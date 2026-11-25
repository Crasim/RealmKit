var RealmKit = RealmKit || {};

RealmKit.LootDrop = class LootDrop {
    constructor(config) {
        this.id = config.id || ('loot_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
        this.x = config.x || 0;
        this.y = config.y || 0;
        
        this.items = config.items || [];
        this.gold = config.gold || 0;
        
        this.spawnTime = Date.now();
        this.lifetime = config.lifetime || 30000;
        this.bobOffset = 0;
        this.bobSpeed = 3;
        this.sparkleTime = 0;
        this.sparkleTimer = 0;
        
        this.radius = config.radius || 16;
        this.active = true;
        
        console.log('[LootDrop] Created at', this.x, this.y, 'items:', this.items.length);
    }
    
    setParticles(particleSystem) {
        this.particles = particleSystem;
    }
    
    update(deltaTime) {
        if (!this.active) return;
        
        this.bobOffset = Math.sin(Date.now() / 200) * 3;
        this.sparkleTime += deltaTime;
        this.sparkleTimer += deltaTime;
        
        if (this.particles && this.sparkleTimer > 800) {
            this.sparkleTimer = 0;
            this.particles.createSparkle(this.x, this.y - 5, this.gold > 0 ? '#ffd700' : '#88aaff', { count: 3, size: 2, speed: 15 });
        }
        
        if (Date.now() - this.spawnTime > this.lifetime) {
            this.active = false;
        }
    }
    
    render(ctx) {
        if (!this.active) return;
        
        var age = Date.now() - this.spawnTime;
        var alpha = age > this.lifetime - 3000 ? Math.max(0.3, (this.lifetime - age) / 3000) : 1;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        var drawY = this.y + this.bobOffset;
        
        ctx.fillStyle = this.gold > 0 ? '#ffd700' : '#8888ff';
        ctx.beginPath();
        ctx.arc(this.x, drawY, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = this.gold > 0 ? '#ffaa00' : '#6666cc';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (this.sparkleTime % 500 < 250) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(this.x - 4, drawY - 4, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (this.items.length > 0 || this.gold > 0) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (this.gold > 0) {
                ctx.fillText('$' + this.gold, this.x, drawY);
            } else if (this.items.length > 0) {
                ctx.fillText(this.items.length, this.x, drawY);
            }
        }
        
        ctx.restore();
    }
    
    canInteract(entity) {
        if (!this.active) return false;
        
        var dx = entity.x - this.x;
        var dy = entity.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        return dist < this.radius + 30;
    }
    
    collect(collector) {
        if (!this.active) return null;
        
        var result = {
            items: this.items.slice(),
            gold: this.gold
        };
        
        this.active = false;
        
        console.log('[LootDrop] Collected by', collector.id, 'gold:', this.gold, 'items:', this.items.length);
        
        return result;
    }
    
    static CreateFromLootTable(lootTableId, x, y, itemManager, level) {
        var lootTable = RealmKit.LootTables[lootTableId];
        if (!lootTable) {
            console.warn('[LootDrop] Loot table not found:', lootTableId);
            return new RealmKit.LootDrop({ x: x, y: y, gold: 0, items: [] });
        }
        
        var drops = [];
        var gold = 0;
        var luck = 0;
        var effectiveLevel = level || 1;
        
        for (var i = 0; i < lootTable.drops.length; i++) {
            var drop = lootTable.drops[i];
            var effectiveWeight = drop.weight + luck;
            
            if (drop.unique) {
                effectiveWeight = drop.weight;
            }
            
            var roll = Math.random() * 100;
            
            if (roll < effectiveWeight) {
                if (drop.itemId === 'gold') {
                    var baseQty = drop.min !== undefined ? 
                        drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1)) : 
                        (drop.quantity || 1);
                    var levelMult = 1 + (effectiveLevel - 1) * 0.1;
                    gold += Math.floor(baseQty * levelMult);
                } else if (itemManager) {
                    var rarity = itemManager.rollRarity(effectiveLevel);
                    var item = itemManager.createItem(drop.itemId, { rarity: rarity.id });
                    if (item) {
                        if (drop.quantity && drop.quantity > 1) {
                            item.quantity = drop.quantity;
                        }
                        drops.push(item);
                    }
                } else {
                    drops.push({
                        id: drop.itemId,
                        name: drop.itemId.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }),
                        quantity: drop.quantity || 1,
                        category: 'misc'
                    });
                }
            }
        }
        
        return new RealmKit.LootDrop({ x: x, y: y, gold: gold, items: drops });
    }
};

console.log('[LootDrop] Class loaded');