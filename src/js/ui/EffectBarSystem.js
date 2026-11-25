var RealmKit = RealmKit || {};

RealmKit.EffectBarSystem = class EffectBarSystem {
    constructor(config) {
        this.config = config || {};
        
        this.activeEffects = new Map();
        
        this.barWidth = this.config.barWidth || 50;
        this.barHeight = this.config.barHeight || 4;
        this.barSpacing = this.config.barSpacing || 6;
        this.showIcon = this.config.showIcon !== false;
        this.showTimer = this.config.showTimer !== false;
        
        console.log('[EffectBarSystem] Initialized');
    }
    
    addEffect(entityId, effectId, displayName, duration, type, iconColor) {
        var key = entityId + '_' + effectId;
        
        this.activeEffects.set(key, {
            entityId: entityId,
            effectId: effectId,
            displayName: displayName || effectId,
            duration: duration,
            remaining: duration,
            startTime: Date.now(),
            type: type || 'buff',
            iconColor: iconColor || (type === 'debuff' ? '#ff4444' : '#44ff44'),
            stacks: 1
        });
        
        console.log('[EffectBarSystem] Added effect:', effectId, 'to entity:', entityId);
        return key;
    }
    
    removeEffect(entityId, effectId) {
        var key = entityId + '_' + effectId;
        return this.activeEffects.delete(key);
    }
    
    updateEffect(entityId, effectId, remaining) {
        var key = entityId + '_' + effectId;
        var effect = this.activeEffects.get(key);
        
        if (effect) {
            effect.remaining = remaining;
            return true;
        }
        return false;
    }
    
    stackEffect(entityId, effectId, duration) {
        var key = entityId + '_' + effectId;
        var effect = this.activeEffects.get(key);
        
        if (effect) {
            effect.stacks++;
            effect.remaining = Math.max(effect.remaining, duration);
            return true;
        }
        return false;
    }
    
    update(deltaTime) {
        var self = this;
        this.activeEffects.forEach(function(effect, key) {
            effect.remaining -= deltaTime;
            
            if (effect.remaining <= 0) {
                self.activeEffects.delete(key);
            }
        });
    }
    
    getEffectsForEntity(entityId) {
        var list = [];
        this.activeEffects.forEach(function(effect, key) {
            if (effect.entityId === entityId) {
                list.push({
                    id: effect.effectId,
                    name: effect.displayName,
                    remaining: effect.remaining,
                    duration: effect.duration,
                    progress: effect.remaining / effect.duration,
                    type: effect.type,
                    stacks: effect.stacks
                });
            }
        });
        return list;
    }
    
    render(ctx, entity, x, y) {
        if (!entity || !entity.id) return 0;
        
        var effects = this.getEffectsForEntity(entity.id);
        if (effects.length === 0) return 0;
        
        effects.sort(function(a, b) {
            if (a.type === 'debuff' && b.type !== 'debuff') return 1;
            if (a.type !== 'debuff' && b.type === 'debuff') return -1;
            return b.remaining - a.remaining;
        });
        
        ctx.save();
        
        var offsetY = 0;
        var spacing = this.barHeight + 2;
        
        for (var i = 0; i < effects.length && i < 5; i++) {
            var effect = effects[i];
            
            var barX = x - this.barWidth / 2;
            var barY = y + offsetY;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, this.barWidth, this.barHeight);
            
            var progress = Math.max(0, effect.progress);
            var fillColor = effect.type === 'debuff' ? '#ff6644' : '#44aa88';
            ctx.fillStyle = fillColor;
            ctx.fillRect(barX, barY, this.barWidth * progress, this.barHeight);
            
            ctx.strokeStyle = effect.type === 'debuff' ? '#aa4422' : '#228866';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, this.barWidth, this.barHeight);
            
            if (this.showTimer) {
                var seconds = Math.ceil(effect.remaining / 1000);
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px monospace';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(seconds + 's', barX + this.barWidth - 2, barY + this.barHeight / 2);
            }
            
            if (effect.stacks > 1) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText('x' + effect.stacks, barX + 2, barY + this.barHeight / 2);
            }
            
            offsetY += spacing;
        }
        
        ctx.restore();
        
        return offsetY;
    }
    
    renderAboveHead(ctx, entity) {
        if (!entity) return;
        
        var barY = entity.y - (entity.height || 32) - 10;
        this.render(ctx, entity, entity.x, barY);
    }
    
    clear() {
        this.activeEffects.clear();
    }
    
    serialize() {
        var data = [];
        this.activeEffects.forEach(function(effect) {
            data.push({
                entityId: effect.entityId,
                effectId: effect.effectId,
                displayName: effect.displayName,
                remaining: effect.remaining,
                duration: effect.duration,
                type: effect.type,
                stacks: effect.stacks
            });
        });
        return JSON.stringify(data);
    }
    
    deserialize(json) {
        try {
            var data = JSON.parse(json);
            this.clear();
            
            for (var i = 0; i < data.length; i++) {
                var effect = data[i];
                this.addEffect(
                    effect.entityId,
                    effect.effectId,
                    effect.displayName,
                    effect.duration,
                    effect.type
                );
                this.updateEffect(effect.entityId, effect.effectId, effect.remaining);
                if (effect.stacks > 1) {
                    for (var j = 1; j < effect.stacks; j++) {
                        this.stackEffect(effect.entityId, effect.effectId, effect.duration);
                    }
                }
            }
            
            console.log('[EffectBarSystem] Loaded', data.length, 'effects');
            return true;
        } catch (e) {
            console.error('[EffectBarSystem] Load failed:', e);
            return false;
        }
    }
};

console.log('[EffectBarSystem] Class loaded');