var RealmKit = RealmKit || {};

RealmKit.EquipmentPanel = class EquipmentPanel {
    constructor(config) {
        this.config = config || {};
        this.visible = false;
        this.equipmentManager = config.equipmentManager || null;
        this.inventoryManager = config.inventoryManager || null;
        this.itemManager = config.itemManager || null;
        
        this.x = config.x || 20;
        this.y = config.y || 80;
        this.width = config.width || 260;
        this.height = config.height || 300;
        this.slotSize = 48;
        this.padding = 8;
        
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        
        this.hoveredSlot = null;
        this.draggedItem = null;
        this.draggedFromSlot = null;
        
        this._boundMouseMove = null;
        this._boundMouseDown = null;
        this._boundClick = null;
        
        this.rarityColors = {
            common: '#aaaaaa',
            uncommon: '#1eff00',
            rare: '#0070dd',
            epic: '#a335ee',
            legendary: '#ff8000'
        };
        
        this.slotNames = {
            head: 'Head',
            chest: 'Chest',
            legs: 'Legs',
            feet: 'Feet',
            mainHand: 'Main Hand',
            offHand: 'Off Hand',
            accessory: 'Accessory'
        };
        
        this.slotPositions = [
            { slot: 'head', col: 0, row: 0 },
            { slot: 'chest', col: 0, row: 1 },
            { slot: 'legs', col: 0, row: 2 },
            { slot: 'feet', col: 0, row: 3 },
            { slot: 'mainHand', col: 1, row: 1 },
            { slot: 'offHand', col: 1, row: 2 },
            { slot: 'accessory', col: 1, row: 3 }
        ];
        
        console.log('[EquipmentPanel] Initialized');
    }
    
    setEquipmentManager(manager) {
        this.equipmentManager = manager;
        this.bindEvents();
    }
    
    setInventoryManager(manager) {
        this.inventoryManager = manager;
    }
    
    setItemManager(manager) {
        this.itemManager = manager;
    }
    
    bindEvents() {
        var self = this;
        if (this.equipmentManager) {
            this.equipmentManager.onEquip = function(item, slot) {
                self.render();
            };
            this.equipmentManager.onUnequip = function(item, slot) {
                self.render();
            };
        }
    }
    
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.visible = true;
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
        this.container.id = 'equipment-panel';
        this.container.style.cssText = 
            'position: fixed;' +
            'top: ' + this.y + 'px;' +
            'left: ' + this.x + 'px;' +
            'width: ' + this.width + 'px;' +
            'background: rgba(20, 20, 30, 0.95);' +
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
        titleBar.innerHTML = '<span style="color:#88ccff;">Equipment</span><span style="cursor:pointer;color:#888;" id="equipment-close-btn">[Esc]</span>';
        this.container.appendChild(titleBar);
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width - this.padding * 2;
        this.canvas.height = 220;
        this.canvas.style.cssText = 
            'display: block;' +
            'border: 1px solid #334455;' +
            'background: #111122;' +
            'border-radius: 4px;';
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
        
        var closeButton = document.getElementById('equipment-close-btn');
        if (closeButton) {
            var self = this;
            closeButton.onclick = function() { self.hide(); };
        }
        
        this._boundMouseMove = this.onMouseMove.bind(this);
        this._boundMouseDown = this.onMouseDown.bind(this);
        this._boundClick = this.onClick.bind(this);
        
        this.canvas.addEventListener('mousemove', this._boundMouseMove);
        this.canvas.addEventListener('mousedown', this._boundMouseDown);
        this.canvas.addEventListener('click', this._boundClick);
        
        document.body.appendChild(this.container);
        this.render();
    }
    
    onMouseDown(e) {
        if (e.button === 2) {
            e.preventDefault();
            this.onRightClick();
            return;
        }
        
        if (e.button === 0 && this.hoveredSlot) {
            this.dragStartSlot = this.hoveredSlot;
        }
    }
    
    onRightClick() {
        if (!this.hoveredSlot) return;
        
        var item = this.equipmentManager ? this.equipmentManager.getItem(this.hoveredSlot) : null;
        
        if (item) {
            var result = this.equipmentManager.unequipToInventory(this.hoveredSlot);
            if (result.success) {
                console.log('[EquipmentPanel] Right-click unequipped', item.name, 'to inventory');
            }
        }
    }
    
    onMouseMove(e) {
        var rect = this.canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;

        this.hoveredSlot = null;

        for (var i = 0, len = this.slotPositions.length; i < len; i++) {
            var pos = this.slotPositions[i];
            var slotX = pos.col * (this.slotSize + this.padding) + this.padding;
            var slotY = pos.row * (this.slotSize + this.padding) + this.padding;

            if (x >= slotX && x < slotX + this.slotSize &&
                y >= slotY && y < slotY + this.slotSize) {
                this.hoveredSlot = pos.slot;
                break;
            }
        }
        
        if (e.buttons === 2 && this.hoveredSlot) {
            this.showContextMenu(this.hoveredSlot, e.clientX, e.clientY);
        }
        
        this.render();
    }
    
    onClick(e) {
        // Already handled by right-click for unequip
    }
    
    onDoubleClick(e) {
        if (!this.hoveredSlot) return;
        
        var item = this.equipmentManager ? this.equipmentManager.getItem(this.hoveredSlot) : null;
        
        if (item) {
            var result = this.equipmentManager.unequipToInventory(this.hoveredSlot);
            if (result.success) {
                console.log('[EquipmentPanel] Double-click unequipped', item.name, 'to inventory');
            }
        }
    }
    
    showContextMenu(slot, x, y) {
        this.hideContextMenu();
        
        var item = this.equipmentManager ? this.equipmentManager.getItem(slot) : null;
        if (!item) return;
        
        var menu = document.createElement('div');
        menu.id = 'equip-context-menu';
        menu.style.cssText = 
            'position: fixed;' +
            'left: ' + x + 'px;' +
            'top: ' + y + 'px;' +
            'background: rgba(20, 20, 35, 0.95);' +
            'border: 1px solid #445566;' +
            'border-radius: 4px;' +
            'padding: 4px 0;' +
            'z-index: 2000;' +
            'font-family: "Press Start 2P", monospace;' +
            'font-size: 9px;' +
            'color: #ccc;';
        
        var self = this;
        
        var unequipOption = document.createElement('div');
        unequipOption.textContent = '  Unequip  ';
        unequipOption.style.cssText = 'padding: 6px 12px; cursor: pointer;';
        unequipOption.onmouseover = function() { this.style.background = '#334455'; };
        unequipOption.onmouseout = function() { this.style.background = 'transparent'; };
        unequipOption.onclick = function() {
            var result = self.equipmentManager.unequipToInventory(slot);
            if (result.success) {
                console.log('[EquipmentPanel] Unequipped', item.name);
            }
            self.hideContextMenu();
            self.render();
        };
        menu.appendChild(unequipOption);
        
        document.body.appendChild(menu);
        this.contextMenu = menu;
        
        setTimeout(function() {
            document.addEventListener('click', function hideMenu() {
                self.hideContextMenu();
                document.removeEventListener('click', hideMenu);
            });
        }, 10);
    }
    
    hideContextMenu() {
        if (this.contextMenu && this.contextMenu.parentNode) {
            this.contextMenu.parentNode.removeChild(this.contextMenu);
        }
        this.contextMenu = null;
    }
    
    render() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (var i = 0, len = this.slotPositions.length; i < len; i++) {
            var pos = this.slotPositions[i];
            this.renderSlot(pos.slot, pos.col, pos.row);
        }
        
        this.renderTooltip();
        
        var stats = this.equipmentManager ? this.equipmentManager.getStatBonuses() : {};
        this.renderStats(stats);
    }
    
    renderSlot(slot, col, row) {
        var x = col * (this.slotSize + this.padding) + this.padding;
        var y = row * (this.slotSize + this.padding) + this.padding;
        
        this.ctx.fillStyle = this.hoveredSlot === slot ? '#334466' : '#223344';
        this.ctx.fillRect(x, y, this.slotSize, this.slotSize);
        
        this.ctx.strokeStyle = this.hoveredSlot === slot ? '#88aacc' : '#445566';
        this.ctx.lineWidth = this.hoveredSlot === slot ? 2 : 1;
        this.ctx.strokeRect(x, y, this.slotSize, this.slotSize);
        
        this.ctx.fillStyle = '#556677';
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        var label = this.slotNames[slot] || slot;
        var words = label.split(' ');
        if (words.length > 1) {
            this.ctx.fillText(words[0], x + this.slotSize/2, y + this.slotSize/2 - 6);
            this.ctx.fillText(words[1], x + this.slotSize/2, y + this.slotSize/2 + 6);
        } else {
            this.ctx.fillText(label, x + this.slotSize/2, y + this.slotSize/2);
        }
        
        var item = this.equipmentManager ? this.equipmentManager.getItem(slot) : null;
        if (item) {
            this.renderItemIcon(item, x, y);
        }
    }
    
    renderItemIcon(item, x, y) {
        var rarityColor = this.rarityColors[item.rarity] || this.rarityColors.common;
        
        this.ctx.fillStyle = rarityColor;
        this.ctx.strokeStyle = rarityColor;
        this.ctx.lineWidth = 2;
        
        var margin = 4;
        this.ctx.beginPath();
        this.ctx.roundRect(x + margin, y + margin, this.slotSize - margin*2, this.slotSize - margin*2, 4);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        var icon = '?';
        if (item.category === 'weapon') icon = item.weaponType === 'bow' ? '🏹' : 
                                                item.weaponType === 'staff' ? '🔮' :
                                                item.weaponType === 'dagger' ? '🗡️' : '⚔️';
        else if (item.category === 'armor') icon = item.slot === 'head' ? '⛑️' :
                                                    item.slot === 'chest' ? '🛡️' : '👟';
        else if (item.category === 'shield') icon = '🔲';
        else if (item.category === 'accessory') icon = '💍';
        else if (item.category === 'focus') icon = '🔮';
        else icon = '📦';
        
        this.ctx.fillText(icon.charAt(0), x + this.slotSize/2, y + this.slotSize/2);
    }
    
    renderTooltip() {
        if (!this.hoveredSlot) return;
        
        var item = this.equipmentManager ? this.equipmentManager.getItem(this.hoveredSlot) : null;
        if (!item) return;
        
        if (!this.itemManager) return;
        
        var desc = this.itemManager.getItemDescription(item);
        var tooltipWidth = 180;
        var lineHeight = 16;
        var tooltipHeight = desc.length * lineHeight + 20;
        
        var tooltipX = this.slotSize * 2 + this.padding * 3;
        var tooltipY = this.padding;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.strokeStyle = '#556677';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
        this.ctx.fill();
        this.ctx.stroke();
        
        for (var i = 0; i < desc.length; i++) {
            var line = desc[i];
            this.ctx.fillStyle = line.color || '#ffffff';
            this.ctx.font = (i === 0 ? 'bold ' : '') + '11px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(line.text, tooltipX + 8, tooltipY + 8 + i * lineHeight);
        }
    }
    
    renderStats(stats) {
        var statsY = this.slotSize * 4 + this.padding * 5;
        
        this.ctx.fillStyle = '#88ccff';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('Stats:', this.padding, statsY);
        
        this.ctx.font = '9px Arial';
        this.ctx.fillStyle = '#aaccdd';
        
        var statLines = [];
        if (stats.attack) statLines.push('Attack: +' + stats.attack);
        if (stats.defense) statLines.push('Defense: +' + stats.defense);
        if (stats.hp) statLines.push('HP: +' + stats.hp);
        if (stats.mp) statLines.push('MP: +' + stats.mp);
        if (stats.speed) statLines.push('Speed: ' + (stats.speed > 0 ? '+' : '') + stats.speed);
        if (stats.critChance) statLines.push('Crit: +' + (stats.critChance * 100).toFixed(0) + '%');
        
        for (var i = 0, len = statLines.length; i < len; i++) {
            this.ctx.fillText(statLines[i], this.padding + 10, statsY + 14 + i * 12);
        }
    }
    
    destroy() {
        if (this._boundMouseMove && this.canvas) {
            this.canvas.removeEventListener('mousemove', this._boundMouseMove);
            this.canvas.removeEventListener('mousedown', this._boundMouseDown);
            this.canvas.removeEventListener('click', this._boundClick);
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this._boundMouseMove = null;
        this._boundMouseDown = null;
        this._boundClick = null;
    }
};

console.log('[EquipmentPanel] Module loaded');