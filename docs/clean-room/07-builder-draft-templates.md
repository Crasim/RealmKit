# Builder Draft Templates

Date: 2026-04-19

## Purpose

This document extracts the useful builder-facing field structure from the
existing StoryBuilder and Realm Studio code, then refines it into cleaner draft
JSON templates for the clean-room rebuild.

These are not database schemas.
These are builder draft contracts.

They are meant to support:

- human editing in Config view
- human editing in Raw JSON view
- AI-assisted generation and update
- validation before persistence

## Source Of Truth For This Doc

This document is derived from the current repository's builder/editor payload
shapes, especially:

- `StoryBuilder.js`
- `RealmStudioShell.js`
- `StoryDatabase.js`
- `STORYBUILDER_ADDENDUM.md`

The goal is to keep useful field vocabulary while improving consistency.

## Clean-Up Rules Applied

The existing builder is helpful, but not clean enough to use as-is.

Main changes for the clean-room version:

1. separate draft JSON from DB tables
2. prefer nested sections over many flat fields when they clearly belong
   together
3. preserve field names already used where they are reasonable
4. remove overly UI-specific assumptions from the raw draft shape
5. make AI-facing payloads explicit and complete enough to express most user
   actions

## Story Draft

### Legacy builder cues

Current StoryBuilder already uses a top-level story draft with:

- `id`
- `title`
- `description`
- `genre`
- `factions`
- `characters`
- `dialogues`
- `quests`
- `scenes`
- `engine_configs`
- `ui_config`

### Clean-room draft shape

```json
{
  "id": "story_grasslands_demo",
  "title": "Grasslands Demo",
  "description": "A builder-authored story set across open plains and trade roads.",
  "genre": "fantasy",
  "rules_profile": "hybrid",
  "ui_profile": {
    "ui_mode": "hybrid",
    "theme_key": "realmkit-parchment",
    "resource_labels": {
      "hp": "HP",
      "mp": "MP",
      "xp": "XP",
      "level": "Level",
      "gold": "Gold"
    },
    "panels": {
      "inventory": true,
      "character": true,
      "quests": true,
      "dialogue": true,
      "pause": true,
      "minimap": true
    },
    "layout": {
      "draggable": true,
      "snapToEdges": true,
      "rememberPositions": true
    }
  },
  "engine_profile": {
    "default_map_width": 64,
    "default_map_height": 64,
    "default_weather": "clear",
    "weather_intensity": 0.3
  }
}
```

### Notes

- `engine_configs` and `ui_config` from the legacy builder are still good ideas
- for the clean-room draft, parse embedded JSON-string fields into real nested
  objects at the draft layer

## Faction Draft

### Legacy builder cues

Current builder uses:

- `name`
- `description`
- `color`

Studio shell also uses:

- `display_name`

### Clean-room draft shape

```json
{
  "id": "faction_iron_legion",
  "name": "iron_legion",
  "display_name": "The Iron Legion",
  "description": "A disciplined military order guarding the eastern road.",
  "color": "#a83030",
  "relationships": [
    {
      "target_faction_id": "faction_bandits",
      "relation": "enemy"
    }
  ]
}
```

### Notes

- keep `name` as the stable key-like identifier
- keep `display_name` as the human-facing label
- move faction relationships into the draft model explicitly

## Character / NPC Draft

### Legacy builder cues

StoryBuilder `Character` currently uses:

- `name`
- `role`
- `level`
- `faction_id`
- `dialogue_id`

Studio shell `NPC` editing already uses:

- `unit_template_id`
- `display_name`
- `behavior`
- `base_hp`
- `base_attack`
- `base_defense`
- `base_speed`
- `knowledge_json`
- `loot_override_json`
- `audio_override_json`

### Clean-room draft shape

```json
{
  "id": "npc_haldor",
  "name": "haldor",
  "display_name": "Haldor the Merchant",
  "role": "merchant",
  "base_unit_id": "unit_human_merchant",
  "behavior": "idle",
  "level": 3,
  "faction_id": "faction_merchants",
  "dialogue_links": [
    "dialogue_haldor_intro"
  ],
  "stat_overrides": {
    "hp": 40,
    "attack": 6,
    "defense": 4,
    "speed": 75
  },
  "loot_override": [],
  "knowledge": [],
  "audio_override": {}
}
```

### Notes

- clean-room should treat NPCs as base-unit-plus-overrides
- `dialogue_links` should be a list, not a single `dialogue_id`
- `stat_overrides` is cleaner than keeping many flat `base_*` override fields at
  the draft layer

## Dialogue Draft

### Legacy builder cues

Current StoryBuilder uses:

- `id`
- `title`
- `nodes`
- first node with:
  - `id`
  - `text`
  - `choices`

### Clean-room draft shape

```json
{
  "id": "dialogue_haldor_intro",
  "title": "Haldor Introduction",
  "character_id": "npc_haldor",
  "nodes": [
    {
      "id": "node_intro",
      "text": "Welcome, traveler. Care to browse my wares?",
      "choices": [
        {
          "id": "choice_trade",
          "label": "Show me what you have.",
          "next_node_id": "node_trade"
        }
      ]
    }
  ]
}
```

### Notes

- legacy structure is already close enough to keep
- clean-room needs stronger choice/condition/action rules later, but this is a
  good draft start

