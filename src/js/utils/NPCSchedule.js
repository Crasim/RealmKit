var RealmKit = RealmKit || {};

RealmKit.SchedulePresets = {
    merchant: {
        name: 'Merchant',
        phases: {
            night: { action: 'sleep', location: 'home' },
            pre_dawn: { action: 'sleep', location: 'home' },
            dawn: { action: 'awaken', location: 'home' },
            morning: { action: 'work', location: 'shop' },
            noon: { action: 'work', location: 'shop' },
            afternoon: { action: 'work', location: 'shop' },
            dusk: { action: 'close_shop', location: 'shop' },
            evening: { action: 'leisure', location: 'tavern' }
        }
    },
    
    guard: {
        name: 'Guard',
        phases: {
            night: { action: 'sleep', location: 'barracks' },
            pre_dawn: { action: 'sleep', location: 'barracks' },
            dawn: { action: 'patrol', location: 'route' },
            morning: { action: 'patrol', location: 'route' },
            noon: { action: 'guard', location: 'post' },
            afternoon: { action: 'patrol', location: 'route' },
            dusk: { action: 'patrol', location: 'walls' },
            evening: { action: 'off_duty', location: 'barracks' }
        }
    },
    
    nightGuard: {
        name: 'Night Guard',
        phases: {
            night: { action: 'patrol', location: 'route' },
            pre_dawn: { action: 'patrol', location: 'route' },
            dawn: { action: 'off_duty', location: 'barracks' },
            morning: { action: 'sleep', location: 'barracks' },
            noon: { action: 'sleep', location: 'barracks' },
            afternoon: { action: 'sleep', location: 'barracks' },
            dusk: { action: 'awaken', location: 'barracks' },
            evening: { action: 'prepare', location: 'barracks' }
        }
    },
    
    villager: {
        name: 'Villager',
        phases: {
            night: { action: 'sleep', location: 'home' },
            pre_dawn: { action: 'sleep', location: 'home' },
            dawn: { action: 'awaken', location: 'home' },
            morning: { action: 'work', location: 'fields' },
            noon: { action: 'work', location: 'fields' },
            afternoon: { action: 'work', location: 'fields' },
            dusk: { action: 'socialize', location: 'square' },
            evening: { action: 'leisure', location: 'tavern' }
        }
    },
    
    innkeeper: {
        name: 'Innkeeper',
        phases: {
            night: { action: 'work', location: 'inn' },
            pre_dawn: { action: 'work', location: 'inn' },
            dawn: { action: 'work', location: 'inn' },
            morning: { action: 'work', location: 'inn' },
            noon: { action: 'work', location: 'inn' },
            afternoon: { action: 'work', location: 'inn' },
            dusk: { action: 'work', location: 'inn' },
            evening: { action: 'work', location: 'inn' }
        }
    },
    
    blacksmith: {
        name: 'Blacksmith',
        phases: {
            night: { action: 'sleep', location: 'home' },
            pre_dawn: { action: 'sleep', location: 'home' },
            dawn: { action: 'prepare', location: 'forge' },
            morning: { action: 'work', location: 'forge' },
            noon: { action: 'break', location: 'tavern' },
            afternoon: { action: 'work', location: 'forge' },
            dusk: { action: 'close_shop', location: 'forge' },
            evening: { action: 'leisure', location: 'tavern' }
        }
    },
    
    wizard: {
        name: 'Wizard',
        phases: {
            night: { action: 'study', location: 'tower' },
            pre_dawn: { action: 'study', location: 'tower' },
            dawn: { action: 'meditate', location: 'tower' },
            morning: { action: 'research', location: 'tower' },
            noon: { action: 'teach', location: 'tower' },
            afternoon: { action: 'research', location: 'tower' },
            dusk: { action: 'meditate', location: 'tower' },
            evening: { action: 'study', location: 'tower' }
        }
    },
    
    farmer: {
        name: 'Farmer',
        phases: {
            night: { action: 'sleep', location: 'home' },
            pre_dawn: { action: 'sleep', location: 'home' },
            dawn: { action: 'awaken', location: 'home' },
            morning: { action: 'work', location: 'farm' },
            noon: { action: 'rest', location: 'farm' },
            afternoon: { action: 'work', location: 'farm' },
            dusk: { action: 'home', location: 'home' },
            evening: { action: 'leisure', location: 'home' }
        }
    },
    
    traveler: {
        name: 'Traveler',
        phases: {
            night: { action: 'rest', location: 'inn' },
            pre_dawn: { action: 'rest', location: 'inn' },
            dawn: { action: 'travel', location: 'road' },
            morning: { action: 'travel', location: 'road' },
            noon: { action: 'travel', location: 'road' },
            afternoon: { action: 'travel', location: 'road' },
            dusk: { action: 'rest', location: 'inn' },
            evening: { action: 'leisure', location: 'tavern' }
        }
    }
};

