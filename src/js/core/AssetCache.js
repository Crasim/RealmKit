var RealmKit = RealmKit || {};

RealmKit.AssetCache = (function() {
    var cache = {
        images: {},
        manifests: {},
        sprites: {}
    };
    
    var stats = {
        imagesLoaded: 0,
        manifestsLoaded: 0,
        errors: 0
    };
    
    return {
        /**
         * Store an image in the cache
         * @param {string} key - Cache key
         * @param {Image} image - Loaded Image object
         */
        setImage: function(key, image) {
            cache.images[key] = image;
            stats.imagesLoaded++;
            console.log('[AssetCache] Image cached:', key, {
                width: image.width,
                height: image.height,
                total: stats.imagesLoaded
            });
        },
        
        /**
         * Get an image from the cache
         * @param {string} key - Cache key
         * @returns {Image|null} - The cached image or null
         */
        getImage: function(key) {
            var image = cache.images[key];
            if (!image) {
                console.warn('[AssetCache] Image not found:', key);
            }
            return image || null;
        },
        
        /**
         * Store a manifest in the cache
         * @param {string} key - Cache key
         * @param {Object} manifest - Parsed JSON manifest
         */
        setManifest: function(key, manifest) {
            cache.manifests[key] = manifest;
            stats.manifestsLoaded++;
            console.log('[AssetCache] Manifest cached:', key, {
                name: manifest.name,
                frameCount: manifest.frameCount,
                total: stats.manifestsLoaded
            });
        },
        
        /**
         * Get a manifest from the cache
         * @param {string} key - Cache key
         * @returns {Object|null} - The cached manifest or null
         */
        getManifest: function(key) {
            var manifest = cache.manifests[key];
            if (!manifest) {
                console.warn('[AssetCache] Manifest not found:', key);
            }
            return manifest || null;
        },
        
        /**
         * Store a processed sprite in the cache
         * @param {string} key - Cache key
         * @param {Object} sprite - Processed sprite object
         */
        setSprite: function(key, sprite) {
            cache.sprites[key] = sprite;
            console.log('[AssetCache] Sprite cached:', key);
        },
        
        /**
         * Get a sprite from the cache
         * @param {string} key - Cache key
         * @returns {Object|null} - The cached sprite or null
         */
        getSprite: function(key) {
            return cache.sprites[key] || null;
        },
        
        /**
         * Check if an asset exists in cache
         * @param {string} type - 'image', 'manifest', or 'sprite'
         * @param {string} key - Cache key
         * @returns {boolean}
         */
        has: function(type, key) {
            if (!cache[type + 's']) {
                console.error('[AssetCache] Invalid cache type:', type);
                return false;
            }
            return cache[type + 's'].hasOwnProperty(key);
        },
        
        /**
         * Get cache statistics
         * @returns {Object}
         */
        getStats: function() {
            return {
                images: stats.imagesLoaded,
                manifests: stats.manifestsLoaded,
                errors: stats.errors,
                cachedImages: Object.keys(cache.images).length,
                cachedManifests: Object.keys(cache.manifests).length,
                cachedSprites: Object.keys(cache.sprites).length
            };
        },
        
        /**
         * Clear all cached assets
         */
        clear: function() {
            cache.images = {};
            cache.manifests = {};
            cache.sprites = {};
            stats.imagesLoaded = 0;
            stats.manifestsLoaded = 0;
            stats.errors = 0;
            console.log('[AssetCache] Cache cleared');
        }
    };
})();

console.log('[AssetCache] Module loaded');