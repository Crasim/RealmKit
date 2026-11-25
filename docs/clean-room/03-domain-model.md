# Domain Model

Date: 2026-04-19

## Purpose

This document defines the primary authored entities for the clean-room rebuild.

## Story

A `Story` is the top-level authored container.

It owns:

- story metadata
- rules profile
- UI profile
- maps
- factions
- unit templates
- NPCs
- dialogues and knowledge content
- quests
- events

It does not own:

- player progress
- user-specific layout preferences

## Story Rules Profile

Each story should declare a rules profile, such as:

- `dnd`
- `hybrid`
- `narrative`

This profile informs:

- stat naming
- resource naming
- combat presentation
- codex emphasis
- action economy language

## Story UI Profile

Each story should declare a UI profile for the player-facing shell.

This can govern:

- codex tabs
- terminology
- default layout density
- party presentation mode
- available widgets

It does not control Studio information architecture.

## Map

A `Map` is the authored world surface for a story.

It owns:

- identity
- width and height
- tileset references
- entry-map designation
- authored editing surfaces

## Map State

`Map State` is the editable surface data for a map.

It owns:

- terrain tile array
- collision tile array
- weather override
- tile metadata
- editor metadata

## Zone

A `Zone` is an authored spatial region on a map.

It owns:

- geometry
- name and type
- transitions and exits
- gating metadata
- zone-local metadata

Zones are authoring concepts first and runtime gameplay helpers second.

## Trigger

A `Trigger` is an authored activation rule bound to a map region or condition.

It owns:

- geometry or activation shape
- activation type
- one-time or repeatable behavior
- condition list
- action list
- active state

Triggers should be authored as structured data, not ad hoc runtime scripts.

## Spawner

A `Spawner` is a map anchor for controlled spawning behavior.

It owns:

- position/area
- spawn pool
- radius
- max active count
- timing conditions
- faction/behavior defaults if needed

## Unit Template

A `Unit Template` is the base combat/behavior definition for a reusable unit
type.

It owns:

- internal key
- display identity
- category and role
- stat block
- faction linkage
- loot defaults
- sprite bindings
- action definitions
- audio bindings

## NPC

An `NPC` is a named or authored character instance built from a base unit
template.

It owns:

- base unit template reference
- identity and presentation
- stat overrides
- sprite/audio overrides
- faction assignment
- dialogue/knowledge
- loot override

NPCs are not just "special units"; they are authored characters with optional
unit inheritance.

## Quest

A `Quest` is a player-facing progression object.

It owns:

- identity and metadata
- objective list
- dependencies / chain position
- rewards
- state model for runtime progress

## Event

An `Event` is a general authored runtime action definition.

Events may be:

- quest events
- non-quest world events
- trigger-driven events
- cinematics
- spawn/system events

They own:

- scope
- conditions
- actions
- optional map linkage
- optional quest linkage

## Faction

A `Faction` is a social/combat grouping and relationship owner.

It owns:

- identity
- display name
- color
- relationship matrix
- reverse membership view over units and NPCs

## Assets, Sprite Templates, and Audio Projects

These are shared registries rather than story-only leaf content.

### Asset

Owns:

- tileset-like resources
- shared visual content
- source metadata

### Sprite Template

Owns:

- frame dimensions
- directional layout
- named animation regions
- action frame mappings

### Audio Project

Owns:

- reusable music or sound authoring data
- import/export-friendly structured representation

## Save Game

A `Save Game` is player state only.

It owns:

- current position
- party state
- inventory and gold
- progression
- quest progress
- discovered state
- user-specific preferences if desired

It is explicitly not authored content.
