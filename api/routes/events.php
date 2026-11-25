<?php
/**
 * /api/events
 *
 * GET    /events?story_id=...&scope=...&quest_id=...
 * GET    /events/{id}
 * POST   /events
 * PATCH  /events/{id}
 * DELETE /events/{id}
 */

$id = $segments[1] ?? null;

function event_row(array $row): array {
    return [
        'id' => $row['id'],
        'story_id' => $row['story_id'],
        'quest_id' => $row['quest_id'],
        'map_id' => $row['map_id'],
        'name' => $row['name'],
        'event_scope' => $row['event_scope'],
        'description' => $row['description'] ?? '',
        'condition_json' => json_decode($row['condition_json'] ?? 'null', true),
        'action_json' => json_decode($row['action_json'] ?? 'null', true),
        'sort_order' => (int)($row['sort_order'] ?? 0),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

if ($method === 'GET' && !$id) {
    $where = [];
    $params = [];
    if (!empty($_GET['story_id'])) {
        $where[] = 'story_id = :sid';
        $params[':sid'] = $_GET['story_id'];
    }
    if (!empty($_GET['scope'])) {
        $where[] = 'event_scope = :scope';
        $params[':scope'] = $_GET['scope'];
    }
    if (!empty($_GET['quest_id'])) {
        $where[] = 'quest_id = :qid';
        $params[':qid'] = $_GET['quest_id'];
    }

    $sql = 'SELECT * FROM story_events';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY sort_order ASC, created_at ASC';

    json_response(array_map('event_row', db_all($sql, $params)));
}

if ($method === 'GET' && $id) {
    $row = db_get('SELECT * FROM story_events WHERE id = :id', [':id' => $id]);
    if (!$row) not_found('Event not found');
    json_response(event_row($row));
}

if ($method === 'POST' && !$id) {
    if (empty($body['story_id'])) bad_request('story_id is required');
    if (empty($body['name'])) bad_request('name is required');

    $eid = new_uuid();
    db_run(
        'INSERT INTO story_events
            (id, story_id, quest_id, map_id, name, event_scope, description, condition_json, action_json, sort_order)
         VALUES
            (:id, :sid, :qid, :mid, :name, :scope, :description, :conditions, :actions, :sort_order)',
        coalesce_params([
            ':id' => $eid,
            ':sid' => $body['story_id'],
            ':qid' => $body['quest_id'] ?? null,
            ':mid' => $body['map_id'] ?? null,
            ':name' => $body['name'],
            ':scope' => $body['event_scope'] ?? 'non_quest',
            ':description' => $body['description'] ?? null,
            ':conditions' => isset($body['condition_json']) ? json_encode($body['condition_json']) : null,
            ':actions' => isset($body['action_json']) ? json_encode($body['action_json']) : null,
            ':sort_order' => (int)($body['sort_order'] ?? 0),
        ])
    );

    json_response(event_row(db_get('SELECT * FROM story_events WHERE id = :id', [':id' => $eid])), 201);
}

if ($method === 'PATCH' && $id) {
    $row = db_get('SELECT * FROM story_events WHERE id = :id', [':id' => $id]);
    if (!$row) not_found('Event not found');

    db_run(
        'UPDATE story_events SET
            quest_id       = COALESCE(:qid, quest_id),
            map_id         = COALESCE(:mid, map_id),
            name           = COALESCE(:name, name),
            event_scope    = COALESCE(:scope, event_scope),
            description    = COALESCE(:description, description),
            condition_json = COALESCE(:conditions, condition_json),
            action_json    = COALESCE(:actions, action_json),
            sort_order     = COALESCE(:sort_order, sort_order)
         WHERE id = :id',
        coalesce_params([
            ':id' => $id,
            ':qid' => $body['quest_id'] ?? null,
            ':mid' => $body['map_id'] ?? null,
            ':name' => $body['name'] ?? null,
            ':scope' => $body['event_scope'] ?? null,
            ':description' => $body['description'] ?? null,
            ':conditions' => array_key_exists('condition_json', $body) ? json_encode($body['condition_json']) : null,
            ':actions' => array_key_exists('action_json', $body) ? json_encode($body['action_json']) : null,
            ':sort_order' => $body['sort_order'] ?? null,
        ])
    );

    json_response(event_row(db_get('SELECT * FROM story_events WHERE id = :id', [':id' => $id])));
}

if ($method === 'DELETE' && $id) {
    $row = db_get('SELECT id FROM story_events WHERE id = :id', [':id' => $id]);
    if (!$row) not_found('Event not found');
    db_run('DELETE FROM story_events WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true, 'id' => $id]);
}

not_found('Event endpoint not found');
