<?php
/**
 * maps.php — CRUD for story maps
 *
 * Variables available from index.php: $method, $segments, $query, $body
 *
 * GET    /api/maps?story_id=xxx         list maps for a story
 * GET    /api/maps/{id}                 single map (full)
 * POST   /api/maps                      create / upsert
 * PATCH  /api/maps/{id}                 partial update
 * DELETE /api/maps/{id}                 delete
 */

$id    = $segments[1] ?? null;   // /maps/{id}
$sub   = $segments[2] ?? null;   // /maps/{id}/studio
$query = $_GET;

// ── helpers ───────────────────────────────────────────────────────────────────

function map_row(array $row): array {
    return [
        'id'            => $row['id'],
        'story_id'      => $row['story_id'],
        'name'          => $row['name'],
        'map_type'      => $row['map_type'],
        'description'   => $row['description'] ?? '',
        'width'         => (int)$row['width'],
        'height'        => (int)$row['height'],
        'tileset_id'    => $row['tileset_id'],
        'tileset_path'  => $row['tileset_path'] ?? '',
        'is_entry_map'  => (bool)(int)$row['is_entry_map'],
        'parent_map_id' => $row['parent_map_id'],
        'connections'   => json_decode($row['connections'] ?? '[]', true) ?: [],
        'meta'          => json_decode($row['meta'] ?? 'null', true),
        'created_at'    => $row['created_at'],
        'updated_at'    => $row['updated_at'],
    ];
}

