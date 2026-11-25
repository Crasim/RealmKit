var RealmKit = RealmKit || {};

RealmKit.CombatSystem = class CombatSystem {
    // Combat constants
    static get DEFAULT_STATS() {
        return {
            HP: 100,
            MP: 50,
            ATTACK: 10,
            DEFENSE: 5,
            SPEED: 100,
            CRIT_CHANCE: 0.05,
            CRIT_MULTIPLIER: 1.5,
            DODGE_CHANCE: 0.05,
            BLOCK_CHANCE: 0,
            BLOCK_AMOUNT: 0.5
        };
    }
    
    static get TIMING() {
        return {
            HIT_FLASH_NORMAL: 200,
            HIT_FLASH_CRITICAL: 350,
            DEFEND_DURATION: 2000,
            BUFF_DURATION: 15000,
            SHIELD_DURATION: 15000
        };
    }
    
    static get SPELLS() {
        return {
            power_strike: { id: 'power_strike', damage: 1.5, mpCost: 5, cooldown: 2000, element: null },
            fireball: { id: 'fireball', damage: 2, mpCost: 15, cooldown: 3000, element: 'fire', type: 'attack' },
            ice_bolt: { id: 'ice_bolt', damage: 1.5, mpCost: 10, cooldown: 2500, element: 'ice', type: 'attack' },
            lightning: { id: 'lightning', damage: 2.5, mpCost: 20, cooldown: 4000, element: 'lightning', type: 'attack' },
            poison: { id: 'poison', damage: 0.5, mpCost: 8, cooldown: 2000, element: 'poison', type: 'attack' },
            heal: { id: 'heal', healAmount: 30, mpCost: 15, cooldown: 5000, type: 'heal' },
            shield: { id: 'shield', mpCost: 10, cooldown: 10000, type: 'buff', statBuffs: { defense: 5, blockChance: 0.3 }, duration: 15000 }
        };
    }
    
    constructor(config) {
        this.config = config || {};
        
        this.entities = new Map();
        this.combatLog = [];
        this.maxLogSize = this.config.maxLogSize || 100;
        this.active = false;
        this.statusEffectManager = null;
        this.threatManager = null;
        
        this.onCombatEvent = null;
        this.onStatusEffectApplied = null;
        
        console.log('[CombatSystem] Initialized');
    }
    
    setStatusEffectManager(manager) {
        this.statusEffectManager = manager;
    }
    
    setThreatManager(manager) {
        this.threatManager = manager;
    }
    
    setEquipmentManager(manager) {
        this.equipmentManager = manager;
    }
    
    createStats(config) {
        var c = config || {};
        return {
            hp: c.hp || 100,
            maxHp: c.maxHp || c.hp || 100,
            mp: c.mp || 50,
            maxMp: c.maxMp || c.mp || 50,
            attack: c.attack || 10,
            defense: c.defense || 5,
            speed: c.speed || 100,
            critChance: c.critChance || 0.05,
            critMultiplier: c.critMultiplier || 1.5,
            dodgeChance: c.dodgeChance || 0.05,
            blockChance: c.blockChance || 0,
            blockAmount: c.blockAmount || 0.5,
            
            elemental: c.elemental || {
                fire: 0,
                ice: 0,
                lightning: 0,
                poison: 0,
                holy: 0,
                dark: 0
            },
            
            resistances: c.resistances || {
                fire: 0,
                ice: 0,
                lightning: 0,
                poison: 0,
                holy: 0,
                dark: 0
            },
            
            statusEffects: [],
            cooldowns: new Map()
        };
    }
    
    registerEntity(entity, stats) {
        var combatStats = this.createStats(stats || {});
        
        this.entities.set(entity.id, {
            entity: entity,
            stats: combatStats,
            targetId: null,
            inCombat: false,
            lastAction: null
        });
        
        console.log('[CombatSystem] Registered entity:', entity.id, 'HP:', combatStats.hp);
        return combatStats;
    }
    
    unregisterEntity(entityId) {
        this.entities.delete(entityId);
        console.log('[CombatSystem] Unregistered entity:', entityId);
    }
    
    setTarget(attackerId, targetId) {
        var attacker = this.entities.get(attackerId);
        if (attacker) {
            attacker.targetId = targetId;
        }
    }
    
    attack(attackerId, targetId, abilityId) {
        var attacker = this.entities.get(attackerId);
        var target = this.entities.get(targetId);
        
        if (!attacker || !target) {
            console.warn('[CombatSystem] Invalid attacker or target');
            return null;
        }
        
        var result = {
            attackerId: attackerId,
            targetId: targetId,
            abilityId: abilityId || 'basic_attack',
            damage: 0,
            critical: false,
            dodged: false,
            blocked: false,
            element: null,
            timestamp: Date.now()
        };
        
        if (Math.random() < target.stats.dodgeChance) {
            result.dodged = true;
            this.logCombat(result);
            return result;
        }
        
        var baseDamage = attacker.stats.attack;
         
        if (this.statusEffectManager) {
            var attackerMods = this.statusEffectManager.getStatModifiers(attackerId);
            baseDamage += attackerMods.attackBonus;
            if (attackerMods.attackBonus !== 0 || attackerMods.attackPenalty !== 0) {
                console.log('[CombatSystem] Attacker', attackerId, 'stat mods: attack+', attackerMods.attackBonus, 'base:', attacker.stats.attack, 'total:', baseDamage);
            }
        }
        
        // Apply equipment bonuses if entity has equipmentManager
        if (attacker.entity && attacker.entity.equipmentManager) {
            var equipBonus = attacker.entity.equipmentManager.getStatBonuses();
            if (equipBonus.attack) {
                baseDamage += equipBonus.attack;
            }
            if (equipBonus.critChance) {
                attacker.stats.critChance = Math.min(1.0, (attacker.stats.critChance || 0.05) + equipBonus.critChance);
            }
            if (equipBonus.critMultiplier) {
                attacker.stats.critMultiplier = (attacker.stats.critMultiplier || 1.5) + equipBonus.critMultiplier;
            }
        }
        
        if (this.equipmentManager && attacker.entity && attacker.entity.id) {
            var globalEquipBonus = this.equipmentManager.getStatBonuses();
            if (globalEquipBonus.attack) {
                baseDamage += globalEquipBonus.attack;
            }
        }
        
        if (abilityId && abilityId !== 'basic_attack') {
            var ability = this.getAbility(abilityId);
            if (ability && this.canUseAbility(attacker, ability)) {
                baseDamage = ability.damage * baseDamage;
                result.element = ability.element || null;
                
                attacker.stats.mp = Math.max(0, attacker.stats.mp - (ability.mpCost || 0));
                attacker.stats.cooldowns.set(abilityId, ability.cooldown || 0);
            }
        }
        
        var defense = target.stats.defense;
        if (this.statusEffectManager) {
            var targetMods = this.statusEffectManager.getStatModifiers(targetId);
            defense += targetMods.defenseBonus;
            if (targetMods.defenseBonus !== 0 || targetMods.defensePenalty !== 0) {
                console.log('[CombatSystem] Target', targetId, 'stat mods: defense+', targetMods.defenseBonus, 'base:', target.stats.defense, 'total:', defense);
            }
        }
        
        // Apply equipment bonuses if entity has equipmentManager
        if (target.entity && target.entity.equipmentManager) {
            var targetEquipBonus = target.entity.equipmentManager.getStatBonuses();
            if (targetEquipBonus.defense) {
                defense += targetEquipBonus.defense;
            }
            if (targetEquipBonus.blockChance) {
                target.stats.blockChance = Math.min(0.8, (target.stats.blockChance || 0) + targetEquipBonus.blockChance);
            }
            if (targetEquipBonus.blockAmount) {
                target.stats.blockAmount = Math.min(0.8, (target.stats.blockAmount || 0.5) + targetEquipBonus.blockAmount);
            }
        }
        
        if (this.equipmentManager && target.entity && target.entity.id) {
            var globalEquipBonus = this.equipmentManager.getStatBonuses();
            if (globalEquipBonus.defense) {
                defense += globalEquipBonus.defense;
            }
        }
        if (result.element && target.stats.resistances && target.stats.resistances[result.element]) {
            defense *= (1 + target.stats.resistances[result.element]);
        }
        
        var damage = Math.max(1, baseDamage - defense);
        
        if (Math.random() < attacker.stats.critChance) {
            damage *= attacker.stats.critMultiplier;
            result.critical = true;
        }
        
        if (Math.random() < target.stats.blockChance) {
            damage *= (1 - target.stats.blockAmount);
            result.blocked = true;
        }
        
        result.damage = Math.round(damage);

        target.stats.hp = Math.max(0, target.stats.hp - result.damage);

        if (target.entity && result.damage > 0) {
            target.entity.hitFlashTime = result.critical ? 350 : 200;
        }

        if (attacker.entity && attacker.entity.weapon && attacker.entity.weapon.statusEffects) {
            var effects = attacker.entity.weapon.statusEffects;
            for (var i = 0; i < effects.length; i++) {
                var effectConfig = effects[i];
                if (Math.random() < effectConfig.chance) {
                    result.appliedEffect = {
                        type: effectConfig.type,
                        duration: effectConfig.duration,
                        targetId: targetId
                    };
                    if (this.onStatusEffectApplied) {
                        this.onStatusEffectApplied(targetId, effectConfig.type, attackerId, effectConfig.duration);
                    }
                }
            }
        }

        target.inCombat = true;
        attacker.inCombat = true;
        attacker.lastAction = 'attack';
        
        if (this.threatManager && result.damage > 0) {
            this.threatManager.addThreat(attackerId, targetId, result.damage, 'damage');
            if (result.critical) {
                this.threatManager.addThreat(attackerId, targetId, result.damage * 0.5, 'critical');
            }
        }
        
        if (target.stats.hp <= 0) {
            result.killed = true;
            target.inCombat = false;
            if (this.threatManager) {
                this.threatManager.clearThreat(targetId);
            }
        }
        
        this.logCombat(result);
        
        if (this.onCombatEvent) {
            this.onCombatEvent(result);
        }
        
        return result;
    }
    
    rangedAttack(attackerId, targetId, weaponConfig, projectileConfig) {
        var attacker = this.entities.get(attackerId);
        var target = this.entities.get(targetId);
        
        if (!attacker || !target) {
            console.warn('[CombatSystem] Invalid attacker or target for ranged attack');
            return null;
        }
        
        var attackerEntity = attacker.entity;
        var targetEntity = target.entity;
        
        if (!attackerEntity || !targetEntity) {
            return null;
        }
        
        var result = {
            attackerId: attackerId,
            targetId: targetId,
            weaponId: weaponConfig ? weaponConfig.id : 'bow',
            hit: false,
            damage: 0,
            critical: false,
            dodged: false,
            blocked: false,
            element: null,
            appliedEffect: null,
            projectileId: null,
            timestamp: Date.now()
        };
        
        var accuracy = (projectileConfig && projectileConfig.accuracy) ? projectileConfig.accuracy : 0.85;
        if (Math.random() > accuracy) {
            result.dodged = true;
            result.projectileId = this.fireProjectile(attackerEntity, targetEntity, result, projectileConfig);
            this.logCombat(result);
            return result;
        }
        
        result.hit = true;
        
        var baseDamage = attacker.stats.attack;
        if (this.statusEffectManager) {
            var attackerMods = this.statusEffectManager.getStatModifiers(attackerId);
            baseDamage += attackerMods.attackBonus;
        }
        
        var defense = target.stats.defense;
        if (this.statusEffectManager) {
            var targetMods = this.statusEffectManager.getStatModifiers(targetId);
            defense += targetMods.defenseBonus;
        }
        
        var damage = Math.max(1, baseDamage - defense);
        
        if (Math.random() < attacker.stats.critChance) {
            damage *= attacker.stats.critMultiplier;
            result.critical = true;
        }
        
        if (Math.random() < target.stats.blockChance) {
            damage *= (1 - target.stats.blockAmount);
            result.blocked = true;
        }
        
        result.damage = Math.round(damage);
        
        if (this.threatManager && result.damage > 0) {
            this.threatManager.addThreat(attackerId, targetId, result.damage, 'damage');
            if (result.critical) {
                this.threatManager.addThreat(attackerId, targetId, result.damage * 0.5, 'critical');
            }
        }
        
        attacker.lastAction = 'ranged_attack';
        attacker.inCombat = true;
        target.inCombat = true;
        
        result.projectileId = this.fireProjectile(attackerEntity, targetEntity, result, projectileConfig);
        
        this.logCombat(result);
        
        if (this.onCombatEvent) {
            this.onCombatEvent(result);
        }
        
        return result;
    }
    
    fireProjectile(attacker, target, result, projectileConfig) {
        if (!this.projectileHandler) {
            if (result.hit && target && target.combatStats) {
                target.combatStats.hp = Math.max(0, target.combatStats.hp - result.damage);
            }
            return null;
        }
        
        var projConfig = {
            x: attacker.x,
            y: attacker.y,
            targetX: target.x,
            targetY: target.y,
            targetId: target.id,
            attackerId: attacker.id,
            hit: result.hit,
            damage: result.damage,
            critical: result.critical,
            speed: projectileConfig ? projectileConfig.speed : 400,
            color: projectileConfig ? projectileConfig.color : '#ffcc00',
            frames: projectileConfig ? projectileConfig.frames : 1,
            frameTime: projectileConfig ? projectileConfig.frameTime : 50,
            onComplete: function(proj, didHit) {
                if (didHit && target.combatStats) {
                    target.combatStats.hp = Math.max(0, target.combatStats.hp - proj.damage);
                    if (target.entity && target.entity.hitFlashTime !== undefined) {
                        target.entity.hitFlashTime = proj.critical ? 350 : 200;
                    }
                }
            }
        };
        
        return this.projectileHandler.fire(projConfig);
    }
    
    setProjectileHandler(handler) {
        this.projectileHandler = handler;
    }
    
    applyProjectileDamage(projectile, targetEntity) {
        if (!projectile.hit || !targetEntity) return;
        
        var targetId = targetEntity.id;
        var target = this.entities.get(targetId);
        
        if (!target) return;
        
        target.stats.hp = Math.max(0, target.stats.hp - projectile.damage);
        
        if (target.stats.hp <= 0) {
            target.inCombat = false;
            if (this.threatManager) {
                this.threatManager.clearThreat(targetId);
            }
        }
        
        if (targetEntity.hitFlashTime !== undefined) {
            targetEntity.hitFlashTime = projectile.critical ? 350 : 200;
        }
    }
    
    defend(entityId) {
        var entity = this.entities.get(entityId);
        if (!entity) return null;

        // Use the statusEffects system so the buff is tracked in game-time,
        // not wall-clock time (fixes tab-backgrounding / pause desync from setTimeout)
        var defendBuff = {
            id: 'defend',
            duration: 2000,
            startTime: null,       // set to null; update() uses game-time accumulation
            gameTimeRemaining: 2000,
            stats: { blockChance: 0.3, blockAmount: 0.2 },
            isDefendBuff: true
        };

        // Remove any existing defend buff first to avoid stacking
        for (var i = entity.stats.statusEffects.length - 1; i >= 0; i--) {
            if (entity.stats.statusEffects[i].id === 'defend') {
                var old = entity.stats.statusEffects[i];
                for (var stat in old.stats) {
                    if (entity.stats[stat] !== undefined) {
                        entity.stats[stat] -= old.stats[stat];
                    }
                }
                entity.stats.statusEffects.splice(i, 1);
            }
        }

        entity.stats.blockChance = Math.min(0.8, entity.stats.blockChance + 0.3);
        entity.stats.blockAmount = Math.min(0.8, entity.stats.blockAmount + 0.2);
        entity.stats.statusEffects.push(defendBuff);
        entity.lastAction = 'defend';

        var result = {
            entityId: entityId,
            action: 'defend',
            blockChance: entity.stats.blockChance,
            blockAmount: entity.stats.blockAmount,
            timestamp: Date.now()
        };

        this.logCombat(result);
        return result;
    }
    
    castSpell(casterId, spellId, targetId) {
        var spell = this.getAbility(spellId);
        if (!spell) {
            console.warn('[CombatSystem] Unknown spell:', spellId);
            return null;
        }
        
        var caster = this.entities.get(casterId);
        if (!caster) return null;
        
        if (caster.stats.mp < (spell.mpCost || 0)) {
            return { error: 'Not enough MP', spellId: spellId };
        }
        
        if (!this.canUseAbility(caster, spell)) {
            return { error: 'Spell on cooldown', spellId: spellId };
        }
        
        if (spell.type === 'heal') {
            return this.heal(casterId, targetId || casterId, spell);
        } else if (spell.type === 'buff') {
            return this.applyBuff(casterId, targetId || casterId, spell);
        } else {
            return this.attack(casterId, targetId, spellId);
        }
    }
    
    heal(casterId, targetId, spell) {
        var target = this.entities.get(targetId);
        if (!target) return null;
        
        var healAmount = spell.healAmount || spell.damage || 20;
        
        var actualHeal = Math.min(healAmount, target.stats.maxHp - target.stats.hp);
        target.stats.hp += actualHeal;
        
        var result = {
            casterId: casterId,
            targetId: targetId,
            action: 'heal',
            healAmount: actualHeal,
            spellId: spell.id,
            timestamp: Date.now()
        };
        
        this.logCombat(result);
        return result;
    }
    
    applyBuff(casterId, targetId, spell) {
        var target = this.entities.get(targetId);
        if (!target) return null;

        // Remove any existing buff with the same ID to prevent stacking
        for (var i = target.stats.statusEffects.length - 1; i >= 0; i--) {
            if (target.stats.statusEffects[i].id === spell.id) {
                var old = target.stats.statusEffects[i];
                for (var stat in old.stats) {
                    if (target.stats[stat] !== undefined) {
                        target.stats[stat] -= old.stats[stat];
                    }
                }
                target.stats.statusEffects.splice(i, 1);
            }
        }

        var buff = {
            id: spell.id,
            duration: spell.duration || 30000,
            stats: spell.statBuffs || {},
            startTime: Date.now()
        };

        target.stats.statusEffects.push(buff);
        
        for (var stat in buff.stats) {
            if (target.stats[stat] !== undefined) {
                target.stats[stat] += buff.stats[stat];
            }
        }
        
        var result = {
            casterId: casterId,
            targetId: targetId,
            action: 'buff',
            spellId: spell.id,
            buffs: buff.stats,
            timestamp: Date.now()
        };
        
        this.logCombat(result);
        return result;
    }
    
    canUseAbility(entity, ability) {
        if (entity.stats.mp < (ability.mpCost || 0)) return false;
        
        var cooldown = entity.stats.cooldowns.get(ability.id);
        if (cooldown && cooldown > 0) return false;
        
        return true;
    }
    
    getAbility(abilityId) {
        var abilities = {
            'basic_attack': { id: 'basic_attack', damage: 1, mpCost: 0, cooldown: 0 },
            'power_strike': { id: 'power_strike', damage: 1.5, mpCost: 5, cooldown: 2000, element: null },
            'fireball': { id: 'fireball', damage: 2, mpCost: 15, cooldown: 3000, element: 'fire', type: 'attack' },
            'ice_bolt': { id: 'ice_bolt', damage: 1.5, mpCost: 10, cooldown: 2500, element: 'ice', type: 'attack' },
            'lightning': { id: 'lightning', damage: 2.5, mpCost: 20, cooldown: 4000, element: 'lightning', type: 'attack' },
            'poison': { id: 'poison', damage: 0.5, mpCost: 8, cooldown: 2000, element: 'poison', type: 'attack' },
            'heal': { id: 'heal', healAmount: 30, mpCost: 15, cooldown: 5000, type: 'heal' },
            'shield': { id: 'shield', mpCost: 10, cooldown: 10000, type: 'buff', statBuffs: { defense: 5, blockChance: 0.3 }, duration: 15000 }
        };
        
        return abilities[abilityId] || null;
    }
    
    update(deltaTime) {
        this.entities.forEach(function(data, id) {
            data.stats.cooldowns.forEach(function(cooldown, abilityId) {
                if (cooldown > 0) {
                    data.stats.cooldowns.set(abilityId, Math.max(0, cooldown - deltaTime));
                }
            });
            
            for (var i = data.stats.statusEffects.length - 1; i >= 0; i--) {
                var effect = data.stats.statusEffects[i];
                var expired = false;

                if (effect.isDefendBuff) {
                    // Game-time tracking: tick down with deltaTime so pausing/backgrounding
                    // doesn't cause the buff to expire at the wrong moment
                    effect.gameTimeRemaining = Math.max(0, effect.gameTimeRemaining - deltaTime);
                    expired = effect.gameTimeRemaining <= 0;
                } else {
                    // Wall-clock tracking for normal buffs applied via applyBuff()
                    expired = (Date.now() - effect.startTime) > effect.duration;
                }

                if (expired) {
                    for (var stat in effect.stats) {
                        if (data.stats[stat] !== undefined) {
                            data.stats[stat] -= effect.stats[stat];
                        }
                    }
                    data.stats.statusEffects.splice(i, 1);
                }
            }
        });
    }
    
    logCombat(result) {
        this.combatLog.push(result);

        if (this.combatLog.length > this.maxLogSize) {
            this.combatLog.shift();
        }

        if (RealmKit.Config && RealmKit.Config.debug && RealmKit.Config.debug.enabled) {
            console.log('[CombatSystem]', result);
        }
    }
    
    getStats(entityId) {
        var data = this.entities.get(entityId);
        return data ? data.stats : null;
    }
    
    getCombatLog(count) {
        count = count || 50;
        return this.combatLog.slice(-count);
    }
    
    aiSelectAction(entity, target) {
        var stats = entity.stats;
        var targetStats = target.stats;
        
        if (stats.hp < stats.maxHp * 0.3 && stats.mp >= 15) {
            return { action: 'cast', spellId: 'heal', targetId: entity.entity.id };
        }
        
        if (Math.random() < 0.3 && stats.mp >= 10 && !stats.cooldowns.get('shield')) {
            return { action: 'cast', spellId: 'shield', targetId: entity.entity.id };
        }
        
        if (stats.mp >= 15 && !stats.cooldowns.get('fireball') && Math.random() < 0.4) {
            return { action: 'cast', spellId: 'fireball', targetId: target.entity.id };
        }
        
        if (stats.mp >= 5 && !stats.cooldowns.get('power_strike') && Math.random() < 0.3) {
            return { action: 'attack', abilityId: 'power_strike', targetId: target.entity.id };
        }
        
        if (Math.random() < 0.15) {
            return { action: 'defend' };
        }
        
        return { action: 'attack', abilityId: 'basic_attack', targetId: target.entity.id };
    }
};

console.log('[CombatSystem] Class loaded');