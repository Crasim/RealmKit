var RealmKit = RealmKit || {};

/**
 * StoryBuilderSidebar — standalone Story Builder side panel
 * Slides in from the right edge independently from Dev Tools
 * Toggle with F4
 */

RealmKit._StoryBuilderSidebarImpl = function StoryBuilderSidebarImpl(engine) {
    this.engine = engine;
    this.visible = false;
    this.activeTab = 'story';   // 'story' | 'factions' | 'characters' | 'units' | 'dialogues' | 'quests' | 'scenes' | 'tilesets'
    this._e = {};
    this.sidebarWidth = parseInt(localStorage.getItem('realmkit.storybuilder.sidebarWidth') || '420', 10);
    this.db = typeof RealmKit.StoryDatabase === 'function'
        ? new RealmKit.StoryDatabase() : null;
    
    this._build();
    this._bindKeys();
};

RealmKit._StoryBuilderSidebarImpl.prototype = {
    
    _build: function() {
        var self = this;
        
        var style = document.createElement('style');
        style.textContent = this._css();
        document.head.appendChild(style);
        
        var el = document.createElement('div');
        el.id = 'sb-root';
        el.innerHTML = this._html();
        document.body.appendChild(el);
        this.el = el;
        
        // Cache refs
        var ids = [
            'sb-toggle', 'sb-main-panel',
            'sb-tab-story', 'sb-tab-factions', 'sb-tab-characters',
            'sb-tab-units', 'sb-tab-dialogues', 'sb-tab-quests',
            'sb-tab-scenes', 'sb-tab-tilesets',
            'sb-pane-story', 'sb-pane-content',
            'sb-story-list', 'sb-story-current', 'sb-story-status'
        ];
        for (var i = 0; i < ids.length; i++) {
            this._e[ids[i]] = document.getElementById(ids[i]);
        }
        
        this._bindControls();
        this._applyWidth();
        console.log('[StoryBuilderSidebar] Built');
    },
    
    _css: function() {
        return [
            '#sb-root{position:fixed;left:0;top:0;height:100%;z-index:9999;font-family:"Press Start 2P",monospace;image-rendering:pixelated;pointer-events:none;}',
            '#sb-root *{pointer-events:auto;}',
            '#sb-main-panel{position:absolute;left:0;top:0;height:100%;width:420px;max-width:calc(100vw - 60px);background:#1a1a2e;transform:translateX(-100%);transition:transform 0.28s cubic-bezier(0.22,0.61,0.36,1);box-shadow:6px 0 22px rgba(0,0,0,0.42);border-right:3px solid #3a2008;}',
            '#sb-main-panel.is-open{transform:translateX(0);}',
            
            '#sb-toggle{position:absolute;left:100%;top:calc(50% + 80px);transform:translateY(-50%);writing-mode:vertical-rl;text-orientation:mixed;cursor:pointer;padding:12px 6px;background:linear-gradient(180deg,#4a2810 0%,#2a1408 100%);border:2px solid #1a0800;border-left:none;color:#e8dcc8;font-size:8px;letter-spacing:1px;box-shadow:4px 0 8px rgba(0,0,0,0.3);white-space:nowrap;transition:background 0.2s;border-radius:0 6px 6px 0;}',
            '#sb-toggle:hover{background:linear-gradient(180deg,#5a3820 0%,#3a2410 100%);}',
            '#sb-toggle-arrow{display:inline-block;transition:transform 0.2s;margin-bottom:4px;}',
            '#sb-main-panel.is-open #sb-toggle-arrow{transform:rotate(180deg);}',
            
            '#sb-header{position:relative;padding:10px 14px;background:linear-gradient(180deg,#3d3326 0%,#2a2218 50%,#17110c 100%);border-bottom:2px solid #1a1828;display:flex;align-items:center;gap:8px;}',
            '#sb-header .sb-diamond{color:#8a7060;font-size:10px;}',
            '#sb-title{color:#f6e2ae;font-size:10px;letter-spacing:2px;}',
            '#sb-subtitle{color:#8a7060;font-size:7px;margin-left:auto;}',
            
            '#sb-tabs{display:flex;background:#2a2218;border-bottom:2px solid #1a1828;overflow-x:auto;}',
            '#sb-tabs::-webkit-scrollbar{height:0;}',
            '.sb-tab{flex:1;min-width:70px;padding:10px 6px;background:linear-gradient(180deg,#3a3848 0%,#2a2838 50%,#1a1828 100%);color:#a8a8c8;font-size:7px;text-align:center;cursor:pointer;transition:all 0.15s;border-right:1px solid #1a1828;white-space:nowrap;}',
            '.sb-tab:last-child{border-right:none;}',
            '.sb-tab:hover{background:linear-gradient(180deg,#4a4858 0%,#3a3848 50%,#2a2838 100%);color:#c8c8e8;}',
            '.sb-tab.sb-active{background:linear-gradient(180deg,#a87630 0%,#885820 100%);color:#ffe7af;box-shadow:inset 0 2px 0 rgba(255,255,255,0.1);}',
            
            '#sb-panes{flex:1;overflow-y:auto;padding:12px;background:#f0e8d8;}',
            '.sb-pane{display:none;}',
            '.sb-pane.sb-active{display:block;}',
            
            '.sb-sec-hdr{color:#87663b;font-size:7px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px 0;padding-bottom:4px;border-bottom:1px solid #c8b890;}',
            '.sb-sec-body{background:#f8f0e8;border:1px solid #c8b890;padding:10px;margin-bottom:12px;}',
            '.sb-row{display:flex;justify-content:space-between;align-items:center;line-height:1.7;color:#3a2818;font-size:7px;margin-bottom:4px;}',
            '.sb-lbl{color:#6a5040;}',
            '.sb-val{color:#2a1408;font-weight:bold;}',
            
            '.sb-btn{font-family:"Press Start 2P",monospace;font-size:6px;padding:8px 12px;background:linear-gradient(180deg,#4a4a58 0%,#2e2e3b 100%);color:#efe6d4;border:none;cursor:pointer;box-shadow:0 3px 0 #161620;margin:4px 0;width:100%;text-align:left;}',
            '.sb-btn:hover{background:linear-gradient(180deg,#5a5a68 0%,#3e3e4b 100%);}',
            '.sb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #161620;}',
            '.sb-btn-green{background:linear-gradient(180deg,#389030 0%,#287020 100%);color:#d0f0c0;box-shadow:0 3px 0 #164010;}',
            '.sb-btn-gold{background:linear-gradient(180deg,#a87030 0%,#885020 100%);color:#ffe7b2;box-shadow:0 3px 0 #4b260b;}',
            
            '.sb-list{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;}',
            '.sb-list-item{padding:8px;background:#e8dcc8;border:1px solid #c8b890;cursor:pointer;font-size:6px;color:#3a2818;}',
            '.sb-list-item:hover{background:#dccba9;}',
            '.sb-list-item.sb-selected{background:#c8b890;box-shadow:inset 0 0 0 1px #a89080;}',
            
            '@media (max-width:640px){#sb-main-panel{width:calc(100vw - 40px);}}'
        ].join('');
    },
    
    _html: function() {
        return [
            '<div id="sb-main-panel">',
            '  <div id="sb-toggle" title="Toggle Story Builder (F4)">',
            '    <span id="sb-toggle-arrow">◀</span>',
            '    <span>Story Builder (F4)</span>',
            '  </div>',
            
            '  <div id="sb-header">',
            '    <span class="sb-diamond">◈</span>',
            '    <span id="sb-title">Story Builder</span>',
            '    <span class="sb-diamond">◈</span>',
            '    <span id="sb-subtitle">CREATE</span>',
            '  </div>',
            
            '  <div id="sb-tabs">',
            '    <div class="sb-tab sb-active" id="sb-tab-story" onclick="RealmKit._storyBuilder._switchTab(\'story\')">📖 Story</div>',
            '    <div class="sb-tab" id="sb-tab-factions" onclick="RealmKit._storyBuilder._switchTab(\'factions\')">⚔️ Factions</div>',
            '    <div class="sb-tab" id="sb-tab-characters" onclick="RealmKit._storyBuilder._switchTab(\'characters\')">👤 Chars</div>',
            '    <div class="sb-tab" id="sb-tab-units" onclick="RealmKit._storyBuilder._switchTab(\'units\')">🎭 Units</div>',
            '    <div class="sb-tab" id="sb-tab-dialogues" onclick="RealmKit._storyBuilder._switchTab(\'dialogues\')">💬 Dialog</div>',
            '    <div class="sb-tab" id="sb-tab-quests" onclick="RealmKit._storyBuilder._switchTab(\'quests\')">📜 Quests</div>',
            '    <div class="sb-tab" id="sb-tab-scenes" onclick="RealmKit._storyBuilder._switchTab(\'scenes\')">🗺️ Scenes</div>',
            '    <div class="sb-tab" id="sb-tab-tilesets" onclick="RealmKit._storyBuilder._switchTab(\'tilesets\')">🎨 Tiles</div>',
            '  </div>',
            
            '  <div id="sb-panes">',
            '    <div class="sb-pane sb-active" id="sb-pane-story">',
            '      <div class="sb-sec-hdr">Current Story</div>',
            '      <div class="sb-sec-body">',
            '        <div class="sb-row"><span class="sb-lbl">Story</span><span class="sb-val" id="sb-story-current">--</span></div>',
            '        <div class="sb-row"><span class="sb-lbl">Status</span><span class="sb-val" id="sb-story-status">Ready</span></div>',
            '      </div>',
            '      <div class="sb-sec-hdr">Stories</div>',
            '      <div class="sb-sec-body">',
            '        <button class="sb-btn" id="sb-story-refresh">⟳ Refresh Stories</button>',
            '        <div id="sb-story-list" class="sb-list"></div>',
            '      </div>',
            '    </div>',
            '    <div class="sb-pane" id="sb-pane-content">',
            '      <div class="sb-sec-hdr">Select a tab to begin</div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    },
    
    _bindControls: function() {
        var self = this;
        var e = this._e;
        
        // Toggle button
        if (e['sb-toggle']) {
            e['sb-toggle'].addEventListener('click', function() {
                self.toggle();
            });
        }
        
        // Refresh stories
        if (e['sb-story-refresh']) {
            e['sb-story-refresh'].addEventListener('click', function() {
                self._loadStories();
            });
        }
        
        // Initial load
        this._loadStories();
    },
    
    _bindKeys: function() {
        var self = this;
        window.addEventListener('keydown', function(ev) {
            if (ev.key === 'F4') {
                ev.preventDefault();
                self.toggle();
            }
        });
    },
    
    _switchTab: function(tab) {
        this.activeTab = tab;
        
        // Update tab styles
        var tabs = document.querySelectorAll('.sb-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove('sb-active');
        }
        var activeTab = document.getElementById('sb-tab-' + tab);
        if (activeTab) activeTab.classList.add('sb-active');
        
        // Show/hide panes
        var panes = document.querySelectorAll('.sb-pane');
        for (var j = 0; j < panes.length; j++) {
            panes[j].classList.remove('sb-active');
        }
        
        if (tab === 'story') {
            var storyPane = document.getElementById('sb-pane-story');
            if (storyPane) storyPane.classList.add('sb-active');
        } else {
            var contentPane = document.getElementById('sb-pane-content');
            if (contentPane) {
                contentPane.classList.add('sb-active');
                this._renderContentPane(tab);
            }
        }
    },
    
    _renderContentPane: function(tab) {
        var pane = document.getElementById('sb-pane-content');
        if (!pane) return;
        
        var titles = {
            factions: 'Factions',
            characters: 'Characters',
            units: 'Unit Templates',
            dialogues: 'Dialogues',
            quests: 'Quests',
            scenes: 'Scenes',
            tilesets: 'Tilesets'
        };
        
        pane.innerHTML = [
            '<div class="sb-sec-hdr">' + (titles[tab] || tab) + '</div>',
            '<div class="sb-sec-body">',
            '  <p style="color:#6a5040;font-size:6px;text-align:center;padding:20px;">',
            '    Loading ' + (titles[tab] || tab) + '...',
            '  </p>',
            '</div>'
        ].join('');
        
        // TODO: Load actual content based on tab
        if (tab === 'units' && typeof RealmKit.StoryBuilder !== 'undefined') {
            // Could integrate with existing StoryBuilder units tab
            pane.innerHTML = [
                '<div class="sb-sec-hdr">Unit Templates</div>',
                '<div class="sb-sec-body">',
                '  <button class="sb-btn sb-btn-gold" onclick="RealmKit._storyBuilder._openFullscreen()">',
                '    ↗ Open Full Story Builder',
                '  </button>',
                '</div>'
            ].join('');
        }
    },
    
    _openFullscreen: function() {
        if (typeof RealmKit.StoryBuilder === 'function' && this.engine) {
            var builder = new RealmKit.StoryBuilder(this.engine);
            builder.show();
        }
    },
    
    _loadStories: function() {
        var self = this;
        var list = this._e['sb-story-list'];
        if (!list) return;
        
        list.innerHTML = '<div style="color:#6a5040;font-size:6px;padding:10px;">Loading...</div>';
        
        if (this.db) {
            this.db.getAllStories().then(function(stories) {
                self._renderStoryList(stories || []);
            }).catch(function(err) {
                list.innerHTML = '<div style="color:#c84040;font-size:6px;padding:10px;">Error loading stories</div>';
                console.error('[StoryBuilderSidebar] Failed to load stories:', err);
            });
        } else {
            list.innerHTML = '<div style="color:#6a5040;font-size:6px;padding:10px;">No database available</div>';
        }
    },
    
    _renderStoryList: function(stories) {
        var list = this._e['sb-story-list'];
        if (!list) return;
        
        if (stories.length === 0) {
            list.innerHTML = '<div style="color:#6a5040;font-size:6px;padding:10px;text-align:center;">No stories found.<br>Create your first story!</div>';
            return;
        }
        
        var html = '';
        for (var i = 0; i < stories.length; i++) {
            var s = stories[i];
            html += '<div class="sb-list-item" data-story-id="' + s.id + '">' + 
                    (s.title || s.name || 'Untitled') + 
                    '</div>';
        }
        list.innerHTML = html;
        
        // Bind click handlers
        var items = list.querySelectorAll('.sb-list-item');
        for (var j = 0; j < items.length; j++) {
            items[j].addEventListener('click', function() {
                var storyId = this.getAttribute('data-story-id');
                self._selectStory(storyId);
            });
        }
        
        var self = this;
    },
    
    _selectStory: function(storyId) {
        // Update selection visual
        var items = document.querySelectorAll('.sb-list-item');
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove('sb-selected');
        }
        var selected = document.querySelector('.sb-list-item[data-story-id="' + storyId + '"]');
        if (selected) selected.classList.add('sb-selected');
        
        // Load story
        if (this.engine && this.engine.loadStory) {
            this.engine.loadStory(storyId);
        }
        
        if (this._e['sb-story-current']) {
            this._e['sb-story-current'].textContent = storyId;
        }
    },
    
    _applyWidth: function() {
        if (this._e['sb-main-panel']) {
            this._e['sb-main-panel'].style.width = this.sidebarWidth + 'px';
        }
    },
    
    toggle: function() {
        this.visible = !this.visible;
        var panel = this._e['sb-main-panel'];
        if (panel) {
            panel.classList.toggle('is-open', this.visible);
        }
        console.log('[StoryBuilderSidebar]', this.visible ? 'opened' : 'closed');
    },
    
    show: function() {
        if (!this.visible) this.toggle();
    },
    
    hide: function() {
        if (this.visible) this.toggle();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
//  NOTE: The standalone StoryBuilderSidebar (#sb-root) is superseded by the
//  Builder tab inside RealmSidebar.  install() now delegates to that tab so
//  only one sidebar is ever created.
// ─────────────────────────────────────────────────────────────────────────────

RealmKit.StoryBuilderSidebar = {
    install: function(engine) {
        // If the unified sidebar already exists, just return a shim that points
        // to its builder mode.  This prevents a second #sb-root being created.
        if (RealmKit._sidebar) {
            var shim = {
                engine:  engine,
                visible: false,
                show:    function() { RealmKit._sidebar._setMode('builder'); },
                hide:    function() { RealmKit._sidebar.hide(); },
                toggle:  function() { RealmKit._sidebar._setMode('builder'); },
                db:      RealmKit._sidebar.db
            };
            RealmKit._storyBuilder = shim;
            return shim;
        }

        // Fallback: build the standalone sidebar only if RealmSidebar isn't loaded
        if (!RealmKit._storyBuilder) {
            RealmKit._storyBuilder = new RealmKit._StoryBuilderSidebarImpl(engine);
        }
        return RealmKit._storyBuilder;
    },

    get: function() {
        return RealmKit._storyBuilder || null;
    }
};

console.log('[StoryBuilderSidebar] Loaded — builder tab is inside RealmSidebar (F4)');