function map_state_row(?array $row, array $map = []): array {
    return [
        'id' => $row['id'] ?? null,
        'story_id' => $row['story_id'] ?? ($map['story_id'] ?? null),
        'map_id' => $row['map_id'] ?? ($map['id'] ?? null),
        'terrain_json' => json_decode($row['terrain_json'] ?? '[]', true) ?: [],
        'collision_json' => json_decode($row['collision_json'] ?? '[]', true) ?: [],
        'weather_override' => $row['weather_override'] ?? null,
        'weather_intensity' => isset($row['weather_intensity']) ? (float)$row['weather_intensity'] : 0.3,
        'tile_meta_json' => json_decode($row['tile_meta_json'] ?? 'null', true),
        'meta_json' => json_decode($row['meta_json'] ?? 'null', true),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function map_zone_row(array $row): array {
    return [
        'id' => $row['id'],
        'story_id' => $row['story_id'],
        'map_id' => $row['map_id'],
        'name' => $row['name'],
        'zone_type' => $row['zone_type'],
        'x' => (float)$row['x'],
        'y' => (float)$row['y'],
        'width' => (float)$row['width'],
        'height' => (float)$row['height'],
        'target_map_id' => $row['target_map_id'],
        'target_spawn_id' => $row['target_spawn_id'],
        'required_level' => (int)($row['required_level'] ?? 0),
        'cost_gold' => (int)($row['cost_gold'] ?? 0),
        'sort_order' => (int)($row['sort_order'] ?? 0),
        'meta_json' => json_decode($row['meta_json'] ?? 'null', true),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function map_trigger_row(array $row): array {
    return [
        'id' => $row['id'],
        'story_id' => $row['story_id'],
        'map_id' => $row['map_id'],
        'name' => $row['name'],
        'trigger_type' => $row['trigger_type'],
        'x' => (float)$row['x'],
        'y' => (float)$row['y'],
        'width' => (float)$row['width'],
        'height' => (float)$row['height'],
        'shape' => $row['shape'] ?? 'rect',
        'radius' => $row['radius'] !== null ? (float)$row['radius'] : null,
        'one_time' => (bool)(int)($row['one_time'] ?? 0),
        'active' => !isset($row['active']) || (bool)(int)$row['active'],
        'condition_json' => json_decode($row['condition_json'] ?? 'null', true),
        'action_json' => json_decode($row['action_json'] ?? 'null', true),
        'sort_order' => (int)($row['sort_order'] ?? 0),
        'meta_json' => json_decode($row['meta_json'] ?? 'null', true),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function map_spawner_row(array $row): array {
    return [
        'id' => $row['id'],
        'story_id' => $row['story_id'],
        'map_id' => $row['map_id'],
        'name' => $row['name'],
        'unit_template_id' => $row['unit_template_id'],
        'x' => (float)$row['x'],
        'y' => (float)$row['y'],
        'radius' => isset($row['radius']) ? (float)$row['radius'] : 80,
        'max_active' => (int)($row['max_active'] ?? 3),
        'location_id' => $row['location_id'],
        'time_window' => $row['time_window'],
        'one_time' => (bool)(int)($row['one_time'] ?? 0),
        'active' => !isset($row['active']) || (bool)(int)$row['active'],
        'spawn_pool_json' => json_decode($row['spawn_pool_json'] ?? 'null', true),
        'sort_order' => (int)($row['sort_order'] ?? 0),
        'meta_json' => json_decode($row['meta_json'] ?? 'null', true),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function map_unit_row(array $row): array {
    return [
        'id' => $row['id'],
        'story_id' => $row['story_id'],
        'map_id' => $row['map_id'],
        'unit_template_id' => $row['unit_template_id'],
        'character_id' => $row['character_id'],
        'name' => $row['name'],
        'x' => (float)$row['x'],
        'y' => (float)$row['y'],
        'facing' => $row['facing'],
        'faction_id' => $row['faction_id'],
        'behavior' => $row['behavior'],
        'sort_order' => (int)($row['sort_order'] ?? 0),
        'meta_json' => json_decode($row['meta_json'] ?? 'null', true),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function studio_map_payload(string $mapId): array {
    $map = db_get('SELECT * FROM maps WHERE id = ?', [$mapId]);
    if (!$map) not_found('Map not found');

    return [
        'map' => map_row($map),
        'state' => map_state_row(db_get('SELECT * FROM map_states WHERE map_id = ?', [$mapId]), $map),
        'zones' => array_map('map_zone_row', db_all('SELECT * FROM map_zones WHERE map_id = ? ORDER BY sort_order ASC, created_at ASC', [$mapId])),
        'triggers' => array_map('map_trigger_row', db_all('SELECT * FROM map_triggers WHERE map_id = ? ORDER BY sort_order ASC, created_at ASC', [$mapId])),
        'spawners' => array_map('map_spawner_row', db_all('SELECT * FROM map_spawners WHERE map_id = ? ORDER BY sort_order ASC, created_at ASC', [$mapId])),
        'units' => array_map('map_unit_row', db_all('SELECT * FROM map_units WHERE map_id = ? ORDER BY sort_order ASC, created_at ASC', [$mapId])),
    ];
}

function studio_json($value): ?string {
    if ($value === null) return null;
    if (is_string($value)) return $value;
    return json_encode($value);
}

function persist_map_collection(string $table, string $mapId, string $storyId, array $rows): void {
    db_run("DELETE FROM {$table} WHERE map_id = ?", [$mapId]);

    foreach ($rows as $index => $row) {
        if (!is_array($row)) continue;
        if ($table === 'map_zones') {
            db_run(
                'INSERT INTO map_zones
                    (id, story_id, map_id, name, zone_type, x, y, width, height, target_map_id, target_spawn_id, required_level, cost_gold, sort_order, meta_json)
                 VALUES
                    (:id, :sid, :mid, :name, :zone_type, :x, :y, :width, :height, :target_map_id, :target_spawn_id, :required_level, :cost_gold, :sort_order, :meta_json)',
                coalesce_params([
                    ':id' => $row['id'] ?? new_uuid(),
                    ':sid' => $storyId,
                    ':mid' => $mapId,
                    ':name' => $row['name'] ?? ('Zone ' . ($index + 1)),
                    ':zone_type' => $row['zone_type'] ?? $row['type'] ?? 'door',
                    ':x' => $row['x'] ?? 0,
                    ':y' => $row['y'] ?? 0,
                    ':width' => $row['width'] ?? 100,
                    ':height' => $row['height'] ?? 100,
                    ':target_map_id' => $row['target_map_id'] ?? $row['targetMap'] ?? null,
                    ':target_spawn_id' => $row['target_spawn_id'] ?? $row['targetSpawnId'] ?? null,
                    ':required_level' => $row['required_level'] ?? $row['requiredLevel'] ?? 0,
                    ':cost_gold' => $row['cost_gold'] ?? $row['costGold'] ?? 0,
                    ':sort_order' => $row['sort_order'] ?? $index,
                    ':meta_json' => studio_json($row['meta_json'] ?? $row),
                ])
            );
            continue;
        }

        if ($table === 'map_triggers') {
            db_run(
                'INSERT INTO map_triggers
                    (id, story_id, map_id, name, trigger_type, x, y, width, height, shape, radius, one_time, active, condition_json, action_json, sort_order, meta_json)
                 VALUES
                    (:id, :sid, :mid, :name, :trigger_type, :x, :y, :width, :height, :shape, :radius, :one_time, :active, :condition_json, :action_json, :sort_order, :meta_json)',
                coalesce_params([
                    ':id' => $row['id'] ?? new_uuid(),
                    ':sid' => $storyId,
                    ':mid' => $mapId,
                    ':name' => $row['name'] ?? ('Trigger ' . ($index + 1)),
                    ':trigger_type' => $row['trigger_type'] ?? $row['type'] ?? 'on_enter',
                    ':x' => $row['x'] ?? 0,
                    ':y' => $row['y'] ?? 0,
                    ':width' => $row['width'] ?? 100,
                    ':height' => $row['height'] ?? 100,
                    ':shape' => $row['shape'] ?? 'rect',
                    ':radius' => $row['radius'] ?? null,
                    ':one_time' => !empty($row['one_time']) || !empty($row['oneTime']) ? 1 : 0,
                    ':active' => array_key_exists('active', $row) ? ((int)(bool)$row['active']) : 1,
                    ':condition_json' => studio_json($row['condition_json'] ?? $row['conditions'] ?? null),
                    ':action_json' => studio_json($row['action_json'] ?? $row['actions'] ?? null),
                    ':sort_order' => $row['sort_order'] ?? $index,
                    ':meta_json' => studio_json($row['meta_json'] ?? $row),
                ])
            );
            continue;
        }

        if ($table === 'map_spawners') {
            db_run(
                'INSERT INTO map_spawners
                    (id, story_id, map_id, name, unit_template_id, x, y, radius, max_active, location_id, time_window, one_time, active, spawn_pool_json, sort_order, meta_json)
                 VALUES
                    (:id, :sid, :mid, :name, :unit_template_id, :x, :y, :radius, :max_active, :location_id, :time_window, :one_time, :active, :spawn_pool_json, :sort_order, :meta_json)',
                coalesce_params([
                    ':id' => $row['id'] ?? new_uuid(),
                    ':sid' => $storyId,
                    ':mid' => $mapId,
                    ':name' => $row['name'] ?? ('Spawner ' . ($index + 1)),
                    ':unit_template_id' => $row['unit_template_id'] ?? $row['templateId'] ?? null,
                    ':x' => $row['x'] ?? 0,
                    ':y' => $row['y'] ?? 0,
                    ':radius' => $row['radius'] ?? 80,
                    ':max_active' => $row['max_active'] ?? $row['maxActive'] ?? 3,
                    ':location_id' => $row['location_id'] ?? $row['locationId'] ?? null,
                    ':time_window' => $row['time_window'] ?? $row['timeOfDay'] ?? null,
                    ':one_time' => !empty($row['one_time']) || !empty($row['oneTime']) ? 1 : 0,
                    ':active' => array_key_exists('active', $row) ? ((int)(bool)$row['active']) : 1,
                    ':spawn_pool_json' => studio_json($row['spawn_pool_json'] ?? $row['spawnPool'] ?? null),
                    ':sort_order' => $row['sort_order'] ?? $index,
                    ':meta_json' => studio_json($row['meta_json'] ?? $row),
                ])
            );
            continue;
        }

        if ($table === 'map_units') {
            db_run(
                'INSERT INTO map_units
                    (id, story_id, map_id, unit_template_id, character_id, name, x, y, facing, faction_id, behavior, sort_order, meta_json)
                 VALUES
                    (:id, :sid, :mid, :unit_template_id, :character_id, :name, :x, :y, :facing, :faction_id, :behavior, :sort_order, :meta_json)',
                coalesce_params([
                    ':id' => $row['id'] ?? new_uuid(),
                    ':sid' => $storyId,
                    ':mid' => $mapId,
                    ':unit_template_id' => $row['unit_template_id'] ?? $row['templateId'] ?? null,
                    ':character_id' => $row['character_id'] ?? null,
                    ':name' => $row['name'] ?? null,
                    ':x' => $row['x'] ?? 0,
                    ':y' => $row['y'] ?? 0,
                    ':facing' => $row['facing'] ?? null,
                    ':faction_id' => $row['faction_id'] ?? null,
                    ':behavior' => $row['behavior'] ?? null,
                    ':sort_order' => $row['sort_order'] ?? $index,
                    ':meta_json' => studio_json($row['meta_json'] ?? $row),
                ])
            );
        }
    }
}

// —— GET /maps/{id}/studio ——————————————————————————————————————————————————————
if ($method === 'GET' && $id && $id !== 'studio' && $sub === 'studio') {
    json_response(studio_map_payload($id));
}

// —— PUT /maps/{id}/studio ——————————————————————————————————————————————————————
if ($method === 'PUT' && $id && $id !== 'studio' && $sub === 'studio') {
    $map = db_get('SELECT * FROM maps WHERE id = ?', [$id]);
    if (!$map) json_response(['error' => 'Not found'], 404);

    $state = $body['state'] ?? null;
    if ($state !== null || array_key_exists('terrain_json', $body) || array_key_exists('collision_json', $body)) {
        $stateRow = $state ?: $body;
        $existingState = db_get('SELECT * FROM map_states WHERE map_id = ?', [$id]);
        $existingTerrain = $existingState ? ($existingState['terrain_json'] ?? '[]') : '[]';
        $existingCollision = $existingState ? ($existingState['collision_json'] ?? '[]') : '[]';
        $existingWeather = $existingState['weather_override'] ?? null;
        $existingIntensity = $existingState && isset($existingState['weather_intensity']) ? $existingState['weather_intensity'] : 0.3;
        $existingTileMeta = $existingState['tile_meta_json'] ?? null;
        $existingMeta = $existingState['meta_json'] ?? null;
        db_run(
            'INSERT INTO map_states
                (id, story_id, map_id, terrain_json, collision_json, weather_override, weather_intensity, tile_meta_json, meta_json)
             VALUES
                (:id, :sid, :mid, :terrain_json, :collision_json, :weather_override, :weather_intensity, :tile_meta_json, :meta_json)
             ON CONFLICT(map_id) DO UPDATE SET
                terrain_json = excluded.terrain_json,
                collision_json = excluded.collision_json,
                weather_override = excluded.weather_override,
                weather_intensity = excluded.weather_intensity,
                tile_meta_json = excluded.tile_meta_json,
                meta_json = excluded.meta_json',
            coalesce_params([
                ':id' => $existingState['id'] ?? new_uuid(),
                ':sid' => $map['story_id'],
                ':mid' => $id,
                ':terrain_json' => array_key_exists('terrain_json', $stateRow) || array_key_exists('terrain', $stateRow)
                    ? studio_json($stateRow['terrain_json'] ?? $stateRow['terrain'] ?? [])
                    : $existingTerrain,
                ':collision_json' => array_key_exists('collision_json', $stateRow) || array_key_exists('collision', $stateRow)
                    ? studio_json($stateRow['collision_json'] ?? $stateRow['collision'] ?? [])
                    : $existingCollision,
                ':weather_override' => array_key_exists('weather_override', $stateRow) ? $stateRow['weather_override'] : $existingWeather,
                ':weather_intensity' => array_key_exists('weather_intensity', $stateRow) ? $stateRow['weather_intensity'] : $existingIntensity,
                ':tile_meta_json' => array_key_exists('tile_meta_json', $stateRow) ? studio_json($stateRow['tile_meta_json']) : $existingTileMeta,
                ':meta_json' => array_key_exists('meta_json', $stateRow) || array_key_exists('meta', $stateRow)
                    ? studio_json($stateRow['meta_json'] ?? $stateRow['meta'] ?? null)
                    : $existingMeta,
            ])
        );
    }

    if (array_key_exists('zones', $body) && is_array($body['zones'])) {
        persist_map_collection('map_zones', $id, $map['story_id'], $body['zones']);
    }
    if (array_key_exists('triggers', $body) && is_array($body['triggers'])) {
        persist_map_collection('map_triggers', $id, $map['story_id'], $body['triggers']);
    }
    if (array_key_exists('spawners', $body) && is_array($body['spawners'])) {
        persist_map_collection('map_spawners', $id, $map['story_id'], $body['spawners']);
    }
    if (array_key_exists('units', $body) && is_array($body['units'])) {
        persist_map_collection('map_units', $id, $map['story_id'], $body['units']);
    }

    json_response(studio_map_payload($id));
}

// ── GET /maps?story_id=xxx ────────────────────────────────────────────────────
if ($method === 'GET' && !$id) {
    $storyId = $query['story_id'] ?? null;
    if (!$storyId) {
        json_response(['error' => 'story_id query param required'], 400);
    }
    $rows = db_all(
        'SELECT * FROM maps WHERE story_id = ? ORDER BY is_entry_map DESC, created_at ASC',
        [$storyId]
    );
    json_response(array_map('map_row', $rows));
}

// ── GET /maps/{id} ────────────────────────────────────────────────────────────
if ($method === 'GET' && $id) {
    $row = db_get('SELECT * FROM maps WHERE id = ?', [$id]);
    if (!$row) json_response(['error' => 'Not found'], 404);
    json_response(map_row($row));
}

// ── POST /maps ────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $mapId   = $body['id']       ?? ('map_' . substr(new_uuid(), 0, 8));
    $storyId = $body['story_id'] ?? null;
    if (!$storyId) json_response(['error' => 'story_id required'], 400);

    $name = trim($body['name'] ?? '');
    if ($name === '') json_response(['error' => 'name required'], 400);

    $connections = $body['connections'] ?? [];
    if (is_array($connections)) $connections = json_encode($connections);

    $meta = $body['meta'] ?? null;
    if (is_array($meta)) $meta = json_encode($meta);

    db_run(
        'INSERT OR REPLACE INTO maps
            (id, story_id, name, map_type, description, width, height,
             tileset_id, tileset_path, is_entry_map, parent_map_id, connections, meta)
         VALUES
            (:id, :story_id, :name, :map_type, :description, :width, :height,
             :tileset_id, :tileset_path, :is_entry_map, :parent_map_id, :connections, :meta)',
        coalesce_params([
            ':id'            => $mapId,
            ':story_id'      => $storyId,
            ':name'          => $name,
            ':map_type'      => $body['map_type']      ?? 'overworld',
            ':description'   => $body['description']   ?? '',
            ':width'         => (int)($body['width']   ?? 20),
            ':height'        => (int)($body['height']  ?? 15),
            ':tileset_id'    => $body['tileset_id']    ?? null,
            ':tileset_path'  => $body['tileset_path']  ?? null,
            ':is_entry_map'  => (int)(bool)($body['is_entry_map'] ?? false),
            ':parent_map_id' => $body['parent_map_id'] ?? null,
            ':connections'   => $connections,
            ':meta'          => $meta,
        ])
    );

    // Enforce single entry map per story
    if (!empty($body['is_entry_map'])) {
        db_run(
            'UPDATE maps SET is_entry_map = 0 WHERE story_id = ? AND id != ? AND is_entry_map = 1',
            [$storyId, $mapId]
        );
    }

    $row = db_get('SELECT * FROM maps WHERE id = ?', [$mapId]);
    json_response(map_row($row), 201);
}

// ── PATCH /maps/{id} ─────────────────────────────────────────────────────────
if ($method === 'PATCH' && $id) {
    $row = db_get('SELECT * FROM maps WHERE id = ?', [$id]);
    if (!$row) json_response(['error' => 'Not found'], 404);

    $fields = [];
    $params = [];

    $allowed = ['name','map_type','description','width','height',
                'tileset_id','tileset_path','is_entry_map','parent_map_id','meta'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "$f = :$f";
            $params[":$f"] = ($f === 'is_entry_map') ? (int)(bool)$body[$f] : $body[$f];
        }
    }
    if (array_key_exists('connections', $body)) {
        $fields[] = 'connections = :connections';
        $c = $body['connections'];
        $params[':connections'] = is_array($c) ? json_encode($c) : $c;
    }
    if (!empty($fields)) {
        $params[':id'] = $id;
        db_run('UPDATE maps SET ' . implode(', ', $fields) . ' WHERE id = :id', $params);
    }

    if (isset($body['is_entry_map']) && $body['is_entry_map']) {
        db_run(
            'UPDATE maps SET is_entry_map = 0 WHERE story_id = ? AND id != ? AND is_entry_map = 1',
            [$row['story_id'], $id]
        );
    }

    json_response(map_row(db_get('SELECT * FROM maps WHERE id = ?', [$id])));
}

// ── DELETE /maps/{id} ────────────────────────────────────────────────────────
if ($method === 'DELETE' && $id) {
    $row = db_get('SELECT id FROM maps WHERE id = ?', [$id]);
    if (!$row) json_response(['error' => 'Not found'], 404);
    db_run('DELETE FROM maps WHERE id = ?', [$id]);
    json_response(['deleted' => true, 'id' => $id]);
}

json_response(['error' => 'Method not allowed'], 405);
