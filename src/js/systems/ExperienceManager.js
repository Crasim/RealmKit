var RealmKit = RealmKit || {};

RealmKit.ExperienceManager = class ExperienceManager {
    constructor(config) {
        this.config = config || {};
        
        this.levelTable = this.config.levelTable || this.generateDefaultLevelTable(60);
        this.entities = new Map();
        
        this.onLevelUp = null;
        this.onXpGain = null;
        
        console.log('[ExperienceManager] Initialized with', this.levelTable.length, 'levels');
    }
    
    generateDefaultLevelTable(maxLevel) {
        var table = [];
        var xpRequired = 0;
        
        for (var level = 1; level <= maxLevel; level++) {
            if (level === 1) {
                xpRequired = 0;
            } else {
                xpRequired = Math.floor(100 * Math.pow(level, 1.8));
            }
            
            table.push({
                level: level,
                xpRequired: xpRequired,
                hpBonus: 10 + level * 2,
                attackBonus: Math.floor(level * 0.5),
                defenseBonus: Math.floor(level * 0.3),
                mpBonus: 5 + level
            });
        }
        
        return table;
    }
    
    registerEntity(entityId, initialXp) {
        var xp = initialXp || 0;
        var levelData = this.getLevelForXp(xp);
        
        this.entities.set(entityId, {
            xp: xp,
            level: levelData.level,
            xpToNextLevel: this.getXpToNextLevel(xp),
            totalXpGained: xp
        });
        
        console.log('[ExperienceManager] Registered', entityId, 'at level', levelData.level, 'with', xp, 'XP');
        
        return this.entities.get(entityId);
    }
    
    unregisterEntity(entityId) {
        this.entities.delete(entityId);
    }
    
    getLevelForXp(xp) {
        for (var i = this.levelTable.length - 1; i >= 0; i--) {
            if (xp >= this.levelTable[i].xpRequired) {
                return this.levelTable[i];
            }
        }
        return this.levelTable[0];
    }
    
    getXpToNextLevel(currentXp) {
        var currentLevel = this.getLevelForXp(currentXp);
        var nextLevelIndex = currentLevel.level;
        
        if (nextLevelIndex >= this.levelTable.length) {
            return 0;
        }
        
        return this.levelTable[nextLevelIndex].xpRequired - currentXp;
    }
    
    addXp(entityId, amount, reason) {
        var data = this.entities.get(entityId);
        if (!data) {
            console.warn('[ExperienceManager] Unknown entity:', entityId);
            return null;
        }
        
        var oldLevel = data.level;
        data.xp += amount;
        data.totalXpGained += amount;
        
        var newLevelData = this.getLevelForXp(data.xp);
        data.level = newLevelData.level;
        data.xpToNextLevel = this.getXpToNextLevel(data.xp);
        
        var result = {
            entityId: entityId,
            xpGained: amount,
            totalXp: data.xp,
            level: data.level,
            leveledUp: false,
            oldLevel: oldLevel,
            newLevel: data.level,
            levelData: null,
            reason: reason || 'unknown'
        };
        
        if (data.level > oldLevel) {
            result.leveledUp = true;
            result.levelData = newLevelData;
            
            console.log('[ExperienceManager]', entityId, 'LEVELED UP!', oldLevel, '->', data.level, '| Bonus: HP+' + newLevelData.hpBonus, 'ATK+' + newLevelData.attackBonus, 'DEF+' + newLevelData.defenseBonus);
            
            if (this.onLevelUp) {
                this.onLevelUp(entityId, oldLevel, data.level, newLevelData);
            }
        } else {
            console.log('[ExperienceManager]', entityId, 'gained', amount, 'XP (', reason, ') | Total:', data.xp, '| Level:', data.level);
        }
        
        if (this.onXpGain) {
            this.onXpGain(entityId, amount, data.level, reason);
        }
        
        return result;
    }
    
    getEntityData(entityId) {
        return this.entities.get(entityId);
    }
    
    getXP(entityId) {
        var data = this.entities.get(entityId);
        if (!data) return null;
        return {
            xp: data.xp,
            level: data.level,
            xpToNext: data.xpToNextLevel,
            totalXp: data.totalXpGained
        };
    }
    
    getXPForLevel(level) {
        if (level < 1 || level > this.levelTable.length) return 0;
        return this.levelTable[level - 1].xpRequired;
    }
    
    getLevelBonuses(entityId) {
        var data = this.entities.get(entityId);
        if (!data) {
            return { hpBonus: 0, attackBonus: 0, defenseBonus: 0, mpBonus: 0 };
        }
        
        var levelData = this.levelTable[data.level - 1];
        return levelData || { hpBonus: 0, attackBonus: 0, defenseBonus: 0, mpBonus: 0 };
    }
    
    calculateXpForKill(entity, targetLevel) {
        var baseXp = 25 + targetLevel * 10;
        var variance = Math.floor(baseXp * 0.2);
        return baseXp + Math.floor(Math.random() * variance);
    }
};

console.log('[ExperienceManager] Class loaded');