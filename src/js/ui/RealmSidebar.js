var RealmKit = RealmKit || {};

RealmKit._LegacyMapGenPanel = RealmKit.MapGenPanel || null;
RealmKit._LegacyStoryBuilderOverlay = RealmKit.StoryBuilder || null;

/**
 * RealmSidebar — unified Dev / Map Gen / Grimoire side panel.
 *
 * Supersedes DevPanel, MapGenPanel, and the fullscreen StoryBuilder overlay.
 * Slides in from the right edge; the game canvas stays fully visible.
 * Toggle with ` (backtick) or F2.
 *
 * The Engine still checks for `RealmKit.DevPanel` and `RealmKit.StoryBuilder`
 * by name.  This file installs shim constructors for both that return the
 * singleton sidebar so the engine's existing wiring works without changes.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Internal implementation
// ─────────────────────────────────────────────────────────────────────────────
RealmKit._RealmSidebarImpl = function RealmSidebarImpl(engine) {
    this.engine      = engine;
    this.visible     = false;
    this.activeTab   = 'dev';   // 'dev' | 'map' | 'story'
    this._e          = {};
    this.sidebarWidth = parseInt(localStorage.getItem('realmkit.sidebarWidth') || '420', 10);
    this.sidebarScale = parseFloat(localStorage.getItem('realmkit.sidebarScale') || '1');
    this._mapDirty   = true;
    this._mapRaf     = null;
    this._fpsBuffer  = [];
    this._lastFps    = performance.now();
    this._fpsDisplay = 0;

    // StoryBuilder duck-typing: engine accesses this.storyBuilder.db for story CRUD
    this.db = typeof RealmKit.StoryDatabase === 'function'
        ? new RealmKit.StoryDatabase() : null;

    this._build();
    this._bindKeys();
};

// ── Tile name lookup (matches DevPanel.TILE_NAMES) ──────────────────────────
RealmKit._RealmSidebarImpl.TILE_NAMES = {
    0:'Deep Water',   1:'Shallow Water', 2:'Beach',
    3:'Grass',        4:'Grass 2',       5:'Dirt',
    6:'Stone',        7:'Cliff',         8:'Mountain',
    9:'Snow',        10:'Road H',       11:'Road V',
    12:'Road Corner',13:'Bridge H',     14:'Bridge V',
    15:'Waterfall',  16:'Ruin Floor',   17:'Ruin Wall',
    18:'Bldg Floor', 19:'Bldg Wall',    20:'Door',
    21:'Tree',       22:'Bush',         23:'Rock',
    24:'Chest',      25:'Forest',       26:'Swamp',
    27:'Desert',     28:'Tundra',       29:'Wetland',
    30:'Meadow',     31:'Ancient'
};

RealmKit._RealmSidebarImpl.TILE_COLORS = {
    0:'#0a2a5a',1:'#1a4a8a',2:'#d4b878',3:'#4a8a3a',4:'#5a9a4a',
    5:'#a07840',6:'#7a7a7a',7:'#6a6060',8:'#909090',9:'#e8e8f0',
    10:'#c0a060',11:'#c0a060',12:'#c0a060',13:'#a0a060',14:'#a0a060',
    15:'#4090c0',16:'#605040',17:'#504030',18:'#a08060',19:'#806040',
    20:'#c08040',21:'#2a7020',22:'#3a6030',23:'#808070',24:'#c8a030',
    25:'#205010',26:'#3a5838',27:'#c8a050',28:'#a0c0e0',29:'#506848',
    30:'#70a040',31:'#8050a0'
};

RealmKit._RealmSidebarImpl.prototype = {

    // ─── Build DOM ───────────────────────────────────────────────────────
    _build: function() {
        var self = this;

        var style = document.createElement('style');
        style.textContent = this._css();
        document.head.appendChild(style);

        var el = document.createElement('div');
        el.id  = 'rs-root';
        el.innerHTML = this._html();
        document.body.appendChild(el);
        this.el = el;

        // Cache refs
        var ids = [
            // layout
            'rs-toggle','rs-main-panel',
            // main tabs
            'rs-tab-dev','rs-tab-map','rs-tab-story',
            'rs-pane-dev','rs-pane-map','rs-pane-story',
            // dev stats
            'rs-runtime','rs-fps','rs-frame-ms','rs-map-info',
            'rs-quick-time-of-day','rs-quick-time-of-day-v',
            'rs-sidebar-width','rs-sidebar-width-v',
            'rs-sidebar-scale','rs-sidebar-scale-v',
            'rs-pw-xy','rs-pt-xy','rs-pt-type',
            'rs-hp-txt','rs-hp-pct','rs-bar-hp',
            'rs-mp-txt','rs-mp-pct','rs-bar-mp',
            'rs-ct-xy','rs-ct-type','rs-ct-elev','rs-ct-moist','rs-ct-temp','rs-ct-col',
            'rs-mm-opacity','rs-mm-opacity-v',
            // map gen
            'rs-water','rs-water-v','rs-hill','rs-hill-v',
            'rs-mtn','rs-mtn-v','rs-escale','rs-escale-v',
            'rs-octaves','rs-octaves-v',
            'rs-moisture','rs-moisture-v','rs-temperature','rs-temperature-v',
            'rs-tsize','rs-preset','rs-mw','rs-mh',
            'rs-seed-disp','rs-regen','rs-same-seed','rs-map-popout',
            'rs-map-canvas','rs-map-canvas-lbl',
            // grimoire inputs that need cached refs
            'rs-tp-x','rs-tp-y','rs-set-hp','rs-set-mp',
            'rs-spawn-type','rs-spawn-count',
            'rs-time-of-day','rs-time-of-day-v','rs-weather',
            'rs-flag-key','rs-flag-val','rs-event-log','rs-dev-status'
            ,
            // story pane
            'rs-story-current','rs-story-status','rs-story-list','rs-story-refresh',
            // builder sub-tabs
            'rs-btab-maps','rs-btab-units','rs-btab-npcs','rs-btab-events',
            'rs-btab-factions','rs-btab-system',
            // builder panes (dynamic content)
            'rs-bpane-maps','rs-bpane-units','rs-bpane-npcs','rs-bpane-events',
            'rs-bpane-factions','rs-bpane-system'
        ];
        for (var i = 0; i < ids.length; i++) {
            this._e[ids[i]] = document.getElementById(ids[i]);
        }

        this._applySidebarWidth(this.sidebarWidth);
        this._applySidebarScale(this.sidebarScale);
        this._bindControls();
    },

    // ─── CSS ─────────────────────────────────────────────────────────────
    _css: function() {
        return [
            '@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");',

            /* ── Root wrapper — zero-width anchor at left edge ── */
            '#rs-root {',
            '  position: fixed; top: 0; left: 0; height: 100%; width: 0;',
            '  z-index: 10001;',
            '  --rs-scale: 1;',
            '  font-family: "Press Start 2P", monospace;',
            '  image-rendering: pixelated;',
            '  pointer-events: none;',
            '}',

            /* ── Main panel — slides in from left; toggle rides on its right edge ── */
            '#rs-main-panel {',
            '  pointer-events: all;',
            '  position: absolute; top: 0; left: 0; width: 420px; height: 100%;',
            '  display: flex; flex-direction: column;',
            '  transform: translateX(-100%) scale(var(--rs-scale));',       /* fully off-screen when closed */
            '  transform-origin: top left;',
            '  transition: transform 0.25s ease;',
            '  background:',
            '    repeating-linear-gradient(90deg, transparent 0px, transparent 5px, rgba(80,50,20,0.28) 5px, rgba(80,50,20,0.28) 6px),',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(60,35,15,0.2) 12px, rgba(60,35,15,0.2) 18px),',
            '    linear-gradient(180deg, #4a2810 0%, #2a1408 50%, #1a0c04 100%);',
            '  border-right: 5px solid #1a0800;',
            '  box-shadow: inset 0 2px 0 rgba(255,200,150,0.15), inset 0 -4px 0 rgba(0,0,0,0.4);',
            '}',
            '#rs-root.rs-open #rs-main-panel { transform: translateX(0) scale(var(--rs-scale)); }',

            /* ── Toggle tabs container ── */
            '#rs-toggles {',
            '  pointer-events: none;',
            '  position: absolute; top: 50%; right: -28px; transform: translateY(-50%);',
            '  display: flex; flex-direction: column; gap: 4px;',
            '}',
            
            /* ── Individual toggle tabs ── */
            '.rs-toggle-tab {',
            '  pointer-events: all;',
            '  width: 28px; min-height: 80px;',
            '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
            '  gap: 4px; padding: 12px 0;',
            '  background:',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(60,35,15,0.2) 12px, rgba(60,35,15,0.2) 18px),',
            '    linear-gradient(180deg, #4a2810 0%, #2a1408 50%, #1a0c04 100%);',
            '  border: 2px solid #5a3c20; border-left: none;',
            '  border-radius: 0 6px 6px 0;',
            '  box-shadow: 4px 0 0 0 #1a0800, inset 0 1px 0 rgba(255,200,150,0.15);',
            '  cursor: pointer; transition: all 0.2s;',
            '}',
            '.rs-toggle-tab:hover {',
            '  background:',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(60,35,15,0.2) 12px, rgba(60,35,15,0.2) 18px),',
            '    linear-gradient(180deg, #5a3820 0%, #3a1e0c 50%, #2a1008 100%);',
            '}',
            
            '/* Active mode styling - Builder tab gets blue tint when active */',
            '.rs-toggle-tab.rs-active {',
            '  background:',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(40,50,80,0.3) 12px, rgba(40,50,80,0.3) 18px),',
            '    linear-gradient(180deg, #3a4868 0%, #2a3858 50%, #1a2848 100%);',
            '  border-color: #4a6898;',
            '}',
            '.rs-toggle-tab.rs-active:hover {',
            '  background:',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(40,50,80,0.3) 12px, rgba(40,50,80,0.3) 18px),',
            '    linear-gradient(180deg, #4a5888 0%, #3a4878 50%, #2a3868 100%);',
            '}',
            
            '.rs-toggle-label {',
            '  font-size: 9px; color: #c8a840;',
            '  text-shadow: 0 0 6px rgba(200,168,64,0.5);',
            '  writing-mode: vertical-rl; text-orientation: mixed;',
            '  letter-spacing: 2px; user-select: none;',
            '}',
            '.rs-toggle-tab.rs-active .rs-toggle-label {',
            '  color: #a8c8f0;',
            '  text-shadow: 0 0 6px rgba(120,168,240,0.5);',
            '}',
            '.rs-toggle-arrow {',
            '  font-size: 11px; color: #c8a840; user-select: none;',
            '  transition: transform 0.25s;',
            '}',
            '.rs-toggle-tab.rs-active .rs-toggle-arrow {',
            '  color: #a8c8f0;',
            '}',
            '/* closed → ▶ points right (open me); open → ◀ points left (close me) */',
            '#rs-root.rs-open .rs-toggle-arrow { transform: scaleX(-1); }',

            /* ── Panel header ── */
            '#rs-header {',
            '  flex-shrink: 0; padding: 10px 12px 8px;',
            '  display: flex; align-items: center; gap: 8px;',
            '  border-bottom: 3px solid #1a0800;',
            '  box-shadow: 0 2px 0 rgba(0,0,0,0.4);',
            '}',
            '.rs-diamond { font-size: 8px; color: #c8a840; opacity: 0.7; flex-shrink: 0; }',
            '#rs-title {',
            '  font-size: 9px; color: #c8a840; letter-spacing: 3px;',
            '  text-shadow: 0 0 8px rgba(200,168,64,0.35), 2px 2px 0 rgba(0,0,0,0.8);',
            '  flex: 1;',
            '}',
            '#rs-subtitle { font-size: 6px; color: #907860; letter-spacing: 2px; }',

            /* ── Main tab row ── */
            '#rs-tabs {',
            '  flex-shrink: 0; display: flex; gap: 3px; padding: 6px 8px 0;',
            '  background: linear-gradient(180deg, #2a1808 0%, #1a0c04 100%);',
            '  border-bottom: 3px solid #1a0800;',
            '}',
            '.rs-tab {',
            '  flex: 1; padding: 7px 4px;',
            '  font-family: "Press Start 2P", monospace; font-size: 7px;',
            '  text-transform: uppercase; letter-spacing: 1px;',
            '  background: linear-gradient(180deg, #3a3848 0%, #2a2838 50%, #1a1828 100%);',
            '  border: 2px solid #3a3848; border-bottom-width: 3px;',
            '  box-shadow: 0 3px 0 0 #0a0818;',
            '  color: #907860; cursor: pointer; text-align: center;',
            '  transition: all 0.05s; user-select: none;',
            '}',
            '.rs-tab.rs-active {',
            '  background: linear-gradient(180deg, #5868a8 0%, #4858a8 50%, #3848a8 100%);',
            '  color: #f0f0ff; border-color: #3848a8;',
            '  box-shadow: 0 3px 0 0 #181828;',
            '}',
            '.rs-tab:hover:not(.rs-active) {',
            '  background: linear-gradient(180deg, #4a4858 0%, #3a3848 50%, #2a2838 100%);',
            '  color: #e8d8c8; border-color: #5a5868;',
            '}',

            /* ── Pane container ── */
            '#rs-panes {',
            '  flex: 1; min-height: 0; overflow: hidden; position: relative;',
            '}',
            '.rs-pane {',
            '  position: absolute; inset: 0;',
            '  display: none; flex-direction: column;',
            '  overflow-y: auto; overflow-x: hidden;',
            '  /* Parchment inner */',
            '  background:',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(139,90,43,0.04) 2px, rgba(139,90,43,0.04) 3px),',
            '    repeating-linear-gradient(90deg, transparent 0px, transparent 5px, rgba(139,90,43,0.03) 5px, rgba(139,90,43,0.03) 6px),',
            '    linear-gradient(180deg, #e8d8b8 0%, #d4c4a0 40%, #c8b890 100%);',
            '  box-shadow: inset 4px 4px 0 rgba(0,0,0,0.08), inset -4px -4px 0 rgba(255,255,255,0.18);',
            '}',
            '.rs-pane.rs-active { display: flex; }',

            /* Parchment scrollbar */
            '.rs-pane::-webkit-scrollbar { width: 10px; }',
            '.rs-pane::-webkit-scrollbar-track { background: #b8a880; box-shadow: inset 2px 2px 4px rgba(0,0,0,0.15); }',
            '.rs-pane::-webkit-scrollbar-thumb {',
            '  background: linear-gradient(180deg, #6a5040 0%, #5a4030 50%, #4a3020 100%);',
            '  border: 2px solid #b8a880;',
            '}',

            /* ── Section header ── */
            '.rs-sec-hdr {',
            '  font-size: 7px; font-weight: bold; letter-spacing: 2px;',
            '  text-transform: uppercase;',
            '  color: #f8e8c8;',
            '  background: linear-gradient(180deg, #3a3848 0%, #2a2838 50%, #1a1828 100%);',
            '  padding: 5px 10px;',
            '  border-bottom: 2px solid #1a1828;',
            '  box-shadow: 0 2px 0 0 #0a0818;',
            '  flex-shrink: 0;',
            '  display: flex; justify-content: space-between; align-items: center;',
            '  cursor: pointer; user-select: none;',
            '}',
            '.rs-sec-hdr:hover { background: linear-gradient(180deg, #4a4858 0%, #3a3848 50%, #2a2838 100%); }',
            '.rs-caret { font-size: 7px; transition: transform 0.18s; flex-shrink: 0; opacity: 0.7; }',
            '.rs-sec-hdr.rs-sec-closed .rs-caret { transform: rotate(-90deg); }',
            '.rs-sec-body { padding: 7px 10px; display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }',
            '.rs-sec-body.rs-sec-closed { display: none; }',

            /* ── Stat rows ── */
            '.rs-row { display: flex; justify-content: space-between; align-items: center; font-size: 8px; }',
            '.rs-lbl { color: #4a3020; }',
            '.rs-val { color: #2a1408; font-family: "Press Start 2P", monospace; font-size: 7px; font-weight: bold; }',

            /* ── HP/MP bars ── */
            '.rs-bar-wrap {',
            '  height: 7px; background: rgba(0,0,0,0.15);',
            '  border: 1px solid #8a7060; overflow: hidden; border-radius: 1px;',
            '}',
            '.rs-bar { height: 100%; transition: width 0.2s; }',

            /* ── Slider rows ── */
            '.rs-sl-row { display: flex; align-items: center; gap: 5px; }',
            '.rs-sl-lbl { width: 90px; color: #4a3020; font-size: 7px; flex-shrink: 0; }',
            '.rs-sl-row input[type=range] { flex: 1; accent-color: #8a5020; height: 11px; }',
            '.rs-sl-val { width: 34px; text-align: right; color: #2a1408; font-size: 6px; font-family: "Press Start 2P"; }',

            /* ── Selects / Number inputs ── */
            '.rs-select {',
            '  width: 100%; background: #f0e8d8;',
            '  border: 2px solid #8a7060; border-bottom-width: 3px;',
            '  color: #2a1408; font-size: 8px; padding: 3px 5px;',
            '  font-family: "Press Start 2P", monospace;',
            '  box-shadow: 0 3px 0 0 #6a5040;',
            '}',
            '.rs-num-row { display: flex; align-items: center; gap: 5px; }',
            '.rs-num-lbl { width: 90px; color: #4a3020; font-size: 7px; flex-shrink: 0; }',
            '.rs-num-row input[type=number] {',
            '  flex: 1; background: #f0e8d8;',
            '  border: 2px solid #8a7060; border-bottom-width: 3px;',
            '  color: #2a1408; font-size: 6px; padding: 2px 4px;',
            '  font-family: "Press Start 2P", monospace;',
            '}',
            '.rs-num-unit { font-size: 7px; color: #6a5040; flex-shrink: 0; }',

            /* ── Seed bar ── */
            '.rs-seed-bar {',
            '  display: flex; justify-content: space-between; align-items: center;',
            '  padding: 5px 10px; background: #c8b890;',
            '  border-top: 1px solid #a09070; border-bottom: 1px solid #a09070;',
            '  font-size: 7px;',
            '}',
            '.rs-seed-lbl { color: #6a5040; }',
            '.rs-seed-val { color: #2a1408; font-family: "Press Start 2P"; font-size: 6px; font-weight: bold; }',

            /* ── Action buttons ── */
            '.rs-actions { padding: 7px 10px; display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }',
            '.rs-btn {',
            '  font-family: "Press Start 2P", monospace; font-size: 8px;',
            '  padding: 9px 12px; border: none; cursor: pointer;',
            '  text-align: center; transition: all 0.05s;',
            '}',
            '.rs-btn-green {',
            '  background: linear-gradient(180deg, #286020 0%, #184010 50%, #102808 100%);',
            '  color: #90c890;',
            '  box-shadow: 0 4px 0 0 #0a1808, inset 0 1px 0 rgba(144,200,144,0.2);',
            '}',
            '.rs-btn-green:hover { background: linear-gradient(180deg, #387030 0%, #286020 50%, #184010 100%); }',
            '.rs-btn-green:active { transform: translateY(4px); box-shadow: 0 0 0 0 #0a1808; }',
            '.rs-btn-slate {',
            '  background: linear-gradient(180deg, #4a4a58 0%, #3a3a48 50%, #2a2a38 100%);',
            '  color: #c8c8d8;',
            '  box-shadow: 0 4px 0 0 #1a1a28, inset 0 1px 0 rgba(255,255,255,0.07);',
            '}',
            '.rs-btn-slate:hover { background: linear-gradient(180deg, #5a5a68 0%, #4a4a58 50%, #3a3a48 100%); }',
            '.rs-btn-slate:active { transform: translateY(4px); box-shadow: 0 0 0 0 #1a1a28; }',
            '.rs-btn-gold {',
            '  background: linear-gradient(180deg, #a87030 0%, #885020 50%, #683010 100%);',
            '  color: #f8e8d0;',
            '  box-shadow: 0 4px 0 0 #301008, inset 0 1px 0 rgba(255,220,180,0.2);',
            '}',
            '.rs-btn-gold:hover { background: linear-gradient(180deg, #b88040 0%, #986030 50%, #784020 100%); }',
            '.rs-btn-gold:active { transform: translateY(4px); box-shadow: 0 0 0 0 #301008; }',
            '.rs-btn-red {',
            '  background: linear-gradient(180deg, #a04040 0%, #803030 50%, #602020 100%);',
            '  color: #ffd0d0;',
            '  box-shadow: 0 4px 0 0 #301010, inset 0 1px 0 rgba(255,180,180,0.2);',
            '}',
            '.rs-btn-red:hover { background: linear-gradient(180deg, #b05050 0%, #904040 50%, #703030 100%); }',
            '.rs-btn-red:active { transform: translateY(4px); box-shadow: 0 0 0 0 #301010; }',

            /* ── Map preview canvas ── */
            '#rs-map-canvas-wrap {',
            '  margin: 0 10px; flex-shrink: 0;',
            '  display: flex; align-items: center; justify-content: center;',
            '  height: 160px; overflow: hidden;',
            '  background: #1a1408;',
            '  border: 2px solid #8a7060; border-bottom-width: 3px;',
            '  box-shadow: 0 3px 0 0 #6a5040;',
            '}',
            '#rs-map-canvas { image-rendering: pixelated; max-width: 100%; max-height: 160px; display: block; }',
            '#rs-map-canvas-lbl { font-size: 6px; color: #6a5040; text-align: center; padding: 4px 10px 6px; flex-shrink: 0; }',


            /* ── Tool rows (label + control) ── */
            '.rs-tool-row { display: flex; align-items: center; gap: 5px; margin: 2px 0; }',
            '.rs-tl { font-size: 6px; color: #4a3020; min-width: 36px; flex-shrink: 0; text-transform: uppercase; }',
            '.rs-num-input { width: 56px; font-family: "Press Start 2P",monospace; font-size: 7px;',
            '  padding: 4px 5px; background: #f8f0e8; border: 2px solid #a89080; color: #2a1408;',
            '  border-bottom-width: 3px; }',
            '.rs-text-input { flex: 1; font-family: "Press Start 2P",monospace; font-size: 7px;',
            '  padding: 4px 6px; background: #f8f0e8; border: 2px solid #a89080; color: #2a1408;',
            '  border-bottom-width: 3px; }',

            /* ── Small inline button ── */
            '.rs-btn-sm { font-family: "Press Start 2P",monospace; font-size: 6px; padding: 4px 8px;',
            '  border: 2px solid; border-bottom-width: 3px; cursor: pointer; letter-spacing: 0px; }',
            '.rs-btn-sm.rs-btn-green { background:#3a2a18;border-color:#87663b;color:#c8a84b;box-shadow:0 3px 0 0 #1a0c04; }',
            '.rs-btn-sm.rs-btn-green:active { transform:translateY(3px);box-shadow:none;border-bottom-width:0; }',

            /* ── Inline number input (used in testing sections) ── */
            '.rs-inline-num { width: 52px; font-family: "Press Start 2P",monospace; font-size: 6px;',
            '  padding: 3px 4px; background: #f0e8d8;',
            '  border: 2px solid #8a7060; border-bottom-width: 3px; color: #2a1408; }',

            /* ── Inline button next to a number input ── */
            '.rs-ibtn { font-family: "Press Start 2P",monospace; font-size: 6px; padding: 4px 7px;',
            '  border: 2px solid; border-bottom-width: 3px; cursor: pointer; white-space: nowrap; }',
            '.rs-ibtn.rs-btn-green { background:#3a2a18;border-color:#87663b;color:#c8a84b;box-shadow:0 3px 0 0 #1a0c04; }',
            '.rs-ibtn.rs-btn-green:active { transform:translateY(3px);box-shadow:none;border-bottom-width:0; }',
            '.rs-ibtn.rs-btn-red { background:#3a1010;border-color:#804040;color:#f08080;box-shadow:0 3px 0 0 #180808; }',
            '.rs-ibtn.rs-btn-red:active { transform:translateY(3px);box-shadow:none;border-bottom-width:0; }',

            /* ── Sub-section label within a body (divider label) ── */
            '.rs-sub-lbl { font-size: 6px; color: #6a5040; text-align: center;',
            '  padding: 3px 0 1px; letter-spacing: 2px; text-transform: uppercase;',
            '  border-top: 1px dashed rgba(100,70,40,0.35); margin-top: 2px; }',

            /* ── Log output box ── */
            '.rs-log-box { margin-top: 6px; padding: 8px 10px;',
            '  background: #1a1208; border: 1px solid #3a2810; color: #e8d7a4;',
            '  font: 7px "Press Start 2P",monospace; min-height: 24px; max-height: 120px;',
            '  overflow-y: auto; line-height: 1.7; }',
            '#rs-event-log { min-height: 240px; max-height: 320px; font-size: 10px; line-height: 1.75; }',

            /* ── Grimoire status bar ── */

            '.rs-empty-state { font-size: 7px; color: #6a5040; text-align: center; padding: 25px 10px; line-height: 2; }',

            /* ── Dev pane status bar ── */
            '#rs-dev-status { flex-shrink: 0; padding: 4px 10px; font-size: 6px;',
            '  color: #8a7060; background: rgba(0,0,0,0.35); border-top: 1px solid #1a1828;',
            '  letter-spacing: 1px; font-family: "Press Start 2P", monospace; }',

            /* ── Hint badge (replaces DevPanel hint) ── */
            '#rs-hint {',
            '  position: fixed; bottom: 8px; left: 8px;',
            '  background: repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
            '  border: 3px solid #1a0800; color: #c8b890;',
            '  font: 6px "Press Start 2P"; padding: 4px 8px; z-index: 10000;',
            '  box-shadow: inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);',
            '  pointer-events: none;',
            '}',

            /* ── Builder panel UI (rs-b-*) ── */
            '.rs-b-toolbar { display:flex; gap:4px; padding:7px 8px; flex-shrink:0;',
            '  background:rgba(0,0,0,0.25); border-bottom:1px solid rgba(60,30,10,0.5); }',
            '.rs-b-list { overflow-y:auto; padding:6px 8px; }',
            '.rs-b-row { display:flex; align-items:center; gap:4px; padding:5px 8px;',
            '  background:rgba(255,248,230,0.04); border:1px solid rgba(90,60,30,0.3);',
            '  border-radius:2px; margin-bottom:3px; cursor:pointer; transition:background 0.15s; }',
            '.rs-b-row:hover { background:rgba(200,168,64,0.1); border-color:rgba(200,168,64,0.35); }',
            '.rs-b-row-active { background:rgba(60,180,100,0.1); border-color:rgba(80,220,120,0.35); }',
            '.rs-b-row-name { flex:1; font-size:7px; color:#d8c090;',
            '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.rs-b-row-del { font-size:8px; color:#5a3020; cursor:pointer;',
            '  padding:1px 5px; border-radius:2px; flex-shrink:0; }',
            '.rs-b-row-del:hover { color:#e04040; background:rgba(200,60,40,0.2); }',
            '.rs-b-import { padding:8px; background:rgba(0,0,0,0.3);',
            '  border-bottom:1px solid rgba(60,30,10,0.5); }',
            '.rs-b-form { padding:8px; overflow-y:auto; }',
            '.rs-b-form-hdr { display:flex; align-items:center; gap:8px; margin-bottom:10px;',
            '  padding-bottom:6px; border-bottom:1px solid rgba(90,60,30,0.4); }',
            '.rs-b-field { margin-bottom:8px; }',
            '.rs-b-field-lbl { display:block; font-size:6px; color:#907860;',
            '  letter-spacing:1px; text-transform:uppercase; margin-bottom:3px; }',
            '.rs-b-input { width:100%; box-sizing:border-box; background:#0e0a06; color:#d8c890;',
            '  border:1px solid #4a3020; padding:4px 6px;',
            '  font-family:"Press Start 2P",monospace; font-size:7px; outline:none;',
            '  transition:border-color 0.15s; }',
            '.rs-b-input:focus { border-color:#c8a840; }',
            'textarea.rs-b-input { resize:vertical; }',
            '.rs-b-hint { font-size:6px; color:#5a4530; margin-top:2px; font-family:monospace; letter-spacing:0; }',

            /* ── Builder tools footer ── */
            '#rs-builder-footer { flex-shrink:0; display:flex; gap:4px; padding:6px 8px;',
            '  background:linear-gradient(180deg,#1a0c04 0%,#120804 100%);',
            '  border-top:2px solid #1a0800; }',
            '#rs-builder-footer a { flex:1; text-align:center; text-decoration:none;',
            '  font-size:6px; padding:5px 2px; letter-spacing:0.5px; }',

            /* ── Realm Studio workspace ── */
            '.rs-studio-wrap { display:flex; flex-direction:column; gap:8px; padding:10px; min-height:0; }',
            '.rs-studio-hero { background:rgba(26,12,4,0.72); border:2px solid #5a3c20; box-shadow:0 3px 0 0 #1a0800; padding:10px; }',
            '.rs-studio-kicker { font-size:6px; color:#c8a840; letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }',
            '.rs-studio-title { font-size:9px; color:#f0e8d8; margin-bottom:5px; letter-spacing:1px; }',
            '.rs-studio-desc { font-size:6px; color:#d8c090; line-height:1.9; }',
            '.rs-studio-crumbs { margin-top:8px; font-size:6px; color:#a09070; line-height:1.8; }',
            '.rs-studio-grid { display:grid; grid-template-columns:1fr; gap:8px; }',
            '.rs-studio-card { background:rgba(255,248,232,0.58); border:1px solid rgba(90,60,30,0.55); box-shadow:inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 0 rgba(60,40,20,0.18); padding:9px 10px; }',
            '.rs-studio-card-hdr { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:6px; }',
            '.rs-studio-card-title { font-size:8px; color:#2a1408; line-height:1.5; }',
            '.rs-studio-card-meta { font-size:6px; color:#7a6040; text-align:right; line-height:1.6; max-width:120px; }',
            '.rs-studio-card-desc { font-size:6px; color:#4a3020; line-height:1.9; margin-bottom:8px; }',
            '.rs-studio-actions { display:flex; flex-wrap:wrap; gap:4px; }',
            '.rs-studio-actions .rs-btn { flex:1; min-width:110px; padding:7px 8px; font-size:6px; }',
            '.rs-studio-note { font-size:6px; color:#6a5040; line-height:1.8; margin-top:6px; }',
            '.rs-studio-divider { height:1px; background:rgba(90,60,30,0.28); margin:2px 0 0; }'

        ].join('\n');
    },

    // ─── HTML ─────────────────────────────────────────────────────────────
    _html: function() {
        return [
            /* ── Main panel — toggle lives inside so it travels with the panel ── */
            '<div id="rs-main-panel">',

            '  <div id="rs-toggles">',
            '    <div id="rs-toggle-dev" class="rs-toggle-tab rs-active" title="Dev Tools (` or F2)" onclick="RealmKit._sidebar._setMode(\'dev\')">',
            '      <span class="rs-toggle-arrow">▶</span>',
            '      <span class="rs-toggle-label">Dev Tools</span>',
            '    </div>',
            '    <div id="rs-toggle-builder" class="rs-toggle-tab" title="Story Builder (F4)" onclick="RealmKit._sidebar._setMode(\'builder\')">',
            '      <span class="rs-toggle-arrow">▶</span>',
            '      <span class="rs-toggle-label">Builder</span>',
            '    </div>',
            '  </div>',

            '  <div id="rs-header">',
            '    <span class="rs-diamond">◈</span>',
            '    <span id="rs-title">RealmKit</span>',
            '    <span class="rs-diamond">◈</span>',
            '    <span id="rs-subtitle">STUDIO</span>',
            '  </div>',

            '  <div id="rs-tabs">',
            '    <div class="rs-tab rs-active" id="rs-tab-dev" onclick="RealmKit._sidebar._switchTab(\'dev\')">⚙ Dev</div>',
            '    <div class="rs-tab"           id="rs-tab-map" onclick="RealmKit._sidebar._switchTab(\'map\')">🗺 Map</div>',
            '  </div>',

            '  <div id="rs-panes">',

            /* ── DEV PANE ── */
            '    <div class="rs-pane rs-active" id="rs-pane-dev">',

            '      <div class="rs-sec-hdr">⏱ World</div>',
            '      <div class="rs-sec-body">',
            '        <div class="rs-row"><span class="rs-lbl">Runtime</span><span class="rs-val" id="rs-runtime">--:--:--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">FPS</span><span class="rs-val" id="rs-fps">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Frame ms</span><span class="rs-val" id="rs-frame-ms">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Map size</span><span class="rs-val" id="rs-map-info">--</span></div>',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">Time of Day</span>',
            '          <input type="range" id="rs-quick-time-of-day" min="0" max="23" value="12">',
            '          <span class="rs-sl-val" id="rs-quick-time-of-day-v">12:00</span>',
            '        </div>',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">Sidebar Width</span>',
            '          <input type="range" id="rs-sidebar-width" min="340" max="640" value="420">',
            '          <span class="rs-sl-val" id="rs-sidebar-width-v">420px</span>',
            '        </div>',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">Sidebar Scale</span>',
            '          <input type="range" id="rs-sidebar-scale" min="80" max="170" value="100">',
            '          <span class="rs-sl-val" id="rs-sidebar-scale-v">1.00x</span>',
            '        </div>',
            '      </div>',

            '      <div class="rs-sec-hdr">🧙 Player</div>',
            '      <div class="rs-sec-body">',
            '        <div class="rs-row"><span class="rs-lbl">World XY</span><span class="rs-val" id="rs-pw-xy">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Tile XY</span><span class="rs-val" id="rs-pt-xy">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Tile type</span><span class="rs-val" id="rs-pt-type">--</span></div>',
            '        <div class="rs-row" style="margin-top:3px">',
            '          <span class="rs-lbl">HP <span id="rs-hp-txt" style="color:#c84040"></span></span>',
            '          <span class="rs-val" id="rs-hp-pct" style="color:#c84040">--</span>',
            '        </div>',
            '        <div class="rs-bar-wrap"><div class="rs-bar" id="rs-bar-hp" style="width:0%;background:#2ecc71"></div></div>',
            '        <div class="rs-row">',
            '          <span class="rs-lbl">MP <span id="rs-mp-txt" style="color:#2980b9"></span></span>',
            '          <span class="rs-val" id="rs-mp-pct" style="color:#2980b9">--</span>',
            '        </div>',
            '        <div class="rs-bar-wrap"><div class="rs-bar" id="rs-bar-mp" style="width:0%;background:#2980b9"></div></div>',
            '      </div>',

            '      <div class="rs-sec-hdr">🖱 Cursor Tile</div>',
            '      <div class="rs-sec-body">',
            '        <div class="rs-row"><span class="rs-lbl">Tile XY</span><span class="rs-val" id="rs-ct-xy">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Type</span><span class="rs-val" id="rs-ct-type">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Elevation</span><span class="rs-val" id="rs-ct-elev">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Moisture</span><span class="rs-val" id="rs-ct-moist">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Temperature</span><span class="rs-val" id="rs-ct-temp">--</span></div>',
            '        <div class="rs-row"><span class="rs-lbl">Collision</span><span class="rs-val" id="rs-ct-col">--</span></div>',
            '      </div>',

            '      <div class="rs-sec-hdr">🗺 Minimap</div>',
            '      <div class="rs-sec-body">',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">Opacity</span>',
            '          <input type="range" id="rs-mm-opacity" min="0" max="100" value="100">',
            '          <span class="rs-sl-val" id="rs-mm-opacity-v">100%</span>',
            '        </div>',
            '      </div>',

            /* ─────────────────────────────────────────────
               TESTING SECTIONS (all collapsed by default)
               ───────────────────────────────────────────── */

            /* ── TELEPORT ── */
            '      <div class="rs-sec-hdr rs-sec-closed">📍 Teleport <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">X</span><input id="rs-tp-x" type="number" value="256" class="rs-inline-num">',
            '          <span class="rs-sl-lbl" style="width:18px;text-align:center;">Y</span><input id="rs-tp-y" type="number" value="256" class="rs-inline-num">',
            '        </div>',
            '        <div class="rs-row"><span class="rs-lbl">Cursor world pos</span><span class="rs-val" id="rs-tp-cursor-xy">--</span></div>',
            '        <button class="rs-btn rs-btn-green" id="rs-tp-btn">⊕ Teleport to X/Y</button>',
            '        <button class="rs-btn rs-btn-slate" id="rs-tp-cursor-btn">⊕ Teleport to Cursor</button>',
            '      </div>',

            /* ── HEALTH & COMBAT ── */
            '      <div class="rs-sec-hdr rs-sec-closed">❤️ Health &amp; Combat <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Set HP</span>',
            '          <input id="rs-set-hp" type="number" value="100" min="0" class="rs-inline-num">',
            '          <button class="rs-ibtn rs-btn-green" id="rs-set-hp-btn">Set</button>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Set MP</span>',
            '          <input id="rs-set-mp" type="number" value="100" min="0" class="rs-inline-num">',
            '          <button class="rs-ibtn rs-btn-green" id="rs-set-mp-btn">Set</button>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Deal Dmg</span>',
            '          <input id="rs-deal-dmg" type="number" value="10" min="1" class="rs-inline-num">',
            '          <button class="rs-ibtn rs-btn-red" id="rs-deal-dmg-btn">Hit</button>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Crit Mult</span>',
            '          <input id="rs-crit-mult" type="number" value="2" min="1" max="10" class="rs-inline-num">',
            '          <button class="rs-ibtn rs-btn-red" id="rs-deal-crit-btn">Crit</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-green" id="rs-cheat-heal" style="flex:1">💚 Full Heal</button>',
            '          <button class="rs-btn rs-btn-green" id="rs-cheat-mana" style="flex:1">💙 Full Mana</button>',
            '        </div>',
            '        <button class="rs-btn rs-btn-gold" id="rs-cheat-gold">💰 Add 999 Gold</button>',
            '      </div>',

            /* ── CONSUMABLES / BUFFS ── */
            '      <div class="rs-sec-hdr rs-sec-closed">💊 Consumables &amp; Buffs <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sub-lbl">— Potions —</div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-green" id="rs-pot-hp-sm"  style="flex:1">HP Sm</button>',
            '          <button class="rs-btn rs-btn-green" id="rs-pot-hp-md"  style="flex:1">HP Md</button>',
            '          <button class="rs-btn rs-btn-green" id="rs-pot-hp-lg"  style="flex:1">HP Lg</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-green" id="rs-pot-mp-sm"  style="flex:1">MP Sm</button>',
            '          <button class="rs-btn rs-btn-green" id="rs-pot-mp-md"  style="flex:1">MP Md</button>',
            '          <button class="rs-btn rs-btn-green" id="rs-pot-mp-lg"  style="flex:1">MP Lg</button>',
            '        </div>',
            '        <div class="rs-sub-lbl">— Buff / Debuff —</div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-gold"  id="rs-buff-str"   style="flex:1">⚔ Str</button>',
            '          <button class="rs-btn rs-btn-gold"  id="rs-buff-spd"   style="flex:1">💨 Spd</button>',
            '          <button class="rs-btn rs-btn-gold"  id="rs-buff-def"   style="flex:1">🛡 Def</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-debuff-poi" style="flex:1">☠ Poison</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-debuff-frz" style="flex:1">❄ Freeze</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-debuff-brn" style="flex:1">🔥 Burn</button>',
            '        </div>',
            '        <button class="rs-btn rs-btn-red" id="rs-clear-buffs">✕ Clear All Buffs</button>',
            '      </div>',

            /* ── SPAWN ── */
            '      <div class="rs-sec-hdr rs-sec-closed">⚔️ Spawn <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Type</span>',
            '          <select class="rs-select" id="rs-spawn-type" style="flex:1">',
            '            <optgroup label="Enemies">',
            '              <option value="enemy_slime">🟢 Slime</option>',
            '              <option value="enemy_goblin">👺 Goblin</option>',
            '              <option value="enemy_skeleton">💀 Skeleton</option>',
            '              <option value="enemy_wolf">🐺 Wolf</option>',
            '              <option value="enemy_troll">🧌 Troll</option>',
            '              <option value="enemy_dragon">🐉 Dragon</option>',
            '            </optgroup>',
            '            <optgroup label="NPCs">',
            '              <option value="npc_villager">🧑 Villager</option>',
            '              <option value="npc_merchant">🛒 Merchant</option>',
            '              <option value="npc_guard">💂 Guard</option>',
            '            </optgroup>',
            '            <optgroup label="Items">',
            '              <option value="item_chest">📦 Chest</option>',
            '              <option value="item_hp_potion">🧪 HP Potion</option>',
            '              <option value="item_mp_potion">💧 MP Potion</option>',
            '              <option value="item_gold">💰 Gold Pile</option>',
            '            </optgroup>',
            '            <optgroup label="Objects">',
            '              <option value="obj_campfire">🔥 Campfire</option>',
            '              <option value="obj_mushroom">🍄 Cave Shroom</option>',
            '              <option value="obj_torch">🕯 Torch</option>',
            '              <option value="obj_crystal">💎 Crystal</option>',
            '            </optgroup>',
            '          </select>',
            '        </div>',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">Count</span>',
            '          <input id="rs-spawn-count" type="number" value="1" min="1" max="20" class="rs-inline-num">',
            '          <span class="rs-sl-lbl" style="width:30px">Lvl</span>',
            '          <input id="rs-spawn-level" type="number" value="1" min="1" max="99" class="rs-inline-num">',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-green" id="rs-spawn-player" style="flex:1">⊕ At Player</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-spawn-cursor" style="flex:1">⊕ At Cursor</button>',
            '        </div>',
            '        <div id="rs-spawn-log" class="rs-log-box"></div>',
            '      </div>',

            /* ── SCREEN SHAKE ── */
            '      <div class="rs-sec-hdr rs-sec-closed">📳 Screen Shake <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Intensity</span>',
            '          <input type="range" id="rs-shake-intensity" min="1" max="30" value="8">',
            '          <span class="rs-sl-val" id="rs-shake-intensity-v">8</span>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Duration ms</span>',
            '          <input type="range" id="rs-shake-duration" min="50" max="1500" step="50" value="300">',
            '          <span class="rs-sl-val" id="rs-shake-duration-v">300</span>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-shake-hit"      style="flex:1">👊 Hit</button>',
            '          <button class="rs-btn rs-btn-red"   id="rs-shake-crit"     style="flex:1">💥 Crit</button>',
            '          <button class="rs-btn rs-btn-red"   id="rs-shake-heavy"    style="flex:1">💣 Heavy</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-shake-explosion" style="flex:1">🌋 Explosion</button>',
            '          <button class="rs-btn rs-btn-gold"  id="rs-shake-custom"   style="flex:1">Custom ↑</button>',
            '        </div>',
            '      </div>',

            /* ── LIGHTING ── */
            '      <div class="rs-sec-hdr rs-sec-closed">💡 Lighting <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Torch radius</span>',
            '          <input type="range" id="rs-light-radius" min="0" max="200" value="100">',
            '          <span class="rs-sl-val" id="rs-light-radius-v">100%</span>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Ambient</span>',
            '          <input type="range" id="rs-light-ambient" min="0" max="100" value="0">',
            '          <span class="rs-sl-val" id="rs-light-ambient-v">0%</span>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Red</span>',
            '          <input type="range" id="rs-light-r" min="0" max="255" value="255">',
            '          <span class="rs-sl-val" id="rs-light-r-v">255</span>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Green</span>',
            '          <input type="range" id="rs-light-g" min="0" max="255" value="200">',
            '          <span class="rs-sl-val" id="rs-light-g-v">200</span>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Blue</span>',
            '          <input type="range" id="rs-light-b" min="0" max="255" value="100">',
            '          <span class="rs-sl-val" id="rs-light-b-v">100</span>',
            '        </div>',
            '        <div id="rs-light-preview" style="height:12px;border-radius:3px;border:1px solid #8a7060;margin:2px 0;background:rgb(255,200,100)"></div>',
            '        <div class="rs-sub-lbl">— Presets —</div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-gold"  id="rs-light-campfire"  style="flex:1">🔥 Campfire</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-light-cave"      style="flex:1">🍄 Cave</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-light-moonlight" style="flex:1">🌙 Moon</button>',
            '          <button class="rs-btn rs-btn-green" id="rs-light-torch"     style="flex:1">🕯 Torch</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-light-crystal"   style="flex:1">💎 Crystal</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-light-default"   style="flex:1">☀ Default</button>',
            '        </div>',
            '        <button class="rs-btn rs-btn-green" id="rs-light-apply">✓ Apply Light Color</button>',
            '      </div>',

            /* ── VISUAL FX ── */
            '      <div class="rs-sec-hdr rs-sec-closed">💥 Visual FX <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sub-lbl">— Screen Flash —</div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-flash-damage" style="flex:1">🩸 Damage</button>',
            '          <button class="rs-btn rs-btn-green" id="rs-flash-heal"   style="flex:1">💚 Heal</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-flash-magic"  style="flex:1">✨ Magic</button>',
            '          <button class="rs-btn rs-btn-red"   id="rs-flash-death"  style="flex:1">💀 Death</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-flash-white"  style="flex:1">⚡ White</button>',
            '          <button class="rs-btn rs-btn-gold"  id="rs-flash-gold"   style="flex:1">🌟 Gold</button>',
            '        </div>',
            '        <div class="rs-sub-lbl">— Particles —</div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-red"   id="rs-pfx-fire"     style="flex:1">🔥 Fire</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-pfx-smoke"    style="flex:1">💨 Smoke</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-green" id="rs-pfx-heal"     style="flex:1">✨ Heal</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-pfx-magic"    style="flex:1">🌀 Magic</button>',
            '        </div>',
            '      </div>',

            /* ── WORLD STATE ── */
            '      <div class="rs-sec-hdr rs-sec-closed">🌤 World State <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Time of day</span>',
            '          <input type="range" id="rs-time-of-day" min="0" max="23" value="12">',
            '          <span class="rs-sl-val" id="rs-time-of-day-v">12:00</span>',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Weather</span>',
            '          <select class="rs-select" id="rs-weather" style="flex:1">',
            '            <option value="clear">☀️ Clear</option>',
            '            <option value="rain">🌧️ Rain</option>',
            '            <option value="snow">❄️ Snow</option>',
            '            <option value="fog">🌫️ Fog</option>',
            '            <option value="storm">⛈️ Storm</option>',
            '          </select>',
            '        </div>',
            '        <button class="rs-btn rs-btn-green" id="rs-apply-world">✓ Apply World State</button>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Camera</span>',
            '          <button class="rs-btn rs-btn-slate" id="rs-cam-snap" style="flex:1">📷 Snap to Player</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-cam-free" style="flex:1;margin-left:4px">🎥 Free</button>',
            '        </div>',
            '      </div>',

            /* ── TOGGLES / DEBUG ── */
            '      <div class="rs-sec-hdr rs-sec-closed">🔧 Debug Toggles <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-toggle-invincible" style="flex:1">🛡 Invincible</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-toggle-noclip"     style="flex:1">👻 Noclip</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-toggle-hitboxes"   style="flex:1">📐 Hitboxes</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-toggle-coords"     style="flex:1">🔢 Coords</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-toggle-collision"  style="flex:1">🚧 Collision</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-toggle-pathfind"   style="flex:1">🕸 Pathfind</button>',
            '        </div>',
            '      </div>',

            /* ── FLAGS ── */
            '      <div class="rs-sec-hdr rs-sec-closed">📜 Events <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sub-lbl">— Combat / loot / quest troubleshooting feed —</div>',
            '        <div id="rs-event-log" class="rs-log-box" style="max-height:320px"></div>',
            '      </div>',

            '      <div class="rs-sec-hdr rs-sec-closed">🏴 Flags <span class="rs-caret">▼</span></div>',
            '      <div class="rs-sec-body rs-sec-closed">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Key</span>',
            '          <input id="rs-flag-key" type="text" placeholder="flag_name" style="flex:1;font-family:\"Press Start 2P\",monospace;font-size:6px;padding:3px 5px;background:#f8f0e8;border:2px solid #a89080;color:#2a1408;">',
            '        </div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Value</span>',
            '          <input id="rs-flag-val" type="text" placeholder="true / 1 / any" style="flex:1;font-family:\"Press Start 2P\",monospace;font-size:6px;padding:3px 5px;background:#f8f0e8;border:2px solid #a89080;color:#2a1408;">',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-green" id="rs-flag-set" style="flex:1">✎ Set</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-flag-get" style="flex:1">? Read</button>',
            '          <button class="rs-btn rs-btn-red"   id="rs-flag-clear-all" style="flex:1">🗑 All</button>',
            '        </div>',
            '        <div style="display:flex;gap:4px">',
            '          <button class="rs-btn rs-btn-slate" id="rs-log-world"  style="flex:1">🌍 World</button>',
            '          <button class="rs-btn rs-btn-slate" id="rs-log-player" style="flex:1">🧍 Player</button>',
            '        </div>',
            '        <div id="rs-flag-out" class="rs-log-box"></div>',
            '      </div>',

            '      <div id="rs-dev-status">Ready</div>',

            '    </div>',  /* end #rs-pane-dev */

            /* ── MAP PANE ── */
            '    <div class="rs-pane" id="rs-pane-map">',

            '      <div class="rs-sec-hdr">⛰ Terrain</div>',
            '      <div class="rs-sec-body">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Water level</span><input type="range" id="rs-water" min="5" max="45" value="22"><span class="rs-sl-val" id="rs-water-v">0.22</span></div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Hill level</span><input type="range" id="rs-hill" min="55" max="88" value="78"><span class="rs-sl-val" id="rs-hill-v">0.78</span></div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Mtn level</span><input type="range" id="rs-mtn" min="70" max="97" value="88"><span class="rs-sl-val" id="rs-mtn-v">0.88</span></div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Elev. scale</span><input type="range" id="rs-escale" min="3" max="20" value="8"><span class="rs-sl-val" id="rs-escale-v">0.008</span></div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Octaves</span><input type="range" id="rs-octaves" min="2" max="8" value="5"><span class="rs-sl-val" id="rs-octaves-v">5</span></div>',
            '      </div>',

            '      <div class="rs-sec-hdr">🌡 Climate</div>',
            '      <div class="rs-sec-body">',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Moisture</span><input type="range" id="rs-moisture" min="1" max="10" value="5"><span class="rs-sl-val" id="rs-moisture-v">5</span></div>',
            '        <div class="rs-sl-row"><span class="rs-sl-lbl">Temperature</span><input type="range" id="rs-temperature" min="1" max="10" value="5"><span class="rs-sl-val" id="rs-temperature-v">5</span></div>',
            '      </div>',

            '      <div class="rs-sec-hdr">📐 Map Size</div>',
            '      <div class="rs-sec-body">',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">Preset</span>',
            '          <select class="rs-select" id="rs-preset">',
            '            <option value="">— custom —</option>',
            '            <option value="64x64">64 × 64</option>',
            '            <option value="128x64">128 × 64</option>',
            '            <option value="128x128">128 × 128</option>',
            '            <option value="256x128">256 × 128</option>',
            '            <option value="256x256" selected>256 × 256</option>',
            '            <option value="512x256">512 × 256</option>',
            '            <option value="512x512">512 × 512</option>',
            '          </select>',
            '        </div>',
            '        <div class="rs-num-row"><span class="rs-num-lbl">Width</span><input type="number" id="rs-mw" value="256" min="32" max="1024"><span class="rs-num-unit">tiles</span></div>',
            '        <div class="rs-num-row"><span class="rs-num-lbl">Height</span><input type="number" id="rs-mh" value="256" min="32" max="1024"><span class="rs-num-unit">tiles</span></div>',
            '        <div class="rs-sl-row">',
            '          <span class="rs-sl-lbl">Tile size</span>',
            '          <select class="rs-select" id="rs-tsize">',
            '            <option value="16">16 px</option>',
            '            <option value="32" selected>32 px</option>',
            '            <option value="48">48 px</option>',
            '            <option value="64">64 px</option>',
            '          </select>',
            '        </div>',
            '      </div>',

            '      <div class="rs-seed-bar">',
            '        <span class="rs-seed-lbl">Seed</span>',
            '        <span class="rs-seed-val" id="rs-seed-disp">--</span>',
            '      </div>',

            '      <div class="rs-sec-hdr">🖼 Preview</div>',
            '      <div id="rs-map-canvas-wrap">',
            '        <canvas id="rs-map-canvas"></canvas>',
            '      </div>',
            '      <div id="rs-map-canvas-lbl">No map loaded</div>',

            '      <div class="rs-actions">',
            '        <button class="rs-btn rs-btn-green" id="rs-regen">⟳ GENERATE NEW WORLD</button>',
            '        <button class="rs-btn rs-btn-slate" id="rs-same-seed">⟲ REGEN SAME SEED</button>',
            '        <button class="rs-btn rs-btn-gold" id="rs-map-popout">↗ OPEN MAP STUDIO</button>',
            '      </div>',

            '    </div>',  /* end #rs-pane-map */

            '  </div>',  /* end #rs-panes (Dev content) */

            /* ── Builder content — full flex column, shown when mode=builder ── */
            '  <div id="rs-builder-content" style="display:none;flex:1;flex-direction:column;overflow:hidden;min-height:0;">',

            /* Builder sub-tab strip */
            '    <div id="rs-btabs" style="flex-shrink:0;display:flex;flex-wrap:wrap;gap:2px;padding:5px 6px 0;background:linear-gradient(180deg,#2a1808 0%,#1a0c04 100%);border-bottom:3px solid #1a0800;">',
            '      <div class="rs-tab rs-active" id="rs-btab-maps"     onclick="RealmKit._sidebar._switchBuilderTab(\'maps\')">Maps</div>',
            '      <div class="rs-tab"           id="rs-btab-units"    onclick="RealmKit._sidebar._switchBuilderTab(\'units\')">Units</div>',
            '      <div class="rs-tab"           id="rs-btab-npcs"     onclick="RealmKit._sidebar._switchBuilderTab(\'npcs\')">NPCs</div>',
            '      <div class="rs-tab"           id="rs-btab-events"   onclick="RealmKit._sidebar._switchBuilderTab(\'events\')">Events</div>',
            '      <div class="rs-tab"           id="rs-btab-factions" onclick="RealmKit._sidebar._switchBuilderTab(\'factions\')">Factions</div>',
            '      <div class="rs-tab"           id="rs-btab-system"   onclick="RealmKit._sidebar._switchBuilderTab(\'system\')">System</div>',
            '    </div>',

            /* Builder pane container */
            '    <div id="rs-bpanes" style="flex:1;min-height:0;overflow:hidden;position:relative;">',
            '      <div class="rs-pane rs-active" id="rs-bpane-maps"></div>',
            '      <div class="rs-pane" id="rs-bpane-units"></div>',
            '      <div class="rs-pane" id="rs-bpane-npcs"></div>',
            '      <div class="rs-pane" id="rs-bpane-events"></div>',
            '      <div class="rs-pane" id="rs-bpane-factions"></div>',
            '      <div class="rs-pane" id="rs-bpane-system"></div>',

            '    </div>',  /* end #rs-bpanes */

            /* ── Builder tools footer ── */
            '    <div id="rs-builder-footer">',
              '      <a href="realm-studio.html" target="_blank" class="rs-btn rs-btn-gold">🪶 REALM STUDIO</a>',
            '      <a href="sprite-builder.html" target="_blank" class="rs-btn rs-btn-slate">🎨 PIXEL PAINTER</a>',
            '      <a href="audio-composer.html" target="_blank" class="rs-btn rs-btn-slate">🎵 MUSIC MAKER</a>',
            '      <a href="builder-templates/" target="_blank" class="rs-btn rs-btn-slate" title="JSON schema reference & LLM prompts for each section">📋 PROMPTS</a>',
            '    </div>',

            '  </div>',   /* end #rs-builder-content */

            '  <div id="rs-dev-status">Ready</div>',
            '</div>',   /* end #rs-main-panel */

        ].join('');
    },

    // ─── Event binding ────────────────────────────────────────────────────
    _bindControls: function() {
        var self = this;
        var e    = this._e;

        // Toggle button
        if (e['rs-toggle']) {
            e['rs-toggle'].addEventListener('click', function() { self.toggle(); });
        }

        // ── Dev: sliders ──
        this._devSlider('rs-mm-opacity', 'rs-mm-opacity-v', function(v) { return v + '%'; }, function(v) { if (self.engine) self.engine.minimapOpacity = v / 100; });
        this._devSlider('rs-sidebar-width', 'rs-sidebar-width-v', function(v) { return v + 'px'; }, function(v) {
            self._applySidebarWidth(v);
        });
        this._devSlider('rs-sidebar-scale', 'rs-sidebar-scale-v', function(v) { return (v / 100).toFixed(2) + 'x'; }, function(v) {
            self._applySidebarScale(v / 100);
        });

        // ── Map: sliders ──
        this._mapSlider('rs-water',       'rs-water-v',       function(v) { return (v/100).toFixed(2); });
        this._mapSlider('rs-hill',        'rs-hill-v',        function(v) { return (v/100).toFixed(2); });
        this._mapSlider('rs-mtn',         'rs-mtn-v',         function(v) { return (v/100).toFixed(2); });
        this._mapSlider('rs-escale',      'rs-escale-v',      function(v) { return (v/1000).toFixed(3); });
        this._mapSlider('rs-octaves',     'rs-octaves-v',     function(v) { return v; });
        this._mapSlider('rs-moisture',    'rs-moisture-v',    function(v) { return v; });
        this._mapSlider('rs-temperature', 'rs-temperature-v', function(v) { return v; });

        // Map preset
        if (e['rs-preset']) {
            e['rs-preset'].addEventListener('change', function() {
                var parts = this.value.split('x');
                if (parts.length === 2) { e['rs-mw'].value = parts[0]; e['rs-mh'].value = parts[1]; }
                self._mapDirty = true; self._scheduleMapPreview();
            });
        }
        ['rs-mw','rs-mh'].forEach(function(id) {
            if (e[id]) e[id].addEventListener('input', function() {
                e['rs-preset'].value = '';
                self._mapDirty = true;
            });
        });

        // Map regen buttons
        if (e['rs-regen'])     e['rs-regen'].addEventListener('click',     function() { self._regen(true);  });
        if (e['rs-same-seed']) e['rs-same-seed'].addEventListener('click', function() { self._regen(false); });
        if (e['rs-map-popout']) e['rs-map-popout'].addEventListener('click', function() { self._openMapPopout(); });

        // Story controls
        if (e['rs-story-refresh']) {
            e['rs-story-refresh'].addEventListener('click', function() {
                self._storyLoadList();
            });
        }
        // Collapsible section headers
        this._bindCollapsibles();

        // ── Teleport ──
        this._grimBtn('rs-tp-btn', function() { self._grimTeleport(); });
        this._grimBtn('rs-tp-cursor-btn', function() {
            if (!self.engine || !self.engine.player) { self._grimLog('No player'); return; }
            var x = self.engine.mouseWorldX || 0;
            var y = self.engine.mouseWorldY || 0;
            self.engine.player.x = x; self.engine.player.y = y;
            if (self.engine.camera) { self.engine.camera.x = x; self.engine.camera.y = y; }
            self._grimLog('Teleported to cursor: ' + Math.round(x) + ', ' + Math.round(y));
        });

        // ── Health & Combat ──
        this._grimBtn('rs-set-hp-btn', function() {
            var v = parseInt((document.getElementById('rs-set-hp')||{}).value, 10);
            if (!isNaN(v) && self.engine && self.engine.player && self.engine.player.combatStats) {
                self.engine.player.combatStats.hp = Math.max(0, v);
                self._grimLog('HP set to ' + v);
            }
        });
        this._grimBtn('rs-set-mp-btn', function() {
            var v = parseInt((document.getElementById('rs-set-mp')||{}).value, 10);
            if (!isNaN(v) && self.engine && self.engine.player && self.engine.player.combatStats) {
                self.engine.player.combatStats.mp = Math.max(0, v);
                self._grimLog('MP set to ' + v);
            }
        });
        this._grimBtn('rs-deal-dmg-btn', function() {
            var cs = self.engine && self.engine.player && self.engine.player.combatStats;
            if (!cs) { self._grimLog('No combatStats on player'); return; }
            var dmg = parseInt((document.getElementById('rs-deal-dmg')||{}).value || 10, 10);
            cs.hp = Math.max(0, cs.hp - dmg);
            self._grimLog('Hit player for ' + dmg + ' dmg → HP: ' + cs.hp + '/' + cs.maxHp);
        });
        this._grimBtn('rs-deal-crit-btn', function() {
            var cs = self.engine && self.engine.player && self.engine.player.combatStats;
            if (!cs) { self._grimLog('No combatStats on player'); return; }
            var mult = parseFloat((document.getElementById('rs-crit-mult')||{}).value || 2);
            var base = parseInt((document.getElementById('rs-deal-dmg')||{}).value || 10, 10);
            var dmg = Math.round(base * mult);
            cs.hp = Math.max(0, cs.hp - dmg);
            self._grimLog('CRIT ×' + mult + ' = ' + dmg + ' dmg → HP: ' + cs.hp + '/' + cs.maxHp);
        });
        this._grimBtn('rs-cheat-heal', function() {
            var cs = self.engine && self.engine.player && self.engine.player.combatStats;
            if (cs) { cs.hp = cs.maxHp; self._grimLog('Full heal → HP: ' + cs.hp); }
        });
        this._grimBtn('rs-cheat-mana', function() {
            var cs = self.engine && self.engine.player && self.engine.player.combatStats;
            if (cs) { cs.mp = cs.maxMp; self._grimLog('Full mana → MP: ' + cs.mp); }
        });
        this._grimBtn('rs-cheat-gold', function() {
            if (!self.engine || !self.engine.player) return;
            if (self.engine.player.gold !== undefined) {
                self.engine.player.gold = (self.engine.player.gold || 0) + 999;
                self._grimLog('Added 999 gold → ' + self.engine.player.gold);
            } else { self._grimLog('No gold property on player'); }
        });

        // ── Consumables & Buffs ──
        var _usePotion = function(type, amount) {
            var cs = self.engine && self.engine.player && self.engine.player.combatStats;
            if (!cs) { self._grimLog('No combatStats'); return; }
            if (type === 'hp') { cs.hp = Math.min(cs.maxHp, cs.hp + amount); self._grimLog('HP Potion +' + amount + ' → ' + cs.hp + '/' + cs.maxHp); }
            else               { cs.mp = Math.min(cs.maxMp, cs.mp + amount); self._grimLog('MP Potion +' + amount + ' → ' + cs.mp + '/' + cs.maxMp); }
        };
        this._grimBtn('rs-pot-hp-sm', function() { _usePotion('hp', 25); });
        this._grimBtn('rs-pot-hp-md', function() { _usePotion('hp', 50); });
        this._grimBtn('rs-pot-hp-lg', function() { _usePotion('hp', 100); });
        this._grimBtn('rs-pot-mp-sm', function() { _usePotion('mp', 20); });
        this._grimBtn('rs-pot-mp-md', function() { _usePotion('mp', 40); });
        this._grimBtn('rs-pot-mp-lg', function() { _usePotion('mp', 80); });

        var _applyBuff = function(stat, mult, label) {
            var p = self.engine && self.engine.player;
            if (!p) { self._grimLog('No player'); return; }
            if (self.engine.applyBuff) { self.engine.applyBuff(stat, mult, 10000); self._grimLog(label + ' applied (10s)'); return; }
            var target = p.stats || p.combatStats || p;
            if (target[stat] !== undefined) { target[stat] = Math.round(target[stat] * mult); self._grimLog(label + ' → ' + stat + ': ' + target[stat]); }
            else { self._grimLog(label + ' (no stats.' + stat + ' found)'); }
        };
        var _applyStatus = function(status, label) {
            var p = self.engine && self.engine.player;
            if (!p) { self._grimLog('No player'); return; }
            // Real engine API: applyStatusEffect(entityId, effectType, source, durationMs)
            if (self.engine.applyStatusEffect) {
                var pid = p.id || p.entityId || 'player';
                self.engine.applyStatusEffect(pid, status, 'dev', 5000);
                self._grimLog(label + ' applied for 5s (applyStatusEffect)');
                return;
            }
            // Fallback: write directly to player's statusEffects map
            if (p.statusEffects !== undefined) {
                p.statusEffects[status] = { duration: 5000, elapsed: 0, source: 'dev' };
                self._grimLog(label + ' applied (direct statusEffects)');
            } else {
                self._grimLog(label + ': no applyStatusEffect or statusEffects on player');
            }
        };
        this._grimBtn('rs-buff-str',   function() { _applyBuff('attack',  2, '⚔ Str Buff×2'); });
        this._grimBtn('rs-buff-spd',   function() { _applyBuff('speed',   2, '💨 Spd Buff×2'); });
        this._grimBtn('rs-buff-def',   function() { _applyBuff('defense', 2, '🛡 Def Buff×2'); });
        this._grimBtn('rs-debuff-poi', function() { _applyStatus('poison', '☠ Poison'); });
        this._grimBtn('rs-debuff-frz', function() { _applyStatus('freeze', '❄ Freeze'); });
        this._grimBtn('rs-debuff-brn', function() { _applyStatus('burn',   '🔥 Burn'); });
        this._grimBtn('rs-clear-buffs', function() {
            var p = self.engine && self.engine.player;
            if (!p) { self._grimLog('No player'); return; }
            if (p.statusEffects) p.statusEffects = {};
            if (self.engine.clearBuffs) self.engine.clearBuffs();
            self._grimLog('All buffs/debuffs cleared');
        });

        // ── Spawn ──
        this._grimBtn('rs-spawn-player', function() { self._grimSpawn(false); });
        this._grimBtn('rs-spawn-cursor', function() { self._grimSpawn(true); });

        // ── Screen Shake ──
        var shakiEl = document.getElementById('rs-shake-intensity');
        var shakiV  = document.getElementById('rs-shake-intensity-v');
        if (shakiEl && shakiV) shakiEl.addEventListener('input', function() { shakiV.textContent = this.value; });
        var shakdEl = document.getElementById('rs-shake-duration');
        var shakdV  = document.getElementById('rs-shake-duration-v');
        if (shakdEl && shakdV) shakdEl.addEventListener('input', function() { shakdV.textContent = this.value; });

        var _shake = function(intensity, duration) {
            if (self.engine && self.engine.triggerShake) {
                self.engine.triggerShake(intensity, duration);
                self._grimLog('Shake: intensity=' + intensity + ' duration=' + duration + 'ms');
            } else {
                self._grimLog('triggerShake() not found on engine');
            }
        };
        this._grimBtn('rs-shake-hit',       function() { _shake(4,  150); });   // normal hit
        this._grimBtn('rs-shake-crit',      function() { _shake(8,  280); });   // critical hit
        this._grimBtn('rs-shake-heavy',     function() { _shake(14, 500); });   // heavy/boss
        this._grimBtn('rs-shake-explosion', function() { _shake(20, 800); });   // explosion
        this._grimBtn('rs-shake-custom', function() {
            var i = parseInt((document.getElementById('rs-shake-intensity')||{}).value || 8, 10);
            var d = parseInt((document.getElementById('rs-shake-duration') ||{}).value || 300, 10);
            _shake(i, d);
        });

        // ── Lighting ──
        // Slider value displays
        this._devSlider('rs-light-radius',  'rs-light-radius-v',  function(v) { return v + '%'; }, function(v) { if (self.engine) self.engine.lightRadiusMultiplier = v / 100; });
        this._devSlider('rs-light-ambient', 'rs-light-ambient-v', function(v) { return v + '%'; }, function(v) { if (self.engine) self.engine.ambientLightOverride  = v / 100; });

        var _refreshLightPreview = function() {
            var r = parseInt((document.getElementById('rs-light-r')||{}).value || 255, 10);
            var g = parseInt((document.getElementById('rs-light-g')||{}).value || 200, 10);
            var b = parseInt((document.getElementById('rs-light-b')||{}).value || 100, 10);
            var prev = document.getElementById('rs-light-preview');
            if (prev) prev.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
            var rv = document.getElementById('rs-light-r-v'); if (rv) rv.textContent = r;
            var gv = document.getElementById('rs-light-g-v'); if (gv) gv.textContent = g;
            var bv = document.getElementById('rs-light-b-v'); if (bv) bv.textContent = b;
        };
        ['rs-light-r','rs-light-g','rs-light-b'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', _refreshLightPreview);
        });

        // _setLightPreset(r, g, b, pixelRadius, ambientPct, label)
        // pixelRadius: actual light radius in pixels (matching registerLight units)
        var _setLightPreset = function(r, g, b, pixelRadius, ambientPct, label) {
            var rEl = document.getElementById('rs-light-r');
            var gEl = document.getElementById('rs-light-g');
            var bEl = document.getElementById('rs-light-b');
            if (rEl) rEl.value = r;
            if (gEl) gEl.value = g;
            if (bEl) bEl.value = b;
            _refreshLightPreview();

            // Sync ambient slider
            if (ambientPct !== undefined) {
                var ambEl = document.getElementById('rs-light-ambient');
                var ambV  = document.getElementById('rs-light-ambient-v');
                if (ambEl) { ambEl.value = ambientPct; if (ambV) ambV.textContent = ambientPct + '%'; }
                if (self.engine) self.engine.ambientLightOverride = ambientPct / 100;
            }

            // Sync radius slider (slider is 0-200 pct of base radius)
            var sliderVal = Math.round(pixelRadius / 2); // 200px → 100%, 140px → 70%
            var radEl = document.getElementById('rs-light-radius');
            var radV  = document.getElementById('rs-light-radius-v');
            if (radEl) { radEl.value = sliderVal; if (radV) radV.textContent = sliderVal + '%'; }
            if (self.engine) self.engine.lightRadiusMultiplier = sliderVal / 100;

            // Fire the actual registerLight call at the player position
            var hexColor = '#'
                + ('0' + Math.round(r).toString(16)).slice(-2)
                + ('0' + Math.round(g).toString(16)).slice(-2)
                + ('0' + Math.round(b).toString(16)).slice(-2);
            if (self.engine && self.engine.player && self.engine.registerLight) {
                self.engine.registerLight('dev_test_light',
                    self.engine.player.x, self.engine.player.y,
                    pixelRadius, hexColor, 1.0);
            }
            self._grimLog('💡 ' + label + ': ' + hexColor + ' r=' + pixelRadius + 'px amb=' + ambientPct + '%');
        };
        // Presets match FeatureTestPanel light definitions (campfire=#ff7020 r140, shroom=#40e0ff r90 etc.)
        this._grimBtn('rs-light-campfire',  function() { _setLightPreset(255, 112,  32, 140,  5, 'Campfire'); });
        this._grimBtn('rs-light-cave',      function() { _setLightPreset( 64, 224, 255,  90, 10, 'Cave Shroom'); });
        this._grimBtn('rs-light-moonlight', function() { _setLightPreset(140, 160, 230, 200, 35, 'Moonlight'); });
        this._grimBtn('rs-light-torch',     function() { _setLightPreset(255, 200,  80, 120,  3, 'Torch'); });
        this._grimBtn('rs-light-crystal',   function() { _setLightPreset(192, 128, 255, 120, 15, 'Crystal'); });
        this._grimBtn('rs-light-default',   function() { _setLightPreset(255, 224, 160, 200,  0, 'Default'); });
        this._grimBtn('rs-light-apply', function() {
            if (!self.engine) { self._grimLog('No engine'); return; }
            var r = parseInt((document.getElementById('rs-light-r')||{}).value || 255, 10);
            var g = parseInt((document.getElementById('rs-light-g')||{}).value || 255, 10);
            var b = parseInt((document.getElementById('rs-light-b')||{}).value || 255, 10);
            var radiusPct = parseInt((document.getElementById('rs-light-radius') ||{}).value || 100, 10);
            var ambient   = parseInt((document.getElementById('rs-light-ambient')||{}).value || 0,   10);

            // Global multipliers (engine reads these)
            self.engine.lightRadiusMultiplier = radiusPct / 100;
            self.engine.ambientLightOverride  = ambient   / 100;

            // Register a point light at the player using registerLight (real API)
            var hexColor = '#'
                + ('0' + Math.round(r).toString(16)).slice(-2)
                + ('0' + Math.round(g).toString(16)).slice(-2)
                + ('0' + Math.round(b).toString(16)).slice(-2);
            var lightRadius = radiusPct * 2; // convert % → pixel radius (100% ≈ 200px)
            if (self.engine.player && self.engine.registerLight) {
                self.engine.registerLight('dev_test_light',
                    self.engine.player.x, self.engine.player.y,
                    lightRadius, hexColor, 1.0);
            }
            self._grimLog('Light: ' + hexColor + ' r=' + lightRadius + 'px amb=' + ambient + '%');
        });

        // ── Visual FX — Screen Flash ──
        this._grimBtn('rs-flash-damage', function() { self._grimFlash('rgba(200,0,0,0.45)'); });
        this._grimBtn('rs-flash-heal',   function() { self._grimFlash('rgba(0,200,80,0.4)'); });
        this._grimBtn('rs-flash-magic',  function() { self._grimFlash('rgba(120,0,255,0.4)'); });
        this._grimBtn('rs-flash-death',  function() { self._grimFlash('rgba(0,0,0,0.75)'); });
        this._grimBtn('rs-flash-white',  function() { self._grimFlash('rgba(255,255,255,0.65)'); });
        this._grimBtn('rs-flash-gold',   function() { self._grimFlash('rgba(200,160,0,0.55)'); });

        // ── Visual FX — Particles (engine.particles is the ParticleSystem instance) ──
        var _pfxPos = function() {
            var px = self.engine.player ? self.engine.player.x : (self.engine.mouseWorldX || 256);
            var py = self.engine.player ? self.engine.player.y : (self.engine.mouseWorldY || 256);
            return { x: px, y: py };
        };
        var _pfxCheck = function(label) {
            if (!self.engine || !self.engine.particles) {
                self._grimLog(label + ': engine.particles not found');
                return false;
            }
            return true;
        };
        this._grimBtn('rs-pfx-fire', function() {
            if (!_pfxCheck('🔥 Fire')) return;
            var p = _pfxPos();
            // Rising fire embers
            self.engine.particles.emit(p.x, p.y, { count: 20, color: '#ff6020', size: 4, speed: 60, lifetime: 700, gravity: -60 });
            self.engine.particles.emit(p.x, p.y, { count: 10, color: '#ffcc00', size: 2, speed: 40, lifetime: 400, gravity: -40 });
            self.engine.particles.createImpactSparks(p.x, p.y);
            self._grimLog('🔥 Fire particles at player pos');
        });
        this._grimBtn('rs-pfx-smoke', function() {
            if (!_pfxCheck('💨 Smoke')) return;
            var p = _pfxPos();
            self.engine.particles.createSmoke(p.x, p.y, { count: 12, color: '#666666' });
            self.engine.particles.createSmoke(p.x, p.y, { count: 6,  color: '#444444' });
            self._grimLog('💨 Smoke particles at player pos');
        });
        this._grimBtn('rs-pfx-heal', function() {
            if (!_pfxCheck('✨ Heal')) return;
            var p = _pfxPos();
            self.engine.particles.createSparkle(p.x, p.y, '#00ff80', { count: 20, size: 3, speed: 30 });
            self.engine.particles.createSparkle(p.x, p.y, '#ffffff', { count: 10, size: 2, speed: 20 });
            self._grimLog('✨ Heal particles at player pos');
        });
        this._grimBtn('rs-pfx-magic', function() {
            if (!_pfxCheck('🌀 Magic')) return;
            var p = _pfxPos();
            self.engine.particles.createSparkle(p.x, p.y, '#8040ff', { count: 20, size: 3, speed: 40 });
            self.engine.particles.emitBurst(p.x, p.y,    { count: 15, color: '#c080ff', size: 2, speed: 50, lifetime: 400, gravity: -20 });
            self._grimLog('🌀 Magic particles at player pos');
        });

        // ── World State ──
        var todEl = document.getElementById('rs-time-of-day');
        var todV  = document.getElementById('rs-time-of-day-v');
        var quickTodEl = document.getElementById('rs-quick-time-of-day');
        var quickTodV  = document.getElementById('rs-quick-time-of-day-v');
        var syncTod = function(v) {
            var text = v + ':00';
            if (todEl && String(todEl.value) !== String(v)) todEl.value = v;
            if (quickTodEl && String(quickTodEl.value) !== String(v)) quickTodEl.value = v;
            if (todV) todV.textContent = text;
            if (quickTodV) quickTodV.textContent = text;
        };
        if (todEl) todEl.addEventListener('input', function() {
            syncTod(this.value);
            self._applyTimeOfDay(this.value);
        });
        if (quickTodEl) quickTodEl.addEventListener('input', function() {
            syncTod(this.value);
            self._applyTimeOfDay(this.value);
        });
        syncTod((quickTodEl && quickTodEl.value) || (todEl && todEl.value) || 12);
        this._grimBtn('rs-apply-world', function() {
            if (!self.engine) { self._grimLog('No engine'); return; }
            var tod = parseInt((document.getElementById('rs-quick-time-of-day')||{}).value || (document.getElementById('rs-time-of-day')||{}).value || 12, 10);
            var wx  = (document.getElementById('rs-weather')||{}).value || 'clear';

            // Time of day — engine.dayNight.time is in seconds (0-86400)
            self._applyTimeOfDay(tod);

            // Weather — real API: engine.weatherSystem.setWeather(type, intensity, windDir)
            var wxIntensity = (wx === 'storm') ? 1.0 : (wx === 'rain' || wx === 'snow') ? 0.7 : (wx === 'fog') ? 0.6 : 0;
            if (self.engine.weatherSystem && self.engine.weatherSystem.setWeather) {
                self.engine.weatherSystem.setWeather(wx, wxIntensity, 0);
            } else if (self.engine.setWeather) {
                self.engine.setWeather(wx);             // fallback
            }

            self._grimLog('World: ' + tod + ':00, weather=' + wx + ' (' + Math.round(wxIntensity * 100) + '%)');
        });
        this._grimBtn('rs-cam-snap', function() {
            if (self.engine && self.engine.camera && self.engine.player) {
                self.engine.camera.x = self.engine.player.x;
                self.engine.camera.y = self.engine.player.y;
                self._grimLog('Camera snapped to player');
            }
        });
        this._grimBtn('rs-cam-free', function() {
            if (!self.engine) return;
            self.engine._freeCam = !self.engine._freeCam;
            self._grimLog('Free camera: ' + (self.engine._freeCam ? 'ON' : 'OFF'));
        });

        // ── Debug Toggles ──
        this._grimBtn('rs-toggle-invincible', function() {
            if (!self.engine || !self.engine.player) return;
            self.engine.player._invincible = !self.engine.player._invincible;
            self._grimLog('Invincible: ' + (self.engine.player._invincible ? 'ON' : 'OFF'));
        });
        this._grimBtn('rs-toggle-noclip', function() {
            if (!self.engine || !self.engine.player) return;
            self.engine.player._noclip = !self.engine.player._noclip;
            self._grimLog('Noclip: ' + (self.engine.player._noclip ? 'ON' : 'OFF'));
        });
        this._grimBtn('rs-toggle-hitboxes', function() {
            if (!self.engine) return;
            self.engine.debugHitboxes = !self.engine.debugHitboxes;
            self._grimLog('Hitboxes: ' + (self.engine.debugHitboxes ? 'ON' : 'OFF'));
        });
        this._grimBtn('rs-toggle-coords', function() {
            if (!self.engine) return;
            self.engine.debugTileCoords = !self.engine.debugTileCoords;
            self._grimLog('Tile coords: ' + (self.engine.debugTileCoords ? 'ON' : 'OFF'));
        });
        this._grimBtn('rs-toggle-collision', function() {
            if (!self.engine) return;
            self.engine.debugCollision = !self.engine.debugCollision;
            self._grimLog('Collision vis: ' + (self.engine.debugCollision ? 'ON' : 'OFF'));
        });
        this._grimBtn('rs-toggle-pathfind', function() {
            if (!self.engine) return;
            self.engine.debugPathfinding = !self.engine.debugPathfinding;
            self._grimLog('Pathfinding vis: ' + (self.engine.debugPathfinding ? 'ON' : 'OFF'));
        });

        // ── Flags ──
        this._grimBtn('rs-flag-set', function() {
            var k = ((document.getElementById('rs-flag-key')||{}).value||'').trim();
            var v = ((document.getElementById('rs-flag-val')||{}).value||'').trim();
            if (!k) return;
            var flags = self.engine && (self.engine.flags || self.engine.gameFlags);
            if (flags) { flags[k] = v; self._grimFlag('Set ' + k + ' = ' + v); }
            else { self._grimFlag('No flags object on engine'); }
        });
        this._grimBtn('rs-flag-get', function() {
            var k = ((document.getElementById('rs-flag-key')||{}).value||'').trim();
            var flags = self.engine && (self.engine.flags || self.engine.gameFlags);
            self._grimFlag(k + ' = ' + (flags ? JSON.stringify(flags[k]) : 'no flags'));
        });
        this._grimBtn('rs-flag-clear-all', function() {
            var flags = self.engine && (self.engine.flags || self.engine.gameFlags);
            if (flags) { Object.keys(flags).forEach(function(k) { delete flags[k]; }); self._grimFlag('All flags cleared'); }
        });
        this._grimBtn('rs-log-world', function() {
            console.log('[Grimoire] World state:', self.engine && self.engine.tileMap);
            self._grimFlag('World state logged → console');
        });
        this._grimBtn('rs-log-player', function() {
            console.log('[Grimoire] Player state:', self.engine && self.engine.player);
            self._grimFlag('Player state logged → console');
        });
    },

    _devSlider: function(id, valId, fmt, onChange) {
        var e = this._e;
        var el  = e[id]; var vel = e[valId];
        if (!el || !vel) return;
        el.addEventListener('input', function() {
            var v = parseInt(this.value, 10);
            vel.textContent = fmt(v);
            if (onChange) onChange(v);
        });
    },

    _mapSlider: function(id, valId, fmt) {
        var self = this;
        var e = this._e;
        var el = e[id]; var vel = e[valId];
        if (!el || !vel) return;
        el.addEventListener('input', function() {
            vel.textContent = fmt(parseInt(this.value, 10));
            self._mapDirty = true;
            self._scheduleMapPreview();
        });
    },

    // ─── Tab switching ────────────────────────────────────────────────────
    _switchTab: function(tab) {
        this.activeTab = tab;
        ['dev','map'].forEach(function(t) {
            var tabEl  = document.getElementById('rs-tab-' + t);
            var paneEl = document.getElementById('rs-pane-' + t);
            if (tabEl)  tabEl.classList.toggle('rs-active',  t === tab);
            if (paneEl) paneEl.classList.toggle('rs-active', t === tab);
        });
        if (tab === 'map') { this._scheduleMapPreview(); }
    },
    
    // ─── Mode switching (DevTools vs Builder) ────────────────────────────────
    _mode: 'dev', // 'dev' | 'builder'
    _setMode: function(mode) {
        this._mode = mode;

        // Update toggle tab styles
        var devTab     = document.getElementById('rs-toggle-dev');
        var builderTab = document.getElementById('rs-toggle-builder');
        if (devTab)     devTab.classList.toggle('rs-active',     mode === 'dev');
        if (builderTab) builderTab.classList.toggle('rs-active', mode === 'builder');

        // Show/hide dev content (tab strip + panes) vs builder content
        var devTabs      = document.getElementById('rs-tabs');
        var devPanes     = document.getElementById('rs-panes');
        var builderContent = document.getElementById('rs-builder-content');
        if (devTabs)        devTabs.style.display        = mode === 'dev' ? ''     : 'none';
        if (devPanes)       devPanes.style.display       = mode === 'dev' ? ''     : 'none';
        if (builderContent) builderContent.style.display = mode === 'builder' ? 'flex' : 'none';

        // Reflect mode in header title
        var title = document.getElementById('rs-title');
        if (title) title.textContent = mode === 'dev' ? 'Dev Tools' : 'Realm Studio';

        // Show sidebar if currently hidden
        if (!this.visible) this.show();
        if (mode === 'builder') this._switchBuilderTab(this._builderTab || 'maps');
    },

    _storySetStatus: function(msg) {
        this._set('rs-story-status', msg);
        this._grimLog(msg);
    },

    _storySyncForm: function() {
        var story = this.engine ? this.engine.currentStory : null;
        var ui = (story && story.ui_config) || (this.engine && this.engine.storyUIConfig) || null;
        this._set('rs-story-current', story ? story.title : '--');
        if (!ui) return;

        var mode = ui.ui_mode || ui.uiMode || 'hybrid';
        var theme = ui.theme_key || ui.themeKey || 'realmkit-parchment';
        var labels = ui.resource_labels_json || null;
        if (!labels && ui.resourceLabels) {
            labels = JSON.stringify(ui.resourceLabels);
        }

        if (this._e['rs-story-ui-mode']) this._e['rs-story-ui-mode'].value = mode;
        if (this._e['rs-story-ui-theme']) this._e['rs-story-ui-theme'].value = theme;
        if (this._e['rs-story-ui-labels'] && labels) this._e['rs-story-ui-labels'].value = labels;
    },

    _storyLoadList: function() {
        var self = this;
        var list = this._e['rs-story-list'];
        if (!list) return;
        if (!this.db) {
            list.innerHTML = 'No StoryDatabase available';
            this._storySetStatus('Story DB unavailable');
            return;
        }

        list.innerHTML = 'Loading stories...';
        this.db.listStories(true).then(function(stories) {
            if (!stories || !stories.length) {
                list.innerHTML = 'No stories found';
                self._storySetStatus('No stories found');
                return;
            }
            var html = [];
            for (var i = 0; i < stories.length; i++) {
                var story = stories[i];
                var selected = self.engine && self.engine.currentStoryId === story.id;
                html.push(
                    '<button class="rs-btn ' + (selected ? 'rs-btn-green' : 'rs-btn-slate') + ' rs-story-item" ' +
                    'data-story-id="' + self._esc(story.id) + '" style="width:100%;margin-bottom:4px;text-align:left;">' +
                    self._esc(story.title) + (story.is_published ? ' · published' : ' · draft') +
                    '</button>'
                );
            }
            list.innerHTML = html.join('');
            var buttons = list.querySelectorAll('.rs-story-item');
            buttons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    self._storySelect(this.getAttribute('data-story-id'));
                });
            });
            self._storySetStatus('Loaded ' + stories.length + ' stories');
        }).catch(function(err) {
            list.innerHTML = 'Failed to load stories';
            self._storySetStatus('Story load failed');
            console.error('[RealmSidebar] Story load failed:', err);
        });
    },

    _storySelect: function(storyId) {
        var self = this;
        if (!this.engine || !storyId) return;
        this._storySetStatus('Loading story...');
        this._ctxStoryId = storyId; // make available to Maps tab
        this.engine.loadStory(storyId).then(function(story) {
            self.engine.currentStory = story;
            self.engine.currentStoryId = storyId;
            self._storySyncForm();
            self._storyLoadList();
            self._storySetStatus('Loaded ' + (story.title || storyId));
        }).catch(function(err) {
            self._storySetStatus('Failed to load story');
            console.error('[RealmSidebar] Story select failed:', err);
        });
    },

    _storySaveUiConfig: function() {
        if (!this.engine || !this.engine.currentStoryId || !this.db) {
            this._storySetStatus('No active story selected');
            return;
        }
        var labelsRaw = (this._e['rs-story-ui-labels'] && this._e['rs-story-ui-labels'].value) || '';
        try {
            JSON.parse(labelsRaw);
        } catch (e) {
            this._storySetStatus('Invalid labels JSON');
            return;
        }

        var payload = {
            ui_mode: this._e['rs-story-ui-mode'] ? this._e['rs-story-ui-mode'].value : 'hybrid',
            theme_key: this._e['rs-story-ui-theme'] ? this._e['rs-story-ui-theme'].value : 'realmkit-parchment',
            resource_labels_json: labelsRaw
        };

        var self = this;
        this._storySetStatus('Saving UI config...');
        this.db.updateUiConfig(this.engine.currentStoryId, payload).then(function(result) {
            if (self.engine.currentStory) {
                self.engine.currentStory.ui_config = result;
            }
            self.engine.storyUIConfig = {
                uiMode: result.ui_mode || 'hybrid',
                themeKey: result.theme_key || 'realmkit-parchment',
                resourceLabels: JSON.parse(result.resource_labels_json || '{}'),
                panels: result.panel_config_json ? JSON.parse(result.panel_config_json) : {},
                layout: result.layout_config_json ? JSON.parse(result.layout_config_json) : {}
            };
            self._storySetStatus('UI config saved');
        }).catch(function(err) {
            self._storySetStatus('UI config save failed');
            console.error('[RealmSidebar] UI config save failed:', err);
        });
    },

    _openMapPopout: function() {
        if (!this.engine || !RealmKit._LegacyMapGenPanel) {
            this._storySetStatus('Map studio unavailable');
            return;
        }
        if (!this.engine.mapGenPanel || !this.engine.mapGenPanel.show) {
            this.engine.mapGenPanel = new RealmKit._LegacyMapGenPanel(this.engine);
        }
        this.engine.mapGenPanel.show();
        this._grimLog('Opened map studio pop-out');
    },

    _openStoryPopout: function() {
        if (!this.engine || !RealmKit._LegacyStoryBuilderOverlay) {
            this._storySetStatus('Story builder unavailable');
            return;
        }
        if (!this.engine.storyBuilderOverlay || !this.engine.storyBuilderOverlay.show) {
            this.engine.storyBuilderOverlay = new RealmKit._LegacyStoryBuilderOverlay(this.engine);
        }
        this.engine.storyBuilderOverlay.show();
        this._grimLog('Opened story builder pop-out');
    },

    _bindCollapsibles: function() {
        var headers = document.querySelectorAll('#rs-pane-dev .rs-sec-hdr');
        headers.forEach(function(hdr) {
            hdr.addEventListener('click', function() {
                var body = hdr.nextElementSibling;
                if (body && body.classList.contains('rs-sec-body')) {
                    var closed = body.classList.toggle('rs-sec-closed');
                    hdr.classList.toggle('rs-sec-closed', closed);
                }
            });
        });
    },

    // ─── Map generation ───────────────────────────────────────────────────
    _regen: function(newSeed) {
        if (!this.engine) return;
        var e  = this._e;
        var mw = Math.max(32, Math.min(1024, parseInt(e['rs-mw'].value, 10) || 256));
        var mh = Math.max(32, Math.min(1024, parseInt(e['rs-mh'].value, 10) || 256));
        e['rs-mw'].value = mw; e['rs-mh'].value = mh;
        var cfg = {
            waterLevel:    parseInt(e['rs-water'].value,  10) / 100,
            hillLevel:     parseInt(e['rs-hill'].value,   10) / 100,
            mountainLevel: parseInt(e['rs-mtn'].value,    10) / 100,
            elevationScale:parseInt(e['rs-escale'].value, 10) / 1000,
            tileSize:      parseInt(e['rs-tsize'].value,  10),
            mapWidth: mw, mapHeight: mh
        };
        if (!newSeed && this.engine.worldSeed !== undefined) { cfg.seed = this.engine.worldSeed; }
        this.engine.regenerateWorld(cfg);
        var self = this;
        setTimeout(function() { self._drawMapPreview(); }, 350);
    },

    _scheduleMapPreview: function() {
        if (this._mapRaf) return;
        var self = this;
        this._mapRaf = requestAnimationFrame(function() {
            self._mapRaf = null;
            if (self._mapDirty) { self._drawMapPreview(); self._mapDirty = false; }
        });
    },

    _drawMapPreview: function() {
        var canvas = this._e['rs-map-canvas'];
        var lbl    = this._e['rs-map-canvas-lbl'];
        if (!canvas) return;
        var tileMap = this.engine && this.engine.tileMap;
        if (tileMap && tileMap.tiles) {
            // Live tilemap render
            var COLORS = RealmKit._RealmSidebarImpl.TILE_COLORS;
            var w = tileMap.width || 64; var h = tileMap.height || 64;
            var maxSide = 340;
            var sc = Math.max(1, Math.floor(Math.min(maxSide / w, maxSide / h)));
            canvas.width = w * sc; canvas.height = h * sc;
            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            for (var ty = 0; ty < h; ty++) {
                for (var tx = 0; tx < w; tx++) {
                    var tile = tileMap.tiles[ty * w + tx];
                    ctx.fillStyle = COLORS[tile ? (tile.type || 0) : 0] || '#404040';
                    ctx.fillRect(tx * sc, ty * sc, sc, sc);
                }
            }
            if (lbl) lbl.textContent = w + ' × ' + h + ' tiles · live';
            if (this._e['rs-seed-disp'] && this.engine.worldSeed !== undefined) {
                this._e['rs-seed-disp'].textContent = this.engine.worldSeed;
            }
        } else {
            // Noise sample preview
            var SIZE = 220;
            canvas.width = SIZE; canvas.height = SIZE;
            var ctx2 = canvas.getContext('2d');
            var img = ctx2.createImageData(SIZE, SIZE);
            var wl = parseInt(this._e['rs-water'].value,  10) / 100;
            var hl = parseInt(this._e['rs-hill'].value,   10) / 100;
            var ml = parseInt(this._e['rs-mtn'].value,    10) / 100;
            var es = parseInt(this._e['rs-escale'].value, 10) / 1000;
            var oc = parseInt(this._e['rs-octaves'].value,10);
            for (var py = 0; py < SIZE; py++) {
                for (var px = 0; px < SIZE; px++) {
                    var nx = px * es * 7; var ny = py * es * 7;
                    var val = 0; var amp = 1; var freq = 1; var maxV = 0;
                    for (var o = 0; o < oc; o++) {
                        val  += (Math.sin(nx*freq+1.3)*Math.cos(ny*freq+0.7)*0.5+0.5)*amp;
                        maxV += amp; amp *= 0.5; freq *= 2.1;
                    }
                    val = val / maxV;
                    var r,g,b;
                    if (val < wl) {
                        var t = val/wl; r=Math.round(10+t*20);g=Math.round(42+t*32);b=Math.round(90+t*48);
                    } else if (val < hl) {
                        var t2=(val-wl)/(hl-wl); r=Math.round(74+t2*30);g=Math.round(138-t2*60);b=Math.round(58+t2*20);
                    } else if (val < ml) {
                        var t3=(val-hl)/(ml-hl); r=Math.round(104-t3*30);g=Math.round(78-t3*30);b=Math.round(78+t3*20);
                    } else {
                        var t4=Math.min(1,(val-ml)/(1-ml)); r=Math.round(74+t4*160);g=Math.round(48+t4*192);b=Math.round(98+t4*140);
                    }
                    var i4=(py*SIZE+px)*4;
                    img.data[i4]=r;img.data[i4+1]=g;img.data[i4+2]=b;img.data[i4+3]=255;
                }
            }
            ctx2.putImageData(img, 0, 0);
            if (lbl) lbl.textContent = (this._e['rs-mw'].value||'256') + ' × ' + (this._e['rs-mh'].value||'256') + ' tiles · approximate preview';
        }
    },

    // ─── Grimoire dev-tool helpers ────────────────────────────────────────
    _grimBtn: function(id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    },

    _grimLog: function(msg) {
        var el = document.getElementById('rs-dev-status');
        if (el) el.textContent = msg;
    },

    _grimFlag: function(msg) {
        var out = document.getElementById('rs-flag-out');
        if (out) {
            out.innerHTML = out.innerHTML + (out.innerHTML ? '<br>' : '') + '» ' + msg;
            out.scrollTop = out.scrollHeight;
        }
        this._grimLog(msg);
    },

    _grimTeleport: function() {
        if (!this.engine || !this.engine.player) { this._grimLog('No player'); return; }
        var x = parseFloat((document.getElementById('rs-tp-x')||{}).value);
        var y = parseFloat((document.getElementById('rs-tp-y')||{}).value);
        if (isNaN(x) || isNaN(y)) { this._grimLog('Invalid coords'); return; }
        this.engine.player.x = x;
        this.engine.player.y = y;
        if (this.engine.camera) { this.engine.camera.x = x; this.engine.camera.y = y; }
        this._grimLog('Teleported to ' + Math.round(x) + ', ' + Math.round(y));
    },

    _grimSpawn: function(atCursor) {
        if (!this.engine) { this._grimLog('No engine'); return; }
        var type  = (document.getElementById('rs-spawn-type') ||{}).value || 'enemy_slime';
        var count = Math.max(1, Math.min(20, parseInt((document.getElementById('rs-spawn-count')||{}).value, 10) || 1));
        var level = Math.max(1, Math.min(99, parseInt((document.getElementById('rs-spawn-level')||{}).value, 10) || 1));
        var x = atCursor ? (this.engine.mouseWorldX || 256) : (this.engine.player ? this.engine.player.x : 256);
        var y = atCursor ? (this.engine.mouseWorldY || 256) : (this.engine.player ? this.engine.player.y : 256);
        var tw = (this.engine.tileMap && this.engine.tileMap.tileWidth) || 32;
        var spawned = 0;
        for (var i = 0; i < count; i++) {
            var ox = (Math.random() - 0.5) * tw * 4;
            var oy = (Math.random() - 0.5) * tw * 4;
            if (typeof this.engine.spawnEntity === 'function') {
                this.engine.spawnEntity(type, x + ox, y + oy, { level: level });
                spawned++;
            }
        }
        var logEl = document.getElementById('rs-spawn-log');
        var locStr = atCursor ? 'cursor' : 'player';
        var msg = spawned
            ? ('Spawned ' + spawned + '× ' + type + ' Lv' + level + ' @ ' + locStr)
            : ('spawnEntity() not found on engine');
        if (logEl) { logEl.innerHTML += (logEl.innerHTML ? '<br>' : '') + '» ' + msg; logEl.scrollTop = logEl.scrollHeight; }
        this._grimLog(msg);
    },

    _grimFlash: function(color) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:' + color + ';z-index:99999;pointer-events:none;transition:opacity 0.4s';
        document.body.appendChild(overlay);
        requestAnimationFrame(function() { requestAnimationFrame(function() { overlay.style.opacity = '0'; }); });
        setTimeout(function() { overlay.parentNode && overlay.parentNode.removeChild(overlay); }, 500);
        this._grimLog('Flash effect fired');
    },

    _applySidebarWidth: function(width) {
        width = Math.max(340, Math.min(640, parseInt(width, 10) || 420));
        this.sidebarWidth = width;
        if (this._e['rs-main-panel']) this._e['rs-main-panel'].style.width = width + 'px';
        if (this._e['rs-sidebar-width']) this._e['rs-sidebar-width'].value = width;
        if (this._e['rs-sidebar-width-v']) this._e['rs-sidebar-width-v'].textContent = width + 'px';
        try { localStorage.setItem('realmkit.sidebarWidth', String(width)); } catch (err) {}
    },

    _applySidebarScale: function(scale) {
        scale = Math.max(0.8, Math.min(1.7, parseFloat(scale) || 1));
        this.sidebarScale = scale;
        if (this.el) this.el.style.setProperty('--rs-scale', String(scale));
        if (this._e['rs-sidebar-scale']) this._e['rs-sidebar-scale'].value = Math.round(scale * 100);
        if (this._e['rs-sidebar-scale-v']) this._e['rs-sidebar-scale-v'].textContent = scale.toFixed(2) + 'x';
        try { localStorage.setItem('realmkit.sidebarScale', String(scale)); } catch (err) {}
    },

    _applyTimeOfDay: function(hour) {
        hour = Math.max(0, Math.min(23, parseInt(hour, 10) || 0));
        if (!this.engine) return;
        if (this.engine.dayNight) {
            this.engine.dayNight.time = hour * 3600;
            if (this.engine.dayNight.manualOverride !== undefined) this.engine.dayNight.manualOverride = true;
        } else if (this.engine.setTimeOfDay) {
            this.engine.setTimeOfDay(hour);
        }
        if (this.engine._timeOfDayLocked !== undefined) this.engine._timeOfDayLocked = true;
        this._grimLog('Time of day set to ' + hour + ':00');
    },

    _esc: function(s) { var d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; },

    // ─── Live update (called each frame by engine) ────────────────────────
    update: function(engine) {
        if (!this.visible || this.activeTab !== 'dev') return;

        var e   = this._e;
        var now = performance.now();

        // FPS rolling average
        this._fpsBuffer.push(engine.totalRenderMs || 0);
        if (this._fpsBuffer.length > 30) this._fpsBuffer.shift();
        if (now - this._lastFps > 500) {
            var avg = 0;
            for (var i = 0; i < this._fpsBuffer.length; i++) avg += this._fpsBuffer[i];
            avg /= this._fpsBuffer.length || 1;
            this._fpsDisplay = avg > 0 ? Math.round(1000 / avg) : 0;
            this._lastFps = now;
        }

        // Runtime
        var elapsed = Math.floor((now - (engine.startTime || now)) / 1000);
        var hh = String(Math.floor(elapsed / 3600)).padStart(2,'0');
        var mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2,'0');
        var ss = String(elapsed % 60).padStart(2,'0');
        this._set('rs-runtime', hh+':'+mm+':'+ss);
        this._set('rs-fps',      this._fpsDisplay + ' fps');
        this._set('rs-frame-ms', (engine.totalRenderMs || 0).toFixed(2) + ' ms');
        if (engine.dayNight) {
            var hour = Math.max(0, Math.min(23, Math.floor((engine.dayNight.time || 0) / 3600)));
            if (e['rs-time-of-day'] && document.activeElement !== e['rs-time-of-day']) e['rs-time-of-day'].value = hour;
            if (e['rs-quick-time-of-day'] && document.activeElement !== e['rs-quick-time-of-day']) e['rs-quick-time-of-day'].value = hour;
            this._set('rs-time-of-day-v', hour + ':00');
            this._set('rs-quick-time-of-day-v', hour + ':00');
        }

        if (engine.tileMap) {
            this._set('rs-map-info', engine.tileMap.width + '×' + engine.tileMap.height + ' (' + (engine.tileMap.tileWidth||32) + 'px)');
        }

        // Player
        if (engine.player && engine.tileMap) {
            var tw = engine.tileMap.tileWidth  || 32;
            var th = engine.tileMap.tileHeight || 32;
            var ptx = Math.floor(engine.player.x / tw);
            var pty = Math.floor(engine.player.y / th);
            this._set('rs-pw-xy', Math.floor(engine.player.x) + ', ' + Math.floor(engine.player.y));
            this._set('rs-pt-xy', ptx + ', ' + pty);
            var ptIdx  = pty * engine.tileMap.width + ptx;
            var ptTile = (engine.tileMap.layers && engine.tileMap.layers[0]) ? engine.tileMap.layers[0].data[ptIdx] : -1;
            this._set('rs-pt-type', RealmKit._RealmSidebarImpl.TILE_NAMES[ptTile] || ('ID '+ptTile));
            var cs = engine.player.combatStats;
            if (cs) {
                var hpP = Math.round((cs.hp/cs.maxHp)*100);
                var mpP = cs.maxMp > 0 ? Math.round((cs.mp/cs.maxMp)*100) : 0;
                if (e['rs-hp-txt']) e['rs-hp-txt'].textContent = cs.hp + '/' + cs.maxHp;
                this._set('rs-hp-pct', hpP + '%');
                if (e['rs-bar-hp']) { e['rs-bar-hp'].style.width = hpP + '%'; e['rs-bar-hp'].style.background = hpP>50?'#2ecc71':hpP>25?'#f1c40f':'#e74c3c'; }
                if (e['rs-mp-txt']) e['rs-mp-txt'].textContent = cs.mp + '/' + cs.maxMp;
                this._set('rs-mp-pct', mpP + '%');
                if (e['rs-bar-mp']) e['rs-bar-mp'].style.width = mpP + '%';
            }
        }

        // Cursor tile
        if (engine.tileMap && engine.mouseWorldX !== undefined) {
            var tw2 = engine.tileMap.tileWidth || 32; var th2 = engine.tileMap.tileHeight || 32;
            var ctx2 = Math.floor(engine.mouseWorldX / tw2);
            var cty2 = Math.floor(engine.mouseWorldY / th2);
            if (ctx2 >= 0 && ctx2 < engine.tileMap.width && cty2 >= 0 && cty2 < engine.tileMap.height) {
                var cidx  = cty2 * engine.tileMap.width + ctx2;
                var cTile = (engine.tileMap.layers && engine.tileMap.layers[0]) ? engine.tileMap.layers[0].data[cidx] : -1;
                this._set('rs-ct-xy',   ctx2 + ', ' + cty2);
                this._set('rs-ct-type', RealmKit._RealmSidebarImpl.TILE_NAMES[cTile] || ('ID ' + cTile));
                this._set('rs-ct-elev',  engine.tileMap.elevationMap    ? engine.tileMap.elevationMap[cidx].toFixed(3) : '--');
                this._set('rs-ct-moist', engine.tileMap.moistureMap     ? engine.tileMap.moistureMap[cidx].toFixed(3)  : '--');
                this._set('rs-ct-temp',  engine.tileMap.temperatureMap  ? engine.tileMap.temperatureMap[cidx].toFixed(3): '--');
                this._set('rs-ct-col',   engine.tileMap.collisionData   ? (engine.tileMap.collisionData[cidx] ? '⛔ yes' : '✓ no') : '--');
            } else {
                this._set('rs-ct-xy', 'out of bounds');
            }
        }

        var eventLogEl = e['rs-event-log'];
        if (eventLogEl && engine.hudSystem && engine.hudSystem.elements) {
            var combatLog = engine.hudSystem.elements.get('combatlog');
            var entries = combatLog && combatLog.entries ? combatLog.entries : [];
            var html = [];
            var start = Math.max(0, entries.length - 10);
            for (var j = start; j < entries.length; j++) {
                var entry = entries[j];
                var tone = '#4a3420';
                if (entry.type === 'damage') tone = '#8a2a24';
                else if (entry.type === 'heal') tone = '#2d6a3e';
                else if (entry.type === 'kill') tone = '#8a4f12';
                else if (entry.type === 'player') tone = '#315b80';
                else if (entry.type === 'gold') tone = '#8a6a18';
                else if (entry.type === 'item') tone = '#446a7a';
                else if (entry.type === 'warning') tone = '#8a5a18';
                else if (entry.type === 'xp_gain') tone = '#5d4480';

                html.push(
                    '<div style="margin-bottom:6px;padding:6px 8px;border-left:3px solid ' + tone + ';background:rgba(255,248,232,0.72)">' +
                    '<span style="display:block;color:#b89a6c;font-size:9px;margin-bottom:3px">' + this._esc(entry.time || '') + '</span>' +
                    '<span style="color:#2a1408;font-size:11px;line-height:1.6">' + this._esc(entry.message || '') + '</span>' +
                    '</div>'
                );
            }
            eventLogEl.innerHTML = html.length ? html.join('') : '<span style="color:#7a6048">No recent events.</span>';
            eventLogEl.scrollTop = eventLogEl.scrollHeight;
        }
    },

    _set: function(id, text) { var el = this._e[id]; if (el) el.textContent = text; },

    // ─── Show / Hide / Toggle ─────────────────────────────────────────────
    show: function() {
        this.visible = true;
        this.el.classList.add('rs-open');
        this._drawMapPreview();
    },
    hide: function() {
        this.visible = false;
        this.el.classList.remove('rs-open');
    },
    toggle: function() {
        if (this.visible) this.hide(); else this.show();
    },

    // ─── Keyboard ─────────────────────────────────────────────────────────
    // ─── Builder sub-tab switching ────────────────────────────────────────
    _builderTab: 'maps',
    _switchBuilderTab: function(tab) {
        this._builderTab = tab;
        var tabs = ['maps','units','npcs','events','factions','system'];
        for (var i = 0; i < tabs.length; i++) {
            var te = document.getElementById('rs-btab-' + tabs[i]);
            var pe = document.getElementById('rs-bpane-' + tabs[i]);
            if (te) te.classList.toggle('rs-active', tabs[i] === tab);
            if (pe) pe.classList.toggle('rs-active', tabs[i] === tab);
        }
        this._bRender(tab);
    },
    _bRender: function(tab) {
        this._bRenderStudioSection(tab);
    },

    _studioDataCount: function(type) {
        if (type === 'storymaps') {
            return Array.isArray(this._mapsCache) ? this._mapsCache.length : 0;
        }
        try { return this._bFetch(type).length; }
        catch (e) { return 0; }
    },

    _studioOpenExternal: function(path) {
        window.open(path, '_blank');
    },

    _studioEnsureMapEditor: function() {
        if (!this.engine) return null;
        if (!this.engine.mapEditor && typeof RealmKit.MapEditor === 'function') {
            this.engine.mapEditor = new RealmKit.MapEditor(this.engine);
        }
        return this.engine.mapEditor || null;
    },

    _studioEnsureWorldEditor: function() {
        if (!this.engine) return null;
        if (!this.engine.worldEditor && typeof RealmKit.WorldEditor === 'function') {
            this.engine.worldEditor = new RealmKit.WorldEditor(this.engine);
        }
        return this.engine.worldEditor || null;
    },

    _studioOpenMapPainter: function(layer) {
        var editor = this._studioEnsureMapEditor();
        if (!editor) {
            this._grimLog('Map painter unavailable');
            return;
        }
        editor.show();
        if (!editor.editMode && editor.toggleEditMode) editor.toggleEditMode();
        if (layer && editor.setLayer) editor.setLayer(layer);
        this._grimLog('Opened map painter (' + (layer || 'terrain') + ')');
    },

    _studioOpenWorldTool: function(layer) {
        var editor = this._studioEnsureWorldEditor();
        if (!editor) {
            this._grimLog('World editor unavailable');
            return;
        }
        editor.show();
        if (!editor.editMode && editor.toggleEditMode) editor.toggleEditMode();
        if (layer && editor.setLayer) editor.setLayer(layer);
        this._grimLog('Opened world editor (' + (layer || 'spawner') + ')');
    },

    _studioRefreshContext: function() {
        var sid = (this.engine && this.engine.currentStoryId) || this._ctxStoryId || null;
        if (sid && this.db && this._storyLoadStory) {
            this._storyLoadStory(sid);
            return;
        }
        this._bRenderStudioSection(this._builderTab || 'maps');
    },

    _studioSpec: function(section) {
        var counts = {
            maps: this._studioDataCount('storymaps'),
            mapweather: this._studioDataCount('mapweather'),
            units: this._studioDataCount('units'),
            chars: this._studioDataCount('chars'),
            factions: this._studioDataCount('factions'),
            quests: this._studioDataCount('quests'),
            dialog: this._studioDataCount('dialog'),
            scenes: this._studioDataCount('scenes'),
            tiles: this._studioDataCount('tiles')
        };
        return {
            maps: {
                title: 'MAPS',
                intro: 'Paint terrain, set local weather, and author travel logic at the map level.',
                tree: ['Map Painter', 'Weather (map-specific override)', 'Zones & Triggers'],
                items: [
                    { title:'Map Painter', meta:(counts.maps || 0) + ' story maps', desc:'Use the live paint tool for terrain, collision, spawners, trigger rectangles, and on-canvas world dressing.', actions:[
                        { label:'Open Painter', kind:'gold', method:"_studioOpenMapPainter('terrain')" },
                        { label:'Paint Collision', kind:'slate', method:"_studioOpenMapPainter('collision')" },
                        { label:'Map Registry', kind:'slate', method:"_bRenderMaps()" },
                        { label:'Open Map Studio', kind:'slate', method:"_openMapPopout()" }
                    ]},
                    { title:'Weather (Map-specific Override)', meta:(counts.mapweather || 0) + ' override presets', desc:'Map weather overrides should live with the map, even when the story or world has a broader weather pool.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" },
                        { label:'World Weather Pool', kind:'slate', method:"_switchBuilderTab('system')" }
                    ]},
                    { title:'Zones & Triggers', meta:'Doors, portals, encounter bounds', desc:'Author map transitions, triggers, and spawn areas using the live world editor so placement stays spatial.', actions:[
                        { label:'Open Zones', kind:'gold', method:"_studioOpenWorldTool('zone')" },
                        { label:'Open Triggers', kind:'slate', method:"_studioOpenWorldTool('trigger')" },
                        { label:'Open Spawners', kind:'slate', method:"_studioOpenWorldTool('spawner')" }
                    ]}
                ]
            },
            units: {
                title: 'UNITS',
                intro: 'Define reusable combat and presentation building blocks that NPC instances can inherit from.',
                tree: ['Base Templates', 'Sprite Sheets', 'Animations (base actions)', 'Audio (base sounds)', 'Loot Tables'],
                items: [
                    { title:'Base Templates', meta:(counts.units || 0) + ' templates', desc:'Base unit templates define default stats, faction defaults, sprite references, and combat behavior shared by many instances.', actions:[
                        { label:'Open Registry', kind:'gold', method:"_bRenderGeneric('units')" },
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]},
                    { title:'Sprite Sheets', meta:(counts.tiles || 0) + ' registered sheets', desc:'Sprite sheets and tilesets should be sourced from Pixel Painter so unit visuals stay reusable across stories and maps.', actions:[
                        { label:'Open Pixel Painter', kind:'gold', method:"_studioOpenExternal('sprite-builder.html')" }
                    ]},
                    { title:'Animations / Audio / Loot', meta:'Shared registries', desc:'Rarely changing unit-level registries like base actions, sounds, and loot tables should stay centralized and reusable.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" },
                        { label:'Audio Composer', kind:'slate', method:"_studioOpenExternal('audio-composer.html')" }
                    ]}
                ]
            },
            npcs: {
                title: 'NPCS',
                intro: 'Place story-specific character instances that override the reusable unit layer when needed.',
                tree: ['Character Instances', 'Unit Override (sprite/audio)', 'Loot Override/Addition', 'Dialog & Knowledge', 'Faction Assignment'],
                items: [
                    { title:'Character Instances', meta:(counts.chars || 0) + ' characters', desc:'Character instances anchor a specific named presence in the story with portrait, faction, and quest-facing metadata.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]},
                    { title:'Dialog & Knowledge', meta:(counts.dialog || 0) + ' dialogue entries', desc:'NPC dialogue, knowledge, hints, and codex-style facts should live alongside the instance layer so each map can tell its own story.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]},
                    { title:'Overrides', meta:'Sprite, loot, faction', desc:'Per-NPC overrides are where inherited unit defaults are bent for unique named actors, merchants, companions, and bosses.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]}
                ]
            },
            events: {
                title: 'EVENTS',
                intro: 'Drive quest flow, cinematic beats, reactive spawns, and map-specific scripted encounters.',
                tree: ['World Events (spawns, cinematics)', 'Quest Events', 'Quest definitions', 'Dependencies & chains'],
                items: [
                    { title:'World Events', meta:(counts.scenes || 0) + ' scenes', desc:'World events cover map-local triggers, cinematics, encounter starts, ambient happenings, and spawn orchestration.', actions:[
                        { label:'Open Triggers', kind:'gold', method:"_studioOpenWorldTool('trigger')" },
                        { label:'Open Spawners', kind:'slate', method:"_studioOpenWorldTool('spawner')" }
                    ]},
                    { title:'Quest Events', meta:(counts.quests || 0) + ' quests', desc:'Quest definitions, dependencies, and chain logic should remain story-authored data, with world events only firing the hooks.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]}
                ]
            },
            factions: {
                title: 'FACTIONS',
                intro: 'Keep allegiance, hostility, and favorability in a shared registry that units and NPCs can inherit from.',
                tree: ['Faction Registry'],
                items: [
                    { title:'Faction Registry', meta:(counts.factions || 0) + ' factions', desc:'The faction registry is the canonical source for assignments, favorability, hostility, world reactions, and political color.', actions:[
                        { label:'Open Registry', kind:'gold', method:"_bRenderGeneric('factions')" },
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]}
                ]
            },
            system: {
                title: 'SYSTEM',
                intro: 'Shared pools and rarely-touched registries belong here so they can be reused across stories.',
                tree: ['Weather Patterns (global pool)', 'Animation Registry (rarely used)', 'Global Audio Library', 'Item/Equipment Database'],
                items: [
                    { title:'Weather Patterns', meta:'Global pool', desc:'Global weather patterns should be authored once and referenced by stories or maps as needed.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]},
                    { title:'Animation / Audio Registries', meta:'Low-touch shared data', desc:'Animation and audio registries are system pools: author them once, then reference them from units, NPCs, and events.', actions:[
                        { label:'Open Pixel Painter', kind:'gold', method:"_studioOpenExternal('sprite-builder.html')" },
                        { label:'Audio Composer', kind:'slate', method:"_studioOpenExternal('audio-composer.html')" }
                    ]},
                    { title:'Item / Equipment Database', meta:'Shared item pool', desc:'Items, equipment, and reusable loot definitions belong in the shared system layer so stories can compose from them.', actions:[
                        { label:'Open Story Builder', kind:'gold', method:"_openStoryPopout()" }
                    ]}
                ]
            }
        }[section] || null;
    },

    _bRenderStudioSection: function(section) {
        var pane = document.getElementById('rs-bpane-' + section);
        var spec = this._studioSpec(section);
        if (!pane || !spec) return;

        var story = this.engine ? this.engine.currentStory : null;
        var storyTitle = story ? (story.title || 'Untitled Story') : ((this.engine && this.engine.currentStoryId) || 'No story selected');
        var storyStatus = story ? 'Story container active' : 'Open the story builder to pick or create a story container.';

        var treeHtml = '';
        for (var i = 0; i < spec.tree.length; i++) {
            treeHtml += '&bull; ' + this._esc(spec.tree[i]) + '<br>';
        }

        var cardsHtml = '';
        for (var j = 0; j < spec.items.length; j++) {
            var item = spec.items[j];
            var actionsHtml = '';
            for (var k = 0; k < item.actions.length; k++) {
                var a = item.actions[k];
                actionsHtml += '<button class="rs-btn rs-btn-' + (a.kind || 'slate') + '" onclick="RealmKit._sidebar.' + a.method + '">' + this._esc(a.label) + '</button>';
            }
            cardsHtml +=
                '<div class="rs-studio-card">' +
                    '<div class="rs-studio-card-hdr">' +
                        '<div class="rs-studio-card-title">' + this._esc(item.title) + '</div>' +
                        '<div class="rs-studio-card-meta">' + this._esc(item.meta || '') + '</div>' +
                    '</div>' +
                    '<div class="rs-studio-card-desc">' + this._esc(item.desc) + '</div>' +
                    '<div class="rs-studio-actions">' + actionsHtml + '</div>' +
                '</div>';
        }

        pane.innerHTML =
            '<div class="rs-studio-wrap">' +
                '<div class="rs-studio-hero">' +
                    '<div class="rs-studio-kicker">Realm Studio / ' + this._esc(spec.title) + '</div>' +
                    '<div class="rs-studio-title">' + this._esc(spec.title) + '</div>' +
                    '<div class="rs-studio-desc">' + this._esc(spec.intro) + '</div>' +
                    '<div class="rs-studio-crumbs">' +
                        'Story Container: <b>' + this._esc(storyTitle) + '</b><br>' +
                        this._esc(storyStatus) + '<br>' +
                        treeHtml +
                    '</div>' +
                    '<div class="rs-studio-actions" style="margin-top:8px;">' +
                        '<button class="rs-btn rs-btn-gold" onclick="RealmKit._sidebar._openStoryPopout()">Open Story Builder</button>' +
                        '<button class="rs-btn rs-btn-slate" onclick="RealmKit._sidebar._studioRefreshContext()">Refresh Context</button>' +
                    '</div>' +
                    '<div class="rs-studio-note">Story is the top-level container. Maps, units, NPCs, events, factions, and shared registries should all hang beneath that authored context.</div>' +
                '</div>' +
                '<div class="rs-studio-divider"></div>' +
                '<div class="rs-studio-grid">' + cardsHtml + '</div>' +
            '</div>';
    },

    // ─── Builder Data Helpers ─────────────────────────────────────────────
    _bFetch: function(type) {
        try   { return JSON.parse(localStorage.getItem('realmkit.b.' + type) || '[]'); }
        catch(e) { return []; }
    },
    _bStore: function(type, arr) {
        try { localStorage.setItem('realmkit.b.' + type, JSON.stringify(arr)); } catch(e) {}
    },
    _bGenId: function(prefix) {
        return (prefix || 'item') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 999);
    },
    _bUpsert: function(type, item) {
        var arr = this._bFetch(type);
        var found = false;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i]._id === item._id) { arr[i] = item; found = true; break; }
        }
        if (!found) arr.push(item);
        this._bStore(type, arr);
    },
    _bDeleteItem: function(type, id) {
        var arr = this._bFetch(type);
        var out = [];
        for (var i = 0; i < arr.length; i++) { if (arr[i]._id !== id) out.push(arr[i]); }
        this._bStore(type, out);
        if (type === 'tiles') this._bRenderTiles();
        else this._bRenderGeneric(type);
    },

    // ─── Builder Schemas ──────────────────────────────────────────────────
    _bSchema: function(tab) {
        var S = {
            factions: { label:'Factions', single:'Faction', nameKey:'name', fields:[
                {k:'name',        l:'Name',      t:'text',   req:true},
                {k:'color',       l:'Color',     t:'color'},
                {k:'alignment',   l:'Alignment', t:'select', opts:['neutral','lawful','chaotic','good','evil']},
                {k:'description', l:'Desc',      t:'textarea'},
            ]},
            chars: { label:'Characters', single:'Character', nameKey:'name', fields:[
                {k:'name',       l:'Name',     t:'text',   req:true},
                {k:'class',      l:'Class',    t:'text'},
                {k:'portrait',   l:'Portrait', t:'text',   hint:'sprite key or URL'},
                {k:'faction_id', l:'Faction',  t:'text',   hint:'faction _id'},
                {k:'hp',  l:'HP',  t:'number', def:100},
                {k:'mp',  l:'MP',  t:'number', def:50},
                {k:'atk', l:'ATK', t:'number', def:10},
                {k:'def', l:'DEF', t:'number', def:10},
                {k:'spd', l:'SPD', t:'number', def:10},
            ]},
            units: { label:'Unit Templates', single:'Unit Template', nameKey:'name', fields:[
                {k:'name',       l:'Name',    t:'text',   req:true},
                {k:'type',       l:'Type',    t:'select', opts:['infantry','archer','cavalry','mage','hero','monster','npc']},
                {k:'sprite',     l:'Sprite',  t:'text',   hint:'sprite key'},
                {k:'faction_id', l:'Faction', t:'text',   hint:'faction _id'},
                {k:'hp',   l:'HP',   t:'number', def:100},
                {k:'atk',  l:'ATK',  t:'number', def:10},
                {k:'def',  l:'DEF',  t:'number', def:10},
                {k:'spd',  l:'SPD',  t:'number', def:10},
                {k:'cost', l:'Cost', t:'number', def:0},
            ]},
            dialog: { label:'Dialogues', single:'Dialogue', nameKey:'id', fields:[
                {k:'id',      l:'ID',       t:'text', req:true, hint:'unique key e.g. intro_01'},
                {k:'speaker', l:'Speaker',  t:'text'},
                {k:'portrait',l:'Portrait', t:'text', hint:'sprite key'},
                {k:'lines',   l:'Lines',    t:'jsonarea', hint:'["Hello!", "Nice to meet you."]'},
                {k:'choices', l:'Choices',  t:'jsonarea', hint:'[{"text":"Greet","next":"greet_01"}]'},
            ]},
            quests: { label:'Quests', single:'Quest', nameKey:'title', fields:[
                {k:'title',       l:'Title',       t:'text', req:true},
                {k:'description', l:'Desc',        t:'textarea'},
                {k:'giver_id',    l:'Quest Giver', t:'text', hint:'char/unit _id'},
                {k:'objectives',  l:'Objectives',  t:'jsonarea', hint:'[{"text":"Slay 5 goblins","type":"kill","target":"goblin","count":5}]'},
                {k:'rewards',     l:'Rewards',     t:'jsonarea', hint:'{"gold":100,"xp":200,"items":[]}'},
            ]},
            scenes: { label:'Scenes', single:'Scene', nameKey:'id', fields:[
                {k:'id',      l:'ID',      t:'text', req:true, hint:'unique key e.g. intro_scene'},
                {k:'name',    l:'Name',    t:'text'},
                {k:'trigger', l:'Trigger', t:'jsonarea', hint:'{"type":"enter","zone":"zone_start","once":true}'},
                {k:'steps',   l:'Steps',   t:'jsonarea', hint:'[{"type":"dialog","id":"intro_01"},{"type":"wait","ms":1000}]'},
            ]},
            tiles: { label:'Tilesets', single:'Tileset', nameKey:'name', fields:[
                {k:'name',       l:'Name',       t:'text',   req:true},
                {k:'path',       l:'Image Path', t:'text',   hint:'relative path to tileset PNG'},
                {k:'tileWidth',  l:'Tile W',     t:'number', def:32},
                {k:'tileHeight', l:'Tile H',     t:'number', def:32},
                {k:'cols',       l:'Columns',    t:'number', def:8},
            ]},
        };
        return S[tab] || null;
    },

    // ─── Generic Section Renderer ─────────────────────────────────────────
    _bRenderGeneric: function(tab) {
        var self   = this;
        var schema = this._bSchema(tab);
        if (!schema) return;
        var pane = document.getElementById('rs-bpane-' + tab);
        if (!pane) return;
        var items   = this._bFetch(tab);
        var nameKey = schema.nameKey || 'name';

        var listHtml = '';
        if (items.length === 0) {
            listHtml =
                '<div style="color:#5a4030;font-size:7px;padding:12px 0;text-align:center;line-height:2;">' +
                'No ' + schema.label.toLowerCase() + ' yet.<br>Click <b>+ New</b> or use <b>{ } JSON</b> to import.</div>';
        } else {
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var dn = String(item[nameKey] || item.name || item.title || item.id || '(unnamed)');
                var safeId = self._esc(item._id);
                listHtml +=
                    '<div class="rs-b-row" onclick="RealmKit._sidebar._bOpenForm(\'' + tab + '\',\'' + safeId + '\')">' +
                    '<span class="rs-b-row-name">' + self._esc(dn) + '</span>' +
                    '<span class="rs-b-row-del" onclick="event.stopPropagation();' +
                    'RealmKit._sidebar._bConfirmDelete(\'' + tab + '\',\'' + safeId + '\')">✕</span>' +
                    '</div>';
            }
        }

        pane.innerHTML =
            '<div class="rs-b-toolbar">' +
            '<button class="rs-btn rs-btn-gold" style="flex:1;" onclick="RealmKit._sidebar._bOpenForm(\'' + tab + '\',null)">+ New</button>' +
            '<button class="rs-btn rs-btn-slate" style="flex:1;" onclick="RealmKit._sidebar._bToggleImport(\'' + tab + '\')">{ } JSON</button>' +
            '<button class="rs-btn rs-btn-slate" style="flex:1;" onclick="RealmKit._sidebar._bExportJSON(\'' + tab + '\')">⬇ Export</button>' +
            '</div>' +
            '<div class="rs-b-import" id="rs-bimp-' + tab + '" style="display:none;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
            '<span style="font-size:6px;color:#a09070;">Paste JSON array — matching _id updates in place:</span>' +
            '<button class="rs-btn rs-btn-slate" style="font-size:5px;padding:2px 5px;" ' +
            'onclick="RealmKit._sidebar._bLoadExample(\'' + tab + '\')" title="Load example JSON into this field">📋 Example</button>' +
            '</div>' +
            '<textarea id="rs-bimp-ta-' + tab + '" style="width:100%;height:90px;box-sizing:border-box;' +
            'background:#0a0604;color:#c8d8b8;border:1px solid #5a3c20;padding:4px;' +
            'font-family:monospace;font-size:9px;resize:vertical;"></textarea>' +
            '<div style="display:flex;gap:4px;margin-top:4px;">' +
            '<button class="rs-btn rs-btn-gold" style="flex:1;" onclick="RealmKit._sidebar._bApplyImport(\'' + tab + '\')">Apply</button>' +
            '<button class="rs-btn rs-btn-slate" style="flex:1;" onclick="RealmKit._sidebar._bToggleImport(\'' + tab + '\')">Cancel</button>' +
            '</div></div>' +
            '<div class="rs-b-list" id="rs-blist-' + tab + '">' + listHtml + '</div>' +
            '<div class="rs-b-form" id="rs-bform-' + tab + '" style="display:none;"></div>';
    },

    _bRenderTiles: function() {
        this._bRenderGeneric('tiles');
        var pane = document.getElementById('rs-bpane-tiles');
        if (!pane) return;

        // Kick off a server fetch if we don't have a cache yet
        if (this._ppServerCatalog === null) {
            this._ppFetchServerCatalog(); // async — will re-render when done
        }

        var catalog = this._ppCatalog([]);
        var ppRows = '';
        if (catalog.length === 0) {
            var fetchNote = this._ppServerCatalog === null ? ' (checking server…)' : '';
            ppRows = '<div style="font-size:6px;color:#5a4030;padding:6px 0;">' +
                     'No saved assets yet' + fetchNote + ' — save a sheet in Pixel Painter first.</div>';
        } else {
            for (var i = 0; i < catalog.length; i++) {
                var c = catalog[i];
                var badge = c._fromServer ? '<span style="font-size:5px;color:#4aaa88;">☁</span> ' : '';
                var label = badge + this._esc(c.name) + ' · ' + (c.frameW||'?') + '×' + (c.frameH||'?') +
                            'px · ' + (c.frame_count||'?') + ' frames';
                ppRows +=
                    '<div class="rs-b-row" onclick="RealmKit._sidebar._ppImportTile(\'' +
                    this._esc(c.id) + '\')">' +
                    '<span class="rs-b-row-name">' + label + '</span>' +
                    '<span style="font-size:6px;color:#5888a8;flex-shrink:0;">+ Register</span>' +
                    '</div>';
            }
        }

        var existing = pane.innerHTML;
        pane.innerHTML =
            '<div style="padding:6px 8px;background:rgba(10,20,40,0.55);border-bottom:2px solid #1a0800;">' +
            '<div style="font-size:6px;color:#7090a0;margin-bottom:5px;">📥 Import from ' +
            '<a href="sprite-builder.html" target="_blank" style="color:#88c8f0;text-decoration:none;">' +
            '🎨 Pixel Painter ↗</a></div>' +
            '<div style="max-height:110px;overflow-y:auto;">' + ppRows + '</div>' +
            '</div>' +
            existing;
    },

    // ─── Pixel Painter Catalog Helpers ────────────────────────────────────

    // Cache of server-fetched assets; null = not yet fetched this session.
    _ppServerCatalog: null,

    /**
     * Async — fetches /api/pp-assets and merges into _ppServerCatalog.
     * After fetching, re-renders the Tiles pane PP section and any open picker.
     */
    _ppFetchServerCatalog: function() {
        var self = this;
        fetch('api/pp-assets')
            .then(function(r) { return r.ok ? r.json() : []; })
            .then(function(list) {
                if (!Array.isArray(list)) list = [];
                // Normalise: server uses file_path, catalog uses file_path too — just store as-is
                self._ppServerCatalog = list;
                // Re-render tiles pane PP section if it's visible
                var tilesPane = document.getElementById('rs-bpane-tiles');
                if (tilesPane && tilesPane.classList.contains('rs-active')) {
                    self._bRenderTiles();
                }
            })
            .catch(function() {
                if (self._ppServerCatalog === null) self._ppServerCatalog = [];
            });
    },

    /**
     * Returns a merged, deduplicated catalog from both localStorage and server.
     * Server entries take precedence when ids collide (they have file_path set).
     */
    _ppCatalog: function(typeFilter) {
        var merged = {};

        // 1. Start with localStorage entries
        try {
            var local = JSON.parse(localStorage.getItem('realmkit.pp_catalog') || '[]');
            for (var i = 0; i < local.length; i++) {
                merged[local[i].id] = local[i];
            }
        } catch(e) {}

        // 2. Server entries overwrite local entries with same id
        var srv = this._ppServerCatalog;
        if (Array.isArray(srv)) {
            for (var j = 0; j < srv.length; j++) {
                var s = srv[j];
                // Map server field names to catalog field names
                merged[s.id] = {
                    id:          s.id,
                    name:        s.name,
                    category:    s.category,
                    frameW:      s.frameW,
                    frameH:      s.frameH,
                    scale:       s.scale,
                    frame_count: s.frame_count,
                    saved_at:    s.saved_at,
                    file_path:   s.file_path,   // real server URL — no pp: prefix needed
                    _fromServer: true,
                };
            }
        }

        var all = Object.values(merged);

        if (!typeFilter || typeFilter.length === 0) return all;
        return all.filter(function(e) {
            var cat = (e.category || '').toLowerCase();
            for (var i = 0; i < typeFilter.length; i++) {
                if (typeFilter[i] === '' || cat.indexOf(typeFilter[i]) !== -1) return true;
            }
            return false;
        });
    },

    // Register a PP catalog entry as a Builder tileset row
    _ppImportTile: function(assetId) {
        var catalog = this._ppCatalog([]);
        var entry   = null;
        for (var i = 0; i < catalog.length; i++) {
            if (catalog[i].id === assetId) { entry = catalog[i]; break; }
        }
        if (!entry) { alert('Catalog entry not found.'); return; }

        // Check if already registered
        var existing = this._bFetch('tiles');
        for (var j = 0; j < existing.length; j++) {
            if (existing[j]._ppRef === assetId) {
                if (!confirm('"' + entry.name + '" is already registered. Update it?')) return;
                break;
            }
        }

        var cols = Math.max(1, Math.round(Math.sqrt(entry.frame_count || 1)));
        // Server assets have a real file_path URL; local-only assets use the pp: prefix
        var tilePath = entry.file_path ? entry.file_path : ('pp:' + assetId);

        var newItem = {
            _id:        this._bGenId('tiles'),
            name:       entry.name,
            path:       tilePath,
            tileWidth:  entry.frameW || 32,
            tileHeight: entry.frameH || 32,
            cols:       cols,
            _ppRef:     assetId
        };
        this._bUpsert('tiles', newItem);
        this._bRenderTiles();
    },

    // PP sprite picker overlay — used for portrait/sprite fields in Chars & Units forms
    _ppPickSprite: function(tab, fieldKey) {
        var pane = document.getElementById('rs-bpane-' + tab);
        if (!pane) return;
        var self    = this;
        var catalog = this._ppCatalog([]);
        var rows    = '';
        if (catalog.length === 0) {
            rows = '<div style="font-size:6px;color:#5a4030;padding:8px 0;text-align:center;">' +
                   'No Pixel Painter assets saved yet.</div>';
        } else {
            for (var i = 0; i < catalog.length; i++) {
                var c     = catalog[i];
                var badge = c._fromServer ? '<span style="font-size:5px;color:#4aaa88;">☁ </span>' : '';
                var label = badge + self._esc(c.name) + ' · ' + (c.frameW||'?') + '×' + (c.frameH||'?');
                rows += '<div class="rs-b-row" onclick="RealmKit._sidebar._ppApplySprite(\'' +
                    tab + '\',\'' + self._esc(fieldKey) + '\',\'' + self._esc(c.id) + '\')">' +
                    '<span class="rs-b-row-name">' + label + '</span>' +
                    '<span style="font-size:6px;color:#5888a8;flex-shrink:0;">Select</span></div>';
            }
        }
        var old = document.getElementById('rs-pp-picker');
        if (old) old.remove();

        var overlay = document.createElement('div');
        overlay.id  = 'rs-pp-picker';
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;' +
            'background:rgba(8,5,2,0.95);z-index:100;display:flex;flex-direction:column;padding:10px;';
        overlay.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
            '<button class="rs-btn rs-btn-slate" ' +
            'onclick="document.getElementById(\'rs-pp-picker\').remove()">← Cancel</button>' +
            '<span style="font-size:7px;color:#a09070;">Pick from Pixel Painter</span></div>' +
            '<div style="flex:1;overflow-y:auto;">' + rows + '</div>';
        pane.appendChild(overlay);
    },

    _ppApplySprite: function(tab, fieldKey, assetId) {
        var el = document.getElementById('rs-bf-' + fieldKey);
        if (el) {
            // Resolve the actual path: server assets have file_path, local use pp: prefix
            var catalog = this._ppCatalog([]);
            var entry = null;
            for (var i = 0; i < catalog.length; i++) {
                if (catalog[i].id === assetId) { entry = catalog[i]; break; }
            }
            el.value = (entry && entry.file_path) ? entry.file_path : ('pp:' + assetId);
        }
        var picker = document.getElementById('rs-pp-picker');
        if (picker) picker.remove();
    },

    // ─── Form Open / Close / Save ─────────────────────────────────────────
    _bOpenForm: function(tab, itemId) {
        var self   = this;
        var schema = this._bSchema(tab);
        if (!schema) return;
        var items  = this._bFetch(tab);
        var item   = null;
        var isNew  = !itemId;
        if (!isNew) {
            for (var fi = 0; fi < items.length; fi++) {
                if (items[fi]._id === itemId) { item = items[fi]; break; }
            }
            if (!item) isNew = true;
        }
        if (isNew) {
            item = { _id: this._bGenId(tab) };
            for (var di = 0; di < schema.fields.length; di++) {
                var df = schema.fields[di];
                item[df.k] = (df.def !== undefined) ? df.def : '';
            }
        }
        var formEl = document.getElementById('rs-bform-' + tab);
        var listEl = document.getElementById('rs-blist-' + tab);
        var tbEl   = document.querySelector('#rs-bpane-' + tab + ' .rs-b-toolbar');
        var impEl  = document.getElementById('rs-bimp-' + tab);
        if (!formEl) return;
        if (listEl) listEl.style.display = 'none';
        if (tbEl)   tbEl.style.display   = 'none';
        if (impEl)  impEl.style.display  = 'none';
        formEl.style.display = '';

        var fields = '';
        for (var i = 0; i < schema.fields.length; i++) {
            var f   = schema.fields[i];
            var val = (item[f.k] !== undefined) ? item[f.k] : (f.def !== undefined ? f.def : '');
            fields += '<div class="rs-b-field">';
            fields += '<label class="rs-b-field-lbl">' + self._esc(f.l) +
                      (f.req ? ' <span style="color:#e04040">*</span>' : '') + '</label>';

            if (f.t === 'textarea') {
                fields += '<textarea id="rs-bf-' + f.k + '" class="rs-b-input" rows="2"' +
                          (f.hint ? ' placeholder="' + self._esc(f.hint) + '"' : '') + '>' +
                          self._esc(String(val)) + '</textarea>';
            } else if (f.t === 'jsonarea') {
                var dv = (typeof val !== 'string') ? JSON.stringify(val, null, 2) : val;
                fields += '<textarea id="rs-bf-' + f.k + '" class="rs-b-input" rows="4" ' +
                          'style="font-family:monospace;font-size:9px;letter-spacing:0;"' +
                          (f.hint ? ' placeholder="' + self._esc(f.hint) + '"' : '') + '>' +
                          self._esc(String(dv)) + '</textarea>';
            } else if (f.t === 'select') {
                fields += '<select id="rs-bf-' + f.k + '" class="rs-b-input">';
                for (var oi = 0; oi < f.opts.length; oi++) {
                    var op = f.opts[oi];
                    fields += '<option value="' + self._esc(op) + '"' +
                              (val === op ? ' selected' : '') + '>' + self._esc(op) + '</option>';
                }
                fields += '</select>';
            } else if (f.t === 'color') {
                var cv = String(val || '#c8a840');
                fields += '<div style="display:flex;gap:4px;align-items:center;">' +
                    '<input type="color" id="rs-bf-' + f.k + '" value="' + self._esc(cv) + '" ' +
                    'style="width:36px;height:24px;border:none;background:none;cursor:pointer;padding:0;" ' +
                    'oninput="document.getElementById(\'rs-bf-' + f.k + '-txt\').value=this.value">' +
                    '<input type="text" id="rs-bf-' + f.k + '-txt" value="' + self._esc(cv) + '" ' +
                    'class="rs-b-input" style="flex:1;" ' +
                    'oninput="document.getElementById(\'rs-bf-' + f.k + '\').value=this.value">' +
                    '</div>';
            } else {
                // Portrait/sprite text fields get a "📥 PP" picker button
                var isPpField = (f.k === 'portrait' || f.k === 'sprite');
                if (isPpField) {
                    fields +=
                        '<div style="display:flex;gap:4px;align-items:stretch;">' +
                        '<input type="text" id="rs-bf-' + f.k + '" value="' + self._esc(String(val)) + '" ' +
                        'class="rs-b-input" style="flex:1;"' +
                        (f.hint ? ' placeholder="' + self._esc(f.hint) + '"' : '') + '>' +
                        '<button class="rs-btn rs-btn-slate" style="flex-shrink:0;font-size:6px;padding:3px 5px;" ' +
                        'title="Pick from Pixel Painter" ' +
                        'onclick="RealmKit._sidebar._ppPickSprite(\'' + tab + '\',\'' + f.k + '\')">📥 PP</button>' +
                        '</div>';
                } else {
                    fields += '<input type="' + (f.t === 'number' ? 'number' : 'text') + '" ' +
                              'id="rs-bf-' + f.k + '" value="' + self._esc(String(val)) + '" class="rs-b-input"' +
                              (f.hint ? ' placeholder="' + self._esc(f.hint) + '"' : '') + '>';
                }
            }
            if (f.hint && f.t === 'text' && f.k !== 'portrait' && f.k !== 'sprite') {
                fields += '<div class="rs-b-hint">' + self._esc(f.hint) + '</div>';
            }
            fields += '</div>';
        }

        var delBtn = isNew ? '' :
            '<button class="rs-btn rs-btn-slate" style="flex:1;color:#d04040;" ' +
            'onclick="RealmKit._sidebar._bConfirmDelete(\'' + tab + '\',\'' + self._esc(item._id) + '\')">✕ Delete</button>';

        formEl.innerHTML =
            '<div class="rs-b-form-hdr">' +
            '<button class="rs-btn rs-btn-slate" onclick="RealmKit._sidebar._bCloseForm(\'' + tab + '\')">← Back</button>' +
            '<span style="font-size:7px;color:#a09070;">' + (isNew ? 'New ' : 'Edit ') +
            self._esc(schema.single || tab) + '</span></div>' +
            '<input type="hidden" id="rs-bf-_id" value="' + self._esc(item._id) + '">' +
            fields +
            '<div style="display:flex;gap:4px;margin-top:10px;">' +
            '<button class="rs-btn rs-btn-gold" style="flex:1;" ' +
            'onclick="RealmKit._sidebar._bSaveForm(\'' + tab + '\')">✓ Save</button>' +
            delBtn + '</div>';
    },

    _bConfirmDelete: function(tab, id) {
        var arr  = this._bFetch(tab);
        var item = null;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i]._id === id) { item = arr[i]; break; }
        }
        var schema = this._bSchema(tab) || {};
        var name = item ? String(item[(schema.nameKey||'name')] || item.name || item.title || item.id || 'this item') : 'this item';
        if (confirm('Delete "' + name + '"?')) {
            this._bDeleteItem(tab, id);
        }
    },

    _bCloseForm: function(tab) {
        var formEl = document.getElementById('rs-bform-' + tab);
        var listEl = document.getElementById('rs-blist-' + tab);
        var tbEl   = document.querySelector('#rs-bpane-' + tab + ' .rs-b-toolbar');
        if (formEl) formEl.style.display = 'none';
        if (listEl) listEl.style.display = '';
        if (tbEl)   tbEl.style.display   = '';
    },

    _bSaveForm: function(tab) {
        var self   = this;
        var schema = this._bSchema(tab);
        if (!schema) return;
        var idEl = document.getElementById('rs-bf-_id');
        if (!idEl) return;
        var item = { _id: idEl.value };
        for (var i = 0; i < schema.fields.length; i++) {
            var f  = schema.fields[i];
            var el = document.getElementById('rs-bf-' + f.k);
            if (!el) continue;
            if (f.req && !el.value.trim()) {
                alert(f.l + ' is required.');
                el.focus(); return;
            }
            if (f.t === 'number') {
                item[f.k] = parseFloat(el.value) || 0;
            } else if (f.t === 'jsonarea') {
                try   { item[f.k] = JSON.parse(el.value); }
                catch (e) { item[f.k] = el.value; }
            } else if (f.t === 'color') {
                var txt = document.getElementById('rs-bf-' + f.k + '-txt');
                item[f.k] = txt ? txt.value : el.value;
            } else {
                item[f.k] = el.value;
            }
        }
        this._bUpsert(tab, item);
        if (tab === 'tiles') this._bRenderTiles();
        else this._bRenderGeneric(tab);
    },

    // ─── Import / Export ──────────────────────────────────────────────────
    _bToggleImport: function(tab) {
        var el = document.getElementById('rs-bimp-' + tab);
        if (!el) return;
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? '' : 'none';
        // make sure list/toolbar visible when import opened
        var listEl = document.getElementById('rs-blist-' + tab);
        var formEl = document.getElementById('rs-bform-' + tab);
        if (listEl) listEl.style.display = '';
        if (formEl) formEl.style.display = 'none';
        var tbEl = document.querySelector('#rs-bpane-' + tab + ' .rs-b-toolbar');
        if (tbEl) tbEl.style.display = '';
    },
    /** Fetch the example JSON file for this tab and load it into the import textarea. */
    _bLoadExample: function(tab) {
        var ta = document.getElementById('rs-bimp-ta-' + tab);
        if (!ta) return;
        // Map tab names to example file names
        var fileMap = {
            factions: 'factions',
            chars:    'characters',
            units:    'units',
            dialog:   'dialogues',
            quests:   'quests',
            scenes:   'scenes',
            tiles:    'tilesets',
            story:    'stories',
        };
        var fileName = fileMap[tab];
        if (!fileName) { ta.value = '// No example file for this tab'; return; }
        var url = 'builder-templates/' + fileName + '.example.json';
        ta.value = 'Loading…';
        fetch(url)
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function(text) {
                ta.value = text;
                ta.focus();
                ta.select();
            })
            .catch(function(e) {
                ta.value = '// Could not load example: ' + e.message + '\n// Make sure the API/web server is running.';
            });
    },

    _bApplyImport: function(tab) {
        var ta = document.getElementById('rs-bimp-ta-' + tab);
        if (!ta || !ta.value.trim()) { alert('Paste JSON first.'); return; }
        try {
            var imported = JSON.parse(ta.value);
            if (!Array.isArray(imported)) imported = [imported];
            var existing = this._bFetch(tab);
            for (var i = 0; i < imported.length; i++) {
                var item = imported[i];
                if (!item._id) item._id = this._bGenId(tab);
                var found = false;
                for (var j = 0; j < existing.length; j++) {
                    if (existing[j]._id === item._id) { existing[j] = item; found = true; break; }
                }
                if (!found) existing.push(item);
            }
            this._bStore(tab, existing);
            ta.value = '';
            if (tab === 'tiles') this._bRenderTiles();
            else this._bRenderGeneric(tab);
        } catch (e) { alert('Invalid JSON: ' + e.message); }
    },
    _bExportJSON: function(tab) {
        var items = this._bFetch(tab);
        var json  = JSON.stringify(items, null, 2);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(json)
                .then(function() { alert('Copied ' + items.length + ' item(s) to clipboard.'); })
                .catch(function() { prompt('Copy JSON:', json); });
        } else { prompt('Copy JSON:', json); }
    },

    // ─── Story-specific builder methods ───────────────────────────────────
    _bStoryNew: function() {
        var formEl = document.getElementById('rs-story-form');
        var listEl = document.getElementById('rs-story-list');
        var impEl  = document.getElementById('rs-story-import-area');
        if (formEl) formEl.style.display = '';
        if (listEl) listEl.style.display = 'none';
        if (impEl)  impEl.style.display  = 'none';
    },
    _bStoryCloseForm: function() {
        var formEl = document.getElementById('rs-story-form');
        var listEl = document.getElementById('rs-story-list');
        if (formEl) formEl.style.display = 'none';
        if (listEl) listEl.style.display = '';
    },
    _bStorySave: function() {
        var self    = this;
        var titleEl = document.getElementById('rs-story-f-title');
        var descEl  = document.getElementById('rs-story-f-desc');
        var tagsEl  = document.getElementById('rs-story-f-tags');
        if (!titleEl || !titleEl.value.trim()) {
            alert('Title is required.');
            if (titleEl) titleEl.focus();
            return;
        }
        var story = {
            title:       titleEl.value.trim(),
            description: descEl  ? descEl.value  : '',
            tags:        tagsEl  ? tagsEl.value  : '',
            is_published: false,
            created_at:  new Date().toISOString()
        };
        if (this.db && typeof this.db.createStory === 'function') {
            this._storySetStatus('Creating story...');
            this.db.createStory(story).then(function(result) {
                self._storySetStatus('Created: ' + (result.title || story.title));
                titleEl.value = ''; if (descEl) descEl.value = ''; if (tagsEl) tagsEl.value = '';
                self._bStoryCloseForm();
                self._storyLoadList();
            }).catch(function(err) {
                self._storySetStatus('Create failed');
                console.error('[RealmSidebar] Story create failed:', err);
            });
        } else {
            // Fallback: persist locally when no StoryDatabase is available
            story._id = this._bGenId('story');
            var arr = this._bFetch('stories_local');
            arr.push(story);
            this._bStore('stories_local', arr);
            this._storySetStatus('Saved locally: ' + story.title);
            titleEl.value = ''; if (descEl) descEl.value = ''; if (tagsEl) tagsEl.value = '';
            this._bStoryCloseForm();
        }
    },
    _bStoryToggleImport: function() {
        var el = document.getElementById('rs-story-import-area');
        if (!el) return;
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? '' : 'none';
        if (el.style.display === '') {
            var formEl = document.getElementById('rs-story-form');
            if (formEl) formEl.style.display = 'none';
        }
    },
    _bStoryApplyImport: function() {
        var self = this;
        var ta   = document.getElementById('rs-story-import-ta');
        if (!ta || !ta.value.trim()) { alert('Paste JSON first.'); return; }
        try {
            var imported = JSON.parse(ta.value);
            if (!Array.isArray(imported)) imported = [imported];
            if (this.db && typeof this.db.createStory === 'function') {
                var pending = imported.length;
                var errors  = 0;
                imported.forEach(function(s) {
                    self.db.createStory(s).then(function() {
                        if (--pending === 0) {
                            self._storySetStatus('Imported ' + imported.length + ' stories');
                            ta.value = '';
                            self._bStoryToggleImport();
                            self._storyLoadList();
                        }
                    }).catch(function() {
                        errors++;
                        if (--pending === 0) {
                            self._storySetStatus('Import done (' + errors + ' error(s))');
                            self._storyLoadList();
                        }
                    });
                });
            } else {
                var arr = this._bFetch('stories_local');
                imported.forEach(function(s) {
                    if (!s._id) s._id = self._bGenId('story');
                    arr.push(s);
                });
                this._bStore('stories_local', arr);
                this._storySetStatus('Imported ' + imported.length + ' stories (local)');
                ta.value = '';
                this._bStoryToggleImport();
            }
        } catch (e) { alert('Invalid JSON: ' + e.message); }
    },

    _bindKeys: function() {
        var self = this;
        window.addEventListener('keydown', function(e) {
            var ae = document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

            if (e.key === '`' || e.key === 'F2') {
                e.preventDefault();
                // If sidebar is open in builder mode, F2 switches to dev; otherwise toggle
                if (self.visible && self._mode === 'builder') {
                    self._setMode('dev');
                } else {
                    self.toggle();
                }
            }
            if (e.key === 'F4') {
                e.preventDefault();
                // If sidebar is open in dev mode, F4 switches to builder; otherwise open to builder
                if (self.visible && self._mode === 'dev') {
                    self._setMode('builder');
                } else if (!self.visible) {
                    self._setMode('builder');
                } else {
                    self.hide();
                }
            }
        });
    },

    // ─── Maps Tab ─────────────────────────────────────────────────────────────
    _ctxStoryId: null,   // set when a story is selected; consumed by Maps tab
    _mapsCache:  null,   // [{id,name,map_type,is_entry_map,parent_map_id,width,height,...}]
    _mapsFormId: null,   // id of map currently open in edit form, or null for new

    _bRenderMaps: function() {
        var self  = this;
        var pane  = document.getElementById('rs-bpane-maps');
        if (!pane) return;

        var sid = this._ctxStoryId || (this.engine && this.engine.currentStoryId) || null;
        if (!sid) {
            pane.innerHTML =
                '<div style="padding:16px;text-align:center;color:#7a6040;font-size:7px;line-height:2.2;">' +
                '🗺 No story selected.<br>Click a story in the <b>📖 Story</b> tab<br>to manage its maps.</div>';
            return;
        }

        pane.innerHTML = '<div style="padding:10px;color:#c8a840;font-size:7px;">Loading maps…</div>';

        fetch('/RealmKit/api/maps?story_id=' + encodeURIComponent(sid))
            .then(function(r) { return r.json(); })
            .then(function(maps) {
                self._mapsCache = maps;
                self._bRenderMapsPanel(sid, maps);
            })
            .catch(function(err) {
                pane.innerHTML = '<div style="padding:10px;color:#e04040;font-size:7px;">Failed to load maps: ' + err.message + '</div>';
            });
    },

    _bRenderMapsPanel: function(sid, maps) {
        var self = this;
        var pane = document.getElementById('rs-bpane-maps');
        if (!pane) return;

        var MAP_TYPE_ICONS = {
            overworld: '🌍', interior: '🏠', dungeon: '⚔️',
            cave: '🪨', town: '🏘️', world: '🗺️', custom: '✨'
        };

        var listHtml = '';
        if (!maps || maps.length === 0) {
            listHtml = '<div style="color:#5a4030;font-size:7px;padding:12px 0;text-align:center;line-height:2;">' +
                       'No maps yet. Click <b>+ New Map</b> to add one.</div>';
        } else {
            for (var i = 0; i < maps.length; i++) {
                var m = maps[i];
                var icon = MAP_TYPE_ICONS[m.map_type] || '🗺️';
                var entry = self._esc(icon + ' ' + m.name);
                var badge = m.is_entry_map
                    ? '<span style="font-size:6px;color:#50c050;margin-left:4px;" title="Entry map">★</span>' : '';
                var parentNote = '';
                if (m.parent_map_id) {
                    var parent = (self._mapsCache || []).filter(function(x){ return x.id === m.parent_map_id; })[0];
                    if (parent) parentNote = '<div style="font-size:5px;color:#7a9070;margin-top:2px;">↳ ' + self._esc(parent.name) + '</div>';
                }
                var conns = Array.isArray(m.connections) ? m.connections : [];
                var connBadge = conns.length > 0
                    ? '<span style="font-size:6px;color:#8090c0;margin-left:4px;" title="' + conns.length + ' connection(s)">' + conns.length + ' 🚪</span>'
                    : '';
                var safeId = self._esc(m.id);
                listHtml +=
                    '<div class="rs-b-row" onclick="RealmKit._sidebar._bMapsOpenForm(\'' + safeId + '\')">' +
                    '<div style="flex:1;min-width:0;">' +
                    '<div style="display:flex;align-items:center;">' +
                    '<span class="rs-b-row-name">' + entry + badge + connBadge + '</span>' +
                    '</div>' +
                    '<div style="font-size:5px;color:#7a6840;margin-top:2px;">' +
                    self._esc(m.map_type) + ' · ' + m.width + '×' + m.height +
                    (m.description ? ' · ' + self._esc(m.description.substring(0,40)) + (m.description.length > 40 ? '…' : '') : '') +
                    '</div>' +
                    parentNote +
                    '</div>' +
                    '<span class="rs-b-row-del" onclick="event.stopPropagation();RealmKit._sidebar._bMapsDelete(\'' + safeId + '\')">✕</span>' +
                    '</div>';
            }
        }

        pane.innerHTML =
            '<div class="rs-b-toolbar">' +
            '<button class="rs-btn rs-btn-gold"  style="flex:1;" onclick="RealmKit._sidebar._bMapsOpenForm(null)">+ New Map</button>' +
            '<button class="rs-btn rs-btn-slate" style="flex:1;" onclick="RealmKit._sidebar._bRenderMaps()">⟳ Refresh</button>' +
            '</div>' +
            '<div class="rs-log-box" id="rs-maps-list" style="max-height:340px;">' + listHtml + '</div>' +
            '<div id="rs-maps-form-container" style="display:none;"></div>';
    },

    _bMapsOpenForm: function(mapId) {
        var self = this;
        var container = document.getElementById('rs-maps-form-container');
        var listEl    = document.getElementById('rs-maps-list');
        var toolbar   = document.querySelector('#rs-bpane-maps .rs-b-toolbar');
        if (!container) return;

        this._mapsFormId = mapId || null;

        var m = null;
        if (mapId && this._mapsCache) {
            for (var i = 0; i < this._mapsCache.length; i++) {
                if (this._mapsCache[i].id === mapId) { m = this._mapsCache[i]; break; }
            }
        }

        // Build parent options
        var parentOpts = '<option value="">— none —</option>';
        if (this._mapsCache) {
            for (var j = 0; j < this._mapsCache.length; j++) {
                var pm = this._mapsCache[j];
                if (pm.id === mapId) continue; // can't be own parent
                var sel2 = (m && m.parent_map_id === pm.id) ? ' selected' : '';
                parentOpts += '<option value="' + self._esc(pm.id) + '"' + sel2 + '>' +
                              self._esc(pm.name) + ' (' + pm.map_type + ')</option>';
            }
        }

        // Build connections editor
        var conns = (m && Array.isArray(m.connections)) ? m.connections : [];
        var connsHtml = this._bMapsConnsHtml(conns);

        var isEntry = m && m.is_entry_map;

        container.style.display = 'block';
        if (listEl)  listEl.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';

        container.innerHTML =
            '<div class="rs-b-form-hdr">' +
            '<button class="rs-btn rs-btn-slate" onclick="RealmKit._sidebar._bMapsCloseForm()">← Back</button>' +
            '<span style="font-size:7px;color:#a09070;">' + (m ? 'Edit Map' : 'New Map') + '</span>' +
            '</div>' +

            /* name */
            '<div class="rs-b-field"><label class="rs-b-field-lbl">Name <span style="color:#e04040">*</span></label>' +
            '<input type="text" id="rs-mf-name" class="rs-b-input" value="' + self._esc(m ? m.name : '') + '" placeholder="Village of Ashenveil"></div>' +

            /* map type */
            '<div class="rs-b-field"><label class="rs-b-field-lbl">Type</label>' +
            '<select id="rs-mf-type" class="rs-b-input">' +
            ['overworld','interior','dungeon','cave','town','world','custom'].map(function(t) {
                return '<option value="' + t + '"' + (m && m.map_type === t ? ' selected' : '') + '>' + t + '</option>';
            }).join('') +
            '</select></div>' +

            /* dimensions */
            '<div style="display:flex;gap:6px;">' +
            '<div class="rs-b-field" style="flex:1;"><label class="rs-b-field-lbl">Width (tiles)</label>' +
            '<input type="number" id="rs-mf-width" class="rs-b-input" value="' + (m ? m.width : 20) + '" min="1"></div>' +
            '<div class="rs-b-field" style="flex:1;"><label class="rs-b-field-lbl">Height (tiles)</label>' +
            '<input type="number" id="rs-mf-height" class="rs-b-input" value="' + (m ? m.height : 15) + '" min="1"></div>' +
            '</div>' +

            /* description */
            '<div class="rs-b-field"><label class="rs-b-field-lbl">Description</label>' +
            '<textarea id="rs-mf-desc" class="rs-b-input" rows="2" placeholder="A fog-shrouded forest clearing...">' + self._esc(m ? (m.description || '') : '') + '</textarea></div>' +

            /* tileset path */
            '<div class="rs-b-field"><label class="rs-b-field-lbl">Tileset Path</label>' +
            '<input type="text" id="rs-mf-tileset-path" class="rs-b-input" value="' + self._esc(m ? (m.tileset_path || '') : '') + '" placeholder="assets/tilesets/overworld.png"></div>' +

            /* parent map */
            '<div class="rs-b-field"><label class="rs-b-field-lbl">Parent Map</label>' +
            '<select id="rs-mf-parent" class="rs-b-input">' + parentOpts + '</select>' +
            '<div style="font-size:5px;color:#7a6840;margin-top:2px;">For interiors/dungeons: which overworld map contains this map\'s entrance.</div></div>' +

            /* entry map flag */
            '<div class="rs-b-field"><label class="rs-b-field-lbl" style="display:flex;align-items:center;gap:6px;">' +
            '<input type="checkbox" id="rs-mf-entry" style="width:auto;" ' + (isEntry ? 'checked' : '') + '> Entry Map</label>' +
            '<div style="font-size:5px;color:#7a6840;margin-top:2px;">The first map loaded when a story begins. Only one per story.</div></div>' +

            /* ── connections ── */
            '<div class="rs-b-field">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
            '<label class="rs-b-field-lbl">Connections / Portals</label>' +
            '<button class="rs-btn rs-btn-gold" style="font-size:5px;padding:2px 5px;" onclick="RealmKit._sidebar._bMapsAddConn()">+ Add</button>' +
            '</div>' +
            '<div id="rs-mf-conns">' + connsHtml + '</div>' +
            '<div style="font-size:5px;color:#7a6840;margin-top:4px;line-height:1.8;">Each portal links a tile position on this map to an entry point on another map.</div>' +
            '</div>' +

            /* save */
            '<button class="rs-btn rs-btn-gold" onclick="RealmKit._sidebar._bMapsSave()" style="width:100%;margin-top:8px;">✓ Save Map</button>';
    },

    _bMapsConnsHtml: function(conns) {
        var self = this;
        var html = '';
        var mapOpts = '<option value="">— none —</option>';
        if (this._mapsCache) {
            for (var j = 0; j < this._mapsCache.length; j++) {
                var pm = this._mapsCache[j];
                mapOpts += '<option value="' + self._esc(pm.id) + '">' + self._esc(pm.name) + '</option>';
            }
        }
        for (var i = 0; i < conns.length; i++) {
            var c = conns[i];
            var cid = c.id || ('conn_' + i);
            html +=
                '<div class="rs-maps-conn" id="rs-conn-' + self._esc(cid) + '" data-conn-idx="' + i + '" ' +
                'style="background:#0a0604;border:1px solid #3a2818;border-radius:3px;padding:5px;margin-bottom:5px;">' +

                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<span style="font-size:6px;color:#c8a840;">🚪 Connection ' + (i+1) + '</span>' +
                '<button class="rs-btn rs-btn-red" style="font-size:5px;padding:1px 4px;" ' +
                'onclick="RealmKit._sidebar._bMapsRemoveConn(' + i + ')">✕</button>' +
                '</div>' +

                '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +

                '<div style="flex:1;min-width:100px;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Label</div>' +
                '<input class="rs-b-input rs-conn-label" style="width:100%;box-sizing:border-box;" value="' + self._esc(c.label || '') + '" placeholder="Front Door">' +
                '</div>' +

                '<div style="flex:1;min-width:120px;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Destination Map</div>' +
                '<select class="rs-b-input rs-conn-target-map">' +
                mapOpts.replace('value="' + (c.target_map_id||'') + '"', 'value="' + (c.target_map_id||'') + '" selected') +
                '</select>' +
                '</div>' +

                '</div>' +

                '<div style="display:flex;gap:4px;margin-top:4px;">' +

                '<div style="flex:1;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Portal tile X</div>' +
                '<input type="number" class="rs-b-input rs-conn-x" value="' + (c.x !== undefined ? c.x : '') + '" placeholder="5">' +
                '</div>' +
                '<div style="flex:1;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Portal tile Y</div>' +
                '<input type="number" class="rs-b-input rs-conn-y" value="' + (c.y !== undefined ? c.y : '') + '" placeholder="3">' +
                '</div>' +
                '<div style="flex:1;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Arrive X</div>' +
                '<input type="number" class="rs-b-input rs-conn-tx" value="' + (c.target_x !== undefined ? c.target_x : '') + '" placeholder="2">' +
                '</div>' +
                '<div style="flex:1;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Arrive Y</div>' +
                '<input type="number" class="rs-b-input rs-conn-ty" value="' + (c.target_y !== undefined ? c.target_y : '') + '" placeholder="10">' +
                '</div>' +

                '</div>' +

                '<div style="display:flex;gap:4px;margin-top:4px;">' +
                '<div style="flex:1;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Facing on arrival</div>' +
                '<select class="rs-b-input rs-conn-dir">' +
                ['none','up','down','left','right'].map(function(d) {
                    return '<option value="' + d + '"' + (c.direction === d ? ' selected' : '') + '>' + d + '</option>';
                }).join('') +
                '</select>' +
                '</div>' +
                '<div style="flex:1;">' +
                '<div style="font-size:5px;color:#a09070;margin-bottom:2px;">Transition</div>' +
                '<select class="rs-b-input rs-conn-trans">' +
                ['fade','warp','walk','none'].map(function(d) {
                    return '<option value="' + d + '"' + (c.transition === d ? ' selected' : '') + '>' + d + '</option>';
                }).join('') +
                '</select>' +
                '</div>' +
                '</div>' +

                '</div>'; /* end .rs-maps-conn */
        }
        return html || '<div style="font-size:6px;color:#5a4030;padding:6px 0;">No connections yet. Click + Add.</div>';
    },

    _bMapsAddConn: function() {
        // Collect current conn data from DOM, add a blank one, re-render
        var existing = this._bMapsCollectConns();
        existing.push({ id: 'conn_' + Date.now().toString(36), label: '', target_map_id: '', x: '', y: '', target_x: '', target_y: '', direction: 'none', transition: 'fade' });
        var connsEl = document.getElementById('rs-mf-conns');
        if (connsEl) connsEl.innerHTML = this._bMapsConnsHtml(existing);
    },

    _bMapsRemoveConn: function(idx) {
        var existing = this._bMapsCollectConns();
        existing.splice(idx, 1);
        var connsEl = document.getElementById('rs-mf-conns');
        if (connsEl) connsEl.innerHTML = this._bMapsConnsHtml(existing);
    },

    _bMapsCollectConns: function() {
        var conns = [];
        var connEls = document.querySelectorAll('#rs-mf-conns .rs-maps-conn');
        for (var i = 0; i < connEls.length; i++) {
            var el = connEls[i];
            var get = function(cls) { var n = el.querySelector('.' + cls); return n ? n.value : ''; };
            conns.push({
                id:            el.id.replace('rs-conn-', '') || ('conn_' + i),
                label:         get('rs-conn-label'),
                target_map_id: get('rs-conn-target-map'),
                x:             get('rs-conn-x')  !== '' ? parseInt(get('rs-conn-x'),  10) : null,
                y:             get('rs-conn-y')  !== '' ? parseInt(get('rs-conn-y'),  10) : null,
                target_x:      get('rs-conn-tx') !== '' ? parseInt(get('rs-conn-tx'), 10) : null,
                target_y:      get('rs-conn-ty') !== '' ? parseInt(get('rs-conn-ty'), 10) : null,
                direction:     get('rs-conn-dir'),
                transition:    get('rs-conn-trans'),
            });
        }
        return conns;
    },

    _bMapsSave: function() {
        var self = this;
        var sid  = this._ctxStoryId || (this.engine && this.engine.currentStoryId) || null;
        if (!sid) { alert('No story selected'); return; }

        var name = (document.getElementById('rs-mf-name') || {}).value || '';
        if (!name.trim()) { alert('Name is required'); return; }

        var payload = {
            story_id:      sid,
            name:          name.trim(),
            map_type:      (document.getElementById('rs-mf-type')         || {}).value || 'overworld',
            width:         parseInt((document.getElementById('rs-mf-width')  || {}).value || '20',  10),
            height:        parseInt((document.getElementById('rs-mf-height') || {}).value || '15',  10),
            description:   (document.getElementById('rs-mf-desc')            || {}).value || '',
            tileset_path:  (document.getElementById('rs-mf-tileset-path')    || {}).value || '',
            parent_map_id: (document.getElementById('rs-mf-parent')          || {}).value || null,
            is_entry_map:  !!(document.getElementById('rs-mf-entry')         || {}).checked,
            connections:   this._bMapsCollectConns(),
        };
        if (this._mapsFormId) payload.id = this._mapsFormId;

        var url    = '/RealmKit/api/maps';
        var method = 'POST';

        fetch(url, {
            method:  method,
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        })
        .then(function(r) {
            if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || r.statusText); });
            return r.json();
        })
        .then(function() {
            self._mapsCache = null;
            self._bMapsCloseForm();
            self._bRenderMaps();
        })
        .catch(function(err) {
            alert('Save failed: ' + err.message);
        });
    },

    _bMapsDelete: function(mapId) {
        if (!confirm('Delete this map? This cannot be undone.')) return;
        var self = this;
        fetch('/RealmKit/api/maps/' + encodeURIComponent(mapId), { method: 'DELETE' })
            .then(function() {
                self._mapsCache = null;
                self._bRenderMaps();
            })
            .catch(function(err) { alert('Delete failed: ' + err.message); });
    },

    _bMapsCloseForm: function() {
        var container = document.getElementById('rs-maps-form-container');
        var listEl    = document.getElementById('rs-maps-list');
        var toolbar   = document.querySelector('#rs-bpane-maps .rs-b-toolbar');
        if (container) container.style.display = 'none';
        if (listEl)    listEl.style.display    = 'block';
        if (toolbar)   toolbar.style.display   = '';
        this._mapsFormId = null;
    }

};

