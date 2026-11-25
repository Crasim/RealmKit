<?php
/**
 * /api/saves
 */

$id    = $segments[1] ?? null;   // 'story' | save-uuid
$sub   = $segments[2] ?? null;   // story-id | 'slot'
$slot  = isset($segments[4]) ? (int)$segments[4] : null;

// ── GET /saves/story/:storyId ─────────────────────────────────
if ($method === 'GET' && $id === 'story' && $sub) {
    $uid = $_GET['user_id'] ?? null;
    $did = $_GET['device_id'] ?? null;
    $base = 'SELECT s.*, sc.name AS scene_name FROM saves s
              LEFT JOIN scenes sc ON sc.id = s.scene_id
              WHERE s.story_id = :sid';
    if ($uid) {
        json_response(db_all($base . ' AND s.user_id = :uid ORDER BY s.slot_number',
            [':sid' => $sub, ':uid' => $uid]));
    } elseif ($did) {
        json_response(db_all($base . ' AND s.device_id = :did ORDER BY s.slot_number',
            [':sid' => $sub, ':did' => $did]));
    } else {
        json_response(db_all($base . ' ORDER BY s.updated_at DESC', [':sid' => $sub]));
    }
}

// ── GET /saves/:id ────────────────────────────────────────────
if ($method === 'GET' && $id && $id !== 'story') {
    $save = db_get('SELECT * FROM saves WHERE id = :id', [':id' => $id]);
    if (!$save) not_found('Save not found');
    $save['flags']              = db_all('SELECT flag_key, flag_value FROM save_flags WHERE save_id = :id', [':id' => $id]);
    $save['quest_progress']     = db_all('SELECT quest_id, status FROM save_quest_progress WHERE save_id = :id', [':id' => $id]);
    $save['objective_progress'] = db_all('SELECT objective_id, current_count FROM save_objective_progress WHERE save_id = :id', [':id' => $id]);
    json_response($save);
}

// ── PUT /saves/story/:storyId/slot/:slot ──────────────────────
if ($method === 'PUT' && $id === 'story' && isset($segments[3]) && $segments[3] === 'slot') {
    $storyId = $sub;
    $slotNum = (int)($segments[4] ?? 0);
    $uid     = $body['user_id']   ?? null;
    $did     = $body['device_id'] ?? null;

    $existing = db_get('SELECT id FROM saves
                        WHERE story_id = :sid AND slot_number = :slot
                          AND (user_id = :uid OR (user_id IS NULL AND device_id = :did))',
        [':sid' => $storyId, ':slot' => $slotNum, ':uid' => $uid, ':did' => $did]);
    $saveId = $existing['id'] ?? new_uuid();

    if ($existing) {
        db_run('UPDATE saves SET
                    display_name      = COALESCE(:dn,  display_name),
                    player_x          = COALESCE(:px,  player_x),
                    player_y          = COALESCE(:py,  player_y),
                    player_hp         = COALESCE(:php, player_hp),
                    player_max_hp     = COALESCE(:pmhp,player_max_hp),
                    player_gold       = COALESCE(:pg,  player_gold),
                    player_xp         = COALESCE(:pxp, player_xp),
                    player_level      = COALESCE(:pl,  player_level),
                    scene_id          = COALESCE(:scid,scene_id),
                    play_time_seconds = COALESCE(:pts, play_time_seconds),
                    sync_status       = COALESCE(:ss,  sync_status)
                WHERE id = :id',
            [':id' => $saveId, ':dn' => $body['display_name'] ?? null,
             ':px' => $body['player_x'] ?? null, ':py' => $body['player_y'] ?? null,
             ':php' => $body['player_hp'] ?? null, ':pmhp' => $body['player_max_hp'] ?? null,
             ':pg' => $body['player_gold'] ?? null, ':pxp' => $body['player_xp'] ?? null,
             ':pl' => $body['player_level'] ?? null, ':scid' => $body['scene_id'] ?? null,
             ':pts' => $body['play_time_seconds'] ?? null, ':ss' => $body['sync_status'] ?? null]);
    } else {
        db_run('INSERT INTO saves (id, story_id, user_id, device_id, slot_number, display_name,
                    player_x, player_y, player_hp, player_max_hp, player_gold,
                    player_xp, player_level, scene_id, play_time_seconds, sync_status)
                VALUES (:id,:sid,:uid,:did,:slot,:dn,:px,:py,:php,:pmhp,:pg,:pxp,:pl,:scid,:pts,:ss)',
            [':id' => $saveId, ':sid' => $storyId, ':uid' => $uid, ':did' => $did,
             ':slot' => $slotNum, ':dn' => $body['display_name'] ?? null,
             ':px' => $body['player_x'] ?? null, ':py' => $body['player_y'] ?? null,
             ':php' => $body['player_hp'] ?? null, ':pmhp' => $body['player_max_hp'] ?? null,
             ':pg' => $body['player_gold'] ?? 0, ':pxp' => $body['player_xp'] ?? 0,
             ':pl' => $body['player_level'] ?? 1, ':scid' => $body['scene_id'] ?? null,
             ':pts' => $body['play_time_seconds'] ?? 0, ':ss' => $body['sync_status'] ?? 'local_only']);
    }

    // Atomically replace flags
    if (isset($body['flags'])) {
        db_run('DELETE FROM save_flags WHERE save_id = :id', [':id' => $saveId]);
        $stmt = db()->prepare('INSERT INTO save_flags (save_id, story_id, flag_key, flag_value) VALUES (?,?,?,?)');
        foreach ($body['flags'] as $k => $v) $stmt->execute([$saveId, $storyId, $k, (string)$v]);
    }

    // Atomically replace quest progress
    if (isset($body['quest_progress'])) {
        db_run('DELETE FROM save_quest_progress WHERE save_id = :id', [':id' => $saveId]);
        $stmt = db()->prepare('INSERT INTO save_quest_progress (save_id, quest_id, story_id, status) VALUES (?,?,?,?)');
        foreach ($body['quest_progress'] as $q) $stmt->execute([$saveId, $q['quest_id'], $storyId, $q['status']]);
    }

    // Atomically replace objective progress
    if (isset($body['objective_progress'])) {
        db_run('DELETE FROM save_objective_progress WHERE save_id = :id', [':id' => $saveId]);
        $stmt = db()->prepare('INSERT INTO save_objective_progress (save_id, objective_id, current_count) VALUES (?,?,?)');
        foreach ($body['objective_progress'] as $o) $stmt->execute([$saveId, $o['objective_id'], $o['current_count'] ?? 0]);
    }

    $save = db_get('SELECT * FROM saves WHERE id = :id', [':id' => $saveId]);
    $save['flags']              = $body['flags'] ?? [];
    $save['quest_progress']     = $body['quest_progress'] ?? [];
    $save['objective_progress'] = $body['objective_progress'] ?? [];
    json_response($save);
}

// ── DELETE /saves/:id ─────────────────────────────────────────
if ($method === 'DELETE' && $id && $id !== 'story') {
    db_run('DELETE FROM saves WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

not_found();
