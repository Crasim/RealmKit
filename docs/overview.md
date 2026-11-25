# RealmKit Overview

RealmKit is a story-driven 2D game engine for the browser, built with vanilla JavaScript and HTML5 Canvas. No bundlers, no frameworks—just clean, modular code.

## What RealmKit Provides

### Core Engine
- **Procedural Terrain Generation** — Perlin noise biomes, rivers, roads, settlements
- **Tile-based World** — Efficient cached rendering, collision detection
- **Entity System** — Players, NPCs, monsters with AI behaviors
- **Combat System** — Realtime-with-pause, D&D-style to-hit rolls, damage calculation

### Game Systems
- **Dialogue Trees** — Branching conversations with conditions and actions
- **Quest Tracking** — Objectives, progress, rewards
- **Inventory** — Items, gold, consumables, equipment
- **Status Effects** — Buffs, debuffs, DOTs, stat modifiers
- **Day/Night Cycle** — Time-based NPC schedules, spawn conditions

### Developer Tools
- **DevPanel (F2)** — FPS, player stats, terrain debug, minimap
- **MapEditor (F5)** — Paint tiles, place spawners/triggers
- **StoryBuilder (F4)** — Create stories, factions, dialogue trees
- **FeatureTestPanel (F3)** — Test combat, spawns, weather

### Performance
- **60 FPS Target** — Optimized render loop
- **Canvas Caching** — Offscreen canvas for static content
- **Quadtree Spatial Partitioning** — Efficient entity queries
- **Object Pooling** — Reusable particles/projectiles

## Project Structure

```
RealmKit/
├── index.html              # Entry point
├── config/
│   └── engine.js           # Debug flags, settings
├── assets/
│   └── sprites/            # Sprite sheets + manifests
├── src/js/
│   ├── core/               # Engine, Viewport, TileMap
│   ├── entity/             # Player, NPC, EntityManager
│   ├── systems/            # Combat, Dialogue, Quest, etc.
│   ├── ui/                 # DevPanel, MapEditor, HUD
│   ├── utils/              # Quadtree, Pathfinding, etc.
│   └── data/               # MonsterTemplates, defaults
├── docs/
│   ├── api/                # API reference
│   ├── integration.md      # Integration guide
│   └── asset-pipeline.md   # Asset creation guide
└── examples/
    └── my-first-game/      # Minimal example
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5 Canvas + Vanilla JavaScript |
| Backend | PHP 8 + PDO SQLite (optional) |
| Database | SQLite with FTS5 |
| Assets | Key-based references (no blobs) |
| Style | `var` + `function()` for browser compatibility |

## Key Design Decisions

### Why Vanilla JS?
- No build step required
- Works in any browser
- Easy to debug
- No dependency management

### Why `var` not `const/let`?
- Global namespace pattern (`RealmKit = RealmKit || {}`)
- Broader browser compatibility
- Consistent with existing codebase

### Why Canvas not WebGL?
- Simpler codebase
- Faster for 2D tile-based games
- No shader complexity
- Works everywhere Canvas works

## Getting Started

1. Open `index.html` in a browser
2. Use arrow keys or WASD to move
3. Press F2 for the DevPanel
4. Press F5 for the MapEditor
5. Press F4 for the StoryBuilder
6. Press F3 for the FeatureTestPanel

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move player |
| E | Interact with NPCs |
| Space | Pause/unpause (combat mode) |
| J | Attack |
| F2 | Toggle DevPanel |
| F3 | Toggle FeatureTestPanel |
| F4 | Toggle StoryBuilder |
| F5 | Toggle MapEditor |
| G | Toggle grid overlay |
| C | Toggle coordinate overlay |
| M | Toggle NPC auto-walk |
| Y | Toggle auto-refresh |

## Demo

Local demo: `http://localhost/RealmKit/`

The demo runs continuously and auto-refreshes every 10 seconds. Use `?mode=VisualDev` to disable auto-refresh during development.

## Documentation

- [API Reference](./api/README.md)
- [Integration Guide](./integration.md)
- [Asset Pipeline](./asset-pipeline.md)
- [Book HUD Design](./ui-book-hud.md)
- [Clean Room Docs](./clean-room/README.md)
- [Roadmap](../ROADMAP.md)

## License

MIT License. Use freely in your projects.
