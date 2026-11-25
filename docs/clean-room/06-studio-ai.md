# Studio AI

Date: 2026-04-19

## Purpose

This document defines how AI participates in Realm Studio.

The goal is not just "AI suggestions." The goal is to let AI operate across the
full builder spectrum when the user wants it to, including the ability to help
create an entire story.

AI is a builder participant.
It is not the persistence layer.

## Core Principle

Studio AI and human authors should use the same structured authoring channel.

That channel is:

- structured JSON contracts for each builder entity
- validation against those contracts
- conversion into normal builder forms and controls
- persistence to normalized database tables

This means:

- humans can author through forms
- humans can author through raw JSON
- AI can author through raw JSON
- the system can render either representation from the same underlying contract

## Studio AI Participation Model

AI should be allowed to participate across the full authoring spectrum:

- create new entries
- update existing entries
- delete existing entries
- generate partial content
- generate complete content
- operate on one item or an entire story
- assist with images, audio, and chained tasks where integrations exist

However, default safety behavior matters.

## Default Safety Model

### Default mode

By default:

- AI works through builder forms and JSON drafts
- AI changes are previewed before DB commit
- user review happens before persistence

### Optional elevated mode

The user may explicitly allow AI to submit directly to the database.

This should be an opt-in mode, not the default.

### Confirmation rules

- `Create`: may be staged automatically, then reviewed
- `Update`: requires confirmation before persistence by default
- `Delete`: requires confirmation before persistence by default

## Raw / Config Dual View

Every AI-capable builder surface should support two synchronized views:

### Raw view

- shows the structured JSON contract
- supports paste/import from external LLMs
- supports export/copy for prompting

### Config view

- shows the same content as normal forms, fields, lists, toggles, and pickers
- supports targeted editing by the user
- supports targeted DOM/AJAX-driven updates by Studio AI

These views are two representations of the same draft object.

## Builder Flow

The intended flow is:

1. user opens or creates an item
2. user or AI supplies JSON
3. Studio validates and normalizes that JSON
4. Studio shows:
   - Config view
   - Raw view
   - optional diff/preview
5. user confirms
6. Studio persists to the database

This keeps the system AI-friendly without making it fragile.

## Why JSON Is The Shared Channel

The same JSON structure should be used for:

- AI input
- AI output
- user paste/import
- draft interchange between tools
- automation and chaining
- optional backend submission payloads

This creates one authoring contract instead of separate "human path" and "AI
path" systems.

## Persistence Rule

JSON is not the storage format.

The database remains the source of truth.

The system should:

1. ingest JSON
2. validate it
3. normalize it
4. write it to the correct tables

The DB should not become a generic JSON blob store just because AI is involved.

## Author Flag

Every created or modified record should support author metadata such as:

- `author_type`: `user` or `ai`
- `author_source`: optional provider or tool identifier
- `author_mode`: `raw`, `config`, `assisted`, `direct`

This is useful for:

- auditability
- undo/review behavior
- deciding when confirmation should be stricter
- later analytics around authoring workflows

## Scope Model

Studio AI should be able to operate at all relevant scopes:

- story scope
- map scope
- faction scope
- unit template scope
- NPC scope
- quest scope
- event scope
- asset/sprite/audio scope

The exact scope depends on the current tool context, but AI should not be
artificially limited to one narrow level.

## AI Task Modes

Studio AI should support at least these modes:

### 1. Generate

Create brand new content from a prompt or example.

Examples:

- generate a starter village map
- create three grassland enemy unit templates
- create a goblin faction and associated units
- build a quest chain around two NPCs

### 2. Edit

Modify an existing item or set of items.

Examples:

- rebalance this unit
- convert this map zone to a safe region
- add faction relationships
- attach a sound to this action

### 3. Complete

Let AI fill in missing pieces while the user provides the rest.

Examples:

- user defines the stats, AI defines the loot
- user defines the map, AI fills in the quests
- user defines the faction, AI suggests matching units and NPCs

