var RealmKit = RealmKit || {};

RealmKit.TileMap = class TileMap {
    constructor(config) {
        this.config = config || {};
        
        this.name = this.config.name || 'untitled_map';
        this.tileset = this.config.tileset || null;
        this.tileWidth = this.config.tileWidth || 32;
        this.tileHeight = this.config.tileHeight || 32;
        
        this.width = this.config.width || 10;
        this.height = this.config.height || 10;
        this.widthInPixels = this.width * this.tileWidth;
        this.heightInPixels = this.height * this.tileHeight;
        
        this.layers = [];
        this.collisionData = null;
        this.loaded = false;
        
        this.mapCanvas = null;
        this.mapReady = false;
        
        console.log('[TileMap] Created:', this.name, this.width + 'x' + this.height, 'tiles');
    }
    
    setTileset(tileset) {
        this.tileset = tileset;
        this.tileWidth = tileset.tileWidth;
        this.tileHeight = tileset.tileHeight;
        this.widthInPixels = this.width * this.tileWidth;
        this.heightInPixels = this.height * this.tileHeight;
    }
    
    addLayer(name, data) {
        if (data.length !== this.width * this.height) {
            console.error('[TileMap] Layer data size mismatch');
            return;
        }
        this.layers.push({ name: name, data: data, visible: true });
        console.log('[TileMap] Layer:', name);
    }
    
    setCollisionData(data) {
        if (data.length !== this.width * this.height) return;
        this.collisionData = data;
    }
    
    isColliding(tileX, tileY) {
        if (!this.collisionData) return false;
        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) return true;
        return this.collisionData[tileY * this.width + tileX] === 1;
    }
    
    buildMapCanvas() {
        if (!this.tileset || !this.tileset.image) {
            console.log('[TileMap] Waiting for tileset image...');
            return false;
        }
        // If the source is an HTMLImageElement, wait until it has finished decoding.
        // Canvas elements (used by the procedural tileset) are always immediately ready.
        if (this.tileset.image.tagName === 'IMG' && !this.tileset.image.complete) {
            console.log('[TileMap] Waiting for tileset image decode...');
            return false;
        }
        
        console.log('[TileMap] Building map canvas...');
        var start = performance.now();
        
        this.mapCanvas = document.createElement('canvas');
        this.mapCanvas.width = this.widthInPixels;
        this.mapCanvas.height = this.heightInPixels;
        var ctx = this.mapCanvas.getContext('2d');
        
        // Grass overlay bleed — tiles on this layer are drawn slightly oversized
        // (+8px wide, +16px tall, centered) so they lap over adjacent tiles and
        // produce a softer, more organic edge instead of hard-cut grid lines.
        var GRASS_BLEED_X = 8;
        var GRASS_BLEED_Y = 16;

        for (var l = 0; l < this.layers.length; l++) {
            var layer = this.layers[l];
            if (!layer.visible) continue;
            var isGrassOverlay = (layer.name === 'grass_overlay');

            for (var row = 0; row < this.height; row++) {
                for (var col = 0; col < this.width; col++) {
                    var index = row * this.width + col;
                    var tileId = layer.data[index];
                    if (tileId < 0) continue;
                    // Animated tiles (ID >= 64) are skipped in the baked canvas
                    // and rendered live each frame in render() instead.
                    if (tileId >= 64) continue;

                    var screenX = col * this.tileWidth;
                    var screenY = row * this.tileHeight;

                    if (isGrassOverlay && this.tileset.image) {
                        // Draw oversized, centered: bleed equally on all sides.
                        var tile   = this.tileset.getTile(tileId);
                        var srcX   = tile.x * this.tileWidth;
                        var srcY   = tile.y * this.tileHeight;
                        var destX  = screenX - GRASS_BLEED_X / 2;
                        var destY  = screenY - GRASS_BLEED_Y / 2;
                        var destW  = this.tileWidth  + GRASS_BLEED_X;
                        var destH  = this.tileHeight + GRASS_BLEED_Y;
                        ctx.drawImage(
                            this.tileset.image,
                            srcX, srcY, this.tileWidth, this.tileHeight,
                            destX, destY, destW, destH
                        );
                    } else {
                        this.tileset.drawTile(ctx, tileId, screenX, screenY, 1);
                    }
                }
            }
        }
        
        this.mapReady = true;
        var elapsed = performance.now() - start;
        console.log('[TileMap] Canvas ready:', this.widthInPixels + 'x' + this.heightInPixels, elapsed.toFixed(1) + 'ms');
        
        return true;
    }
    
    render(ctx, viewport, elapsed) {
        if (!this.mapReady) {
            if (!this.buildMapCanvas()) {
                this.renderFallback(ctx, viewport);
                return;
            }
        }

        var startX = Math.max(0, Math.floor(viewport.x));
        var startY = Math.max(0, Math.floor(viewport.y));
        var viewW = Math.min(viewport.viewWidth, this.widthInPixels - startX);
        var viewH = Math.min(viewport.viewHeight, this.heightInPixels - startY);

        if (viewW <= 0 || viewH <= 0) return;

        // Draw the static pre-baked layer
        ctx.drawImage(
            this.mapCanvas,
            startX, startY, viewW, viewH,
            startX, startY, viewW, viewH
        );

        // --- Animated tile pass ---
        // Tiles with ID >= 64 were excluded from the baked canvas.
        // We cycle through their 4-frame animation in real time using elapsed ms.
        if (!this.tileset) return;
        var ANIM_FPS = 8;
        var frameDur  = 1000 / ANIM_FPS;           // ms per frame
        var now       = elapsed || (Date.now() % 100000);
        var startCol  = Math.max(0, Math.floor(startX / this.tileWidth));
        var startRow2 = Math.max(0, Math.floor(startY / this.tileHeight));
        var endCol    = Math.min(this.width,  Math.ceil((startX + viewW) / this.tileWidth));
        var endRow2   = Math.min(this.height, Math.ceil((startY + viewH) / this.tileHeight));

        for (var l = 0; l < this.layers.length; l++) {
            var layer = this.layers[l];
            if (!layer.visible) continue;

            for (var r = startRow2; r < endRow2; r++) {
                for (var c = startCol; c < endCol; c++) {
                    var tileId = layer.data[r * this.width + c];
                    if (tileId < 64) continue;

                    // Each animated region is 4 frames; base ID is always the first frame.
                    // Snap to the nearest 4-frame block start (e.g. 64, 68, 72, …).
                    // Ping-pong: 0→1→2→3→2→1→0→… (period=6, 2*(4-1)) for smooth loops.
                    var baseId   = tileId - ((tileId - 64) % 4);
                    var cycle    = Math.floor(now / frameDur) % 6;
                    var frameIdx = cycle < 4 ? cycle : 6 - cycle;
                    var drawId   = baseId + frameIdx;

                    this.tileset.drawTile(ctx, drawId,
                        c * this.tileWidth, r * this.tileHeight, 1);
                }
            }
        }
    }
    
    renderFallback(ctx, viewport) {
        var startCol = Math.max(0, Math.floor(viewport.x / this.tileWidth));
        var startRow = Math.max(0, Math.floor(viewport.y / this.tileHeight));
        var endCol = Math.min(this.width, Math.ceil((viewport.x + viewport.viewWidth) / this.tileWidth) + 1);
        var endRow = Math.min(this.height, Math.ceil((viewport.y + viewport.viewHeight) / this.tileHeight) + 1);
        
        var colors = ['#2d5a27', '#3d6a37', '#5a6a7a', '#4682b4'];
        
        for (var row = startRow; row < endRow; row++) {
            for (var col = startCol; col < endCol; col++) {
                var index = row * this.width + col;
                var tileId = index % colors.length;
                ctx.fillStyle = colors[tileId];
                ctx.fillRect(col * this.tileWidth, row * this.tileHeight, this.tileWidth, this.tileHeight);
            }
        }
    }
    
    static createTestMap(tileset, width, height, terrainConfig) {
        width = width || 50;
        height = height || 38;
        terrainConfig = terrainConfig || {};

        var map = new RealmKit.TileMap({
            name: 'test_map',
            tileWidth: tileset.tileWidth,
            tileHeight: tileset.tileHeight,
            width: width,
            height: height
        });

        map.setTileset(tileset);

        console.log('[TileMap] Generating procedural terrain', width + 'x' + height);
        var genConfig = {
            width:          width,
            height:         height,
            seed:           terrainConfig.seed          || (Math.random() * 100000),
            waterLevel:     terrainConfig.waterLevel    || undefined,
            hillLevel:      terrainConfig.hillLevel     || undefined,
            mountainLevel:  terrainConfig.mountainLevel || undefined,
            elevationScale: terrainConfig.elevationScale|| undefined,
            flat:           terrainConfig.flat          || false,
            tileSize:       terrainConfig.tileSize      || tileset.tileWidth || 32
        };
        // Remove undefined keys so TerrainGenerator defaults take over
        Object.keys(genConfig).forEach(function(k) {
            if (genConfig[k] === undefined) delete genConfig[k];
        });
        var terrainData = RealmKit.TerrainGenerator.generateMap(genConfig);
        
        var groundLayer = [];
        for (var i = 0; i < terrainData.ground.length; i++) {
            groundLayer[i] = terrainData.ground[i];
        }
        map.addLayer('ground', groundLayer);

        if (terrainData.grassOverlay) {
            var grassOverlayLayer = [];
            for (var i = 0; i < terrainData.grassOverlay.length; i++) {
                grassOverlayLayer[i] = terrainData.grassOverlay[i];
            }
            map.addLayer('grass_overlay', grassOverlayLayer);
        }

        var objectLayer = [];
        for (var i = 0; i < terrainData.objects.length; i++) {
            objectLayer[i] = terrainData.objects[i] > 0 ? terrainData.objects[i] : -1;
        }
        map.addLayer('objects', objectLayer);
        
        var collisionData = [];
        for (var i = 0; i < terrainData.collision.length; i++) {
            collisionData[i] = terrainData.collision[i];
        }
        map.setCollisionData(collisionData);
        
        map.roadMap       = terrainData.roadMap       || null;
        map.riverMap      = terrainData.riverMap      || null;
        map.elevationMap  = terrainData.elevationMap  || null;
        map.moistureMap   = terrainData.moistureMap   || null;
        map.temperatureMap= terrainData.temperatureMap|| null;
        map.settlements   = terrainData.settlements   || [];
        
        if (terrainData.spawns && terrainData.spawns.length > 0) {
            map.spawns = terrainData.spawns;
            console.log('[TileMap] Added', terrainData.spawns.length, 'spawn points');
        }
        
        var collisionTiles = 0;
        for (var i = 0; i < map.collisionData.length; i++) {
            if (map.collisionData[i] === 1) collisionTiles++;
        }
        
        console.log('[TileMap] Created:', width + 'x' + height, 'tiles,', collisionTiles, 'collision tiles');
        
        return map;
    }
};

console.log('[TileMap] Class loaded');