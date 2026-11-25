-- ============================================================
--  RealmKit Platform - Studio Data Model
--  Database: SQLite
--  Migration: 010
--
--  Purpose:
--   Persist StarEdit-style authoring data for Realm Studio:
--   - per-map terrain/collision/weather state
--   - zones / triggers / spawners / placed units
--   - richer unit and NPC metadata
--   - story-scoped non-quest events
-- ============================================================

-- ============================================================
--  UNIT / NPC EXTENSIONS
-- ============================================================
ALTER TABLE unit_templates ADD COLUMN faction_id TEXT REFERENCES factions(id) ON DELETE SET NULL;
ALTER TABLE unit_templates ADD COLUMN loot_table_json TEXT;
ALTER TABLE unit_templates ADD COLUMN action_profile_json TEXT;
ALTER TABLE unit_templates ADD COLUMN audio_profile_json TEXT;

ALTER TABLE characters ADD COLUMN loot_override_json TEXT;
ALTER TABLE characters ADD COLUMN knowledge_json TEXT;
ALTER TABLE characters ADD COLUMN audio_override_json TEXT;

-- ============================================================
--  MAP STATE
--  One record per map for terrain/collision/weather/editor data.
-- ============================================================
CREATE TABLE IF NOT EXISTS map_states (
    id                TEXT PRIMARY KEY,
    story_id          TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    map_id            TEXT NOT NULL UNIQUE REFERENCES maps(id) ON DELETE CASCADE,
    terrain_json      TEXT NOT NULL DEFAULT '[]',
    collision_json    TEXT NOT NULL DEFAULT '[]',
    weather_override  TEXT
                      CHECK (weather_override IS NULL OR weather_override IN ('clear','rain','snow','storm','fog','ash')),
    weather_intensity REAL DEFAULT 0.3 CHECK (weather_intensity BETWEEN 0 AND 1),
    tile_meta_json    TEXT,
    meta_json         TEXT,
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_map_states_updated_at
    AFTER UPDATE ON map_states FOR EACH ROW
BEGIN UPDATE map_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  MAP ZONES
-- ============================================================
CREATE TABLE IF NOT EXISTS map_zones (
    id               TEXT PRIMARY KEY,
    story_id         TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    map_id           TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    zone_type        TEXT NOT NULL DEFAULT 'door',
    x                REAL NOT NULL DEFAULT 0,
    y                REAL NOT NULL DEFAULT 0,
    width            REAL NOT NULL DEFAULT 100,
    height           REAL NOT NULL DEFAULT 100,
    target_map_id    TEXT REFERENCES maps(id) ON DELETE SET NULL,
    target_spawn_id  TEXT,
    required_level   INTEGER DEFAULT 0,
    cost_gold        INTEGER DEFAULT 0,
    sort_order       INTEGER DEFAULT 0,
    meta_json        TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_map_zones_updated_at
    AFTER UPDATE ON map_zones FOR EACH ROW
BEGIN UPDATE map_zones SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  MAP TRIGGERS
-- ============================================================
CREATE TABLE IF NOT EXISTS map_triggers (
    id               TEXT PRIMARY KEY,
    story_id         TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    map_id           TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    trigger_type     TEXT NOT NULL DEFAULT 'on_enter',
    x                REAL NOT NULL DEFAULT 0,
    y                REAL NOT NULL DEFAULT 0,
    width            REAL NOT NULL DEFAULT 100,
    height           REAL NOT NULL DEFAULT 100,
    shape            TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect','circle')),
    radius           REAL,
    one_time         INTEGER DEFAULT 0 CHECK (one_time IN (0,1)),
    active           INTEGER DEFAULT 1 CHECK (active IN (0,1)),
    condition_json   TEXT,
    action_json      TEXT,
    sort_order       INTEGER DEFAULT 0,
    meta_json        TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_map_triggers_updated_at
    AFTER UPDATE ON map_triggers FOR EACH ROW
BEGIN UPDATE map_triggers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  MAP SPAWNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS map_spawners (
    id               TEXT PRIMARY KEY,
    story_id         TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    map_id           TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    unit_template_id TEXT REFERENCES unit_templates(id) ON DELETE SET NULL,
    x                REAL NOT NULL DEFAULT 0,
    y                REAL NOT NULL DEFAULT 0,
    radius           REAL DEFAULT 80,
    max_active       INTEGER DEFAULT 3,
    location_id      TEXT,
    time_window      TEXT,
    one_time         INTEGER DEFAULT 0 CHECK (one_time IN (0,1)),
    active           INTEGER DEFAULT 1 CHECK (active IN (0,1)),
    spawn_pool_json  TEXT,
    sort_order       INTEGER DEFAULT 0,
    meta_json        TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_map_spawners_updated_at
    AFTER UPDATE ON map_spawners FOR EACH ROW
BEGIN UPDATE map_spawners SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  MAP UNITS
--  Placed unit markers / NPC placements on the authoring surface.
-- ============================================================
CREATE TABLE IF NOT EXISTS map_units (
    id               TEXT PRIMARY KEY,
    story_id         TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    map_id           TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    unit_template_id TEXT REFERENCES unit_templates(id) ON DELETE SET NULL,
    character_id     TEXT REFERENCES characters(id) ON DELETE SET NULL,
    name             TEXT,
    x                REAL NOT NULL DEFAULT 0,
    y                REAL NOT NULL DEFAULT 0,
    facing           TEXT,
    faction_id       TEXT REFERENCES factions(id) ON DELETE SET NULL,
    behavior         TEXT,
    sort_order       INTEGER DEFAULT 0,
    meta_json        TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_map_units_updated_at
    AFTER UPDATE ON map_units FOR EACH ROW
BEGIN UPDATE map_units SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  STORY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS story_events (
    id             TEXT PRIMARY KEY,
    story_id       TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    quest_id       TEXT REFERENCES quests(id) ON DELETE SET NULL,
    map_id         TEXT REFERENCES maps(id) ON DELETE SET NULL,
    name           TEXT NOT NULL,
    event_scope    TEXT NOT NULL DEFAULT 'non_quest'
                   CHECK (event_scope IN ('world','quest','non_quest','cinematic','spawn','system')),
    description    TEXT,
    condition_json TEXT,
    action_json    TEXT,
    sort_order     INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_story_events_updated_at
    AFTER UPDATE ON story_events FOR EACH ROW
BEGIN UPDATE story_events SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_map_states_story      ON map_states(story_id);
CREATE INDEX IF NOT EXISTS idx_map_zones_story_map   ON map_zones(story_id, map_id);
CREATE INDEX IF NOT EXISTS idx_map_triggers_story_map ON map_triggers(story_id, map_id);
CREATE INDEX IF NOT EXISTS idx_map_spawners_story_map ON map_spawners(story_id, map_id);
CREATE INDEX IF NOT EXISTS idx_map_units_story_map   ON map_units(story_id, map_id);
CREATE INDEX IF NOT EXISTS idx_story_events_story    ON story_events(story_id, event_scope);
CREATE INDEX IF NOT EXISTS idx_unit_templates_faction ON unit_templates(faction_id);
CREATE INDEX IF NOT EXISTS idx_map_units_faction     ON map_units(faction_id);
