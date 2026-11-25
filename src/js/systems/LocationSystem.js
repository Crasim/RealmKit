var RealmKit = RealmKit || {};

RealmKit.LocationSystem = class LocationSystem {
    constructor(config) {
        config = config || {};
        
        this.locations = [];
        this.zones = {};
        
        console.log('[LocationSystem] Initialized');
    }
    
    addLocation(locationData) {
        var location = {
            id: locationData.id || 'loc_' + Date.now(),
            name: locationData.name || 'Unnamed Location',
            type: locationData.type || 'area',
            x: locationData.x || 0,
            y: locationData.y || 0,
            width: locationData.width || 100,
            height: locationData.height || 100,
            radius: locationData.radius || 50,
            tags: locationData.tags || [],
            metadata: locationData.metadata || {}
        };
        
        this.locations.push(location);
        this.zones[location.id] = location;
        
        console.log('[LocationSystem] Added location:', location.id, location.name, 'at', location.x, location.y);
        return location;
    }
    
    removeLocation(locationId) {
        for (var i = 0; i < this.locations.length; i++) {
            if (this.locations[i].id === locationId) {
                this.locations.splice(i, 1);
                delete this.zones[locationId];
                console.log('[LocationSystem] Removed location:', locationId);
                return true;
            }
        }
        return false;
    }
    
    getLocation(locationId) {
        return this.zones[locationId] || null;
    }
    
    getLocationsByTag(tag) {
        var result = [];
        for (var i = 0; i < this.locations.length; i++) {
            var loc = this.locations[i];
            if (loc.tags && loc.tags.indexOf(tag) !== -1) {
                result.push(loc);
            }
        }
        return result;
    }
    
    getLocationsByType(type) {
        var result = [];
        for (var i = 0; i < this.locations.length; i++) {
            var loc = this.locations[i];
            if (loc.type === type) {
                result.push(loc);
            }
        }
        return result;
    }
    
    getLocationAt(x, y) {
        for (var i = 0; i < this.locations.length; i++) {
            var loc = this.locations[i];
            if (this._isInside(x, y, loc)) {
                return loc;
            }
        }
        return null;
    }
    
    checkLocationRequirement(x, y, locationId) {
        if (!locationId) return true;
        
        var location = this.zones[locationId];
        if (!location) {
            return false;
        }
        
        return this._isInside(x, y, location);
    }
    
    _isInside(x, y, location) {
        if (location.type === 'point') {
            var dx = x - location.x;
            var dy = y - location.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            return dist <= location.radius;
        } else if (location.type === 'circle') {
            var cx = location.x + (location.radius || 0);
            var cy = location.y + (location.radius || 0);
            var r = location.radius;
            var dx = x - cx;
            var dy = y - cy;
            return (dx * dx + dy * dy) <= (r * r);
        } else {
            var left = location.x;
            var top = location.y;
            var right = location.x + (location.width || 100);
            var bottom = location.y + (location.height || 100);
            return x >= left && x <= right && y >= top && y <= bottom;
        }
    }
    
    updateEntityLocation(entity, locationId) {
        if (!entity) return;
        
        entity.currentLocationId = locationId;
        
        var prevLocation = entity.previousLocationId;
        if (prevLocation !== locationId) {
            entity.previousLocationId = prevLocation;
            entity.locationEnterTime = locationId ? Date.now() : null;
            
            console.log('[LocationSystem] Entity', entity.id, 'entered location:', locationId);
        }
    }
    
    checkEntities(entityManager) {
        if (!entityManager) return;
        
        var entities = entityManager.getAll();
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            var location = this.getLocationAt(entity.x, entity.y);
            var locationId = location ? location.id : null;
            this.updateEntityLocation(entity, locationId);
        }
    }
    
    toJSON() {
        return this.locations.map(function(loc) {
            return {
                id: loc.id,
                name: loc.name,
                type: loc.type,
                x: loc.x,
                y: loc.y,
                width: loc.width,
                height: loc.height,
                radius: loc.radius,
                tags: loc.tags,
                metadata: loc.metadata
            };
        });
    }
    
    fromJSON(data) {
        this.locations = [];
        this.zones = {};
        
        if (Array.isArray(data)) {
            for (var i = 0; i < data.length; i++) {
                this.addLocation(data[i]);
            }
        }
        
        console.log('[LocationSystem] Loaded', this.locations.length, 'locations from data');
    }
    
    clear() {
        this.locations = [];
        this.zones = {};
        console.log('[LocationSystem] All locations cleared');
    }
};

console.log('[LocationSystem] Module loaded');