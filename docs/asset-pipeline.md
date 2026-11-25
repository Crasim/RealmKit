# Asset Pipeline Guide

How to create, organize, and load sprites, tilesets, and audio in RealmKit.

## Directory Structure

```
assets/
├── sprites/
│   ├── hero.png
│   ├── hero.json
│   ├── npc/
│   │   ├── villager.png
│   │   └── villager.json
│   └── monsters/
│       ├── goblin.png
│       └── goblin.json
├── tilesets/
│   ├── terrain.png
│   └── terrain.json
├── audio/
│   ├── sfx/
│   │   ├── hit.wav
│   │   └── pickup.wav
│   └── music/
│       └── ambient.mp3
└── data/
    └── monsters.json
```

## Sprite Sheets

### Standard Format: 32-Column Humanoid

RealmKit uses a **32-column grid** for character sprites. Each frame is 32×48 pixels.

```
Sheet dimensions: 32 cols × N rows
Frame size: 32×48 pixels
Total frames = 32 × rows
```

#### Row Layout (Humanoid Standard)

| Rows | Animation | Frames | FPS | Loop | Notes |
|------|----------|--------|-----|------|-------|
| 0-7 | Idle (8 dirs) | 4 each | 2 | Yes | down, up, left, right, diag_ne, diag_nw, diag_sw, diag_se |
| 8-15 | Walk (8 dirs) | 8 each | 8 | Yes | Same direction order |
| 16-23 | Run (8 dirs) | 8 each | 12 | Yes | Same direction order |
| 24 | Death | 8 | 8 | No | Non-directional |
| 25 | Hurt | 4 | 12 | No | Transitions to idle_down |
| 26 | Sleep | 4 | 2 | Yes | Non-directional |
| 27-31 | Combat (5 dirs) | 6 each | 10-12 | No | melee/ranged/cast per direction |

#### Optional Extended Rows (PC/Boss Sprites)

| Rows | Animation | Frames | FPS | Loop |
|------|----------|--------|-----|------|
| 32-39 | Swim (8 dirs) | 8 each | 6 | Yes |
| 40-47 | Melee (8 dirs) | 6 each | 12 | No→idle |
| 48-55 | Ranged (8 dirs) | 6 each | 10 | No→idle |
| 56-63 | Cast (8 dirs) | 8 each | 8 | No→idle |
| 64-71 | Victory | 6 | 8 | No→idle_down |
| 72-95 | Emotes ×12 | 4-8 each | 6-8 | No→idle_down |
| 96-127 | Specials ×19 | 8 each | 8 | No→idle_down |

#### Direction Mirroring

For symmetric characters, only paint 5 directions (down, up, left, diag_ne, diag_sw). The engine mirrors these at render time:

```
Engine mirrors: right←left, diag_nw←diag_ne, diag_se←diag_sw
```

#### Tile ID Calculation

```
frameIndex = row × 32 + col
row = floor(frameIndex / 32)
col = frameIndex % 32
```

### Manifest JSON

