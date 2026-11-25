var RealmKit = RealmKit || {};

RealmKit.MonsterTemplates = {
    goblin_scout: {
        id: 'goblin_scout',
        name: 'Goblin Scout',
        description: 'A quick and sneaky goblin scout.',
        category: 'goblin',
        tier: 1,
        baseStats: {
            hp: 35,
            maxHp: 35,
            mp: 0,
            maxMp: 0,
            attack: 10,
            defense: 2,
            speed: 100,
            critChance: 0.08,
            critMultiplier: 1.5
        },
        behavior: 'hostile',
        aggroRange: 180,
        attackRange: 35,
        patrolSpeed: 60,
        combatSpeed: 100,
        xpValue: 12,
        goldDrop: { min: 3, max: 10 },
        lootTable: 'goblin_basic',
        faction: 'hostile',
        tags: ['goblin', 'humanoid', 'melee'],
        spawnWeight: 100,
        minLevel: 1,
        maxLevel: 10
    },
    
    goblin_warrior: {
        id: 'goblin_warrior',
        name: 'Goblin Warrior',
        description: 'A tougher goblin with a rusty blade.',
        category: 'goblin',
        tier: 1,
        baseStats: {
            hp: 50,
            maxHp: 50,
            mp: 0,
            maxMp: 0,
            attack: 14,
            defense: 4,
            speed: 80,
            critChance: 0.05,
            critMultiplier: 1.4
        },
        behavior: 'hostile',
        aggroRange: 150,
        attackRange: 40,
        patrolSpeed: 50,
        combatSpeed: 80,
        xpValue: 18,
        goldDrop: { min: 5, max: 15 },
        lootTable: 'goblin_warrior',
        faction: 'hostile',
        tags: ['goblin', 'humanoid', 'melee'],
        spawnWeight: 80,
        minLevel: 2,
        maxLevel: 15
    },
    
    goblin_archer: {
        id: 'goblin_archer',
        name: 'Goblin Archer',
        description: 'A goblin with a crude bow.',
        category: 'goblin',
        tier: 1,
        baseStats: {
            hp: 30,
            maxHp: 30,
            mp: 0,
            maxMp: 0,
            attack: 12,
            defense: 2,
            speed: 90,
            critChance: 0.1,
            critMultiplier: 1.6,
            rangedAttack: true,
            projectileSpeed: 400,
            fireRate: 2000
        },
        behavior: 'caster',
        aggroRange: 200,
        attackRange: 150,
        preferredRange: 100,
        patrolSpeed: 50,
        combatSpeed: 70,
        xpValue: 15,
        goldDrop: { min: 4, max: 12 },
        lootTable: 'goblin_basic',
        faction: 'hostile',
        tags: ['goblin', 'humanoid', 'ranged'],
        spawnWeight: 60,
        minLevel: 2,
        maxLevel: 12
    },
    
    goblin_shaman: {
        id: 'goblin_shaman',
        name: 'Goblin Shaman',
        description: 'A goblin magic user with weak spells.',
        category: 'goblin',
        tier: 1,
        baseStats: {
            hp: 25,
            maxHp: 25,
            mp: 50,
            maxMp: 50,
            attack: 8,
            defense: 1,
            speed: 60,
            critChance: 0.12,
            critMultiplier: 1.8,
            abilities: ['fireball_weak']
        },
        behavior: 'caster',
        aggroRange: 220,
        attackRange: 140,
        preferredRange: 100,
        patrolSpeed: 40,
        combatSpeed: 55,
        xpValue: 22,
        goldDrop: { min: 8, max: 20 },
        lootTable: 'caster_basic',
        faction: 'hostile',
        tags: ['goblin', 'humanoid', 'magic'],
        spawnWeight: 30,
        minLevel: 3,
        maxLevel: 15
    },
    
    skeleton: {
        id: 'skeleton',
        name: 'Skeleton',
        description: 'Animated bones of the fallen.',
        category: 'undead',
        tier: 1,
        baseStats: {
            hp: 30,
            maxHp: 30,
            mp: 0,
            maxMp: 0,
            attack: 10,
            defense: 3,
            speed: 70,
            critChance: 0.1,
            critMultiplier: 1.3
        },
        behavior: 'hostile',
        aggroRange: 140,
        attackRange: 38,
        patrolSpeed: 40,
        combatSpeed: 70,
        xpValue: 10,
        goldDrop: { min: 2, max: 8 },
        lootTable: 'undead_basic',
        faction: 'evil',
        tags: ['undead', 'melee'],
        spawnWeight: 100,
        minLevel: 1,
        maxLevel: 8,
        spawnConditions: {
            timeOfDay: ['night', 'dungeon'],
            terrain: ['crypt', 'ruins', 'graveyard']
        }
    },
    
    skeleton_archer: {
        id: 'skeleton_archer',
        name: 'Skeleton Archer',
        description: 'A skeletal archer, forever drawing its bow.',
        category: 'undead',
        tier: 1,
        baseStats: {
            hp: 25,
            maxHp: 25,
            mp: 0,
            maxMp: 0,
            attack: 11,
            defense: 2,
            speed: 60,
            critChance: 0.08,
            critMultiplier: 1.4,
            rangedAttack: true,
            projectileSpeed: 350,
            fireRate: 2500
        },
        behavior: 'caster',
        aggroRange: 180,
        attackRange: 160,
        preferredRange: 120,
        patrolSpeed: 35,
        combatSpeed: 55,
        xpValue: 14,
        goldDrop: { min: 3, max: 10 },
        lootTable: 'undead_basic',
        faction: 'evil',
        tags: ['undead', 'ranged'],
        spawnWeight: 50,
        minLevel: 2,
        maxLevel: 12,
        spawnConditions: {
            timeOfDay: ['night', 'dungeon'],
            terrain: ['crypt', 'ruins', 'graveyard']
        }
    },
    
    zombie: {
        id: 'zombie',
        name: 'Zombie',
        description: 'A rotting corpse that hungers for flesh.',
        category: 'undead',
        tier: 1,
        baseStats: {
            hp: 60,
            maxHp: 60,
            mp: 0,
            maxMp: 0,
            attack: 12,
            defense: 5,
            speed: 40,
            critChance: 0.02,
            critMultiplier: 1.2
        },
        behavior: 'hostile',
        aggroRange: 100,
        attackRange: 35,
        patrolSpeed: 25,
        combatSpeed: 45,
        xpValue: 15,
        goldDrop: { min: 1, max: 5 },
        lootTable: 'undead_basic',
        faction: 'evil',
        tags: ['undead', 'melee', 'slow'],
        spawnWeight: 80,
        minLevel: 1,
        maxLevel: 6,
        abilities: ['infect'],
        spawnConditions: {
            timeOfDay: ['night', 'dungeon']
        }
    },
    
    wolf: {
        id: 'wolf',
        name: 'Wolf',
        description: 'A hungry wolf prowling for prey.',
        category: 'beast',
        tier: 1,
        baseStats: {
            hp: 40,
            maxHp: 40,
            mp: 0,
            maxMp: 0,
            attack: 12,
            defense: 2,
            speed: 150,
            critChance: 0.15,
            critMultiplier: 1.5
        },
        behavior: 'hostile',
        aggroRange: 200,
        attackRange: 30,
        patrolSpeed: 80,
        combatSpeed: 140,
        xpValue: 14,
        goldDrop: { min: 0, max: 3 },
        lootTable: 'beast_basic',
        faction: 'neutral',
        tags: ['beast', 'melee', 'fast'],
        spawnWeight: 100,
        minLevel: 1,
        maxLevel: 8,
        spawnConditions: {
            terrain: ['forest', 'plains', 'hills']
        }
    },
    
    spider_giant: {
        id: 'spider_giant',
        name: 'Giant Spider',
        description: 'A massive arachnid with venomous fangs.',
        category: 'beast',
        tier: 2,
        baseStats: {
            hp: 55,
            maxHp: 55,
            mp: 20,
            maxMp: 20,
            attack: 16,
            defense: 4,
            speed: 90,
            critChance: 0.1,
            critMultiplier: 1.6,
            abilities: ['poison_bite', 'web']
        },
        behavior: 'hostile',
        aggroRange: 160,
        attackRange: 40,
        patrolSpeed: 50,
        combatSpeed: 85,
        xpValue: 25,
        goldDrop: { min: 5, max: 15 },
        lootTable: 'beast_medium',
        faction: 'hostile',
        tags: ['beast', 'melee', 'poison'],
        spawnWeight: 60,
        minLevel: 3,
        maxLevel: 15,
        spawnConditions: {
            terrain: ['forest', 'cave', 'crypt']
        }
    },
    
    orc_grunt: {
        id: 'orc_grunt',
        name: 'Orc Grunt',
        description: 'A strong orc warrior.',
        category: 'orc',
        tier: 2,
        baseStats: {
            hp: 80,
            maxHp: 80,
            mp: 0,
            maxMp: 0,
            attack: 20,
            defense: 6,
            speed: 70,
            critChance: 0.08,
            critMultiplier: 1.5
        },
        behavior: 'hostile',
        aggroRange: 130,
        attackRange: 45,
        patrolSpeed: 45,
        combatSpeed: 70,
        xpValue: 35,
        goldDrop: { min: 10, max: 30 },
        lootTable: 'orc_basic',
        faction: 'hostile',
        tags: ['orc', 'humanoid', 'melee'],
        spawnWeight: 70,
        minLevel: 5,
        maxLevel: 20
    },
    
    orc_berserker: {
        id: 'orc_berserker',
        name: 'Orc Berserker',
        description: 'A frenzied orc warrior.',
        category: 'orc',
        tier: 2,
        baseStats: {
            hp: 100,
            maxHp: 100,
            mp: 0,
            maxMp: 0,
            attack: 28,
            defense: 3,
            speed: 100,
            critChance: 0.2,
            critMultiplier: 2.0,
            abilities: ['rage']
        },
        behavior: 'hostile',
        aggroRange: 180,
        attackRange: 42,
        patrolSpeed: 60,
        combatSpeed: 110,
        xpValue: 50,
        goldDrop: { min: 15, max: 45 },
        lootTable: 'orc_medium',
        faction: 'hostile',
        tags: ['orc', 'humanoid', 'melee', 'berserker'],
        spawnWeight: 30,
        minLevel: 8,
        maxLevel: 25
    },
    
    dark_mage: {
        id: 'dark_mage',
        name: 'Dark Mage',
        description: 'A corrupted spellcaster.',
        category: 'humanoid',
        tier: 2,
        baseStats: {
            hp: 45,
            maxHp: 45,
            mp: 100,
            maxMp: 100,
            attack: 8,
            defense: 2,
            speed: 55,
            critChance: 0.15,
            critMultiplier: 1.8,
            abilities: ['fireball', 'ice_bolt', 'shadow_bolt']
        },
        behavior: 'caster',
        aggroRange: 250,
        attackRange: 180,
        preferredRange: 130,
        patrolSpeed: 35,
        combatSpeed: 50,
        xpValue: 40,
        goldDrop: { min: 15, max: 40 },
        lootTable: 'caster_medium',
        faction: 'hostile',
        tags: ['humanoid', 'magic', 'ranged'],
        spawnWeight: 25,
        minLevel: 6,
        maxLevel: 18
    },
    
    boss_goblin_king: {
        id: 'boss_goblin_king',
        name: 'Goblin King',
        description: 'The ruler of the goblin tribe.',
        category: 'boss',
        tier: 3,
        isBoss: true,
        baseStats: {
            hp: 500,
            maxHp: 500,
            mp: 100,
            maxMp: 100,
            attack: 35,
            defense: 12,
            speed: 80,
            critChance: 0.1,
            critMultiplier: 2.0,
            abilities: ['summon_goblins', 'rage', 'poison_strike']
        },
        behavior: 'hostile',
        aggroRange: 200,
        attackRange: 50,
        patrolSpeed: 0,
        combatSpeed: 90,
        xpValue: 500,
        goldDrop: { min: 100, max: 250 },
        lootTable: 'boss_goblin_king',
        faction: 'hostile',
        tags: ['goblin', 'boss', 'humanoid'],
        spawnWeight: 1,
        minLevel: 12,
        maxLevel: 100,
        spawnConditions: {
            location: 'goblin_throne_room',
            oneTime: true
        }
    },
    
    boss_lich: {
        id: 'boss_lich',
        name: 'Ancient Lich',
        description: 'An undead sorcerer of immense power.',
        category: 'boss',
        tier: 4,
        isBoss: true,
        baseStats: {
            hp: 800,
            maxHp: 800,
            mp: 500,
            maxMp: 500,
            attack: 25,
            defense: 8,
            speed: 50,
            critChance: 0.15,
            critMultiplier: 2.2,
            abilities: ['fireball', 'ice_bolt', 'summon_undead', 'life_drain', 'curse']
        },
        behavior: 'caster',
        aggroRange: 300,
        attackRange: 200,
        preferredRange: 150,
        patrolSpeed: 0,
        combatSpeed: 60,
        xpValue: 1200,
        goldDrop: { min: 300, max: 600 },
        lootTable: 'boss_lich',
        faction: 'evil',
        tags: ['undead', 'boss', 'magic'],
        spawnWeight: 1,
        minLevel: 20,
        maxLevel: 100,
        spawnConditions: {
            location: 'lich_tomb',
            oneTime: true
        }
    }
};

