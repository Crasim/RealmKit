# JSON Contracts

Date: 2026-04-19

## Purpose

RealmKit should support structured JSON import/export for every major builder
surface so AI tools and external generators can help create content.

JSON is a builder boundary and interchange format.
JSON is not the canonical storage model.

## Core Rule

The flow is:

1. export or define a JSON payload
2. import JSON into the relevant editor
3. validate it
4. normalize it into the domain model
5. persist it to the database

## Why This Exists

- AI-assisted creation
- bulk authoring
- migration/import pipelines
- deterministic payload review
- easier testing and fixture creation

## JSON-Supported Builder Surfaces

Every major builder/editor should support import/export for:

- Story
- Map
- Map State
- Zones
- Triggers
- Spawners
- Placed Units
- Unit Templates
- NPCs
- Quests
- Events
- Factions
- Tileset / Asset bindings
- Sprite templates
- Audio projects

## Validation Expectations

Each import path should validate:

- required fields
- enum values
- foreign-key references
- schema version
- story compatibility
- map compatibility where applicable

Validation failures should appear inline in the builder UI.

## Editor Behavior

Each editor should support:

- `Export JSON`
- `Import JSON`
- preview/diff before commit
- save after normalization

Editors may accept broader, more generation-friendly JSON than the exact
persistence payload, as long as it maps cleanly into normalized storage.

## Example Mapping Principle

### Map JSON

One JSON payload may contain:

- map metadata
- terrain
- collision
- zones
- triggers
- spawners
- placed units

But persistence still fans this back out into the appropriate map-related
tables.

### Unit JSON

One JSON payload may contain:

- identity
- category
- stat block
- faction
- loot
- sprite bindings
- action definitions
- audio bindings

But persistence still writes to normalized unit-related storage.

## AI-Assisted Workflow

The intended AI workflow is:

1. export a real example JSON payload from RealmKit
2. ask AI to generate or modify a compatible payload
3. import that payload back into the builder
4. inspect the result visually in normal editor UI
5. save to the database

This lets AI participate in authoring without becoming the persistence layer.
