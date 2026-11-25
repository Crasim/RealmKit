var RealmKit = RealmKit || {};

RealmKit.MapEditor = function MapEditor(engine) {
    this.engine = engine;
    this.visible = false;
    this.editMode = false;
    
    this.currentLayer = 'terrain';
    this.currentTileId = 30;
    this.defaultTerrainTileId = 30;
    this.brushSize = 1;
    this.eraserMode = false;
    
    this.tiles = [];
    this.collision = [];
    this.spawners = [];
    this.triggers = [];
    this.entities = [];
    
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;
    
    this.gridVisible = false;
    this.gridColor = 'rgba(255, 255, 255, 0.3)';
    this.gridSize = 32;
    
    this.selectedEntity = null;
    this.selectedTrigger = null;
    this.selectedSpawner = null;
    this.selectedEntityTemplate = 'hero_knight';
    
    this.tileset = null;
    this.terrainTypes = [];
    
    this._mouseDown = false;
    this._lastTileX = -1;
    this._lastTileY = -1;
    this._dragEntity = null;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._triggerStartX = null;
    this._triggerStartY = null;
    
    this.el = null;
    this._e = {};
    
    this._build();
    this._bindKeys();
    this._bindMouse();
    
    console.log('[MapEditor] Initialized - press F5 to toggle');
};

