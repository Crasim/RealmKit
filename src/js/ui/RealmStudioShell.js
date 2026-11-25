var RealmKit = RealmKit || {};

(function() {
    function StudioShell() {
        this.frameReady = false;
        this.activeTool = 'map-painter';
        this.activeNodeId = '';
        this.storyId = '';
        this.currentMapId = '';
        this.studioData = null;
        this.db = null;
        this.tree = [];
        this.expanded = {};
        this.refs = {};
        this._previewLoop = null;
        this._bootstrapping = false;
    }

    StudioShell.prototype = {
        init: function() {
            this.db = typeof RealmKit.StoryDatabase === 'function' ? new RealmKit.StoryDatabase() : null;
            this.refs.toggle = document.getElementById('studio-toggle');
            this.refs.browser = document.getElementById('studio-browser');
            this.refs.frame = document.getElementById('studio-frame');
            this.refs.plaque = document.getElementById('studio-plaque');
            this.refs.note = document.getElementById('studio-surface-note');

            this._bind();
            this._renderBrowser();
            this._syncSurfaceCopy();
            this._sendActiveTool(true);
            this._startPreviewLoop();
            this._bootstrapStudioData();
        },

        _bind: function() {
            var self = this;
            if (this.refs.toggle) {
                this.refs.toggle.addEventListener('click', function() {
                    document.body.classList.toggle('is-sidebar-collapsed');
                    self._refreshFrameLayout();
                });
            }
            if (this.refs.frame) {
                this.refs.frame.addEventListener('load', function() {
                    self.frameReady = true;
                    self._sendActiveTool(true);
                    self._refreshFrameLayout();
                    self._ensureFrameStoryDatabase();
                    if (self.currentMapId) {
                        self._applyCurrentMapToFrame();
                    }
                    self._renderBrowser();
                });
            }
        },

        _bootstrapStudioData: async function() {
            if (!this.db || this._bootstrapping) return;
            this._bootstrapping = true;
            try {
                var storyId = await this._resolveStoryId();
                if (!storyId) return;
                this.storyId = storyId;
                this.studioData = await this.db.getStudioData(storyId);
                await this._loadSupplementalStudioData(storyId);
                this.currentMapId = this.currentMapId || this._defaultMapId();
                this._renderBrowser();
                this._ensureFrameStoryDatabase();
                if (this.currentMapId) {
                    this._applyCurrentMapToFrame();
                }
            } catch (e) {
                console.warn('[RealmStudio] Failed to load studio data from DB:', e);
            } finally {
                this._bootstrapping = false;
            }
        },

        _resolveStoryId: async function() {
            var params = new URLSearchParams(window.location.search);
            var fromUrl = params.get('story_id') || params.get('story');
            if (fromUrl) return fromUrl;

            var engine = this._getFrameEngine();
            if (engine) {
                if (engine.currentStoryId) return engine.currentStoryId;
                if (engine.currentStory && engine.currentStory.id) return engine.currentStory.id;
            }

            if (!this.db) return '';

            var stories = await this.db.listStories(true);
            if (stories && stories.length) {
                return stories[0].id;
            }
            return '';
        },

        _ensureStudioContext: async function() {
            if (!this.db) return false;
            if (!this.storyId) {
                await this._bootstrapStudioData();
            }
            if (!this.storyId) {
                this.storyId = await this._resolveStoryId();
            }
            return !!this.storyId;
        },

        _loadSupplementalStudioData: async function(storyId) {
            if (!this.db || !storyId) return;
            var results = await Promise.allSettled([
                this.db.getAssets(storyId),
                this.db.getSpriteTemplates(),
                this.db.getAudioProjects()
            ]);

            if (!this.studioData) this.studioData = {};
            this.studioData.assets = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
            this.studioData.sprite_templates = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
            this.studioData.audio_projects = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];
        },

        _reloadStudioData: async function(focusNodeId) {
            if (!this.db || !this.storyId) return;
            this.studioData = await this.db.getStudioData(this.storyId);
            await this._loadSupplementalStudioData(this.storyId);
            if (!this.currentMapId) {
                this.currentMapId = this._defaultMapId();
            }
            this._ensureFrameStoryDatabase();
            if (focusNodeId) {
                this.activeNodeId = focusNodeId;
            }
            if (this.currentMapId) {
                this._applyCurrentMapToFrame();
            } else {
                this._renderBrowser();
            }
        },

        _ensureFrameStoryDatabase: function() {
            var engine = this._getFrameEngine();
            if (!engine || !this.db) return;
            if (!engine.storyDatabase) {
                engine.storyDatabase = this.db;
            }
            if (this.storyId) {
                engine.currentStudioStoryId = this.storyId;
            }
            if (this.currentMapId) {
                engine.currentStudioMapId = this.currentMapId;
            }
        },

        _defaultMapId: function() {
            var maps = this.studioData && Array.isArray(this.studioData.maps) ? this.studioData.maps : [];
            if (!maps.length) return '';
            for (var i = 0; i < maps.length; i++) {
                if (maps[i].is_entry_map || maps[i].isEntryPoint) return maps[i].id;
            }
            return maps[0].id;
        },

        _applyCurrentMapToFrame: function() {
            var engine = this._getFrameEngine();
            if (!engine || !this.currentMapId) return;

            var bundle = this._getStudioMapBundle(this.currentMapId);
            if (!bundle || !bundle.map) return;

            var map = bundle.map;
            var tileSize = engine.tileset && engine.tileset.tileWidth ? engine.tileset.tileWidth : 32;
            if (!engine.tileMap || engine.tileMap.width !== map.width || engine.tileMap.height !== map.height) {
                engine.initTileMap({
                    tileSize: tileSize,
                    mapWidth: map.width || 64,
                    mapHeight: map.height || 64,
                    blank: true,
                    blankTileId: 30,
                    flat: true
                });
            }

            if (engine.tileMap) {
                engine.tileMap.name = map.name || map.label || map.id || 'studio_map';
            }

            var terrain = bundle.state && Array.isArray(bundle.state.terrain_json) && bundle.state.terrain_json.length
                ? bundle.state.terrain_json
                : new Array((map.width || 64) * (map.height || 64)).fill(30);
            var collision = bundle.state && Array.isArray(bundle.state.collision_json) && bundle.state.collision_json.length
                ? bundle.state.collision_json
                : new Array((map.width || 64) * (map.height || 64)).fill(0);

            var worldPayload = {
                width: map.width || 64,
                height: map.height || 64,
                tiles: terrain,
                collision: collision,
                spawners: bundle.spawners || [],
                triggers: bundle.triggers || [],
                entities: bundle.units || []
            };

            var mapEditor = this._getFrameMapEditor();
            if (mapEditor && typeof mapEditor._applyWorldData === 'function') {
                mapEditor._applyWorldData(worldPayload);
            }

            var worldEditor = this._getFrameWorldEditor();
            if (worldEditor && typeof worldEditor._applyWorldData === 'function') {
                worldEditor._applyWorldData({
                    spawners: bundle.spawners || [],
                    triggers: bundle.triggers || [],
                    zones: bundle.zones || []
                });
            }

            if (engine.weatherSystem && typeof engine.weatherSystem.setWeather === 'function') {
                var weatherType = bundle.state && bundle.state.weather_override ? bundle.state.weather_override : 'clear';
                var weatherIntensity = bundle.state && bundle.state.weather_intensity != null ? bundle.state.weather_intensity : 0;
                engine.weatherSystem.setWeather(weatherType, weatherIntensity, 0);
            }

            engine.currentStudioMapId = this.currentMapId;
            this._syncSurfaceCopy();
            this._renderBrowser();
        },

        _getStudioMapBundle: function(mapId) {
            if (!this.studioData) return null;
            var maps = this.studioData.maps || [];
            var map = null;
            for (var i = 0; i < maps.length; i++) {
                if (maps[i].id === mapId) {
                    map = maps[i];
                    break;
                }
            }
            if (!map) return null;

            return {
                map: map,
                state: this._findByMapId(this.studioData.map_states, mapId),
                zones: this._filterByMapId(this.studioData.map_zones, mapId),
                triggers: this._filterByMapId(this.studioData.map_triggers, mapId),
                spawners: this._filterByMapId(this.studioData.map_spawners, mapId),
                units: this._filterByMapId(this.studioData.map_units, mapId)
            };
        },

        _renderBrowser: function() {
            var engine = this._getFrameEngine();
            var story = this._getStory(engine);
            this.tree = this._buildTree(engine, story);
            this._ensureExpandedState(this.tree);

            var node = this._findNodeById(this.activeNodeId, this.tree) || this._findFirstNode(this.tree);
            this.activeNodeId = node ? node.id : '';

            var html = [];
            html.push('<div class="studio-workspace-sticky">');
            html.push(this._renderSurfaceSummary(engine, story));
            html.push('</div>');
            html.push('<div class="studio-browser-tree">');
            for (var i = 0; i < this.tree.length; i++) {
                html.push(this._renderNode(this.tree[i], 0));
            }
            html.push('</div>');
            html.push('<div class="studio-browser-detail">');
            html.push(this._renderDetail(node));
            html.push('</div>');

            this.refs.browser.innerHTML = html.join('');
            this.refs.minimapCanvas = document.getElementById('studio-minimap');
            this.refs.minimapSize = document.getElementById('studio-minimap-size');
            this._bindBrowserControls();
        },

        _renderSurfaceSummary: function(engine, story) {
            var currentMap = this._getCurrentMap(engine, story);
            var mapName = currentMap ? currentMap.label : this._surfaceName(this.activeTool);
            var mapMeta = this._mapMeta(currentMap, engine);
            var html = [];

            html.push('<div class="studio-browser-surface">');
            html.push('<div class="studio-sub-lbl">Current Surface</div>');
            html.push('<div class="studio-section-title">' + this._esc(mapName) + '</div>');
            html.push('<div class="studio-section-desc">' + this._esc(mapMeta) + '</div>');
            html.push('<div class="studio-minimap-wrap">');
            html.push('  <canvas id="studio-minimap" class="studio-minimap-canvas" width="176" height="176"></canvas>');
            html.push('  <div class="studio-minimap-meta">');
            html.push('    <span id="studio-minimap-size" class="studio-minimap-size">--</span>');
            html.push('    <span class="studio-minimap-hint">Click to pan</span>');
            html.push('  </div>');
            html.push('</div>');
            html.push('</div>');

            return html.join('');
        },

        _renderNode: function(node, depth) {
            if (depth === 0) {
                return this._renderSection(node);
            }
            if (node.children && node.children.length) {
                return this._renderBranch(node, depth);
            }
            return this._renderLeaf(node, depth);
        },

        _renderSection: function(node) {
            var open = this.expanded[node.id] !== false;
            var html = [];
            html.push('<div class="studio-folder">');
            html.push(
                '<button class="studio-sec-hdr studio-folder-hdr' + (open ? '' : ' is-closed') + (this.activeNodeId === node.id ? ' is-selected' : '') + '" type="button" data-node-toggle="' + this._escAttr(node.id) + '">' +
                '<span class="studio-caret">' + (open ? 'v' : '>') + '</span>' +
                '<span class="studio-folder-label">' + this._esc(node.label) + '</span>' +
                '</button>'
            );
            if (open) {
                if (node.desc) {
                    html.push('<div class="studio-folder-note">' + this._esc(node.desc) + '</div>');
                }
                html.push('<div class="studio-folder-body studio-folder-body--full">');
                for (var i = 0; i < node.children.length; i++) {
                    html.push(this._renderNode(node.children[i], 1));
                }
                html.push('</div>');
            }
            html.push('</div>');
            return html.join('');
        },

        _renderBranch: function(node, depth) {
            var open = this.expanded[node.id] !== false;
            var html = [];
            html.push('<div class="studio-tree-branch depth-' + depth + '">');
            html.push(
                '<button class="studio-tree-branch-hdr' + (open ? '' : ' is-closed') + (this.activeNodeId === node.id ? ' is-active' : '') + '" type="button" data-node-toggle="' + this._escAttr(node.id) + '">' +
                '<span class="studio-caret">' + (open ? 'v' : '>') + '</span>' +
                '<span class="studio-tree-branch-label">' + this._esc(node.label) + '</span>' +
                (node.meta ? '<span class="studio-node-meta">' + this._esc(node.meta) + '</span>' : '') +
                '</button>'
            );
            if (open) {
                html.push('<div class="studio-tree-children">');
                for (var i = 0; i < node.children.length; i++) {
                    html.push(this._renderNode(node.children[i], depth + 1));
                }
                html.push('</div>');
            }
            html.push('</div>');
            return html.join('');
        },

        _renderLeaf: function(node, depth) {
            var active = this.activeNodeId === node.id;
            var html = [];
            html.push('<div class="studio-tree-leaf-wrap">');
            html.push(
                '<button class="studio-tree-leaf studio-tree-leaf-depth-' + depth + (active ? ' is-active' : '') + '" type="button" data-node-select="' + this._escAttr(node.id) + '">' +
                '<span class="studio-tree-leaf-label">' + this._esc(node.label) + '</span>' +
                (node.meta ? '<span class="studio-node-meta">' + this._esc(node.meta) + '</span>' : '') +
                '</button>'
            );
            if (active && node.inlineForm) {
                html.push(this._renderInlineForm(node));
            }
            html.push('</div>');
            return html.join('');
        },

        _renderInlineForm: function(node) {
            if (!node || !node.inlineForm) return '';
            if (node.inlineForm.type === 'create-unit') {
                return this._renderCreateUnitInlineForm(node);
            }
            if (node.inlineForm.type === 'create-faction') {
                return this._renderCreateFactionInlineForm(node);
            }
            return '';
        },

        _renderCreateUnitInlineForm: function(node) {
            var factions = this.studioData && Array.isArray(this.studioData.factions) ? this.studioData.factions : [];
            var html = [];
            html.push('<form class="studio-inline-form" data-inline-form="create-unit" data-node-id="' + this._escAttr(node.id) + '">');
            html.push('<div class="studio-inline-form-title">New Unit Definition</div>');
            html.push('<div class="studio-inline-grid">');
            html.push(this._renderInlineField('Name', '<input type="text" name="name" value="new_unit" required>'));
            html.push(this._renderInlineField('Display Name', '<input type="text" name="display_name" value="New Unit">'));
            html.push(this._renderInlineField('Category', '<select name="category"><option value="enemy">Enemy</option><option value="ally">Ally</option><option value="neutral">Neutral</option><option value="boss">Boss</option><option value="hero">Hero</option></select>'));
            html.push(this._renderInlineField('Faction', this._renderFactionSelect('faction_id')));
            html.push(this._renderInlineField('HP', '<input type="number" name="base_hp" value="40" min="1" step="1">'));
            html.push(this._renderInlineField('MP', '<input type="number" name="base_mp" value="0" min="0" step="1">'));
            html.push(this._renderInlineField('Attack', '<input type="number" name="base_attack" value="10" min="0" step="1">'));
            html.push(this._renderInlineField('Defense', '<input type="number" name="base_defense" value="5" min="0" step="1">'));
            html.push(this._renderInlineField('Speed', '<input type="number" name="base_speed" value="80" min="1" step="1">'));
            html.push('</div>');
            html.push(this._renderInlineField('Description', '<textarea name="description" rows="3" placeholder="Shared unit behavior, role, or notes"></textarea>'));
            html.push('<div class="studio-inline-actions">');
            html.push('<button class="studio-btn is-gold" type="submit">Create Unit</button>');
            html.push('<button class="studio-btn" type="button" data-inline-cancel="' + this._escAttr(node.id) + '">Cancel</button>');
            html.push('</div>');
            html.push('</form>');
            return html.join('');
        },

        _renderCreateFactionInlineForm: function(node) {
            var html = [];
            html.push('<form class="studio-inline-form" data-inline-form="create-faction" data-node-id="' + this._escAttr(node.id) + '">');
            html.push('<div class="studio-inline-form-title">New Faction</div>');
            html.push('<div class="studio-inline-grid">');
            html.push(this._renderInlineField('Faction Key', '<input type="text" name="name" value="new_faction" required>'));
            html.push(this._renderInlineField('Display Name', '<input type="text" name="display_name" value="New Faction">'));
            html.push(this._renderInlineField('Color', '<input type="text" name="color" value="#ffffff">'));
            html.push('</div>');
            html.push('<div class="studio-inline-actions">');
            html.push('<button class="studio-btn is-gold" type="submit">Create Faction</button>');
            html.push('<button class="studio-btn" type="button" data-inline-cancel="' + this._escAttr(node.id) + '">Cancel</button>');
            html.push('</div>');
            html.push('</form>');
            return html.join('');
        },

        _renderInlineField: function(label, controlHtml) {
            return '<label class="studio-inline-field"><span class="studio-inline-label">' + this._esc(label) + '</span>' + controlHtml + '</label>';
        },

        _renderFactionSelect: function(name) {
            var factions = this.studioData && Array.isArray(this.studioData.factions) ? this.studioData.factions : [];
            var html = [];
            html.push('<select name="' + this._escAttr(name) + '">');
            html.push('<option value="">None</option>');
            for (var i = 0; i < factions.length; i++) {
                html.push('<option value="' + this._escAttr(factions[i].id) + '">' + this._esc(factions[i].display_name || factions[i].name || factions[i].id) + '</option>');
            }
            html.push('</select>');
            return html.join('');
        },

        _renderDetail: function(node) {
            if (!node) {
                return '<div class="studio-section-desc">Select an item in the tree to inspect or edit it.</div>';
            }

            var html = [];
            html.push('<div class="studio-sub-lbl">' + this._esc(node.meta || this._nodeTypeLabel(node.kind)) + '</div>');
            html.push('<div class="studio-section-title">' + this._esc(node.title || node.label) + '</div>');
            html.push('<div class="studio-section-desc">' + this._esc(node.desc || '') + '</div>');

            if (node.actions && node.actions.length) {
                html.push('<div class="studio-actions">');
                for (var i = 0; i < node.actions.length; i++) {
                    var action = node.actions[i];
                    var activeClass = action.mode === 'frame' && action.tool === this.activeTool ? ' is-active' : '';
                    html.push(
                        '<button class="studio-btn' +
                        (action.kind === 'gold' ? ' is-gold' : '') +
                        activeClass +
                        '" type="button" data-node-action="' + this._escAttr(node.id + ':' + i) + '">' +
                        this._esc(action.label) +
                        '</button>'
                    );
                }
                html.push('</div>');
            }

            if (node.sections && node.sections.length) {
                for (var s = 0; s < node.sections.length; s++) {
                    html.push(this._renderDetailSection(node.sections[s]));
                }
            } else if (node.children && node.children.length) {
                html.push('<div class="studio-detail-section">');
                html.push('<div class="studio-detail-heading">Contents</div>');
                html.push('<div class="studio-section-desc">Expand the tree to inspect individual children of this section.</div>');
                html.push('</div>');
            }

            return html.join('');
        },

        _renderDetailSection: function(section) {
            var html = [];
            html.push('<div class="studio-detail-section">');
            if (section.title) {
                html.push('<div class="studio-detail-heading">' + this._esc(section.title) + '</div>');
            }

            if (section.text) {
                html.push('<div class="studio-section-desc">' + this._esc(section.text) + '</div>');
            }

            if (section.facts && section.facts.length) {
                html.push('<div class="studio-detail-facts">');
                for (var i = 0; i < section.facts.length; i++) {
                    var fact = section.facts[i];
                    html.push(
                        '<div class="studio-detail-fact">' +
                        '<span class="studio-detail-fact-label">' + this._esc(fact.label) + '</span>' +
                        '<span class="studio-detail-fact-value">' + this._esc(fact.value) + '</span>' +
                        '</div>'
                    );
                }
                html.push('</div>');
            }

            if (section.cards && section.cards.length) {
                html.push('<div class="studio-detail-grid">');
                for (var j = 0; j < section.cards.length; j++) {
                    var card = section.cards[j];
                    html.push('<div class="studio-detail-card">');
                    html.push('<div class="studio-detail-card-title">' + this._esc(card.title) + '</div>');
                    if (card.lines && card.lines.length) {
                        for (var k = 0; k < card.lines.length; k++) {
                            html.push('<div class="studio-detail-card-line">' + this._esc(card.lines[k]) + '</div>');
                        }
                    }
                    html.push('</div>');
                }
                html.push('</div>');
            }

            html.push('</div>');
            return html.join('');
        },

        _bindBrowserControls: function() {
            var self = this;
            var toggles = this.refs.browser.querySelectorAll('[data-node-toggle]');
            for (var i = 0; i < toggles.length; i++) {
                toggles[i].addEventListener('click', function() {
                    var nodeId = this.getAttribute('data-node-toggle');
                    self.expanded[nodeId] = !(self.expanded[nodeId] !== false);
                    self.activeNodeId = nodeId;
                    self._renderBrowser();
                });
            }

            var selects = this.refs.browser.querySelectorAll('[data-node-select]');
            for (var j = 0; j < selects.length; j++) {
                selects[j].addEventListener('click', function() {
                    self._selectNode(this.getAttribute('data-node-select'));
                });
            }

            var actions = this.refs.browser.querySelectorAll('[data-node-action]');
            for (var k = 0; k < actions.length; k++) {
                actions[k].addEventListener('click', function() {
                    var value = this.getAttribute('data-node-action');
                    var idx = value.lastIndexOf(':');
                    if (idx < 0) return;
                    var nodeId = value.substring(0, idx);
                    var actionIndex = parseInt(value.substring(idx + 1), 10);
                    var node = self._findNodeById(nodeId, self.tree);
                    if (!node || !node.actions || !node.actions[actionIndex]) return;
                    self._runAction(node.actions[actionIndex]);
                });
            }

            var inlineForms = this.refs.browser.querySelectorAll('[data-inline-form]');
            for (var m = 0; m < inlineForms.length; m++) {
                inlineForms[m].addEventListener('submit', async function(event) {
                    event.preventDefault();
                    await self._submitInlineForm(this);
                });
            }

            var inlineCancel = this.refs.browser.querySelectorAll('[data-inline-cancel]');
            for (var n = 0; n < inlineCancel.length; n++) {
                inlineCancel[n].addEventListener('click', function() {
                    var nodeId = this.getAttribute('data-inline-cancel');
                    var parentId = nodeId && nodeId.indexOf(':') > -1 ? nodeId.split(':')[0] === 'faction' ? 'section:factions' : 'section:units' : '';
                    self.activeNodeId = parentId || '';
                    self._renderBrowser();
                });
            }

            if (this.refs.minimapCanvas) {
                this.refs.minimapCanvas.addEventListener('click', function(event) {
                    self._handleMinimapClick(event);
                });
            }
        },

        _submitInlineForm: async function(form) {
            if (!form) return;
            var formType = form.getAttribute('data-inline-form');
            var nodeId = form.getAttribute('data-node-id');
            var fd = new FormData(form);

            try {
                if (formType === 'create-unit') {
                    await this._createUnitTemplateRecord({
                        name: this._formText(fd, 'name'),
                        display_name: this._formText(fd, 'display_name'),
                        category: this._formText(fd, 'category') || 'enemy',
                        faction_id: this._formText(fd, 'faction_id') || null,
                        description: this._formText(fd, 'description') || null,
                        base_hp: this._formInt(fd, 'base_hp', 40),
                        base_mp: this._formInt(fd, 'base_mp', 0),
                        base_attack: this._formInt(fd, 'base_attack', 10),
                        base_defense: this._formInt(fd, 'base_defense', 5),
                        base_speed: this._formInt(fd, 'base_speed', 80)
                    });
                    return;
                }

                if (formType === 'create-faction') {
                    await this._createFactionRecord({
                        name: this._formText(fd, 'name'),
                        display_name: this._formText(fd, 'display_name'),
                        color: this._formText(fd, 'color') || '#ffffff'
                    });
                    return;
                }
            } catch (e) {
                console.warn('[RealmStudio] Inline form submit failed:', e);
                window.alert('Create failed: ' + (e && e.message ? e.message : e));
                this.activeNodeId = nodeId || this.activeNodeId;
                this._renderBrowser();
            }
        },

        _selectNode: function(nodeId) {
            var node = this._findNodeById(nodeId, this.tree);
            if (!node) return;
            this.activeNodeId = nodeId;
            if (node.mapId) {
                this.currentMapId = node.mapId;
                this._applyCurrentMapToFrame();
            }
            if (node.onSelectAction) {
                this._runAction(node.onSelectAction);
            }
            this._renderBrowser();
        },

        _runAction: async function(action) {
            try {
                if (!action) return;
                if (action.mapId) {
                    this.currentMapId = action.mapId;
                    this._applyCurrentMapToFrame();
                }

                if (action.mode === 'frame') {
                    this.activeTool = action.tool;
                    this._syncSurfaceCopy();
                    this._renderBrowser();
                    this._launchFrameTool(action.tool, action);
                    return;
                }

                if (action.mode === 'external' && action.href) {
                    window.open(action.href, '_blank');
                    return;
                }

                if (action.mode === 'select-unit') {
                    this.activeTool = 'map-units';
                    this._launchFrameTool('map-units', { layer: 'entities' });
                    this._setFrameUnitTemplate(action.templateId);
                    this._syncSurfaceCopy();
                    this._renderBrowser();
                    return;
                }

                if (action.mode === 'select-zone') {
                    this.activeTool = 'world-zone';
                    this._launchFrameTool('world-zone', { layer: 'zone' });
                    this._selectWorldEditorNode('zone', action.index);
                    this._syncSurfaceCopy();
                    this._renderBrowser();
                    return;
                }

                if (action.mode === 'select-trigger') {
                    this.activeTool = 'world-trigger';
                    this._launchFrameTool('world-trigger', { layer: 'trigger' });
                    this._selectWorldEditorNode('trigger', action.index);
                    this._syncSurfaceCopy();
                    this._renderBrowser();
                    return;
                }

                if (action.mode === 'set-weather') {
                    this._setWeather(action.weather, action.intensity);
                    if (this.db && this.currentMapId) {
                        this.db.saveMapStudio(this.currentMapId, {
                            state: {
                                weather_override: action.weather,
                                weather_intensity: action.intensity
                            }
                        }).then(function() {}, function() {});
                    }
                    if (this.studioData && Array.isArray(this.studioData.map_states)) {
                        var state = this._findByMapId(this.studioData.map_states, this.currentMapId);
                        if (!state) {
                            state = { map_id: this.currentMapId, weather_override: action.weather, weather_intensity: action.intensity, terrain_json: [], collision_json: [] };
                            this.studioData.map_states.push(state);
                        } else {
                            state.weather_override = action.weather;
                            state.weather_intensity = action.intensity;
                        }
                    }
                    this._renderBrowser();
                    return;
                }

                if (action.mode === 'create-map') {
                    await this._createMapRecord();
                    return;
                }

                if (action.mode === 'create-unit') {
                    await this._createUnitTemplateRecord();
                    return;
                }

                if (action.mode === 'create-npc') {
                    await this._createNPCRecord();
                    return;
                }

                if (action.mode === 'create-faction') {
                    await this._createFactionRecord();
                    return;
                }

                if (action.mode === 'show-inline-form') {
                    this.activeNodeId = action.nodeId || this.activeNodeId;
                    this._renderBrowser();
                    return;
                }

                if (action.mode === 'create-quest') {
                    await this._createQuestRecord();
                    return;
                }

                if (action.mode === 'create-event') {
                    await this._createEventRecord();
                    return;
                }

                if (action.mode === 'create-asset') {
                    await this._createAssetRecord(action);
                    return;
                }

                if (action.mode === 'save-map') {
                    await this._saveMapRecord(action.mapId || this.currentMapId);
                    return;
                }

                if (action.mode === 'save-map-state') {
                    await this._saveCurrentMapState(action.tool || this.activeTool, action.mapId || this.currentMapId);
                    return;
                }

                if (action.mode === 'save-asset') {
                    await this._saveAssetRecord(action.assetId);
                    return;
                }

                if (action.mode === 'save-unit') {
                    await this._saveUnitTemplateRecord(action.templateId);
                    return;
                }

                if (action.mode === 'save-npc') {
                    await this._saveNPCRecord(action.characterId);
                    return;
                }

                if (action.mode === 'save-faction') {
                    await this._saveFactionRecord(action.factionId);
                    return;
                }

                if (action.mode === 'save-quest') {
                    await this._saveQuestRecord(action.questId);
                    return;
                }

                if (action.mode === 'save-event') {
                    await this._saveEventRecord(action.eventId);
                    return;
                }

                if (action.mode === 'create-sprite-template') {
                    await this._createSpriteTemplateRecord();
                    return;
                }

                if (action.mode === 'save-sprite-template') {
                    await this._saveSpriteTemplateRecord(action.templateId);
                    return;
                }

                if (action.mode === 'create-audio-project') {
                    await this._createAudioProjectRecord();
                    return;
                }

                if (action.mode === 'save-audio-project') {
                    await this._saveAudioProjectRecord(action.projectId);
                    return;
                }
            } catch (e) {
                console.warn('[RealmStudio] Action failed:', e);
                window.alert('Studio action failed: ' + (e && e.message ? e.message : e));
            }
        },

        _buildTree: function(engine, story) {
            return [
                this._buildMapsSection(engine, story),
                this._buildUnitsSection(engine),
                this._buildNPCSection(engine, story),
                this._buildEventsSection(engine, story),
                this._buildFactionsSection(engine, story),
                this._buildSystemSection(engine)
            ];
        },

        _buildMapsSection: function(engine, story) {
            var maps = this._getMaps(engine, story);
            var mapNodes = [
                {
                    id: 'maps:create',
                    kind: 'leaf',
                    label: 'Create Map',
                    meta: 'Definition',
                    title: 'Create Map',
                    desc: 'Create a new authoring surface and persist it in the story database.',
                actions: [
                    { label: 'Create Map', kind: 'gold', mode: 'create-map' }
                ],
                    sections: [
                        {
                            title: 'New Map',
                            facts: [
                                { label: 'Story', value: this.storyId || 'Select a story first' },
                                { label: 'Defaults', value: '64 x 64 overworld surface' }
                            ]
                        }
                    ]
                }
            ];
            for (var i = 0; i < maps.length; i++) {
                mapNodes.push(this._buildMapNode(maps[i], engine, story));
            }

            return {
                id: 'section:maps',
                kind: 'section',
                label: 'Maps',
                desc: 'Per-map editing tree for tilesets, terrain, zones, collision, and weather.',
                children: mapNodes
            };
        },

        _buildMapNode: function(map, engine, story) {
            var bundle = this._getStudioMapBundle(map.id) || {};
            var state = bundle.state || {};
            var currentWeather = state.weather_override || (engine && engine.weatherSystem ? engine.weatherSystem.currentWeather : 'clear');
            var weatherIntensity = this._fmt(state.weather_intensity != null ? state.weather_intensity : (engine && engine.weatherSystem ? (engine.weatherSystem.targetIntensity || engine.weatherSystem.intensity || 0) : 0));
            var terrainFacts = this._terrainFacts(story, map);
            var zoneNodes = this._buildZoneNodes(engine, map.id);
            var blockedCount = Array.isArray(state.collision_json) && state.collision_json.length ? this._countTruthy(state.collision_json) : this._collisionCount(engine);
            var tilesetNodes = this._buildAssetNodes('tileset');

            return {
                id: 'map:' + map.id,
                kind: 'branch',
                mapId: map.id,
                label: map.label,
                meta: map.width + 'x' + map.height,
                title: map.label,
                desc: 'Primary map node. Expand it to edit the surface, collision, zones, and weather for this map.',
                sections: [
                    {
                        title: 'Map Surface',
                        facts: [
                            { label: 'Name', value: map.label },
                            { label: 'Size', value: map.width + ' x ' + map.height + ' tiles' },
                            { label: 'Entry', value: map.isEntryPoint ? 'Yes' : 'No' }
                        ]
                    }
                ],
                children: [
                    {
                        id: 'map:' + map.id + ':tilesets',
                        kind: 'branch',
                        mapId: map.id,
                        label: 'Tilesets',
                        meta: tilesetNodes.length + ' assets',
                        title: map.label + ' Tilesets',
                        desc: 'Manage tileset art and palette sources used by this map.',
                        actions: [
                            { label: 'Save Map', kind: 'gold', mode: 'save-map', mapId: map.id },
                            { label: 'Save Surface', kind: 'slate', mode: 'save-map-state', mapId: map.id, tool: 'map-painter' },
                            { label: 'Open Pixel Painter', kind: 'gold', mode: 'external', href: 'sprite-builder.html', mapId: map.id },
                            { label: 'Terrain Brush', kind: 'slate', mode: 'frame', tool: 'map-painter', layer: 'terrain', mapId: map.id },
                            { label: 'New Tileset Asset', kind: 'slate', mode: 'create-asset', assetType: 'tileset', mapId: map.id }
                        ],
                        sections: [
                            {
                                title: 'Tileset Source',
                                facts: [
                                    { label: 'Surface', value: map.tileset_path || map.tileset_id || 'Live tileset palette' },
                                    { label: 'Tile Count', value: Array.isArray(state.terrain_json) ? String(state.terrain_json.length || (map.width * map.height)) : String(map.width * map.height) }
                                ]
                            }
                        ],
                        children: [
                            {
                                id: 'map:' + map.id + ':tilesets:create',
                                kind: 'leaf',
                                mapId: map.id,
                                label: 'Create Tileset Asset',
                                meta: 'Registry',
                                title: 'Create Tileset Asset',
                                desc: 'Create a new tileset or terrain palette asset for this story.',
                                actions: [
                                    { label: 'Create Tileset Asset', kind: 'gold', mode: 'create-asset', assetType: 'tileset', mapId: map.id }
                                ]
                            }
                        ].concat(tilesetNodes.length ? tilesetNodes : [
                            this._simpleLeaf('map:' + map.id + ':tilesets:none', 'No Tileset Assets', 'Registry', 'Create a story asset or keep using the live tileset palette.', [
                                { label: 'Status', value: 'No tileset assets found' }
                            ], 'system')
                        ])
                    },
                    {
                        id: 'map:' + map.id + ':terrain',
                        kind: 'leaf',
                        mapId: map.id,
                        label: 'Terrain',
                        meta: 'Brush + Properties',
                        title: map.label + ' Terrain',
                        desc: 'Paint terrain and inspect the generation thresholds driving this map.',
                        onSelectAction: { mode: 'frame', tool: 'map-painter', layer: 'terrain', mapId: map.id },
                        actions: [
                            { label: 'Terrain Brush', kind: 'gold', mode: 'frame', tool: 'map-painter', layer: 'terrain', mapId: map.id },
                            { label: 'Save Terrain', kind: 'slate', mode: 'save-map-state', tool: 'map-painter', mapId: map.id },
                            { label: 'Open System Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=system', mapId: map.id }
                        ],
                        sections: [
                            { title: 'Terrain Properties', facts: terrainFacts }
                        ]
                    },
                    {
                        id: 'map:' + map.id + ':zones',
                        kind: 'branch',
                        mapId: map.id,
                        label: 'Zones',
                        meta: zoneNodes.length + ' zones',
                        title: map.label + ' Zones',
                        desc: 'Inspect all zones for this surface and draw more directly on the map.',
                        onSelectAction: { mode: 'frame', tool: 'world-zone', layer: 'zone', mapId: map.id },
                        actions: [
                            { label: 'Zone Layer', kind: 'gold', mode: 'frame', tool: 'world-zone', layer: 'zone', mapId: map.id },
                            { label: 'Save Zones', kind: 'slate', mode: 'save-map-state', tool: 'world-zone', mapId: map.id }
                        ],
                        sections: [
                            {
                                title: 'Zone Summary',
                                facts: [
                                    { label: 'Zones', value: String(zoneNodes.length) },
                                    { label: 'Mode', value: 'Paint and select on canvas' }
                                ]
                            }
                        ],
                        children: [
                            {
                                id: 'map:' + map.id + ':zones:create',
                                kind: 'leaf',
                                mapId: map.id,
                                label: 'Draw New Zone',
                                meta: 'Canvas tool',
                                title: 'Draw New Zone',
                                desc: 'Switch to the zone layer and paint or define a new zone on the map.',
                                onSelectAction: { mode: 'frame', tool: 'world-zone', layer: 'zone', mapId: map.id },
                                actions: [
                                    { label: 'Zone Layer', kind: 'gold', mode: 'frame', tool: 'world-zone', layer: 'zone', mapId: map.id },
                                    { label: 'Save Zones', kind: 'slate', mode: 'save-map-state', tool: 'world-zone', mapId: map.id }
                                ]
                            }
                        ].concat(zoneNodes)
                    },
                    {
                        id: 'map:' + map.id + ':collision',
                        kind: 'leaf',
                        mapId: map.id,
                        label: 'Collision',
                        meta: blockedCount + ' blocked',
                        title: map.label + ' Collision',
                        desc: 'Paintable collision layer for blocked cells and movement boundaries.',
                        onSelectAction: { mode: 'frame', tool: 'map-collision', layer: 'collision', mapId: map.id },
                        actions: [
                            { label: 'Collision Brush', kind: 'gold', mode: 'frame', tool: 'map-collision', layer: 'collision', mapId: map.id },
                            { label: 'Save Collision', kind: 'slate', mode: 'save-map-state', tool: 'map-collision', mapId: map.id }
                        ],
                        sections: [
                            {
                                title: 'Collision Summary',
                                facts: [
                                    { label: 'Blocked Cells', value: String(blockedCount) },
                                    { label: 'Editing', value: 'Paint directly on the map' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'map:' + map.id + ':weather',
                        kind: 'leaf',
                        mapId: map.id,
                        label: 'Weather',
                        meta: currentWeather,
                        title: map.label + ' Weather Override',
                        desc: 'Map-specific weather override and intensity controls.',
                        actions: [
                            { label: 'Clear', kind: 'gold', mode: 'set-weather', weather: 'clear', intensity: 0, mapId: map.id },
                            { label: 'Rain', kind: 'slate', mode: 'set-weather', weather: 'rain', intensity: 0.5, mapId: map.id },
                            { label: 'Save Weather', kind: 'slate', mode: 'save-map-state', tool: 'map-painter', mapId: map.id },
                            { label: 'Open Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=system', mapId: map.id }
                        ],
                        sections: [
                            {
                                title: 'Weather State',
                                facts: [
                                    { label: 'Current', value: currentWeather },
                                    { label: 'Intensity', value: weatherIntensity }
                                ]
                            }
                        ]
                    }
                ]
            };
        },

        _buildUnitsSection: function(engine) {
            var templates = this._getUnitTemplates(engine);
            var keys = Object.keys(templates).sort();
            var children = [
                {
                    id: 'units:create',
                    kind: 'leaf',
                    label: 'Create Unit',
                    meta: 'Definition',
                    inlineForm: { type: 'create-unit' },
                    title: 'Create Unit',
                    desc: 'Create a new unit definition and tune its shared stats, loot, faction, sprites, and sounds.',
                    actions: [
                        { label: 'Open Create Form', kind: 'gold', mode: 'show-inline-form', nodeId: 'units:create' }
                    ],
                    sections: [
                        {
                            title: 'New Unit Definition',
                            facts: [
                                { label: 'Scope', value: 'Story-scoped unit template' },
                                { label: 'Defaults', value: 'Enemy category with starter combat stats' }
                            ]
                        }
                    ]
                }
            ];

            for (var i = 0; i < keys.length; i++) {
                children.push(this._buildUnitNode(keys[i], templates[keys[i]]));
            }

            return {
                id: 'section:units',
                kind: 'section',
                label: 'Units',
                desc: 'Base unit definitions, painter selection, sprites, actions, and sound attachments.',
                children: children
            };
        },

        _buildUnitNode: function(templateId, template) {
            var actionNodes = [];
            var abilities = Array.isArray(template.abilities) ? template.abilities : [];
            var actionDetails = Array.isArray(template.actionDetails) ? template.actionDetails : [];
            for (var i = 0; i < abilities.length; i++) {
                var detail = actionDetails[i] || {};
                actionNodes.push({
                    id: 'unit:' + templateId + ':action:' + abilities[i],
                    kind: 'leaf',
                    label: abilities[i],
                    meta: 'Action',
                    title: (template.name || templateId) + ' - ' + abilities[i],
                    desc: 'Attach frames and sounds for this unit action.',
                    actions: [
                        { label: 'Open Unit Builder', kind: 'gold', mode: 'external', href: 'index.html?tool=builder&builderTab=units' }
                    ],
                    sections: [
                        {
                            title: 'Action Hook',
                            facts: [
                                { label: 'Action', value: abilities[i] },
                                { label: 'Animation', value: detail.anim || 'None' },
                                { label: 'Sound', value: detail.sound || template.soundSet || 'None' }
                            ]
                        }
                    ]
                });
            }

            return {
                id: 'unit:' + templateId,
                kind: 'branch',
                label: template.name || templateId,
                meta: template.category || template.type || 'unit',
                title: template.name || templateId,
                desc: template.description || 'Unit definition',
                actions: [
                    { label: 'Paint This Unit', kind: 'gold', mode: 'select-unit', templateId: templateId },
                    { label: 'Save Unit', kind: 'slate', mode: 'save-unit', templateId: templateId },
                    { label: 'Open Unit Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=units' }
                ],
                sections: [
                    {
                        title: 'Identity',
                        facts: [
                            { label: 'Template', value: templateId },
                            { label: 'Category', value: template.category || 'Unknown' },
                            { label: 'Faction', value: template.defaultFaction || 'None' },
                            { label: 'Sound Set', value: template.soundSet || 'None' }
                        ]
                    }
                ],
                children: [
                    {
                        id: 'unit:' + templateId + ':name',
                        kind: 'leaf',
                        label: 'Name',
                        meta: 'Identity',
                        title: (template.name || templateId) + ' Name',
                        desc: 'Display and identity settings for this unit.',
                        actions: [
                            { label: 'Save Unit', kind: 'gold', mode: 'save-unit', templateId: templateId },
                            { label: 'Open Unit Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=units' }
                        ],
                        sections: [
                            {
                                title: 'Identity',
                                facts: [
                                    { label: 'Name', value: template.name || templateId },
                                    { label: 'Description', value: template.description || 'No description' },
                                    { label: 'Type', value: template.type || 'unit' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'unit:' + templateId + ':stats',
                        kind: 'leaf',
                        label: 'Stat Properties',
                        meta: 'Combat',
                        title: (template.name || templateId) + ' Stats',
                        desc: 'Base numeric properties for this unit.',
                        actions: [
                            { label: 'Save Unit', kind: 'gold', mode: 'save-unit', templateId: templateId },
                            { label: 'Open Unit Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=units' }
                        ],
                        sections: [
                            { title: 'Base Stats', facts: this._statsFacts(template.baseStats) }
                        ]
                    },
                    {
                        id: 'unit:' + templateId + ':loot',
                        kind: 'leaf',
                        label: 'Loot Tables',
                        meta: 'Drops',
                        title: (template.name || templateId) + ' Loot',
                        desc: 'Shared loot and reward tables for this unit.',
                        actions: [
                            { label: 'Save Unit', kind: 'gold', mode: 'save-unit', templateId: templateId },
                            { label: 'Open System Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=system' }
                        ],
                        sections: [
                            {
                                title: 'Loot',
                                facts: [
                                    { label: 'Loot Table', value: template.lootTable || 'None' },
                                    { label: 'Gold Drop', value: template.goldDrop ? (template.goldDrop.min + ' - ' + template.goldDrop.max) : 'None' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'unit:' + templateId + ':faction',
                        kind: 'leaf',
                        label: 'Faction',
                        meta: 'Alignment',
                        title: (template.name || templateId) + ' Faction',
                        desc: 'Default faction and controllability settings.',
                        actions: [
                            { label: 'Save Unit', kind: 'gold', mode: 'save-unit', templateId: templateId },
                            { label: 'Open Factions', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=factions' }
                        ],
                        sections: [
                            {
                                title: 'Faction',
                                facts: [
                                    { label: 'Default Faction', value: template.defaultFaction || 'None' },
                                    { label: 'Controllable', value: template.controllable ? 'Yes' : 'No' },
                                    { label: 'Recruitable', value: template.recruitable ? 'Yes' : 'No' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'unit:' + templateId + ':sprites',
                        kind: 'branch',
                        label: 'Sprite Sheets',
                        meta: 'Art',
                        title: (template.name || templateId) + ' Sprite Sheets',
                        desc: 'Attach base, extended, and manifest-driven sprites to this unit.',
                        children: [
                            this._simpleLeaf('unit:' + templateId + ':sprites:base', 'Base Sprite', 'Sprite', 'Base sprite sheet assignment.', [
                                { label: 'Sprite', value: template.spriteBase || template.sprite || 'None' }
                            ], 'units'),
                            this._simpleLeaf('unit:' + templateId + ':sprites:extended', 'Extended Sprite', 'Sprite', 'Extended action sprite sheet assignment.', [
                                { label: 'Sprite Ext', value: template.spriteExt || 'None' }
                            ], 'units'),
                            this._simpleLeaf('unit:' + templateId + ':sprites:manifest', 'Manifest', 'Frames', 'Manifest links for the attached spritesheets.', [
                                { label: 'Manifest', value: template.manifestKey || 'None' },
                                { label: 'Ext Manifest', value: template.manifestExtKey || 'None' }
                            ], 'units')
                        ]
                    },
                    {
                        id: 'unit:' + templateId + ':actions',
                        kind: 'branch',
                        label: 'Actions',
                        meta: abilities.length + ' actions',
                        title: (template.name || templateId) + ' Actions',
                        desc: 'Frame and sound hooks by action name.',
                        children: actionNodes.length ? actionNodes : [
                            this._simpleLeaf('unit:' + templateId + ':actions:none', 'No Actions Defined', 'Action', 'This unit has no explicit action list yet.', [
                                { label: 'Status', value: 'No action definitions' }
                            ], 'units')
                        ]
                    }
                ]
            };
        },

        _buildNPCSection: function(engine, story) {
            var npcs = this._getNPCs(story);
            var children = [
                {
                    id: 'npcs:create',
                    kind: 'leaf',
                    label: 'Create NPC',
                    meta: 'Hero / NPC',
                    title: 'Create NPC',
                    desc: 'Create an NPC or hero override on top of a base unit definition.',
                    actions: [
                        { label: 'Create NPC', kind: 'gold', mode: 'create-npc' }
                    ],
                    sections: [
                        {
                            title: 'New NPC Override',
                            facts: [
                                { label: 'Base', value: 'Select a unit template during creation' },
                                { label: 'Scope', value: 'Story-scoped character override' }
                            ]
                        }
                    ]
                }
            ];

            for (var i = 0; i < npcs.length; i++) {
                children.push(this._buildNPCNode(npcs[i], story));
            }

            return {
                id: 'section:npcs',
                kind: 'section',
                label: 'NPCs',
                desc: 'Hero and NPC instances built as overrides on top of unit definitions.',
                children: children
            };
        },

        _buildNPCNode: function(npc, story) {
            var dialogues = this._dialoguesForNPC(story, npc.id);
            var baseUnit = npc.unit_template_id || npc.base_unit_id || npc.template_id || 'Not assigned';
            var factionName = this._factionNameById(story, npc.faction_id) || npc.faction_id || 'None';

            return {
                id: 'npc:' + npc.id,
                kind: 'branch',
                label: npc.display_name || npc.name || npc.id,
                meta: npc.behavior || 'npc',
                title: npc.display_name || npc.name || npc.id,
                desc: 'Story-authored NPC or hero override.',
                actions: [
                    { label: 'Save NPC', kind: 'gold', mode: 'save-npc', characterId: npc.id },
                    { label: 'Open NPC Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=npcs' }
                ],
                sections: [
                    {
                        title: 'Overview',
                        facts: [
                            { label: 'Behavior', value: npc.behavior || 'idle' },
                            { label: 'Faction', value: factionName },
                            { label: 'Base Unit', value: baseUnit }
                        ]
                    }
                ],
                children: [
                    this._simpleLeaf('npc:' + npc.id + ':base', 'Base Unit', 'Override Base', 'Select the base unit definition for this NPC.', [
                        { label: 'Base Unit', value: baseUnit }
                    ], 'npcs'),
                    this._simpleLeaf('npc:' + npc.id + ':name', 'Name', 'Identity', 'Identity and visible naming overrides.', [
                        { label: 'Display', value: npc.display_name || npc.name || npc.id },
                        { label: 'Internal', value: npc.name || npc.id }
                    ], 'npcs'),
                    this._simpleLeaf('npc:' + npc.id + ':stats', 'Stat Properties', 'Overrides', 'Numeric override values layered on top of the base unit.', this._npcStatsFacts(npc), 'npcs'),
                    this._simpleLeaf('npc:' + npc.id + ':loot', 'Loot Override', 'Drops', 'NPC-specific loot additions or overrides.', [
                        { label: 'Loot Table', value: npc.loot_table || 'Inherited / none' },
                        { label: 'Gold', value: npc.reward_gold != null ? String(npc.reward_gold) : 'Inherited / none' }
                    ], 'npcs'),
                    this._simpleLeaf('npc:' + npc.id + ':faction', 'Faction Assignment', 'Alignment', 'Faction relationship for this NPC.', [
                        { label: 'Faction', value: factionName }
                    ], 'factions'),
                    this._simpleLeaf('npc:' + npc.id + ':dialogue', 'Dialog & Knowledge', 'Narrative', 'Dialogue trees and knowledge hooks for this NPC.', [
                        { label: 'Dialogues', value: String(dialogues.length) },
                        { label: 'First Dialogue', value: dialogues.length ? (dialogues[0].name || dialogues[0].id) : 'None' }
                    ], 'npcs'),
                    this._simpleLeaf('npc:' + npc.id + ':sprite-audio', 'Sprite / Audio Override', 'Presentation', 'Override sprite sheets and sound hooks for this NPC instance.', [
                        { label: 'Sprite Override', value: npc.sprite_asset_id || npc.sprite_template_id || 'None' },
                        { label: 'Audio Override', value: npc.sound_set || 'None' }
                    ], 'npcs')
                ]
            };
        },

        _buildEventsSection: function(engine, story) {
            var triggers = this.studioData && Array.isArray(this.studioData.map_triggers)
                ? this.studioData.map_triggers.slice()
                : ((this._getFrameWorldEditor() && Array.isArray(this._getFrameWorldEditor().triggers)) ? this._getFrameWorldEditor().triggers : []);
            var quests = this.studioData && Array.isArray(this.studioData.quests)
                ? this.studioData.quests
                : (story && Array.isArray(story.quests) ? story.quests : []);
            var nonQuest = this.studioData && Array.isArray(this.studioData.events)
                ? this.studioData.events.filter(function(event) { return event.event_scope !== 'quest'; })
                : [];

            var triggerChildren = [
                {
                    id: 'events:triggers:create',
                    kind: 'leaf',
                    label: 'Draw New Trigger',
                    meta: 'Canvas tool',
                    title: 'Draw New Trigger',
                    desc: 'Switch to the trigger layer and define a new trigger region on the map.',
                    onSelectAction: { mode: 'frame', tool: 'world-trigger', layer: 'trigger' },
                    actions: [
                        { label: 'Trigger Layer', kind: 'gold', mode: 'frame', tool: 'world-trigger', layer: 'trigger' }
                    ]
                }
            ];
            for (var i = 0; i < triggers.length; i++) {
                triggerChildren.push({
                    id: 'events:trigger:' + i,
                    kind: 'leaf',
                    label: triggers[i].name || ('Trigger ' + (i + 1)),
                    meta: triggers[i].trigger_type || triggers[i].type || 'trigger',
                    mapId: triggers[i].map_id || this.currentMapId,
                    title: triggers[i].name || ('Trigger ' + (i + 1)),
                    desc: 'Spatial trigger definition.',
                    actions: [
                        { label: 'Edit Trigger', kind: 'gold', mode: 'select-trigger', index: this._indexWithinMap(this.studioData && this.studioData.map_triggers ? this.studioData.map_triggers : triggers, triggers[i]), mapId: triggers[i].map_id || this.currentMapId }
                    ],
                    sections: [
                        {
                            title: 'Trigger',
                            facts: [
                                { label: 'Type', value: triggers[i].trigger_type || triggers[i].type || 'on_enter' },
                                { label: 'Area', value: Math.floor(triggers[i].width || 100) + ' x ' + Math.floor(triggers[i].height || 100) },
                                { label: 'One Time', value: (triggers[i].one_time || triggers[i].oneTime) ? 'Yes' : 'No' }
                            ]
                        }
                    ]
                });
            }

            var questChildren = [
                {
                    id: 'events:quests:create',
                    kind: 'leaf',
                    label: 'Create Quest',
                    meta: 'Definition',
                    title: 'Create Quest',
                    desc: 'Create a new quest definition, chain, or dependency.',
                    actions: [
                        { label: 'Create Quest', kind: 'gold', mode: 'create-quest' }
                    ]
                }
            ];
            for (var q = 0; q < quests.length; q++) {
                questChildren.push({
                    id: 'events:quest:' + quests[q].id,
                    kind: 'leaf',
                    label: quests[q].title || quests[q].id,
                    meta: 'Quest',
                    title: quests[q].title || quests[q].id,
                    desc: quests[q].description || 'Quest definition.',
                    actions: [
                        { label: 'Save Quest', kind: 'gold', mode: 'save-quest', questId: quests[q].id },
                        { label: 'Open Quest Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=events' }
                    ],
                    sections: [
                        {
                            title: 'Quest',
                            facts: [
                                { label: 'Prerequisite', value: quests[q].prerequisite_quest_id || 'None' },
                                { label: 'Reward XP', value: String(quests[q].reward_xp || 0) },
                                { label: 'Reward Gold', value: String(quests[q].reward_gold || 0) }
                            ]
                        }
                    ]
                });
            }

            var nonQuestChildren = [
                {
                    id: 'events:nonquest:create',
                    kind: 'leaf',
                    label: 'Create Event',
                    meta: 'Narrative',
                    title: 'Create Non-Quest Event',
                    desc: 'Create a world or narrative event that is not part of the quest chain.',
                    actions: [
                        { label: 'Create Event', kind: 'gold', mode: 'create-event' }
                    ]
                }
            ];
            for (var n = 0; n < nonQuest.length; n++) {
                nonQuestChildren.push({
                    id: 'events:nonquest:' + (nonQuest[n].id || n),
                    kind: 'leaf',
                    label: nonQuest[n].name || nonQuest[n].id || ('Event ' + (n + 1)),
                    meta: nonQuest[n].event_scope || 'Narrative',
                    title: nonQuest[n].name || nonQuest[n].id || ('Event ' + (n + 1)),
                    desc: 'Non-quest narrative event, dialogue, or world interaction.',
                    actions: [
                        { label: 'Save Event', kind: 'gold', mode: 'save-event', eventId: nonQuest[n].id },
                        { label: 'Open Event Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=events' }
                    ],
                    sections: [
                        {
                            title: 'Event',
                            facts: [
                                { label: 'Scope', value: nonQuest[n].event_scope || 'non_quest' },
                                { label: 'Map', value: nonQuest[n].map_id || 'Global' },
                                { label: 'Quest', value: nonQuest[n].quest_id || 'None' }
                            ]
                        }
                    ]
                });
            }
            if (!nonQuestChildren.length) {
                nonQuestChildren.push(this._simpleLeaf('events:nonquest:none', 'No Non-Quest Events', 'Narrative', 'Add dialogues or custom world events to populate this branch.', [
                    { label: 'Status', value: 'No non-quest events yet' }
                ], 'events'));
            }

            return {
                id: 'section:events',
                kind: 'section',
                label: 'Events',
                desc: 'Triggers, quest chains, and non-quest narrative events.',
                children: [
                    {
                        id: 'events:triggers',
                        kind: 'branch',
                        label: 'Triggers',
                        meta: triggers.length + ' items',
                        title: 'Triggers',
                        desc: 'Spatial trigger definitions.',
                        actions: [
                            { label: 'Trigger Layer', kind: 'gold', mode: 'frame', tool: 'world-trigger', layer: 'trigger' }
                        ],
                        children: triggerChildren
                    },
                    {
                        id: 'events:quests',
                        kind: 'branch',
                        label: 'Quests',
                        meta: quests.length + ' items',
                        title: 'Quests',
                        desc: 'Quest definitions, chains, and dependencies.',
                        children: questChildren
                    },
                    {
                        id: 'events:nonquest',
                        kind: 'branch',
                        label: 'Non-Quest Events',
                        meta: nonQuestChildren.length + ' items',
                        title: 'Non-Quest Events',
                        desc: 'Dialogues and world events outside the quest chain.',
                        children: nonQuestChildren
                    }
                ]
            };
        },

        _buildFactionsSection: function(engine, story) {
            var factions = story && Array.isArray(story.factions) ? story.factions : [];
            var membership = this._buildFactionMembership(engine, story);
            var children = [
                {
                    id: 'faction:create',
                    kind: 'leaf',
                    label: 'Create Faction',
                    meta: 'Registry',
                    inlineForm: { type: 'create-faction' },
                    title: 'Create Faction',
                    desc: 'Create a new faction and make it available to units and NPC overrides.',
                    actions: [
                        { label: 'Open Create Form', kind: 'gold', mode: 'show-inline-form', nodeId: 'faction:create' }
                    ],
                    sections: [
                        {
                            title: 'New Faction',
                            facts: [
                                { label: 'Scope', value: 'Story registry' },
                                { label: 'Defaults', value: 'Name, display name, and color' }
                            ]
                        }
                    ]
                }
            ];

            for (var i = 0; i < factions.length; i++) {
                var faction = factions[i];
                var members = membership[faction.id] || { units: [], npcs: [] };
                children.push({
                    id: 'faction:' + faction.id,
                    kind: 'branch',
                    label: faction.display_name || faction.name || faction.id,
                    meta: (members.units.length + members.npcs.length) + ' members',
                    title: faction.display_name || faction.name || faction.id,
                    desc: 'Reverse view of units and NPCs attached to this faction.',
                    actions: [
                        { label: 'Save Faction', kind: 'gold', mode: 'save-faction', factionId: faction.id },
                        { label: 'Open Faction Builder', kind: 'slate', mode: 'external', href: 'index.html?tool=builder&builderTab=factions' }
                    ],
                    sections: [
                        {
                            title: 'Faction',
                            facts: [
                                { label: 'ID', value: faction.id || 'Unknown' },
                                { label: 'Name', value: faction.name || 'Unknown' },
                                { label: 'Color', value: faction.color || 'None' }
                            ]
                        }
                    ],
                    children: [
                        {
                            id: 'faction:' + faction.id + ':units',
                            kind: 'branch',
                            label: 'Units',
                            meta: members.units.length + ' templates',
                            title: 'Faction Units',
                            desc: 'Unit definitions associated with this faction.',
                            children: members.units.length ? members.units : [
                                this._simpleLeaf('faction:' + faction.id + ':units:none', 'No Units', 'Membership', 'No units currently map to this faction.', [
                                    { label: 'Status', value: 'No unit templates' }
                                ], 'factions')
                            ]
                        },
                        {
                            id: 'faction:' + faction.id + ':npcs',
                            kind: 'branch',
                            label: 'NPCs',
                            meta: members.npcs.length + ' instances',
                            title: 'Faction NPCs',
                            desc: 'NPC and hero instances associated with this faction.',
                            children: members.npcs.length ? members.npcs : [
                                this._simpleLeaf('faction:' + faction.id + ':npcs:none', 'No NPCs', 'Membership', 'No NPCs currently map to this faction.', [
                                    { label: 'Status', value: 'No NPC overrides' }
                                ], 'factions')
                            ]
                        }
                    ]
                });
            }

            if (!children.length) {
                children.push(this._simpleLeaf('faction:none', 'No Factions', 'Registry', 'Create factions to organize units and NPCs.', [
                    { label: 'Status', value: 'No factions loaded' }
                ], 'factions'));
            }

            return {
                id: 'section:factions',
                kind: 'section',
                label: 'Factions',
                desc: 'Reverse registry of factions and their associated units and NPCs.',
                children: children
            };
        },

        _buildSystemSection: function(engine) {
            return {
                id: 'section:system',
                kind: 'section',
                label: 'System',
                desc: 'Global registries for weather, animation, audio, and item databases.',
                children: [
                    this._simpleLeaf('system:weather', 'Weather Patterns', 'Global Pool', 'Global weather pattern pool used by maps and events.', [
                        { label: 'Current', value: engine && engine.weatherSystem ? engine.weatherSystem.currentWeather : 'clear' }
                    ], 'system', [
                        { label: 'Open System Builder', kind: 'gold', mode: 'external', href: 'index.html?tool=builder&builderTab=system' }
                    ]),
                    this._buildAnimationRegistryNode(),
                    this._buildAudioLibraryNode(),
                    this._simpleLeaf('system:items', 'Item / Equipment Database', 'Global Pool', 'Shared item and equipment definitions.', [
                        { label: 'Database', value: 'ItemDefinitions.js' }
                    ], 'system', [
                        { label: 'Open System Builder', kind: 'gold', mode: 'external', href: 'index.html?tool=builder&builderTab=system' }
                    ])
                ]
            };
        },

        _buildAnimationRegistryNode: function() {
            var templates = this.studioData && Array.isArray(this.studioData.sprite_templates)
                ? this.studioData.sprite_templates
                : [];
            var children = [
                {
                    id: 'system:animation:create',
                    kind: 'leaf',
                    label: 'Create Sprite Template',
                    meta: 'Registry',
                    title: 'Create Sprite Template',
                    desc: 'Add a reusable sprite manifest template to the shared registry.',
                    actions: [
                        { label: 'Create Template', kind: 'gold', mode: 'create-sprite-template' }
                    ]
                }
            ];

            for (var i = 0; i < templates.length; i++) {
                children.push({
                    id: 'system:animation:' + templates[i].id,
                    kind: 'leaf',
                    label: templates[i].name || templates[i].id,
                    meta: templates[i].category || 'template',
                    title: templates[i].name || templates[i].id,
                    desc: templates[i].description || 'Shared sprite template.',
                    actions: [
                        { label: 'Save Template', kind: 'gold', mode: 'save-sprite-template', templateId: templates[i].id },
                        { label: 'Open Sprite Builder', kind: 'slate', mode: 'external', href: 'sprite-builder.html' }
                    ],
                    sections: [
                        {
                            title: 'Sprite Template',
                            facts: [
                                { label: 'Frame Size', value: (templates[i].frame_w || '?') + ' x ' + (templates[i].frame_h || '?') },
                                { label: 'Category', value: templates[i].category || 'character' },
                                { label: 'Columns', value: String(templates[i].cols_per_row || 14) }
                            ]
                        }
                    ]
                });
            }

            return {
                id: 'system:animation',
                kind: 'branch',
                label: 'Animation Registry',
                meta: templates.length + ' templates',
                title: 'Animation Registry',
                desc: 'Registry of shared animation manifests and frame groupings.',
                children: children
            };
        },

        _buildAudioLibraryNode: function() {
            var projects = this.studioData && Array.isArray(this.studioData.audio_projects)
                ? this.studioData.audio_projects
                : [];
            var children = [
                {
                    id: 'system:audio:create',
                    kind: 'leaf',
                    label: 'Create Audio Project',
                    meta: 'Composer',
                    title: 'Create Audio Project',
                    desc: 'Add a reusable shared music or ambience project to the audio library.',
                    actions: [
                        { label: 'Create Audio Project', kind: 'gold', mode: 'create-audio-project' }
                    ]
                }
            ];

            for (var i = 0; i < projects.length; i++) {
                children.push({
                    id: 'system:audio:' + projects[i].id,
                    kind: 'leaf',
                    label: projects[i].name || projects[i].id,
                    meta: (projects[i].bpm || 120) + ' bpm',
                    title: projects[i].name || projects[i].id,
                    desc: 'Shared audio/composer project.',
                    actions: [
                        { label: 'Save Audio Project', kind: 'gold', mode: 'save-audio-project', projectId: projects[i].id },
                        { label: 'Open Audio Composer', kind: 'slate', mode: 'external', href: 'audio-composer.html' }
                    ],
                    sections: [
                        {
                            title: 'Project',
                            facts: [
                                { label: 'BPM', value: String(projects[i].bpm || 120) },
                                { label: 'Bars', value: String(projects[i].bars || 2) },
                                { label: 'Tracks', value: String(projects[i].track_count || (projects[i].track_names ? projects[i].track_names.length : 0) || 0) }
                            ]
                        }
                    ]
                });
            }

            return {
                id: 'system:audio',
                kind: 'branch',
                label: 'Global Audio Library',
                meta: projects.length + ' projects',
                title: 'Global Audio Library',
                desc: 'Shared audio hooks for units, actions, and ambience.',
                children: children
            };
        },

        _buildAssetNodes: function(filterType) {
            var assets = this.studioData && Array.isArray(this.studioData.assets)
                ? this.studioData.assets
                : [];
            var out = [];
            for (var i = 0; i < assets.length; i++) {
                var asset = assets[i];
                var type = (asset.asset_type || '').toLowerCase();
                if (filterType && type.indexOf(String(filterType).toLowerCase()) === -1) continue;
                out.push({
                    id: 'asset:' + asset.id,
                    kind: 'leaf',
                    label: asset.asset_key || asset.id,
                    meta: asset.asset_type || 'asset',
                    title: asset.asset_key || asset.id,
                    desc: 'Shared story asset entry.',
                    actions: [
                        { label: 'Save Asset', kind: 'gold', mode: 'save-asset', assetId: asset.id }
                    ],
                    sections: [
                        {
                            title: 'Asset',
                            facts: [
                                { label: 'Type', value: asset.asset_type || 'asset' },
                                { label: 'Source', value: asset.source_type || 'unknown' },
                                { label: 'URL', value: asset.source_url || 'None' }
                            ]
                        }
                    ]
                });
            }
            return out;
        },

        _simpleLeaf: function(id, label, meta, desc, facts, builderTab, actions) {
            return {
                id: id,
                kind: 'leaf',
                label: label,
                meta: meta,
                title: label,
                desc: desc,
                actions: actions || [
                    { label: 'Open Builder', kind: 'gold', mode: 'external', href: 'index.html?tool=builder&builderTab=' + encodeURIComponent(builderTab || 'story') }
                ],
                sections: [
                    {
                        title: label,
                        facts: facts || []
                    }
                ]
            };
        },

        _buildZoneNodes: function(engine, mapId) {
            var zones = this.studioData && Array.isArray(this.studioData.map_zones)
                ? this._filterByMapId(this.studioData.map_zones, mapId || this.currentMapId)
                : ((this._getFrameWorldEditor() && Array.isArray(this._getFrameWorldEditor().zones)) ? this._getFrameWorldEditor().zones : []);
            var nodes = [];
            for (var i = 0; i < zones.length; i++) {
                var zone = zones[i];
                nodes.push({
                    id: 'zone:' + i,
                    kind: 'leaf',
                    mapId: mapId || zone.map_id || this.currentMapId,
                    label: zone.name || ('Zone ' + (i + 1)),
                    meta: zone.zoneType || 'zone',
                    title: zone.name || ('Zone ' + (i + 1)),
                    desc: 'Zone definition for the current map.',
                    actions: [
                        { label: 'Edit Zone', kind: 'gold', mode: 'select-zone', index: i, mapId: mapId || zone.map_id || this.currentMapId }
                    ],
                    sections: [
                        {
                            title: 'Zone',
                            facts: [
                                { label: 'Type', value: zone.zone_type || zone.zoneType || 'door' },
                                { label: 'Target Map', value: zone.target_map_id || zone.targetMap || 'None' },
                                { label: 'Target Spawn', value: zone.target_spawn_id || zone.targetSpawnId || 'default' }
                            ]
                        }
                    ]
                });
            }
            return nodes;
        },

        _getMaps: function(engine, story) {
            if (this.studioData && Array.isArray(this.studioData.maps) && this.studioData.maps.length) {
                return this.studioData.maps.map(function(map, index) {
                    return {
                        id: map.id || ('map_' + index),
                        label: map.name || map.label || map.id || ('Map ' + (index + 1)),
                        name: map.name || map.label || map.id || ('Map ' + (index + 1)),
                        width: map.width || 64,
                        height: map.height || 64,
                        isEntryPoint: !!(map.is_entry_map || map.isEntryPoint),
                        tileset_id: map.tileset_id || null,
                        tileset_path: map.tileset_path || null
                    };
                });
            }

            var maps = [];
            var scenes = story && Array.isArray(story.scenes) ? story.scenes : [];
            for (var i = 0; i < scenes.length; i++) {
                maps.push({
                    id: scenes[i].id || ('scene_' + i),
                    label: scenes[i].name || scenes[i].id || ('Map ' + (i + 1)),
                    width: scenes[i].map_width || (engine && engine.tileMap ? engine.tileMap.width : 64),
                    height: scenes[i].map_height || (engine && engine.tileMap ? engine.tileMap.height : 64),
                    isEntryPoint: !!scenes[i].is_entry_point
                });
            }

            if (!maps.length && engine && engine.tileMap) {
                maps.push(this._getCurrentMap(engine, story));
            }

            return maps;
        },

        _getCurrentMap: function(engine, story) {
            if (this.currentMapId && this.studioData && Array.isArray(this.studioData.maps)) {
                for (var i = 0; i < this.studioData.maps.length; i++) {
                    if (this.studioData.maps[i].id === this.currentMapId) {
                        return {
                            id: this.studioData.maps[i].id,
                            label: this.studioData.maps[i].name || this.studioData.maps[i].label || this.studioData.maps[i].id,
                            width: this.studioData.maps[i].width || 64,
                            height: this.studioData.maps[i].height || 64,
                            isEntryPoint: !!(this.studioData.maps[i].is_entry_map || this.studioData.maps[i].isEntryPoint)
                        };
                    }
                }
            }
            var tileMap = engine && engine.tileMap ? engine.tileMap : null;
            var label = tileMap && tileMap.name ? tileMap.name : 'Current Surface';
            return {
                id: tileMap && tileMap.name ? tileMap.name : 'current_surface',
                label: label,
                width: tileMap && tileMap.width ? tileMap.width : (story && story.engine_configs ? story.engine_configs.default_map_width : 64),
                height: tileMap && tileMap.height ? tileMap.height : (story && story.engine_configs ? story.engine_configs.default_map_height : 64),
                isEntryPoint: true
            };
        },

        _mapMeta: function(map, engine) {
            if (!map) return 'Blank authoring surface.';
            return map.width + ' x ' + map.height + ' tiles on the live studio surface.';
        },

        _terrainFacts: function(story, map) {
            var ec = story && story.engine_configs ? story.engine_configs : {};
            return [
                { label: 'Map Width', value: String(map.width) },
                { label: 'Map Height', value: String(map.height) },
                { label: 'Water Level', value: this._fmt(ec.terrain_water_level != null ? ec.terrain_water_level : 0.22) },
                { label: 'Hill Level', value: this._fmt(ec.terrain_hill_level != null ? ec.terrain_hill_level : 0.78) },
                { label: 'Mountain Level', value: this._fmt(ec.terrain_mountain_level != null ? ec.terrain_mountain_level : 0.88) },
                { label: 'Elevation Scale', value: this._fmt(ec.terrain_elevation_scale != null ? ec.terrain_elevation_scale : 0.008) }
            ];
        },

        _collisionCount: function(engine) {
            if (!engine || !engine.tileMap || !engine.tileMap.collisionData) return 0;
            var count = 0;
            for (var i = 0; i < engine.tileMap.collisionData.length; i++) {
                if (engine.tileMap.collisionData[i]) count++;
            }
            return count;
        },

        _getUnitTemplates: function(engine) {
            if (this.studioData && Array.isArray(this.studioData.unit_templates)) {
                return this._normalizeStudioUnitTemplates(this.studioData.unit_templates);
            }
            try {
                if (this.refs.frame && this.refs.frame.contentWindow && this.refs.frame.contentWindow.RealmKit && this.refs.frame.contentWindow.RealmKit.UnitTemplates) {
                    return this.refs.frame.contentWindow.RealmKit.UnitTemplates;
                }
            } catch (e) {}
            return window.RealmKit && window.RealmKit.UnitTemplates ? window.RealmKit.UnitTemplates : {};
        },

        _getNPCs: function(story) {
            if (this.studioData && Array.isArray(this.studioData.characters)) {
                return this.studioData.characters.slice();
            }
            return story && Array.isArray(story.characters) ? story.characters.slice() : [];
        },

        _statsFacts: function(stats) {
            if (!stats) return [{ label: 'Stats', value: 'No stats defined' }];
            var order = ['hp', 'maxHp', 'mp', 'maxMp', 'attack', 'defense', 'speed', 'critChance', 'critMultiplier', 'str', 'dex', 'con', 'int', 'wis', 'cha'];
            var facts = [];
            for (var i = 0; i < order.length; i++) {
                if (stats[order[i]] == null) continue;
                facts.push({ label: order[i], value: String(stats[order[i]]) });
            }
            return facts.length ? facts : [{ label: 'Stats', value: 'No stats defined' }];
        },

        _npcStatsFacts: function(npc) {
            var pairs = [
                { label: 'HP', value: npc.base_hp },
                { label: 'Attack', value: npc.base_attack },
                { label: 'Defense', value: npc.base_defense },
                { label: 'Speed', value: npc.base_speed }
            ];
            var facts = [];
            for (var i = 0; i < pairs.length; i++) {
                if (pairs[i].value == null) continue;
                facts.push({ label: pairs[i].label, value: String(pairs[i].value) });
            }
            return facts.length ? facts : [{ label: 'Overrides', value: 'No stat overrides defined' }];
        },

        _dialoguesForNPC: function(story, characterId) {
            var dialogues = story && Array.isArray(story.dialogues) ? story.dialogues : [];
            var out = [];
            for (var i = 0; i < dialogues.length; i++) {
                if (dialogues[i].character_id === characterId) {
                    out.push(dialogues[i]);
                }
            }
            return out;
        },

        _buildFactionMembership: function(engine, story) {
            var factions = story && Array.isArray(story.factions) ? story.factions : [];
            var membership = {};
            for (var i = 0; i < factions.length; i++) {
                membership[factions[i].id] = { units: [], npcs: [] };
            }

            var templates = this._getUnitTemplates(engine);
            var templateKeys = Object.keys(templates);
            for (var t = 0; t < templateKeys.length; t++) {
                var templateId = templateKeys[t];
                var template = templates[templateId];
                var factionId = this._matchFactionId(factions, template.defaultFaction);
                if (!factionId || !membership[factionId]) continue;
                membership[factionId].units.push({
                    id: 'faction:' + factionId + ':unit:' + templateId,
                    kind: 'leaf',
                    label: template.name || templateId,
                    meta: template.category || 'unit',
                    title: template.name || templateId,
                    desc: 'Unit template associated with this faction.',
                    actions: [
                        { label: 'Paint This Unit', kind: 'gold', mode: 'select-unit', templateId: templateId }
                    ],
                    sections: [
                        {
                            title: 'Unit',
                            facts: [
                                { label: 'Template', value: templateId },
                                { label: 'Faction', value: template.defaultFaction || 'None' }
                            ]
                        }
                    ]
                });
            }

            var npcs = this._getNPCs(story);
            for (var n = 0; n < npcs.length; n++) {
                var npc = npcs[n];
                if (!membership[npc.faction_id]) continue;
                membership[npc.faction_id].npcs.push({
                    id: 'faction:' + npc.faction_id + ':npc:' + npc.id,
                    kind: 'leaf',
                    label: npc.display_name || npc.name || npc.id,
                    meta: npc.behavior || 'npc',
                    title: npc.display_name || npc.name || npc.id,
                    desc: 'NPC associated with this faction.',
                    actions: [
                        { label: 'Open NPC Builder', kind: 'gold', mode: 'external', href: 'index.html?tool=builder&builderTab=npcs' }
                    ],
                    sections: [
                        {
                            title: 'NPC',
                            facts: [
                                { label: 'Behavior', value: npc.behavior || 'idle' },
                                { label: 'Faction', value: this._factionNameById(story, npc.faction_id) || npc.faction_id }
                            ]
                        }
                    ]
                });
            }

            return membership;
        },

        _matchFactionId: function(factions, value) {
            if (!value) return null;
            var target = String(value).toLowerCase();
            for (var i = 0; i < factions.length; i++) {
                var faction = factions[i];
                if (!faction) continue;
                if (String(faction.id || '').toLowerCase() === target) return faction.id;
                if (String(faction.name || '').toLowerCase() === target) return faction.id;
                if (String(faction.display_name || '').toLowerCase() === target) return faction.id;
            }
            return null;
        },

        _factionNameById: function(story, factionId) {
            var factions = story && Array.isArray(story.factions) ? story.factions : [];
            for (var i = 0; i < factions.length; i++) {
                if (factions[i].id === factionId) {
                    return factions[i].display_name || factions[i].name || factions[i].id;
                }
            }
            return null;
        },

        _characterNameById: function(story, characterId) {
            var characters = story && Array.isArray(story.characters) ? story.characters : [];
            for (var i = 0; i < characters.length; i++) {
                if (characters[i].id === characterId) {
                    return characters[i].display_name || characters[i].name || characters[i].id;
                }
            }
            return null;
        },

        _getStory: function(engine) {
            if (this.studioData && this.studioData.story) {
                var hydrated = Object.assign({}, this.studioData.story);
                hydrated.maps = this.studioData.maps || [];
                hydrated.characters = this.studioData.characters || [];
                hydrated.quests = this.studioData.quests || [];
                hydrated.dialogues = this.studioData.dialogues || [];
                hydrated.factions = this.studioData.factions || [];
                hydrated.faction_relations = this.studioData.faction_relations || [];
                return hydrated;
            }
            if (engine && engine.currentStory) return engine.currentStory;
            if (engine && engine.storyBuilder && engine.storyBuilder.storyData) return engine.storyBuilder.storyData;
            if (window.RealmKit && RealmKit.DefaultStory) return RealmKit.DefaultStory;
            return null;
        },

        _ensureExpandedState: function(nodes) {
            for (var i = 0; i < nodes.length; i++) {
                this._ensureNodeExpanded(nodes[i], 0);
            }
        },

        _ensureNodeExpanded: function(node, depth) {
            if (this.expanded[node.id] === undefined) {
                this.expanded[node.id] = depth < 2 || node.kind === 'section';
            }
            if (node.children) {
                for (var i = 0; i < node.children.length; i++) {
                    this._ensureNodeExpanded(node.children[i], depth + 1);
                }
            }
        },

        _findNodeById: function(nodeId, nodes) {
            if (!nodeId || !nodes) return null;
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].id === nodeId) return nodes[i];
                if (nodes[i].children) {
                    var child = this._findNodeById(nodeId, nodes[i].children);
                    if (child) return child;
                }
            }
            return null;
        },

        _findFirstNode: function(nodes) {
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].children && nodes[i].children.length) {
                    return this._findFirstNode(nodes[i].children);
                }
                return nodes[i];
            }
            return null;
        },

        _syncSurfaceCopy: function() {
            var meta = this._toolMeta(this.activeTool);
            if (this.refs.plaque) this.refs.plaque.textContent = meta.title || this._surfaceName(this.activeTool);
            if (this.refs.note) this.refs.note.textContent = meta.desc || '';
        },

        _launchFrameTool: function(tool, options) {
            if (!this._postToFrame(tool, options)) {
                this.refs.frame.src = this._toolUrl(tool);
            }
        },

        _getFrameEngine: function() {
            try {
                if (!this.refs.frame || !this.refs.frame.contentWindow) return null;
                return this.refs.frame.contentWindow.engine || null;
            } catch (e) {
                return null;
            }
        },

        _getFrameMapEditor: function() {
            var engine = this._getFrameEngine();
            return engine && engine.mapEditor ? engine.mapEditor : null;
        },

        _getFrameWorldEditor: function() {
            var engine = this._getFrameEngine();
            return engine && engine.worldEditor ? engine.worldEditor : null;
        },

        _setFrameUnitTemplate: function(templateId) {
            var editor = this._getFrameMapEditor();
            if (!editor) return;
            editor.selectedEntityTemplate = templateId;
            if (editor._e && editor._e['me-entity-template']) {
                editor._e['me-entity-template'].value = templateId;
            }
            if (editor._updateStatus) {
                editor._updateStatus('Unit template: ' + templateId);
            }
        },

        _selectWorldEditorNode: function(type, index) {
            var editor = this._getFrameWorldEditor();
            if (!editor || typeof editor.select !== 'function') return;
            editor.select(type, index);
        },

        _setWeather: function(type, intensity) {
            var engine = this._getFrameEngine();
            if (!engine || !engine.weatherSystem || typeof engine.weatherSystem.setWeather !== 'function') return;
            engine.weatherSystem.setWeather(type, intensity, 0);
        },

        _startPreviewLoop: function() {
            var self = this;
            if (this._previewLoop) return;
            this._previewLoop = window.setInterval(function() {
                self._renderMinimapPreview();
            }, 180);
        },

        _renderMinimapPreview: function() {
            var canvas = this.refs.minimapCanvas;
            if (!canvas) return;
            var ctx = canvas.getContext('2d');
            if (!ctx) return;

            var engine = this._getFrameEngine();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#dcc79a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (!engine || !engine.tileMap || !engine.tileMap.layers || !engine.tileMap.layers[0] || !engine.tileMap.layers[0].data) {
                ctx.fillStyle = '#6a5040';
                ctx.font = '8px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('No Map', canvas.width / 2, canvas.height / 2);
                if (this.refs.minimapSize) this.refs.minimapSize.textContent = '--';
                return;
            }

            var mapW = engine.tileMap.width || 1;
            var mapH = engine.tileMap.height || 1;
            var data = engine.tileMap.layers[0].data;
            var pad = 6;
            var drawW = canvas.width - pad * 2;
            var drawH = canvas.height - pad * 2;
            var scale = Math.min(drawW / mapW, drawH / mapH);
            var mmW = Math.max(1, Math.floor(mapW * scale));
            var mmH = Math.max(1, Math.floor(mapH * scale));
            var offX = Math.floor((canvas.width - mmW) / 2);
            var offY = Math.floor((canvas.height - mmH) / 2);
            var pixel = Math.max(1, Math.ceil(scale));
            var tileColors = this._tileColors();

            ctx.fillStyle = '#eadfbf';
            ctx.fillRect(offX - 2, offY - 2, mmW + 4, mmH + 4);
            ctx.fillStyle = '#d6c08e';
            ctx.fillRect(offX, offY, mmW, mmH);

            for (var y = 0; y < mapH; y++) {
                for (var x = 0; x < mapW; x++) {
                    var tileId = data[y * mapW + x] || 0;
                    ctx.fillStyle = tileColors[tileId] || '#7a8a6a';
                    ctx.fillRect(
                        offX + Math.floor(x * scale),
                        offY + Math.floor(y * scale),
                        pixel,
                        pixel
                    );
                }
            }

            if (engine.renderer && engine.renderer.viewport && engine.mapBounds) {
                var vp = engine.renderer.viewport;
                var mapBounds = engine.mapBounds;
                var vx = offX + Math.floor((vp.x / mapBounds.width) * mmW);
                var vy = offY + Math.floor((vp.y / mapBounds.height) * mmH);
                var vw = Math.max(4, Math.floor((vp.viewWidth / mapBounds.width) * mmW));
                var vh = Math.max(4, Math.floor((vp.viewHeight / mapBounds.height) * mmH));
                ctx.fillStyle = 'rgba(255,244,210,0.14)';
                ctx.fillRect(vx, vy, vw, vh);
                ctx.strokeStyle = 'rgba(255,240,200,0.9)';
                ctx.lineWidth = 1;
                ctx.strokeRect(vx, vy, vw, vh);
            }

            ctx.strokeStyle = '#7a6040';
            ctx.lineWidth = 2;
            ctx.strokeRect(offX - 1, offY - 1, mmW + 2, mmH + 2);

            if (this.refs.minimapSize) {
                this.refs.minimapSize.textContent = mapW + 'x' + mapH;
            }
        },

        _handleMinimapClick: function(event) {
            var canvas = this.refs.minimapCanvas;
            var engine = this._getFrameEngine();
            if (!canvas || !engine || !engine.renderer || !engine.renderer.viewport || !engine.mapBounds) return;

            var rect = canvas.getBoundingClientRect();
            var mapW = engine.tileMap && engine.tileMap.width ? engine.tileMap.width : 1;
            var mapH = engine.tileMap && engine.tileMap.height ? engine.tileMap.height : 1;
            var pad = 6;
            var drawW = canvas.width - pad * 2;
            var drawH = canvas.height - pad * 2;
            var scale = Math.min(drawW / mapW, drawH / mapH);
            var mmW = Math.max(1, Math.floor(mapW * scale));
            var mmH = Math.max(1, Math.floor(mapH * scale));
            var offX = Math.floor((canvas.width - mmW) / 2);
            var offY = Math.floor((canvas.height - mmH) / 2);

            var localX = ((event.clientX - rect.left) / rect.width) * canvas.width;
            var localY = ((event.clientY - rect.top) / rect.height) * canvas.height;
            if (localX < offX || localX > offX + mmW || localY < offY || localY > offY + mmH) return;

            var relX = (localX - offX) / mmW;
            var relY = (localY - offY) / mmH;
            var targetWorldX = relX * engine.mapBounds.width;
            var targetWorldY = relY * engine.mapBounds.height;
            var vp = engine.renderer.viewport;

            var nextX = Math.max(0, Math.min(targetWorldX - vp.viewWidth / 2, Math.max(0, engine.mapBounds.width - vp.viewWidth)));
            var nextY = Math.max(0, Math.min(targetWorldY - vp.viewHeight / 2, Math.max(0, engine.mapBounds.height - vp.viewHeight)));

            if (engine.camera) {
                engine.camera.x = nextX;
                engine.camera.y = nextY;
            }
            vp.x = nextX;
            vp.y = nextY;
        },

        _refreshFrameLayout: function() {
            var self = this;
            [0, 80, 180, 320].forEach(function(delay) {
                window.setTimeout(function() {
                    self._resizeEmbeddedSurface();
                }, delay);
            });
        },

        _resizeEmbeddedSurface: function() {
            if (!this.refs.frame || !this.refs.frame.contentWindow) return;
            try {
                var win = this.refs.frame.contentWindow;
                if (typeof win.dispatchEvent === 'function' && typeof win.Event === 'function') {
                    win.dispatchEvent(new win.Event('resize'));
                }

                var engine = win.engine;
                if (engine && engine.renderer && typeof engine.renderer.resize === 'function') {
                    engine.renderer.resize();
                }
                if (
                    engine &&
                    engine.camera &&
                    typeof engine.camera.resize === 'function' &&
                    engine.renderer &&
                    engine.renderer.viewport
                ) {
                    engine.camera.resize(
                        engine.renderer.viewport.viewWidth,
                        engine.renderer.viewport.viewHeight
                    );
                }
            } catch (e) {
                console.warn('[RealmStudio] Surface resize sync failed:', e);
            }
        },

        _tileColors: function() {
            return {
                0: '#1a5276', 1: '#2980b9', 2: '#f9e79f', 3: '#27ae60',
                4: '#58d68d', 5: '#a67c52', 6: '#7f8c8d', 7: '#6e6658',
                8: '#85929e', 9: '#ecf0f1', 10: '#b7950b', 11: '#b7950b',
                12: '#b7950b', 13: '#8e7d32', 14: '#8e7d32', 15: '#5dade2',
                16: '#7d6608', 17: '#5d4037', 18: '#c39b77', 19: '#8d6e63',
                20: '#d35400', 21: '#145a32', 22: '#196f3d', 23: '#616a6b',
                24: '#d4ac0d', 25: '#0b5345', 26: '#1e8449', 27: '#d7b66a',
                28: '#d6eaf8', 29: '#7dcea0', 30: '#7fbf58', 31: '#884ea0'
            };
        },

        _postToFrame: function(tool, options) {
            try {
                var win = this.refs.frame.contentWindow;
                if (!win) return false;
                var payload = {
                    type: 'realm-studio-command',
                    command: 'launch-tool',
                    tool: tool,
                    layer: options && options.layer ? options.layer : ''
                };
                if (win.realmStudioBridge && typeof win.realmStudioBridge.launchTool === 'function') {
                    win.realmStudioBridge.launchTool(tool, payload);
                    return true;
                }
                if (this.frameReady) {
                    win.postMessage(payload, '*');
                    return true;
                }
            } catch (e) {}
            return false;
        },

        _sendActiveTool: function(force) {
            if (force || this.frameReady) {
                this._launchFrameTool(this.activeTool, this._toolMeta(this.activeTool));
            }
        },

        _toolUrl: function(tool) {
            return 'index.html?studio=1&tool=' + encodeURIComponent(tool);
        },

        _toolMeta: function(tool) {
            if (tool === 'map-painter') return { title: 'Terrain Painter', desc: 'Paint terrain directly on the live map surface.' };
            if (tool === 'map-collision') return { title: 'Collision Painter', desc: 'Paint blocked movement cells directly on the live map surface.' };
            if (tool === 'map-units') return { title: 'Unit Painter', desc: 'Place unit instances directly onto the live map surface.' };
            if (tool === 'world-zone') return { title: 'Zone Authoring', desc: 'Draw and edit zone rectangles directly on the map.' };
            if (tool === 'world-trigger') return { title: 'Trigger Authoring', desc: 'Draw and edit trigger rectangles directly on the map.' };
            if (tool === 'world-spawner') return { title: 'Spawner Authoring', desc: 'Place encounter and spawn anchors directly on the map.' };
            return { title: this._surfaceName(tool), desc: '' };
        },

        _surfaceName: function(tool) {
            if (tool === 'map-painter') return 'Terrain Painter';
            if (tool === 'map-collision') return 'Collision Painter';
            if (tool === 'map-units') return 'Unit Painter';
            if (tool === 'world-zone') return 'Zone Authoring';
            if (tool === 'world-trigger') return 'Trigger Authoring';
            if (tool === 'world-spawner') return 'Spawner Authoring';
            return tool;
        },

        _nodeTypeLabel: function(kind) {
            if (kind === 'section') return 'Section';
            if (kind === 'branch') return 'Folder';
            return 'Detail';
        },

        _findByMapId: function(list, mapId) {
            if (!Array.isArray(list)) return null;
            for (var i = 0; i < list.length; i++) {
                if (list[i] && list[i].map_id === mapId) return list[i];
            }
            return null;
        },

        _filterByMapId: function(list, mapId) {
            if (!Array.isArray(list)) return [];
            return list.filter(function(item) {
                return item && item.map_id === mapId;
            });
        },

        _countTruthy: function(values) {
            if (!Array.isArray(values)) return 0;
            var count = 0;
            for (var i = 0; i < values.length; i++) {
                if (values[i]) count++;
            }
            return count;
        },

        _indexWithinMap: function(list, item) {
            if (!Array.isArray(list) || !item) return 0;
            var mapId = item.map_id || this.currentMapId;
            var index = 0;
            for (var i = 0; i < list.length; i++) {
                var candidate = list[i];
                if (!candidate || (candidate.map_id || this.currentMapId) !== mapId) continue;
                if (candidate === item || (candidate.id && item.id && candidate.id === item.id)) {
                    return index;
                }
                index++;
            }
            return 0;
        },

        _normalizeStudioUnitTemplates: function(rows) {
            var out = {};
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (!row || !row.id) continue;
                var skills = Array.isArray(row.skills) ? row.skills : [];
                var actionProfile = row.action_profile_json || {};
                out[row.id] = {
                    id: row.id,
                    name: row.display_name || row.name || row.id,
                    category: row.category || 'unit',
                    description: row.description || '',
                    defaultFaction: row.faction_display_name || row.faction_name || row.faction_id || null,
                    soundSet: row.audio_profile_json && row.audio_profile_json.sound_set ? row.audio_profile_json.sound_set : null,
                    spriteBase: row.sprite_asset_key_v2 || row.sprite_asset_key || row.sprite_asset_id || null,
                    spriteExt: row.sprite_ext_asset_key_v2 || row.sprite_ext_asset_key || row.sprite_ext_asset_id || null,
                    manifestKey: row.sprite_template_name || null,
                    manifestExtKey: row.sprite_ext_template_name || null,
                    lootTable: row.loot_table_json && row.loot_table_json.table ? row.loot_table_json.table : (row.loot_table_id || null),
                    goldDrop: row.loot_table_json && row.loot_table_json.gold_drop ? row.loot_table_json.gold_drop : null,
                    abilities: skills.map(function(skill) { return skill.display_name || skill.name || skill.anim_name || skill.id; }),
                    baseStats: {
                        hp: row.base_hp,
                        mp: row.base_mp,
                        attack: row.base_attack,
                        defense: row.base_defense,
                        speed: row.base_speed,
                        agility: row.base_agility,
                        aggroRange: row.aggro_range,
                        attackRange: row.attack_range,
                        attackCooldown: row.attack_cooldown_ms
                    },
                    controllable: actionProfile.controllable || false,
                    recruitable: actionProfile.recruitable || false,
                    actionDetails: skills.map(function(skill) {
                        return {
                            label: skill.display_name || skill.name || skill.id,
                            sound: skill.sound_effect || (row.audio_profile_json && row.audio_profile_json[skill.anim_name]) || null,
                            anim: skill.anim_name || null
                        };
                    })
                };
            }
            return out;
        },

        _createMapRecord: async function() {
            if (!(await this._ensureStudioContext())) return;

            var name = window.prompt('Map name?', 'New Map');
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var width = parseInt(window.prompt('Map width (tiles)?', '64'), 10);
            var height = parseInt(window.prompt('Map height (tiles)?', '64'), 10);
            var mapType = window.prompt('Map type?', 'overworld');

            var created = await this.db.createMap({
                story_id: this.storyId,
                name: name,
                width: isNaN(width) ? 64 : Math.max(8, width),
                height: isNaN(height) ? 64 : Math.max(8, height),
                map_type: (mapType || 'overworld').trim() || 'overworld'
            });

            this.currentMapId = created.id;
            await this._reloadStudioData('map:' + created.id);
        },

        _createUnitTemplateRecord: async function(seedData) {
            if (!(await this._ensureStudioContext())) return;

            var name;
            var displayName;
            var category;
            var factionId;
            var description;
            var baseHp;
            var baseMp;
            var baseAttack;
            var baseDefense;
            var baseSpeed;

            if (seedData && typeof seedData === 'object') {
                name = (seedData.name || '').trim();
                if (!name) return;
                displayName = seedData.display_name;
                category = seedData.category;
                factionId = seedData.faction_id;
                description = seedData.description;
                baseHp = seedData.base_hp;
                baseMp = seedData.base_mp;
                baseAttack = seedData.base_attack;
                baseDefense = seedData.base_defense;
                baseSpeed = seedData.base_speed;
            } else {
                name = window.prompt('Unit template name?', 'new_unit');
                if (name == null) return;
                name = name.trim();
                if (!name) return;

                displayName = window.prompt('Display name?', name);
                category = window.prompt('Category?', 'enemy');
                factionId = window.prompt('Faction ID (optional)?', '');
                description = window.prompt('Description (optional)?', '');
                baseHp = 40;
                baseMp = 0;
                baseAttack = 10;
                baseDefense = 5;
                baseSpeed = 80;
            }

            var created = await this.db.createUnitTemplate({
                story_id: this.storyId,
                name: name,
                display_name: (displayName || name).trim() || name,
                category: (category || 'enemy').trim() || 'enemy',
                faction_id: factionId ? factionId.trim() : null,
                description: description ? description.trim() : null,
                base_hp: baseHp,
                base_mp: baseMp,
                base_attack: baseAttack,
                base_defense: baseDefense,
                base_speed: baseSpeed
            });

            await this._reloadStudioData('unit:' + created.id);
        },

        _createNPCRecord: async function() {
            if (!(await this._ensureStudioContext())) return;

            var templates = this._getUnitTemplates(this._getFrameEngine());
            var templateIds = Object.keys(templates);
            var defaultTemplateId = templateIds.length ? templateIds[0] : '';
            var name = window.prompt('NPC name?', 'new_npc');
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var templatePrompt = 'Base unit template id?' + (templateIds.length ? '\n\nAvailable:\n' + templateIds.slice(0, 20).join(', ') : '');
            var templateId = window.prompt(templatePrompt, defaultTemplateId);
            if (templateId == null) return;
            templateId = templateId.trim();

            var displayName = window.prompt('Display name?', name);
            var behavior = window.prompt('Behavior?', 'idle');
            var factionId = window.prompt('Faction ID (optional)?', '');

            var created = await this.db.createCharacter(this.storyId, {
                name: name,
                display_name: (displayName || name).trim() || name,
                unit_template_id: templateId || null,
                behavior: (behavior || 'idle').trim() || 'idle',
                faction_id: factionId ? factionId.trim() : null
            });

            await this._reloadStudioData('npc:' + created.id);
        },

        _createFactionRecord: async function(seedData) {
            if (!(await this._ensureStudioContext())) return;

            var name;
            var displayName;
            var color;
            if (seedData && typeof seedData === 'object') {
                name = (seedData.name || '').trim();
                if (!name) return;
                displayName = seedData.display_name;
                color = seedData.color;
            } else {
                name = window.prompt('Faction key?', 'new_faction');
                if (name == null) return;
                name = name.trim();
                if (!name) return;

                displayName = window.prompt('Display name?', name);
                color = window.prompt('Color?', '#ffffff');
            }

            var created = await this.db.createFaction({
                story_id: this.storyId,
                name: name,
                display_name: (displayName || name).trim() || name,
                color: (color || '#ffffff').trim() || '#ffffff'
            });

            await this._reloadStudioData('faction:' + created.id);
        },

        _createQuestRecord: async function() {
            if (!(await this._ensureStudioContext())) return;

            var title = window.prompt('Quest title?', 'New Quest');
            if (title == null) return;
            title = title.trim();
            if (!title) return;

            var description = window.prompt('Quest description?', '');
            var rewardXp = parseInt(window.prompt('Reward XP?', '0'), 10);
            var rewardGold = parseInt(window.prompt('Reward Gold?', '0'), 10);

            var created = await this.db.createQuest(this.storyId, {
                title: title,
                description: description ? description.trim() : null,
                reward_xp: isNaN(rewardXp) ? 0 : rewardXp,
                reward_gold: isNaN(rewardGold) ? 0 : rewardGold
            });

            await this._reloadStudioData('events:quest:' + created.id);
        },

        _createEventRecord: async function() {
            if (!(await this._ensureStudioContext())) return;

            var name = window.prompt('Event name?', 'New Event');
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var scope = window.prompt('Event scope?', 'non_quest');
            var description = window.prompt('Event description?', '');

            var created = await this.db.createEvent({
                story_id: this.storyId,
                map_id: this.currentMapId || null,
                name: name,
                event_scope: (scope || 'non_quest').trim() || 'non_quest',
                description: description ? description.trim() : null
            });

            await this._reloadStudioData('events:nonquest:' + (created.id || 'create'));
        },

        _createAssetRecord: async function(action) {
            if (!(await this._ensureStudioContext())) return;

            var assetType = (action && action.assetType) || 'tileset';
            var assetKey = window.prompt('Asset key?', assetType + '_asset');
            if (assetKey == null) return;
            assetKey = assetKey.trim();
            if (!assetKey) return;

            var resolvedType = window.prompt('Asset type?', assetType);
            if (resolvedType == null) return;
            resolvedType = (resolvedType || assetType).trim() || assetType;

            var sourceType = window.prompt('Source type? (url / procedural)', 'url');
            if (sourceType == null) return;
            sourceType = (sourceType || 'url').trim() || 'url';

            var sourceUrl = '';
            if (sourceType === 'url') {
                sourceUrl = window.prompt('Source URL?', '') || '';
            }

            var tileSize = this._promptInt('Tile size (optional)?', 32);
            var created = await this.db.createAsset(this.storyId, {
                asset_key: assetKey,
                asset_type: resolvedType,
                source_type: sourceType,
                source_url: sourceType === 'url' ? (sourceUrl.trim() || null) : null,
                proc_tile_size: tileSize || null
            });

            await this._reloadStudioData(action && action.mapId ? ('map:' + action.mapId + ':tilesets') : ('asset:' + created.id));
        },

        _saveAssetRecord: async function(assetId) {
            if (!(await this._ensureStudioContext()) || !assetId) return;
            var record = await this.db.getAsset(assetId);
            if (!record) return;

            var assetKey = window.prompt('Asset key?', record.asset_key || assetId);
            if (assetKey == null) return;
            assetKey = assetKey.trim();
            if (!assetKey) return;

            var assetType = window.prompt('Asset type?', record.asset_type || 'tileset');
            var sourceType = window.prompt('Source type?', record.source_type || 'url');
            var sourceUrl = '';
            if ((sourceType || '').trim() === 'url') {
                sourceUrl = window.prompt('Source URL?', record.source_url || '') || '';
            }
            var tileSize = this._promptInt('Tile size?', record.proc_tile_size || 32);
            var cols = this._promptInt('Columns?', record.proc_cols || 0);
            var rows = this._promptInt('Rows?', record.proc_rows || 0);

            await this.db.updateAsset(assetId, {
                asset_key: assetKey,
                asset_type: assetType ? assetType.trim() : record.asset_type,
                source_type: sourceType ? sourceType.trim() : record.source_type,
                source_url: sourceUrl ? sourceUrl.trim() : null,
                proc_tile_size: tileSize || null,
                proc_cols: cols || null,
                proc_rows: rows || null
            });

            await this._reloadStudioData('asset:' + assetId);
        },

        _saveMapRecord: async function(mapId) {
            if (!(await this._ensureStudioContext()) || !mapId) return;
            var map = null;
            var maps = this.studioData && Array.isArray(this.studioData.maps) ? this.studioData.maps : [];
            for (var i = 0; i < maps.length; i++) {
                if (maps[i].id === mapId) {
                    map = maps[i];
                    break;
                }
            }
            if (!map) return;

            var name = window.prompt('Map name?', map.name || map.label || '');
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var description = window.prompt('Description?', map.description || '');
            var mapType = window.prompt('Map type?', map.map_type || 'overworld');
            var width = this._promptInt('Map width (tiles)?', map.width || 64);
            var height = this._promptInt('Map height (tiles)?', map.height || 64);
            var tilesetPath = window.prompt('Tileset path / key (optional)?', map.tileset_path || map.tileset_id || '');
            var isEntry = this._promptBoolean('Entry map? (yes / no)', !!(map.is_entry_map || map.isEntryPoint));

            await this.db.updateMap(mapId, {
                name: name,
                description: description != null ? description.trim() : null,
                map_type: (mapType || 'overworld').trim() || 'overworld',
                width: width || map.width || 64,
                height: height || map.height || 64,
                tileset_path: tilesetPath ? tilesetPath.trim() : null,
                is_entry_map: isEntry ? 1 : 0
            });

            await this._reloadStudioData('map:' + mapId);
        },

        _saveCurrentMapState: async function(tool, mapId) {
            if (!(await this._ensureStudioContext())) return;
            if (mapId) this.currentMapId = mapId;
            if (!this.currentMapId) return;

            var payload = this._collectCurrentMapStudioPayload();
            await this.db.saveMapStudio(this.currentMapId, payload);
            await this._reloadStudioData(this.activeNodeId || ('map:' + this.currentMapId));
        },

        _saveUnitTemplateRecord: async function(templateId) {
            if (!(await this._ensureStudioContext()) || !templateId) return;
            var record = await this.db.getUnitTemplate(templateId);
            if (!record) return;

            var name = window.prompt('Unit key / name?', record.name || templateId);
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var displayName = window.prompt('Display name?', record.display_name || record.name || name);
            var category = window.prompt('Category?', record.category || 'enemy');
            var description = window.prompt('Description?', record.description || '');
            var factionId = window.prompt('Faction ID?', record.faction_id || '');
            var baseHp = this._promptInt('Base HP?', record.base_hp || 40);
            var baseMp = this._promptInt('Base MP?', record.base_mp || 0);
            var baseAttack = this._promptInt('Base Attack?', record.base_attack || 10);
            var baseDefense = this._promptInt('Base Defense?', record.base_defense || 5);
            var baseSpeed = this._promptInt('Base Speed?', record.base_speed || 80);
            var spriteAssetId = window.prompt('Base sprite asset ID?', record.sprite_asset_id || '');
            var spriteTemplateId = window.prompt('Sprite template ID?', record.sprite_template_id || '');
            var spriteExtAssetId = window.prompt('Extended sprite asset ID?', record.sprite_ext_asset_id || '');
            var spriteExtTemplateId = window.prompt('Extended sprite template ID?', record.sprite_ext_template_id || '');
            var lootTable = window.prompt('Loot table key (optional)?', record.loot_table_json && record.loot_table_json.table ? record.loot_table_json.table : '');
            var soundSet = window.prompt('Sound set key (optional)?', record.audio_profile_json && record.audio_profile_json.sound_set ? record.audio_profile_json.sound_set : '');
            var controllable = this._promptBoolean('Controllable? (yes / no)', !!(record.action_profile_json && record.action_profile_json.controllable));
            var recruitable = this._promptBoolean('Recruitable? (yes / no)', !!(record.action_profile_json && record.action_profile_json.recruitable));

            await this.db.updateUnitTemplate(templateId, {
                name: name,
                display_name: displayName ? displayName.trim() : null,
                category: category ? category.trim() : null,
                description: description != null ? description.trim() : null,
                faction_id: factionId ? factionId.trim() : null,
                base_hp: baseHp,
                base_mp: baseMp,
                base_attack: baseAttack,
                base_defense: baseDefense,
                base_speed: baseSpeed,
                sprite_asset_id: spriteAssetId ? spriteAssetId.trim() : null,
                sprite_template_id: spriteTemplateId ? spriteTemplateId.trim() : null,
                sprite_ext_asset_id: spriteExtAssetId ? spriteExtAssetId.trim() : null,
                sprite_ext_template_id: spriteExtTemplateId ? spriteExtTemplateId.trim() : null,
                loot_table_json: lootTable ? { table: lootTable.trim() } : {},
                action_profile_json: {
                    controllable: !!controllable,
                    recruitable: !!recruitable
                },
                audio_profile_json: soundSet ? { sound_set: soundSet.trim() } : {}
            });

            await this._reloadStudioData('unit:' + templateId);
        },

        _saveNPCRecord: async function(characterId) {
            if (!(await this._ensureStudioContext()) || !characterId) return;
            var record = await this.db.getCharacter(characterId);
            if (!record) return;

            var name = window.prompt('NPC name?', record.name || characterId);
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var displayName = window.prompt('Display name?', record.display_name || record.name || name);
            var unitTemplateId = window.prompt('Base unit template ID?', record.unit_template_id || '');
            var behavior = window.prompt('Behavior?', record.behavior || 'idle');
            var factionId = window.prompt('Faction ID?', record.faction_id || '');
            var baseHp = this._promptInt('HP override?', record.base_hp || 40);
            var baseAttack = this._promptInt('Attack override?', record.base_attack || 10);
            var baseDefense = this._promptInt('Defense override?', record.base_defense || 5);
            var baseSpeed = this._promptInt('Speed override?', record.base_speed || 80);
            var knowledgeJson = this._promptJSON('Knowledge JSON?', record.knowledge_json || []);
            var lootOverride = this._promptJSON('Loot override JSON?', record.loot_override_json || []);
            var audioOverride = this._promptJSON('Audio override JSON?', record.audio_override_json || {});

            await this.db.updateCharacter(characterId, {
                name: name,
                display_name: displayName ? displayName.trim() : null,
                unit_template_id: unitTemplateId ? unitTemplateId.trim() : null,
                behavior: behavior ? behavior.trim() : 'idle',
                faction_id: factionId ? factionId.trim() : null,
                base_hp: baseHp,
                base_attack: baseAttack,
                base_defense: baseDefense,
                base_speed: baseSpeed,
                knowledge_json: knowledgeJson,
                loot_override_json: lootOverride,
                audio_override_json: audioOverride
            });

            await this._reloadStudioData('npc:' + characterId);
        },

        _saveFactionRecord: async function(factionId) {
            if (!(await this._ensureStudioContext()) || !factionId) return;
            var factions = this.studioData && Array.isArray(this.studioData.factions) ? this.studioData.factions : [];
            var record = null;
            for (var i = 0; i < factions.length; i++) {
                if (factions[i].id === factionId) {
                    record = factions[i];
                    break;
                }
            }
            if (!record) return;

            var name = window.prompt('Faction key?', record.name || factionId);
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var displayName = window.prompt('Display name?', record.display_name || record.name || name);
            var color = window.prompt('Color?', record.color || '#ffffff');

            await this.db.updateFaction(factionId, {
                name: name,
                display_name: displayName ? displayName.trim() : null,
                color: color ? color.trim() : '#ffffff'
            });

            await this._reloadStudioData('faction:' + factionId);
        },

        _saveQuestRecord: async function(questId) {
            if (!(await this._ensureStudioContext()) || !questId) return;
            var quests = this.studioData && Array.isArray(this.studioData.quests) ? this.studioData.quests : [];
            var record = null;
            for (var i = 0; i < quests.length; i++) {
                if (quests[i].id === questId) {
                    record = quests[i];
                    break;
                }
            }
            if (!record) return;

            var title = window.prompt('Quest title?', record.title || questId);
            if (title == null) return;
            title = title.trim();
            if (!title) return;

            var description = window.prompt('Description?', record.description || '');
            var giver = window.prompt('Giver character ID?', record.giver_character_id || '');
            var prerequisite = window.prompt('Prerequisite quest ID?', record.prerequisite_quest_id || '');
            var rewardXp = this._promptInt('Reward XP?', record.reward_xp || 0);
            var rewardGold = this._promptInt('Reward Gold?', record.reward_gold || 0);
            var sortOrder = this._promptInt('Sort order?', record.sort_order || 0);

            await this.db.updateQuest(questId, {
                title: title,
                description: description != null ? description.trim() : null,
                giver_character_id: giver ? giver.trim() : null,
                prerequisite_quest_id: prerequisite ? prerequisite.trim() : null,
                reward_xp: rewardXp,
                reward_gold: rewardGold,
                sort_order: sortOrder
            });

            await this._reloadStudioData('events:quest:' + questId);
        },

        _saveEventRecord: async function(eventId) {
            if (!(await this._ensureStudioContext()) || !eventId) return;
            var events = this.studioData && Array.isArray(this.studioData.events) ? this.studioData.events : [];
            var record = null;
            for (var i = 0; i < events.length; i++) {
                if (events[i].id === eventId) {
                    record = events[i];
                    break;
                }
            }
            if (!record) return;

            var name = window.prompt('Event name?', record.name || eventId);
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var scope = window.prompt('Event scope?', record.event_scope || 'non_quest');
            var description = window.prompt('Description?', record.description || '');
            var mapId = window.prompt('Map ID?', record.map_id || this.currentMapId || '');
            var questId = window.prompt('Quest ID?', record.quest_id || '');
            var sortOrder = this._promptInt('Sort order?', record.sort_order || 0);
            var conditionJson = this._promptJSON('Condition JSON?', record.condition_json || {});
            var actionJson = this._promptJSON('Action JSON?', record.action_json || {});

            await this.db.updateEvent(eventId, {
                name: name,
                event_scope: scope ? scope.trim() : 'non_quest',
                description: description != null ? description.trim() : null,
                map_id: mapId ? mapId.trim() : null,
                quest_id: questId ? questId.trim() : null,
                sort_order: sortOrder,
                condition_json: conditionJson,
                action_json: actionJson
            });

            await this._reloadStudioData('events:nonquest:' + eventId);
        },

        _createSpriteTemplateRecord: async function() {
            if (!this.db) return;

            var name = window.prompt('Sprite template name?', 'new_template');
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var category = window.prompt('Category?', 'character');
            var frameW = this._promptInt('Frame width?', 32);
            var frameH = this._promptInt('Frame height?', 32);
            var cols = this._promptInt('Columns per row?', 14);
            var hasDirections = this._promptBoolean('Has directions? (yes / no)', true);

            var created = await this.db.createSpriteTemplate({
                name: name,
                category: category ? category.trim() : 'character',
                frame_w: frameW || 32,
                frame_h: frameH || 32,
                cols_per_row: cols || 14,
                has_directions: !!hasDirections,
                directions: hasDirections ? ['down', 'up', 'left', 'right'] : []
            });

            await this._reloadStudioData('system:animation:' + created.id);
        },

        _saveSpriteTemplateRecord: async function(templateId) {
            if (!this.db || !templateId) return;
            var record = await this.db.getSpriteTemplate(templateId);
            if (!record) return;

            var name = window.prompt('Sprite template name?', record.name || templateId);
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var description = window.prompt('Description?', record.description || '');
            var category = window.prompt('Category?', record.category || 'character');
            var frameW = this._promptInt('Frame width?', record.frame_w || 32);
            var frameH = this._promptInt('Frame height?', record.frame_h || 32);
            var cols = this._promptInt('Columns per row?', record.cols_per_row || 14);
            var hasDirections = this._promptBoolean('Has directions? (yes / no)', !!record.has_directions);

            await this.db.updateSpriteTemplate(templateId, {
                name: name,
                description: description != null ? description.trim() : null,
                category: category ? category.trim() : 'character',
                frame_w: frameW || 32,
                frame_h: frameH || 32,
                cols_per_row: cols || 14,
                has_directions: !!hasDirections,
                directions: hasDirections ? (record.directions || ['down', 'up', 'left', 'right']) : []
            });

            await this._reloadStudioData('system:animation:' + templateId);
        },

        _createAudioProjectRecord: async function() {
            if (!this.db) return;

            var name = window.prompt('Audio project name?', 'New Audio Project');
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var bpm = this._promptInt('BPM?', 120);
            var bars = this._promptInt('Bars?', 2);
            var tags = window.prompt('Tags?', 'studio');

            var created = await this.db.createAudioProject({
                name: name,
                tags: tags ? tags.trim() : '',
                data: {
                    bpm: bpm || 120,
                    bars: bars || 2,
                    tracks: [
                        {
                            id: 1,
                            name: 'Piano Lead',
                            type: 'melodic',
                            instrument: 'piano',
                            volume: 0.8,
                            muted: false,
                            solo: false,
                            color: '#c8a840',
                            notes: []
                        }
                    ]
                }
            });

            await this._reloadStudioData('system:audio:' + created.id);
        },

        _saveAudioProjectRecord: async function(projectId) {
            if (!this.db || !projectId) return;
            var record = await this.db.getAudioProject(projectId);
            if (!record) return;

            var name = window.prompt('Audio project name?', record.name || projectId);
            if (name == null) return;
            name = name.trim();
            if (!name) return;

            var tags = window.prompt('Tags?', record.tags || '');
            var data = record.data || { bpm: 120, bars: 2, tracks: [] };
            var bpm = this._promptInt('BPM?', data.bpm || record.bpm || 120);
            var bars = this._promptInt('Bars?', data.bars || record.bars || 2);
            data.bpm = bpm || 120;
            data.bars = bars || 2;

            await this.db.updateAudioProject(projectId, {
                name: name,
                tags: tags ? tags.trim() : '',
                data: data
            });

            await this._reloadStudioData('system:audio:' + projectId);
        },

        _collectCurrentMapStudioPayload: function() {
            var engine = this._getFrameEngine();
            var mapEditor = this._getFrameMapEditor();
            var worldEditor = this._getFrameWorldEditor();
            var tileMap = engine && engine.tileMap ? engine.tileMap : null;

            return {
                state: {
                    terrain: tileMap && tileMap.layers && tileMap.layers[0] ? (tileMap.layers[0].data || []) : [],
                    collision: tileMap && tileMap.collisionData ? tileMap.collisionData : [],
                    weather_override: engine && engine.weatherSystem ? engine.weatherSystem.currentWeather : null,
                    weather_intensity: engine && engine.weatherSystem ? (engine.weatherSystem.targetIntensity || engine.weatherSystem.intensity || 0) : 0,
                    meta: {
                        saved_from: 'realm-studio',
                        tool: this.activeTool,
                        timestamp: Date.now()
                    }
                },
                spawners: worldEditor && Array.isArray(worldEditor.spawners)
                    ? worldEditor.spawners
                    : (mapEditor && Array.isArray(mapEditor.spawners) ? mapEditor.spawners : []),
                triggers: worldEditor && Array.isArray(worldEditor.triggers)
                    ? worldEditor.triggers
                    : (mapEditor && Array.isArray(mapEditor.triggers) ? mapEditor.triggers : []),
                zones: worldEditor && Array.isArray(worldEditor.zones) ? worldEditor.zones : [],
                units: mapEditor && Array.isArray(mapEditor.entities) ? mapEditor.entities : []
            };
        },

        _promptInt: function(label, value) {
            var raw = window.prompt(label, value == null ? '' : String(value));
            if (raw == null) return value;
            var parsed = parseInt(String(raw).trim(), 10);
            return isNaN(parsed) ? value : parsed;
        },

        _promptBoolean: function(label, value) {
            var raw = window.prompt(label, value ? 'yes' : 'no');
            if (raw == null) return value;
            raw = String(raw).trim().toLowerCase();
            return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y' || raw === 'on';
        },

        _promptJSON: function(label, value) {
            var raw = window.prompt(label, JSON.stringify(value == null ? {} : value));
            if (raw == null) return value;
            raw = raw.trim();
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch (e) {
                window.alert('Invalid JSON, keeping previous value.');
                return value;
            }
        },

        _formText: function(formData, key) {
            var value = formData.get(key);
            return value == null ? '' : String(value).trim();
        },

        _formInt: function(formData, key, fallback) {
            var value = formData.get(key);
            var parsed = parseInt(value, 10);
            return isNaN(parsed) ? fallback : parsed;
        },

        _fmt: function(value) {
            if (typeof value !== 'number') return String(value);
            if (Math.abs(value) >= 10 || Math.floor(value) === value) return String(value);
            return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
        },

        _esc: function(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        _escAttr: function(value) {
            return this._esc(value).replace(/"/g, '&quot;');
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        RealmKit._realmStudioShell = new StudioShell();
        RealmKit._realmStudioShell.init();
    });
})();
