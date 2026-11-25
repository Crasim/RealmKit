var RealmKit = RealmKit || {};

RealmKit.StatusEffectType = {
    POISON: 'poison',
    BURN: 'burn',
    FREEZE: 'freeze',
    SLOW: 'slow',
    STUN: 'stun',
    BLEED: 'bleed',
    REGEN: 'regen',
    HASTE: 'haste',
    SHIELD: 'shield',
    STRENGTH: 'strength',
    WEAKNESS: 'weakness',
    DEFENSE: 'defense',
    VULNERABILITY: 'vulnerability',
    INVISIBILITY: 'invisibility',
    IMMUNITY: 'immunity'
};

RealmKit.StatusEffectFlags = {
    DAMAGE_OVER_TIME: 'damageOverTime',
    HEAL_OVER_TIME: 'healOverTime',
    STAT_MODIFIER: 'statModifier',
    MOVEMENT_MODIFIER: 'movementModifier',
    ACTION_BLOCK: 'actionBlock',
    INVULNERABILITY: 'invulnerability'
};

RealmKit.StatusEffectManager = class StatusEffectManager {
    constructor(config) {
        this.config = config || {};
        this.activeEffects = new Map();
        this.effectHistory = [];
        this.maxHistory = this.config.maxHistory || 100;
        
        console.log('[StatusEffectManager] Initialized');
    }
    
    static getEffectDefinition(effectType) {
        var definitions = {
            poison: {
                name: 'Poison',
                icon: '🟢',
                color: '#00ff00',
                flags: [RealmKit.StatusEffectFlags.DAMAGE_OVER_TIME],
                tickInterval: 1000,
                damagePerTick: 5,
                duration: 10000,
                stacking: 'refresh',
                category: 'debuff'
            },
            burn: {
                name: 'Burn',
                icon: '🔥',
                color: '#ff6600',
                flags: [RealmKit.StatusEffectFlags.DAMAGE_OVER_TIME],
                tickInterval: 500,
                damagePerTick: 3,
                duration: 6000,
                stacking: 'refresh',
                category: 'debuff'
            },
            freeze: {
                name: 'Freeze',
                icon: '❄️',
                color: '#00ccff',
                flags: [RealmKit.StatusEffectFlags.MOVEMENT_MODIFIER, RealmKit.StatusEffectFlags.ACTION_BLOCK],
                movementMultiplier: 0,
                duration: 3000,
                stacking: 'none',
                category: 'debuff'
            },
            slow: {
                name: 'Slow',
                icon: '🐢',
                color: '#8888ff',
                flags: [RealmKit.StatusEffectFlags.MOVEMENT_MODIFIER],
                movementMultiplier: 0.5,
                duration: 5000,
                stacking: 'none',
                category: 'debuff'
            },
            stun: {
                name: 'Stun',
                icon: '💫',
                color: '#ffff00',
                flags: [RealmKit.StatusEffectFlags.ACTION_BLOCK],
                duration: 2000,
                stacking: 'none',
                category: 'debuff'
            },
            bleed: {
                name: 'Bleed',
                icon: '🩸',
                color: '#aa0000',
                flags: [RealmKit.StatusEffectFlags.DAMAGE_OVER_TIME],
                tickInterval: 2000,
                damagePerTick: 8,
                duration: 12000,
                stacking: 'stack',
                maxStacks: 5,
                category: 'debuff'
            },
            regen: {
                name: 'Regeneration',
                icon: '💚',
                color: '#00ff88',
                flags: [RealmKit.StatusEffectFlags.HEAL_OVER_TIME],
                tickInterval: 1500,
                healPerTick: 10,
                duration: 15000,
                stacking: 'refresh',
                category: 'buff'
            },
            haste: {
                name: 'Haste',
                icon: '⚡',
                color: '#ffff00',
                flags: [RealmKit.StatusEffectFlags.MOVEMENT_MODIFIER],
                movementMultiplier: 1.5,
                duration: 8000,
                stacking: 'none',
                category: 'buff'
            },
            shield: {
                name: 'Shield',
                icon: '🛡️',
                color: '#6495ed',
                flags: [RealmKit.StatusEffectFlags.STAT_MODIFIER, RealmKit.StatusEffectFlags.INVULNERABILITY],
                blockChance: 0.5,
                blockAmount: 0.5,
                duration: 10000,
                stacking: 'none',
                category: 'buff'
            },
            strength: {
                name: 'Strength',
                icon: '💪',
                color: '#ff4444',
                flags: [RealmKit.StatusEffectFlags.STAT_MODIFIER],
                attackBonus: 5,
                duration: 30000,
                stacking: 'none',
                category: 'buff'
            },
            weakness: {
                name: 'Weakness',
                icon: '💔',
                color: '#666666',
                flags: [RealmKit.StatusEffectFlags.STAT_MODIFIER],
                attackPenalty: 3,
                duration: 20000,
                stacking: 'none',
                category: 'debuff'
            },
            defense: {
                name: 'Defense',
                icon: '🛡️',
                color: '#4488ff',
                flags: [RealmKit.StatusEffectFlags.STAT_MODIFIER],
                defenseBonus: 5,
                duration: 30000,
                stacking: 'none',
                category: 'buff'
            },
            vulnerability: {
                name: 'Vulnerability',
                icon: '🔻',
                color: '#ff00ff',
                flags: [RealmKit.StatusEffectFlags.STAT_MODIFIER],
                defensePenalty: 3,
                duration: 20000,
                stacking: 'none',
                category: 'debuff'
            },
            invisibility: {
                name: 'Invisibility',
                icon: '👻',
                color: '#ffffff',
                flags: [RealmKit.StatusEffectFlags.INVULNERABILITY],
                duration: 5000,
                stacking: 'none',
                category: 'buff'
            },
            immunity: {
                name: 'Immunity',
                icon: '🔶',
                color: '#ffd700',
                flags: [],
                immuneToAll: true,
                duration: 10000,
                stacking: 'none',
                category: 'buff'
            }
        };
        
        return definitions[effectType] || null;
    }
    
    applyEffect(entity, effectType, source, customDuration) {
        if (!entity || !effectType) return null;
        
        var definition = RealmKit.StatusEffectManager.getEffectDefinition(effectType);
        if (!definition) {
            console.warn('[StatusEffectManager] Unknown effect type:', effectType);
            return null;
        }
        
        var entityId = entity.id || entity.entityId;
        
        if (!this.activeEffects.has(entityId)) {
            this.activeEffects.set(entityId, []);
        }
        
        var effects = this.activeEffects.get(entityId);
        
        var existingIndex = -1;
        for (var i = 0; i < effects.length; i++) {
            if (effects[i].type === effectType) {
                existingIndex = i;
                break;
            }
        }
        
        var effect = {
            type: effectType,
            name: definition.name,
            icon: definition.icon,
            color: definition.color,
            flags: definition.flags,
            category: definition.category,
            duration: customDuration || definition.duration,
            startTime: Date.now(),
            gameTimeRemaining: customDuration || definition.duration,
            source: source || 'unknown',
            
            tickInterval: definition.tickInterval || 0,
            lastTick: 0,
            damagePerTick: definition.damagePerTick || 0,
            healPerTick: definition.healPerTick || 0,
            
            movementMultiplier: definition.movementMultiplier,
            attackBonus: definition.attackBonus || 0,
            attackPenalty: definition.attackPenalty || 0,
            defenseBonus: definition.defenseBonus || 0,
            defensePenalty: definition.defensePenalty || 0,
            blockChance: definition.blockChance || 0,
            blockAmount: definition.blockAmount || 0,
            
            stacks: definition.stacking === 'stack' ? 1 : 1,
            maxStacks: definition.maxStacks || 1,
            
            immuneToAll: definition.immuneToAll || false
        };
        
        if (existingIndex !== -1) {
            var existing = effects[existingIndex];
            
            if (definition.stacking === 'refresh') {
                effect.stacks = existing.stacks;
                effects[existingIndex] = effect;
                this.log({
                    entity: entityId,
                    effect: effectType,
                    action: 'refreshed',
                    duration: effect.duration
                });
            } else if (definition.stacking === 'stack') {
                if (existing.stacks < definition.maxStacks) {
                    existing.stacks++;
                    existing.duration = definition.duration;
                    existing.startTime = Date.now();
                    existing.gameTimeRemaining = definition.duration;
                }
                this.log({
                    entity: entityId,
                    effect: effectType,
                    action: 'stacked',
                    stacks: existing.stacks
                });
                return existing;
            } else {
                effect.stacks = existing.stacks;
                effects[existingIndex] = effect;
            }
        } else {
            effects.push(effect);
            this.log({
                entity: entityId,
                effect: effectType,
                action: 'applied',
                duration: effect.duration
            });
        }
        
        this.applyStatModifiers(entity, effect);
        
        console.log('[StatusEffectManager] Applied', effectType, 'to', entityId, 'duration:', effect.duration);
        return effect;
    }
    
    removeEffect(entity, effectType) {
        if (!entity) return false;
        
        var entityId = entity.id || entity.entityId;
        var effects = this.activeEffects.get(entityId);
        
        if (!effects) return false;
        
        for (var i = effects.length - 1; i >= 0; i--) {
            if (effects[i].type === effectType) {
                effects.splice(i, 1);
                this.log({
                    entity: entityId,
                    effect: effectType,
                    action: 'removed'
                });
                console.log('[StatusEffectManager] Removed', effectType, 'from', entityId);
                return true;
            }
        }
        
        return false;
    }
    
    removeAllEffects(entity) {
        if (!entity) return;
        
        var entityId = entity.id || entity.entityId;
        var effects = this.activeEffects.get(entityId);
        
        if (effects) {
            this.log({
                entity: entityId,
                effect: 'all',
                action: 'removed'
            });
            effects.length = 0;
        }
    }
    
    getEffects(entityId) {
        return this.activeEffects.get(entityId) || [];
    }
    
    getEffectsByCategory(entityId, category) {
        var effects = this.activeEffects.get(entityId) || [];
        var filtered = [];
        for (var i = 0; i < effects.length; i++) {
            if (effects[i].category === category) {
                filtered.push(effects[i]);
            }
        }
        return filtered;
    }
    
    hasEffect(entityId, effectType) {
        var effects = this.activeEffects.get(entityId) || [];
        for (var i = 0; i < effects.length; i++) {
            if (effects[i].type === effectType) {
                return true;
            }
        }
        return false;
    }
    
    isImmuneTo(entityId, effectType) {
        var effects = this.activeEffects.get(entityId) || [];
        for (var i = 0; i < effects.length; i++) {
            if (effects[i].immuneToAll) return true;
        }
        return false;
    }
    
    isActionBlocked(entityId) {
        var effects = this.activeEffects.get(entityId) || [];
        for (var i = 0; i < effects.length; i++) {
            var flags = effects[i].flags;
            for (var j = 0; j < flags.length; j++) {
                if (flags[j] === RealmKit.StatusEffectFlags.ACTION_BLOCK) {
                    return true;
                }
            }
        }
        return false;
    }
    
    getMovementMultiplier(entityId) {
        var effects = this.activeEffects.get(entityId) || [];
        var multiplier = 1;
        
        for (var i = 0; i < effects.length; i++) {
            if (effects[i].movementMultiplier !== undefined) {
                multiplier *= effects[i].movementMultiplier;
            }
        }
        
        return Math.max(0, multiplier);
    }
    
    getStatModifiers(entityId) {
        var effects = this.activeEffects.get(entityId) || [];
        var modifiers = {
            attackBonus: 0,
            defenseBonus: 0,
            blockChance: 0,
            blockAmount: 0
        };
        
        for (var i = 0; i < effects.length; i++) {
            var effect = effects[i];
            modifiers.attackBonus += (effect.attackBonus || 0) * effect.stacks;
            modifiers.attackBonus -= (effect.attackPenalty || 0) * effect.stacks;
            modifiers.defenseBonus += (effect.defenseBonus || 0) * effect.stacks;
            modifiers.defenseBonus -= (effect.defensePenalty || 0) * effect.stacks;
            modifiers.blockChance = Math.max(modifiers.blockChance, effect.blockChance || 0);
            modifiers.blockAmount = Math.max(modifiers.blockAmount, effect.blockAmount || 0);
        }
        
        return modifiers;
    }
    
    applyStatModifiers(entity, effect) {
        if (!entity.combatStats) return;
        
        if (effect.attackBonus) {
            entity.combatStats.attack = (entity.combatStats.attack || 0) + effect.attackBonus * effect.stacks;
        }
        if (effect.attackPenalty) {
            entity.combatStats.attack = Math.max(1, (entity.combatStats.attack || 0) - effect.attackPenalty * effect.stacks);
        }
        if (effect.defenseBonus) {
            entity.combatStats.defense = (entity.combatStats.defense || 0) + effect.defenseBonus * effect.stacks;
        }
        if (effect.defensePenalty) {
            entity.combatStats.defense = Math.max(0, (entity.combatStats.defense || 0) - effect.defensePenalty * effect.stacks);
        }
    }
    
    update(entityId, deltaTime, combatSystem) {
        var effects = this.activeEffects.get(entityId);
        if (!effects || effects.length === 0) return [];
        
        var tickResults = [];
        var toRemove = [];
        
        for (var i = 0; i < effects.length; i++) {
            var effect = effects[i];
            
            effect.gameTimeRemaining = Math.max(0, effect.gameTimeRemaining - deltaTime);
            
            if (effect.gameTimeRemaining <= 0) {
                toRemove.push(effect.type);
                continue;
            }
            
            if (effect.tickInterval > 0) {
                effect.lastTick += deltaTime;
                
                if (effect.lastTick >= effect.tickInterval) {
                    effect.lastTick = 0;
                    
                    var tickResult = this.processEffectTick(entityId, effect, combatSystem);
                    if (tickResult) {
                        tickResults.push(tickResult);
                    }
                }
            }
        }
        
        for (var j = 0; j < toRemove.length; j++) {
            this.removeEffectById(entityId, toRemove[j], effects);
        }
        
        return tickResults;
    }
    
    processEffectTick(entityId, effect, combatSystem) {
        var result = {
            entityId: entityId,
            effectType: effect.type,
            timestamp: Date.now()
        };
        
        if (effect.damagePerTick > 0 && combatSystem) {
            var entityData = combatSystem.entities.get(entityId);
            if (entityData && entityData.stats) {
                var totalDamage = effect.damagePerTick * effect.stacks;
                entityData.stats.hp = Math.max(0, entityData.stats.hp - totalDamage);
                result.damage = totalDamage;
                result.action = 'damage';
                
                if (entityData.stats.hp <= 0) {
                    result.killed = true;
                }
                
                this.log({
                    entity: entityId,
                    effect: effect.type,
                    action: 'tick_damage',
                    damage: totalDamage
                });
            }
        }
        
        if (effect.healPerTick > 0 && combatSystem) {
            var entityData2 = combatSystem.entities.get(entityId);
            if (entityData2 && entityData2.stats) {
                var totalHeal = effect.healPerTick * effect.stacks;
                entityData2.stats.hp = Math.min(entityData2.stats.maxHp, entityData2.stats.hp + totalHeal);
                result.heal = totalHeal;
                result.action = 'heal';
                
                this.log({
                    entity: entityId,
                    effect: effect.type,
                    action: 'tick_heal',
                    heal: totalHeal
                });
            }
        }
        
        return result.action ? result : null;
    }
    
    removeEffectById(entityId, effectType, effects) {
        for (var i = effects.length - 1; i >= 0; i--) {
            if (effects[i].type === effectType) {
                effects.splice(i, 1);
                this.log({
                    entity: entityId,
                    effect: effectType,
                    action: 'expired'
                });
                console.log('[StatusEffectManager] Effect', effectType, 'expired on', entityId);
                return;
            }
        }
    }
    
    log(entry) {
        this.effectHistory.push({
            timestamp: Date.now(),
            entity: entry.entity,
            effect: entry.effect,
            action: entry.action,
            stacks: entry.stacks,
            duration: entry.duration,
            damage: entry.damage,
            heal: entry.heal
        });
        
        if (this.effectHistory.length > this.maxHistory) {
            this.effectHistory.shift();
        }
    }
    
    getHistory(count) {
        count = count || 50;
        return this.effectHistory.slice(-count);
    }
    
    serializeEffects(entityId) {
        var effects = this.activeEffects.get(entityId);
        if (!effects) return [];
        
        var serialized = [];
        for (var i = 0; i < effects.length; i++) {
            serialized.push({
                type: effects[i].type,
                remaining: effects[i].gameTimeRemaining,
                stacks: effects[i].stacks,
                source: effects[i].source
            });
        }
        return serialized;
    }
};

console.log('[StatusEffectManager] Class loaded');