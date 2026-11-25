# Engine

The core orchestrator of RealmKit. Manages game loop, rendering, entities, systems, and world state.

## Constructor

```javascript
var engine = new RealmKit.Engine();
```

Creates a new engine instance. Automatically initializes all subsystems.

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `player` | `Player` | Current player entity |
| `entityManager` | `EntityManager` | Entity spawning/management |
| `tileMap` | `TileMap` | Current world tile data |
| `combatSystem` | `CombatSystem` | Combat handler |
| `dialogueSystem` | `DialogueSystem` | Conversation manager |
| `questSystem` | `QuestSystem` | Quest tracking |
| `inventoryManager` | `InventoryManager` | Player inventory |
| `isPaused` | `boolean` | Pause state for realtime-with-pause |

## Methods

### start()

```javascript
engine.start();
```

Initialize and begin the game loop. Sets up canvas, loads assets, spawns player.

### stop()

```javascript
engine.stop();
```

Stop the game loop and cleanup resources.

### regenerateWorld(config)

```javascript
engine.regenerateWorld({
    seed: 12345,
    width: 128,
    height: 128,
    waterLevel: 0.35,
    hillLevel: 0.55,
    mountainLevel: 0.75
});
```

Generate new procedural terrain.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `seed` | `number` | random | World seed for reproducibility |
| `width` | `number` | 128 | Map width in tiles |
| `height` | `number` | 128 | Map height in tiles |
| `waterLevel` | `number` | 0.35 | Elevation threshold for water |
| `hillLevel` | `number` | 0.55 | Elevation threshold for hills |
| `mountainLevel` | `number` | 0.75 | Elevation threshold for mountains |

### loadStory(storyId)

```javascript
engine.loadStory('story_123', function(success) {
    if (success) {
        console.log('Story loaded');
    }
});
```

Load a story from the API and apply its configuration.

### teleport(x, y)

```javascript
engine.teleport(1000, 500);
```

Instantly move the player to world coordinates.

### togglePause()

```javascript
engine.togglePause();
```

Toggle realtime-with-pause mode (Space key).

### addScreenShake(intensity, duration)

```javascript
engine.addScreenShake(0.5, 300);
```

Add screen shake effect (used on hit/crit).

| Parameter | Type | Description |
|-----------|------|-------------|
| `intensity` | `number` | Shake strength (0-1) |
| `duration` | `number` | Duration in milliseconds |

## Events

The engine emits events through subsystem callbacks:

```javascript
engine.combatSystem.onDamage = function(attacker, target, damage) {
    console.log(attacker.name, 'hit', target.name, 'for', damage);
};

engine.questSystem.onComplete = function(questId) {
    console.log('Quest completed:', questId);
};
```

## URL Parameters

| Parameter | Effect |
|-----------|--------|
| `?mode=VisualDev` | Disable auto-refresh for manual testing |
| `?mode=launcher` | Show story selection UI |
| `?testStory=<id>` | Load specific story at startup |
| `?showBuilder` | Open StoryBuilder on load |

## Example

```javascript
var engine = new RealmKit.Engine();
engine.start();

// Access player
engine.player.x = 500;
engine.player.y = 300;

// Spawn NPC
var npc = engine.entityManager.spawn('villager', 600, 400);

// Add quest
engine.questSystem.addQuest({
    id: 'main_1',
    title: 'Find the Lost Sword',
    objectives: [
        { type: 'item', itemId: 'sword_1', count: 1 }
    ]
});
```