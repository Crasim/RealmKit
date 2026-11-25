<?php
/**
 * /api/sprite-templates
 *
 * GET  /sprite-templates              — list all templates (summary)
 * GET  /sprite-templates/:id          — template + full regions
 * POST /sprite-templates              — create new template
 * PATCH /sprite-templates/:id         — update template meta
 * DELETE /sprite-templates/:id        — delete (cascades regions)
 *
 * Regions sub-resource:
 * GET    /sprite-templates/:id/regions          — list regions ordered by start_frame
 * POST   /sprite-templates/:id/regions          — add a region
 * PATCH  /sprite-templates/:id/regions/:rid     — update a region
 * DELETE /sprite-templates/:id/regions/:rid     — remove a region
 */

$id  = $segments[1] ?? null;
$sub = $segments[2] ?? null;   // 'regions'
$rid = $segments[3] ?? null;   // region id

// ── GET /sprite-templates ─────────────────────────────────────────────────────
if ($method === 'GET' && !$id) {
    json_response(db_all('SELECT * FROM sprite_templates ORDER BY category, name'));
}

// ── GET /sprite-templates/:id ─────────────────────────────────────────────────
if ($method === 'GET' && $id && !$sub) {
    $tpl = db_get('SELECT * FROM sprite_templates WHERE id = :id', [':id' => $id]);
    if (!$tpl) not_found('Sprite template not found');
    $tpl['regions'] = db_all(
        'SELECT * FROM sprite_template_regions WHERE template_id = :tid ORDER BY start_frame',
        [':tid' => $id]
    );
    json_response($tpl);
}

// ── GET /sprite-templates/:id/regions ────────────────────────────────────────
if ($method === 'GET' && $id && $sub === 'regions' && !$rid) {
    json_response(db_all(
        'SELECT * FROM sprite_template_regions WHERE template_id = :tid ORDER BY sort_order, start_frame',
        [':tid' => $id]
    ));
}

// ── POST /sprite-templates ────────────────────────────────────────────────────
if ($method === 'POST' && !$id) {
    foreach (['name','frame_w','frame_h'] as $f) {
        if (empty($body[$f])) bad_request("$f is required");
    }
    $tid = new_uuid();
    db_run('INSERT INTO sprite_templates
                (id, name, description, category, frame_w, frame_h, cols_per_row, has_directions, directions)
            VALUES (:id,:name,:desc,:cat,:fw,:fh,:cols,:hdir,:dirs)',
        [':id'   => $tid,
         ':name' => $body['name'],
         ':desc' => $body['description']   ?? null,
         ':cat'  => $body['category']      ?? 'character',
         ':fw'   => (int)$body['frame_w'],
         ':fh'   => (int)$body['frame_h'],
         ':cols' => (int)($body['cols_per_row']   ?? 14),
         ':hdir' => empty($body['has_directions']) ? 0 : 1,
         ':dirs' => isset($body['directions']) ? json_encode($body['directions']) : '["down","up","left","right"]',
        ]);
    $tpl = db_get('SELECT * FROM sprite_templates WHERE id = :id', [':id' => $tid]);
    $tpl['regions'] = [];
    json_response($tpl, 201);
}

