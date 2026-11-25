<?php
/**
 * db.php — SQLite connection and helpers
 *
 * Uses PHP's built-in PDO + pdo_sqlite (enabled by default in XAMPP/WAMP/LAMP).
 * The database file is created automatically on first request.
 */

define('DB_PATH', dirname(__DIR__) . '/realmkit.db');
define('SCHEMA_PATH', __DIR__ . '/migrations/001_initial_schema.sql');

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // Enable FK enforcement and WAL mode
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');

    // Run all schema migrations in order
    run_migrations($pdo);

    return $pdo;
}

/** Run all SQL migrations in migrations/ folder in order, each at most once. */
function run_migrations(PDO $pdo): void {
    // Ensure the tracking table exists first
    $pdo->exec('CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime(\'now\'))
    )');

    // Bootstrap: if the DB already has the `assets` table it was created before
    // the tracking table existed (001–003 applied via the old bare exec() path).
    // Mark those legacy files as done so we never try to re-run them.
    $assetsExists = $pdo->query(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='assets'"
    )->fetchColumn();
    if ($assetsExists) {
        foreach (['001_initial_schema.sql', '002_tileset_overlap.sql', '003_unit_templates.sql'] as $f) {
            $pdo->exec("INSERT OR IGNORE INTO _migrations (filename) VALUES (" . $pdo->quote($f) . ")");
        }
    }

    $migrationsDir = __DIR__ . '/migrations';
    $files = glob($migrationsDir . '/*.sql');
    sort($files); // 001, 002, 003… order

    foreach ($files as $file) {
        $filename = basename($file);

        // Skip if already applied
        $applied = $pdo->query(
            "SELECT 1 FROM _migrations WHERE filename = " . $pdo->quote($filename)
        )->fetchColumn();
        if ($applied) continue;

        // Run the whole file at once
        try {
            $pdo->exec(file_get_contents($file));
            // Mark as applied only after clean execution
            $pdo->exec("INSERT OR IGNORE INTO _migrations (filename) VALUES (" . $pdo->quote($filename) . ")");
        } catch (PDOException $e) {
            // Log error but continue to allow other migrations/API to work
            error_log("Migration failed ($filename): " . $e->getMessage());
            // If it's a "duplicate column" error, we can still mark it as applied to move on
            $msg = $e->getMessage();
            if (strpos($msg, 'duplicate column name') !== false || strpos($msg, 'already exists') !== false) {
                $pdo->exec("INSERT OR IGNORE INTO _migrations (filename) VALUES (" . $pdo->quote($filename) . ")");
            }
        }
    }
}

/** Return all rows for a query. */
function db_all(string $sql, array $params = []): array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/** Return the first row, or null. */
function db_get(string $sql, array $params = []): ?array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

/** Execute a write statement. Returns number of affected rows. */
function db_run(string $sql, array $params = []): int {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

/** Generate a UUID v4. */
function new_uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40); // version 4
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80); // variant
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/** Cast PHP nulls/empty cleanly for SQLite named params. */
function coalesce_params(array $arr): array {
    return array_map(fn($v) => $v === '' ? null : $v, $arr);
}
