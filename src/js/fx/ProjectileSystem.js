var RealmKit = RealmKit || {};

RealmKit.ProjectileSystem = class ProjectileSystem {
    constructor(config) {
        this.config = config || {};
        this.projectiles = [];
        this.maxProjectiles = this.config.maxProjectiles || 200;
        
        this.onHit = null;
        this.onMiss = null;
        this.onArrival = null;
        
        console.log('[ProjectileSystem] Initialized');
    }
    
    fire(config) {
        if (this.projectiles.length >= this.maxProjectiles) {
            var oldest = this.projectiles.shift();
            if (oldest && oldest.onComplete) {
                oldest.onComplete(null, false);
            }
        }
        
        var proj = {
            id: 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            x: config.x,
            y: config.y,
            startX: config.x,
            startY: config.y,
            targetX: config.targetX,
            targetY: config.targetY,
            targetId: config.targetId || null,
            attackerId: config.attackerId || null,
            
            speed: config.speed || 400,
            sprite: config.sprite || null,
            color: config.color || '#ffcc00',
            frames: config.frames || 1,
            frameTime: config.frameTime || 50,
            
            hit: config.hit !== undefined ? config.hit : true,
            damage: config.damage || 0,
            critical: config.critical || false,
            effectType: config.effectType || null,
            
            startTime: Date.now(),
            travelTime: 0,
            totalDistance: 0,
            frame: 0,
            frameTimer: 0,
            
            onComplete: config.onComplete || null,
            particleEffect: config.particleEffect !== false,
            audioEffect: config.audioEffect !== false
        };
        
        var dx = proj.targetX - proj.x;
        var dy = proj.targetY - proj.y;
        proj.totalDistance = Math.sqrt(dx * dx + dy * dy);
        proj.travelTime = (proj.totalDistance / proj.speed) * 1000;
        
        this.projectiles.push(proj);
        
        return proj.id;
    }
    
    update(deltaTime) {
        var dt = deltaTime / 1000;
        var completed = [];
        
        for (var i = this.projectiles.length - 1; i >= 0; i--) {
            var proj = this.projectiles[i];
            
            var dx = proj.targetX - proj.x;
            var dy = proj.targetY - proj.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5 || Date.now() - proj.startTime > proj.travelTime + 500) {
                completed.push({ index: i, proj: proj });
                continue;
            }
            
            var moveAmount = proj.speed * dt;
            if (moveAmount > dist) {
                moveAmount = dist;
            }
            
            var angle = Math.atan2(dy, dx);
            proj.x += Math.cos(angle) * moveAmount;
            proj.y += Math.sin(angle) * moveAmount;
            
            if (proj.frames > 1) {
                proj.frameTimer += deltaTime;
                if (proj.frameTimer >= proj.frameTime) {
                    proj.frameTimer = 0;
                    proj.frame = (proj.frame + 1) % proj.frames;
                }
            }
        }
        
        for (var i = completed.length - 1; i >= 0; i--) {
            var c = completed[i];
            this.projectiles.splice(c.index, 1);
            this.handleArrival(c.proj);
        }
    }
    
    handleArrival(proj) {
        if (proj.onComplete) {
            proj.onComplete(proj, proj.hit);
        }
        
        if (proj.hit) {
            if (this.onHit) {
                this.onHit(proj);
            }
        } else {
            if (this.onMiss) {
                this.onMiss(proj);
            }
        }
        
        if (this.onArrival) {
            this.onArrival(proj);
        }
    }
    
    render(ctx, viewport) {
        ctx.save();
        
        for (var i = 0; i < this.projectiles.length; i++) {
            var proj = this.projectiles[i];
            this.renderProjectile(ctx, proj, viewport);
        }
        
        ctx.restore();
    }
    
    renderProjectile(ctx, proj, viewport) {
        var screenX = proj.x - viewport.x;
        var screenY = proj.y - viewport.y;
        
        if (screenX < -50 || screenX > viewport.width + 50 ||
            screenY < -50 || screenY > viewport.height + 50) {
            return;
        }
        
        var angle = Math.atan2(proj.targetY - proj.startY, proj.targetX - proj.startX);
        
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(angle);
        
        if (proj.sprite && this.hasSprite(proj.sprite)) {
            this.renderSpriteProjectile(ctx, proj);
        } else {
            this.renderProceduralProjectile(ctx, proj);
        }
        
        ctx.restore();
    }
    
    hasSprite(spriteKey) {
        return false;
    }
    
    renderSpriteProjectile(ctx, proj) {
        // Placeholder for sprite rendering
        // When sprite system is integrated, this will draw from sprite sheet
        this.renderProceduralProjectile(ctx, proj);
    }
    
    renderProceduralProjectile(ctx, proj) {
        var size = proj.frames > 1 ? 6 + proj.frame : 6;
        var length = 12;
        
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 3;
        ctx.fillStyle = proj.color;
        
        if (proj.hit) {
            ctx.shadowColor = proj.color;
            ctx.shadowBlur = 8;
        } else {
            ctx.shadowColor = '#888';
            ctx.shadowBlur = 4;
        }
        
        if (proj.frames > 1 && proj.frame % 2 === 0) {
            ctx.beginPath();
            ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.moveTo(-length, 0);
        ctx.lineTo(0, -size / 2);
        ctx.lineTo(length, 0);
        ctx.lineTo(0, size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        if (proj.critical) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-length - 4, 0);
            ctx.lineTo(-length, -3);
            ctx.lineTo(-length, 3);
            ctx.closePath();
            ctx.stroke();
        }
    }
    
    getByAttacker(attackerId) {
        var results = [];
        for (var i = 0; i < this.projectiles.length; i++) {
            if (this.projectiles[i].attackerId === attackerId) {
                results.push(this.projectiles[i]);
            }
        }
        return results;
    }
    
    getByTarget(targetId) {
        var results = [];
        for (var i = 0; i < this.projectiles.length; i++) {
            if (this.projectiles[i].targetId === targetId) {
                results.push(this.projectiles[i]);
            }
        }
        return results;
    }
    
    remove(id) {
        for (var i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].id === id) {
                this.projectiles.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    
    clear() {
        var count = this.projectiles.length;
        this.projectiles = [];
        console.log('[ProjectileSystem] Cleared', count, 'projectiles');
    }
    
    count() {
        return this.projectiles.length;
    }
    
    setParticleHandler(particleSystem) {
        this.particles = particleSystem;
    }
    
    setAudioHandler(audioSystem) {
        this.audio = audioSystem;
    }
    
    createHitEffect(x, y, hit, critical) {
        if (!this.particles) return;
        
        if (hit) {
            this.particles.createSparkle(x, y, critical ? '#ffd700' : '#ff8800', { 
                count: critical ? 15 : 8, 
                size: critical ? 4 : 3 
            });
            if (critical) {
                this.particles.createImpactSparks(x, y);
            }
        } else {
            this.particles.createSmoke(x, y, { 
                count: 3, 
                color: '#888888' 
            });
        }
    }
    
    createMissEffect(x, y) {
        if (!this.particles) return;
        
        this.particles.createSmoke(x, y, { count: 5, color: '#666666' });
        this.particles.emit(x, y, {
            count: 8,
            color: '#999999',
            size: 2,
            speed: 30,
            lifetime: 300
        });
    }
};

console.log('[ProjectileSystem] Class loaded');