// ── POST /sprite-templates/:id/regions ───────────────────────────────────────
if ($method === 'POST' && $id && $sub === 'regions' && !$rid) {
    foreach (['anim_name','display_name','start_frame','frame_count'] as $f) {
        if (!isset($body[$f]) || $body[$f] === '') bad_request("$f is required");
    }

    $newStart = (int)$body['start_frame'];
    $newEnd   = $newStart + (int)$body['frame_count'] - 1;

    // Validate no overlap with existing regions
    $existing = db_all(
        'SELECT anim_name, start_frame, frame_count FROM sprite_template_regions
          WHERE template_id = :tid',
        [':tid' => $id]
    );
    foreach ($existing as $r) {
        $rEnd = $r['start_frame'] + $r['frame_count'] - 1;
        if ($newStart <= $rEnd && $newEnd >= $r['start_frame']) {
            bad_request("Region overlaps '{$r['anim_name']}' (frames {$r['start_frame']}–{$rEnd})");
        }
    }

    $rid_new = new_uuid();
    db_run('INSERT INTO sprite_template_regions
                (id, template_id, anim_name, display_name, start_frame,
                 frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
            VALUES (:id,:tid,:anim,:dn,:sf,:fc,:fps,:loop,:next,:req,:fb,:sort)',
        [':id'   => $rid_new,
         ':tid'  => $id,
         ':anim' => $body['anim_name'],
         ':dn'   => $body['display_name'],
         ':sf'   => $newStart,
         ':fc'   => (int)$body['frame_count'],
         ':fps'  => (float)($body['fps']          ?? 8.0),
         ':loop' => empty($body['loop'])           ? 0 : 1,
         ':next' => $body['next_anim']             ?? null,
         ':req'  => empty($body['is_required'])    ? 0 : 1,
         ':fb'   => $body['fallback_anim']         ?? null,
         ':sort' => (int)($body['sort_order']      ?? 0),
        ]);
    json_response(db_get('SELECT * FROM sprite_template_regions WHERE id = :id', [':id' => $rid_new]), 201);
}

// ── PATCH /sprite-templates/:id ──────────────────────────────────────────────
if ($method === 'PATCH' && $id && !$sub) {
    db_run('UPDATE sprite_templates SET
                name            = COALESCE(:name, name),
                description     = COALESCE(:desc, description),
                category        = COALESCE(:cat,  category),
                frame_w         = COALESCE(:fw,   frame_w),
                frame_h         = COALESCE(:fh,   frame_h),
                cols_per_row    = COALESCE(:cols, cols_per_row),
                has_directions  = COALESCE(:hdir, has_directions),
                directions      = COALESCE(:dirs, directions)
            WHERE id = :id',
        [':id'   => $id,
         ':name' => $body['name']          ?? null,
         ':desc' => $body['description']   ?? null,
         ':cat'  => $body['category']      ?? null,
         ':fw'   => isset($body['frame_w']) ? (int)$body['frame_w'] : null,
         ':fh'   => isset($body['frame_h']) ? (int)$body['frame_h'] : null,
         ':cols' => isset($body['cols_per_row']) ? (int)$body['cols_per_row'] : null,
         ':hdir' => isset($body['has_directions']) ? ($body['has_directions'] ? 1 : 0) : null,
         ':dirs' => isset($body['directions']) ? json_encode($body['directions']) : null,
        ]);
    $tpl = db_get('SELECT * FROM sprite_templates WHERE id = :id', [':id' => $id]);
    if (!$tpl) not_found('Sprite template not found');
    $tpl['regions'] = db_all(
        'SELECT * FROM sprite_template_regions WHERE template_id = :tid ORDER BY start_frame',
        [':tid' => $id]
    );
    json_response($tpl);
}

// ── PATCH /sprite-templates/:id/regions/:rid ─────────────────────────────────
if ($method === 'PATCH' && $id && $sub === 'regions' && $rid) {
    db_run('UPDATE sprite_template_regions SET
                anim_name    = COALESCE(:anim, anim_name),
                display_name = COALESCE(:dn,   display_name),
                start_frame  = COALESCE(:sf,   start_frame),
                frame_count  = COALESCE(:fc,   frame_count),
                fps          = COALESCE(:fps,  fps),
                loop         = COALESCE(:loop, loop),
                next_anim    = COALESCE(:next, next_anim),
                is_required  = COALESCE(:req,  is_required),
                fallback_anim= COALESCE(:fb,   fallback_anim),
                sort_order   = COALESCE(:sort, sort_order)
            WHERE id = :rid AND template_id = :tid',
        [':rid'  => $rid,
         ':tid'  => $id,
         ':anim' => $body['anim_name']     ?? null,
         ':dn'   => $body['display_name']  ?? null,
         ':sf'   => isset($body['start_frame'])   ? (int)$body['start_frame']   : null,
         ':fc'   => isset($body['frame_count'])   ? (int)$body['frame_count']   : null,
         ':fps'  => isset($body['fps'])           ? (float)$body['fps']         : null,
         ':loop' => isset($body['loop'])          ? ($body['loop'] ? 1 : 0)     : null,
         ':next' => $body['next_anim']            ?? null,
         ':req'  => isset($body['is_required'])   ? ($body['is_required'] ? 1 : 0) : null,
         ':fb'   => $body['fallback_anim']        ?? null,
         ':sort' => isset($body['sort_order'])    ? (int)$body['sort_order']    : null,
        ]);
    $reg = db_get('SELECT * FROM sprite_template_regions WHERE id = :id', [':id' => $rid]);
    if (!$reg) not_found('Region not found');
    json_response($reg);
}

// ── DELETE /sprite-templates/:id ─────────────────────────────────────────────
if ($method === 'DELETE' && $id && !$sub) {
    db_run('DELETE FROM sprite_templates WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

// ── DELETE /sprite-templates/:id/regions/:rid ────────────────────────────────
if ($method === 'DELETE' && $id && $sub === 'regions' && $rid) {
    db_run('DELETE FROM sprite_template_regions WHERE id = :rid AND template_id = :tid',
        [':rid' => $rid, ':tid' => $id]);
    json_response(['deleted' => true]);
}

not_found();
