var RealmKit = RealmKit || {};

RealmKit.Camera = class Camera {
    constructor(config) {
        this.config = config || {};
        
        this.x = 0;
        this.y = 0;
        
        this.target = null;
        
        this.viewWidth = this.config.viewWidth || 400;
        this.viewHeight = this.config.viewHeight || 300;
        
        this.smoothing = typeof this.config.smoothing === 'number' ? this.config.smoothing : 0.1;
        
        this.needsRedraw = true;
        this.lastTargetX = 0;
        this.lastTargetY = 0;
        
        this._calculateDeadZone();
        this._calculateEdgeZone();
        
        console.log('[Camera] Initialized', {
            viewWidth: this.viewWidth,
            viewHeight: this.viewHeight,
            smoothing: this.smoothing
        });
    }
    
    _calculateDeadZone() {
        var deadZoneWidth = typeof this.config.deadZoneWidth === 'number' ? this.config.deadZoneWidth : 0.4;
        var deadZoneHeight = typeof this.config.deadZoneHeight === 'number' ? this.config.deadZoneHeight : 0.4;
        
        this.deadZone = {
            left: this.viewWidth * (0.5 - deadZoneWidth / 2),
            right: this.viewWidth * (0.5 + deadZoneWidth / 2),
            top: this.viewHeight * (0.5 - deadZoneHeight / 2),
            bottom: this.viewHeight * (0.5 + deadZoneHeight / 2)
        };
    }
    
    _calculateEdgeZone() {
        this.edgeZone = {
            left: this.viewWidth * 0.15,
            right: this.viewWidth * 0.85,
            top: this.viewHeight * 0.15,
            bottom: this.viewHeight * 0.85
        };
    }
    
    _calculateDeadZone() {
        var deadZoneWidth = typeof this.config.deadZoneWidth === 'number' ? this.config.deadZoneWidth : 0.4;
        var deadZoneHeight = typeof this.config.deadZoneHeight === 'number' ? this.config.deadZoneHeight : 0.4;
        
        this.deadZone = {
            left: this.viewWidth * (0.5 - deadZoneWidth / 2),
            right: this.viewWidth * (0.5 + deadZoneWidth / 2),
            top: this.viewHeight * (0.5 - deadZoneHeight / 2),
            bottom: this.viewHeight * (0.5 + deadZoneHeight / 2)
        };
    }
    
    _calculateEdgeZone() {
        this.edgeZone = {
            left: this.viewWidth * 0.15,
            right: this.viewWidth * 0.85,
            top: this.viewHeight * 0.15,
            bottom: this.viewHeight * 0.85
        };
    }
    
    resize(viewWidth, viewHeight) {
        if (!viewWidth || !viewHeight) return;
        
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        
        this._calculateDeadZone();
        this._calculateEdgeZone();
        
        this.needsRedraw = true;
        
        console.log('[Camera] Resized', {
            viewWidth: viewWidth,
            viewHeight: viewHeight,
            deadZone: this.deadZone
        });
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    update(viewWidth, viewHeight, mapWidth, mapHeight) {
        if (!this.target) {
            return { moved: false, preloadDirection: null };
        }
        
        var targetScreenX = this.target.x - this.x;
        var targetScreenY = this.target.y - this.y;
        
        var moved = false;
        var preloadDirection = null;
        
        if (targetScreenX < this.deadZone.left) {
            var desiredX = this.target.x - this.deadZone.left;
            this.x += (desiredX - this.x) * this.smoothing;
            moved = true;
        } else if (targetScreenX > this.deadZone.right) {
            var desiredX = this.target.x - this.deadZone.right;
            this.x += (desiredX - this.x) * this.smoothing;
            moved = true;
        }
        
        if (targetScreenY < this.deadZone.top) {
            var desiredY = this.target.y - this.deadZone.top;
            this.y += (desiredY - this.y) * this.smoothing;
            moved = true;
        } else if (targetScreenY > this.deadZone.bottom) {
            var desiredY = this.target.y - this.deadZone.bottom;
            this.y += (desiredY - this.y) * this.smoothing;
            moved = true;
        }
        
        if (mapWidth !== undefined && mapHeight !== undefined) {
            this.x = Math.max(0, Math.min(this.x, mapWidth - viewWidth));
            this.y = Math.max(0, Math.min(this.y, mapHeight - viewHeight));
        }
        
        if (this.target.velocityX !== undefined && this.target.velocityY !== undefined) {
            var edgeScreenX = this.target.x - this.x;
            var edgeScreenY = this.target.y - this.y;
            
            if (edgeScreenX < this.edgeZone.left && this.target.velocityX < 0) {
                preloadDirection = 'left';
            } else if (edgeScreenX > this.edgeZone.right && this.target.velocityX > 0) {
                preloadDirection = 'right';
            }
            
            if (edgeScreenY < this.edgeZone.top && this.target.velocityY < 0) {
                preloadDirection = preloadDirection ? preloadDirection + '-up' : 'up';
            } else if (edgeScreenY > this.edgeZone.bottom && this.target.velocityY > 0) {
                preloadDirection = preloadDirection ? preloadDirection + '-down' : 'down';
            }
        }
        
        this.needsRedraw = moved || 
            Math.abs(this.target.x - this.lastTargetX) > 0.1 || 
            Math.abs(this.target.y - this.lastTargetY) > 0.1;
        
        this.lastTargetX = this.target.x;
        this.lastTargetY = this.target.y;
        
        this.viewportX = this.x;
        this.viewportY = this.y;
        
        return {
            moved: moved,
            needsRedraw: this.needsRedraw,
            preloadDirection: preloadDirection
        };
    }
    
    getPosition() {
        return { x: this.x, y: this.y };
    }
    
    isInDeadZone(screenX, screenY) {
        return screenX >= this.deadZone.left &&
               screenX <= this.deadZone.right &&
               screenY >= this.deadZone.top &&
               screenY <= this.deadZone.bottom;
    }
    
    isInEdgeZone(screenX, screenY) {
        return screenX < this.edgeZone.left ||
               screenX > this.edgeZone.right ||
               screenY < this.edgeZone.top ||
               screenY > this.edgeZone.bottom;
    }
};

console.log('[Camera] Class loaded');