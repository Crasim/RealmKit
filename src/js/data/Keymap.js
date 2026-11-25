// Key mapping to avoid conflicts between InputHandler and InputController
// InputHandler handles: UI toggles, debug features
// InputController handles: Movement, combat, party management

var RealmKitKeymap = {
    // Movement (InputController only)
    movement: {
        up: ['w', 'arrowup'],
        down: ['s', 'arrowdown'],
        left: ['a', 'arrowleft'],
        right: ['d', 'arrowright'],
        sprint: 'shift'
    },
    
    // Combat (InputController only)
    combat: {
        attack: 'space',      // Spacebar
        interact: 'e',
        use: 'q'
    },
    
    // Party Management (InputController only)
    party: {
        switchMember: 'tab',
        recruit: 'r',
        toggleManual: 'n',
        formation: 'f'
    },
    
    // UI Panels (InputHandler only)
    ui: {
        inventory: 'i',
        codex: 'j',
        quests: 'l',
        overview: 'k',
        map: 'm'
    },
    
    // Debug Features (InputHandler only)
    debug: {
        grid: 'g',
        coordinates: 'c',
        tiles: 't',
        terrain: 'd',
        path: 'p',
        sprite: 's',
        refresh: 'y'
    },
    
    // System
    system: {
        pause: ' ',
        escape: 'escape'
    },
    
    // Helper: Check if a key belongs to a category
    isMovementKey: function(key) {
        var keys = this.movement.up.concat(this.movement.down).concat(this.movement.left).concat(this.movement.right);
        return keys.indexOf(key.toLowerCase()) !== -1;
    },
    
    // Helper: Get key description
    getDescription: function(key) {
        var descs = {
            'w': 'Move up',
            's': 'Move down',
            'a': 'Move left',
            'd': 'Move right',
            'shift': 'Sprint',
            ' ': 'Attack / Pause',
            'e': 'Interact',
            'q': 'Use ability/item',
            'tab': 'Switch party member',
            'r': 'Recruit NPC',
            'n': 'Toggle manual/auto control',
            'f': 'Change formation',
            'i': 'Inventory',
            'j': 'Character codex',
            'l': 'Quest log',
            'k': 'Overview',
            'm': 'Map',
            'g': 'Toggle grid (debug)',
            'c': 'Toggle coordinates (debug)',
            't': 'Toggle tiles (debug)',
            'd': 'Terrain debug (debug)',
            'p': 'Path debug (debug)',
            's': 'Sprite toggle (debug)',
            'y': 'Auto refresh (debug)',
            'escape': 'Close panels / Menu'
        };
        return descs[key.toLowerCase()] || key;
    },
    
    // Helper: Print all bindings
    printHelp: function() {
        console.log('=== RealmKit Key Bindings ===');
        console.log('Movement: W/A/S/D or Arrow keys, Shift=sprint');
        console.log('Combat: Space=attack, E=interact, Q=use');
        console.log('Party: Tab=switch, R=recruit, N=manual toggle, F=formation');
        console.log('UI: I=inventory, J=codex, L=quests, K=overview, M=map');
        console.log('System: Space=pause, Esc=close');
        console.log('Debug: G=grid, C=coords, T=tiles, D=terrain, P=path, S=sprite, Y=refresh');
    }
};

console.log('[Keymap] Loaded');
