<?php
/**
 * /api/unit-templates - Race-based unit blueprints
 */

$id  = $segments[1] ?? null;
$sub = $segments[2] ?? null;

// new_uuid() is already defined in db.php - do not redeclare

// GET /unit-templates - List templates
// Query params: story_id (optional), category (optional), global (optional)
if ($method === 'GET' && !$id) {
    $storyId = $_GET['story_id'] ?? null;
    $category = $_GET['category'] ?? null;
    $includeGlobal = ($_GET['global'] ?? 'true') === 'true';
    
    $where = [];
    $params = [];
    
    if ($storyId) {
        if ($includeGlobal) {
            $where[] = '(story_id = :sid OR story_id IS NULL)';
            $params[':sid'] = $storyId;
        } else {
            $where[] = 'story_id = :sid';
            $params[':sid'] = $storyId;
        }
    }
    
    if ($category) {
        $where[] = 'category = :cat';
        $params[':cat'] = $category;
    }
    
    $sql = 'SELECT ut.*, f.name AS faction_name, f.display_name AS faction_display_name,
                   a.asset_key AS sprite_asset_key, st.name AS sprite_template_name,
                   ae.asset_key AS sprite_ext_asset_key, ste.name AS sprite_ext_template_name,
                   ap.name AS sprite_asset_key_v2, aep.name AS sprite_ext_asset_key_v2
            FROM unit_templates ut
            LEFT JOIN factions f ON f.id = ut.faction_id
            LEFT JOIN assets a ON a.id = ut.sprite_asset_id
            LEFT JOIN sprite_templates st ON st.id = ut.sprite_template_id
            LEFT JOIN assets ae ON ae.id = ut.sprite_ext_asset_id
            LEFT JOIN sprite_templates ste ON ste.id = ut.sprite_ext_template_id
            LEFT JOIN pixel_painter_assets ap ON ap.id = ut.sprite_asset_id
            LEFT JOIN pixel_painter_assets aep ON aep.id = ut.sprite_ext_asset_id';
    
    if (!empty($where)) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    
    $sql .= ' ORDER BY ut.category, ut.name';
    
    json_response(db_all($sql, $params));
}

