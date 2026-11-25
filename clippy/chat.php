<?php
/* =========================================================
 * Clippy PHP backend adapter — entry point
 * ---------------------------------------------------------
 * Accepts a POST body in Ollama /api/chat shape:
 *   { model, messages: [{role, content}], stream?: false, options?: {} }
 * Routes to the configured provider and returns the same shape back:
 *   { message: { role, content }, ... }
 *
 * Why this exists (vs. a plain Apache reverse proxy): a proxy can't hold
 * API keys for hosted LLMs (Anthropic / OpenAI / etc.), can't normalise
 * between provider protocols, and can't apply policy (rate limits, logs,
 * provider routing). This PHP handler does.
 * ========================================================= */

declare(strict_types=1);

// ---- Response helpers ----
// NB: CORS headers are added (below) *before* any response, so they ride along
// on whatever respond_json() ultimately emits. PHP buffers header() calls
// until the first byte of output, so ordering is fine as long as we set CORS
// before this runs.
function respond_json(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(int $status, string $msg, array $extra = []): void {
    respond_json($status, array_merge(['error' => $msg], $extra));
}

// ---- Load config (needed early for the CORS allowlist) ----
// We moved from config.php to config.json so the catalog can be served to the
// browser (sanitised) by models.php without evaluating PHP, and so the file is
// safer to hand-edit. If someone is upgrading from the old layout, fall back
// to config.php with a deprecation notice.
$config = clippy_load_config(__DIR__);

function clippy_load_config(string $dir): array {
    $jsonPath = $dir . '/config.json';
    $phpPath  = $dir . '/config.php';
    if (file_exists($jsonPath)) {
        $raw = file_get_contents($jsonPath);
        if ($raw === false) fail(500, 'Could not read config.json.');
        // Allow UTF-8 BOM at start (Windows editors).
        if (substr($raw, 0, 3) === "\xEF\xBB\xBF") $raw = substr($raw, 3);
        $parsed = json_decode($raw, true);
        if (!is_array($parsed)) fail(500, 'config.json is not valid JSON: ' . json_last_error_msg());
        return $parsed;
    }
    if (file_exists($phpPath)) {
        error_log('[clippy-api] config.php is deprecated — rename to config.json');
        $parsed = require $phpPath;
        if (!is_array($parsed)) fail(500, 'config.php did not return an array.');
        return $parsed;
    }
    fail(500, 'No config found. Copy config.sample.json to config.json and edit it.');
}

// ---- CORS ----------------------------------------------------------------
// The adapter is same-origin by default. If Clippy is embedded on a page
// served from a different origin than this PHP file, add that origin to
// `allowed_origins` in config.php. The browser's preflight (OPTIONS) runs
// before the widget's POST because the request has Content-Type: application/json,
// which is a "non-simple" header that forces a preflight.
//
// Behaviour:
//   • No Origin header / no allowlist  → no CORS headers emitted (same-origin).
//   • Origin matches an entry (or '*') → echo it back with Vary: Origin so
//     caches don't serve one origin's response to another.
//   • An unmatched Origin               → treated as same-origin-only;
//     the browser will block the response. We don't 403 here — that would
//     break legitimate same-origin POSTs that happen to include an Origin
//     header (all modern browsers do).
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = $config['allowed_origins'] ?? [];
$originAllowed = false;
if ($origin !== '' && is_array($allowed) && !empty($allowed)) {
    if (in_array('*', $allowed, true) || in_array($origin, $allowed, true)) {
        $originAllowed = true;
    }
}
if ($originAllowed) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

// ---- Preflight ----
// Browsers send OPTIONS with Access-Control-Request-{Method,Headers} before
// any cross-origin POST that isn't a "simple" request. We answer 204 with
// the matching headers, or 403 if the origin isn't on the allowlist.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    if (!$originAllowed) {
        http_response_code(403);
        exit;
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    // Echo back whatever the browser said it wanted to send, falling back to
    // the set we actually use. Content-Type is required; X-Clippy-Provider
    // is our routing override.
    $reqHdrs = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? 'Content-Type, X-Clippy-Provider';
    header('Access-Control-Allow-Headers: ' . $reqHdrs);
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

// ---- Method gate ----
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST, OPTIONS');
    fail(405, 'Use POST. Body must be JSON with { model, messages }.');
}

// ---- Read and validate body ----
$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    fail(400, 'Empty request body.');
}
$body = json_decode($raw, true);
if (!is_array($body)) {
    fail(400, 'Request body is not valid JSON.');
}
if (empty($body['messages']) || !is_array($body['messages'])) {
    fail(400, 'Missing "messages" array.');
}
if (empty($body['model']) || !is_string($body['model'])) {
    fail(400, 'Missing "model" string.');
}

// ---- Pick a provider ----
// Routing is intentionally minimal today (single default provider). The
// config file leaves a "routes" stub so we can grow into model-based
// routing later without restructuring the handler.
$providerName = pick_provider($body, $config);
$providerConfig = $config['providers'][$providerName] ?? null;
if (!is_array($providerConfig)) {
    fail(500, "No config for provider: {$providerName}");
}

// ---- Load provider handler ----
$safeName = preg_replace('/[^a-z0-9_-]/i', '', $providerName);
$providerPath = __DIR__ . "/providers/{$safeName}.php";
if ($safeName === '' || !file_exists($providerPath)) {
    fail(500, "Unknown provider: {$providerName}");
}
/** @var callable $handler */
$handler = require $providerPath;
if (!is_callable($handler)) {
    fail(500, "Provider file did not return a callable: {$providerName}");
}

// ---- Invoke ----
try {
    $result = $handler($body, $providerConfig);
} catch (Throwable $e) {
    // Log full detail server-side, return a short message to the client.
    error_log('[clippy-api] provider error: ' . $e->getMessage());
    fail(502, 'Provider error: ' . $e->getMessage());
}

if (!is_array($result)) {
    fail(502, 'Provider returned non-object response.');
}
respond_json(200, $result);


/* ---------- helpers ---------- */

function pick_provider(array $body, array $config): string {
    // Explicit request header wins (e.g., "X-Clippy-Provider: anthropic").
    $headerProvider = $_SERVER['HTTP_X_CLIPPY_PROVIDER'] ?? null;
    if (is_string($headerProvider) && $headerProvider !== '') {
        return strtolower($headerProvider);
    }

    // Route table (regex → provider). Optional — skip entirely if empty.
    $routes = $config['routes'] ?? [];
    if (is_array($routes) && !empty($routes) && !empty($body['model'])) {
        foreach ($routes as $pattern => $provider) {
            if (@preg_match($pattern, (string)$body['model'])) {
                return (string)$provider;
            }
        }
    }

    return (string)($config['default_provider'] ?? 'ollama');
}
