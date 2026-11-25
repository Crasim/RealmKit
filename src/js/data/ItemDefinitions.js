var RealmKit = RealmKit || {};

RealmKit.ItemRarities = {
    common: {
        id: 'common',
        name: 'Common',
        color: '#aaaaaa',
        statMult: 1.0,
        dropWeight: 60
    },
    uncommon: {
        id: 'uncommon',
        name: 'Uncommon',
        color: '#1eff00',
        statMult: 1.2,
        dropWeight: 25
    },
    rare: {
        id: 'rare',
        name: 'Rare',
        color: '#0070dd',
        statMult: 1.5,
        dropWeight: 10
    },
    epic: {
        id: 'epic',
        name: 'Epic',
        color: '#a335ee',
        statMult: 2.0,
        dropWeight: 4
    },
    legendary: {
        id: 'legendary',
        name: 'Legendary',
        color: '#ff8000',
        statMult: 3.0,
        dropWeight: 1
    }
};

RealmKit.EquipmentSlots = {
    head: { id: 'head', name: 'Head', icon: 'head' },
    chest: { id: 'chest', name: 'Chest', icon: 'chest' },
    legs: { id: 'legs', name: 'Legs', icon: 'legs' },
    feet: { id: 'feet', name: 'Feet', icon: 'feet' },
    mainHand: { id: 'mainHand', name: 'Main Hand', icon: 'mainHand' },
    offHand: { id: 'offHand', name: 'Off Hand', icon: 'offHand' },
    accessory: { id: 'accessory', name: 'Accessory', icon: 'ring' }
};

