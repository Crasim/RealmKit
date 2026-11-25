# StoryBuilder — Build, Update & Change Addendum

**Project:** RealmKit RPG Engine
**Date:** 2026-03-27
**Scope:** Items identified during Engine.js story-driven refactor sessions

---

## Context

The Engine was recently refactored to a data-first, story-driven architecture using `DEMO_UNITS` and `DEMO_FACTIONS` plain-object definitions that resolve into loaded assets at runtime. This pattern was designed to eventually be owned and driven by the StoryBuilder rather than hardcoded in `Engine.js`. The items below document the gap between the current StoryBuilder state and what is needed to complete that integration.

---

## 1. Unit Definitions — Bridge Engine ↔ StoryBuilder

**Current state:**
Units (Male Hero, Female Hero, Goblin, Skeleton) are hardcoded in `Engine.js → onAssetsLoaded()` as a `DEMO_UNITS` object. This is explicitly a demo scaffold, not a permanent solution.

**What needs to change:**
`onAssetsLoaded` should load unit and faction definitions from `StoryDatabase` (via `StoryBuilder`) rather than from a hardcoded block. The `DEMO_UNITS` / `DEMO_FACTIONS` objects should be replaced with a call that retrieves the active story's unit roster and faction list.

**What needs to be built:**
- `Engine.loadStory(storyId)` needs a full implementation that fetches factions and unit templates from the DB, resolves their sprite assets, and rebuilds the `resolvedUnits` map
- A clear contract between StoryBuilder's unit data shape and the engine's `resolvedUnits` map:
  ```
  { def, img, manifest, imgExt, manifestExt }
  ```
- The StoryBuilder Unit Editor form needs two additional fields: **Sprite Base** (dropdown of PP character assets) and **Sprite Ext** (dropdown of PP ext assets)

---

## 2. Unit Editor — Extended Spritesheet Support

**Current state:**
The StoryBuilder Unit Editor (`StoryBuilder.js → _showUnitEditor`) has forms for basic info and base stats but has no fields for spritesheets. It has no concept of the extended spritesheet (`spriteExt` / `manifestExt`) that drives melee, ranged, and cast animations.

**What needs to be added to the Unit Editor form:**

| Field | Type | Notes |
|---|---|---|
| Sprite Base | Asset dropdown | Filters `pixel_painter_assets` by category = character |
| Sprite Ext | Asset dropdown | Filters `pixel_painter_assets` by name containing `_Ext_` |
| Faction | Dropdown | Populated from story's faction list |
| Behavior | Dropdown | `idle`, `hostile`, `wander`, `caster` |
| Aggro Range | Number | Pixels; 0 = passive |
| Attack Range | Number | Pixels |

The editor should show a live sprite preview (base sheet idle frame) when a Sprite Base is selected, and a second preview (melee frame) when Sprite Ext is selected.

---

## 3. Factions Tab — Connect to Engine

**Current state:**
The StoryBuilder Factions tab has a working CRUD form (name, description, color). The Engine hardcodes `DEMO_FACTIONS = { friendly: { label, color }, hostile: { label, color } }`.

**What needs to change:**
- When a story is loaded, the engine should read its factions from `StoryDatabase` and build the faction registry from that data
- The faction `color` field in StoryBuilder should drive health bar tints, faction badge colors, and potentially the minimap legend
- `FactionRelations` (currently a static object) should also be story-driven — the StoryBuilder Factions tab should include a relationship matrix (e.g., Friendly ↔ Hostile = foe)

---

## 4. StoryBuilderSidebar — Content Panes Not Implemented

**Current state:**
`StoryBuilderSidebar._renderContentPane(tab)` renders `"Loading <tab>..."` for every tab except Units, which shows a button to open the full-screen StoryBuilder. No actual content is rendered in the sidebar for any secondary tab.

**What needs to be built (each tab):**

- **Factions** — List of factions for the active story with name and color swatch; click to edit
- **Characters** — Scrollable list of named characters; click to open character detail or launch full editor
- **Units** — Grid of unit template cards (name, icon, HP/ATK stats, faction badge); inline Spawn button that places a unit at the player's current position
- **Dialogues** — List of dialogue trees; click to open in full editor
- **Quests** — List of quests with status indicator (draft / active / complete)
- **Scenes** — List of scene definitions; click to preview trigger zones on the map
- **Tilesets** — Already partially implemented in the full StoryBuilder; bring the biome/asset list into the sidebar pane

---

## 5. Spawn-from-StoryBuilder Integration

**Current state:**
Unit cards in the full StoryBuilder have a **Spawn** button that calls `_spawnUnit(id)`. The current NPC spawn pipeline in `Engine.js` expects the full `resolvedUnits` structure (sprite images already loaded, manifest already built).

**What needs to be built:**
- `_spawnUnit(id)` should look up the unit template by ID, resolve its sprite assets on demand (loading images if not already cached via `_spriteImgMap`), then call the engine's NPC spawn method with the fully resolved unit object
- A helper `engine.spawnResolvedUnit(resolvedUnit, x, y)` that accepts the same shape as the existing NPC spawn loop — keeping the spawn path consistent whether triggered by story load or StoryBuilder UI

