var RealmKit = RealmKit || {};

RealmKit.ThreatManager = class ThreatManager {
    constructor(config) {
        this.config = config || {};
        this.threatTables = new Map();
        this.decayRate = this.config.decayRate || 0.95;
        this.decayInterval = this.config.decayInterval || 2000;
        this.lastDecay = Date.now();
        
        console.log('[ThreatManager] Initialized');
    }
    
    addThreat(attackerId, targetId, amount, reason) {
        if (!this.threatTables.has(targetId)) {
            this.threatTables.set(targetId, new Map());
        }
        
        var table = this.threatTables.get(targetId);
        var current = table.get(attackerId) || 0;
        var newThreat = current + amount;
        
        table.set(attackerId, newThreat);
        
        console.log('[ThreatManager]', reason || 'combat', '|', attackerId, '->', targetId, ':', current.toFixed(1), '+', amount.toFixed(1), '=', newThreat.toFixed(1));
        
        return newThreat;
    }
    
    removeThreat(attackerId, targetId) {
        var table = this.threatTables.get(targetId);
        if (table) {
            table.delete(attackerId);
        }
    }
    
    getHighestThreatTarget(targetId) {
        var table = this.threatTables.get(targetId);
        if (!table || table.size === 0) {
            return null;
        }
        
        var highestId = null;
        var highestThreat = -Infinity;
        
        table.forEach(function(threat, id) {
            if (threat > highestThreat) {
                highestThreat = threat;
                highestId = id;
            }
        });
        
        return highestId;
    }
    
    getThreatTable(targetId) {
        return this.threatTables.get(targetId) || new Map();
    }
    
    getThreatValue(targetId, attackerId) {
        var table = this.threatTables.get(targetId);
        if (!table) return 0;
        return table.get(attackerId) || 0;
    }
    
    decayThreat() {
        var now = Date.now();
        if (now - this.lastDecay < this.decayInterval) return;
        
        this.lastDecay = now;
        
        var self = this;
        this.threatTables.forEach(function(table, targetId) {
            table.forEach(function(threat, attackerId) {
                var decayed = threat * self.decayRate;
                if (decayed < 1) {
                    table.delete(attackerId);
                } else {
                    table.set(attackerId, decayed);
                }
            });
        });
    }
    
    clearThreat(targetId) {
        this.threatTables.delete(targetId);
    }
    
    clearAllThreat() {
        this.threatTables.clear();
        console.log('[ThreatManager] All threat tables cleared');
    }
    
    clear() {
        this.clearAllThreat();
    }
    
    serialize() {
        var data = {};
        this.threatTables.forEach(function(table, targetId) {
            data[targetId] = {};
            table.forEach(function(threat, attackerId) {
                data[targetId][attackerId] = threat;
            });
        });
        return data;
    }
};

console.log('[ThreatManager] Class loaded');