RealmKit.ItemTemplates = {
    head: {
        leather_cap: {
            id: 'leather_cap',
            name: 'Leather Cap',
            slot: 'head',
            category: 'armor',
            baseStats: { defense: 2 },
            weight: 1,
            value: 15
        },
        iron_helm: {
            id: 'iron_helm',
            name: 'Iron Helm',
            slot: 'head',
            category: 'armor',
            baseStats: { defense: 5, hp: 10 },
            weight: 3,
            value: 50
        },
        steel_helm: {
            id: 'steel_helm',
            name: 'Steel Helm',
            slot: 'head',
            category: 'armor',
            baseStats: { defense: 8, hp: 20 },
            weight: 4,
            value: 150
        },
        wizard_hat: {
            id: 'wizard_hat',
            name: 'Wizard Hat',
            slot: 'head',
            category: 'armor',
            baseStats: { mp: 15, attack: 2 },
            weight: 0.5,
            value: 80
        },
        crown_thorns: {
            id: 'crown_thorns',
            name: 'Crown of Thorns',
            slot: 'head',
            category: 'armor',
            baseStats: { defense: 3, hp: 30, critChance: 0.02 },
            weight: 2,
            value: 300,
            rarity: 'rare'
        }
    },
    
    chest: {
        leather_vest: {
            id: 'leather_vest',
            name: 'Leather Vest',
            slot: 'chest',
            category: 'armor',
            baseStats: { defense: 3 },
            weight: 2,
            value: 20
        },
        iron_armor: {
            id: 'iron_armor',
            name: 'Iron Armor',
            slot: 'chest',
            category: 'armor',
            baseStats: { defense: 8, hp: 25 },
            weight: 6,
            value: 80
        },
        steel_armor: {
            id: 'steel_armor',
            name: 'Steel Armor',
            slot: 'chest',
            category: 'armor',
            baseStats: { defense: 12, hp: 40 },
            weight: 8,
            value: 250
        },
        robe_apprentice: {
            id: 'robe_apprentice',
            name: "Apprentice's Robe",
            slot: 'chest',
            category: 'armor',
            baseStats: { mp: 20, defense: 2 },
            weight: 1,
            value: 60
        },
        robe_archmage: {
            id: 'robe_archmage',
            name: "Archmage's Robe",
            slot: 'chest',
            category: 'armor',
            baseStats: { mp: 50, attack: 8, defense: 4 },
            weight: 1,
            value: 500,
            rarity: 'epic'
        },
        royal_armor: {
            id: 'royal_armor',
            name: 'Royal Armor',
            slot: 'chest',
            category: 'armor',
            baseStats: { defense: 15, hp: 60, blockChance: 0.05 },
            weight: 10,
            value: 800,
            rarity: 'legendary'
        }
    },
    
    legs: {
        leather_legs: {
            id: 'leather_legs',
            name: 'Leather Leggings',
            slot: 'legs',
            category: 'armor',
            baseStats: { defense: 2 },
            weight: 1.5,
            value: 15
        },
        iron_legs: {
            id: 'iron_legs',
            name: 'Iron Greaves',
            slot: 'legs',
            category: 'armor',
            baseStats: { defense: 5, speed: -5 },
            weight: 4,
            value: 60
        },
        steel_legs: {
            id: 'steel_legs',
            name: 'Steel Greaves',
            slot: 'legs',
            category: 'armor',
            baseStats: { defense: 7, hp: 15, speed: -5 },
            weight: 5,
            value: 180
        },
        robes_skirt: {
            id: 'robes_skirt',
            name: 'Robe Skirt',
            slot: 'legs',
            category: 'armor',
            baseStats: { defense: 1, mp: 10 },
            weight: 0.5,
            value: 40
        }
    },
    
    feet: {
        leather_boots: {
            id: 'leather_boots',
            name: 'Leather Boots',
            slot: 'feet',
            category: 'armor',
            baseStats: { defense: 1, speed: 5 },
            weight: 1,
            value: 12
        },
        iron_boots: {
            id: 'iron_boots',
            name: 'Iron Boots',
            slot: 'feet',
            category: 'armor',
            baseStats: { defense: 3, speed: -3 },
            weight: 3,
            value: 45
        },
        steel_boots: {
            id: 'steel_boots',
            name: 'Steel Boots',
            slot: 'feet',
            category: 'armor',
            baseStats: { defense: 5, hp: 10 },
            weight: 4,
            value: 140
        },
        swift_moccasins: {
            id: 'swift_moccasins',
            name: 'Swift Moccasins',
            slot: 'feet',
            category: 'armor',
            baseStats: { defense: 1, speed: 20 },
            weight: 0.3,
            value: 200,
            rarity: 'rare'
        }
    },
    
    mainHand: {
        rusty_dagger: {
            id: 'rusty_dagger',
            name: 'Rusty Dagger',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'dagger',
            attackType: 'melee',
            baseStats: { attack: 3 },
            weight: 0.5,
            value: 5,
            range: 30,
            attackSpeed: 1.5
        },
        iron_sword: {
            id: 'iron_sword',
            name: 'Iron Sword',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'sword',
            attackType: 'melee',
            baseStats: { attack: 8, critChance: 0.02 },
            weight: 2,
            value: 50,
            range: 40,
            attackSpeed: 1.0
        },
        steel_sword: {
            id: 'steel_sword',
            name: 'Steel Sword',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'sword',
            attackType: 'melee',
            baseStats: { attack: 14, critChance: 0.04 },
            weight: 2.5,
            value: 180,
            range: 42,
            attackSpeed: 1.0
        },
        iron_axe: {
            id: 'iron_axe',
            name: 'Iron Axe',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'axe',
            attackType: 'melee',
            baseStats: { attack: 10, critMultiplier: 0.2 },
            weight: 3,
            value: 55,
            range: 38,
            attackSpeed: 0.8
        },
        kings_sword: {
            id: 'kings_sword',
            name: "King's Sword",
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'sword',
            attackType: 'melee',
            baseStats: { attack: 25, critChance: 0.08, critMultiplier: 0.5 },
            weight: 3,
            value: 1200,
            range: 45,
            attackSpeed: 1.1,
            rarity: 'legendary'
        },
        staff: {
            id: 'staff',
            name: 'Wooden Staff',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'staff',
            attackType: 'magic',
            baseStats: { attack: 5, mp: 20 },
            weight: 1.5,
            value: 40,
            range: 120,
            attackSpeed: 0.7,
            projectileSpeed: 350,
            projectileColor: '#88aaff'
        },
        staff_of_lich: {
            id: 'staff_of_lich',
            name: 'Staff of the Lich',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'staff',
            attackType: 'magic',
            baseStats: { attack: 18, mp: 80, critChance: 0.1 },
            weight: 2,
            value: 2000,
            range: 160,
            attackSpeed: 0.8,
            projectileSpeed: 500,
            projectileColor: '#9900ff',
            rarity: 'legendary',
            statusEffects: [{
                type: 'poison',
                chance: 0.15,
                duration: 5000
            }]
        },
        bow: {
            id: 'bow',
            name: 'Hunting Bow',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'bow',
            attackType: 'ranged',
            baseStats: { attack: 7, critChance: 0.05 },
            weight: 1,
            value: 35,
            range: 150,
            attackSpeed: 0.9,
            projectileSpeed: 450,
            projectileColor: '#ffcc00',
            ammoType: 'arrow'
        },
        crossbow: {
            id: 'crossbow',
            name: 'Crossbow',
            slot: 'mainHand',
            category: 'weapon',
            weaponType: 'crossbow',
            attackType: 'ranged',
            baseStats: { attack: 12, critChance: 0.03, critMultiplier: 0.3 },
            weight: 3,
            value: 120,
            range: 180,
            attackSpeed: 0.6,
            projectileSpeed: 550,
            projectileColor: '#ff8800',
            ammoType: 'bolt'
        }
    },
    
    offHand: {
        wooden_shield: {
            id: 'wooden_shield',
            name: 'Wooden Shield',
            slot: 'offHand',
            category: 'shield',
            baseStats: { defense: 3, blockChance: 0.1 },
            weight: 2,
            value: 20
        },
        iron_shield: {
            id: 'iron_shield',
            name: 'Iron Shield',
            slot: 'offHand',
            category: 'shield',
            baseStats: { defense: 6, blockChance: 0.15 },
            weight: 5,
            value: 80
        },
        steel_shield: {
            id: 'steel_shield',
            name: 'Steel Shield',
            slot: 'offHand',
            category: 'shield',
            baseStats: { defense: 10, blockChance: 0.2, hp: 20 },
            weight: 7,
            value: 250
        },
        focus_orb: {
            id: 'focus_orb',
            name: 'Focus Orb',
            slot: 'offHand',
            category: 'focus',
            baseStats: { mp: 30, attack: 3 },
            weight: 0.5,
            value: 100
        },
        spell_tome: {
            id: 'spell_tome',
            name: 'Spell Tome',
            slot: 'offHand',
            category: 'focus',
            baseStats: { mp: 50, attack: 5, critChance: 0.03 },
            weight: 1,
            value: 200,
            rarity: 'rare'
        }
    },
    
    accessory: {
        copper_ring: {
            id: 'copper_ring',
            name: 'Copper Ring',
            slot: 'accessory',
            category: 'accessory',
            baseStats: { hp: 5 },
            weight: 0,
            value: 10
        },
        silver_ring: {
            id: 'silver_ring',
            name: 'Silver Ring',
            slot: 'accessory',
            category: 'accessory',
            baseStats: { hp: 12, mp: 12 },
            weight: 0,
            value: 60
        },
        gold_ring: {
            id: 'gold_ring',
            name: 'Gold Ring',
            slot: 'accessory',
            category: 'accessory',
            baseStats: { hp: 20, mp: 20, critChance: 0.02 },
            weight: 0,
            value: 200
        },
        ancient_amulet: {
            id: 'ancient_amulet',
            name: 'Ancient Amulet',
            slot: 'accessory',
            category: 'accessory',
            baseStats: { hp: 50, mp: 50, defense: 3, attack: 5 },
            weight: 0,
            value: 800,
            rarity: 'epic'
        },
        goblin_crown: {
            id: 'goblin_crown',
            name: 'Goblin Crown',
            slot: 'accessory',
            category: 'accessory',
            baseStats: { hp: 30, attack: 10, speed: 20, critChance: 0.05 },
            weight: 0.5,
            value: 1000,
            rarity: 'legendary'
        }
    }
};

