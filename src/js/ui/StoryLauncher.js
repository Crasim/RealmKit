var RealmKit = RealmKit || {};

RealmKit.StoryLauncher = class StoryLauncher {
    constructor(config) {
        this.config = config || {};
        this.container = config.container || document.body;
        this.apiUrl = config.apiUrl || '/RealmKit/api';
        this.engine = config.engine || null;
        
        this.stories = [];
        this.selectedStoryId = null;
        this.visible = false;
        
        this.element = null;
        this.listElement = null;
        this.statusElement = null;
        
        this.callbacks = {
            select: null,
            offline: null,
            error: null
        };
        
        console.log('[StoryLauncher] Initialized');
    }
    
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
        return this;
    }
    
    async show() {
        if (!this.element) {
            this.createElement();
        }
        
        this.element.style.display = 'flex';
        this.element.style.opacity = '0';
        
        var self = this;
        requestAnimationFrame(function() {
            self.element.style.opacity = '1';
        });
        
        this.visible = true;
        
        await this.loadStories();
        
        return this;
    }
    
    hide() {
        if (this.element) {
            this.element.style.opacity = '0';
            var self = this;
            setTimeout(function() {
                self.element.style.display = 'none';
            }, 300);
        }
        this.visible = false;
        return this;
    }
    
    createElement() {
        this.element = document.createElement('div');
        this.element.id = 'story-launcher';
        this.element.innerHTML = this.getHTML();
        
        var style = document.createElement('style');
        style.textContent = this.getStyles();
        (document.head || document.getElementsByTagName('head')[0]).appendChild(style);
        
        this.container.appendChild(this.element);
        
        this.listElement = this.element.querySelector('#launcher-story-list');
        this.statusElement = this.element.querySelector('#launcher-status');
        
        this.bindEvents();
        
        return this.element;
    }
    
    getHTML() {
        return [
            '<div class="rl-overlay">',
            '  <div class="rl-frame">',
            '    <div class="rl-wood-frame">',
            '      <div class="rl-wood-corner rl-corner-nw"></div>',
            '      <div class="rl-wood-corner rl-corner-ne"></div>',
            '      <div class="rl-wood-corner rl-corner-sw"></div>',
            '      <div class="rl-wood-corner rl-corner-se"></div>',
            '      <div class="rl-wood-edge rl-edge-n"></div>',
            '      <div class="rl-wood-edge rl-edge-s"></div>',
            '      <div class="rl-wood-edge rl-edge-w"></div>',
            '      <div class="rl-wood-edge rl-edge-e"></div>',
            '      <div class="rl-wood-inner">',
            '        <div class="rl-header">',
            '          <div class="rl-header-line rl-hl-left"></div>',
            '          <div class="rl-header-ornament"></div>',
            '          <h1 class="rl-title">RealmKit</h1>',
            '          <div class="rl-header-ornament"></div>',
            '          <div class="rl-header-line rl-hl-right"></div>',
            '        </div>',
            '        <p class="rl-subtitle">Choose Your Story</p>',
            '        <div class="rl-list-container" id="launcher-story-list">',
            '          <div class="rl-loading">',
            '            <div class="rl-loading-dots">',
            '              <span>.</span><span>.</span><span>.</span>',
            '            </div>',
            '            <span>Loading</span>',
            '          </div>',
            '        </div>',
            '        <div class="rl-buttons">',
            '          <button class="rl-btn" id="launcher-refresh">Refresh</button>',
            '          <button class="rl-btn rl-btn-gold" id="launcher-offline">Play Offline</button>',
            '        </div>',
            '        <div class="rl-status" id="launcher-status"></div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }
    
    getStyles() {
        return [
            '@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");',
            '',
            '#story-launcher {',
            '  position: fixed;',
            '  top: 0; left: 0;',
            '  width: 100%; height: 100%;',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  z-index: 10000;',
            '  font-family: "Press Start 2P", monospace;',
            '  image-rendering: pixelated;',
            '  image-rendering: crisp-edges;',
            '  transition: opacity 0.3s;',
            '}',
            '',
            '/* Dark background */',
            '.rl-overlay {',
            '  width: 100%; height: 100%;',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  background: #0a0a12;',
            '  background-image: ',
            '    radial-gradient(circle at 20% 30%, #1a1a28 0%, transparent 40%),',
            '    radial-gradient(circle at 80% 70%, #1a1a28 0%, transparent 40%);',
            '}',
            '',
            '/* Frame container */',
            '.rl-frame {',
            '  max-width: 870px;',
            '  width: 92%;',
            '}',
            '',
            '/* Wood frame - outer border */',
            '.rl-wood-frame {',
            '  position: relative;',
            '  background: #2a1408;',
            '  padding: 24px;',
            '}',
            '',
            '/* Wood grain texture */',
            '.rl-wood-frame::before {',
            '  content: "";',
            '  position: absolute;',
            '  top: 0; left: 0; right: 0; bottom: 0;',
            '  background: ',
            '    repeating-linear-gradient(',
            '      90deg,',
            '      transparent 0px,',
            '      transparent 5px,',
            '      rgba(80, 50, 20, 0.4) 5px,',
            '      rgba(80, 50, 20, 0.4) 6px',
            '    ),',
            '    repeating-linear-gradient(',
            '      0deg,',
            '      transparent 0px,',
            '      transparent 12px,',
            '      rgba(60, 35, 15, 0.3) 12px,',
            '      rgba(60, 35, 15, 0.3) 18px',
            '    ),',
            '    linear-gradient(180deg, #4a2810 0%, #3a1808 50%, #2a1000 100%);',
            '  pointer-events: none;',
            '}',
            '',
            '/* 3D wood border effect */',
            '.rl-wood-frame {',
            '  box-shadow: ',
            '    inset 0 3px 0 0 rgba(255, 200, 150, 0.2),',
            '    inset 0 -6px 0 0 rgba(0, 0, 0, 0.5),',
            '    inset 3px 0 0 0 rgba(255, 200, 150, 0.15),',
            '    inset -3px 0 0 0 rgba(0, 0, 0, 0.3),',
            '    0 0 0 5px #1a0800,',
            '    0 0 0 9px #3a2008,',
            '    0 12px 0 9px rgba(0, 0, 0, 0.5);',
            '}',
            '',
            '/* Corner pieces - decorative */',
            '.rl-wood-corner {',
            '  position: absolute;',
            '  width: 36px;',
            '  height: 36px;',
            '  background: #3a1808;',
            '  box-shadow: ',
            '    inset 0 0 0 3px #5a3818,',
            '    inset 0 0 0 6px #4a2808;',
            '}',
            '.rl-corner-nw { top: 6px; left: 6px; }',
            '.rl-corner-ne { top: 6px; right: 6px; }',
            '.rl-corner-sw { bottom: 6px; left: 6px; }',
            '.rl-corner-se { bottom: 6px; right: 6px; }',
            '',
            '/* Carved corner details */',
            '.rl-corner-nw::before, .rl-corner-ne::before,',
            '.rl-corner-sw::before, .rl-corner-se::before {',
            '  content: "";',
            '  position: absolute;',
            '  top: 6px; left: 6px; right: 6px; bottom: 6px;',
            '  background: #2a1000;',
            '  box-shadow: inset 2px 2px 0 0 rgba(255, 200, 150, 0.15);',
            '}',
            '',
            '/* Edge decorations */',
            '.rl-wood-edge {',
            '  position: absolute;',
            '  background: #3a1808;',
            '}',
            '.rl-edge-n {',
            '  top: 6px; left: 48px; right: 48px; height: 5px;',
            '  background: linear-gradient(90deg, ',
            '    transparent 0%, rgba(5, 5, 3, 0.6) 10%, rgba(5, 5, 3, 0.6) 90%, transparent 100%);',
            '}',
            '.rl-edge-s {',
            '  bottom: 6px; left: 48px; right: 48px; height: 5px;',
            '  background: linear-gradient(90deg, ',
            '    transparent 0%, rgba(5, 5, 3, 0.6) 10%, rgba(5, 5, 3, 0.6) 90%, transparent 100%);',
            '}',
            '.rl-edge-w {',
            '  left: 6px; top: 48px; bottom: 48px; width: 5px;',
            '  background: linear-gradient(180deg, ',
            '    transparent 0%, rgba(5, 5, 3, 0.4) 10%, rgba(5, 5, 3, 0.4) 90%, transparent 100%);',
            '}',
            '.rl-edge-e {',
            '  right: 6px; top: 48px; bottom: 48px; width: 5px;',
            '  background: linear-gradient(180deg, ',
            '    transparent 0%, rgba(5, 5, 3, 0.4) 10%, rgba(5, 5, 3, 0.4) 90%, transparent 100%);',
            '}',
            '',
            '/* Inner parchment area */',
            '.rl-wood-inner {',
            '  position: relative;',
            '  background: #d4c4a0;',
            '  background-image: ',
            '    repeating-linear-gradient(',
            '      0deg,',
            '      transparent 0px,',
            '      transparent 2px,',
            '      rgba(139, 90, 43, 0.05) 2px,',
            '      rgba(139, 90, 43, 0.05) 3px',
            '    ),',
            '    repeating-linear-gradient(',
            '      90deg,',
            '      transparent 0px,',
            '      transparent 5px,',
            '      rgba(139, 90, 43, 0.03) 5px,',
            '      rgba(139, 90, 43, 0.03) 6px',
            '    ),',
            '    linear-gradient(180deg, #e8d8b8 0%, #d4c4a0 40%, #c8b890 100%);',
            '  padding: 24px;',
            '  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.15);',
            '}',
            '',
            '/* Parchment border inset */',
            '.rl-wood-inner {',
            '  box-shadow: ',
            '    inset 5px 5px 0 0 rgba(0, 0, 0, 0.1),',
            '    inset -5px -5px 0 0 rgba(255, 255, 255, 0.2);',
            '}',
            '',
            '/* Title area */',
            '.rl-header {',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  margin-bottom: 12px;',
            '}',
            '',
            '.rl-header-line {',
            '  flex: 1;',
            '  height: 5px;',
            '  max-width: 120px;',
            '  background: linear-gradient(90deg,',
            '    transparent 0%,',
            '    #6a4020 30%,',
            '    #5a3010 50%,',
            '    #6a4020 70%,',
            '    transparent 100%);',
            '}',
            '.rl-hl-left { margin-right: 12px; }',
            '.rl-hl-right { margin-left: 12px; }',
            '',
            '.rl-header-ornament {',
            '  width: 12px;',
            '  height: 12px;',
            '  background: #5a3020;',
            '  transform: rotate(45deg);',
            '  margin: 0 12px;',
            '  box-shadow: inset 2px 2px 0 rgba(255, 200, 150, 0.3);',
            '}',
            '',
            '.rl-title {',
            '  font-size: 21px;',
            '  color: #2a1408;',
            '  margin: 0;',
            '  text-shadow: 2px 2px 0 rgba(255, 255, 255, 0.4);',
            '  letter-spacing: 5px;',
            '}',
            '',
            '.rl-subtitle {',
            '  font-size: 11px;',
            '  color: #6a5040;',
            '  text-align: center;',
            '  margin: 9px 0 18px;',
            '}',
            '',
            '/* Story list */',
            '.rl-list-container {',
            '  max-height: 360px;',
            '  overflow-y: auto;',
            '  overflow-x: hidden;',
            '  margin: 12px 0;',
            '  padding: 6px;',
            '}',
            '',
            '.rl-list-container::-webkit-scrollbar {',
            '  width: 15px;',
            '}',
            '',
            '.rl-list-container::-webkit-scrollbar-track {',
            '  background: #b8a880;',
            '  box-shadow: inset 3px 3px 6px rgba(0, 0, 0, 0.15);',
            '}',
            '',
            '.rl-list-container::-webkit-scrollbar-thumb {',
            '  background: linear-gradient(180deg, #6a5040 0%, #5a4030 50%, #4a3020 100%);',
            '  border: 3px solid #b8a880;',
            '  box-shadow: inset 2px 2px 0 rgba(255, 200, 150, 0.2);',
            '}',
            '',
            '/* Story card - pixel art style */',
            '.rl-card {',
            '  background: #3a2820;',
            '  margin-bottom: 12px;',
            '  padding: 3px;',
            '  box-shadow: ',
            '    0 5px 0 0 #201408,',
            '    inset 0 2px 0 0 rgba(255, 200, 150, 0.1);',
            '  cursor: pointer;',
            '  transition: all 0.05s;',
            '}',
            '',
            '.rl-card:hover {',
            '  background: #4a3830;',
            '  transform: translateX(3px);',
            '}',
            '',
            '.rl-card.rl-selected {',
            '  background: #4a3020;',
            '  box-shadow: ',
            '    0 5px 0 0 #201408,',
            '    inset 0 0 0 3px #c89030,',
            '    0 0 12px 0 rgba(200, 144, 48, 0.3);',
            '}',
            '',
            '.rl-card-inner {',
            '  background: linear-gradient(180deg, #302018 0%, #281810 100%);',
            '  padding: 15px 18px;',
            '}',
            '',
            '.rl-card-title {',
            '  font-size: 14px;',
            '  color: #f8e8c8;',
            '  margin: 0 0 6px;',
            '  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);',
            '}',
            '',
            '.rl-card-genre {',
            '  display: inline-block;',
            '  font-size: 9px;',
            '  color: #c8a040;',
            '  background: #201008;',
            '  padding: 3px 12px;',
            '  margin-bottom: 9px;',
            '  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.3);',
            '}',
            '',
            '.rl-card-desc {',
            '  font-size: 9px;',
            '  color: #a89080;',
            '  line-height: 1.6;',
            '  margin: 0 0 12px;',
            '  max-height: 48px;',
            '  overflow: hidden;',
            '}',
            '',
            '.rl-card-meta {',
            '  display: flex;',
            '  justify-content: space-between;',
            '  align-items: center;',
            '  font-size: 9px;',
            '  color: #807060;',
            '}',
            '',
            '/* Play button */',
            '.rl-card-btn {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 9px;',
            '  padding: 8px 18px;',
            '  background: linear-gradient(180deg, #286020 0%, #184010 50%, #102808 100%);',
            '  color: #90c890;',
            '  border: none;',
            '  cursor: pointer;',
            '  box-shadow: ',
            '    0 5px 0 0 #0a1808,',
            '    inset 0 2px 0 0 rgba(144, 200, 144, 0.3),',
            '    inset 0 -2px 0 0 rgba(0, 0, 0, 0.3);',
            '  transition: all 0.05s;',
            '}',
            '',
            '.rl-card-btn:hover {',
            '  background: linear-gradient(180deg, #388030 0%, #286020 50%, #184010 100%);',
            '}',
            '',
            '.rl-card-btn:active {',
            '  transform: translateY(3px);',
            '  box-shadow: ',
            '    0 2px 0 0 #0a1808,',
            '    inset 0 2px 0 0 rgba(144, 200, 144, 0.3);',
            '}',
            '',
            '/* Loading */',
            '.rl-loading {',
            '  text-align: center;',
            '  padding: 48px 24px;',
            '  color: #6a5040;',
            '  font-size: 12px;',
            '}',
            '',
            '.rl-loading-dots {',
            '  margin-bottom: 12px;',
            '}',
            '',
            '.rl-loading-dots span {',
            '  display: inline-block;',
            '  font-size: 30px;',
            '  animation: rl-bounce 1s infinite;',
            '}',
            '',
            '.rl-loading-dots span:nth-child(2) { animation-delay: 0.2s; }',
            '.rl-loading-dots span:nth-child(3) { animation-delay: 0.4s; }',
            '',
            '@keyframes rl-bounce {',
            '  0%, 80%, 100% { transform: translateY(0); }',
            '  40% { transform: translateY(-12px); }',
            '}',
            '',
            '/* Error */',
            '.rl-error {',
            '  text-align: center;',
            '  padding: 36px 24px;',
            '  color: #8a4030;',
            '  font-size: 11px;',
            '  line-height: 2;',
            '}',
            '',
            '/* Empty */',
            '.rl-empty {',
            '  text-align: center;',
            '  padding: 36px 24px;',
            '  color: #6a5040;',
            '  font-size: 11px;',
            '}',
            '',
            '/* Buttons */',
            '.rl-buttons {',
            '  display: flex;',
            '  justify-content: center;',
            '  gap: 18px;',
            '  margin-top: 18px;',
            '}',
            '',
            '.rl-btn {',
            '  font-family: "Press Start 2P", monospace;',
            '  font-size: 11px;',
            '  padding: 15px 27px;',
            '  background: linear-gradient(180deg, #4a4a58 0%, #3a3a48 50%, #2a2a38 100%);',
            '  color: #c8c8d8;',
            '  border: none;',
            '  cursor: pointer;',
            '  box-shadow: ',
            '    0 6px 0 0 #1a1a28,',
            '    inset 0 2px 0 0 rgba(255, 255, 255, 0.1),',
            '    inset 0 -2px 0 0 rgba(0, 0, 0, 0.3);',
            '  transition: all 0.05s;',
            '}',
            '',
            '.rl-btn:hover {',
            '  background: linear-gradient(180deg, #5a5a68 0%, #4a4a58 50%, #3a3a48 100%);',
            '}',
            '',
            '.rl-btn:active {',
            '  transform: translateY(3px);',
            '  box-shadow: ',
            '    0 3px 0 0 #1a1a28,',
            '    inset 0 2px 0 0 rgba(255, 255, 255, 0.1),',
            '    inset 0 -2px 0 0 rgba(0, 0, 0, 0.3);',
            '}',
            '',
            '.rl-btn-gold {',
            '  background: linear-gradient(180deg, #a87030 0%, #885020 50%, #683010 100%);',
            '  color: #f8e8d0;',
            '  box-shadow: ',
            '    0 6px 0 0 #401808,',
            '    inset 0 2px 0 0 rgba(255, 220, 180, 0.3),',
            '    inset 0 -2px 0 0 rgba(0, 0, 0, 0.3);',
            '}',
            '',
            '.rl-btn-gold:hover {',
            '  background: linear-gradient(180deg, #b88040 0%, #986030 50%, #784020 100%);',
            '}',
            '',
            '/* Status */',
            '.rl-status {',
            '  text-align: center;',
            '  margin-top: 15px;',
            '  font-size: 9px;',
            '  color: #7a6050;',
            '}'
        ].join('\n');
    }
    
    bindEvents() {
        var self = this;
        
        var refreshBtn = this.element.querySelector('#launcher-refresh');
        var offlineBtn = this.element.querySelector('#launcher-offline');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                self.loadStories();
            });
        }
        
        if (offlineBtn) {
            offlineBtn.addEventListener('click', function() {
                self.hide();
                if (self.callbacks.offline) {
                    self.callbacks.offline();
                }
            });
        }
    }
    
    async loadStories() {
        var self = this;
        
        if (!this.listElement) {
            console.error('[StoryLauncher] List element not found');
            return;
        }
        
        this.setStatus('Loading...');
        this.listElement.innerHTML = '<div class="rl-loading"><div class="rl-loading-dots"><span>.</span><span>.</span><span>.</span></div><span>Loading</span></div>';
        
        try {
            var response = await fetch(this.apiUrl + '/stories');
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            this.stories = await response.json();
            this.renderStories();
            this.setStatus('');
        } catch (e) {
            console.error('[StoryLauncher] Failed to load stories:', e);
            this.listElement.innerHTML = '<div class="rl-error">Unable to connect.<br>Use "Play Offline" to start.</div>';
            this.setStatus('Connection failed');
        }
    }
    
    renderStories() {
        if (!this.listElement) return;
        
        if (this.stories.length === 0) {
            this.listElement.innerHTML = '<div class="rl-empty">No stories found.<br>Use "Play Offline" to begin.</div>';
            return;
        }
        
        var html = '';
        for (var i = 0; i < this.stories.length; i++) {
            var story = this.stories[i];
            var selected = story.id === this.selectedStoryId ? ' rl-selected' : '';
            var playCount = story.play_count || 0;
            var genre = story.genre_name || story.genre || 'Unknown';
            
            html += [
                '<div class="rl-card' + selected + '" data-story-id="' + story.id + '">',
                '  <div class="rl-card-inner">',
                '    <h3 class="rl-card-title">' + this.escapeHtml(story.title) + '</h3>',
                '    <span class="rl-card-genre">' + this.escapeHtml(genre) + '</span>',
                '    <p class="rl-card-desc">' + this.escapeHtml(story.description || 'An adventure awaits...') + '</p>',
                '    <div class="rl-card-meta">',
                '      <span>Plays: ' + playCount + '</span>',
                '      <button class="rl-card-btn" data-story-id="' + story.id + '">Start</button>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');
        }
        
        this.listElement.innerHTML = html;
        this.bindStoryEvents();
    }
    
    bindStoryEvents() {
        var self = this;
        
        var cards = this.listElement.querySelectorAll('.rl-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', function(e) {
                if (e.target.classList.contains('rl-card-btn')) {
                    return;
                }
                var storyId = this.getAttribute('data-story-id');
                self.selectStory(storyId);
            });
        }
        
        var playBtns = this.listElement.querySelectorAll('.rl-card-btn');
        for (var i = 0; i < playBtns.length; i++) {
            playBtns[i].addEventListener('click', function(e) {
                e.stopPropagation();
                var storyId = this.getAttribute('data-story-id');
                self.playStory(storyId);
            });
        }
    }
    
    selectStory(storyId) {
        this.selectedStoryId = storyId;
        this.renderStories();
        this.setStatus('Selected: ' + storyId);
    }
    
    async playStory(storyId) {
        this.setStatus('Starting...');
        this.hide();
        
        if (this.callbacks.select) {
            this.callbacks.select(storyId);
        }
    }
    
    setStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
    }
    
    escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

console.log('[StoryLauncher] Class loaded');