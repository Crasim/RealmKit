-- ============================================================
--  RealmKit Platform — Seed Unit Visuals
--  Database: SQLite
--  Migration: 009
-- ============================================================

-- Update Goblin
UPDATE unit_templates SET
    sprite_asset_id = 'pp_1774582458315',
    sprite_template_id = 'tpl_humanoid_base',
    sprite_ext_asset_id = 'pp_1774622442678',
    sprite_ext_template_id = 'tpl_humanoid_ext'
WHERE name = 'goblin';

-- Update Skeleton
UPDATE unit_templates SET
    sprite_asset_id = 'pp_1774585861857',
    sprite_template_id = 'tpl_humanoid_base',
    sprite_ext_asset_id = 'pp_1774622566754',
    sprite_ext_template_id = 'tpl_humanoid_ext'
WHERE name = 'skeleton';

-- Insert/Update Male Hero
INSERT INTO unit_templates (id, name, display_name, category, base_hp, base_attack, base_defense, base_speed, is_global, sprite_asset_id, sprite_template_id, sprite_ext_asset_id, sprite_ext_template_id)
VALUES ('tpl_male_hero', 'male_hero', 'Male Hero', 'npc', 100, 20, 8, 100, 1, 'pp_1774586029262', 'tpl_humanoid_base', 'pp_1774622243309', 'tpl_humanoid_ext')
ON CONFLICT(name) DO UPDATE SET
    sprite_asset_id = 'pp_1774586029262',
    sprite_template_id = 'tpl_humanoid_base',
    sprite_ext_asset_id = 'pp_1774622243309',
    sprite_ext_template_id = 'tpl_humanoid_ext';

-- Insert/Update Female Hero
INSERT INTO unit_templates (id, name, display_name, category, base_hp, base_attack, base_defense, base_speed, is_global, sprite_asset_id, sprite_template_id, sprite_ext_asset_id, sprite_ext_template_id)
VALUES ('tpl_female_hero', 'female_hero', 'Female Hero', 'npc', 100, 18, 10, 110, 1, 'pp_1774586120551', 'tpl_humanoid_base', 'pp_1774622319808', 'tpl_humanoid_ext')
ON CONFLICT(name) DO UPDATE SET
    sprite_asset_id = 'pp_1774586120551',
    sprite_template_id = 'tpl_humanoid_base',
    sprite_ext_asset_id = 'pp_1774622319808',
    sprite_ext_template_id = 'tpl_humanoid_ext';
