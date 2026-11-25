var RealmKit = RealmKit || {};

RealmKit.NPC = class NPC extends RealmKit.Entity {
    static ATTACK_COOLDOWN = 800;
    static ATTACK_COOLDOWN_AI = 1000;
    static DEFAULT_AGGRO_RANGE = 150;
    static DEFAULT_ATTACK_RANGE = 40;
    static PATH_REQUEST_COOLDOWN = 500;
    static PATH_FOLLOW_THRESHOLD = 8;
    static DEATH_LINGER_TIME = 5000;
    
    constructor(config) {
        super(config);
        
        this.type = 'npc';
        this.name = this.config.name || 'NPC';
        this.dialog = this.config.dialog || [];
        this.dialogIndex = 0;
        this.interactable = this.config.interactable !== false;
        this.interactionRadius = this.config.interactionRadius || 64;
        
        this.aiState = 'idle';
        this.aiTime = 0;
        this.aiWaitTime = 0;
        this.aiTargetX = 0;
        this.aiTargetY = 0;
        
        this.wanderRadius = this.config.wanderRadius || 100;
        this.homeX = this.x;
        this.homeY = this.y;
        
        this.behavior = this.config.behavior || 'idle';
        
        this.stateMachine = RealmKit.AnimationStateMachine.createForPlayer();
        this.stateMachine.setState('idle_down');
        
        this.nudgeTime = 0;
        
        this.stats = config.stats || null;
        this.combatStats = null;
        this.inCombat = false;
        this.combatTarget = null;
        this.attackCooldown = 0;
        this.aggroRange = config.aggroRange || NPC.DEFAULT_AGGRO_RANGE;
        this.attackRange = config.attackRange || NPC.DEFAULT_ATTACK_RANGE;
        this.faction = config.faction || 'neutral';
        this.originalFaction = this.faction;
        this.deathTime = 0;
        this.deathLingerTime = NPC.DEATH_LINGER_TIME;
        
        this.schedule = null;
        this.schedulePreset = config.schedulePreset || config.scheduleType || null;
        this.scheduleLocations = config.scheduleLocations || {};
        this.sleepLocation = config.sleepLocation || null;
        this.workLocation = config.workLocation || null;
        this.scheduleOverride = false;
        this.customSchedulePhases = config.schedulePhases || null;
        
        // Story-linked availability
        this.questRequired = config.questRequired || null;
        this.questCompleted = config.questCompleted || null;
        this.questInProgress = config.questInProgress || null;
        this.flagRequired = config.flagRequired || null;
        this.flagRequiredValue = config.flagRequiredValue !== undefined ? config.flagRequiredValue : true;
        this.minLevel = config.minLevel || null;
        
        // Pathfinding state
        this.currentPath = null;
        this.pathIndex = 0;
        this.pathRequestPending = false;
        this.lastPathRequestTime = 0;
        this.pathRequestCooldown = NPC.PATH_REQUEST_COOLDOWN;
        this.usePathfinding = config.usePathfinding !== false;
        
        if (this.schedulePreset && RealmKit.NPCSchedule) {
            this.schedule = RealmKit.NPCSchedule.createFromPreset(this.schedulePreset, this.scheduleLocations);
            if (this.sleepLocation) {
                this.schedule.addLocation('home', this.sleepLocation);
            }
            if (this.workLocation) {
                this.schedule.addLocation('work', this.workLocation);
            }
        } else if (this.customSchedulePhases && RealmKit.NPCSchedule) {
            this.schedule = RealmKit.NPCSchedule.createCustom(this.customSchedulePhases, this.scheduleLocations);
        }
        
        // console.log('[NPC] Created:', this.id, this.name, 'behavior:', this.behavior, 'faction:', this.faction);
    }
    
    setBehavior(behavior) {
        this.behavior = behavior;
        this.aiTime = 0;
        this.aiState = 'idle';
        this.currentPath = null;
        this.pathIndex = 0;
    }
    
    requestPath(world, targetX, targetY, callback) {
        if (!world || !world.engine) return;
        if (!this.usePathfinding) {
            callback(null);
            return;
        }
        
        var now = Date.now();
        if (now - this.lastPathRequestTime < this.pathRequestCooldown) {
            return;
        }
        
        var prm = world.engine.pathRequestManager;
        if (!prm) {
            callback(null);
            return;
        }
        
        this.pathRequestPending = true;
        this.lastPathRequestTime = now;
        
        var self = this;
        prm.requestPath(this.id, this.x, this.y, targetX, targetY, function(path, fromCache) {
            self.pathRequestPending = false;
            if (path && path.length > 0) {
                self.currentPath = path;
                self.pathIndex = 0;
            } else {
                self.currentPath = null;
                self.pathIndex = 0;
            }
            if (callback) callback(self.currentPath);
        }, 0);
    }
    
    followPath(speed) {
        if (!this.currentPath || this.currentPath.length === 0) {
            return false;
        }
        
        if (this.pathIndex >= this.currentPath.length) {
            this.currentPath = null;
            this.pathIndex = 0;
            return false;
        }
        
        var target = this.currentPath[this.pathIndex];
        var dx = target.x - this.x;
        var dy = target.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < NPC.PATH_FOLLOW_THRESHOLD) {
            this.pathIndex++;
            if (this.pathIndex >= this.currentPath.length) {
                this.currentPath = null;
                this.pathIndex = 0;
                return false;
            }
            target = this.currentPath[this.pathIndex];
            dx = target.x - this.x;
            dy = target.y - this.y;
            dist = Math.sqrt(dx * dx + dy * dy);
        }
        
        if (dist > 1) {
            this.velocityX = (dx / dist) * speed;
            this.velocityY = (dy / dist) * speed;
            
            if (Math.abs(dy) > Math.abs(dx)) {
                this.setDirection(dy > 0 ? 'down' : 'up');
            } else {
                this.setDirection(dx > 0 ? 'right' : 'left');
            }
            this.stateMachine.setState('walk_' + this.direction);
        }
        
        return true;
    }
    
    clearPath() {
        this.currentPath = null;
        this.pathIndex = 0;
    }
    
    hasActivePath() {
        return this.currentPath && this.currentPath.length > 0 && this.pathIndex < this.currentPath.length;
    }
    
    updateScheduleBehavior(world) {
        if (!this.schedule || !world || !world.engine) return;
        
        var engine = world.engine;
        var timeOfDay = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.getTimeOfDay(engine.dayNight.time) : 'day';
        var scheduleBehavior = this.schedule.getBehavior(engine.dayNight.time);
        
        if (this.scheduleOverride) return;
        
        if (scheduleBehavior.action === 'sleep') {
            if (this.behavior !== 'sleep') {
                this.setBehavior('sleep');
                this.velocityX = 0;
                this.velocityY = 0;
            }
        } else if (scheduleBehavior.action === 'shopkeep' || scheduleBehavior.action === 'work') {
            if (this.behavior !== 'wander') {
                this.setBehavior('wander');
            }
        } else if (scheduleBehavior.action === 'patrol') {
            if (this.behavior !== 'patrol') {
                this.setBehavior('patrol');
            }
        } else if (scheduleBehavior.action === 'idle') {
            if (this.behavior !== 'idle') {
                this.setBehavior('idle');
            }
        } else if (scheduleBehavior.action === 'tavern' || scheduleBehavior.action === 'socialize') {
            if (this.behavior !== 'wander') {
                this.setBehavior('wander');
            }
        }
    }
    
    checkEntityCollision(world, newX, newY) {
        if (!world || !world.entities) return null;
        
        var checkRadius = this.width * 0.6;
        
        for (var i = 0; i < world.entities.length; i++) {
            var entity = world.entities[i];
            if (entity === this) continue;
            if (!entity.active) continue;
            if (entity.type === 'player') continue;
            
            var dx = newX - entity.x;
            var dy = newY - entity.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < checkRadius + (entity.width || 32) * 0.5) {
                return entity;
            }
        }
        
        return null;
    }
    
    updateSleepAI(deltaTime, world) {
        this.velocityX = 0;
        this.velocityY = 0;
        this.stateMachine.setState('idle_' + this.direction);
    }
    
    update(deltaTime, world) {
        var dt = deltaTime / 1000;

        this.lastCollision = null;

        if (this.combatStats && this.combatStats.hp <= 0) {
            this.velocityX = 0;
            this.velocityY = 0;
            this.nudgeTime = 0;
            this.inCombat = false;
            this.combatTarget = null;
            if (this.stateMachine) {
                this.stateMachine.setState('idle_' + this.direction);
            }
            this.updateAnimation(deltaTime);
            if (this.hitFlashTime > 0) {
                this.hitFlashTime = Math.max(0, this.hitFlashTime - deltaTime);
            }
            return;
        }

        // Tick hit flash timer
        if (this.hitFlashTime > 0) {
            this.hitFlashTime = Math.max(0, this.hitFlashTime - deltaTime);
        }

        if (this.weapon) {
            this.weapon.update(deltaTime);
        }
        
        if (this.nudgeTime > 0) {
            this.nudgeTime -= deltaTime;
            if (this.nudgeTime <= 0) {
                this.velocityX = 0;
                this.velocityY = 0;
                this.nudgeTime = 0;
            }
        }
        
        // Check story-based availability
        if (!this.isAvailable(world)) {
            this.setBehavior('sleep');
            this.visible = false;
            return;
        } else if (!this.visible) {
            this.visible = true;
        }
        
        if (this.schedule && world && world.engine) {
            this.updateScheduleBehavior(world);
        }
        
        if (this.behavior === 'sleep') {
            this.updateSleepAI(deltaTime, world);
        } else if (this.behavior === 'wander') {
            this.updateWanderAI(deltaTime, world);
        } else if (this.behavior === 'patrol') {
            this.updatePatrolAI(deltaTime, world);
        } else if (this.behavior === 'follow') {
            this.updateFollowAI(deltaTime, world);
        } else if (this.behavior === 'hostile' || this.behavior === 'caster') {
            this.updateCombatAI(deltaTime, world);
        } else if (this.behavior === 'partyMember') {
            this.updatePartyMemberAI(deltaTime, world);
        }
        
        if (this.nudgeTime > 0) {
            this.stateMachine.setState('walk_' + this.direction);
        }
        
        var newX = this.x + this.velocityX * dt;
        var newY = this.y + this.velocityY * dt;
        
        var collidedX = false;
        var collidedY = false;
        
        // Entity avoidance - try to steer around other entities
        if (this.usePathfinding && world && world.entities) {
            var blockingEntity = this.checkEntityCollision(world, newX, newY);
            if (blockingEntity && !blockingEntity.type.startsWith('loot')) {
                // Try to steer around
                var avoidAngle = Math.atan2(this.velocityY, this.velocityX) + (Math.random() > 0.5 ? 0.5 : -0.5);
                var speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
                newX = this.x + Math.cos(avoidAngle) * speed * dt;
                newY = this.y + Math.sin(avoidAngle) * speed * dt;
            }
        }
        
        if (world && world.tileMap) {
            collidedX = this.checkTileCollision(newX, this.y, world.tileMap);
            collidedY = this.checkTileCollision(this.x, newY, world.tileMap);
            
            if (!collidedX) {
                this.x = newX;
            }
            
            if (!collidedY) {
                this.y = newY;
            }
            
            if (collidedX || collidedY) {
                this.lastCollision = {
                    x: collidedX,
                    y: collidedY,
                    tileX: Math.floor(this.x / world.tileMap.tileWidth),
                    tileY: Math.floor(this.y / world.tileMap.tileHeight)
                };
                
                this.onCollision(world);
            }
        } else {
            this.x = newX;
            this.y = newY;
        }
        
        if (world && world.mapBounds) {
            var halfW = this.width / 2;
            var halfH = this.height / 2;
            this.x = Math.max(halfW, Math.min(this.x, world.mapBounds.width - halfW));
            this.y = Math.max(halfH, Math.min(this.y, world.mapBounds.height - halfH));
        }
        
        if (this.stateMachine) {
            var anim = this.stateMachine.update(deltaTime, this);
            if (anim) {
                this.setAnimation(anim);
            }
        }
        
        this.updateAnimation(deltaTime);
    }
    
    updateWanderAI(deltaTime, world) {
        this.aiTime += deltaTime;
        
        if (this.aiState === 'idle') {
            if (this.aiTime >= this.aiWaitTime) {
                this.aiState = 'walking';
                this.aiTime = 0;
                this.aiWaitTime = 500 + Math.random() * 1500;
                
                var targetX, targetY;
                var foundRoad = false;
                
                if (world && world.tileMap && world.tileMap.roadMap) {
                    var tileSize = world.tileMap.tileWidth || 32;
                    var tileX = Math.floor(this.x / tileSize);
                    var tileY = Math.floor(this.y / tileSize);
                    var mapW = world.tileMap.width;
                    var mapH = world.tileMap.height;
                    
                    for (var radius = 1; radius <= 5 && !foundRoad; radius++) {
                        for (var dy = -radius; dy <= radius && !foundRoad; dy++) {
                            for (var dx = -radius; dx <= radius && !foundRoad; dx++) {
                                var checkX = tileX + dx;
                                var checkY = tileY + dy;
                                if (checkX < 0 || checkX >= mapW || checkY < 0 || checkY >= mapH) continue;
                                
                                var idx = checkY * mapW + checkX;
                                if (world.tileMap.roadMap[idx] > 0) {
                                    var angle = Math.random() * Math.PI * 2;
                                    var roadDist = 30 + Math.random() * 60;
                                    targetX = (checkX * tileSize + tileSize / 2) + Math.cos(angle) * roadDist;
                                    targetY = (checkY * tileSize + tileSize / 2) + Math.sin(angle) * roadDist;
                                    foundRoad = true;
                                }
                            }
                        }
                    }
                }
                
                if (!foundRoad) {
                    var angle = Math.random() * Math.PI * 2;
                    var dist = Math.random() * this.wanderRadius * 1.5;
                    targetX = this.homeX + Math.cos(angle) * dist;
                    targetY = this.homeY + Math.sin(angle) * dist;
                }
                
                this.aiTargetX = targetX;
                this.aiTargetY = targetY;
                
                if (world && world.mapBounds) {
                    this.aiTargetX = Math.max(32, Math.min(this.aiTargetX, world.mapBounds.width - 32));
                    this.aiTargetY = Math.max(32, Math.min(this.aiTargetY, world.mapBounds.height - 32));
                }
                
                // Try pathfinding if available
                if (this.usePathfinding && world && world.engine && world.engine.pathfinding) {
                    var pf = world.engine.pathfinding;
                    var hasLOS = pf.hasLineOfSight(this.x, this.y, this.aiTargetX, this.aiTargetY);
                    if (!hasLOS) {
                        var self = this;
                        this.requestPath(world, this.aiTargetX, this.aiTargetY);
                    }
                }
            } else {
                this.velocityX = 0;
                this.velocityY = 0;
                this.stateMachine.setState('idle_' + this.direction);
            }
        } else if (this.aiState === 'walking') {
            // Follow path if we have one
            if (this.hasActivePath()) {
                this.followPath(50 + Math.random() * 30);
                this.aiTime += deltaTime;
                
                if (this.aiTime >= 6000) {
                    this.aiState = 'idle';
                    this.aiTime = 0;
                    this.aiWaitTime = 200 + Math.random() * 800;
                    this.clearPath();
                }
                return;
            }
            
            var dx = this.aiTargetX - this.x;
            var dy = this.aiTargetY - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5 || this.aiTime >= 4000) {
                this.aiState = 'idle';
                this.aiTime = 0;
                this.aiWaitTime = 200 + Math.random() * 800;
            } else {
                var speed = 80 + Math.random() * 40;
                this.velocityX = (dx / dist) * speed;
                this.velocityY = (dy / dist) * speed;
                
                if (Math.abs(dy) > Math.abs(dx)) {
                    this.setDirection(dy > 0 ? 'down' : 'up');
                    this.stateMachine.setState('walk_' + this.direction);
                } else {
                    this.setDirection(dx > 0 ? 'right' : 'left');
                    this.stateMachine.setState('walk_' + this.direction);
                }
            }
        }
    }
    
    updatePatrolAI(deltaTime, world) {
        this.aiTime += deltaTime;
        
        if (this.aiTime >= 3000) {
            this.aiTime = 0;
            this.velocityX = 0;
            this.velocityY = 0;
            this.patrolPoints = this.patrolPoints || 0;
            this.patrolPoints = (this.patrolPoints + 1) % 4;
        }
        
        var speed = 50;
        var dirs = [
            { vx: 0, vy: speed, dir: 'down' },
            { vx: speed, vy: 0, dir: 'right' },
            { vx: 0, vy: -speed, dir: 'up' },
            { vx: -speed, vy: 0, dir: 'left' }
        ];
        
        var idx = this.patrolPoints || 0;
        this.velocityX = dirs[idx].vx;
        this.velocityY = dirs[idx].vy;
        this.setDirection(dirs[idx].dir);
        this.stateMachine.setState('walk_' + dirs[idx].dir);
    }
    
    updateFollowAI(deltaTime, world) {
        if (!world || !world.player) return;
        
        var target = world.player;
        var dx = target.x - this.x;
        var dy = target.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        var followDist = 64;
        var maxDist = 200;
        
        if (dist > maxDist) {
            var speed = 100;
            this.velocityX = (dx / dist) * speed;
            this.velocityY = (dy / dist) * speed;
        } else if (dist > followDist) {
            var speed = 50;
            this.velocityX = (dx / dist) * speed;
            this.velocityY = (dy / dist) * speed;
        } else {
            this.velocityX = 0;
            this.velocityY = 0;
        }
        
        if (Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1) {
            if (Math.abs(dy) > Math.abs(dx)) {
                this.setDirection(dy > 0 ? 'down' : 'up');
            } else {
                this.setDirection(dx > 0 ? 'right' : 'left');
            }
            this.stateMachine.setState('walk_' + this.direction);
        } else {
            this.stateMachine.setState('idle_' + this.direction);
        }
    }
    
    updatePartyMemberAI(deltaTime, world) {
        if (!world || !world.player) return;
        
        this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
        
        if (!this.combatStats) {
            this.combatStats = world.combatSystem.registerEntity(this, this.stats || world.combatSystem.createStats({
                hp: 60,
                maxHp: 60,
                attack: 12,
                defense: 5,
                speed: 80
            }));
        }
        
        if (this.combatStats.hp <= 0) {
            this.velocityX = 0;
            this.velocityY = 0;
            return;
        }
        
        var targetX = this.formationX !== undefined ? this.formationX : world.player.x;
        var targetY = this.formationY !== undefined ? this.formationY : world.player.y;
        var inCombat = false;
        var combatTarget = null;
        
        var entities = world.entities || [];
        var closestEnemy = null;
        var closestEnemyDist = this.aggroRange || 200;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity === this) continue;
            if (!entity.active) continue;
            if (entity.type === 'player') continue;
            
            var targetStats = world.combatSystem.getStats(entity.id);
            if (!targetStats || targetStats.hp <= 0) continue;
            
            var entityFaction = entity.faction || 'neutral';
            var relation = this.getFactionRelation(entityFaction);
            
            if (relation !== 'foe') continue;
            
            var dx = entity.x - this.x;
            var dy = entity.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < closestEnemyDist) {
                closestEnemy = entity;
                closestEnemyDist = dist;
            }
        }
        
        if (closestEnemy && closestEnemyDist < (this.aggroRange || 200)) {
            inCombat = true;
            combatTarget = closestEnemy;
        }
        
        if (inCombat && combatTarget) {
            var dx = combatTarget.x - this.x;
            var dy = combatTarget.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var attackRange = this.attackRange || 40;
            
            if (dist <= attackRange && this.attackCooldown <= 0) {
                this.velocityX = 0;
                this.velocityY = 0;
                
                var result = world.combatSystem.attack(this.id, combatTarget.id, 'basic_attack');
                if (this.weapon) {
                    this.weapon.startAttack(this.direction);
                }
                if (this.stateMachine) {
                    this.stateMachine.startAttackState(this.direction);
                }
                this.attackCooldown = NPC.ATTACK_COOLDOWN;
                this.stateMachine.setState('idle_' + this.direction);
                
                if (result && result.damage && world.particles) {
                    world.particles.createCollisionEffect(combatTarget.x, combatTarget.y, '#ff4444');
                }
            } else {
                var speed = this.speed || 80;
                this.velocityX = (dx / dist) * speed;
                this.velocityY = (dy / dist) * speed;
                
                if (Math.abs(dy) > Math.abs(dx)) {
                    this.setDirection(dy > 0 ? 'down' : 'up');
                } else {
                    this.setDirection(dx > 0 ? 'right' : 'left');
                }
                this.stateMachine.setState('walk_' + this.direction);
            }
        } else {
            var dx = targetX - this.x;
            var dy = targetY - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var followDist = 30;
            
            if (dist > followDist) {
                var speed = (this.speed || 80) * 0.8;
                this.velocityX = (dx / dist) * speed;
                this.velocityY = (dy / dist) * speed;
                
                if (Math.abs(dy) > Math.abs(dx)) {
                    this.setDirection(dy > 0 ? 'down' : 'up');
                } else {
                    this.setDirection(dx > 0 ? 'right' : 'left');
                }
                this.stateMachine.setState('walk_' + this.direction);
            } else {
                this.velocityX = 0;
                this.velocityY = 0;
                this.stateMachine.setState('idle_' + this.direction);
            }
        }
    }
    
    updateCombatAI(deltaTime, world) {
        if (!world || !world.combatSystem) return;
        
        this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
        
        if (!this.combatStats) {
            this.combatStats = world.combatSystem.registerEntity(this, this.stats || world.combatSystem.createStats({
                hp: 40,
                maxHp: 40,
                attack: 10,
                defense: 3,
                speed: 80
            }));
        }
        
        if (this.combatStats.hp <= 0) {
            return;
        }
        
        var potentialTargets = [];
        var entities = world.entities || [];
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity === this) continue;
            if (!entity.active) continue;
            
            var targetStats = world.combatSystem.getStats(entity.id);
            if (!targetStats || targetStats.hp <= 0) continue;
            
            var entityFaction = entity.faction || 'neutral';
            var relation = this.getFactionRelation(entityFaction);
            
            if (relation !== 'foe') continue;
            
            var dx = entity.x - this.x;
            var dy = entity.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < this.aggroRange) {
                potentialTargets.push({ entity: entity, dist: dist, stats: targetStats });
            }
        }
        
        if (this.combatStats.hp <= 0) {
            this.velocityX = 0;
            this.velocityY = 0;
            this.solid = false;
            this.stateMachine.setState('idle_' + this.direction);
            // Play death sound once on first death frame
            if (!this._deathSoundFired) {
                this._deathSoundFired = true;
                if (world && world.audio) {
                    world.audio.playDeath();
                }
            }
            return;
        }
        
        var potentialTargets = [];
        var entities = world.entities || [];
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity === this) continue;
            if (!entity.active) continue;
            
            var targetStats = world.combatSystem.getStats(entity.id);
            if (!targetStats || targetStats.hp <= 0) continue;
            
            var entityFaction = entity.faction || 'neutral';
            var relation = this.getFactionRelation(entityFaction);
            
            if (relation !== 'foe') continue;
            
            var dx = entity.x - this.x;
            var dy = entity.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < this.aggroRange) {
                potentialTargets.push({ entity: entity, dist: dist, stats: targetStats });
            }
        }
        
        potentialTargets.sort(function(a, b) { return a.dist - b.dist; });
        
        if (potentialTargets.length > 0) {
            this.combatTarget = potentialTargets[0].entity;
            this.inCombat = true;
        } else {
            this.combatTarget = null;
            this.inCombat = false;
            this.velocityX = 0;
            this.velocityY = 0;
            this.stateMachine.setState('idle_' + this.direction);
            return;
        }
        
        var targetStats = world.combatSystem.getStats(this.combatTarget.id);
        if (!targetStats || targetStats.hp <= 0) {
            this.combatTarget = null;
            this.inCombat = false;
            this.velocityX = 0;
            this.velocityY = 0;
            this.stateMachine.setState('idle_' + this.direction);
            return;
        }
        
        var dx = this.combatTarget.x - this.x;
        var dy = this.combatTarget.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > this.aggroRange * 1.5) {
            this.combatTarget = null;
            this.inCombat = false;
            this.velocityX = 0;
            this.velocityY = 0;
            this.stateMachine.setState('idle_' + this.direction);
            return;
        }
        
        if (dist <= this.attackRange && this.attackCooldown <= 0) {
            this.velocityX = 0;
            this.velocityY = 0;
            
            var actionResult = world.combatSystem.aiSelectAction(
                { entity: this, stats: this.combatStats },
                { entity: this.combatTarget, stats: targetStats }
            );
            
            var result;
            if (actionResult.action === 'attack') {
                result = world.combatSystem.attack(this.id, this.combatTarget.id, actionResult.abilityId || 'basic_attack');
                if (this.weapon) {
                    this.weapon.startAttack(this.direction);
                }
                if (this.stateMachine) {
                    this.stateMachine.startAttackState(this.direction);
                }
            } else if (actionResult.action === 'defend') {
                result = world.combatSystem.defend(this.id);
            } else if (actionResult.action === 'cast') {
                result = world.combatSystem.castSpell(this.id, actionResult.spellId, this.combatTarget.id);
            }
            
            this.attackCooldown = NPC.ATTACK_COOLDOWN_AI;
            this.stateMachine.setState('idle_' + this.direction);
            
            if (result && result.damage && world.particles) {
                world.particles.createCollisionEffect(
                    this.combatTarget.x,
                    this.combatTarget.y,
                    '#ff4444'
                );
            }
            // If the target is the player, trigger screen shake and hit sound
            if (result && result.damage > 0 && this.combatTarget === world.player) {
                if (world.engine) {
                    world.engine.triggerShake(result.critical ? 5 : 2, result.critical ? 180 : 100);
                }
                if (world.audio) {
                    world.audio.playHit(result.critical || false);
                }
                // Flash the player red when they get hit
                if (this.combatTarget) {
                    this.combatTarget.hitFlashTime = result.critical ? 300 : 180;
                }
            }
        } else {
            var speed = this.speed || 80;
            var moveX = dx / dist;
            var moveY = dy / dist;

            // Use pathfinding when available and no clear line of sight
            var pf = world.pathfinding;
            if (pf && dist > 48) {
                var hasLOS = pf.hasLineOfSight
                    ? pf.hasLineOfSight(this.x, this.y, this.combatTarget.x, this.combatTarget.y)
                    : true;
                if (!hasLOS) {
                    var wp = pf.getNextWaypoint(this, this.combatTarget.x, this.combatTarget.y);
                    if (wp) {
                        var wdx = wp.x - this.x;
                        var wdy = wp.y - this.y;
                        var wdist = Math.sqrt(wdx * wdx + wdy * wdy);
                        if (wdist > 1) {
                            moveX = wdx / wdist;
                            moveY = wdy / wdist;
                        }
                    }
                }
            }

            this.velocityX = moveX * speed;
            this.velocityY = moveY * speed;

            if (Math.abs(moveY) > Math.abs(moveX)) {
                this.setDirection(moveY > 0 ? 'down' : 'up');
            } else {
                this.setDirection(moveX > 0 ? 'right' : 'left');
            }
            this.stateMachine.setState('walk_' + this.direction);
        }
    }
    
    getFactionRelation(otherFaction) {
        var myFaction = this.faction || 'neutral';
        
        if (!RealmKit.FactionRelations || !RealmKit.FactionRelations[myFaction]) {
            return 'neutral';
        }
        
        var relation = RealmKit.FactionRelations[myFaction][otherFaction];
        if (!relation) {
            return 'neutral';
        }
        
        return relation;
    }
    
    onCollision(world) {
        if (this.aiState === 'walking') {
            this.aiState = 'idle';
            this.aiTime = 0;
            this.aiWaitTime = 500;
        }
        
        if (this.behavior === 'follow' || this.behavior === 'patrol') {
            this.velocityX = 0;
            this.velocityY = 0;
            this.stateMachine.setState('idle_' + this.direction);
        }
    }
    
    canInteract(player) {
        if (!this.interactable) return false;
        
        var dx = player.x - this.x;
        var dy = player.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        return dist <= this.interactionRadius;
    }
    
    isAvailable(world) {
        var engine = world && world.engine;
        
        if (this.minLevel && engine && engine.player) {
            var playerLevel = engine.player.level || 1;
            if (playerLevel < this.minLevel) {
                return false;
            }
        }
        
        if (this.questRequired && engine && engine.questSystem) {
            if (!engine.questSystem.isCompleted(this.questRequired)) {
                return false;
            }
        }
        
        if (this.questCompleted && engine && engine.questSystem) {
            if (engine.questSystem.isCompleted(this.questCompleted)) {
                return false;
            }
        }
        
        if (this.questInProgress && engine && engine.questSystem) {
            if (!engine.questSystem.isActive(this.questInProgress)) {
                return false;
            }
        }
        
        if (this.flagRequired && engine && engine._storyFlags) {
            if (engine._storyFlags[this.flagRequired] !== this.flagRequiredValue) {
                return false;
            }
        }
        
        return true;
    }
    
    interact(player) {
        if (!this.canInteract(player)) return null;
        
        var result = {
            npc: this,
            dialog: null,
            finished: false
        };
        
        if (this.dialog && this.dialog.length > 0) {
            result.dialog = this.dialog[this.dialogIndex];
            this.dialogIndex = (this.dialogIndex + 1) % this.dialog.length;
            
            if (this.dialogIndex === 0) {
                result.finished = true;
            }
        }
        
        return result;
    }
    
    renderFallback(ctx, renderer) {
        var lunge = this.getAttackBodyOffset();
        var drawX = this.x - this.width / 2 + lunge.dx;
        var drawY = this.y - this.height / 2 + lunge.dy;

        var hpPercent = this.combatStats ? this.combatStats.hp / this.combatStats.maxHp : 1;
        var isDead = this.combatStats && this.combatStats.hp <= 0;
        
        if (isDead) {
            this.deathTime = this.deathTime || Date.now();
            var deathAlpha = Math.max(0, 1 - (Date.now() - this.deathTime) / this.deathLingerTime);
            
            if (deathAlpha <= 0) {
                this.active = false;
                this.solid = false;
                return;
            }
            
            ctx.globalAlpha = deathAlpha;
            ctx.fillStyle = '#444';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(drawX + 4, drawY + 4);
            ctx.lineTo(drawX + this.width - 4, drawY + this.height - 4);
            ctx.moveTo(drawX + this.width - 4, drawY + 4);
            ctx.lineTo(drawX + 4, drawY + this.height - 4);
            ctx.stroke();
            
            ctx.fillStyle = '#ffcccc';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('DEAD', this.x, drawY + this.height / 2);
            
            ctx.globalAlpha = 1;
            return;
        }
        
        if (hpPercent < 0.3) {
            ctx.fillStyle = '#ff4444';
        } else if (hpPercent < 0.6) {
            ctx.fillStyle = '#ff8844';
        } else {
            ctx.fillStyle = this.behavior === 'hostile' ? '#ff4444' : '#4488ff';
        }
        
        ctx.fillRect(drawX, drawY, this.width, this.height);

        // Hit flash overlay (white for normal, gold for crit)
        if (this.hitFlashTime > 0) {
            var flashAlpha = this.hitFlashTime > 250 ? 0.75 : (this.hitFlashTime / 333);
            ctx.save();
            ctx.globalAlpha = flashAlpha;
            ctx.fillStyle = this.hitFlashTime > 300 ? '#ffd700' : '#ff4444';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            ctx.restore();
        }

        ctx.strokeStyle = this.inCombat ? '#ffff00' : '#fff';
        ctx.lineWidth = this.inCombat ? 2 : 1;
        ctx.strokeRect(drawX, drawY, this.width, this.height);
        
        var barWidth = this.width;
        var barHeight = 5;
        var barX = drawX;
        var barY = drawY - 8;
        
        ctx.fillStyle = '#222';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        if (this.combatStats && this.combatStats.maxHp > 0) {
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = hpPercent < 0.3 ? '#ff0000' : (hpPercent < 0.6 ? '#ff8800' : '#00ff00');
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
            
            ctx.fillStyle = '#fff';
            ctx.font = '8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.combatStats.hp) + '/' + this.combatStats.maxHp, this.x, barY - 2);
        }
        
        if (this.name) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, barY - 12);
        }
        
        if (this.interactable && this.interactionRadius) {
            ctx.strokeStyle = 'rgba(68, 136, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.interactionRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        if (this.behavior === 'sleep') {
            ctx.fillStyle = 'rgba(100, 150, 255, 0.7)';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('💤', this.x, this.y - this.height / 2 - 5);
        }
        
        if (this.combatStats && this.aggroRange > 0 &&
            (this.behavior === 'hostile' || this.behavior === 'caster')) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.aggroRange, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    renderInteractionIndicator(ctx, playerX, playerY) {
        if (!this.interactable) return;
        
        var dx = playerX - this.x;
        var dy = playerY - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= this.interactionRadius) {
            var indicatorY = this.y - this.height / 2 - 15;
            
            ctx.fillStyle = 'rgba(78, 204, 163, 0.9)';
            ctx.beginPath();
            ctx.moveTo(this.x - 10, indicatorY + 10);
            ctx.lineTo(this.x + 10, indicatorY + 10);
            ctx.lineTo(this.x, indicatorY);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Courier New';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('E', this.x, indicatorY + 6);
        }
    }
    
    separateFromNearbyEntities(world) {
        var separationRadius = 40;
        var separationForce = 3;
        var entities = world.entities || [];
        var pushX = 0;
        var pushY = 0;
        var count = 0;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity === this) continue;
            if (!entity.active) continue;
            if (entity.type === 'player') continue;
            
            var dx = this.x - entity.x;
            var dy = this.y - entity.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < separationRadius && dist > 0) {
                pushX += (dx / dist) * separationForce;
                pushY += (dy / dist) * separationForce;
                count++;
            }
        }
        
        if (count > 0) {
            this.x += pushX / count;
            this.y += pushY / count;
        }
    }
};

console.log('[NPC] Class loaded');