RealmKit.LootTables = {
    goblin_basic: {
        id: 'goblin_basic',
        drops: [
            { itemId: 'gold', weight: 100, min: 3, max: 10 },
            { itemId: 'health_potion', weight: 15, quantity: 1 },
            { itemId: 'rusty_dagger', weight: 5, quantity: 1 },
            { itemId: 'goblin_ear', weight: 20, quantity: 1, quest: true }
        ]
    },
    
    goblin_warrior: {
        id: 'goblin_warrior',
        drops: [
            { itemId: 'gold', weight: 100, min: 5, max: 18 },
            { itemId: 'health_potion', weight: 20, quantity: 1 },
            { itemId: 'iron_sword', weight: 8, quantity: 1 },
            { itemId: 'leather_armor', weight: 5, quantity: 1 },
            { itemId: 'goblin_ear', weight: 25, quantity: 1, quest: true }
        ]
    },
    
    caster_basic: {
        id: 'caster_basic',
        drops: [
            { itemId: 'gold', weight: 100, min: 8, max: 20 },
            { itemId: 'mana_potion', weight: 25, quantity: 1 },
            { itemId: 'health_potion', weight: 15, quantity: 1 },
            { itemId: 'magic_essence', weight: 10, quantity: 1 }
        ]
    },
    
    caster_medium: {
        id: 'caster_medium',
        drops: [
            { itemId: 'gold', weight: 100, min: 15, max: 40 },
            { itemId: 'mana_potion', weight: 30, quantity: 1 },
            { itemId: 'health_potion', weight: 20, quantity: 1 },
            { itemId: 'magic_essence', weight: 15, quantity: 2 },
            { itemId: 'staff', weight: 8, quantity: 1 },
            { itemId: 'robe', weight: 5, quantity: 1 }
        ]
    },
    
    undead_basic: {
        id: 'undead_basic',
        drops: [
            { itemId: 'gold', weight: 100, min: 2, max: 10 },
            { itemId: 'bone_fragment', weight: 40, quantity: 1 },
            { itemId: 'health_potion', weight: 10, quantity: 1 },
            { itemId: 'ancient_coin', weight: 5, quantity: 1, quest: true }
        ]
    },
    
    beast_basic: {
        id: 'beast_basic',
        drops: [
            { itemId: 'gold', weight: 50, min: 0, max: 5 },
            { itemId: 'beast_hide', weight: 60, quantity: 1 },
            { itemId: 'beast_fang', weight: 30, quantity: 1 },
            { itemId: 'raw_meat', weight: 40, quantity: 1 }
        ]
    },
    
    beast_medium: {
        id: 'beast_medium',
        drops: [
            { itemId: 'gold', weight: 60, min: 3, max: 15 },
            { itemId: 'beast_hide', weight: 70, quantity: 1 },
            { itemId: 'beast_fang', weight: 40, quantity: 1 },
            { itemId: 'raw_meat', weight: 50, quantity: 1 },
            { itemId: 'poison_gland', weight: 20, quantity: 1 }
        ]
    },
    
    orc_basic: {
        id: 'orc_basic',
        drops: [
            { itemId: 'gold', weight: 100, min: 10, max: 30 },
            { itemId: 'health_potion', weight: 25, quantity: 1 },
            { itemId: 'iron_axe', weight: 8, quantity: 1 },
            { itemId: 'iron_armor', weight: 5, quantity: 1 },
            { itemId: 'orc_tooth', weight: 30, quantity: 1, quest: true }
        ]
    },
    
    orc_medium: {
        id: 'orc_medium',
        drops: [
            { itemId: 'gold', weight: 100, min: 20, max: 50 },
            { itemId: 'health_potion', weight: 30, quantity: 1 },
            { itemId: 'steel_axe', weight: 10, quantity: 1 },
            { itemId: 'steel_armor', weight: 6, quantity: 1 },
            { itemId: 'orc_tooth', weight: 35, quantity: 1, quest: true }
        ]
    },
    
    boss_goblin_king: {
        id: 'boss_goblin_king',
        drops: [
            { itemId: 'gold', weight: 100, min: 100, max: 250 },
            { itemId: 'goblin_crown', weight: 100, quantity: 1, unique: true },
            { itemId: 'kings_sword', weight: 30, quantity: 1 },
            { itemId: 'royal_armor', weight: 20, quantity: 1 },
            { itemId: 'health_potion', weight: 50, quantity: 3 },
            { itemId: 'mana_potion', weight: 40, quantity: 2 }
        ]
    },
    
    boss_lich: {
        id: 'boss_lich',
        drops: [
            { itemId: 'gold', weight: 100, min: 300, max: 600 },
            { itemId: 'lich_phylactery', weight: 100, quantity: 1, unique: true, quest: true },
            { itemId: 'staff_of_lich', weight: 25, quantity: 1 },
            { itemId: 'robe_of_darkness', weight: 15, quantity: 1 },
            { itemId: 'health_potion', weight: 60, quantity: 5 },
            { itemId: 'mana_potion', weight: 60, quantity: 5 },
            { itemId: 'ancient_tome', weight: 10, quantity: 1 }
        ]
    }
};