RealmKit.MapEditor.prototype = {
    
    LAYERS: ['terrain', 'collision', 'spawners', 'triggers', 'entities'],
    TILE_META: {
        0: { name: 'Deep Water', color: '#0a2a5a', abbr: 'DW' },
        1: { name: 'Shallow Water', color: '#1a4a8a', abbr: 'SW' },
        2: { name: 'Beach', color: '#d4b878', abbr: 'BE' },
        3: { name: 'Grass', color: '#4a8a3a', abbr: 'GR' },
        4: { name: 'Grass 2', color: '#5a9a4a', abbr: 'G2' },
        5: { name: 'Dirt', color: '#a07840', abbr: 'DI' },
        6: { name: 'Stone', color: '#7a7a7a', abbr: 'ST' },
        7: { name: 'Cliff', color: '#6a6060', abbr: 'CL' },
        8: { name: 'Mountain', color: '#909090', abbr: 'MT' },
        9: { name: 'Snow', color: '#e8e8f0', abbr: 'SN' },
        10: { name: 'Road H', color: '#c0a060', abbr: 'RH' },
        11: { name: 'Road V', color: '#c0a060', abbr: 'RV' },
        12: { name: 'Road Corner', color: '#c0a060', abbr: 'RC' },
        13: { name: 'Bridge H', color: '#a0a060', abbr: 'BH' },
        14: { name: 'Bridge V', color: '#a0a060', abbr: 'BV' },
        15: { name: 'Waterfall', color: '#4090c0', abbr: 'WF' },
        16: { name: 'Ruin Floor', color: '#605040', abbr: 'RF' },
        17: { name: 'Ruin Wall', color: '#504030', abbr: 'RW' },
        18: { name: 'Building Floor', color: '#a08060', abbr: 'BF' },
        19: { name: 'Building Wall', color: '#806040', abbr: 'BW' },
        20: { name: 'Door', color: '#c08040', abbr: 'DR' },
        21: { name: 'Tree', color: '#2a7020', abbr: 'TR' },
        22: { name: 'Bush', color: '#3a6030', abbr: 'BU' },
        23: { name: 'Rock', color: '#808070', abbr: 'RK' },
        24: { name: 'Chest', color: '#c8a030', abbr: 'CH' },
        25: { name: 'Forest', color: '#205010', abbr: 'FO' },
        26: { name: 'Swamp', color: '#3a5838', abbr: 'SM' },
        27: { name: 'Desert', color: '#c8a050', abbr: 'DE' },
        28: { name: 'Tundra', color: '#a0c0e0', abbr: 'TU' },
        29: { name: 'Wetland', color: '#506848', abbr: 'WL' },
        30: { name: 'Meadow', color: '#70a040', abbr: 'MD' },
        31: { name: 'Ancient', color: '#8050a0', abbr: 'AN' }
    },
    
    _build: function() {
        var self = this;
        
        // Inject styles only once
        if (!document.getElementById('me-mapeditor-styles')) {
            var style = document.createElement('style');
            style.id = 'me-mapeditor-styles';
            style.textContent = this._getStyles();
            document.head.appendChild(style);
        }
        
        var p = document.createElement('div');
        p.id = 'rk-mapeditor';
        p.innerHTML = this._getHTML();
        p.style.display = 'none';
        document.body.appendChild(p);
        this.el = p;
        
        var ids = [
            'me-close', 'me-mode', 'me-grid', 'me-layer', 'me-brush', 'me-eraser', 'me-undo', 'me-redo',
            'me-clear', 'me-save', 'me-load',
            'me-tileset', 'me-collision', 'me-spawners', 'me-triggers', 'me-entities',
            'me-tiles', 'me-selected', 'me-props',
            'me-tile-grid', 'me-spawner-list', 'me-trigger-list', 'me-entity-list', 'me-entity-template', 'me-add-spawner', 'me-add-trigger',
            'me-prop-x', 'me-prop-y', 'me-status'
        ];
        for (var i = 0; i < ids.length; i++) {
            this._e[ids[i]] = document.getElementById(ids[i]);
        }
        
        this._bindControls();
        this._loadTilesetPalettes();
        this._populateEntityTemplates();
        
        console.log('[MapEditor] UI built');
    },
    
    _getStyles: function() {
        return [
            '@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");',
            '',
            '#rk-mapeditor {',
            '  position: fixed;',
            '  top: 60px; right: 10px;',
            '  width: 280px;',
            '  max-height: calc(100vh - 80px);',
            '  overflow-y: auto;',
            '  z-index: 10002;',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 8px;',
            '  background: repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
            '  border: 3px solid #1a0800;',
            '  box-shadow: inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);',
            '  border-radius: 4px;',
            '}',

            '.me-hdr {',
            '  display: flex; justify-content: space-between; align-items: center;',
            '  padding: 8px 10px;',
            '  background: linear-gradient(180deg,#3d3326 0%,#2a2218 50%,#17110c 100%);',
            '  border-bottom: 2px solid #1a1828;',
            '}',
            '',
            '.me-hdr {',
            '  display: flex; justify-content: space-between; align-items: center;',
            '  padding: 8px 10px;',
            '  background: linear-gradient(180deg, #3a2818 0%, #2a1808 100%);',
            '  border-bottom: 2px solid #4a3828;',
            '}',
            '.me-title { color: #e8d8b8; font-size: 10px; }',
            '.me-close {',
            '  background: #803030; border: 2px solid #a04040;',
            '  color: #ffd0d0; padding: 2px 8px; cursor: pointer;',
            '  font-size: 8px;',
            '}',
            '.me-close:hover { background: #a04040; }',
            '',
            '.me-section { padding: 8px; border-bottom: 1px solid #3a2818; }',
            '.me-section:last-child { border-bottom: none; }',
            '.me-sec-title {',
            '  color: #c8b888; font-size: 7px; margin-bottom: 6px;',
            '  text-transform: uppercase; letter-spacing: 1px;',
            '}',
            '',
            '.me-btn-row { display: flex; gap: 4px; flex-wrap: wrap; }',
            '.me-btn {',
            '  background: linear-gradient(180deg, #4a3828 0%, #3a2818 100%);',
            '  border: 2px solid #5a4838; border-bottom-color: #2a1808;',
            '  color: #d8c8a8; padding: 4px 8px; cursor: pointer;',
            '  font-size: 7px; font-family: inherit;',
            '  min-width: 50px;',
            '}',
            '.me-btn:hover { background: linear-gradient(180deg, #5a4838 0%, #4a3828 100%); }',
            '.me-btn:active { background: #2a1808; border-top-color: #2a1808; border-bottom-color: #5a4838; }',
            '.me-btn.active { background: #605030; border-color: #908050; color: #fff; }',
            '',
            '.me-layer-btns { display: flex; gap: 2px; }',
            '.me-layer-btn {',
            '  flex: 1; padding: 4px 2px; font-size: 6px;',
            '}',
            '',
            '.me-tile-grid {',
            '  display: grid;',
            '  grid-template-columns: repeat(8, 1fr);',
            '  gap: 2px;',
            '  max-height: 200px;',
            '  overflow-y: auto;',
            '  padding: 4px;',
            '  background: #1a0c04;',
            '  border: 2px inset #5a3818;',
            '}',
            '.me-tile {',
            '  width: 28px; height: 28px;',
            '  border: 2px solid #5a3818;',
            '  cursor: pointer;',
            '  image-rendering: pixelated;',
            '  background: #2a1408;',
            '}',
            '.me-tile:hover { border-color: #87663b; }',
            '.me-tile.selected { border-color: #c8a84b; box-shadow: 0 0 4px #c8a84b; }',
            '.me-tile.eraser {',
            '  display: flex; align-items: center; justify-content: center;',
            '  color: #8a7060; font-size: 12px;',
            '}',

            '.me-brush-row { display: flex; gap: 4px; align-items: center; }',
            '.me-brush-size {',
            '  width: 40px; padding: 2px 4px;',
            '  background: #2a1408; border: 2px inset #5a3818;',
            '  color: #c8b890; font-size: 8px; font-family: inherit;',
            '}',

            '.me-prop-grid {',
            '  display: grid;',
            '  grid-template-columns: 80px 1fr;',
            '  gap: 4px;',
            '}',
            '.me-prop-label { color: #6a5040; }',
            '.me-prop-input {',
            '  background: #2a1408; border: 2px inset #5a3818;',
            '  color: #c8b890; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',
            '.me-prop-input[type="number"] { width: 60px; }',
            '.me-prop-input[type="text"] { width: 100%; }',

            '.me-status {',
            '  padding: 4px 8px;',
            '  background: #1a0c04;',
            '  color: #8a7060;',
            '  font-size: 7px;',
            '}',
            '.me-status.active { color: #c8a84b; }',

            '.me-spawner-list, .me-trigger-list, .me-entity-list {',
            '  max-height: 120px;',
            '  overflow-y: auto;',
            '  background: #1a0c04;',
            '  border: 2px inset #3a2818;',
            '}',
            '.me-tile {',
            '  width: 28px; height: 28px;',
            '  border: 2px solid #3a2818;',
            '  cursor: pointer;',
            '  image-rendering: pixelated;',
            '  background: #2a2018;',
            '}',
            '.me-tile:hover { border-color: #708090; }',
            '.me-tile.selected { border-color: #f0f040; box-shadow: 0 0 4px #f0f040; }',
            '.me-tile.eraser {',
            '  display: flex; align-items: center; justify-content: center;',
            '  color: #888; font-size: 12px;',
            '}',
            '',
            '.me-brush-row { display: flex; gap: 4px; align-items: center; }',
            '.me-brush-size {',
            '  width: 40px; padding: 2px 4px;',
            '  background: #1a1408; border: 2px inset #3a2818;',
            '  color: #d8c8a8; font-size: 8px; font-family: inherit;',
            '}',
            '',
            '.me-prop-grid {',
            '  display: grid;',
            '  grid-template-columns: 80px 1fr;',
            '  gap: 4px;',
            '}',
            '.me-prop-label { color: #a89878; }',
            '.me-prop-input {',
            '  background: #2a2018; border: 2px inset #3a2818;',
            '  color: #d8c8a8; padding: 2px 4px; font-size: 7px; font-family: inherit;',
            '}',
            '.me-prop-input[type="number"] { width: 60px; }',
            '.me-prop-input[type="text"] { width: 100%; }',
            '',
            '.me-status {',
            '  padding: 4px 8px;',
            '  background: #1a1408;',
            '  color: #987858;',
            '  font-size: 7px;',
            '}',
            '.me-status.active { color: #c8b888; }',
            '',
            '.me-spawner-list, .me-trigger-list, .me-entity-list {',
            '  max-height: 120px;',
            '  overflow-y: auto;',
            '  background: #1a1408;',
            '  border: 2px inset #3a2818;',
            '}',
            '.me-list-item {',
            '  padding: 4px 6px;',
            '  border-bottom: 1px solid #2a2018;',
            '  cursor: pointer;',
            '  color: #a89878;',
            '}',
            '.me-list-item:hover { background: #3a2818; color: #c8b888; }',
            '.me-list-item.selected { background: #4a3828; color: #e8d8b8; }',
            '',
            '.me-hint {',
            '  position: fixed;',
            '  bottom: 60px; left: 50%; transform: translateX(-50%);',
            '  background: rgba(0,0,0,0.85);',
            '  color: #e8d8b8; padding: 4px 12px;',
            '  font-family: "Press Start 2P", monospace; font-size: 7px;',
            '  z-index: 10003; display: none;',
            '  border: 2px solid #4a3828;',
            '  pointer-events: none;',
            '}'
        ].join('\n');
    },
    
    _getHTML: function() {
        return [
            '<div class="me-hdr">',
            '  <span class="me-title">MAP EDITOR</span>',
            '  <button class="me-close" id="me-close">ESC</button>',
            '</div>',
            '',
            '<div class="me-section">',
            '  <div class="me-sec-title">Mode</div>',
            '  <div class="me-btn-row">',
            '    <button class="me-btn" id="me-mode">EDIT: OFF</button>',
            '    <button class="me-btn" id="me-grid">GRID: OFF</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="me-section" id="me-layer">',
            '  <div class="me-sec-title">Layer</div>',
            '  <div class="me-layer-btns">',
            '    <button class="me-btn me-layer-btn active" data-layer="terrain">Terrain</button>',
            '    <button class="me-btn me-layer-btn" data-layer="collision">Collisn</button>',
            '    <button class="me-btn me-layer-btn" data-layer="entities">Units</button>',
            '    <button class="me-btn me-layer-btn" data-layer="spawners">Spawn</button>',
            '    <button class="me-btn me-layer-btn" data-layer="triggers">Trigger</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="me-section">',
            '  <div class="me-sec-title">Brush</div>',
            '  <div class="me-brush-row">',
            '    <span class="me-prop-label">Size:</span>',
            '    <input type="number" class="me-brush-size" id="me-brush" value="1" min="1" max="5">',
            '    <button class="me-btn" id="me-eraser">ERASER</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="me-section">',
            '  <div class="me-sec-title">History</div>',
            '  <div class="me-btn-row">',
            '    <button class="me-btn" id="me-undo">UNDO</button>',
            '    <button class="me-btn" id="me-redo">REDO</button>',
            '    <button class="me-btn" id="me-clear">CLEAR</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="me-section" id="me-tileset">',
            '  <div class="me-sec-title">Tiles</div>',
            '  <div class="me-tile-grid" id="me-tile-grid">',
            '    <div class="me-tile eraser" data-tile="-1">X</div>',
            '  </div>',
            '</div>',
            '<div id="me-tiles" style="display:none;"></div>',
            '<div id="me-selected" style="display:none;"></div>',
            '',
            '<div class="me-section" id="me-collision" style="display:none">',
            '  <div class="me-sec-title">Collision</div>',
            '  <div class="me-tile-grid">',
            '    <div class="me-tile" data-collision="0" style="background:#4a4;">PASS</div>',
            '    <div class="me-tile" data-collision="1" style="background:#a44;">WALL</div>',
            '  </div>',
            '</div>',
            '',
            '<div class="me-section" id="me-entities" style="display:none">',
            '  <div class="me-sec-title">Units</div>',
            '  <div class="me-prop-grid">',
            '    <span class="me-prop-label">Template:</span><select class="me-prop-input" id="me-entity-template"></select>',
            '  </div>',
            '  <div class="me-spawner-list me-entity-list" id="me-entity-list"></div>',
            '</div>',
            '',
            '<div class="me-section" id="me-spawners" style="display:none">',
            '  <div class="me-sec-title">Spawners</div>',
            '  <div class="me-btn-row">',
            '    <button class="me-btn" id="me-add-spawner">+ ADD</button>',
            '  </div>',
            '  <div class="me-spawner-list" id="me-spawner-list"></div>',
            '</div>',
            '',
            '<div class="me-section" id="me-triggers" style="display:none">',
            '  <div class="me-sec-title">Triggers</div>',
            '  <div class="me-btn-row">',
            '    <button class="me-btn" id="me-add-trigger">+ ADD</button>',
            '  </div>',
            '  <div class="me-trigger-list" id="me-trigger-list"></div>',
            '</div>',
            '',
            '<div class="me-section" id="me-props" style="display:none">',
            '  <div class="me-sec-title">Properties</div>',
            '  <div class="me-prop-grid" id="me-prop-grid">',
            '    <span class="me-prop-label">X:</span><input type="number" class="me-prop-input" id="me-prop-x" value="0">',
            '    <span class="me-prop-label">Y:</span><input type="number" class="me-prop-input" id="me-prop-y" value="0">',
            '  </div>',
            '</div>',
            '',
            '<div class="me-section">',
            '  <div class="me-btn-row">',
            '    <button class="me-btn" id="me-save">SAVE</button>',
            '    <button class="me-btn" id="me-load">LOAD</button>',
            '  </div>',
            '</div>',
            '',
            '<div class="me-status" id="me-status">Press F5 to toggle edit mode</div>'
        ].join('\n');
    },
    
    _bindControls: function() {
        var self = this;
        
        if (this._e['me-close']) {
            this._e['me-close'].addEventListener('click', function() {
                self.hide();
            });
        }
        
        if (this._e['me-mode']) {
            this._e['me-mode'].addEventListener('click', function() {
                self.toggleEditMode();
            });
        }
        
        if (this._e['me-grid']) {
            this._e['me-grid'].addEventListener('click', function() {
                self.toggleGrid();
            });
        }
        
        if (this._e['me-brush']) {
            this._e['me-brush'].addEventListener('change', function() {
                self.brushSize = Math.max(1, Math.min(5, parseInt(this.value) || 1));
            });
        }
        
        if (this._e['me-eraser']) {
            this._e['me-eraser'].addEventListener('click', function() {
                self.eraserMode = !self.eraserMode;
                this.classList.toggle('active', self.eraserMode);
                self._updateStatus('Eraser: ' + (self.eraserMode ? 'ON' : 'OFF'));
            });
        }
        
        if (this._e['me-undo']) {
            this._e['me-undo'].addEventListener('click', function() {
                self.undo();
            });
        }
        
        if (this._e['me-redo']) {
            this._e['me-redo'].addEventListener('click', function() {
                self.redo();
            });
        }
        
        if (this._e['me-clear']) {
            this._e['me-clear'].addEventListener('click', function() {
                if (confirm('Clear all edits?')) {
                    self.clearAll();
                }
            });
        }
        
        if (this._e['me-save']) {
            this._e['me-save'].addEventListener('click', function() {
                self.saveWorld();
            });
        }
        
        if (this._e['me-load']) {
            this._e['me-load'].addEventListener('click', function() {
                self.loadWorld();
            });
        }
        
        var layerBtns = document.querySelectorAll('.me-layer-btn');
        for (var i = 0; i < layerBtns.length; i++) {
            layerBtns[i].addEventListener('click', function() {
                self.setLayer(this.getAttribute('data-layer'));
            });
        }
        
        if (this._e['me-add-spawner']) {
            this._e['me-add-spawner'].addEventListener('click', function() {
                self.addSpawner();
            });
        }
        
        if (this._e['me-add-trigger']) {
            this._e['me-add-trigger'].addEventListener('click', function() {
                self.addTrigger();
            });
        }

        if (this._e['me-entity-template']) {
            this._e['me-entity-template'].addEventListener('change', function() {
                self.selectedEntityTemplate = this.value || 'hero_knight';
                self._updateStatus('Unit template: ' + self.selectedEntityTemplate);
            });
        }
    },

    _populateEntityTemplates: function() {
        var select = this._e['me-entity-template'];
        if (!select || !RealmKit.UnitTemplates) return;
        var options = [];
        var keys = Object.keys(RealmKit.UnitTemplates);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var template = RealmKit.UnitTemplates[key];
            options.push('<option value="' + key + '">' + (template.name || key) + '</option>');
        }
        select.innerHTML = options.join('');
        select.value = this.selectedEntityTemplate;
    },
    
    _bindKeys: function() {
        var self = this;
        window.addEventListener('keydown', function(e) {
            if (e.key === 'F5') {
                e.preventDefault();
                self.toggle();
            }
            if (e.key === 'Escape' && self.visible) {
                self.hide();
            }
            if (self.editMode) {
                if (e.key === 'g') {
                    self.toggleGrid();
                }
                if (e.key === 'u' && e.ctrlKey) {
                    e.preventDefault();
                    self.undo();
                }
                if (e.key === 'y' && e.ctrlKey) {
                    e.preventDefault();
                    self.redo();
                }
            }
        });
    },
    
    _bindMouse: function() {
        var self = this;
        var canvas = document.getElementById('gameCanvas') || document.querySelector('canvas');
        if (!canvas) {
            console.warn('[MapEditor] Canvas not found for mouse binding');
            return;
        }
        
        canvas.addEventListener('mousedown', function(e) {
            if (!self.editMode) return;
            self._mouseDown = true;
            
            var coords = self._getWorldCoords(e);
            var clickedItem = self._findItemAt(coords.worldX, coords.worldY);
            
            if (clickedItem) {
                self._dragEntity = clickedItem;
                self._dragOffsetX = coords.worldX - clickedItem.x;
                self._dragOffsetY = coords.worldY - clickedItem.y;
                self._saveHistory();
            } else {
                self._handleCanvasClick(e);
            }
        });
        
        canvas.addEventListener('mousemove', function(e) {
            if (!self.editMode) return;
            
            if (self._dragEntity && self._mouseDown) {
                var coords = self._getWorldCoords(e);
                self._dragEntity.x = coords.worldX - self._dragOffsetX;
                self._dragEntity.y = coords.worldY - self._dragOffsetY;
                self._updateProps();
            } else if (self._mouseDown) {
                self._handleCanvasClick(e);
            }
        });
        
        canvas.addEventListener('mouseup', function(e) {
            if (self._dragEntity) {
                self._dragEntity = null;
            }
            self._mouseDown = false;
            self._lastTileX = -1;
            self._lastTileY = -1;
        });
        
        canvas.addEventListener('mouseleave', function(e) {
            if (self._dragEntity) {
                self._dragEntity = null;
            }
            self._mouseDown = false;
            self._lastTileX = -1;
            self._lastTileY = -1;
            self._triggerStartX = null;
            self._triggerStartY = null;
        });
    },
    
    _getWorldCoords: function(e) {
        var canvas = this.engine && this.engine.renderer && this.engine.renderer.canvas
            ? this.engine.renderer.canvas
            : e.target;
        var rect = canvas.getBoundingClientRect();
        var renderW = this.engine && this.engine.renderer
            ? (this.engine.renderer.displayWidth || canvas.width)
            : canvas.width;
        var renderH = this.engine && this.engine.renderer
            ? (this.engine.renderer.displayHeight || canvas.height)
            : canvas.height;
        var scaleX = rect.width ? (renderW / rect.width) : 1;
        var scaleY = rect.height ? (renderH / rect.height) : 1;
        var viewX = this.engine.renderer ? this.engine.renderer.viewport.x : 0;
        var viewY = this.engine.renderer ? this.engine.renderer.viewport.y : 0;
        
        return {
            worldX: (e.clientX - rect.left) * scaleX + viewX,
            worldY: (e.clientY - rect.top) * scaleY + viewY
        };
    },
    
    _findItemAt: function(worldX, worldY) {
        if (this.currentLayer === 'entities') {
            for (var e = this.entities.length - 1; e >= 0; e--) {
                var ent = this.entities[e];
                var hit = 12;
                if (worldX >= ent.x - hit && worldX <= ent.x + hit && worldY >= ent.y - hit && worldY <= ent.y + hit) {
                    this.selectEntity(e);
                    return ent;
                }
            }
        } else if (this.currentLayer === 'spawners') {
            for (var i = this.spawners.length - 1; i >= 0; i--) {
                var sp = this.spawners[i];
                var radius = sp.radius || 80;
                var dx = worldX - sp.x;
                var dy = worldY - sp.y;
                if (dx * dx + dy * dy <= radius * radius) {
                    this.selectSpawner(i);
                    return sp;
                }
            }
        } else if (this.currentLayer === 'triggers') {
            for (var j = this.triggers.length - 1; j >= 0; j--) {
                var tr = this.triggers[j];
                var tx = tr.x;
                var ty = tr.y;
                var tw = tr.width || 100;
                var th = tr.height || 100;
                if (worldX >= tx && worldX <= tx + tw && worldY >= ty && worldY <= ty + th) {
                    this.selectTrigger(j);
                    return tr;
                }
            }
        }
        return null;
    },
    
    _updateProps: function() {
        var el = this._e['me-props'];
        if (!el) return;
        
        if (this.selectedSpawner !== null && this.spawners[this.selectedSpawner]) {
            var sp = this.spawners[this.selectedSpawner];
            if (this._e['me-prop-x']) this._e['me-prop-x'].value = Math.floor(sp.x);
            if (this._e['me-prop-y']) this._e['me-prop-y'].value = Math.floor(sp.y);
        } else if (this.selectedTrigger !== null && this.triggers[this.selectedTrigger]) {
            var tr = this.triggers[this.selectedTrigger];
            if (this._e['me-prop-x']) this._e['me-prop-x'].value = Math.floor(tr.x);
            if (this._e['me-prop-y']) this._e['me-prop-y'].value = Math.floor(tr.y);
        } else if (this.selectedEntity !== null && this.entities[this.selectedEntity]) {
            var ent = this.entities[this.selectedEntity];
            if (this._e['me-prop-x']) this._e['me-prop-x'].value = Math.floor(ent.x);
            if (this._e['me-prop-y']) this._e['me-prop-y'].value = Math.floor(ent.y);
        }
    },
    
    _handleCanvasClick: function(e) {
        var canvas = this.engine && this.engine.renderer && this.engine.renderer.canvas
            ? this.engine.renderer.canvas
            : e.target;
        var rect = canvas.getBoundingClientRect();
        var renderW = this.engine && this.engine.renderer
            ? (this.engine.renderer.displayWidth || canvas.width)
            : canvas.width;
        var renderH = this.engine && this.engine.renderer
            ? (this.engine.renderer.displayHeight || canvas.height)
            : canvas.height;
        var scaleX = rect.width ? (renderW / rect.width) : 1;
        var scaleY = rect.height ? (renderH / rect.height) : 1;
        
        var viewX = this.engine.renderer ? this.engine.renderer.viewport.x : 0;
        var viewY = this.engine.renderer ? this.engine.renderer.viewport.y : 0;
        
        var mouseX = (e.clientX - rect.left) * scaleX + viewX;
        var mouseY = (e.clientY - rect.top) * scaleY + viewY;
        
        var tileX = Math.floor(mouseX / this.gridSize);
        var tileY = Math.floor(mouseY / this.gridSize);

        if (this.currentLayer === 'terrain') {
            if (tileX === this._lastTileX && tileY === this._lastTileY) return;
            this._lastTileX = tileX;
            this._lastTileY = tileY;
            this.paintTile(tileX, tileY);
        } else if (this.currentLayer === 'collision') {
            if (tileX === this._lastTileX && tileY === this._lastTileY) return;
            this._lastTileX = tileX;
            this._lastTileY = tileY;
            this.paintCollision(tileX, tileY);
        } else if (this.currentLayer === 'entities' && e.type === 'mousedown') {
            this.placeEntity(mouseX, mouseY);
        } else if (this.currentLayer === 'spawners' && e.type === 'mousedown') {
            this.placeSpawner(mouseX, mouseY);
        } else if (this.currentLayer === 'triggers' && e.type === 'mousedown') {
            this.placeTriggerCorner(mouseX, mouseY);
        }
    },
    
    _loadTilesetPalettes: function() {
        var grid = this._e['me-tile-grid'];
        if (!grid) return;
        var self = this;
        
        while (grid.children.length > 1) {
            grid.removeChild(grid.lastChild);
        }
        
        for (var i = 0; i < 128; i++) {
            var tile = document.createElement('div');
            tile.className = 'me-tile';
            var meta = this.TILE_META[i] || { name: 'Tile ' + i, color: '#6a5846', abbr: String(i) };
            tile.setAttribute('data-tile', i);
            tile.style.background = meta.color;
            tile.style.display = 'flex';
            tile.style.alignItems = 'flex-end';
            tile.style.justifyContent = 'flex-start';
            tile.style.padding = '2px';
            tile.style.color = '#1a0800';
            tile.style.fontSize = '5px';
            tile.style.textShadow = '0 1px 0 rgba(255,255,255,0.35)';
            tile.textContent = meta.abbr;
            tile.title = meta.name + ' (' + i + ')';
            tile.addEventListener('click', function() {
                self.selectTile(parseInt(this.getAttribute('data-tile')));
            });
            grid.appendChild(tile);
        }

        var eraser = grid.querySelector('.me-tile.eraser');
        if (eraser) {
            eraser.addEventListener('click', function() {
                self.selectTile(-1);
            });
        }
        
        this.selectTile(this.defaultTerrainTileId);
    },
    
    selectTile: function(tileId) {
        this.currentTileId = tileId;
        this.eraserMode = tileId < 0;
        
        var tiles = document.querySelectorAll('.me-tile');
        for (var i = 0; i < tiles.length; i++) {
            tiles[i].classList.remove('selected');
            if (parseInt(tiles[i].getAttribute('data-tile')) === tileId) {
                tiles[i].classList.add('selected');
            }
        }
        
        this._updateStatus('Tile: ' + (tileId < 0 ? 'Eraser' : tileId));
    },
    
    setLayer: function(layer) {
        this.currentLayer = layer;
        
        var layerBtns = document.querySelectorAll('.me-layer-btn');
        for (var i = 0; i < layerBtns.length; i++) {
            layerBtns[i].classList.toggle('active', layerBtns[i].getAttribute('data-layer') === layer);
        }
        
        var sections = ['me-tileset', 'me-collision', 'me-entities', 'me-spawners', 'me-triggers'];
        for (var j = 0; j < sections.length; j++) {
            var el = document.getElementById(sections[j]);
            if (el) {
                el.style.display = (sections[j] === 'me-' + layer || 
                    (sections[j] === 'me-tileset' && layer === 'terrain') ||
                    (sections[j] === 'me-tileset' && layer === 'collision')) ? 'block' : 'none';
            }
        }
        
        this._updateStatus('Layer: ' + layer);
        console.log('[MapEditor] Layer:', layer);
    },
    
    toggle: function() {
        this.visible = !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
        
        var hint = document.getElementById('me-hint');
        if (this.visible && !hint) {
            hint = document.createElement('div');
            hint.id = 'me-hint';
            hint.className = 'me-hint';
            hint.textContent = 'EDIT MODE - Click to paint, G = Grid';
            document.body.appendChild(hint);
        }
        
        if (hint) {
            hint.style.display = this.visible ? 'block' : 'none';
        }
        
        console.log('[MapEditor] ' + (this.visible ? 'Shown' : 'Hidden'));
    },
    
    show: function() {
        if (!this.visible) this.toggle();
    },
    
    hide: function() {
        if (this.visible) this.toggle();
    },
    
    toggleEditMode: function() {
        this.editMode = !this.editMode;
        this._e['me-mode'].textContent = 'EDIT: ' + (this.editMode ? 'ON' : 'OFF');
        this._e['me-mode'].classList.toggle('active', this.editMode);
        this._updateStatus(this.editMode ? 'Edit mode ON - Click to paint' : 'Edit mode OFF');
        
        if (this.engine.debug) {
            this.engine.debug.showGrid = this.editMode && this.gridVisible;
        }
        
        console.log('[MapEditor] Edit mode:', this.editMode);
    },
    
    toggleGrid: function() {
        this.gridVisible = !this.gridVisible;
        this._e['me-grid'].textContent = 'GRID: ' + (this.gridVisible ? 'ON' : 'OFF');
        this._e['me-grid'].classList.toggle('active', this.gridVisible);
        
        if (this.engine && this.engine.devPanel) {
            this.engine.devPanel.toggleGrid && this.engine.devPanel.toggleGrid();
        }
        
        console.log('[MapEditor] Grid:', this.gridVisible);
    },
    
    paintTile: function(tileX, tileY) {
        var tileMap = this.engine.tileMap;
        if (!tileMap) return;
        
        this._saveHistory();
        
        var tileId = this.eraserMode ? this.defaultTerrainTileId : this.currentTileId;
        
        for (var dy = 0; dy < this.brushSize; dy++) {
            for (var dx = 0; dx < this.brushSize; dx++) {
                var tx = tileX + dx;
                var ty = tileY + dy;
                
                if (tx < 0 || tx >= tileMap.width || ty < 0 || ty >= tileMap.height) continue;
                
                var index = ty * tileMap.width + tx;
                
                if (tileMap.layers && tileMap.layers[0]) {
                    tileMap.layers[0].data[index] = tileId;
                }
            }
        }
        
        tileMap.mapReady = false;
        tileMap.buildMapCanvas();
        
        this._updateStatus('Painted tile ' + tileId + ' at ' + tileX + ',' + tileY);
    },
    
    paintCollision: function(tileX, tileY) {
        var tileMap = this.engine.tileMap;
        if (!tileMap) return;
        
        this._saveHistory();
        
        var collisionValue = this.eraserMode ? 0 : 1;
        
        if (!tileMap.collisionData) {
            tileMap.collisionData = new Array(tileMap.width * tileMap.height).fill(0);
        }
        
        for (var dy = 0; dy < this.brushSize; dy++) {
            for (var dx = 0; dx < this.brushSize; dx++) {
                var tx = tileX + dx;
                var ty = tileY + dy;
                
                if (tx < 0 || tx >= tileMap.width || ty < 0 || ty >= tileMap.height) continue;
                
                var index = ty * tileMap.width + tx;
                tileMap.collisionData[index] = collisionValue;
            }
        }
        
        this._updateStatus('Collision ' + (collisionValue ? 'wall' : 'pass') + ' at ' + tileX + ',' + tileY);
    },
    
    addSpawner: function() {
        this._saveHistory();
        var anchor = this._defaultAnchor();
        
        var templates = ['goblin_scout', 'skeleton', 'wolf', 'orc_grunt'];
        var templateId = templates[Math.floor(Math.random() * templates.length)];
        
        var spawnerData = {
            id: 'spawner_' + Date.now(),
            x: anchor.x + (Math.random() - 0.5) * 200,
            y: anchor.y + (Math.random() - 0.5) * 200,
            radius: 80,
            spawnPool: [{ templateId: templateId, weight: 1 }],
            maxActive: 3,
            minActive: 1,
            respawnDelay: 30000
        };
        
        this.spawners.push(spawnerData);
        
        if (this.engine.spawnerManager) {
            var mgr = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
            if (!this.engine.spawnerManager.templateManager) {
                this.engine.spawnerManager.templateManager = mgr;
            }
            this.engine.spawnerManager.createSpawner(spawnerData);
        }
        
        this._updateSpawnerList();
        this._updateStatus('Added spawner: ' + spawnerData.id);
        console.log('[MapEditor] Added spawner:', spawnerData);
    },
    
    _updateSpawnerList: function() {
        var list = this._e['me-spawner-list'];
        if (!list) return;
        
        list.innerHTML = '';
        
        for (var i = 0; i < this.spawners.length; i++) {
            var sp = this.spawners[i];
            var item = document.createElement('div');
            item.className = 'me-list-item';
            if (this.selectedSpawner === i) item.classList.add('selected');
            item.textContent = sp.id.substring(0, 20);
            item.setAttribute('data-index', i);
            item.addEventListener('click', (function(idx) {
                return function() {
                    self.selectSpawner(idx);
                };
            })(i));
            list.appendChild(item);
        }
        
        var self = this;
    },
    
    selectSpawner: function(index) {
        this.selectedSpawner = index;
        this.selectedEntity = null;
        this.selectedTrigger = null;
        
        var sp = this.spawners[index];
        if (sp) {
            this._e['me-prop-x'].value = Math.floor(sp.x);
            this._e['me-prop-y'].value = Math.floor(sp.y);
            this._e['me-props'].style.display = 'block';
        }
        
        this._updateSpawnerList();
        this._updateStatus('Selected spawner: ' + index);
    },
    
    addTrigger: function() {
        this._saveHistory();
        var anchor = this._defaultAnchor();
        
        var triggerData = {
            id: 'trigger_' + Date.now(),
            name: 'New Trigger',
            type: 'on_enter',
            shape: 'rect',
            x: anchor.x - 50,
            y: anchor.y - 50,
            width: 100,
            height: 100,
            actions: [{ type: 'message', text: 'Trigger activated!' }]
        };
        
        this.triggers.push(triggerData);
        
        if (this.engine.triggerSystem) {
            this.engine.triggerSystem.createTrigger(triggerData);
        }
        
        this._updateTriggerList();
        this._updateStatus('Added trigger: ' + triggerData.id);
        console.log('[MapEditor] Added trigger:', triggerData);
    },
    
    _updateTriggerList: function() {
        var list = this._e['me-trigger-list'];
        if (!list) return;
        
        list.innerHTML = '';
        
        for (var i = 0; i < this.triggers.length; i++) {
            var tr = this.triggers[i];
            var item = document.createElement('div');
            item.className = 'me-list-item';
            if (this.selectedTrigger === i) item.classList.add('selected');
            item.textContent = (tr.name || tr.id).substring(0, 20);
            item.setAttribute('data-index', i);
            item.addEventListener('click', (function(idx) {
                return function() {
                    self.selectTrigger(idx);
                };
            })(i));
            list.appendChild(item);
        }
        
        var self = this;
    },
    
    selectTrigger: function(index) {
        this.selectedTrigger = index;
        this.selectedEntity = null;
        this.selectedSpawner = null;
        
        var tr = this.triggers[index];
        if (tr) {
            this._e['me-prop-x'].value = Math.floor(tr.x);
            this._e['me-prop-y'].value = Math.floor(tr.y);
            this._e['me-props'].style.display = 'block';
        }
        
        this._updateTriggerList();
        this._updateStatus('Selected trigger: ' + index);
    },

    _defaultAnchor: function() {
        if (this.engine.player) {
            return { x: this.engine.player.x, y: this.engine.player.y };
        }
        var viewport = this.engine && this.engine.renderer ? this.engine.renderer.viewport : { x: 0, y: 0, viewWidth: 800, viewHeight: 600 };
        return {
            x: viewport.x + viewport.viewWidth / 2,
            y: viewport.y + viewport.viewHeight / 2
        };
    },

    placeEntity: function(worldX, worldY) {
        this._saveHistory();
        var template = RealmKit.UnitTemplates ? RealmKit.UnitTemplates[this.selectedEntityTemplate] : null;
        var snappedX = Math.floor(worldX / this.gridSize) * this.gridSize + this.gridSize / 2;
        var snappedY = Math.floor(worldY / this.gridSize) * this.gridSize + this.gridSize / 2;
        this.entities.push({
            id: 'unit_' + Date.now(),
            templateId: this.selectedEntityTemplate,
            name: template ? template.name : this.selectedEntityTemplate,
            x: snappedX,
            y: snappedY
        });
        this.selectedEntity = this.entities.length - 1;
        this.selectedSpawner = null;
        this.selectedTrigger = null;
        this._updateEntityList();
        this._updateProps();
        this._updateStatus('Placed unit: ' + (template ? template.name : this.selectedEntityTemplate) + ' @ ' + Math.floor(snappedX) + ',' + Math.floor(snappedY));
    },

    _updateEntityList: function() {
        var list = this._e['me-entity-list'];
        if (!list) return;

        list.innerHTML = '';
        var self = this;
        for (var i = 0; i < this.entities.length; i++) {
            var ent = this.entities[i];
            var item = document.createElement('div');
            item.className = 'me-list-item';
            if (this.selectedEntity === i) item.classList.add('selected');
            item.textContent = (ent.name || ent.templateId || ent.id).substring(0, 20);
            item.addEventListener('click', (function(idx) {
                return function() {
                    self.selectEntity(idx);
                };
            })(i));
            list.appendChild(item);
        }
    },

    selectEntity: function(index) {
        this.selectedEntity = index;
        this.selectedSpawner = null;
        this.selectedTrigger = null;
        if (this._e['me-props']) this._e['me-props'].style.display = 'block';
        this._updateEntityList();
        this._updateProps();
        this._updateStatus('Selected unit: ' + (this.entities[index] && this.entities[index].name ? this.entities[index].name : index));
    },
    
    placeSpawner: function(worldX, worldY) {
        this._saveHistory();
        
        var templates = ['goblin_scout', 'skeleton', 'wolf', 'orc_grunt'];
        var templateId = templates[Math.floor(Math.random() * templates.length)];
        
        var spawnerData = {
            id: 'spawner_' + Date.now(),
            x: worldX,
            y: worldY,
            radius: 80,
            spawnPool: [{ templateId: templateId, weight: 1 }],
            maxActive: 3,
            minActive: 1,
            respawnDelay: 30000,
            conditions: {}
        };
        
        this.spawners.push(spawnerData);
        
        if (this.engine.spawnerManager) {
            this.engine.spawnerManager.createSpawner(spawnerData);
        }
        
        this._updateSpawnerList();
        this._updateStatus('Spawner placed at ' + Math.floor(worldX) + ',' + Math.floor(worldY));
        console.log('[MapEditor] Spawner placed:', spawnerData);
    },
    
    placeTriggerCorner: function(worldX, worldY) {
        if (this._triggerStartX === null || this._triggerStartX === undefined) {
            this._triggerStartX = worldX;
            this._triggerStartY = worldY;
            this._updateStatus('Click opposite corner to define trigger area');
            console.log('[MapEditor] Trigger start corner:', worldX, worldY);
        } else {
            this._saveHistory();
            
            var minX = Math.min(this._triggerStartX, worldX);
            var minY = Math.min(this._triggerStartY, worldY);
            var width = Math.abs(worldX - this._triggerStartX);
            var height = Math.abs(worldY - this._triggerStartY);
            
            width = Math.max(width, 32);
            height = Math.max(height, 32);
            
            var triggerData = {
                id: 'trigger_' + Date.now(),
                name: 'Trigger ' + (this.triggers.length + 1),
                type: 'on_enter',
                shape: 'rect',
                x: minX,
                y: minY,
                width: width,
                height: height,
                actions: [{ type: 'message', text: 'Trigger activated!' }],
                conditions: {},
                oneTime: false,
                active: true
            };
            
            this.triggers.push(triggerData);
            
            if (this.engine.triggerSystem) {
                this.engine.triggerSystem.createTrigger(triggerData);
            }
            
            this._triggerStartX = null;
            this._triggerStartY = null;
            
            this._updateTriggerList();
            this._updateStatus('Trigger created: ' + Math.floor(width) + 'x' + Math.floor(height));
            console.log('[MapEditor] Trigger created:', triggerData);
        }
    },
    
    _saveHistory: function() {
        var tileMap = this.engine.tileMap;
        if (!tileMap) return;
        
        var state = {
            tiles: tileMap.layers[0] ? tileMap.layers[0].data.slice() : [],
            collision: tileMap.collisionData ? tileMap.collisionData.slice() : [],
            spawners: JSON.parse(JSON.stringify(this.spawners)),
            triggers: JSON.parse(JSON.stringify(this.triggers)),
            entities: JSON.parse(JSON.stringify(this.entities))
        };
        
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
    },
    
    undo: function() {
        if (this.historyIndex <= 0) {
            this._updateStatus('Nothing to undo');
            return;
        }
        
        this.historyIndex--;
        this._restoreState(this.history[this.historyIndex]);
        this._updateStatus('Undo (' + (this.historyIndex + 1) + '/' + this.history.length + ')');
    },
    
    redo: function() {
        if (this.historyIndex >= this.history.length - 1) {
            this._updateStatus('Nothing to redo');
            return;
        }
        
        this.historyIndex++;
        this._restoreState(this.history[this.historyIndex]);
        this._updateStatus('Redo (' + (this.historyIndex + 1) + '/' + this.history.length + ')');
    },
    
    _restoreState: function(state) {
        var tileMap = this.engine.tileMap;
        if (!tileMap) return;
        
        if (tileMap.layers[0]) {
            for (var i = 0; i < state.tiles.length; i++) {
                tileMap.layers[0].data[i] = state.tiles[i];
            }
        }
        
        tileMap.collisionData = state.collision.slice();
        this.spawners = JSON.parse(JSON.stringify(state.spawners));
        this.triggers = JSON.parse(JSON.stringify(state.triggers));
        this.entities = JSON.parse(JSON.stringify(state.entities || []));
        
        tileMap.mapReady = false;
        tileMap.buildMapCanvas();
        
        this._updateSpawnerList();
        this._updateTriggerList();
        this._updateEntityList();
    },
    
    clearAll: function() {
        var tileMap = this.engine.tileMap;
        if (!tileMap) return;
        
        this._saveHistory();
        
        if (tileMap.layers[0]) {
            for (var i = 0; i < tileMap.layers[0].data.length; i++) {
                tileMap.layers[0].data[i] = this.defaultTerrainTileId;
            }
        }
        
        if (tileMap.collisionData) {
            for (var j = 0; j < tileMap.collisionData.length; j++) {
                tileMap.collisionData[j] = 0;
            }
        }
        
        this.spawners = [];
        this.triggers = [];
        this.entities = [];
        
        tileMap.mapReady = false;
        tileMap.buildMapCanvas();
        
        this._updateSpawnerList();
        this._updateTriggerList();
        this._updateEntityList();
        this._updateStatus('Cleared all');
    },
    
    saveWorld: function() {
        var tileMap = this.engine.tileMap;
        if (!tileMap) return;

        var worldData = {
            version: 1,
            width: tileMap.width,
            height: tileMap.height,
            tiles: tileMap.layers[0] ? tileMap.layers[0].data : [],
            collision: tileMap.collisionData || [],
            spawners: this.spawners,
            triggers: this.triggers,
            entities: this.entities,
            timestamp: Date.now()
        };

        if (this.engine && this.engine.isStudioMode && this.engine.storyDatabase && this.engine.currentStudioMapId) {
            var self = this;
            this.engine.storyDatabase.saveMapStudio(this.engine.currentStudioMapId, {
                state: {
                    terrain: worldData.tiles,
                    collision: worldData.collision,
                    weather_override: this.engine.weatherSystem ? this.engine.weatherSystem.currentWeather : null,
                    weather_intensity: this.engine.weatherSystem ? (this.engine.weatherSystem.targetIntensity || this.engine.weatherSystem.intensity || 0) : 0,
                    meta: {
                        saved_from: 'map-editor',
                        version: worldData.version,
                        timestamp: worldData.timestamp
                    }
                },
                spawners: worldData.spawners,
                triggers: worldData.triggers,
                units: worldData.entities
            }).then(function() {
                self._updateStatus('Map saved to database');
                console.log('[MapEditor] Map saved to database');
                try {
                    var parentShell = window.parent && window.parent.RealmKit && window.parent.RealmKit._realmStudioShell;
                    if (parentShell && typeof parentShell._reloadStudioData === 'function') {
                        parentShell._reloadStudioData(parentShell.activeNodeId);
                    }
                } catch (e) {
                    console.warn('[MapEditor] Failed to notify studio shell after save:', e);
                }
            }).catch(function(err) {
                console.error('[MapEditor] Failed to save map to database:', err);
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
        console.log('[MapEditor] World saved');
    },
    
    loadWorld: function() {
        var self = this;
        if (this.engine && this.engine.isStudioMode && this.engine.storyDatabase && this.engine.currentStudioMapId) {
            this.engine.storyDatabase.getMapStudio(this.engine.currentStudioMapId).then(function(bundle) {
                self._applyWorldData({
                    width: bundle.map && bundle.map.width,
                    height: bundle.map && bundle.map.height,
                    tiles: bundle.state ? bundle.state.terrain_json : [],
                    collision: bundle.state ? bundle.state.collision_json : [],
                    spawners: bundle.spawners || [],
                    triggers: bundle.triggers || [],
                    entities: bundle.units || []
                });
                self._updateStatus('Map loaded from database');
                console.log('[MapEditor] Map loaded from database');
            }).catch(function(err) {
                console.error('[MapEditor] Failed to load map from database:', err);
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
                    console.log('[MapEditor] World loaded from file');
                } catch (err) {
                    console.error('[MapEditor] Failed to load world:', err);
                    self._updateStatus('Load failed: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    },
    
    _applyWorldData: function(data) {
        var tileMap = this.engine.tileMap;
        if (!tileMap) return;
        
        this._saveHistory();
        
        if (tileMap.layers[0] && data.tiles) {
            var len = Math.min(data.tiles.length, tileMap.layers[0].data.length);
            for (var i = 0; i < len; i++) {
                tileMap.layers[0].data[i] = data.tiles[i];
            }
        }
        
        if (data.collision) {
            tileMap.collisionData = data.collision.slice();
        }
        
        this.spawners = data.spawners || [];
        this.triggers = data.triggers || [];
        this.entities = data.entities || [];
        
        tileMap.mapReady = false;
        tileMap.buildMapCanvas();
        
        this._updateSpawnerList();
        this._updateTriggerList();
        this._updateEntityList();
    },
    
    _updateStatus: function(msg) {
        var status = this._e['me-status'];
        if (status) {
            status.textContent = msg;
            status.classList.add('active');
        }
    },
    
    renderOverlay: function(ctx, viewport) {
        if (!this.editMode) return;
        
        if (this.gridVisible) {
            this._renderGrid(ctx, viewport);
        }
        
        this._renderSpawners(ctx, viewport);
        this._renderTriggers(ctx, viewport);
        this._renderEntities(ctx, viewport);

        if (this.selectedSpawner !== null || this.selectedTrigger !== null || this.selectedEntity !== null) {
            this._renderSelection(ctx, viewport);
        }
    },
    
    _renderGrid: function(ctx, viewport) {
        ctx.save();
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 0.5;
        
        var startX = Math.floor(viewport.x / this.gridSize) * this.gridSize;
        var startY = Math.floor(viewport.y / this.gridSize) * this.gridSize;
        var endX = viewport.x + viewport.viewWidth;
        var endY = viewport.y + viewport.viewHeight;
        
        for (var x = startX; x < endX; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, viewport.y);
            ctx.lineTo(x, viewport.y + viewport.viewHeight);
            ctx.stroke();
        }
        
        for (var y = startY; y < endY; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(viewport.x, y);
            ctx.lineTo(viewport.x + viewport.viewWidth, y);
            ctx.stroke();
        }
        
        ctx.restore();
    },
    
    _renderSpawners: function(ctx, viewport) {
        if (this.currentLayer !== 'spawners' && this.currentLayer !== 'terrain') return;
        
        ctx.save();
        
        for (var i = 0; i < this.spawners.length; i++) {
            var sp = this.spawners[i];
            var sx = sp.x - viewport.x;
            var sy = sp.y - viewport.y;
            
            ctx.strokeStyle = i === this.selectedSpawner ? '#ffff00' : '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, sp.radius || 50, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px monospace';
            ctx.fillText((sp.spawnPool && sp.spawnPool[0] && sp.spawnPool[0].templateId) || 'spawner', sx - 20, sy - 10);
        }
        
        ctx.restore();
    },
    
    _renderTriggers: function(ctx, viewport) {
        if (this.currentLayer !== 'triggers' && this.currentLayer !== 'terrain') return;
        
        ctx.save();
        
        for (var i = 0; i < this.triggers.length; i++) {
            var tr = this.triggers[i];
            var tx = tr.x - viewport.x;
            var ty = tr.y - viewport.y;
            
            ctx.strokeStyle = i === this.selectedTrigger ? '#ffff00' : '#ff00ff';
            ctx.lineWidth = 2;
            
            if (tr.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(tx + tr.radius / 2, ty + tr.radius / 2, tr.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeRect(tx, ty, tr.width || 100, tr.height || 100);
            }
            
            ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
            if (tr.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(tx + tr.radius / 2, ty + tr.radius / 2, tr.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(tx, ty, tr.width || 100, tr.height || 100);
            }
            
            ctx.fillStyle = '#ff00ff';
            ctx.font = '8px monospace';
            ctx.fillText(tr.name || tr.id, tx + 2, ty + 10);
        }
        
        ctx.restore();
    },

    _renderEntities: function(ctx, viewport) {
        if (this.currentLayer !== 'entities') return;

        ctx.save();
        for (var i = 0; i < this.entities.length; i++) {
            var ent = this.entities[i];
            var ex = ent.x - viewport.x;
            var ey = ent.y - viewport.y;

            ctx.strokeStyle = 'rgba(26, 8, 0, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ex - 10, ey);
            ctx.lineTo(ex + 10, ey);
            ctx.moveTo(ex, ey - 10);
            ctx.lineTo(ex, ey + 10);
            ctx.stroke();

            ctx.fillStyle = i === this.selectedEntity ? '#f0d060' : '#4ecdc4';
            ctx.fillRect(ex - 7, ey - 7, 14, 14);
            ctx.strokeStyle = '#1a0800';
            ctx.lineWidth = 2;
            ctx.strokeRect(ex - 7, ey - 7, 14, 14);

            ctx.fillStyle = '#ffffff';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText((ent.name || ent.templateId || 'unit'), ex, ey + 20);
        }
        ctx.restore();
    },
    
    _renderSelection: function(ctx, viewport) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        if (this.selectedSpawner !== null) {
            var sp = this.spawners[this.selectedSpawner];
            if (sp) {
                ctx.strokeRect(sp.x - viewport.x - 5, sp.y - viewport.y - 5, 10, 10);
            }
        } else if (this.selectedTrigger !== null) {
            var tr = this.triggers[this.selectedTrigger];
            if (tr) {
                if (tr.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(tr.x - viewport.x + tr.radius / 2, tr.y - viewport.y + tr.radius / 2, tr.radius + 5, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    ctx.strokeRect(tr.x - viewport.x - 5, tr.y - viewport.y - 5, (tr.width || 100) + 10, (tr.height || 100) + 10);
                }
            }
        } else if (this.selectedEntity !== null) {
            var ent = this.entities[this.selectedEntity];
            if (ent) {
                ctx.strokeRect(ent.x - viewport.x - 12, ent.y - viewport.y - 12, 24, 24);
            }
        }
        
        ctx.restore();
    }
};

console.log('[MapEditor] Module loaded');
