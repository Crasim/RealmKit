var RealmKit = RealmKit || {};

RealmKit.WorldEditor = function WorldEditor(engine) {
    this.engine = engine;
    this.visible = false;
    this.editMode = false;
    
    this.selectedType = 'spawner';
    this.selectedId = null;
    
    this.spawners = [];
    this.triggers = [];
    this.zones = [];
    
    this.templates = {
        spawner: [
            { id: 'goblin_scout', name: 'Goblin Scout', level: 3, weight: 1 },
            { id: 'skeleton', name: 'Skeleton', level: 5, weight: 1 },
            { id: 'wolf', name: 'Wolf', level: 4, weight: 1 },
            { id: 'orc_grunt', name: 'Orc Grunt', level: 7, weight: 1 },
            { id: 'goblin_shaman', name: 'Goblin Shaman', level: 6, weight: 1 },
            { id: 'skeleton_archer', name: 'Skeleton Archer', level: 6, weight: 1 },
            { id: 'zombie', name: 'Zombie', level: 4, weight: 1 },
            { id: 'vampire_bat', name: 'Vampire Bat', level: 5, weight: 1 }
        ],
        boss: [
            { id: 'goblin_chieftain', name: 'Goblin Chieftain', level: 12, weight: 1 },
            { id: 'skeletal_warlord', name: 'Skeletal Warlord', level: 15, weight: 1 },
            { id: 'ancient_wolf', name: 'Ancient Wolf', level: 14, weight: 1 },
            { id: 'orc_warlord', name: 'Orc Warlord', level: 18, weight: 1 }
        ]
    };
    
    this.triggerTypes = [
        { id: 'on_enter', name: 'On Enter', description: 'Trigger when player enters zone' },
        { id: 'on_exit', name: 'On Exit', description: 'Trigger when player exits zone' },
        { id: 'on_interact', name: 'On Interact', description: 'Trigger when player presses E' },
        { id: 'on_time', name: 'On Time', description: 'Trigger at specific game time' },
        { id: 'on_kill', name: 'On Kill', description: 'Trigger when monsters killed in area' }
    ];
    
    this.actionTypes = [
        { id: 'spawn', name: 'Spawn Monster', params: ['templateId', 'count'] },
        { id: 'message', name: 'Show Message', params: ['text'] },
        { id: 'dialog', name: 'Start Dialog', params: ['dialogId'] },
        { id: 'teleport', name: 'Teleport Player', params: ['x', 'y'] },
        { id: 'quest', name: 'Start Quest', params: ['questId'] },
        { id: 'item', name: 'Give Item', params: ['itemId', 'count'] },
        { id: 'gold', name: 'Give Gold', params: ['amount'] },
        { id: 'weather', name: 'Set Weather', params: ['type', 'intensity'] },
        { id: 'flag', name: 'Set Flag', params: ['flagName', 'value'] },
        { id: 'spawner', name: 'Toggle Spawner', params: ['spawnerId', 'active'] }
    ];
    
    this.el = null;
    this._e = {};
    
    this._dragging = false;
    this._dragTarget = null;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._pendingTriggerStart = null;
    
    this._build();
    this._bindKeys();
    this._bindMouse();
    
    console.log('[WorldEditor] Initialized - press F6 to toggle');
};