// GET /unit-templates/:id
if ($method === 'GET' && $id && $id !== 'story' && $id !== 'spawn') {
    $tpl = db_get('
        SELECT ut.*, f.name AS faction_name, f.display_name AS faction_display_name,
               a.asset_key AS sprite_asset_key, st.name AS sprite_template_name,
               ae.asset_key AS sprite_ext_asset_key, ste.name AS sprite_ext_template_name,
               ap.name AS sprite_asset_key_v2, aep.name AS sprite_ext_asset_key_v2
        FROM unit_templates ut
        LEFT JOIN factions f ON f.id = ut.faction_id
        LEFT JOIN assets a ON a.id = ut.sprite_asset_id
        LEFT JOIN sprite_templates st ON st.id = ut.sprite_template_id
        LEFT JOIN assets ae ON ae.id = ut.sprite_ext_asset_id
        LEFT JOIN sprite_templates ste ON ste.id = ut.sprite_ext_template_id
        LEFT JOIN pixel_painter_assets ap ON ap.id = ut.sprite_asset_id
        LEFT JOIN pixel_painter_assets aep ON aep.id = ut.sprite_ext_asset_id
        WHERE ut.id = :id', [':id' => $id]);
    
    if (!$tpl) not_found('Unit template not found');
    
    // Parse custom animations JSON
    if ($tpl['custom_animations']) {
        $tpl['custom_animations'] = json_decode($tpl['custom_animations'], true);
    }
    if ($tpl['loot_table_json']) {
        $tpl['loot_table_json'] = json_decode($tpl['loot_table_json'], true);
    }
    if ($tpl['action_profile_json']) {
        $tpl['action_profile_json'] = json_decode($tpl['action_profile_json'], true);
    }
    if ($tpl['audio_profile_json']) {
        $tpl['audio_profile_json'] = json_decode($tpl['audio_profile_json'], true);
    }
    
    // Get sharing info
    $tpl['sharing'] = db_all('
        SELECT asset_type, shared_with_user_id, share_level
        FROM asset_sharing
        WHERE asset_type = :type AND asset_id = :id',
        [':type' => 'unit_template', ':id' => $id]);
    
    // Get linked skills
    $tpl['skills'] = db_all('
        SELECT s.*, uts.unlocked_at_level
        FROM skills s
        JOIN unit_template_skills uts ON uts.skill_id = s.id
        WHERE uts.unit_template_id = :id
        ORDER BY uts.unlocked_at_level, s.name',
        [':id' => $id]);
    
    json_response($tpl);
}

// POST /unit-templates - Create new template
if ($method === 'POST' && !$id) {
    if (empty($body['name'])) bad_request('name is required');
    
    $tplId = new_uuid();
    $storyId = $body['story_id'] ?? null;
    
    db_run('INSERT INTO unit_templates 
                (id, story_id, name, category, display_name, description,
                 base_hp, base_mp, base_attack, base_defense, base_speed, base_agility,
                 aggro_range, attack_range, attack_cooldown_ms,
                 sprite_asset_id, sprite_template_id, 
                 sprite_ext_asset_id, sprite_ext_template_id,
                 default_animation,
                 default_behavior, ai_script, custom_animations,
                 faction_id, loot_table_json, action_profile_json, audio_profile_json,
                 is_unique, max_spawn_count, is_global)
             VALUES 
                (:id, :sid, :name, :cat, :dn, :desc,
                 :hp, :mp, :atk, :def, :spd, :agi,
                 :ar, :xr, :acd,
                 :said, :stid, :seaid, :setid, :danim,
                 :beh, :ai, :canim, :fid, :loot, :action_profile, :audio_profile,
                 :uniq, :max, :global)',
        [
            ':id'     => $tplId,
            ':sid'   => $storyId,
            ':name'   => $body['name'],
            ':cat'    => $body['category'] ?? 'enemy',
            ':dn'     => $body['display_name'] ?? null,
            ':desc'   => $body['description'] ?? null,
            ':hp'     => $body['base_hp'] ?? 40,
            ':mp'     => $body['base_mp'] ?? 0,
            ':atk'    => $body['base_attack'] ?? 10,
            ':def'    => $body['base_defense'] ?? 5,
            ':spd'    => $body['base_speed'] ?? 80,
            ':agi'    => $body['base_agility'] ?? 10,
            ':ar'     => $body['aggro_range'] ?? 150,
            ':xr'     => $body['attack_range'] ?? 40,
            ':acd'    => $body['attack_cooldown_ms'] ?? 600,
            ':said'   => $body['sprite_asset_id'] ?? null,
            ':stid'   => $body['sprite_template_id'] ?? null,
            ':seaid'  => $body['sprite_ext_asset_id'] ?? null,
            ':setid'  => $body['sprite_ext_template_id'] ?? null,
            ':danim'  => $body['default_animation'] ?? 'idle_down',
            ':beh'    => $body['default_behavior'] ?? 'idle',
            ':ai'     => $body['ai_script'] ?? null,
            ':canim'  => isset($body['custom_animations']) ? json_encode($body['custom_animations']) : null,
            ':fid'    => $body['faction_id'] ?? null,
            ':loot'   => isset($body['loot_table_json']) ? json_encode($body['loot_table_json']) : null,
            ':action_profile' => isset($body['action_profile_json']) ? json_encode($body['action_profile_json']) : null,
            ':audio_profile' => isset($body['audio_profile_json']) ? json_encode($body['audio_profile_json']) : null,
            ':uniq'   => empty($body['is_unique']) ? 0 : 1,
            ':max'    => $body['max_spawn_count'] ?? 0,
            ':global' => empty($body['is_global']) ? 0 : 1
        ]);
    
    // Add sharing record if story-specific
    if ($storyId && !empty($body['shared_with'])) {
        foreach ($body['shared_with'] as $share) {
            db_run('INSERT INTO asset_sharing (id, asset_type, asset_id, owner_user_id, shared_with_user_id, share_level)
                    VALUES (:id, :type, :aid, :owner, :swid, :level)',
                [
                    ':id'     => new_uuid(),
                    ':type'   => 'unit_template',
                    ':aid'    => $tplId,
                    ':owner'  => $body['owner_user_id'] ?? 'anonymous',
                    ':swid'   => $share['user_id'] ?? null,
                    ':level'  => $share['level'] ?? 'view'
                ]);
        }
    }
    
    json_response(db_get('SELECT * FROM unit_templates WHERE id = :id', [':id' => $tplId]), 201);
}

// PATCH /unit-templates/:id - Update template
if ($method === 'PATCH' && $id && $id !== 'spawn') {
    $tpl = db_get('SELECT * FROM unit_templates WHERE id = :id', [':id' => $id]);
    if (!$tpl) not_found('Unit template not found');
    
    db_run('UPDATE unit_templates SET
                name                    = COALESCE(:name, name),
                category                = COALESCE(:cat, category),
                display_name            = COALESCE(:dn, display_name),
                description             = COALESCE(:desc, description),
                base_hp                 = COALESCE(:hp, base_hp),
                base_mp                 = COALESCE(:mp, base_mp),
                base_attack             = COALESCE(:atk, base_attack),
                base_defense            = COALESCE(:def, base_defense),
                base_speed              = COALESCE(:spd, base_speed),
                base_agility            = COALESCE(:agi, base_agility),
                aggro_range             = COALESCE(:ar, aggro_range),
                attack_range            = COALESCE(:xr, attack_range),
                attack_cooldown_ms      = COALESCE(:acd, attack_cooldown_ms),
                sprite_asset_id         = COALESCE(:said, sprite_asset_id),
                sprite_template_id      = COALESCE(:stid, sprite_template_id),
                sprite_ext_asset_id     = COALESCE(:seaid, sprite_ext_asset_id),
                sprite_ext_template_id  = COALESCE(:setid, sprite_ext_template_id),
                default_animation       = COALESCE(:danim, default_animation),
                default_behavior        = COALESCE(:beh, default_behavior),
                ai_script               = COALESCE(:ai, ai_script),
                custom_animations       = COALESCE(:canim, custom_animations),
                faction_id              = COALESCE(:fid, faction_id),
                loot_table_json         = COALESCE(:loot, loot_table_json),
                action_profile_json     = COALESCE(:action_profile, action_profile_json),
                audio_profile_json      = COALESCE(:audio_profile, audio_profile_json),
                is_unique               = COALESCE(:uniq, is_unique),
                max_spawn_count         = COALESCE(:max, max_spawn_count),
                is_global               = COALESCE(:global, is_global)
            WHERE id = :id',
        [
            ':id'     => $id,
            ':name'   => $body['name'] ?? null,
            ':cat'    => $body['category'] ?? null,
            ':dn'     => $body['display_name'] ?? null,
            ':desc'   => $body['description'] ?? null,
            ':hp'     => $body['base_hp'] ?? null,
            ':mp'     => $body['base_mp'] ?? null,
            ':atk'    => $body['base_attack'] ?? null,
            ':def'    => $body['base_defense'] ?? null,
            ':spd'    => $body['base_speed'] ?? null,
            ':agi'    => $body['base_agility'] ?? null,
            ':ar'     => $body['aggro_range'] ?? null,
            ':xr'     => $body['attack_range'] ?? null,
            ':acd'    => $body['attack_cooldown_ms'] ?? null,
            ':said'   => $body['sprite_asset_id'] ?? null,
            ':stid'   => $body['sprite_template_id'] ?? null,
            ':seaid'  => $body['sprite_ext_asset_id'] ?? null,
            ':setid'  => $body['sprite_ext_template_id'] ?? null,
            ':danim'  => $body['default_animation'] ?? null,
            ':beh'    => $body['default_behavior'] ?? null,
            ':ai'     => $body['ai_script'] ?? null,
            ':canim'  => isset($body['custom_animations']) ? json_encode($body['custom_animations']) : null,
            ':fid'    => $body['faction_id'] ?? null,
            ':loot'   => array_key_exists('loot_table_json', $body) ? json_encode($body['loot_table_json']) : null,
            ':action_profile' => array_key_exists('action_profile_json', $body) ? json_encode($body['action_profile_json']) : null,
            ':audio_profile' => array_key_exists('audio_profile_json', $body) ? json_encode($body['audio_profile_json']) : null,
            ':uniq'   => isset($body['is_unique']) ? ($body['is_unique'] ? 1 : 0) : null,
            ':max'    => $body['max_spawn_count'] ?? null,
            ':global' => isset($body['is_global']) ? ($body['is_global'] ? 1 : 0) : null
        ]);
    
    json_response(db_get('SELECT * FROM unit_templates WHERE id = :id', [':id' => $id]));
}

// DELETE /unit-templates/:id
if ($method === 'DELETE' && $id && $id !== 'spawn') {
    db_run('DELETE FROM unit_templates WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

// POST /unit-templates/:id/spawn - Spawn a character instance from template
if ($method === 'POST' && $id === 'spawn' && $sub) {
    $tpl = db_get('SELECT * FROM unit_templates WHERE id = :id', [':id' => $sub]);
    if (!$tpl) not_found('Unit template not found');
    
    if (empty($body['story_id'])) bad_request('story_id is required');
    
    $charId = new_uuid();
    $storyId = $body['story_id'];
    
    // Create character from template
    db_run('INSERT INTO characters
                (id, story_id, name, display_name, faction_id, behavior,
                 sprite_asset_id, sprite_template_id, sprite_ext_asset_id, sprite_ext_template_id,
                 sprite_frame_w, sprite_frame_h,
                 is_unique, aggro_range, attack_range, 
                 base_hp, base_attack, base_defense, base_speed,
                 backstory, unit_template_id)
             VALUES
                (:id, :sid, :name, :dn, :fid, :beh,
                 :said, :stid, :seaid, :setid,
                 :sfw, :sfh,
                 :uniq, :ar, :xr,
                 :hp, :atk, :def, :spd,
                 :bs, :tplid)',
        [
            ':id'    => $charId,
            ':sid'   => $storyId,
            ':name'  => $body['name'] ?? $tpl['name'] . '_' . substr($charId, 0, 8),
            ':dn'    => $body['display_name'] ?? $tpl['display_name'] ?? $tpl['name'],
            ':fid'   => $body['faction_id'] ?? null,
            ':beh'   => $body['behavior'] ?? $tpl['default_behavior'] ?? 'idle',
            ':said'  => $tpl['sprite_asset_id'],
            ':stid'  => $tpl['sprite_template_id'],
            ':seaid' => $tpl['sprite_ext_asset_id'],
            ':setid' => $tpl['sprite_ext_template_id'],
            ':sfw'   => $body['sprite_frame_w'] ?? $tpl['sprite_frame_w'] ?? null,
            ':sfh'   => $body['sprite_frame_h'] ?? $tpl['sprite_frame_h'] ?? null,
            ':uniq'  => $tpl['is_unique'],
            ':ar'    => $body['aggro_range'] ?? $tpl['aggro_range'] ?? 150,
            ':xr'    => $body['attack_range'] ?? $tpl['attack_range'] ?? 40,
            ':hp'    => $body['base_hp'] ?? $tpl['base_hp'] ?? 40,
            ':atk'   => $body['base_attack'] ?? $tpl['base_attack'] ?? 10,
            ':def'   => $body['base_defense'] ?? $tpl['base_defense'] ?? 5,
            ':spd'   => $body['base_speed'] ?? $tpl['base_speed'] ?? 80,
            ':bs'    => $body['backstory'] ?? $tpl['description'] ?? null,
            ':tplid' => $sub
        ]);
    
    json_response(db_get('
        SELECT c.*, ut.name AS template_name
        FROM characters c
        LEFT JOIN unit_templates ut ON ut.id = c.unit_template_id
        WHERE c.id = :id', [':id' => $charId]), 201);
}

not_found('Unit template endpoint not found');
