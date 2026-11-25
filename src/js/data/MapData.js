var RealmKit = RealmKit || {};

RealmKit.MapData = class MapData {
    constructor(config) {
        this.config = config || {};
        
        this.id = this.config.id || 'map_' + Date.now();
        this.name = this.config.name || 'Untitled Map';
        this.version = this.config.version || 1;
        
        this.width = this.config.width || 50;
        this.height = this.config.height || 38;
        this.tileWidth = this.config.tileWidth || 32;
        this.tileHeight = this.config.tileHeight || 32;
        
        this.layers = this.config.layers || [];
        this.collisionLayer = this.config.collisionLayer || null;
        this.entities = this.config.entities || [];
        this.spawns = this.config.spawns || [];
        this.zones = this.config.zones || [];
        
        this.metadata = this.config.metadata || {
            author: '',
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            tags: []
        };
        
        console.log('[MapData] Created:', this.id, this.width + 'x' + this.height);
    }
    
    addLayer(name, data, options) {
        options = options || {};
        
        var layer = {
            name: name,
            data: data,
            visible: options.visible !== false,
            opacity: options.opacity || 1,
            zIndex: options.zIndex || this.layers.length
        };
        
        this.layers.push(layer);
        return layer;
    }
    
    setCollisionLayer(data) {
        if (data.length !== this.width * this.height) {
            console.error('[MapData] Collision layer size mismatch');
            return;
        }
        this.collisionLayer = data;
    }
    
    addEntity(config) {
        var entity = {
            id: config.id || 'entity_' + Date.now(),
            type: config.type || 'npc',
            x: config.x || 0,
            y: config.y || 0,
            template: config.template || null,
            properties: config.properties || {}
        };
        
        this.entities.push(entity);
        return entity;
    }
    
    addSpawn(config) {
        var spawn = {
            id: config.id || 'spawn_' + Date.now(),
            x: config.x || 0,
            y: config.y || 0,
            width: config.width || 32,
            height: config.height || 32,
            type: config.type || 'player',
            properties: config.properties || {}
        };
        
        this.spawns.push(spawn);
        return spawn;
    }
    
    addZone(config) {
        var zone = {
            id: config.id || 'zone_' + Date.now(),
            name: config.name || 'Zone',
            x: config.x || 0,
            y: config.y || 0,
            width: config.width || 100,
            height: config.height || 100,
            type: config.type || 'trigger',
            properties: config.properties || {},
            onEnter: config.onEnter || null,
            onExit: config.onExit || null
        };
        
        this.zones.push(zone);
        return zone;
    }
    
    toJson() {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            version: this.version,
            width: this.width,
            height: this.height,
            tileWidth: this.tileWidth,
            tileHeight: this.tileHeight,
            layers: this.layers,
            collisionLayer: this.collisionLayer,
            entities: this.entities,
            spawns: this.spawns,
            zones: this.zones,
            metadata: this.metadata
        }, null, 2);
    }
    
    static fromJson(json) {
        var data;
        try {
            data = JSON.parse(json);
        } catch (e) {
            console.error('[MapData] Failed to parse JSON:', e);
            return null;
        }
        
        var map = new RealmKit.MapData({
            id: data.id,
            name: data.name,
            version: data.version,
            width: data.width,
            height: data.height,
            tileWidth: data.tileWidth,
            tileHeight: data.tileHeight,
            layers: data.layers,
            collisionLayer: data.collisionLayer,
            entities: data.entities,
            spawns: data.spawns,
            zones: data.zones,
            metadata: data.metadata
        });
        
        return map;
    }
    
    static generateDungeon(config) {
        config = config || {};
        
        var width = config.width || 50;
        var height = config.height || 38;
        var roomCount = config.roomCount || 5;
        var minRoomSize = config.minRoomSize || 5;
        var maxRoomSize = config.maxRoomSize || 10;
        
        var groundLayer = [];
        var collisionLayer = [];
        
        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                groundLayer.push(0);
                collisionLayer.push(1);
            }
        }
        
        var rooms = [];
        
        for (var r = 0; r < roomCount; r++) {
            var roomW = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
            var roomH = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
            var roomX = 1 + Math.floor(Math.random() * (width - roomW - 2));
            var roomY = 1 + Math.floor(Math.random() * (height - roomH - 2));
            
            var overlap = false;
            for (var i = 0; i < rooms.length; i++) {
                var other = rooms[i];
                if (roomX < other.x + other.w + 2 && roomX + roomW + 2 > other.x &&
                    roomY < other.y + other.h + 2 && roomY + roomH + 2 > other.y) {
                    overlap = true;
                    break;
                }
            }
            
            if (!overlap) {
                rooms.push({ x: roomX, y: roomY, w: roomW, h: roomH });
                
                for (var ry = roomY; ry < roomY + roomH; ry++) {
                    for (var rx = roomX; rx < roomX + roomW; rx++) {
                        var idx = ry * width + rx;
                        groundLayer[idx] = 1;
                        collisionLayer[idx] = 0;
                    }
                }
            }
        }
        
        for (var i = 1; i < rooms.length; i++) {
            var r1 = rooms[i - 1];
            var r2 = rooms[i];
            
            var x1 = Math.floor(r1.x + r1.w / 2);
            var y1 = Math.floor(r1.y + r1.h / 2);
            var x2 = Math.floor(r2.x + r2.w / 2);
            var y2 = Math.floor(r2.y + r2.h / 2);
            
            if (Math.random() < 0.5) {
                RealmKit.MapData._carveHCorridor(groundLayer, collisionLayer, width, x1, x2, y1);
                RealmKit.MapData._carveVCorridor(groundLayer, collisionLayer, width, y1, y2, x2);
            } else {
                RealmKit.MapData._carveVCorridor(groundLayer, collisionLayer, width, y1, y2, x1);
                RealmKit.MapData._carveHCorridor(groundLayer, collisionLayer, width, x1, x2, y2);
            }
        }
        
        var map = new RealmKit.MapData({
            id: config.id || 'dungeon_' + Date.now(),
            name: config.name || 'Generated Dungeon',
            width: width,
            height: height
        });
        
        map.addLayer('ground', groundLayer);
        map.setCollisionLayer(collisionLayer);
        
        if (rooms.length > 0) {
            var firstRoom = rooms[0];
            var lastRoom = rooms[rooms.length - 1];
            
            map.addSpawn({
                id: 'player_start',
                x: (firstRoom.x + Math.floor(firstRoom.w / 2)) * map.tileWidth,
                y: (firstRoom.y + Math.floor(firstRoom.h / 2)) * map.tileHeight,
                type: 'player'
            });
            
            map.addSpawn({
                id: 'enemy_spawn',
                x: (lastRoom.x + Math.floor(lastRoom.w / 2)) * map.tileWidth,
                y: (lastRoom.y + Math.floor(lastRoom.h / 2)) * map.tileHeight,
                type: 'enemy',
                properties: { enemyType: 'goblin' }
            });
        }
        
        console.log('[MapData] Generated dungeon:', rooms.length, 'rooms');
        return map;
    }
    
    static _carveHCorridor(ground, collision, width, x1, x2, y) {
        var start = Math.min(x1, x2);
        var end = Math.max(x1, x2);
        
        for (var x = start; x <= end; x++) {
            var idx = y * width + x;
            ground[idx] = 1;
            collision[idx] = 0;
        }
    }
    
    static _carveVCorridor(ground, collision, width, y1, y2, x) {
        var start = Math.min(y1, y2);
        var end = Math.max(y1, y2);
        
        for (var y = start; y <= end; y++) {
            var idx = y * width + x;
            ground[idx] = 1;
            collision[idx] = 0;
        }
    }
    
    static generateOpenWorld(config) {
        config = config || {};
        
        var width = config.width || 100;
        var height = config.height || 100;
        var treeDensity = config.treeDensity || 0.05;
        var waterDensity = config.waterDensity || 0.02;
        
        var groundLayer = [];
        var collisionLayer = [];
        
        var seed = config.seed || Math.random() * 10000;
        var noise = RealmKit.MapData._noise2D(seed);
        
        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var idx = y * width + x;
                
                var elevation = noise(x * 0.05, y * 0.05);
                var moisture = noise(x * 0.03 + 500, y * 0.03 + 500);
                
                var isEdge = x < 2 || x >= width - 2 || y < 2 || y >= height - 2;
                
                if (isEdge) {
                    groundLayer[idx] = 3;
                    collisionLayer[idx] = 1;
                } else if (elevation < 0.3) {
                    groundLayer[idx] = 2;
                    collisionLayer[idx] = 1;
                } else if (elevation > 0.75) {
                    groundLayer[idx] = 3;
                    collisionLayer[idx] = 1;
                } else if (moisture > 0.7) {
                    groundLayer[idx] = 2;
                    collisionLayer[idx] = Math.random() < 0.3 ? 1 : 0;
                } else if (Math.random() < treeDensity) {
                    groundLayer[idx] = 3;
                    collisionLayer[idx] = 1;
                } else {
                    groundLayer[idx] = Math.floor(Math.random() * 2);
                    collisionLayer[idx] = 0;
                }
            }
        }
        
        var centerX = Math.floor(width / 2);
        var centerY = Math.floor(height / 2);
        
        for (var dy = -2; dy <= 2; dy++) {
            for (var dx = -2; dx <= 2; dx++) {
                var idx = (centerY + dy) * width + (centerX + dx);
                groundLayer[idx] = 1;
                collisionLayer[idx] = 0;
            }
        }
        
        var map = new RealmKit.MapData({
            id: config.id || 'openworld_' + Date.now(),
            name: config.name || 'Generated World',
            width: width,
            height: height
        });
        
        map.addLayer('ground', groundLayer);
        map.setCollisionLayer(collisionLayer);
        
        map.addSpawn({
            id: 'player_start',
            x: centerX * map.tileWidth,
            y: centerY * map.tileHeight,
            type: 'player'
        });
        
        console.log('[MapData] Generated open world:', width + 'x' + height);
        return map;
    }
    
    static _noise2D(seed) {
        return function(x, y) {
            var n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
            return n - Math.floor(n);
        };
    }
};

console.log('[MapData] Class loaded');