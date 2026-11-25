# TileMap

Manages tile grid data, layers, collision, and cached rendering.

## Constructor

```javascript
var tileMap = new RealmKit.TileMap({
    width: 128,
    height: 128,
    tileSize: 32,
    layers: [
        { name: 'ground', data: tileDataArray }
    ],
    collisionData: collisionArray
});
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number` | Map width in tiles |
| `height` | `number` | Map height in tiles |
| `tileSize` | `number` | Pixels per tile (default 32) |
| `layers` | `array` | Layer data arrays |
| `collisionData` | `array` | Collision flags (0/1) |
| `mapCanvas` | `Canvas` | Cached render canvas |
| `mapReady` | `boolean` | Canvas is cached |

## Methods

### buildMapCanvas(tileset)

```javascript
tileMap.buildMapCanvas(engine.tileset);
```

Render all layers to offscreen canvas. Called automatically by Engine.

### getTileAt(x, y)

```javascript
var tileId = tileMap.getTileAt(5, 10);
```

Get tile ID at position. Returns -1 if out of bounds.

### setTileAt(x, y, tileId, layer)

```javascript
tileMap.setTileAt(5, 10, 42, 0);
```

Set tile at position in specified layer.

### isCollision(x, y)

```javascript
if (tileMap.isCollision(5, 10)) {
    // tile is solid
}
```

Check if tile position has collision.

### worldToTile(worldX, worldY)

```javascript
var tilePos = tileMap.worldToTile(500, 300);
// { x: 15, y: 9 }
```

Convert world coordinates to tile coordinates.

### tileToWorld(tileX, tileY)

```javascript
var worldPos = tileMap.tileToWorld(15, 9);
// { x: 480, y: 288 }
```

Convert tile coordinates to world coordinates (top-left corner).

## Collision Data Format

```javascript
// Uint8Array or regular array
collisionData[position] = 0; // passable
collisionData[position] = 1; // solid

// Position = y * width + x
var position = tileY * tileMap.width + tileX;
```

## Layer Format

```javascript
layers: [
    {
        name: 'ground',
        data: [] // tile IDs, length = width * height
    },
    {
        name: 'decoration',
        data: []
    }
]
```

## Example

```javascript
var tileMap = new RealmKit.TileMap({
    width: 64,
    height: 64,
    tileSize: 32
});

// Generate initial data
tileMap.layers = [{
    name: 'ground',
    data: new Array(64 * 64).fill(0)
}];

tileMap.collisionData = new Array(64 * 64).fill(0);

// Set some walls
for (var i = 0; i < 64; i++) {
    tileMap.setTileAt(i, 0, 1, 0);  // top wall
    tileMap.setTileAt(i, 63, 1, 0); // bottom wall
    tileMap.collisionData[i] = 1;              // top collision
    tileMap.collisionData[63 * 64 + i] = 1;    // bottom collision
}

tileMap.buildMapCanvas(tileset);
```

## Rendering

TileMap uses canvas caching for performance:
1. `buildMapCanvas()` renders all tiles to an offscreen canvas
2. `Engine.renderGroundLayer()` draws the cached canvas with viewport offset
3. Only redraws when `mapReady = false`