## Quest Draft

### Legacy builder cues

StoryBuilder uses:

- `title`
- `description`
- `xp_reward`
- `gold_reward`
- `objectives`

Studio shell extends with:

- `giver_character_id`
- `prerequisite_quest_id`
- `sort_order`

### Clean-room draft shape

```json
{
  "id": "quest_wolf_hunt",
  "title": "Wolf Hunt",
  "description": "Drive the wild wolves away from the trade road.",
  "giver_character_id": "npc_haldor",
  "prerequisite_quest_id": null,
  "sort_order": 10,
  "rewards": {
    "xp": 150,
    "gold": 50
  },
  "objectives": [
    {
      "id": "obj_kill_wolves",
      "type": "kill",
      "target": "unit_wolf",
      "count": 5
    }
  ]
}
```

### Notes

- keep reward fields grouped under `rewards`
- keep objectives explicit and typed

## Unit Template Draft

### Legacy builder cues

Current StoryBuilder unit editor already captures a lot of the right surface:

- `name`
- `display_name`
- `category`
- `description`
- `base_hp`
- `base_mp`
- `base_attack`
- `base_defense`
- `base_speed`
- `base_agility`
- `aggro_range`
- `attack_range`
- `attack_cooldown_ms`
- `sprite_asset_id`
- `sprite_template_id`
- `sprite_ext_asset_id`
- `sprite_ext_template_id`
- `default_animation`
- `default_behavior`
- `is_unique`
- `is_global`
- `max_spawn_count`

Studio shell adds:

- `faction_id`
- `loot_table_json`
- `action_profile_json`
- `audio_profile_json`

### Clean-room draft shape

```json
{
  "id": "unit_goblin_raider",
  "name": "goblin_raider",
  "display_name": "Goblin Raider",
  "category": "enemy",
  "description": "A fast melee goblin used in grassland encounters.",
  "faction_id": "faction_goblins",
  "stats": {
    "hp": 40,
    "mp": 0,
    "attack": 10,
    "defense": 5,
    "speed": 80,
    "agility": 10
  },
  "combat": {
    "aggro_range": 150,
    "attack_range": 40,
    "attack_cooldown_ms": 600
  },
  "visual": {
    "sprite_asset_id": "asset_goblin_base",
    "sprite_template_id": "tpl_humanoid_base",
    "sprite_ext_asset_id": "asset_goblin_ext",
    "sprite_ext_template_id": "tpl_humanoid_ext",
    "default_animation": "idle_down"
  },
  "behavior": {
    "default_behavior": "hostile",
    "controllable": false,
    "recruitable": false
  },
  "loot": {
    "table": "loot_goblin_common",
    "gold_drop": 5
  },
  "actions": [
    {
      "id": "melee_basic",
      "type": "melee",
      "anim": "melee_down",
      "sound": "snd_goblin_slash"
    }
  ],
  "options": {
    "is_unique": false,
    "is_global": false,
    "max_spawn_count": 0
  }
}
```

### Notes

- this is the biggest place where clean-room should improve on the legacy shape
- nested `stats`, `combat`, `visual`, `behavior`, `loot`, and `options` are
  easier for AI and humans than one long flat payload
- keep the legacy DB field names for normalization, but expose a cleaner draft

## Map Draft

### Legacy builder cues

Studio shell already uses fields like:

- `name`
- `description`
- `map_type`
- `width`
- `height`
- `tileset_path`
- `is_entry_map`

### Clean-room draft shape

```json
{
  "id": "map_eastern_road",
  "name": "Eastern Road",
  "description": "A grassland trade route with scattered camps and wolf dens.",
  "map_type": "overworld",
  "width": 64,
  "height": 64,
  "tilesets": [
    "tileset_grassland_main"
  ],
  "is_entry_map": true,
  "state": {
    "terrain": [],
    "collision": [],
    "weather_override": {
      "weather": "clear",
      "intensity": 0.3
    }
  }
}
```

### Notes

- map draft should contain editable state in authoring/export scenarios
- DB normalization can still split this into `maps` and `map_states`

## Event Draft

### Legacy builder cues

Studio shell uses:

- `name`
- `event_scope`
- `description`
- `map_id`
- `quest_id`
- `sort_order`
- `condition_json`
- `action_json`

### Clean-room draft shape

```json
{
  "id": "event_spawn_road_wolves",
  "name": "Road Wolf Spawn",
  "event_scope": "non_quest",
  "description": "Spawns wolves when the player first enters the eastern road zone.",
  "map_id": "map_eastern_road",
  "quest_id": null,
  "sort_order": 20,
  "conditions": {
    "trigger": "zone_enter",
    "zone_id": "zone_road_wolf_entry"
  },
  "actions": {
    "spawn_units": [
      {
        "unit_id": "unit_wolf",
        "count": 3
      }
    ]
  }
}
```

### Notes

- `condition_json` and `action_json` are valid legacy ideas
- clean-room should rename them to `conditions` and `actions` at the draft
  layer for readability

## Recommended Next Step

These draft templates should be followed by true schema docs for:

1. Story
2. Map
3. Unit Template
4. NPC
5. Faction
6. Quest
7. Event

Those schemas should define:

- required fields
- optional fields
- enums
- reference types
- validation rules
- normalization mapping to DB/API storage