---

## 6. UnitDefinitions.js — Sync with StoryBuilder

**Current state:**
`UnitDefinitions.js` contains static `RealmKit.UnitTemplates` entries (e.g., `creature_goblin_grunt`, `creature_skeleton`). The `creature_skeleton` template was added manually this session. StoryBuilder's Unit Editor can create new unit templates, but they are stored in `StoryDatabase` and do not automatically appear in `UnitDefinitions.js`.

**What needs to change:**
- Decide on the source of truth: `UnitDefinitions.js` (static JS) vs `StoryDatabase` (dynamic SQLite)
- **Recommended path:** `UnitDefinitions.js` becomes the engine's built-in template library (creatures, archetypes, bosses). Story-specific custom units live in `StoryDatabase`. `UnitFactory` should check `StoryDatabase` first, fall back to `UnitDefinitions.js`
- Add a StoryBuilder export action: "Export to UnitDefinitions" that generates the JS template block from a StoryBuilder unit, making promotion from story-specific to engine-built-in explicit and deliberate

---

## 7. Walk Animation — Direction Mirroring

**Current state:**
The `tpl_humanoid_base` template in the DB has `direction_mirrors = {"right":"left","diag_nw":"diag_ne","diag_se":"diag_sw"}`. This means the PP tool considers right-facing animations to be mirrors of left-facing ones. Whether the exported PNG contains independent right-facing frames or duplicate-of-left frames that require a canvas flip at render time has not yet been confirmed.

**What needs to be investigated / potentially built:**
- Open one of the character spritesheets (e.g., `Male-Hero`) and compare the visual content at walk_left rows (frames 160–167, row 20) vs walk_right rows (frames 176–183, row 22) to determine if frames are independently drawn or are identical
- If frames are identical, `Entity.renderSprite()` needs to apply `ctx.scale(-1, 1)` with a matching translate when rendering any `_right` or `_diag_nw` / `_diag_se` animation
- The same mirroring logic would need to apply in the ext manifest for `melee_right`, `ranged_right`, `cast_right`, and the `attack_right` alias

---

## 8. Animation Debug HUD

**Current state (just added):**
The info bar at the top of the game screen now shows `Anim:<name>` reflecting the player's active `this.animation` value. This was added to help diagnose walk direction behavior.

**Longer-term StoryBuilder integration:**
- The StoryBuilder sidebar could include a live **Entity Inspector** tab (or sub-panel) that shows the currently selected entity's: position, faction, animation state, HP, and active state machine state
- Clicking an entity on-canvas while StoryBuilder is open could "select" it and populate the inspector
- This would be especially useful for debugging NPC AI behavior (aggro transitions, attack state machine, faction relation lookups)

---

## 9. Story Load ↔ Map Initialization

**Current state:**
`initTileMap` is called with hardcoded parameters `{ tileset: serverTileset, tileSize: serverTileSize, flat: true, mapSize: 32 }`. The tileset comes from the first asset loaded by the engine config.

**What needs to change:**
- A story record should include map settings: tileset name, map size, tile size, map type (flat / generated / file-loaded)
- `engine.loadStory(storyId)` should read these settings and re-initialize the tile map accordingly
- The StoryBuilder **Scenes** tab is the right place to define map composition — each scene can specify its tileset and map parameters
- The Tilesets tab (already partially built) should provide the tileset picker that feeds into scene definitions

---

## 10. Hardcoded Demo Values to Migrate

The following values in `Engine.js → onAssetsLoaded` are currently hardcoded for the demo and should eventually come from the active story loaded via StoryBuilder:

| Item | Current value | Should come from |
|---|---|---|
| Enemy count | 15 | Story / scene spawn template |
| Friendly NPC count | 4 | Story / scene spawn template |
| Wander radius | `40 + Math.random() * 30` | Unit template or scene config |
| Player hero selection | Random from `friendly` faction | Story protagonist definition |
| Map size | 32 | Scene / map definition |
| Tileset | `'Grassland Tileset 64-bit'` | Scene / map definition |

---

## Summary — Priority Order

| # | Item | Effort | Priority |
|---|---|---|---|
| 1 | Unit Editor: add Sprite Base + Ext fields | Medium | High |
| 2 | `engine.loadStory()` full implementation | Large | High |
| 3 | Sidebar content panes: Units + Factions | Medium | High |
| 4 | Walk animation mirror investigation & fix | Small | High |
| 5 | Factions tab → Engine faction registry | Medium | Medium |
| 6 | Spawn-from-StoryBuilder pipeline | Medium | Medium |
| 7 | Sidebar content panes: remaining tabs | Large | Medium |
| 8 | UnitDefinitions ↔ StoryDatabase source-of-truth decision | Small | Medium |
| 9 | Story → map initialization | Medium | Low |
| 10 | Live Entity Inspector in sidebar | Large | Low |
