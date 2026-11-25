# RealmKit Book HUD Design

## Purpose

This document defines the visual and structural rules for the player-facing
RealmKit UI. It exists so the codex, party cards, hotbar, dialogue windows,
minimap, launcher, and future story-facing UI all feel like parts of the same
kit instead of isolated widgets.

The primary visual anchors are:

- the launcher at `?mode=launcher`
- the codex / book UI
- classic CRPG HUD layouts
- parchment-and-wood fantasy interfaces

## Design Goals

1. Make the runtime UI feel authored, not debug-built.
2. Keep the launcher, codex, party cards, hotbar, minimap, and dialogue windows
   in the same visual family.
3. Let the codex carry dense information while the bottom HUD stays compact.
4. Support one controlled player or a multi-member party without changing the
   entire layout model.
5. Keep reusable chrome in shared CSS, and keep runtime layout logic in
   `RealmGameUI.js`.

## Visual Language

### Outer Frame

- Dark carved wood shell
- Overhanging corner hardware
- Subtle vertical wood grain
- Gold/burnished title plaque

### Inner Surface

- Warm parchment panel
- Faint paper grain and ruled texture
- Slight inset lighting
- Soft border line inside the page

### Typography

- Pixel-style fantasy presentation
- High-value labels should be short and uppercase
- Content-heavy codex pages should favor scannable blocks, not giant headings

## Core Layout Model

### Bottom HUD

The bottom HUD is split into two separate framed regions:

- party card strip on the left
- hotbar/action strip on the right

This separation is intentional. Party cards should never visually read as if
they are inside the hotbar frame.

### Party Cards

Each party member gets an independent framed card.

Card structure:

```text
+------------------+
| portrait   level |
| status icons     |
| HP [bar] value   |
| MP [bar] value   |
| XP [bar] value   |
+------------------+
```

Rules:

- one card per party member
- the controlled member gets a crest marker
- as party count rises, the hotbar frame shrinks first
- party cards stay discrete; they do not merge into a single group shell

### Codex / Journal

The codex is a fixed-aspect book window.

Rules:

- keep the book aspect ratio stable
- keep all content inside the codex shell
- overflow belongs in internal scroll regions, never outside the frame
- tabs live down the right side of the notes page on desktop
- the left page is the character/adventurer page
- the right page changes by tab

### Minimap

The minimap should feel like a field map or parchment insert, not a debug box.

Rules:

- use the same wood frame and corner treatment as other windows
- include a title plaque
- keep map rendering slightly translucent so the parchment mat reads through
- put time-of-day indication here, not in the hotbar

## Shared Chrome Rules

These values should come from the shared stylesheet whenever possible.

### Insets

- standard inner inset: `5px`
- standard inner offset for full-height shells: `10px`

These are exposed through shared CSS tokens in
`src/css/realmkit-ui.css`:

- `--rk-inner-inset`
- `--rk-inner-offset`

### Corners

- corner size: `24px`
- corner overhang: `-12px`

### Title Plaques

- centered on major windows
- gold/burnished finish
- should visually echo the launcher plaque

## CSS Ownership

### Shared CSS

Shared visual tokens and reusable shell rules belong in:

[`realmkit-ui.css`](../src/css/realmkit-ui.css)

This includes:

- color tokens
- inner inset tokens
- reusable card/page surface rules
- reusable party card baseline rules

### Runtime JS Styles

`RealmGameUI.js` still injects styles for runtime-specific layout concerns:

- fixed positioning
- responsive book sizing
- dock spacing
- hotbar shrink behavior
- per-component layout rules that depend on runtime structure

If a style is shared across launcher, cards, codex, minimap, or other fantasy
panels, prefer moving it into the shared stylesheet.

## Content Priorities

### Bottom HUD should show

- party cards
- hotbar slots
- minimal action buttons
- optional status chips

### Bottom HUD should avoid

- large debug text
- large world stats
- duplicate gold/time panels
- information already available in the codex

### Codex should carry

- character sheet
- backpack / inventory
- quests
- factions
- lore / codex entries
- magic / abilities

## Authoring Direction

Long-term, stories should be able to influence:

- codex tab availability
- labels like `HP`, `MP`, `Focus`, or `Spell Points`
- default open page
- party HUD density
- solo vs party presentation

That story-driven variation should sit on top of this visual system rather than
replace it.

## Current Implementation Notes

Current runtime implementation lives in:

- [`RealmGameUI.js`](../src/js/ui/RealmGameUI.js)
- [`Engine.js`](../src/js/core/Engine.js)
- [`realmkit-ui.css`](../src/css/realmkit-ui.css)

When adjusting the player UI, keep the launcher page open as a visual reference.
