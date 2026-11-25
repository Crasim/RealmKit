var RealmKit = RealmKit || {};

/**
 * StoryDatabase — client-side wrapper for the RealmKit API.
 *
 * Handles all story content: listing, loading, authoring.
 * Save state is handled separately by RealmKit.SaveDatabase.
 *
 * Usage:
 *   var db = new RealmKit.StoryDatabase({ baseUrl: 'http://localhost:3001/api' });
 *   db.listStories().then(function(stories) { ... });
 */
RealmKit.StoryDatabase = class StoryDatabase {

    constructor(config) {
        config = config || {};
        var defaultBase = '/RealmKit/api';
        if (typeof window !== 'undefined' && window.location && window.location.pathname) {
            var basePath = window.location.pathname.replace(/\/[^\/]*$/, '');
            defaultBase = basePath + '/api';
        }
        this._base = (config.baseUrl || defaultBase).replace(/\/$/, '');
        // In-memory cache so the engine doesn't re-fetch on every scene load
        this._cache = {};
    }

    // ── Internal fetch helper ────────────────────────────────
    async _req(method, path, body) {
        var url = this._base + path;
        var opts = {
            method:  method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) opts.body = JSON.stringify(body);
        var res = await fetch(url, opts);
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed: ' + res.status);
        return data;
    }

    // ── Stories ──────────────────────────────────────────────
    listStories(includeUnpublished) {
        var path = '/stories';
        if (includeUnpublished) {
            path += '?include_unpublished=1';
        }
        return this._req('GET', path);
    }

    /**
     * Load a full story including engine config, factions, and flags.
     * Result is cached so subsequent calls within a session are instant.
     */
    async loadStory(id) {
        if (this._cache[id]) return this._cache[id];
        var story = await this._req('GET', '/stories/' + id);
        this._cache[id] = story;
        return story;
    }

    createStory(data) {
        this._cache = {};
        return this._req('POST', '/stories', data);
    }

    updateStory(id, data) {
        delete this._cache[id];
        return this._req('PATCH', '/stories/' + id, data);
    }

    deleteStory(id) {
        delete this._cache[id];
        return this._req('DELETE', '/stories/' + id);
    }

    publishStory(id, userId) {
        return this._req('POST', '/stories/' + id + '/publish', { user_id: userId });
    }

    // ── Engine config ────────────────────────────────────────
    updateEngineConfig(storyId, config) {
        delete this._cache[storyId];
        return this._req('PUT', '/stories/' + storyId + '/engine-config', config);
    }

    updateUiConfig(storyId, config) {
        delete this._cache[storyId];
        return this._req('PUT', '/stories/' + storyId + '/ui-config', config);
    }

    // ── Flag definitions ─────────────────────────────────────
    getFlags(storyId) {
        return this._req('GET', '/stories/' + storyId + '/flags');
    }

    createFlag(storyId, flag) {
        return this._req('POST', '/stories/' + storyId + '/flags', flag);
    }

    // ── Characters ───────────────────────────────────────────
    getCharacters(storyId) {
        return this._req('GET', '/characters/story/' + storyId);
    }

    getCharacter(id) {
        return this._req('GET', '/characters/' + id);
    }

    createCharacter(storyId, data) {
        return this._req('POST', '/characters/story/' + storyId, data);
    }

    updateCharacter(id, data) {
        return this._req('PATCH', '/characters/' + id, data);
    }

    deleteCharacter(id) {
        return this._req('DELETE', '/characters/' + id);
    }

    // ── Dialogues ────────────────────────────────────────────
    getDialogues(storyId) {
        return this._req('GET', '/dialogues/story/' + storyId);
    }

    /** Returns full tree: { ...dialogue, nodes: [{ ...node, choices: [] }] } */
    getDialogueTree(dialogueId) {
        return this._req('GET', '/dialogues/' + dialogueId + '/tree');
    }

    createDialogue(storyId, data) {
        return this._req('POST', '/dialogues/story/' + storyId, data);
    }

    createDialogueNode(data) {
        return this._req('POST', '/dialogues/nodes', data);
    }

    updateDialogueNode(id, data) {
        return this._req('PATCH', '/dialogues/nodes/' + id, data);
    }

    setDialogueEntry(dialogueId, nodeId) {
        return this._req('PATCH', '/dialogues/' + dialogueId + '/entry-node', { node_id: nodeId });
    }

    createDialogueChoice(data) {
        return this._req('POST', '/dialogues/choices', data);
    }

    deleteDialogueChoice(id) {
        return this._req('DELETE', '/dialogues/choices/' + id);
    }

    // ── Quests ───────────────────────────────────────────────
    getQuests(storyId) {
        return this._req('GET', '/quests/story/' + storyId);
    }

    createQuest(storyId, data) {
        return this._req('POST', '/quests/story/' + storyId, data);
    }

    updateQuest(id, data) {
        return this._req('PATCH', '/quests/' + id, data);
    }

    deleteQuest(id) {
        return this._req('DELETE', '/quests/' + id);
    }

    createQuestObjective(questId, data) {
        return this._req('POST', '/quests/' + questId + '/objectives', data);
    }

    // ── Scenes ───────────────────────────────────────────────
    getScenes(storyId) {
        return this._req('GET', '/scenes/story/' + storyId);
    }

    getScene(id) {
        return this._req('GET', '/scenes/' + id);
    }

    createScene(storyId, data) {
        return this._req('POST', '/scenes/story/' + storyId, data);
    }

    updateScene(id, data) {
        return this._req('PATCH', '/scenes/' + id, data);
    }

    createSceneTrigger(data) {
        return this._req('POST', '/scenes/triggers', data);
    }

    // ── Assets ───────────────────────────────────────────────
    getStudioData(storyId) {
        return this._req('GET', '/stories/' + storyId + '/studio');
    }

    getMaps(storyId) {
        return this._req('GET', '/maps?story_id=' + storyId);
    }

    getMap(id) {
        return this._req('GET', '/maps/' + id);
    }

    createMap(data) {
        return this._req('POST', '/maps', data);
    }

    updateMap(id, data) {
        return this._req('PATCH', '/maps/' + id, data);
    }

    deleteMap(id) {
        return this._req('DELETE', '/maps/' + id);
    }

    getMapStudio(id) {
        return this._req('GET', '/maps/' + id + '/studio');
    }

    saveMapStudio(id, data) {
        return this._req('PUT', '/maps/' + id + '/studio', data);
    }

    getFactions(storyId) {
        return this._req('GET', '/factions?story_id=' + storyId);
    }

    createFaction(data) {
        return this._req('POST', '/factions', data);
    }

    updateFaction(id, data) {
        return this._req('PATCH', '/factions/' + id, data);
    }

    deleteFaction(id) {
        return this._req('DELETE', '/factions/' + id);
    }

    getEvents(storyId, scope) {
        var path = '/events';
        var parts = [];
        if (storyId) parts.push('story_id=' + encodeURIComponent(storyId));
        if (scope) parts.push('scope=' + encodeURIComponent(scope));
        if (parts.length) path += '?' + parts.join('&');
        return this._req('GET', path);
    }

    createEvent(data) {
        return this._req('POST', '/events', data);
    }

    updateEvent(id, data) {
        return this._req('PATCH', '/events/' + id, data);
    }

    deleteEvent(id) {
        return this._req('DELETE', '/events/' + id);
    }

    getAssets(storyId) {
        return this._req('GET', '/assets/story/' + storyId);
    }
    
    getAsset(assetId) {
        return this._req('GET', '/assets/' + assetId);
    }

    createAsset(storyId, data) {
        return this._req('POST', '/assets/story/' + storyId, data);
    }

    updateAsset(id, data) {
        return this._req('PATCH', '/assets/' + id, data);
    }

    deleteAsset(id) {
        return this._req('DELETE', '/assets/' + id);
    }

    // ── Sprite Templates ─────────────────────────────────────
    getSpriteTemplates() {
        return this._req('GET', '/sprite-templates');
    }

    getSpriteTemplate(id) {
        return this._req('GET', '/sprite-templates/' + id);
    }

    createSpriteTemplate(data) {
        return this._req('POST', '/sprite-templates', data);
    }

    updateSpriteTemplate(id, data) {
        return this._req('PATCH', '/sprite-templates/' + id, data);
    }

    deleteSpriteTemplate(id) {
        return this._req('DELETE', '/sprite-templates/' + id);
    }

    getAudioProjects() {
        return this._req('GET', '/audio-projects');
    }

    getAudioProject(id) {
        return this._req('GET', '/audio-projects/' + id);
    }

    createAudioProject(data) {
        return this._req('POST', '/audio-projects', data);
    }

    updateAudioProject(id, data) {
        return this._req('PATCH', '/audio-projects/' + id, data);
    }

    deleteAudioProject(id) {
        return this._req('DELETE', '/audio-projects/' + id);
    }

    // ── Unit Templates ───────────────────────────────────────
    getUnitTemplates(storyId) {
        var path = '/unit-templates';
        if (storyId) path += '?story_id=' + storyId;
        return this._req('GET', path);
    }

    getUnitTemplate(id) {
        return this._req('GET', '/unit-templates/' + id);
    }

    createUnitTemplate(data) {
        return this._req('POST', '/unit-templates', data);
    }

    updateUnitTemplate(id, data) {
        return this._req('PATCH', '/unit-templates/' + id, data);
    }

    deleteUnitTemplate(id) {
        return this._req('DELETE', '/unit-templates/' + id);
    }

    // ── Engine integration helper ────────────────────────────
    /**
     * Load a story and apply its engine config to a running Engine instance.
     * Called from Engine.loadStory(storyId) during the launcher flow.
     */
    async applyToEngine(storyId, engine) {
        var story = await this.loadStory(storyId);

        // Apply terrain config
        if (story.engine_configs) {
            var ec = story.engine_configs;
            engine.regenerateWorld({
                waterLevel:     ec.terrain_water_level,
                hillLevel:      ec.terrain_hill_level,
                mountainLevel:  ec.terrain_mountain_level,
                elevationScale: ec.terrain_elevation_scale,
                mapWidth:       ec.default_map_width,
                mapHeight:      ec.default_map_height,
            });
        }

        // Apply weather
        if (story.engine_configs && engine.weatherSystem) {
            engine.weatherSystem.setWeather(
                story.engine_configs.default_weather    || 'clear',
                story.engine_configs.weather_intensity  || 0.3,
                0
            );
        }

        // Register factions from DB instead of hardcoded
        if (story.factions && story.faction_relations) {
            RealmKit.FactionRelations = {};
            story.factions.forEach(function(f) {
                RealmKit.FactionRelations[f.name] = {};
            });
            story.faction_relations.forEach(function(rel) {
                var a = story.factions.find(function(f) { return f.id === rel.faction_a_id; });
                var b = story.factions.find(function(f) { return f.id === rel.faction_b_id; });
                if (a && b) {
                    var type = rel.relation_type === 'enemy' ? 'foe' : rel.relation_type;
                    RealmKit.FactionRelations[a.name][b.name] = type;
                    RealmKit.FactionRelations[b.name][a.name] = type;
                }
            });
        }

        // Register story flag defaults
        if (story.story_flag_definitions) {
            engine._storyFlags = {};
            story.story_flag_definitions.forEach(function(f) {
                engine._storyFlags[f.flag_key] = f.default_value;
            });
        }

        if (story.ui_config) {
            engine.storyUIConfig = {
                uiMode: story.ui_config.ui_mode || 'hybrid',
                themeKey: story.ui_config.theme_key || 'realmkit-parchment',
                resourceLabels: this._safeParseJSON(story.ui_config.resource_labels_json, {
                    hp: 'HP',
                    mp: 'MP',
                    xp: 'XP',
                    level: 'Level',
                    gold: 'Gold'
                }),
                panels: this._safeParseJSON(story.ui_config.panel_config_json, {}),
                layout: this._safeParseJSON(story.ui_config.layout_config_json, {})
            };
        }

        console.log('[StoryDatabase] Applied story to engine:', story.title);
        return story;
    }

    _safeParseJSON(value, fallback) {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (e) {
            console.warn('[StoryDatabase] Failed to parse JSON config:', e.message);
            return fallback;
        }
    }
};
