# RealmKit API Reference

RealmKit is a story-driven 2D game engine built in vanilla JavaScript for the browser. It provides procedural terrain generation, entity management, combat systems, dialogue trees, quests, and multiplayer support.

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
    <title>My RealmKit Game</title>
</head>
<body>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    
    <!-- Load in order -->
    <script src="config/engine.js"></script>
    <script src="src/js/core/Engine.js"></script>
    <!-- ... other modules ... -->
    
    <script>
        var engine = new RealmKit.Engine({
            canvas: document.getElementById('gameCanvas'),
            debug: { enabled: true }
        });
        engine.start();
    </script>
</body>
</html>
```

## Architecture

```
RealmKit/
├── core/           # Engine, Viewport, GameLoop, TileMap
├── entity/         # Entity, Player, NPC, LootDrop
├── systems/        # Combat, Dialogue, Quest, Trigger, etc.
├── utils/          # Quadtree, Pathfinding, SaveManager, etc.
├── ui/             # DevPanel, MapEditor, StoryBuilder
├── network/        # WebSocket client, multiplayer sync
└── data/           # Templates, defaults, factories
```

## Core Modules

| Module | Description |
|--------|-------------|
| [Engine](./Engine.md) | Main orchestrator - game loop, rendering, world state |
| [Viewport](./Viewport.md) | Camera system with coordinate transformation |
| [TileMap](./TileMap.md) | Tile grid with collision and layer data |
| [TerrainGenerator](./TerrainGenerator.md) | Perlin noise terrain generation |

## Entity System

| Module | Description |
|--------|-------------|
| [Entity](./Entity.md) | Base class for all game objects |
| [Player](./Player.md) | Player controller with input handling |
| [NPC](./NPC.md) | AI-driven non-player characters |
| [EntityManager](./EntityManager.md) | Spawn, update, destroy entities |

## Game Systems

| Module | Description |
|--------|-------------|
| [CombatSystem](./CombatSystem.md) | Damage, aggro, hit detection |
| [DialogueSystem](./DialogueSystem.md) | Branching conversations |
| [QuestSystem](./QuestSystem.md) | Objectives and tracking |
| [TriggerSystem](./TriggerSystem.md) | Zone-based events |
| [NPCSpawner](./NPCSpawner.md) | Monster spawn pools |

## Utilities

| Module | Description |
|--------|-------------|
| [Quadtree](./Quadtree.md) | Spatial partitioning for entity queries |
| [Pathfinding](./Pathfinding.md) | A* grid-based pathfinding |
| [SaveManager](./SaveManager.md) | localStorage persistence |
| [TimeOfDay](./TimeOfDay.md) | Day/night cycle |

## UI Components

| Module | Description |
|--------|-------------|
| [DevPanel](./DevPanel.md) | F2 debug overlay |
| [MapEditor](./MapEditor.md) | F5 in-game map editor |
| [StoryBuilder](./StoryBuilder.md) | F4 story/world editor |

## Conventions

### Namespace
All classes are under the `RealmKit` namespace:
```javascript
var engine = new RealmKit.Engine();
var player = new RealmKit.Player();
```

### Naming
- Classes: PascalCase (`Entity`, `CombatSystem`)
- Methods: camelCase (`update()`, `render()`)
- Private methods: underscore prefix (`_saveHistory()`)
- Constants: UPPER_CASE (`MAX_ENTITIES`)

### Configuration
Engine config in `config/engine.js`:
```javascript
var engineConfig = {
    debug: { enabled: true, showGrid: false },
    targetFPS: 60,
    defaultScale: 2,
    autoRefresh: true
};
```

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

No external dependencies. Requires HTML5 Canvas support.