RealmKit.ItemManager = class ItemManager {
    constructor() {
        this.templates = RealmKit.ItemTemplates;
        this.rarities = RealmKit.ItemRarities;
        this.slots = RealmKit.EquipmentSlots;
        this.generatedId = 0;
        
        console.log('[ItemManager] Initialized');
    }
    
    getTemplate(itemId) {
        for (var slot in this.templates) {
            if (this.templates[slot][itemId]) {
                return this.templates[slot][itemId];
            }
        }
        return null;
    }
    
    getTemplatesForSlot(slot) {
        return this.templates[slot] || {};
    }
    
    createItem(itemId, overrides) {
        var template = this.getTemplate(itemId);
        if (!template) {
            console.warn('[ItemManager] Template not found:', itemId);
            return null;
        }
        
        this.generatedId++;
        var item = {
            id: itemId,
            instanceId: itemId + '_' + this.generatedId + '_' + Date.now(),
            name: template.name,
            slot: template.slot,
            category: template.category,
            weight: template.weight || 0,
            value: template.value || 0,
            rarity: overrides && overrides.rarity ? overrides.rarity : (template.rarity || 'common'),
            stats: Object.assign({}, template.baseStats),
            quantity: 1
        };
        
        if (template.weaponType) {
            item.weaponType = template.weaponType;
            item.attackType = template.attackType;
            item.range = template.range;
            item.attackSpeed = template.attackSpeed;
            if (template.projectileSpeed) item.projectileSpeed = template.projectileSpeed;
            if (template.projectileColor) item.projectileColor = template.projectileColor;
            if (template.ammoType) item.ammoType = template.ammoType;
        }
        
        if (template.statusEffects) {
            item.statusEffects = template.statusEffects.slice();
        }
        
        var rarity = this.rarities[item.rarity];
        if (rarity && rarity.statMult !== 1) {
            for (var stat in item.stats) {
                if (typeof item.stats[stat] === 'number') {
                    item.stats[stat] = Math.round(item.stats[stat] * rarity.statMult);
                }
            }
        }
        
        if (overrides) {
            if (overrides.stats) {
                for (var s in overrides.stats) {
                    item.stats[s] = (item.stats[s] || 0) + overrides.stats[s];
                }
            }
            if (overrides.name) {
                item.name = overrides.name;
            }
        }
        
        item.displayName = this.getDisplayName(item);
        
        return item;
    }
    
    getDisplayName(item) {
        var rarity = this.rarities[item.rarity];
        return {
            text: item.name,
            color: rarity ? rarity.color : '#ffffff'
        };
    }
    
    generateRandomItem(level, slot) {
        var targetSlot = slot;
        if (!targetSlot) {
            var slots = Object.keys(this.templates);
            targetSlot = slots[Math.floor(Math.random() * slots.length)];
        }
        
        var templates = this.templates[targetSlot];
        var templateIds = Object.keys(templates);
        if (templateIds.length === 0) {
            return null;
        }
        
        var templateId = templateIds[Math.floor(Math.random() * templateIds.length)];
        
        var rarity = this.rollRarity(level);
        
        return this.createItem(templateId, { rarity: rarity.id });
    }
    
    rollRarity(level) {
        level = level || 1;
        var roll = Math.random() * 100;
        var bonus = level * 0.3;
        
        var sortedRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        var cumulative = 0;
        
        for (var i = 0; i < sortedRarities.length; i++) {
            var rarityId = sortedRarities[i];
            var rarity = this.rarities[rarityId];
            cumulative += rarity.dropWeight;
            if (i > 0) {
                cumulative += bonus * (i * 0.5);
            }
            if (roll < cumulative) {
                return rarity;
            }
        }
        
        return this.rarities.common;
    }
    
    generateLootItems(tableId, level) {
        var table = RealmKit.LootTables[tableId];
        if (!table) {
            console.warn('[ItemManager] Loot table not found:', tableId);
            return [];
        }
        
        var items = [];
        var luck = 0;
        
        for (var i = 0; i < table.drops.length; i++) {
            var drop = table.drops[i];
            var roll = Math.random() * 100;
            
            if (roll < drop.weight + luck) {
                if (drop.itemId === 'gold') {
                    var qty = drop.min !== undefined ? 
                        drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1)) :
                        (drop.quantity || 1);
                    items.push({
                        id: 'gold',
                        name: 'Gold',
                        quantity: qty,
                        category: 'currency',
                        quality: 'common'
                    });
                } else {
                    var template = this.getTemplate(drop.itemId);
                    if (template) {
                        var rarity = this.rarities[template.rarity || 'common'];
                        var item = this.createItem(drop.itemId);
                        if (drop.quantity && drop.quantity > 1) {
                            item.quantity = drop.quantity;
                        }
                        items.push(item);
                    } else {
                        items.push({
                            id: drop.itemId,
                            name: drop.itemId.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }),
                            quantity: drop.quantity || 1,
                            category: 'misc'
                        });
                    }
                }
            }
        }
        
        return items;
    }
    
    getStatBonuses(items) {
        var bonuses = {
            attack: 0,
            defense: 0,
            hp: 0,
            mp: 0,
            speed: 0,
            critChance: 0,
            critMultiplier: 0,
            blockChance: 0,
            blockAmount: 0
        };
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (!item || !item.stats) continue;
            
            for (var stat in item.stats) {
                if (bonuses[stat] !== undefined) {
                    bonuses[stat] += item.stats[stat];
                }
            }
        }
        
        return bonuses;
    }
    
    getItemDescription(item) {
        var lines = [];
        var rarity = this.rarities[item.rarity];
        
        lines.push({
            text: item.name,
            color: rarity ? rarity.color : '#ffffff'
        });
        
        lines.push({
            text: item.category.charAt(0).toUpperCase() + item.category.slice(1) + ' - ' + item.slot.charAt(0).toUpperCase() + item.slot.slice(1),
            color: '#888888'
        });
        
        lines.push({ text: '', color: '#888888' });
        
        if (item.stats) {
            for (var stat in item.stats) {
                var value = item.stats[stat];
                var statName = this.formatStatName(stat);
                var sign = value >= 0 ? '+' : '';
                
                if (stat === 'critChance' || stat === 'blockChance') {
                    lines.push({ text: sign + (value * 100).toFixed(0) + '% ' + statName, color: value >= 0 ? '#1eff00' : '#ff0000' });
                } else if (stat === 'critMultiplier') {
                    lines.push({ text: sign + 'x' + (1 + value).toFixed(1) + ' Crit Damage', color: '#1eff00' });
                } else {
                    lines.push({ text: sign + value + ' ' + statName, color: value >= 0 ? '#1eff00' : '#ff0000' });
                }
            }
        }
        
        if (item.weaponType) {
            lines.push({ text: '', color: '#888888' });
            lines.push({ text: 'Attack Type: ' + item.attackType, color: '#aaaaaa' });
            if (item.attackType === 'ranged') {
                lines.push({ text: 'Range: ' + item.range + ' | Speed: ' + item.projectileSpeed, color: '#aaaaaa' });
            } else if (item.attackType === 'magic') {
                lines.push({ text: 'Range: ' + item.range, color: '#aaaaaa' });
            } else {
                lines.push({ text: 'Range: ' + item.range, color: '#aaaaaa' });
            }
        }
        
        lines.push({ text: '', color: '#888888' });
        lines.push({ text: 'Value: ' + item.value + ' gold', color: '#ffd700' });
        
        return lines;
    }
    
    formatStatName(stat) {
        var names = {
            attack: 'Attack',
            defense: 'Defense',
            hp: 'HP',
            mp: 'MP',
            speed: 'Speed',
            critChance: 'Crit Chance',
            critMultiplier: 'Crit Multiplier',
            blockChance: 'Block Chance',
            blockAmount: 'Block Amount'
        };
        return names[stat] || stat.charAt(0).toUpperCase() + stat.slice(1);
    }
};

console.log('[ItemDefinitions] Module loaded');