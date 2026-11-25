var RealmKit = RealmKit || {};

/**
 * DevPanel — floating developer HUD.
 * Toggle with backtick (`) or F2.
 * Shows live world stats, player info, cursor tile details, and
 * controls for minimap opacity and terrain regeneration.
 */
RealmKit.DevPanel = function DevPanel(engine) {
    this.engine = engine;
    this.visible = false;
    this.el = null;
    this._e = {};          // cached element refs
    this._dragging = false;
    this._dragOffX = 0;
    this._dragOffY = 0;
    this._fpsBuffer = [];
    this._lastFpsTime = performance.now();
    this._fpsDisplay = 0;

    this._build();
    this._bindKeys();
    this._bindDrag();
};

// ─── Tile name lookup ──────────────────────────────────────────────────────
RealmKit.DevPanel.TILE_NAMES = {
    0: 'Deep Water',    1: 'Shallow Water', 2: 'Beach',
    3: 'Grass',         4: 'Grass 2',       5: 'Dirt',
    6: 'Stone',         7: 'Cliff',         8: 'Mountain',
    9: 'Snow',         10: 'Road H',       11: 'Road V',
    12: 'Road Corner', 13: 'Bridge H',     14: 'Bridge V',
    15: 'Waterfall',   16: 'Ruin Floor',   17: 'Ruin Wall',
    18: 'Bldg Floor',  19: 'Bldg Wall',    20: 'Door',
    21: 'Tree',        22: 'Bush',         23: 'Rock',
    24: 'Chest',       25: 'Forest',       26: 'Swamp',
    27: 'Desert',      28: 'Tundra',       29: 'Wetland',
    30: 'Meadow',      31: 'Ancient'
};

