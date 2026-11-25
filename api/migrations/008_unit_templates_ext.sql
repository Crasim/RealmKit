-- ============================================================
--  RealmKit Platform — Unit Templates Extensions
--  Database: SQLite
--  Migration: 005
-- ============================================================

-- Add missing columns to unit_templates if they don't exist
-- SQLite doesn't support 'IF NOT EXISTS' for columns, so we use a trick or just ignore errors.
-- However, since this script runs once via the migration tracker, we can just do it.

-- These columns might be missing if 003 was applied before I edited it.
ALTER TABLE unit_templates ADD COLUMN sprite_ext_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE unit_templates ADD COLUMN sprite_ext_template_id TEXT REFERENCES sprite_templates(id) ON DELETE SET NULL;
