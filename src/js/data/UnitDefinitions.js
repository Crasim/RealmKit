var RealmKit = RealmKit || {};

/**
 * UnitDefinitions - Template-based unit creation system
 * All units (player, NPC, enemies, animals) are created from templates
 * Runtime behavior determined by: faction, partyId, playerControlled
 */

RealmKit.UnitCategories = {
    HERO: 'hero',           // Story characters, can be player controlled
    CREATURE: 'creature',   // Animals, monsters, can be recruited
    SOLDIER: 'soldier',     // Basic combat units
    CIVILIAN: 'civilian',   // Non-combat NPCs
    PROP: 'prop',           // Chests, doors (interactable world objects)
    DECORATION: 'decoration' // Non-interactable visual elements
};

RealmKit.UnitTemplates = {
    // Heroes - Start as player faction, always controllable
    hero_knight: {
        id: 'hero_knight',
        category: RealmKit.UnitCategories.HERO,
        type: 'hero',
        name: 'Knight',
        description: 'A stalwart defender',
        defaultFaction: 'player',
        controllable: true,
        recruitable: false,
        hasAI: false,  // Heroes don't use AI when not player-controlled
        width: 32,
        height: 48,
        baseStats: {
            hp: 100,
            maxHp: 100,
            mp: 30,
            maxMp: 30,
            attack: 15,
            defense: 8,
            speed: 100,
            critChance: 0.1,
            critMultiplier: 2.0,
            str: 16,
            dex: 12,
            con: 14,
            int: 10,
            wis: 12,
            cha: 10
        },
        equipmentSlots: ['weapon', 'offhand', 'helmet', 'armor', 'boots', 'accessory1', 'accessory2'],
        abilities: ['slash', 'shield_bash', 'taunt'],
        sprite: 'hero_knight',
        spriteBase: 'Male-Hero',
        spriteExt: 'Male_Hero_Ext_32-bit',
        manifestKey: 'humanoid_base',
        manifestExtKey: 'humanoid_ext',
        soundSet: 'human_male',
        levelUpStats: ['str', 'con'],
        xpToLevel: 100
    },

    hero_ranger: {
        id: 'hero_ranger',
        category: RealmKit.UnitCategories.HERO,
        type: 'hero',
        name: 'Ranger',
        description: 'A skilled archer',
        defaultFaction: 'player',
        controllable: true,
        recruitable: false,
        hasAI: false,
        width: 32,
        height: 48,
        baseStats: {
            hp: 80,
            maxHp: 80,
            mp: 40,
            maxMp: 40,
            attack: 18,
            defense: 5,
            speed: 120,
            critChance: 0.15,
            critMultiplier: 2.0,
            str: 12,
            dex: 16,
            con: 12,
            int: 10,
            wis: 14,
            cha: 10
        },
        equipmentSlots: ['weapon', 'offhand', 'helmet', 'armor', 'boots', 'accessory1', 'accessory2'],
        abilities: ['aimed_shot', 'rapid_fire', 'tracking'],
        sprite: 'hero_ranger',
        spriteBase: 'Female-Hero',
        spriteExt: 'Female_Hero_Ext_32-bit',
        manifestKey: 'humanoid_base',
        manifestExtKey: 'humanoid_ext',
        soundSet: 'human_female',
        levelUpStats: ['dex', 'wis'],
        xpToLevel: 100
    },

    hero_mage: {
        id: 'hero_mage',
        category: RealmKit.UnitCategories.HERO,
        type: 'hero',
        name: 'Mage',
        description: 'A wielder of arcane power',
        defaultFaction: 'player',
        controllable: true,
        recruitable: false,
        hasAI: false,
        width: 32,
        height: 48,
        baseStats: {
            hp: 60,
            maxHp: 60,
            mp: 100,
            maxMp: 100,
            attack: 8,
            defense: 3,
            speed: 90,
            critChance: 0.1,
            critMultiplier: 1.8,
            str: 8,
            dex: 12,
            con: 10,
            int: 16,
            wis: 14,
            cha: 10
        },
        equipmentSlots: ['weapon', 'offhand', 'helmet', 'armor', 'boots', 'accessory1', 'accessory2'],
        abilities: ['fireball', 'ice_bolt', 'magic_missile', 'shield'],
        sprite: 'hero_mage',
        soundSet: 'human_male',
        levelUpStats: ['int', 'wis'],
        xpToLevel: 100
    },

    // Creatures - Can become allies through faction change or recruitment
    creature_goblin_grunt: {
        id: 'creature_goblin_grunt',
        category: RealmKit.UnitCategories.CREATURE,
        type: 'npc',
        name: 'Goblin Grunt',
        description: 'A basic goblin warrior',
        defaultFaction: 'hostile',
        controllable: true,
        recruitable: true,
        hasAI: true,
        aiBehavior: 'hostile',
        width: 32,
        height: 48,
        baseStats: {
            hp: 40,
            maxHp: 40,
            mp: 0,
            maxMp: 0,
            attack: 12,
            defense: 3,
            speed: 90,
            critChance: 0.05,
            critMultiplier: 1.5,
            str: 12,
            dex: 14,
            con: 10,
            int: 6,
            wis: 8,
            cha: 6
        },
        equipmentSlots: ['weapon', 'armor'],
        abilities: ['slash'],
        sprite: 'goblin_grunt',
        spriteBase: 'Goblin',
        spriteExt: 'Goblin_Ext_32-bit',
        manifestKey: 'humanoid_base',
        manifestExtKey: 'humanoid_ext',
        soundSet: 'goblin',
        aggroRange: 150,
        attackRange: 40,
        xpValue: 15,
        goldDrop: { min: 3, max: 8 },
        lootTable: 'goblin_basic'
    },

    creature_skeleton: {
        id: 'creature_skeleton',
        category: RealmKit.UnitCategories.CREATURE,
        type: 'npc',
        name: 'Skeleton',
        description: 'An undead skeleton warrior',
        defaultFaction: 'hostile',
        controllable: true,
        recruitable: false,
        hasAI: true,
        aiBehavior: 'hostile',
        width: 32,
        height: 48,
        baseStats: {
            hp: 50,
            maxHp: 50,
            mp: 0,
            maxMp: 0,
            attack: 14,
            defense: 6,
            speed: 70,
            critChance: 0.05,
            critMultiplier: 1.5,
            str: 14,
            dex: 8,
            con: 12,
            int: 4,
            wis: 6,
            cha: 4
        },
        equipmentSlots: ['weapon', 'armor'],
        abilities: ['slash'],
        sprite: 'skeleton',
        soundSet: 'skeleton',
        aggroRange: 150,
        attackRange: 45,
        xpValue: 20,
        goldDrop: { min: 2, max: 6 },
        lootTable: 'undead_basic'
    },

    creature_goblin_archer: {
        id: 'creature_goblin_archer',
        category: RealmKit.UnitCategories.CREATURE,
        type: 'npc',
        name: 'Goblin Archer',
        description: 'A ranged goblin attacker',
        defaultFaction: 'hostile',
        controllable: true,
        recruitable: true,
        hasAI: true,
        aiBehavior: 'ranged',
        width: 32,
        height: 48,
        baseStats: {
            hp: 30,
            maxHp: 30,
            mp: 0,
            maxMp: 0,
            attack: 10,
            defense: 2,
            speed: 80,
            critChance: 0.1,
            critMultiplier: 1.6,
            str: 10,
            dex: 16,
            con: 8,
            int: 6,
            wis: 10,
            cha: 6
        },
        equipmentSlots: ['weapon'],
        abilities: ['shoot'],
        sprite: 'goblin_archer',
        soundSet: 'goblin',
        aggroRange: 200,
        attackRange: 150,
        preferredRange: 100,
        xpValue: 18,
        goldDrop: { min: 4, max: 10 },
        lootTable: 'goblin_basic'
    },

    creature_wolf: {
        id: 'creature_wolf',
        category: RealmKit.UnitCategories.CREATURE,
        type: 'npc',
        name: 'Wolf',
        description: 'A wild wolf',
        defaultFaction: 'wild',
        controllable: true,
        recruitable: true,
        hasAI: true,
        aiBehavior: 'pack',
        width: 32,
        height: 32,
        baseStats: {
            hp: 35,
            maxHp: 35,
            mp: 0,
            maxMp: 0,
            attack: 14,
            defense: 4,
            speed: 140,
            critChance: 0.15,
            critMultiplier: 1.4,
            str: 14,
            dex: 16,
            con: 12,
            int: 6,
            wis: 12,
            cha: 6
        },
        equipmentSlots: [], // Natural weapons only
        abilities: ['bite', 'pack_tactics'],
        sprite: 'wolf',
        soundSet: 'wolf',
        aggroRange: 180,
        attackRange: 30,
        xpValue: 12,
        goldDrop: { min: 0, max: 2 },
        lootTable: 'animal_basic'
    },

    creature_bear: {
        id: 'creature_bear',
        category: RealmKit.UnitCategories.CREATURE,
        type: 'npc',
        name: 'Bear',
        description: 'A powerful bear',
        defaultFaction: 'wild',
        controllable: true,
        recruitable: false, // Too wild to recruit normally
        hasAI: true,
        aiBehavior: 'defensive',
        width: 48,
        height: 48,
        baseStats: {
            hp: 80,
            maxHp: 80,
            mp: 0,
            maxMp: 0,
            attack: 20,
            defense: 8,
            speed: 100,
            critChance: 0.1,
            critMultiplier: 1.8,
            str: 18,
            dex: 10,
            con: 16,
            int: 4,
            wis: 12,
            cha: 6
        },
        equipmentSlots: [],
        abilities: ['claw', 'maul', 'roar'],
        sprite: 'bear',
        soundSet: 'bear',
        aggroRange: 120,
        attackRange: 50,
        xpValue: 35,
        goldDrop: { min: 0, max: 5 },
        lootTable: 'animal_rare'
    },

    // Civilians - Townsfolk, merchants, quest givers
    civilian_villager: {
        id: 'civilian_villager',
        category: RealmKit.UnitCategories.CIVILIAN,
        type: 'npc',
        name: 'Villager',
        description: 'A common villager',
        defaultFaction: 'friendly',
        controllable: false,
        recruitable: true,
        hasAI: true,
        aiBehavior: 'wander',
        width: 32,
        height: 48,
        baseStats: {
            hp: 20,
            maxHp: 20,
            mp: 0,
            maxMp: 0,
            attack: 2,
            defense: 0,
            speed: 60,
            critChance: 0,
            critMultiplier: 1,
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10
        },
        equipmentSlots: [],
        abilities: [],
        sprite: 'villager',
        soundSet: 'human',
        interactable: true,
        interactionRadius: 64,
        dialog: ['Hello traveler!', 'Nice weather today.'],
        wanderRadius: 100
    },

    civilian_merchant: {
        id: 'civilian_merchant',
        category: RealmKit.UnitCategories.CIVILIAN,
        type: 'npc',
        name: 'Merchant',
        description: 'A traveling merchant',
        defaultFaction: 'friendly',
        controllable: false,
        recruitable: false,
        hasAI: true,
        aiBehavior: 'schedule',
        width: 32,
        height: 48,
        baseStats: {
            hp: 25,
            maxHp: 25,
            mp: 0,
            maxMp: 0,
            attack: 3,
            defense: 1,
            speed: 50,
            critChance: 0,
            critMultiplier: 1,
            str: 10,
            dex: 10,
            con: 10,
            int: 12,
            wis: 12,
            cha: 14
        },
        equipmentSlots: [],
        abilities: [],
        sprite: 'merchant',
        soundSet: 'human',
        interactable: true,
        interactionRadius: 64,
        hasShop: true,
        shopInventory: 'basic_goods'
    },

    // Props - Interactable world objects
    prop_chest: {
        id: 'prop_chest',
        category: RealmKit.UnitCategories.PROP,
        name: 'Treasure Chest',
        description: 'A sturdy chest',
        defaultFaction: 'neutral',
        controllable: false,
        recruitable: false,
        hasAI: false,
        width: 32,
        height: 32,
        baseStats: {
            hp: 50,
            maxHp: 50,
            defense: 5,
            speed: 0
        },
        solid: true,
        interactable: true,
        interactionRadius: 48,
        sprite: 'chest_closed',
        lootTable: 'chest_basic',
        locked: false
    },

    prop_door: {
        id: 'prop_door',
        category: RealmKit.UnitCategories.PROP,
        name: 'Door',
        description: 'A wooden door',
        defaultFaction: 'neutral',
        controllable: false,
        recruitable: false,
        hasAI: false,
        width: 32,
        height: 48,
        baseStats: {
            hp: 30,
            maxHp: 30,
            defense: 2,
            speed: 0
        },
        solid: true,
        interactable: true,
        interactionRadius: 48,
        sprite: 'door_closed',
        open: false,
        locked: false
    },

    prop_sign: {
        id: 'prop_sign',
        category: RealmKit.UnitCategories.PROP,
        name: 'Sign',
        description: 'A wooden sign',
        defaultFaction: 'neutral',
        controllable: false,
        recruitable: false,
        hasAI: false,
        width: 32,
        height: 32,
        baseStats: {
            hp: 10,
            maxHp: 10,
            defense: 0,
            speed: 0
        },
        solid: true,
        interactable: true,
        interactionRadius: 48,
        sprite: 'sign',
        signText: 'Welcome to Town'
    },

    // Guard Tower example - Active building
    prop_guard_tower: {
        id: 'prop_guard_tower',
        category: RealmKit.UnitCategories.PROP,
        name: 'Guard Tower',
        description: 'An automated defense tower',
        defaultFaction: 'player',
        controllable: false,
        recruitable: false,
        hasAI: true,
        aiBehavior: 'turret',
        width: 64,
        height: 96,
        baseStats: {
            hp: 200,
            maxHp: 200,
            attack: 25,
            defense: 10,
            speed: 0
        },
        solid: true,
        immovable: true,
        sprite: 'guard_tower',
        aggroRange: 250,
        attackRange: 200,
        attackCooldown: 1500,
        abilities: ['arrow_volley']
    }
};

