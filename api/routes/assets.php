<?php
/**
 * /api/assets
 */

$id  = $segments[1] ?? null;   // 'story' | asset-uuid
$sub = $segments[2] ?? null;   // story-id (when $id === 'story')

// GET /assets/story/:storyId
// Returns story-scoped assets + global assets (story_id IS NULL).
// When the same asset_key exists in both, both rows are returned;
// the client should prefer the story-scoped one.
if ($method === 'GET' && $id === 'story' && $sub) {
    json_response(db_all(
        'SELECT * FROM assets
          WHERE story_id = :sid OR story_id IS NULL
          ORDER BY asset_type, asset_key',
        [':sid' => $sub]
    ));
}

// GET /assets/:id
// Returns a single asset by ID.
if ($method === 'GET' && $id && $id !== 'story') {
    $asset = db_get('SELECT * FROM assets WHERE id = :id', [':id' => $id]);
    if (!$asset) not_found();
    json_response($asset);
}

// POST /assets/story/:storyId
if ($method === 'POST' && $id === 'story' && $sub) {
    if (empty($body['asset_key']))   bad_request('asset_key is required');
    if (empty($body['asset_type']))  bad_request('asset_type is required');
    if (empty($body['source_type'])) bad_request('source_type is required');
    if ($body['source_type'] === 'url' && empty($body['source_url']))
        bad_request('source_url is required when source_type is url');

    $aid = new_uuid();
    db_run(
        'INSERT INTO assets
            (id, story_id, asset_key, asset_type, source_type, source_url,
             proc_tile_size, proc_cols, proc_rows, proc_seed, overlap_top, overlap_left)
         VALUES
            (:id,:sid,:akey,:atype,:stype,:url,:pts,:cols,:rows,:seed,:ot,:ol)',
        [
            ':id'    => $aid,
            ':sid'   => $sub,
            ':akey'  => $body['asset_key'],
            ':atype' => $body['asset_type'],
            ':stype' => $body['source_type'],
            ':url'   => $body['source_url']     ?? null,
            ':pts'   => $body['proc_tile_size'] ?? null,
            ':cols'  => $body['proc_cols']      ?? null,
            ':rows'  => $body['proc_rows']      ?? null,
            ':seed'  => $body['proc_seed']      ?? null,
            ':ot'    => $body['overlap_top']    ?? 0,
            ':ol'    => $body['overlap_left']   ?? 0,
        ]
    );
    json_response(db_get('SELECT * FROM assets WHERE id = :id', [':id' => $aid]), 201);
}

// PATCH /assets/:id
if ($method === 'PATCH' && $id && $id !== 'story') {
    db_run(
        'UPDATE assets SET
            asset_key      = COALESCE(:akey,  asset_key),
            asset_type     = COALESCE(:atype, asset_type),
            source_type    = COALESCE(:stype, source_type),
            source_url     = COALESCE(:url,   source_url),
            proc_tile_size = COALESCE(:pts,   proc_tile_size),
            proc_cols      = COALESCE(:cols,  proc_cols),
            proc_rows      = COALESCE(:rows,  proc_rows),
            proc_seed      = COALESCE(:seed,  proc_seed),
            overlap_top    = COALESCE(:ot,    overlap_top),
            overlap_left   = COALESCE(:ol,   overlap_left)
         WHERE id = :id',
        [
            ':id'    => $id,
            ':akey'  => $body['asset_key']      ?? null,
            ':atype' => $body['asset_type']      ?? null,
            ':stype' => $body['source_type']     ?? null,
            ':url'   => $body['source_url']      ?? null,
            ':pts'   => $body['proc_tile_size']  ?? null,
            ':cols'  => $body['proc_cols']       ?? null,
            ':rows'  => $body['proc_rows']       ?? null,
            ':seed'  => $body['proc_seed']       ?? null,
            ':ot'    => $body['overlap_top']     ?? null,
            ':ol'    => $body['overlap_left']    ?? null,
        ]
    );
    json_response(db_get('SELECT * FROM assets WHERE id = :id', [':id' => $id]));
}

// DELETE /assets/:id
if ($method === 'DELETE' && $id && $id !== 'story') {
    db_run('DELETE FROM assets WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

not_found();
