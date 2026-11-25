var RealmKit = RealmKit || {};

/**
 * MapGenPanel — dedicated map generation studio.
 * Open from the sidebar Map tab.
 *
 * Pulls terrain-generation controls out of the DevPanel into a
 * full-screen styled panel that matches the StoryBuilder / Launcher
 * wood-frame + parchment visual language.  Adds a live noise-preview
 * canvas so designers can see the heightmap before committing a regen.
 */
RealmKit.MapGenPanel = function MapGenPanel(engine) {
    this.engine  = engine;
    this.visible = false;
    this.el      = null;
    this._e      = {};
    this._previewRaf = null;
    this._dirty      = true;   // re-draw preview on next tick

    this._build();
    this._bindKeys();
    console.log('[MapGenPanel] Loaded — open from the sidebar Map tab');
};

// ─── Tile-type colour lookup (matches DevPanel.TILE_NAMES order) ───────────
RealmKit.MapGenPanel.TILE_COLORS = {
    0:'#0a2a5a', 1:'#1a4a8a', 2:'#d4b878', 3:'#4a8a3a', 4:'#5a9a4a',
    5:'#a07840', 6:'#7a7a7a', 7:'#6a6060', 8:'#909090', 9:'#e8e8f0',
    10:'#c0a060',11:'#c0a060',12:'#c0a060',13:'#a0a060',14:'#a0a060',
    15:'#4090c0',16:'#605040',17:'#504030',18:'#a08060',19:'#806040',
    20:'#c08040',21:'#2a7020',22:'#3a6030',23:'#808070',24:'#c8a030',
    25:'#205010',26:'#3a5838',27:'#c8a050',28:'#a0c0e0',29:'#506848',
    30:'#70a040',31:'#8050a0'
};

