var RealmKit = RealmKit || {};

RealmKit.Player = class Player extends RealmKit.Entity {
    constructor(config) {
        super(config);
        
        this.type = 'player';
        this.speed = this.config.speed || 150;
        
        this.velocityX = 0;
        this.velocityY = 0;
        this.isMoving = false;
        
        this.npcMode = config.npcMode || false;
        this.npcPatterns = [
            { vx: 0, vy: 100, dir: 'down', duration: 2500 },
            { vx: 100, vy: 0, dir: 'right', duration: 3000 },
            { vx: 0, vy: -100, dir: 'up', duration: 2500 },
            { vx: -100, vy: 0, dir: 'left', duration: 3000 }
        ];
        this.npcPatternIndex = 0;
        this.npcTime = 0;
        
        this.lastCollision = null;
        
        this.stateMachine = RealmKit.AnimationStateMachine.createForPlayer();
        this.stateMachine.setState('idle_down');
        
        this.faction = 'player';
        this.attackCooldown = 0;
        this.aggroRange = 150;
        this.attackRange = 50;
        
        console.log('[Player] Created:', this.id, 'npcMode:', this.npcMode, 'faction:', this.faction);
    }
    
    updateCombatAI(deltaTime, world) {
        if (!this.npcMode || !world || !world.combatSystem) return;
        
        this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
        
        if (!this.combatStats) return;
        if (this.combatStats.hp <= 0) return;
        
        var potentialTargets = [];
        var entities = world.entities || [];
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity === this) continue;
            if (!entity.active) continue;
            
            var targetStats = world.combatSystem.getStats(entity.id);
            if (!targetStats || targetStats.hp <= 0) continue;
            
            var relation = 'neutral';
            if (RealmKit.FactionRelations && RealmKit.FactionRelations.player) {
                relation = RealmKit.FactionRelations.player[entity.faction || 'neutral'] || 'neutral';
            }
            if (relation !== 'foe') continue;
            
            var dx = entity.x - this.x;
            var dy = entity.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < this.aggroRange) {
                potentialTargets.push({ entity: entity, dist: dist });
            }
        }
        
        potentialTargets.sort(function(a, b) { return a.dist - b.dist; });
        
        if (potentialTargets.length === 0) return;
        
        var target = potentialTargets[0].entity;
        var dx = target.x - this.x;
        var dy = target.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= this.attackRange && this.attackCooldown <= 0) {
            var result = world.combatSystem.attack(this.id, target.id, 'basic_attack');
            this.attackCooldown = 600;
            if (this.weapon) { this.weapon.startAttack(this.direction); }
            if (this.stateMachine) { this.stateMachine.startAttackState(this.direction); }

            if (result && result.damage) {
                console.log('[Player] Auto-attack hit', target.name || target.id, 'for', result.damage);
            }
        } else if (dist > this.attackRange) {
            var speed = this.speed * 0.7;
            this.velocityX = (dx / dist) * speed;
            this.velocityY = (dy / dist) * speed;
            
            if (Math.abs(dy) > Math.abs(dx)) {
                this.setDirection(dy > 0 ? 'down' : 'up');
            } else {
                this.setDirection(dx > 0 ? 'right' : 'left');
            }
            this.stateMachine.setState('walk_' + this.direction);
            this.isMoving = true;
        }
    }
    
    handleInput(inputHandler) {
        if (this.npcMode) return;
        
        var movement = inputHandler.getMovement();
        this.isMoving = movement.x !== 0 || movement.y !== 0;
        
        if (this.isMoving) {
            this.velocityX = movement.x * this.speed;
            this.velocityY = movement.y * this.speed;
            
            if (movement.y < 0) {
                this.setDirection('up');
                this.stateMachine.setState('walk_up');
            }
            else if (movement.y > 0) {
                this.setDirection('down');
                this.stateMachine.setState('walk_down');
            }
            else if (movement.x < 0) {
                this.setDirection('left');
                this.stateMachine.setState('walk_left');
            }
            else if (movement.x > 0) {
                this.setDirection('right');
                this.stateMachine.setState('walk_right');
            }
        } else {
            this.velocityX = 0;
            this.velocityY = 0;
            this.stateMachine.setState('idle_' + this.direction);
        }
    }
    
    nudgeNearbyEntities(entities) {
        var nudgeRadius = 20;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity === this || entity.type === 'player') continue;
            if (!entity.solid) continue;
            
            var dx = entity.x - this.x;
            var dy = entity.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nudgeRadius) {
                this.nudgeEntity(entity, 80);
            }
        }
    }
    
    updateNPC(deltaTime) {
        if (!this.npcMode) return;
        
        this.npcTime += deltaTime;
        var pattern = this.npcPatterns[this.npcPatternIndex];
        
        if (this.npcTime >= pattern.duration) {
            this.npcTime = 0;
            this.npcPatternIndex = (this.npcPatternIndex + 1) % this.npcPatterns.length;
            pattern = this.npcPatterns[this.npcPatternIndex];
        }
        
        this.velocityX = pattern.vx;
        this.velocityY = pattern.vy;
        this.setDirection(pattern.dir);
        this.stateMachine.setState('walk_' + pattern.dir);
        this.isMoving = true;
    }
    
    update(deltaTime, world) {
        var dt = deltaTime / 1000;
        
        this.lastCollision = null;
        
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        if (world && world.combatSystem && this.npcMode) {
            this.updateCombatAI(deltaTime, world);
        }
        
        if (this.nudgeTime > 0) {
            this.nudgeTime -= deltaTime;
            if (this.nudgeTime <= 0) {
                this.velocityX = 0;
                this.velocityY = 0;
                this.nudgeTime = 0;
            }
        }
        
        var newX = this.x + this.velocityX * dt;
        var newY = this.y + this.velocityY * dt;
        
        var collidedX = false;
        var collidedY = false;
        
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
                
                if (this.npcMode) {
                    this.npcTime = this.npcPatterns[this.npcPatternIndex].duration;
                }
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
    
    renderFallback(ctx, renderer) {
        var lunge = this.getAttackBodyOffset();
        var drawX = this.x - this.width / 2 + lunge.dx;
        var drawY = this.y - this.height / 2 + lunge.dy;

        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(drawX, drawY, this.width, this.height);

        // Hit flash overlay
        if (this.hitFlashTime > 0) {
            var flashAlpha = this.hitFlashTime > 250 ? 0.75 : (this.hitFlashTime / 333);
            ctx.save();
            ctx.globalAlpha = flashAlpha;
            ctx.fillStyle = this.hitFlashTime > 300 ? '#ffd700' : '#ff4444';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            ctx.restore();
        }

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX, drawY, this.width, this.height);
        
        var barWidth = this.width;
        var barHeight = 5;
        var barX = drawX;
        var barY = drawY - 8;
        
        ctx.fillStyle = '#222';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 4);
        
        var hpPercent = this.combatStats ? this.combatStats.hp / this.combatStats.maxHp : 1;
        ctx.fillStyle = hpPercent < 0.3 ? '#ff0000' : (hpPercent < 0.6 ? '#ff8800' : '#00ff00');
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        if (this.combatStats) {
            ctx.fillStyle = '#fff';
            ctx.font = '8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.combatStats.hp) + '/' + this.combatStats.maxHp, this.x, barY - 2);
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name || 'Player', this.x, barY - 14);
    }
};

console.log('[Player] Class loaded');