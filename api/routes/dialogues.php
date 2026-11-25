<?php
/**
 * /api/dialogues
 */

$id    = $segments[1] ?? null;
$sub   = $segments[2] ?? null;
$subId = $segments[3] ?? null;

// GET /dialogues/story/:storyId
if ($method === 'GET' && $id === 'story' && $sub) {
    json_response(db_all('
        SELECT d.id, d.name, d.character_id, d.entry_node_id, c.name AS character_name
        FROM dialogues d LEFT JOIN characters c ON c.id = d.character_id
        WHERE d.story_id = :sid ORDER BY d.name', [':sid' => $sub]));
}

// GET /dialogues/:id/tree
if ($method === 'GET' && $id && $sub === 'tree') {
    $dialogue = db_get('SELECT * FROM dialogues WHERE id = :id', [':id' => $id]);
    if (!$dialogue) not_found('Dialogue not found');
    $nodes   = db_all('SELECT * FROM dialogue_nodes WHERE dialogue_id = :id ORDER BY sort_order', [':id' => $id]);
    $choices = db_all('SELECT dc.* FROM dialogue_choices dc
                       JOIN dialogue_nodes dn ON dn.id = dc.node_id
                       WHERE dn.dialogue_id = :id ORDER BY dc.sort_order', [':id' => $id]);
    $byNode = [];
    foreach ($choices as $c) $byNode[$c['node_id']][] = $c;
    foreach ($nodes as &$n) $n['choices'] = $byNode[$n['id']] ?? [];
    $dialogue['nodes'] = $nodes;
    json_response($dialogue);
}

// POST /dialogues/story/:storyId
if ($method === 'POST' && $id === 'story' && $sub) {
    if (empty($body['name'])) bad_request('name is required');
    $did = new_uuid();
    db_run('INSERT INTO dialogues (id, story_id, name, character_id) VALUES (:id,:sid,:name,:cid)',
        [':id' => $did, ':sid' => $sub, ':name' => $body['name'], ':cid' => $body['character_id'] ?? null]);
    json_response(db_get('SELECT * FROM dialogues WHERE id = :id', [':id' => $did]), 201);
}

// DELETE /dialogues/:id
if ($method === 'DELETE' && $id && !$sub) {
    db_run('DELETE FROM dialogues WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

// PATCH /dialogues/:id/entry-node
if ($method === 'PATCH' && $id && $sub === 'entry-node') {
    if (empty($body['node_id'])) bad_request('node_id required');
    db_run('UPDATE dialogues SET entry_node_id = :nid WHERE id = :id',
        [':nid' => $body['node_id'], ':id' => $id]);
    json_response(['entry_node_id' => $body['node_id']]);
}

// POST /dialogues/nodes
if ($method === 'POST' && $id === 'nodes') {
    if (empty($body['dialogue_id'])) bad_request('dialogue_id is required');
    if (empty($body['text']))        bad_request('text is required');
    if (empty($body['node_type']))   bad_request('node_type is required');
    $nid = new_uuid();
    db_run('INSERT INTO dialogue_nodes (id, dialogue_id, story_id, speaker_character_id, text, node_type,
                condition_flag, condition_value, set_flag, set_flag_value, sort_order)
            VALUES (:id,:did,:sid,:scid,:text,:ntype,:cflag,:cval,:sflag,:sval,:so)',
        [':id' => $nid, ':did' => $body['dialogue_id'], ':sid' => $body['story_id'] ?? null,
         ':scid' => $body['speaker_character_id'] ?? null, ':text' => $body['text'],
         ':ntype' => $body['node_type'], ':cflag' => $body['condition_flag'] ?? null,
         ':cval' => $body['condition_value'] ?? null, ':sflag' => $body['set_flag'] ?? null,
         ':sval' => $body['set_flag_value'] ?? null, ':so' => $body['sort_order'] ?? 0]);
    json_response(db_get('SELECT * FROM dialogue_nodes WHERE id = :id', [':id' => $nid]), 201);
}

// PATCH /dialogues/nodes/:id
if ($method === 'PATCH' && $id === 'nodes' && $sub) {
    db_run('UPDATE dialogue_nodes SET
                text                 = COALESCE(:text,  text),
                node_type            = COALESCE(:ntype, node_type),
                speaker_character_id = COALESCE(:scid,  speaker_character_id),
                condition_flag       = COALESCE(:cflag, condition_flag),
                condition_value      = COALESCE(:cval,  condition_value),
                set_flag             = COALESCE(:sflag, set_flag),
                set_flag_value       = COALESCE(:sval,  set_flag_value),
                sort_order           = COALESCE(:so,    sort_order)
            WHERE id = :id',
        [':id' => $sub, ':text' => $body['text'] ?? null, ':ntype' => $body['node_type'] ?? null,
         ':scid' => $body['speaker_character_id'] ?? null, ':cflag' => $body['condition_flag'] ?? null,
         ':cval' => $body['condition_value'] ?? null, ':sflag' => $body['set_flag'] ?? null,
         ':sval' => $body['set_flag_value'] ?? null, ':so' => $body['sort_order'] ?? null]);
    json_response(db_get('SELECT * FROM dialogue_nodes WHERE id = :id', [':id' => $sub]));
}

// POST /dialogues/choices
if ($method === 'POST' && $id === 'choices') {
    if (empty($body['node_id'])) bad_request('node_id is required');
    if (empty($body['text']))    bad_request('text is required');
    $cid = new_uuid();
    db_run('INSERT INTO dialogue_choices (id, node_id, story_id, text, next_node_id,
                condition_flag, condition_value, sort_order)
            VALUES (:id,:nid,:sid,:text,:nnid,:cflag,:cval,:so)',
        [':id' => $cid, ':nid' => $body['node_id'], ':sid' => $body['story_id'] ?? null,
         ':text' => $body['text'], ':nnid' => $body['next_node_id'] ?? null,
         ':cflag' => $body['condition_flag'] ?? null, ':cval' => $body['condition_value'] ?? null,
         ':so' => $body['sort_order'] ?? 0]);
    json_response(db_get('SELECT * FROM dialogue_choices WHERE id = :id', [':id' => $cid]), 201);
}

// DELETE /dialogues/choices/:id
if ($method === 'DELETE' && $id === 'choices' && $sub) {
    db_run('DELETE FROM dialogue_choices WHERE id = :id', [':id' => $sub]);
    json_response(['deleted' => true]);
}

not_found();
