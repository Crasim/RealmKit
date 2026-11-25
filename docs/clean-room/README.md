# RealmKit Clean Room Docs

Date: 2026-04-19

This folder is the clean-team documentation set for rebuilding RealmKit from
the current repository without inheriting its structural confusion.

The current codebase and legacy docs remain useful as dirty-team reference
material, but the documents in this folder are the intended source of truth for
the rebuild.

## How To Read This Set

Start here:

1. [Rebuild Charter](./01-rebuild-charter.md)
2. [Workstreams](./02-workstreams.md)
3. [Domain Model](./03-domain-model.md)
4. [Gameplay Systems](./04-gameplay-systems.md)
5. [JSON Contracts](./05-json-contracts.md)
6. [Studio AI](./06-studio-ai.md)
7. [Builder Draft Templates](./07-builder-draft-templates.md)

## What This Set Covers

- product/application boundaries
- builder-first architecture
- clean-room rebuild phases
- story, map, unit, NPC, faction, quest, and event definitions
- trigger, zone, and map editing concepts
- stats and combat expectations
- JSON import/export rules for AI-assisted authoring
- Studio AI participation model
- draft JSON shapes derived from the existing builder

## What This Set Does Not Do

- preserve the current folder structure
- preserve current UI shells just because they already exist
- treat the player runtime as the primary application
- replace the database with JSON blob storage

## Dirty-Team Rule

The existing codebase may still be inspected to extract:

- user workflows
- data already present in the database
- API and migration constraints
- visual directions worth preserving

But new implementation work should follow the contracts in this folder rather
than mirror the legacy code mechanically.
