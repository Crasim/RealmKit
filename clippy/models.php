<?php
/* =========================================================
 * Clippy backend adapter — public catalog endpoint
 * ---------------------------------------------------------
 * GET /clippy/models.php
 *
 * Returns a SANITISED subset of config.json — provider ids + labels and
 * their available models — so the widget can render Provider and Model
 * dropdowns without ever seeing secrets. Shape:
 *
 *   {
 *     "default_provider": "ollama",
 *     "providers": {
 *       "ollama": {
 *         "label": "Ollama (local)",
 *         "models": [ { "id": "gemma4:e4b", "label": "Gemma 4 e4b" } ]
 *       }
 *     }
 *   }
 *
 * We reuse the same CORS rules as chat.php (driven by config.allowed_origins)
 * so the two endpoints behave identically from the browser's perspective.
 * ========================================================= */

declare(strict_types=1);

function respond_json(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    // Cache briefly in the browser — catalogs change rarely.
    header('Cache-Control: public, max-age=60');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(int $status, string $msg, array $extra = []): void {
    respond_json($status, array_merge(['error' => $msg], $extra));
}

// ---- Method gate ----
// GET (or HEAD) only. OPTIONS is the CORS preflight and is handled below.
$method = $_SERVER['REQUEST_METHOD'] ?? '';

// ---- Load config (for CORS allowlist + catalog) ----
$configPath = __DIR__ . '/config.json';
if (!file_exists($configPath)) {
    // Deprecated fallback.
    $configPath = __DIR__ . '/config.php';
}
if (!file_exists($configPath)) {
    fail(500, 'No config found. Copy config.sample.json to config.json.');
}
$config = null;
if (substr($configPath, -5) === '.json') {
    $raw = file_get_contents($configPath);
    if ($raw === false) fail(500, 'Could not read config.json.');
    if (substr($raw, 0, 3) === "\xEF\xBB\xBF") $raw = substr($raw, 3);
    $config = json_decode($raw, true);
} else {
    $config = require $configPath;
}
if (!is_array($config)) {
    fail(500, 'Config is not a valid map.');
}

// ---- CORS (mirrors chat.php) ----
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

if ($method === 'OPTIONS') {
    if (!$originAllowed) { http_response_code(403); exit; }
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    $reqHdrs = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? 'Content-Type';
    header('Access-Control-Allow-Headers: ' . $reqHdrs);
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

if ($method !== 'GET' && $method !== 'HEAD') {
    header('Allow: GET, HEAD, OPTIONS');
    fail(405, 'Use GET.');
}

// ---- Build the sanitised catalog ----
// Only things the browser needs are emitted. api_key, base_url, timeout,
// routes, and any _note/_comment-style keys are dropped. Provider entries
// whose id starts with '_' are treated as scaffolding and omitted — that's
// what lets config.sample.json stash disabled blocks under names like
// "_anthropic".
$catalog = [
    'default_provider' => (string)($config['default_provider'] ?? ''),
    'providers'        => new stdClass(), // force {} in JSON even if empty
];
$providers = $config['providers'] ?? [];
$publicProviders = [];
if (is_array($providers)) {
    foreach ($providers as $name => $p) {
        if (!is_string($name) || $name === '' || $name[0] === '_') continue;
        if (!is_array($p)) continue;
        $models = [];
        foreach (($p['models'] ?? []) as $m) {
            if (!is_array($m)) continue;
            $id = isset($m['id']) ? (string)$m['id'] : '';
            if ($id === '') continue;
            $label = isset($m['label']) ? (string)$m['label'] : $id;
            $models[] = ['id' => $id, 'label' => $label];
        }
        $publicProviders[$name] = [
            'label'  => (string)($p['label'] ?? $name),
            'models' => $models,
        ];
    }
}
if (!empty($publicProviders)) {
    $catalog['providers'] = $publicProviders;
}

respond_json(200, $catalog);