RealmKit.NPCSchedule = {
    
    PHASES: ['night', 'pre_dawn', 'dawn', 'morning', 'noon', 'afternoon', 'dusk', 'evening'],
    
    getPreset: function(presetName) {
        var preset = RealmKit.SchedulePresets[presetName];
        if (!preset) {
            console.warn('[NPCSchedule] Unknown preset:', presetName);
            return null;
        }
        return preset;
    },
    
    getPhaseFromHour: function(hour) {
        if (hour >= 22 || hour < 5) return 'night';
        if (hour >= 5 && hour < 7) return 'pre_dawn';
        if (hour >= 7 && hour < 9) return 'dawn';
        if (hour >= 9 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 14) return 'noon';
        if (hour >= 14 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 20) return 'dusk';
        return 'evening';
    },
    
    getPhase: function(seconds) {
        var hour = Math.floor((seconds / 3600) % 24);
        return this.getPhaseFromHour(hour);
    },
    
    getHour: function(seconds) {
        return Math.floor((seconds / 3600) % 24);
    },
    
    formatTime: function(seconds) {
        var hour = Math.floor((seconds / 3600) % 24);
        var minute = Math.floor((seconds % 3600) / 60);
        return (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute;
    },
    
    getPhaseLabel: function(seconds) {
        var phase = this.getPhase(seconds);
        var labels = {
            night: '\uD83C\uDF19 Night',
            pre_dawn: '\uD83C\uDF15 Pre-dawn',
            dawn: '\uD83C\uDF05 Dawn',
            morning: '\u2600\uFE0F Morning',
            noon: '\uD83C\uDF1E Noon',
            afternoon: '\u26C5 Afternoon',
            dusk: '\uD83C\uDF07 Dusk',
            evening: '\uD83C\uDF06 Evening'
        };
        return labels[phase] || phase;
    },
    
    isNighttime: function(seconds) {
        var phase = this.getPhase(seconds);
        return phase === 'night' || phase === 'pre_dawn';
    },
    
    createSchedule: function(config) {
        config = config || {};
        
        var schedule = {
            type: config.type || 'custom',
            preset: config.preset || null,
            locations: config.locations || {},
            overrides: {},
            customPhases: config.phases || null
        };
        
        if (schedule.preset && RealmKit.SchedulePresets[schedule.preset]) {
            schedule._presetData = RealmKit.SchedulePresets[schedule.preset];
        }
        
        if (config.sleepLocation) {
            schedule.locations.home = config.sleepLocation;
        }
        if (config.workLocation) {
            schedule.locations.work = config.workLocation;
        }
        
        schedule.getBehavior = function(seconds) {
            var phase = RealmKit.NPCSchedule.getPhase(seconds);
            
            if (this.overrides[phase]) {
                return this.overrides[phase];
            }
            
            if (this.customPhases && this.customPhases[phase]) {
                var behavior = this.customPhases[phase];
                return {
                    action: behavior.action,
                    location: this.locations[behavior.location] || behavior.location
                };
            }
            
            if (this._presetData && this._presetData.phases[phase]) {
                var behavior = this._presetData.phases[phase];
                return {
                    action: behavior.action,
                    location: this.locations[behavior.location] || behavior.location
                };
            }
            
            return { action: 'idle', location: 'default' };
        };
        
        schedule.getLocation = function(seconds) {
            var behavior = this.getBehavior(seconds);
            return this.locations[behavior.location] || behavior.location;
        };
        
        schedule.setPhaseOverride = function(phase, action, location) {
            this.overrides[phase] = { action: action, location: location };
        };
        
        schedule.clearPhaseOverride = function(phase) {
            delete this.overrides[phase];
        };
        
        schedule.clearAllOverrides = function() {
            this.overrides = {};
        };
        
        schedule.addLocation = function(name, x, y) {
            if (typeof x === 'object') {
                this.locations[name] = x;
            } else {
                this.locations[name] = { x: x, y: y };
            }
        };
        
        schedule.setCustomPhase = function(phase, action, location) {
            if (!this.customPhases) {
                this.customPhases = {};
            }
            this.customPhases[phase] = { action: action, location: location };
        };
        
        schedule.setCustomPhases = function(phases) {
            this.customPhases = phases;
        };
        
        schedule.toJSON = function() {
            return {
                type: this.type,
                preset: this.preset,
                locations: this.locations,
                overrides: this.overrides,
                customPhases: this.customPhases
            };
        };
        
        return schedule;
    },
    
    createFromPreset: function(presetName, locations) {
        return this.createSchedule({
            preset: presetName,
            locations: locations || {}
        });
    },
    
    createCustom: function(phases, locations) {
        return this.createSchedule({
            type: 'custom',
            phases: phases,
            locations: locations || {}
        });
    },
    
    mergeSchedules: function(baseSchedule, overrideSchedule) {
        var merged = this.createSchedule({
            preset: baseSchedule.preset,
            locations: Object.assign({}, baseSchedule.locations, overrideSchedule.locations)
        });
        
        merged.overrides = Object.assign({}, baseSchedule.overrides, overrideSchedule.overrides);
        
        return merged;
    }
};

console.log('[NPCSchedule] Module loaded with', Object.keys(RealmKit.SchedulePresets).length, 'presets');