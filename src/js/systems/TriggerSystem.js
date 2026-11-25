var RealmKit = RealmKit || {};

RealmKit.TriggerZone = class TriggerZone {
    constructor(config) {
        config = config || {};
        
        this.id = config.id || 'trigger_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.name = config.name || 'Trigger Zone';
        this.type = config.type || 'on_enter';
        
        this.shape = config.shape || 'rect';
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 100;
        this.height = config.height || 100;
        this.radius = config.radius || 100;
        this.points = config.points || null;
        
        this.triggerOnce = config.triggerOnce || false;
        this.triggered = false;
        this.cooldown = config.cooldown || 0;
        this.lastTriggerTime = 0;
        
        this.conditions = config.conditions || null;
        this.actions = config.actions || [];
        
        this.active = config.active !== false;
        this.visible = config.visible !== false;
        
        this.metadata = config.metadata || {};
        
        this._entitiesInZone = {};
        
        console.log('[TriggerZone] Created:', this.id, 'type:', this.type, 'shape:', this.shape);
    }
    
    containsPoint(x, y) {
        if (this.shape === 'rect') {
            return x >= this.x && x <= this.x + this.width &&
                   y >= this.y && y <= this.y + this.height;
        }
        
        if (this.shape === 'circle') {
            var dx = x - (this.x + this.radius);
            var dy = y - (this.y + this.radius);
            return Math.sqrt(dx * dx + dy * dy) <= this.radius;
        }
        
        if (this.shape === 'polygon' && this.points) {
            return this._pointInPolygon(x, y);
        }
        
        return false;
    }
    
    _pointInPolygon(x, y) {
        var inside = false;
        var pts = this.points;
        
        for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            var xi = pts[i].x, yi = pts[i].y;
            var xj = pts[j].x, yj = pts[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    checkConditions(context) {
        if (!this.conditions) return true;
        
        var engine = context.engine;
        var player = context.player;
        
        for (var key in this.conditions) {
            var cond = this.conditions[key];
            
            if (key === 'playerLevel') {
                if (player && player.stats) {
                    if (player.stats.level < cond.min || player.stats.level > cond.max) {
                        return false;
                    }
                }
            }
            
            if (key === 'hasItem') {
                if (engine && engine.inventoryManager) {
                    var hasItem = engine.inventoryManager.hasItem(cond.itemId, cond.quantity || 1);
                    if (!hasItem) return false;
                }
            }
            
            if (key === 'hasFlag') {
                if (engine && engine._storyFlags) {
                    var flagValue = engine._storyFlags[cond.flag];
                    if (flagValue !== cond.value) return false;
                }
            }
            
            if (key === 'questState') {
                if (engine && engine.questSystem) {
                    var quest = engine.questSystem.getQuest(cond.questId);
                    if (!quest || quest.state !== cond.state) return false;
                }
            }
            
            if (key === 'timeOfDay') {
                if (engine && engine.timeOfDay) {
                    if (engine.timeOfDay !== cond.value) return false;
                }
            }
            
            if (key === 'factionReputation') {
                if (player && player.reputation) {
                    var rep = player.reputation[cond.faction] || 0;
                    if (cond.min !== undefined && rep < cond.min) return false;
                    if (cond.max !== undefined && rep > cond.max) return false;
                }
            }
        }
        
        return true;
    }
    
    canTrigger(now) {
        if (!this.active) return false;
        if (this.triggerOnce && this.triggered) return false;
        if (this.cooldown > 0 && now - this.lastTriggerTime < this.cooldown) return false;
        return true;
    }
    
    execute(context) {
        var now = Date.now();
        
        if (!this.canTrigger(now)) {
            return false;
        }
        
        if (!this.checkConditions(context)) {
            console.log('[TriggerZone]', this.id, 'conditions not met');
            return false;
        }
        
        this.lastTriggerTime = now;
        this.triggered = true;
        
        console.log('[TriggerZone]', this.id, 'triggering', this.actions.length, 'actions');
        
        for (var i = 0; i < this.actions.length; i++) {
            this._executeAction(this.actions[i], context);
        }
        
        return true;
    }
    
    _executeAction(action, context) {
        var engine = context.engine;
        var player = context.player;
        var type = action.type;
        
        console.log('[TriggerZone]', this.id, 'executing action:', type);
        
        switch (type) {
            case 'spawn':
                this._actionSpawn(action, engine, player);
                break;
            case 'dialogue':
                this._actionDialogue(action, engine, player);
                break;
            case 'teleport':
                this._actionTeleport(action, player);
                break;
            case 'setFlag':
                this._actionSetFlag(action, engine);
                break;
            case 'startQuest':
                this._actionStartQuest(action, engine, player);
                break;
            case 'completeQuest':
                this._actionCompleteQuest(action, engine, player);
                break;
            case 'giveItem':
                this._actionGiveItem(action, engine, player);
                break;
            case 'removeItem':
                this._actionRemoveItem(action, engine, player);
                break;
            case 'giveXP':
                this._actionGiveXP(action, engine, player);
                break;
            case 'giveGold':
                this._actionGiveGold(action, engine, player);
                break;
            case 'playSound':
                this._actionPlaySound(action, engine);
                break;
            case 'playMusic':
                this._actionPlayMusic(action, engine);
                break;
            case 'changeWeather':
                this._actionChangeWeather(action, engine);
                break;
            case 'activateSpawner':
                this._actionActivateSpawner(action, engine);
                break;
            case 'deactivateSpawner':
                this._actionDeactivateSpawner(action, engine);
                break;
            case 'activateTrigger':
                this._actionActivateTrigger(action, engine);
                break;
            case 'deactivateTrigger':
                this._actionDeactivateTrigger(action, engine);
                break;
            case 'message':
                this._actionMessage(action, engine, player);
                break;
            case 'cutscene':
                this._actionCutscene(action, engine);
                break;
            case 'script':
                this._actionScript(action, context);
                break;
            default:
                console.warn('[TriggerZone] Unknown action type:', type);
        }
    }
    
    _actionSpawn(action, engine, player) {
        if (!engine || !engine.spawnerManager) return;
        
        var spawner = engine.spawnerManager.getSpawner(action.spawnerId);
        if (spawner) {
            spawner.spawn(engine.entityManager, engine.spawnerManager.templateManager);
            console.log('[TriggerZone] Spawned from spawner:', action.spawnerId);
        } else {
            console.warn('[TriggerZone] Spawner not found:', action.spawnerId);
        }
    }
    
    _actionDialogue(action, engine, player) {
        if (!engine || !engine.dialogueSystem) return;
        
        engine.dialogueSystem.startDialogue(action.dialogueId, player.id, action.npcId);
        console.log('[TriggerZone] Starting dialogue:', action.dialogueId);
    }
    
    _actionTeleport(action, player) {
        if (!player) return;
        
        player.x = action.x;
        player.y = action.y;
        
        if (action.map && action.onMapChange) {
            action.onMapChange(action.map, action.spawnPoint);
        }
        
        console.log('[TriggerZone] Teleported player to:', action.x, action.y);
    }
    
    _actionSetFlag(action, engine) {
        if (!engine || !engine._storyFlags) return;
        
        engine._storyFlags[action.flag] = action.value;
        console.log('[TriggerZone] Set flag:', action.flag, '=', action.value);
    }
    
    _actionStartQuest(action, engine, player) {
        if (!engine || !engine.questSystem) return;
        
        engine.questSystem.startQuest(action.questId, player.id);
        console.log('[TriggerZone] Started quest:', action.questId);
    }
    
    _actionCompleteQuest(action, engine, player) {
        if (!engine || !engine.questSystem) return;
        
        engine.questSystem.completeQuest(action.questId, player.id);
        console.log('[TriggerZone] Completed quest:', action.questId);
    }
    
    _actionGiveItem(action, engine, player) {
        if (!engine || !engine.inventoryManager) return;
        
        engine.inventoryManager.addItem(action.itemId, action.quantity || 1);
        console.log('[TriggerZone] Gave item:', action.itemId, 'x', action.quantity || 1);
    }
    
    _actionRemoveItem(action, engine, player) {
        if (!engine || !engine.inventoryManager) return;
        
        engine.inventoryManager.removeItem(action.itemId, action.quantity || 1);
        console.log('[TriggerZone] Removed item:', action.itemId, 'x', action.quantity || 1);
    }
    
    _actionGiveXP(action, engine, player) {
        if (!engine || !engine.experienceManager) return;
        
        engine.experienceManager.addXp(player.id, action.amount);
        console.log('[TriggerZone] Gave XP:', action.amount);
    }
    
    _actionGiveGold(action, engine, player) {
        if (!engine || !engine.inventoryManager) return;
        
        engine.inventoryManager.addGold(action.amount);
        console.log('[TriggerZone] Gave gold:', action.amount);
    }
    
    _actionPlaySound(action, engine) {
        if (!engine || !engine.audioSystem) return;
        
        engine.audioSystem.play(action.soundId, action.volume || 1.0);
        console.log('[TriggerZone] Playing sound:', action.soundId);
    }
    
    _actionPlayMusic(action, engine) {
        if (!engine || !engine.audioSystem) return;
        
        engine.audioSystem.playMusic(action.musicId, action.volume || 0.5, action.fadeTime || 1000);
        console.log('[TriggerZone] Playing music:', action.musicId);
    }
    
    _actionChangeWeather(action, engine) {
        if (!engine || !engine.weatherSystem) return;
        
        engine.weatherSystem.setWeather(action.weatherType, action.intensity || 1.0);
        console.log('[TriggerZone] Changed weather:', action.weatherType);
    }
    
    _actionActivateSpawner(action, engine) {
        if (!engine || !engine.spawnerManager) return;
        
        var spawner = engine.spawnerManager.getSpawner(action.spawnerId);
        if (spawner) {
            spawner.active = true;
            console.log('[TriggerZone] Activated spawner:', action.spawnerId);
        }
    }
    
    _actionDeactivateSpawner(action, engine) {
        if (!engine || !engine.spawnerManager) return;
        
        var spawner = engine.spawnerManager.getSpawner(action.spawnerId);
        if (spawner) {
            spawner.active = false;
            console.log('[TriggerZone] Deactivated spawner:', action.spawnerId);
        }
    }
    
    _actionActivateTrigger(action, engine) {
        if (!engine || !engine.triggerSystem) return;
        
        var trigger = engine.triggerSystem.getTrigger(action.triggerId);
        if (trigger) {
            trigger.active = true;
            console.log('[TriggerZone] Activated trigger:', action.triggerId);
        }
    }
    
    _actionDeactivateTrigger(action, engine) {
        if (!engine || !engine.triggerSystem) return;
        
        var trigger = engine.triggerSystem.getTrigger(action.triggerId);
        if (trigger) {
            trigger.active = false;
            console.log('[TriggerZone] Deactivated trigger:', action.triggerId);
        }
    }
    
    _actionMessage(action, engine, player) {
        if (!engine || !engine.hudSystem) return;
        
        engine.hudSystem.addCombatLogEntry(action.text, action.style || 'info');
        console.log('[TriggerZone] Message:', action.text);
    }
    
    _actionCutscene(action, engine) {
        if (!engine || !engine.cutsceneSystem) return;
        
        engine.cutsceneSystem.play(action.cutsceneId);
        console.log('[TriggerZone] Playing cutscene:', action.cutsceneId);
    }
    
    _actionScript(action, context) {
        if (action.handler && typeof action.handler === 'function') {
            action.handler(context);
            console.log('[TriggerZone] Executed custom script');
        }
    }
    
    onEntityEnter(entity, context) {
        var entityId = entity.id || entity;
        
        if (!this.active) return false;
        if (this._entitiesInZone[entityId]) return false;
        
        this._entitiesInZone[entityId] = {
            entity: entity,
            enteredAt: Date.now()
        };
        
        if (this.type === 'on_enter') {
            return this.execute(context);
        }
        
        return false;
    }
    
    onEntityExit(entity, context) {
        var entityId = entity.id || entity;
        
        if (!this.active) return false;
        if (!this._entitiesInZone[entityId]) return false;
        
        delete this._entitiesInZone[entityId];
        
        if (this.type === 'on_exit') {
            return this.execute(context);
        }
        
        return false;
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            shape: this.shape,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            radius: this.radius,
            points: this.points,
            triggerOnce: this.triggerOnce,
            cooldown: this.cooldown,
            conditions: this.conditions,
            actions: this.actions,
            active: this.active,
            metadata: this.metadata
        };
    }
    
    static fromJSON(data) {
        return new RealmKit.TriggerZone(data);
    }
};

RealmKit.TriggerSystem = class TriggerSystem {
    constructor(config) {
        config = config || {};
        
        this.triggers = [];
        this.timers = [];
        this.active = true;
        
        this.checkInterval = config.checkInterval || 100;
        this.lastCheck = 0;
        
        this._entityPositions = new Map();
        
        console.log('[TriggerSystem] Initialized');
    }
    
    createTrigger(config) {
        var trigger = new RealmKit.TriggerZone(config);
        this.triggers.push(trigger);
        console.log('[TriggerSystem] Created trigger:', trigger.id);
        return trigger;
    }
    
    createTimer(config) {
        var timer = {
            id: config.id || 'timer_' + Date.now(),
            interval: config.interval || 1000,
            lastFired: 0,
            actions: config.actions || [],
            active: config.active !== false,
            repeat: config.repeat !== false
        };
        
        this.timers.push(timer);
        console.log('[TriggerSystem] Created timer:', timer.id);
        return timer;
    }
    
    removeTrigger(triggerId) {
        for (var i = 0; i < this.triggers.length; i++) {
            if (this.triggers[i].id === triggerId) {
                this.triggers.splice(i, 1);
                console.log('[TriggerSystem] Removed trigger:', triggerId);
                return true;
            }
        }
        return false;
    }
    
    getTrigger(triggerId) {
        for (var i = 0; i < this.triggers.length; i++) {
            if (this.triggers[i].id === triggerId) {
                return this.triggers[i];
            }
        }
        return null;
    }
    
    updatePositions(entities, context) {
        if (!this.active) return;
        
        var now = Date.now();
        if (now - this.lastCheck < this.checkInterval) return;
        this.lastCheck = now;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            var entityId = entity.id;
            var prevPos = this._entityPositions.get(entityId);
            var currentPos = { x: entity.x, y: entity.y };
            
            for (var j = 0; j < this.triggers.length; j++) {
                var trigger = this.triggers[j];
                var wasInZone = prevPos && trigger.containsPoint(prevPos.x, prevPos.y);
                var isInZone = trigger.containsPoint(currentPos.x, currentPos.y);
                
                var triggerContext = {
                    engine: context.engine,
                    player: context.player,
                    entity: entity
                };
                
                if (isInZone && !wasInZone) {
                    trigger.onEntityEnter(entity, triggerContext);
                }
                
                if (!isInZone && wasInZone) {
                    trigger.onEntityExit(entity, triggerContext);
                }
            }
            
            this._entityPositions.set(entityId, currentPos);
        }
    }
    
    updateTimers(context) {
        if (!this.active) return;
        
        var now = Date.now();
        
        for (var i = this.timers.length - 1; i >= 0; i--) {
            var timer = this.timers[i];
            
            if (!timer.active) continue;
            
            if (now - timer.lastFired >= timer.interval) {
                for (var j = 0; j < timer.actions.length; j++) {
                    this._executeTimerAction(timer.actions[j], context);
                }
                timer.lastFired = now;
                
                if (!timer.repeat) {
                    this.timers.splice(i, 1);
                }
            }
        }
    }
    
    _executeTimerAction(action, context) {
        var trigger = new RealmKit.TriggerZone({ actions: [action] });
        trigger.execute(context);
    }
    
    pause() {
        this.active = false;
        console.log('[TriggerSystem] Paused');
    }
    
    resume() {
        this.active = true;
        console.log('[TriggerSystem] Resumed');
    }
    
    checkEntity(entity, context) {
        if (!this.active) return [];
        
        var triggersHit = [];
        
        for (var i = 0; i < this.triggers.length; i++) {
            var trigger = this.triggers[i];
            
            if (trigger.containsPoint(entity.x, entity.y)) {
                var prevPos = this._entityPositions.get(entity.id);
                var wasInZone = prevPos && trigger.containsPoint(prevPos.x, prevPos.y);
                
                var triggerContext = {
                    engine: context.engine,
                    player: context.player,
                    entity: entity
                };
                
                if (!wasInZone) {
                    if (trigger.onEntityEnter(entity, triggerContext)) {
                        triggersHit.push(trigger.id);
                    }
                }
            }
        }
        
        this._entityPositions.set(entity.id, { x: entity.x, y: entity.y });
        return triggersHit;
    }
    
    clearEntity(entityId) {
        this._entityPositions.delete(entityId);
    }
    
    loadFromData(data) {
        if (Array.isArray(data)) {
            for (var i = 0; i < data.length; i++) {
                this.createTrigger(RealmKit.TriggerZone.fromJSON(data[i]));
            }
        }
        console.log('[TriggerSystem] Loaded', this.triggers.length, 'triggers');
    }
    
    saveToData() {
        var data = [];
        for (var i = 0; i < this.triggers.length; i++) {
            data.push(this.triggers[i].toJSON());
        }
        return data;
    }
    
    clear() {
        this.triggers = [];
        this.timers = [];
        this._entityPositions.clear();
        console.log('[TriggerSystem] Cleared');
    }
};

console.log('[TriggerSystem] Module loaded');