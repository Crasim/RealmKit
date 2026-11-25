var RealmKit = RealmKit || {};

RealmKit.StoryBuilder = function StoryBuilder(engine) {
    this.engine = engine;
    this.visible = false;
    this.el = null;
    this.tabs = {};
    this.activeTab = 'story';
    this.currentStoryId = null;
    this.storyData = null;
    this.db = new RealmKit.StoryDatabase();
    this._e = {};
    
    this._build();
    this._bindKeys();
};

RealmKit.StoryBuilder.prototype = {
    
    _build: function() {
        var self = this;
        var style = document.createElement('style');
        style.textContent = this._getStyles();
        document.head.appendChild(style);
        
        var p = document.createElement('div');
        p.id = 'rk-storybuilder';
        p.innerHTML = this._getHTML();
        document.body.appendChild(p);
        this.el = p;
        
        var ids = [
            'sb-close', 'sb-story-list', 'sb-story-info',
            'sb-tab-story', 'sb-tab-factions', 'sb-tab-characters',
            'sb-tab-dialogues', 'sb-tab-quests', 'sb-tab-scenes',
            'sb-tab-tilesets', 'sb-content'
        ];
        for (var i = 0; i < ids.length; i++) {
            this._e[ids[i]] = document.getElementById(ids[i]);
        }
        
        this._bindEvents();
        this._hideAllTabs();
        this.tabs = {
            story: { editor: null, loaded: false },
            factions: { editor: null, loaded: false },
            characters: { editor: null, loaded: false },
            units: { editor: null, loaded: false },
            dialogues: { editor: null, loaded: false },
            quests: { editor: null, loaded: false },
            scenes: { editor: null, loaded: false },
            tilesets: { editor: null, loaded: false }
        };
        
        console.log('[StoryBuilder] UI built');
        this._sendLog('builder_init', { status: 'ready' });
    },
    
    _getStyles: function() {
        return [
            '@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");',
            '',
            '#rk-storybuilder {',
            '  position: fixed;',
            '  top: 0; left: 0;',
            '  width: 100%; height: 100%;',
            '  z-index: 10001;',
            '  font-family: "Press Start 2P", monospace;',
            '  image-rendering: pixelated;',
            '  display: none;',
            '  background: rgba(10, 10, 18, 0.95);',
            '}',
            '',
            '.sb-frame {',
            '  position: relative;',
            '  width: 95%; height: 92%;',
            '  margin: 2% auto;',
            '  max-width: 1200px;',
            '  background: #2a1408;',
            '  padding: 18px;',
            '  box-shadow: ',
            '    0 0 0 5px #1a0800,',
            '    0 0 0 9px #3a2008,',
            '    0 12px 24px rgba(0, 0, 0, 0.6);',
            '}',
            '',
            '.sb-frame::before {',
            '  content: "";',
            '  position: absolute;',
            '  top: 0; left: 0; right: 0; bottom: 0;',
            '  background: ',
            '    repeating-linear-gradient(90deg, transparent 0px, transparent 5px, rgba(80, 50, 20, 0.3) 5px, rgba(80, 50, 20, 0.3) 6px),',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(60, 35, 15, 0.2) 12px, rgba(60, 35, 15, 0.2) 18px),',
            '    linear-gradient(180deg, #4a2810 0%, #3a1808 50%, #2a1000 100%);',
            '  pointer-events: none;',
            '}',
            '',
            '.sb-corner {',
            '  position: absolute;',
            '  width: 32px; height: 32px;',
            '  background: #3a1808;',
            '  box-shadow: inset 0 0 0 3px #5a3818, inset 0 0 0 6px #4a2808;',
            '  z-index: 2;',
            '}',
            '.sb-corner::before {',
            '  content: "";',
            '  position: absolute;',
            '  top: 6px; left: 6px; right: 6px; bottom: 6px;',
            '  background: #2a1000;',
            '  box-shadow: inset 2px 2px 0 rgba(255,200,150,0.15);',
            '}',
            '.sb-cnw { top: 5px; left: 5px; }',
            '.sb-cne { top: 5px; right: 5px; }',
            '.sb-csw { bottom: 5px; left: 5px; }',
            '.sb-cse { bottom: 5px; right: 5px; }',
            '',
            '.sb-inner {',
            '  position: relative;',
            '  background: #d4c4a0;',
            '  background-image: ',
            '    repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(139, 90, 43, 0.05) 2px, rgba(139, 90, 43, 0.05) 3px),',
            '    repeating-linear-gradient(90deg, transparent 0px, transparent 5px, rgba(139, 90, 43, 0.03) 5px, rgba(139, 90, 43, 0.03) 6px),',
            '    linear-gradient(180deg, #e8d8b8 0%, #d4c4a0 40%, #c8b890 100%);',
            '  height: 100%;',
            '  padding: 12px;',
            '  box-shadow: ',
            '    inset 5px 5px 0 0 rgba(0, 0, 0, 0.1),',
            '    inset -5px -5px 0 0 rgba(255, 255, 255, 0.2);',
            '  display: flex;',
            '  flex-direction: column;',
            '}',
            '',
            '.sb-header {',
            '  display: flex;',
            '  justify-content: space-between;',
            '  align-items: center;',
            '  margin-bottom: 12px;',
            '}',
            '',
            '.sb-title-row {',
            '  display: flex;',
            '  align-items: center;',
            '  gap: 10px;',
            '}',
            '.sb-ornament {',
            '  width: 10px;',
            '  height: 10px;',
            '  background: #5a3020;',
            '  transform: rotate(45deg);',
            '  box-shadow: inset 1px 1px 0 rgba(255,200,150,0.25);',
            '  flex-shrink: 0;',
            '}',
            '',
            '.sb-title {',
            '  font-size: 12px;',
            '  color: #2a1408;',
            '  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.4);',
            '  letter-spacing: 3px;',
            '}',
            '',
            '.sb-close {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 10px;',
            '  padding: 8px 14px;',
            '  background: linear-gradient(180deg, #a04040 0%, #803030 50%, #602020 100%);',
            '  color: #ffd0d0;',
            '  border: none;',
            '  cursor: pointer;',
            '  box-shadow: 0 4px 0 0 #301010;',
            '}',
            '',
            '.sb-close:hover {',
            '  background: linear-gradient(180deg, #b05050 0%, #904040 50%, #703030 100%);',
            '}',
            '',
            '.sb-close:active {',
            '  transform: translateY(2px);',
            '  box-shadow: 0 2px 0 0 #301010;',
            '}',
            '',
            '.sb-columns {',
            '  display: flex;',
            '  gap: 12px;',
            '  flex: 1;',
            '  min-height: 0;',
            '}',
            '',
            '.sb-sidebar {',
            '  width: 200px;',
            '  background: #f0e8d8;',
            '  border: 3px solid #8a7060;',
            '  box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.1);',
            '  display: flex;',
            '  flex-direction: column;',
            '}',
            '',
            '.sb-nav {',
            '  display: flex;',
            '  flex-direction: column;',
            '  gap: 4px;',
            '  padding: 8px;',
            '}',
            '',
            '.sb-nav-item {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 8px;',
            '  padding: 10px 12px;',
            '  background: linear-gradient(180deg, #3a3848 0%, #2a2838 50%, #1a1828 100%);',
            '  color: #c8c8d8;',
            '  border: none;',
            '  cursor: pointer;',
            '  text-align: left;',
            '  box-shadow: 0 3px 0 0 #0a0818;',
            '}',
            '',
            '.sb-nav-item:hover {',
            '  background: linear-gradient(180deg, #4a4858 0%, #3a3848 50%, #2a2838 100%);',
            '}',
            '',
            '.sb-nav-item.sb-active {',
            '  background: linear-gradient(180deg, #5868a8 0%, #4858a8 50%, #3848a8 100%);',
            '  color: #f8f8ff;',
            '  box-shadow: 0 3px 0 0 #282858;',
            '}',
            '',
            '.sb-panel {',
            '  flex: 1;',
            '  background: #f0e8d8;',
            '  border: 3px solid #8a7060;',
            '  box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.1);',
            '  display: flex;',
            '  flex-direction: column;',
            '  overflow: hidden;',
            '}',
            '',
            '.sb-panel-header {',
            '  background: #4a4030;',
            '  padding: 10px 14px;',
            '  border-bottom: 2px solid #2a2010;',
            '}',
            '',
            '.sb-panel-title {',
            '  font-size: 9px;',
            '  color: #e8d8c8;',
            '  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.5);',
            '}',
            '',
            '.sb-panel-body {',
            '  flex: 1;',
            '  padding: 12px;',
            '  overflow-y: auto;',
            '}',
            '',
            '.sb-list {',
            '  display: flex;',
            '  flex-direction: column;',
            '  gap: 6px;',
            '}',
            '',
            '.sb-list-item {',
            '  font-size: 8px;',
            '  padding: 10px 12px;',
            '  background: #e8d8c8;',
            '  border: 2px solid #a89080;',
            '  cursor: pointer;',
            '  display: flex;',
            '  justify-content: space-between;',
            '  align-items: center;',
            '}',
            '',
            '.sb-list-item:hover {',
            '  background: #f0e8d8;',
            '  border-color: #886850;',
            '}',
            '',
            '.sb-list-item.sb-selected {',
            '  background: #d8e8d8;',
            '  border-color: #488848;',
            '}',
            '',
            '.sb-list-item span {',
            '  color: #2a1408;',
            '}',
            '',
            '.sb-list-item small {',
            '  color: #6a5040;',
            '  font-size: 7px;',
            '}',
            '',
            '.sb-btn {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 8px;',
            '  padding: 8px 14px;',
            '  background: linear-gradient(180deg, #3a68a8 0%, #2a58a8 50%, #1a48a8 100%);',
            '  color: #d8e8f8;',
            '  border: none;',
            '  cursor: pointer;',
            '  box-shadow: 0 3px 0 0 #0a1838;',
            '}',
            '',
            '.sb-btn:hover {',
            '  background: linear-gradient(180deg, #4a78b8 0%, #3a68a8 50%, #2a58a8 100%);',
            '}',
            '',
            '.sb-btn.sb-btn-create {',
            '  background: linear-gradient(180deg, #286020 0%, #184010 50%, #102808 100%);',
            '  color: #90c890;',
            '  box-shadow: 0 3px 0 0 #0a1808;',
            '}',
            '',
            '.sb-btn.sb-btn-create:hover {',
            '  background: linear-gradient(180deg, #388030 0%, #286020 50%, #184010 100%);',
            '}',
            '',
            '.sb-form {',
            '  display: flex;',
            '  flex-direction: column;',
            '  gap: 10px;',
            '}',
            '',
            '.sb-form-group {',
            '  display: flex;',
            '  flex-direction: column;',
            '  gap: 4px;',
            '}',
            '',
            '.sb-form-group label {',
            '  font-size: 7px;',
            '  color: #4a3020;',
            '  text-transform: uppercase;',
            '}',
            '',
            '.sb-form-group input,',
            '.sb-form-group textarea,',
            '.sb-form-group select {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 8px;',
            '  padding: 8px 10px;',
            '  background: #f8f0e8;',
            '  border: 2px solid #a89080;',
            '  color: #2a1408;',
            '}',
            '',
            '.sb-form-group textarea {',
            '  min-height: 60px;',
            '  resize: vertical;',
            '}',
            '',
            '.sb-form-row {',
            '  display: flex;',
            '  gap: 10px;',
            '}',
            '',
            '.sb-form-row .sb-form-group {',
            '  flex: 1;',
            '}',
            '',
            '.sb-status {',
            '  font-size: 7px;',
            '  color: #6a5040;',
            '  padding: 8px 10px;',
            '  background: #e8d8c8;',
            '  border-top: 2px solid #a89080;',
            '}',
            '',
            '.sb-empty {',
            '  font-size: 8px;',
            '  color: #6a5040;',
            '  text-align: center;',
            '  padding: 30px;',
            '}',
            '',
            '.sb-spinner {',
            '  display: inline-block;',
            '  width: 12px;',
            '  height: 12px;',
            '  border: 2px solid #a89080;',
            '  border-top-color: #4a3020;',
            '  border-radius: 50%;',
            '  animation: sb-spin 0.8s linear infinite;',
            '}',
            '',
            '@keyframes sb-spin {',
            '  to { transform: rotate(360deg); }',
            '}',
            '',
            '/* ── Tilesets tab ── */',
            '.sb-nav-tilesets { border-top: 2px solid #486848 !important; margin-top: 4px; color: #90c890 !important; }',
            '.sb-nav-tilesets.sb-active { background: linear-gradient(180deg, #286828 0%, #184818 50%, #103010 100%) !important; color: #90e890 !important; box-shadow: 0 3px 0 0 #081808 !important; }',
            '.sb-ts-section-lbl { font-size: 7px; color: #6a5040; letter-spacing: 2px; padding: 0 0 6px; border-bottom: 1px solid #c8b890; margin-bottom: 8px; }',
            '.sb-ts-biome-grid { display: flex; flex-direction: column; gap: 6px; }',
            '.sb-ts-biome-card {',
            '  display: flex; align-items: center; gap: 8px;',
            '  padding: 8px 10px;',
            '  background: #e8d8c8;',
            '  border: 2px solid #a89080; border-bottom-width: 3px;',
            '  cursor: pointer;',
            '}',
            '.sb-ts-biome-card:hover { border-color: #688868; background: #f0e8d8; }',
            '.sb-ts-biome-icon { font-size: 18px; flex-shrink: 0; }',
            '.sb-ts-biome-body { flex: 1; min-width: 0; }',
            '.sb-ts-biome-name { font-size: 8px; color: #2a1408; margin-bottom: 2px; }',
            '.sb-ts-biome-desc { font-size: 7px; color: #6a5040; }',
            '.sb-ts-badge { font-size: 6px; background: #286828; color: #90e890; padding: 1px 5px; margin-left: 5px; vertical-align: middle; }',
            '.sb-ts-new-btn { font-size: 7px !important; padding: 5px 8px !important; flex-shrink: 0; }',
            '.sb-ts-asset-list { display: flex; flex-direction: column; gap: 6px; }',
            '.sb-ts-asset-row {',
            '  display: flex; align-items: center; gap: 8px;',
            '  padding: 6px 8px;',
            '  background: #e8d8c8;',
            '  border: 2px solid #a89080; border-bottom-width: 3px;',
            '}',
            '.sb-ts-preview {',
            '  width: 48px; height: 48px; object-fit: contain;',
            '  image-rendering: pixelated;',
            '  border: 2px solid #8a7060; flex-shrink: 0;',
            '  background: #1a1408;',
            '}',
            '.sb-ts-no-preview {',
            '  display: flex; align-items: center; justify-content: center;',
            '  font-size: 16px; color: #6a5040;',
            '}',
            '.sb-ts-asset-meta { flex: 1; min-width: 0; }',
            '.sb-ts-asset-name { font-size: 8px; color: #2a1408; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }',
            '.sb-ts-asset-sub  { font-size: 6px; color: #6a5040; }',
            '.sb-ts-asset-actions { display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }',
            '.sb-ts-edit-btn { font-size: 7px !important; padding: 4px 8px !important; }',
            '.sb-ts-del-btn  { font-size: 7px !important; padding: 4px 8px !important; background: linear-gradient(180deg, #a04040 0%, #803030 100%) !important; color: #ffd0d0 !important; border-color: #601010 !important; box-shadow: 0 2px 0 0 #300808 !important; }',
            '',
            '/* ── Units Tab Styles ── */',
            '.sb-units-container { padding: 12px; height: 100%; overflow-y: auto; }',
            '.sb-units-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #c8b890; }',
            '.sb-units-header h3 { font-size: 11px; color: #2a1408; margin: 0; }',
            '.sb-units-filter { display: flex; gap: 8px; align-items: center; }',
            '.sb-units-filter select { font-family: "Press Start 2P", monospace; font-size: 7px; padding: 6px; background: #f0e8d8; border: 2px solid #8a7060; color: #2a1408; }',
            '.sb-units-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }',
            '.sb-unit-card { background: linear-gradient(180deg, #f8f0e0 0%, #e8dcc8 100%); border: 2px solid #8a7060; padding: 10px; box-shadow: 0 3px 0 0 #6a5040; cursor: pointer; transition: transform 0.1s; }',
            '.sb-unit-card:hover { transform: translateY(-2px); box-shadow: 0 5px 0 0 #6a5040; }',
            '.sb-unit-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }',
            '.sb-unit-icon { font-size: 16px; }',
            '.sb-unit-name { font-size: 9px; color: #2a1408; flex: 1; font-weight: bold; }',
            '.sb-unit-scope { font-size: 10px; }',
            '.sb-unit-stats { display: flex; gap: 12px; font-size: 7px; color: #4a3828; margin-bottom: 8px; flex-wrap: wrap; }',
            '.sb-unit-actions { display: flex; gap: 6px; justify-content: flex-end; }',
            '.sb-unit-editor { padding: 16px; height: 100%; overflow-y: auto; }',
            '.sb-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #c8b890; }',
            '.sb-editor-header h3 { font-size: 11px; color: #2a1408; margin: 0; }',
            '.sb-editor-form { max-width: 700px; }',
            '.sb-form-section { margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.3); border: 1px solid #c8b890; }',
            '.sb-form-section h4 { font-size: 8px; color: #5a4030; margin: 0 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid #c8b890; }',
            '.sb-form-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }',
            '.sb-form-row label { font-size: 7px; color: #3a2820; width: 140px; flex-shrink: 0; }',
            '.sb-form-row input, .sb-form-row select, .sb-form-row textarea { font-family: "Press Start 2P", monospace; font-size: 7px; padding: 6px; background: #f8f0e0; border: 2px solid #8a7060; color: #2a1408; flex: 1; }',
            '.sb-form-row textarea { min-height: 60px; resize: vertical; }',
            '.sb-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }',
            '.sb-checkbox-row label { display: flex; align-items: center; gap: 6px; cursor: pointer; }',
            '.sb-checkbox-row input[type="checkbox"] { width: auto; }',
            '.sb-editor-actions { display: flex; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 2px solid #c8b890; }'
        ].join('\n');
    },
    
    _getHTML: function() {
        return [
            '<div class="sb-frame">',
            '  <div class="sb-corner sb-cnw"></div>',
            '  <div class="sb-corner sb-cne"></div>',
            '  <div class="sb-corner sb-csw"></div>',
            '  <div class="sb-corner sb-cse"></div>',
            '  <div class="sb-inner">',
            '    <div class="sb-header">',
            '      <div class="sb-title-row"><div class="sb-ornament"></div><h1 class="sb-title">STORY BUILDER</h1><div class="sb-ornament"></div></div>',
            '      <button class="sb-close" id="sb-close">ESC</button>',
            '    </div>',
            '',
            '    <div class="sb-columns">',
            '      <div class="sb-sidebar">',
            '        <div class="sb-nav">',
            '          <button class="sb-nav-item sb-active" id="sb-tab-story" data-tab="story">Story</button>',
            '          <button class="sb-nav-item" id="sb-tab-factions" data-tab="factions">Factions</button>',
            '          <button class="sb-nav-item" id="sb-tab-characters" data-tab="characters">Characters</button>',
            '          <button class="sb-nav-item" id="sb-tab-units" data-tab="units">Units</button>',
            '          <button class="sb-nav-item" id="sb-tab-dialogues" data-tab="dialogues">Dialogues</button>',
            '          <button class="sb-nav-item" id="sb-tab-quests" data-tab="quests">Quests</button>',
            '          <button class="sb-nav-item" id="sb-tab-scenes" data-tab="scenes">Scenes</button>',
            '          <button class="sb-nav-item sb-nav-tilesets" id="sb-tab-tilesets" data-tab="tilesets">🗺 Tilesets</button>',
            '        </div>',
            '      </div>',
            '',
            '      <div class="sb-panel">',
            '        <div class="sb-panel-header">',
            '          <div class="sb-panel-title" id="sb-panel-title">Story Info</div>',
            '        </div>',
            '        <div class="sb-panel-body" id="sb-content">',
            '          <div class="sb-empty">Select or create a story to begin</div>',
            '        </div>',
            '        <div class="sb-status" id="sb-status">Ready</div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
    },
    
    _bindEvents: function() {
        var self = this;
        
        if (this._e['sb-close']) {
            this._e['sb-close'].addEventListener('click', function() {
                self.hide();
            });
        }
        
        var tabBtns = document.querySelectorAll('.sb-nav-item');
        for (var i = 0; i < tabBtns.length; i++) {
            tabBtns[i].addEventListener('click', function() {
                var tab = this.getAttribute('data-tab');
                self._switchTab(tab);
            });
        }
    },
    
    _bindKeys: function() {
        var self = this;
        window.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && self.visible) {
                self.hide();
            }
        });
    },
    
    _hideAllTabs: function() {
        var tabBtns = document.querySelectorAll('.sb-nav-item');
        for (var i = 0; i < tabBtns.length; i++) {
            tabBtns[i].classList.remove('sb-active');
        }
    },
    
    _switchTab: function(tab) {
        this.activeTab = tab;
        this._hideAllTabs();
        
        var tabBtn = document.getElementById('sb-tab-' + tab);
        if (tabBtn) tabBtn.classList.add('sb-active');
        
        var titles = {
            story: 'Story Info',
            factions: 'Factions',
            characters: 'Characters',
            units: 'Units',
            dialogues: 'Dialogues',
            quests: 'Quests',
            scenes: 'Scenes'
        };
        
        if (this._e['sb-panel-title']) {
            this._e['sb-panel-title'].textContent = titles[tab] || tab;
        }
        
        this._renderTab(tab);
        this._sendLog('tab_switch', { tab: tab });
    },
    
    _renderTab: function(tab) {
        if (!this._e['sb-content']) return;
        
        switch (tab) {
            case 'story':
                this._renderStoryTab();
                break;
            case 'factions':
                this._renderFactionsTab();
                break;
            case 'characters':
                this._renderCharactersTab();
                break;
            case 'units':
                this._renderUnitsTab();
                break;
            case 'dialogues':
                this._renderDialoguesTab();
                break;
            case 'quests':
                this._renderQuestsTab();
                break;
            case 'scenes':
                this._renderScenesTab();
                break;
            case 'tilesets':
                this._renderTilesetsTab();
                break;
        }
    },
    
    _setStatus: function(msg) {
        if (this._e['sb-status']) {
            this._e['sb-status'].textContent = msg;
        }
    },
    
    _sendLog: function(action, data) {
        if (this.engine && this.engine.sendLog) {
            this.engine.sendLog({
                type: 'storybuilder',
                action: action,
                data: data || {}
            });
        }
        console.log('[StoryBuilder]', action, data || {});
    },
    
    toggle: function() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    },
    
    show: function() {
        this.visible = true;
        this.el.style.display = 'block';
        this._switchTab(this.activeTab || 'story');
        this._loadStories();
        this._sendLog('show', { status: 'opened' });
    },
    
    hide: function() {
        this.visible = false;
        this.el.style.display = 'none';
        this._sendLog('hide', { status: 'closed' });
    },
    
    _loadStories: function() {
        var self = this;
        this._setStatus('Loading stories...');
        console.log('[StoryBuilder] _loadStories called');
        
        if (!this.db) {
            console.error('[StoryBuilder] DB not initialized in _loadStories');
            this._setStatus('Error: DB not initialized');
            this._renderStoryTab(true);
            return;
        }
        
        this.db.listStories(true).then(function(stories) {
            console.log('[StoryBuilder] listStories SUCCESS:', stories);
            self.stories = stories;
            self._renderStoryTab();
            self._setStatus('Loaded ' + stories.length + ' stories');
            self._sendLog('stories_loaded', { count: stories.length });
        }).catch(function(e) {
            console.error('[StoryBuilder] listStories FAILED:', e);
            self._setStatus('API unavailable, offline mode');
            self._sendLog('stories_error', { error: e.message, offline: true });
            self._renderStoryTab(true);
        });
    },
    
    _renderStoryTab: function(offline) {
        var self = this;
        var content = this._e['sb-content'];
        if (!content) return;
        
        if (offline) {
            content.innerHTML = [
                '<div class="sb-form">',
                '  <div class="sb-form-group">',
                '    <label>Story Title</label>',
                '    <input type="text" id="sb-new-title" placeholder="Enter story title">',
                '  </div>',
                '  <div class="sb-form-group">',
                '    <label>Description</label>',
                '    <textarea id="sb-new-desc" placeholder="Story description"></textarea>',
                '  </div>',
                '  <div class="sb-form-row">',
                '    <div class="sb-form-group">',
                '      <label>Genre</label>',
                '      <select id="sb-new-genre">',
                '        <option value="fantasy">Fantasy</option>',
                '        <option value="scifi">Sci-Fi</option>',
                '        <option value="horror">Horror</option>',
                '        <option value="mystery">Mystery</option>',
                '        <option value="adventure">Adventure</option>',
                '      </select>',
                '    </div>',
                '  </div>',
                '  <button class="sb-btn sb-btn-create" id="sb-create-offline">Create Offline Story</button>',
                '</div>'
            ].join('');
            
            var createBtn = document.getElementById('sb-create-offline');
            if (createBtn) {
                createBtn.addEventListener('click', function() {
                    var title = document.getElementById('sb-new-title');
                    var desc = document.getElementById('sb-new-desc');
                    var genre = document.getElementById('sb-new-genre');
                    if (title && desc && genre) {
                        self._createOfflineStory(title.value, desc.value, genre.value);
                    }
                });
            }
            return;
        }
        
        var html = '<div class="sb-list">';
        
        if (this.stories && this.stories.length > 0) {
            for (var i = 0; i < this.stories.length; i++) {
                var s = this.stories[i];
                var selected = s.id === this.currentStoryId ? ' sb-selected' : '';
                html += [
                    '<div class="sb-list-item' + selected + '" data-story-id="' + s.id + '">',
                    '  <span>' + this._escapeHtml(s.title) + '</span>',
                    '  <small>' + (s.genre_name || 'Unknown') + '</small>',
                    '</div>'
                ].join('');
            }
        }
        
        html += '</div>';
        html += '<button class="sb-btn sb-btn-create" id="sb-new-story" style="margin-top:10px;">+ New Story</button>';
        html += '<button class="sb-btn" id="sb-refresh-stories" style="margin-left:6px;">Refresh</button>';
        
        if (this.currentStoryId) {
            html += '<button class="sb-btn" id="sb-edit-story" style="margin-left:6px;">Edit</button>';
        }

        if (this.storyData && this.storyData.id === this.currentStoryId) {
            html += this._renderStorySettingsCard();
        }
        
        content.innerHTML = html;
        
        this._bindStoryEvents();
    },
    
    _bindStoryEvents: function() {
        var self = this;
        
        var items = document.querySelectorAll('.sb-list-item[data-story-id]');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function() {
                var id = this.getAttribute('data-story-id');
                self._selectStory(id);
            });
        }
        
        var newBtn = document.getElementById('sb-new-story');
        if (newBtn) {
            newBtn.addEventListener('click', function() {
                self._showCreateStoryForm();
            });
        }
        
        var refreshBtn = document.getElementById('sb-refresh-stories');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                self._loadStories();
            });
        }
        
        var editBtn = document.getElementById('sb-edit-story');
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                if (self.currentStoryId) {
                    self._showEditStoryForm();
                }
            });
        }

        this._bindStorySettingsEvents();
    },
    
    _selectStory: function(id) {
        this.currentStoryId = id;
        this._sendLog('story_select', { storyId: id });
        
        var self = this;
        this.db.loadStory(id).then(function(story) {
            self.storyData = story;
            self._setStatus('Loaded: ' + story.title);
            self._renderStoryTab();
            self._sendLog('story_loaded', { 
                storyId: id, 
                title: story.title,
                factions: story.factions ? story.factions.length : 0,
                characters: story.characters ? story.characters.length : 0
            });
        }).catch(function(e) {
            self._setStatus('Error loading story');
            self._sendLog('story_load_error', { storyId: id, error: e.message });
        });
    },
    
    _showCreateStoryForm: function() {
        var self = this;
        var content = this._e['sb-content'];
        if (!content) return;
        
        console.log('[StoryBuilder] Showing create story form');
        this._sendLog('show_create_form', { status: 'opened' });
        
        content.innerHTML = [
            '<div class="sb-form">',
            '  <div class="sb-form-group">',
            '    <label>Story Title</label>',
            '    <input type="text" id="sb-new-title" placeholder="Enter story title">',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Description</label>',
            '    <textarea id="sb-new-desc" placeholder="Story description"></textarea>',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <div class="sb-form-group">',
            '      <label>Genre</label>',
            '      <select id="sb-new-genre">',
            '        <option value="fantasy">Fantasy</option>',
            '        <option value="scifi">Sci-Fi</option>',
            '        <option value="horror">Horror</option>',
            '        <option value="mystery">Mystery</option>',
            '        <option value="adventure">Adventure</option>',
            '      </select>',
            '    </div>',
            '    <div class="sb-form-group">',
            '      <label>Author</label>',
            '      <input type="text" id="sb-new-author" placeholder="Author name">',
            '    </div>',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <button class="sb-btn" id="sb-cancel-create">Cancel</button>',
            '    <button class="sb-btn sb-btn-create" id="sb-submit-create">Create Story</button>',
            '  </div>',
            '</div>'
        ].join('');
        
        var cancelBtn = document.getElementById('sb-cancel-create');
        var submitBtn = document.getElementById('sb-submit-create');
        
        console.log('[StoryBuilder] Buttons found:', {
            cancel: !!cancelBtn,
            submit: !!submitBtn
        });
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                console.log('[StoryBuilder] Cancel button clicked');
                self._renderStoryTab();
            });
        }
        
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                console.log('[StoryBuilder] Submit button clicked');
                self._createStory();
            });
        }
    },
    
    _createStory: function() {
        var self = this;
        
        console.log('[StoryBuilder] _createStory called');
        
        var titleEl = document.getElementById('sb-new-title');
        var descEl = document.getElementById('sb-new-desc');
        var genreEl = document.getElementById('sb-new-genre');
        var authorEl = document.getElementById('sb-new-author');
        
        console.log('[StoryBuilder] Form elements:', {
            title: titleEl ? titleEl.value : 'MISSING',
            desc: descEl ? descEl.value : 'MISSING',
            genre: genreEl ? genreEl.value : 'MISSING',
            author: authorEl ? authorEl.value : 'MISSING'
        });
        
        if (!titleEl || !titleEl.value.trim()) {
            this._setStatus('Title is required');
            this._sendLog('story_create_error', { error: 'Title is required' });
            console.error('[StoryBuilder] Title is required or element missing');
            return;
        }
        
        var data = {
            title: titleEl.value.trim(),
            description: descEl ? descEl.value.trim() : '',
            genre: genreEl ? genreEl.value : 'fantasy',
            author: authorEl ? authorEl.value.trim() : 'Anonymous',
            is_published: false
        };
        
        this._setStatus('Creating story...');
        this._sendLog('story_create_start', data);
        console.log('[StoryBuilder] Attempting API createStory with data:', data);
        
        if (!this.db) {
            console.error('[StoryBuilder] DB not initialized!');
            this._setStatus('Error: DB not initialized');
            this._sendLog('story_create_error', { error: 'DB not initialized' });
            return;
        }
        
        this.db.createStory(data).then(function(result) {
            console.log('[StoryBuilder] createStory SUCCESS:', result);
            self._setStatus('Story created: ' + result.id);
            self._sendLog('story_created', { storyId: result.id, title: data.title });
            self.currentStoryId = result.id;
            self.storyData = result;
            self._loadStories();
        }).catch(function(e) {
            console.error('[StoryBuilder] createStory FAILED:', e);
            self._setStatus('API Error, creating offline...');
            self._sendLog('story_create_fallback', { error: e.message, usingOffline: true });
            self._createOfflineStory(data.title, data.description, data.genre);
        });
    },
    
    _createOfflineStory: function(title, desc, genre) {
        console.log('[StoryBuilder] _createOfflineStory called:', { title: title, desc: desc, genre: genre });
        
        this.storyData = {
            id: 'offline_' + Date.now(),
            title: title || 'Untitled Story',
            description: desc || '',
            genre: genre || 'fantasy',
            factions: [],
            characters: [],
            dialogues: [],
            quests: [],
            scenes: [],
            engine_configs: {},
            ui_config: {
                ui_mode: 'hybrid',
                theme_key: 'realmkit-parchment',
                resource_labels_json: '{"hp":"HP","mp":"MP","xp":"XP","level":"Level","gold":"Gold"}',
                panel_config_json: '{"inventory":true,"character":true,"quests":true,"dialogue":true,"pause":true,"minimap":true}',
                layout_config_json: '{"draggable":true,"snapToEdges":true,"rememberPositions":true}'
            }
        };
        this.currentStoryId = this.storyData.id;
        
        if (!this.stories) this.stories = [];
        this.stories.push({
            id: this.storyData.id,
            title: this.storyData.title,
            genre_name: this.storyData.genre
        });
        
        this._setStatus('Created offline story: ' + this.storyData.title);
        this._sendLog('offline_story_created', { id: this.storyData.id, title: this.storyData.title });
        console.log('[StoryBuilder] Offline story created:', this.storyData);
        this._renderStoryTab();
    },

    _renderStorySettingsCard: function() {
        var ui = (this.storyData && this.storyData.ui_config) || {};
        var uiMode = ui.ui_mode || 'hybrid';
        var themeKey = ui.theme_key || 'realmkit-parchment';
        var labels = ui.resource_labels_json || '{"hp":"HP","mp":"MP","xp":"XP","level":"Level","gold":"Gold"}';

        return [
            '<div style="margin-top:14px;padding:12px;background:#e8d8c8;border:2px solid #a89080;">',
            '  <div class="sb-ts-section-lbl">STORY UI CONFIG</div>',
            '  <div class="sb-form">',
            '    <div class="sb-form-row">',
            '      <div class="sb-form-group">',
            '        <label>Presentation Mode</label>',
            '        <select id="sb-ui-mode">',
            '          <option value="dnd"' + (uiMode === 'dnd' ? ' selected' : '') + '>D&D</option>',
            '          <option value="hybrid"' + (uiMode === 'hybrid' ? ' selected' : '') + '>Hybrid</option>',
            '          <option value="narrative"' + (uiMode === 'narrative' ? ' selected' : '') + '>Narrative</option>',
            '        </select>',
            '      </div>',
            '      <div class="sb-form-group">',
            '        <label>Theme Key</label>',
            '        <input type="text" id="sb-ui-theme" value="' + this._escapeHtml(themeKey) + '" placeholder="realmkit-parchment">',
            '      </div>',
            '    </div>',
            '    <div class="sb-form-group">',
            '      <label>Resource Labels JSON</label>',
            '      <textarea id="sb-ui-labels" style="min-height:72px;">' + this._escapeHtml(labels) + '</textarea>',
            '    </div>',
            '    <div class="sb-form-row">',
            '      <button class="sb-btn" id="sb-save-ui-config">Save UI Config</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    },

    _bindStorySettingsEvents: function() {
        var self = this;
        var saveBtn = document.getElementById('sb-save-ui-config');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._saveStoryUIConfig();
            });
        }
    },

    _saveStoryUIConfig: function() {
        if (!this.currentStoryId || !this.storyData) {
            this._setStatus('Select a story first');
            return;
        }

        var modeEl = document.getElementById('sb-ui-mode');
        var themeEl = document.getElementById('sb-ui-theme');
        var labelsEl = document.getElementById('sb-ui-labels');
        if (!modeEl || !themeEl || !labelsEl) {
            this._setStatus('UI config controls unavailable');
            return;
        }

        var labelsRaw = labelsEl.value.trim();
        try {
            JSON.parse(labelsRaw);
        } catch (e) {
            this._setStatus('Labels JSON is invalid');
            return;
        }

        var payload = {
            ui_mode: modeEl.value,
            theme_key: themeEl.value.trim() || 'realmkit-parchment',
            resource_labels_json: labelsRaw
        };

        if (this.currentStoryId.indexOf('offline_') === 0) {
            if (!this.storyData.ui_config) {
                this.storyData.ui_config = {};
            }
            this.storyData.ui_config.ui_mode = payload.ui_mode;
            this.storyData.ui_config.theme_key = payload.theme_key;
            this.storyData.ui_config.resource_labels_json = payload.resource_labels_json;
            this._setStatus('Saved to offline story draft');
            this._sendLog('story_ui_config_saved_offline', { storyId: this.currentStoryId, uiMode: payload.ui_mode });
            this._renderStoryTab();
            return;
        }

        var self = this;
        this._setStatus('Saving UI config...');
        this.db.updateUiConfig(this.currentStoryId, payload).then(function(result) {
            self.storyData.ui_config = result;
            self._setStatus('UI config saved');
            self._sendLog('story_ui_config_saved', { storyId: self.currentStoryId, uiMode: result.ui_mode });
            self._renderStoryTab();
        }).catch(function(e) {
            self._setStatus('UI config save failed');
            self._sendLog('story_ui_config_error', { storyId: self.currentStoryId, error: e.message });
        });
    },
    
    _renderFactionsTab: function() {
        var content = this._e['sb-content'];
        if (!content) return;
        
        if (!this.currentStoryId) {
            content.innerHTML = '<div class="sb-empty">Select a story first</div>';
            return;
        }
        
        var factions = (this.storyData && this.storyData.factions) ? this.storyData.factions : [];
        
        var html = '<div class="sb-list">';
        for (var i = 0; i < factions.length; i++) {
            var f = factions[i];
            var colour = this._getFactionColour(f.name);
            html += [
                '<div class="sb-list-item" data-faction-id="' + f.id + '">',
                '  <span style="color:' + colour + ';">' + this._escapeHtml(f.name) + '</span>',
                '  <small>' + (f.description || 'No description') + '</small>',
                '</div>'
            ].join('');
        }
        html += '</div>';
        html += '<button class="sb-btn sb-btn-create" id="sb-add-faction" style="margin-top:10px;">+ Add Faction</button>';
        
        content.innerHTML = html;
        this._bindFactionEvents();
    },
    
    _getFactionColour: function(name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        var h = hash % 360;
        return 'hsl(' + h + ', 60%, 40%)';
    },
    
    _bindFactionEvents: function() {
        var self = this;
        var addBtn = document.getElementById('sb-add-faction');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                self._showAddFactionForm();
            });
        }
    },
    
    _showAddFactionForm: function() {
        var self = this;
        var content = this._e['sb-content'];
        if (!content) return;
        
        content.innerHTML = [
            '<div class="sb-form">',
            '  <div class="sb-form-group">',
            '    <label>Faction Name</label>',
            '    <input type="text" id="sb-faction-name" placeholder="e.g., The Iron Legion">',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Description</label>',
            '    <textarea id="sb-faction-desc" placeholder="Faction background"></textarea>',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Color (hex)</label>',
            '    <input type="text" id="sb-faction-color" placeholder="#a83030" value="#a83030">',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <button class="sb-btn" id="sb-faction-cancel">Cancel</button>',
            '    <button class="sb-btn sb-btn-create" id="sb-faction-save">Save Faction</button>',
            '  </div>',
            '</div>'
        ].join('');
        
        var cancelBtn = document.getElementById('sb-faction-cancel');
        var saveBtn = document.getElementById('sb-faction-save');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self._renderFactionsTab();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._saveFaction();
            });
        }
    },
    
    _saveFaction: function() {
        var self = this;
        var nameEl = document.getElementById('sb-faction-name');
        var descEl = document.getElementById('sb-faction-desc');
        var colorEl = document.getElementById('sb-faction-color');
        
        if (!nameEl || !nameEl.value.trim()) {
            this._setStatus('Faction name is required');
            return;
        }
        
        var data = {
            name: nameEl.value.trim(),
            description: descEl ? descEl.value.trim() : '',
            color: colorEl ? colorEl.value : '#a83030'
        };
        
        this._setStatus('Saving faction...');
        this._sendLog('faction_save_start', data);
        
        if (this.currentStoryId && this.currentStoryId.indexOf('offline_') === 0) {
            if (!this.storyData) this.storyData = { factions: [] };
            if (!this.storyData.factions) this.storyData.factions = [];
            
            this.storyData.factions.push({
                id: 'faction_' + Date.now(),
                name: data.name,
                description: data.description,
                color: data.color
            });
            
            this._setStatus('Faction added: ' + data.name);
            this._sendLog('faction_added', { name: data.name });
            this._renderFactionsTab();
        } else {
            // Would call API for real stories
            this._setStatus('Faction saved (would sync to API)');
            this._sendLog('faction_saved', data);
            this._renderFactionsTab();
        }
    },
    
    _renderCharactersTab: function() {
        var content = this._e['sb-content'];
        if (!content) return;
        
        if (!this.currentStoryId) {
            content.innerHTML = '<div class="sb-empty">Select a story first</div>';
            return;
        }
        
        var characters = (this.storyData && this.storyData.characters) ? this.storyData.characters : [];
        
        var html = '<div class="sb-list">';
        for (var i = 0; i < characters.length; i++) {
            var c = characters[i];
            html += [
                '<div class="sb-list-item" data-char-id="' + (c.id || i) + '">',
                '  <span>' + this._escapeHtml(c.name || 'Unnamed') + '</span>',
                '  <small>Lvl ' + (c.level || 1) + ' ' + (c.role || 'NPC') + '</small>',
                '</div>'
            ].join('');
        }
        html += '</div>';
        html += '<button class="sb-btn sb-btn-create" id="sb-add-char" style="margin-top:10px;">+ Add Character</button>';
        
        content.innerHTML = html;
        this._bindCharacterEvents();
    },
    
    _bindCharacterEvents: function() {
        var self = this;
        var addBtn = document.getElementById('sb-add-char');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                self._showAddCharacterForm();
            });
        }
    },
    
    _showAddCharacterForm: function() {
        var self = this;
        var factions = (this.storyData && this.storyData.factions) ? this.storyData.factions : [];
        var content = this._e['sb-content'];
        if (!content) return;
        
        var factionOptions = '<option value="">None</option>';
        for (var i = 0; i < factions.length; i++) {
            factionOptions += '<option value="' + factions[i].id + '">' + this._escapeHtml(factions[i].name) + '</option>';
        }
        
        content.innerHTML = [
            '<div class="sb-form">',
            '  <div class="sb-form-group">',
            '    <label>Character Name</label>',
            '    <input type="text" id="sb-char-name" placeholder="Character name">',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <div class="sb-form-group">',
            '      <label>Role</label>',
            '      <select id="sb-char-role">',
            '        <option value="npc">NPC</option>',
            '        <option value="enemy">Enemy</option>',
            '        <option value="merchant">Merchant</option>',
            '        <option value="questgiver">Quest Giver</option>',
            '      </select>',
            '    </div>',
            '    <div class="sb-form-group">',
            '      <label>Level</label>',
            '      <input type="number" id="sb-char-level" value="1" min="1" max="100">',
            '    </div>',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Faction</label>',
            '    <select id="sb-char-faction">' + factionOptions + '</select>',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Dialogue ID (optional)</label>',
            '    <input type="text" id="sb-char-dialogue" placeholder="Link to dialogue">',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <button class="sb-btn" id="sb-char-cancel">Cancel</button>',
            '    <button class="sb-btn sb-btn-create" id="sb-char-save">Save Character</button>',
            '  </div>',
            '</div>'
        ].join('');
        
        var cancelBtn = document.getElementById('sb-char-cancel');
        var saveBtn = document.getElementById('sb-char-save');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self._renderCharactersTab();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._saveCharacter();
            });
        }
    },
    
    _saveCharacter: function() {
        var nameEl = document.getElementById('sb-char-name');
        var roleEl = document.getElementById('sb-char-role');
        var levelEl = document.getElementById('sb-char-level');
        var factionEl = document.getElementById('sb-char-faction');
        var dialogueEl = document.getElementById('sb-char-dialogue');
        
        if (!nameEl || !nameEl.value.trim()) {
            this._setStatus('Character name is required');
            return;
        }
        
        var data = {
            id: 'char_' + Date.now(),
            name: nameEl.value.trim(),
            role: roleEl ? roleEl.value : 'npc',
            level: levelEl ? parseInt(levelEl.value, 10) || 1 : 1,
            faction_id: factionEl ? factionEl.value : null,
            dialogue_id: dialogueEl ? dialogueEl.value.trim() : null
        };
        
        if (!this.storyData) this.storyData = { characters: [] };
        if (!this.storyData.characters) this.storyData.characters = [];
        this.storyData.characters.push(data);
        
        this._setStatus('Character added: ' + data.name);
        this._sendLog('character_added', data);
        this._renderCharactersTab();
    },
    
    _renderDialoguesTab: function() {
        var content = this._e['sb-content'];
        if (!content) return;
        
        if (!this.currentStoryId) {
            content.innerHTML = '<div class="sb-empty">Select a story first</div>';
            return;
        }
        
        var dialogues = (this.storyData && this.storyData.dialogues) ? this.storyData.dialogues : [];
        
        var html = '<div class="sb-list">';
        for (var i = 0; i < dialogues.length; i++) {
            var d = dialogues[i];
            html += [
                '<div class="sb-list-item" data-dialogue-id="' + (d.id || i) + '">',
                '  <span>' + this._escapeHtml(d.title || d.name || 'Unnamed') + '</span>',
                '  <small>' + (d.nodes ? d.nodes.length : 0) + ' nodes</small>',
                '</div>'
            ].join('');
        }
        html += '</div>';
        html += '<button class="sb-btn sb-btn-create" id="sb-add-dialogue" style="margin-top:10px;">+ Add Dialogue</button>';
        
        content.innerHTML = html;
        this._bindDialogueEvents();
    },
    
    _bindDialogueEvents: function() {
        var self = this;
        var addBtn = document.getElementById('sb-add-dialogue');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                self._showAddDialogueForm();
            });
        }
    },
    
    _showAddDialogueForm: function() {
        var self = this;
        var content = this._e['sb-content'];
        if (!content) return;
        
        content.innerHTML = [
            '<div class="sb-form">',
            '  <div class="sb-form-group">',
            '    <label>Dialogue Title</label>',
            '    <input type="text" id="sb-dialogue-title" placeholder="e.g., Village Greeting">',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>First Node Text</label>',
            '    <textarea id="sb-dialogue-text" placeholder="What the NPC says first"></textarea>',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <button class="sb-btn" id="sb-dialogue-cancel">Cancel</button>',
            '    <button class="sb-btn sb-btn-create" id="sb-dialogue-save">Create Dialogue</button>',
            '  </div>',
            '</div>'
        ].join('');
        
        var cancelBtn = document.getElementById('sb-dialogue-cancel');
        var saveBtn = document.getElementById('sb-dialogue-save');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self._renderDialoguesTab();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._saveDialogue();
            });
        }
    },
    
    _saveDialogue: function() {
        var titleEl = document.getElementById('sb-dialogue-title');
        var textEl = document.getElementById('sb-dialogue-text');
        
        if (!titleEl || !titleEl.value.trim()) {
            this._setStatus('Dialogue title is required');
            return;
        }
        
        var data = {
            id: 'dialogue_' + Date.now(),
            title: titleEl.value.trim(),
            nodes: [{
                id: 'node_' + Date.now(),
                text: textEl ? textEl.value : '',
                choices: []
            }]
        };
        
        if (!this.storyData) this.storyData = { dialogues: [] };
        if (!this.storyData.dialogues) this.storyData.dialogues = [];
        this.storyData.dialogues.push(data);
        
        this._setStatus('Dialogue added: ' + data.title);
        this._sendLog('dialogue_added', { id: data.id, title: data.title });
        this._renderDialoguesTab();
    },
    
    _renderQuestsTab: function() {
        var content = this._e['sb-content'];
        if (!content) return;
        
        if (!this.currentStoryId) {
            content.innerHTML = '<div class="sb-empty">Select a story first</div>';
            return;
        }
        
        var quests = (this.storyData && this.storyData.quests) ? this.storyData.quests : [];
        
        var html = '<div class="sb-list">';
        for (var i = 0; i < quests.length; i++) {
            var q = quests[i];
            html += [
                '<div class="sb-list-item" data-quest-id="' + (q.id || i) + '">',
                '  <span>' + this._escapeHtml(q.title || q.name || 'Unnamed') + '</span>',
                '  <small>' + (q.objectives ? q.objectives.length : 0) + ' objectives</small>',
                '</div>'
            ].join('');
        }
        html += '</div>';
        html += '<button class="sb-btn sb-btn-create" id="sb-add-quest" style="margin-top:10px;">+ Add Quest</button>';
        
        content.innerHTML = html;
        this._bindQuestEvents();
    },
    
    _bindQuestEvents: function() {
        var self = this;
        var addBtn = document.getElementById('sb-add-quest');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                self._showAddQuestForm();
            });
        }
    },
    
    _showAddQuestForm: function() {
        var self = this;
        var content = this._e['sb-content'];
        if (!content) return;
        
        content.innerHTML = [
            '<div class="sb-form">',
            '  <div class="sb-form-group">',
            '    <label>Quest Title</label>',
            '    <input type="text" id="sb-quest-title" placeholder="e.g., Defeat the Dragon">',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Description</label>',
            '    <textarea id="sb-quest-desc" placeholder="Quest description"></textarea>',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <div class="sb-form-group">',
            '      <label>XP Reward</label>',
            '      <input type="number" id="sb-quest-xp" value="100" min="0">',
            '    </div>',
            '    <div class="sb-form-group">',
            '      <label>Gold Reward</label>',
            '      <input type="number" id="sb-quest-gold" value="50" min="0">',
            '    </div>',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <button class="sb-btn" id="sb-quest-cancel">Cancel</button>',
            '    <button class="sb-btn sb-btn-create" id="sb-quest-save">Create Quest</button>',
            '  </div>',
            '</div>'
        ].join('');
        
        var cancelBtn = document.getElementById('sb-quest-cancel');
        var saveBtn = document.getElementById('sb-quest-save');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self._renderQuestsTab();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._saveQuest();
            });
        }
    },
    
    _saveQuest: function() {
        var titleEl = document.getElementById('sb-quest-title');
        var descEl = document.getElementById('sb-quest-desc');
        var xpEl = document.getElementById('sb-quest-xp');
        var goldEl = document.getElementById('sb-quest-gold');
        
        if (!titleEl || !titleEl.value.trim()) {
            this._setStatus('Quest title is required');
            return;
        }
        
        var data = {
            id: 'quest_' + Date.now(),
            title: titleEl.value.trim(),
            description: descEl ? descEl.value.trim() : '',
            xp_reward: xpEl ? parseInt(xpEl.value, 10) || 100 : 100,
            gold_reward: goldEl ? parseInt(goldEl.value, 10) || 50 : 50,
            objectives: []
        };
        
        if (!this.storyData) this.storyData = { quests: [] };
        if (!this.storyData.quests) this.storyData.quests = [];
        this.storyData.quests.push(data);
        
        this._setStatus('Quest added: ' + data.title);
        this._sendLog('quest_added', { id: data.id, title: data.title });
        this._renderQuestsTab();
    },
    
    _renderScenesTab: function() {
        var content = this._e['sb-content'];
        if (!content) return;
        
        if (!this.currentStoryId) {
            content.innerHTML = '<div class="sb-empty">Select a story first</div>';
            return;
        }
        
        var scenes = (this.storyData && this.storyData.scenes) ? this.storyData.scenes : [];
        
        var html = '<div class="sb-list">';
        for (var i = 0; i < scenes.length; i++) {
            var s = scenes[i];
            html += [
                '<div class="sb-list-item" data-scene-id="' + (s.id || i) + '">',
                '  <span>' + this._escapeHtml(s.name || 'Unnamed Scene') + '</span>',
                '  <small>' + (s.width || '?') + 'x' + (s.height || '?') + '</small>',
                '</div>'
            ].join('');
        }
        html += '</div>';
        html += '<button class="sb-btn sb-btn-create" id="sb-add-scene" style="margin-top:10px;">+ Add Scene</button>';
        
        content.innerHTML = html;
        this._bindSceneEvents();
    },
    
    _bindSceneEvents: function() {
        var self = this;
        var addBtn = document.getElementById('sb-add-scene');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                self._showAddSceneForm();
            });
        }
    },
    
    _showAddSceneForm: function() {
        var self = this;
        var content = this._e['sb-content'];
        if (!content) return;
        
        content.innerHTML = [
            '<div class="sb-form">',
            '  <div class="sb-form-group">',
            '    <label>Scene Name</label>',
            '    <input type="text" id="sb-scene-name" placeholder="e.g., Forest Entrance">',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <div class="sb-form-group">',
            '      <label>Width (tiles)</label>',
            '      <input type="number" id="sb-scene-width" value="128" min="32" max="512">',
            '    </div>',
            '    <div class="sb-form-group">',
            '      <label>Height (tiles)</label>',
            '      <input type="number" id="sb-scene-height" value="128" min="32" max="512">',
            '    </div>',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Bias (terrain type)</label>',
            '    <select id="sb-scene-bias">',
            '      <option value="forest">Forest</option>',
            '      <option value="desert">Desert</option>',
            '      <option value="tundra">Tundra</option>',
            '      <option value="swamp">Swamp</option>',
            '      <option value="meadow">Meadow</option>',
            '    </select>',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <button class="sb-btn" id="sb-scene-cancel">Cancel</button>',
            '    <button class="sb-btn sb-btn-create" id="sb-scene-save">Create Scene</button>',
            '  </div>',
            '</div>'
        ].join('');
        
        var cancelBtn = document.getElementById('sb-scene-cancel');
        var saveBtn = document.getElementById('sb-scene-save');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self._renderScenesTab();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._saveScene();
            });
        }
    },
    
    _saveScene: function() {
        var nameEl = document.getElementById('sb-scene-name');
        var widthEl = document.getElementById('sb-scene-width');
        var heightEl = document.getElementById('sb-scene-height');
        var biasEl = document.getElementById('sb-scene-bias');
        
        if (!nameEl || !nameEl.value.trim()) {
            this._setStatus('Scene name is required');
            return;
        }
        
        var data = {
            id: 'scene_' + Date.now(),
            name: nameEl.value.trim(),
            width: widthEl ? parseInt(widthEl.value, 10) || 128 : 128,
            height: heightEl ? parseInt(heightEl.value, 10) || 128 : 128,
            biome_bias: biasEl ? biasEl.value : 'forest',
            spawns: []
        };
        
        if (!this.storyData) this.storyData = { scenes: [] };
        if (!this.storyData.scenes) this.storyData.scenes = [];
        this.storyData.scenes.push(data);
        
        this._setStatus('Scene added: ' + data.name);
        this._sendLog('scene_added', { id: data.id, name: data.name });
        this._renderScenesTab();
    },
    
    _showEditStoryForm: function() {
        var self = this;
        var content = this._e['sb-content'];
        if (!content || !this.storyData) return;
        
        var s = this.storyData;
        content.innerHTML = [
            '<div class="sb-form">',
            '  <div class="sb-form-group">',
            '    <label>Story Title</label>',
            '    <input type="text" id="sb-edit-title" value="' + this._escapeHtml(s.title || '') + '">',
            '  </div>',
            '  <div class="sb-form-group">',
            '    <label>Description</label>',
            '    <textarea id="sb-edit-desc">' + this._escapeHtml(s.description || '') + '</textarea>',
            '  </div>',
            '  <div class="sb-form-row">',
            '    <button class="sb-btn" id="sb-edit-cancel">Back</button>',
            '    <button class="sb-btn sb-btn-create" id="sb-edit-save">Save Changes</button>',
            '  </div>',
            '</div>'
        ].join('');
        
        var cancelBtn = document.getElementById('sb-edit-cancel');
        var saveBtn = document.getElementById('sb-edit-save');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self._renderStoryTab();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._saveStoryEdit();
            });
        }
    },
    
    _saveStoryEdit: function() {
        var titleEl = document.getElementById('sb-edit-title');
        var descEl = document.getElementById('sb-edit-desc');
        
        if (titleEl) this.storyData.title = titleEl.value;
        if (descEl) this.storyData.description = descEl.value;
        
        this._setStatus('Story updated: ' + this.storyData.title);
        this._sendLog('story_updated', { id: this.currentStoryId, title: this.storyData.title });
        this._renderStoryTab();
    },
    
    _escapeHtml: function(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ── Tilesets tab ──────────────────────────────────────────────────────────
    // Shows biome cards (one per biome template) and a list of locally-saved
    // tilesets the artist has painted in the Sprite Builder.  Clicking "Edit"
    // on a saved asset opens sprite-builder.html?loadAsset=<id> so the artist
    // can pick up where they left off.

    _BIOMES: [
        { id: 'tpl_ts_grassland', label: 'Grassland', icon: '🌿', desc: 'Grass, dirt, stone, water & flora' },
        { id: 'tpl_ts_tundra',    label: 'Tundra',    icon: '❄️',  desc: 'Snow, ice, frozen rock & streams' },
        { id: 'tpl_ts_desert',    label: 'Desert',    icon: '🏜️',  desc: 'Sand dunes, cracked earth & oasis' },
        { id: 'tpl_ts_forest',    label: 'Forest',    icon: '🌲',  desc: 'Dense canopy, roots & mushrooms' },
        { id: 'tpl_ts_swamp',     label: 'Swamp',     icon: '🐸',  desc: 'Mud, reeds, dark water & vines' },
        { id: 'tpl_ts_volcanic',  label: 'Volcanic',  icon: '🌋',  desc: 'Lava, obsidian, ash & cinders' },
        { id: 'tpl_ts_custom',    label: 'Custom',    icon: '🎨',  desc: 'Blank slate — generic Primary/Secondary/Tertiary rows + 10 animation slots for any theme' },
    ],

    _renderTilesetsTab: function() {
        var self = this;
        var content = this._e['sb-content'];
        if (!content) return;

        var saved = [];
        try { saved = JSON.parse(localStorage.getItem('rk_tileset_assets') || '[]'); }
        catch (e) { /* ignore */ }

        // ── Biome cards ───────────────────────────────────────────────────────
        var biomesHtml = '<div class="sb-ts-section-lbl">BIOME TEMPLATES</div>';
        biomesHtml += '<div class="sb-ts-biome-grid">';
        this._BIOMES.forEach(function(b) {
            var count = saved.filter(function(a) { return a.template_id === b.id; }).length;
            var badge = count > 0 ? '<span class="sb-ts-badge">' + count + ' saved</span>' : '';
            biomesHtml += [
                '<div class="sb-ts-biome-card" data-biome="' + b.id + '">',
                '  <span class="sb-ts-biome-icon">' + b.icon + '</span>',
                '  <div class="sb-ts-biome-body">',
                '    <div class="sb-ts-biome-name">' + b.label + badge + '</div>',
                '    <div class="sb-ts-biome-desc">' + b.desc + '</div>',
                '  </div>',
                '  <button class="sb-btn sb-btn-create sb-ts-new-btn" data-biome="' + b.id + '">+ New</button>',
                '</div>',
            ].join('');
        });
        biomesHtml += '</div>';

        // ── Saved tilesets ────────────────────────────────────────────────────
        var assetsHtml = '<div class="sb-ts-section-lbl" style="margin-top:14px;">SAVED TILESETS</div>';
        if (saved.length === 0) {
            assetsHtml += '<div class="sb-empty" style="font-size:7px;padding:12px;">No tilesets saved yet.<br><br>Paint a tileset in the Sprite Builder,<br>then press 💾 Save to Assets.</div>';
        } else {
            assetsHtml += '<div class="sb-ts-asset-list">';
            saved.forEach(function(asset) {
                var biomeMeta = self._BIOMES.find(function(b) { return b.id === asset.template_id; });
                var icon = biomeMeta ? biomeMeta.icon : '🗂';
                var date = asset.saved_at ? asset.saved_at.slice(0, 10) : '—';
                var preview = asset.sheet_png
                    ? '<img class="sb-ts-preview" src="' + asset.sheet_png + '" title="Sheet preview">'
                    : '<div class="sb-ts-preview sb-ts-no-preview">?</div>';
                assetsHtml += [
                    '<div class="sb-ts-asset-row" data-asset-id="' + asset.id + '">',
                    '  ' + preview,
                    '  <div class="sb-ts-asset-meta">',
                    '    <div class="sb-ts-asset-name">' + icon + ' ' + self._escapeHtml(asset.name) + '</div>',
                    '    <div class="sb-ts-asset-sub">' + (asset.template_name || asset.template_id) + ' · ' + asset.frameW + 'x' + asset.frameH + 'px · ' + date + '</div>',
                    '  </div>',
                    '  <div class="sb-ts-asset-actions">',
                    '    <button class="sb-btn sb-ts-edit-btn" data-asset-id="' + asset.id + '">✏ Edit</button>',
                    '    <button class="sb-btn sb-ts-del-btn" data-asset-id="' + asset.id + '" style="margin-top:4px;">✕</button>',
                    '  </div>',
                    '</div>',
                ].join('');
            });
            assetsHtml += '</div>';
        }

        content.innerHTML = biomesHtml + assetsHtml;
        this._bindTilesetsEvents();
    },

    _bindTilesetsEvents: function() {
        var self = this;

        // New tileset buttons — open sprite-builder with the biome template pre-selected
        var newBtns = document.querySelectorAll('.sb-ts-new-btn');
        for (var i = 0; i < newBtns.length; i++) {
            newBtns[i].addEventListener('click', function(e) {
                e.stopPropagation();
                var biomeId = this.getAttribute('data-biome');
                window.open('sprite-builder.html?template=' + encodeURIComponent(biomeId), '_blank');
            });
        }

        // Edit buttons — open sprite-builder with the saved asset restored
        var editBtns = document.querySelectorAll('.sb-ts-edit-btn');
        for (var j = 0; j < editBtns.length; j++) {
            editBtns[j].addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.getAttribute('data-asset-id');
                window.open('sprite-builder.html?loadAsset=' + encodeURIComponent(id), '_blank');
            });
        }

        // Delete buttons — remove from localStorage and re-render
        var delBtns = document.querySelectorAll('.sb-ts-del-btn');
        for (var k = 0; k < delBtns.length; k++) {
            delBtns[k].addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.getAttribute('data-asset-id');
                if (!confirm('Delete this saved tileset? This cannot be undone.')) return;
                try {
                    var all = JSON.parse(localStorage.getItem('rk_tileset_assets') || '[]');
                    all = all.filter(function(a) { return a.id !== id; });
                    localStorage.setItem('rk_tileset_assets', JSON.stringify(all));
                } catch (ex) { /* ignore */ }
                self._renderTilesetsTab();
            });
        }

        // Biome card body click — filter saved list to that biome
        var biomeCards = document.querySelectorAll('.sb-ts-biome-card');
        for (var m = 0; m < biomeCards.length; m++) {
            biomeCards[m].addEventListener('click', function() {
                var biomeId = this.getAttribute('data-biome');
                var rows = document.querySelectorAll('.sb-ts-asset-row');
                for (var n = 0; n < rows.length; n++) {
                    var id = rows[n].getAttribute('data-asset-id');
                    try {
                        var all = JSON.parse(localStorage.getItem('rk_tileset_assets') || '[]');
                        var asset = all.find(function(a) { return a.id === id; });
                        rows[n].style.display = (!asset || asset.template_id === biomeId) ? '' : 'none';
                    } catch (ex) { rows[n].style.display = ''; }
                }
            });
        }
    },

    // ═══════════════════════════════════════════════════════════
    //  UNITS TAB - Race-based unit templates
    // ═══════════════════════════════════════════════════════════
    _renderUnitsTab: function() {
        var self = this;
        var container = this._e['sb-content'];
        if (!container) return;

        container.innerHTML = [
            '<div class="sb-units-container">',
            '  <div class="sb-units-header">',
            '    <h3>Unit Templates</h3>',
            '    <div class="sb-units-filter">',
            '      <select id="sb-units-category">',
            '        <option value="">All Categories</option>',
            '        <option value="enemy">Enemy</option>',
            '        <option value="npc">NPC</option>',
            '        <option value="animal">Animal</option>',
            '        <option value="boss">Boss</option>',
            '      </select>',
            '      <select id="sb-units-scope">',
            '        <option value="all">All Units</option>',
            '        <option value="story">This Story</option>',
            '        <option value="global">Global Units</option>',
            '      </select>',
            '      <button class="sb-btn sb-btn-primary" id="sb-units-new">+ New Template</button>',
            '    </div>',
            '  </div>',
            '  <div class="sb-units-list" id="sb-units-list">',
            '    <div class="sb-loading">Loading unit templates...</div>',
            '  </div>',
            '</div>'
        ].join('\n');

        this._loadUnitTemplates();

        // Bind filter events
        var categorySelect = document.getElementById('sb-units-category');
        var scopeSelect = document.getElementById('sb-units-scope');

        if (categorySelect) {
            categorySelect.addEventListener('change', function() {
                self._loadUnitTemplates();
            });
        }

        if (scopeSelect) {
            scopeSelect.addEventListener('change', function() {
                self._loadUnitTemplates();
            });
        }

        // New template button
        var newBtn = document.getElementById('sb-units-new');
        if (newBtn) {
            newBtn.addEventListener('click', function() {
                self._showUnitEditor(null);
            });
        }
    },

    _loadUnitTemplates: function() {
        var self = this;
        var list = document.getElementById('sb-units-list');
        if (!list) return;

        var category = document.getElementById('sb-units-category')?.value || '';
        var scope = document.getElementById('sb-units-scope')?.value || 'all';

        var url = 'api/unit-templates?';
        if (category) url += 'category=' + encodeURIComponent(category) + '&';
        if (scope === 'story' && this.currentStoryId) {
            url += 'story_id=' + encodeURIComponent(this.currentStoryId) + '&';
        }
        if (scope === 'global') {
            url += 'global=true&';
        } else if (scope === 'all') {
            url += 'global=true&';
        }

        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                self._renderUnitList(data || []);
            })
            .catch(function(e) {
                list.innerHTML = '<div class="sb-error">Error loading units: ' + e.message + '</div>';
            });
    },

    _renderUnitList: function(units) {
        var self = this;
        var list = document.getElementById('sb-units-list');
        if (!list) return;

        if (units.length === 0) {
            list.innerHTML = [
                '<div class="sb-empty">',
                '  <p>No unit templates found.</p>',
                '  <p>Create your first race template to get started.</p>',
                '</div>'
            ].join('');
            return;
        }

        var html = ['<div class="sb-units-grid">'];

        for (var i = 0; i < units.length; i++) {
            var u = units[i];
            var scopeLabel = u.is_global ? '🌍' : (u.story_id ? '📖' : '📖');
            var categoryIcon = {
                'enemy': '⚔️',
                'npc': '👤',
                'animal': '🐺',
                'boss': '👑'
            }[u.category] || '👤';

            html.push([
                '<div class="sb-unit-card" data-id="' + u.id + '">',
                '  <div class="sb-unit-header">',
                '    <span class="sb-unit-icon">' + categoryIcon + '</span>',
                '    <span class="sb-unit-name">' + (u.display_name || u.name) + '</span>',
                '    <span class="sb-unit-scope" title="' + (u.is_global ? 'Global' : 'Story-specific') + '">' + scopeLabel + '</span>',
                '  </div>',
                '  <div class="sb-unit-stats">',
                '    <span>HP: ' + u.base_hp + '</span>',
                '    <span>ATK: ' + u.base_attack + '</span>',
                '    <span>DEF: ' + u.base_defense + '</span>',
                '    <span>SPD: ' + u.base_speed + '</span>',
                '  </div>',
                '  <div class="sb-unit-actions">',
                '    <button class="sb-btn sb-btn-small" data-action="edit" data-id="' + u.id + '">Edit</button>',
                '    <button class="sb-btn sb-btn-small" data-action="spawn" data-id="' + u.id + '">Spawn</button>',
                '    <button class="sb-btn sb-btn-small sb-btn-danger" data-action="delete" data-id="' + u.id + '">Delete</button>',
                '  </div>',
                '</div>'
            ].join(''));
        }

        html.push('</div>');
        list.innerHTML = html.join('');

        // Bind card actions
        var cards = list.querySelectorAll('.sb-unit-card');
        for (var j = 0; j < cards.length; j++) {
            cards[j].addEventListener('click', function(e) {
                var btn = e.target.closest('[data-action]');
                if (!btn) return;

                var action = btn.getAttribute('data-action');
                var id = btn.getAttribute('data-id');

                if (action === 'edit') self._showUnitEditor(id);
                else if (action === 'spawn') self._spawnUnit(id);
                else if (action === 'delete') self._deleteUnit(id);
            });
        }
    },

    _showUnitEditor: function(templateId) {
        var self = this;
        var container = this._e['sb-content'];
        if (!container) return;

        var isNew = !templateId;
        var title = isNew ? 'New Unit Template' : 'Edit Unit Template';

        container.innerHTML = [
            '<div class="sb-unit-editor">',
            '  <div class="sb-editor-header">',
            '    <h3>' + title + '</h3>',
            '    <button class="sb-btn" id="sb-unit-cancel">Cancel</button>',
            '  </div>',
            '  <form id="sb-unit-form" class="sb-editor-form">',
            '    <div class="sb-form-section">',
            '      <h4>Basic Info</h4>',
            '      <div class="sb-form-row">',
            '        <label>Name (race):</label>',
            '        <input type="text" id="sb-unit-name" placeholder="e.g. Goblin" required>',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Display Name:</label>',
            '        <input type="text" id="sb-unit-display" placeholder="e.g. Goblin Warrior">',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Category:</label>',
            '        <select id="sb-unit-category">',
            '          <option value="enemy">Enemy</option>',
            '          <option value="npc">NPC</option>',
            '          <option value="animal">Animal</option>',
            '          <option value="boss">Boss</option>',
            '        </select>',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Description:</label>',
            '        <textarea id="sb-unit-desc" rows="3"></textarea>',
            '      </div>',
            '    </div>',
            '    <div class="sb-form-section">',
            '      <h4>Base Stats</h4>',
            '      <div class="sb-stats-grid">',
            '        <div class="sb-form-row"><label>HP:</label><input type="number" id="sb-unit-hp" value="40" min="1"></div>',
            '        <div class="sb-form-row"><label>MP:</label><input type="number" id="sb-unit-mp" value="0" min="0"></div>',
            '        <div class="sb-form-row"><label>Attack:</label><input type="number" id="sb-unit-atk" value="10" min="0"></div>',
            '        <div class="sb-form-row"><label>Defense:</label><input type="number" id="sb-unit-def" value="5" min="0"></div>',
            '        <div class="sb-form-row"><label>Speed:</label><input type="number" id="sb-unit-spd" value="80" min="1"></div>',
            '        <div class="sb-form-row"><label>Agility:</label><input type="number" id="sb-unit-agi" value="10" min="0"></div>',
            '      </div>',
            '    </div>',
            '    <div class="sb-form-section">',
            '      <h4>Combat</h4>',
            '      <div class="sb-form-row">',
            '        <label>Aggro Range:</label>',
            '        <input type="number" id="sb-unit-aggro" value="150" min="0">',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Attack Range:</label>',
            '        <input type="number" id="sb-unit-atkrng" value="40" min="0">',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Attack Cooldown (ms):</label>',
            '        <input type="number" id="sb-unit-cd" value="600" min="0">',
            '      </div>',
            '    </div>',
            '    <div class="sb-form-section">',
            '      <h4>Visual & AI</h4>',
            '      <div class="sb-form-row">',
            '        <label>Spritesheet Base:</label>',
            '        <select id="sb-unit-sprite"><option value="">Loading...</option></select>',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Sprite Template (Base):</label>',
            '        <select id="sb-unit-template"><option value="">Loading...</option></select>',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Spritesheet Ext:</label>',
            '        <select id="sb-unit-sprite-ext"><option value="">Loading...</option></select>',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Sprite Template (Ext):</label>',
            '        <select id="sb-unit-template-ext"><option value="">Loading...</option></select>',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Default Animation:</label>',
            '        <input type="text" id="sb-unit-anim" value="idle_down">',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Behavior:</label>',
            '        <select id="sb-unit-behavior">',
            '          <option value="idle">Idle</option>',
            '          <option value="wander">Wander</option>',
            '          <option value="hostile">Hostile</option>',
            '          <option value="friendly">Friendly</option>',
            '          <option value="patrol">Patrol</option>',
            '        </select>',
            '      </div>',
            '    </div>',
            '    <div class="sb-form-section">',
            '      <h4>Options</h4>',
            '      <div class="sb-form-row sb-checkbox-row">',
            '        <label><input type="checkbox" id="sb-unit-unique"> Is Unique (only one can spawn)</label>',
            '      </div>',
            '      <div class="sb-form-row sb-checkbox-row">',
            '        <label><input type="checkbox" id="sb-unit-global"> Global (available in all stories)</label>',
            '      </div>',
            '      <div class="sb-form-row">',
            '        <label>Max Spawn Count (0 = unlimited):</label>',
            '        <input type="number" id="sb-unit-maxcount" value="0" min="0">',
            '      </div>',
            '    </div>',
            '    <div class="sb-editor-actions">',
            '      <button type="submit" class="sb-btn sb-btn-primary">Save Template</button>',
            '      <button type="button" class="sb-btn" id="sb-unit-preview">Preview</button>',
            '    </div>',
            '  </form>',
            '</div>'
        ].join('\n');

        // Load spritesheet options
        this._loadSpriteAssets();

        // Load existing data if editing
        if (!isNew) {
            fetch('api/unit-templates/' + encodeURIComponent(templateId))
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    self._populateUnitForm(data);
                })
                .catch(function(e) {
                    console.error('Failed to load unit template:', e);
                });
        }

        // Form submission
        var form = document.getElementById('sb-unit-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                self._saveUnitTemplate(templateId);
            });
        }

        // Cancel button
        var cancelBtn = document.getElementById('sb-unit-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self._renderUnitsTab();
            });
        }
    },

    _populateUnitForm: function(data) {
        document.getElementById('sb-unit-name').value = data.name || '';
        document.getElementById('sb-unit-display').value = data.display_name || '';
        document.getElementById('sb-unit-category').value = data.category || 'enemy';
        document.getElementById('sb-unit-desc').value = data.description || '';
        document.getElementById('sb-unit-hp').value = data.base_hp || 40;
        document.getElementById('sb-unit-mp').value = data.base_mp || 0;
        document.getElementById('sb-unit-atk').value = data.base_attack || 10;
        document.getElementById('sb-unit-def').value = data.base_defense || 5;
        document.getElementById('sb-unit-spd').value = data.base_speed || 80;
        document.getElementById('sb-unit-agi').value = data.base_agility || 10;
        document.getElementById('sb-unit-aggro').value = data.aggro_range || 150;
        document.getElementById('sb-unit-atkrng').value = data.attack_range || 40;
        document.getElementById('sb-unit-cd').value = data.attack_cooldown_ms || 600;
        document.getElementById('sb-unit-sprite').value = data.sprite_asset_id || '';
        document.getElementById('sb-unit-template').value = data.sprite_template_id || '';
        document.getElementById('sb-unit-sprite-ext').value = data.sprite_ext_asset_id || '';
        document.getElementById('sb-unit-template-ext').value = data.sprite_ext_template_id || '';
        document.getElementById('sb-unit-anim').value = data.default_animation || 'idle_down';
        document.getElementById('sb-unit-behavior').value = data.default_behavior || 'idle';
        document.getElementById('sb-unit-unique').checked = data.is_unique;
        document.getElementById('sb-unit-global').checked = data.is_global;
        document.getElementById('sb-unit-maxcount').value = data.max_spawn_count || 0;
    },

    _loadSpriteAssets: function() {
        var self = this;
        
        // Load Assets
        fetch('api/assets?type=sprite')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var selects = [
                    document.getElementById('sb-unit-sprite'),
                    document.getElementById('sb-unit-sprite-ext')
                ];
                
                selects.forEach(function(select) {
                    if (!select) return;
                    var options = ['<option value="">(none)</option>'];
                    for (var i = 0; i < data.length; i++) {
                        var a = data[i];
                        options.push('<option value="' + a.id + '">' + (a.asset_key || a.id) + '</option>');
                    }
                    select.innerHTML = options.join('');
                });
            })
            .catch(function(e) {
                console.error('Failed to load sprite assets:', e);
            });
            
        // Load Sprite Templates
        fetch('api/sprite-templates')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var selects = [
                    document.getElementById('sb-unit-template'),
                    document.getElementById('sb-unit-template-ext')
                ];
                
                selects.forEach(function(select) {
                    if (!select) return;
                    var options = ['<option value="">(none)</option>'];
                    for (var i = 0; i < data.length; i++) {
                        var t = data[i];
                        options.push('<option value="' + t.id + '">' + (t.name || t.id) + '</option>');
                    }
                    select.innerHTML = options.join('');
                });
            })
            .catch(function(e) {
                console.error('Failed to load sprite templates:', e);
            });
    },

    _saveUnitTemplate: function(templateId) {
        var self = this;

        var data = {
            name: document.getElementById('sb-unit-name').value,
            display_name: document.getElementById('sb-unit-display').value,
            category: document.getElementById('sb-unit-category').value,
            description: document.getElementById('sb-unit-desc').value,
            base_hp: parseInt(document.getElementById('sb-unit-hp').value) || 40,
            base_mp: parseInt(document.getElementById('sb-unit-mp').value) || 0,
            base_attack: parseInt(document.getElementById('sb-unit-atk').value) || 10,
            base_defense: parseInt(document.getElementById('sb-unit-def').value) || 5,
            base_speed: parseInt(document.getElementById('sb-unit-spd').value) || 80,
            base_agility: parseInt(document.getElementById('sb-unit-agi').value) || 10,
            aggro_range: parseInt(document.getElementById('sb-unit-aggro').value) || 150,
            attack_range: parseInt(document.getElementById('sb-unit-atkrng').value) || 40,
            attack_cooldown_ms: parseInt(document.getElementById('sb-unit-cd').value) || 600,
            sprite_asset_id: document.getElementById('sb-unit-sprite').value || null,
            sprite_template_id: document.getElementById('sb-unit-template').value || null,
            sprite_ext_asset_id: document.getElementById('sb-unit-sprite-ext').value || null,
            sprite_ext_template_id: document.getElementById('sb-unit-template-ext').value || null,
            default_animation: document.getElementById('sb-unit-anim').value || 'idle_down',
            default_behavior: document.getElementById('sb-unit-behavior').value || 'idle',
            is_unique: document.getElementById('sb-unit-unique').checked ? 1 : 0,
            is_global: document.getElementById('sb-unit-global').checked ? 1 : 0,
            max_spawn_count: parseInt(document.getElementById('sb-unit-maxcount').value) || 0
        };

        if (!templateId) {
            // Create new
            if (this.currentStoryId && !data.is_global) {
                data.story_id = this.currentStoryId;
            }
        }

        var url = templateId ? 'api/unit-templates/' + encodeURIComponent(templateId) : 'api/unit-templates';
        var method = templateId ? 'PATCH' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(function(r) {
            if (!r.ok) throw new Error('Save failed: ' + r.status);
            return r.json();
        })
        .then(function(result) {
            self._setStatus('Unit template saved: ' + result.name);
            self._renderUnitsTab();
        })
        .catch(function(e) {
            self._setStatus('Error: ' + e.message);
        });
    },

    _spawnUnit: function(templateId) {
        var self = this;

        if (!this.currentStoryId) {
            alert('Please select a story first to spawn a unit.');
            return;
        }

        fetch('api/unit-templates/' + encodeURIComponent(templateId) + '/spawn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                story_id: this.currentStoryId
            })
        })
        .then(function(r) {
            if (!r.ok) throw new Error('Spawn failed: ' + r.status);
            return r.json();
        })
        .then(function(character) {
            self._setStatus('Spawned character: ' + (character.display_name || character.name));
            alert('Unit spawned successfully!\n\nName: ' + (character.display_name || character.name) + '\nID: ' + character.id);
        })
        .catch(function(e) {
            self._setStatus('Spawn error: ' + e.message);
        });
    },

    _deleteUnit: function(templateId) {
        var self = this;

        if (!confirm('Delete this unit template? This cannot be undone.')) return;

        fetch('api/unit-templates/' + encodeURIComponent(templateId), {
            method: 'DELETE'
        })
        .then(function(r) {
            if (!r.ok) throw new Error('Delete failed: ' + r.status);
            self._loadUnitTemplates();
            self._setStatus('Unit template deleted');
        })
        .catch(function(e) {
            self._setStatus('Delete error: ' + e.message);
        });
    }
};

console.log('[StoryBuilder] Class loaded — press F4 to toggle');
