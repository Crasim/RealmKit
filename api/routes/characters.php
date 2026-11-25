<?php
/**
 * /api/characters
 */

$id  = $segments[1] ?? null;
$sub = $segments[2] ?? null;

// GET /characters/story/:storyId
if ($method === 'GET' && $id === 'story' && $sub) {
    json_response(db_all('
        SELECT c.*, f.name AS faction_name, f.display_name AS faction_display_name, f.color AS faction_color,
               ut.name AS unit_template_name, ut.display_name AS unit_template_display_name
        FROM characters c
        LEFT JOIN factions f ON f.id = c.faction_id
        LEFT JOIN unit_templates ut ON ut.id = c.unit_template_id
        WHERE c.story_id = :sid
        ORDER BY c.is_unique DESC, c.name', [':sid' => $sub]));
}

// GET /characters/:id
if ($method === 'GET' && $id && $id !== 'story') {
    $char = db_get('
        SELECT c.*, f.name AS faction_name, f.display_name AS faction_display_name,
               ut.name AS unit_template_name, ut.display_name AS unit_template_display_name
        FROM characters c
        LEFT JOIN factions f ON f.id = c.faction_id
        LEFT JOIN unit_templates ut ON ut.id = c.unit_template_id
        WHERE c.id = :id', [':id' => $id]);
    if (!$char) not_found('Character not found');
    $char['relationships'] = db_all('SELECT * FROM character_relationships WHERE character_a_id = :id OR character_b_id = :id2',
        [':id' => $id, ':id2' => $id]);
    json_response($char);
}

// POST /characters/story/:storyId
if ($method === 'POST' && $id === 'story' && $sub) {
    if (empty($body['name'])) bad_request('name is required');
    $cid = new_uuid();
    db_run('INSERT INTO characters (id, story_id, name, display_name, faction_id, behavior,
                sprite_asset_id, sprite_template_id, sprite_ext_asset_id, sprite_ext_template_id,
                sprite_frame_w, sprite_frame_h,
                is_unique, aggro_range, attack_range, base_hp, base_attack, base_defense, base_speed, backstory,
                unit_template_id, loot_override_json, knowledge_json, audio_override_json)
            VALUES (:id,:sid,:name,:dn,:fid,:beh,
                    :said,:stid,:sxaid,:sxtid,
                    :sfw,:sfh,
                    :uniq,:ar,:xr,:hp,:atk,:def,:spd,:bs,
                    :tplid,:loot,:knowledge,:audio)',
        [':id'    => $cid,                             ':sid'   => $sub,
         ':name'  => $body['name'],                    ':dn'    => $body['display_name']        ?? null,
         ':fid'   => $body['faction_id']    ?? null,   ':beh'   => $body['behavior']            ?? 'idle',
         ':said'  => $body['sprite_asset_id']      ?? null,
         ':stid'  => $body['sprite_template_id']   ?? null,
         ':sxaid' => $body['sprite_ext_asset_id']  ?? null,
         ':sxtid' => $body['sprite_ext_template_id'] ?? null,
         ':sfw'   => $body['sprite_frame_w']   ?? null,
         ':sfh'   => $body['sprite_frame_h']   ?? null,
         ':uniq'  => empty($body['is_unique']) ? 0 : 1,
         ':ar'    => $body['aggro_range']   ?? 150,    ':xr'    => $body['attack_range']        ?? 40,
         ':hp'    => $body['base_hp']       ?? 40,     ':atk'   => $body['base_attack']         ?? 10,
         ':def'   => $body['base_defense']  ?? 5,      ':spd'   => $body['base_speed']          ?? 80,
         ':bs'    => $body['backstory']     ?? null,
         ':tplid' => $body['unit_template_id'] ?? null,
         ':loot'  => array_key_exists('loot_override_json', $body) ? json_encode($body['loot_override_json']) : null,
         ':knowledge' => array_key_exists('knowledge_json', $body) ? json_encode($body['knowledge_json']) : null,
         ':audio' => array_key_exists('audio_override_json', $body) ? json_encode($body['audio_override_json']) : null]);
    json_response(db_get('SELECT * FROM characters WHERE id = :id', [':id' => $cid]), 201);
}

// PATCH /characters/:id
if ($method === 'PATCH' && $id && $id !== 'story') {
    db_run('UPDATE characters SET
                name                    = COALESCE(:name,  name),
                display_name            = COALESCE(:dn,    display_name),
                faction_id              = COALESCE(:fid,   faction_id),
                behavior                = COALESCE(:beh,   behavior),
                sprite_asset_id         = COALESCE(:said,  sprite_asset_id),
                sprite_template_id      = COALESCE(:stid,  sprite_template_id),
                sprite_ext_asset_id     = COALESCE(:sxaid, sprite_ext_asset_id),
                sprite_ext_template_id  = COALESCE(:sxtid, sprite_ext_template_id),
                sprite_frame_w          = COALESCE(:sfw,   sprite_frame_w),
                sprite_frame_h          = COALESCE(:sfh,   sprite_frame_h),
                aggro_range             = COALESCE(:ar,    aggro_range),
                attack_range            = COALESCE(:xr,    attack_range),
                base_hp                 = COALESCE(:hp,    base_hp),
                base_attack             = COALESCE(:atk,   base_attack),
                base_defense            = COALESCE(:def,   base_defense),
                base_speed              = COALESCE(:spd,   base_speed),
                backstory               = COALESCE(:bs,    backstory),
                unit_template_id        = COALESCE(:tplid, unit_template_id),
                loot_override_json      = COALESCE(:loot,  loot_override_json),
                knowledge_json          = COALESCE(:knowledge, knowledge_json),
                audio_override_json     = COALESCE(:audio, audio_override_json)
            WHERE id = :id',
        [':id'    => $id,
         ':name'  => $body['name']                   ?? null,  ':dn'   => $body['display_name']         ?? null,
         ':fid'   => $body['faction_id']             ?? null,  ':beh'  => $body['behavior']             ?? null,
         ':said'  => $body['sprite_asset_id']        ?? null,
         ':stid'  => $body['sprite_template_id']     ?? null,
         ':sxaid' => $body['sprite_ext_asset_id']    ?? null,
         ':sxtid' => $body['sprite_ext_template_id'] ?? null,
         ':sfw'   => $body['sprite_frame_w']         ?? null,
         ':sfh'   => $body['sprite_frame_h']         ?? null,
         ':ar'    => $body['aggro_range']            ?? null,  ':xr'   => $body['attack_range']         ?? null,
         ':hp'    => $body['base_hp']                ?? null,  ':atk'  => $body['base_attack']          ?? null,
         ':def'   => $body['base_defense']           ?? null,  ':spd'  => $body['base_speed']           ?? null,
         ':bs'    => $body['backstory']              ?? null,
         ':tplid' => $body['unit_template_id']       ?? null,
         ':loot'  => array_key_exists('loot_override_json', $body) ? json_encode($body['loot_override_json']) : null,
         ':knowledge' => array_key_exists('knowledge_json', $body) ? json_encode($body['knowledge_json']) : null,
         ':audio' => array_key_exists('audio_override_json', $body) ? json_encode($body['audio_override_json']) : null]);
    json_response(db_get('SELECT * FROM characters WHERE id = :id', [':id' => $id]));
}

// DELETE /characters/:id
if ($method === 'DELETE' && $id && $id !== 'story') {
    db_run('DELETE FROM characters WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

not_found();
