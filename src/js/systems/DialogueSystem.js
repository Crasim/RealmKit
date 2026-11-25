var RealmKit = RealmKit || {};

RealmKit.DialogueSystem = class DialogueSystem {
    constructor(config) {
        this.config = config || {};
        
        this.dialogues = new Map();
        this.activeDialogue = null;
        this.currentNode = null;
        this.history = [];
        
        this.onDialogueStart = null;
        this.onDialogueEnd = null;
        this.onNodeChange = null;
        this.onChoice = null;
        
        console.log('[DialogueSystem] Initialized');
    }
    
    registerDialogue(id, dialogueData) {
        this.dialogues.set(id, dialogueData);
        console.log('[DialogueSystem] Registered dialogue:', id);
    }
    
    start(dialogueId, context) {
        var dialogue = this.dialogues.get(dialogueId);
        if (!dialogue) {
            console.warn('[DialogueSystem] Dialogue not found:', dialogueId);
            return false;
        }
        
        this.activeDialogue = dialogue;
        this.currentNode = dialogue.startNode || 'start';
        this.history = [];
        this.context = context || {};
        
        var node = this.getNode(this.currentNode);
        
        if (this.onDialogueStart) {
            this.onDialogueStart(dialogueId, node, this.context);
        }
        
        console.log('[DialogueSystem] Started dialogue:', dialogueId);
        return true;
    }
    
    end() {
        if (!this.activeDialogue) return;
        
        var dialogueId = this.activeDialogue.id;
        this.activeDialogue = null;
        this.currentNode = null;
        this.history = [];
        
        if (this.onDialogueEnd) {
            this.onDialogueEnd(dialogueId, this.context);
        }
        
        console.log('[DialogueSystem] Dialogue ended');
    }
    
    getNode(nodeId) {
        if (!this.activeDialogue) return null;
        return this.activeDialogue.nodes ? this.activeDialogue.nodes[nodeId] : null;
    }
    
    getCurrentText() {
        var node = this.getNode(this.currentNode);
        if (!node) return '';
        
        var text = node.text;
        if (typeof text === 'function') {
            return text(this.context);
        }
        return text;
    }
    
    getCurrentSpeaker() {
        var node = this.getNode(this.currentNode);
        return node ? node.speaker || 'NPC' : 'NPC';
    }
    
    getChoices() {
        var node = this.getNode(this.currentNode);
        if (!node || !node.choices) return [];
        
        var availableChoices = [];
        for (var i = 0; i < node.choices.length; i++) {
            var choice = node.choices[i];
            if (this.canShowChoice(choice)) {
                availableChoices.push({
                    index: i,
                    text: typeof choice.text === 'function' ? choice.text(this.context) : choice.text,
                    enabled: this.isChoiceEnabled(choice)
                });
            }
        }
        
        return availableChoices;
    }
    
    canShowChoice(choice) {
        if (!choice.condition) return true;
        if (typeof choice.condition === 'function') {
            return choice.condition(this.context);
        }
        
        // Check quest state condition
        if (choice.condition.questState && this.context.engine && this.context.engine.questSystem) {
            var quest = this.context.engine.questSystem.getQuest(choice.condition.questId);
            if (!quest || quest.state !== choice.condition.questState) {
                return false;
            }
        }
        
        // Check flag condition
        if (choice.condition.hasFlag && this.context.engine) {
            var flagValue = this.context.engine._storyFlags ? this.context.engine._storyFlags[choice.condition.hasFlag] : undefined;
            if (flagValue !== choice.condition.flagValue) {
                return false;
            }
        }
        
        // Check level condition
        if (choice.condition.playerLevel && this.context.player && this.context.player.level) {
            if (this.context.player.level < choice.condition.playerLevel.min) {
                return false;
            }
            if (choice.condition.playerLevel.max !== undefined && this.context.player.level > choice.condition.playerLevel.max) {
                return false;
            }
        }
        
        // Check has item condition
        if (choice.condition.hasItem && this.context.engine && this.context.engine.inventoryManager) {
            var hasItem = this.context.engine.inventoryManager.findById(choice.condition.hasItem);
            if (!hasItem) {
                return false;
            }
        }
        
        return true;
    }
    
    isChoiceEnabled(choice) {
        if (!choice.enabled) return true;
        if (typeof choice.enabled === 'function') {
            return choice.enabled(this.context);
        }
        return choice.enabled;
    }
    
    selectChoice(choiceIndex) {
        var node = this.getNode(this.currentNode);
        if (!node || !node.choices || choiceIndex >= node.choices.length) {
            this.advance();
            return;
        }
        
        var choice = node.choices[choiceIndex];
        
        this.history.push({
            nodeId: this.currentNode,
            choice: choice.text
        });
        
        if (choice.action && typeof choice.action === 'function') {
            choice.action(this.context);
        }
        
        // Handle quest actions
        if (choice.startQuest && this.context.engine && this.context.engine.questSystem) {
            this.context.engine.questSystem.start(choice.startQuest);
        }
        
        if (choice.completeQuest && this.context.engine && this.context.engine.questSystem) {
            this.context.engine.questSystem.complete(choice.completeQuest);
        }
        
        if (choice.advanceQuest && this.context.engine && this.context.engine.questSystem) {
            var adv = choice.advanceQuest;
            this.context.engine.questSystem.updateObjective(adv.questId, adv.objectiveId, adv.amount || 1);
        }
        
        // Handle flag actions
        if (choice.setFlag && this.context.engine) {
            if (!this.context.engine._storyFlags) {
                this.context.engine._storyFlags = {};
            }
            this.context.engine._storyFlags[choice.setFlag] = choice.flagValue !== undefined ? choice.flagValue : true;
        }
        
        // Handle item rewards
        if (choice.giveItem && this.context.engine && this.context.engine.inventoryManager && this.context.engine.itemManager) {
            var item = this.context.engine.itemManager.createItem(choice.giveItem, choice.itemConfig);
            if (item) {
                this.context.engine.inventoryManager.addItem(item);
            }
        }
        
        // Handle gold rewards
        if (choice.giveGold && this.context.engine && this.context.engine.inventoryManager) {
            this.context.engine.inventoryManager.addGold(choice.giveGold);
        }
        
        // Handle XP rewards
        if (choice.giveXP && this.context.engine && this.context.engine.experienceManager && this.context.player) {
            this.context.engine.experienceManager.addXp(this.context.player.id, choice.giveXP);
        }
        
        // Handle recruitment
        if (choice.recruitNPC && this.context.engine && this.context.engine.inputController) {
            var npc = this.context.npc;
            if (npc && this.context.engine.inputController.recruitUnit(npc)) {
                console.log('[DialogueSystem] Recruited NPC through dialogue:', npc.name);
            }
        }
        
        if (choice.next) {
            this.currentNode = choice.next;
        } else {
            this.advance();
        }
        
        if (this.onChoice) {
            this.onChoice(choiceIndex, choice, this.context);
        }
        
        if (this.onNodeChange) {
            this.onNodeChange(this.currentNode, this.getNode(this.currentNode));
        }
    }
    
    advance() {
        var node = this.getNode(this.currentNode);
        if (!node) {
            this.end();
            return;
        }
        
        if (node.next) {
            this.history.push({ nodeId: this.currentNode });
            this.currentNode = node.next;
            
            if (this.onNodeChange) {
                this.onNodeChange(this.currentNode, this.getNode(this.currentNode));
            }
        } else {
            this.end();
        }
    }
    
    isActive() {
        return this.activeDialogue !== null;
    }
    
    setContextVariable(key, value) {
        this.context[key] = value;
    }
    
    getContextVariable(key) {
        return this.context[key];
    }
    
    getHistory() {
        return this.history.slice();
    }
    
    createSimpleDialogue(id, speaker, lines) {
        var nodes = {};
        for (var i = 0; i < lines.length; i++) {
            nodes[i === 0 ? 'start' : 'node_' + i] = {
                speaker: speaker,
                text: lines[i],
                next: i < lines.length - 1 ? 'node_' + (i + 1) : null
            };
        }
        
        this.registerDialogue(id, { id: id, startNode: 'start', nodes: nodes });
        return id;
    }
    
    createDialogueWithChoices(id, nodes) {
        this.registerDialogue(id, { id: id, startNode: 'start', nodes: nodes });
        return id;
    }
};

console.log('[DialogueSystem] Class loaded');