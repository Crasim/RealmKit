var RealmKit = RealmKit || {};

RealmKit.AssetLoader = class AssetLoader {
    constructor(config) {
        this.config = config || {};
        this.basePath = this.config.basePath || '';
        
        // Queue for assets to load
        this.loadQueue = [];
        this.loadedCount = 0;
        this.totalCount = 0;
        
        // Callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        
        console.log('[AssetLoader] Initialized', {
            basePath: this.basePath || '(relative)'
        });
    }
    
    /**
     * Add an image to the load queue
     * @param {string} key - Cache key
     * @param {string} src - Image path
     * @returns {AssetLoader} - this for chaining
     */
    addImage(key, src) {
        this.loadQueue.push({
            type: 'image',
            key: key,
            src: this.basePath + src
        });
        this.totalCount++;
        console.log('[AssetLoader] Queued image:', key, src);
        return this;
    }
    
    /**
     * Add a JSON manifest to the load queue
     * @param {string} key - Cache key
     * @param {string} src - JSON path
     * @returns {AssetLoader} - this for chaining
     */
    addManifest(key, src) {
        this.loadQueue.push({
            type: 'manifest',
            key: key,
            src: this.basePath + src
        });
        this.totalCount++;
        console.log('[AssetLoader] Queued manifest:', key, src);
        return this;
    }
    
    /**
     * Add both image and manifest for a spritesheet
     * @param {string} key - Base key (used for both image and manifest)
     * @param {string} imagePath - Image path
     * @param {string} manifestPath - JSON manifest path
     * @returns {AssetLoader} - this for chaining
     */
    addSpritesheet(key, imagePath, manifestPath) {
        this.addImage(key, imagePath);
        this.addManifest(key, manifestPath);
        return this;
    }
    
    /**
     * Load a single image
     * @param {Object} item - Queue item
     * @returns {Promise}
     */
    loadImage(item) {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            console.log('[AssetLoader] Loading image:', item.key, 'from', item.src);
            
            var image = new Image();
            
            image.onload = function() {
                RealmKit.AssetCache.setImage(item.key, image);
                self.loadedCount++;
                
                console.log('[AssetLoader] Image loaded:', item.key, {
                    width: image.width,
                    height: image.height,
                    progress: self.loadedCount + '/' + self.totalCount
                });
                
                if (self.onProgress) {
                    self.onProgress(self.loadedCount, self.totalCount, item.key);
                }
                
                resolve({
                    key: item.key,
                    image: image,
                    success: true
                });
            };
            
            image.onerror = function(e) {
                console.error('[AssetLoader] Image failed:', item.key, item.src, e);
                self.loadedCount++;
                
                if (self.onError) {
                    self.onError(item.key, 'image', item.src);
                }
                
                resolve({
                    key: item.key,
                    error: true,
                    success: false
                });
            };
            
            image.src = item.src;
        });
    }
    
    /**
     * Load a single JSON manifest
     * @param {Object} item - Queue item
     * @returns {Promise}
     */
    loadManifest(item) {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            console.log('[AssetLoader] Loading manifest:', item.key, 'from', item.src);
            
            fetch(item.src)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                    }
                    return response.json();
                })
                .then(function(data) {
                    RealmKit.AssetCache.setManifest(item.key, data);
                    self.loadedCount++;
                    
                    console.log('[AssetLoader] Manifest loaded:', item.key, {
                        name: data.name,
                        type: data.type,
                        frameCount: data.frameCount,
                        progress: self.loadedCount + '/' + self.totalCount
                    });
                    
                    if (self.onProgress) {
                        self.onProgress(self.loadedCount, self.totalCount, item.key);
                    }
                    
                    resolve({
                        key: item.key,
                        manifest: data,
                        success: true
                    });
                })
                .catch(function(error) {
                    console.error('[AssetLoader] Manifest failed:', item.key, item.src, error);
                    self.loadedCount++;
                    
                    if (self.onError) {
                        self.onError(item.key, 'manifest', item.src);
                    }
                    
                    resolve({
                        key: item.key,
                        error: error.message,
                        success: false
                    });
                });
        });
    }
    
    /**
     * Start loading all queued assets
     * @returns {Promise}
     */
    load() {
        var self = this;
        
        console.log('[AssetLoader] Starting load of', this.totalCount, 'assets');
        
        var promises = this.loadQueue.map(function(item) {
            if (item.type === 'image') {
                return self.loadImage(item);
            } else if (item.type === 'manifest') {
                return self.loadManifest(item);
            } else {
                console.warn('[AssetLoader] Unknown asset type:', item.type);
                return Promise.resolve({ key: item.key, error: 'Unknown type', success: false });
            }
        });
        
        return Promise.all(promises).then(function(results) {
            var successes = results.filter(function(r) { return r.success; });
            var failures = results.filter(function(r) { return !r.success; });
            
            console.log('[AssetLoader] Load complete:', {
                total: results.length,
                succeeded: successes.length,
                failed: failures.length
            });
            
            if (failures.length > 0) {
                console.error('[AssetLoader] Failed assets:', failures.map(function(f) { return f.key; }));
            }
            
            var stats = RealmKit.AssetCache.getStats();
            console.log('[AssetLoader] Cache stats:', stats);
            
            if (self.onComplete) {
                self.onComplete(successes, failures);
            }
            
            return {
                successes: successes,
                failures: failures,
                stats: stats
            };
        });
    }
    
    /**
     * Set progress callback
     * @param {Function} callback - Function(loaded, total, key)
     * @returns {AssetLoader}
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
        return this;
    }
    
    /**
     * Set complete callback
     * @param {Function} callback - Function(successes, failures)
     * @returns {AssetLoader}
     */
    setCompleteCallback(callback) {
        this.onComplete = callback;
        return this;
    }
    
    /**
     * Set error callback
     * @param {Function} callback - Function(key, type, src)
     * @returns {AssetLoader}
     */
    setErrorCallback(callback) {
        this.onError = callback;
        return this;
    }
    
    /**
     * Get load progress (0.0 to 1.0)
     * @returns {number}
     */
    getProgress() {
        if (this.totalCount === 0) return 1.0;
        return this.loadedCount / this.totalCount;
    }
    
    /**
     * Clear the load queue (doesn't clear cache)
     */
    clearQueue() {
        this.loadQueue = [];
        this.loadedCount = 0;
        this.totalCount = 0;
        console.log('[AssetLoader] Queue cleared');
    }
};

console.log('[AssetLoader] Class loaded');