RealmKit.WorldEditor.prototype = {
    
    _build: function() {
        var self = this;
        
        // Inject styles only once
        if (!document.getElementById('we-worldeditor-styles')) {
            var style = document.createElement('style');
            style.id = 'we-worldeditor-styles';
            style.textContent = this._getStyles();
            document.head.appendChild(style);
        }
        
        var p = document.createElement('div');
        p.id = 'rk-worldeditor';
        p.innerHTML = this._getHTML();
        p.style.display = 'none';
        document.body.appendChild(p);
        this.el = p;
        
        var ids = [
            'we-close', 'we-mode', 'we-layer', 'we-add',
            'we-spawner-list', 'we-trigger-list',
            'we-spawner-template', 'we-spawner-radius', 'we-spawner-count', 
            'we-spawner-location', 'we-spawner-time', 'we-spawner-onetime', 'we-spawner-active',
            'we-trigger-type', 'we-trigger-width', 'we-trigger-height', 'we-trigger-once',
            'we-delete', 'we-save', 'we-load',
            'we-status'
        ];
        for (var i = 0; i < ids.length; i++) {
            this._e[ids[i]] = document.getElementById(ids[i]);
        }
        
        this._bindControls();
        this._populateTemplates();
        
        console.log('[WorldEditor] UI built');
    },
    
    _getStyles: function() {
        return [
            '@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");',
            '',
            '#rk-worldeditor {',
            '  position: fixed;',
            '  top: 60px; right: 10px;',
            '  width: 320px;',
            '  max-height: calc(100vh - 80px);',
            '  overflow-y: auto;',
            '  z-index: 10003;',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 7px;',
            '  background: repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
            '  border: 3px solid #1a0800;',
            '  box-shadow: inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);',
            '  border-radius: 4px;',
            '}',

            '.we-hdr {',
            '  display: flex; justify-content: space-between; align-items: center;',
            '  padding: 8px 10px;',
            '  background: linear-gradient(180deg,#3d3326 0%,#2a2218 50%,#17110c 100%);',
            '  border-bottom: 2px solid #1a1828;',
            '}',
            '.we-title { color: #f6e2ae; font-size: 8px; }',
            '.we-close {',
            '  background: linear-gradient(180deg,#4a4a58 0%,#3a3a48 50%,#2a2a38 100%);border:1px solid #1a0800;color:#e8d8c8;',
            '  padding: 2px 8px; cursor: pointer;',
            '  font-size: 7px;',
            '}',
            '.we-close:hover { background: linear-gradient(180deg,#5a5a68 0%,#4a4a58 50%,#3a3a38 100%); }',

            '.we-section { padding: 8px; border-bottom: 1px solid rgba(90,56,24,.45); }',
            '.we-section:last-child { border-bottom: none; }',
            '.we-sec-title {',
            '  color: #87663b; font-size: 7px; margin-bottom: 6px;',
            '  text-transform: uppercase; letter-spacing: 1px;',
            '}',

            '.we-btn-row { display: flex; gap: 4px; flex-wrap: wrap; }',
            '.we-btn {',
            '  background: linear-gradient(180deg,#4a4a58 0%,#3a3a48 50%,#2a2a38 100%);border:1px solid #1a0800;color:#e8d8c8;',
            '  padding: 4px 8px; cursor: pointer;',
            '  font-size: 7px; font-family: inherit;',
            '  min-width: 50px;',
            '}',
            '.we-btn:hover { background: linear-gradient(180deg,#5a5a68 0%,#4a4a58 50%,#3a3a38 100%);border-color:#87663b;color:#c8a84b; }',
            '.we-btn:active { background: #2e1e0e; }',
            '.we-btn.active { background: #3a2a18; border-color: #87663b; color: #c8a84b; }',
            '',
            '.we-layer-btns { display: flex; gap: 2px; }',
            '.we-layer-btn {',
            '  flex: 1; padding: 4px 2px; font-size: 6px;',
            '}',
            '',
            '.we-list {',
            '  max-height: 120px;',
            '  overflow-y: auto;',
            '  background: #1a0c04;',
            '  border: 2px inset #5a3818;',
            '}',
            '.we-list-item {',
            '  padding: 4px 6px;',
            '  border-bottom: 1px solid #3a2818;',
            '  cursor: pointer;',
            '  color: #8a7060;',
            '}',
            '.we-list-item:hover { background: #2a1408; color: #c8b890; }',
            '.we-list-item.selected { background: #3a2a18; color: #c8a84b; }',

            '.we-prop-grid {',
            '  display: grid;',
            '  grid-template-columns: 80px 1fr;',
            '  gap: 4px;',
            '}',
            '.we-prop-label { color: #6a5040; }',
            '.we-prop-input {',
            '  background: #2a1408; border: 2px inset #5a3818;',
            '  color: #c8b890; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',
            '.we-prop-input[type="number"] { width: 60px; }',
            '.we-prop-input[type="text"] { width: 100%; }',
            '.we-prop-select {',
            '  background: #2a1408; border: 2px solid #5a3818;',
            '  color: #c8b890; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',

            '.we-status {',
            '  padding: 4px 8px;',
            '  background: #1a0c04;',
            '  color: #8a7060;',
            '  font-size: 7px;',
            '}',
            '.we-list-item {',
            '  padding: 4px 6px;',
            '  border-bottom: 1px solid #3a2818;',
            '  cursor: pointer;',
            '  color: #8a7060;',
            '}',
            '.we-list-item:hover { background: #2a1408; color: #c8b890; }',
            '.we-list-item.selected { background: #3a2a18; color: #c8a84b; }',

            '.we-prop-grid {',
            '  display: grid;',
            '  grid-template-columns: 80px 1fr;',
            '  gap: 4px;',
            '}',
            '.we-prop-label { color: #6a5040; }',
            '.we-prop-input {',
            '  background: #2a1408; border: 2px inset #5a3818;',
            '  color: #c8b890; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',
            '.we-prop-input[type="number"] { width: 60px; }',
            '.we-prop-input[type="text"] { width: 100%; }',
            '.we-prop-select {',
            '  background: #2a1408; border: 2px solid #5a3818;',
            '  color: #c8b890; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',
            '.we-list-item:hover { background: #2a1408; color: #c8b890; }',
            '.we-list-item.selected { background: #3a2a18; color: #c8a84b; }',

            '.we-prop-grid {',
            '  display: grid;',
            '  grid-template-columns: 80px 1fr;',
            '  gap: 4px;',
            '}',
            '.we-prop-label { color: #6a5040; }',
            '.we-prop-input {',
            '  background: #2a1408; border: 2px inset #5a3818;',
            '  color: #c8b890; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',
            '.we-prop-input[type="number"] { width: 60px; }',
            '.we-prop-input[type="text"] { width: 100%; }',
            '.we-prop-select {',
            '  background: #2a1408; border: 2px solid #5a3818;',
            '  color: #c8b890; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',
            '',
            '.we-prop-grid {',
            '  display: grid;',
            '  grid-template-columns: 80px 1fr;',
            '  gap: 4px;',
            '}',
            '',
            '',
            '.we-status {',
            '  padding: 4px 8px;',
            '  background: #1a0c04;',
            '  color: #8a7060;',
            '  font-size: 7px;',
            '}',
            '.we-status.active { color: #c8a84b; }',
            '',
            '.we-hint {',
            '  position: fixed;',
            '  bottom: 60px; left: 50%; transform: translateX(-50%);',
            '  background: repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
            '  color: #c8b890; padding: 4px 12px;',
            '  font-family: "Press Start 2P", monospace; font-size: 7px;',
            '  z-index: 10004; display: none;',
            '  border: 3px solid #1a0800;',
            '  box-shadow: inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);',
            '  pointer-events: none;',
            '}'
        ].join('\n');
    },
    
    _getHTML: function() {
        return [
            '<div class="we-hdr">',
            '  <span class="we-title">WORLD EDITOR</span>',
            '  <button class="we-close" id="we-close">ESC</button>',
            '</div>',
            '',
            '<div class="we-section">',
            '  <div class="we-sec-title">Mode</div>',
            '  <div class="we-btn-row">',
            '    <button class="we-btn" id="we-mode">EDIT: OFF</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="we-section">',
            '  <div class="we-sec-title">Layer</div>',
            '  <div class="we-layer-btns">',
            '    <button class="we-btn we-layer-btn active" data-layer="spawner">Spawners</button>',
            '    <button class="we-btn we-layer-btn" data-layer="trigger">Triggers</button>',
            '    <button class="we-btn we-layer-btn" data-layer="zone">Zones</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="we-section">',
            '  <div class="we-sec-title">Add</div>',
            '  <div class="we-btn-row">',
            '    <button class="we-btn we-btn-amber" id="we-add">+ ADD</button>',
            '    <button class="we-btn we-btn-red" id="we-delete">DELETE</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="we-section" id="we-spawner-props">',
            '  <div class="we-sec-title">Spawner Properties</div>',
            '  <div class="we-prop-grid">',
            '    <span class="we-prop-label">Template:</span>',
            '    <select class="we-prop-select" id="we-spawner-template"></select>',
            '    <span class="we-prop-label">Radius:</span>',
            '    <input type="number" class="we-prop-input" id="we-spawner-radius" value="80" min="20" max="500">',
            '    <span class="we-prop-label">Max Active:</span>',
            '    <input type="number" class="we-prop-input" id="we-spawner-count" value="3" min="1" max="20">',
            '    <span class="we-prop-label">Location:</span>',
            '    <input type="text" class="we-prop-input" id="we-spawner-location" placeholder="Optional location ID">',
            '    <span class="we-prop-label">Time:</span>',
            '    <select class="we-prop-select" id="we-spawner-time"><option value="">Any</option><option value="day">Day Only</option><option value="night">Night Only</option><option value="dawn">Dawn</option><option value="dusk">Dusk</option></select>',
            '    <span class="we-prop-label">One-Time:</span>',
            '    <input type="checkbox" id="we-spawner-onetime">',
            '    <span class="we-prop-label">Active:</span>',
            '    <input type="checkbox" id="we-spawner-active" checked>',
            '  </div>',
            '</div>',
            '',
            '<div class="we-section" id="we-trigger-props" style="display:none">',
            '  <div class="we-sec-title">Trigger Properties</div>',
            '  <div class="we-prop-grid">',
            '    <span class="we-prop-label">Type:</span>',
            '    <select class="we-prop-select" id="we-trigger-type"></select>',
            '    <span class="we-prop-label">Width:</span>',
            '    <input type="number" class="we-prop-input" id="we-trigger-width" value="100" min="32" max="500">',
            '    <span class="we-prop-label">Height:</span>',
            '    <input type="number" class="we-prop-input" id="we-trigger-height" value="100" min="32" max="500">',
            '    <span class="we-prop-label">One-time:</span>',
            '    <input type="checkbox" id="we-trigger-once">',
            '  </div>',
            '</div>',
            
            '<div class="we-section" id="we-zone-props" style="display:none">',
            '  <div class="we-sec-title">Zone Transition Properties</div>',
            '  <div class="we-prop-grid">',
            '    <span class="we-prop-label">Type:</span>',
            '    <select class="we-prop-select" id="we-zone-type"><option value="door">Door</option><option value="portal">Portal</option><option value="cave">Cave</option><option value="stairs_down">Stairs Down</option><option value="stairs_up">Stairs Up</option></select>',
            '    <span class="we-prop-label">Target Map:</span>',
            '    <input type="text" class="we-prop-input" id="we-zone-target" placeholder="leave empty for same map">',
            '    <span class="we-prop-label">Spawn ID:</span>',
            '    <input type="text" class="we-prop-input" id="we-zone-spawn" placeholder="default">',
            '    <span class="we-prop-label">Req Level:</span>',
            '    <input type="number" class="we-prop-input" id="we-zone-level" value="0" min="0">',
            '    <span class="we-prop-label">Cost Gold:</span>',
            '    <input type="number" class="we-prop-input" id="we-zone-cost" value="0" min="0">',
            '  </div>',
            '</div>',
            '',
            '<div class="we-section">',
            '  <div class="we-sec-title">Spawners</div>',
            '  <div class="we-list" id="we-spawner-list"></div>',
            '</div>',
            '',
            '<div class="we-section">',
            '  <div class="we-sec-title">Triggers</div>',
            '  <div class="we-list" id="we-trigger-list"></div>',
            '</div>',
            
            '<div class="we-section">',
            '  <div class="we-sec-title">Zones</div>',
            '  <div class="we-list" id="we-zone-list"></div>',
            '</div>',
            
            '<div class="we-section">',
            '  <div class="we-btn-row">',
            '    <button class="we-btn" id="we-save">SAVE</button>',
            '    <button class="we-btn" id="we-load">LOAD</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="we-status" id="we-status">Press F6 to toggle edit mode</div>'
        ].join('\n');
    },
    
    _bindControls: function() {
        var self = this;
        
        if (this._e['we-close']) {
            this._e['we-close'].addEventListener('click', function() {
                self.hide();
            });
        }
        
        if (this._e['we-mode']) {
            this._e['we-mode'].addEventListener('click', function() {
                self.toggleEditMode();
            });
        }
        
        if (this._e['we-add']) {
            this._e['we-add'].addEventListener('click', function() {
                self.addSelected();
            });
        }
        
        if (this._e['we-delete']) {
            this._e['we-delete'].addEventListener('click', function() {
                self.deleteSelected();
            });
        }
        
        if (this._e['we-save']) {
            this._e['we-save'].addEventListener('click', function() {
                self.saveWorld();
            });
        }
        
        if (this._e['we-load']) {
            this._e['we-load'].addEventListener('click', function() {
                self.loadWorld();
            });
        }
        
        var layerBtns = document.querySelectorAll('.we-layer-btn');
        for (var i = 0; i < layerBtns.length; i++) {
            layerBtns[i].addEventListener('click', function() {
                self.setLayer(this.getAttribute('data-layer'));
            });
        }
        
        if (this._e['we-spawner-template']) {
            this._e['we-spawner-template'].addEventListener('change', function() {
                self.updateSelectedSpawner();
            });
        }
        
        if (this._e['we-spawner-radius']) {
            this._e['we-spawner-radius'].addEventListener('change', function() {
                self.updateSelectedSpawner();
            });
        }
        
        if (this._e['we-spawner-count']) {
            this._e['we-spawner-count'].addEventListener('change', function() {
                self.updateSelectedSpawner();
            });
        }
        
        if (this._e['we-spawner-active']) {
            this._e['we-spawner-active'].addEventListener('change', function() {
                self.updateSelectedSpawner();
            });
        }
        
        if (this._e['we-trigger-type']) {
            this._e['we-trigger-type'].addEventListener('change', function() {
                self.updateSelectedTrigger();
            });
        }
        
        if (this._e['we-trigger-width']) {
            this._e['we-trigger-width'].addEventListener('change', function() {
                self.updateSelectedTrigger();
            });
        }
        
        if (this._e['we-trigger-height']) {
            this._e['we-trigger-height'].addEventListener('change', function() {
                self.updateSelectedTrigger();
            });
        }
        
        if (this._e['we-trigger-once']) {
            this._e['we-trigger-once'].addEventListener('change', function() {
                self.updateSelectedTrigger();
            });
        }
    },
    
    _bindKeys: function() {
        var self = this;
        window.addEventListener('keydown', function(e) {
            if (e.key === 'F6') {
                e.preventDefault();
                self.toggle();
            }
            if (e.key === 'Escape' && self.visible) {
                self.hide();
            }
            if (self.editMode) {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    self.deleteSelected();
                }
            }
        });
    },
    
    _bindMouse: function() {
        var self = this;
        var canvas = document.getElementById('gameCanvas') || document.querySelector('canvas');
        if (!canvas) {
            console.warn('[WorldEditor] Canvas not found');
            return;
        }
        
        canvas.addEventListener('mousedown', function(e) {
            if (!self.editMode) return;
            
            var coords = self._getWorldCoords(e);
            var clicked = self._findAt(coords.worldX, coords.worldY);
            
            if (clicked) {
                self._dragging = true;
                self._dragTarget = clicked;
                self._dragOffsetX = coords.worldX - clicked.x;
                self._dragOffsetY = coords.worldY - clicked.y;
                self.select(clicked.type, clicked.index);
            } else {
                self.addSelectedAt(coords.worldX, coords.worldY);
            }
        });
        
        canvas.addEventListener('mousemove', function(e) {
            if (!self.editMode || !self._dragging || !self._dragTarget) return;
            
            var coords = self._getWorldCoords(e);
            self._dragTarget.x = coords.worldX - self._dragOffsetX;
            self._dragTarget.y = coords.worldY - self._dragOffsetY;
            self._updateLists();
        });
        
        canvas.addEventListener('mouseup', function(e) {
            self._dragging = false;
            self._dragTarget = null;
        });
        
        canvas.addEventListener('mouseleave', function(e) {
            self._dragging = false;
            self._dragTarget = null;
        });
    },
    
    _populateTemplates: function() {
        var spawnerSelect = this._e['we-spawner-template'];
        if (spawnerSelect) {
            spawnerSelect.innerHTML = '<optgroup label="Regular">';
            for (var i = 0; i < this.templates.spawner.length; i++) {
                var t = this.templates.spawner[i];
                spawnerSelect.innerHTML += '<option value="' + t.id + '">' + t.name + ' (L' + t.level + ')</option>';
            }
            spawnerSelect.innerHTML += '</optgroup><optgroup label="Bosses">';
            for (var j = 0; j < this.templates.boss.length; j++) {
                var b = this.templates.boss[j];
                spawnerSelect.innerHTML += '<option value="' + b.id + '">' + b.name + ' (L' + b.level + ')</option>';
            }
            spawnerSelect.innerHTML += '</optgroup>';
        }
        
        var triggerSelect = this._e['we-trigger-type'];
        if (triggerSelect) {
            triggerSelect.innerHTML = '';
            for (var k = 0; k < this.triggerTypes.length; k++) {
                var tt = this.triggerTypes[k];
                triggerSelect.innerHTML += '<option value="' + tt.id + '">' + tt.name + '</option>';
            }
        }
    },
    
    _getWorldCoords: function(e) {
        var canvas = e.target;
        var rect = canvas.getBoundingClientRect();
        var scale = this.engine.renderer ? this.engine.renderer.viewport.currentScale : 1;
        var viewX = this.engine.renderer ? this.engine.renderer.viewport.x : 0;
        var viewY = this.engine.renderer ? this.engine.renderer.viewport.y : 0;
        
        return {
            worldX: (e.clientX - rect.left) / scale + viewX,
            worldY: (e.clientY - rect.top) / scale + viewY
        };
    },
    
    _findAt: function(worldX, worldY) {
        if (this.selectedType === 'spawner') {
            for (var i = this.spawners.length - 1; i >= 0; i--) {
                var sp = this.spawners[i];
                var radius = sp.radius || 80;
                var dx = worldX - sp.x;
                var dy = worldY - sp.y;
                if (dx * dx + dy * dy <= radius * radius) {
                    return { type: 'spawner', index: i, x: sp.x, y: sp.y };
                }
            }
        } else if (this.selectedType === 'zone') {
            for (var z = this.zones.length - 1; z >= 0; z--) {
                var zn = this.zones[z];
                var zx = zn.x;
                var zy = zn.y;
                var zw = zn.width || 64;
                var zh = zn.height || 64;
                if (worldX >= zx && worldX <= zx + zw && worldY >= zy && worldY <= zy + zh) {
                    return { type: 'zone', index: z, x: zn.x, y: zn.y };
                }
            }
        } else {
            for (var j = this.triggers.length - 1; j >= 0; j--) {
                var tr = this.triggers[j];
                var tx = tr.x;
                var ty = tr.y;
                var tw = tr.width || 100;
                var th = tr.height || 100;
                if (worldX >= tx && worldX <= tx + tw && worldY >= ty && worldY <= ty + th) {
                    return { type: 'trigger', index: j, x: tr.x, y: tr.y };
                }
            }
        }
        return null;
    },
    
    toggle: function() {
        this.visible = !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
        
        var hint = document.getElementById('we-hint');
        if (this.visible && !hint) {
            hint = document.createElement('div');
            hint.id = 'we-hint';
            hint.className = 'we-hint';
            hint.textContent = 'WORLD EDIT - Click empty space to place, drag existing items to move';
            document.body.appendChild(hint);
        }
        
        if (hint) {
            hint.style.display = this.visible ? 'block' : 'none';
        }
        
        console.log('[WorldEditor] ' + (this.visible ? 'Shown' : 'Hidden'));
    },
    
    show: function() {
        if (!this.visible) this.toggle();
    },
    
    hide: function() {
        if (this.visible) this.toggle();
    },
    
    toggleEditMode: function() {
        this.editMode = !this.editMode;
        this._e['we-mode'].textContent = 'EDIT: ' + (this.editMode ? 'ON' : 'OFF');
        this._e['we-mode'].classList.toggle('active', this.editMode);
        this._updateStatus(this.editMode ? 'Edit mode ON - Click canvas to add/select' : 'Edit mode OFF');
        console.log('[WorldEditor] Edit mode:', this.editMode);
    },
    
    setLayer: function(layer) {
        this.selectedType = layer;
        
        var layerBtns = document.querySelectorAll('.we-layer-btn');
        for (var i = 0; i < layerBtns.length; i++) {
            layerBtns[i].classList.toggle('active', layerBtns[i].getAttribute('data-layer') === layer);
        }
        
        var spawnerProps = document.getElementById('we-spawner-props');
        var triggerProps = document.getElementById('we-trigger-props');
        var zoneProps = document.getElementById('we-zone-props');
        if (spawnerProps) spawnerProps.style.display = layer === 'spawner' ? 'block' : 'none';
        if (triggerProps) triggerProps.style.display = layer === 'trigger' ? 'block' : 'none';
        if (zoneProps) zoneProps.style.display = layer === 'zone' ? 'block' : 'none';
        
        this._updateStatus('Layer: ' + layer);
    },
    
    select: function(type, index) {
        this.selectedType = type;
        this.selectedId = index;
        
        if (type === 'spawner' && this.spawners[index]) {
            var sp = this.spawners[index];
            if (this._e['we-spawner-template']) {
                this._e['we-spawner-template'].value = sp.spawnPool && sp.spawnPool[0] ? sp.spawnPool[0].templateId : 'goblin_scout';
            }
            if (this._e['we-spawner-radius']) this._e['we-spawner-radius'].value = sp.radius || 80;
            if (this._e['we-spawner-count']) this._e['we-spawner-count'].value = sp.maxActive || 3;
            if (this._e['we-spawner-location']) {
                this._e['we-spawner-location'].value = sp.spawnConditions && sp.spawnConditions.locationId ? sp.spawnConditions.locationId : '';
            }
            if (this._e['we-spawner-time']) {
                var timeOfDay = sp.spawnConditions && sp.spawnConditions.timeOfDay ? sp.spawnConditions.timeOfDay.join(',') : '';
                this._e['we-spawner-time'].value = timeOfDay;
            }
            if (this._e['we-spawner-onetime']) this._e['we-spawner-onetime'].checked = sp.oneTime || false;
            if (this._e['we-spawner-active']) this._e['we-spawner-active'].checked = sp.active !== false;
            this.setLayer('spawner');
        } else if (type === 'trigger' && this.triggers[index]) {
            var tr = this.triggers[index];
            if (this._e['we-trigger-type']) this._e['we-trigger-type'].value = tr.type || 'on_enter';
            if (this._e['we-trigger-width']) this._e['we-trigger-width'].value = tr.width || 100;
            if (this._e['we-trigger-height']) this._e['we-trigger-height'].value = tr.height || 100;
            if (this._e['we-trigger-once']) this._e['we-trigger-once'].checked = tr.oneTime || false;
            this.setLayer('trigger');
        } else if (type === 'zone' && this.zones[index]) {
            var zn = this.zones[index];
            var zoneType = document.getElementById('we-zone-type');
            var targetMap = document.getElementById('we-zone-target');
            var targetSpawn = document.getElementById('we-zone-spawn');
            var reqLevel = document.getElementById('we-zone-level');
            var costGold = document.getElementById('we-zone-cost');
            
            if (zoneType) zoneType.value = zn.zoneType || 'door';
            if (targetMap) targetMap.value = zn.targetMap || '';
            if (targetSpawn) targetSpawn.value = zn.targetSpawnId || 'default';
            if (reqLevel) reqLevel.value = zn.requiresLevel || 0;
            if (costGold) costGold.value = zn.costGold || 0;
            this.setLayer('zone');
        }
        
        this._updateLists();
        this._updateStatus('Selected: ' + type + ' #' + index);
    },
    
    deselect: function() {
        this.selectedId = null;
        this._updateLists();
        this._updateStatus('Deselected');
    },

    _defaultAnchor: function() {
        if (this.engine && this.engine.player) {
            return { x: this.engine.player.x, y: this.engine.player.y };
        }
        var viewport = this.engine && this.engine.renderer ? this.engine.renderer.viewport : { x: 0, y: 0, viewWidth: 800, viewHeight: 600 };
        return {
            x: viewport.x + viewport.viewWidth / 2,
            y: viewport.y + viewport.viewHeight / 2
        };
    },
    
    addSelected: function() {
        var anchor = this._defaultAnchor();
        this.addSelectedAt(anchor.x, anchor.y);
    },

    addSelectedAt: function(x, y) {
        
        if (this.selectedType === 'spawner') {
            var templateId = this._e['we-spawner-template'] ? this._e['we-spawner-template'].value : 'goblin_scout';
            var radius = this._e['we-spawner-radius'] ? parseInt(this._e['we-spawner-radius'].value) || 80 : 80;
            var maxActive = this._e['we-spawner-count'] ? parseInt(this._e['we-spawner-count'].value) || 3 : 3;
            var locationId = this._e['we-spawner-location'] ? this._e['we-spawner-location'].value.trim() : '';
            var timeOfDay = this._e['we-spawner-time'] ? this._e['we-spawner-time'].value : '';
            var oneTime = this._e['we-spawner-onetime'] ? this._e['we-spawner-onetime'].checked : false;
            
            var spawnConditions = {};
            if (locationId) {
                spawnConditions.locationId = locationId;
            }
            if (timeOfDay) {
                spawnConditions.timeOfDay = [timeOfDay];
            }
            
            var spawnerData = {
                id: 'spawner_' + Date.now(),
                x: x,
                y: y,
                radius: radius,
                spawnPool: [{ templateId: templateId, weight: 1 }],
                maxActive: maxActive,
                minActive: 1,
                respawnDelay: 30000,
                spawnConditions: Object.keys(spawnConditions).length > 0 ? spawnConditions : null,
                oneTime: oneTime,
                active: true
            };
            
            this.spawners.push(spawnerData);
            
            if (this.engine.spawnerManager) {
                this.engine.spawnerManager.createSpawner(spawnerData);
            }
            
            this.select('spawner', this.spawners.length - 1);
            this._updateStatus('Added spawner: ' + templateId);
            console.log('[WorldEditor] Added spawner:', spawnerData);
            
        } else if (this.selectedType === 'trigger') {
            var width = this._e['we-trigger-width'] ? parseInt(this._e['we-trigger-width'].value) || 100 : 100;
            var height = this._e['we-trigger-height'] ? parseInt(this._e['we-trigger-height'].value) || 100 : 100;
            var triggerType = this._e['we-trigger-type'] ? this._e['we-trigger-type'].value : 'on_enter';
            var oneTime = this._e['we-trigger-once'] ? this._e['we-trigger-once'].checked : false;
            
            var triggerData = {
                id: 'trigger_' + Date.now(),
                name: 'Trigger ' + (this.triggers.length + 1),
                type: triggerType,
                shape: 'rect',
                x: x - width / 2,
                y: y - height / 2,
                width: width,
                height: height,
                actions: [{ type: 'message', text: 'Trigger activated!' }],
                conditions: {},
                oneTime: oneTime,
                active: true
            };
            
            this.triggers.push(triggerData);
            
            if (this.engine.triggerSystem) {
                this.engine.triggerSystem.createTrigger(triggerData);
            }
            
            this.select('trigger', this.triggers.length - 1);
            this._updateStatus('Added trigger: ' + triggerType);
            console.log('[WorldEditor] Added trigger:', triggerData);
        } else if (this.selectedType === 'zone') {
            var zoneType = document.getElementById('we-zone-type') ? document.getElementById('we-zone-type').value : 'door';
            var targetMap = document.getElementById('we-zone-target') ? document.getElementById('we-zone-target').value.trim() : '';
            var targetSpawnId = document.getElementById('we-zone-spawn') ? document.getElementById('we-zone-spawn').value.trim() : 'default';
            var reqLevel = document.getElementById('we-zone-level') ? parseInt(document.getElementById('we-zone-level').value) || 0 : 0;
            var costGold = document.getElementById('we-zone-cost') ? parseInt(document.getElementById('we-zone-cost').value) || 0 : 0;
            
            var zoneData = {
                id: 'zone_' + Date.now(),
                name: 'Zone ' + (this.zones.length + 1),
                zoneType: zoneType,
                x: x - 32,
                y: y - 32,
                width: 64,
                height: 64,
                targetMap: targetMap || null,
                targetSpawnId: targetSpawnId,
                requiresLevel: reqLevel > 0 ? reqLevel : null,
                costGold: costGold
            };
            
            this.zones.push(zoneData);
            
            if (this.engine.zoneManager) {
                this.engine.zoneManager.addZone(zoneData);
            }
            
            this.select('zone', this.zones.length - 1);
            this._updateStatus('Added zone: ' + zoneType);
            console.log('[WorldEditor] Added zone:', zoneData);
        }
        
        this._updateLists();
    },
    
    deleteSelected: function() {
        if (this.selectedId === null) {
            this._updateStatus('Nothing selected');
            return;
        }
        
        if (this.selectedType === 'spawner') {
            var spawner = this.spawners[this.selectedId];
            if (spawner && this.engine.spawnerManager) {
                this.engine.spawnerManager.removeSpawner(spawner.id);
            }
            this.spawners.splice(this.selectedId, 1);
            this._updateStatus('Deleted spawner');
        } else if (this.selectedType === 'trigger') {
            var trigger = this.triggers[this.selectedId];
            if (trigger && this.engine.triggerSystem) {
                this.engine.triggerSystem.removeTrigger(trigger.id);
            }
            this.triggers.splice(this.selectedId, 1);
            this._updateStatus('Deleted trigger');
        } else if (this.selectedType === 'zone') {
            var zone = this.zones[this.selectedId];
            if (zone && this.engine.zoneManager) {
                this.engine.zoneManager.removeZone(zone.id);
            }
            this.zones.splice(this.selectedId, 1);
            this._updateStatus('Deleted zone');
        }
        
        this.selectedId = null;
        this._updateLists();
    },
    
    updateSelectedSpawner: function() {
        if (this.selectedType !== 'spawner' || this.selectedId === null) return;
        
        var sp = this.spawners[this.selectedId];
        if (!sp) return;
        
        if (this._e['we-spawner-template']) {
            sp.spawnPool = [{ templateId: this._e['we-spawner-template'].value, weight: 1 }];
        }
        if (this._e['we-spawner-radius']) {
            sp.radius = parseInt(this._e['we-spawner-radius'].value) || 80;
        }
        if (this._e['we-spawner-count']) {
            sp.maxActive = parseInt(this._e['we-spawner-count'].value) || 3;
        }
        if (this._e['we-spawner-location']) {
            var locationId = this._e['we-spawner-location'].value.trim();
            if (locationId) {
                sp.spawnConditions = sp.spawnConditions || {};
                sp.spawnConditions.locationId = locationId;
            } else if (sp.spawnConditions) {
                delete sp.spawnConditions.locationId;
            }
        }
        if (this._e['we-spawner-time']) {
            var timeOfDay = this._e['we-spawner-time'].value;
            if (timeOfDay) {
                sp.spawnConditions = sp.spawnConditions || {};
                sp.spawnConditions.timeOfDay = [timeOfDay];
            } else if (sp.spawnConditions) {
                delete sp.spawnConditions.timeOfDay;
            }
        }
        if (this._e['we-spawner-onetime']) {
            sp.oneTime = this._e['we-spawner-onetime'].checked;
        }
        if (this._e['we-spawner-active']) {
            sp.active = this._e['we-spawner-active'].checked;
        }
        
        if (sp.spawnConditions && Object.keys(sp.spawnConditions).length === 0) {
            sp.spawnConditions = null;
        }
        
        this._updateLists();
    },
    
    updateSelectedTrigger: function() {
        if (this.selectedType !== 'trigger' || this.selectedId === null) return;
        
        var tr = this.triggers[this.selectedId];
        if (!tr) return;
        
        if (this._e['we-trigger-type']) {
            tr.type = this._e['we-trigger-type'].value;
        }
        if (this._e['we-trigger-width']) {
            tr.width = parseInt(this._e['we-trigger-width'].value) || 100;
        }
        if (this._e['we-trigger-height']) {
            tr.height = parseInt(this._e['we-trigger-height'].value) || 100;
        }
        if (this._e['we-trigger-once']) {
            tr.oneTime = this._e['we-trigger-once'].checked;
        }
        
        this._updateLists();
    },
    
    updateSelectedZone: function() {
        if (this.selectedType !== 'zone' || this.selectedId === null) return;
        
        var zn = this.zones[this.selectedId];
        if (!zn) return;
        
        var zoneType = document.getElementById('we-zone-type');
        var targetMap = document.getElementById('we-zone-target');
        var targetSpawn = document.getElementById('we-zone-spawn');
        var reqLevel = document.getElementById('we-zone-level');
        var costGold = document.getElementById('we-zone-cost');
        
        if (zoneType) zn.zoneType = zoneType.value;
        if (targetMap) zn.targetMap = targetMap.value.trim() || null;
        if (targetSpawn) zn.targetSpawnId = targetSpawn.value.trim() || 'default';
        if (reqLevel) zn.requiresLevel = parseInt(reqLevel.value) || null;
        if (costGold) zn.costGold = parseInt(costGold.value) || 0;
        
        this._updateLists();
    },
    
    _updateLists: function() {
        var self = this;
        var spawnerList = this._e['we-spawner-list'];
        if (spawnerList) {
            spawnerList.innerHTML = '';
            for (var i = 0; i < this.spawners.length; i++) {
                var sp = this.spawners[i];
                var templateName = sp.spawnPool && sp.spawnPool[0] ? sp.spawnPool[0].templateId : 'unknown';
                var item = document.createElement('div');
                item.className = 'we-list-item';
                if (this.selectedType === 'spawner' && this.selectedId === i) {
                    item.classList.add('selected');
                }
                item.textContent = templateName + ' (' + Math.floor(sp.x) + ',' + Math.floor(sp.y) + ')';
                item.setAttribute('data-index', i);
                item.addEventListener('click', (function(idx) {
                    return function() {
                        self.select('spawner', idx);
                    };
                })(i));
                spawnerList.appendChild(item);
            }
        }
        
        var triggerList = this._e['we-trigger-list'];
        if (triggerList) {
            triggerList.innerHTML = '';
            for (var j = 0; j < this.triggers.length; j++) {
                var tr = this.triggers[j];
                var tItem = document.createElement('div');
                tItem.className = 'we-list-item';
                if (this.selectedType === 'trigger' && this.selectedId === j) {
                    tItem.classList.add('selected');
                }
                tItem.textContent = (tr.name || tr.id) + ' (' + Math.floor(tr.x) + ',' + Math.floor(tr.y) + ')';
                tItem.setAttribute('data-index', j);
                tItem.addEventListener('click', (function(idx) {
                    return function() {
                        self.select('trigger', idx);
                    };
                })(j));
                triggerList.appendChild(tItem);
            }
        }
        
        var zoneList = document.getElementById('we-zone-list');
        if (zoneList) {
            zoneList.innerHTML = '';
            for (var k = 0; k < this.zones.length; k++) {
                var zn = this.zones[k];
                var zItem = document.createElement('div');
                zItem.className = 'we-list-item';
                if (this.selectedType === 'zone' && this.selectedId === k) {
                    zItem.classList.add('selected');
                }
                zItem.textContent = (zn.name || zn.id) + ' (' + Math.floor(zn.x) + ',' + Math.floor(zn.y) + ')';
                zItem.setAttribute('data-index', k);
                zItem.addEventListener('click', (function(idx) {
                    return function() {
                        self.select('zone', idx);
                    };
                })(k));
                zoneList.appendChild(zItem);
            }
        }
    },
    
    saveWorld: function() {
        var worldData = {
            version: 1,
            spawners: this.spawners,
            triggers: this.triggers,
            zones: this.zones,
            timestamp: Date.now()
        };

        if (this.engine && this.engine.isStudioMode && this.engine.storyDatabase && this.engine.currentStudioMapId) {
            var self = this;
            this.engine.storyDatabase.saveMapStudio(this.engine.currentStudioMapId, {
                spawners: worldData.spawners,
                triggers: worldData.triggers,
                zones: worldData.zones
            }).then(function() {
                self._updateStatus('World data saved to database');
                console.log('[WorldEditor] World data saved to database');
                try {
                    var parentShell = window.parent && window.parent.RealmKit && window.parent.RealmKit._realmStudioShell;
                    if (parentShell && typeof parentShell._reloadStudioData === 'function') {
                        parentShell._reloadStudioData(parentShell.activeNodeId);
                    }
                } catch (e) {
                    console.warn('[WorldEditor] Failed to notify studio shell after save:', e);
                }
            }).catch(function(err) {
                console.error('[WorldEditor] Failed to save world data to database:', err);
                self._updateStatus('DB save failed: ' + err.message);
            });
            return;
        }
        
        var json = JSON.stringify(worldData, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        
        var a = document.createElement('a');
        a.href = url;
        a.download = 'world_' + Date.now() + '.json';
        a.click();
        
        URL.revokeObjectURL(url);
        this._updateStatus('World saved to file');
        console.log('[WorldEditor] World saved');
    },
    
    loadWorld: function() {
        var self = this;
        if (this.engine && this.engine.isStudioMode && this.engine.storyDatabase && this.engine.currentStudioMapId) {
            this.engine.storyDatabase.getMapStudio(this.engine.currentStudioMapId).then(function(bundle) {
                self._applyWorldData({
                    spawners: bundle.spawners || [],
                    triggers: bundle.triggers || [],
                    zones: bundle.zones || []
                });
                self._updateStatus('World data loaded from database');
                console.log('[WorldEditor] World data loaded from database');
            }).catch(function(err) {
                console.error('[WorldEditor] Failed to load world data from database:', err);
                self._updateStatus('DB load failed: ' + err.message);
            });
            return;
        }

        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var worldData = JSON.parse(ev.target.result);
                    self._applyWorldData(worldData);
                    self._updateStatus('World loaded');
                    console.log('[WorldEditor] World loaded from file');
                } catch (err) {
                    console.error('[WorldEditor] Failed to load world:', err);
                    self._updateStatus('Load failed: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    },
    
    _applyWorldData: function(data) {
        this.spawners = data.spawners || [];
        this.triggers = data.triggers || [];
        this.zones = data.zones || [];
        
        if (this.engine.spawnerManager) {
            this.engine.spawnerManager.clear();
            for (var i = 0; i < this.spawners.length; i++) {
                this.engine.spawnerManager.createSpawner(this.spawners[i]);
            }
        }
        
        if (this.engine.triggerSystem) {
            this.engine.triggerSystem.clear();
            for (var j = 0; j < this.triggers.length; j++) {
                this.engine.triggerSystem.createTrigger(this.triggers[j]);
            }
        }
        
        if (this.engine.zoneManager) {
            this.engine.zoneManager.clear();
            for (var k = 0; k < this.zones.length; k++) {
                this.engine.zoneManager.addZone(this.zones[k]);
            }
        }
        
        this._updateLists();
        this._updateStatus('Loaded ' + this.spawners.length + ' spawners, ' + this.triggers.length + ' triggers, ' + this.zones.length + ' zones');
    },
    
    _updateStatus: function(msg) {
        var status = this._e['we-status'];
        if (status) {
            status.textContent = msg;
            status.classList.add('active');
            setTimeout(function() {
                status.classList.remove('active');
            }, 2000);
        }
    },
    
    renderOverlay: function(ctx, viewport) {
        if (!this.editMode) return;
        
        this._renderSpawners(ctx, viewport);
        this._renderTriggers(ctx, viewport);
        this._renderZones(ctx, viewport);
    },
    
    _renderSpawners: function(ctx, viewport) {
        ctx.save();
        
        for (var i = 0; i < this.spawners.length; i++) {
            var sp = this.spawners[i];
            var sx = sp.x - viewport.x;
            var sy = sp.y - viewport.y;
            
            var isSelected = this.selectedType === 'spawner' && this.selectedId === i;
            
            ctx.strokeStyle = isSelected ? '#ffff00' : '#00ff00';
            if (!sp.active) ctx.strokeStyle = '#808080';
            ctx.lineWidth = 2;
            ctx.setLineDash(isSelected ? [5, 5] : []);
            
            ctx.beginPath();
            ctx.arc(sx, sy, sp.radius || 80, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.setLineDash([]);
            ctx.fillStyle = isSelected ? '#ffff00' : '#00ff00';
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px monospace';
            var templateName = sp.spawnPool && sp.spawnPool[0] ? sp.spawnPool[0].templateId : 'spawner';
            ctx.fillText(templateName.substring(0, 12), sx - 24, sy - 12);
            
            if (sp.active !== false) {
                ctx.fillStyle = '#ffaa00';
                ctx.fillText('x' + (sp.maxActive || 3), sx - 6, sy + 4);
            }
        }
        
        ctx.restore();
    },
    
    _renderTriggers: function(ctx, viewport) {
        ctx.save();
        
        for (var i = 0; i < this.triggers.length; i++) {
            var tr = this.triggers[i];
            var tx = tr.x - viewport.x;
            var ty = tr.y - viewport.y;
            var tw = tr.width || 100;
            var th = tr.height || 100;
            
            var isSelected = this.selectedType === 'trigger' && this.selectedId === i;
            
            ctx.strokeStyle = isSelected ? '#ffff00' : '#ff00ff';
            if (!tr.active) ctx.strokeStyle = '#808080';
            ctx.lineWidth = 2;
            ctx.setLineDash(isSelected ? [5, 5] : [3, 3]);
            
            if (tr.shape === 'circle') {
                var radius = tr.radius || 50;
                ctx.beginPath();
                ctx.arc(tx + tw / 2, ty + th / 2, radius, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(255, 0, 255, 0.15)';
                ctx.fill();
            } else {
                ctx.strokeRect(tx, ty, tw, th);
                
                ctx.fillStyle = 'rgba(255, 0, 255, 0.15)';
                ctx.fillRect(tx, ty, tw, th);
            }
            
            ctx.setLineDash([]);
            ctx.fillStyle = '#ff00ff';
            ctx.font = '8px monospace';
            ctx.fillText(tr.name || 'trigger', tx + 4, ty + 12);
            
            if (tr.oneTime) {
                ctx.fillStyle = '#ff8800';
                ctx.fillText('[1x]', tx + 4, ty + 22);
            }
        }
        
        ctx.restore();
    },
    
    _renderZones: function(ctx, viewport) {
        ctx.save();
        
        for (var i = 0; i < this.zones.length; i++) {
            var zn = this.zones[i];
            var zx = zn.x - viewport.x;
            var zy = zn.y - viewport.y;
            var zw = zn.width || 64;
            var zh = zn.height || 64;
            
            var isSelected = this.selectedType === 'zone' && this.selectedId === i;
            
            var colors = {
                door: '#aa8844',
                portal: '#9944ff',
                cave: '#553311',
                stairs_down: '#556677',
                stairs_up: '#778899',
                dock: '#4488aa',
                trapdoor: '#445544'
            };
            var color = colors[zn.zoneType] || '#888888';
            
            ctx.strokeStyle = isSelected ? '#ffff00' : color;
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.setLineDash(isSelected ? [6, 3] : []);
            
            ctx.strokeRect(zx, zy, zw, zh);
            
            ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#', 'rgba(');
            if (color.startsWith('#')) {
                var r = parseInt(color.substr(1, 2), 16);
                var g = parseInt(color.substr(3, 2), 16);
                var b = parseInt(color.substr(5, 2), 16);
                ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.2)';
            }
            ctx.fillRect(zx, zy, zw, zh);
            
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px monospace';
            var label = zn.zoneType || 'zone';
            ctx.fillText(label.substring(0, 8), zx + 4, zy + 12);
            
            if (zn.targetMap) {
                ctx.fillStyle = '#aaccff';
                ctx.font = '7px monospace';
                ctx.fillText('→ ' + zn.targetMap.substring(0, 10), zx + 4, zy + zh - 8);
            }
        }
        
        ctx.restore();
    }
};

console.log('[WorldEditor] Module loaded');