```json
{
    "id": "hero_knight",
    "name": "Hero Knight",
    "image": "assets/sprites/hero_knight.png",
    "imageWidth": 1024,
    "imageHeight": 1536,
    "frameWidth": 32,
    "frameHeight": 48,
    "colsPerRow": 32,
    "directions": ["down", "up", "left", "right", "diag_ne", "diag_nw", "diag_sw", "diag_se"],
    "directionMirrors": {
        "right": "left",
        "diag_nw": "diag_ne",
        "diag_se": "diag_sw"
    },
    "animations": {
        "idle_down":     { "row": 0,  "frames": 4, "fps": 2, "loop": true },
        "idle_up":       { "row": 1,  "frames": 4, "fps": 2, "loop": true },
        "idle_left":     { "row": 2,  "frames": 4, "fps": 2, "loop": true },
        "idle_right":    { "row": 3,  "frames": 4, "fps": 2, "loop": true },
        "idle_diag_ne":  { "row": 4,  "frames": 4, "fps": 2, "loop": true },
        "idle_diag_nw":  { "row": 5,  "frames": 4, "fps": 2, "loop": true },
        "idle_diag_sw":  { "row": 6,  "frames": 4, "fps": 2, "loop": true },
        "idle_diag_se":  { "row": 7,  "frames": 4, "fps": 2, "loop": true },
        "walk_down":     { "row": 8,  "frames": 8, "fps": 8, "loop": true },
        "walk_up":       { "row": 9,  "frames": 8, "fps": 8, "loop": true },
        "walk_left":     { "row": 10, "frames": 8, "fps": 8, "loop": true },
        "walk_right":    { "row": 11, "frames": 8, "fps": 8, "loop": true },
        "walk_diag_ne":  { "row": 12, "frames": 8, "fps": 8, "loop": true },
        "walk_diag_nw":  { "row": 13, "frames": 8, "fps": 8, "loop": true },
        "walk_diag_sw":  { "row": 14, "frames": 8, "fps": 8, "loop": true },
        "walk_diag_se":  { "row": 15, "frames": 8, "fps": 8, "loop": true },
        "run_down":      { "row": 16, "frames": 8, "fps": 12, "loop": true },
        "run_up":        { "row": 17, "frames": 8, "fps": 12, "loop": true },
        "run_left":      { "row": 18, "frames": 8, "fps": 12, "loop": true },
        "run_right":     { "row": 19, "frames": 8, "fps": 12, "loop": true },
        "run_diag_ne":   { "row": 20, "frames": 8, "fps": 12, "loop": true },
        "run_diag_nw":   { "row": 21, "frames": 8, "fps": 12, "loop": true },
        "run_diag_sw":   { "row": 22, "frames": 8, "fps": 12, "loop": true },
        "run_diag_se":   { "row": 23, "frames": 8, "fps": 12, "loop": true },
        "death":         { "row": 24, "frames": 8, "fps": 8, "loop": false },
        "hurt":          { "row": 25, "frames": 4, "fps": 12, "loop": false, "nextAnim": "idle_down" },
        "sleep":         { "row": 26, "frames": 4, "fps": 2, "loop": true },
        "melee_down":   { "row": 27, "frames": 6, "fps": 12, "loop": false, "nextAnim": "idle_down" },
        "melee_up":     { "row": 28, "frames": 6, "fps": 12, "loop": false, "nextAnim": "idle_up" },
        "melee_left":   { "row": 29, "frames": 6, "fps": 12, "loop": false, "nextAnim": "idle_left" },
        "melee_right":  { "row": 30, "frames": 6, "fps": 12, "loop": false, "nextAnim": "idle_right" },
        "ranged_down":   { "row": 31, "frames": 6, "fps": 10, "loop": false, "nextAnim": "idle_down" }
    }
}
```

### Animation Properties

| Property | Type | Description |
|----------|------|-------------|
| `row` | `number` | Row index in the sprite sheet (0-based) |
| `frames` | `number` | Number of frames in this animation |
| `fps` | `number` | Frames per second |
| `loop` | `boolean` | Loop animation (default: true) |
| `nextAnim` | `string` | Animation to play after this one completes (for non-looping) |

### Animation State Machine

Entities use an `AnimationStateMachine` to manage transitions:

```
idle → walk (on movement)
walk → idle (on stop)
idle/walk → attack (on combat trigger)
attack → idle (after animation completes, via nextAnim)
idle/walk → hurt (on damage)
hurt → idle_down (after animation)
idle/walk → death (on HP≤0)
death → idle_down (on respawn)
```

### Loading Sprites

```javascript
// Method 1: Use PreloadManager (recommended)
var preload = new RealmKit.PreloadManager({ showProgress: true });
preload.addSpritesheet('hero', 'assets/sprites/hero.png', 'assets/sprites/hero.json');
preload.setCompleteCallback(function() {
    engine.start();
});
preload.start();

// Method 2: Load directly
engine.assetLoader.loadImage('assets/sprites/hero.png', function(img) {
    engine.assetCache.setCanvas('hero', img);
});
engine.assetLoader.loadJSON('assets/sprites/hero.json', function(manifest) {
    engine.player.manifest = manifest;
});
```

### Using Sprites

```javascript
// Assign to entity
player.sprite = engine.assetCache.getCanvas('hero');
player.manifest = engine.assetCache.getManifest('hero');
player.animation = 'walk_down';

// Change animation
player.animation = 'attack_down';
```

## Tilesets

### Tileset PNG

Create a PNG with tiles arranged in a grid:

```
+------+------+------+------+
| 0    | 1    | 2    | 3    |  <- Grass, dirt, water, sand
+------+------+------+------+
| 4    | 5    | 6    | 7    |  <- Floor types
+------+------+------+------+
| 8    | 9    | 10   | 11   |  <- Wall types
+------+------+------+------+
| 12   | 13   | 14   | 15   |  <- Decorations
+------+------+------+------+
```

Tile IDs are calculated as: `id = row * columns + column`

### Procedural Tileset

RealmKit can generate tilesets procedurally:

