var RealmKit = RealmKit || {};

RealmKit.ObjectPool = class ObjectPool {
    constructor(createFn, resetFn, initialSize) {
        this.createFn = createFn;
        this.resetFn = resetFn || function(obj) { return obj; };
        
        this.pool = [];
        this.active = [];
        this.maxPoolSize = 1000;
        
        if (initialSize) {
            for (var i = 0; i < initialSize; i++) {
                this.pool.push(this.createFn());
            }
        }
        
        console.log('[ObjectPool] Initialized with', this.pool.length, 'objects');
    }
    
    acquire() {
        var obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        
        this.active.push(obj);
        return obj;
    }
    
    release(obj) {
        var index = this.active.indexOf(obj);
        if (index !== -1) {
            this.active.splice(index, 1);
            this.resetFn(obj);
            
            if (this.pool.length < this.maxPoolSize) {
                this.pool.push(obj);
            }
        }
    }
    
    releaseAll() {
        while (this.active.length > 0) {
            var obj = this.active.pop();
            this.resetFn(obj);
            if (this.pool.length < this.maxPoolSize) {
                this.pool.push(obj);
            }
        }
    }
    
    getActiveCount() {
        return this.active.length;
    }
    
    getPoolCount() {
        return this.pool.length;
    }
    
    getTotalCount() {
        return this.active.length + this.pool.length;
    }
    
    forEach(callback) {
        for (var i = 0; i < this.active.length; i++) {
            callback(this.active[i], i);
        }
    }
    
    update(deltaTime) {
        for (var i = this.active.length - 1; i >= 0; i--) {
            var obj = this.active[i];
            if (obj.active === false || obj.lifetime !== undefined && obj.lifetime <= 0) {
                this.release(obj);
            } else if (obj.update) {
                obj.update(deltaTime);
            }
        }
    }
    
    render(ctx, viewport) {
        for (var i = 0; i < this.active.length; i++) {
            var obj = this.active[i];
            if (obj.render) {
                obj.render(ctx, viewport);
            }
        }
    }
};

console.log('[ObjectPool] Class loaded');