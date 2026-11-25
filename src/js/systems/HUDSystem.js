var RealmKit = RealmKit || {};

RealmKit.HUDSystem = class HUDSystem {
    constructor(config) {
        this.config = config || {};
        
        this.elements = new Map();
        this.container = null;
        
        this.dirty = true;
        
        console.log('[HUDSystem] Initialized');
    }
    
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[HUDSystem] Container not found:', containerId);
            return false;
        }
        
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.zIndex = '200';
        
        console.log('[HUDSystem] Container initialized');
        return true;
    }
    
    addHealthBar(entityId, options) {
        options = options || {};
        
        var element = {
            type: 'healthbar',
            entityId: entityId,
            x: options.x || 0,
            y: options.y || 0,
            width: options.width || 100,
            height: options.height || 10,
            bgColor: options.bgColor || '#333',
            fgColor: options.fgColor || '#4ecca3',
            lowColor: options.lowColor || '#ff4444',
            lowThreshold: options.lowThreshold || 0.3,
            borderColor: options.borderColor || '#222',
            showText: options.showText || false,
            followEntity: options.followEntity !== false,
            offset: options.offset || { x: 0, y: -20 },
            
            current: options.current || 100,
            max: options.max || 100,
            
            element: null
        };
        
        var div = document.createElement('div');
        div.id = 'hud_healthbar_' + entityId;
        div.style.position = 'absolute';
        div.style.width = element.width + 'px';
        div.style.height = element.height + 'px';
        div.style.backgroundColor = element.bgColor;
        div.style.border = '1px solid ' + element.borderColor;
        div.style.borderRadius = '3px';
        
        var fill = document.createElement('div');
        fill.style.width = '100%';
        fill.style.height = '100%';
        fill.style.backgroundColor = element.fgColor;
        fill.style.borderRadius = '2px';
        fill.style.transition = 'width 0.2s, background-color 0.3s';
        
        div.appendChild(fill);
        element.fillElement = fill;
        
        if (element.showText) {
            var text = document.createElement('span');
            text.style.position = 'absolute';
            text.style.top = '50%';
            text.style.left = '50%';
            text.style.transform = 'translate(-50%, -50%)';
            text.style.color = '#fff';
            text.style.fontSize = '10px';
            text.style.fontFamily = 'monospace';
            text.style.textShadow = '1px 1px 1px #000';
            div.appendChild(text);
            element.textElement = text;
        }
        
        this.container.appendChild(div);
        element.element = div;
        
        this.elements.set(entityId + '_health', element);
        
        console.log('[HUDSystem] Added health bar for:', entityId);
        return element;
    }
    
    updateHealthBar(entityId, current, max) {
        var key = entityId + '_health';
        var element = this.elements.get(key);
        
        if (!element) return;
        
        element.current = current;
        element.max = max;
        
        var percent = Math.max(0, Math.min(1, current / max));
        
        element.fillElement.style.width = (percent * 100) + '%';
        
        if (percent < element.lowThreshold) {
            element.fillElement.style.backgroundColor = element.lowColor;
        } else {
            element.fillElement.style.backgroundColor = element.fgColor;
        }
        
        if (element.textElement) {
            element.textElement.textContent = Math.round(current) + '/' + max;
        }
        
        this.dirty = true;
    }
    
    positionHealthBar(entityId, screenX, screenY) {
        var key = entityId + '_health';
        var element = this.elements.get(key);
        
        if (!element || !element.followEntity) return;
        
        var x = screenX + element.offset.x - element.width / 2;
        var y = screenY + element.offset.y - element.height / 2;
        
        element.element.style.left = x + 'px';
        element.element.style.top = y + 'px';
    }
    
    addText(id, options) {
        options = options || {};
        
        var element = {
            type: 'text',
            id: id,
            x: options.x || 10,
            y: options.y || 10,
            text: options.text || '',
            color: options.color || '#fff',
            font: options.font || '14px monospace',
            align: options.align || 'left',
            
            element: null
        };
        
        var div = document.createElement('div');
        div.id = 'hud_text_' + id;
        div.style.position = 'absolute';
        div.style.left = element.x + 'px';
        div.style.top = element.y + 'px';
        div.style.color = element.color;
        div.style.font = element.font;
        div.style.textAlign = element.align;
        div.style.textShadow = '1px 1px 2px #000';
        div.style.whiteSpace = 'nowrap';
        div.style.pointerEvents = 'none';
        div.textContent = element.text;
        
        this.container.appendChild(div);
        element.element = div;
        
        this.elements.set(id, element);
        return element;
    }
    
    updateText(id, text) {
        var element = this.elements.get(id);
        if (!element) return;
        
        element.text = text;
        element.element.textContent = text;
        this.dirty = true;
    }
    
    addButton(id, options) {
        options = options || {};
        
        var element = {
            type: 'button',
            id: id,
            x: options.x || 0,
            y: options.y || 0,
            width: options.width || 80,
            height: options.height || 30,
            text: options.text || 'Button',
            onClick: options.onClick || null,
            
            element: null
        };
        
        var button = document.createElement('button');
        button.id = 'hud_button_' + id;
        button.style.position = 'absolute';
        button.style.left = element.x + 'px';
        button.style.top = element.y + 'px';
        button.style.width = element.width + 'px';
        button.style.height = element.height + 'px';
        button.style.backgroundColor = '#333';
        button.style.color = '#fff';
        button.style.border = '1px solid #555';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.pointerEvents = 'auto';
        button.textContent = element.text;
        
        if (element.onClick) {
            button.addEventListener('click', element.onClick);
        }
        
        this.container.appendChild(button);
        element.element = button;
        
        this.elements.set(id, element);
        return element;
    }
    
    addInventorySlot(id, options) {
        options = options || {};
        
        var element = {
            type: 'inventory_slot',
            id: id,
            x: options.x || 0,
            y: options.y || 0,
            size: options.size || 40,
            item: options.item || null,
            quantity: options.quantity || 0,
            
            element: null,
            iconElement: null,
            countElement: null
        };
        
        var slot = document.createElement('div');
        slot.id = 'hud_slot_' + id;
        slot.style.position = 'absolute';
        slot.style.left = element.x + 'px';
        slot.style.top = element.y + 'px';
        slot.style.width = element.size + 'px';
        slot.style.height = element.size + 'px';
        slot.style.backgroundColor = '#222';
        slot.style.border = '2px solid #555';
        slot.style.borderRadius = '4px';
        slot.style.pointerEvents = 'auto';
        
        var icon = document.createElement('div');
        icon.style.width = '100%';
        icon.style.height = '100%';
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.fontSize = '12px';
        icon.style.color = '#fff';
        slot.appendChild(icon);
        
        var count = document.createElement('span');
        count.style.position = 'absolute';
        count.style.bottom = '2px';
        count.style.right = '2px';
        count.style.color = '#fff';
        count.style.fontSize = '10px';
        count.style.fontFamily = 'monospace';
        count.style.textShadow = '1px 1px 1px #000';
        count.style.display = 'none';
        slot.appendChild(count);
        
        this.container.appendChild(slot);
        element.element = slot;
        element.iconElement = icon;
        element.countElement = count;
        
        this.elements.set(id, element);
        return element;
    }
    
    setInventoryItem(id, item, quantity) {
        var element = this.elements.get(id);
        if (!element) return;
        
        element.item = item;
        element.quantity = quantity || (item ? 1 : 0);
        
        if (element.item) {
            element.iconElement.textContent = element.item.icon || '?';
            if (element.quantity > 1) {
                element.countElement.textContent = element.quantity;
                element.countElement.style.display = 'block';
            } else {
                element.countElement.style.display = 'none';
            }
        } else {
            element.iconElement.textContent = '';
            element.countElement.style.display = 'none';
        }
    }
    
    remove(id) {
        var element = this.elements.get(id);
        if (!element) return;
        
        if (element.element && element.element.parentNode) {
            element.element.parentNode.removeChild(element.element);
        }
        
        this.elements.delete(id);
    }
    
    createCombatLog(options) {
        options = options || {};
        var headless = !!options.headless;
        
        var log = {
            type: 'combatlog',
            maxEntries: options.maxEntries || 8,
            entries: [],
            element: null,
            entriesDiv: null,
            headless: headless
        };

        if (!headless) {
            var container = document.createElement('div');
            container.id = 'hud_combatlog';
            container.style.cssText = 'position:absolute;bottom:90px;left:10px;width:280px;height:100px;' +
                'background:rgba(0,0,0,0.7);border:1px solid #444;border-radius:5px;' +
                'padding:6px;overflow-y:auto;font-family:monospace;font-size:10px;color:#fff;' +
                'pointer-events:none;z-index:100;';

            var title = document.createElement('div');
            title.style.cssText = 'font-weight:bold;color:#4ecdc4;margin-bottom:5px;border-bottom:1px solid #333;padding-bottom:3px;';
            title.textContent = 'Combat Log';
            container.appendChild(title);

            var entriesDiv = document.createElement('div');
            entriesDiv.className = 'combat-log-entries';
            container.appendChild(entriesDiv);

            log.entriesDiv = entriesDiv;
            log.element = container;
        }
        
        this.elements.set('combatlog', log);
        
        if (!headless && this.container && log.element) {
            this.container.appendChild(log.element);
        }
        
        console.log('[HUDSystem] Created combat log');
        return log;
    }
    
    addCombatLogEntry(message, type) {
        var log = this.elements.get('combatlog');
        if (!log) {
            log = this.createCombatLog({
                headless: !!document.getElementById('rgui-root')
            });
        }
        
        var entry = {
            message: message,
            type: type || 'info',
            time: new Date().toLocaleTimeString()
        };
        
        log.entries.push(entry);
        
        if (log.entries.length > log.maxEntries) {
            log.entries.shift();
            if (log.entriesDiv && log.entriesDiv.firstChild) {
                log.entriesDiv.removeChild(log.entriesDiv.firstChild);
            }
        }

        if (log.entriesDiv) {
            var entryDiv = document.createElement('div');
            entryDiv.style.marginBottom = '2px';

            var color = '#fff';
            if (type === 'damage') color = '#ff6666';
            else if (type === 'heal') color = '#66ff66';
            else if (type === 'kill') color = '#ff8800';
            else if (type === 'player') color = '#4ecdc4';
            else if (type === 'gold') color = '#ffd700';
            else if (type === 'item') color = '#88ccff';
            else if (type === 'warning') color = '#ffaa00';
            else if (type === 'xp_gain') color = '#aa88ff';

            entryDiv.style.color = color;
            entryDiv.textContent = entry.time + ' ' + message;

            log.entriesDiv.appendChild(entryDiv);
        }
        
        return entry;
    }
    
    clear() {
        this.elements.forEach(function(element, id) {
            if (element.element && element.element.parentNode) {
                element.element.parentNode.removeChild(element.element);
            }
        });
        
        this.elements.clear();
        this.dirty = true;
    }
    
    render() {
    }
    
    resize() {
        this.dirty = true;
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }
};

console.log('[HUDSystem] Class loaded');
