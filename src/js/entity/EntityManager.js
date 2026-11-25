var RealmKit = RealmKit || {};

RealmKit.EntityManager = class EntityManager {
    constructor() {
        this.entities = [];
        this.entitiesById = {};
        this.onEntityCollision = null;
        this.particles = null;
        
        console.log('[EntityManager] Initialized');
    }
    
    setParticles(particles) {
        this.particles = particles;
    }
    
    add(entity) {
        if (this.entitiesById[entity.id]) {
            console.warn('[EntityManager] Entity already exists:', entity.id);
            return entity;
        }
        
        this.entities.push(entity);
        this.entitiesById[entity.id] = entity;
        
        console.log('[EntityManager] Added entity:', entity.id, '(' + entity.type + ')');
        
        return entity;
    }
    
    remove(entity) {
        var id = typeof entity === 'string' ? entity : entity.id;
        var ent = this.entitiesById[id];
        
        if (!ent) return false;
        
        var index = this.entities.indexOf(ent);
        if (index > -1) {
            this.entities.splice(index, 1);
        }
        
        delete this.entitiesById[id];
        
        console.log('[EntityManager] Removed entity:', id);
        
        return true;
    }
    
    get(id) {
        return this.entitiesById[id];
    }
    
    getByType(type) {
        return this.entities.filter(function(e) { return e.type === type; });
    }
    
    update(deltaTime, world) {
        this.tileMap = world.tileMap;
        this._world = world;   // keep ref so checkEntityCollisions can access quadtree

        for (var i = 0; i < this.entities.length; i++) {
            var entity = this.entities[i];
            if (entity.active) {
                entity.update(deltaTime, world);
            }
        }

        this.checkEntityCollisions();
    }

    checkEntityCollisions() {
        var quadtree = this._world && this._world.quadtree;

        // Fast path: use quadtree for spatial narrowing (O(n log n) vs O(n²))
        if (quadtree) {
            var checked = {};
            for (var i = 0; i < this.entities.length; i++) {
                var a = this.entities[i];
                if (!a.active || !a.solid) continue;

                var radius = Math.max(a.width || 32, a.height || 32) * 2;
                var candidates = quadtree.retrieveNear(a.x, a.y, radius);
                for (var ci = 0; ci < candidates.length; ci++) {
                    var b = candidates[ci];
                    if (b === a) continue;
                    if (!b.active || !b.solid) continue;

                    // Avoid duplicate pair checks using a sorted key
                    var keyA = a.id || i;
                    var keyB = b.id || ci;
                    var pairKey = keyA < keyB ? keyA + '|' + keyB : keyB + '|' + keyA;
                    if (checked[pairKey]) continue;
                    checked[pairKey] = true;

                    var collision = a.checkEntityCollision(b);
                    if (collision) {
                        this.resolveEntityCollision(a, b, collision);
                    }
                }
            }
            return;
        }

        // Fallback: O(n²) brute force when quadtree not yet built
        for (var i = 0; i < this.entities.length; i++) {
            var a = this.entities[i];
            if (!a.active || !a.solid) continue;

            for (var j = i + 1; j < this.entities.length; j++) {
                var b = this.entities[j];
                if (!b.active || !b.solid) continue;

                var collision = a.checkEntityCollision(b);
                if (collision) {
                    this.resolveEntityCollision(a, b, collision);
                }
            }
        }
    }
    
    resolveEntityCollision(a, b, collision) {
        var overlapX = collision.overlapX;
        var overlapY = collision.overlapY;
        
        var minSeparation = 2;
        var oldAx = a.x;
        var oldAy = a.y;
        var oldBx = b.x;
        var oldBy = b.y;
        
        var pushA = 0.5;
        var pushB = 0.5;
        
        if (a.type === 'player') {
            pushA = 0.8;
            pushB = 0.2;
        } else if (b.type === 'player') {
            pushA = 0.2;
            pushB = 0.8;
        }
        
        if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
                var totalPush = Math.max(overlapX + minSeparation, minSeparation);
                var sign = a.x < b.x ? -1 : 1;
                a.x += sign * totalPush * pushA;
                b.x -= sign * totalPush * pushB;
            } else {
                var totalPush = Math.max(overlapY + minSeparation, minSeparation);
                var sign = a.y < b.y ? -1 : 1;
                a.y += sign * totalPush * pushA;
                b.y -= sign * totalPush * pushB;
            }
        } else if (overlapX > 0) {
            var totalPush = Math.max(overlapX + minSeparation, minSeparation);
            var sign = a.x < b.x ? -1 : 1;
            a.x += sign * totalPush * pushA;
            b.x -= sign * totalPush * pushB;
        } else if (overlapY > 0) {
            var totalPush = Math.max(overlapY + minSeparation, minSeparation);
            var sign = a.y < b.y ? -1 : 1;
            a.y += sign * totalPush * pushA;
            b.y -= sign * totalPush * pushB;
        }
        
        if (this.tileMap) {
            if (a.checkTileCollision && a.checkTileCollision(a.x, a.y, this.tileMap)) {
                a.x = oldAx;
                a.y = oldAy;
            }
            if (b.checkTileCollision && b.checkTileCollision(b.x, b.y, this.tileMap)) {
                b.x = oldBx;
                b.y = oldBy;
            }
        }
        
        if (this.onEntityCollision) {
            this.onEntityCollision(a, b, overlapX, overlapY);
        }
    }
    
    render(ctx, renderer) {
        var viewport = renderer ? renderer.viewport : null;
        var viewLeft = viewport ? viewport.x - 64 : -Infinity;
        var viewRight = viewport ? viewport.x + viewport.viewWidth + 64 : Infinity;
        var viewTop = viewport ? viewport.y - 64 : -Infinity;
        var viewBottom = viewport ? viewport.y + viewport.viewHeight + 64 : Infinity;
        
        var visibleEntities = [];
        
        for (var i = 0; i < this.entities.length; i++) {
            var entity = this.entities[i];
            if (!entity.active || !entity.visible) continue;
            
            var halfW = (entity.width || 32) / 2;
            var halfH = (entity.height || 48) / 2;
            
            if (entity.x + halfW < viewLeft || entity.x - halfW > viewRight ||
                entity.y + halfH < viewTop || entity.y - halfH > viewBottom) {
                continue;
            }
            
            visibleEntities.push(entity);
        }
        
        visibleEntities.sort(function(a, b) {
            return a.y - b.y;
        });

        var player = this.entitiesById['player'] || null;

        for (var j = 0; j < visibleEntities.length; j++) {
            var entity = visibleEntities[j];
            entity.render(ctx, renderer);
            if (player && entity.type === 'npc' && entity.renderInteractionIndicator) {
                entity.renderInteractionIndicator(ctx, player.x, player.y);
            }
        }
    }
    
    clear() {
        this.entities = [];
        this.entitiesById = {};
        console.log('[EntityManager] Cleared all entities');
    }
    
    count() {
        return this.entities.length;
    }
};

console.log('[EntityManager] Class loaded');