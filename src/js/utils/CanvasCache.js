var RealmKit = RealmKit || {};

RealmKit.CanvasCache = class CanvasCache {
    constructor(config) {
        config = config || {};
        
        this.caches = {};
        this.chunkSize = config.chunkSize || 512;
        this.maxCaches = config.maxCaches || 50;
        this.debug = config.debug || false;
        
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        console.log('[CanvasCache] Initialized', {
            chunkSize: this.chunkSize,
            maxCaches: this.maxCaches
        });
    }
    
    createCanvas(width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    
    getCache(key) {
        if (this.caches[key]) {
            this.cacheHits++;
            this.caches[key].lastUsed = Date.now();
            return this.caches[key].canvas;
        }
        this.cacheMisses++;
        return null;
    }
    
    setCache(key, canvas, metadata) {
        metadata = metadata || {};
        
        if (Object.keys(this.caches).length >= this.maxCaches) {
            this.evictOldest();
        }
        
        this.caches[key] = {
            canvas: canvas,
            lastUsed: Date.now(),
            created: Date.now(),
            width: canvas.width,
            height: canvas.height,
            metadata: metadata
        };
        
        if (this.debug) {
            console.log('[CanvasCache] Cached:', key, canvas.width + 'x' + canvas.height);
        }
        
        return canvas;
    }
    
    evictOldest() {
        var oldestKey = null;
        var oldestTime = Infinity;
        
        for (var key in this.caches) {
            if (this.caches[key].lastUsed < oldestTime) {
                oldestTime = this.caches[key].lastUsed;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            delete this.caches[oldestKey];
            if (this.debug) {
                console.log('[CanvasCache] Evicted:', oldestKey);
            }
        }
    }
    
    has(key) {
        return !!this.caches[key];
    }
    
    remove(key) {
        if (this.caches[key]) {
            delete this.caches[key];
            return true;
        }
        return false;
    }
    
    clear() {
        this.caches = {};
        this.cacheHits = 0;
        this.cacheMisses = 0;
        console.log('[CanvasCache] Cache cleared');
    }
    
    getStats() {
        return {
            cacheCount: Object.keys(this.caches).length,
            maxCaches: this.maxCaches,
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: this.cacheMisses > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)).toFixed(2) : '1.00'
        };
    }
    
    createGridCache(gridSize, viewportWidth, viewportHeight, color, lineWidth) {
        var key = 'grid_' + gridSize + '_' + viewportWidth + 'x' + viewportHeight + '_' + (color || '').replace(/[^a-z0-9]/gi, '');
        
        var cached = this.getCache(key);
        if (cached) return cached;
        
        var canvas = this.createCanvas(viewportWidth + gridSize * 2, viewportHeight + gridSize * 2);
        var ctx = canvas.getContext('2d');
        
        ctx.strokeStyle = color || 'rgba(255,255,255,0.15)';
        ctx.lineWidth = lineWidth || 0.5;
        
        ctx.beginPath();
        for (var x = 0; x <= canvas.width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }
        for (var y = 0; y <= canvas.height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();
        
        return this.setCache(key, canvas, { type: 'grid', gridSize: gridSize });
    }
    
    createPatternCache(patternType, width, height, config) {
        config = config || {};
        var key = 'pattern_' + patternType + '_' + width + 'x' + height;
        
        var cached = this.getCache(key);
        if (cached) return cached;
        
        var canvas = this.createCanvas(width, height);
        var ctx = canvas.getContext('2d');
        
        if (patternType === 'checker') {
            var size = config.size || 32;
            var color1 = config.color1 || '#ffffff';
            var color2 = config.color2 || '#cccccc';
            var alpha = config.alpha || 0.5;
            
            ctx.globalAlpha = alpha;
            for (var y = 0; y < height; y += size) {
                for (var x = 0; x < width; x += size) {
                    ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? color1 : color2;
                    ctx.fillRect(x, y, size, size);
                }
            }
        } else if (patternType === 'noise') {
            var imageData = ctx.createImageData(width, height);
            var density = config.density || 0.02;
            var color = config.color || [0, 0, 0];
            
            for (var i = 0; i < imageData.data.length; i += 4) {
                if (Math.random() < density) {
                    imageData.data[i] = color[0];
                    imageData.data[i + 1] = color[1];
                    imageData.data[i + 2] = color[2];
                    imageData.data[i + 3] = Math.random() * 50 + 20;
                }
            }
            ctx.putImageData(imageData, 0, 0);
        } else if (patternType === 'gradient') {
            var gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, config.startColor || 'rgba(0,0,0,0)');
            gradient.addColorStop(1, config.endColor || 'rgba(0,0,0,0.3)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }
        
        return this.setCache(key, canvas, { type: 'pattern', patternType: patternType });
    }
    
    renderGrid(ctx, viewport, gridSize, color) {
        gridSize = gridSize || 32;
        color = color || 'rgba(255,255,255,0.15)';
        
        var cacheKey = 'grid_' + gridSize + '_' + viewport.viewWidth + 'x' + viewport.viewHeight;
        var cached = this.getCache(cacheKey);
        
        if (!cached) {
            cached = this.createGridCache(gridSize, viewport.viewWidth, viewport.viewHeight, color, 0.5);
        }
        
        var startX = Math.floor(viewport.x / gridSize) * gridSize;
        var startY = Math.floor(viewport.y / gridSize) * gridSize;
        
        var offsetX = (startX - viewport.x) % gridSize;
        var offsetY = (startY - viewport.y) % gridSize;
        
        ctx.drawImage(cached, offsetX - gridSize, offsetY - gridSize);
    }
    
    createUISpriteCache(key, drawFunc, width, height) {
        var cached = this.getCache(key);
        if (cached) return cached;
        
        var canvas = this.createCanvas(width, height);
        var ctx = canvas.getContext('2d');
        
        drawFunc(ctx, width, height);
        
        return this.setCache(key, canvas, { type: 'uiSprite' });
    }
    
    createTileChunk(tileset, tileIds, tilesPerRow, tileSize) {
        var rowCount = Math.ceil(tileIds.length / tilesPerRow);
        var key = 'chunk_' + tileset.name + '_' + tileIds.length + '_' + tileSize;
        
        var cached = this.getCache(key);
        if (cached) return cached;
        
        var canvas = this.createCanvas(tilesPerRow * tileSize, rowCount * tileSize);
        var ctx = canvas.getContext('2d');
        
        for (var i = 0; i < tileIds.length; i++) {
            var col = i % tilesPerRow;
            var row = Math.floor(i / tilesPerRow);
            tileset.drawTile(ctx, tileIds[i], col * tileSize, row * tileSize, 1);
        }
        
        return this.setCache(key, canvas, { type: 'tileChunk', tileCount: tileIds.length });
    }
    
    preloadTileset(tileset, callback) {
        var self = this;
        
        if (!tileset || !tileset.tiles || tileset.tiles.length === 0) {
            console.warn('[CanvasCache] Cannot preload: invalid tileset');
            if (callback) callback(false);
            return;
        }
        
        var tileIds = [];
        for (var id in tileset.tiles) {
            tileIds.push(parseInt(id, 10));
        }
        
        if (tileIds.length === 0) {
            if (callback) callback(true);
            return;
        }
        
        var chunkCanvas = this.createTileChunk(tileset, tileIds, 16, tileset.tileWidth);
        
        if (this.debug) {
            console.log('[CanvasCache] Preloaded tileset:', tileset.name, tileIds.length, 'tiles');
        }
        
        if (callback) callback(true);
    }
    
    prune(maxAge) {
        maxAge = maxAge || 60000;
        var now = Date.now();
        var pruned = 0;
        
        for (var key in this.caches) {
            if (now - this.caches[key].lastUsed > maxAge) {
                delete this.caches[key];
                pruned++;
            }
        }
        
        if (pruned > 0 && this.debug) {
            console.log('[CanvasCache] Pruned', pruned, 'stale caches');
        }
        
        return pruned;
    }
};

console.log('[CanvasCache] Class loaded');