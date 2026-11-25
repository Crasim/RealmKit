var RealmKit = RealmKit || {};

RealmKit.AchievementSystem = class AchievementSystem {
    constructor(config) {
        this.config = config || {};
        
        this.achievements = new Map();
        this.unlocked = [];
        this.stats = {};
        
        this.onUnlock = null;
        
        this.initDefaultAchievements();
        
        console.log('[AchievementSystem] Initialized');
    }
    
    initDefaultAchievements() {
        this.register({
            id: 'first_kill',
            name: 'First Blood',
            description: 'Defeat your first enemy',
            icon: 'sword',
            type: 'combat',
            condition: function(stats) { return stats.kills >= 1; }
        });
        
        this.register({
            id: 'killer_10',
            name: 'Slayer',
            description: 'Defeat 10 enemies',
            icon: 'sword',
            type: 'combat',
            condition: function(stats) { return stats.kills >= 10; }
        });
        
        this.register({
            id: 'killer_100',
            name: 'Warlord',
            description: 'Defeat 100 enemies',
            icon: 'sword',
            type: 'combat',
            condition: function(stats) { return stats.kills >= 100; }
        });
        
        this.register({
            id: 'gold_hoarder',
            name: 'Gold Hoarder',
            description: 'Accumulate 1000 gold',
            icon: 'coin',
            type: 'economy',
            condition: function(stats) { return stats.goldCollected >= 1000; }
        });
        
        this.register({
            id: 'gold_rich',
            name: 'Wealthy',
            description: 'Accumulate 10000 gold',
            icon: 'coin',
            type: 'economy',
            condition: function(stats) { return stats.goldCollected >= 10000; }
        });
        
        this.register({
            id: 'level_5',
            name: 'Adventurer',
            description: 'Reach level 5',
            icon: 'star',
            type: 'progression',
            condition: function(stats) { return stats.level >= 5; }
        });
        
        this.register({
            id: 'level_10',
            name: 'Veteran',
            description: 'Reach level 10',
            icon: 'star',
            type: 'progression',
            condition: function(stats) { return stats.level >= 10; }
        });
        
        this.register({
            id: 'level_20',
            name: 'Champion',
            description: 'Reach level 20',
            icon: 'star',
            type: 'progression',
            condition: function(stats) { return stats.level >= 20; }
        });
        
        this.register({
            id: 'level_30',
            name: 'Legend',
            description: 'Reach level 30',
            icon: 'crown',
            type: 'progression',
            condition: function(stats) { return stats.level >= 30; }
        });
        
        this.register({
            id: 'level_50',
            name: 'Demigod',
            description: 'Reach level 50',
            icon: 'crown',
            type: 'progression',
            condition: function(stats) { return stats.level >= 50; }
        });
        
        this.register({
            id: 'xp_1000',
            name: 'Experienced',
            description: 'Earn 1000 total XP',
            icon: 'star',
            type: 'progression',
            condition: function(stats) { return stats.totalXp >= 1000; }
        });
        
        this.register({
            id: 'xp_10000',
            name: 'Seasoned',
            description: 'Earn 10000 total XP',
            icon: 'star',
            type: 'progression',
            condition: function(stats) { return stats.totalXp >= 10000; }
        });
        
        this.register({
            id: 'xp_50000',
            name: 'Master',
            description: 'Earn 50000 total XP',
            icon: 'star',
            type: 'progression',
            condition: function(stats) { return stats.totalXp >= 50000; }
        });
        
        this.register({
            id: 'explorer',
            name: 'Explorer',
            description: 'Visit 100 different tiles',
            icon: 'map',
            type: 'exploration',
            condition: function(stats) { return stats.tilesVisited >= 100; }
        });
        
        this.register({
            id: 'potion_user',
            name: 'Alchemist',
            description: 'Use 50 potions',
            icon: 'potion',
            type: 'items',
            condition: function(stats) { return stats.potionsUsed >= 50; }
        });
        
        this.register({
            id: 'crit_master',
            name: 'Precision',
            description: 'Land 25 critical hits',
            icon: 'star',
            type: 'combat',
            condition: function(stats) { return stats.criticalHits >= 25; }
        });
        
        this.register({
            id: 'party_first',
            name: 'Leader',
            description: 'Recruit your first party member',
            icon: 'users',
            type: 'social',
            condition: function(stats) { return stats.partyMembers >= 1; }
        });
        
        this.register({
            id: 'party_full',
            name: 'Commander',
            description: 'Recruit a full party of 6 members',
            icon: 'users',
            type: 'social',
            condition: function(stats) { return stats.partyMembers >= 6; }
        });
        
        this.register({
            id: 'party_loyal',
            name: 'Loyal Friend',
            description: 'Keep a party member for 10 battles',
            icon: 'heart',
            type: 'social',
            condition: function(stats) { return stats.partyBattles >= 10; }
        });
    }
    
    register(achievement) {
        if (!achievement.id) {
            console.warn('[AchievementSystem] Achievement missing id');
            return;
        }
        
        achievement.unlocked = false;
        achievement.unlockedAt = null;
        
        this.achievements.set(achievement.id, achievement);
        console.log('[AchievementSystem] Registered:', achievement.id);
    }
    
    trackStat(stat, value) {
        if (!this.stats[stat]) {
            this.stats[stat] = 0;
        }
        
        if (typeof value === 'number') {
            this.stats[stat] += value;
        } else if (value === undefined) {
            this.stats[stat]++;
        } else {
            this.stats[stat] = value;
        }
        
        this.checkAchievements();
    }
    
    setStat(stat, value) {
        this.stats[stat] = value;
        this.checkAchievements();
    }
    
    getStat(stat) {
        return this.stats[stat] || 0;
    }
    
    checkAchievements() {
        var self = this;
        this.achievements.forEach(function(achievement, id) {
            if (achievement.unlocked) return;
            
            try {
                if (achievement.condition(self.stats)) {
                    self.unlock(id);
                }
            } catch (e) {
                console.warn('[AchievementSystem] Condition error for', id, e);
            }
        });
    }
    
    unlock(achievementId) {
        var achievement = this.achievements.get(achievementId);
        if (!achievement || achievement.unlocked) return false;
        
        achievement.unlocked = true;
        achievement.unlockedAt = Date.now();
        this.unlocked.push(achievementId);
        
        console.log('[AchievementSystem] Unlocked:', achievement.name);
        
        if (this.onUnlock) {
            this.onUnlock(achievement);
        }
        
        return true;
    }
    
    isUnlocked(achievementId) {
        var a = this.achievements.get(achievementId);
        return a ? a.unlocked : false;
    }
    
    getAll() {
        var list = [];
        this.achievements.forEach(function(a) { list.push(a); });
        return list;
    }
    
    getUnlocked() {
        return this.unlocked.slice();
    }
    
    getProgress(achievementId) {
        var a = this.achievements.get(achievementId);
        if (!a) return 0;
        
        if (a.unlocked) return 1;
        
        return 0;
    }
    
    serialize() {
        var data = {
            stats: this.stats,
            unlocked: this.unlocked
        };
        return JSON.stringify(data);
    }
    
    deserialize(json) {
        try {
            var data = JSON.parse(json);
            this.stats = data.stats || {};
            
            for (var i = 0; i < data.unlocked.length; i++) {
                var a = this.achievements.get(data.unlocked[i]);
                if (a) {
                    a.unlocked = true;
                }
            }
            this.unlocked = data.unlocked || [];
            
            console.log('[AchievementSystem] Loaded', this.unlocked.length, 'achievements');
            return true;
        } catch (e) {
            console.error('[AchievementSystem] Load failed:', e);
            return false;
        }
    }
};

console.log('[AchievementSystem] Class loaded');