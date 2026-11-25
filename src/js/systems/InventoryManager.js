var RealmKit = RealmKit || {};

RealmKit.InventoryManager = class InventoryManager {
    constructor(config) {
        this.config = config || {};
        
        this.maxSlots = this.config.maxSlots || 20;
        this.items = [];
        this.gold = 0;
        
        this.goldStackLimit = 999999;
        this.stackableTypes = ['potion_health', 'potion_mana', 'potion_cure', 'gold', 'arrow', 'bolt'];
        
        console.log('[InventoryManager] Initialized, maxSlots:', this.maxSlots);
    }
    
    addItem(item) {
        if (!item || !item.id) {
            console.warn('[InventoryManager] Invalid item');
            return { success: false, error: 'invalid_item' };
        }
        
        if (this.isStackable(item.type)) {
            var existingSlot = this.findStackableSlot(item);
            if (existingSlot !== -1) {
                var existing = this.items[existingSlot];
                var maxStack = item.maxStack || 99;
                var spaceInStack = maxStack - (existing.quantity || 1);
                var toAdd = Math.min(item.quantity || 1, spaceInStack);
                
                existing.quantity = (existing.quantity || 1) + toAdd;
                console.log('[InventoryManager] Stacked', item.name, 'qty:', toAdd, 'total:', existing.quantity);
                
                if (item.quantity > toAdd) {
                    var remainder = Object.assign({}, item);
                    remainder.quantity = item.quantity - toAdd;
                    return this.addItem(remainder);
                }
                
                return { success: true, slot: existingSlot, stacked: true, quantity: toAdd };
            }
        }
        
        if (this.items.length >= this.maxSlots) {
            console.warn('[InventoryManager] Inventory full');
            return { success: false, error: 'inventory_full' };
        }
        
        var newItem = Object.assign({}, item);
        if (newItem.quantity === undefined) newItem.quantity = 1;
        this.items.push(newItem);
        
        console.log('[InventoryManager] Added', item.name, 'to slot', this.items.length - 1);
        return { success: true, slot: this.items.length - 1, stacked: false };
    }
    
    removeItem(slotId, quantity) {
        quantity = quantity || 1;
        
        if (slotId < 0 || slotId >= this.items.length) {
            console.warn('[InventoryManager] Invalid slot:', slotId);
            return { success: false, error: 'invalid_slot' };
        }
        
        var item = this.items[slotId];
        if (!item) {
            return { success: false, error: 'empty_slot' };
        }
        
        var actualQuantity = Math.min(quantity, item.quantity || 1);
        item.quantity = (item.quantity || 1) - actualQuantity;
        
        if (item.quantity <= 0) {
            var removed = this.items.splice(slotId, 1)[0];
            console.log('[InventoryManager] Removed', removed.name, 'from slot', slotId);
            return { success: true, item: removed, quantity: actualQuantity };
        }
        
        console.log('[InventoryManager] Reduced', item.name, 'by', actualQuantity, 'remaining:', item.quantity);
        return { success: true, item: item, quantity: actualQuantity };
    }
    
    getItem(slotId) {
        if (slotId < 0 || slotId >= this.items.length) {
            return null;
        }
        return this.items[slotId];
    }
    
    findStackableSlot(item) {
        if (!this.isStackable(item.type)) return -1;
        
        for (var i = 0; i < this.items.length; i++) {
            var existing = this.items[i];
            if (existing.id === item.id || (existing.type === item.type && existing.name === item.name)) {
                if ((existing.quantity || 1) < (item.maxStack || 99)) {
                    return i;
                }
            }
        }
        
        return -1;
    }
    
    isStackable(type) {
        return this.stackableTypes.indexOf(type) !== -1;
    }
    
    addGold(amount) {
        amount = amount || 0;
        var oldGold = this.gold;
        this.gold = Math.min(this.gold + amount, this.goldStackLimit);
        var added = this.gold - oldGold;
        console.log('[InventoryManager] Gold +', added, 'total:', this.gold);
        return { success: true, gold: this.gold, added: added };
    }
    
    removeGold(amount) {
        if (amount > this.gold) {
            console.warn('[InventoryManager] Not enough gold:', amount, '>', this.gold);
            return { success: false, error: 'insufficient_gold', gold: this.gold };
        }
        this.gold -= amount;
        console.log('[InventoryManager] Gold -', amount, 'total:', this.gold);
        return { success: true, gold: this.gold };
    }
    
    hasGold(amount) {
        return this.gold >= amount;
    }
    
    // ── Ammunition Methods ───────────────────────────────────────
    
    hasAmmo(ammoType, count) {
        if (!ammoType) return true;
        if (this.unlimitedAmmo) return true;
        
        count = count || 1;
        var found = 0;
        
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            if (item.type === ammoType || item.id === ammoType || item.name === ammoType) {
                found += (item.quantity || 1);
                if (found >= count) return true;
            }
        }
        
        return false;
    }
    
    consumeAmmo(ammoType, count) {
        if (!ammoType) return { success: true, consumed: 0 };
        if (this.unlimitedAmmo) return { success: true, consumed: 0, unlimited: true };
        
        count = count || 1;
        var remaining = count;
        var consumed = 0;
        
        for (var i = this.items.length - 1; i >= 0 && remaining > 0; i--) {
            var item = this.items[i];
            if (item.type === ammoType || item.id === ammoType || item.name === ammoType) {
                var available = item.quantity || 1;
                var toConsume = Math.min(available, remaining);
                
                item.quantity = available - toConsume;
                consumed += toConsume;
                remaining -= toConsume;
                
                if (item.quantity <= 0) {
                    this.items.splice(i, 1);
                    console.log('[InventoryManager] Ammo slot exhausted:', ammoType);
                }
            }
        }
        
        if (remaining > 0) {
            console.warn('[InventoryManager] Not enough ammo:', ammoType, 'needed:', count, 'consumed:', consumed);
            return { success: false, error: 'insufficient_ammo', consumed: consumed };
        }
        
        console.log('[InventoryManager] Consumed', consumed, ammoType);
        return { success: true, consumed: consumed };
    }
    
    getAmmoCount(ammoType) {
        if (!ammoType) return 0;
        
        var total = 0;
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            if (item.type === ammoType || item.id === ammoType || item.name === ammoType) {
                total += (item.quantity || 1);
            }
        }
        return total;
    }
    
    addAmmo(ammoType, count, config) {
        if (!ammoType) return { success: false, error: 'invalid_ammo_type' };
        
        var ammoItem = Object.assign({
            id: ammoType,
            name: ammoType.charAt(0).toUpperCase() + ammoType.slice(1),
            type: ammoType,
            quantity: count || 1,
            maxStack: 99,
            weight: 0.1,
            category: 'ammo'
        }, config || {});
        
        return this.addItem(ammoItem);
    }
    
    setUnlimitedAmmo(unlimited) {
        this.unlimitedAmmo = unlimited;
        console.log('[InventoryManager] Unlimited ammo:', unlimited);
    }
    
    // ── Item Search ─────────────────────────────────────────────
    
    getTotalItems() {
        return this.items.length;
    }
    
    getTotalWeight() {
        var total = 0;
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            var qty = item.quantity || 1;
            var weight = item.weight || 1;
            total += qty * weight;
        }
        return total;
    }
    
    findByType(type) {
        var results = [];
        for (var i = 0; i < this.items.length; i++) {
            if (this.items[i].type === type) {
                results.push({ slot: i, item: this.items[i] });
            }
        }
        return results;
    }
    
    findById(itemId) {
        for (var i = 0; i < this.items.length; i++) {
            if (this.items[i].id === itemId) {
                return { slot: i, item: this.items[i] };
            }
        }
        return null;
    }
    
    findByProperty(prop, value) {
        for (var i = 0; i < this.items.length; i++) {
            if (this.items[i][prop] === value) {
                return { slot: i, item: this.items[i] };
            }
        }
        return null;
    }
    
    clear() {
        this.items = [];
        this.gold = 0;
        console.log('[InventoryManager] Inventory cleared');
    }
    
    // ── Equipment Integration ────────────────────────────────────
    
    setEquipmentManager(equipmentManager) {
        this.equipmentManager = equipmentManager;
        console.log('[InventoryManager] EquipmentManager linked');
    }
    
    equipFromInventory(slotId, targetSlot) {
        var item = this.getItem(slotId);
        if (!item) {
            console.warn('[InventoryManager] No item in slot:', slotId);
            return { success: false, error: 'empty_slot' };
        }
        
        if (!this.equipmentManager) {
            console.warn('[InventoryManager] No EquipmentManager linked');
            return { success: false, error: 'no_equipment_manager' };
        }
        
        var removeResult = this.removeItem(slotId, item.quantity || 1);
        if (!removeResult.success) {
            return removeResult;
        }
        
        var equipResult = this.equipmentManager.equip(removeResult.item, targetSlot);
        
        if (!equipResult.success) {
            this.addItem(removeResult.item);
            return equipResult;
        }
        
        console.log('[InventoryManager] Equipped', item.name, 'from inventory slot', slotId);
        return { success: true, item: item, targetSlot: equipResult.slot };
    }
    
    equipItem(itemOrId, slot) {
        if (!this.equipmentManager) {
            console.warn('[InventoryManager] No EquipmentManager linked');
            return { success: false, error: 'no_equipment_manager' };
        }
        
        return this.equipmentManager.equip(itemOrId, slot);
    }
    
    // ── Serialization ──────────────────────────────────────────
    
    serialize() {
        return {
            gold: this.gold,
            items: this.items.slice()
        };
    }
    
    deserialize(data) {
        if (!data) return;
        
        this.gold = data.gold || 0;
        this.items = data.items ? data.items.slice() : [];
        
        console.log('[InventoryManager] Loaded', this.items.length, 'items, gold:', this.gold);
    }
};

console.log('[InventoryManager] Class loaded');