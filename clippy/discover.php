<?php
/* =========================================================
 * Clippy backend adapter — live model discovery
 * ---------------------------------------------------------
 * GET /clippy/discover.php?provider=<name>
 *
 * Returns models that the provider currently has installed / exposes,
 * independent of config.json's static list. The browser uses this to
 * populate a "pick an installed model" list when adding a custom entry.
 *
 * Shape:
 *   { "provider": "ollama", "source": "http://127.0.0.1:11434/api/tags",
 *     "models": [ { "id": "gemma4:e4b", "label": "gemma4:e4b (2.8 GB)" } ] }
 *
 * Only works for providers whose config has a public discovery endpoint
 * (Ollama does via /api/tags; Anthropic/OpenAI require an API key but
 * that lookup happens server-side too, so we can add those when they
 * land). An unsupported provider returns { models: [] } with a 200 so
 * the client can just fall back to manual entry.
 * ========================================================= */

declare(strict_types=1);

function respond_json(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(int $status, string $msg, array $extra = []): void {
    respond_json($status, array_merge(['error' => $msg], $extra));
}

// ---- Load config (shared with chat.php / models.php) ----
$configPath = __DIR__ . '/config.json';
if (!file_exists($configPath)) {
    fail(500, 'No config found. Copy config.sample.json to config.json.');
}
$raw = file_get_contents($configPath);
if ($raw === false) fail(500, 'Could not read config.json.');
if (substr($raw, 0, 3) === "\xEF\xBB\xBF") $raw = substr($raw, 3);
$config = json_decode($raw, true);
if (!is_array($config)) fail(500, 'config.json is not valid JSON.');

// ---- CORS (mirrors chat.php / models.php) ----
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

$method = $_SERVER['REQUEST_METHOD'] ?? '';
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

// ---- Pick provider ----
$provider = isset($_GET['provider']) ? preg_replace('/[^a-z0-9_-]/i', '', (string)$_GET['provider']) : '';
if ($provider === '') {
    fail(400, 'Missing provider query parameter.');
}
$pconf = ($config['providers'] ?? [])[$provider] ?? null;
if (!is_array($pconf)) {
    fail(404, 'Unknown provider: ' . $provider);
}

// ---- Dispatch to provider-specific discovery ----
// Adding a new provider: add a case here. Each case must return the
// common shape { provider, source, models: [{id, label}] }.
switch ($provider) {
    case 'ollama':
        $result = discover_ollama($pconf);
        break;

    // case 'anthropic':
    //     $result = discover_anthropic($pconf);
    //     break;

    default:
        // Unknown-but-configured provider: return empty so the client falls
        // back to manual entry without surfacing an error.
        $result = ['provider' => $provider, 'source' => null, 'models' => []];
}

respond_json(200, $result);


/* ---------- provider discovery helpers ---------- */

function discover_ollama(array $pconf): array {
    $base = rtrim((string)($pconf['base_url'] ?? 'http://127.0.0.1:11434'), '/');
    $url  = $base . '/api/tags';
    $timeout = (int)($pconf['timeout'] ?? 10);
    // Discovery should be snappy — use a shorter cap than chat.
    if ($timeout > 30) $timeout = 30;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        // Soft-fail: return empty list + reason so the client can show the
        // user why discovery didn't yield results, but still let them add a
        // model manually.
        return [
            'provider' => 'ollama',
            'source'   => $url,
            'models'   => [],
            'warning'  => trim(($err !== '' ? $err : "HTTP $code") . ' from ' . $url),
        ];
    }
    $data = json_decode($body, true);
    $models = [];
    if (is_array($data) && isset($data['models']) && is_array($data['models'])) {
        foreach ($data['models'] as $m) {
            if (!is_array($m)) continue;
            $id = isset($m['name']) ? (string)$m['name'] : '';
            if ($id === '') continue;
            // Build a friendly label: "<id> (<size>)" when size is available.
            $label = $id;
            if (isset($m['size']) && is_numeric($m['size'])) {
                $gb = round(((float)$m['size']) / 1073741824, 1);
                if ($gb > 0) $label = "$id ({$gb} GB)";
            }
            $models[] = ['id' => $id, 'label' => $label];
        }
    }
    return ['provider' => 'ollama', 'source' => $url, 'models' => $models];
}
