var RealmKit = RealmKit || {};

RealmKit.NPCSpawner = class NPCSpawner {
    constructor(config) {
        this.config = config || {};
        
        this.spawners = [];
        this.spawnedEntities = new Map();
        
        this.defaultRespawnDelay = this.config.respawnDelay || 30000;
        this.maxPerSpawner = this.config.maxPerSpawner || 5;
        
        console.log('[NPCSpawner] Initialized');
    }
    
    createSpawner(config) {
        var spawner = {
            id: config.id || 'spawner_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            x: config.x || 0,
            y: config.y || 0,
            radius: config.radius || 100,
            npcType: config.npcType || 'npc',
            npcConfig: config.npcConfig || {},
            maxNPCs: config.maxNPCs || this.maxPerSpawner,
            respawnDelay: config.respawnDelay || this.defaultRespawnDelay,
            active: config.active !== false,
            spawnOnStart: config.spawnOnStart !== false,
            
            npcs: [],
            deadNPCs: [],
            lastSpawn: 0
        };
        
        this.spawners.push(spawner);
        console.log('[NPCSpawner] Created spawner:', spawner.id);
        return spawner;
    }
    
    removeSpawner(spawnerId) {
        for (var i = 0; i < this.spawners.length; i++) {
            if (this.spawners[i].id === spawnerId) {
                this.spawners.splice(i, 1);
                console.log('[NPCSpawner] Removed spawner:', spawnerId);
                return true;
            }
        }
        return false;
    }
    
    spawn(spawner, entityManager) {
        if (!spawner || !spawner.active || !entityManager) return null;
        
        var npc = RealmKit.NPC ? new RealmKit.NPC(spawner.npcConfig) : null;
        if (!npc) {
            console.warn('[NPCSpawner] NPC class not available');
            return null;
        }
        
        var angle = Math.random() * Math.PI * 2;
        var dist = Math.random() * spawner.radius;
        npc.x = spawner.x + Math.cos(angle) * dist;
        npc.y = spawner.y + Math.sin(angle) * dist;
        npc.id = npc.id || 'npc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        npc.spawnerId = spawner.id;
        
        entityManager.add(npc);
        spawner.npcs.push({
            id: npc.id,
            entity: npc,
            spawnedAt: Date.now()
        });
        
        this.spawnedEntities.set(npc.id, {
            spawnerId: spawner.id,
            spawnTime: Date.now()
        });
        
        console.log('[NPCSpawner] Spawned NPC:', npc.id, 'from spawner:', spawner.id);
        return npc;
    }
    
    initialSpawn(entityManager) {
        for (var i = 0; i < this.spawners.length; i++) {
            var spawner = this.spawners[i];
            if (!spawner.spawnOnStart) continue;
            
            for (var j = 0; j < spawner.maxNPCs; j++) {
                this.spawn(spawner, entityManager);
            }
        }
    }
    
    update(deltaTime, entityManager) {
        var now = Date.now();
        
        for (var i = 0; i < this.spawners.length; i++) {
            var spawner = this.spawners[i];
            if (!spawner.active) continue;
            
            for (var j = spawner.npcs.length - 1; j >= 0; j--) {
                var npcData = spawner.npcs[j];
                var entity = npcData.entity;
                
                if (!entity || entity.hp <= 0 || entity.dead) {
                    spawner.deadNPCs.push({
                        id: npcData.id,
                        diedAt: now
                    });
                    spawner.npcs.splice(j, 1);
                    this.spawnedEntities.delete(npcData.id);
                    console.log('[NPCSpawner] NPC died:', npcData.id);
                }
            }
            
            for (var j = spawner.deadNPCs.length - 1; j >= 0; j--) {
                var dead = spawner.deadNPCs[j];
                if (now - dead.diedAt >= spawner.respawnDelay) {
                    if (spawner.npcs.length < spawner.maxNPCs) {
                        this.spawn(spawner, entityManager);
                    }
                    spawner.deadNPCs.splice(j, 1);
                }
            }
        }
    }
    
    getSpawner(spawnerId) {
        for (var i = 0; i < this.spawners.length; i++) {
            if (this.spawners[i].id === spawnerId) {
                return this.spawners[i];
            }
        }
        return null;
    }
    
    getAllSpawned() {
        var list = [];
        this.spawnedEntities.forEach(function(data, id) {
            list.push(id);
        });
        return list;
    }
    
    getSpawnerStats(spawnerId) {
        var spawner = this.getSpawner(spawnerId);
        if (!spawner) return null;
        
        return {
            active: spawner.npcs.length,
            dead: spawner.deadNPCs.length,
            max: spawner.maxNPCs
        };
    }
    
    setSpawnerActive(spawnerId, active) {
        var spawner = this.getSpawner(spawnerId);
        if (spawner) {
            spawner.active = active;
            console.log('[NPCSpawner] Set active:', spawnerId, active);
        }
    }
    
    clear() {
        this.spawners = [];
        this.spawnedEntities.clear();
        console.log('[NPCSpawner] Cleared all spawners');
    }
};

console.log('[NPCSpawner] Class loaded');