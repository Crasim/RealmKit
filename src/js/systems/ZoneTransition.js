var RealmKit = RealmKit || {};

RealmKit.ZoneTransition = class ZoneTransition {
    constructor(config) {
        config = config || {};
        
        this.id = config.id || 'zone_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        this.type = 'zoneTransition';
        
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 64;
        this.height = config.height || 64;
        
        this.zoneId = config.zoneId || 'overworld';
        this.name = config.name || 'Zone Transition';
        this.zoneType = config.zoneType || 'door';
        
        this.targetMap = config.targetMap || null;
        this.targetSpawnId = config.targetSpawnId || 'default';
        this.spawnPoint = config.spawnPoint || { x: 0, y: 0 };
        
        this.biome = config.biome || null;
        this.levelRange = config.levelRange || { min: 1, max: 10 };
        
        this.triggerOnEnter = config.triggerOnEnter !== false;
        this.cooldown = config.cooldown || 2000;
        this.lastTriggerTime = 0;
        this.oneWay = config.oneWay || false;
        this.requiresItem = config.requiresItem || null;
        this.requiresQuest = config.requiresQuest || null;
        this.requiresLevel = config.requiresLevel || null;
        this.costGold = config.costGold || 0;
        
        this.visited = false;
        this.active = true;
        
        this.visualConfig = {
            color: this.getZoneColor(),
            pulseSpeed: 0.003,
            pulseRange: 0.3,
            iconSize: 24
        };
        
        this.pulsePhase = Math.random() * Math.PI * 2;
        
        console.log('[ZoneTransition] Created:', this.id, 'type:', this.zoneType, 'target:', this.targetMap);
    }
    
    getZoneColor() {
        var colors = {
            door: '#aa8844',
            portal: '#9944ff',
            cave: '#553311',
            stairs_down: '#556677',
            stairs_up: '#778899',
            dock: '#4488aa',
            trapdoor: '#445544'
        };
        return colors[this.zoneType] || '#888888';
    }
    
    containsPoint(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
    }
    
    canTransition(player, inventoryManager, questSystem) {
        if (!this.active) {
            return { canTransition: false, reason: 'inactive' };
        }
        
        var now = Date.now();
        if (now - this.lastTriggerTime < this.cooldown) {
            return { canTransition: false, reason: 'cooldown' };
        }
        
        if (this.requiresLevel && player && player.level < this.requiresLevel) {
            return { canTransition: false, reason: 'level_required', required: this.requiresLevel };
        }
        
        if (this.requiresItem && inventoryManager) {
            var hasItem = inventoryManager.findById(this.requiresItem);
            if (!hasItem) {
                return { canTransition: false, reason: 'item_required', itemId: this.requiresItem };
            }
        }
        
        if (this.requiresQuest && questSystem) {
            if (!questSystem.isCompleted(this.requiresQuest)) {
                return { canTransition: false, reason: 'quest_required', questId: this.requiresQuest };
            }
        }
        
        if (this.costGold > 0 && inventoryManager) {
            if (!inventoryManager.hasGold(this.costGold)) {
                return { canTransition: false, reason: 'gold_required', amount: this.costGold };
            }
        }
        
        return { canTransition: true };
    }
    
    trigger(player, inventoryManager, engine) {
        var result = this.canTransition(player, inventoryManager, engine.questSystem);
        if (!result.canTransition) {
            return result;
        }
        
        this.lastTriggerTime = Date.now();
        this.visited = true;
        
        if (this.costGold > 0 && inventoryManager) {
            inventoryManager.removeGold(this.costGold);
        }
        
        console.log('[ZoneTransition] Transitioning to:', this.targetMap, 'spawn:', this.targetSpawnId);
        
        return {
            canTransition: true,
            targetMap: this.targetMap,
            targetSpawnId: this.targetSpawnId,
            spawnPoint: this.spawnPoint
        };
    }
    
    update(deltaTime) {
        this.pulsePhase += deltaTime * this.visualConfig.pulseSpeed;
    }
    
    render(ctx, viewport) {
        if (!this.active) return;
        
        var screenX = this.x - viewport.x;
        var screenY = this.y - viewport.y;
        
        if (screenX + this.width < 0 || screenX > viewport.viewWidth ||
            screenY + this.height < 0 || screenY > viewport.viewHeight) {
            return;
        }
        
        ctx.save();
        
        var pulse = Math.sin(this.pulsePhase) * this.visualConfig.pulseRange;
        var alpha = 0.6 + pulse;
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.visualConfig.color;
        ctx.strokeStyle = this.visited ? '#44ff44' : '#ffffff';
        ctx.lineWidth = this.visited ? 3 : 2;
        
        ctx.beginPath();
        
        if (this.zoneType === 'portal') {
            this.renderPortal(ctx, screenX, screenY);
        } else if (this.zoneType === 'cave' || this.zoneType === 'trapdoor') {
            this.renderCave(ctx, screenX, screenY);
        } else if (this.zoneType === 'stairs_down' || this.zoneType === 'stairs_up') {
            this.renderStairs(ctx, screenX, screenY);
        } else {
            this.renderDoor(ctx, screenX, screenY);
        }
        
        ctx.restore();
    }
    
    renderPortal(ctx, screenX, screenY) {
        var centerX = screenX + this.width / 2;
        var centerY = screenY + this.height / 2;
        var radius = Math.min(this.width, this.height) / 2;
        
        var gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(153, 68, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(102, 34, 204, 0.6)');
        gradient.addColorStop(1, 'rgba(51, 17, 102, 0.2)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#bb88ff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + this.visualConfig.iconSize + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◈', centerX, centerY);
    }
    
    renderCave(ctx, screenX, screenY) {
        ctx.fillStyle = '#332211';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, screenY + this.height / 2 + 8, this.width / 2, this.height / 2 - 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#110800';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, screenY + this.height / 2 + 5, this.width / 2 - 8, this.height / 2 - 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#553311';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(screenX + 5, screenY + this.height - 5);
        ctx.lineTo(screenX + this.width / 3, screenY + 10);
        ctx.lineTo(screenX + this.width / 2, screenY + 5);
        ctx.lineTo(screenX + this.width * 2 / 3, screenY + 10);
        ctx.lineTo(screenX + this.width - 5, screenY + this.height - 5);
        ctx.stroke();
    }
    
    renderStairs(ctx, screenX, screenY) {
        var centerX = screenX + this.width / 2;
        var centerY = screenY + this.height / 2;
        
        ctx.fillStyle = this.zoneType === 'stairs_down' ? '#445566' : '#667788';
        
        for (var i = 0; i < 4; i++) {
            var y = screenY + 5 + i * (this.height - 10) / 4;
            var width = this.width - i * 8;
            var offset = i * 4;
            
            ctx.fillStyle = this.zoneType === 'stairs_down' ? 
                'rgb(' + (68 + i * 20) + ',' + (85 + i * 15) + ',' + (102 + i * 10) + ')' :
                'rgb(' + (102 - i * 10) + ',' + (119 - i * 8) + ',' + (136 - i * 6) + ')';
            
            ctx.fillRect(screenX + offset, y, width, (this.height - 10) / 4 - 2);
        }
        
        ctx.strokeStyle = '#889999';
        ctx.strokeRect(screenX, screenY, this.width, this.height);
    }
    
    renderDoor(ctx, screenX, screenY) {
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(screenX + 4, screenY + 4, this.width - 8, this.height - 8);
        
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX + 4, screenY + 4, this.width - 8, this.height - 8);
        
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(screenX + 8, screenY + 8, (this.width - 16) / 2 - 2, this.height - 16);
        ctx.fillRect(screenX + this.width / 2 + 2, screenY + 8, (this.width - 16) / 2 - 2, this.height - 16);
        
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(screenX + this.width - 14, screenY + this.height / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = this.visited ? '#44ff44' : '#886644';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, this.width, this.height);
    }
    
    toJSON() {
        return {
            id: this.id,
            type: 'zoneTransition',
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            zoneId: this.zoneId,
            name: this.name,
            zoneType: this.zoneType,
            targetMap: this.targetMap,
            targetSpawnId: this.targetSpawnId,
            spawnPoint: this.spawnPoint,
            biome: this.biome,
            levelRange: this.levelRange,
            triggerOnEnter: this.triggerOnEnter,
            cooldown: this.cooldown,
            oneWay: this.oneWay,
            requiresItem: this.requiresItem,
            requiresQuest: this.requiresQuest,
            requiresLevel: this.requiresLevel,
            costGold: this.costGold,
            visited: this.visited,
            active: this.active
        };
    }
    
    static fromJSON(data) {
        return new RealmKit.ZoneTransition(data);
    }
};

