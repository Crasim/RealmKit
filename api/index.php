<?php
/**
 * index.php — Front controller / router
 */

// Check PHP version
if (version_compare(PHP_VERSION, '8.0.0', '<')) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'RealmKit API requires PHP 8.0 or higher. Current version: ' . PHP_VERSION]);
    exit;
}

// ── CORS headers ──────────────────────────────────────────────
$origin = $_ENV['CLIENT_ORIGIN'] ?? $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Pre-flight OPTIONS — return early
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Parse request ─────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];

// Strip base path (everything up to and including /api) from the URI
$scriptDir  = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path       = trim(substr($requestUri, strlen($scriptDir)), '/');

// Split into segments: ['stories', '123', 'flags'] etc.
$segments = $path !== '' ? explode('/', $path) : [];

// Request body (for POST / PUT / PATCH)
$body = [];
if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
}

// ── Helper: send JSON response ────────────────────────────────
function json_response(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function not_found(string $msg = 'Not found'): never {
    json_response(['error' => $msg], 404);
}

function bad_request(string $msg): never {
    json_response(['error' => $msg], 400);
}

function server_error(string $msg): never {
    json_response(['error' => $msg], 500);
}

// ── Global error handling ─────────────────────────────────────
set_exception_handler(function (Throwable $e) {
    error_log("API Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()]);
    exit;
});

// ── Route ─────────────────────────────────────────────────────
require_once __DIR__ . '/db.php';

$resource = $segments[0] ?? '';

    try {
    match ($resource) {
        'stories'        => require __DIR__ . '/routes/stories.php',
        'saves'          => require __DIR__ . '/routes/saves.php',
        'characters'     => require __DIR__ . '/routes/characters.php',
        'quests'         => require __DIR__ . '/routes/quests.php',
        'dialogues'      => require __DIR__ . '/routes/dialogues.php',
        'scenes'         => require __DIR__ . '/routes/scenes.php',
        'assets'         => require __DIR__ . '/routes/assets.php',
        'uploads'        => require __DIR__ . '/routes/uploads.php',
        'pp-assets'      => require __DIR__ . '/routes/pp-assets.php',
        'audio-projects' => require __DIR__ . '/routes/audio-projects.php',
        'maps'           => require __DIR__ . '/routes/maps.php',
        'sprite-templates' => require __DIR__ . '/routes/sprite-templates.php',
        'unit-templates'   => require __DIR__ . '/routes/unit-templates.php',
        'factions'         => require __DIR__ . '/routes/factions.php',
        'skills'           => require __DIR__ . '/routes/skills.php',
        'events'           => require __DIR__ . '/routes/events.php',
        'health'         => json_response(['status' => 'ok', 'db' => DB_PATH]),
        default          => not_found("Unknown resource: $resource"),
    };
} catch (PDOException $e) {
    server_error('Database error: ' . $e->getMessage());
} catch (Throwable $e) {
    server_error($e->getMessage());
}
