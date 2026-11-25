-- ============================================================
--  Migration 002: Tileset overlap support
--  Adds columns for transparent PNG tileset edges
--
--  Some tileset images have transparent pixels on top/left edges
--  that need to be skipped when drawing tiles. These columns
--  allow storing that information per-asset.
--
--  overlap_top:  pixels to skip at top of each tile row
--  overlap_left: pixels to skip at left of each tile column
--
--  Typical values:
--    0 (default) - no overlap, tile starts at grid origin
--    2           - 2px transparent margin (common for bleeding)
-- ============================================================

ALTER TABLE assets ADD COLUMN overlap_top INTEGER DEFAULT 0;
ALTER TABLE assets ADD COLUMN overlap_left INTEGER DEFAULT 0;