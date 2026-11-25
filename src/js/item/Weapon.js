var RealmKit = RealmKit || {};

RealmKit.WeaponTypes = {
    sword: { length: 25, width: 4, color: '#a0a0a0', glowColor: '#ffcc00' },
    axe: { length: 20, width: 8, color: '#8b4513', glowColor: '#ff6600' },
    dagger: { length: 15, width: 3, color: '#c0c0c0', glowColor: '#00ffff' },
    staff: { length: 30, width: 5, color: '#654321', glowColor: '#9932cc' },
    mace: { length: 18, width: 10, color: '#555555', glowColor: '#ff4444' },
    spear: { length: 35, width: 3, color: '#8b4513', glowColor: '#44ff44' },
    bow: { length: 20, width: 6, color: '#8b4513', glowColor: '#ffcc00', attackType: 'ranged' },
    crossbow: { length: 18, width: 8, color: '#555555', glowColor: '#ff8800', attackType: 'ranged' },
    wand: { length: 25, width: 3, color: '#654321', glowColor: '#9932cc', attackType: 'magic' },
    musket: { length: 30, width: 6, color: '#444444', glowColor: '#ffaa00', attackType: 'ranged' }
};

RealmKit.ProjectileTypes = {
    arrow: { speed: 350, color: '#8b4513', frames: 1 },
    bolt: { speed: 450, color: '#666666', frames: 1 },
    spark: { speed: 600, color: '#9932cc', frames: 4, frameTime: 50 },
    bullet: { speed: 800, color: '#ffaa00', frames: 1 },
    magic_orb: { speed: 500, color: '#00ccff', frames: 4, frameTime: 80 },
    fireball: { speed: 400, color: '#ff4400', frames: 4, frameTime: 60 }
};

