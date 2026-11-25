var RealmKit = RealmKit || {};

RealmKit.CanvasRenderer = class CanvasRenderer {
    constructor(canvasId, config) {
        this.canvasId = canvasId || 'game-canvas';
        this.config = config || {};
        
        this.canvas = null;
        this.ctx = null;
        this.displayWidth = 0;
        this.displayHeight = 0;
        
        // Viewport handles coordinate transformation
        this.viewport = null;

        // Grid settings
        this.gridSize = 32;
        this.showGrid = true;
        this.showCoordinates = true;
        
        // Performance: cache grid drawing
        this.gridNeedsRedraw = true;
        this.lastGridBounds = null;
        
        this.frameCount = 0;
        
        // Store bound resize handler for cleanup
        this._boundResize = null;
        
        console.log('[CanvasRenderer] Initialized');
    }
    
    init() {
        this.canvas = document.getElementById(this.canvasId);
        
        if (!this.canvas) {
            throw new Error('[CanvasRenderer] Canvas element \'' + this.canvasId + '\' not found');
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.ctx) {
            throw new Error('[CanvasRenderer] Could not get 2D context');
        }
        
        // Initialize viewport
        this.viewport = new RealmKit.Viewport({
            baseWidth: 800,
            baseHeight: 600,
            tileSize: 32,
            defaultScale: this.config.defaultScale || 2,
            minScale: this.config.minScale || 1,
            maxScale: this.config.maxScale || 3
        });
        
        // Initial resize
        this.resize();
        
        // Listen for window resize - store bound handler for cleanup
        this._boundResize = this.resize.bind(this);
        window.addEventListener('resize', this._boundResize);
        
        console.log('[CanvasRenderer] Canvas initialized', {
            displayWidth: this.displayWidth,
            displayHeight: this.displayHeight,
            viewWidth: this.viewport.viewWidth,
            viewHeight: this.viewport.viewHeight
        });
        
        return true;
    }
    
    resize() {
        var container = this.canvas.parentElement;
        this.displayWidth = container.clientWidth;
        this.displayHeight = container.clientHeight;
        
        this.canvas.width = this.displayWidth;
        this.canvas.height = this.displayHeight;
        
        // Update viewport dimensions
        this.viewport.resize(this.displayWidth, this.displayHeight);
        
        // Force grid redraw after resize
        this.gridNeedsRedraw = true;
        
        console.log('[CanvasRenderer] Resized', this.displayWidth, '×', this.displayHeight);
    }
    
    clear() {
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
    }
    
    update(deltaTime) {
        var dt = deltaTime / 1000;
        
        // Update position (game coordinates)
        this.testRect.x += this.testRect.velocityX * dt;
        this.testRect.y += this.testRect.velocityY * dt;
        
        // Bounce off bounds
        var padding = 50;
        var mapWidth = 1600;
        var mapHeight = 1200;
        
        if (this.testRect.x < padding) {
            this.testRect.x = padding;
            this.testRect.velocityX = Math.abs(this.testRect.velocityX);
        }
        if (this.testRect.x > mapWidth - padding) {
            this.testRect.x = mapWidth - padding;
            this.testRect.velocityX = -Math.abs(this.testRect.velocityX);
        }
        
        if (this.testRect.y < padding) {
            this.testRect.y = padding;
            this.testRect.velocityY = Math.abs(this.testRect.velocityY);
        }
        if (this.testRect.y > mapHeight - padding) {
            this.testRect.y = mapHeight - padding;
            this.testRect.velocityY = -Math.abs(this.testRect.velocityY);
        }
        
        // Update viewport to follow target
        this.viewport.update(mapWidth, mapHeight);
    }
    
    render() {
        this.clear();
        
        // Apply viewport transform
        this.ctx.save();
        this.ctx.scale(this.viewport.currentScale, this.viewport.currentScale);
        this.ctx.translate(-this.viewport.x, -this.viewport.y);
        
        // Layer 0: Ground
        this.renderGroundLayer();
        
        // Layer 2: Actors
        this.renderActorLayer();
        
        this.ctx.restore();
        
        // Draw title overlay (not affected by viewport)
        this.renderUIOverlay();
        
        // Update debug info
        this.updateDebugInfo();
        
        this.frameCount++;
    }
    
    renderGroundLayer() {
        var bounds = this.viewport.getVisibleBounds();
        
        // Draw grid (optimized - every 32px)
        if (this.showGrid) {
            this.ctx.strokeStyle = '#1e3a5f';
            this.ctx.lineWidth = 0.5;
            
            var startX = Math.floor(bounds.left / this.gridSize) * this.gridSize;
            var startY = Math.floor(bounds.top / this.gridSize) * this.gridSize;
            
            // Vertical lines
            this.ctx.beginPath();
            for (var x = startX; x < bounds.right; x += this.gridSize) {
                this.ctx.moveTo(x, bounds.top);
                this.ctx.lineTo(x, bounds.bottom);
            }
            this.ctx.stroke();
            
            // Horizontal lines
            this.ctx.beginPath();
            for (var y = startY; y < bounds.bottom; y += this.gridSize) {
                this.ctx.moveTo(bounds.left, y);
                this.ctx.lineTo(bounds.right, y);
            }
            this.ctx.stroke();
        }
        
        // Draw coordinate markers (less frequently - every 200px)
        if (this.showCoordinates) {
            this.ctx.fillStyle = '#2a4a6f';
            this.ctx.font = '12px Courier New';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            
            var labelStep = 200;
            var startX = Math.floor(bounds.left / labelStep) * labelStep;
            var startY = Math.floor(bounds.top / labelStep) * labelStep;
            
            for (var lx = startX; lx < bounds.right; lx += labelStep) {
                for (var ly = startY; ly < bounds.bottom; ly += labelStep) {
                    if (this.viewport.isVisible(lx, ly, 50, 50)) {
                        this.ctx.fillText(lx + ',' + ly, lx + 5, ly + 5);
                    }
                }
            }
        }
    }
    
    renderActorLayer() {
        var rect = this.testRect;
        
        // Calculate top-left position for centered rectangle
        var drawX = rect.x - (rect.width / 2);
        var drawY = rect.y - (rect.height / 2);
        
        // Convert to screen coordinates
        var screen = this.viewport.gameToScreen(drawX, drawY);
        var scale = this.viewport.currentScale;
        
        // Draw rectangle
        this.ctx.fillStyle = rect.color;
        this.ctx.fillRect(drawX, drawY, rect.width, rect.height);
        
        // Draw rectangle outline for visibility
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(drawX, drawY, rect.width, rect.height);
        
        // Draw label above rectangle
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(
            Math.floor(rect.x) + ', ' + Math.floor(rect.y),
            rect.x,
            drawY - 5
        );
        
        // Draw size below rectangle
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(
            rect.width + '×' + rect.height,
            rect.x,
            drawY + rect.height + 5
        );
    }
    
    renderUIOverlay() {
        // Fixed UI elements (not affected by viewport)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(10, 10, 300, 70);
        
        this.ctx.fillStyle = '#4ecca3';
        this.ctx.font = 'bold 16px Courier New';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('RealmKit Engine - Phase 0.1', 20, 20);
        
        this.ctx.fillStyle = '#888';
        this.ctx.font = '12px Courier New';
        this.ctx.fillText('Canvas + Game Loop + Viewport', 20, 42);
        this.ctx.fillText('Layers: Ground | Actors | UI', 20, 58);
    }
    
    updateDebugInfo() {
        var infoElement = document.getElementById('info-bar');
        if (infoElement) {
            var scale = this.viewport.currentScale.toFixed(1);
            var viewW = Math.floor(this.viewport.viewWidth);
            var viewH = Math.floor(this.viewport.viewHeight);
            
            infoElement.innerHTML = 
                'Game View: ' + viewW + '×' + viewH + ' | ' +
                'Scale: ' + scale + 'x | ' +
                'Player: (' + Math.floor(this.testRect.x) + ', ' + Math.floor(this.testRect.y) + ')';
        }
    }
    
    destroy() {
        if (this._boundResize) {
            window.removeEventListener('resize', this._boundResize);
            this._boundResize = null;
        }
        this.canvas = null;
        this.ctx = null;
        this.viewport = null;
    }
};

console.log('[CanvasRenderer] Class loaded');