// ─────────────────────────────────────────────────────────────────────────────
//  Shim constructors so Engine.js finds DevPanel + StoryBuilder unchanged
// ─────────────────────────────────────────────────────────────────────────────
RealmKit._sidebar = null;

/** Replaces RealmKit.DevPanel — engine does `this.devPanel = new RealmKit.DevPanel(engine)` */
RealmKit.DevPanel = function DevPanel(engine) {
    if (!RealmKit._sidebar) {
        RealmKit._sidebar = new RealmKit._RealmSidebarImpl(engine);
    }
    // Returning an object from `new` causes JavaScript to use that object instead
    return RealmKit._sidebar;
};
// Keep static lookup so DevPanel.TILE_NAMES still works
RealmKit.DevPanel.TILE_NAMES = RealmKit._RealmSidebarImpl.TILE_NAMES;

/** Replaces RealmKit.StoryBuilder — engine does `this.storyBuilder = new RealmKit.StoryBuilder(engine)` */
RealmKit.StoryBuilder = function StoryBuilder(engine) {
    // Use StoryBuilderSidebar if available, otherwise fall back to sidebar
    if (typeof RealmKit.StoryBuilderSidebar !== 'undefined') {
        return RealmKit.StoryBuilderSidebar.install(engine);
    }
    if (!RealmKit._sidebar) {
        RealmKit._sidebar = new RealmKit._RealmSidebarImpl(engine);
    }
    return RealmKit._sidebar;
};

console.log('[RealmSidebar] Loaded — press ` or F2 to toggle sidebar');