RealmKit.Weapon = class Weapon {
    constructor(config) {
        this.id = config.id || 'weapon';
        this.name = config.name || 'Weapon';
        this.type = config.type || 'sword';
        this.damage = config.damage || 10;
        this.range = config.range || 50;
        this.speed = config.speed || 1;
        
        this.attackType = config.attackType || 'melee';
        
        if (config.projectile) {
            this.projectile = {
                type: config.projectile.type || 'arrow',
                speed: config.projectile.speed || 350,
                sprite: config.projectile.sprite || null,
                color: config.projectile.color || '#ffcc00',
                frames: config.projectile.frames || 1,
                frameTime: config.projectile.frameTime || 50,
                accuracy: config.projectile.accuracy !== undefined ? config.projectile.accuracy : 0.85
            };
        } else if (this.attackType === 'ranged' || this.attackType === 'magic') {
            var projDefaults = RealmKit.ProjectileTypes[this.type] || RealmKit.ProjectileTypes.arrow;
            this.projectile = {
                type: this.type,
                speed: projDefaults.speed,
                sprite: null,
                color: projDefaults.color,
                frames: projDefaults.frames,
                frameTime: projDefaults.frameTime || 50,
                accuracy: 0.85
            };
        } else {
            this.projectile = null;
        }
        
        this.ammoType = config.ammoType || null;
        this.ammoConsumed = config.ammoConsumed || 1;
        this.fireRate = config.fireRate || 1.5;
        this.loadingTime = config.loadingTime || 0;
        this.mpCost = config.mpCost || 0;
        
        this.attackDuration = config.attackDuration || 300;
        this.attackTime = 0;
        this.isAttacking = false;
        this.attackPhase = 0;
        
        this.statusEffects = config.statusEffects || [];
        
        var weaponData = RealmKit.WeaponTypes[this.type] || RealmKit.WeaponTypes.sword;
        
        this.length = config.length || weaponData.length;
        this.width = config.width || weaponData.width;
        this.color = config.color || weaponData.color;
        this.glowColor = config.glowColor || weaponData.glowColor;
        
        this.scale = config.scale || 0.7;
        this.swingOffset = 0;
        
        console.log('[Weapon] Created:', this.id, this.type, 'attackType:', this.attackType, 'range:', this.range);
    }
    
    isRanged() {
        return this.attackType === 'ranged' || this.attackType === 'magic';
    }
    
    isMagic() {
        return this.attackType === 'magic';
    }
    
    getProjectileConfig() {
        if (!this.projectile) return null;
        
        return {
            speed: this.projectile.speed,
            sprite: this.projectile.sprite,
            color: this.projectile.color,
            frames: this.projectile.frames,
            frameTime: this.projectile.frameTime,
            accuracy: this.projectile.accuracy
        };
    }
    
    static randomize(baseDamage) {
        var types = Object.keys(RealmKit.WeaponTypes);
        var type = types[Math.floor(Math.random() * types.length)];
        var data = RealmKit.WeaponTypes[type];
        var scaleVariation = 0.6 + Math.random() * 0.3;
        
        var attackType = data.attackType || 'melee';
        var projectile = null;
        
        if (attackType === 'ranged' || attackType === 'magic') {
            var projDefaults = RealmKit.ProjectileTypes[type] || RealmKit.ProjectileTypes.arrow;
            projectile = {
                type: type,
                speed: projDefaults.speed * (0.8 + Math.random() * 0.4),
                color: projDefaults.color,
                frames: projDefaults.frames,
                frameTime: projDefaults.frameTime || 50,
                accuracy: 0.75 + Math.random() * 0.2
            };
        }
        
        var statusEffects = [];
        if (Math.random() < 0.3) {
            var effectTypes = ['poison', 'burn', 'bleed', 'slow', 'weakness', 'vulnerability'];
            var effectType = effectTypes[Math.floor(Math.random() * effectTypes.length)];
            var durations = { poison: 5000, burn: 4000, bleed: 8000, slow: 3000, weakness: 10000, vulnerability: 8000 };
            statusEffects.push({
                type: effectType,
                chance: 0.25 + Math.random() * 0.25,
                duration: durations[effectType] || 5000
            });
        }
        
        return {
            type: type,
            attackType: attackType,
            projectile: projectile,
            length: data.length * scaleVariation,
            width: data.width,
            color: data.color,
            glowColor: data.glowColor,
            scale: 0.5 + Math.random() * 0.3,
            damage: Math.floor(baseDamage * (0.8 + Math.random() * 0.4)),
            range: attackType === 'melee' ? 50 : 300 + Math.floor(Math.random() * 200),
            statusEffects: statusEffects,
            ammoType: attackType === 'ranged' ? 'arrow' : null,
            fireRate: attackType === 'ranged' ? 1.0 + Math.random() : 1.5
        };
    }
    
    startAttack(direction) {
        this.isAttacking = true;
        this.attackTime = 0;
        this.attackPhase = 0;
        this.attackDirection = direction || 'down';
    }

    // Returns { name: 'windup'|'strike'|'impact'|'followthrough', t: 0..1 }
    // Phase boundaries (fraction of total attackDuration):
    //   windup:        0.00 → 0.25   (25%)  slow pull-back
    //   strike:        0.25 → 0.55   (30%)  fast snap forward
    //   impact:        0.55 → 0.70   (15%)  hold at forward position
    //   followthrough: 0.70 → 1.00   (30%)  ease back to rest
    getPhaseInfo() {
        if (!this.isAttacking) return { name: 'idle', t: 0 };
        var p = this.attackPhase;
        if (p < 0.25) return { name: 'windup',        t: p / 0.25 };
        if (p < 0.55) return { name: 'strike',         t: (p - 0.25) / 0.30 };
        if (p < 0.70) return { name: 'impact',         t: (p - 0.55) / 0.15 };
        return              { name: 'followthrough',   t: (p - 0.70) / 0.30 };
    }

    // Returns per-direction angle / offset data for all 4 phases
    _getDirectionAngles(dir) {
        var PI = Math.PI;
        if (dir === 'right') {
            return {
                rest:     -PI/8,          restOX:     5,   restOY:  0,
                windup:   -PI/4 - 0.4,    windupOX:  -2,   windupOY: 0,
                impact:   -PI/4 + PI*0.55, impactOX:  10,   impactOY: 0,
                follow:   -PI/4 + PI*1.2
            };
        } else if (dir === 'left') {
            return {
                rest:     PI + PI/8,       restOX:    -5,   restOY:  0,
                windup:   PI + PI/4 + 0.4, windupOX:   2,   windupOY: 0,
                impact:   PI + PI/4 - PI*0.55, impactOX: -10, impactOY: 0,
                follow:   PI + PI/4 - PI*1.2
            };
        } else if (dir === 'up') {
            return {
                rest:     -PI/2 - PI/8,       restOX:  0,  restOY:  -5,
                windup:   -PI/2 - PI/4 - 0.4, windupOX: 0, windupOY:  2,
                impact:   -PI/2 - PI/4 + PI*0.55, impactOX: 0, impactOY: -10,
                follow:   -PI/2 - PI/4 + PI*1.2
            };
        } else { // down
            return {
                rest:     PI/2 + PI/8,        restOX:  0,  restOY:   5,
                windup:   PI/2 + PI/4 + 0.4,  windupOX: 0, windupOY: -2,
                impact:   PI/2 + PI/4 - PI*0.55, impactOX: 0, impactOY: 10,
                follow:   PI/2 + PI/4 - PI*1.2
            };
        }
    }

    update(deltaTime) {
        if (!this.isAttacking) return;

        this.attackTime += deltaTime;
        this.attackPhase = this.attackTime / this.attackDuration;

        if (this.attackTime >= this.attackDuration) {
            this.isAttacking = false;
            this.attackTime = 0;
            this.attackPhase = 0;
        }
    }

    render(ctx, ownerX, ownerY, direction) {
        ctx.save();

        var scale = this.scale;
        var info = this.getPhaseInfo();
        var ang = this._getDirectionAngles(direction);

        var angle, offsetX, offsetY;

        if (!this.isAttacking) {
            // Resting pose
            angle   = ang.rest;
            offsetX = ang.restOX;
            offsetY = ang.restOY;
        } else {
            var t = info.t;

            if (info.name === 'windup') {
                // easeInQuad — starts slow, accelerates into pull-back
                var e = t * t;
                angle   = ang.rest   + (ang.windup  - ang.rest)   * e;
                offsetX = ang.restOX + (ang.windupOX - ang.restOX) * e;
                offsetY = ang.restOY + (ang.windupOY - ang.restOY) * e;

            } else if (info.name === 'strike') {
                // easeOutCubic — blazes forward, decelerates at impact
                var e = 1 - Math.pow(1 - t, 3);
                angle   = ang.windup  + (ang.impact  - ang.windup)  * e;
                offsetX = ang.windupOX + (ang.impactOX - ang.windupOX) * e;
                offsetY = ang.windupOY + (ang.impactOY - ang.windupOY) * e;

            } else if (info.name === 'impact') {
                // Hold at impact angle; tiny vibration for feel
                angle   = ang.impact + Math.sin(t * Math.PI * 3) * 0.04;
                offsetX = ang.impactOX;
                offsetY = ang.impactOY;

            } else { // followthrough
                // easeInOutQuad — smooth deceleration back toward rest
                var e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
                angle   = ang.impact  + (ang.follow  - ang.impact)  * e;
                offsetX = ang.impactOX + (ang.restOX  - ang.impactOX) * e;
                offsetY = ang.impactOY + (ang.restOY  - ang.impactOY) * e;
            }
        }

        // Translate to world position FIRST, then rotate, then scale geometry.
        // Doing scale() before translate() was wrong: the viewport's built-in
        // translate(-vpX,-vpY) also got scaled down, sending the weapon off-screen.
        ctx.translate(ownerX + offsetX, ownerY + offsetY);
        ctx.rotate(angle);
        ctx.scale(scale, scale);

        // Glow only during strike + impact phases
        if (this.isAttacking && (info.name === 'strike' || info.name === 'impact')) {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur  = info.name === 'strike' ? 8 + info.t * 8 : 12;
        }

        this.drawWeapon(ctx);
        ctx.restore();
    }
    
    drawWeapon(ctx) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.fillStyle = this.color;
        
        if (this.type === 'sword') {
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(-5, -3);
            ctx.lineTo(this.length * 0.3, -4);
            ctx.lineTo(this.length, -2);
            ctx.lineTo(this.length, 2);
            ctx.lineTo(this.length * 0.3, 4);
            ctx.lineTo(-5, 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#654321';
            ctx.fillRect(-15, -2, 10, 4);
        } else if (this.type === 'axe') {
            ctx.fillRect(-10, -2, this.length * 0.5, 4);
            ctx.strokeRect(-10, -2, this.length * 0.5, 4);
            
            ctx.beginPath();
            ctx.moveTo(this.length * 0.4, 0);
            ctx.quadraticCurveTo(this.length, -8, this.length * 0.7, -10);
            ctx.lineTo(this.length, 0);
            ctx.lineTo(this.length * 0.7, 10);
            ctx.quadraticCurveTo(this.length, 8, this.length * 0.4, 0);
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'dagger') {
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(this.length * 0.5, -2);
            ctx.lineTo(this.length, 0);
            ctx.lineTo(this.length * 0.5, 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#654321';
            ctx.fillRect(-12, -2, 5, 4);
        } else if (this.type === 'staff') {
            ctx.fillRect(-5, -2, this.length, 4);
            ctx.strokeRect(-5, -2, this.length, 4);
            
            ctx.fillStyle = '#9932cc';
            ctx.beginPath();
            ctx.arc(this.length - 5, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'mace') {
            ctx.fillRect(-8, -2, this.length * 0.6, 4);
            ctx.strokeRect(-8, -2, this.length * 0.6, 4);
            
            ctx.beginPath();
            ctx.arc(this.length * 0.5, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#333';
            for (var i = 0; i < 6; i++) {
                var a = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(this.length * 0.5 + Math.cos(a) * 6, Math.sin(a) * 6, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.type === 'spear') {
            ctx.fillRect(-5, -1, this.length * 0.8, 2);
            ctx.strokeRect(-5, -1, this.length * 0.8, 2);
            
            ctx.beginPath();
            ctx.moveTo(this.length * 0.7, 0);
            ctx.lineTo(this.length, -3);
            ctx.lineTo(this.length + 5, 0);
            ctx.lineTo(this.length, 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
};

console.log('[Weapon] Class loaded');