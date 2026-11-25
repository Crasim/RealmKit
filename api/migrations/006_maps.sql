-- ============================================================
--  RealmKit Platform — Maps Migration
--  Database: SQLite (PDO)
--  Migration: 006
--
--  Purpose: Multi-map support for Stories
--           Supports: overworld, interior (buildings), dungeons,
--           caves, towns, and custom maps with portal connections
-- ============================================================

-- ============================================================
--  MAPS
--  Each Story can have many Maps.
--  Maps link to each other via the `connections` JSON field
--  (portal/door/transition points) and via parent_map_id
--  for a loose hierarchy (e.g. interior of a building on overworld).
-- ============================================================
CREATE TABLE IF NOT EXISTS maps (
    id          TEXT PRIMARY KEY,
    story_id    TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,

    -- Identity
    name        TEXT NOT NULL,
    map_type    TEXT NOT NULL DEFAULT 'overworld'
        CHECK (map_type IN ('overworld','interior','dungeon','cave','town','world','custom')),
    description TEXT,

    -- Layout (in tiles)
    width       INTEGER NOT NULL DEFAULT 20 CHECK (width  > 0),
    height      INTEGER NOT NULL DEFAULT 15 CHECK (height > 0),

    -- Tileset (denormalised path for convenience; also store FK if managed)
    tileset_id   TEXT REFERENCES assets(id) ON DELETE SET NULL,
    tileset_path TEXT,          -- e.g. "assets/tilesets/dungeon.png"

    -- Navigation
    is_entry_map  INTEGER NOT NULL DEFAULT 0 CHECK (is_entry_map IN (0,1)),
    parent_map_id TEXT REFERENCES maps(id) ON DELETE SET NULL,  -- e.g. overworld map this interior belongs to

    -- Portal / connection definitions (JSON array)
    -- Each element: {
    --   "id":           "conn_<uid>",        -- unique within this map
    --   "label":        "Front Door",        -- human label
    --   "x": 5, "y": 3,                      -- tile position of portal on THIS map
    --   "target_map_id": "map_xxx",          -- destination map id
    --   "target_x": 2, "target_y": 10,       -- arrival tile on destination
    --   "direction": "up|down|left|right|none", -- player facing on arrival
    --   "transition": "fade|warp|walk|none"  -- visual transition
    -- }
    connections TEXT NOT NULL DEFAULT '[]',

    -- Freeform extras (light color, weather, music track id, etc.)
    meta        TEXT,           -- JSON object

    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_maps_updated_at
    AFTER UPDATE ON maps FOR EACH ROW
BEGIN
    UPDATE maps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_maps_story     ON maps(story_id);
CREATE INDEX IF NOT EXISTS idx_maps_type      ON maps(story_id, map_type);
CREATE INDEX IF NOT EXISTS idx_maps_entry     ON maps(story_id, is_entry_map) WHERE is_entry_map = 1;
CREATE INDEX IF NOT EXISTS idx_maps_parent    ON maps(parent_map_id);
