<?php
/**
 * /api/scenes
 */

$id    = $segments[1] ?? null;
$sub   = $segments[2] ?? null;

// GET /scenes/story/:storyId
if ($method === 'GET' && $id === 'story' && $sub) {
    $scenes = db_all('SELECT * FROM scenes WHERE story_id = :sid ORDER BY is_entry_point DESC, name',
        [':sid' => $sub]);
    foreach ($scenes as &$s) {
        $s['triggers']        = db_all('SELECT * FROM scene_triggers  WHERE scene_id = :sid ORDER BY sort_order', [':sid' => $s['id']]);
        $s['spawn_templates'] = db_all('SELECT * FROM spawn_templates WHERE scene_id = :sid', [':sid' => $s['id']]);
    }
    json_response($scenes);
}

// GET /scenes/:id
if ($method === 'GET' && $id && $id !== 'story' && $id !== 'triggers') {
    $scene = db_get('SELECT * FROM scenes WHERE id = :id', [':id' => $id]);
    if (!$scene) not_found('Scene not found');
    $scene['triggers']        = db_all('SELECT * FROM scene_triggers WHERE scene_id = :id ORDER BY sort_order', [':id' => $id]);
    $scene['spawn_templates'] = db_all('SELECT st.*, c.name AS character_name, c.behavior AS character_behavior
                                        FROM spawn_templates st JOIN characters c ON c.id = st.character_id
                                        WHERE st.scene_id = :id', [':id' => $id]);
    json_response($scene);
}

// POST /scenes/story/:storyId
if ($method === 'POST' && $id === 'story' && $sub) {
    if (empty($body['name'])) bad_request('name is required');
    $sid = new_uuid();
    db_run('INSERT INTO scenes (id, story_id, name, description, map_seed, map_width, map_height,
                weather_override, music_asset_id, is_entry_point)
            VALUES (:id,:sid,:name,:desc,:seed,:mw,:mh,:wo,:maid,:ep)',
        [':id' => $sid, ':sid' => $sub, ':name' => $body['name'],
         ':desc' => $body['description'] ?? null, ':seed' => $body['map_seed'] ?? null,
         ':mw' => $body['map_width'] ?? 256, ':mh' => $body['map_height'] ?? 256,
         ':wo' => $body['weather_override'] ?? null, ':maid' => $body['music_asset_id'] ?? null,
         ':ep' => empty($body['is_entry_point']) ? 0 : 1]);
    json_response(db_get('SELECT * FROM scenes WHERE id = :id', [':id' => $sid]), 201);
}

// PATCH /scenes/:id
if ($method === 'PATCH' && $id && $id !== 'story' && $id !== 'triggers') {
    db_run('UPDATE scenes SET
                name             = COALESCE(:name, name),
                description      = COALESCE(:desc, description),
                map_seed         = COALESCE(:seed, map_seed),
                map_width        = COALESCE(:mw,   map_width),
                map_height       = COALESCE(:mh,   map_height),
                weather_override = COALESCE(:wo,   weather_override),
                music_asset_id   = COALESCE(:maid, music_asset_id),
                is_entry_point   = COALESCE(:ep,   is_entry_point)
            WHERE id = :id',
        [':id' => $id, ':name' => $body['name'] ?? null, ':desc' => $body['description'] ?? null,
         ':seed' => $body['map_seed'] ?? null, ':mw' => $body['map_width'] ?? null,
         ':mh' => $body['map_height'] ?? null, ':wo' => $body['weather_override'] ?? null,
         ':maid' => $body['music_asset_id'] ?? null,
         ':ep' => isset($body['is_entry_point']) ? (int)$body['is_entry_point'] : null]);
    json_response(db_get('SELECT * FROM scenes WHERE id = :id', [':id' => $id]));
}

// DELETE /scenes/:id
if ($method === 'DELETE' && $id && $id !== 'story' && $id !== 'triggers') {
    db_run('DELETE FROM scenes WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

// POST /scenes/triggers
if ($method === 'POST' && $id === 'triggers') {
    if (empty($body['scene_id']))    bad_request('scene_id is required');
    if (empty($body['trigger_type'])) bad_request('trigger_type is required');
    if (empty($body['action_type']))  bad_request('action_type is required');
    $tid = new_uuid();
    db_run('INSERT INTO scene_triggers (id, scene_id, story_id, trigger_type, trigger_target,
                action_type, action_target_id, condition_flag, condition_value, sort_order)
            VALUES (:id,:sid,:stid,:ttype,:ttgt,:atype,:atid,:cflag,:cval,:so)',
        [':id' => $tid, ':sid' => $body['scene_id'], ':stid' => $body['story_id'] ?? null,
         ':ttype' => $body['trigger_type'], ':ttgt' => $body['trigger_target'] ?? null,
         ':atype' => $body['action_type'], ':atid' => $body['action_target_id'] ?? null,
         ':cflag' => $body['condition_flag'] ?? null, ':cval' => $body['condition_value'] ?? null,
         ':so' => $body['sort_order'] ?? 0]);
    json_response(db_get('SELECT * FROM scene_triggers WHERE id = :id', [':id' => $tid]), 201);
}

// DELETE /scenes/triggers/:id
if ($method === 'DELETE' && $id === 'triggers' && $sub) {
    db_run('DELETE FROM scene_triggers WHERE id = :id', [':id' => $sub]);
    json_response(['deleted' => true]);
}

not_found();
