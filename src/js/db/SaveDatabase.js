var RealmKit = RealmKit || {};

/**
 * SaveDatabase — manages save state with split local / cloud strategy.
 *
 * - Anonymous users: saves go to IndexedDB only (local_only)
 * - Authenticated users: saves go to the API (cloud) and are mirrored locally
 *   for offline resilience.
 *
 * The engine calls:
 *   saveDb.save(engine, slot)     — write current state
 *   saveDb.load(storyId, slot)    — read state back
 *   saveDb.listSlots(storyId)     — show save-slot picker UI
 */
RealmKit.SaveDatabase = class SaveDatabase {

    constructor(config) {
        config = config || {};
        this._base     = (config.baseUrl || 'http://localhost:3001/api').replace(/\/$/, '');
        this._userId   = config.userId   || null;
        this._deviceId = config.deviceId || this._getOrCreateDeviceId();
        this._dbName   = 'realmkit_saves';
        this._idb      = null;   // IndexedDB handle, set by _openIDB()
        this._idbReady = this._openIDB();
    }

    // ── Device ID (stable anonymous identifier) ───────────────
    _getOrCreateDeviceId() {
        var key = 'rk_device_id';
        var id  = localStorage.getItem(key);
        if (!id) {
            id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            localStorage.setItem(key, id);
        }
        return id;
    }

    // ── IndexedDB setup ───────────────────────────────────────
    _openIDB() {
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open('realmkit_saves', 1);
            req.onupgradeneeded = function(e) {
                var idb = e.target.result;
                if (!idb.objectStoreNames.contains('saves')) {
                    var store = idb.createObjectStore('saves', { keyPath: 'local_key' });
                    store.createIndex('by_story', 'story_id');
                }
            };
            req.onsuccess = function(e) { resolve(e.target.result); };
            req.onerror   = function(e) { reject(e.target.error); };
        });
    }

    async _idbPut(record) {
        var idb = await this._idbReady;
        return new Promise(function(resolve, reject) {
            var tx    = idb.transaction('saves', 'readwrite');
            var store = tx.objectStore('saves');
            var req   = store.put(record);
            req.onsuccess = function() { resolve(); };
            req.onerror   = function(e) { reject(e.target.error); };
        });
    }

    async _idbGet(key) {
        var idb = await this._idbReady;
        return new Promise(function(resolve, reject) {
            var tx    = idb.transaction('saves', 'readonly');
            var store = tx.objectStore('saves');
            var req   = store.get(key);
            req.onsuccess = function(e) { resolve(e.target.result || null); };
            req.onerror   = function(e) { reject(e.target.error); };
        });
    }

    async _idbGetByStory(storyId) {
        var idb = await this._idbReady;
        return new Promise(function(resolve, reject) {
            var tx    = idb.transaction('saves', 'readonly');
            var store = tx.objectStore('saves');
            var idx   = store.index('by_story');
            var req   = idx.getAll(storyId);
            req.onsuccess = function(e) { resolve(e.target.result || []); };
            req.onerror   = function(e) { reject(e.target.error); };
        });
    }

    _localKey(storyId, slot) {
        return storyId + ':' + slot;
    }

    // ── API helper ────────────────────────────────────────────
    async _req(method, path, body) {
        var url  = this._base + path;
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        try {
            var res  = await fetch(url, opts);
            var data = await res.json();
            if (!res.ok) throw new Error(data.error || 'API error ' + res.status);
            return data;
        } catch (e) {
            console.warn('[SaveDatabase] API unavailable, using local only:', e.message);
            return null;
        }
    }

    // ── Serialize engine state ────────────────────────────────
    _serialize(engine, storyId, slot) {
        var p = engine.player;
        var flags = engine._storyFlags || {};
        var quests = [];
        var objectives = [];

        if (engine.questSystem) {
            var qs = engine.questSystem;
            (qs.activeQuests || []).forEach(function(qid) {
                quests.push({ quest_id: qid, status: 'active' });
            });
            (qs.completedQuests || []).forEach(function(qid) {
                quests.push({ quest_id: qid, status: 'complete' });
            });
        }

        return {
            story_id:         storyId,
            user_id:          this._userId,
            device_id:        this._deviceId,
            slot_number:      slot,
            display_name:     'Slot ' + (slot + 1) + ' — ' + new Date().toLocaleDateString(),
            player_x:         p ? p.x : 0,
            player_y:         p ? p.y : 0,
            player_hp:        p && p.combatStats ? p.combatStats.hp    : 100,
            player_max_hp:    p && p.combatStats ? p.combatStats.maxHp : 100,
            player_gold:      engine.inventoryManager ? engine.inventoryManager.gold : 0,
            player_xp:        0,
            player_level:     1,
            play_time_seconds: Math.floor((Date.now() - (engine.startTime || Date.now())) / 1000),
            sync_status:      this._userId ? 'pending_sync' : 'local_only',
            flags:            flags,
            quest_progress:   quests,
            objective_progress: objectives,
            current_map:      engine.mapId || 'overworld',
            visited_zones:    engine.zoneManager ? Array.from(engine.zoneManager.visitedZones) : []
        };
    }

    // ── Save ──────────────────────────────────────────────────
    async save(engine, storyId, slot) {
        slot = slot || 0;
        var state = this._serialize(engine, storyId, slot);

        // Always write locally first
        await this._idbPut(Object.assign({}, state, { local_key: this._localKey(storyId, slot) }));
        console.log('[SaveDatabase] Local save written — slot', slot);

        // If online and user exists, sync to cloud
        if (this._userId || navigator.onLine) {
            var cloudSave = await this._req('PUT',
                '/saves/story/' + storyId + '/slot/' + slot, state);
            if (cloudSave) {
                console.log('[SaveDatabase] Cloud save synced — slot', slot);
            }
        }

        return state;
    }

    // ── Load ──────────────────────────────────────────────────
    async load(storyId, slot) {
        slot = slot || 0;

        // Try cloud first if user is signed in
        if (this._userId) {
            var cloudSave = await this._req('GET',
                '/saves/story/' + storyId + '?user_id=' + this._userId);
            if (cloudSave && cloudSave.length > 0) {
                var slotSave = cloudSave.find(function(s) { return s.slot_number === slot; });
                if (slotSave) return slotSave;
            }
        }

        // Fall back to local
        return await this._idbGet(this._localKey(storyId, slot));
    }

    // ── List slots (for save picker UI) ──────────────────────
    async listSlots(storyId) {
        var local = await this._idbGetByStory(storyId);

        // Merge with cloud saves if available
        if (this._userId) {
            var cloud = await this._req('GET',
                '/saves/story/' + storyId + '?user_id=' + this._userId);
            if (cloud) {
                // Cloud wins for matching slots
                var merged = {};
                local.forEach(function(s) { merged[s.slot_number] = s; });
                cloud.forEach(function(s) { merged[s.slot_number] = s; });
                return Object.values(merged).sort(function(a, b) { return a.slot_number - b.slot_number; });
            }
        }

        return local.sort(function(a, b) { return a.slot_number - b.slot_number; });
    }

    // ── Apply loaded state back to engine ─────────────────────
    applyToEngine(saveState, engine) {
        if (!saveState) return false;

        if (engine.player) {
            engine.player.x = saveState.player_x || engine.player.x;
            engine.player.y = saveState.player_y || engine.player.y;
            if (engine.player.combatStats) {
                engine.player.combatStats.hp    = saveState.player_hp    || engine.player.combatStats.hp;
                engine.player.combatStats.maxHp = saveState.player_max_hp || engine.player.combatStats.maxHp;
            }
        }

        if (engine.inventoryManager && saveState.player_gold !== undefined) {
            engine.inventoryManager.gold = saveState.player_gold;
        }

        if (saveState.flags) {
            engine._storyFlags = Object.assign({}, saveState.flags);
        }
        
        if (engine.zoneManager && saveState.visited_zones) {
            saveState.visited_zones.forEach(function(zoneId) {
                engine.zoneManager.visitedZones.add(zoneId);
            });
        }
        
        if (saveState.current_map) {
            engine.mapId = saveState.current_map;
        }

        console.log('[SaveDatabase] State applied to engine from slot', saveState.slot_number);
        return true;
    }

    // ── Set user (called after login) ─────────────────────────
    setUser(userId) {
        this._userId = userId;
        console.log('[SaveDatabase] User set:', userId);
    }
};
