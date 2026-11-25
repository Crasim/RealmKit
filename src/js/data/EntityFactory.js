var RealmKit = RealmKit || {};

RealmKit.Factions = {
    PLAYER: 'player',
    FRIENDLY: 'friendly',
    NEUTRAL: 'neutral',
    HOSTILE: 'hostile',
    EVIL: 'evil'
};

RealmKit.FactionRelations = {
    player: { player: 'friend', friendly: 'friend', neutral: 'neutral', hostile: 'foe', evil: 'foe' },
    friendly: { player: 'friend', friendly: 'friend', neutral: 'neutral', hostile: 'foe', evil: 'foe' },
    neutral: { player: 'neutral', friendly: 'neutral', neutral: 'neutral', hostile: 'foe', evil: 'foe' },
    hostile: { player: 'foe', friendly: 'foe', neutral: 'foe', hostile: 'friend', evil: 'friend' },
    evil: { player: 'foe', friendly: 'foe', neutral: 'foe', hostile: 'friend', evil: 'friend' }
};

RealmKit.EntityTemplates = {
    player: {
        type: 'player',
        name: 'Player',
        width: 32,
        height: 48,
        speed: 150,
        solid: true,
        collideWithEntities: true,
        stats: {
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            attack: 15,
            defense: 5,
            speed: 100,
            critChance: 0.1,
            critMultiplier: 2,
            abilities: ['basic_attack', 'power_strike']
        }
    },
    
    npc_villager: {
        type: 'npc',
        name: 'Villager',
        width: 32,
        height: 48,
        speed: 50,
        solid: true,
        collideWithEntities: true,
        behavior: 'wander',
        wanderRadius: 60,
        interactable: true,
        interactionRadius: 64,
        dialog: ['Hello there!', 'Nice weather today.'],
        stats: {
            hp: 50,
            maxHp: 50,
            mp: 20,
            maxMp: 20,
            attack: 5,
            defense: 2,
            speed: 50
        }
    },
    
    enemy_goblin: {
        type: 'enemy',
        name: 'Goblin',
        width: 32,
        height: 48,
        speed: 80,
        solid: true,
        collideWithEntities: true,
        behavior: 'hostile',
        aggroRange: 200,
        attackRange: 40,
        stats: {
            hp: 40,
            maxHp: 40,
            mp: 10,
            maxMp: 10,
            attack: 12,
            defense: 3,
            speed: 80,
            critChance: 0.05,
            critMultiplier: 1.5,
            xpValue: 15,
            loot: [
                { id: 'gold', chance: 0.8, min: 5, max: 15 },
                { id: 'health_potion', chance: 0.1, quantity: 1 }
            ]
        }
    },
    
    enemy_skeleton: {
        type: 'enemy',
        name: 'Skeleton',
        width: 32,
        height: 48,
        speed: 60,
        solid: true,
        collideWithEntities: true,
        behavior: 'hostile',
        aggroRange: 150,
        attackRange: 45,
        stats: {
            hp: 30,
            maxHp: 30,
            mp: 0,
            maxMp: 0,
            attack: 10,
            defense: 2,
            speed: 60,
            critChance: 0.1,
            critMultiplier: 1.3,
            xpValue: 10,
            loot: [
                { id: 'gold', chance: 0.5, min: 2, max: 8 },
                { id: 'bone', chance: 0.3, quantity: 1 }
            ]
        }
    },
    
    enemy_mage: {
        type: 'enemy',
        name: 'Dark Mage',
        width: 32,
        height: 48,
        speed: 50,
        solid: true,
        collideWithEntities: true,
        behavior: 'caster',
        aggroRange: 250,
        attackRange: 150,
        preferredRange: 120,
        stats: {
            hp: 25,
            maxHp: 25,
            mp: 100,
            maxMp: 100,
            attack: 8,
            defense: 1,
            speed: 50,
            critChance: 0.15,
            critMultiplier: 1.8,
            xpValue: 25,
            abilities: ['fireball', 'ice_bolt'],
            elemental: { fire: 10, ice: 5 },
            loot: [
                { id: 'gold', chance: 0.9, min: 10, max: 25 },
                { id: 'mana_potion', chance: 0.2, quantity: 1 },
                { id: 'staff', chance: 0.05, quantity: 1 }
            ]
        }
    },
    
    item_health_potion: {
        type: 'item',
        name: 'Health Potion',
        subtype: 'consumable',
        width: 16,
        height: 16,
        solid: false,
        stackable: true,
        maxStack: 20,
        effect: {
            type: 'heal',
            amount: 50
        },
        icon: '♥',
        description: 'Restores 50 HP'
    },
    
    item_mana_potion: {
        type: 'item',
        name: 'Mana Potion',
        subtype: 'consumable',
        width: 16,
        height: 16,
        solid: false,
        stackable: true,
        maxStack: 20,
        effect: {
            type: 'restore_mp',
            amount: 30
        },
        icon: '♦',
        description: 'Restores 30 MP'
    },
    
    chest: {
        type: 'container',
        name: 'Treasure Chest',
        width: 32,
        height: 32,
        solid: true,
        interactable: true,
        locked: false,
        lootTable: [
            { id: 'gold', chance: 1.0, min: 10, max: 50 },
            { id: 'health_potion', chance: 0.5, quantity: 1 },
            { id: 'weapon_sword', chance: 0.1, quantity: 1 }
        ]
    },
    
    door: {
        type: 'door',
        name: 'Door',
        width: 32,
        height: 48,
        solid: true,
        interactable: true,
        open: false,
        targetMap: null,
        targetSpawn: null
    }
};

RealmKit.EntityFactory = class EntityFactory {
    static create(templateId, overrides) {
        var template = RealmKit.EntityTemplates[templateId];
        
        if (!template) {
            console.error('[EntityFactory] Unknown template:', templateId);
            return null;
        }
        
        var entity = Object.assign({}, template, overrides || {});
        entity.templateId = templateId;
        entity.id = overrides && overrides.id ? overrides.id : templateId + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        
        if (template.stats) {
            entity.stats = Object.assign({}, template.stats, (overrides && overrides.stats) || {});
        }
        
        if (template.loot) {
            entity.loot = template.loot.slice();
        }
        
        console.log('[EntityFactory] Created:', entity.id, 'from template:', templateId);
        return entity;
    }
    
    static registerTemplate(templateId, template) {
        RealmKit.EntityTemplates[templateId] = template;
        console.log('[EntityFactory] Registered template:', templateId);
    }
    
    static getTemplate(templateId) {
        return RealmKit.EntityTemplates[templateId] || null;
    }
    
    static listTemplates() {
        return Object.keys(RealmKit.EntityTemplates);
    }
};

console.log('[EntityFactory] Module loaded');