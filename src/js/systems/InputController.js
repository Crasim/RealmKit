var RealmKit = RealmKit || {};

/**
 * InputController - Handles player input for any controllable unit
 * Can attach/detach from units at runtime to switch control
 */
RealmKit.InputController = class InputController {
    constructor(config) {
        config = config || {};
        
        this.engine = config.engine || null;
        this.inputHandler = config.inputHandler || null;
        
        // Currently controlled unit
        this.controlledUnit = null;
        
        // Input state
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            attack: false,
            interact: false,
            use: false,
            inventory: false,
            quest: false,
            map: false,
            escape: false
        };
        
        // Movement
        this.moveSpeed = 0;
        this.sprintMultiplier = 1.5;
        this.isSprinting = false;
        
        // Bound handlers (stored for cleanup)
        this._boundKeyDown = null;
        this._boundKeyUp = null;
        this._boundMouseDown = null;
        this._boundMouseMove = null;
        
        // Timers
        this.attackTimer = 0;
        this.interactTimer = 0;
        
        console.log('[InputController] Initialized');
    }
    
    /**
     * Attach input to a unit - this unit will receive player input
     * @param {Object} unit - The unit to control
     * @returns {boolean} Success
     */
    attach(unit) {
        if (!unit) {
            console.warn('[InputController] Cannot attach to null unit');
            return false;
        }
        
        if (!unit.controllable) {
            console.warn('[InputController] Unit is not controllable:', unit.name);
            return false;
        }
        
        // Detach from current unit
        this.detach();
        
        this.controlledUnit = unit;
        unit.playerControlled = true;
        
        // Reset input state
        this.resetKeys();
        
        console.log('[InputController] Attached to:', unit.name);
        
        // Notify engine
        if (this.engine) {
            this.engine.onUnitControlChanged(unit);
        }
        
        return true;
    }
    
    /**
     * Detach from current unit
     */
    detach() {
        if (this.controlledUnit) {
            this.controlledUnit.playerControlled = false;
            this.controlledUnit.velocityX = 0;
            this.controlledUnit.velocityY = 0;
            console.log('[InputController] Detached from:', this.controlledUnit.name);
        }
        
        this.controlledUnit = null;
        this.resetKeys();
    }
    
    /**
     * Switch control to another unit
     * @param {Object} newUnit 
     * @returns {boolean}
     */
    switchTo(newUnit) {
        if (!newUnit || !newUnit.controllable) {
            console.warn('[InputController] Cannot switch to uncontrollable unit');
            return false;
        }
        
        var previousUnit = this.controlledUnit;
        
        if (this.attach(newUnit)) {
            // Update party leader if applicable
            if (this.engine && this.engine.partyManager) {
                this.engine.partyManager.setLeader(newUnit);
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Update input processing
     * @param {number} deltaTime 
     */
    update(deltaTime) {
        if (!this.controlledUnit || !this.controlledUnit.active) {
            return;
        }
        
        var unit = this.controlledUnit;
        
        // Calculate movement direction
        var dx = 0;
        var dy = 0;
        
        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            var length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }
        
        // Apply speed
        var speed = unit.combatStats ? unit.combatStats.speed : unit.speed;
        if (this.isSprinting) {
            speed *= this.sprintMultiplier;
        }
        
        unit.velocityX = dx * speed;
        unit.velocityY = dy * speed;
        
        // Update direction
        if (dx !== 0 || dy !== 0) {
            if (Math.abs(dy) > Math.abs(dx)) {
                unit.direction = dy > 0 ? 'down' : 'up';
            } else {
                unit.direction = dx > 0 ? 'right' : 'left';
            }
            unit.animation = 'walk_' + unit.direction;
            if (unit.stateMachine) unit.stateMachine.setState('walk_' + unit.direction);
        } else {
            unit.animation = 'idle_' + unit.direction;
            if (unit.stateMachine) unit.stateMachine.setState('idle_' + unit.direction);
        }
        
        // Update attack cooldown
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }
        
        // Update interact cooldown
        if (this.interactTimer > 0) {
            this.interactTimer -= deltaTime;
        }
        
        // Timers
        this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - deltaTime);
    }
    
    /**
     * Process attack input
     */
    onAttack() {
        if (!this.controlledUnit) {
            return;
        }
        if (this.attackTimer > 0) {
            return;
        }
        
        var unit = this.controlledUnit;
        
        // Check if unit can attack (has weapon/abilities)
        if (this.engine && this.engine.combatSystem) {
            // Trigger attack
            this.engine.playerAttack(unit);
        }
        
        // Set cooldown
        var attackCooldown = unit.attackCooldown || 600;
        this.attackTimer = attackCooldown;
        
        // Animation
        if (unit.animation.indexOf('attack_') !== 0) {
            unit.animation = 'attack_' + unit.direction;
            if (unit.stateMachine) unit.stateMachine.startAttackState(unit.direction);
        }
    }
    
    /**
     * Process interact input
     */
    onInteract() {
        if (!this.controlledUnit || this.interactTimer > 0) {
            return;
        }
        
        var unit = this.controlledUnit;
        
        // Find interactable entities
        if (this.engine) {
            this.engine.tryInteract();
        }
        
        this.interactTimer = 300; // 300ms cooldown
    }
    
    /**
     * Process use/special ability input
     */
    onUse() {
        if (!this.controlledUnit) return;
        
        // Use special ability or item
        if (this.engine && this.engine.inventoryManager) {
            this.engine.inventoryManager.useQuickSlot(this.controlledUnit, 0);
        }
    }
    
    /**
     * Open inventory
     */
    onInventory() {
        if (this.engine && this.engine.equipmentPanel) {
            this.engine.equipmentPanel.toggle();
        }
    }
    
    /**
     * Open quest log
     */
    onQuest() {
        if (this.engine && this.engine.questPanel) {
            this.engine.questPanel.toggle();
        }
    }
    
    /**
     * Open map
     */
    onMap() {
        if (this.engine && this.engine.toggleMinimap) {
            this.engine.toggleMinimap();
        }
    }

    /**
     * Toggle manual/auto control for current unit
     */
    onToggleManual() {
        if (!this.controlledUnit) return;

        var unit = this.controlledUnit;
        unit.npcMode = !unit.npcMode;
        unit.playerControlled = !unit.npcMode;

        console.log('[InputController] Manual control:', unit.npcMode ? 'OFF (auto)' : 'ON (manual)', 'for', unit.name);

        // Update UI if available
        if (this.engine && this.engine.gameUI && this.engine.gameUI.sync) {
            this.engine.gameUI.sync(true);
        }
    }

    /**
     * Recruit nearest NPC
     */
    onRecruit() {
        if (this.engine && this.engine.recruitNearestNPC) {
            this.engine.recruitNearestNPC();
        }
    }

    /**
     * Handle escape key (close panels)
     */
    onEscape() {
        if (this.engine) {
            this.engine.closeAllPanels();
        }
    }
    
    /**
     * Setup keyboard listeners
     * Note: InputHandler.init() forwards combat/party/ui keys to InputController methods.
     * This only registers movement keys for state tracking.
     */
    setupListeners() {
        if (!this.inputHandler) return;
        
        var self = this;
        
        // Register movement keys (keydown)
        this.inputHandler.on('w', function() { self.onKeyDown('w'); });
        this.inputHandler.on('a', function() { self.onKeyDown('a'); });
        this.inputHandler.on('s', function() { self.onKeyDown('s'); });
        this.inputHandler.on('d', function() { self.onKeyDown('d'); });
        this.inputHandler.on('arrowup', function() { self.onKeyDown('ArrowUp'); });
        this.inputHandler.on('arrowdown', function() { self.onKeyDown('ArrowDown'); });
        this.inputHandler.on('arrowleft', function() { self.onKeyDown('ArrowLeft'); });
        this.inputHandler.on('arrowright', function() { self.onKeyDown('ArrowRight'); });
        
        // Also register movement keyup callbacks
        this.inputHandler.on('keyup_w', function() { self.onKeyUp('w'); });
        this.inputHandler.on('keyup_a', function() { self.onKeyUp('a'); });
        this.inputHandler.on('keyup_s', function() { self.onKeyUp('s'); });
        this.inputHandler.on('keyup_d', function() { self.onKeyUp('d'); });
        this.inputHandler.on('keyup_arrowup', function() { self.onKeyUp('ArrowUp'); });
        this.inputHandler.on('keyup_arrowdown', function() { self.onKeyUp('ArrowDown'); });
        this.inputHandler.on('keyup_arrowleft', function() { self.onKeyUp('ArrowLeft'); });
        this.inputHandler.on('keyup_arrowright', function() { self.onKeyUp('ArrowRight'); });
    }
    
    /**
     * Remove keyboard listeners
     */
    removeListeners() {
        if (!this.inputHandler) return;
        
        if (this._boundKeyDown) {
            this.inputHandler.off('keydown', this._boundKeyDown);
        }
        if (this._boundKeyUp) {
            this.inputHandler.off('keyup', this._boundKeyUp);
        }
    }
    
    /**
     * Handle key down
     * @param {string} key 
     */
    onKeyDown(key) {
        switch (key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                this.keys.up = true;
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                this.keys.down = true;
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                this.keys.left = true;
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                this.keys.right = true;
                break;
            case 'Shift':
                this.isSprinting = true;
                break;
            case 'space': // Spacebar
            case 'Attack':
                this.onAttack();
                break;
            case 'e':
            case 'E':
            case 'Interact':
                this.onInteract();
                break;
            case 'q':
            case 'Q':
            case 'Use':
                this.onUse();
                break;
            case 'i':
            case 'I':
                this.onInventory();
                break;
            case 'l':
            case 'L':
                this.onQuest();
                break;
            case 'm':
            case 'M':
                this.onToggleManual();
                break;
            case 'n':
            case 'N':
                this.onToggleManual();
                break;
            case 'r':
            case 'R':
                this.onRecruit();
                break;
            case 'Escape':
                this.onEscape();
                break;
            case 'Tab':
                this.onSwitchPartyMember();
                break;
        }
    }
    
    /**
     * Switch to next party member
     */
    onSwitchPartyMember() {
        if (this.switchToNextPartyMember()) {
            console.log('[InputController] Switched to next party member');
        }
    }
    
    /**
     * Handle key up
     * @param {string} key 
     */
    onKeyUp(key) {
        switch (key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                this.keys.up = false;
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                this.keys.down = false;
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                this.keys.left = false;
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                this.keys.right = false;
                break;
            case 'Shift':
                this.isSprinting = false;
                break;
        }
    }
    
    /**
     * Reset all input keys
     */
    resetKeys() {
        for (var key in this.keys) {
            this.keys[key] = false;
        }
        this.isSprinting = false;
    }
    
    /**
     * Get currently controlled unit
     * @returns {Object|null}
     */
    getControlledUnit() {
        return this.controlledUnit;
    }
    
    /**
     * Check if controlling a unit
     * @returns {boolean}
     */
    isControlling() {
        return this.controlledUnit !== null && this.controlledUnit.active;
    }
    
    /**
     * Get party members
     * @returns {Array}
     */
    getPartyMembers() {
        if (this.controlledUnit && this.engine && this.engine.partyManager) {
            return this.engine.partyManager.getMembers();
        }
        return [];
    }
    
    /**
     * Switch to next party member
     * @returns {boolean}
     */
    switchToNextPartyMember() {
        var members = this.getPartyMembers();
        if (members.length <= 1) return false;
        
        var currentIndex = members.indexOf(this.controlledUnit);
        var nextIndex = (currentIndex + 1) % members.length;
        
        return this.switchTo(members[nextIndex]);
    }
    
    /**
     * Switch to previous party member
     * @returns {boolean}
     */
    switchToPreviousPartyMember() {
        var members = this.getPartyMembers();
        if (members.length <= 1) return false;
        
        var currentIndex = members.indexOf(this.controlledUnit);
        var prevIndex = (currentIndex - 1 + members.length) % members.length;
        
        return this.switchTo(members[prevIndex]);
    }
    
    /**
     * Recruit a unit to party
     * @param {Object} unit 
     * @returns {boolean}
     */
    recruitUnit(unit) {
        if (!this.engine || !this.engine.partyManager) {
            return false;
        }
        
        return this.engine.partyManager.recruit(unit, this.controlledUnit);
    }
    
    /**
     * Dismiss a unit from party
     * @param {Object} unit 
     * @returns {boolean}
     */
    dismissUnit(unit) {
        if (!this.engine || !this.engine.partyManager) {
            return false;
        }
        
        // Cannot dismiss last party member
        var members = this.getPartyMembers();
        if (members.length <= 1) {
            console.warn('[InputController] Cannot dismiss last party member');
            return false;
        }
        
        // If dismissing current controlled unit, switch to another
        if (unit === this.controlledUnit) {
            var otherMembers = members.filter(function(m) { return m !== unit; });
            if (otherMembers.length > 0) {
                this.switchTo(otherMembers[0]);
            }
        }
        
        return this.engine.partyManager.dismiss(unit);
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.detach();
        this.removeListeners();
        this.engine = null;
        this.inputHandler = null;
        console.log('[InputController] Destroyed');
    }
};

console.log('[InputController] Module loaded');
