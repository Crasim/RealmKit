var RealmKit = RealmKit || {};

RealmKit.MonsterSpawner = class MonsterSpawner {
    constructor(config) {
        config = config || {};
        
        this.id = config.id || 'spawner_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.name = config.name || 'Monster Spawner';
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.radius = config.radius || 100;
        
        this.spawnPool = config.spawnPool || [];
        this.totalWeight = 0;
        this._calculateTotalWeight();
        
        this.maxActive = config.maxActive || 5;
        this.minActive = config.minActive || 1;
        this.respawnDelay = config.respawnDelay || 30000;
        this.spawnDelay = config.spawnDelay || 2000;
        this.initialSpawnDelay = config.initialSpawnDelay || 5000;
        
        this.spawnConditions = config.spawnConditions || null;
        this.spawnOnStart = config.spawnOnStart !== false;
        this.active = config.active !== false;
        this.oneTime = config.oneTime || false;
        
        this.activeEntities = [];
        this.deadQueue = [];
        this.spawnQueue = [];
        this.lastSpawnTime = 0;
        this.totalSpawned = 0;
        this.totalKilled = 0;
        
        this.patrolPath = config.patrolPath || null;
        this.spawnArea = config.spawnArea || null;
        this.triggerId = config.triggerId || null;
        
        this.templateManager = null;
        
        console.log('[MonsterSpawner] Created:', this.id, 'at', this.x, ',', this.y, 'pool:', this.spawnPool.length, 'types');
    }
    
    _calculateTotalWeight() {
        this.totalWeight = 0;
        for (var i = 0; i < this.spawnPool.length; i++) {
            this.totalWeight += this.spawnPool[i].weight || 1;
        }
    }
    
    setTemplateManager(manager) {
        this.templateManager = manager;
        console.log('[MonsterSpawner]', this.id, 'template manager set');
    }
    
    addToSpawnPool(templateId, weight, overrides) {
        this.spawnPool.push({
            templateId: templateId,
            weight: weight || 1,
            overrides: overrides || null
        });
        this._calculateTotalWeight();
        console.log('[MonsterSpawner]', this.id, 'added to pool:', templateId, 'weight:', weight);
    }
    
    removeFromSpawnPool(templateId) {
        for (var i = this.spawnPool.length - 1; i >= 0; i--) {
            if (this.spawnPool[i].templateId === templateId) {
                this.spawnPool.splice(i, 1);
            }
        }
        this._calculateTotalWeight();
    }
    
    clearSpawnPool() {
        this.spawnPool = [];
        this.totalWeight = 0;
    }
    
    pickRandomTemplate() {
        if (this.spawnPool.length === 0) {
            console.warn('[MonsterSpawner]', this.id, 'empty spawn pool');
            return null;
        }
        
        var roll = Math.random() * this.totalWeight;
        var cumulative = 0;
        
        for (var i = 0; i < this.spawnPool.length; i++) {
            cumulative += this.spawnPool[i].weight;
            if (roll < cumulative) {
                return this.spawnPool[i];
            }
        }
        
        return this.spawnPool[0];
    }
    
    getSpawnPosition() {
        if (this.spawnArea && this.spawnArea.points && this.spawnArea.points.length >= 3) {
            return this._getPointInPolygon(this.spawnArea.points);
        }
        
        var angle = Math.random() * Math.PI * 2;
        var dist = Math.random() * this.radius;
        return {
            x: this.x + Math.cos(angle) * dist,
            y: this.y + Math.sin(angle) * dist
        };
    }
    
    _getPointInPolygon(points) {
        var minX = Infinity, maxX = -Infinity;
        var minY = Infinity, maxY = -Infinity;
        
        for (var i = 0; i < points.length; i++) {
            minX = Math.min(minX, points[i].x);
            maxX = Math.max(maxX, points[i].x);
            minY = Math.min(minY, points[i].y);
            maxY = Math.max(maxY, points[i].y);
        }
        
        var attempts = 100;
        while (attempts > 0) {
            var x = minX + Math.random() * (maxX - minX);
            var y = minY + Math.random() * (maxY - minY);
            
            if (this._pointInPolygon(x, y, points)) {
                return { x: x, y: y };
            }
            attempts--;
        }
        
        return { x: this.x, y: this.y };
    }
    
    _pointInPolygon(x, y, points) {
        var inside = false;
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
            var xi = points[i].x, yi = points[i].y;
            var xj = points[j].x, yj = points[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }
    
    canSpawn(entityManager) {
        if (!this.active) return false;
        if (this.oneTime && this.totalSpawned > 0 && this.activeEntities.length === 0) return false;
        
        if (this.spawnConditions) {
            if (this.spawnConditions.timeOfDay && entityManager) {
                var currentTime = entityManager.timeOfDay || 
                    (entityManager.engine && entityManager.engine.timeOfDay) || 
                    'day';
                var validTimes = this.spawnConditions.timeOfDay;
                
                if (validTimes.indexOf(currentTime) === -1) {
                    console.log('[MonsterSpawner]', this.id, 'blocked: timeOfDay', currentTime, 'not in', validTimes);
                    return false;
                }
            }
            
            if (this.spawnConditions.terrain && entityManager) {
                var currentTerrain = entityManager.terrain || 
                    (entityManager.engine && entityManager.engine.currentTerrain);
                if (currentTerrain && this.spawnConditions.terrain.indexOf(currentTerrain) === -1) {
                    return false;
                }
            }
            
            if (this.spawnConditions.locationId) {
                var engine = entityManager && entityManager.engine;
                if (!engine || !engine.locationSystem) {
                    return false;
                }
                var locationValid = engine.locationSystem.checkLocationRequirement(
                    this.x, this.y, this.spawnConditions.locationId
                );
                if (!locationValid) {
                    console.log('[MonsterSpawner]', this.id, 'blocked: locationId', this.spawnConditions.locationId, 'not valid at', this.x, this.y);
                    return false;
                }
            }
        }
        
        return this.activeEntities.length < this.maxActive;
    }
    
    spawn(entityManager, templateManager) {
        if (!this.canSpawn(entityManager)) {
            return null;
        }
        
        var tm = templateManager || this.templateManager;
        if (!tm) {
            tm = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
        }
        
        var poolEntry = this.pickRandomTemplate();
        if (!poolEntry) return null;
        
        var monsterData = tm.createEntity(poolEntry.templateId, poolEntry.overrides);
        if (!monsterData) {
            console.error('[MonsterSpawner] Failed to create entity from template:', poolEntry.templateId);
            return null;
        }
        
        var pos = this.getSpawnPosition();
        monsterData.x = pos.x;
        monsterData.y = pos.y;
        monsterData.homeX = pos.x;
        monsterData.homeY = pos.y;
        monsterData.spawnerId = this.id;
        
        if (this.patrolPath) {
            monsterData.patrolPath = this.patrolPath;
            monsterData.patrolIndex = 0;
            monsterData.behavior = 'patrol';
        }
        
        var entity = null;
        if (RealmKit.NPC) {
            entity = new RealmKit.NPC(monsterData);
            entity.spawnerId = this.id;
            entityManager.add(entity);
        }
        
        if (entity) {
            this.activeEntities.push({
                id: entity.id,
                entity: entity,
                spawnedAt: Date.now(),
                templateId: poolEntry.templateId
            });
            this.totalSpawned++;
            this.lastSpawnTime = Date.now();
            
            console.log('[MonsterSpawner]', this.id, 'spawned:', entity.id, 'template:', poolEntry.templateId, 'active:', this.activeEntities.length + '/' + this.maxActive);
        }
        
        return entity;
    }
    
    initialSpawn(entityManager, templateManager) {
        if (!this.spawnOnStart) return;
        
        var self = this;
        setTimeout(function() {
            for (var i = 0; i < self.minActive; i++) {
                self.spawn(entityManager, templateManager);
            }
            console.log('[MonsterSpawner]', self.id, 'initial spawn complete');
        }, this.initialSpawnDelay);
    }
    
    update(deltaTime, entityManager, templateManager) {
        if (!this.active) return;
        
        var now = Date.now();
        
        for (var i = this.activeEntities.length - 1; i >= 0; i--) {
            var entry = this.activeEntities[i];
            var entity = entry.entity;
            
            if (!entity || entity.dead || entity.hp <= 0) {
                this.deadQueue.push({
                    id: entry.id,
                    templateId: entry.templateId,
                    diedAt: now
                });
                this.activeEntities.splice(i, 1);
                this.totalKilled++;
                
                console.log('[MonsterSpawner]', this.id, 'entity died:', entry.id, 'killed:', this.totalKilled);
            }
        }
        
        for (var j = this.deadQueue.length - 1; j >= 0; j--) {
            var dead = this.deadQueue[j];
            if (now - dead.diedAt >= this.respawnDelay) {
                if (this.canSpawn(entityManager)) {
                    this.spawnQueue.push(dead);
                }
                this.deadQueue.splice(j, 1);
            }
        }
        
        while (this.spawnQueue.length > 0 && this.canSpawn(entityManager)) {
            var toSpawn = this.spawnQueue.shift();
            this.spawn(entityManager, templateManager);
        }
        
        if (this.activeEntities.length < this.minActive && this.canSpawn(entityManager)) {
            if (now - this.lastSpawnTime >= this.spawnDelay) {
                this.spawn(entityManager, templateManager);
            }
        }
    }
    
    getStats() {
        return {
            id: this.id,
            name: this.name,
            active: this.activeEntities.length,
            maxActive: this.maxActive,
            minActive: this.minActive,
            deadQueue: this.deadQueue.length,
            totalSpawned: this.totalSpawned,
            totalKilled: this.totalKilled,
            spawnPool: this.spawnPool.length
        };
    }
    
    setPatrolPath(path) {
        this.patrolPath = path;
        console.log('[MonsterSpawner]', this.id, 'patrol path set:', path.length, 'waypoints');
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            radius: this.radius,
            spawnPool: this.spawnPool,
            maxActive: this.maxActive,
            minActive: this.minActive,
            respawnDelay: this.respawnDelay,
            spawnDelay: this.spawnDelay,
            spawnOnStart: this.spawnOnStart,
            active: this.active,
            oneTime: this.oneTime,
            patrolPath: this.patrolPath,
            spawnArea: this.spawnArea,
            spawnConditions: this.spawnConditions,
            triggerId: this.triggerId
        };
    }
    
    static fromJSON(data) {
        var spawner = new RealmKit.MonsterSpawner(data);
        return spawner;
    }
};