/**
 * UnitFactory - Creates units from templates with runtime state
 */
RealmKit.UnitFactory = class UnitFactory {
    constructor() {
        this.templates = RealmKit.UnitTemplates;
        this.unitCounter = 0;
    }

    /**
     * Create a unit from template
     * @param {string} templateId - The template ID
     * @param {Object} overrides - Properties to override
     * @returns {Object} New unit instance
     */
    create(templateId, overrides) {
        var template = this.templates[templateId];
        
        if (!template) {
            console.error('[UnitFactory] Unknown template:', templateId);
            return null;
        }

        this.unitCounter++;
        
        // Create base unit from template
        var unit = {
            // Identity
            id: overrides?.id || (templateId + '_' + Date.now() + '_' + this.unitCounter),
            templateId: templateId,
            category: template.category,
            type: overrides?.type || template.type || 'entity',
            name: overrides?.name || template.name,
            
            // Position
            x: overrides?.x || 0,
            y: overrides?.y || 0,
            width: template.width || 32,
            height: template.height || 32,
            
            // Movement
            velocityX: 0,
            velocityY: 0,
            speed: template.baseStats?.speed || 100,
            
            // Visual
            sprite: template.sprite || null,
            manifest: null, // Set by engine
            animation: 'idle_down',
            animationFrame: 0,
            animationTime: 0,
            direction: 'down',
            
            // State
            active: true,
            visible: true,
            solid: template.solid !== false,
            collidable: template.solid !== false,
            interactable: template.interactable || false,
            interactionRadius: template.interactionRadius || 48,
            
            // Faction (can be changed at runtime)
            faction: overrides?.faction || template.defaultFaction,
            originalFaction: template.defaultFaction,
            
            // Party (null = not in a party)
            partyId: overrides?.partyId || null,
            isPartyLeader: overrides?.isPartyLeader || false,
            
            // Player control
            playerControlled: overrides?.playerControlled || false,
            controllable: template.controllable,
            
            // Recruitment
            recruitable: template.recruitable || false,
            
            // AI
            hasAI: template.hasAI || false,
            aiBehavior: template.aiBehavior || 'idle',
            aiState: 'idle',
            aiTime: 0,
            
            // Combat
            combatStats: template.baseStats ? Object.assign({}, template.baseStats) : null,
            attackCooldown: 0,
            inCombat: false,
            combatTarget: null,
            
            // Combat ranges (if applicable)
            aggroRange: template.aggroRange || 150,
            attackRange: template.attackRange || 40,
            preferredRange: template.preferredRange || null,
            
            // Death
            deathTime: 0,
            deathLingerTime: 3000,
            deathDespawnTime: 300000,
            
            // Loot
            deadBodyLoot: null,
            lootDropped: false,
            
            // Equipment
            equipmentSlots: template.equipmentSlots || [],
            equipment: {}, // slot -> item mapping
            
            // Abilities
            abilities: template.abilities || [],
            
            // Equipment/Template-specific data
            equipmentManager: null, // Set by engine
            
            // Interactions (for NPCs/props)
            dialog: template.dialog || null,
            hasShop: template.hasShop || false,
            shopInventory: template.shopInventory || null,
            
            // Schedule (for NPCs with schedules)
            schedule: null,
            
            // Prop-specific
            open: template.open || false,
            locked: template.locked || false,
            signText: template.signText || null,
            
            // Leveling (for heroes)
            level: 1,
            xp: 0,
            xpToLevel: template.xpToLevel || null,
            levelUpStats: template.levelUpStats || null,
            
            // Visual effects
            hitFlashTime: 0
        };

        console.log('[UnitFactory] Created:', unit.id, 'from template:', templateId);
        return unit;
    }

    /**
     * Register a new template
     * @param {string} templateId 
     * @param {Object} template 
     */
    registerTemplate(templateId, template) {
        this.templates[templateId] = template;
        console.log('[UnitFactory] Registered template:', templateId);
    }

    /**
     * Get template definition
     * @param {string} templateId
     * @returns {Object|null}
     */
    getTemplate(templateId) {
        return this.templates[templateId] || null;
    }

    /**
     * Get all templates in a category
     * @param {string} category
     * @returns {Array}
     */
    getTemplatesByCategory(category) {
        var results = [];
        for (var id in this.templates) {
            if (this.templates[id].category === category) {
                results.push(this.templates[id]);
            }
        }
        return results;
    }

    /**
     * Get all recruitable unit templates
     * @returns {Array}
     */
    getRecruitableTemplates() {
        var results = [];
        for (var id in this.templates) {
            if (this.templates[id].recruitable) {
                results.push(this.templates[id]);
            }
        }
        return results;
    }

    /**
     * Check if unit can join a party based on faction
     * @param {Object} unit
     * @param {string} partyFaction
     * @returns {boolean}
     */
    canJoinParty(unit, partyFaction) {
        if (!unit.recruitable) return false;
        
        // Check faction relations
        var relation = this.getFactionRelation(unit.faction, partyFaction);
        return relation === 'friend' || relation === 'neutral';
    }

    /**
     * Get faction relation
     * @param {string} factionA
     * @param {string} factionB
     * @returns {string}
     */
    getFactionRelation(factionA, factionB) {
        if (factionA === factionB) return 'friend';
        
        var relations = {
            player: { friendly: 'friend', neutral: 'neutral', hostile: 'foe', evil: 'foe', wild: 'neutral' },
            friendly: { player: 'friend', neutral: 'neutral', hostile: 'foe', evil: 'foe', wild: 'neutral' },
            neutral: { player: 'neutral', friendly: 'neutral', hostile: 'foe', evil: 'foe', wild: 'neutral' },
            hostile: { player: 'foe', friendly: 'foe', neutral: 'foe', evil: 'friend', wild: 'foe' },
            evil: { player: 'foe', friendly: 'foe', neutral: 'foe', hostile: 'friend', wild: 'foe' },
            wild: { player: 'neutral', friendly: 'neutral', neutral: 'neutral', hostile: 'foe', evil: 'foe' }
        };
        
        return (relations[factionA] && relations[factionA][factionB]) || 'neutral';
    }

    /**
     * Change unit faction (e.g., charm spell, diplomacy)
     * @param {Object} unit
     * @param {string} newFaction
     */
    changeFaction(unit, newFaction) {
        console.log('[UnitFactory]', unit.name, 'faction changed:', unit.faction, '->', newFaction);
        unit.faction = newFaction;
    }

    /**
     * Add unit to party
     * @param {Object} unit
     * @param {string} partyId
     * @param {boolean} isLeader
     */
    addToParty(unit, partyId, isLeader) {
        unit.partyId = partyId;
        unit.isPartyLeader = isLeader || false;
        unit.controllable = true; // Party members can be controlled
        console.log('[UnitFactory]', unit.name, 'joined party:', partyId);
    }

    /**
     * Remove unit from party
     * @param {Object} unit
     */
    removeFromParty(unit) {
        unit.partyId = null;
        unit.isPartyLeader = false;
        unit.playerControlled = false;
        console.log('[UnitFactory]', unit.name, 'left party');
    }

    /**
     * Switch player control to a unit
     * @param {Object} fromUnit - Currently controlled unit
     * @param {Object} toUnit - Unit to control
     */
    switchControl(fromUnit, toUnit) {
        if (fromUnit) {
            fromUnit.playerControlled = false;
        }
        
        if (toUnit && toUnit.controllable) {
            toUnit.playerControlled = true;
            console.log('[UnitFactory] Control switched to:', toUnit.name);
            return true;
        }
        
        return false;
    }
};

console.log('[UnitDefinitions] Module loaded with', Object.keys(RealmKit.UnitTemplates).length, 'templates');
