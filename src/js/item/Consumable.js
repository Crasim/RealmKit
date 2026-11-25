var RealmKit = RealmKit || {};

RealmKit.ConsumableTypes = {
    potion_health: {
        name: 'Health Potion',
        effect: 'heal',
        value: 25,
        cooldown: 2000,
        color: '#ff4444',
        icon: 'hp',
        maxStack: 20,
        weight: 0.5
    },
    potion_health_large: {
        name: 'Large Health Potion',
        effect: 'heal',
        value: 50,
        cooldown: 2000,
        color: '#ff0000',
        icon: 'hp+',
        maxStack: 10,
        weight: 0.8
    },
    potion_mana: {
        name: 'Mana Potion',
        effect: 'restore_mana',
        value: 20,
        cooldown: 2000,
        color: '#4488ff',
        icon: 'mp',
        maxStack: 20,
        weight: 0.5
    },
    potion_mana_large: {
        name: 'Large Mana Potion',
        effect: 'restore_mana',
        value: 40,
        cooldown: 2000,
        color: '#0044ff',
        icon: 'mp+',
        maxStack: 10,
        weight: 0.8
    },
    potion_cure: {
        name: 'Antidote',
        effect: 'cure',
        value: 1,
        cooldown: 1000,
        color: '#44ff44',
        icon: 'cur',
        maxStack: 10,
        weight: 0.3
    },
    potion_rejuvenation: {
        name: 'Rejuvenation Potion',
        effect: 'rejuvenate',
        value: 15,
        cooldown: 3000,
        color: '#ff44ff',
        icon: 'rej',
        maxStack: 5,
        weight: 0.6
    },
    food_bread: {
        name: 'Bread',
        effect: 'heal',
        value: 5,
        cooldown: 5000,
        color: '#c4a954',
        icon: 'brd',
        maxStack: 20,
        weight: 0.2
    },
    food_meat: {
        name: 'Cooked Meat',
        effect: 'heal',
        value: 15,
        cooldown: 4000,
        color: '#8b4513',
        icon: 'mt',
        maxStack: 10,
        weight: 0.4
    },
    scroll_teleport: {
        name: 'Scroll of Teleport',
        effect: 'teleport',
        value: 1,
        targetValue: 'spawn',
        cooldown: 10000,
        color: '#9932cc',
        icon: 'tp',
        maxStack: 5,
        weight: 1.0
    },
    elixir_strength: {
        name: 'Elixir of Strength',
        effect: 'buff',
        buffType: 'strength',
        value: 10,
        duration: 30000,
        cooldown: 60000,
        color: '#ff8844',
        icon: 'str',
        maxStack: 5,
        weight: 0.8
    },
    elixir_speed: {
        name: 'Elixir of Speed',
        effect: 'buff',
        buffType: 'speed',
        value: 25,
        duration: 20000,
        cooldown: 60000,
        color: '#44ff88',
        icon: 'spd',
        maxStack: 5,
        weight: 0.8
    }
};

