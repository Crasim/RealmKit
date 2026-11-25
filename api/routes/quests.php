<?php
/**
 * /api/quests
 */

$id    = $segments[1] ?? null;
$sub   = $segments[2] ?? null;
$subId = $segments[3] ?? null;

// GET /quests/story/:storyId
if ($method === 'GET' && $id === 'story' && $sub) {
    $quests = db_all('SELECT * FROM quests WHERE story_id = :sid ORDER BY sort_order', [':sid' => $sub]);
    foreach ($quests as &$q) {
        $q['objectives'] = db_all('SELECT * FROM quest_objectives WHERE quest_id = :qid ORDER BY sort_order',
            [':qid' => $q['id']]);
    }
    json_response($quests);
}

// POST /quests/story/:storyId
if ($method === 'POST' && $id === 'story' && $sub) {
    if (empty($body['title'])) bad_request('title is required');
    $qid = new_uuid();
    db_run('INSERT INTO quests (id, story_id, title, description, giver_character_id,
                prerequisite_quest_id, reward_gold, reward_xp, auto_complete, sort_order)
            VALUES (:id,:sid,:title,:desc,:gcid,:pqid,:gold,:xp,:ac,:so)',
        [':id' => $qid, ':sid' => $sub, ':title' => $body['title'],
         ':desc' => $body['description'] ?? null, ':gcid' => $body['giver_character_id'] ?? null,
         ':pqid' => $body['prerequisite_quest_id'] ?? null, ':gold' => $body['reward_gold'] ?? 0,
         ':xp' => $body['reward_xp'] ?? 0, ':ac' => empty($body['auto_complete']) ? 1 : (int)$body['auto_complete'],
         ':so' => $body['sort_order'] ?? 0]);
    json_response(db_get('SELECT * FROM quests WHERE id = :id', [':id' => $qid]), 201);
}

// PATCH /quests/:id
if ($method === 'PATCH' && $id && $id !== 'story' && $sub !== 'objectives') {
    db_run('UPDATE quests SET
                title                 = COALESCE(:title, title),
                description           = COALESCE(:desc,  description),
                giver_character_id    = COALESCE(:gcid,  giver_character_id),
                prerequisite_quest_id = COALESCE(:pqid,  prerequisite_quest_id),
                reward_gold           = COALESCE(:gold,  reward_gold),
                reward_xp             = COALESCE(:xp,    reward_xp),
                sort_order            = COALESCE(:so,    sort_order)
            WHERE id = :id',
        [':id' => $id, ':title' => $body['title'] ?? null, ':desc' => $body['description'] ?? null,
         ':gcid' => $body['giver_character_id'] ?? null, ':pqid' => $body['prerequisite_quest_id'] ?? null,
         ':gold' => $body['reward_gold'] ?? null, ':xp' => $body['reward_xp'] ?? null,
         ':so' => $body['sort_order'] ?? null]);
    json_response(db_get('SELECT * FROM quests WHERE id = :id', [':id' => $id]));
}

// DELETE /quests/:id
if ($method === 'DELETE' && $id && $id !== 'story' && $sub !== 'objectives') {
    db_run('DELETE FROM quests WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

// POST /quests/:questId/objectives
if ($method === 'POST' && $id && $sub === 'objectives') {
    if (empty($body['objective_type'])) bad_request('objective_type is required');
    $quest = db_get('SELECT story_id FROM quests WHERE id = :id', [':id' => $id]);
    if (!$quest) not_found('Quest not found');
    $oid = new_uuid();
    db_run('INSERT INTO quest_objectives (id, quest_id, story_id, objective_type, target_name, required_count, description, sort_order)
            VALUES (:id,:qid,:sid,:otype,:tname,:rcount,:desc,:so)',
        [':id' => $oid, ':qid' => $id, ':sid' => $quest['story_id'],
         ':otype' => $body['objective_type'], ':tname' => $body['target_name'] ?? null,
         ':rcount' => $body['required_count'] ?? 1, ':desc' => $body['description'] ?? null,
         ':so' => $body['sort_order'] ?? 0]);
    json_response(db_get('SELECT * FROM quest_objectives WHERE id = :id', [':id' => $oid]), 201);
}

// DELETE /quests/objectives/:id
if ($method === 'DELETE' && $id === 'objectives' && $sub) {
    db_run('DELETE FROM quest_objectives WHERE id = :id', [':id' => $sub]);
    json_response(['deleted' => true]);
}

not_found();