### 4. Analyze / Lint

Inspect existing content and report issues.

Examples:

- missing sprite/action binding
- quest trigger references a missing zone
- NPC base unit missing required actions
- faction has no valid hostile targets

### 5. Chain

Perform multi-step builder workflows across tools.

Examples:

- create unit template -> generate sprite via provider -> attach sprite sheets
- create NPC from base unit -> attach dialogue -> assign faction
- create quest -> create trigger -> create map zone -> link reward

## Provider Model

### Phase 1

Manual copy/paste to and from external LLMs is fully supported via Raw JSON
view.

### Phase 2

Direct provider integration can be added later so Studio AI can interact with
models directly inside Realm Studio.

This document does not assume one provider only. Provider support should be a
pluggable concern.

## Tool Awareness And Chaining

Studio AI should be tool-aware.

It should understand which builder surface it is operating in and which related
tools can be invoked next.

Examples:

- if a user creates a unit, AI may suggest sprite generation next
- if a sprite sheet is generated, AI can update unit bindings
- if a quest is created, AI can suggest triggers and NPC dialogue hooks

This is intentionally closer to a useful "builder assistant" than to a passive
chat window.

## DOM / AJAX Interaction Model

The long-term interaction model can include a local assistant that:

- reads the current builder state
- updates specific fields
- inserts/removes form sections
- switches between Raw and Config views
- stages changes in narrow, recoverable chunks

That assistant should still operate through the same validated draft contract.

It should not bypass validation simply because it can touch the DOM.

## External Tool Integrations

### Image generation

Planned direction:

- ComfyUI integration for sprites, portraits, and related image workflows

Typical chain:

1. AI creates or updates entity JSON
2. AI or user requests image generation
3. ComfyUI produces assets
4. builder updates sprite references and related metadata

### Sound / music

Current direction:

- structured MIDI-like JSON beat/composition tracks

This should remain import/export-friendly and builder-driven.

Audio should follow the same contract pattern:

- raw JSON/composition data at the edge
- validated builder representation
- persisted record in normal storage

## Review And Diff Model

AI-generated changes should be reviewable.

Preferred review tools:

- per-item diff
- field-by-field change summary
- raw JSON diff when needed
- validation warnings inline

Because JSON can be fragile, review should happen in narrow chunks:

- one item
- one unit
- one NPC
- one faction
- one quest
- one event
- one map surface area or map artifact

This is safer and easier to recover from than giant whole-story blind commits.

## Builder Entity Coverage

Studio AI should eventually support the full builder surface:

- Story
- Map
- Terrain
- Collision
- Zones
- Triggers
- Weather
- Unit Templates
- NPCs
- Factions
- Quests
- Events
- Asset bindings
- Sprite templates
- Audio projects

## Required Contract Work

For this system to work well, each entity needs:

1. a strong JSON schema/template
2. a normalized DB mapping
3. Raw view support
4. Config view support
5. validation rules
6. preview/diff behavior

Without strong schemas, Studio AI will be weak and inconsistent.

## Recommended Build Order

### Phase A

- define JSON templates for all major entities
- define normalized DB mapping for each
- add author metadata fields

### Phase B

- implement Raw / Config dual view
- implement validation and preview
- implement import/export for each editor

### Phase C

- enable AI-assisted creation and editing via copy/paste flow
- add lint/analyze tools

### Phase D

- add direct provider integrations
- add tool chaining
- add DOM/AJAX assistant behavior

## Open Items

These still need follow-up design decisions:

- exact provider abstraction model
- exact confirmation UX
- exact diff UX
- which records store author metadata directly vs in audit history
- how direct-to-DB AI mode is enabled and scoped

## Summary

Studio AI should not be bolted on as a chat widget.

It should be built into the authoring system through:

- strong JSON templates
- raw/config dual editing
- validation
- preview
- confirmation
- normalized persistence

The key idea is simple:

`human and AI both author through the same contract; the database remains the source of truth.`
