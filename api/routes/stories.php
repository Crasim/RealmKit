<?php
/**
 * /api/stories
 * $method, $segments, $body available from index.php
 */

$id      = $segments[1] ?? null;
$sub     = $segments[2] ?? null;  // 'flags', 'publish', 'engine-config' ...
$subId   = $segments[3] ?? null;

function studio_json_field(?string $value, $fallback = null) {
    if ($value === null || $value === '') return $fallback;
    $decoded = json_decode($value, true);
    return $decoded === null && strtolower(trim($value)) !== 'null' ? $fallback : $decoded;
}

function studio_story_payload(string $storyId): array {
    $story = db_get('
        SELECT s.*, g.name AS genre_name, g.display_name AS genre_display_name
        FROM stories s LEFT JOIN genres g ON g.id = s.genre_id
        WHERE s.id = :id', [':id' => $storyId]);
    if (!$story) not_found('Story not found');

    $story['engine_configs'] = db_get('SELECT * FROM engine_configs WHERE story_id = :id', [':id' => $storyId]);
    $story['ui_config'] = db_get('SELECT * FROM ui_configs WHERE story_id = :id', [':id' => $storyId]);
    $story['factions'] = db_all('SELECT * FROM factions WHERE story_id = :id ORDER BY name', [':id' => $storyId]);
    $story['faction_relations'] = db_all('SELECT * FROM faction_relations WHERE story_id = :id', [':id' => $storyId]);
    $story['story_flag_definitions'] = db_all('SELECT * FROM story_flag_definitions WHERE story_id = :id ORDER BY flag_key', [':id' => $storyId]);

    $maps = db_all('SELECT * FROM maps WHERE story_id = :id ORDER BY is_entry_map DESC, created_at ASC', [':id' => $storyId]);
    foreach ($maps as &$map) {
        $map['width'] = (int)$map['width'];
        $map['height'] = (int)$map['height'];
        $map['is_entry_map'] = (bool)(int)$map['is_entry_map'];
        $map['connections'] = studio_json_field($map['connections'], []);
        $map['meta'] = studio_json_field($map['meta'], null);
    }
    unset($map);

    $mapStates = db_all('SELECT * FROM map_states WHERE story_id = :id', [':id' => $storyId]);
    foreach ($mapStates as &$state) {
        $state['terrain_json'] = studio_json_field($state['terrain_json'], []);
        $state['collision_json'] = studio_json_field($state['collision_json'], []);
        $state['tile_meta_json'] = studio_json_field($state['tile_meta_json'], null);
        $state['meta_json'] = studio_json_field($state['meta_json'], null);
        $state['weather_intensity'] = isset($state['weather_intensity']) ? (float)$state['weather_intensity'] : 0.3;
    }
    unset($state);

    $mapZones = db_all('SELECT * FROM map_zones WHERE story_id = :id ORDER BY map_id, sort_order ASC, created_at ASC', [':id' => $storyId]);
    foreach ($mapZones as &$zone) {
        $zone['x'] = (float)$zone['x'];
        $zone['y'] = (float)$zone['y'];
        $zone['width'] = (float)$zone['width'];
        $zone['height'] = (float)$zone['height'];
        $zone['required_level'] = (int)($zone['required_level'] ?? 0);
        $zone['cost_gold'] = (int)($zone['cost_gold'] ?? 0);
        $zone['meta_json'] = studio_json_field($zone['meta_json'], null);
    }
    unset($zone);

    $mapTriggers = db_all('SELECT * FROM map_triggers WHERE story_id = :id ORDER BY map_id, sort_order ASC, created_at ASC', [':id' => $storyId]);
    foreach ($mapTriggers as &$trigger) {
        $trigger['x'] = (float)$trigger['x'];
        $trigger['y'] = (float)$trigger['y'];
        $trigger['width'] = (float)$trigger['width'];
        $trigger['height'] = (float)$trigger['height'];
        $trigger['radius'] = $trigger['radius'] !== null ? (float)$trigger['radius'] : null;
        $trigger['one_time'] = (bool)(int)($trigger['one_time'] ?? 0);
        $trigger['active'] = !isset($trigger['active']) || (bool)(int)$trigger['active'];
        $trigger['condition_json'] = studio_json_field($trigger['condition_json'], null);
        $trigger['action_json'] = studio_json_field($trigger['action_json'], null);
        $trigger['meta_json'] = studio_json_field($trigger['meta_json'], null);
    }
    unset($trigger);

    $mapSpawners = db_all('SELECT * FROM map_spawners WHERE story_id = :id ORDER BY map_id, sort_order ASC, created_at ASC', [':id' => $storyId]);
    foreach ($mapSpawners as &$spawner) {
        $spawner['x'] = (float)$spawner['x'];
        $spawner['y'] = (float)$spawner['y'];
        $spawner['radius'] = isset($spawner['radius']) ? (float)$spawner['radius'] : 80;
        $spawner['max_active'] = (int)($spawner['max_active'] ?? 3);
        $spawner['one_time'] = (bool)(int)($spawner['one_time'] ?? 0);
        $spawner['active'] = !isset($spawner['active']) || (bool)(int)$spawner['active'];
        $spawner['spawn_pool_json'] = studio_json_field($spawner['spawn_pool_json'], null);
        $spawner['meta_json'] = studio_json_field($spawner['meta_json'], null);
    }
    unset($spawner);

    $mapUnits = db_all('SELECT * FROM map_units WHERE story_id = :id ORDER BY map_id, sort_order ASC, created_at ASC', [':id' => $storyId]);
    foreach ($mapUnits as &$unit) {
        $unit['x'] = (float)$unit['x'];
        $unit['y'] = (float)$unit['y'];
        $unit['meta_json'] = studio_json_field($unit['meta_json'], null);
    }
    unset($unit);

    $unitTemplates = db_all('
        SELECT ut.*, f.name AS faction_name, f.display_name AS faction_display_name
        FROM unit_templates ut
        LEFT JOIN factions f ON f.id = ut.faction_id
        WHERE (ut.story_id = :id OR ut.story_id IS NULL OR ut.is_global = 1)
        ORDER BY ut.category, ut.name', [':id' => $storyId]);
    foreach ($unitTemplates as &$tpl) {
        $tpl['custom_animations'] = studio_json_field($tpl['custom_animations'] ?? null, null);
        $tpl['loot_table_json'] = studio_json_field($tpl['loot_table_json'] ?? null, null);
        $tpl['action_profile_json'] = studio_json_field($tpl['action_profile_json'] ?? null, null);
        $tpl['audio_profile_json'] = studio_json_field($tpl['audio_profile_json'] ?? null, null);
        $tpl['skills'] = db_all('
            SELECT s.*, uts.unlocked_at_level
            FROM skills s
            JOIN unit_template_skills uts ON uts.skill_id = s.id
            WHERE uts.unit_template_id = :id
            ORDER BY uts.unlocked_at_level, s.name', [':id' => $tpl['id']]);
    }
    unset($tpl);

    $characters = db_all('
        SELECT c.*, f.name AS faction_name, f.display_name AS faction_display_name,
               ut.name AS unit_template_name, ut.display_name AS unit_template_display_name
        FROM characters c
        LEFT JOIN factions f ON f.id = c.faction_id
        LEFT JOIN unit_templates ut ON ut.id = c.unit_template_id
        WHERE c.story_id = :id
        ORDER BY c.is_unique DESC, c.name', [':id' => $storyId]);
    foreach ($characters as &$character) {
        $character['loot_override_json'] = studio_json_field($character['loot_override_json'] ?? null, null);
        $character['knowledge_json'] = studio_json_field($character['knowledge_json'] ?? null, null);
        $character['audio_override_json'] = studio_json_field($character['audio_override_json'] ?? null, null);
    }
    unset($character);

    $dialogues = db_all('SELECT * FROM dialogues WHERE story_id = :id ORDER BY created_at ASC', [':id' => $storyId]);

    $quests = db_all('SELECT * FROM quests WHERE story_id = :id ORDER BY sort_order ASC', [':id' => $storyId]);
    foreach ($quests as &$quest) {
        $quest['reward_gold'] = (int)($quest['reward_gold'] ?? 0);
        $quest['reward_xp'] = (int)($quest['reward_xp'] ?? 0);
        $quest['objectives'] = db_all('SELECT * FROM quest_objectives WHERE quest_id = :qid ORDER BY sort_order ASC', [':qid' => $quest['id']]);
    }
    unset($quest);

    $events = db_all('SELECT * FROM story_events WHERE story_id = :id ORDER BY sort_order ASC, created_at ASC', [':id' => $storyId]);
    foreach ($events as &$event) {
        $event['condition_json'] = studio_json_field($event['condition_json'] ?? null, null);
        $event['action_json'] = studio_json_field($event['action_json'] ?? null, null);
    }
    unset($event);

    return [
        'story' => $story,
        'maps' => $maps,
        'map_states' => $mapStates,
        'map_zones' => $mapZones,
        'map_triggers' => $mapTriggers,
        'map_spawners' => $mapSpawners,
        'map_units' => $mapUnits,
        'unit_templates' => $unitTemplates,
        'characters' => $characters,
        'dialogues' => $dialogues,
        'quests' => $quests,
        'events' => $events,
        'factions' => $story['factions'],
        'faction_relations' => $story['faction_relations'],
    ];
}

// ── GET /stories ──────────────────────────────────────────────
if ($method === 'GET' && !$id) {
    $includeUnpublished = isset($_GET['include_unpublished']) && $_GET['include_unpublished'] === '1';
    $whereClause = $includeUnpublished ? '' : 'WHERE s.is_published = 1';
    json_response(db_all('
        SELECT s.id, s.title, s.slug, s.description, s.is_published, s.created_at,
               g.name AS genre_name, g.display_name AS genre_display_name,
               sp.play_count, sp.rating_average, sp.is_featured
        FROM stories s
        LEFT JOIN genres g              ON g.id = s.genre_id
        LEFT JOIN story_publications sp ON sp.story_id = s.id
        ' . $whereClause . '
        ORDER BY s.created_at DESC'));
}

// ── GET /stories/:id ──────────────────────────────────────────
if ($method === 'GET' && $id && !$sub) {
    $story = db_get('
        SELECT s.*, g.name AS genre_name, g.display_name AS genre_display_name
        FROM stories s LEFT JOIN genres g ON g.id = s.genre_id
        WHERE s.id = :id', [':id' => $id]);
    if (!$story) not_found('Story not found');

    $story['engine_configs']         = db_get('SELECT * FROM engine_configs         WHERE story_id = :id', [':id' => $id]);
    $story['ui_config']              = db_get('SELECT * FROM ui_configs             WHERE story_id = :id', [':id' => $id]);
    $story['factions']               = db_all('SELECT * FROM factions               WHERE story_id = :id ORDER BY name', [':id' => $id]);
    $story['faction_relations']      = db_all('SELECT * FROM faction_relations      WHERE story_id = :id', [':id' => $id]);
    $story['story_flag_definitions'] = db_all('SELECT * FROM story_flag_definitions WHERE story_id = :id ORDER BY flag_key', [':id' => $id]);
    json_response($story);
}

// ── GET /stories/:id/flags ────────────────────────────────────
if ($method === 'GET' && $id && $sub === 'studio') {
    json_response(studio_story_payload($id));
}

if ($method === 'GET' && $id && $sub === 'flags') {
    json_response(db_all('SELECT * FROM story_flag_definitions WHERE story_id = :id ORDER BY flag_key',
        [':id' => $id]));
}

// ── POST /stories ─────────────────────────────────────────────
if ($method === 'POST' && !$id) {
    if (empty($body['title'])) bad_request('title is required');
    if (empty($body['slug'])) {
        $body['slug'] = strtolower(trim(preg_replace('/[^a-z0-9]+/', '-', $body['title'])));
        $body['slug'] = trim($body['slug'], '-');
    }
    if (empty($body['slug'])) bad_request('slug is required');
    if (!preg_match('/^[a-z0-9-]+$/', $body['slug'])) bad_request('slug: lowercase letters, numbers and hyphens only');

    $genreId = $body['genre_id'] ?? null;
    if (!$genreId && !empty($body['genre'])) {
        $genre = db_get('SELECT id FROM genres WHERE name = :name', [':name' => $body['genre']]);
        if ($genre) {
            $genreId = $genre['id'];
        }
    }

    $newId = new_uuid();
    db_run('INSERT INTO stories (id, title, slug, genre_id, description, created_by)
            VALUES (:id, :title, :slug, :genre_id, :description, :created_by)',
        [':id' => $newId, ':title' => $body['title'], ':slug' => $body['slug'],
         ':genre_id' => $genreId, ':description' => $body['description'] ?? null,
         ':created_by' => $body['created_by'] ?? null]);
    db_run('INSERT INTO engine_configs (id, story_id) VALUES (:id, :sid)',
        [':id' => new_uuid(), ':sid' => $newId]);
    db_run('INSERT INTO ui_configs (id, story_id) VALUES (:id, :sid)',
        [':id' => new_uuid(), ':sid' => $newId]);
    json_response(db_get('SELECT * FROM stories WHERE id = :id', [':id' => $newId]), 201);
}

// ── POST /stories/:id/publish ─────────────────────────────────
if ($method === 'POST' && $id && $sub === 'publish') {
    db_run('UPDATE stories SET is_published = 1 WHERE id = :id', [':id' => $id]);
    $existing = db_get('SELECT id FROM story_publications WHERE story_id = :id', [':id' => $id]);
    if ($existing) {
        db_run('UPDATE story_publications SET published_at = CURRENT_TIMESTAMP WHERE story_id = :id', [':id' => $id]);
    } else {
        db_run('INSERT INTO story_publications (id, story_id, published_by) VALUES (:id, :sid, :pub)',
            [':id' => new_uuid(), ':sid' => $id, ':pub' => $body['user_id'] ?? null]);
    }
    json_response(['published' => true]);
}

// ── POST /stories/:id/unpublish ───────────────────────────────
if ($method === 'POST' && $id && $sub === 'unpublish') {
    db_run('UPDATE stories SET is_published = 0 WHERE id = :id', [':id' => $id]);
    json_response(['published' => false]);
}

// ── POST /stories/:id/flags ───────────────────────────────────
if ($method === 'POST' && $id && $sub === 'flags') {
    if (empty($body['flag_key']))  bad_request('flag_key is required');
    if (empty($body['flag_type'])) bad_request('flag_type is required');
    $fid = new_uuid();
    db_run('INSERT INTO story_flag_definitions (id, story_id, flag_key, flag_type, default_value, description)
            VALUES (:id, :sid, :fk, :ft, :dv, :desc)',
        [':id' => $fid, ':sid' => $id, ':fk' => $body['flag_key'], ':ft' => $body['flag_type'],
         ':dv' => $body['default_value'] ?? 'false', ':desc' => $body['description'] ?? null]);
    json_response(db_get('SELECT * FROM story_flag_definitions WHERE id = :id', [':id' => $fid]), 201);
}

// ── PATCH /stories/:id ────────────────────────────────────────
if ($method === 'PATCH' && $id && !$sub) {
    db_run('UPDATE stories SET
                title       = COALESCE(:title,       title),
                slug        = COALESCE(:slug,        slug),
                genre_id    = COALESCE(:genre_id,    genre_id),
                description = COALESCE(:description, description)
            WHERE id = :id',
        [':id' => $id, ':title' => $body['title'] ?? null, ':slug' => $body['slug'] ?? null,
         ':genre_id' => $body['genre_id'] ?? null, ':description' => $body['description'] ?? null]);
    json_response(db_get('SELECT * FROM stories WHERE id = :id', [':id' => $id]));
}

// ── PUT /stories/:id/engine-config ────────────────────────────
if ($method === 'PUT' && $id && $sub === 'engine-config') {
    $b = $body;
    $existing = db_get('SELECT id FROM engine_configs WHERE story_id = :id', [':id' => $id]);
    if ($existing) {
        db_run('UPDATE engine_configs SET
                    terrain_water_level     = COALESCE(:twl, terrain_water_level),
                    terrain_hill_level      = COALESCE(:thl, terrain_hill_level),
                    terrain_mountain_level  = COALESCE(:tml, terrain_mountain_level),
                    terrain_elevation_scale = COALESCE(:tes, terrain_elevation_scale),
                    default_weather         = COALESCE(:dw,  default_weather),
                    weather_intensity       = COALESCE(:wi,  weather_intensity),
                    day_night_speed         = COALESCE(:dns, day_night_speed),
                    lighting_theme          = COALESCE(:lt,  lighting_theme),
                    ui_theme                = COALESCE(:ut,  ui_theme),
                    ambient_audio_key       = COALESCE(:aak, ambient_audio_key),
                    default_map_width       = COALESCE(:dmw, default_map_width),
                    default_map_height      = COALESCE(:dmh, default_map_height)
                WHERE story_id = :sid',
            [':sid' => $id, ':twl' => $b['terrain_water_level'] ?? null,
             ':thl' => $b['terrain_hill_level'] ?? null, ':tml' => $b['terrain_mountain_level'] ?? null,
             ':tes' => $b['terrain_elevation_scale'] ?? null, ':dw' => $b['default_weather'] ?? null,
             ':wi' => $b['weather_intensity'] ?? null, ':dns' => $b['day_night_speed'] ?? null,
             ':lt' => $b['lighting_theme'] ?? null, ':ut' => $b['ui_theme'] ?? null,
             ':aak' => $b['ambient_audio_key'] ?? null, ':dmw' => $b['default_map_width'] ?? null,
             ':dmh' => $b['default_map_height'] ?? null]);
    } else {
        db_run('INSERT INTO engine_configs (id, story_id, terrain_water_level, terrain_hill_level,
                    terrain_mountain_level, terrain_elevation_scale, default_weather,
                    weather_intensity, day_night_speed, lighting_theme, ui_theme,
                    ambient_audio_key, default_map_width, default_map_height)
                VALUES (:eid,:sid,:twl,:thl,:tml,:tes,:dw,:wi,:dns,:lt,:ut,:aak,:dmw,:dmh)',
            [':eid' => new_uuid(), ':sid' => $id,
             ':twl' => $b['terrain_water_level'] ?? null, ':thl' => $b['terrain_hill_level'] ?? null,
             ':tml' => $b['terrain_mountain_level'] ?? null, ':tes' => $b['terrain_elevation_scale'] ?? null,
             ':dw' => $b['default_weather'] ?? null, ':wi' => $b['weather_intensity'] ?? null,
             ':dns' => $b['day_night_speed'] ?? null, ':lt' => $b['lighting_theme'] ?? null,
             ':ut' => $b['ui_theme'] ?? null, ':aak' => $b['ambient_audio_key'] ?? null,
             ':dmw' => $b['default_map_width'] ?? null, ':dmh' => $b['default_map_height'] ?? null]);
    }
    json_response(db_get('SELECT * FROM engine_configs WHERE story_id = :id', [':id' => $id]));
}

// —— PUT /stories/:id/ui-config ————————————————————————————————————————————————
if ($method === 'PUT' && $id && $sub === 'ui-config') {
    $b = $body;
    $existing = db_get('SELECT id FROM ui_configs WHERE story_id = :id', [':id' => $id]);
    if ($existing) {
        db_run('UPDATE ui_configs SET
                    ui_mode              = COALESCE(:um, ui_mode),
                    theme_key            = COALESCE(:tk, theme_key),
                    resource_labels_json = COALESCE(:rlj, resource_labels_json),
                    panel_config_json    = COALESCE(:pcj, panel_config_json),
                    layout_config_json   = COALESCE(:lcj, layout_config_json)
                WHERE story_id = :sid',
            [':sid' => $id,
             ':um' => $b['ui_mode'] ?? null,
             ':tk' => $b['theme_key'] ?? null,
             ':rlj' => $b['resource_labels_json'] ?? null,
             ':pcj' => $b['panel_config_json'] ?? null,
             ':lcj' => $b['layout_config_json'] ?? null]);
    } else {
        db_run('INSERT INTO ui_configs (id, story_id, ui_mode, theme_key, resource_labels_json, panel_config_json, layout_config_json)
                VALUES (:id, :sid, :um, :tk, :rlj, :pcj, :lcj)',
            [':id' => new_uuid(),
             ':sid' => $id,
             ':um' => $b['ui_mode'] ?? 'hybrid',
             ':tk' => $b['theme_key'] ?? 'realmkit-parchment',
             ':rlj' => $b['resource_labels_json'] ?? null,
             ':pcj' => $b['panel_config_json'] ?? null,
             ':lcj' => $b['layout_config_json'] ?? null]);
    }
    json_response(db_get('SELECT * FROM ui_configs WHERE story_id = :id', [':id' => $id]));
}

// ── DELETE /stories/:id ───────────────────────────────────────
if ($method === 'DELETE' && $id && !$sub) {
    db_run('DELETE FROM stories WHERE id = :id', [':id' => $id]);
    json_response(['deleted' => true]);
}

// ── DELETE /stories/:id/flags/:flagId ────────────────────────
if ($method === 'DELETE' && $id && $sub === 'flags' && $subId) {
    db_run('DELETE FROM story_flag_definitions WHERE id = :fid AND story_id = :sid',
        [':fid' => $subId, ':sid' => $id]);
    json_response(['deleted' => true]);
}

not_found();
