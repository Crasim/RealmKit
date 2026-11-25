# Gameplay Systems

Date: 2026-04-19

## Purpose

This document describes the gameplay-side systems the clean-room rebuild must
support, without forcing those systems to own Studio concerns.

## Story Runtime Model

At runtime, a story resolves into:

- a selected map or scene
- the story rules profile
- the story UI profile
- the relevant factions
- the relevant unit and NPC definitions
- the relevant quests and events

Runtime should consume a normalized story snapshot, not scrape authoring UI.

## Stats Model

RealmKit should support a flexible stat system that can present as:

- D&D-like
- hybrid RPG
- narrative-light

### Core Runtime Stats

These should exist regardless of presentation mode:

- `hp`
- `maxHp`
- `resource`
- `maxResource`
- `attack`
- `defense`
- `speed`

Optional/common extension stats:

- `critChance`
- `critMultiplier`
- `dodgeChance`
- `blockChance`
- `blockAmount`
- `aggroRange`
- `attackRange`

### Presentation Layer Rule

The UI may rename or group these, for example:

- `resource` -> MP
- `resource` -> Spell Points
- `resource` -> Focus

But the runtime contract should stay coherent underneath.

## Combat System

The rebuild should preserve the intended combat flavor:

- realtime-with-pause
- story/rules-profile-aware presentation
- unit-template-driven stat resolution

### Combat Responsibilities

Combat must support:

- hit resolution
- damage resolution
- range and aggro behavior
- friendly/hostile faction checks
- status effects
- death/down state
- loot trigger points

### Combat Inputs

Combat uses:

- unit template base stats
- NPC or placed-unit overrides
- faction relationships
- active status effects
- story/rules profile

### Combat Outputs

Combat can emit:

- damage events
- kill events
- faction response events
- quest/event triggers
- loot drops

## Status Effects

Status effects should be a reusable system, not hardcoded per unit type.

They may include:

- buff/debuff modifiers
- DOT/HOT
- movement changes
- action restrictions
- vulnerability/resistance effects

Status effects should be visible in Player Runtime and inspectable in Studio
preview, but not authored inside player HUD logic.

## Triggers and Conditions

Triggers are the bridge between map space and authored runtime behavior.

### Trigger Types

Examples:

- area enter
- area exit
- interaction
- kill condition
- quest state condition
- faction state condition
- timer/wave condition

### Trigger Actions

Examples:

- spawn units
- start dialogue
- advance quest
- modify faction standing
- play cinematic
- change weather
- grant loot/reward

Triggers should always be editable as structured authoring objects.

## Zones

Zones are spatial authoring tools used by multiple systems.

They can drive:

- transitions
- safe/hostile regions
- weather/local environment rules
- spawn context
- quest gating

Zones should be paintable/drawable in Studio and previewable in Runtime Embed.

## Quests

Quest design should support:

- standalone quests
- dependency chains
- branching progression
- objective-based tracking
- event-driven advancement

Quests should not be limited to "kill N enemies"; they need flexible objective
and dependency support.

## Factions

Faction behavior affects:

- hostility/friendliness
- combat response
- spawn logic
- story logic
- dialogue/knowledge routing

Faction relationships should be authorable and inspectable from the faction
side, not only from unit/NPC forms.

## Dialogue and Knowledge

NPC dialogue and knowledge should remain separate from raw combat definitions.

Dialogue/knowledge systems should support:

- NPC-specific authored content
- conditional lines/options
- quest/faction/state gating
- authorable references to story facts or discovered information

## Runtime Preview Expectations

Studio preview should let authors test:

- map surfaces
- zone/trigger behavior
- placed units and NPCs
- faction interactions
- quest/event activation

without loading full player-facing HUD or demo gameplay baggage.
