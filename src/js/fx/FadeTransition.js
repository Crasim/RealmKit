var RealmKit = RealmKit || {};

RealmKit.FadeTransition = class FadeTransition {
    constructor(config) {
        this.config = config || {};
        
        this.state = 'idle';
        this.alpha = 0;
        this.targetAlpha = 0;
        this.fadeSpeed = this.config.fadeSpeed || 2;
        this.color = this.config.color || '#000000';
        
        this.onFadeComplete = null;
        this.pendingCallback = null;
        
        this.canvas = null;
        this.ctx = null;
        
        console.log('[FadeTransition] Initialized');
    }
    
    init(renderer) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = renderer.viewport.width;
        this.canvas.height = renderer.viewport.height;
        this.ctx = this.canvas.getContext('2d');
        console.log('[FadeTransition] Canvas created', this.canvas.width, 'x', this.canvas.height);
    }
    
    fadeIn(duration, callback) {
        this.state = 'fadeIn';
        this.alpha = 1;
        this.targetAlpha = 0;
        this.fadeSpeed = duration ? 1000 / duration : 2;
        this.pendingCallback = callback;
        console.log('[FadeTransition] Fade in started, duration:', duration);
    }
    
    fadeOut(duration, callback) {
        this.state = 'fadeOut';
        this.alpha = 0;
        this.targetAlpha = 1;
        this.fadeSpeed = duration ? 1000 / duration : 2;
        this.pendingCallback = callback;
        console.log('[FadeTransition] Fade out started, duration:', duration);
    }
    
    transition(scenes, callback) {
        var self = this;
        this.fadeOut(500, function() {
            if (scenes.onBlack) scenes.onBlack();
            self.fadeIn(500, callback);
        });
    }
    
    update(deltaTime) {
        if (this.state === 'idle') return;
        
        var dt = deltaTime / 1000;
        
        if (this.state === 'fadeIn') {
            this.alpha -= this.fadeSpeed * dt;
            if (this.alpha <= this.targetAlpha) {
                this.alpha = 0;
                this.state = 'idle';
                if (this.pendingCallback) {
                    var cb = this.pendingCallback;
                    this.pendingCallback = null;
                    cb();
                }
            }
        } else if (this.state === 'fadeOut') {
            this.alpha += this.fadeSpeed * dt;
            if (this.alpha >= this.targetAlpha) {
                this.alpha = 1;
                this.state = 'idle';
                if (this.pendingCallback) {
                    var cb = this.pendingCallback;
                    this.pendingCallback = null;
                    cb();
                }
            }
        }
    }
    
    render(ctx, viewport) {
        if (this.state === 'idle' && this.alpha <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
        ctx.fillStyle = this.color;
        ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
        ctx.restore();
    }
    
    resize(width, height) {
        if (this.canvas) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }
    
    isTransitioning() {
        return this.state !== 'idle';
    }
    
    forceComplete() {
        this.state = 'idle';
        this.alpha = 0;
        if (this.pendingCallback) {
            var cb = this.pendingCallback;
            this.pendingCallback = null;
            cb();
        }
    }
};

console.log('[FadeTransition] Class loaded');