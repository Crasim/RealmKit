var RealmKit = RealmKit || {};

/**
 * MobileTouchHandler - Adds touch controls for tablets/mobile devices
 * Maps touch events to keyboard inputs to avoid conflicts with existing systems
 * Only activates on touch-capable devices
 */
RealmKit.MobileTouchHandler = class MobileTouchHandler {
    constructor(engine) {
        this.engine = engine;
        this.enabled = false;
        this.isTouchDevice = false;
        
        // Touch state
        this.joystickActive = false;
        this.joystickStart = { x: 0, y: 0 };
        this.joystickCurrent = { x: 0, y: 0 };
        this.joystickId = null;
        this.joystickMaxRadius = 60;
        
        // Button states
        this.buttons = {
            attack: false,
            recruit: false,
            menu: false,
            interact: false
        };
        
        // DOM elements
        this.container = null;
        this.joystickBase = null;
        this.joystickThumb = null;
        this.buttonElements = {};
        
        console.log('[MobileTouchHandler] Initialized');
    }
    
    /**
     * Check if device supports touch
     */
    detectTouchDevice() {
        // Check for touch support
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Also check if we're on a mobile/tablet user agent
        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Enable if either touch is supported OR we're on mobile
        if (this.isTouchDevice || isMobile) {
            console.log('[MobileTouchHandler] Touch device detected:', { 
                touchSupport: this.isTouchDevice, 
                mobileUA: isMobile 
            });
            return true;
        }
        
        return false;
    }
    
    /**
     * Initialize touch controls
     */
    init() {
        // Check for touch support
        var hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Check user agent for mobile/tablet
        var isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Mobile|Touch/i.test(navigator.userAgent);
        
        // Enable if has touch support AND is mobile UA
        if (!hasTouch || !isMobileUA) {
            console.log('[MobileTouchHandler] Not a mobile/touch device, skipping');
            return false;
        }
        
        this.isTouchDevice = true;
        
        console.log('[MobileTouchHandler] Mobile device detected, creating touch UI');
        
        this.createUI();
        this.bindEvents();
        this.enabled = true;
        
        return true;
    }
    
    /**
     * Create the touch control UI
     */
    createUI() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'mobile-touch-controls';
        this.container.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'width: 100%',
            'height: 100%',
            'pointer-events: none',
            'z-index: 900',
            'user-select: none',
            '-webkit-user-select: none',
            'touch-action: none'
        ].join(';');
        
        // Create virtual joystick (left side)
        this.createJoystick();
        
        // Create action buttons (right side)
        this.createButtons();
        
        // Create OSD indicator showing mobile mode is active
        this.createOSD();
        
        // Add to document
        document.body.appendChild(this.container);
    }
    
    /**
     * Create virtual joystick
     */
    createJoystick() {
        // Joystick base
        this.joystickBase = document.createElement('div');
        this.joystickBase.id = 'mobile-joystick-base';
        this.joystickBase.style.cssText = [
            'position: absolute',
            'left: 80px',
            'bottom: 140px',
            'width: 120px',
            'height: 120px',
            'border-radius: 50%',
            'background: rgba(60, 40, 20, 0.5)',
            'border: 3px solid rgba(200, 180, 140, 0.6)',
            'pointer-events: auto',
            'display: block',
            'z-index: 901'
        ].join(';');
        
        // Joystick thumb
        this.joystickThumb = document.createElement('div');
        this.joystickThumb.id = 'mobile-joystick-thumb';
        this.joystickThumb.style.cssText = [
            'position: absolute',
            'left: 50%',
            'top: 50%',
            'width: 50px',
            'height: 50px',
            'border-radius: 50%',
            'background: radial-gradient(circle, rgba(200, 180, 140, 0.9), rgba(150, 130, 100, 0.8))',
            'border: 2px solid rgba(255, 240, 200, 0.8)',
            'transform: translate(-50%, -50%)',
            'pointer-events: none'
        ].join(';');
        
        this.joystickBase.appendChild(this.joystickThumb);
        this.container.appendChild(this.joystickBase);
    }
    
    /**
     * Create action buttons
     */
    createButtons() {
        var buttonConfigs = [
            { id: 'attack', label: '⚔', x: -80, y: 180, action: 'attack' },
            { id: 'recruit', label: '👤', x: -160, y: 120, action: 'recruit' },
            { id: 'interact', label: '👋', x: -80, y: 100, action: 'interact' },
            { id: 'menu', label: '☰', x: -80, y: 40, action: 'menu' }
        ];
        
        var self = this;
        buttonConfigs.forEach(function(config) {
            var btn = document.createElement('div');
            btn.id = 'mobile-btn-' + config.id;
            btn.style.cssText = [
                'position: absolute',
                'right: ' + Math.abs(config.x) + 'px',
                'bottom: ' + config.y + 'px',
                'width: 70px',
                'height: 70px',
                'border-radius: 50%',
                'background: radial-gradient(circle, rgba(80, 60, 40, 0.9), rgba(40, 30, 20, 0.95))',
                'border: 4px solid rgba(200, 180, 140, 0.8)',
                'display: flex',
                'align-items: center',
                'justify-content: center',
                'font-size: 28px',
                'color: rgba(255, 240, 200, 0.95)',
                'pointer-events: auto',
                'cursor: pointer',
                'touch-action: manipulation',
                '-webkit-tap-highlight-color: transparent',
                'box-shadow: 0 4px 8px rgba(0,0,0,0.5)'
            ].join(';');
            
            btn.innerHTML = config.label;
            btn.dataset.action = config.action;
            
            self.container.appendChild(btn);
            self.buttonElements[config.id] = btn;
        });
        
        // Add mute button for audio control
        this.createMuteButton();
    }
    
    /**
     * Create OSD indicator showing mobile mode
     */
    createOSD() {
        this.osd = document.createElement('div');
        this.osd.id = 'mobile-osd-indicator';
        this.osd.style.cssText = [
            'position: fixed',
            'top: 10px',
            'left: 50%',
            'transform: translateX(-50%)',
            'padding: 8px 16px',
            'background: rgba(40, 30, 20, 0.85)',
            'border: 2px solid rgba(200, 180, 140, 0.6)',
            'border-radius: 6px',
            'color: rgba(255, 240, 200, 0.9)',
            'font-family: "Press Start 2P", monospace',
            'font-size: 8px',
            'pointer-events: none',
            'z-index: 901',
            'text-align: center',
            'letter-spacing: 1px'
        ].join(';');
        
        this.osd.innerHTML = '📱 MOBILE MODE ACTIVE';
        
        this.container.appendChild(this.osd);
        
        // Create permanent debug indicator (small, bottom left)
        this.debugIndicator = document.createElement('div');
        this.debugIndicator.id = 'mobile-debug-indicator';
        this.debugIndicator.style.cssText = [
            'position: fixed',
            'bottom: 5px',
            'left: 5px',
            'padding: 4px 8px',
            'background: rgba(0, 0, 0, 0.7)',
            'color: #0f0',
            'font-family: monospace',
            'font-size: 10px',
            'z-index: 9999',
            'pointer-events: none',
            'border: 1px solid #0f0'
        ].join(';');
        this.debugIndicator.innerHTML = 'TOUCH: ON';
        document.body.appendChild(this.debugIndicator);
        
        // Fade out OSD after 5 seconds but keep debug
        var self = this;
        setTimeout(function() {
            if (self.osd) {
                self.osd.style.transition = 'opacity 1s';
                self.osd.style.opacity = '0';
                setTimeout(function() {
                    if (self.osd) {
                        self.osd.style.display = 'none';
                    }
                }, 1000);
            }
        }, 5000);
    }
    
    /**
     * Create audio mute button
     */
    createMuteButton() {
        var self = this;
        
        // Create mute button
        this.muteBtn = document.createElement('div');
        this.muteBtn.id = 'mobile-mute-btn';
        this.muteBtn.style.cssText = [
            'position: absolute',
            'right: 10px',
            'top: 50px',
            'width: 50px',
            'height: 50px',
            'border-radius: 50%',
            'background: radial-gradient(circle, rgba(80, 60, 40, 0.8), rgba(40, 30, 20, 0.9))',
            'border: 3px solid rgba(200, 180, 140, 0.6)',
            'display: flex',
            'align-items: center',
            'justify-content: center',
            'font-size: 20px',
            'color: rgba(255, 240, 200, 0.9)',
            'pointer-events: auto',
            'cursor: pointer',
            'touch-action: manipulation',
            '-webkit-tap-highlight-color: transparent'
        ].join(';');
        
        // Set initial icon based on audio state
        this.updateMuteIcon();
        
        // Add click handler
        this.muteBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            self.toggleAudioMute();
        }, { passive: false });
        
        // Also support mouse for hybrid devices
        this.muteBtn.addEventListener('mousedown', function(e) {
            e.preventDefault();
            self.toggleAudioMute();
        });
        
        this.container.appendChild(this.muteBtn);
    }
    
    /**
     * Toggle audio mute
     */
    toggleAudioMute() {
        if (!this.engine || !this.engine.audio) return;
        
        var isMuted = this.engine.audio.toggleMute();
        this.updateMuteIcon();
        
        console.log('[MobileTouchHandler] Audio muted:', isMuted);
    }
    
    /**
     * Update mute button icon
     */
    updateMuteIcon() {
        if (!this.muteBtn) return;
        
        var isMuted = this.engine && this.engine.audio && this.engine.audio.isMuted;
        this.muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
        this.muteBtn.style.opacity = isMuted ? '0.5' : '1';
    }
    
    /**
     * Bind touch events
     */
    bindEvents() {
        var self = this;
        
        // Joystick touch events
        this.joystickBase.addEventListener('touchstart', function(e) {
            e.preventDefault();
            self.handleJoystickStart(e);
        }, { passive: false });
        
        this.joystickBase.addEventListener('touchmove', function(e) {
            e.preventDefault();
            self.handleJoystickMove(e);
        }, { passive: false });
        
        this.joystickBase.addEventListener('touchend', function(e) {
            e.preventDefault();
            self.handleJoystickEnd(e);
        }, { passive: false });
        
        // Button touch events
        Object.keys(this.buttonElements).forEach(function(key) {
            var btn = self.buttonElements[key];
            
            btn.addEventListener('touchstart', function(e) {
                e.preventDefault();
                self.handleButtonDown(key, btn);
            }, { passive: false });
            
            btn.addEventListener('touchend', function(e) {
                e.preventDefault();
                self.handleButtonUp(key, btn);
            }, { passive: false });
        });
        
        // Window resize
        window.addEventListener('resize', function() {
            self.handleResize();
        });
    }
    
    /**
     * Handle joystick touch start
     */
    handleJoystickStart(e) {
        var touch = e.changedTouches[0];
        var rect = this.joystickBase.getBoundingClientRect();
        
        this.joystickActive = true;
        this.joystickId = touch.identifier;
        this.joystickStart = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        this.joystickCurrent = { x: touch.clientX, y: touch.clientY };
        
        this.updateJoystickVisual();
        this.updateMovement();
    }
    
    /**
     * Handle joystick touch move
     */
    handleJoystickMove(e) {
        if (!this.joystickActive) return;
        
        // Find our tracked touch
        var touch = null;
        for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.joystickId) {
                touch = e.changedTouches[i];
                break;
            }
        }
        
        if (!touch) return;
        
        this.joystickCurrent = { x: touch.clientX, y: touch.clientY };
        this.updateJoystickVisual();
        this.updateMovement();
    }
    
    /**
     * Handle joystick touch end
     */
    handleJoystickEnd(e) {
        // Check if our tracked touch ended
        var found = false;
        for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.joystickId) {
                found = true;
                break;
            }
        }
        
        if (!found) return;
        
        this.joystickActive = false;
        this.joystickId = null;
        this.joystickCurrent = { x: 0, y: 0 };
        
        this.updateJoystickVisual();
        this.clearMovement();
    }
    
    /**
     * Update joystick visual position
     */
    updateJoystickVisual() {
        if (!this.joystickActive) {
            this.joystickThumb.style.transform = 'translate(-50%, -50%)';
            return;
        }
        
        var dx = this.joystickCurrent.x - this.joystickStart.x;
        var dy = this.joystickCurrent.y - this.joystickStart.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        // Clamp to max radius
        if (dist > this.joystickMaxRadius) {
            var ratio = this.joystickMaxRadius / dist;
            dx *= ratio;
            dy *= ratio;
        }
        
        this.joystickThumb.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    }
    
    /**
     * Update movement based on joystick position
     */
    updateMovement() {
        if (!this.engine || !this.engine.inputController) return;
        
        var dx = this.joystickCurrent.x - this.joystickStart.x;
        var dy = this.joystickCurrent.y - this.joystickStart.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        // Deadzone
        if (dist < 10) {
            this.clearMovement();
            return;
        }
        
        // Normalize and set keys
        var threshold = 10;
        var controller = this.engine.inputController;
        
        controller.keys.up = dy < -threshold;
        controller.keys.down = dy > threshold;
        controller.keys.left = dx < -threshold;
        controller.keys.right = dx > threshold;
    }
    
    /**
     * Clear all movement keys
     */
    clearMovement() {
        if (!this.engine || !this.engine.inputController) return;
        
        var controller = this.engine.inputController;
        controller.keys.up = false;
        controller.keys.down = false;
        controller.keys.left = false;
        controller.keys.right = false;
    }
    
    /**
     * Handle button press
     */
    handleButtonDown(action, btnElement) {
        this.buttons[action] = true;
        btnElement.style.background = 'radial-gradient(circle, rgba(120, 100, 70, 0.9), rgba(60, 50, 30, 0.9))';
        btnElement.style.transform = 'scale(0.95)';
        
        // Call the appropriate action directly
        if (!this.engine || !this.engine.inputController) return;
        
        var controller = this.engine.inputController;
        
        switch (action) {
            case 'attack':
                controller.onAttack();
                console.log('[MobileTouchHandler] Attack triggered');
                break;
            case 'recruit':
                controller.onRecruit();
                console.log('[MobileTouchHandler] Recruit triggered');
                break;
            case 'interact':
                controller.onInteract();
                console.log('[MobileTouchHandler] Interact triggered');
                break;
            case 'menu':
                controller.onEscape();
                console.log('[MobileTouchHandler] Menu triggered');
                break;
        }
    }
    
    /**
     * Handle button release
     */
    handleButtonUp(action, btnElement) {
        this.buttons[action] = false;
        btnElement.style.background = 'radial-gradient(circle, rgba(80, 60, 40, 0.8), rgba(40, 30, 20, 0.9))';
        btnElement.style.transform = 'scale(1)';
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        // Show/hide joystick based on screen size
        if (this.joystickBase) {
            this.joystickBase.style.display = window.innerWidth < 768 ? 'block' : 'none';
        }
    }
    
    /**
     * Enable/disable touch controls
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.container) {
            this.container.style.display = enabled ? 'block' : 'none';
        }
    }
    
    /**
     * Check if touch controls are active
     */
    isActive() {
        return this.enabled && this.isTouchDevice;
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.enabled = false;
        console.log('[MobileTouchHandler] Destroyed');
    }
};

console.log('[MobileTouchHandler] Module loaded');
