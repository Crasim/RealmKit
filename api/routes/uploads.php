<?php
/**
 * uploads.php — Sprite/asset upload handler
 *
 * POST /uploads
 *   Accepts a PNG file upload (spritesheet from sprite-builder.html)
 *   Saves to RealmKit/assets/sprites/generated/<uuid>.png
 *   Returns { url, filename, asset_key } on success
 *
 * Optional body params (multipart):
 *   asset_key  — human-friendly key for the asset (e.g. "hero_walk")
 *   story_id   — if provided, also inserts a row in the assets table
 *   width      — sprite frame width  (informational, stored in meta)
 *   height     — sprite frame height (informational, stored in meta)
 *   frame_count — number of frames in the sheet
 */

// ── Config ───────────────────────────────────────────────────────────────────
const UPLOAD_DIR     = __DIR__ . '/../../assets/sprites/generated/';
const UPLOAD_URL_BASE = '/RealmKit/assets/sprites/generated/';
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME   = ['image/png'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function upload_error(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function ensure_upload_dir(): void {
    if (!is_dir(UPLOAD_DIR)) {
        if (!mkdir(UPLOAD_DIR, 0755, true)) {
            upload_error('Could not create upload directory', 500);
        }
    }
}

// ── Routing ──────────────────────────────────────────────────────────────────

if ($method === 'POST') {

    // ── Validate file presence ────────────────────────────────────────────────
    if (empty($_FILES['file'])) {
        upload_error('No file uploaded — expected multipart field "file"');
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
        upload_error($php_errors[$file['error']] ?? 'Unknown upload error', 500);
    }

    // ── Size check ────────────────────────────────────────────────────────────
    if ($file['size'] > MAX_FILE_BYTES) {
        upload_error('File too large (max 4 MB)');
    }

    // ── MIME validation (sniff actual bytes, not client header) ───────────────
    $finfo    = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    if (!in_array($mimeType, ALLOWED_MIME, true)) {
        upload_error("Invalid file type ($mimeType) — only PNG accepted");
    }

    // ── PNG magic bytes double-check ──────────────────────────────────────────
    $handle = fopen($file['tmp_name'], 'rb');
    $magic  = fread($handle, 8);
    fclose($handle);
    if ($magic !== "\x89PNG\r\n\x1a\n") {
        upload_error('File does not appear to be a valid PNG');
    }

    // ── Build destination path ────────────────────────────────────────────────
    ensure_upload_dir();

    $uuid      = new_uuid();
    $assetKey  = trim($_POST['asset_key'] ?? '');
    $storyId   = trim($_POST['story_id']  ?? '');

    // Sanitise asset_key for use in filename (alphanumeric + _ -)
    $safeKey = preg_replace('/[^a-z0-9_\-]/i', '_', $assetKey);
    $safeKey = substr($safeKey, 0, 64);

    $filename = $safeKey !== '' ? "{$safeKey}_{$uuid}.png" : "{$uuid}.png";
    $destPath = UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        upload_error('Failed to save uploaded file', 500);
    }

    $url = UPLOAD_URL_BASE . $filename;

    // ── Optional: insert into assets table ───────────────────────────────────
    $assetId = null;
    if ($storyId !== '') {
        $width      = (int)($_POST['width']       ?? 0);
        $height     = (int)($_POST['height']      ?? 0);
        $frameCount = (int)($_POST['frame_count'] ?? 1);

        $meta = json_encode([
            'frame_width'  => $width,
            'frame_height' => $height,
            'frame_count'  => $frameCount,
            'source'       => 'sprite_builder',
        ]);

        $assetId = new_uuid();
        db_run(
            'INSERT INTO assets (id, story_id, asset_key, asset_type, file_path, meta)
             VALUES (:id, :story_id, :asset_key, :asset_type, :file_path, :meta)',
            coalesce_params([
                ':id'         => $assetId,
                ':story_id'   => $storyId,
                ':asset_key'  => $assetKey !== '' ? $assetKey : $filename,
                ':asset_type' => 'spritesheet',
                ':file_path'  => $url,
                ':meta'       => $meta,
            ])
        );
    }

    $response = [
        'url'       => $url,
        'filename'  => $filename,
        'asset_key' => $assetKey !== '' ? $assetKey : null,
    ];
    if ($assetId !== null) {
        $response['asset_id'] = $assetId;
    }

    http_response_code(201);
    echo json_encode($response);

} elseif ($method === 'GET') {

    // ── List generated sprites ───────────────────────────────────────────────
    ensure_upload_dir();
    $files = glob(UPLOAD_DIR . '*.png') ?: [];
    $list  = array_map(function (string $path): array {
        $name = basename($path);
        return [
            'filename' => $name,
            'url'      => UPLOAD_URL_BASE . $name,
            'size'     => filesize($path),
            'modified' => date('c', filemtime($path)),
        ];
    }, $files);

    // Newest first
    usort($list, fn($a, $b) => strcmp($b['modified'], $a['modified']));

    echo json_encode(['files' => $list, 'count' => count($list)]);

} else {
    http_response_code(405);
    header('Allow: GET, POST');
    echo json_encode(['error' => 'Method not allowed']);
}