RealmKit.SpawnerManager = class SpawnerManager {
    constructor(config) {
        config = config || {};
        
        this.spawners = [];
        this.templateManager = config.templateManager || new RealmKit.MonsterTemplateManager();
        this.entityManager = null;
        
        this.globalPause = false;
        this.spawnMultiplier = config.spawnMultiplier || 1;
        this.respawnMultiplier = config.respawnMultiplier || 1;
        
        if (!RealmKit.monsterTemplateManager) {
            RealmKit.monsterTemplateManager = this.templateManager;
        }
        
        console.log('[SpawnerManager] Initialized');
    }
    
    setEntityManager(manager) {
        this.entityManager = manager;
        console.log('[SpawnerManager] Entity manager set');
    }
    
    createSpawner(config) {
        var spawner = new RealmKit.MonsterSpawner(config);
        spawner.setTemplateManager(this.templateManager);
        this.spawners.push(spawner);
        console.log('[SpawnerManager] Created spawner:', spawner.id);
        return spawner;
    }
    
    removeSpawner(spawnerId) {
        for (var i = 0; i < this.spawners.length; i++) {
            if (this.spawners[i].id === spawnerId) {
                this.spawners.splice(i, 1);
                console.log('[SpawnerManager] Removed spawner:', spawnerId);
                return true;
            }
        }
        return false;
    }
    
    getSpawner(spawnerId) {
        for (var i = 0; i < this.spawners.length; i++) {
            if (this.spawners[i].id === spawnerId) {
                return this.spawners[i];
            }
        }
        return null;
    }
    
    getAllSpawners() {
        return this.spawners.slice();
    }
    
    initialSpawn() {
        for (var i = 0; i < this.spawners.length; i++) {
            this.spawners[i].initialSpawn(this.entityManager, this.templateManager);
        }
        console.log('[SpawnerManager] Initial spawn triggered for', this.spawners.length, 'spawners');
    }
    
    update(deltaTime) {
        if (this.globalPause) return;
        
        for (var i = 0; i < this.spawners.length; i++) {
            var respawnDelay = this.spawners[i].respawnDelay * this.respawnMultiplier;
            this.spawners[i].respawnDelay = respawnDelay;
            this.spawners[i].update(deltaTime, this.entityManager, this.templateManager);
        }
    }
    
    pauseAll() {
        this.globalPause = true;
        console.log('[SpawnerManager] All spawners paused');
    }
    
    resumeAll() {
        this.globalPause = false;
        console.log('[SpawnerManager] All spawners resumed');
    }
    
    setSpawnMultiplier(mult) {
        this.spawnMultiplier = mult;
        console.log('[SpawnerManager] Spawn multiplier set to:', mult);
    }
    
    setRespawnMultiplier(mult) {
        this.respawnMultiplier = mult;
        console.log('[SpawnerManager] Respawn multiplier set to:', mult);
    }
    
    getStats() {
        var stats = {
            totalSpawners: this.spawners.length,
            totalActive: 0,
            totalSpawned: 0,
            totalKilled: 0,
            spawners: []
        };
        
        for (var i = 0; i < this.spawners.length; i++) {
            var s = this.spawners[i].getStats();
            stats.totalActive += s.active;
            stats.totalSpawned += s.totalSpawned;
            stats.totalKilled += s.totalKilled;
            stats.spawners.push(s);
        }
        
        return stats;
    }
    
    loadFromData(data) {
        if (Array.isArray(data)) {
            for (var i = 0; i < data.length; i++) {
                this.createSpawner(RealmKit.MonsterSpawner.fromJSON(data[i]));
            }
        }
        console.log('[SpawnerManager] Loaded', this.spawners.length, 'spawners from data');
    }
    
    saveToData() {
        var data = [];
        for (var i = 0; i < this.spawners.length; i++) {
            data.push(this.spawners[i].toJSON());
        }
        return data;
    }
    
    clear() {
        this.spawners = [];
        console.log('[SpawnerManager] All spawners cleared');
    }
};

console.log('[MonsterSpawner] Module loaded');