# Workstreams

Date: 2026-04-19

## Purpose

This document turns the clean-room rebuild into a set of practical workstreams.

## Workstream 1: Freeze Contracts

Goal:

- stop architecture drift
- define what data and APIs we are actually preserving

Tasks:

- inventory existing DB tables and identify canonical ones
- inventory API routes worth keeping
- define canonical entities and ownership
- identify legacy/demo-only code paths to exclude from the rebuild

Deliverables:

- stable domain contract list
- migration inventory
- dirty-team findings list

## Workstream 2: Build Studio First

Goal:

- establish Studio as the primary application

Tasks:

- studio shell
- collapsible editor tree
- always-visible minimap preview
- detail pane
- inline create/edit forms
- embedded runtime bridge

Deliverables:

- Studio boots independently
- Studio can browse and edit story-scoped content

## Workstream 3: Runtime Embed

Goal:

- create a clean simulation surface for builder actions

Tasks:

- blank map boot
- map load from authored data
- terrain painter
- collision painter
- zone drawing/editing
- trigger editing
- spawner editing
- placed unit/NPC editing
- viewport/minimap bridge back to Studio

Deliverables:

- no player HUD
- no launcher overlay
- no demo entities
- no ambient music by default

## Workstream 4: Map Authoring

Goal:

- make maps fully authorable from Studio

Tasks:

- map creation
- tileset assignment
- terrain properties editor
- collision layer editor
- zones editor
- triggers editor
- weather override editor
- map save/load

Deliverables:

- one branch per map in Studio
- child nodes for Tilesets, Terrain, Zones, Collision, Weather

## Workstream 5: Unit Authoring

Goal:

- make units first-class DB-backed templates

Tasks:

- create unit template
- edit name, category, stats, faction
- attach loot defaults
- attach sprite sheets / sprite templates
- define actions
- attach per-action sound bindings

Deliverables:

- Units tree with `Create Unit`
- one branch per unit template
- inline editing forms

## Workstream 6: NPC Authoring

Goal:

- make NPCs override-driven instances based on unit templates

Tasks:

- create NPC from base unit selector
- override stats and identity
- override sprite/audio
- assign faction
- attach dialogue and knowledge
- attach loot override

Deliverables:

- NPC tree with `Create NPC`
- base unit selection in creation flow

## Workstream 7: Event / Quest Authoring

Goal:

- unify quests and non-quest events under clear event tooling

Tasks:

- trigger authoring
- quest definitions
- dependency chains
- non-quest events
- runtime action wiring

Deliverables:

- `Events` tree with `Triggers`, `Quests`, `Non-Quest Events`

## Workstream 8: Faction Authoring

Goal:

- make factions a real reverse-membership system

Tasks:

- create faction
- edit identity, color, display
- edit relationships
- surface member units
- surface member NPCs

Deliverables:

- faction-first reverse view of associated units/NPCs

## Workstream 9: Player Runtime

Goal:

- build the separate play shell after Studio and Runtime Embed

Tasks:

- launcher handoff
- story load
- save load/apply
- codex/book HUD
- party cards
- dialogue
- minimap

Deliverables:

- Player Runtime contains no authoring tree logic

## Workstream 10: Migration / Validation

Goal:

- migrate existing content and validate behavior cleanly

Tasks:

- import authored maps
- import units/NPCs/factions/events
- verify save separation
- verify no demo dependencies
- verify story loading from canonical data

Deliverables:

- content migration checklist
- rebuild acceptance test list

## Priority Order

Recommended sequence:

1. Freeze Contracts
2. Studio First
3. Runtime Embed
4. Map Authoring
5. Unit / NPC / Faction Authoring
6. Event / Quest Authoring
7. Player Runtime
8. Migration / Validation
