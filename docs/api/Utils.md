# Utilities API Reference

Helper classes for spatial partitioning, pathfinding, persistence, and more.

## Quadtree

Spatial partitioning for efficient entity queries.

```javascript
var quadtree = new RealmKit.Quadtree({
    x: 0,
    y: 0,
    width: 4096,
    height: 4096,
    maxObjects: 10,
    maxLevels: 4
});

// Insert entity
quadtree.insert(entity);

// Query region
var nearby = quadtree.retrieve({
    x: player.x - 200,
    y: player.y - 200,
    width: 400,
    height: 400
});

// Clear for next frame
quadtree.clear();
```

### Methods

| Method | Description |
|--------|-------------|
| `insert(entity)` | Add entity to tree |
| `retrieve(bounds)` | Get entities in region |
| `clear()` | Remove all entities |
| `getCount()` | Get total entity count |

---

## Pathfinding

A* grid-based pathfinding.

```javascript
var pathfinder = new RealmKit.Pathfinding({
    width: 128,
    height: 128,
    getCollision: function(x, y) {
        return engine.tileMap.isCollision(x, y);
    }
});

// Find path
var path = pathfinder.findPath(
    { x: startX, y: startY },
    { x: endX, y: endY }
);
// path = [{x, y}, {x, y}, ...] or null if unreachable
```

### Methods

| Method | Description |
|--------|-------------|
| `findPath(start, end)` | Find path between points |
| `setCollision(x, y, solid)` | Mark tile as passable/solid |
| `isWalkable(x, y)` | Check if tile is passable |

---

## SaveManager

localStorage persistence with slot system.

```javascript
var saveManager = new RealmKit.SaveManager({
    autoSaveInterval: 60000,  // 1 minute
    maxSlots: 5
});

// Save to slot
saveManager.saveToSlot(0, function(success) {
    console.log('Saved:', success);
});

// Load from slot
saveManager.loadFromSlot(0, function(data) {
    console.log('Loaded:', data);
});

// List all saves
var saves = saveManager.listSaves();
// [{ slot: 0, timestamp: 1234567890, name: 'Save 1' }, ...]

// Delete save
saveManager.deleteSlot(0);

// Auto-save
saveManager.enableAutoSave(engine);
```

### Methods

| Method | Description |
|--------|-------------|
| `saveToSlot(slot, callback)` | Save game to slot |
| `loadFromSlot(slot, callback)` | Load game from slot |
| `listSaves()` | Get all save metadata |
| `deleteSlot(slot)` | Delete a save |
| `enableAutoSave(engine)` | Enable periodic saves |
| `disableAutoSave()` | Disable auto-save |

---

## TimeOfDay

Day/night cycle calculations.

```javascript
var timeOfDay = new RealmKit.TimeOfDay({
    startHour: 8,      // 8:00 AM
    speed: 120,        // 120 game seconds per real second
    cycleDuration: 86400  // 24 hours in seconds
});

// Get current time
var time = timeOfDay.getTimeOfDay();  // 'morning', 'noon', 'evening', 'night'
var hour = timeOfDay.getHour();       // 0-23
var formatted = timeOfDay.formatTime(); // '14:30'

// Light level for rendering
var light = timeOfDay.getLightLevel();  // 0-1, 0 = midnight, 1 = noon
var color = timeOfDay.getAmbientColor(); // { r, g, b, a }

// Set time
timeOfDay.setHour(20);  // 8 PM
```

### Time Periods

| Period | Hours |
|--------|-------|
| dawn | 5-7 |
| morning | 7-12 |
| noon | 12-14 |
| afternoon | 14-17 |
| evening | 17-20 |
| night | 20-5 |

---

## NPCSchedule

Time-based NPC behavior schedules.

```javascript
var schedule = new RealmKit.NPCSchedule({
    type: 'merchant'  // 'merchant', 'guard', 'villager', 'night_guard'
});

// Get current activity
var activity = schedule.getActivity(currentHour);
// { action: 'work', location: { x: 500, y: 300 } }

// Is NPC sleeping?
if (schedule.isSleeping(currentHour)) {
    npc.showSleepIndicator();
}
```

### Schedule Presets

| Type | Day Pattern |
|------|-------------|
| merchant | work 9-17, sleep 22-6 |
| guard | patrol 6-22, sleep 22-6 |
| villager | wander 8-20, sleep 21-5 |
| night_guard | sleep 6-18, patrol 18-6 |

---

## CanvasCache

Offscreen canvas caching for performance.

```javascript
var cache = new RealmKit.CanvasCache({
    chunkSize: 512,
    maxCaches: 100,
    debug: false
});

// Cache grid overlay
var gridCanvas = cache.createGridCache(32, 800, 600, 'rgba(255,255,255,0.15)', 0.5);

// Cache pattern
var patternCanvas = cache.createPatternCache('checker', 64, 64, {
    colors: ['#333', '#444']
});

// Get cached canvas
var cached = cache.getCache('grid_32_800x600');
if (cached) {
    ctx.drawImage(cached.canvas, 0, 0);
}

// Clear all caches
cache.clear();
```

---

## PreloadManager

Asset preloading with progress UI.

```javascript
var preload = new RealmKit.PreloadManager({
    showProgress: true,
    timeout: 30000,
    retryCount: 3
});

// Add assets
preload.addImage('hero', 'assets/sprites/hero.png');
preload.addSpritesheet('hero_sprite', 'assets/sprites/hero.png', 'assets/sprites/hero.json');
preload.addAudio('hit', 'assets/audio/hit.wav');
preload.addJSON('config', 'data/game_config.json');

// Set progress callback
preload.setProgressCallback(function(progress) {
    console.log('Loading:', Math.round(progress * 100) + '%');
});

// Set complete callback
preload.setCompleteCallback(function(successes, failures) {
    console.log('Loaded:', successes.length, 'Failed:', failures.length);
    engine.start();
});

// Start loading
preload.start();
```

---

## HotReload

Development hot reload for JS/CSS files.

```javascript
var hotReload = new RealmKit.HotReload({
    pollInterval: 1000,
    files: [
        'src/js/core/Engine.js',
        'src/js/entity/Player.js',
        'src/style/game.css'
    ]
});

hotReload.onReload(function(file) {
    console.log('Reloaded:', file);
    if (file.includes('Engine.js')) {
        engine.reinitialize();
    }
});

// Stop watching
hotReload.stop();
```