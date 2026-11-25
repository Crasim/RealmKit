var RealmKit = RealmKit || {};

RealmKit.QuestTracker = class QuestTracker {
    constructor(config) {
        this.config = config || {};
        
        this.questSystem = config.questSystem || null;
        
        this.x = config.x || 10;
        this.y = config.y || 140;
        this.width = config.width || 260;
        this.maxObjectives = config.maxObjectives || 3;
        
        this.container = null;
        this.visible = true;
        
        this._dirty = true;
        this._lastQuestHash = '';
        
        console.log('[QuestTracker] Initialized');
    }
    
    setQuestSystem(questSystem) {
        this.questSystem = questSystem;
        this._dirty = true;
    }
    
    _computeQuestHash(quests) {
        if (!quests || quests.length === 0) return 'empty';
        var parts = [];
        for (var i = 0, len = Math.min(quests.length, 3); i < len; i++) {
            var q = quests[i];
            var objStr = '';
            var objectives = q.objectives || [];
            for (var j = 0, jlen = objectives.length; j < jlen && j < this.maxObjectives; j++) {
                var obj = objectives[j];
                var prog = q.progress[obj.id];
                objStr += (prog ? prog.current : 0) + '/' + (prog ? prog.required : 0) + ';';
            }
            parts.push(q.id + ':' + objStr);
        }
        return parts.join('|');
    }
    
    create() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.id = 'quest-tracker';
        this.container.style.cssText = 
            'position: fixed;' +
            'top: ' + this.y + 'px;' +
            'left: ' + this.x + 'px;' +
            'width: ' + this.width + 'px;' +
            'pointer-events: none;' +
            'z-index: 150;' +
            'font-family: "Press Start 2P", monospace;' +
            'font-size: 6px;' +
            'background: repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);' +
            'border: 3px solid #1a0800;' +
            'box-shadow: inset 0 2px 0 rgba(255,200,150,.15), inset 0 -4px 0 rgba(0,0,0,.45), 0 10px 18px rgba(0,0,0,.35);' +
            'border-radius: 4px;' +
            'padding: 6px;';
        
        document.body.appendChild(this.container);
    }
    
    update() {
        if (!this.container) {
            this.create();
        }
        
        if (!this.visible || !this.questSystem) {
            this.container.style.display = 'none';
            return;
        }
        
        var activeQuests = this.questSystem.getActiveQuests();
        
        if (activeQuests.length === 0) {
            this.container.style.display = 'none';
            return;
        }
        
        this.container.style.display = 'block';
        
        var currentHash = this._computeQuestHash(activeQuests);
        if (!this._dirty && currentHash === this._lastQuestHash) {
            return;
        }
        
        this._dirty = false;
        this._lastQuestHash = currentHash;
        
        this.container.innerHTML = '';
        
        var maxQuests = Math.min(3, activeQuests.length);
        
        for (var q = 0; q < maxQuests; q++) {
            var quest = activeQuests[q];
            this.renderQuest(quest, q);
        }
    }
    
    renderQuest(quest, index) {
        var questDiv = document.createElement('div');
        questDiv.style.cssText = 
            'background: repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.18) 5px,rgba(80,50,20,.18) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);' +
            'border: 2px solid #5a3818;' +
            'border-radius: 3px;' +
            'padding: 6px 8px;' +
            'margin-bottom: 5px;';
        
        var titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'color: #f6e2ae; font-weight: bold; margin-bottom: 4px; font-size: 8px; text-shadow: 1px 1px 0 rgba(0,0,0,.5);';
        titleDiv.textContent = quest.title;
        questDiv.appendChild(titleDiv);
        
        var objectives = quest.objectives || [];
        var shown = 0;
        
        for (var i = 0; i < objectives.length && shown < this.maxObjectives; i++) {
            var obj = objectives[i];
            var prog = quest.progress[obj.id];
            
            if (!prog) continue;
            
            var complete = prog.current >= prog.required;
            
            var objDiv = document.createElement('div');
            objDiv.style.cssText = 
                'color: ' + (complete ? '#9fcd91' : '#c8b890') + ';' +
                'font-size: 7px;' +
                'margin-left: 6px;' +
                'margin-top: 2px;';
            
            var checkmark = complete ? '✓' : '○';
            var description = obj.description || this.getObjectiveDescription(obj);
            
            objDiv.textContent = checkmark + ' ' + description;
            
            if (!complete) {
                var progressSpan = document.createElement('span');
                progressSpan.style.cssText = 'color: #8a7060; margin-left: 4px;';
                progressSpan.textContent = '(' + prog.current + '/' + prog.required + ')';
                objDiv.appendChild(progressSpan);
            }
            
            questDiv.appendChild(objDiv);
            shown++;
        }
        
        if (quest.rewards) {
            var rewardDiv = document.createElement('div');
            rewardDiv.style.cssText = 'color: #f6d86a; font-size: 7px; margin-top: 4px; margin-left: 6px;';
            var rewardText = '';
            if (quest.rewards.xp) rewardText += quest.rewards.xp + ' XP ';
            if (quest.rewards.gold) rewardText += quest.rewards.gold + ' Gold';
            rewardDiv.textContent = 'Reward: ' + rewardText.trim();
            questDiv.appendChild(rewardDiv);
        }
        
        this.container.appendChild(questDiv);
    }
    
    getObjectiveDescription(obj) {
        var type = obj.type || 'unknown';
        var target = obj.target || obj.item || obj.location || '???';
        var required = obj.required || 1;
        
        switch (type) {
            case 'kill':
                return 'Defeat ' + target + (required > 1 ? ' x' + required : '');
            case 'collect':
                return 'Collect ' + target + (required > 1 ? ' x' + required : '');
            case 'talk':
                return 'Speak to ' + target;
            case 'reach':
                return 'Travel to ' + target;
            case 'deliver':
                return 'Deliver ' + target;
            case 'explore':
                return 'Explore ' + target;
            default:
                return target;
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    show() {
        this.visible = true;
    }
    
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
};

console.log('[QuestTracker] Module loaded');