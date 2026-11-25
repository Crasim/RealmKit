var RealmKit = RealmKit || {};

RealmKit.ParticleSystem = class ParticleSystem {
    constructor(config) {
        this.config = config || {};
        
        this.maxParticles = this.config.maxParticles || 100;
        
        this.pool = new RealmKit.ObjectPool(
            function() {
                return { x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '#ffffff', alpha: 1, lifetime: 0, maxLifetime: 0, gravity: 0, active: false };
            },
            function(p) {
                p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
                p.size = 0; p.color = '#ffffff'; p.alpha = 1;
                p.lifetime = 0; p.maxLifetime = 0; p.gravity = 0;
                p.active = false;
                return p;
            },
            this.maxParticles
        );
        
        this.emitters = [];
        
        console.log('[ParticleSystem] Initialized with ObjectPool, max:', this.maxParticles);
    }
    
    _createParticle(x, y, options) {
        var p = this.pool.acquire();
        if (!p || this.pool.getActiveCount() > this.maxParticles) {
            if (p) this.pool.release(p);
            return null;
        }
        
        var speed = options.speed || 50;
        var angle = (options.direction || 0) + (Math.random() - 0.5) * (options.spread || Math.PI * 2);
        var speedVariation = speed * (0.5 + Math.random() * 0.5);
        
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speedVariation;
        p.vy = Math.sin(angle) * speedVariation;
        p.size = (options.size || 3) * (0.5 + Math.random() * 0.5);
        p.color = options.color || '#ffffff';
        p.alpha = 1;
        p.lifetime = (options.lifetime || 500) * (0.5 + Math.random() * 0.5);
        p.maxLifetime = options.lifetime || 500;
        p.gravity = options.gravity || 0;
        p.active = true;
        
        return p;
    }
    
    emit(x, y, options) {
        options = options || {};
        
        var count = options.count || 5;
        
        for (var i = 0; i < count && this.pool.getActiveCount() < this.maxParticles; i++) {
            this._createParticle(x, y, {
                color: options.color || '#ffffff',
                size: options.size || 3,
                speed: options.speed || 50,
                lifetime: options.lifetime || 500,
                gravity: options.gravity || 0,
                spread: options.spread || Math.PI * 2,
                direction: options.direction || 0
            });
        }
    }
    
    emitBurst(x, y, options) {
        options = options || {};
        options.count = options.count || 10;
        options.spread = Math.PI * 2;
        this.emit(x, y, options);
    }
    
    emitDirectional(x, y, direction, options) {
        options = options || {};
        options.direction = direction;
        options.spread = options.spread || Math.PI / 3;
        this.emit(x, y, options);
    }
    
    update(deltaTime) {
        var dt = deltaTime / 1000;
        var self = this;
        
        this.pool.forEach(function(p) {
            if (!p.active) return;
            
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            if (p.gravity) {
                p.vy += p.gravity * dt;
            }
            
            p.lifetime -= deltaTime;
            p.alpha = Math.max(0, p.lifetime / p.maxLifetime);
            
            if (p.lifetime <= 0) {
                p.active = false;
            }
        });
        
        var toRelease = [];
        for (var i = this.pool.active.length - 1; i >= 0; i--) {
            if (!this.pool.active[i].active) {
                toRelease.push(this.pool.active[i]);
            }
        }
        toRelease.forEach(function(p) { self.pool.release(p); });
    }
    
    render(ctx, viewport) {
        this.pool.forEach(function(p) {
            if (!p.active) return;
            
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.globalAlpha = 1;
    }
    
    clear() {
        this.pool.releaseAll();
    }
    
    count() {
        return this.pool.getActiveCount();
    }
    
    createCollisionEffect(x, y, color) {
        this.emitBurst(x, y, {
            count: 6,
            color: color || '#ff6600',
            size: 2,
            speed: 40,
            lifetime: 300,
            gravity: 100
        });
    }
    
    createNudgeEffect(x, y) {
        this.emitBurst(x, y, {
            count: 4,
            color: '#88ccff',
            size: 2,
            speed: 30,
            lifetime: 200
        });
    }
    
    createWalkDust(x, y, direction) {
        this.emitDirectional(x, y, direction + Math.PI, {
            count: 2,
            color: '#8b7355',
            size: 1.5,
            speed: 15,
            lifetime: 150,
            spread: Math.PI / 4
        });
    }

    createBloodSplash(x, y, direction, isCrit) {
        var count = isCrit ? 12 : 6;
        var speed = isCrit ? 80 : 50;
        var size = isCrit ? 4 : 3;
        this.emitDirectional(x, y, direction, {
            count: count,
            color: '#cc2222',
            size: size,
            speed: speed,
            lifetime: 400,
            spread: Math.PI / 2,
            gravity: 200
        });
        if (isCrit) {
            this.emitBurst(x, y, {
                count: 5,
                color: '#ff4444',
                size: 2,
                speed: 60,
                lifetime: 250
            });
        }
    }

    createSparkle(x, y, color, options) {
        options = options || {};
        var count = options.count || 8;
        var size = options.size || 2;
        var speed = options.speed || 25;
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var dist = Math.random() * 8;
            this.emit(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, {
                count: 1,
                color: color || '#ffd700',
                size: size,
                speed: speed,
                lifetime: 300 + Math.random() * 200,
                gravity: -30
            });
        }
    }

    createSmoke(x, y, options) {
        options = options || {};
        var count = options.count || 5;
        var color = options.color || '#666666';
        for (var i = 0; i < count; i++) {
            this.emit(x + (Math.random() - 0.5) * 10, y, {
                count: 1,
                color: color,
                size: 4 + Math.random() * 3,
                speed: 15 + Math.random() * 10,
                lifetime: 600 + Math.random() * 400,
                gravity: -20
            });
        }
    }

    createImpactSparks(x, y) {
        this.emitBurst(x, y, {
            count: 15,
            color: '#ffcc00',
            size: 3,
            speed: 100,
            lifetime: 300,
            gravity: 150
        });
        this.emitBurst(x, y, {
            count: 8,
            color: '#ffffff',
            size: 2,
            speed: 70,
            lifetime: 200
        });
    }

    createDeathEffect(x, y) {
        this.emitBurst(x, y, {
            count: 20,
            color: '#8b0000',
            size: 4,
            speed: 60,
            lifetime: 500,
            gravity: 100
        });
        this.emitBurst(x, y, {
            count: 10,
            color: '#2a0a0a',
            size: 6,
            speed: 30,
            lifetime: 800,
            gravity: -10
        });
    }
};

console.log('[ParticleSystem] Class loaded');