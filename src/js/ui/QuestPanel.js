var RealmKit = RealmKit || {};

RealmKit.QuestPanel = class QuestPanel {
    constructor(config) {
        this.config = config || {};
        this.visible = false;
        
        this.questSystem = config.questSystem || null;
        
        this.x = config.x || 20;
        this.y = config.y || 80;
        this.width = config.width || 320;
        this.height = config.height || 400;
        this.padding = 8;
        
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        
        this.selectedQuestId = null;
        this.scrollOffset = 0;
        this.maxScroll = 0;
        
        this.tabMode = 'active';
        
        this._boundClick = null;
        this._boundWheel = null;
        this._boundKeyDown = null;
        
        console.log('[QuestPanel] Initialized');
    }
    
    setQuestSystem(questSystem) {
        this.questSystem = questSystem;
    }
    
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.visible = true;
            this.render();
            return;
        }
        
        this.createUI();
        this.visible = true;
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.visible = false;
    }
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'quest-panel';
        this.container.style.cssText = 
            'position: fixed;' +
            'top: ' + this.y + 'px;' +
            'left: ' + this.x + 'px;' +
            'width: ' + this.width + 'px;' +
            'background: rgba(15, 15, 25, 0.95);' +
            'border: 2px solid #445566;' +
            'border-radius: 8px;' +
            'padding: ' + this.padding + 'px;' +
            'z-index: 1000;' +
            'font-family: "Press Start 2P", "Courier New", monospace;' +
            'font-size: 10px;' +
            'color: #ffffff;' +
            'pointer-events: auto;' +
            'box-shadow: 0 4px 12px rgba(0,0,0,0.5);';
        
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 
            'border-bottom: 1px solid #445566;' +
            'padding-bottom: 8px;' +
            'margin-bottom: 8px;' +
            'display: flex;' +
            'justify-content: space-between;' +
            'align-items: center;';
        titleBar.innerHTML = '<span style="color:#88ccff;">Quest Log</span><span style="cursor:pointer;color:#888;font-size:8px;" id="quest-close-btn">[Esc]</span>';
        this.container.appendChild(titleBar);
        
        var tabContainer = document.createElement('div');
        tabContainer.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
        
        var self = this;
        
        var activeTab = document.createElement('button');
        activeTab.textContent = 'Active';
        activeTab.style.cssText = 'flex:1;padding:4px;background:#334455;border:1px solid #445566;color:#88ccff;cursor:pointer;font-size:9px;';
        activeTab.onclick = function() { self.setTab('active'); };
        tabContainer.appendChild(activeTab);
        
        var completedTab = document.createElement('button');
        completedTab.textContent = 'Completed';
        completedTab.style.cssText = 'flex:1;padding:4px;background:#222;border:1px solid #334455;color:#666;cursor:pointer;font-size:9px;';
        completedTab.onclick = function() { self.setTab('completed'); };
        tabContainer.appendChild(completedTab);
        
        this.container.appendChild(tabContainer);
        this.tabElements = { active: activeTab, completed: completedTab };
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width - this.padding * 2;
        this.canvas.height = this.height - 80;
        this.canvas.style.cssText = 
            'display: block;' +
            'border: 1px solid #334455;' +
            'background: #111122;' +
            'border-radius: 4px;' +
            'cursor: pointer;';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.ctx.roundRect) {
            this.ctx.roundRect = function(x, y, w, h, r) {
                if (w < 2 * r) r = w / 2;
                if (h < 2 * r) r = h / 2;
                this.beginPath();
                this.moveTo(x + r, y);
                this.arcTo(x + w, y, x + w, y + h, r);
                this.arcTo(x + w, y + h, x, y + h, r);
                this.arcTo(x, y + h, x, y, r);
                this.arcTo(x, y, x + w, y, r);
                this.closePath();
                return this;
            };
        }
        
        this._boundClick = this.onClick.bind(this);
        this._boundWheel = this.onWheel.bind(this);
        this._boundKeyDown = this.onKeyDown.bind(this);

        this.canvas.addEventListener('click', this._boundClick);
        this.canvas.addEventListener('wheel', this._boundWheel);
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.addEventListener('keydown', this._boundKeyDown);
        
        var closeButton = document.getElementById('quest-close-btn');
        if (closeButton) {
            closeButton.onclick = function() { self.hide(); };
        }
        
        document.body.appendChild(this.container);
        this.render();
    }
    
    setTab(mode) {
        this.tabMode = mode;
        this.selectedQuestId = null;
        this.scrollOffset = 0;
        
        if (this.tabElements) {
            if (mode === 'active') {
                this.tabElements.active.style.background = '#334455';
                this.tabElements.active.style.color = '#88ccff';
                this.tabElements.completed.style.background = '#222';
                this.tabElements.completed.style.color = '#666';
            } else {
                this.tabElements.completed.style.background = '#334455';
                this.tabElements.completed.style.color = '#88ccff';
                this.tabElements.active.style.background = '#222';
                this.tabElements.active.style.color = '#666';
            }
        }
        
        this.render();
    }
    
    onClick(e) {
        var rect = this.canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top - this.scrollOffset;
        
        if (x > 10 && x < this.canvas.width - 10) {
            var quests = this.getQuests();
            var itemHeight = 60;
            
            for (var i = 0; i < quests.length; i++) {
                var itemY = 10 + i * itemHeight;
                if (y >= itemY && y < itemY + itemHeight - 5) {
                    this.selectedQuestId = quests[i].id;
                    this.render();
                    return;
                }
            }
        }
    }
    
    onWheel(e) {
        e.preventDefault();
        this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + e.deltaY));
        this.render();
    }
    
    onKeyDown(e) {
        var quests = this.getQuests();
        if (quests.length === 0) return;
        
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                e.preventDefault();
                this.selectedQuestId = this._getPrevQuestId(quests);
                this.ensureVisible(this.selectedQuestId, quests);
                this.render();
                break;
            case 'ArrowDown':
            case 's':
                e.preventDefault();
                this.selectedQuestId = this._getNextQuestId(quests);
                this.ensureVisible(this.selectedQuestId, quests);
                this.render();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (this.selectedQuestId) {
                    this.showQuestDetails(this.selectedQuestId);
                }
                break;
            case 'Tab':
                e.preventDefault();
                this.setTab(this.tabMode === 'active' ? 'completed' : 'active');
                break;
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
        }
    }
    
    _getPrevQuestId(quests) {
        if (!this.selectedQuestId) return quests[0].id;
        var idx = -1;
        for (var i = 0; i < quests.length; i++) {
            if (quests[i].id === this.selectedQuestId) {
                idx = i;
                break;
            }
        }
        if (idx <= 0) return quests[0].id;
        return quests[idx - 1].id;
    }
    
    _getNextQuestId(quests) {
        if (!this.selectedQuestId) return quests[0].id;
        var idx = -1;
        for (var i = 0; i < quests.length; i++) {
            if (quests[i].id === this.selectedQuestId) {
                idx = i;
                break;
            }
        }
        if (idx >= quests.length - 1) return quests[quests.length - 1].id;
        return quests[idx + 1].id;
    }
    
    ensureVisible(questId, quests) {
        var itemHeight = 60;
        var idx = -1;
        for (var i = 0; i < quests.length; i++) {
            if (quests[i].id === questId) {
                idx = i;
                break;
            }
        }
        if (idx === -1) return;
        
        var itemTop = idx * itemHeight;
        var itemBottom = itemTop + itemHeight;
        
        if (itemTop < this.scrollOffset) {
            this.scrollOffset = itemTop;
        } else if (itemBottom > this.scrollOffset + this.canvas.height) {
            this.scrollOffset = itemBottom - this.canvas.height;
        }
        this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset));
    }
    
    showQuestDetails(questId) {
        // Could open a detail modal or expand in place
        console.log('[QuestPanel] Selected quest:', questId);
    }
    
    getQuests() {
        if (!this.questSystem) return [];
        
        if (this.tabMode === 'active') {
            return this.questSystem.getActiveQuests();
        } else {
            var completed = [];
            for (var i = 0; i < this.questSystem.completedQuests.length; i++) {
                var quest = this.questSystem.quests.get(this.questSystem.completedQuests[i]);
                if (quest) completed.push(quest);
            }
            return completed;
        }
    }
    
    render() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        var quests = this.getQuests();
        var itemHeight = 60;
        
        this.maxScroll = Math.max(0, quests.length * itemHeight - this.canvas.height + 20);
        
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.clip();
        this.ctx.translate(0, -this.scrollOffset);
        
        if (quests.length === 0) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                this.tabMode === 'active' ? 'No active quests' : 'No completed quests',
                this.canvas.width / 2,
                this.canvas.height / 2
            );
        } else {
            for (var i = 0; i < quests.length; i++) {
                this.renderQuestItem(quests[i], 10, 10 + i * itemHeight);
            }
        }
        
        this.ctx.restore();
    }
    
    renderQuestItem(quest, x, y) {
        var width = this.canvas.width - 20;
        var height = 55;
        
        var isSelected = this.selectedQuestId === quest.id;
        
        this.ctx.fillStyle = isSelected ? '#334466' : '#1a1a2a';
        this.ctx.strokeStyle = isSelected ? '#88aacc' : '#334455';
        this.ctx.lineWidth = isSelected ? 2 : 1;
        
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 4);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#88ccff';
        this.ctx.font = 'bold 11px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(quest.title, x + 8, y + 6);
        
        var objectives = quest.objectives || [];
        var completedCount = 0;
        for (var i = 0; i < objectives.length; i++) {
            var prog = quest.progress[objectives[i].id];
            if (prog && prog.current >= prog.required) {
                completedCount++;
            }
        }
        
        this.ctx.fillStyle = '#666';
        this.ctx.font = '9px Arial';
        this.ctx.fillText(
            completedCount + '/' + objectives.length + ' objectives',
            x + 8, y + 22
        );
        
        var objY = y + 36;
        for (var i = 0; i < Math.min(2, objectives.length); i++) {
            var obj = objectives[i];
            var prog = quest.progress[obj.id];
            var complete = prog && prog.current >= prog.required;
            
            this.ctx.fillStyle = complete ? '#4ecca3' : '#888';
            this.ctx.fillText(
                (complete ? '✓ ' : '○ ') + (obj.description || obj.type + ' ' + (obj.target || obj.item || obj.location)) +
                (prog ? ' (' + prog.current + '/' + prog.required + ')' : ''),
                x + 8, objY + i * 12
            );
        }
        
        if (quest.rewards && Object.keys(quest.rewards).length > 0) {
            this.ctx.fillStyle = '#ffd700';
            this.ctx.font = '8px Arial';
            this.ctx.textAlign = 'right';
            var rewardText = '';
            if (quest.rewards.xp) rewardText += quest.rewards.xp + ' XP ';
            if (quest.rewards.gold) rewardText += quest.rewards.gold + ' Gold ';
            this.ctx.fillText(rewardText.trim(), x + width - 8, y + 6);
        }
    }
    
    destroy() {
        if (this._boundClick && this.canvas) {
            this.canvas.removeEventListener('click', this._boundClick);
            this.canvas.removeEventListener('wheel', this._boundWheel);
            this.canvas.removeEventListener('keydown', this._boundKeyDown);
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this._boundClick = null;
        this._boundWheel = null;
        this._boundKeyDown = null;
    }
};

console.log('[QuestPanel] Module loaded');