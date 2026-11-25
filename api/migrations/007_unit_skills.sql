-- ============================================================
--  RealmKit Platform — Unit Skills & Actions Migration
--  Database: SQLite (better-sqlite3)
--  Migration: 004
--
--  Purpose: Define specific skills/actions and link them to units
-- ============================================================

-- ============================================================
--  SKILLS / ABILITIES
--  Defines the logic and visual reference for a special action
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                  -- "Whirlwind", "Fireball"
    display_name TEXT,                   -- "Whirlwind Attack"
    description TEXT,
    category TEXT DEFAULT 'combat'       -- combat, magic, social, utility
        CHECK (category IN ('combat','magic','social','utility')),
    
    -- Visual / Animation Reference
    -- Conceptually links to sprite_template_regions.anim_name
    anim_name TEXT NOT NULL,             -- "special_1", "cast_down", etc.
    particle_effect TEXT,                -- key for ParticleSystem
    sound_effect TEXT,                   -- key for AudioSystem
    
    -- Mechanics
    damage_multiplier REAL DEFAULT 1.0,
    mp_cost INTEGER DEFAULT 0,
    cooldown_ms INTEGER DEFAULT 1000,
    range INTEGER DEFAULT 40,
    is_aoe INTEGER DEFAULT 0,
    aoe_radius INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_skills_updated_at
    AFTER UPDATE ON skills FOR EACH ROW
BEGIN UPDATE skills SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  UNIT TEMPLATE SKILLS (Many-to-Many)
--  Attaches skills to unit templates
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_template_skills (
    unit_template_id TEXT NOT NULL REFERENCES unit_templates(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    unlocked_at_level INTEGER DEFAULT 1,
    PRIMARY KEY (unit_template_id, skill_id)
);

-- ============================================================
--  SEED: Basic skills
-- ============================================================

-- Basic Melee Slash (uses standard melee anims)
INSERT OR IGNORE INTO skills (id, name, display_name, description, anim_name, damage_multiplier, mp_cost, cooldown_ms)
VALUES ('skill_slash', 'slash', 'Slash', 'A basic melee attack.', 'melee', 1.0, 0, 600);

-- Whirlwind (uses special_1)
INSERT OR IGNORE INTO skills (id, name, display_name, description, anim_name, damage_multiplier, mp_cost, cooldown_ms, is_aoe, aoe_radius)
VALUES ('skill_whirlwind', 'whirlwind', 'Whirlwind', 'Spin around hitting all nearby enemies.', 'special_1', 0.8, 10, 2000, 1, 64);

-- Fireball (uses cast anim)
INSERT OR IGNORE INTO skills (id, name, display_name, description, anim_name, damage_multiplier, mp_cost, cooldown_ms, range)
VALUES ('skill_fireball', 'fireball', 'Fireball', 'Launch a bolt of fire at a distance.', 'cast', 1.5, 15, 3000, 200);

-- ============================================================
--  SEED: Link skills to templates
-- ============================================================

-- Knight gets Slash and Whirlwind
INSERT OR IGNORE INTO unit_template_skills (unit_template_id, skill_id) VALUES ('tpl_knight', 'skill_slash');
INSERT OR IGNORE INTO unit_template_skills (unit_template_id, skill_id) VALUES ('tpl_knight', 'skill_whirlwind');

-- Goblin gets Slash
INSERT OR IGNORE INTO unit_template_skills (unit_template_id, skill_id) VALUES ('tpl_goblin', 'skill_slash');
