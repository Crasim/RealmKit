var RealmKit = RealmKit || {};

RealmKit.PartyManager = class PartyManager {
    constructor(config) {
        this.config = config || {};
        
        this.members = [];
        this.maxMembers = this.config.maxMembers || 4;
        this.leader = null;
        
        this.formation = 'line';
        this.formationSpacing = 50;
        
        this.partyInventory = [];
        this.partyGold = 0;
        
        console.log('[PartyManager] Initialized, maxMembers:', this.maxMembers);
    }
    
    addMember(entity) {
        if (this.members.length >= this.maxMembers) {
            console.warn('[PartyManager] Party is full');
            return false;
        }
        
        if (this.members.indexOf(entity) !== -1) {
            console.warn('[PartyManager] Entity already in party');
            return false;
        }
        
        this.members.push(entity);
        
        if (!this.leader) {
            this.leader = entity;
        }
        
        console.log('[PartyManager] Added member:', entity.id, 'total:', this.members.length);
        return true;
    }
    
    removeMember(entity) {
        var idx = this.members.indexOf(entity);
        if (idx === -1) {
            console.warn('[PartyManager] Entity not in party');
            return false;
        }
        
        this.members.splice(idx, 1);
        
        if (this.leader === entity && this.members.length > 0) {
            this.leader = this.members[0];
        } else if (this.members.length === 0) {
            this.leader = null;
        }
        
        console.log('[PartyManager] Removed member:', entity.id, 'remaining:', this.members.length);
        return true;
    }
    
    setLeader(entity) {
        if (this.members.indexOf(entity) === -1) {
            console.warn('[PartyManager] Cannot set leader: not in party');
            return false;
        }
        
        this.leader = entity;
        console.log('[PartyManager] Leader set to:', entity.id);
        return true;
    }
    
    getFormation() {
        return this.formation;
    }
    
    setFormation(formationType) {
        var validFormations = ['line', 'spread', 'surround'];
        if (validFormations.indexOf(formationType) === -1) {
            console.warn('[PartyManager] Invalid formation:', formationType);
            return false;
        }
        
        this.formation = formationType;
        this.updateFormationPositions();
        console.log('[PartyManager] Formation set to:', formationType);
        return true;
    }
    
    updateFormationPositions() {
        if (!this.leader) return;
        
        for (var i = 0; i < this.members.length; i++) {
            var member = this.members[i];
            if (member === this.leader) continue;
            
            var offset = this.getFormationOffset(i);
            member.formationX = this.leader.x + offset.x;
            member.formationY = this.leader.y + offset.y;
        }
    }
    
    getFormationOffset(memberIndex) {
        var spacing = this.formationSpacing;
        
        if (this.formation === 'line') {
            var leaderIdx = this.members.indexOf(this.leader);
            var relIdx = memberIndex - leaderIdx;
            if (relIdx < 0) relIdx++;
            return { x: 0, y: relIdx * spacing };
        } else if (this.formation === 'spread') {
            var angle = (memberIndex / this.members.length) * Math.PI * 2;
            return {
                x: Math.cos(angle) * spacing,
                y: Math.sin(angle) * spacing
            };
        } else if (this.formation === 'surround') {
            var angle = (memberIndex / this.members.length) * Math.PI * 2;
            return {
                x: Math.cos(angle) * spacing * 1.5,
                y: Math.sin(angle) * spacing * 1.5
            };
        }
        
        return { x: 0, y: 0 };
    }
    
    update(deltaTime) {
        this.updateFormationPositions();
    }
    
    getMembers() {
        return this.members.slice();
    }
    
    getLeader() {
        return this.leader;
    }
    
    getLiveMembers() {
        var alive = [];
        for (var i = 0; i < this.members.length; i++) {
            var member = this.members[i];
            if (member.active && member.combatStats && member.combatStats.hp > 0) {
                alive.push(member);
            }
        }
        return alive;
    }
    
    areAllDead() {
        return this.getLiveMembers().length === 0;
    }
    
    addGold(amount) {
        this.partyGold += amount;
        console.log('[PartyManager] Gold +', amount, 'total:', this.partyGold);
    }
    
    addItem(item) {
        this.partyInventory.push(item);
        console.log('[PartyManager] Item added:', item.id || item.name);
    }
    
    removeItem(itemId) {
        for (var i = 0; i < this.partyInventory.length; i++) {
            if (this.partyInventory[i].id === itemId || this.partyInventory[i].name === itemId) {
                this.partyInventory.splice(i, 1);
                console.log('[PartyManager] Item removed:', itemId);
                return true;
            }
        }
        return false;
    }
    
    recruit(unit, recruiter) {
        if (!unit) {
            console.warn('[PartyManager] Cannot recruit: null unit');
            return false;
        }
        
        if (!unit.recruitable) {
            console.warn('[PartyManager] Cannot recruit: unit is not recruitable');
            return false;
        }
        
        if (this.members.length >= this.maxMembers) {
            console.warn('[PartyManager] Party is full, cannot recruit');
            return false;
        }
        
        // Check faction relation
        var recruiterFaction = recruiter ? recruiter.faction : 'player';
        var relation = this.getFactionRelation(recruiterFaction, unit.faction);
        
        if (relation === 'foe') {
            console.warn('[PartyManager] Cannot recruit: hostile faction');
            return false;
        }
        
        // Change faction to match recruiter
        unit.faction = recruiterFaction;
        unit.originalFaction = unit.faction;
        
        // Make controllable
        unit.controllable = true;
        unit.hasAI = false; // Disable AI when in party
        unit.interactable = false;
        
        // Set up party ID
        var partyId = this.members.length > 0 ? this.members[0].partyId : ('party_' + Date.now());
        unit.partyId = partyId;
        unit.isPartyLeader = false;
        
        var success = this.addMember(unit);
        if (success) {
            this.updateFormationPositions();
            console.log('[PartyManager] Recruited:', unit.name, 'party size:', this.members.length);
        }
        return success;
    }
    
    /**
     * Get faction relation between two factions
     * @param {string} factionA
     * @param {string} factionB
     * @returns {string}
     */
    getFactionRelation(factionA, factionB) {
        if (factionA === factionB) return 'friend';
        
        var relations = {
            player: { friendly: 'friend', neutral: 'neutral', hostile: 'foe', evil: 'foe', wild: 'neutral' },
            friendly: { player: 'friend', neutral: 'neutral', hostile: 'foe', evil: 'foe', wild: 'neutral' },
            neutral: { player: 'neutral', friendly: 'neutral', hostile: 'foe', evil: 'foe', wild: 'neutral' },
            hostile: { player: 'foe', friendly: 'foe', neutral: 'foe', evil: 'friend', wild: 'foe' },
            evil: { player: 'foe', friendly: 'foe', neutral: 'foe', hostile: 'friend', wild: 'foe' },
            wild: { player: 'neutral', friendly: 'neutral', neutral: 'neutral', hostile: 'foe', evil: 'foe' }
        };
        
        return (relations[factionA] && relations[factionA][factionB]) || 'neutral';
    }
    
    dismiss(unit) {
        var idx = this.members.indexOf(unit);
        if (idx === -1) {
            console.warn('[PartyManager] Cannot dismiss: not in party');
            return false;
        }
        
        if (unit === this.leader && this.members.length > 1) {
            console.warn('[PartyManager] Cannot dismiss party leader (switch control first)');
            return false;
        }
        
        // Restore original faction
        if (unit.originalFaction) {
            unit.faction = unit.originalFaction;
        }
        
        // Re-enable AI
        unit.hasAI = true;
        unit.aiBehavior = 'wander';
        unit.controllable = unit.category === 'hero'; // Only heroes stay controllable
        unit.interactable = true;
        unit.partyId = null;
        unit.isPartyLeader = false;
        unit.playerControlled = false;
        
        var success = this.removeMember(unit);
        if (success) {
            console.log('[PartyManager] Dismissed:', unit.name);
        }
        return success;
    }
    
    /**
     * Switch party leader
     * @param {Object} newLeader 
     * @returns {boolean}
     */
    setLeader(newLeader) {
        if (this.members.indexOf(newLeader) === -1) {
            console.warn('[PartyManager] Cannot set leader: not in party');
            return false;
        }
        
        if (this.leader) {
            this.leader.isPartyLeader = false;
            this.leader.playerControlled = false;
        }
        
        this.leader = newLeader;
        this.leader.isPartyLeader = true;
        this.leader.playerControlled = true;
        
        console.log('[PartyManager] Leader set to:', newLeader.name);
        this.updateFormationPositions();
        return true;
    }
};

console.log('[PartyManager] Class loaded');