var RealmKit = RealmKit || {};

RealmKit.SaveManager = class SaveManager {
    constructor(config) {
        this.config = config || {};
        this.storageKey = this.config.storageKey || 'realmkit_save';
        this.autoSaveInterval = this.config.autoSaveInterval || 60000;
        this.maxSlots = this.config.maxSlots || 5;
        
        this.autoSaveTimer = null;
        this.lastSave = null;
        this.lastLoad = null;
        
        console.log('[SaveManager] Initialized');
    }
    
    save(slot, gameState) {
        try {
            var slotKey = this.storageKey + '_' + (slot || 0);
            var saveData = {
                version: '1.0.0',
                timestamp: Date.now(),
                gameState: gameState
            };
            
            localStorage.setItem(slotKey, JSON.stringify(saveData));
            this.lastSave = saveData;
            
            console.log('[SaveManager] Saved to slot', slot);
            return { success: true, timestamp: saveData.timestamp };
        } catch (e) {
            console.error('[SaveManager] Save failed:', e);
            return { success: false, error: e.message };
        }
    }
    
    load(slot) {
        try {
            var slotKey = this.storageKey + '_' + (slot || 0);
            var data = localStorage.getItem(slotKey);
            
            if (!data) {
                return { success: false, error: 'No save data found' };
            }
            
            var saveData = JSON.parse(data);
            this.lastLoad = saveData;
            
            console.log('[SaveManager] Loaded from slot', slot);
            return { success: true, data: saveData };
        } catch (e) {
            console.error('[SaveManager] Load failed:', e);
            return { success: false, error: e.message };
        }
    }
    
    delete(slot) {
        try {
            var slotKey = this.storageKey + '_' + (slot || 0);
            localStorage.removeItem(slotKey);
            console.log('[SaveManager] Deleted slot', slot);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
    
    getSlotInfo(slot) {
        try {
            var slotKey = this.storageKey + '_' + (slot || 0);
            var data = localStorage.getItem(slotKey);
            
            if (!data) return null;
            
            var saveData = JSON.parse(data);
            return {
                slot: slot,
                timestamp: saveData.timestamp,
                version: saveData.version,
                hasData: true
            };
        } catch (e) {
            return null;
        }
    }
    
    listSlots() {
        var slots = [];
        for (var i = 0; i < this.maxSlots; i++) {
            var info = this.getSlotInfo(i);
            slots.push(info || { slot: i, hasData: false });
        }
        return slots;
    }
    
    hasSave(slot) {
        var slotKey = this.storageKey + '_' + (slot || 0);
        return localStorage.getItem(slotKey) !== null;
    }
    
    serializeEntity(entity) {
        if (!entity) return null;
        return {
            id: entity.id,
            type: entity.type,
            x: entity.x,
            y: entity.y,
            width: entity.width,
            height: entity.height,
            hp: entity.hp,
            maxHp: entity.maxHp,
            mp: entity.mp,
            maxMp: entity.maxMp,
            state: entity.stateMachine ? entity.stateMachine.currentState : null,
            dir: entity.direction
        };
    }
    
    deserializeEntity(data) {
        return data;
    }
    
    serializeWorld(engine) {
        var entities = [];
        if (engine.entityManager) {
            for (var i = 0; i < engine.entityManager.entities.length; i++) {
                entities.push(this.serializeEntity(engine.entityManager.entities[i]));
            }
        }
        
        return {
            player: this.serializeEntity(engine.player),
            entities: entities,
            dayNight: engine.dayNight ? {
                time: engine.dayNight.time,
                speed: engine.dayNight.speed
            } : null,
            seed: engine.tileMap ? engine.tileMap.seed : null
        };
    }
    
    startAutoSave(engine, interval) {
        var self = this;
        this.stopAutoSave();
        this.autoSaveTimer = setInterval(function() {
            var state = self.serializeWorld(engine);
            self.save(0, state);
            console.log('[SaveManager] Auto-saved');
        }, interval || this.autoSaveInterval);
    }
    
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    getStorageSize() {
        var total = 0;
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith(this.storageKey)) {
                total += localStorage.getItem(key).length;
            }
        }
        return total;
    }
};

console.log('[SaveManager] Class loaded');