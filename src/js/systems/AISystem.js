var RealmKit = RealmKit || {};

/**
 * AISystem - Handles AI behavior for all entities with hasAI=true
 * Decouples AI logic from NPC class to support template-based units
 */
RealmKit.AISystem = class AISystem {
    constructor(engine) {
        this.engine = engine;
        this.world = null;
        this.activeBehaviors = new Map();
        
        // Behavior handlers
        this.behaviors = {
            'wander': this.updateWander.bind(this),
            'hostile': this.updateCombat.bind(this),
            'ranged': this.updateCombat.bind(this),
            'pack': this.updateCombat.bind(this),
            'defensive': this.updateCombat.bind(this),
            'patrol': this.updatePatrol.bind(this),
            'follow': this.updateFollow.bind(this),
            'schedule': this.updateSchedule.bind(this),
            'turret': this.updateTurret.bind(this),
            'idle': this.updateIdle.bind(this)
        };
        
        console.log('[AISystem] Initialized');
    }
    
    setWorld(world) {
        this.world = world;
    }
    
    /**
     * Register an entity for AI processing
     */
    registerEntity(entity) {
        if (!entity.hasAI) return;
        
        var behavior = entity.aiBehavior || 'idle';
        this.activeBehaviors.set(entity.id, {
            entity: entity,
            behavior: behavior,
            state: 'idle',
            stateTime: 0,
            waitTime: 0,
            targetX: entity.x,
            targetY: entity.y,
            homeX: entity.x,
            homeY: entity.y,
            wanderRadius: entity.wanderRadius || 100,
            path: null,
            pathIndex: 0,
            lastPathRequest: 0,
            pathCooldown: 500
        });
        
        console.log('[AISystem] Registered entity:', entity.id, 'behavior:', behavior);
    }
    
    /**
     * Unregister an entity from AI processing
     */
    unregisterEntity(entityId) {
        this.activeBehaviors.delete(entityId);
    }
    
    /**
     * Change entity behavior at runtime
     */
    setBehavior(entityId, behavior) {
        var data = this.activeBehaviors.get(entityId);
        if (data) {
            data.behavior = behavior;
            data.state = 'idle';
            data.stateTime = 0;
            data.path = null;
            console.log('[AISystem] Behavior changed:', entityId, '->', behavior);
        }
    }
    
    /**
     * Main update loop - called by Engine
     */
    update(deltaTime) {
        if (!this.world) return;
        
        var self = this;
        this.activeBehaviors.forEach(function(data, entityId) {
            var entity = data.entity;
            
            // Skip if entity is dead or inactive
            if (!entity.active) return;
            if (entity.combatStats && entity.combatStats.hp <= 0) return;
            
            // Skip if player-controlled
            if (entity.playerControlled) return;
            
            // Get behavior handler
            var handler = self.behaviors[data.behavior];
            if (handler) {
                handler(entity, data, deltaTime);
            }
        });
    }
    
    /**
     * Idle behavior - do nothing
     */
    updateIdle(entity, data, deltaTime) {
        entity.velocityX = 0;
        entity.velocityY = 0;
        if (entity.stateMachine) {
            entity.stateMachine.setState('idle_' + entity.direction);
        }
    }
    
    /**
     * Wander behavior - move randomly within radius
     */
    updateWander(entity, data, deltaTime) {
        data.stateTime += deltaTime;
        
        if (data.state === 'idle') {
            // Wait for random duration, then pick new target
            if (data.stateTime >= data.waitTime) {
                data.state = 'moving';
                data.stateTime = 0;
                
                // Pick random target within wander radius
                var angle = Math.random() * Math.PI * 2;
                var dist = Math.random() * data.wanderRadius;
                data.targetX = data.homeX + Math.cos(angle) * dist;
                data.targetY = data.homeY + Math.sin(angle) * dist;
                
                // Clamp to world bounds
                if (this.world && this.world.mapBounds) {
                    data.targetX = Math.max(32, Math.min(data.targetX, this.world.mapBounds.width - 32));
                    data.targetY = Math.max(32, Math.min(data.targetY, this.world.mapBounds.height - 32));
                }
            } else {
                entity.velocityX = 0;
                entity.velocityY = 0;
                if (entity.stateMachine) {
                    entity.stateMachine.setState('idle_' + entity.direction);
                }
            }
        } else if (data.state === 'moving') {
            var dx = data.targetX - entity.x;
            var dy = data.targetY - entity.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            // Reached target or timeout
            if (dist < 8 || data.stateTime >= 4000) {
                data.state = 'idle';
                data.stateTime = 0;
                data.waitTime = 500 + Math.random() * 1500;
                entity.velocityX = 0;
                entity.velocityY = 0;
                return;
            }
            
            // Move toward target
            var speed = (entity.speed || 80) * 0.8;
            entity.velocityX = (dx / dist) * speed;
            entity.velocityY = (dy / dist) * speed;
            
            // Update direction
            if (Math.abs(dy) > Math.abs(dx)) {
                entity.setDirection(dy > 0 ? 'down' : 'up');
            } else {
                entity.setDirection(dx > 0 ? 'right' : 'left');
            }
            
            if (entity.stateMachine) {
                entity.stateMachine.setState('walk_' + entity.direction);
            }
        }
    }
    
    /**
     * Patrol behavior - move in a pattern
     */
    updatePatrol(entity, data, deltaTime) {
        data.stateTime += deltaTime;
        
        // Simple patrol: cycle through 4 directions every 3 seconds
        if (data.stateTime >= 3000) {
            data.stateTime = 0;
            data.patrolIndex = (data.patrolIndex || 0) + 1;
        }
        
        var dirs = [
            { vx: 0, vy: 1, dir: 'down' },
            { vx: 1, vy: 0, dir: 'right' },
            { vx: 0, vy: -1, dir: 'up' },
            { vx: -1, vy: 0, dir: 'left' }
        ];
        
        var idx = (data.patrolIndex || 0) % 4;
        var speed = 50;
        entity.velocityX = dirs[idx].vx * speed;
        entity.velocityY = dirs[idx].vy * speed;
        entity.setDirection(dirs[idx].dir);
        
        if (entity.stateMachine) {
            entity.stateMachine.setState('walk_' + dirs[idx].dir);
        }
    }
    
    /**
     * Follow behavior - follow a target (usually the player)
     */
    updateFollow(entity, data, deltaTime) {
        if (!this.world || !this.world.player) {
            entity.velocityX = 0;
            entity.velocityY = 0;
            return;
        }
        
        var target = this.world.player;
        var dx = target.x - entity.x;
        var dy = target.y - entity.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        var followDist = 64;
        var maxDist = 200;
        
        if (dist > maxDist) {
            // Too far - run to catch up
            var speed = entity.speed || 100;
            entity.velocityX = (dx / dist) * speed;
            entity.velocityY = (dy / dist) * speed;
        } else if (dist > followDist) {
            // Normal follow distance
            var speed = (entity.speed || 100) * 0.5;
            entity.velocityX = (dx / dist) * speed;
            entity.velocityY = (dy / dist) * speed;
        } else {
            // Close enough - stop
            entity.velocityX = 0;
            entity.velocityY = 0;
        }
        
        // Update direction and animation
        if (Math.abs(entity.velocityX) > 0.1 || Math.abs(entity.velocityY) > 0.1) {
            if (Math.abs(dy) > Math.abs(dx)) {
                entity.setDirection(dy > 0 ? 'down' : 'up');
            } else {
                entity.setDirection(dx > 0 ? 'right' : 'left');
            }
            if (entity.stateMachine) {
                entity.stateMachine.setState('walk_' + entity.direction);
            }
        } else {
            if (entity.stateMachine) {
                entity.stateMachine.setState('idle_' + entity.direction);
            }
        }
    }
    
    /**
     * Combat behavior - find and attack enemies
     */
    updateCombat(entity, data, deltaTime) {
        if (!this.world || !this.world.combatSystem) return;
        
        // Update attack cooldown
        entity.attackCooldown = Math.max(0, entity.attackCooldown - deltaTime);
        
        // Register with combat system if not already
        if (!entity.combatStats) {
            entity.combatStats = this.world.combatSystem.registerEntity(
                entity, 
                entity.baseStats || {
                    hp: 40, maxHp: 40,
                    attack: 10, defense: 3,
                    speed: entity.speed || 80
                }
            );
        }
        
        // Skip if dead
        if (entity.combatStats.hp <= 0) {
            entity.velocityX = 0;
            entity.velocityY = 0;
            return;
        }
        
        // Find closest enemy
        var target = this.findClosestEnemy(entity);
        
        if (target) {
            data.combatTarget = target;
            this.updateCombatMovement(entity, data, deltaTime);
        } else {
            // No target - return to wander or idle
            data.combatTarget = null;
            entity.inCombat = false;
            
            // If we have a wander behavior as fallback, use it
            if (data.behavior === 'pack' || data.behavior === 'defensive') {
                this.updateWander(entity, data, deltaTime);
            } else {
                entity.velocityX = 0;
                entity.velocityY = 0;
                if (entity.stateMachine) {
                    entity.stateMachine.setState('idle_' + entity.direction);
                }
            }
        }
    }
    
    /**
     * Find closest enemy based on faction
     */
    findClosestEnemy(entity) {
        if (!this.world || !this.world.entities) return null;
        
        var aggroRange = entity.aggroRange || 150;
        var closest = null;
        var closestDist = aggroRange;
        var entities = this.world.entities;
        
        for (var i = 0; i < entities.length; i++) {
            var other = entities[i];
            if (other === entity) continue;
            if (!other.active) continue;
            
            // Check if enemy
            if (!this.isEnemy(entity, other)) continue;
            
            // Check if alive
            if (other.combatStats && other.combatStats.hp <= 0) continue;
            
            var dx = other.x - entity.x;
            var dy = other.y - entity.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < closestDist) {
                closest = other;
                closestDist = dist;
            }
        }
        
        return closest;
    }
    
    /**
     * Check if two entities are enemies
     */
    isEnemy(entityA, entityB) {
        var factionA = entityA.faction || 'neutral';
        var factionB = entityB.faction || 'neutral';
        
        // Same faction = not enemies
        if (factionA === factionB) return false;
        
        // Hostile factions
        var hostileFactions = ['hostile', 'evil'];
        if (hostileFactions.includes(factionA)) {
            // Hostile entities are enemies of player and friendly
            return factionB === 'player' || factionB === 'friendly';
        }
        if (hostileFactions.includes(factionB)) {
            return factionA === 'player' || factionA === 'friendly';
        }
        
        // Wild faction attacks everyone except other wild
        if (factionA === 'wild') {
            return factionB !== 'wild';
        }
        if (factionB === 'wild') {
            return factionA !== 'wild';
        }
        
        return false;
    }
    
    /**
     * Move toward target and attack
     */
    updateCombatMovement(entity, data, deltaTime) {
        var target = data.combatTarget;
        if (!target) return;
        
        var dx = target.x - entity.x;
        var dy = target.y - entity.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        var attackRange = entity.attackRange || 40;
        
        // Check if target moved out of aggro range
        if (dist > (entity.aggroRange || 150) * 1.5) {
            data.combatTarget = null;
            entity.inCombat = false;
            return;
        }
        
        // Attack if in range and cooldown ready
        if (dist <= attackRange && entity.attackCooldown <= 0) {
            entity.velocityX = 0;
            entity.velocityY = 0;
            
            // Perform attack
            var result = this.world.combatSystem.attack(entity.id, target.id, 'basic_attack');
            
            if (entity.weapon) {
                entity.weapon.startAttack(entity.direction);
            }
            if (entity.stateMachine) {
                entity.stateMachine.startAttackState(entity.direction);
            }
            
            entity.attackCooldown = 800; // 800ms cooldown
            entity.attackCooldown = entity.attackCooldown || 800;
            
            if (result && result.damage && this.world.particles) {
                this.world.particles.createCollisionEffect(target.x, target.y, '#ff4444');
            }
            
            return;
        }
        
        // Move toward target
        if (dist > attackRange) {
            var speed = entity.speed || 80;
            entity.velocityX = (dx / dist) * speed;
            entity.velocityY = (dy / dist) * speed;
            
            if (Math.abs(dy) > Math.abs(dx)) {
                entity.setDirection(dy > 0 ? 'down' : 'up');
            } else {
                entity.setDirection(dx > 0 ? 'right' : 'left');
            }
            
            if (entity.stateMachine) {
                entity.stateMachine.setState('walk_' + entity.direction);
            }
        }
        
        entity.inCombat = true;
    }
    
    /**
     * Schedule behavior - follow daily schedule
     */
    updateSchedule(entity, data, deltaTime) {
        // For now, fall back to wander
        // Full schedule system would check time of day and move to different locations
        this.updateWander(entity, data, deltaTime);
    }
    
    /**
     * Turret behavior - stationary but attacks nearby enemies
     */
    updateTurret(entity, data, deltaTime) {
        entity.velocityX = 0;
        entity.velocityY = 0;
        
        // Still use combat logic to find and attack targets
        this.updateCombat(entity, data, deltaTime);
    }
    
    /**
     * Request path for entity
     */
    requestPath(entity, targetX, targetY, callback) {
        if (!this.world || !this.world.engine || !this.world.engine.pathRequestManager) {
            if (callback) callback(null);
            return;
        }
        
        var now = Date.now();
        var data = this.activeBehaviors.get(entity.id);
        if (data && now - data.lastPathRequest < data.pathCooldown) {
            if (callback) callback(data.path);
            return;
        }
        
        var self = this;
        this.world.engine.pathRequestManager.requestPath(
            entity.id, entity.x, entity.y, targetX, targetY,
            function(path, fromCache) {
                if (data) {
                    data.lastPathRequest = Date.now();
                    data.path = path;
                    data.pathIndex = 0;
                }
                if (callback) callback(path);
            },
            0
        );
    }
};

console.log('[AISystem] Module loaded');
