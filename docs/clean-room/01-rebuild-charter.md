# Rebuild Charter

Date: 2026-04-19

## Purpose

RealmKit should be rebuilt as a story authoring platform with a player runtime,
not as a game page with some hidden editor toggles.

This charter defines the highest-level product boundaries for the clean-room
rebuild.

## Core Reframe

RealmKit is made of four distinct applications:

1. `Launcher`
2. `Studio`
3. `Runtime Embed`
4. `Player Runtime`

The most important architectural decision is:

`Builder first. Runtime second. Game shell third.`

## Application Boundaries

### Launcher

Purpose:

- choose story
- choose offline vs connected play
- enter play mode

Launcher is intentionally thin.

### Studio

Purpose:

- author stories
- paint maps
- place units and NPCs
- define factions
- build quests and events
- manage assets, sprite bindings, and audio projects
- test authored content through an embedded runtime

Studio is the primary application.

### Runtime Embed

Purpose:

- provide a clean simulation/canvas surface for Studio
- render authored map state
- support terrain painting, collision painting, zone editing, placement, and
  preview
- expose a bridge API to the studio shell

It is not a player-facing page.

### Player Runtime

Purpose:

- load authored content for play
- load save state
- run gameplay systems
- render player-facing HUD/codex/dialogue/minimap UI

## Explicit Anti-Goals

The rebuild should not preserve:

- one monolithic shell hosting both game and builder concerns
- authoring tools embedded as if they were gameplay mechanics
- prompt-like creation flows where inline authoring forms belong
- demo content as a hidden dependency
- duplicated UI stacks for similar responsibilities

## Visual Direction

The current visual direction is split intentionally:

- `Studio`: editor-like, structured, navigable, builder-first
- `Player Runtime`: codex/book/parchment/wood game presentation

Those directions can share a design language, but not the same information
architecture.

## Persistence Rule

### DB-backed authored content

These live in shared persistence:

- stories
- maps and map states
- zones, triggers, spawners
- placed units
- unit templates
- NPCs
- quests and events
- factions
- assets
- sprite templates
- audio projects

### Save-backed player state

Only player progress gets the local/offline plus DB/cloud split:

- location
- party state
- inventory and gold
- progression
- quest progress
- preferences and personal layout overrides

## Deliverable Standard

The clean-room rebuild is successful when:

1. a story can be authored entirely from Studio
2. a blank map can be created and edited without demo runtime activity
3. maps, units, NPCs, factions, quests, and events are editable inline
4. Runtime Embed acts like a canvas/service, not the main app
5. Player Runtime can play authored stories without studio code leaking into it

## Relationship To Dirty-Team Inputs

The existing repository is still useful for:

- extracting user-facing requirements
- understanding stored data
- migration constraints
- preserving intentional visual directions

But implementation should follow this charter and the rest of the clean-room
docs, not the legacy architecture.
