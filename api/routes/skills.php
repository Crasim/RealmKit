<?php
/**
 * /api/skills
 */

$id = $segments[1] ?? null;

// GET /skills
if ($method === 'GET' && !$id) {
    json_response(db_all('SELECT * FROM skills ORDER BY name'));
}

// GET /skills/:id
if ($method === 'GET' && $id) {
    $row = db_get('SELECT * FROM skills WHERE id = :id', [':id' => $id]);
    if (!$row) not_found('Skill not found');
    json_response($row);
}

// POST /skills
if ($method === 'POST' && !$id) {
    if (empty($body['name']) || empty($body['anim_name'])) {
        bad_request('name and anim_name are required');
    }
    
    $sid = new_uuid();
    db_run('INSERT INTO skills (id, name, display_name, description, category, anim_name, particle_effect, sound_effect, damage_multiplier, mp_cost, cooldown_ms, range, is_aoe, aoe_radius)
            VALUES (:id, :name, :dn, :desc, :cat, :anim, :part, :snd, :dmg, :mp, :cd, :rng, :aoe, :rad)',
        [
            ':id'    => $sid,
            ':name'  => $body['name'],
            ':dn'    => $body['display_name'] ?? $body['name'],
            ':desc'  => $body['description'] ?? null,
            ':cat'   => $body['category'] ?? 'combat',
            ':anim'  => $body['anim_name'],
            ':part'  => $body['particle_effect'] ?? null,
            ':snd'   => $body['sound_effect'] ?? null,
            ':dmg'   => $body['damage_multiplier'] ?? 1.0,
            ':mp'    => $body['mp_cost'] ?? 0,
            ':cd'    => $body['cooldown_ms'] ?? 1000,
            ':rng'   => $body['range'] ?? 40,
            ':aoe'   => $body['is_aoe'] ?? 0,
            ':rad'   => $body['aoe_radius'] ?? 0
        ]);
        
    json_response(db_get('SELECT * FROM skills WHERE id = :id', [':id' => $sid]), 201);
}

not_found();
