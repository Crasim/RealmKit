var RealmKit = RealmKit || {};

RealmKit.WebSocketClient = class WebSocketClient {
    constructor(config) {
        config = config || {};
        
        this.url = config.url || null;
        this.autoReconnect = config.autoReconnect !== false;
        this.reconnectDelay = config.reconnectDelay || 3000;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
        this.reconnectAttempts = 0;
        this.binaryMode = config.binaryMode || false;
        
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        
        this._eventHandlers = {};
        this._onceHandlers = {};
        this._messageQueue = [];
        this._lastPing = 0;
        this._latency = 0;
        
        this.state = 'disconnected';
        this.lastError = null;
        
        if (this.url) {
            this.connect();
        }
    }
    
    connect(url) {
        if (url) {
            this.url = url;
        }
        
        if (!this.url) {
            console.error('[WebSocketClient] No URL provided');
            return false;
        }
        
        if (this.connecting || this.connected) {
            console.warn('[WebSocketClient] Already connected or connecting');
            return false;
        }
        
        this.connecting = true;
        this.state = 'connecting';
        this.lastError = null;
        
        var self = this;
        
        try {
            this.socket = new WebSocket(this.url, this.binaryMode ? 'binary' : undefined);
            
            this.socket.onopen = function(event) {
                self.connected = true;
                self.connecting = false;
                self.state = 'connected';
                self.reconnectAttempts = 0;
                self._lastPing = Date.now();
                
                console.log('[WebSocketClient] Connected to ' + self.url);
                
                self._flushMessageQueue();
                self._emit('connect', { url: self.url });
            };
            
            this.socket.onclose = function(event) {
                self.connected = false;
                self.connecting = false;
                self.state = 'disconnected';
                
                var reason = event.reason || 'Connection closed';
                var code = event.code;
                
                console.log('[WebSocketClient] Disconnected: ' + reason + ' (code: ' + code + ')');
                
                self._emit('disconnect', { code: code, reason: reason });
                
                if (self.autoReconnect && self.reconnectAttempts < self.maxReconnectAttempts) {
                    self._scheduleReconnect();
                }
            };
            
            this.socket.onerror = function(error) {
                self.lastError = error;
                self.connecting = false;
                
                console.error('[WebSocketClient] Error:', error);
                
                self._emit('error', { error: error });
            };
            
            this.socket.onmessage = function(event) {
                self._handleMessage(event.data);
            };
            
            return true;
        } catch (e) {
            console.error('[WebSocketClient] Failed to create socket:', e);
            this.lastError = e;
            this.connecting = false;
            this.state = 'error';
            return false;
        }
    }
    
    disconnect() {
        this.autoReconnect = false;
        
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        
        this.connected = false;
        this.connecting = false;
        this.state = 'disconnected';
        this._emit('disconnect', { code: 1000, reason: 'Client disconnect' });
    }
    
    send(type, data) {
        var message = {
            type: type,
            data: data || {},
            ts: Date.now()
        };
        
        return this._sendRaw(message);
    }
    
    sendRaw(data) {
        return this._sendRaw(data);
    }
    
    _sendRaw(message) {
        if (!this.connected) {
            this._messageQueue.push(message);
            return false;
        }
        
        try {
            var payload;
            
            if (this.binaryMode) {
                payload = this._encodeBinary(message);
            } else {
                payload = JSON.stringify(message);
            }
            
            this.socket.send(payload);
            return true;
        } catch (e) {
            console.error('[WebSocketClient] Send error:', e);
            return false;
        }
    }
    
    _flushMessageQueue() {
        while (this._messageQueue.length > 0 && this.connected) {
            var message = this._messageQueue.shift();
            this._sendRaw(message);
        }
    }
    
    _handleMessage(rawData) {
        var message;
        
        try {
            if (this.binaryMode) {
                message = this._decodeBinary(rawData);
            } else {
                message = JSON.parse(rawData);
            }
        } catch (e) {
            console.error('[WebSocketClient] Failed to parse message:', e);
            this._emit('error', { error: e, raw: rawData });
            return;
        }
        
        var type = message.type || 'message';
        var data = message.data || message;
        
        if (type === 'pong') {
            this._latency = Date.now() - this._lastPing;
            return;
        }
        
        if (type === 'ping') {
            this.send('pong', {});
            return;
        }
        
        this._emit(type, data);
        this._emit('message', { type: type, data: data });
    }
    
    _encodeBinary(message) {
        var json = JSON.stringify(message);
        var buffer = new ArrayBuffer(json.length * 2);
        var view = new Uint16Array(buffer);
        
        for (var i = 0; i < json.length; i++) {
            view[i] = json.charCodeAt(i);
        }
        
        return buffer;
    }
    
    _decodeBinary(buffer) {
        var view = new Uint16Array(buffer);
        var chars = [];
        
        for (var i = 0; i < view.length; i++) {
            chars.push(String.fromCharCode(view[i]));
        }
        
        return JSON.parse(chars.join(''));
    }
    
    on(event, handler) {
        if (!this._eventHandlers[event]) {
            this._eventHandlers[event] = [];
        }
        this._eventHandlers[event].push(handler);
        return this;
    }
    
    once(event, handler) {
        if (!this._onceHandlers[event]) {
            this._onceHandlers[event] = [];
        }
        this._onceHandlers[event].push(handler);
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
                    console.error('[WebSocketClient] Handler error:', e);
                }
            }
        }
        
        var onceHandlers = this._onceHandlers[event];
        if (onceHandlers) {
            delete this._onceHandlers[event];
            for (var j = 0; j < onceHandlers.length; j++) {
                try {
                    onceHandlers[j](data);
                } catch (e) {
                    console.error('[WebSocketClient] Once handler error:', e);
                }
            }
        }
    }
    
    _scheduleReconnect() {
        this.reconnectAttempts++;
        this.state = 'reconnecting';
        
        var delay = this.reconnectDelay * this.reconnectAttempts;
        
        console.log('[WebSocketClient] Reconnecting in ' + delay + 'ms (attempt ' + this.reconnectAttempts + '/' + this.maxReconnectAttempts + ')');
        
        var self = this;
        setTimeout(function() {
            if (!self.connected && !self.connecting) {
                self.connect();
            }
        }, delay);
    }
    
    ping() {
        if (!this.connected) {
            return -1;
        }
        
        this._lastPing = Date.now();
        this.send('ping', {});
        return this._lastPing;
    }
    
    getLatency() {
        return this._latency;
    }
    
    getState() {
        return this.state;
    }
    
    isConnected() {
        return this.connected;
    }
    
    getQueueLength() {
        return this._messageQueue.length;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealmKit.WebSocketClient;
}