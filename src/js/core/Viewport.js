var RealmKit = RealmKit || {};

RealmKit.Viewport = class Viewport {
    constructor(config) {
        this.config = config || {};
        
        this.baseWidth = this.config.baseWidth || 800;
        this.baseHeight = this.config.baseHeight || 600;
        this.tileSize = this.config.tileSize || 32;
        
        this.minScale = this.config.minScale || 1;
        this.maxScale = this.config.maxScale || 3;
        this.currentScale = this.config.defaultScale || 1;
        
        this.x = 0;
        this.y = 0;
        
        this.followTarget = null;
        
        this.viewWidth = 0;
        this.viewHeight = 0;
        
        this.displayWidth = 0;
        this.displayHeight = 0;
        
        console.log('[Viewport] Initialized', {
            baseWidth: this.baseWidth,
            baseHeight: this.baseHeight,
            tileSize: this.tileSize,
            scale: this.currentScale
        });
    }
    
    resize(displayWidth, displayHeight) {
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
        
        // Calculate how many game pixels fit in display at current scale
        this.viewWidth = Math.floor(displayWidth / this.currentScale);
        this.viewHeight = Math.floor(displayHeight / this.currentScale);
        
        console.log('[Viewport] Resized', {
            display: displayWidth + '×' + displayHeight,
            view: this.viewWidth + '×' + this.viewHeight,
            scale: this.currentScale
        });
    }
    
    setScale(scale) {
        this.currentScale = Math.max(this.minScale, Math.min(this.maxScale, scale));
        
        // Recalculate view dimensions
        if (this.displayWidth > 0) {
            this.viewWidth = Math.floor(this.displayWidth / this.currentScale);
            this.viewHeight = Math.floor(this.displayHeight / this.currentScale);
        }
    }
    
    setFollowTarget(target) {
        this.followTarget = target;
    }
    
    update(mapWidth, mapHeight) {
        // If following a target, center on it
        if (this.followTarget) {
            var targetX = this.followTarget.x;
            var targetY = this.followTarget.y;
            
            // Center camera on target
            var desiredX = targetX - (this.viewWidth / 2);
            var desiredY = targetY - (this.viewHeight / 2);
            
            // Smooth camera (optional)
            var smoothing = 0.1;
            this.x += (desiredX - this.x) * smoothing;
            this.y += (desiredY - this.y) * smoothing;
        }
        
        // Clamp to map bounds (if bounds provided)
        if (mapWidth !== undefined && mapHeight !== undefined) {
            this.x = Math.max(0, Math.min(this.x, mapWidth - this.viewWidth));
            this.y = Math.max(0, Math.min(this.y, mapHeight - this.viewHeight));
        }
    }
    
    // Convert game coordinates to screen coordinates
    gameToScreen(gameX, gameY) {
        return {
            x: Math.floor((gameX - this.x) * this.currentScale),
            y: Math.floor((gameY - this.y) * this.currentScale)
        };
    }
    
    // Convert screen coordinates to game coordinates
    screenToGame(screenX, screenY) {
        return {
            x: (screenX / this.currentScale) + this.x,
            y: (screenY / this.currentScale) + this.y
        };
    }
    
    // Check if a game coordinate is visible in viewport
    isVisible(gameX, gameY, width, height) {
        width = width || 0;
        height = height || 0;
        
        return gameX + width >= this.x &&
               gameX <= this.x + this.viewWidth &&
               gameY + height >= this.y &&
               gameY <= this.y + this.viewHeight;
    }
    
    // Get visible bounds for culling
    getVisibleBounds() {
        return {
            left: this.x,
            top: this.y,
            right: this.x + this.viewWidth,
            bottom: this.y + this.viewHeight
        };
    }
};

console.log('[Viewport] Class loaded');