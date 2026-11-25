<?php
/**
 * audio-projects.php — Music Composer project storage
 *
 * Projects are pure JSON — no files on disk.
 * All data lives in the audio_projects table.
 *
 * GET    /audio-projects            — list all projects (summary, no full data)
 * GET    /audio-projects/{id}       — single project including full project_data
 * POST   /audio-projects            — create / upsert a project  (JSON body)
 * PATCH  /audio-projects/{id}       — update name / tags / data  (JSON body)
 * DELETE /audio-projects/{id}       — remove a project
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function ap_error(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

/** Map a DB row to the shape the front-end expects (summary or full). */
function ap_row_summary(array $row): array {
    return [
        'id'          => $row['id'],
        'name'        => $row['name'],
        'bpm'         => (int) $row['bpm'],
        'bars'        => (int) $row['bars'],
        'track_count' => (int) $row['track_count'],
        'track_names' => $row['track_names'] ? json_decode($row['track_names'], true) : [],
        'tags'        => $row['tags'],
        'saved_at'    => $row['created_at'],
        'updated_at'  => $row['updated_at'],
    ];
}

function ap_row_full(array $row): array {
    $summary = ap_row_summary($row);
    $summary['data'] = $row['project_data'] ? json_decode($row['project_data'], true) : null;
    return $summary;
}

// ── Route ─────────────────────────────────────────────────────────────────────

$id = $segments[1] ?? null;

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {

    if ($id !== null) {
        $row = db_get('SELECT * FROM audio_projects WHERE id = ?', [$id]);
        if (!$row) ap_error("Project '$id' not found", 404);
        echo json_encode(ap_row_full($row));
    } else {
        // List — summary only (no project_data to keep payload small)
        $rows = db_all('SELECT id, name, bpm, bars, track_count, track_names, tags, created_at, updated_at
                        FROM audio_projects ORDER BY updated_at DESC');
        echo json_encode(array_map('ap_row_summary', $rows));
    }

// ── POST (create / upsert) ────────────────────────────────────────────────────
} elseif ($method === 'POST') {

    $clientId = trim($body['id'] ?? '');
    $name     = trim($body['name'] ?? '');
    if ($name === '') ap_error('name is required');

    $data = $body['data'] ?? null;
    if ($data === null) ap_error('data is required');

    $projectId  = $clientId !== '' ? $clientId : new_uuid();
    $bpm        = (int)($data['bpm']              ?? $body['bpm']  ?? 120);
    $bars       = (int)($data['bars']             ?? $body['bars'] ?? 2);
    $tracks     = $data['tracks']                 ?? [];
    $trackCount = count($tracks);
    $trackNames = json_encode(array_values(array_map(fn($t) => $t['name'] ?? '', $tracks)));
    $tags       = trim($body['tags']              ?? '');
    $dataJson   = json_encode($data);

    db_run(
        'INSERT OR REPLACE INTO audio_projects
             (id, name, bpm, bars, track_count, track_names, tags, project_data,
              created_at, updated_at)
         VALUES
             (:id, :name, :bpm, :bars, :track_count, :track_names, :tags, :project_data,
              COALESCE((SELECT created_at FROM audio_projects WHERE id = :id2), datetime(\'now\')),
              datetime(\'now\'))',
        coalesce_params([
            ':id'           => $projectId,
            ':id2'          => $projectId,
            ':name'         => $name,
            ':bpm'          => $bpm,
            ':bars'         => $bars,
            ':track_count'  => $trackCount,
            ':track_names'  => $trackNames,
            ':tags'         => $tags !== '' ? $tags : null,
            ':project_data' => $dataJson,
        ])
    );

    $row = db_get('SELECT * FROM audio_projects WHERE id = ?', [$projectId]);
    http_response_code(201);
    echo json_encode(ap_row_full($row));

// ── PATCH (update metadata or data) ──────────────────────────────────────────
} elseif ($method === 'PATCH') {

    if (!$id) ap_error('Project ID required', 400);
    $row = db_get('SELECT * FROM audio_projects WHERE id = ?', [$id]);
    if (!$row) ap_error("Project '$id' not found", 404);

    $sets   = ['updated_at = datetime(\'now\')'];
    $params = [':id' => $id];

    if (isset($body['name'])) {
        $sets[] = 'name = :name';
        $params[':name'] = trim($body['name']);
    }
    if (isset($body['tags'])) {
        $sets[] = 'tags = :tags';
        $params[':tags'] = trim($body['tags']) ?: null;
    }
    if (isset($body['data'])) {
        $data       = $body['data'];
        $tracks     = $data['tracks'] ?? [];
        $trackCount = count($tracks);
        $trackNames = json_encode(array_values(array_map(fn($t) => $t['name'] ?? '', $tracks)));

        $sets[] = 'bpm          = :bpm';
        $sets[] = 'bars         = :bars';
        $sets[] = 'track_count  = :track_count';
        $sets[] = 'track_names  = :track_names';
        $sets[] = 'project_data = :project_data';

        $params[':bpm']          = (int)($data['bpm']  ?? $row['bpm']);
        $params[':bars']         = (int)($data['bars'] ?? $row['bars']);
        $params[':track_count']  = $trackCount;
        $params[':track_names']  = $trackNames;
        $params[':project_data'] = json_encode($data);
    }

    db_run(
        'UPDATE audio_projects SET ' . implode(', ', $sets) . ' WHERE id = :id',
        $params
    );

    $updated = db_get('SELECT * FROM audio_projects WHERE id = ?', [$id]);
    echo json_encode(ap_row_full($updated));

// ── DELETE ────────────────────────────────────────────────────────────────────
} elseif ($method === 'DELETE') {

    if (!$id) ap_error('Project ID required', 400);
    $row = db_get('SELECT id FROM audio_projects WHERE id = ?', [$id]);
    if (!$row) ap_error("Project '$id' not found", 404);

    db_run('DELETE FROM audio_projects WHERE id = ?', [$id]);
    http_response_code(200);
    echo json_encode(['deleted' => $id]);

} else {
    http_response_code(405);
    header('Allow: GET, POST, PATCH, DELETE');
    echo json_encode(['error' => 'Method not allowed']);
}
