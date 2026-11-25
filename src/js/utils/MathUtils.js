var RealmKit = RealmKit || {};

RealmKit.MathUtils = {
    /**
     * Calculate distance between two points using Pythagorean theorem
     * @param {number} x1 - First point X coordinate
     * @param {number} y1 - First point Y coordinate
     * @param {number} x2 - Second point X coordinate
     * @param {number} y2 - Second point Y coordinate
     * @returns {number} Distance between points
     */
    distance: function(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    /**
     * Calculate squared distance (faster, no sqrt)
     * Useful for distance comparisons without needing actual distance
     * @param {number} x1 - First point X coordinate
     * @param {number} y1 - First point Y coordinate
     * @param {number} x2 - Second point X coordinate
     * @param {number} y2 - Second point Y coordinate
     * @returns {number} Squared distance between points
     */
    distanceSq: function(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return dx * dx + dy * dy;
    },
    
    /**
     * Check if two points are within a given distance
     * Uses squared distance for performance (avoids sqrt)
     * @param {number} x1 - First point X coordinate
     * @param {number} y1 - First point Y coordinate
     * @param {number} x2 - Second point X coordinate
     * @param {number} y2 - Second point Y coordinate
     * @param {number} range - Maximum distance
     * @returns {boolean} True if within range
     */
    withinRange: function(x1, y1, x2, y2, range) {
        return this.distanceSq(x1, y1, x2, y2) <= range * range;
    },
    
    /**
     * Get direction from point A to point B (as unit vector)
     * @param {number} x1 - From point X coordinate
     * @param {number} y1 - From point Y coordinate
     * @param {number} x2 - To point X coordinate
     * @param {number} y2 - To point Y coordinate
     * @returns {object} Object with nx, ny (normalized direction) and dist
     */
    getDirection: function(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.0001) {
            return { nx: 0, ny: 0, dist: 0 };
        }
        
        return { nx: dx / dist, ny: dy / dist, dist: dist };
    },
    
    /**
     * Linear interpolation between two values
     * @param {number} start - Starting value
     * @param {number} end - Ending value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp: function(start, end, t) {
        return start + (end - start) * t;
    },
    
    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    /**
     * Generate a random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    randomInt: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Generate a random float between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random float
     */
    randomFloat: function(min, max) {
        return Math.random() * (max - min) + min;
    }
};

console.log('[MathUtils] Module loaded');
