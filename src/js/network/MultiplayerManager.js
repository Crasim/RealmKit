var RealmKit = RealmKit || {};

RealmKit.MultiplayerManager = class MultiplayerManager {
    constructor(config) {
        config = config || {};
        
        this.client = config.client || null;
        this.playerId = config.playerId || null;
        this.playerName = config.playerName || 'Player';
        this.roomId = config.roomId || null;
        this.zoneId = config.zoneId || null;
        
        this.players = {};
        this.entities = {};
        this.events = {};
        
        this.pendingActions = [];
        this.serverState = {};
        this.lastSyncTime = 0;
        this.syncInterval = config.syncInterval || 50;
        
        this.interpolationBuffer = {};
        this.interpolationDelay = config.interpolationDelay || 100;
        
        this.predictedStates = {};
        this.unconfirmedInputs = [];
        
        this._entityHandlers = {};
        this._eventHandlers = {};
        
        if (this.client) {
            this._setupClientHandlers();
        }
    }
    
    setClient(client) {
        this.client = client;
        this._setupClientHandlers();
    }
    
    _setupClientHandlers() {
        var self = this;
        
        this.client.on('connect', function(data) {
            self._onConnect(data);
        });
        
        this.client.on('disconnect', function(data) {
            self._onDisconnect(data);
        });
        
        this.client.on('player_join', function(data) {
            self._onPlayerJoin(data);
        });
        
        this.client.on('player_leave', function(data) {
            self._onPlayerLeave(data);
        });
        
        this.client.on('player_sync', function(data) {
            self._onPlayerSync(data);
        });
        
        this.client.on('entity_sync', function(data) {
            self._onEntitySync(data);
        });
        
        this.client.on('room_state', function(data) {
            self._onRoomState(data);
        });
        
        this.client.on('chat', function(data) {
            self._onChat(data);
        });
        
        this.client.on('error', function(data) {
            self._onError(data);
        });
    }
    
    connect(url, playerName) {
        if (playerName) {
            this.playerName = playerName;
        }
        
        if (!this.client) {
            this.client = new RealmKit.WebSocketClient({ url: url });
        } else if (url) {
            this.client.connect(url);
        }
    }
    
    disconnect() {
        if (this.client) {
            this.client.disconnect();
        }
        
        this.players = {};
        this.entities = {};
        this.serverState = {};
    }
    
    joinRoom(roomId, zoneId) {
        this.roomId = roomId;
        this.zoneId = zoneId;
        
        this.client.send('join_room', {
            playerId: this.playerId,
            playerName: this.playerName,
            roomId: roomId,
            zoneId: zoneId
        });
    }
    
    leaveRoom() {
        if (this.roomId) {
            this.client.send('leave_room', {
                playerId: this.playerId,
                roomId: this.roomId
            });
            
            this.roomId = null;
            this.zoneId = null;
            this.players = {};
            this.entities = {};
        }
    }
    
    sendChat(message, channel) {
        channel = channel || 'global';
        
        this.client.send('chat', {
            playerId: this.playerId,
            playerName: this.playerName,
            message: message,
            channel: channel,
            roomId: this.roomId
        });
    }
    
    syncPlayerState(player) {
        if (!this.client || !this.client.isConnected()) {
            return false;
        }
        
        var now = Date.now();
        if (now - this.lastSyncTime < this.syncInterval) {
            return false;
        }
        
        this.lastSyncTime = now;
        
        var state = {
            x: player.x,
            y: player.y,
            vx: player.vx || 0,
            vy: player.vy || 0,
            facing: player.facing || 'down',
            state: player.state || 'idle',
            animFrame: player.animFrame || 0,
            hp: player.hp,
            mp: player.mp
        };
        
        this.unconfirmedInputs.push({
            seq: this.unconfirmedInputs.length,
            state: state,
            ts: now
        });
        
        this.client.send('player_sync', {
            playerId: this.playerId,
            state: state
        });
        
        return true;
    }
    
    getInterpolatedPosition(entityId, now) {
        var buffer = this.interpolationBuffer[entityId];
        if (!buffer || buffer.length < 2) {
            return null;
        }
        
        var renderTime = now - this.interpolationDelay;
        
        for (var i = 0; i < buffer.length - 1; i++) {
            var a = buffer[i];
            var b = buffer[i + 1];
            
            if (renderTime >= a.ts && renderTime <= b.ts) {
                var t = (renderTime - a.ts) / (b.ts - a.ts);
                
                return {
                    x: a.x + (b.x - a.x) * t,
                    y: a.y + (b.y - a.y) * t,
                    facing: b.facing,
                    state: b.state
                };
            }
        }
        
        var latest = buffer[buffer.length - 1];
        return {
            x: latest.x,
            y: latest.y,
            facing: latest.facing,
            state: latest.state
        };
    }
    
    _addToInterpolationBuffer(entityId, state) {
        if (!this.interpolationBuffer[entityId]) {
            this.interpolationBuffer[entityId] = [];
        }
        
        this.interpolationBuffer[entityId].push({
            x: state.x,
            y: state.y,
            facing: state.facing,
            state: state.state,
            ts: Date.now()
        });
        
        while (this.interpolationBuffer[entityId].length > 10) {
            this.interpolationBuffer[entityId].shift();
        }
    }
    
    reconcileStates() {
        if (this.unconfirmedInputs.length === 0) {
            return;
        }
        
        var lastConfirmed = -1;
        
        for (var i = 0; i < this.unconfirmedInputs.length; i++) {
            var pending = this.unconfirmedInputs[i];
            
            if (pending.seq <= (this.serverState.lastProcessedSeq || -1)) {
                lastConfirmed = i;
            }
        }
        
        if (lastConfirmed >= 0) {
            this.unconfirmedInputs.splice(0, lastConfirmed + 1);
        }
    }
    
    _onConnect(data) {
        this._emit('connect', data);
    }
    
    _onDisconnect(data) {
        this.players = {};
        this.entities = {};
        this._emit('disconnect', data);
    }
    
    _onPlayerJoin(data) {
        if (data.playerId !== this.playerId) {
            this.players[data.playerId] = {
                id: data.playerId,
                name: data.playerName,
                x: data.x || 0,
                y: data.y || 0,
                state: 'idle',
                lastUpdate: Date.now()
            };
        }
        
        this._emit('player_join', data);
    }
    
    _onPlayerLeave(data) {
        delete this.players[data.playerId];
        delete this.interpolationBuffer[data.playerId];
        this._emit('player_leave', data);
    }
    
    _onPlayerSync(data) {
        if (data.playerId === this.playerId) {
            this.serverState = data;
            this.serverState.lastProcessedSeq = data.seq;
            this.reconcileStates();
            return;
        }
        
        if (this.players[data.playerId]) {
            this.players[data.playerId].x = data.state.x;
            this.players[data.playerId].y = data.state.y;
            this.players[data.playerId].facing = data.state.facing;
            this.players[data.playerId].state = data.state.state;
            this.players[data.playerId].lastUpdate = Date.now();
        }
        
        this._addToInterpolationBuffer(data.playerId, data.state);
        this._emit('player_update', data);
    }
    
    _onEntitySync(data) {
        for (var i = 0; i < data.entities.length; i++) {
            var entity = data.entities[i];
            this.entities[entity.id] = entity;
        }
        
        this._emit('entity_update', data);
    }
    
    _onRoomState(data) {
        this.roomId = data.roomId;
        this.zoneId = data.zoneId;
        
        for (var playerId in data.players) {
            if (data.players.hasOwnProperty(playerId) && playerId !== this.playerId) {
                this.players[playerId] = data.players[playerId];
            }
        }
        
        this._emit('room_state', data);
    }
    
    _onChat(data) {
        this._emit('chat', data);
    }
    
    _onError(data) {
        this._emit('error', data);
    }
    
    on(event, handler) {
        if (!this._eventHandlers[event]) {
            this._eventHandlers[event] = [];
        }
        this._eventHandlers[event].push(handler);
        return this;
    }
    
    off(event, handler) {
        if (this._eventHandlers[event]) {
            var idx = this._eventHandlers[event].indexOf(handler);
            if (idx !== -1) {
                this._eventHandlers[event].splice(idx, 1);
            }
        }
        return this;
    }
    
    _emit(event, data) {
        var handlers = this._eventHandlers[event];
        if (handlers) {
            for (var i = 0; i < handlers.length; i++) {
                try {
                    handlers[i](data);
                } catch (e) {
                    console.error('[MultiplayerManager] Handler error:', e);
                }
            }
        }
    }
    
    setEntityHandler(entityId, handler) {
        this._entityHandlers[entityId] = handler;
    }
    
    removeEntityHandler(entityId) {
        delete this._entityHandlers[entityId];
    }
    
    getPlayer(id) {
        return this.players[id] || null;
    }
    
    getEntity(id) {
        return this.entities[id] || null;
    }
    
    getAllPlayers() {
        var result = [];
        for (var id in this.players) {
            if (this.players.hasOwnProperty(id)) {
                result.push(this.players[id]);
            }
        }
        return result;
    }
    
    getAllEntities() {
        var result = [];
        for (var id in this.entities) {
            if (this.entities.hasOwnProperty(id)) {
                result.push(this.entities[id]);
            }
        }
        return result;
    }
    
    isOurPlayer(playerId) {
        return playerId === this.playerId;
    }
    
    getOtherPlayers() {
        var result = [];
        for (var id in this.players) {
            if (this.players.hasOwnProperty(id) && id !== this.playerId) {
                result.push(this.players[id]);
            }
        }
        return result;
    }
    
    updateEntityLocalState(entityId, state) {
        if (!this.entities[entityId]) {
            this.entities[entityId] = { id: entityId };
        }
        
        for (var key in state) {
            if (state.hasOwnProperty(key)) {
                this.entities[entityId][key] = state[key];
            }
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealmKit.MultiplayerManager;
}