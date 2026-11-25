<?php
/**
 * /api/factions
 */

$id = $segments[1] ?? null;

// GET /factions
if ($method === 'GET' && !$id) {
    $storyId = $_GET['story_id'] ?? null;
    $params = [];
    $sql = 'SELECT * FROM factions';
    
    if ($storyId) {
        $sql .= ' WHERE story_id = :sid';
        $params[':sid'] = $storyId;
    }
    
    $sql .= ' ORDER BY name';
    
    json_response(db_all($sql, $params));
}

// GET /factions/:id
if ($method === 'GET' && $id) {
    $row = db_get('SELECT * FROM factions WHERE id = :id', [':id' => $id]);
    if (!$row) not_found('Faction not found');
    json_response($row);
}

// POST /factions
if ($method === 'POST' && !$id) {
    if (empty($body['name']) || empty($body['story_id'])) {
        bad_request('name and story_id are required');
    }
    
    $fid = new_uuid();
    db_run('INSERT INTO factions (id, story_id, name, display_name, color)
            VALUES (:id, :sid, :name, :dn, :color)',
        [
            ':id'    => $fid,
            ':sid'   => $body['story_id'],
            ':name'  => $body['name'],
            ':dn'    => $body['display_name'] ?? $body['name'],
            ':color' => $body['color'] ?? '#ffffff'
        ]);
        
    json_response(db_get('SELECT * FROM factions WHERE id = :id', [':id' => $fid]), 201);
}

// PATCH /factions/:id
if ($method === 'PATCH' && $id) {
    $existing = db_get('SELECT * FROM factions WHERE id = :id', [':id' => $id]);
    if (!$existing) not_found('Faction not found');

    db_run('UPDATE factions SET
                name         = COALESCE(:name, name),
                display_name = COALESCE(:dn, display_name),
                color        = COALESCE(:color, color)
            WHERE id = :id',
        [
            ':id' => $id,
            ':name' => $body['name'] ?? null,
            ':dn' => $body['display_name'] ?? null,
            ':color' => $body['color'] ?? null
        ]);

    json_response(db_get('SELECT * FROM factions WHERE id = :id', [':id' => $id]));
}

// DELETE /factions/:id
if ($method === 'DELETE' && $id) {
    $existing = db_get('SELECT id FROM factions WHERE id = :id', [':id' => $id]);
    if (!$existing) not_found('Faction not found');
    db_run('DELETE FROM factions WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true, 'id' => $id]);
}

not_found();
