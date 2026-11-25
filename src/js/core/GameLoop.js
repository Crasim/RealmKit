var RealmKit = RealmKit || {};

RealmKit.GameLoop = class GameLoop {
    constructor(config) {
        this.config = config || {};
        this.targetFPS = this.config.targetFPS || 60;
        this.fixedDelta = this.config.fixedDelta || (1000 / 60);
        
        this.accumulator = 0;
        this.lastTime = 0;
        this.running = false;
        this.paused = false;
        
        this.frameCount = 0;
        this.fpsTime = 0;
        this.fps = 0;
        this.totalFrames = 0;
        
        this.maxUpdatesPerFrame = this.config.maxUpdatesPerFrame || 10;
        
        this.updateTime = 0;
        this.renderTime = 0;
        this.frameTime = 0;
        
        this.updateCallback = null;
        this.renderCallback = null;
        this.pauseCallback = null;
        
        console.log('[GameLoop] Initialized', {
            targetFPS: this.targetFPS,
            fixedDelta: this.fixedDelta.toFixed(2) + 'ms'
        });
    }
    
    setUpdateCallback(callback) {
        this.updateCallback = callback;
        console.log('[GameLoop] Update callback set');
    }
    
    setRenderCallback(callback) {
        this.renderCallback = callback;
        console.log('[GameLoop] Render callback set');
    }
    
    setPauseCallback(callback) {
        this.pauseCallback = callback;
        console.log('[GameLoop] Pause callback set');
    }
    
    start() {
        if (this.running) {
            console.warn('[GameLoop] Already running');
            return;
        }
        
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fpsTime = 0;
        this.totalFrames = 0;
        
        console.log('[GameLoop] Started');
        requestAnimationFrame((time) => this.loop(time));
    }
    
    stop() {
        this.running = false;
        console.log('[GameLoop] Stopped');
    }
    
    pause() {
        if (this.paused) return;
        this.paused = true;
        console.log('[GameLoop] Paused');
        if (this.pauseCallback) {
            this.pauseCallback(true);
        }
    }
    
    resume() {
        if (!this.paused) return;
        this.paused = false;
        this.lastTime = performance.now();
        this.accumulator = 0;
        console.log('[GameLoop] Resumed');
        if (this.pauseCallback) {
            this.pauseCallback(false);
        }
    }
    
    togglePause() {
        if (this.paused) {
            this.resume();
        } else {
            this.pause();
        }
    }
    
    isPaused() {
        return this.paused;
    }
    
    loop(currentTime) {
        if (!this.running) return;
        
        var self = this;
        
        if (this.paused) {
            if (this.renderCallback) {
                this.renderCallback(0);
            }
            requestAnimationFrame(function(time) {
                self.loop(time);
            });
            return;
        }
        
        var frameStart = performance.now();
        
        var deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        var cappedDelta = Math.min(deltaTime, 100);
        
        this.accumulator += cappedDelta;
        
        this.frameCount++;
        this.fpsTime += deltaTime;
        this.totalFrames++;
        
        if (this.fpsTime >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / this.fpsTime);
            this.frameCount = 0;
            this.fpsTime = 0;
        }
        
        var updateStart = performance.now();
        var updateCount = 0;
        while (this.accumulator >= this.fixedDelta && updateCount < this.maxUpdatesPerFrame) {
            if (this.updateCallback) {
                this.updateCallback(this.fixedDelta);
            }
            this.accumulator -= this.fixedDelta;
            updateCount++;
        }
        this.updateTime = performance.now() - updateStart;
        
        var renderStart = performance.now();
        var alpha = this.accumulator / this.fixedDelta;
        
        if (this.renderCallback) {
            this.renderCallback(alpha);
        }
        this.renderTime = performance.now() - renderStart;
        
        this.frameTime = performance.now() - frameStart;
        
        requestAnimationFrame(function(time) {
            self.loop(time);
        });
    }
    
    getFPS() {
        return this.fps;
    }
    
    getFrameTime() {
        return this.frameTime;
    }
    
    getUpdateTime() {
        return this.updateTime;
    }
    
    getRenderTime() {
        return this.renderTime;
    }
};

console.log('[GameLoop] Class loaded');