RealmKit.DevPanel.prototype = {

    // ─── Build DOM ────────────────────────────────────────────────────────
    _build: function() {
        var self = this;
        
        // Inject styles only once
        if (!document.getElementById('rk-dev-styles')) {
            var style = document.createElement('style');
            style.id = 'rk-dev-styles';
            style.textContent = [
                '#rk-dev{position:fixed;top:10px;right:10px;width:248px;',
                'background:repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),',
                'linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
                'border:3px solid #1a0800;color:#c8b890;font:7px/1.5 "Press Start 2P",monospace;',
                'z-index:9999;display:none;flex-direction:column;user-select:none;',
                'box-shadow:inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);}',

            '#rk-dev-hdr{background:linear-gradient(180deg,#3d3326 0%,#2a2218 50%,#17110c 100%);',
            'padding:6px 8px;cursor:move;display:flex;',
            'align-items:center;justify-content:space-between;border-bottom:2px solid #1a1828;}',
            '#rk-dev-hdr span{color:#f6e2ae;font-weight:bold;font-size:8px;letter-spacing:1px;}',
            '#rk-dev-hdr small{color:#8a7060;font-size:6px;}',
            '#rk-fullscreen{background:transparent;border:none;color:#8a7060;font-size:10px;',
            'cursor:pointer;padding:2px 6px;transition:color 0.2s;}',
            '#rk-fullscreen:hover{color:#f6e2ae;}',
            '#rk-fullscreen.active{color:#4ecca3;}',

            '.rk-sec{padding:6px 8px;border-bottom:1px solid rgba(90,56,24,.45);}',
            '.rk-sec-title{color:#87663b;font-size:7px;font-weight:bold;letter-spacing:1px;',
            'text-transform:uppercase;margin-bottom:4px;}',
            '.rk-row{display:flex;justify-content:space-between;line-height:1.7;color:#b8a080;}',
            '.rk-row b{color:#f6e2ae;}',
            '.rk-lbl{color:#8a7060;font-size:6px;}',

            '.rk-bar-wrap{background:#1a0c04;border:1px solid #5a3818;height:7px;',
            'border-radius:2px;overflow:hidden;margin:2px 0 4px;}',
            '.rk-bar{height:100%;transition:width .15s;}',
            '.rk-bar-hp{background:linear-gradient(90deg,#a04030,#c06030 55%,#6a8a30);}',
            '.rk-bar-mp{background:linear-gradient(90deg,#3050a0,#4080c0);}',
            '.rk-bar-sta{background:linear-gradient(90deg,#907030,#c8a840);}',

            '.rk-slider-row{display:flex;align-items:center;gap:5px;margin:3px 0;}',
            '.rk-slider-row label{width:95px;color:#8a7060;font-size:6px;flex-shrink:0;}',
            '.rk-slider-row input[type=range]{flex:1;accent-color:#87663b;height:14px;}',
            '.rk-slider-row span{width:34px;text-align:right;color:#c8b890;font-size:6px;}',

            '.rk-select-row{display:flex;align-items:center;gap:5px;margin:3px 0;}',
            '.rk-select-row label{width:95px;color:#8a7060;font-size:6px;flex-shrink:0;}',
            '.rk-select-row select{flex:1;background:#2a1408;border:1px solid #5a3818;',
            'color:#c8b890;font-size:6px;padding:1px 2px;}',

            '.rk-btn{display:block;width:100%;margin:3px 0;padding:5px;',
            'background:linear-gradient(180deg,#4a4a58 0%,#3a3a48 50%,#2a2a38 100%);',
            'border:1px solid #1a0800;color:#e8d8c8;',
            'font:bold 7px "Press Start 2P";cursor:pointer;text-align:center;',
            'letter-spacing:1px;transition:background .1s;}',
            '.rk-btn:hover{background:linear-gradient(180deg,#5a5a68 0%,#4a4a58 50%,#3a3a38 100%);}',
            '.rk-btn-seed{border-color:#5a3818;color:#c8b890;}',
            '.rk-btn-seed:hover{background:#3a2818;}',

            '#rk-hint{position:fixed;bottom:8px;right:8px;',
            'background:repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),',
            'linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
            'border:3px solid #1a0800;color:#c8b890;font:6px "Press Start 2P";padding:4px 6px;',
            'box-shadow:inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);',
            'z-index:9998;pointer-events:none;}'
        ].join('');
        document.head.appendChild(style);
        }

        // ── Panel root ─────────────────────────────────────────────────────
        var p = document.createElement('div');
        p.id = 'rk-dev';
        p.innerHTML = [
            '<div id="rk-dev-hdr">',
            '  <span>⚙ DEV PANEL</span>',
            '  <button id="rk-fullscreen" title="Toggle Fullscreen">⛶</button>',
            '  <small>` or F2 to toggle</small>',
            '</div>',

            // World section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">World</div>',
            '  <div class="rk-row"><span class="rk-lbl">Runtime</span><b id="rk-runtime">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">FPS</span><b id="rk-fps">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Frame ms</span><b id="rk-frame-ms">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Map size</span><b id="rk-map-info">--</b></div>',
            '</div>',

            // Status section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">Status</div>',
            '  <div class="rk-row">',
            '    <span class="rk-lbl">Auto-refresh</span>',
            '    <b id="rk-status-refresh" style="padding:1px 6px;border-radius:3px;font-size:6px;">--</b>',
            '  </div>',
            '  <div class="rk-row">',
            '    <span class="rk-lbl">Control</span>',
            '    <b id="rk-status-mode" style="padding:1px 6px;border-radius:3px;font-size:6px;">--</b>',
            '  </div>',
            '  <div class="rk-row">',
            '    <span class="rk-lbl">Paused</span>',
            '    <b id="rk-status-pause" style="padding:1px 6px;border-radius:3px;font-size:6px;">--</b>',
            '  </div>',
            '</div>',

            // XP/Level section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">Progress</div>',
            '  <div class="rk-row"><span class="rk-lbl">Level</span><b id="rk-xp-level">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Total XP</span><b id="rk-xp-total">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">XP to next</span><b id="rk-xp-next">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Achievements</span><b id="rk-ach-count">--</b></div>',
            '</div>',

            // Player section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">Player</div>',
            '  <div class="rk-row"><span class="rk-lbl">World XY</span><b id="rk-pw-xy">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Tile XY</span><b id="rk-pt-xy">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Tile type</span><b id="rk-pt-type">--</b></div>',
            '  <div class="rk-row" style="margin-top:3px">',
            '    <span class="rk-lbl">HP <span id="rk-hp-txt" style="color:#e74c3c"></span></span>',
            '    <span id="rk-hp-pct" style="color:#e74c3c">--</span>',
            '  </div>',
            '  <div class="rk-bar-wrap"><div class="rk-bar rk-bar-hp" id="rk-bar-hp" style="width:0%"></div></div>',
            '  <div class="rk-row">',
            '    <span class="rk-lbl">MP <span id="rk-mp-txt" style="color:#2980b9"></span></span>',
            '    <span id="rk-mp-pct" style="color:#2980b9">--</span>',
            '  </div>',
            '  <div class="rk-bar-wrap"><div class="rk-bar rk-bar-mp" id="rk-bar-mp" style="width:0%"></div></div>',
            '</div>',

            // Cursor tile section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">Cursor Tile</div>',
            '  <div class="rk-row"><span class="rk-lbl">Tile XY</span><b id="rk-ct-xy">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Type</span><b id="rk-ct-type">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Elevation</span><b id="rk-ct-elev">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Moisture</span><b id="rk-ct-moist">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Temperature</span><b id="rk-ct-temp">--</b></div>',
            '  <div class="rk-row"><span class="rk-lbl">Collision</span><b id="rk-ct-col">--</b></div>',
            '</div>',

            // Minimap section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">Minimap</div>',
            '  <div class="rk-slider-row">',
            '    <label>Opacity</label>',
            '    <input type="range" id="rk-mm-opacity" min="0" max="100" value="100">',
            '    <span id="rk-mm-opacity-v">100%</span>',
            '  </div>',
            '  <div class="rk-slider-row">',
            '    <label>Time of day</label>',
            '    <input type="range" id="rk-time-of-day" min="0" max="23" value="12">',
            '    <span id="rk-time-of-day-v">12:00</span>',
            '  </div>',
            '</div>',

            // Lighting section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">Lighting</div>',
            '  <div class="rk-slider-row">',
            '    <label>Torch radius</label>',
            '    <input type="range" id="rk-light-radius" min="0" max="200" value="100">',
            '    <span id="rk-light-radius-v">100%</span>',
            '  </div>',
            '  <div class="rk-slider-row">',
            '    <label>Ambient light</label>',
            '    <input type="range" id="rk-light-ambient" min="0" max="100" value="0">',
            '    <span id="rk-light-ambient-v">0%</span>',
            '  </div>',
            '</div>',

            // Terrain section
            '<div class="rk-sec">',
            '  <div class="rk-sec-title">Terrain Generation</div>',
            '  <div class="rk-slider-row">',
            '    <label>Water level</label>',
            '    <input type="range" id="rk-t-water" min="5" max="45" value="22">',
            '    <span id="rk-t-water-v">0.22</span>',
            '  </div>',
            '  <div class="rk-slider-row">',
            '    <label>Hill level</label>',
            '    <input type="range" id="rk-t-hill" min="55" max="88" value="78">',
            '    <span id="rk-t-hill-v">0.78</span>',
            '  </div>',
            '  <div class="rk-slider-row">',
            '    <label>Mtn level</label>',
            '    <input type="range" id="rk-t-mtn" min="70" max="97" value="88">',
            '    <span id="rk-t-mtn-v">0.88</span>',
            '  </div>',
            '  <div class="rk-slider-row">',
            '    <label>Elev. scale ×1000</label>',
            '    <input type="range" id="rk-t-escale" min="3" max="20" value="8">',
            '    <span id="rk-t-escale-v">0.008</span>',
            '  </div>',
            '  <div class="rk-select-row">',
            '    <label>Tile size (px)</label>',
            '    <select id="rk-t-tsize">',
            '      <option value="16">16 px</option>',
            '      <option value="32" selected>32 px</option>',
            '      <option value="48">48 px</option>',
            '      <option value="64">64 px</option>',
            '    </select>',
            '  </div>',
            // Map dimensions — free-form width × height
            '  <div class="rk-sec-title" style="margin-top:4px">Map Dimensions (tiles)</div>',
            '  <div class="rk-select-row">',
            '    <label>Preset</label>',
            '    <select id="rk-t-preset">',
            '      <option value="">— custom —</option>',
            '      <option value="64x64">64 × 64</option>',
            '      <option value="128x64">128 × 64</option>',
            '      <option value="64x128">64 × 128</option>',
            '      <option value="128x128">128 × 128</option>',
            '      <option value="256x128">256 × 128</option>',
            '      <option value="128x256">128 × 256</option>',
            '      <option value="256x256" selected>256 × 256</option>',
            '      <option value="512x256">512 × 256</option>',
            '      <option value="256x512">256 × 512</option>',
            '      <option value="512x512">512 × 512</option>',
            '    </select>',
            '  </div>',
            '  <div class="rk-select-row">',
            '    <label>Width</label>',
            '    <input type="number" id="rk-t-mw" value="256" min="32" max="1024" step="1"',
            '      style="flex:1;background:#2a1408;border:1px solid #5a3818;color:#c8b890;',
            '             font-size:6px;padding:1px 4px;font-family:\"Press Start 2P\",monospace;">',
            '    <span style="color:#8a7060;font-size:6px;margin-left:3px">tiles</span>',
            '  </div>',
            '  <div class="rk-select-row">',
            '    <label>Height</label>',
            '    <input type="number" id="rk-t-mh" value="256" min="32" max="1024" step="1"',
            '      style="flex:1;background:#2a1408;border:1px solid #5a3818;color:#c8b890;',
            '             font-size:6px;padding:1px 4px;font-family:\"Press Start 2P\",monospace;">',
            '    <span style="color:#8a7060;font-size:6px;margin-left:3px">tiles</span>',
            '  </div>',
            '  <div class="rk-row" style="margin:4px 0 2px">',
            '    <span class="rk-lbl">Seed</span><b id="rk-t-seed-disp">--</b>',
            '  </div>',
            '  <button class="rk-btn" id="rk-regen">⟳ REGENERATE WORLD</button>',
            '  <button class="rk-btn rk-btn-seed" id="rk-new-seed">⟲ REGEN SAME SEED</button>',
            '  <button class="rk-btn" id="rk-toggle-refresh">Toggle Auto-Refresh</button>',
            '</div>'
        ].join('');
        document.body.appendChild(p);
        this.el = p;

        // ── Cache element refs ─────────────────────────────────────────────
        var ids = [
            'rk-runtime','rk-fps','rk-frame-ms','rk-map-info',
            'rk-pw-xy','rk-pt-xy','rk-pt-type',
            'rk-hp-txt','rk-hp-pct','rk-bar-hp',
            'rk-mp-txt','rk-mp-pct','rk-bar-mp',
            'rk-ct-xy','rk-ct-type','rk-ct-elev','rk-ct-moist','rk-ct-temp','rk-ct-col',
            'rk-mm-opacity','rk-mm-opacity-v','rk-time-of-day','rk-time-of-day-v',
            'rk-light-radius','rk-light-radius-v','rk-light-ambient','rk-light-ambient-v',
            'rk-t-water','rk-t-water-v','rk-t-hill','rk-t-hill-v',
            'rk-t-mtn','rk-t-mtn-v','rk-t-escale','rk-t-escale-v',
            'rk-t-tsize','rk-t-preset','rk-t-mw','rk-t-mh','rk-t-seed-disp',
            'rk-regen','rk-new-seed','rk-toggle-refresh',
            'rk-status-refresh','rk-status-mode','rk-status-pause',
            'rk-xp-level','rk-xp-total','rk-xp-next','rk-ach-count'
        ];
        for (var i = 0; i < ids.length; i++) {
            this._e[ids[i]] = document.getElementById(ids[i]);
        }

        // ── Control events ─────────────────────────────────────────────────
        this._bindSlider('rk-mm-opacity', 'rk-mm-opacity-v', function(v) {
            return v + '%';
        }, function(v) {
            self.engine.minimapOpacity = v / 100;
        });
        this._bindSlider('rk-time-of-day', 'rk-time-of-day-v', function(v) {
            return v + ':00';
        }, function(v) {
            if (self.engine && self.engine.dayNight) self.engine.dayNight.time = v * 3600;
        });

        this._bindSlider('rk-light-radius', 'rk-light-radius-v', function(v) {
            return v + '%';
        }, function(v) {
            self.engine.lightRadiusMultiplier = v / 100;
        });

        this._bindSlider('rk-light-ambient', 'rk-light-ambient-v', function(v) {
            return v + '%';
        }, function(v) {
            self.engine.ambientLightOverride = v / 100;
        });

        this._bindSlider('rk-t-water', 'rk-t-water-v', function(v) {
            return (v / 100).toFixed(2);
        });
        this._bindSlider('rk-t-hill', 'rk-t-hill-v', function(v) {
            return (v / 100).toFixed(2);
        });
        this._bindSlider('rk-t-mtn', 'rk-t-mtn-v', function(v) {
            return (v / 100).toFixed(2);
        });
        this._bindSlider('rk-t-escale', 'rk-t-escale-v', function(v) {
            return (v / 1000).toFixed(3);
        });

        // Preset select → auto-fill width/height inputs
        this._e['rk-t-preset'].addEventListener('change', function() {
            var val = self._e['rk-t-preset'].value;
            if (!val) return;
            var parts = val.split('x');
            if (parts.length === 2) {
                self._e['rk-t-mw'].value = parts[0];
                self._e['rk-t-mh'].value = parts[1];
            }
        });

        // Typing custom W/H clears the preset label back to "— custom —"
        ['rk-t-mw','rk-t-mh'].forEach(function(id) {
            self._e[id].addEventListener('input', function() {
                self._e['rk-t-preset'].value = '';
            });
        });

        // "Regenerate World" — always picks a new random seed so the world changes
        this._e['rk-regen'].addEventListener('click', function() {
            if (self.engine.terrainConfig) {
                self.engine.terrainConfig.seed = Math.floor(Math.random() * 999999);
            }
            self._regen();
        });
        // "Regen Same Seed" — re-runs generation with the existing seed,
        // useful for tweaking biome parameters without changing terrain layout
        this._e['rk-new-seed'].addEventListener('click', function() {
            self._regen();
        });

        // Toggle auto-refresh
        this._e['rk-toggle-refresh'].addEventListener('click', function() {
            self.engine.toggleAutoRefresh();
            self._setStatus('Auto-refresh: ' + (self.engine.autoRefresh ? 'ON' : 'OFF'));
        });

        // Fullscreen button
        var fsBtn = document.getElementById('rk-fullscreen');
        if (fsBtn) {
            fsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._toggleFullscreen();
            });
        }
    },

    // ─── Fullscreen toggle ────────────────────────────────────────────────
    _toggleFullscreen: function() {
        var doc = document.documentElement;
        var btn = document.getElementById('rk-fullscreen');
        
        if (!document.fullscreenElement) {
            if (doc.requestFullscreen) {
                doc.requestFullscreen().then(function() {
                    if (btn) btn.classList.add('active');
                }).catch(function(err) {
                    console.log('[DevPanel] Fullscreen error:', err);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().then(function() {
                    if (btn) btn.classList.remove('active');
                });
            }
        }
    },

    // ─── Slider helper ────────────────────────────────────────────────────
    _bindSlider: function(sliderId, valId, fmt, onChange) {
        var el = this._e[sliderId];
        var valEl = this._e[valId];
        if (!el || !valEl) return;
        el.addEventListener('input', function() {
            valEl.textContent = fmt(Number(el.value));
            if (onChange) onChange(Number(el.value));
        });
    },

    // ─── Keyboard toggle ─────────────────────────────────────────────────
    _bindKeys: function() {
        var self = this;
        window.addEventListener('keydown', function(e) {
            if (e.key === '`' || e.key === 'F2') {
                // Don't toggle if typing in an input field
                var activeEl = document.activeElement;
                var isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
                if (isTyping) return;
                
                e.preventDefault();
                self.toggle();
            }
        });
    },

    // ─── Drag ─────────────────────────────────────────────────────────────
    _bindDrag: function() {
        var self = this;
        var hdr = document.getElementById('rk-dev-hdr');
        if (!hdr) return;

        hdr.addEventListener('mousedown', function(e) {
            self._dragging = true;
            self._dragOffX = e.clientX - self.el.getBoundingClientRect().left;
            self._dragOffY = e.clientY - self.el.getBoundingClientRect().top;
            e.preventDefault();
        });
        window.addEventListener('mousemove', function(e) {
            if (!self._dragging) return;
            self.el.style.right = 'auto';
            self.el.style.left = (e.clientX - self._dragOffX) + 'px';
            self.el.style.top  = (e.clientY - self._dragOffY) + 'px';
        });
        window.addEventListener('mouseup', function() {
            self._dragging = false;
        });
    },

    // ─── Toggle visibility ────────────────────────────────────────────────
    toggle: function() {
        this.visible = !this.visible;
        this.el.style.display = this.visible ? 'flex' : 'none';
    },

    // ─── Regenerate world ─────────────────────────────────────────────────
    _regen: function() {
        var e = this._e;
        var mw = Math.max(32, Math.min(1024, parseInt(e['rk-t-mw'].value, 10) || 256));
        var mh = Math.max(32, Math.min(1024, parseInt(e['rk-t-mh'].value, 10) || 256));
        // Snap back in case user typed out-of-range values
        e['rk-t-mw'].value = mw;
        e['rk-t-mh'].value = mh;
        var cfg = {
            waterLevel:    parseInt(e['rk-t-water'].value,  10) / 100,
            hillLevel:     parseInt(e['rk-t-hill'].value,   10) / 100,
            mountainLevel: parseInt(e['rk-t-mtn'].value,    10) / 100,
            elevationScale:parseInt(e['rk-t-escale'].value, 10) / 1000,
            tileSize:      parseInt(e['rk-t-tsize'].value,  10),
            mapWidth:  mw,
            mapHeight: mh
        };
        this.engine.regenerateWorld(cfg);
    },

    // ─── Per-frame update ─────────────────────────────────────────────────
    update: function(engine) {
        if (!this.visible) return;
        
        // Throttle DOM updates to every 3rd frame (~20fps at 60fps)
        this._frameCount = (this._frameCount || 0) + 1;
        if (this._frameCount % 3 !== 0) return;

        var e = this._e;
        var now = performance.now();

        // ── FPS smoothing (rolling 30-frame buffer) ────────────────────────
        this._fpsBuffer.push(engine.totalRenderMs || 0);
        if (this._fpsBuffer.length > 30) this._fpsBuffer.shift();
        if (now - this._lastFpsTime > 500) {
            var avgMs = 0;
            for (var i = 0; i < this._fpsBuffer.length; i++) avgMs += this._fpsBuffer[i];
            avgMs /= (this._fpsBuffer.length || 1);
            this._fpsDisplay = avgMs > 0 ? Math.round(1000 / avgMs) : 0;
            this._lastFpsTime = now;
        }

        // ── Runtime ───────────────────────────────────────────────────────
        var elapsed = Math.floor((now - (engine.startTime || now)) / 1000);
        var hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        var mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        var ss = String(elapsed % 60).padStart(2, '0');
        e['rk-runtime'].textContent = hh + ':' + mm + ':' + ss;
        e['rk-fps'].textContent = this._fpsDisplay + ' fps';
        e['rk-frame-ms'].textContent = (engine.totalRenderMs || 0).toFixed(2) + ' ms';

        // ── Map info ──────────────────────────────────────────────────────
        if (engine.tileMap) {
            e['rk-map-info'].textContent =
                engine.tileMap.width + '×' + engine.tileMap.height +
                ' (' + engine.tileMap.tileWidth + 'px tiles)';
        }

        // ── Terrain config sync (keeps inputs consistent after external regen) ──
        if (engine.terrainConfig) {
            e['rk-t-seed-disp'].textContent =
                Math.floor(engine.terrainConfig.seed || 0).toString();
            // Only sync dimension inputs when the user isn't actively editing them
            if (document.activeElement !== e['rk-t-mw'] && engine.terrainConfig.width) {
                e['rk-t-mw'].value = engine.terrainConfig.width;
            }
            if (document.activeElement !== e['rk-t-mh'] && engine.terrainConfig.height) {
                e['rk-t-mh'].value = engine.terrainConfig.height;
            }
        }
        if (engine.dayNight && e['rk-time-of-day'] && document.activeElement !== e['rk-time-of-day']) {
            var hour = Math.max(0, Math.min(23, Math.floor((engine.dayNight.time || 0) / 3600)));
            e['rk-time-of-day'].value = hour;
            e['rk-time-of-day-v'].textContent = hour + ':00';
        }

        // ── Pending-changes highlight on the Regen button ─────────────────────
        // Glows yellow when the dimension/param inputs differ from the live map
        var pendingW = parseInt(e['rk-t-mw'].value, 10);
        var pendingH = parseInt(e['rk-t-mh'].value, 10);
        var liveW = engine.terrainConfig ? (engine.terrainConfig.width  || 256) : 256;
        var liveH = engine.terrainConfig ? (engine.terrainConfig.height || 256) : 256;
        var pending = (pendingW !== liveW || pendingH !== liveH);
        var regenBtn = e['rk-regen'];
        if (pending) {
            regenBtn.style.borderColor = '#ffe066';
            regenBtn.style.color       = '#ffe066';
            regenBtn.textContent       = '\u27f3 REGEN \u2014 ' + pendingW + '\u00d7' + pendingH;
        } else {
            regenBtn.style.borderColor = '';
            regenBtn.style.color       = '';
            regenBtn.textContent       = '\u27f3 REGENERATE WORLD';
        }

        // ── Status indicators ───────────────────────────────────────────────
        var refreshEl = e['rk-status-refresh'];
        var modeEl = e['rk-status-mode'];
        var pauseEl = e['rk-status-pause'];
        
        if (refreshEl) {
            var isRefresh = engine.autoRefresh;
            refreshEl.textContent = isRefresh ? 'ON' : 'OFF';
            refreshEl.style.background = isRefresh ? '#3a2a18' : '#4a2020';
            refreshEl.style.color = isRefresh ? '#c8a84b' : '#c86060';
        }
        
        if (modeEl) {
            var isAuto = engine.npcMode;
            modeEl.textContent = isAuto ? 'AUTO' : 'MANUAL';
            modeEl.style.background = isAuto ? '#2a2838' : '#3a3218';
            modeEl.style.color = isAuto ? '#a8a8c8' : '#c8c878';
        }

        if (pauseEl) {
            var isPaused = engine.isPaused;
            pauseEl.textContent = isPaused ? 'PAUSED' : 'RUNNING';
            pauseEl.style.background = isPaused ? '#4a3020' : '#3a2a18';
            pauseEl.style.color = isPaused ? '#c88040' : '#c8a84b';
        }

        // ── Player ────────────────────────────────────────────────────────
        if (engine.player && engine.tileMap) {
            var tw = engine.tileMap.tileWidth  || 32;
            var th = engine.tileMap.tileHeight || 32;
            var ptx = Math.floor(engine.player.x / tw);
            var pty = Math.floor(engine.player.y / th);

            e['rk-pw-xy'].textContent =
                Math.floor(engine.player.x) + ', ' + Math.floor(engine.player.y);
            e['rk-pt-xy'].textContent = ptx + ', ' + pty;

            var ptIdx = pty * engine.tileMap.width + ptx;
            var ptTile = (engine.tileMap.layers && engine.tileMap.layers[0])
                ? engine.tileMap.layers[0].data[ptIdx] : -1;
            e['rk-pt-type'].textContent =
                RealmKit.DevPanel.TILE_NAMES[ptTile] || ('ID ' + ptTile);

            // HP / MP bars
            var cs = engine.player.combatStats;
            if (cs) {
                var hpPct = Math.round((cs.hp / cs.maxHp) * 100);
                var mpPct = cs.maxMp > 0 ? Math.round((cs.mp / cs.maxMp) * 100) : 0;

                e['rk-hp-txt'].textContent = cs.hp + '/' + cs.maxHp;
                e['rk-hp-pct'].textContent = hpPct + '%';
                e['rk-bar-hp'].style.width  = hpPct + '%';
                // Colour shift: green → yellow → red
                var hpColour = hpPct > 50 ? '#2ecc71' : hpPct > 25 ? '#f1c40f' : '#e74c3c';
                e['rk-bar-hp'].style.background = hpColour;

                e['rk-mp-txt'].textContent = cs.mp + '/' + cs.maxMp;
                e['rk-mp-pct'].textContent = mpPct + '%';
                e['rk-bar-mp'].style.width  = mpPct + '%';
            }
        }

        // ── XP / Level ────────────────────────────────────────────────────────
        if (engine.experienceManager && engine.player) {
            var xpData = engine.experienceManager.getXP(engine.player.id);
            if (xpData) {
                e['rk-xp-level'].textContent = xpData.level;
                e['rk-xp-total'].textContent = xpData.totalXp;
                e['rk-xp-next'].textContent = xpData.xpToNext > 0 ? xpData.xpToNext : 'MAX';
            }
        } else {
            e['rk-xp-level'].textContent = '--';
            e['rk-xp-total'].textContent = '--';
            e['rk-xp-next'].textContent = '--';
        }

        // ── Achievements ───────────────────────────────────────────────────────
        if (engine.achievementSystem) {
            e['rk-ach-count'].textContent = engine.achievementSystem.getUnlocked().length + '/' + engine.achievementSystem.getAll().length;
        } else {
            e['rk-ach-count'].textContent = '--';
        }

        // ── Cursor tile ───────────────────────────────────────────────────
        if (engine.tileMap && engine.mouseWorldX !== undefined) {
            var tw2 = engine.tileMap.tileWidth  || 32;
            var th2 = engine.tileMap.tileHeight || 32;
            var ctx = Math.floor(engine.mouseWorldX / tw2);
            var cty = Math.floor(engine.mouseWorldY / th2);

            if (ctx >= 0 && ctx < engine.tileMap.width &&
                cty >= 0 && cty < engine.tileMap.height) {

                var cidx = cty * engine.tileMap.width + ctx;
                var cTile = (engine.tileMap.layers && engine.tileMap.layers[0])
                    ? engine.tileMap.layers[0].data[cidx] : -1;

                e['rk-ct-xy'].textContent   = ctx + ', ' + cty;
                e['rk-ct-type'].textContent =
                    RealmKit.DevPanel.TILE_NAMES[cTile] || ('ID ' + cTile);

                var elev  = engine.tileMap.elevationMap
                    ? engine.tileMap.elevationMap[cidx].toFixed(3) : '--';
                var moist = engine.tileMap.moistureMap
                    ? engine.tileMap.moistureMap[cidx].toFixed(3) : '--';
                var temp  = engine.tileMap.temperatureMap
                    ? engine.tileMap.temperatureMap[cidx].toFixed(3) : '--';
                var col   = engine.tileMap.collisionData
                    ? (engine.tileMap.collisionData[cidx] ? '⛔ yes' : '✓ no') : '--';

                e['rk-ct-elev'].textContent  = elev;
                e['rk-ct-moist'].textContent = moist;
                e['rk-ct-temp'].textContent  = temp;
                e['rk-ct-col'].textContent   = col;
            } else {
                e['rk-ct-xy'].textContent = 'out of bounds';
            }
        }
    }
};

console.log('[DevPanel] Loaded — press ` or F2 to toggle');