RealmKit.MonsterTemplateManager = class MonsterTemplateManager {
    constructor() {
        this.templates = RealmKit.MonsterTemplates;
        this.lootTables = RealmKit.LootTables;
        console.log('[MonsterTemplateManager] Initialized with', Object.keys(this.templates).length, 'templates');
    }
    
    getTemplate(templateId) {
        return this.templates[templateId] || null;
    }
    
    getLootTable(tableId) {
        return this.lootTables[tableId] || null;
    }
    
    getTemplatesByCategory(category) {
        var results = [];
        for (var id in this.templates) {
            if (this.templates[id].category === category) {
                results.push(this.templates[id]);
            }
        }
        return results;
    }
    
    getTemplatesByTier(tier) {
        var results = [];
        for (var id in this.templates) {
            if (this.templates[id].tier === tier) {
                results.push(this.templates[id]);
            }
        }
        return results;
    }
    
    getTemplatesForLevel(level) {
        var results = [];
        for (var id in this.templates) {
            var t = this.templates[id];
            if (level >= t.minLevel && level <= t.maxLevel) {
                results.push(t);
            }
        }
        return results;
    }
    
    getTemplatesForTerrain(terrain, level) {
        var results = [];
        for (var id in this.templates) {
            var t = this.templates[id];
            if (level && (level < t.minLevel || level > t.maxLevel)) continue;
            if (!t.spawnConditions || !t.spawnConditions.terrain) {
                results.push(t);
            } else if (t.spawnConditions.terrain.indexOf(terrain) !== -1) {
                results.push(t);
            }
        }
        return results;
    }
    
    rollLoot(tableId, luck, level) {
        var table = this.getLootTable(tableId);
        if (!table) {
            console.warn('[MonsterTemplateManager] Loot table not found:', tableId);
            return [];
        }
        
        var drops = [];
        var luckBonus = luck || 0;
        var levelScale = level ? Math.max(1, level / 10) : 1;
        
        for (var i = 0; i < table.drops.length; i++) {
            var drop = table.drops[i];
            var effectiveWeight = drop.weight + luckBonus;
            
            if (drop.unique) {
                effectiveWeight = drop.weight;
            }
            
            var roll = Math.random() * 100;
            
            if (roll < effectiveWeight) {
                var item = {
                    itemId: drop.itemId,
                    quantity: drop.quantity || 1,
                    quality: this._calculateQuality(level)
                };
                
                if (drop.min !== undefined && drop.max !== undefined) {
                    var baseQty = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
                    item.quantity = Math.floor(baseQty * levelScale);
                }
                
                if (drop.quest) {
                    item.quest = true;
                }
                
                if (drop.unique) {
                    item.unique = true;
                }
                
                drops.push(item);
            }
        }
        
        console.log('[MonsterTemplateManager] Rolled loot from', tableId, ':', drops.length, 'items', level ? '(lvl ' + level + ')' : '');
        return drops;
    }
    
    _calculateQuality(level) {
        level = level || 1;
        
        var roll = Math.random() * 100;
        var qualityBonus = Math.min(level * 0.5, 25);
        
        if (roll < 5 + qualityBonus * 0.2) {
            return 'legendary';
        } else if (roll < 15 + qualityBonus * 0.4) {
            return 'epic';
        } else if (roll < 35 + qualityBonus * 0.6) {
            return 'rare';
        } else if (roll < 60 + qualityBonus * 0.8) {
            return 'uncommon';
        } else {
            return 'common';
        }
    }
    
    rollLootWithKillData(tableId, killer, victim) {
        var killerLevel = killer && killer.stats ? (killer.level || 1) : 1;
        var victimLevel = victim && victim.template ? (victim.template.minLevel || 1) : 1;
        var effectiveLevel = Math.max(1, Math.floor((killerLevel + victimLevel) / 2));
        
        var luck = 0;
        if (killer && killer.luck) {
            luck = killer.luck;
        }
        
        var loot = this.rollLoot(tableId, luck, effectiveLevel);
        
        if (victim && victim.goldDrop) {
            var goldMin = victim.goldDrop.min || 0;
            var goldMax = victim.goldDrop.max || 0;
            var levelMultiplier = 1 + (effectiveLevel - 1) * 0.1;
            var gold = Math.floor((goldMin + Math.random() * (goldMax - goldMin)) * levelMultiplier);
            if (gold > 0) {
                loot.push({ itemId: 'gold', quantity: gold, quality: 'common' });
            }
        }
        
        return loot;
    }
    
    createEntity(templateId, overrides) {
        var template = this.getTemplate(templateId);
        if (!template) {
            console.error('[MonsterTemplateManager] Template not found:', templateId);
            return null;
        }
        
        var entity = Object.assign({}, template.baseStats);
        entity.id = overrides && overrides.id ? overrides.id : templateId + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        entity.templateId = templateId;
        entity.name = overrides && overrides.name ? overrides.name : template.name;
        entity.behavior = template.behavior;
        entity.aggroRange = template.aggroRange;
        entity.attackRange = template.attackRange;
        entity.preferredRange = template.preferredRange;
        entity.faction = template.faction;
        entity.xpValue = template.xpValue;
        entity.goldDrop = template.goldDrop;
        entity.lootTable = template.lootTable;
        entity.isBoss = template.isBoss || false;
        
        if (overrides) {
            for (var key in overrides) {
                if (overrides.hasOwnProperty(key) && key !== 'baseStats') {
                    entity[key] = overrides[key];
                }
            }
            
            if (overrides.stats) {
                for (var stat in overrides.stats) {
                    entity[stat] = overrides.stats[stat];
                }
            }
        }
        
        console.log('[MonsterTemplateManager] Created entity:', entity.id, 'from template:', templateId);
        return entity;
    }
    
    registerTemplate(template) {
        if (!template.id) {
            console.error('[MonsterTemplateManager] Template must have an id');
            return false;
        }
        this.templates[template.id] = template;
        console.log('[MonsterTemplateManager] Registered template:', template.id);
        return true;
    }
    
    registerLootTable(table) {
        if (!table.id) {
            console.error('[MonsterTemplateManager] Loot table must have an id');
            return false;
        }
        this.lootTables[table.id] = table;
        console.log('[MonsterTemplateManager] Registered loot table:', table.id);
        return true;
    }
};

console.log('[MonsterTemplates] Module loaded');