<?php
/**
 * pp-assets.php — Pixel Painter asset management
 *
 * Hybrid storage: PNG images on the server filesystem, metadata in SQLite.
 *
 * GET    /pp-assets              — list all assets (lightweight metadata only)
 * GET    /pp-assets?category=X   — filter by category
 * GET    /pp-assets/{id}         — single asset record
 * POST   /pp-assets              — upload PNG + save metadata  (multipart/form-data)
 * PATCH  /pp-assets/{id}         — update metadata only        (application/json)
 * DELETE /pp-assets/{id}         — remove file + DB row
 */

// ── Config ────────────────────────────────────────────────────────────────────
const PP_UPLOAD_DIR      = __DIR__ . '/../../assets/sprites/pp/';
const PP_UPLOAD_URL_BASE = '/RealmKit/assets/sprites/pp/';
const PP_MAX_FILE_BYTES  = 8 * 1024 * 1024;  // 8 MB
const PP_ALLOWED_MIME    = ['image/png'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pp_error(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function pp_ensure_dir(): void {
    if (!is_dir(PP_UPLOAD_DIR)) {
        if (!mkdir(PP_UPLOAD_DIR, 0755, true)) {
            pp_error('Could not create upload directory', 500);
        }
    }
}

/** Map a DB row to the catalog entry shape expected by the front-end. */
function pp_row_to_catalog(array $row): array {
    return [
        'id'            => $row['id'],
        'name'          => $row['name'],
        'category'      => $row['category'],
        'file_path'     => $row['file_path'],
        'frameW'        => (int) $row['frame_w'],
        'frameH'        => (int) $row['frame_h'],
        'frame_count'   => (int) $row['frame_count'],
        'cols'          => (int) $row['cols'],
        'scale'         => (float) $row['scale'],
        'template_id'   => $row['template_id'],
        'template_name' => $row['template_name'],
        'biome'         => $row['biome'],
        'tags'          => $row['tags'],
        'saved_at'      => $row['created_at'],
        'updated_at'    => $row['updated_at'],
        'meta'          => $row['meta'] ? json_decode($row['meta'], true) : null,
    ];
}

// ── Route ─────────────────────────────────────────────────────────────────────

$id = $segments[1] ?? null;   // /pp-assets/{id}

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {

    if ($id !== null) {
        // Single record
        $row = db_get('SELECT * FROM pixel_painter_assets WHERE id = ?', [$id]);
        if (!$row) pp_error("Asset '$id' not found", 404);
        echo json_encode(pp_row_to_catalog($row));
    } else {
        // List — optional ?category= filter
        $category = $_GET['category'] ?? null;
        if ($category !== null) {
            $rows = db_all(
                'SELECT * FROM pixel_painter_assets WHERE category = ? ORDER BY created_at DESC',
                [$category]
            );
        } else {
            $rows = db_all('SELECT * FROM pixel_painter_assets ORDER BY created_at DESC');
        }
        echo json_encode(array_map('pp_row_to_catalog', $rows));
    }

// ── POST (upload) ─────────────────────────────────────────────────────────────
} elseif ($method === 'POST') {

    if (empty($_FILES['file'])) {
        pp_error('No file uploaded — expected multipart field "file"');
    }

    $file = $_FILES['file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $php_errors = [
            UPLOAD_ERR_INI_SIZE   => 'File exceeds upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL    => 'File only partially uploaded',
            UPLOAD_ERR_NO_FILE    => 'No file uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temp folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write to disk',
            UPLOAD_ERR_EXTENSION  => 'Upload blocked by PHP extension',
        ];
        pp_error($php_errors[$file['error']] ?? 'Unknown upload error', 500);
    }

    if ($file['size'] > PP_MAX_FILE_BYTES) {
        pp_error('File too large (max 8 MB)');
    }

    // MIME + magic bytes validation
    $finfo    = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    if (!in_array($mimeType, PP_ALLOWED_MIME, true)) {
        pp_error("Invalid file type ($mimeType) — only PNG accepted");
    }

    $handle = fopen($file['tmp_name'], 'rb');
    $magic  = fread($handle, 8);
    fclose($handle);
    if ($magic !== "\x89PNG\r\n\x1a\n") {
        pp_error('File does not appear to be a valid PNG');
    }

    pp_ensure_dir();

    // Determine ID — use client-supplied id if provided (for upsert on re-save)
    $clientId = trim($_POST['id'] ?? '');
    $assetId  = $clientId !== '' ? $clientId : new_uuid();

    $name     = trim($_POST['name']          ?? 'Untitled');
    $category = trim($_POST['category']      ?? 'tileset');
    $frameW   = (int)($_POST['frame_w']      ?? $_POST['frameW']  ?? 32);
    $frameH   = (int)($_POST['frame_h']      ?? $_POST['frameH']  ?? 32);
    $frameCnt = (int)($_POST['frame_count']  ?? 1);
    $cols     = (int)($_POST['cols']         ?? 8);
    $scale    = (float)($_POST['scale']      ?? 1.0);
    $tmplId   = trim($_POST['template_id']   ?? '');
    $tmplName = trim($_POST['template_name'] ?? '');
    $biome    = trim($_POST['biome']         ?? '');
    $tags     = trim($_POST['tags']          ?? '');
    $metaRaw  = trim($_POST['meta']          ?? '');

    // Build filename: {safeId}.png (deterministic — overwrite on re-save)
    $safeId   = preg_replace('/[^a-z0-9_\-]/i', '_', $assetId);
    $filename = $safeId . '.png';
    $destPath = PP_UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        pp_error('Failed to save uploaded file', 500);
    }

    $filePath = PP_UPLOAD_URL_BASE . $filename;

    // Upsert into DB (INSERT OR REPLACE respects PRIMARY KEY)
    db_run(
        'INSERT OR REPLACE INTO pixel_painter_assets
             (id, name, category, file_path, frame_w, frame_h, frame_count,
              cols, scale, template_id, template_name, biome, tags, meta,
              created_at, updated_at)
         VALUES
             (:id, :name, :category, :file_path, :frame_w, :frame_h, :frame_count,
              :cols, :scale, :template_id, :template_name, :biome, :tags, :meta,
              COALESCE((SELECT created_at FROM pixel_painter_assets WHERE id = :id2), datetime(\'now\')),
              datetime(\'now\'))',
        coalesce_params([
            ':id'            => $assetId,
            ':id2'           => $assetId,
            ':name'          => $name,
            ':category'      => $category,
            ':file_path'     => $filePath,
            ':frame_w'       => $frameW,
            ':frame_h'       => $frameH,
            ':frame_count'   => $frameCnt,
            ':cols'          => $cols,
            ':scale'         => $scale,
            ':template_id'   => $tmplId   !== '' ? $tmplId   : null,
            ':template_name' => $tmplName !== '' ? $tmplName : null,
            ':biome'         => $biome    !== '' ? $biome    : null,
            ':tags'          => $tags     !== '' ? $tags     : null,
            ':meta'          => $metaRaw  !== '' ? $metaRaw  : null,
        ])
    );

    $row = db_get('SELECT * FROM pixel_painter_assets WHERE id = ?', [$assetId]);
    http_response_code(201);
    echo json_encode(pp_row_to_catalog($row));

// ── PATCH (metadata update) ───────────────────────────────────────────────────
} elseif ($method === 'PATCH') {

    if (!$id) pp_error('Asset ID required', 400);

    $row = db_get('SELECT * FROM pixel_painter_assets WHERE id = ?', [$id]);
    if (!$row) pp_error("Asset '$id' not found", 404);

    // Only update fields that were provided
    $allowed = ['name', 'category', 'tags', 'biome', 'template_id', 'template_name',
                'frame_w', 'frame_h', 'frame_count', 'cols', 'scale', 'meta'];

    $sets   = ['updated_at = datetime(\'now\')'];
    $params = [':id' => $id];

    foreach ($allowed as $field) {
        $bodyKey = match($field) {
            'frame_w' => 'frameW',
            'frame_h' => 'frameH',
            default   => $field,
        };
        if (array_key_exists($bodyKey, $body) || array_key_exists($field, $body)) {
            $val = $body[$bodyKey] ?? $body[$field];
            $sets[] = "$field = :$field";
            $params[":$field"] = $val;
        }
    }

    if (count($sets) === 1) {
        // Only updated_at changed — nothing to do, just return current
        echo json_encode(pp_row_to_catalog($row));
    } else {
        db_run(
            'UPDATE pixel_painter_assets SET ' . implode(', ', $sets) . ' WHERE id = :id',
            $params
        );
        $updated = db_get('SELECT * FROM pixel_painter_assets WHERE id = ?', [$id]);
        echo json_encode(pp_row_to_catalog($updated));
    }

// ── DELETE ────────────────────────────────────────────────────────────────────
} elseif ($method === 'DELETE') {

    if (!$id) pp_error('Asset ID required', 400);

    $row = db_get('SELECT * FROM pixel_painter_assets WHERE id = ?', [$id]);
    if (!$row) pp_error("Asset '$id' not found", 404);

    // Remove file from disk
    $safeId   = preg_replace('/[^a-z0-9_\-]/i', '_', $id);
    $filename = $safeId . '.png';
    $filePath = PP_UPLOAD_DIR . $filename;
    if (file_exists($filePath)) {
        @unlink($filePath);
    }

    db_run('DELETE FROM pixel_painter_assets WHERE id = ?', [$id]);

    http_response_code(200);
    echo json_encode(['deleted' => $id]);

} else {
    http_response_code(405);
    header('Allow: GET, POST, PATCH, DELETE');
    echo json_encode(['error' => 'Method not allowed']);
}
