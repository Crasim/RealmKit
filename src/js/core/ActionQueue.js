var RealmKit = RealmKit || {};

RealmKit.ActionQueue = class ActionQueue {
    constructor(maxActions) {
        this.maxActions = maxActions || 10;
        this.actions = [];
        this.onActionAdded = null;
        this.onActionRemoved = null;
        this.onQueueCleared = null;
    }
    
    addAction(action) {
        if (!action || !action.type) {
            console.warn('[ActionQueue] Invalid action:', action);
            return false;
        }
        
        if (this.actions.length >= this.maxActions) {
            console.warn('[ActionQueue] Queue full, cannot add:', action.type);
            return false;
        }
        
        var queueAction = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: action.type,
            data: action.data || {},
            timestamp: Date.now(),
            valid: true
        };
        
        this.actions.push(queueAction);
        
        console.log('[ActionQueue] Added action:', queueAction.type, 'queue length:', this.actions.length);
        
        if (this.onActionAdded) {
            this.onActionAdded(queueAction);
        }
        
        return true;
    }
    
    removeAction(actionId) {
        var index = this.actions.findIndex(function(a) {
            return a.id === actionId;
        });
        
        if (index === -1) {
            console.warn('[ActionQueue] Action not found:', actionId);
            return false;
        }
        
        var removed = this.actions.splice(index, 1)[0];
        
        console.log('[ActionQueue] Removed action:', removed.type, 'queue length:', this.actions.length);
        
        if (this.onActionRemoved) {
            this.onActionRemoved(removed);
        }
        
        return true;
    }
    
    getNextAction() {
        while (this.actions.length > 0) {
            var action = this.actions[0];
            if (action.valid) {
                return action;
            }
            this.actions.shift();
        }
        return null;
    }
    
    popAction() {
        if (this.actions.length === 0) {
            return null;
        }
        return this.actions.shift();
    }
    
    peekAction() {
        if (this.actions.length === 0) {
            return null;
        }
        return this.actions[0];
    }
    
    clear() {
        this.actions = [];
        console.log('[ActionQueue] Queue cleared');
        
        if (this.onQueueCleared) {
            this.onQueueCleared();
        }
    }
    
    invalidateAction(actionId) {
        var action = this.actions.find(function(a) {
            return a.id === actionId;
        });
        
        if (action) {
            action.valid = false;
            console.log('[ActionQueue] Invalidated action:', action.type);
        }
    }
    
    invalidateAll() {
        this.actions.forEach(function(action) {
            action.valid = false;
        });
        console.log('[ActionQueue] Invalidated all actions');
    }
    
    getLength() {
        return this.actions.length;
    }
    
    getValidLength() {
        return this.actions.filter(function(a) {
            return a.valid;
        }).length;
    }
    
    isEmpty() {
        return this.actions.length === 0;
    }
    
    hasActions() {
        return this.actions.some(function(a) {
            return a.valid;
        });
    }
    
    getAll() {
        return this.actions.slice();
    }
    
    setOnActionAdded(callback) {
        this.onActionAdded = callback;
    }
    
    setOnActionRemoved(callback) {
        this.onActionRemoved = callback;
    }
    
    setOnQueueCleared(callback) {
        this.onQueueCleared = callback;
    }
};

console.log('[ActionQueue] Class loaded');