```javascript
var tileset = new RealmKit.Tileset({
    tileSize: 32,
    tileTypes: ['grass', 'dirt', 'water', 'sand', 'stone', 'wood']
});
tileset.generateProcedural();

engine.tileset = tileset;
```

### Custom Tileset JSON

```json
{
    "id": "terrain",
    "image": "terrain.png",
    "tileWidth": 32,
    "tileHeight": 32,
    "tiles": {
        "0": { "type": "grass", "walkable": true },
        "1": { "type": "dirt", "walkable": true },
        "2": { "type": "water", "walkable": false },
        "3": { "type": "sand", "walkable": true }
    }
}
```

## Audio

### Sound Effects

```javascript
// Load audio
var audio = new RealmKit.AudioSystem();
audio.loadSound('hit', 'assets/audio/sfx/hit.wav');
audio.loadSound('pickup', 'assets/audio/sfx/pickup.wav');

// Play one-shot
audio.play('hit');
audio.play('pickup', 0.5);  // 50% volume

// Set master volume
audio.setMasterVolume(0.8);  // 80% volume

// Mute/unmute
audio.toggleMute();
```

### Background Music

```javascript
// Load music
audio.loadMusic('ambient', 'assets/audio/music/ambient.mp3');

// Play looping music
audio.playMusic('ambient');

// Fade in/out
audio.fadeIn(2000);  // 2 second fade in
audio.fadeOut(1000); // 1 second fade out
```

### Audio Formats

| Format | Support | Best For |
|--------|---------|----------|
| WAV | Excellent | Short sound effects |
| MP3 | Excellent | Background music |
| OGG | Good | Both (smaller than MP3) |

## Procedural Sprites

When you don't have art assets, use procedural sprites:

```javascript
var proceduralSprite = new RealmKit.ProceduralSprite({
    width: 32,
    height: 32,
    type: 'character',
    colors: {
        body: '#4a9',
        shirt: '#d84',
        hair: '#333'
    }
});

var canvas = proceduralSprite.generate();
player.sprite = canvas;
player.manifest = proceduralSprite.manifest;
```

### Procedural Types

| Type | Description |
|------|-------------|
| `character` | Human NPC/player sprite |
| `monster` | Monster sprite |
| `item` | Item icon |
| `tile` | Single tile |

## Asset Organization Tips

### Naming Conventions

```
sprites/
├── {entity_type}_{variant}.png    <- hero_knight.png
├── {entity_type}_{variant}.json   <- hero_knight.json
└── {category}/
    └── {name}.png                 <- monsters/goblin.png
```

### Preload Pattern

```javascript
var preload = new RealmKit.PreloadManager({ showProgress: true });

// Critical assets first
preload.addImage('player', 'assets/sprites/hero.png', 'critical');
preload.addJSON('player_manifest', 'assets/sprites/hero.json', 'critical');

// Then other sprites
preload.addSpritesheet('villager', 'assets/sprites/npc/villager.png', 'assets/sprites/npc/villager.json', 'normal');

// Audio last (can be deferred)
preload.addAudio('hit', 'assets/audio/sfx/hit.wav', 'deferred');

preload.start();
```

### Lazy Loading

```javascript
// Defer loading until needed
function loadMonsterSprites() {
    engine.assetLoader.loadImage('assets/sprites/monsters/goblin.png', function(img) {
        engine.assetCache.setCanvas('goblin', img);
    });
}

// Call when player enters monster area
```

## Debugging Assets

### Check Loading Status

```javascript
preload.setProgressCallback(function(progress, loaded, total) {
    console.log('Loaded:', loaded, '/', total, '(', Math.round(progress * 100), '%)');
});

preload.setCompleteCallback(function(successes, failures) {
    failures.forEach(function(f) {
        console.error('Failed to load:', f.url);
    });
});
```

### Inspect Cache

```javascript
// List loaded assets
var assets = engine.assetCache.list();
console.log('Loaded assets:', assets);

// Check specific asset
if (engine.assetCache.has('hero')) {
    var canvas = engine.assetCache.getCanvas('hero');
    console.log('Hero sprite size:', canvas.width, 'x', canvas.height);
}
```

## Performance Notes

1. **Sprite sheets** are more efficient than separate images
2. **Keep tilesets small** - 256x256 or 512x512 max
3. **Use WAV for short SFX** - faster decode, lower latency
4. **Use MP3/OGG for music** - smaller file size
5. **Preload critical assets** before game start
6. **Defer non-essential assets** for faster startup
7. **32-column spritesheets** align well with GPU texture requirements