RealmKit.MapGenPanel.prototype = {

    // ─── Build DOM ────────────────────────────────────────────────────────
    _build: function() {
        var self = this;

        var style = document.createElement('style');
        style.textContent = this._getStyles();
        document.head.appendChild(style);

        var el = document.createElement('div');
        el.id  = 'rk-mapgen';
        el.innerHTML = this._getHTML();
        document.body.appendChild(el);
        this.el = el;

        // Cache element refs
        var ids = [
            'mg-water','mg-water-v','mg-hill','mg-hill-v',
            'mg-mtn','mg-mtn-v','mg-escale','mg-escale-v',
            'mg-tsize','mg-preset','mg-mw','mg-mh',
            'mg-moisture','mg-moisture-v','mg-temperature','mg-temperature-v',
            'mg-octaves','mg-octaves-v',
            'mg-seed-disp','mg-regen','mg-same-seed',
            'mg-preview','mg-preview-label','mg-close'
        ];
        for (var i = 0; i < ids.length; i++) {
            this._e[ids[i]] = document.getElementById(ids[i]);
        }

        this._bindControls();
    },

    // ─── Styles ───────────────────────────────────────────────────────────
    _getStyles: function() {
        return [
            '@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");',
            '',
            '/* ── Map Gen Panel overlay ── */',
            '#rk-mapgen {',
            '  position: fixed; top: 0; left: 0;',
            '  width: 100%; height: 100%;',
            '  z-index: 10002;',
            '  font-family: "Press Start 2P", monospace;',
            '  image-rendering: pixelated;',
            '  display: none;',
            '  align-items: center;',
            '  justify-content: center;',
            '  background: rgba(10, 10, 18, 0.92);',
            '  transition: opacity 0.2s;',
            '}',
            '#rk-mapgen.mg-visible { display: flex; }',
            '',
            '/* ── Outer wood frame ── */',
            '.mg-frame {',
            '  position: relative;',
            '  width: 96%; height: 90%;',
            '  max-width: 1100px;',
            '  background: #2a1408;',
            '  padding: 18px;',
            '  /* Wood grain */',
            '  background-image:',
            '    repeating-linear-gradient(90deg, transparent 0px, transparent 5px, rgba(80,50,20,0.3) 5px, rgba(80,50,20,0.3) 6px),',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(60,35,15,0.2) 12px, rgba(60,35,15,0.2) 18px),',
            '    linear-gradient(180deg, #4a2810 0%, #3a1808 50%, #2a1000 100%);',
            '  box-shadow:',
            '    inset 0 3px 0 0 rgba(255,200,150,0.2),',
            '    inset 0 -6px 0 0 rgba(0,0,0,0.5),',
            '    0 0 0 5px #1a0800,',
            '    0 0 0 9px #3a2008,',
            '    0 16px 0 9px rgba(0,0,0,0.5);',
            '}',
            '',
            '/* Corner decorations */',
            '.mg-corner {',
            '  position: absolute; width: 32px; height: 32px;',
            '  background: #3a1808;',
            '  box-shadow: inset 0 0 0 3px #5a3818, inset 0 0 0 6px #4a2808;',
            '}',
            '.mg-corner::before {',
            '  content: ""; position: absolute;',
            '  top: 6px; left: 6px; right: 6px; bottom: 6px;',
            '  background: #2a1000;',
            '  box-shadow: inset 2px 2px 0 rgba(255,200,150,0.15);',
            '}',
            '.mg-cnw { top: 5px; left: 5px; }',
            '.mg-cne { top: 5px; right: 5px; }',
            '.mg-csw { bottom: 5px; left: 5px; }',
            '.mg-cse { bottom: 5px; right: 5px; }',
            '',
            '/* ── Inner parchment area ── */',
            '.mg-inner {',
            '  position: relative;',
            '  background: #d4c4a0;',
            '  background-image:',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(139,90,43,0.05) 2px, rgba(139,90,43,0.05) 3px),',
            '    repeating-linear-gradient(90deg, transparent 0px, transparent 5px, rgba(139,90,43,0.03) 5px, rgba(139,90,43,0.03) 6px),',
            '    linear-gradient(180deg, #e8d8b8 0%, #d4c4a0 40%, #c8b890 100%);',
            '  height: 100%;',
            '  padding: 12px;',
            '  box-shadow: inset 5px 5px 0 rgba(0,0,0,0.1), inset -5px -5px 0 rgba(255,255,255,0.2);',
            '  display: flex;',
            '  flex-direction: column;',
            '  gap: 10px;',
            '}',
            '',
            '/* ── Panel header ── */',
            '.mg-header {',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: space-between;',
            '  flex-shrink: 0;',
            '}',
            '.mg-title-row {',
            '  display: flex; align-items: center; gap: 10px;',
            '}',
            '.mg-ornament {',
            '  width: 10px; height: 10px;',
            '  background: #5a3020; transform: rotate(45deg);',
            '  box-shadow: inset 1px 1px 0 rgba(255,200,150,0.25);',
            '  flex-shrink: 0;',
            '}',
            '.mg-title {',
            '  font-size: 11px; color: #2a1408;',
            '  text-shadow: 1px 1px 0 rgba(255,255,255,0.4);',
            '  letter-spacing: 3px;',
            '}',
            '.mg-hint {',
            '  font-size: 8px; color: #6a5040;',
            '  margin-left: 10px;',
            '}',
            '',
            '/* ── Close button ── */',
            '.mg-close {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 9px;',
            '  padding: 7px 14px;',
            '  background: linear-gradient(180deg, #a04040 0%, #803030 50%, #602020 100%);',
            '  color: #ffd0d0;',
            '  border: none; cursor: pointer;',
            '  box-shadow: 0 4px 0 0 #301010, inset 0 1px 0 rgba(255,180,180,0.25);',
            '  transition: all 0.05s;',
            '}',
            '.mg-close:hover { background: linear-gradient(180deg, #b05050 0%, #904040 50%, #703030 100%); }',
            '.mg-close:active { transform: translateY(4px); box-shadow: 0 0 0 0 #301010; }',
            '',
            '/* ── Two-column layout ── */',
            '.mg-columns {',
            '  display: flex; gap: 10px; flex: 1; min-height: 0;',
            '}',
            '',
            '/* ── Controls column ── */',
            '.mg-controls {',
            '  width: 260px; flex-shrink: 0;',
            '  background: #f0e8d8;',
            '  border: 3px solid #8a7060;',
            '  box-shadow: inset 2px 2px 6px rgba(0,0,0,0.1);',
            '  display: flex; flex-direction: column;',
            '  overflow-y: auto;',
            '}',
            '',
            '/* ── Preview column ── */',
            '.mg-preview-col {',
            '  flex: 1; min-width: 0;',
            '  background: #f0e8d8;',
            '  border: 3px solid #8a7060;',
            '  box-shadow: inset 2px 2px 6px rgba(0,0,0,0.1);',
            '  display: flex; flex-direction: column;',
            '}',
            '',
            '/* ── Section headers ── */',
            '.mg-sec-hdr {',
            '  font-size: 8px; font-weight: bold; letter-spacing: 1px;',
            '  text-transform: uppercase;',
            '  color: #f8e8c8;',
            '  background: linear-gradient(180deg, #3a3848 0%, #2a2838 50%, #1a1828 100%);',
            '  padding: 6px 10px;',
            '  border-bottom: 2px solid #5a3c20;',
            '  box-shadow: 0 2px 0 0 #0a0818;',
            '}',
            '',
            '/* ── Sliders and controls ── */',
            '.mg-sec-body { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }',
            '.mg-row {',
            '  display: flex; align-items: center; gap: 5px;',
            '}',
            '.mg-lbl {',
            '  width: 110px; color: #4a3020; font-size: 8px; flex-shrink: 0;',
            '}',
            '.mg-row input[type=range] {',
            '  flex: 1; accent-color: #8a5020; height: 12px;',
            '}',
            '.mg-row input[type=number] {',
            '  flex: 1;',
            '  background: #e8d8b8; border: 2px solid #8a7060;',
            '  color: #2a1408; font-size: 7px; padding: 2px 4px;',
            '  font-family: "Press Start 2P", monospace;',
            '}',
            '.mg-val {',
            '  width: 38px; text-align: right; color: #2a1408; font-size: 7px;',
            '}',
            '.mg-tiles-lbl { color: #7a6050; font-size: 6px; margin-left: 2px; }',

            '.mg-select {',
            '  width: 100%; background: #e8d8b8;',
            '  border: 2px solid #8a7060; color: #2a1408;',
            '  font-size: 7px; padding: 3px 4px;',
            '  font-family: "Press Start 2P", monospace;',
            '}',

            '/* ── Seed display ── */',
            '.mg-seed-row {',
            '  display: flex; justify-content: space-between; align-items: center;',
            '  padding: 4px 10px;',
            '  background: #e8d8b8; border-top: 1px solid #c0a880;',
            '}',
            '.mg-seed-lbl { font-size: 6px; color: #6a5040; }',
            '.mg-seed-val { font-size: 7px; color: #2a1408; font-family: "Press Start 2P"; }',
            '',
            '/* ── Action buttons ── */',
            '.mg-actions { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }',
            '.mg-btn {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 9px;',
            '  padding: 10px 14px;',
            '  border: none; cursor: pointer;',
            '  text-align: center;',
            '  transition: all 0.05s;',
            '}',
            '.mg-btn-regen {',
            '  background: linear-gradient(180deg, #286020 0%, #184010 50%, #102808 100%);',
            '  color: #90c890;',
            '  box-shadow: 0 5px 0 0 #0a1808, inset 0 1px 0 rgba(144,200,144,0.25);',
            '}',
            '.mg-btn-regen:hover { background: linear-gradient(180deg, #387030 0%, #286020 50%, #184010 100%); }',
            '.mg-btn-regen:active { transform: translateY(5px); box-shadow: 0 0 0 0 #0a1808; }',
            '.mg-btn-seed {',
            '  background: linear-gradient(180deg, #4a4a58 0%, #3a3a48 50%, #2a2a38 100%);',
            '  color: #c8c8d8;',
            '  box-shadow: 0 5px 0 0 #1a1a28, inset 0 1px 0 rgba(255,255,255,0.08);',
            '}',
            '.mg-btn-seed:hover { background: linear-gradient(180deg, #5a5a68 0%, #4a4a58 50%, #3a3a48 100%); }',
            '.mg-btn-seed:active { transform: translateY(5px); box-shadow: 0 0 0 0 #1a1a28; }',
            '',
            '/* ── Preview canvas area ── */',
            '.mg-preview-hdr {',
            '  display: flex; align-items: center; justify-content: space-between;',
            '  padding: 4px 10px;',
            '}',
            '.mg-preview-title { font-size: 8px; color: #2a1408; letter-spacing: 1px; }',
            '.mg-preview-badge {',
            '  font-size: 7px; color: #6a5040;',
            '  background: #e0d0a8; padding: 2px 6px;',
            '  border: 1px solid #a09070;',
            '}',
            '',
            '.mg-canvas-wrap {',
            '  flex: 1; display: flex; align-items: center; justify-content: center;',
            '  padding: 8px; overflow: hidden;',
            '}',
            '',
            '#mg-preview {',
            '  image-rendering: pixelated;',
            '  max-width: 100%; max-height: 100%;',
            '  border: 3px solid #8a7060;',
            '  box-shadow: 3px 3px 0 rgba(0,0,0,0.2);',
            '}',
            '',
            '#mg-preview-label {',
            '  text-align: center;',
            '  padding: 6px 10px;',
            '  font-size: 7px; color: #6a5040;',
            '  border-top: 1px solid #c0a880;',
            '  flex-shrink: 0;',
            '}'
        ].join('\n');
    },

    // ─── HTML ─────────────────────────────────────────────────────────────
    _getHTML: function() {
        return [
            '<div class="mg-frame">',
            '  <div class="mg-corner mg-cnw"></div>',
            '  <div class="mg-corner mg-cne"></div>',
            '  <div class="mg-corner mg-csw"></div>',
            '  <div class="mg-corner mg-cse"></div>',
            '  <div class="mg-inner">',
            '    <div class="mg-header">',
            '      <div class="mg-title-row">',
            '        <div class="mg-ornament"></div>',
            '        <span class="mg-title">Map Generator</span>',
            '        <div class="mg-ornament"></div>',
            '        <span class="mg-hint">Pop-out map studio</span>',
            '      </div>',
            '      <button class="mg-close" id="mg-close">✕ Close</button>',
            '    </div>',

            '    <div class="mg-columns">',

            '      <!-- Controls column -->',
            '      <div class="mg-controls">',

            '        <div class="mg-sec-hdr">⛰ Terrain</div>',
            '        <div class="mg-sec-body">',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Water level</span>',
            '            <input type="range" id="mg-water" min="5" max="45" value="22">',
            '            <span class="mg-val" id="mg-water-v">0.22</span>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Hill level</span>',
            '            <input type="range" id="mg-hill" min="55" max="88" value="78">',
            '            <span class="mg-val" id="mg-hill-v">0.78</span>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Mtn level</span>',
            '            <input type="range" id="mg-mtn" min="70" max="97" value="88">',
            '            <span class="mg-val" id="mg-mtn-v">0.88</span>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Elev. scale</span>',
            '            <input type="range" id="mg-escale" min="3" max="20" value="8">',
            '            <span class="mg-val" id="mg-escale-v">0.008</span>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Octaves</span>',
            '            <input type="range" id="mg-octaves" min="2" max="8" value="5">',
            '            <span class="mg-val" id="mg-octaves-v">5</span>',
            '          </div>',
            '        </div>',

            '        <div class="mg-sec-hdr">🌡 Climate</div>',
            '        <div class="mg-sec-body">',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Moisture</span>',
            '            <input type="range" id="mg-moisture" min="1" max="10" value="5">',
            '            <span class="mg-val" id="mg-moisture-v">5</span>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Temperature</span>',
            '            <input type="range" id="mg-temperature" min="1" max="10" value="5">',
            '            <span class="mg-val" id="mg-temperature-v">5</span>',
            '          </div>',
            '        </div>',

            '        <div class="mg-sec-hdr">📐 Map Size</div>',
            '        <div class="mg-sec-body">',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Preset</span>',
            '            <select class="mg-select" id="mg-preset">',
            '              <option value="">— custom —</option>',
            '              <option value="64x64">64 × 64</option>',
            '              <option value="128x64">128 × 64</option>',
            '              <option value="128x128">128 × 128</option>',
            '              <option value="256x128">256 × 128</option>',
            '              <option value="256x256" selected>256 × 256</option>',
            '              <option value="512x256">512 × 256</option>',
            '              <option value="512x512">512 × 512</option>',
            '            </select>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Width</span>',
            '            <input type="number" id="mg-mw" value="256" min="32" max="1024" step="1">',
            '            <span class="mg-tiles-lbl">tiles</span>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Height</span>',
            '            <input type="number" id="mg-mh" value="256" min="32" max="1024" step="1">',
            '            <span class="mg-tiles-lbl">tiles</span>',
            '          </div>',
            '          <div class="mg-row">',
            '            <span class="mg-lbl">Tile size</span>',
            '            <select class="mg-select" id="mg-tsize">',
            '              <option value="16">16 px</option>',
            '              <option value="32" selected>32 px</option>',
            '              <option value="48">48 px</option>',
            '              <option value="64">64 px</option>',
            '            </select>',
            '          </div>',
            '        </div>',

            '        <div class="mg-seed-row">',
            '          <span class="mg-seed-lbl">Current seed</span>',
            '          <span class="mg-seed-val" id="mg-seed-disp">--</span>',
            '        </div>',

            '        <div class="mg-actions">',
            '          <button class="mg-btn mg-btn-regen" id="mg-regen">⟳ GENERATE NEW WORLD</button>',
            '          <button class="mg-btn mg-btn-seed" id="mg-same-seed">⟲ REGEN SAME SEED</button>',
            '        </div>',

            '      </div>',

            '      <!-- Preview column -->',
            '      <div class="mg-preview-col">',
            '        <div class="mg-preview-hdr">',
            '          <span class="mg-preview-title">Heightmap Preview</span>',
            '          <span class="mg-preview-badge" id="mg-preview-label">No map loaded</span>',
            '        </div>',
            '        <div class="mg-canvas-wrap">',
            '          <canvas id="mg-preview"></canvas>',
            '        </div>',
            '      </div>',

            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    },

    // ─── Bind slider/control events ───────────────────────────────────────
    _bindControls: function() {
        var self = this;
        var e = this._e;

        // Terrain sliders
        this._slider('mg-water',       'mg-water-v',       function(v){ return (v/100).toFixed(2); });
        this._slider('mg-hill',        'mg-hill-v',        function(v){ return (v/100).toFixed(2); });
        this._slider('mg-mtn',         'mg-mtn-v',         function(v){ return (v/100).toFixed(2); });
        this._slider('mg-escale',      'mg-escale-v',      function(v){ return (v/1000).toFixed(3); });
        this._slider('mg-octaves',     'mg-octaves-v',     function(v){ return v; });
        this._slider('mg-moisture',    'mg-moisture-v',    function(v){ return v; });
        this._slider('mg-temperature', 'mg-temperature-v', function(v){ return v; });

        // Preset → fill width/height
        if (e['mg-preset']) {
            e['mg-preset'].addEventListener('change', function() {
                var v = this.value;
                if (!v) return;
                var parts = v.split('x');
                if (parts.length === 2) {
                    e['mg-mw'].value = parts[0];
                    e['mg-mh'].value = parts[1];
                }
                self._dirty = true;
                self._schedulePreview();
            });
        }

        // Width/height → clear preset
        ['mg-mw','mg-mh'].forEach(function(id) {
            if (e[id]) e[id].addEventListener('input', function() {
                e['mg-preset'].value = '';
                self._dirty = true;
            });
        });

        // Regen
        if (e['mg-regen']) {
            e['mg-regen'].addEventListener('click', function() {
                self._regen(true);
            });
        }
        if (e['mg-same-seed']) {
            e['mg-same-seed'].addEventListener('click', function() {
                self._regen(false);
            });
        }

        // Close
        if (e['mg-close']) {
            e['mg-close'].addEventListener('click', function() { self.hide(); });
        }
    },

    _slider: function(id, valId, fmt) {
        var self = this;
        var el  = this._e[id];
        var vel = this._e[valId];
        if (!el || !vel) return;
        el.addEventListener('input', function() {
            vel.textContent = fmt(parseInt(this.value, 10));
            self._dirty = true;
            self._schedulePreview();
        });
    },

    // ─── Regen world via engine ────────────────────────────────────────────
    _regen: function(newSeed) {
        if (!this.engine) return;
        var e   = this._e;
        var mw  = Math.max(32, Math.min(1024, parseInt(e['mg-mw'].value, 10) || 256));
        var mh  = Math.max(32, Math.min(1024, parseInt(e['mg-mh'].value, 10) || 256));
        e['mg-mw'].value = mw;
        e['mg-mh'].value = mh;
        var cfg = {
            waterLevel:    parseInt(e['mg-water'].value,  10) / 100,
            hillLevel:     parseInt(e['mg-hill'].value,   10) / 100,
            mountainLevel: parseInt(e['mg-mtn'].value,    10) / 100,
            elevationScale:parseInt(e['mg-escale'].value, 10) / 1000,
            tileSize:      parseInt(e['mg-tsize'].value,  10),
            mapWidth:  mw,
            mapHeight: mh
        };
        if (newSeed) {
            this.engine.regenerateWorld(cfg);
        } else {
            // pass existing seed if engine exposes it
            if (this.engine.worldSeed !== undefined) {
                cfg.seed = this.engine.worldSeed;
            }
            this.engine.regenerateWorld(cfg);
        }
        // Refresh preview after short delay for engine to settle
        var self = this;
        setTimeout(function() { self._drawPreview(); }, 300);
    },

    // ─── Live heightmap preview ────────────────────────────────────────────
    _schedulePreview: function() {
        if (this._previewRaf) return;
        var self = this;
        this._previewRaf = requestAnimationFrame(function() {
            self._previewRaf = null;
            if (self._dirty) { self._drawPreview(); self._dirty = false; }
        });
    },

    _drawPreview: function() {
        var canvas = this._e['mg-preview'];
        var label  = this._e['mg-preview-label'];
        if (!canvas) return;

        // Try to pull the live tileMap from the engine
        var tileMap = this.engine && this.engine.tileMap;
        if (tileMap && tileMap.tiles) {
            this._drawFromTileMap(canvas, tileMap, label);
        } else {
            // Fall back: draw a synthetic noise preview from slider values
            this._drawNoiseSample(canvas, label);
        }
    },

    _drawFromTileMap: function(canvas, tileMap, label) {
        var COLORS = RealmKit.MapGenPanel.TILE_COLORS;
        var w = tileMap.width  || 64;
        var h = tileMap.height || 64;
        var maxSide = 512;
        var scale = Math.max(1, Math.floor(Math.min(maxSide / w, maxSide / h)));
        canvas.width  = w * scale;
        canvas.height = h * scale;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (var ty = 0; ty < h; ty++) {
            for (var tx = 0; tx < w; tx++) {
                var tile = tileMap.tiles[ty * w + tx];
                var type = tile ? (tile.type || 0) : 0;
                ctx.fillStyle = COLORS[type] || '#404040';
                ctx.fillRect(tx * scale, ty * scale, scale, scale);
            }
        }
        if (label) label.textContent = w + ' × ' + h + ' tiles · live';
    },

    _drawNoiseSample: function(canvas, label) {
        // Lightweight simplex-like synthetic preview using Math.sin
        var SIZE = 256;
        canvas.width  = SIZE;
        canvas.height = SIZE;
        var ctx = canvas.getContext('2d');
        var img = ctx.createImageData(SIZE, SIZE);

        var wl   = parseInt(this._e['mg-water'].value,  10) / 100;
        var hl   = parseInt(this._e['mg-hill'].value,   10) / 100;
        var ml   = parseInt(this._e['mg-mtn'].value,    10) / 100;
        var es   = parseInt(this._e['mg-escale'].value, 10) / 1000;
        var oct  = parseInt(this._e['mg-octaves'].value,10);

        for (var y = 0; y < SIZE; y++) {
            for (var x = 0; x < SIZE; x++) {
                // Cheap pseudo-perlin using layered sin/cos
                var nx = x * es * 6;
                var ny = y * es * 6;
                var v = 0; var amp = 1; var freq = 1; var max = 0;
                for (var o = 0; o < oct; o++) {
                    v   += (Math.sin(nx * freq + 1.3) * Math.cos(ny * freq + 0.7) * 0.5 + 0.5) * amp;
                    max += amp; amp *= 0.5; freq *= 2.1;
                }
                v = v / max;

                var r, g, b;
                if (v < wl) {
                    var t = v / wl;
                    r = Math.round(10 + t * 20);
                    g = Math.round(42 + t * 32);
                    b = Math.round(90 + t * 48);
                } else if (v < hl) {
                    var t2 = (v - wl) / (hl - wl);
                    r = Math.round(74 + t2 * 30);
                    g = Math.round(138 - t2 * 60);
                    b = Math.round(58 + t2 * 20);
                } else if (v < ml) {
                    var t3 = (v - hl) / (ml - hl);
                    r = Math.round(104 - t3 * 30);
                    g = Math.round(78  - t3 * 30);
                    b = Math.round(78  + t3 * 20);
                } else {
                    var t4 = Math.min(1, (v - ml) / (1 - ml));
                    r = Math.round(74  + t4 * 160);
                    g = Math.round(48  + t4 * 192);
                    b = Math.round(98  + t4 * 140);
                }

                var i4 = (y * SIZE + x) * 4;
                img.data[i4]     = r;
                img.data[i4 + 1] = g;
                img.data[i4 + 2] = b;
                img.data[i4 + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        var mw = this._e['mg-mw'].value || '256';
        var mh = this._e['mg-mh'].value || '256';
        if (label) label.textContent = mw + ' × ' + mh + ' tiles · preview (approximate)';
    },

    // ─── Show / hide ─────────────────────────────────────────────────────
    show: function() {
        this.visible = true;
        this.el.classList.add('mg-visible');
        // Update seed display from engine
        if (this.engine && this.engine.worldSeed !== undefined) {
            if (this._e['mg-seed-disp']) {
                this._e['mg-seed-disp'].textContent = this.engine.worldSeed;
            }
        }
        this._drawPreview();
    },

    hide: function() {
        this.visible = false;
        this.el.classList.remove('mg-visible');
    },

    toggle: function() {
        if (this.visible) this.hide(); else this.show();
    },

    // ─── Sync seed display (called by engine after regen) ─────────────────
    updateSeed: function(seed) {
        if (this._e['mg-seed-disp']) {
            this._e['mg-seed-disp'].textContent = seed;
        }
    },

    // ─── F3 keybind ───────────────────────────────────────────────────────
    _bindKeys: function() {
        var self = this;
        window.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && self.visible) {
                e.preventDefault();
                self.hide();
            }
        });
    }
};