RealmKit.ZoneManager = class ZoneManager {
    constructor(engine) {
        this.engine = engine;
        this.zones = [];
        this.visitedZones = new Set();
        this.spawnPoints = {};
        this.currentZoneId = null;
        
        this.pendingTransition = null;
        this.transitionCallback = null;
        
        console.log('[ZoneManager] Initialized');
    }
    
    addZone(zone) {
        if (zone instanceof RealmKit.ZoneTransition) {
            this.zones.push(zone);
        } else {
            this.zones.push(new RealmKit.ZoneTransition(zone));
        }
        console.log('[ZoneManager] Added zone:', zone.id);
    }
    
    removeZone(zoneId) {
        for (var i = 0; i < this.zones.length; i++) {
            if (this.zones[i].id === zoneId) {
                this.zones.splice(i, 1);
                console.log('[ZoneManager] Removed zone:', zoneId);
                return true;
            }
        }
        return false;
    }
    
    getZone(zoneId) {
        for (var i = 0; i < this.zones.length; i++) {
            if (this.zones[i].id === zoneId) {
                return this.zones[i];
            }
        }
        return null;
    }
    
    registerSpawnPoint(spawnId, x, y, zoneId) {
        this.spawnPoints[spawnId] = { x: x, y: y, zoneId: zoneId || this.currentZoneId };
        console.log('[ZoneManager] Registered spawn point:', spawnId, 'at', x, y);
    }
    
    getSpawnPoint(spawnId) {
        return this.spawnPoints[spawnId] || { x: 0, y: 0 };
    }
    
    checkPlayerPosition(player, inventoryManager) {
        if (!player || !this.zones || this.zones.length === 0) return null;
        
        for (var i = 0; i < this.zones.length; i++) {
            var zone = this.zones[i];
            
            if (!zone.active) continue;
            if (!zone.triggerOnEnter) continue;
            
            if (zone.containsPoint(player.x, player.y)) {
                var result = zone.canTransition(player, inventoryManager, this.engine.questSystem);
                if (result.canTransition) {
                    return zone;
                }
            }
        }
        
        return null;
    }
    
    initiateTransition(zone, player, inventoryManager, callback) {
        var result = zone.trigger(player, inventoryManager, this.engine);
        
        if (!result.canTransition) {
            console.log('[ZoneManager] Cannot transition:', result.reason);
            return result;
        }
        
        this.pendingTransition = {
            zone: zone,
            targetMap: result.targetMap,
            targetSpawnId: result.targetSpawnId,
            spawnPoint: result.spawnPoint
        };
        
        this.transitionCallback = callback;
        
        if (this.engine.fadeTransition) {
            var self = this;
            this.engine.fadeTransition.fadeOut(500, function() {
                self.completeTransition();
            });
        } else {
            this.completeTransition();
        }
        
        return { canTransition: true, transitioning: true };
    }
    
    completeTransition() {
        if (!this.pendingTransition) return;
        
        var transition = this.pendingTransition;
        this.visitedZones.add(transition.zone.id);
        
        console.log('[ZoneManager] Transition complete to:', transition.targetMap);
        
        if (this.transitionCallback) {
            this.transitionCallback(transition);
        }
        
        this.pendingTransition = null;
        this.transitionCallback = null;
    }
    
    setPlayerToSpawn(player, spawnId) {
        var spawn = this.getSpawnPoint(spawnId);
        player.x = spawn.x;
        player.y = spawn.y;
        console.log('[ZoneManager] Player placed at spawn:', spawnId, spawn.x, spawn.y);
    }
    
    getMapSeed(mapId) {
        var hash = 0;
        for (var i = 0; i < mapId.length; i++) {
            var char = mapId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) + 1000;
    }
    
    update(deltaTime) {
        for (var i = 0; i < this.zones.length; i++) {
            this.zones[i].update(deltaTime);
        }
    }
    
    render(ctx, viewport) {
        for (var i = 0; i < this.zones.length; i++) {
            this.zones[i].render(ctx, viewport);
        }
    }
    
    serialize() {
        var zoneData = [];
        for (var i = 0; i < this.zones.length; i++) {
            zoneData.push(this.zones[i].toJSON());
        }
        
        return {
            zones: zoneData,
            visited: Array.from(this.visitedZones),
            spawnPoints: this.spawnPoints,
            currentZone: this.currentZoneId
        };
    }
    
    deserialize(data) {
        if (!data) return;
        
        this.zones = [];
        if (data.zones) {
            for (var i = 0; i < data.zones.length; i++) {
                this.zones.push(RealmKit.ZoneTransition.fromJSON(data.zones[i]));
            }
        }
        
        this.visitedZones = new Set(data.visited || []);
        this.spawnPoints = data.spawnPoints || {};
        this.currentZoneId = data.currentZone || null;
        
        console.log('[ZoneManager] Loaded', this.zones.length, 'zones');
    }
    
    clear() {
        this.zones = [];
        this.visitedZones = new Set();
        this.spawnPoints = {};
        this.currentZoneId = null;
    }
};

console.log('[ZoneTransition] Module loaded');