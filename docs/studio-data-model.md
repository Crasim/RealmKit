# Realm Studio Data Model

## Purpose

Realm Studio uses a story-scoped authoring model. The studio shell, painters, and world editors read and write persisted data through the API instead of relying on demo/runtime-only state.

The design goal is:

- `stories` own authored content
- `maps` own per-surface state
- `units`, `npcs`, `events`, and `factions` are queryable from the database
- canvas tools save back into the same persisted model used by the studio sidebar

The studio should also accept structured JSON as an import/export layer for all
major authored entities, while keeping normalized DB tables as the persistence
source of truth.

## JSON Boundary Rule

JSON is supported for:

- AI-assisted creation
- bulk import/export
- migration payloads
- draft interchange between tools

JSON is not the primary storage model for authored content.

The intended flow is:

1. import JSON into a builder/editor
2. validate and normalize it
3. write normalized fields to existing tables
4. optionally export normalized records back to JSON

This means builder components can be AI-friendly without collapsing the schema
into a document store.

## Core Tables

### `maps`

Base map registry per story:

- identity and label
- width / height
- tileset references
- entry-map flag

### `map_states`

One row per map for authored surface state:

- terrain tile array
- collision tile array
- weather override
- weather intensity
- optional tile metadata and editor metadata

### `map_zones`

Per-map authored zones:

- name / type
- rect dimensions
- target map / spawn targets
- level / gold gates

### `map_triggers`

Per-map trigger definitions:

- trigger type
- rect / circle shape
- one-time / active flags
- condition and action JSON

### `map_spawners`

Per-map spawn anchors:

- unit template linkage
- radius / max active
- active / one-time flags
- spawn pool JSON

### `map_units`

Placed units and NPC markers on a map:

- unit template linkage
- optional character linkage
- position / facing
- faction / behavior
- metadata JSON

### `unit_templates`

Extended to support studio authoring:

- faction assignment
- loot table JSON
- action profile JSON
- audio profile JSON

### `characters`

Extended to support NPC override authoring:

- base unit template
- loot override JSON
- knowledge JSON
- audio override JSON

### `story_events`

Story-scoped events outside the raw trigger table:

- world / quest / non-quest / cinematic / spawn / system scope
- map linkage
- quest linkage
- condition and action JSON

## Aggregate Payloads

### `GET /api/stories/:id/studio`

Returns the studio authoring snapshot for a story:

- story
- maps
- map state collections
- unit templates
- characters
- dialogues
- quests
- story events
- factions and relations

This is the primary bootstrap payload for `RealmStudioShell`.

### `GET /api/maps/:id/studio`

Returns the focused authoring payload for one map:

- map
- state
- zones
- triggers
- spawners
- units

This is the primary load/save payload for the embedded map/world editors.

## Editor Import / Export Shape

Each editor should expose two compatible shapes:

- a normalized API payload for persistence
- a JSON import/export payload for authoring assistance

The JSON shape may be broader and more convenient for generation, but it must
map cleanly into the normalized persisted model.

Examples:

- `Map` JSON can include terrain, collision, zones, triggers, spawners, and
  placed units in one payload for authoring, while persistence still fans out
  to `maps`, `map_states`, `map_zones`, `map_triggers`, `map_spawners`, and
  `map_units`
- `Unit Template` JSON can include stats, faction, loot, action bindings,
  sprite bindings, and audio bindings in one payload, while persistence maps
  into `unit_templates` plus any supporting registries
- `NPC` JSON can include base unit linkage plus override fields, while
  persistence maps into `characters` and related tables

## Builder Expectations

Every major builder surface should eventually support:

- `Export JSON`
- `Import JSON`
- inline validation errors
- preview before commit
- save to DB after normalization

## Studio Shell Integration

`RealmStudioShell.js` now prefers database-backed studio data when available:

- `Maps` tree comes from `maps`, `map_states`, `map_zones`, `map_triggers`
- `Units` comes from `unit_templates`
- `NPCs` comes from `characters`
- `Events` comes from `story_events`, `quests`, and map triggers
- `Factions` is a reverse-membership view over units and NPCs

Create actions in the shell now write through `StoryDatabase` instead of only routing to the legacy builder.

## Embedded Editor Integration

`MapEditor.js` and `WorldEditor.js` save directly through:

- `StoryDatabase.saveMapStudio(mapId, payload)`

and load through:

- `StoryDatabase.getMapStudio(mapId)`

When they save in studio mode, they notify the parent studio shell to reload the sidebar data so the tree stays in sync with what was painted.

## Current Boundary

What is DB-backed now:

- maps and per-map editing state
- placed units, zones, triggers, spawners
- story events
- richer unit and NPC metadata
- studio tree bootstrapping

What still needs deeper authoring UI:

- inline editors for all unit action/frame/audio fields
- full faction editing inside the studio shell
- richer event/quest editing inside the studio shell
- item/equipment database editing
