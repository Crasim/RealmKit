var RealmKit = RealmKit || {};

RealmKit.EquipmentManager = class EquipmentManager {
    constructor(config) {
        this.config = config || {};
        
        this.slotOrder = ['head', 'chest', 'legs', 'feet', 'mainHand', 'offHand', 'accessory'];
        this.equipment = {};
        
        for (var i = 0; i < this.slotOrder.length; i++) {
            this.equipment[this.slotOrder[i]] = null;
        }
        
        this.itemManager = null;
        this.inventoryManager = null;
        
        this.onEquip = null;
        this.onUnequip = null;
        this.onStatsChanged = null;
        
        console.log('[EquipmentManager] Initialized');
    }
    
    setItemManager(manager) {
        this.itemManager = manager;
    }
    
    setInventoryManager(manager) {
        this.inventoryManager = manager;
    }
    
    equip(itemId, slot) {
        if (!this.itemManager) {
            console.warn('[EquipmentManager] No ItemManager set');
            return { success: false, error: 'no_item_manager' };
        }
        
        var item = null;
        if (typeof itemId === 'object') {
            item = itemId;
        } else {
            item = this.itemManager.createItem(itemId);
        }
        
        if (!item) {
            console.warn('[EquipmentManager] Invalid item:', itemId);
            return { success: false, error: 'invalid_item' };
        }
        
        if (!item.slot) {
            console.warn('[EquipmentManager] Item has no slot:', item.id);
            return { success: false, error: 'no_slot' };
        }
        
        var targetSlot = slot || item.slot;
        
        if (!this.equipment.hasOwnProperty(targetSlot)) {
            console.warn('[EquipmentManager] Invalid slot:', targetSlot);
            return { success: false, error: 'invalid_slot' };
        }
        
        if (item.slot !== targetSlot && !(item.slot === 'mainHand' && targetSlot === 'offHand') && !(item.slot === 'offHand' && targetSlot === 'mainHand')) {
            var template = this.itemManager.getTemplate(item.id);
            if (template && template.slot !== targetSlot) {
                console.warn('[EquipmentManager] Item', item.id, 'cannot go in slot', targetSlot);
                return { success: false, error: 'wrong_slot' };
            }
        }
        
        var previousItem = this.equipment[targetSlot];
        
        if (previousItem) {
            var unequipResult = this.unequipToInventory(targetSlot);
            if (!unequipResult.success) {
                return { success: false, error: 'inventory_full' };
            }
        }
        
        this.equipment[targetSlot] = item;
        
        console.log('[EquipmentManager] Equipped', item.name, 'to', targetSlot);
        
        if (this.onEquip) {
            this.onEquip(item, targetSlot);
        }
        
        if (this.onStatsChanged) {
            this.onStatsChanged(this.getStatBonuses());
        }
        
        return { success: true, item: item, slot: targetSlot, previousItem: previousItem };
    }
    
    unequip(slot) {
        if (!this.equipment.hasOwnProperty(slot)) {
            return { success: false, error: 'invalid_slot' };
        }
        
        var item = this.equipment[slot];
        if (!item) {
            return { success: false, error: 'empty_slot' };
        }
        
        this.equipment[slot] = null;
        
        console.log('[EquipmentManager] Unequipped', item.name, 'from', slot);
        
        if (this.onUnequip) {
            this.onUnequip(item, slot);
        }
        
        if (this.onStatsChanged) {
            this.onStatsChanged(this.getStatBonuses());
        }
        
        return { success: true, item: item };
    }
    
    unequipToInventory(slot) {
        var result = this.unequip(slot);
        
        if (!result.success) {
            return result;
        }
        
        if (this.inventoryManager) {
            var addResult = this.inventoryManager.addItem(result.item);
            if (!addResult.success) {
                this.equipment[slot] = result.item;
                console.warn('[EquipmentManager] Cannot unequip - inventory full');
                return { success: false, error: 'inventory_full', item: result.item };
            }
            console.log('[EquipmentManager] Moved', result.item.name, 'to inventory');
        }
        
        return result;
    }
    
    getItem(slot) {
        if (!this.equipment.hasOwnProperty(slot)) {
            return null;
        }
        return this.equipment[slot];
    }
    
    hasItem(slot) {
        return this.equipment[slot] !== null;
    }
    
    getAll() {
        var items = [];
        for (var i = 0; i < this.slotOrder.length; i++) {
            var slot = this.slotOrder[i];
            if (this.equipment[slot]) {
                items.push({
                    slot: slot,
                    item: this.equipment[slot]
                });
            }
        }
        return items;
    }
    
    getWeapon() {
        return this.equipment.mainHand;
    }
    
    getOffhand() {
        return this.equipment.offHand;
    }
    
    getMainHandAttackType() {
        var weapon = this.equipment.mainHand;
        if (!weapon) {
            return 'melee';
        }
        return weapon.attackType || 'melee';
    }
    
    getStatBonuses() {
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
        
        for (var slot in this.equipment) {
            var item = this.equipment[slot];
            if (!item || !item.stats) continue;
            
            for (var stat in item.stats) {
                if (bonuses[stat] !== undefined) {
                    bonuses[stat] += item.stats[stat];
                }
            }
        }
        
        return bonuses;
    }
    
    applyToCombatStats(combatStats) {
        if (!combatStats) {
            return combatStats;
        }
        
        var bonuses = this.getStatBonuses();
        
        if (bonuses.attack) {
            combatStats.attack = (combatStats.attack || 10) + bonuses.attack;
        }
        if (bonuses.defense) {
            combatStats.defense = (combatStats.defense || 5) + bonuses.defense;
        }
        if (bonuses.hp) {
            combatStats.hp = (combatStats.hp || 100) + bonuses.hp;
            combatStats.maxHp = (combatStats.maxHp || 100) + bonuses.hp;
        }
        if (bonuses.mp) {
            combatStats.mp = (combatStats.mp || 50) + bonuses.mp;
            combatStats.maxMp = (combatStats.maxMp || 50) + bonuses.mp;
        }
        if (bonuses.speed) {
            combatStats.speed = (combatStats.speed || 100) + bonuses.speed;
        }
        if (bonuses.critChance) {
            combatStats.critChance = (combatStats.critChance || 0.05) + bonuses.critChance;
        }
        if (bonuses.critMultiplier) {
            combatStats.critMultiplier = (combatStats.critMultiplier || 1.5) + bonuses.critMultiplier;
        }
        if (bonuses.blockChance) {
            combatStats.blockChance = (combatStats.blockChance || 0) + bonuses.blockChance;
        }
        if (bonuses.blockAmount) {
            combatStats.blockAmount = (combatStats.blockAmount || 0.5) + bonuses.blockAmount;
        }
        
        console.log('[EquipmentManager] Applied stat bonuses to combat:', bonuses);
        
        return combatStats;
    }
    
    getTotalWeight() {
        var total = 0;
        for (var slot in this.equipment) {
            var item = this.equipment[slot];
            if (item && item.weight) {
                total += item.weight;
            }
        }
        return total;
    }
    
    getTotalValue() {
        var total = 0;
        for (var slot in this.equipment) {
            var item = this.equipment[slot];
            if (item && item.value) {
                total += item.value;
            }
        }
        return total;
    }
    
    hasWeaponEquipped() {
        return this.equipment.mainHand !== null;
    }
    
    hasShieldEquipped() {
        var offhand = this.equipment.offHand;
        return offhand && offhand.category === 'shield';
    }
    
    canDualWield() {
        var mainHand = this.equipment.mainHand;
        return mainHand && mainHand.weaponType === 'dagger';
    }
    
    getWeaponStatusEffects() {
        var weapon = this.equipment.mainHand;
        if (!weapon || !weapon.statusEffects) {
            return [];
        }
        return weapon.statusEffects;
    }
    
    getWeaponRange() {
        var weapon = this.equipment.mainHand;
        if (!weapon) {
            return 35;
        }
        return weapon.range || 35;
    }
    
    getWeaponAttackSpeed() {
        var weapon = this.equipment.mainHand;
        if (!weapon) {
            return 1.0;
        }
        return weapon.attackSpeed || 1.0;
    }
    
    getWeaponProjectileConfig() {
        var weapon = this.equipment.mainHand;
        if (!weapon || weapon.attackType === 'melee') {
            return null;
        }
        
        return {
            speed: weapon.projectileSpeed || 400,
            color: weapon.projectileColor || '#ffcc00',
            frames: weapon.projectileFrames || 1,
            frameTime: weapon.projectileFrameTime || 50
        };
    }
    
    serialize() {
        var data = {};
        for (var slot in this.equipment) {
            var item = this.equipment[slot];
            if (item) {
                data[slot] = {
                    id: item.id,
                    instanceId: item.instanceId,
                    rarity: item.rarity,
                    stats: item.stats
                };
            }
        }
        return data;
    }
    
    deserialize(data, itemManager) {
        if (!data) return;
        
        for (var slot in data) {
            var itemData = data[slot];
            if (itemData && itemManager) {
                var item = itemManager.createItem(itemData.id);
                if (item) {
                    if (itemData.rarity) {
                        item.rarity = itemData.rarity;
                    }
                    if (itemData.stats) {
                        item.stats = itemData.stats;
                    }
                    item.instanceId = itemData.instanceId;
                    this.equipment[slot] = item;
                }
            }
        }
        
        console.log('[EquipmentManager] Deserialized equipment for', Object.keys(data).length, 'slots');
    }
    
    clear() {
        for (var slot in this.equipment) {
            this.equipment[slot] = null;
        }
        console.log('[EquipmentManager] Cleared all equipment');
    }
};

console.log('[EquipmentManager] Module loaded');