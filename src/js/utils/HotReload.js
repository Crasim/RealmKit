var RealmKit = RealmKit || {};

RealmKit.HotReload = class HotReload {
    constructor(config) {
        config = config || {};
        
        this.enabled = config.enabled !== false;
        this.watchFiles = config.watchFiles || [];
        this.pollInterval = config.pollInterval || 1000;
        this.checkVersion = config.checkVersion !== false;
        
        this.fileVersions = {};
        this.reloadCallbacks = [];
        this.reloadCount = 0;
        this.lastReload = null;
        
        this.pollTimer = null;
        this.isPolling = false;
        
        if (this.enabled) {
            this.init();
        }
    }
    
    init() {
        var self = this;
        
        if (document.readyState === 'complete') {
            this.captureVersions();
            this.startPolling();
        } else {
            window.addEventListener('load', function() {
                self.captureVersions();
                self.startPolling();
            });
        }
        
        console.log('[HotReload] Initialized, polling:', this.pollInterval + 'ms');
    }
    
    captureVersions() {
        var scripts = document.querySelectorAll('script[src]');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src;
            if (src && !src.includes('://cdn.') && !src.includes('googleapis')) {
                this.fileVersions[src] = this.getFileVersion(src);
            }
        }
        
        var styles = document.querySelectorAll('link[rel="stylesheet"]');
        for (var j = 0; j < styles.length; j++) {
            var href = styles[j].href;
            if (href) {
                this.fileVersions[href] = this.getFileVersion(href);
            }
        }
    }
    
    getFileVersion(url) {
        var match = url.match(/[?&]v=([^&]+)/);
        if (match) {
            return match[1];
        }
        match = url.match(/[?&]cachebust=([^&]+)/);
        if (match) {
            return match[1];
        }
        return Date.now().toString();
    }
    
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        this.pollTimer = setInterval(this.checkChanges.bind(this), this.pollInterval);
    }
    
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.isPolling = false;
    }
    
    checkChanges() {
        var self = this;
        
        var scripts = document.querySelectorAll('script[src]');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src;
            if (src && !src.includes('://cdn.') && !src.includes('googleapis')) {
                this.checkFile(src);
            }
        }
    }
    
    checkFile(url) {
        var self = this;
        var cachedVersion = this.fileVersions[url];
        
        if (!cachedVersion) {
            this.fileVersions[url] = this.getFileVersion(url);
            return;
        }
        
        var checkUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        
        fetch(checkUrl, { method: 'HEAD' })
            .then(function(response) {
                if (response.ok) {
                    var newVersion = self.getFileVersion(response.url || url);
                    if (newVersion !== cachedVersion) {
                        console.log('[HotReload] File changed:', url);
                        self.fileVersions[url] = newVersion;
                        self.reloadFile(url);
                    }
                }
            })
            .catch(function(error) {
                
            });
    }
    
    reloadFile(url) {
        this.reloadCount++;
        this.lastReload = Date.now();
        
        var extension = url.split('.').pop().toLowerCase();
        
        if (extension === 'js') {
            this.reloadScript(url);
        } else if (extension === 'css') {
            this.reloadStylesheet(url);
        }
        
        this.notifyReload(url);
    }
    
    reloadScript(src) {
        var scripts = document.querySelectorAll('script[src="' + src + '"]');
        
        for (var i = 0; i < scripts.length; i++) {
            var oldScript = scripts[i];
            var newScript = document.createElement('script');
            
            for (var j = 0; j < oldScript.attributes.length; j++) {
                var attr = oldScript.attributes[j];
                if (attr.name !== 'src') {
                    newScript.setAttribute(attr.name, attr.value);
                }
            }
            
            newScript.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
            
            oldScript.parentNode.replaceChild(newScript, oldScript);
        }
        
        console.log('[HotReload] Reloaded script:', src);
    }
    
    reloadStylesheet(href) {
        var links = document.querySelectorAll('link[rel="stylesheet"][href="' + href + '"]');
        
        for (var i = 0; i < links.length; i++) {
            var oldLink = links[i];
            var newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = href + (href.includes('?') ? '&' : '?') + 'v=' + Date.now();
            
            oldLink.parentNode.replaceChild(newLink, oldLink);
        }
        
        console.log('[HotReload] Reloaded stylesheet:', href);
    }
    
    onReload(callback) {
        this.reloadCallbacks.push(callback);
        return this;
    }
    
    offReload(callback) {
        var index = this.reloadCallbacks.indexOf(callback);
        if (index !== -1) {
            this.reloadCallbacks.splice(index, 1);
        }
        return this;
    }
    
    notifyReload(file) {
        for (var i = 0; i < this.reloadCallbacks.length; i++) {
            try {
                this.reloadCallbacks[i](file);
            } catch (e) {
                console.error('[HotReload] Callback error:', e);
            }
        }
    }
    
    manualReload(fileUrl) {
        if (this.fileVersions[fileUrl]) {
            this.fileVersions[fileUrl] = Date.now().toString();
            this.reloadFile(fileUrl);
            return true;
        }
        return false;
    }
    
    reloadAll() {
        var count = 0;
        
        for (var url in this.fileVersions) {
            this.fileVersions[url] = Date.now().toString();
            this.reloadFile(url);
            count++;
        }
        
        console.log('[HotReload] Reloaded', count, 'files');
        return count;
    }
    
    reloadByKey(keyPattern) {
        var re = new RegExp(keyPattern);
        var count = 0;
        
        for (var url in this.fileVersions) {
            if (re.test(url)) {
                this.fileVersions[url] = Date.now().toString();
                this.reloadFile(url);
                count++;
            }
        }
        
        return count;
    }
    
    getStats() {
        return {
            enabled: this.enabled,
            polling: this.isPolling,
            fileCount: Object.keys(this.fileVersions).length,
            reloadCount: this.reloadCount,
            lastReload: this.lastReload,
            pollInterval: this.pollInterval
        };
    }
    
    setPollInterval(ms) {
        this.pollInterval = ms;
        if (this.isPolling) {
            this.stopPolling();
            this.startPolling();
        }
        return this;
    }
    
    enable() {
        if (!this.enabled) {
            this.enabled = true;
            this.captureVersions();
            this.startPolling();
        }
        return this;
    }
    
    disable() {
        this.enabled = false;
        this.stopPolling();
        return this;
    }
    
    addWatchFile(url) {
        this.watchFiles.push(url);
        this.fileVersions[url] = this.getFileVersion(url);
        return this;
    }
    
    removeWatchFile(url) {
        var index = this.watchFiles.indexOf(url);
        if (index !== -1) {
            this.watchFiles.splice(index, 1);
        }
        delete this.fileVersions[url];
        return this;
    }
    
    static create(config) {
        return new RealmKit.HotReload(config);
    }
};

console.log('[HotReload] Class loaded');