RealmKit.Consumable = class Consumable {
    static create(type, config) {
        var template = RealmKit.ConsumableTypes[type];
        if (!template) {
            console.warn('[Consumable] Unknown type:', type);
            return null;
        }
        
        var item = Object.assign({}, template, config || {});
        item.id = config && config.id ? config.id : ('cons_' + type + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
        item.type = type;
        item.category = 'consumable';
        
        if (item.quantity === undefined) item.quantity = 1;
        if (item.maxStack === undefined) item.maxStack = template.maxStack || 99;
        
        return item;
    }
    
    static use(item, target, combatSystem, statusEffectManager) {
        if (!item || !target) {
            return { success: false, error: 'invalid_target' };
        }
        
        var template = RealmKit.ConsumableTypes[item.type];
        if (!template) {
            return { success: false, error: 'unknown_type' };
        }
        
        var effect = template.effect;
        var result = { success: true, consumed: true, effect: effect, value: template.value };
        
        switch (effect) {
            case 'heal':
                if (target.combatStats) {
                    var healAmount = template.value;
                    target.combatStats.hp = Math.min(target.combatStats.hp + healAmount, target.combatStats.maxHp);
                    result.healed = healAmount;
                    result.hp = target.combatStats.hp;
                    result.maxHp = target.combatStats.maxHp;
                }
                break;
                
            case 'restore_mana':
                if (target.combatStats && target.combatStats.mp !== undefined) {
                    var restoreAmount = template.value;
                    target.combatStats.mp = Math.min((target.combatStats.mp || 0) + restoreAmount, target.combatStats.maxMp || 100);
                    result.restored = restoreAmount;
                    result.mp = target.combatStats.mp;
                    result.maxMp = target.combatStats.maxMp || 100;
                }
                break;
                
            case 'cure':
                if (statusEffectManager) {
                    var removed = statusEffectManager.removeByCategory(target.id, 'harmful');
                    result.removedEffects = removed;
                }
                break;
                
            case 'rejuvenate':
                if (target.combatStats) {
                    target.combatStats.hp = Math.min(target.combatStats.hp + template.value, target.combatStats.maxHp);
                    if (target.combatStats.mp !== undefined) {
                        target.combatStats.mp = Math.min((target.combatStats.mp || 0) + template.value, target.combatStats.maxMp || 100);
                    }
                    result.healed = template.value;
                    result.restored = template.value;
                }
                break;
                
            case 'buff':
                if (statusEffectManager && template.buffType) {
                    var buffName = template.name.toLowerCase();
                    statusEffectManager.applyEffect(target, buffName, 'consumable', template.duration || 30000);
                    result.buffApplied = template.buffType;
                    result.duration = template.duration;
                }
                break;
                
            case 'teleport':
                result.teleport = true;
                result.teleportTarget = template.targetValue || 'spawn';
                result.consumed = true;
                break;
        }
        
        return result;
    }
    
    static getDisplayName(item) {
        var template = RealmKit.ConsumableTypes[item.type];
        return template ? template.name : (item.name || 'Unknown');
    }
    
    static getDescription(item) {
        var template = RealmKit.ConsumableTypes[item.type];
        if (!template) return 'Unknown item';
        
        switch (template.effect) {
            case 'heal':
                return 'Restores ' + template.value + ' HP';
            case 'restore_mana':
                return 'Restores ' + template.value + ' MP';
            case 'cure':
                return 'Cures harmful status effects';
            case 'rejuvenate':
                return 'Restores ' + template.value + ' HP and MP';
            case 'buff':
                return 'Grants ' + template.buffType + ' boost for ' + Math.floor(template.duration / 1000) + 's';
            case 'teleport':
                return 'Teleports to ' + (template.targetValue || 'spawn');
            default:
                return template.name;
        }
    }
    
    static randomDrop(level) {
        level = level || 1;
        
        var dropWeights = [
            { type: 'potion_health', weight: 30, minLevel: 1 },
            { type: 'potion_health_large', weight: 15, minLevel: 3 },
            { type: 'potion_mana', weight: 20, minLevel: 1 },
            { type: 'potion_mana_large', weight: 10, minLevel: 3 },
            { type: 'potion_cure', weight: 10, minLevel: 1 },
            { type: 'food_bread', weight: 25, minLevel: 1 },
            { type: 'food_meat', weight: 15, minLevel: 2 }
        ];
        
        var eligible = dropWeights.filter(function(e) { return e.minLevel <= level; });
        var totalWeight = 0;
        for (var i = 0; i < eligible.length; i++) {
            totalWeight += eligible[i].weight;
        }
        
        var roll = Math.random() * totalWeight;
        var cumulative = 0;
        for (var i = 0; i < eligible.length; i++) {
            cumulative += eligible[i].weight;
            if (roll < cumulative) {
                return RealmKit.Consumable.create(eligible[i].type);
            }
        }
        
        return null;
    }
};

console.log('[Consumable] Class loaded');