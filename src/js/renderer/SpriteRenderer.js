var RealmKit = RealmKit || {};

RealmKit.SpriteRenderer = class SpriteRenderer {
    constructor(ctx, viewport) {
        this.ctx = ctx;
        this.viewport = viewport;
        
        console.log('[SpriteRenderer] Initialized');
    }
    
    /**
     * Get a frame's position in a spritesheet
     * @param {Object} manifest - Sprite manifest
     * @param {number} frameIndex - Frame index
     * @returns {Object} - { x, y, width, height }
     */
    getFrameRect(manifest, frameIndex) {
        if (!manifest || frameIndex < 0 || frameIndex >= manifest.frameCount) {
            console.error('[SpriteRenderer] Invalid frame:', frameIndex, 'of', manifest ? manifest.frameCount : 'null manifest');
            return { x: 0, y: 0, width: 32, height: 48 };
        }
        
        var columns = Math.floor(manifest.imageWidth / manifest.frameWidth);
        var row = Math.floor(frameIndex / columns);
        var col = frameIndex % columns;
        
        return {
            x: col * manifest.frameWidth,
            y: row * manifest.frameHeight,
            width: manifest.frameWidth,
            height: manifest.frameHeight
        };
    }
    
    /**
     * Draw a sprite frame at game coordinates
     * @param {Image} image - Spritesheet image
     * @param {Object} manifest - Sprite manifest
     * @param {number} frameIndex - Frame index
     * @param {number} gameX - Game X coordinate (center)
     * @param {number} gameY - Game Y coordinate (center)
     * @param {Object} options - Optional: scale, flipX, flipY, alpha
     */
    drawSprite(image, manifest, frameIndex, gameX, gameY, options) {
        if (!image) {
            console.error('[SpriteRenderer] No image provided');
            return;
        }
        
        if (!manifest) {
            console.error('[SpriteRenderer] No manifest provided');
            return;
        }
        
        options = options || {};
        var scale = options.scale || 1;
        var flipX = options.flipX || false;
        var flipY = options.flipY || false;
        var alpha = options.alpha !== undefined ? options.alpha : 1;
        
        var frameRect = this.getFrameRect(manifest, frameIndex);
        
        var drawWidth = frameRect.width * scale;
        var drawHeight = frameRect.height * scale;
        var drawX = gameX - (drawWidth / 2);
        var drawY = gameY - (drawHeight / 2);
        
        var oldAlpha = this.ctx.globalAlpha;
        if (alpha !== 1) {
            this.ctx.globalAlpha = alpha;
        }
        
        this.ctx.save();
        
        if (flipX || flipY) {
            this.ctx.translate(
                flipX ? drawX + drawWidth : drawX,
                flipY ? drawY + drawHeight : drawY
            );
            this.ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        }
        
        this.ctx.drawImage(
            image,
            frameRect.x,
            frameRect.y,
            frameRect.width,
            frameRect.height,
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );
        
        this.ctx.restore();
        
        if (alpha !== 1) {
            this.ctx.globalAlpha = oldAlpha;
        }
        
        if (options.debug) {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
        }
    }
    
    /**
     * Draw a simple rectangle (fallback for sprites)
     * @param {number} gameX - Game X coordinate
     * @param {number} gameY - Game Y coordinate
     * @param {number} width - Width in game units
     * @param {number} height - Height in game units
     * @param {string} color - Fill color
     */
    drawRect(gameX, gameY, width, height, color) {
        var screen = this.viewport.gameToScreen(gameX, gameY);
        var scale = this.viewport.currentScale;
        
        this.ctx.fillStyle = color || '#ff6600';
        this.ctx.fillRect(screen.x, screen.y, width * scale, height * scale);
    }
    
    /**
     * Draw text at game coordinates
     * @param {string} text - Text to draw
     * @param {number} gameX - Game X coordinate
     * @param {number} gameY - Game Y coordinate
     * @param {string} color - Text color
     * @param {string} font - Font string
     * @param {string} align - Text alignment
     */
    drawText(text, gameX, gameY, color, font, align) {
        var screen = this.viewport.gameToScreen(gameX, gameY);
        
        this.ctx.fillStyle = color || '#ffffff';
        this.ctx.font = font || '12px Courier New';
        this.ctx.textAlign = align || 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, screen.x, screen.y);
    }
    
    /**
     * Check if a sprite would be visible in the viewport
     * @param {number} gameX - Game X coordinate
     * @param {number} gameY - Game Y coordinate
     * @param {number} width - Sprite width
     * @param {number} height - Sprite height
     * @returns {boolean}
     */
    isSpriteVisible(gameX, gameY, width, height) {
        return this.viewport.isVisible(gameX - width/2, gameY - height/2, width, height);
    }
};

console.log('[SpriteRenderer] Class loaded');