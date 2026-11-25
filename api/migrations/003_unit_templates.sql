-- ============================================================
--  RealmKit Platform — Unit Templates Migration
--  Database: SQLite (better-sqlite3)
--  Migration: 003
--
--  Purpose: Race-based unit blueprints for spawning characters
-- ============================================================

-- ============================================================
--  UNIT TEMPLATES (Race blueprints)
--  Separate from characters table - these are reusable templates
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_templates (
    id TEXT PRIMARY KEY,
    story_id TEXT REFERENCES stories(id) ON DELETE CASCADE, -- NULL = global
    name TEXT NOT NULL UNIQUE,               -- "Goblin", "Human", "Skeleton"
    category TEXT DEFAULT 'enemy',           -- enemy, npc, animal, boss
    display_name TEXT,
    description TEXT,
    
    -- Base stats (copied to character on spawn)
    base_hp INTEGER DEFAULT 40 CHECK (base_hp > 0),
    base_mp INTEGER DEFAULT 0 CHECK (base_mp >= 0),
    base_attack INTEGER DEFAULT 10 CHECK (base_attack >= 0),
    base_defense INTEGER DEFAULT 5 CHECK (base_defense >= 0),
    base_speed INTEGER DEFAULT 80 CHECK (base_speed > 0),
    base_agility INTEGER DEFAULT 10 CHECK (base_agility >= 0),
    
    -- Combat
    aggro_range INTEGER DEFAULT 150 CHECK (aggro_range >= 0),
    attack_range INTEGER DEFAULT 40 CHECK (attack_range >= 0),
    attack_cooldown_ms INTEGER DEFAULT 600 CHECK (attack_cooldown_ms >= 0),
    
    -- Visual
    sprite_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
    sprite_template_id TEXT REFERENCES sprite_templates(id) ON DELETE SET NULL,
    sprite_ext_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
    sprite_ext_template_id TEXT REFERENCES sprite_templates(id) ON DELETE SET NULL,
    default_animation TEXT DEFAULT 'idle_down',
    
    -- AI
    default_behavior TEXT DEFAULT 'idle'       -- idle, wander, hostile, friendly, etc
        CHECK (default_behavior IN ('idle','wander','patrol','follow','hostile','friendly','caster')),
    ai_script TEXT,                          -- custom AI behavior JSON
    
    -- Custom skills/animations (JSON for now - can normalize later if needed)
    custom_animations TEXT,                  -- {"skill_throw": {"frames": [16,17,18], "fps": 10}}
    
    -- Loot
    loot_table_id TEXT,                      -- FK to loot_tables (future)
    
    -- Meta
    is_unique INTEGER DEFAULT 0 CHECK (is_unique IN (0,1)),              -- Can only spawn one?
    max_spawn_count INTEGER DEFAULT 0 CHECK (max_spawn_count >= 0),      -- 0 = unlimited
    
    -- Sharing
    is_global INTEGER DEFAULT 0 CHECK (is_global IN (0,1)),              -- Visible to everyone
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_unit_templates_updated_at
    AFTER UPDATE ON unit_templates FOR EACH ROW
BEGIN UPDATE unit_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  Modify CHARACTERS table to link to unit templates
-- ============================================================
ALTER TABLE characters ADD COLUMN unit_template_id TEXT REFERENCES unit_templates(id) ON DELETE SET NULL;

-- ============================================================
--  ASSET SHARING (Supports multiple users per asset)
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_sharing (
    id TEXT PRIMARY KEY,
    asset_type TEXT NOT NULL               -- 'unit_template', 'scene', 'tileset', 'asset'
        CHECK (asset_type IN ('unit_template','scene','tileset','asset')),
    asset_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL = public/everyone
    share_level TEXT DEFAULT 'view'       -- view, edit, admin
        CHECK (share_level IN ('view','edit','admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_type, asset_id, shared_with_user_id)
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_unit_templates_story ON unit_templates(story_id);
CREATE INDEX IF NOT EXISTS idx_unit_templates_category ON unit_templates(category);
CREATE INDEX IF NOT EXISTS idx_unit_templates_global ON unit_templates(is_global) WHERE is_global = 1;
CREATE INDEX IF NOT EXISTS idx_unit_templates_sprite ON unit_templates(sprite_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_sharing_type_id ON asset_sharing(asset_type, asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_sharing_user ON asset_sharing(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_characters_template ON characters(unit_template_id);

-- ============================================================
--  SEED: Sample unit templates
-- ============================================================

-- Goblin (basic enemy)
INSERT OR IGNORE INTO unit_templates 
    (id, name, category, display_name, description,
     base_hp, base_mp, base_attack, base_defense, base_speed, base_agility,
     aggro_range, attack_range, attack_cooldown_ms,
     default_behavior, is_global)
VALUES
    ('tpl_goblin', 'goblin', 'enemy', 'Goblin', 'A sneaky green creature that attacks in packs.',
     30, 0, 8, 3, 90, 12,
     200, 35, 800,
     'hostile', 1);

-- Human Villager (neutral NPC)
INSERT OR IGNORE INTO unit_templates
    (id, name, category, display_name, description,
     base_hp, base_mp, base_attack, base_defense, base_speed, base_agility,
     aggro_range, attack_range, attack_cooldown_ms,
     default_behavior, is_global)
VALUES
    ('tpl_human_villager', 'human_villager', 'npc', 'Human Villager', 'A common villager going about their day.',
     50, 0, 5, 5, 80, 10,
     0, 40, 1000,
     'wander', 1);

-- Skeleton (undead enemy)
INSERT OR IGNORE INTO unit_templates
    (id, name, category, display_name, description,
     base_hp, base_mp, base_attack, base_defense, base_speed, base_agility,
     aggro_range, attack_range, attack_cooldown_ms,
     default_behavior, is_global)
VALUES
    ('tpl_skeleton', 'skeleton', 'enemy', 'Skeleton', 'An animated skeleton warrior.',
     40, 0, 12, 6, 70, 8,
     150, 45, 700,
     'hostile', 1);

-- Slime (basic enemy)
INSERT OR IGNORE INTO unit_templates
    (id, name, category, display_name, description,
     base_hp, base_mp, base_attack, base_defense, base_speed, base_agility,
     aggro_range, attack_range, attack_cooldown_ms,
     default_behavior, is_global)
VALUES
    ('tpl_slime', 'slime', 'enemy', 'Slime', 'A gelatinous blob that slowly approaches its prey.',
     20, 0, 5, 2, 40, 5,
     100, 25, 1200,
     'hostile', 1);
