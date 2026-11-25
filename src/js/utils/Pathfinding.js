var RealmKit = RealmKit || {};

RealmKit.Pathfinding = class Pathfinding {
    constructor(tileMap) {
        this.tileMap = tileMap;
        this.grid = null;
        this.gridWidth = 0;
        this.gridHeight = 0;
        
        console.log('[Pathfinding] Initialized');
    }
    
    buildGrid() {
        if (!this.tileMap) return;
        
        this.gridWidth = this.tileMap.width;
        this.gridHeight = this.tileMap.height;
        this.grid = [];
        
        for (var y = 0; y < this.gridHeight; y++) {
            this.grid[y] = [];
            for (var x = 0; x < this.gridWidth; x++) {
                var idx = y * this.gridWidth + x;
                var walkable = !this.tileMap.collisionData || !this.tileMap.collisionData[idx];
                this.grid[y][x] = walkable ? 0 : 1;
            }
        }
        
        console.log('[Pathfinding] Grid built', this.gridWidth, 'x', this.gridHeight);
    }
    
    isWalkable(x, y) {
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return false;
        return this.grid && this.grid[y] && this.grid[y][x] === 0;
    }
    
    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
    
    getNeighbors(node) {
        var neighbors = [];
        var dirs = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 }
        ];
        
        for (var i = 0; i < dirs.length; i++) {
            var nx = node.x + dirs[i].x;
            var ny = node.y + dirs[i].y;
            
            if (this.isWalkable(nx, ny)) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        
        return neighbors;
    }
    
    findPath(startX, startY, endX, endY) {
        if (!this.grid) this.buildGrid();
        
        var startTileX = Math.floor(startX / (this.tileMap ? this.tileMap.tileWidth : 32));
        var startTileY = Math.floor(startY / (this.tileMap ? this.tileMap.tileHeight : 32));
        var endTileX = Math.floor(endX / (this.tileMap ? this.tileMap.tileWidth : 32));
        var endTileY = Math.floor(endY / (this.tileMap ? this.tileMap.tileHeight : 32));
        
        if (!this.isWalkable(startTileX, startTileY) || !this.isWalkable(endTileX, endTileY)) {
            return [];
        }
        
        var openList = [];
        var closedList = {};
        var cameFrom = {};
        var gScore = {};
        var fScore = {};
        
        var startKey = startTileX + ',' + startTileY;
        var endKey = endTileX + ',' + endTileY;
        
        gScore[startKey] = 0;
        fScore[startKey] = this.heuristic({ x: startTileX, y: startTileY }, { x: endTileX, y: endTileY });
        
        openList.push({ x: startTileX, y: startTileY, f: fScore[startKey] });
        
        var maxIterations = 1000;
        var iterations = 0;
        
        while (openList.length > 0 && iterations < maxIterations) {
            iterations++;
            
            openList.sort(function(a, b) { return a.f - b.f; });
            var current = openList.shift();
            var currentKey = current.x + ',' + current.y;
            
            if (current.x === endTileX && current.y === endTileY) {
                return this.reconstructPath(cameFrom, current, startX, startY);
            }
            
            closedList[currentKey] = true;
            
            var neighbors = this.getNeighbors(current);
            
            for (var i = 0; i < neighbors.length; i++) {
                var neighbor = neighbors[i];
                var neighborKey = neighbor.x + ',' + neighbor.y;
                
                if (closedList[neighborKey]) continue;
                
                var tentativeG = (gScore[currentKey] || Infinity) + 1;
                
                var inOpenList = openList.some(function(n) { return n.x === neighbor.x && n.y === neighbor.y; });
                
                if (!inOpenList) {
                    openList.push(neighbor);
                } else if (tentativeG >= (gScore[neighborKey] || Infinity)) {
                    continue;
                }
                
                cameFrom[neighborKey] = current;
                gScore[neighborKey] = tentativeG;
                fScore[neighborKey] = tentativeG + this.heuristic(neighbor, { x: endTileX, y: endTileY });
                
                for (var j = 0; j < openList.length; j++) {
                    if (openList[j].x === neighbor.x && openList[j].y === neighbor.y) {
                        openList[j].f = fScore[neighborKey];
                        break;
                    }
                }
            }
        }
        
        return [];
    }
    
    reconstructPath(cameFrom, current, startX, startY) {
        var path = [];
        var currentKey = current.x + ',' + current.y;
        
        var tileWidth = this.tileMap ? this.tileMap.tileWidth : 32;
        var tileHeight = this.tileMap ? this.tileMap.tileHeight : 32;
        
        path.unshift({
            x: current.x * tileWidth + tileWidth / 2,
            y: current.y * tileHeight + tileHeight / 2
        });
        
        while (cameFrom[currentKey]) {
            current = cameFrom[currentKey];
            currentKey = current.x + ',' + current.y;
            path.unshift({
                x: current.x * tileWidth + tileWidth / 2,
                y: current.y * tileHeight + tileHeight / 2
            });
        }
        
        if (path.length > 0) {
            path[0].x = startX;
            path[0].y = startY;
        }
        
        return path;
    }
    
    getNextWaypoint(entity, targetX, targetY) {
        var path = this.findPath(entity.x, entity.y, targetX, targetY);
        if (path.length > 1) {
            return path[1];
        }
        return path.length > 0 ? path[0] : null;
    }
    
    hasLineOfSight(x1, y1, x2, y2) {
        var tileWidth = this.tileMap ? this.tileMap.tileWidth : 32;
        var tileHeight = this.tileMap ? this.tileMap.tileHeight : 32;
        
        var startX = Math.floor(x1 / tileWidth);
        var startY = Math.floor(y1 / tileHeight);
        var endX = Math.floor(x2 / tileWidth);
        var endY = Math.floor(y2 / tileHeight);
        
        var dx = Math.abs(endX - startX);
        var dy = Math.abs(endY - startY);
        var sx = startX < endX ? 1 : -1;
        var sy = startY < endY ? 1 : -1;
        var err = dx - dy;
        
        var iterations = 0;
        var maxIterations = 200;
        
        while (iterations < maxIterations) {
            iterations++;
            
            if (!this.isWalkable(startX, startY)) return false;
            if (startX === endX && startY === endY) return true;
            
            var e2 = 2 * err;
            if (e2 > -dy) { err -= dy; startX += sx; }
            if (e2 < dx) { err += dx; startY += sy; }
        }
        
        return false;
    }
};

console.log('[Pathfinding] Class loaded');