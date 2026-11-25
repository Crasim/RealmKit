var RealmKit = RealmKit || {};

RealmKit.WeatherSystem = class WeatherSystem {
    constructor(config) {
        this.config = config || {};
        
        this.particles = [];
        this.maxParticles = this.config.maxParticles || 500;
        
        this.currentWeather = 'clear';
        this.intensity = 0;
        this.targetIntensity = 0;
        this.windDirection = 0;
        this.windSpeed = 50;
        
        this.transitionSpeed = 0.5;
        
        this.particlePool = [];
        
        console.log('[WeatherSystem] Initialized');
    }
    
    setWeather(type, intensity, windDir) {
        this.currentWeather = type;
        this.targetIntensity = intensity !== undefined ? intensity : 1;
        this.windDirection = windDir !== undefined ? windDir : this.windDirection;
        
        console.log('[WeatherSystem] Weather set to', type, 'intensity', this.targetIntensity);
    }
    
    update(deltaTime) {
        var dt = deltaTime / 1000;
        
        if (this.intensity < this.targetIntensity) {
            this.intensity = Math.min(this.intensity + this.transitionSpeed * dt, this.targetIntensity);
        } else if (this.intensity > this.targetIntensity) {
            this.intensity = Math.max(this.intensity - this.transitionSpeed * dt, this.targetIntensity);
        }
        
        if (this.currentWeather === 'clear') {
            for (var i = this.particles.length - 1; i >= 0; i--) {
                this.particles[i].lifetime -= deltaTime;
                if (this.particles[i].lifetime <= 0) {
                    this.particles.splice(i, 1);
                }
            }
            return;
        }
        
        var spawnRate = this.getSpawnRate();
        var toSpawn = Math.floor(spawnRate * this.intensity * dt);
        
        for (var i = 0; i < toSpawn && this.particles.length < this.maxParticles; i++) {
            var p = this.createParticle();
            if (p) this.particles.push(p);
        }
        
        for (var i = this.particles.length - 1; i >= 0; i--) {
            var p = this.particles[i];
            
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.lifetime -= deltaTime;
            
            if (p.lifetime <= 0 || p.y > p.maxY) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    getSpawnRate() {
        switch (this.currentWeather) {
            case 'rain': return 200;
            case 'snow': return 100;
            case 'storm': return 400;
            default: return 0;
        }
    }
    
    createParticle() {
        var vx = Math.cos(this.windDirection) * this.windSpeed;
        var vy = 200;
        
        var type = 'drop';
        var size = 2;
        var color = '#6688aa';
        var length = 10;
        
        if (this.currentWeather === 'snow') {
            type = 'flake';
            vy = 50 + Math.random() * 30;
            vx = Math.cos(this.windDirection) * (20 + Math.random() * 20);
            size = 2 + Math.random() * 2;
            color = '#ffffff';
            length = 0;
        } else if (this.currentWeather === 'storm') {
            type = 'drop';
            vy = 300 + Math.random() * 100;
            vx = Math.cos(this.windDirection) * (100 + Math.random() * 50);
            length = 15 + Math.random() * 10;
            color = '#88aacc';
        }
        
        return {
            x: Math.random() * 2000 - 500,
            y: -20,
            vx: vx,
            vy: vy,
            size: size,
            color: color,
            type: type,
            length: length,
            lifetime: 3000,
            maxY: 1200
        };
    }
    
    render(ctx, viewport) {
        if (this.particles.length === 0) return;
        
        ctx.save();
        
        ctx.translate(-viewport.x, -viewport.y);
        
        for (var i = 0; i < this.particles.length; i++) {
            var p = this.particles[i];
            
            ctx.globalAlpha = Math.min(1, p.lifetime / 500) * this.intensity;
            
            if (p.type === 'flake') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
    
    getParticleCount() {
        return this.particles.length;
    }
    
    getWeatherInfo() {
        return {
            type: this.currentWeather,
            intensity: this.intensity,
            wind: {
                direction: this.windDirection,
                speed: this.windSpeed
            }
        };
    }
    
    clear() {
        this.particles = [];
        this.currentWeather = 'clear';
        this.intensity = 0;
        this.targetIntensity = 0;
    }
};

console.log('[WeatherSystem] Class loaded');