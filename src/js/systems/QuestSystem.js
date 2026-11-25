var RealmKit = RealmKit || {};

RealmKit.QuestSystem = class QuestSystem {
    constructor(config) {
        this.config = config || {};
        
        this.quests = new Map();
        this.activeQuests = [];
        this.completedQuests = [];
        
        this.onQuestStart = null;
        this.onQuestComplete = null;
        this.onObjectiveUpdate = null;
        
        console.log('[QuestSystem] Initialized');
    }
    
    register(questData) {
        if (!questData.id) {
            console.warn('[QuestSystem] Quest missing id');
            return;
        }
        
        var quest = {
            id: questData.id,
            title: questData.title || 'Untitled Quest',
            description: questData.description || '',
            objectives: questData.objectives || [],
            rewards: questData.rewards || {},
            prerequisites: questData.prerequisites || [],
            state: 'available',
            progress: {}
        };
        
        for (var i = 0; i < quest.objectives.length; i++) {
            var obj = quest.objectives[i];
            quest.progress[obj.id] = {
                current: 0,
                required: obj.required || 1
            };
        }
        
        this.quests.set(quest.id, quest);
        console.log('[QuestSystem] Registered quest:', quest.id);
    }
    
    start(questId) {
        var quest = this.quests.get(questId);
        if (!quest) {
            console.warn('[QuestSystem] Quest not found:', questId);
            return false;
        }
        
        if (quest.state !== 'available') {
            console.warn('[QuestSystem] Quest not available:', questId);
            return false;
        }
        
        for (var i = 0; i < quest.prerequisites.length; i++) {
            if (!this.isCompleted(quest.prerequisites[i])) {
                return false;
            }
        }
        
        quest.state = 'active';
        this.activeQuests.push(questId);
        
        if (this.onQuestStart) {
            this.onQuestStart(quest);
        }
        
        console.log('[QuestSystem] Started quest:', questId);
        return true;
    }
    
    complete(questId) {
        var quest = this.quests.get(questId);
        if (!quest || quest.state !== 'active') return false;
        
        var allComplete = true;
        for (var i = 0; i < quest.objectives.length; i++) {
            var obj = quest.objectives[i];
            var prog = quest.progress[obj.id];
            if (prog.current < prog.required) {
                allComplete = false;
                break;
            }
        }
        
        if (!allComplete) {
            console.warn('[QuestSystem] Quest objectives not complete:', questId);
            return false;
        }
        
        quest.state = 'completed';
        
        var idx = this.activeQuests.indexOf(questId);
        if (idx !== -1) this.activeQuests.splice(idx, 1);
        this.completedQuests.push(questId);
        
        if (this.onQuestComplete) {
            this.onQuestComplete(quest, quest.rewards);
        }
        
        console.log('[QuestSystem] Completed quest:', questId);
        return true;
    }
    
    fail(questId) {
        var quest = this.quests.get(questId);
        if (!quest || quest.state !== 'active') return false;
        
        quest.state = 'failed';
        
        var idx = this.activeQuests.indexOf(questId);
        if (idx !== -1) this.activeQuests.splice(idx, 1);
        
        console.log('[QuestSystem] Failed quest:', questId);
        return true;
    }
    
    updateObjective(questId, objectiveId, amount) {
        var quest = this.quests.get(questId);
        if (!quest || quest.state !== 'active') return false;
        
        var progress = quest.progress[objectiveId];
        if (!progress) return false;
        
        progress.current = Math.min(progress.current + (amount || 1), progress.required);
        
        if (this.onObjectiveUpdate) {
            this.onObjectiveUpdate(quest, objectiveId, progress);
        }
        
        console.log('[QuestSystem] Updated objective:', questId, objectiveId, progress.current + '/' + progress.required);
        
        this.checkAutoComplete(questId);
        
        return true;
    }
    
    checkAutoComplete(questId) {
        var quest = this.quests.get(questId);
        if (!quest || quest.state !== 'active') return;
        
        var allComplete = true;
        for (var i = 0; i < quest.objectives.length; i++) {
            var obj = quest.objectives[i];
            var prog = quest.progress[obj.id];
            if (prog.current < prog.required) {
                allComplete = false;
                break;
            }
        }
        
        if (allComplete && quest.autoComplete) {
            this.complete(questId);
        }
    }
    
    onKill(enemyType) {
        for (var i = 0; i < this.activeQuests.length; i++) {
            var quest = this.quests.get(this.activeQuests[i]);
            if (!quest) continue;
            
            for (var j = 0; j < quest.objectives.length; j++) {
                var obj = quest.objectives[j];
                if (obj.type === 'kill' && (obj.target === enemyType || obj.target === 'any')) {
                    this.updateObjective(quest.id, obj.id, 1);
                }
            }
        }
    }
    
    onCollect(itemType) {
        for (var i = 0; i < this.activeQuests.length; i++) {
            var quest = this.quests.get(this.activeQuests[i]);
            if (!quest) continue;
            
            for (var j = 0; j < quest.objectives.length; j++) {
                var obj = quest.objectives[j];
                if (obj.type === 'collect' && obj.item === itemType) {
                    this.updateObjective(quest.id, obj.id, 1);
                }
            }
        }
    }
    
    onTalk(npcId) {
        for (var i = 0; i < this.activeQuests.length; i++) {
            var quest = this.quests.get(this.activeQuests[i]);
            if (!quest) continue;
            
            for (var j = 0; j < quest.objectives.length; j++) {
                var obj = quest.objectives[j];
                if (obj.type === 'talk' && obj.npc === npcId) {
                    this.updateObjective(quest.id, obj.id, 1);
                }
            }
        }
    }
    
    onExplore(locationId) {
        for (var i = 0; i < this.activeQuests.length; i++) {
            var quest = this.quests.get(this.activeQuests[i]);
            if (!quest) continue;
            
            for (var j = 0; j < quest.objectives.length; j++) {
                var obj = quest.objectives[j];
                if (obj.type === 'explore' && obj.location === locationId) {
                    this.updateObjective(quest.id, obj.id, 1);
                }
            }
        }
    }
    
    startQuest(questId) {
        return this.start(questId);
    }
    
    getQuest(questId) {
        return this.quests.get(questId);
    }
    
    advanceQuest(questId, objectiveId, amount) {
        return this.updateObjective(questId, objectiveId, amount || 1);
    }
    
    onReachLocation(locationId) {
        for (var i = 0; i < this.activeQuests.length; i++) {
            var quest = this.quests.get(this.activeQuests[i]);
            if (!quest) continue;
            
            for (var j = 0; j < quest.objectives.length; j++) {
                var obj = quest.objectives[j];
                if (obj.type === 'reach' && obj.location === locationId) {
                    this.updateObjective(quest.id, obj.id, 1);
                }
            }
        }
    }
    
    isActive(questId) {
        var quest = this.quests.get(questId);
        return quest ? quest.state === 'active' : false;
    }
    
    isCompleted(questId) {
        return this.completedQuests.indexOf(questId) !== -1;
    }
    
    isAvailable(questId) {
        var quest = this.quests.get(questId);
        if (!quest) return false;
        if (quest.state !== 'available') return false;
        
        for (var i = 0; i < quest.prerequisites.length; i++) {
            if (!this.isCompleted(quest.prerequisites[i])) return false;
        }
        
        return true;
    }
    
    getActiveQuests() {
        var list = [];
        for (var i = 0; i < this.activeQuests.length; i++) {
            list.push(this.quests.get(this.activeQuests[i]));
        }
        return list;
    }
    
    getProgress(questId) {
        var quest = this.quests.get(questId);
        return quest ? quest.progress : null;
    }
    
    serialize() {
        var data = {
            active: this.activeQuests.slice(),
            completed: this.completedQuests.slice(),
            progress: {}
        };
        
        this.quests.forEach(function(quest, id) {
            data.progress[id] = quest.progress;
        });
        
        return JSON.stringify(data);
    }
    
    deserialize(json) {
        try {
            var data = JSON.parse(json);
            
            this.activeQuests = data.active || [];
            this.completedQuests = data.completed || [];
            
            for (var questId in data.progress) {
                var quest = this.quests.get(questId);
                if (quest) {
                    quest.progress = data.progress[questId];
                    if (this.activeQuests.indexOf(questId) !== -1) {
                        quest.state = 'active';
                    } else if (this.completedQuests.indexOf(questId) !== -1) {
                        quest.state = 'completed';
                    }
                }
            }
            
            console.log('[QuestSystem] Loaded state');
            return true;
        } catch (e) {
            console.error('[QuestSystem] Load failed:', e);
            return false;
        }
    }
};

console.log('[QuestSystem] Class loaded');