var RealmKit = RealmKit || {};

RealmKit.InputHandler = class InputHandler {
    constructor(engine) {
        this.engine = engine;
        this.keys = {};
        this.heldKeys = {};
        this.callbacks = {};
        
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
        
        console.log('[InputHandler] Initialized');
    }
    
    init() {
        window.addEventListener('keydown', this.boundKeyDown);
        window.addEventListener('keyup', this.boundKeyUp);
        
        // Debug keys from Keymap
        this.on(RealmKitKeymap.debug.grid, function() {
            this.engine.config.debug.showGrid = !this.engine.config.debug.showGrid;
            console.log('[Input] Grid:', this.engine.config.debug.showGrid ? 'ON' : 'OFF');
        }.bind(this));
        
        this.on(RealmKitKeymap.debug.coordinates, function() {
            this.engine.config.debug.showCoordinates = !this.engine.config.debug.showCoordinates;
            console.log('[Input] Coordinates:', this.engine.config.debug.showCoordinates ? 'ON' : 'OFF');
        }.bind(this));
        
        this.on(RealmKitKeymap.debug.tiles, function() {
            this.engine.renderTiles = !this.engine.renderTiles;
            console.log('[Input] Tiles:', this.engine.renderTiles ? 'ON' : 'OFF');
        }.bind(this));
        
        this.on(RealmKitKeymap.debug.path, function() {
            this.engine.config.debug.showPathDebug = !this.engine.config.debug.showPathDebug;
            if (this.engine.pathRequestManager) {
                this.engine.pathRequestManager.toggleDebug();
            }
            console.log('[Input] Path Debug:', this.engine.config.debug.showPathDebug ? 'ON' : 'OFF');
        }.bind(this));
        
        this.on(RealmKitKeymap.debug.refresh, function() {
            this.engine.toggleAutoRefresh();
        }.bind(this));
        
        // UI key (opens gear codex page)
        this.on('u', function() {
            if (this.engine.gameUI) {
                this.engine.gameUI.openCodexPage('gear');
            }
        }.bind(this));
        
        // Escape - system
        this.on(RealmKitKeymap.system.escape, function() {
            if (this.engine.gameUI && this.engine.gameUI.handleEscape && this.engine.gameUI.handleEscape()) {
                return;
            }
            if (this.engine.actionQueue && this.engine.actionQueue.getLength() > 0) {
                this.engine.actionQueue.clear();
                console.log('[Input] Action queue cleared');
            }
        }.bind(this));
        
        // Combat keys - forward to InputController
        this.on(RealmKitKeymap.combat.attack, function() {
            if (this.engine.inputController && this.engine.inputController.onAttack) {
                this.engine.inputController.onAttack();
            }
        }.bind(this));
        
        this.on(RealmKitKeymap.combat.interact, function() {
            if (this.engine.inputController && this.engine.inputController.onInteract) {
                this.engine.inputController.onInteract();
            }
        }.bind(this));
        
        this.on(RealmKitKeymap.combat.use, function() {
            if (this.engine.inputController && this.engine.inputController.onUse) {
                this.engine.inputController.onUse();
            }
        }.bind(this));
        
        // Party keys - forward to InputController
        this.on(RealmKitKeymap.party.recruit, function() {
            if (this.engine.inputController && this.engine.inputController.onRecruit) {
                this.engine.inputController.onRecruit();
            }
        }.bind(this));
        
        this.on(RealmKitKeymap.party.toggleManual, function() {
            if (this.engine.inputController && this.engine.inputController.onToggleManual) {
                this.engine.inputController.onToggleManual();
            }
        }.bind(this));
        
        // UI panel keys - forward to InputController
        this.on(RealmKitKeymap.ui.inventory, function() {
            if (this.engine.inputController && this.engine.inputController.onInventory) {
                this.engine.inputController.onInventory();
            }
        }.bind(this));
        
        this.on(RealmKitKeymap.ui.quests, function() {
            if (this.engine.inputController && this.engine.inputController.onQuest) {
                this.engine.inputController.onQuest();
            }
        }.bind(this));
        
        // Sprint keys
        this.on(RealmKitKeymap.movement.sprint, function() {
            if (this.engine.inputController) {
                this.engine.inputController.isSprinting = true;
            }
        }.bind(this));
        
        this.on('keyup_shift', function() {
            if (this.engine.inputController) {
                this.engine.inputController.isSprinting = false;
            }
        }.bind(this));

        console.log('[InputHandler] Ready - WASD:move Space:attack E:interact R:recruit Q:use I:inventory L:quests ESC:menu');
    }
    
    on(key, callback) {
        key = key.toLowerCase();
        if (!this.callbacks[key]) {
            this.callbacks[key] = [];
        }
        this.callbacks[key].push(callback);
    }
    
    off(key, callback) {
        key = key.toLowerCase();
        if (this.callbacks[key]) {
            this.callbacks[key] = this.callbacks[key].filter(function(cb) {
                return cb !== callback;
            });
        }
    }
    
    handleKeyDown(event) {
        var key = event.key.toLowerCase();
        if (key === ' ') key = 'space';  // Normalize spacebar
        
        var activeEl = document.activeElement;
        var isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        var storyBuilderOpen = this.engine.storyBuilder && this.engine.storyBuilder.visible;
        
        if (isTyping) {
            return;
        }
        
        if (storyBuilderOpen && key !== 'escape') {
            return;
        }
        
        if (!this.keys[key]) {
            this.keys[key] = true;
            
            if (this.callbacks[key]) {
                for (var i = 0; i < this.callbacks[key].length; i++) {
                    this.callbacks[key][i]();
                }
            }
        }
        
        this.heldKeys[key] = true;
        
        if (key === 'g' || key === 'c' || key === 't' || key === 'd' || key === 's' || key === 'y' || key === 'n' || key === 'escape' || key === ' ' || this.isMovementKey(key)) {
            event.preventDefault();
        }
    }
    
    handleKeyUp(event) {
        var key = event.key.toLowerCase();
        if (key === ' ') key = 'space';  // Normalize spacebar
        this.keys[key] = false;
        this.heldKeys[key] = false;
        
        // Fire keyup callbacks (registered as 'keyup_<key>')
        var keyupKey = 'keyup_' + key;
        if (this.callbacks[keyupKey]) {
            for (var i = 0; i < this.callbacks[keyupKey].length; i++) {
                this.callbacks[keyupKey][i]();
            }
        }
    }
    
    isMovementKey(key) {
        return key === 'w' || key === 'a' || key === 's' || key === 'd' ||
               key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright';
    }
    
    isDown(key) {
        return this.heldKeys[key.toLowerCase()] === true;
    }
    
    getMovement() {
        var movement = { x: 0, y: 0 };
        
        if (this.isDown('w') || this.isDown('arrowup')) movement.y = -1;
        if (this.isDown('s') || this.isDown('arrowdown')) movement.y = 1;
        if (this.isDown('a') || this.isDown('arrowleft')) movement.x = -1;
        if (this.isDown('d') || this.isDown('arrowright')) movement.x = 1;
        
        return movement;
    }
    
    isAnyMovementDown() {
        return this.isDown('w') || this.isDown('s') || this.isDown('a') || this.isDown('d') ||
               this.isDown('arrowup') || this.isDown('arrowdown') || this.isDown('arrowleft') || this.isDown('arrowright');
    }
    
    destroy() {
        window.removeEventListener('keydown', this.boundKeyDown);
        window.removeEventListener('keyup', this.boundKeyUp);
    }
};

console.log('[InputHandler] Class loaded');
