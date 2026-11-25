var RealmKit = RealmKit || {};

/**
 * Entity - Base game entity class
 * 
 * NOTE: This class is being deprecated in favor of template-based units.
 * Use UnitFactory.create() for new code. This class remains for backward compatibility.
 * 
 * @deprecated Use RealmKit.UnitFactory.create() instead
 */
RealmKit.Entity = class Entity {
    constructor(config) {
        this.config = config || {};
        
        // Support template-based creation
        var templateUnit = null;
        if (this.config.templateId && RealmKit.UnitFactory) {
            var factory = new RealmKit.UnitFactory();
            templateUnit = factory.create(this.config.templateId, this.config);
        }
        
        if (templateUnit) {
            // Copy template data first
            this._copyTemplateData(templateUnit);
            console.log('[Entity] Created from template:', this.config.templateId);
            
            // Apply config overrides (id, type, name, position, etc.)
            if (this.config.id) this.id = this.config.id;
            if (this.config.type) this.type = this.config.type;
            if (this.config.name) this.name = this.config.name;
            if (this.config.x !== undefined) this.x = this.config.x;
            if (this.config.y !== undefined) this.y = this.config.y;
            if (this.config.sprite) this.sprite = this.config.sprite;
            if (this.config.manifest) this.manifest = this.config.manifest;
            if (this.config.playerControlled !== undefined) this.playerControlled = this.config.playerControlled;
        } else {
            // Legacy constructor (for backward compatibility)
            this.id = this.config.id || ('entity_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
            this.type = this.config.type || 'entity';
            this.name = this.config.name || this.type;
            
            this.x = this.config.x || 0;
            this.y = this.config.y || 0;
            this.width = this.config.width || 32;
            this.height = this.config.height || 32;
            
            this.velocityX = 0;
            this.velocityY = 0;
            this.speed = this.config.speed || 100;
            
            this.sprite = this.config.sprite || null;
            this.manifest = this.config.manifest || null;
            // Extended spritesheet (humanoid_ext: melee/ranged/cast/swim/…)
            this.spriteExt    = this.config.spriteExt    || null;
            this.manifestExt  = this.config.manifestExt  || null;
            // Special spritesheet (reserved for future use)
            this.spriteSpecial   = this.config.spriteSpecial   || null;
            this.manifestSpecial = this.config.manifestSpecial || null;
            this.animation = this.config.animation || 'idle_down';
            this.animationFrame = 0;
            this.animationTime = 0;
            this.direction = this.config.direction || 'down';
            
            this.stateMachine = null;
            
            this.solid = this.config.solid !== undefined ? this.config.solid : true;
            this.collidable = this.config.collidable !== undefined ? this.config.collidable : true;
            this.interactable = this.config.interactable !== undefined ? this.config.interactable : false;
            this.interactionRadius = this.config.interactionRadius || 60;
            this.dialog = this.config.dialog || [];
            this.faction = this.config.faction || 'neutral';
            
            // Template-based properties (for compatibility)
            this.category = this.config.category || 'entity';
            this.templateId = this.config.templateId || null;
            this.controllable = this.config.controllable || false;
            this.playerControlled = this.config.playerControlled || false;
            this.partyId = this.config.partyId || null;
            this.isPartyLeader = this.config.isPartyLeader || false;
            this.recruitable = this.config.recruitable || false;
            this.hasAI = this.config.hasAI !== false;
            this.aiBehavior = this.config.aiBehavior || 'idle';
            this.aiState = 'idle';
            this.aiTime = 0;
            this.combatStats = this.config.stats ? Object.assign({}, this.config.stats) : null;
            this.attackCooldown = 0;
            this.inCombat = false;
            this.combatTarget = null;
            this.aggroRange = this.config.aggroRange || 150;
            this.attackRange = this.config.attackRange || 40;
            
            this.skills = this.config.skills || [];
            this.activeSkills = {}; // keyed by name
            
            this.weapon = null;
            
            this.active = true;
            this.visible = true;
            this.nudgeTime = 0;
            this._loggedRender = false;

            // Combat VFX
            this.hitFlashTime = 0;     // ms remaining for damage flash overlay
            this.lootDropped = false;  // flag so loot only fires once on death
            
            // Dead body loot system
            this.deadBodyLoot = null;  // { gold: N, items: [], collected: false }
            this.deathTime = 0;        // when entity died
            this.deathLingerTime = 3000;  // 3s visual fade, extends if loot present
            this.deathDespawnTime = 300000; // 5min = 300000ms backup despawn
            this.interactable = true;  // allow E-key interaction for dead bodies
            this.interactionRadius = 50;
            
            console.log('[Entity] Created:', this.id, 'type:', this.type, 'sprite:', !!this.sprite, 'manifest:', !!this.manifest);
        }
    }
    
    /**
     * Copy data properties from template unit (not methods)
     * This preserves Entity class methods while getting template data
     * @param {Object} templateUnit
     */
    _copyTemplateData(templateUnit) {
        // Only copy own properties, not inherited ones
        var keys = Object.keys(templateUnit);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = templateUnit[key];
            // Only copy data (not functions)
            if (typeof value !== 'function') {
                this[key] = value;
            }
        }
    }
    
    equipWeapon(weapon) {
        this.weapon = weapon;
        console.log('[Entity]', this.id, 'equipped weapon:', weapon.name);
    }
    
    unequipWeapon() {
        this.weapon = null;
    }
    
    attack() {
        if (!this.weapon) return false;
        
        if (this.weapon.isAttacking) return false;
        
        this.weapon.startAttack(this.direction);
        return true;
    }

    useSkill(skillName) {
        var skill = this.skills.find(s => s.name === skillName);
        if (!skill) {
            console.warn('[Entity] Skill not found:', skillName);
            return false;
        }

        // Trigger animation
        var animKey = skill.anim_name;
        
        if (this.stateMachine) {
            // Dynamically add the state if it doesn't exist
            if (!this.stateMachine.states[animKey] && !this.stateMachine.states[animKey + '_' + this.direction]) {
                this.stateMachine.addSkillState(animKey, skill.cooldown_ms || 500);
            }

            var stateName = animKey + '_' + this.direction;
            if (this.stateMachine.states[stateName]) {
                this.stateMachine.forceState(stateName);
            } else if (this.stateMachine.states[animKey]) {
                this.stateMachine.forceState(animKey);
            }
        } else {
            // Fallback for simple entities
            this.setAnimation(animKey);
        }

        console.log('[Entity]', this.id, 'used skill:', skill.display_name || skill.name);
        return true;
    }
    
    update(deltaTime, world) {
        var dt = deltaTime / 1000;

        if (this.combatStats && this.combatStats.hp <= 0) {
            // Corpses should not continue drifting due to old velocity or nudges.
            this.velocityX = 0;
            this.velocityY = 0;
            this.nudgeTime = 0;
            this.updateAnimation(deltaTime);
            if (this.hitFlashTime > 0) {
                this.hitFlashTime = Math.max(0, this.hitFlashTime - deltaTime);
            }
            return;
        }

        if (this.weapon) {
            this.weapon.update(deltaTime);
        }

        this.x += this.velocityX * dt;
        this.y += this.velocityY * dt;

        // Drive directional animation from state machine (if one was assigned)
        if (this.stateMachine) {
            var smAnim = this.stateMachine.update(deltaTime, this);
            if (smAnim) this.setAnimation(smAnim);
        }

        this.updateAnimation(deltaTime);
        
        if (this.hitFlashTime > 0) {
            this.hitFlashTime = Math.max(0, this.hitFlashTime - deltaTime);
        }
    }
    
    updateAnimation(deltaTime) {
        if (!this.manifest || !this.manifest.animations) return;
        
        var anim = this.manifest.animations[this.animation];
        if (!anim) return;
        
        var fps = anim.fps || 8;
        var frameTime = 1000 / fps;
        
        this.animationTime += deltaTime;

        if (this.animationTime >= frameTime) {
            this.animationTime -= frameTime;
            this.animationFrame++;

            var maxFrames = anim.frames ? anim.frames.length : anim.frames;
            if (this.animationFrame >= maxFrames) {
                if (anim.loop === false) {
                    this.animationFrame = maxFrames - 1;
                    if (anim.nextAnim) {
                        this.animation = anim.nextAnim;
                        this.animationFrame = 0;
                    }
                } else {
                    this.animationFrame = 0;
                }
            }
        }
    }
    
    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }
    
    intersects(other) {
        var a = this.getBounds();
        var b = other.getBounds();
        
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }
    
    checkEntityCollision(other) {
        if (!other || !other.solid || other === this) return false;
        
        if (!this.intersects(other)) return false;
        
        var dx = this.x - other.x;
        var dy = this.y - other.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 1) dist = 1;
        
        var overlapX = (this.width / 2 + other.width / 2) - Math.abs(dx);
        var overlapY = (this.height / 2 + other.height / 2) - Math.abs(dy);
        
        return {
            entity: other,
            dx: dx,
            dy: dy,
            dist: dist,
            overlapX: overlapX,
            overlapY: overlapY
        };
    }
    
    resolveEntityCollision(collision, pushForce) {
        pushForce = pushForce || 0.5;
        
        if (!collision) return;
        
        var dx = collision.dx;
        var dy = collision.dy;
        var dist = collision.dist;
        
        if (dist < 1) dist = 1;
        
        var nx = dx / dist;
        var ny = dy / dist;
        
        var overlap = Math.min(collision.overlapX, collision.overlapY);
        
        this.x += nx * overlap * pushForce;
        this.y += ny * overlap * pushForce;
    }
    
    nudgeEntity(other, strength) {
        strength = strength || 50;
        
        var dx = other.x - this.x;
        var dy = other.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 1) dist = 1;
        
        var nx = dx / dist;
        var ny = dy / dist;
        
        other.velocityX = nx * strength;
        other.velocityY = ny * strength;
        
        other.nudgeTime = 200;
    }
    
    getTilePosition(tileWidth, tileHeight) {
        return {
            x: Math.floor(this.x / tileWidth),
            y: Math.floor(this.y / tileHeight)
        };
    }
    
    checkTileCollision(x, y, tileMap) {
        if (!tileMap || !tileMap.collisionData) return false;
        
        var halfW = this.width / 2 - 4;
        var halfH = this.height / 2 - 4;
        
        var corners = [
            { x: x - halfW, y: y - halfH },
            { x: x + halfW, y: y - halfH },
            { x: x - halfW, y: y + halfH },
            { x: x + halfW, y: y + halfH }
        ];
        
        for (var i = 0; i < corners.length; i++) {
            var tileX = Math.floor(corners[i].x / tileMap.tileWidth);
            var tileY = Math.floor(corners[i].y / tileMap.tileHeight);
            
            if (tileMap.isColliding(tileX, tileY)) {
                return true;
            }
        }
        
        return false;
    }
    
    setAnimation(animName) {
        if (this.animation !== animName) {
            this.animation = animName;
            this.animationFrame = 0;
            this.animationTime = 0;
        }
    }
    
    setDirection(dir) {
        if (this.direction !== dir) {
            this.direction = dir;
        }
    }

    // Returns a {dx, dy} pixel offset to apply to the entity body during an attack swing.
    // Wind-up: body leans slightly backward; strike/impact: body lunges forward; follow-through: returns to 0.
    getAttackBodyOffset() {
        if (!this.weapon || !this.weapon.isAttacking) return { dx: 0, dy: 0 };
        var info = this.weapon.getPhaseInfo();
        var dir  = this.weapon.attackDirection || this.direction;
        var strength = 0;

        if (info.name === 'windup') {
            strength = -(info.t * info.t) * 3;               // ease in: 0 → -3px (lean back)
        } else if (info.name === 'strike') {
            var e = 1 - Math.pow(1 - info.t, 3);             // easeOutCubic
            strength = e * 5;                                  // 0 → +5px (lunge forward)
        } else if (info.name === 'impact') {
            strength = 5;                                      // hold lunge
        } else { // followthrough
            var e = info.t < 0.5 ? 2*info.t*info.t : 1 - Math.pow(-2*info.t+2,2)/2;
            strength = 5 * (1 - e);                           // 5 → 0 (return to rest)
        }

        if (dir === 'right') return { dx:  strength, dy: 0 };
        if (dir === 'left')  return { dx: -strength, dy: 0 };
        if (dir === 'up')    return { dx: 0, dy: -strength };
        return                      { dx: 0, dy:  strength }; // down
    }
    
    render(ctx, renderer) {
        if (!this.visible) return;
        
        if (this.sprite && this.manifest) {
            this.renderSprite(ctx, renderer);
        } else {
            this.renderFallback(ctx, renderer);
        }
        
        if (this.weapon) {
            this.weapon.render(ctx, this.x, this.y, this.direction);
        }
        
        this.renderHealthBar(ctx);
    }
    
    renderSprite(ctx, renderer) {
        // ── Spritesheet priority: ext → special → base ─────────────────────────
        // Check which manifest contains the current animation, prefer ext/special.
        var activeManifest = this.manifest;
        var activeSprite   = this.sprite;
        var animName       = this.animation;
        var mirrored       = false;

        // Helper to check for mirroring in a manifest
        var checkMirror = function(manifest, anim) {
            if (!manifest || !manifest.directionMirrors) return null;
            for (var target in manifest.directionMirrors) {
                if (anim.endsWith('_' + target)) {
                    var sourceDir = manifest.directionMirrors[target];
                    var base = anim.substring(0, anim.length - target.length);
                    var sourceAnimName = base + sourceDir;
                    if (manifest.animations && manifest.animations[sourceAnimName]) {
                        return { source: sourceAnimName, target: target };
                    }
                }
            }
            return null;
        };

        // Resolve active manifest and animation (with mirroring fallback)
        if (this.manifestExt && this.manifestExt.animations &&
                (this.manifestExt.animations[animName] || checkMirror(this.manifestExt, animName))) {
            activeManifest = this.manifestExt;
            activeSprite   = this.spriteExt || this.sprite;
            var mirrorInfo = !activeManifest.animations[animName] ? checkMirror(activeManifest, animName) : null;
            if (mirrorInfo) {
                animName = mirrorInfo.source;
                mirrored = true;
            }
        } else if (this.manifestSpecial && this.manifestSpecial.animations &&
                (this.manifestSpecial.animations[animName] || checkMirror(this.manifestSpecial, animName))) {
            activeManifest = this.manifestSpecial;
            activeSprite   = this.spriteSpecial || this.sprite;
            var mirrorInfo = !activeManifest.animations[animName] ? checkMirror(activeManifest, animName) : null;
            if (mirrorInfo) {
                animName = mirrorInfo.source;
                mirrored = true;
            }
        } else if (activeManifest && activeManifest.animations) {
            var mirrorInfo = !activeManifest.animations[animName] ? checkMirror(activeManifest, animName) : null;
            if (mirrorInfo) {
                animName = mirrorInfo.source;
                mirrored = true;
            }
        }

        if (!activeManifest || !activeManifest.animations) {
            if (!this._loggedRender) {
                console.log('[Entity.renderSprite] No manifest/animations for', this.id);
                this._loggedRender = true;
            }
            return;
        }

        var anim = activeManifest.animations[animName];
        if (!anim) {
            if (!this._loggedRender) {
                console.log('[Entity.renderSprite] No animation frames for', this.id, animName);
                this._loggedRender = true;
            }
            return;
        }

        if (!activeSprite) {
            if (!this._loggedRender) {
                console.log('[Entity.renderSprite] No sprite for', this.id);
                this._loggedRender = true;
            }
            return;
        }

        var cols = activeManifest.colsPerRow || activeManifest.layout?.colsPerRow || 10;
        var frameWidth  = activeManifest.frameWidth;
        var frameHeight = activeManifest.frameHeight;

        var frameIndex;
        if (anim.frames && Array.isArray(anim.frames)) {
            frameIndex = anim.frames[this.animationFrame % anim.frames.length];
        } else {
            frameIndex = anim.row * cols + (this.animationFrame % anim.frames);
        }

        var col = frameIndex % cols;
        var row = Math.floor(frameIndex / cols);
        var frameX = col * frameWidth;
        var frameY = row * frameHeight;

        // Anchor: feet at bottom of entity collision box.
        // drawY places the sprite so its bottom aligns with entity.y + height/2.
        var drawX = this.x - frameWidth / 2;
        var drawY = this.y + this.height / 2 - frameHeight;
        
        if (!this._loggedRender) {
            console.log('[Entity.renderSprite] Drawing', this.id, 'at', drawX, drawY,
                'anim:', animName, (mirrored ? '(mirrored)' : ''), 'frame:', frameX, frameY,
                'sheet:', activeSprite.src ? activeSprite.src.split('/').pop() : 'no src');
            this._loggedRender = true;
        }

        if (mirrored) {
            ctx.save();
            // Flip horizontally around the center of the sprite
            ctx.translate(this.x, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(
                activeSprite,
                frameX, frameY,
                frameWidth, frameHeight,
                -frameWidth / 2, drawY,
                frameWidth, frameHeight
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                activeSprite,
                frameX, frameY,
                frameWidth, frameHeight,
                drawX, drawY,
                frameWidth, frameHeight
            );
        }
        
        if (this.hitFlashTime > 0) {
            ctx.save();
            ctx.globalAlpha = this.hitFlashTime > 250 ? 0.8 : (this.hitFlashTime / 300);
            ctx.fillStyle = '#ffffcc';
            ctx.fillRect(drawX, drawY, frameWidth, frameHeight);
            ctx.restore();
        }
    }

    // Returns frameWidth/Height from whichever spritesheet is active (for health bar, etc.)
    _getActiveFrameDims() {
        var m = this.manifest;
        if (this.manifestExt && this.manifestExt.animations && this.manifestExt.animations[this.animation]) m = this.manifestExt;
        else if (this.manifestSpecial && this.manifestSpecial.animations && this.manifestSpecial.animations[this.animation]) m = this.manifestSpecial;
        return m ? { w: m.frameWidth, h: m.frameHeight } : { w: this.width, h: this.height };
    }
    
    renderHealthBar(ctx) {
        if (!this.combatStats && !this.deathTime) return;
        
        var isDead = this.combatStats && this.combatStats.hp <= 0;
        
        if (isDead && !this.deathTime) {
            this.deathTime = Date.now();
        }
        
        var dims = this._getActiveFrameDims();
        var width  = dims.w;
        var height = dims.h;
        var drawX = this.x - width / 2;
        var drawY = this.y + this.height / 2 - height;
        
        if (this.deathTime && (!this.combatStats || this.combatStats.hp <= 0)) {
            var elapsed = Date.now() - this.deathTime;
            var hasLoot = this.deadBodyLoot && !this.deadBodyLoot.collected;
            var hasUncollectedLoot = hasLoot && (this.deadBodyLoot.gold > 0 || this.deadBodyLoot.items.length > 0);
            
            // Only fade if loot collected OR 5min backup timer expired
            if (!hasUncollectedLoot && elapsed > this.deathDespawnTime) {
                this.active = false;
                this.solid = false;
                return;
            }

            // Calculate alpha: fade over 3s only if no loot, otherwise stay visible
            var deathAlpha;
            if (hasUncollectedLoot) {
                deathAlpha = 1; // Stay fully visible
            } else {
                deathAlpha = Math.max(0, 1 - elapsed / this.deathLingerTime);
            }
            
            if (deathAlpha <= 0) {
                this.active = false;
                this.solid = false;
                return;
            }
            
            ctx.globalAlpha = deathAlpha * 0.5;
            ctx.fillStyle = '#333';
            ctx.fillRect(drawX, drawY, width, height);
            ctx.globalAlpha = 1;
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(drawX + 5, drawY + 5);
            ctx.lineTo(drawX + width - 5, drawY + height - 5);
            ctx.moveTo(drawX + width - 5, drawY + 5);
            ctx.lineTo(drawX + 5, drawY + height - 5);
            ctx.stroke();
            
            // Show DEAD or LOOT text
            ctx.fillStyle = hasUncollectedLoot ? '#ffd700' : '#ff0000';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(hasUncollectedLoot ? 'LOOT' : 'DEAD', this.x, drawY + height / 2);
            
            return;
        }
        
        if (!this.combatStats) return;
        
        var hpPercent = this.combatStats.hp / this.combatStats.maxHp;
        var barY = drawY - 16;
        var barWidth = width;
        var barHeight = 4;
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, barY, barWidth, barHeight);
        
        ctx.fillStyle = '#333';
        ctx.fillRect(drawX + 1, barY + 1, barWidth - 2, barHeight - 2);
        
        ctx.fillStyle = '#333';
        ctx.fillRect(drawX, barY, barWidth, barHeight);
        
        ctx.fillStyle = hpPercent < 0.3 ? '#ff0000' : (hpPercent < 0.6 ? '#ff8800' : '#00ff00');
        ctx.fillRect(drawX + 1, barY + 1, (barWidth - 2) * hpPercent, barHeight - 2);
        
        if (window.engine && window.engine.statusEffectManager) {
            var effects = window.engine.statusEffectManager.getEffects(this.id);
            if (effects && effects.length > 0) {
                var iconSize = 10;
                var iconSpacing = 2;
                var startX = drawX;
                var iconY = barY - iconSize - 2;
                
                for (var i = 0; i < effects.length; i++) {
                    var effect = effects[i];
                    ctx.fillStyle = effect.color || '#ffffff';
                    ctx.globalAlpha = 0.9;
                    ctx.beginPath();
                    ctx.arc(startX + iconSize / 2 + i * (iconSize + iconSpacing), iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    if (effect.icon && effect.icon.length === 1) {
                        ctx.fillStyle = '#fff';
                        ctx.font = '8px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(effect.icon, startX + iconSize / 2 + i * (iconSize + iconSpacing), iconY + iconSize / 2);
                    }
                }
            }
        }
        
        if (this.name) {
            ctx.fillStyle = '#fff';
            ctx.font = '9px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, barY - 2);
        }
    }
    
    getFramePosition(frameIndex) {
        var framesPerRow = this.manifest.framesPerRow || 10;
        return {
            x: (frameIndex % framesPerRow) * this.manifest.frameWidth,
            y: Math.floor(frameIndex / framesPerRow) * this.manifest.frameHeight
        };
    }
    
    renderFallback(ctx, renderer) {
        var drawX = this.x - this.width / 2;
        var drawY = this.y - this.height / 2;
        
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(drawX, drawY, this.width, this.height);
        
        if (this.hitFlashTime > 0) {
            ctx.save();
            ctx.globalAlpha = this.hitFlashTime > 250 ? 0.8 : (this.hitFlashTime / 300);
            ctx.fillStyle = '#ffffcc';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            ctx.restore();
        }
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, drawY, this.width, this.height);
    }

    setDeadBodyLoot(gold, items) {
        this.deadBodyLoot = {
            gold: gold || 0,
            items: items || [],
            collected: false
        };
    }

    lootBody(collector) {
        if (!this.deadBodyLoot || this.deadBodyLoot.collected) {
            return { success: false, error: 'no_loot' };
        }

        var result = {
            gold: this.deadBodyLoot.gold,
            items: this.deadBodyLoot.items.slice(),
            success: true
        };

        this.deadBodyLoot.collected = true;
        console.log('[Entity] Body looted by', collector.id, 'gold:', result.gold, 'items:', result.items.length);

        return result;
    }

    canLootBody(entity) {
        if (!this.deadBodyLoot || this.deadBodyLoot.collected) return false;
        if (!this.combatStats || this.combatStats.hp > 0) return false;

        var dx = entity.x - this.x;
        var dy = entity.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        return dist < this.interactionRadius;
    }
};

console.log('[Entity] Class loaded');
