-- 004_pp_assets.sql
-- Pixel Painter asset registry
-- Images are stored on the server filesystem; this table holds metadata.

CREATE TABLE IF NOT EXISTS pixel_painter_assets (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    category       TEXT NOT NULL DEFAULT 'tileset',  -- tileset | character | ui | misc
    file_path      TEXT NOT NULL,                    -- relative URL served by web server
    frame_w        INTEGER NOT NULL DEFAULT 32,
    frame_h        INTEGER NOT NULL DEFAULT 32,
    frame_count    INTEGER NOT NULL DEFAULT 1,
    cols           INTEGER NOT NULL DEFAULT 8,
    scale          REAL    NOT NULL DEFAULT 1,
    template_id    TEXT,
    template_name  TEXT,
    biome          TEXT,
    tags           TEXT,                             -- comma-separated
    meta           TEXT,                             -- JSON blob for extra fields
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pp_assets_category ON pixel_painter_assets(category);
CREATE INDEX IF NOT EXISTS idx_pp_assets_created  ON pixel_painter_assets(created_at DESC);
