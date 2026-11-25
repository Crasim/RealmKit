var RealmKit = RealmKit || {};

RealmKit.PreloadManager = class PreloadManager {
    constructor(config) {
        config = config || {};
        
        this.engine = config.engine || null;
        this.assetLoader = config.assetLoader || null;
        
        this.showProgress = config.showProgress !== false;
        this.timeout = config.timeout || 30000;
        this.retryCount = config.retryCount || 3;
        this.retryDelay = config.retryDelay || 1000;
        
        this.preloadQueue = [];
        this.preloaded = {};
        this.totalAssets = 0;
        this.loadedAssets = 0;
        
        this.progressCallback = null;
        this.completeCallback = null;
        this.errorCallback = null;
        
        this.overlayElement = null;
        this.progressBar = null;
        this.statusText = null;
        
        console.log('[PreloadManager] Initialized');
    }
    
    setEngine(engine) {
        this.engine = engine;
        return this;
    }
    
    setAssetLoader(assetLoader) {
        this.assetLoader = assetLoader;
        return this;
    }
    
    setProgressCallback(callback) {
        this.progressCallback = callback;
        return this;
    }
    
    setCompleteCallback(callback) {
        this.completeCallback = callback;
        return this;
    }
    
    setErrorCallback(callback) {
        this.errorCallback = callback;
        return this;
    }
    
    addToQueue(item) {
        this.preloadQueue.push(item);
        this.totalAssets++;
        return this;
    }
    
    addImage(key, src, options) {
        options = options || {};
        this.preloadQueue.push({
            type: 'image',
            key: key,
            src: src,
            priority: options.priority || 0,
            critical: options.critical || false
        });
        this.totalAssets++;
        return this;
    }
    
    addManifest(key, src, options) {
        options = options || {};
        this.preloadQueue.push({
            type: 'manifest',
            key: key,
            src: src,
            priority: options.priority || 0,
            critical: options.critical || false
        });
        this.totalAssets++;
        return this;
    }
    
    addSpritesheet(key, imagePath, manifestPath, options) {
        this.addImage(key, imagePath, options);
        this.addManifest(key, manifestPath, options);
        return this;
    }
    
    addEssentialAssets(assets) {
        for (var i = 0; i < assets.length; i++) {
            var asset = assets[i];
            if (asset.type === 'image') {
                this.addImage(asset.key, asset.src, { priority: 10, critical: true });
            } else if (asset.type === 'manifest') {
                this.addManifest(asset.key, asset.src, { priority: 10, critical: true });
            }
        }
        return this;
    }
    
    sortQueueByPriority() {
        this.preloadQueue.sort(function(a, b) {
            return (b.priority || 0) - (a.priority || 0);
        });
    }
    
    createOverlay() {
        if (!this.showProgress) return;
        
        if (this.overlayElement) return;
        
        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'preload-overlay';
        this.overlayElement.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'width: 100%',
            'height: 100%',
            'background: #0a0f14',
            'display: flex',
            'flex-direction: column',
            'align-items: center',
            'justify-content: center',
            'z-index: 99999',
            'font-family: "Press Start 2P", monospace'
        ].join(';');
        
        var title = document.createElement('div');
        title.style.cssText = 'color: #4a8;color: #ffffff;font-size: 24px;margin-bottom: 30px;';
        title.textContent = 'RealmKit';
        this.overlayElement.appendChild(title);
        
        var progressContainer = document.createElement('div');
        progressContainer.style.cssText = 'width: 300px;height: 20px;background: #1a2030;border: 2px solid #3a5a70;border-radius: 4px;overflow: hidden;';
        
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = 'width: 0%;height: 100%;background: linear-gradient(90deg, #2a6040, #4a8a60);transition: width 0.2s;';
        progressContainer.appendChild(this.progressBar);
        this.overlayElement.appendChild(progressContainer);
        
        this.statusText = document.createElement('div');
        this.statusText.style.cssText = 'color: #8899aa;font-size: 10px;margin-top: 15px;';
        this.statusText.textContent = 'Loading assets...';
        this.overlayElement.appendChild(this.statusText);
        
        document.body.appendChild(this.overlayElement);
    }
    
    updateProgress(loaded, total, key) {
        this.loadedAssets = loaded;
        
        if (this.progressBar) {
            var percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
            this.progressBar.style.width = percent + '%';
        }
        
        if (this.statusText) {
            var percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
            this.statusText.textContent = percent + '% - ' + (key || 'Loading...');
        }
        
        if (this.progressCallback) {
            this.progressCallback(loaded, total, key);
        }
    }
    
    hideOverlay() {
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.style.opacity = '0';
            this.overlayElement.style.transition = 'opacity 0.3s';
            var self = this;
            setTimeout(function() {
                if (self.overlayElement && self.overlayElement.parentNode) {
                    self.overlayElement.parentNode.removeChild(self.overlayElement);
                    self.overlayElement = null;
                }
            }, 300);
        }
    }
    
    loadItem(item) {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            var retryAttempts = 0;
            var attemptTimeout = null;
            
            function attempt() {
                if (item.type === 'image') {
                    var image = new Image();
                    
                    attemptTimeout = setTimeout(function() {
                        image.onerror = null;
                        image.onload = null;
                        handleRetry('Timeout loading image: ' + item.key);
                    }, self.timeout);
                    
                    image.onload = function() {
                        clearTimeout(attemptTimeout);
                        RealmKit.AssetCache.setImage(item.key, image);
                        self.preloaded[item.key] = { type: 'image', asset: image };
                        resolve({ key: item.key, success: true });
                    };
                    
                    image.onerror = function() {
                        clearTimeout(attemptTimeout);
                        handleRetry('Failed to load image: ' + item.key);
                    };
                    
                    image.src = item.src;
                } else if (item.type === 'manifest') {
                    attemptTimeout = setTimeout(function() {
                        handleRetry('Timeout loading manifest: ' + item.key);
                    }, self.timeout);
                    
                    fetch(item.src)
                        .then(function(response) {
                            clearTimeout(attemptTimeout);
                            if (!response.ok) {
                                throw new Error('HTTP ' + response.status);
                            }
                            return response.json();
                        })
                        .then(function(data) {
                            clearTimeout(attemptTimeout);
                            RealmKit.AssetCache.setManifest(item.key, data);
                            self.preloaded[item.key] = { type: 'manifest', asset: data };
                            resolve({ key: item.key, success: true });
                        })
                        .catch(function(error) {
                            clearTimeout(attemptTimeout);
                            handleRetry('Failed to load manifest: ' + item.key + ' - ' + error.message);
                        });
                }
            }
            
            function handleRetry(errorMsg) {
                retryAttempts++;
                if (retryAttempts <= self.retryCount) {
                    console.warn('[PreloadManager] Retry', retryAttempts, 'for', item.key);
                    setTimeout(attempt, self.retryDelay);
                } else {
                    console.error('[PreloadManager] ' + errorMsg);
                    if (item.critical) {
                        reject(new Error(errorMsg));
                    } else {
                        resolve({ key: item.key, success: false, error: errorMsg });
                    }
                }
            }
            
            attempt();
        });
    }
    
    start() {
        var self = this;
        
        this.sortQueueByPriority();
        this.createOverlay();
        
        console.log('[PreloadManager] Starting preload of', this.preloadQueue.length, 'items');
        
        var loadedCount = 0;
        var errors = [];
        var promises = [];
        
        for (var i = 0; i < this.preloadQueue.length; i++) {
            (function(item, index) {
                var p = self.loadItem(item)
                    .then(function(result) {
                        loadedCount++;
                        self.updateProgress(loadedCount, self.preloadQueue.length, item.key);
                        return result;
                    })
                    .catch(function(error) {
                        loadedCount++;
                        self.updateProgress(loadedCount, self.preloadQueue.length, item.key);
                        errors.push({ key: item.key, error: error.message });
                        return { key: item.key, success: false, error: error.message };
                    });
                promises.push(p);
            })(this.preloadQueue[i], i);
        }
        
        return Promise.all(promises)
            .then(function(results) {
                self.hideOverlay();
                
                var successes = results.filter(function(r) { return r.success; });
                var failures = results.filter(function(r) { return !r.success; });
                
                console.log('[PreloadManager] Complete:', successes.length, 'succeeded,', failures.length, 'failed');
                
                if (self.completeCallback) {
                    self.completeCallback(successes, failures);
                }
                
                return {
                    successes: successes,
                    failures: failures,
                    preloaded: self.preloaded
                };
            });
    }
    
    preloadCriticalOnly() {
        var criticalItems = this.preloadQueue.filter(function(item) {
            return item.critical;
        });
        
        if (criticalItems.length === 0) {
            console.log('[PreloadManager] No critical assets to preload');
            return Promise.resolve({ successes: [], failures: [], preloaded: {} });
        }
        
        var self = this;
        this.preloadQueue = criticalItems;
        this.totalAssets = criticalItems.length;
        
        console.log('[PreloadManager] Preloading', criticalItems.length, 'critical assets');
        
        return this.start();
    }
    
    loadDeferred() {
        var deferredItems = this.preloadQueue.filter(function(item) {
            return !item.critical;
        });
        
        if (deferredItems.length === 0) {
            console.log('[PreloadManager] No deferred assets');
            return Promise.resolve({ successes: [], failures: [] });
        }
        
        return this.start();
    }
    
    getPreloaded(key) {
        return this.preloaded[key] || null;
    }
    
    getStats() {
        return {
            queued: this.preloadQueue.length,
            loaded: this.loadedAssets,
            total: this.totalAssets,
            preloaded: Object.keys(this.preloaded).length
        };
    }
    
    clear() {
        this.preloadQueue = [];
        this.preloaded = {};
        this.totalAssets = 0;
        this.loadedAssets = 0;
        console.log('[PreloadManager] Queue cleared');
    }
};

console.log('[PreloadManager] Class loaded');