# Integration Guide

How to integrate RealmKit into your own game project.

## Basic Setup

### 1. Copy Files

```
your-game/
├── index.html
├── config/
│   └── engine.js
├── assets/
│   └── sprites/
│       └── hero.json
├── src/js/
│   ├── core/
│   ├── entity/
│   ├── systems/
│   ├── utils/
│   └── ui/
└── api/ (optional, for PHP backend)
```

Copy the `RealmKit/src/` directory and `config/engine.js` to your project.

### 2. Minimal HTML

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>My RealmKit Game</title>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #000; }
        #gameCanvas { display: block; }
    </style>
</head>
<body>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    
    <!-- Config first -->
    <script src="config/engine.js"></script>
    
    <!-- Core modules -->
    <script src="src/js/core/TerrainGenerator.js"></script>
    <script src="src/js/core/Tileset.js"></script>
    <script src="src/js/core/TileMap.js"></script>
    <script src="src/js/core/GameLoop.js"></script>
    <script src="src/js/core/Viewport.js"></script>
    <script src="src/js/core/AssetCache.js"></script>
    <script src="src/js/core/AssetLoader.js"></script>
    <script src="src/js/core/InputHandler.js"></script>
    <script src="src/js/core/Engine.js"></script>
    
    <!-- Entity modules -->
    <script src="src/js/entity/Entity.js"></script>
    <script src="src/js/entity/Player.js"></script>
    <script src="src/js/entity/NPC.js"></script>
    <script src="src/js/entity/EntityManager.js"></script>
    
    <!-- Systems -->
    <script src="src/js/systems/CombatSystem.js"></script>
    <script src="src/js/systems/DialogueSystem.js"></script>
    <!-- ... load other systems ... -->
    
    <script>
        // Initialize and start
        var engine = new RealmKit.Engine();
        engine.start();
    </script>
</body>
</html>
```

### 3. Configuration

Edit `config/engine.js`:

```javascript
var RealmKit = RealmKit || {};

RealmKit.Config = {
    debug: {
        enabled: true,
        showGrid: false,
        showCoordinates: false
    },
    targetFPS: 60,
    defaultScale: 2,
    autoRefresh: false
};
```

## Custom Sprites

### Create Sprite Manifest

```json
// assets/sprites/hero.json
{
    "id": "hero",
    "width": 32,
    "height": 32,
    "animations": {
        "idle_down": { "frames": [0], "fps": 1 },
        "walk_down": { "frames": [0, 1, 2, 1], "fps": 8 },
        "walk_up": { "frames": [3, 4, 5, 4], "fps": 8 },
        "walk_left": { "frames": [6, 7, 8, 7], "fps": 8 },
        "walk_right": { "frames": [9, 10, 11, 10], "fps": 8 }
    }
}
```

### Load Sprite

```javascript
engine.assetLoader.loadManifest('assets/sprites/hero.json', function(manifest) {
    engine.player.manifest = manifest;
    engine.player.sprite = engine.assetCache.getCanvas('hero');
});
```

## Custom Monsters

### Define Monster Template

```javascript
// In MonsterTemplates.js or your own file
var myMonsters = {
    goblin_wolf_rider: {
        name: 'Goblin Wolf Rider',
        level: 8,
        hp: 120,
        attack: 25,
        defense: 12,
        speed: 150,
        xp: 150,
        loot: [
            { itemId: 'gold', weight: 100, min: 10, max: 30 },
            { itemId: 'wolf_pelt', weight: 30, min: 1, max: 1 }
        ],
        behavior: 'aggressive',
        detectRange: 200,
        attackRange: 40
    }
};
```

### Spawn Monster

```javascript
var spawner = engine.spawnerManager.createSpawner({
    id: 'goblin_camp_1',
    x: 500,
    y: 800,
    radius: 150,
    spawnPool: [
        { templateId: 'goblin_wolf_rider', weight: 1 }
    ],
    maxActive: 3,
    respawnDelay: 60000
});
```

## Custom GUI

### Add HUD Elements

```javascript
// After engine.start()
engine.hudSystem.addElement({
    id: 'health_bar',
    type: 'bar',
    x: 10,
    y: 10,
    width: 200,
    height: 20,
    getValue: function() {
        return engine.player.combatStats.hp / engine.player.combatStats.maxHp;
    },
    color: '#ff4444',
    label: 'HP'
});
```

### Custom DevPanel

```javascript
engine.devPanel.addSection({
    id: 'my_section',
    title: 'Custom Controls',
    render: function(ctx, x, y) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Custom: ' + engine.myValue, x, y);
    }
});
```

## Backend Integration

### Save/Load to API

```javascript
// Save game
engine.saveManager.saveToSlot(0, function(success) {
    if (success) {
        console.log('Game saved');
    }
});

// Load game
engine.saveManager.loadFromSlot(0, function(data) {
    if (data) {
        engine.player.x = data.playerX;
        engine.player.y = data.playerY;
    }
});
```

### Custom Save Format

```javascript
engine.saveManager.getSaveData = function() {
    return {
        player: {
            x: engine.player.x,
            y: engine.player.y,
            hp: engine.player.combatStats.hp,
            inventory: engine.inventoryManager.items
        },
        quests: engine.questSystem.getSaveData(),
        flags: engine.storyFlags,
        timestamp: Date.now()
    };
};
```

## Event Hooks

### Combat Events

```javascript
engine.combatSystem.onDamage = function(attacker, target, damage, critical) {
    engine.particles.emit('blood', target.x, target.y, 5);
    if (critical) {
        engine.addScreenShake(0.8, 300);
    }
};

engine.combatSystem.onKill = function(killer, victim) {
    engine.questSystem.checkObjective('kill', victim.type);
    engine.particles.emit('death', victim.x, victim.y, 20);
};
```

### Dialogue Events

```javascript
engine.dialogueSystem.onChoose = function(index, choice) {
    console.log('Player chose:', choice.text);
};

engine.dialogueSystem.onClose = function() {
    engine.isPaused = false;
};
```

### Quest Events

```javascript
engine.questSystem.onProgress = function(questId, objectiveIndex) {
    console.log('Quest progressed:', questId, 'objective', objectiveIndex);
};

engine.questSystem.onComplete = function(questId) {
    var quest = engine.questSystem.quests[questId];
    console.log('Quest complete:', quest.title);
    engine.inventoryManager.addGold(quest.rewardGold);
};
```

## Performance Tips

1. **Reduce particle counts** in `config/engine.js`
2. **Use smaller maps** for mobile (64x64 instead of 128x128)
3. **Disable debug overlays** in production
4. **Preload assets** before starting game

```javascript
var preload = new RealmKit.PreloadManager({ showProgress: true });
preload.addSpritesheet('hero', 'assets/sprites/hero.png', 'assets/sprites/hero.json');
preload.setCompleteCallback(function() {
    engine.start();
});
preload.start();
```

## Browser Compatibility

Test your game on:
- Chrome 90+ (recommended)
- Firefox 88+
- Edge 90+
- Safari 14+

Mobile considerations:
- Reduce particle counts
- Use smaller map sizes
- Lower default scale