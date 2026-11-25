var RealmKit = RealmKit || {};

RealmKit.PathRequestManager = class PathRequestManager {
    constructor(config) {
        config = config || {};
        
        this.pathfinding = null;
        this.pendingRequests = [];
        this.completedPaths = {};
        this.maxPathsPerFrame = config.maxPathsPerFrame || 3;
        this.pathCacheSize = config.pathCacheSize || 100;
        this.cacheExpiryTime = config.cacheExpiryTime || 5000;
        
        this.debug = config.debug || false;
        this.showPaths = false;
        this.pathColors = {
            active: '#00ff00',
            pending: '#ffff00',
            cached: '#00ffff'
        };
        
        console.log('[PathRequestManager] Initialized, maxPathsPerFrame:', this.maxPathsPerFrame);
    }
    
    setPathfinding(pathfinding) {
        this.pathfinding = pathfinding;
        console.log('[PathRequestManager] Pathfinding set');
    }
    
    setTileMap(tileMap) {
        if (this.pathfinding) {
            this.pathfinding.tileMap = tileMap;
            this.pathfinding.buildGrid();
        }
    }
    
    requestPath(entityId, startX, startY, endX, endY, callback, priority) {
        priority = priority || 0;
        
        var cacheKey = this._getCacheKey(startX, startY, endX, endY);
        
        if (this.completedPaths[cacheKey]) {
            var cached = this.completedPaths[cacheKey];
            if (Date.now() - cached.timestamp < this.cacheExpiryTime) {
                if (callback) callback(cached.path, true);
                if (this.debug) console.log('[PathRequestManager] Cache hit for', cacheKey);
                return;
            } else {
                delete this.completedPaths[cacheKey];
            }
        }
        
        for (var i = 0; i < this.pendingRequests.length; i++) {
            if (this.pendingRequests[i].entityId === entityId) {
                this.pendingRequests[i].startX = startX;
                this.pendingRequests[i].startY = startY;
                this.pendingRequests[i].endX = endX;
                this.pendingRequests[i].endY = endY;
                this.pendingRequests[i].callback = callback;
                this.pendingRequests[i].priority = priority;
                return;
            }
        }
        
        this.pendingRequests.push({
            entityId: entityId,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            callback: callback,
            priority: priority,
            timestamp: Date.now()
        });
        
        this.pendingRequests.sort(function(a, b) {
            return b.priority - a.priority;
        });
    }
    
    cancelRequest(entityId) {
        for (var i = this.pendingRequests.length - 1; i >= 0; i--) {
            if (this.pendingRequests[i].entityId === entityId) {
                this.pendingRequests.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    
    update(deltaTime) {
        if (!this.pathfinding) return;
        
        var processed = 0;
        
        while (this.pendingRequests.length > 0 && processed < this.maxPathsPerFrame) {
            var request = this.pendingRequests.shift();
            
            var path = this.pathfinding.findPath(
                request.startX, request.startY,
                request.endX, request.endY
            );
            
            var cacheKey = this._getCacheKey(request.startX, request.startY, request.endX, request.endY);
            this.completedPaths[cacheKey] = {
                path: path,
                timestamp: Date.now()
            };
            
            if (Object.keys(this.completedPaths).length > this.pathCacheSize) {
                this._pruneCache();
            }
            
            if (request.callback) {
                request.callback(path, false);
            }
            
            processed++;
        }
    }
    
    _getCacheKey(x1, y1, x2, y2) {
        var tileSize = this.pathfinding && this.pathfinding.tileMap ? 
            this.pathfinding.tileMap.tileWidth : 32;
        var tx1 = Math.floor(x1 / tileSize);
        var ty1 = Math.floor(y1 / tileSize);
        var tx2 = Math.floor(x2 / tileSize);
        var ty2 = Math.floor(y2 / tileSize);
        return tx1 + ',' + ty1 + '->' + tx2 + ',' + ty2;
    }
    
    _pruneCache() {
        var keys = Object.keys(this.completedPaths);
        var now = Date.now();
        
        for (var i = 0; i < keys.length; i++) {
            if (now - this.completedPaths[keys[i]].timestamp > this.cacheExpiryTime) {
                delete this.completedPaths[keys[i]];
            }
        }
        
        if (Object.keys(this.completedPaths).length > this.pathCacheSize) {
            var oldest = null;
            var oldestKey = null;
            for (var key in this.completedPaths) {
                if (!oldest || this.completedPaths[key].timestamp < oldest) {
                    oldest = this.completedPaths[key].timestamp;
                    oldestKey = key;
                }
            }
            if (oldestKey) {
                delete this.completedPaths[oldestKey];
            }
        }
    }
    
    clearCache() {
        this.completedPaths = {};
    }
    
    getStats() {
        return {
            pending: this.pendingRequests.length,
            cached: Object.keys(this.completedPaths).length,
            maxPerFrame: this.maxPathsPerFrame
        };
    }
    
    toggleDebug() {
        this.debug = !this.debug;
        this.showPaths = this.debug;
        console.log('[PathRequestManager] Debug:', this.debug);
    }
    
    renderDebug(ctx, viewport) {
        if (!this.showPaths || !this.pathfinding) return;
        
        ctx.save();
        ctx.strokeStyle = this.pathColors.cached;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        
        for (var key in this.completedPaths) {
            var pathData = this.completedPaths[key];
            var path = pathData.path;
            
            if (path.length < 2) continue;
            
            ctx.beginPath();
            ctx.moveTo(path[0].x - viewport.x, path[0].y - viewport.y);
            
            for (var i = 1; i < path.length; i++) {
                ctx.lineTo(path[i].x - viewport.x, path[i].y - viewport.y);
            }
            
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    renderEntityPath(ctx, viewport, path, color) {
        if (!path || path.length < 2) return;
        
        ctx.save();
        ctx.strokeStyle = color || this.pathColors.active;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        
        ctx.beginPath();
        ctx.moveTo(path[0].x - viewport.x, path[0].y - viewport.y);
        
        for (var i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x - viewport.x, path[i].y - viewport.y);
        }
        
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.fillStyle = color || this.pathColors.active;
        
        for (var j = 0; j < path.length; j++) {
            ctx.beginPath();
            ctx.arc(path[j].x - viewport.x, path[j].y - viewport.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
};

console.log('[PathRequestManager] Module loaded');