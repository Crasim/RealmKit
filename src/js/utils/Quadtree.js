var RealmKit = RealmKit || {};

RealmKit.Quadtree = class Quadtree {
    constructor(bounds, maxObjects, maxLevels, level) {
        this.bounds = bounds || { x: 0, y: 0, width: 4096, height: 4096 };
        this.maxObjects = maxObjects || 10;
        this.maxLevels = maxLevels || 5;
        this.level = level || 0;
        
        this.objects = [];
        this.nodes = [];
        this.totalObjects = 0;
    }
    
    clear() {
        this.objects = [];
        this.totalObjects = 0;
        for (var i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i]) {
                this.nodes[i].clear();
            }
        }
        this.nodes = [];
    }
    
    split() {
        var x = this.bounds.x;
        var y = this.bounds.y;
        var subWidth = this.bounds.width / 2;
        var subHeight = this.bounds.height / 2;
        
        this.nodes[0] = new RealmKit.Quadtree(
            { x: x + subWidth, y: y, width: subWidth, height: subHeight },
            this.maxObjects, this.maxLevels, this.level + 1
        );
        this.nodes[1] = new RealmKit.Quadtree(
            { x: x, y: y, width: subWidth, height: subHeight },
            this.maxObjects, this.maxLevels, this.level + 1
        );
        this.nodes[2] = new RealmKit.Quadtree(
            { x: x, y: y + subHeight, width: subWidth, height: subHeight },
            this.maxObjects, this.maxLevels, this.level + 1
        );
        this.nodes[3] = new RealmKit.Quadtree(
            { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
            this.maxObjects, this.maxLevels, this.level + 1
        );
    }
    
    getIndex(rect) {
        var index = -1;
        var verticalMidpoint = this.bounds.x + this.bounds.width / 2;
        var horizontalMidpoint = this.bounds.y + this.bounds.height / 2;
        
        var topQuadrant = rect.y < horizontalMidpoint && rect.y + rect.height < horizontalMidpoint;
        var bottomQuadrant = rect.y > horizontalMidpoint;
        var leftQuadrant = rect.x < verticalMidpoint && rect.x + rect.width < verticalMidpoint;
        var rightQuadrant = rect.x > verticalMidpoint;
        
        if (topQuadrant && rightQuadrant) index = 0;
        else if (topQuadrant && leftQuadrant) index = 1;
        else if (bottomQuadrant && leftQuadrant) index = 2;
        else if (bottomQuadrant && rightQuadrant) index = 3;
        
        return index;
    }
    
    insert(entity) {
        if (!entity || entity.x === undefined || entity.y === undefined) return;
        
        var rect = {
            x: entity.x - (entity.width || 16) / 2,
            y: entity.y - (entity.height || 16) / 2,
            width: entity.width || 16,
            height: entity.height || 16,
            entity: entity
        };
        
        if (this.nodes.length > 0) {
            var index = this.getIndex(rect);
            if (index !== -1) {
                this.nodes[index].insert(entity);
                return;
            }
        }
        
        this.objects.push(rect);
        this.totalObjects++;
        
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (this.nodes.length === 0) {
                this.split();
            }
            
            var i = 0;
            while (i < this.objects.length) {
                var index = this.getIndex(this.objects[i]);
                if (index !== -1) {
                    this.nodes[index].insert(this.objects[i].entity);
                    this.objects.splice(i, 1);
                } else {
                    i++;
                }
            }
        }
    }
    
    retrieve(rect) {
        var results = [];
        
        var searchRect = rect;
        if (rect.x === undefined) {
            searchRect = {
                x: rect.x || 0,
                y: rect.y || 0,
                width: rect.width || 100,
                height: rect.height || 100
            };
        }
        
        var index = this.getIndex(searchRect);
        if (index !== -1 && this.nodes.length > 0) {
            var nodeResults = this.nodes[index].retrieve(searchRect);
            for (var i = 0; i < nodeResults.length; i++) {
                results.push(nodeResults[i]);
            }
        }
        
        for (var j = 0; j < this.objects.length; j++) {
            results.push(this.objects[j].entity);
        }
        
        if (this.nodes.length > 0) {
            for (var k = 0; k < this.nodes.length; k++) {
                if (k !== index) {
                    var otherResults = this.nodes[k].retrieve(searchRect);
                    for (var l = 0; l < otherResults.length; l++) {
                        results.push(otherResults[l]);
                    }
                }
            }
        }
        
        return results;
    }
    
    retrieveNear(x, y, radius) {
        return this.retrieve({
            x: x - radius,
            y: y - radius,
            width: radius * 2,
            height: radius * 2
        });
    }
    
    count() {
        return this.totalObjects;
    }
};

console.log('[Quadtree] Class loaded');