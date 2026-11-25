var RealmKit = RealmKit || {};

RealmKit.AnimationStateMachine = class AnimationStateMachine {
    constructor(config) {
        this.config = config || {};
        
        this.states = {};
        this.currentState = null;
        this.previousState = null;
        this.stateTime = 0;
        this.locked = false;
        
        this.transitions = [];
        
        console.log('[AnimationStateMachine] Initialized');
    }
    
    addState(name, config) {
        this.states[name] = {
            animation: config.animation || name,
            loop: config.loop !== false,
            priority: config.priority || 0,
            duration: config.duration || 0,
            onEnter: config.onEnter || null,
            onExit: config.onExit || null,
            transitions: config.transitions || []
        };
        
        console.log('[AnimationStateMachine] Added state:', name);
        return this;
    }

    /**
     * Dynamically add a skill state
     * @param {string} animName - e.g. "special_1"
     * @param {number} duration - ms
     */
    addSkillState(animName, duration) {
        var self = this;
        var dirs = ['down', 'up', 'left', 'right', 'diag_ne', 'diag_nw', 'diag_sw', 'diag_se'];
        
        dirs.forEach(function(dir) {
            var name = animName + '_' + dir;
            if (!self.states[name]) {
                self.addState(name, {
                    animation: name,
                    loop: false,
                    priority: 5,
                    duration: duration || 500,
                    transitions: [{ event: 'complete', target: 'idle_' + dir }]
                });
            }
        });

        // Also add non-directional base
        if (!this.states[animName]) {
            this.addState(animName, {
                animation: animName,
                loop: false,
                priority: 5,
                duration: duration || 500,
                transitions: [{ event: 'complete', target: 'idle_down' }]
            });
        }
    }
    
    setState(name, force) {
        if (!this.states[name]) {
            console.warn('[AnimationStateMachine] Unknown state:', name);
            return false;
        }
        
        var newState = this.states[name];
        var oldState = this.currentState ? this.states[this.currentState] : null;
        
        if (this.locked && !force) {
            return false;
        }
        
        if (oldState && oldState.priority > newState.priority && !force) {
            return false;
        }
        
        if (this.currentState === name && !force) {
            return false;
        }
        
        if (oldState && oldState.onExit) {
            oldState.onExit(this);
        }
        
        this.previousState = this.currentState;
        this.currentState = name;
        this.stateTime = 0;
        
        if (newState.onEnter) {
            newState.onEnter(this);
        }
        
        return true;
    }
    
    update(deltaTime, entity) {
        if (!this.currentState) return null;
        
        this.stateTime += deltaTime;
        
        var state = this.states[this.currentState];
        
        if (state.duration > 0 && this.stateTime >= state.duration) {
            var nextState = this.resolveTransition('complete');
            if (nextState) {
                this.setState(nextState);
            }
        }
        
        return state.animation;
    }
    
    resolveTransition(event) {
        var state = this.currentState ? this.states[this.currentState] : null;
        if (!state) return null;
        
        for (var i = 0; i < state.transitions.length; i++) {
            var t = state.transitions[i];
            if (t.event === event) {
                return t.target;
            }
        }
        
        if (event === 'complete' && !state.loop) {
            return this.previousState || 'idle';
        }
        
        return null;
    }
    
    getState() {
        return this.currentState;
    }
    
    getAnimation() {
        var state = this.currentState ? this.states[this.currentState] : null;
        return state ? state.animation : 'idle';
    }
    
    lock(duration) {
        this.locked = true;
        if (duration && duration > 0) {
            var self = this;
            setTimeout(function() {
                self.unlock();
            }, duration);
        }
    }
    
    unlock() {
        this.locked = false;
    }
    
    isLocked() {
        return this.locked;
    }
    
    isState(name) {
        return this.currentState === name;
    }
    
    getStateTime() {
        return this.stateTime;
    }
    
    forceState(name) {
        return this.setState(name, true);
    }
    
    returnToPrevious() {
        if (this.previousState && this.states[this.previousState]) {
            this.setState(this.previousState, true);
        }
    }
    
    createPlayerStates() {
        this.addState('idle', { animation: 'idle_down', loop: true, priority: 0 });
        this.addState('idle_down',  { animation: 'idle_down',  loop: true, priority: 1 });
        this.addState('idle_up',    { animation: 'idle_up',    loop: true, priority: 1 });
        this.addState('idle_left',  { animation: 'idle_left',  loop: true, priority: 1 });
        this.addState('idle_right', { animation: 'idle_right', loop: true, priority: 1 });

        this.addState('walk',       { animation: 'walk_down',  loop: true, priority: 2 });
        this.addState('walk_down',  { animation: 'walk_down',  loop: true, priority: 3 });
        this.addState('walk_up',    { animation: 'walk_up',    loop: true, priority: 3 });
        this.addState('walk_left',  { animation: 'walk_left',  loop: true, priority: 3 });
        this.addState('walk_right', { animation: 'walk_right', loop: true, priority: 3 });

        // Attack states — high priority, non-looping, auto-transition back to idle when done.
        var atkCfg = function(dir) {
            return {
                animation: 'attack_' + dir,
                loop: false,
                priority: 10,
                duration: 350,
                transitions: [{ event: 'complete', target: 'idle_' + dir }]
            };
        };
        this.addState('attack_down',  atkCfg('down'));
        this.addState('attack_up',    atkCfg('up'));
        this.addState('attack_left',  atkCfg('left'));
        this.addState('attack_right', atkCfg('right'));

        return this;
    }

    startAttackState(dir) {
        var stateName = 'attack_' + (dir || 'down');
        return this.forceState(stateName);
    }

    isAttacking() {
        return this.currentState && this.currentState.indexOf('attack_') === 0;
    }
    
    static createForPlayer() {
        var sm = new RealmKit.AnimationStateMachine();
        sm.createPlayerStates();
        sm.setState('idle_down');
        return sm;
    }
};

console.log('[AnimationStateMachine] Class loaded');
