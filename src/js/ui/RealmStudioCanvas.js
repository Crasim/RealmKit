var RealmKit = RealmKit || {};

(function() {
    function RealmStudioCanvas() {
        this.canvas = document.getElementById('studio-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.dpr = Math.max(1, window.devicePixelRatio || 1);
        this.width = 0;
        this.height = 0;
        this.hitRegions = [];
        this.hoverKey = null;
        this.pointer = { x: 0, y: 0 };
        this.status = 'Choose a section on the left, then launch a live tool from the cards on the right.';
        this.activeSection = this._initialSection();
        this.activeLeaf = null;
        this.counts = this._loadCounts();
        this.sections = this._buildSections();
        this.palette = {
            bg: '#0a0a12',
            woodDark: '#1a0c04',
            wood: '#2a1408',
            woodMid: '#4a2810',
            woodLight: '#5a3c20',
            woodEdge: '#8a6040',
            parchment: '#e8d8b8',
            parchmentDark: '#c8b890',
            parchmentShadow: '#b8a880',
            accent: '#c8a840',
            accentLight: '#f0d890',
            text: '#2a1408',
            muted: '#6a5040',
            slate: '#384868',
            slateEdge: '#586898'
        };

        this._bind();
        this._resize();
        this._syncLeaf();
        this.render();
    }

    RealmStudioCanvas.prototype = {
        _initialSection: function() {
            try {
                var params = new URLSearchParams(window.location.search);
                return params.get('section') || 'maps';
            } catch (e) {
                return 'maps';
            }
        },

        _bind: function() {
            var self = this;
            window.addEventListener('resize', function() { self._resize(); });
            this.canvas.addEventListener('mousemove', function(e) { self._onPointerMove(e); });
            this.canvas.addEventListener('mouseleave', function() {
                self.hoverKey = null;
                self.status = 'Choose a section on the left, then launch a live tool from the cards on the right.';
                self.render();
            });
            this.canvas.addEventListener('click', function(e) { self._onClick(e); });
        },

        _resize: function() {
            var rect = this.canvas.getBoundingClientRect();
            this.width = Math.max(960, Math.floor(rect.width));
            this.height = Math.max(640, Math.floor(rect.height));
            this.canvas.width = Math.floor(this.width * this.dpr);
            this.canvas.height = Math.floor(this.height * this.dpr);
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.render();
        },

        _loadCounts: function() {
            function readCount(key) {
                try {
                    var raw = localStorage.getItem('realmkit.b.' + key);
                    if (!raw) return 0;
                    var parsed = JSON.parse(raw);
                    return Array.isArray(parsed) ? parsed.length : 0;
                } catch (e) {
                    return 0;
                }
            }
            return {
                units: readCount('units'),
                chars: readCount('chars'),
                factions: readCount('factions'),
                quests: readCount('quests'),
                dialog: readCount('dialog'),
                scenes: readCount('scenes'),
                tiles: readCount('tiles')
            };
        },

        _openTool: function(href) {
            window.location.href = href;
        },

        _makeOpen: function(href) {
            var self = this;
            return function() { self._openTool(href); };
        },

        _buildSections: function() {
            var self = this;
            return [
                {
                    key: 'maps',
                    label: 'MAPS',
                    description: 'Map authoring, live paint tools, weather overrides, and travel logic.',
                    children: [
                        { key: 'map-painter', label: 'Map Painter', note: 'terrain + collision + paint', action: function() { self._openTool('index.html?tool=map-painter'); } },
                        { key: 'weather-override', label: 'Weather (map-specific override)', note: 'local climate + ambience', action: function() { self._openTool('index.html?tool=builder&builderTab=system'); } },
                        { key: 'zones-triggers', label: 'Zones & Triggers', note: 'doors + portals + triggers', action: function() { self._openTool('index.html?tool=world-zone'); } }
                    ],
                    cards: [
                        {
                            key: 'map-painter',
                            title: 'Map Painter',
                            badge: 'Live Painter',
                            desc: 'Launch the live terrain painter for brush-based world authoring, collision painting, spawn layers, and trigger rectangles.',
                            buttons: [
                                { label: 'Open Painter', href: 'index.html?tool=map-painter', tone: 'gold' },
                                { label: 'Collision Layer', href: 'index.html?tool=map-collision', tone: 'slate' },
                                { label: 'Map Registry', href: 'index.html?tool=builder&builderTab=maps', tone: 'slate' }
                            ]
                        },
                        {
                            key: 'weather-override',
                            title: 'Map Weather',
                            badge: 'Per-Map Override',
                            desc: 'Keep local weather and ambience attached to the map so overworld, caves, interiors, and special zones can diverge from the global pool.',
                            buttons: [
                                { label: 'Story Builder', href: 'index.html?tool=builder&builderTab=system', tone: 'gold' },
                                { label: 'Game View', href: 'index.html', tone: 'slate' }
                            ]
                        },
                        {
                            key: 'zones-triggers',
                            title: 'Zones & Triggers',
                            badge: 'Spatial Logic',
                            desc: 'Create portals, level transitions, encounter bounds, cinematic triggers, and map-space scripted interactions.',
                            buttons: [
                                { label: 'Open Zones', href: 'index.html?tool=world-zone', tone: 'gold' },
                                { label: 'Open Triggers', href: 'index.html?tool=world-trigger', tone: 'slate' },
                                { label: 'Open Spawners', href: 'index.html?tool=world-spawner', tone: 'slate' }
                            ]
                        }
                    ]
                },
                {
                    key: 'units',
                    label: 'UNITS',
                    description: 'Reusable unit foundations: templates, visuals, animation, audio, and shared loot.',
                    children: [
                        { key: 'unit-templates', label: 'Base Templates', note: this.counts.units + ' templates', action: function() { self._openTool('index.html?tool=builder&builderTab=units'); } },
                        { key: 'sprite-sheets', label: 'Sprite Sheets', note: this.counts.tiles + ' registered sheets', action: function() { self._openTool('sprite-builder.html'); } },
                        { key: 'unit-animations', label: 'Animations (base actions)', note: 'shared motion sets', action: function() { self._openTool('index.html?tool=builder&builderTab=system'); } },
                        { key: 'unit-audio', label: 'Audio (base sounds)', note: 'shared sound hooks', action: function() { self._openTool('audio-composer.html'); } },
                        { key: 'loot-tables', label: 'Loot Tables', note: 'drop tables + weights', action: function() { self._openTool('index.html?tool=builder&builderTab=system'); } }
                    ],
                    cards: [
                        {
                            key: 'unit-templates',
                            title: 'Base Templates',
                            badge: this.counts.units + ' Templates',
                            desc: 'Author reusable unit definitions for combat stats, faction defaults, sprite references, and behavior that NPC instances can inherit from.',
                            buttons: [
                                { label: 'Open Registry', href: 'index.html?tool=builder&builderTab=units', tone: 'gold' }
                            ]
                        },
                        {
                            key: 'sprite-sheets',
                            title: 'Sprite Sheets',
                            badge: this.counts.tiles + ' Sheets',
                            desc: 'Sprite sheets should come from Pixel Painter so units, NPCs, and environmental actors all reference the same source library.',
                            buttons: [
                                { label: 'Pixel Painter', href: 'sprite-builder.html', tone: 'gold' }
                            ]
                        },
                        {
                            key: 'unit-animations',
                            title: 'Animations / Audio / Loot',
                            badge: 'Shared Pools',
                            desc: 'Keep rarely changing action sets, sound banks, and loot tables centralized so stories assemble from stable registries instead of duplicating definitions.',
                            buttons: [
                                { label: 'Audio Composer', href: 'audio-composer.html', tone: 'slate' },
                                { label: 'System Registry', href: 'index.html?tool=builder&builderTab=system', tone: 'gold' }
                            ]
                        }
                    ]
                },
                {
                    key: 'npcs',
                    label: 'NPCS',
                    description: 'Story-specific character instances, overrides, faction hooks, and knowledge.',
                    children: [
                        { key: 'npc-instances', label: 'Character Instances', note: this.counts.chars + ' characters', action: function() { self._openTool('index.html?tool=builder&builderTab=npcs'); } },
                        { key: 'unit-override', label: 'Unit Override (sprite/audio)', note: 'instance overrides', action: function() { self._openTool('index.html?tool=builder&builderTab=npcs'); } },
                        { key: 'loot-override', label: 'Loot Override / Addition', note: 'instance-specific drops', action: function() { self._openTool('index.html?tool=builder&builderTab=npcs'); } },
                        { key: 'dialog-knowledge', label: 'Dialog & Knowledge', note: this.counts.dialog + ' dialogue entries', action: function() { self._openTool('index.html?tool=builder&builderTab=npcs'); } },
                        { key: 'faction-assign', label: 'Faction Assignment', note: this.counts.factions + ' factions', action: function() { self._openTool('index.html?tool=builder&builderTab=factions'); } }
                    ],
                    cards: [
                        {
                            key: 'npc-instances',
                            title: 'Character Instances',
                            badge: this.counts.chars + ' Instances',
                            desc: 'Named story actors should be authored as character instances that can override the base unit layer with portrait, faction, dialogue, and quest hooks.',
                            buttons: [
                                { label: 'Open NPCs', href: 'index.html?tool=builder&builderTab=npcs', tone: 'gold' }
                            ]
                        },
                        {
                            key: 'dialog-knowledge',
                            title: 'Dialog & Knowledge',
                            badge: this.counts.dialog + ' Entries',
                            desc: 'Conversations, hints, lore, codex facts, and relationship cues all belong beside the instance layer so the world feels authored instead of generic.',
                            buttons: [
                                { label: 'NPC Dialog', href: 'index.html?tool=builder&builderTab=npcs', tone: 'gold' }
                            ]
                        },
                        {
                            key: 'faction-assign',
                            title: 'Faction Assignment',
                            badge: this.counts.factions + ' Factions',
                            desc: 'Every NPC should be able to inherit faction behavior while still layering on individual overrides for loyalty, hostility, or plot-driven relationships.',
                            buttons: [
                                { label: 'Faction Registry', href: 'index.html?tool=builder&builderTab=factions', tone: 'gold' }
                            ]
                        }
                    ]
                },
                {
                    key: 'events',
                    label: 'EVENTS',
                    description: 'Reactive world logic, scripted beats, quests, and dependency chains.',
                    children: [
                        { key: 'world-events', label: 'World Events (spawns, cinematics)', note: this.counts.scenes + ' scenes', action: function() { self._openTool('index.html?tool=builder&builderTab=events'); } },
                        { key: 'quest-events', label: 'Quest Events', note: this.counts.quests + ' quests', action: function() { self._openTool('index.html?tool=builder&builderTab=events'); } },
                        { key: 'quest-defs', label: 'Quest Definitions', note: 'goals + rewards', action: function() { self._openTool('index.html?tool=builder&builderTab=events'); } },
                        { key: 'quest-deps', label: 'Dependencies & Chains', note: 'progression logic', action: function() { self._openTool('index.html?tool=builder&builderTab=events'); } }
                    ],
                    cards: [
                        {
                            key: 'world-events',
                            title: 'World Events',
                            badge: this.counts.scenes + ' Scenes',
                            desc: 'World events cover spawn waves, map triggers, cinematics, environmental scripting, and all the little reactive pieces that make a place feel alive.',
                            buttons: [
                                { label: 'Open Events', href: 'index.html?tool=builder&builderTab=events', tone: 'gold' },
                                { label: 'Trigger Layer', href: 'index.html?tool=world-trigger', tone: 'slate' }
                            ]
                        },
                        {
                            key: 'quest-events',
                            title: 'Quest Events',
                            badge: this.counts.quests + ' Quests',
                            desc: 'Quest definitions, prerequisites, chains, and event hooks should stay authored at the story layer and be fired into the world by event nodes.',
                            buttons: [
                                { label: 'Quest Registry', href: 'index.html?tool=builder&builderTab=events', tone: 'gold' }
                            ]
                        }
                    ]
                },
                {
                    key: 'factions',
                    label: 'FACTIONS',
                    description: 'Shared allegiance registry for units, NPCs, and systemic reactions.',
                    children: [
                        { key: 'faction-registry', label: 'Faction Registry', note: this.counts.factions + ' factions', action: function() { self._openTool('index.html?tool=builder&builderTab=factions'); } }
                    ],
                    cards: [
                        {
                            key: 'faction-registry',
                            title: 'Faction Registry',
                            badge: this.counts.factions + ' Factions',
                            desc: 'Use one canonical faction registry for hostility, favorability, dialogue reactions, political color, and default unit allegiance.',
                            buttons: [
                                { label: 'Open Registry', href: 'index.html?tool=builder&builderTab=factions', tone: 'gold' }
                            ]
                        }
                    ]
                },
                {
                    key: 'system',
                    label: 'SYSTEM',
                    description: 'Global pools and shared registries that stories reference rather than redefine.',
                    children: [
                        { key: 'weather-patterns', label: 'Weather Patterns (global pool)', note: 'shared climate library', action: function() { self._openTool('index.html?tool=builder&builderTab=system'); } },
                        { key: 'anim-registry', label: 'Animation Registry (rarely used)', note: 'shared animation keys', action: function() { self._openTool('index.html?tool=builder&builderTab=system'); } },
                        { key: 'audio-library', label: 'Global Audio Library', note: 'music + sfx', action: function() { self._openTool('audio-composer.html'); } },
                        { key: 'item-db', label: 'Item / Equipment Database', note: 'shared item pool', action: function() { self._openTool('index.html?tool=builder&builderTab=system'); } }
                    ],
                    cards: [
                        {
                            key: 'weather-patterns',
                            title: 'Weather Patterns',
                            badge: 'Global Pool',
                            desc: 'Global weather patterns should be referenced by stories and maps so atmospheric behavior stays coherent across the broader project.',
                            buttons: [
                                { label: 'System Registry', href: 'index.html?tool=builder&builderTab=system', tone: 'gold' }
                            ]
                        },
                        {
                            key: 'audio-library',
                            title: 'Animation / Audio Registries',
                            badge: 'Shared Libraries',
                            desc: 'Animation and audio registries are low-touch system pools: author them once, then reference them from units, NPCs, maps, and events.',
                            buttons: [
                                { label: 'Audio Composer', href: 'audio-composer.html', tone: 'gold' },
                                { label: 'Pixel Painter', href: 'sprite-builder.html', tone: 'slate' }
                            ]
                        },
                        {
                            key: 'item-db',
                            title: 'Item & Equipment Database',
                            badge: 'Shared Item Pool',
                            desc: 'Store item, equipment, and loot building blocks in one system registry so stories can assemble from them instead of redefining the same objects.',
                            buttons: [
                                { label: 'System Registry', href: 'index.html?tool=builder&builderTab=system', tone: 'gold' }
                            ]
                        }
                    ]
                }
            ];
        },

        _syncLeaf: function() {
            var section = this._currentSection();
            if (!section) return;
            if (!this.activeLeaf || !this._sectionHasLeaf(section, this.activeLeaf)) {
                this.activeLeaf = section.children.length ? section.children[0].key : null;
            }
        },

        _currentSection: function() {
            for (var i = 0; i < this.sections.length; i++) {
                if (this.sections[i].key === this.activeSection) return this.sections[i];
            }
            return this.sections[0];
        },

        _sectionHasLeaf: function(section, leafKey) {
            for (var i = 0; i < section.children.length; i++) {
                if (section.children[i].key === leafKey) return true;
            }
            return false;
        },

        _onPointerMove: function(e) {
            var rect = this.canvas.getBoundingClientRect();
            this.pointer.x = e.clientX - rect.left;
            this.pointer.y = e.clientY - rect.top;
            var hover = null;
            for (var i = this.hitRegions.length - 1; i >= 0; i--) {
                var r = this.hitRegions[i];
                if (this.pointer.x >= r.x && this.pointer.x <= r.x + r.w &&
                    this.pointer.y >= r.y && this.pointer.y <= r.y + r.h) {
                    hover = r;
                    break;
                }
            }
            this.hoverKey = hover ? hover.key : null;
            this.canvas.style.cursor = hover ? 'pointer' : 'default';
            this.status = hover && hover.hint ? hover.hint : 'Choose a section on the left, then launch a live tool from the cards on the right.';
            this.render();
        },

        _onClick: function(e) {
            var rect = this.canvas.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            for (var i = this.hitRegions.length - 1; i >= 0; i--) {
                var r = this.hitRegions[i];
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    if (typeof r.onClick === 'function') r.onClick();
                    return;
                }
            }
        },

        _clear: function() {
            var ctx = this.ctx;
            ctx.clearRect(0, 0, this.width, this.height);
            var grad = ctx.createLinearGradient(0, 0, 0, this.height);
            grad.addColorStop(0, '#131324');
            grad.addColorStop(1, '#09090f');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, this.width, this.height);
            this._fillNoise(0, 0, this.width, this.height, 'rgba(255,255,255,0.015)', 14);
        },

        _fillNoise: function(x, y, w, h, color, step) {
            var ctx = this.ctx;
            ctx.fillStyle = color;
            for (var py = y; py < y + h; py += step) {
                for (var px = x; px < x + w; px += step) {
                    if (((px / step) + (py / step)) % 5 === 0) ctx.fillRect(px, py, 1, 1);
                }
            }
        },

        _drawWoodFrame: function(x, y, w, h, title) {
            var c = this.palette;
            var ctx = this.ctx;
            ctx.fillStyle = c.woodDark;
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = c.woodMid;
            ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
            ctx.fillStyle = c.wood;
            ctx.fillRect(x + 9, y + 9, w - 18, h - 18);
            ctx.strokeStyle = c.woodEdge;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
            this._drawCorners(x, y, w, h);
            if (title) this._drawPlaque(x + w / 2 - 92, y - 8, 184, 30, title);
        },

        _drawCorners: function(x, y, w, h) {
            var ctx = this.ctx;
            var c = this.palette;
            var size = 20;
            var inset = 6;
            var corners = [
                [x - 4, y - 4],
                [x + w - size + 4, y - 4],
                [x - 4, y + h - size + 4],
                [x + w - size + 4, y + h - size + 4]
            ];
            for (var i = 0; i < corners.length; i++) {
                var cx = corners[i][0];
                var cy = corners[i][1];
                ctx.fillStyle = c.woodDark;
                ctx.fillRect(cx, cy, size, size);
                ctx.fillStyle = c.woodMid;
                ctx.fillRect(cx + 3, cy + 3, size - 6, size - 6);
                ctx.fillStyle = c.wood;
                ctx.fillRect(cx + inset, cy + inset, size - inset * 2, size - inset * 2);
            }
        },

        _drawPlaque: function(x, y, w, h, label) {
            var ctx = this.ctx;
            var c = this.palette;
            ctx.fillStyle = c.woodDark;
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = c.woodMid;
            ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
            ctx.fillStyle = '#4c3418';
            ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
            ctx.fillStyle = c.accent;
            this._setFont(8, true);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x + w / 2, y + h / 2 + 1);
        },

        _drawHeader: function() {
            var ctx = this.ctx;
            var c = this.palette;
            var h = 62;
            ctx.fillStyle = c.woodDark;
            ctx.fillRect(0, 0, this.width, h);
            ctx.fillStyle = c.woodMid;
            ctx.fillRect(0, 0, this.width, h - 4);
            this._fillNoise(0, 0, this.width, h, 'rgba(255,220,180,0.03)', 11);
            ctx.fillStyle = c.wood;
            ctx.fillRect(0, h - 10, this.width, 6);

            var plaqueW = 270;
            var plaqueX = Math.floor((this.width - plaqueW) / 2);
            this._drawPlaque(plaqueX, 10, plaqueW, 36, 'Realm Studio');

            this._setFont(6, false);
            ctx.textAlign = 'left';
            ctx.fillStyle = c.accentLight;
            ctx.fillText('Canvas Workspace', 26, 22);
            ctx.fillStyle = c.parchment;
            ctx.fillText('Choose a registry or live tool and launch directly into it.', 26, 38);

            this._drawHeaderButton(this.width - 250, 15, 92, 28, 'Game', 'index.html', 'slate');
            this._drawHeaderButton(this.width - 150, 15, 118, 28, 'Pixel Painter', 'sprite-builder.html', 'gold');
            this._drawHeaderButton(this.width - 26 - 96, 15, 96, 28, 'Audio', 'audio-composer.html', 'slate');
        },

        _drawHeaderButton: function(x, y, w, h, label, href, tone) {
            var self = this;
            this._drawButton(x, y, w, h, label, tone || 'slate');
            this.hitRegions.push({
                x: x, y: y, w: w, h: h,
                key: 'hdr-' + label,
                hint: 'Open ' + label,
                onClick: function() { self._openTool(href); }
            });
        },

        _drawButton: function(x, y, w, h, label, tone) {
            var ctx = this.ctx;
            var c = this.palette;
            var fillTop = tone === 'gold' ? '#a87030' : c.slate;
            var fillBottom = tone === 'gold' ? '#683010' : '#1f2940';
            var edge = tone === 'gold' ? '#3a1808' : '#0e1624';
            ctx.fillStyle = edge;
            ctx.fillRect(x, y + 3, w, h);
            var grad = ctx.createLinearGradient(0, y, 0, y + h - 3);
            grad.addColorStop(0, fillTop);
            grad.addColorStop(1, fillBottom);
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, w, h - 3);
            ctx.strokeStyle = tone === 'gold' ? '#d8b060' : c.slateEdge;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 4);
            this._setFont(6, true);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#f8f0e8';
            ctx.fillText(label, x + w / 2, y + (h - 3) / 2 + 1);
        },

        _drawLeftTree: function(x, y, w, h) {
            var ctx = this.ctx;
            var c = this.palette;
            this._drawWoodFrame(x, y, w, h, 'Studio Tree');
            var inner = { x: x + 12, y: y + 16, w: w - 24, h: h - 28 };
            ctx.fillStyle = c.parchment;
            ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
            this._fillNoise(inner.x, inner.y, inner.w, inner.h, 'rgba(90,56,20,0.045)', 8);
            ctx.strokeStyle = c.parchmentShadow;
            ctx.strokeRect(inner.x + 0.5, inner.y + 0.5, inner.w - 1, inner.h - 1);

            var cy = inner.y + 16;
            for (var i = 0; i < this.sections.length; i++) {
                var section = this.sections[i];
                var sectionActive = this.activeSection === section.key;
                var sectionHover = this.hoverKey === 'section-' + section.key;
                var rowH = 20;
                ctx.fillStyle = sectionActive ? '#2f3e64' : sectionHover ? '#eadfbf' : 'rgba(255,248,232,0.55)';
                ctx.fillRect(inner.x + 8, cy - 12, inner.w - 16, rowH);
                ctx.strokeStyle = sectionActive ? '#6f89c8' : '#b89b68';
                ctx.strokeRect(inner.x + 8.5, cy - 11.5, inner.w - 17, rowH - 1);
                this._setFont(7, true);
                ctx.textAlign = 'left';
                ctx.fillStyle = sectionActive ? '#f0f4ff' : c.text;
                ctx.fillText(section.label, inner.x + 18, cy + 1);
                this.hitRegions.push({
                    x: inner.x + 8, y: cy - 12, w: inner.w - 16, h: rowH,
                    key: 'section-' + section.key,
                    hint: section.description,
                    onClick: this._makeSelectSection(section.key)
                });
                cy += 22;

                for (var j = 0; j < section.children.length; j++) {
                    var child = section.children[j];
                    var childActive = this.activeLeaf === child.key && sectionActive;
                    var childHover = this.hoverKey === 'leaf-' + child.key;
                    var ch = 14;
                    ctx.fillStyle = childActive ? '#d8c080' : childHover ? 'rgba(255,248,232,0.82)' : 'transparent';
                    if (childActive || childHover) ctx.fillRect(inner.x + 18, cy - 10, inner.w - 28, ch);
                    this._setFont(5, false);
                    ctx.fillStyle = childActive ? c.text : '#4b3725';
                    ctx.fillText('> ' + child.label, inner.x + 24, cy + 1);
                    if (child.note) {
                        ctx.fillStyle = c.muted;
                        ctx.textAlign = 'right';
                        ctx.fillText(child.note, inner.x + inner.w - 18, cy + 1);
                        ctx.textAlign = 'left';
                    }
                    this.hitRegions.push({
                        x: inner.x + 18, y: cy - 10, w: inner.w - 28, h: ch + 6,
                        key: 'leaf-' + child.key,
                        hint: child.label + (child.note ? ' - ' + child.note : ''),
                        onClick: this._makeSelectLeaf(section.key, child.key, child.action)
                    });
                    cy += 16;
                }
                cy += 4;
            }
        },

        _makeSelectSection: function(key) {
            var self = this;
            return function() {
                self.activeSection = key;
                self._syncLeaf();
                self.status = self._currentSection().description;
                self.render();
            };
        },

        _makeSelectLeaf: function(sectionKey, leafKey, action) {
            var self = this;
            return function() {
                self.activeSection = sectionKey;
                self.activeLeaf = leafKey;
                if (typeof action === 'function') {
                    self.status = 'Opening ' + leafKey.replace(/-/g, ' ') + '...';
                    self.render();
                    window.setTimeout(function() { action(); }, 30);
                    return;
                }
                self.render();
            };
        },

        _drawMainWorkspace: function(x, y, w, h) {
            var section = this._currentSection();
            var ctx = this.ctx;
            var c = this.palette;
            this._drawWoodFrame(x, y, w, h, section.label);
            var inner = { x: x + 12, y: y + 16, w: w - 24, h: h - 28 };
            ctx.fillStyle = c.parchment;
            ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
            this._fillNoise(inner.x, inner.y, inner.w, inner.h, 'rgba(90,56,20,0.04)', 8);
            ctx.strokeStyle = c.parchmentShadow;
            ctx.strokeRect(inner.x + 0.5, inner.y + 0.5, inner.w - 1, inner.h - 1);

            var heroH = 116;
            this._drawHeroCard(inner.x + 12, inner.y + 12, inner.w - 24, heroH, section);

            var cardAreaX = inner.x + 12;
            var cardAreaY = inner.y + 12 + heroH + 12;
            var cardAreaW = inner.w - 24;
            var gap = 12;
            var colW = Math.floor((cardAreaW - gap) / 2);
            var cardH = 118;
            for (var i = 0; i < section.cards.length; i++) {
                var col = i % 2;
                var row = Math.floor(i / 2);
                var cx = cardAreaX + col * (colW + gap);
                var cy = cardAreaY + row * (cardH + gap);
                this._drawStudioCard(cx, cy, colW, cardH, section.cards[i]);
            }
        },

        _drawHeroCard: function(x, y, w, h, section) {
            var ctx = this.ctx;
            var c = this.palette;
            ctx.fillStyle = 'rgba(26,12,4,0.72)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = c.woodEdge;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

            this._setFont(6, false);
            ctx.fillStyle = c.accent;
            ctx.textAlign = 'left';
            ctx.fillText('REALM STUDIO / ' + section.label, x + 14, y + 18);

            this._setFont(10, true);
            ctx.fillStyle = c.parchment;
            ctx.fillText(section.label, x + 14, y + 40);

            this._setFont(6, false);
            ctx.fillStyle = '#d8c090';
            this._wrapText(section.description, x + 14, y + 58, w - 180, 12, 6, '#d8c090');

            ctx.fillStyle = '#b89a6c';
            ctx.fillText('Story Container', x + w - 170, y + 18);
            this._setFont(7, true);
            ctx.fillStyle = c.parchment;
            ctx.fillText('Maps + Units + NPCs', x + w - 170, y + 38);
            this._setFont(6, false);
            ctx.fillStyle = '#d8c090';
            ctx.fillText('Shared registries attach under a story.', x + w - 170, y + 56);
            ctx.fillText('Map tools launch live from here.', x + w - 170, y + 70);

            var leaf = this.activeLeaf ? this._findLeaf(section, this.activeLeaf) : null;
            if (leaf) {
                this._setFont(6, false);
                ctx.fillStyle = c.accentLight;
                ctx.fillText('Selected: ' + leaf.label, x + 14, y + h - 16);
            }
        },

        _findLeaf: function(section, leafKey) {
            for (var i = 0; i < section.children.length; i++) {
                if (section.children[i].key === leafKey) return section.children[i];
            }
            return null;
        },

        _drawStudioCard: function(x, y, w, h, card) {
            var ctx = this.ctx;
            var c = this.palette;
            var active = this.activeLeaf === card.key;
            ctx.fillStyle = active ? 'rgba(255,248,232,0.94)' : 'rgba(255,248,232,0.70)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = active ? c.accent : '#b89a6c';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

            this._setFont(7, true);
            ctx.textAlign = 'left';
            ctx.fillStyle = c.text;
            ctx.fillText(card.title, x + 12, y + 18);

            var badgeW = Math.min(110, Math.max(70, Math.ceil(ctx.measureText(card.badge || '').width + 14)));
            ctx.fillStyle = '#d7c58f';
            ctx.fillRect(x + w - badgeW - 12, y + 8, badgeW, 16);
            ctx.strokeStyle = '#a88c58';
            ctx.strokeRect(x + w - badgeW - 11.5, y + 8.5, badgeW - 1, 15);
            this._setFont(5, false);
            ctx.fillStyle = c.muted;
            ctx.textAlign = 'center';
            ctx.fillText(card.badge || '', x + w - badgeW / 2 - 12, y + 18);

            this._wrapText(card.desc, x + 12, y + 36, w - 24, 11, 6, c.muted);

            var btnY = y + h - 34;
            var gap = 8;
            var btnCount = card.buttons.length;
            var btnW = Math.floor((w - 24 - gap * (btnCount - 1)) / btnCount);
            for (var i = 0; i < card.buttons.length; i++) {
                var btn = card.buttons[i];
                var bx = x + 12 + i * (btnW + gap);
                this._drawButton(bx, btnY, btnW, 22, btn.label, btn.tone || 'slate');
                this.hitRegions.push({
                    x: bx, y: btnY, w: btnW, h: 22,
                    key: 'btn-' + card.key + '-' + i,
                    hint: btn.label,
                    onClick: this._makeOpen(btn.href)
                });
            }
        },

        _drawFooter: function() {
            var ctx = this.ctx;
            var c = this.palette;
            var h = 34;
            var y = this.height - h;
            ctx.fillStyle = c.woodDark;
            ctx.fillRect(0, y, this.width, h);
            ctx.fillStyle = c.woodMid;
            ctx.fillRect(0, y, this.width, h - 4);
            this._setFont(6, false);
            ctx.textAlign = 'left';
            ctx.fillStyle = c.accent;
            ctx.fillText('Status', 18, y + 15);
            ctx.fillStyle = c.parchment;
            ctx.fillText(this.status, 86, y + 15);
            ctx.fillStyle = '#9c8b6a';
            ctx.fillText('Tip: click a left-hand leaf to launch a tool immediately.', this.width - 360, y + 15);
        },

        _wrapText: function(text, x, y, maxWidth, lineHeight, size, color) {
            var ctx = this.ctx;
            this._setFont(size, false);
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            var words = String(text || '').split(/\s+/);
            var line = '';
            var cy = y;
            for (var i = 0; i < words.length; i++) {
                var test = line ? line + ' ' + words[i] : words[i];
                if (ctx.measureText(test).width > maxWidth && line) {
                    ctx.fillText(line, x, cy);
                    line = words[i];
                    cy += lineHeight;
                } else {
                    line = test;
                }
            }
            if (line) ctx.fillText(line, x, cy);
        },

        _setFont: function(size, bright) {
            this.ctx.font = size + 'px "Press Start 2P", monospace';
            this.ctx.shadowColor = bright ? 'rgba(0,0,0,0.25)' : 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        },

        render: function() {
            this.hitRegions = [];
            this._clear();
            this._drawHeader();

            var headerH = 62;
            var footerH = 34;
            var pad = 20;
            var leftW = 330;
            var workspaceX = pad + leftW + 16;
            var bodyY = headerH + 14;
            var bodyH = this.height - headerH - footerH - 28;
            var workspaceW = this.width - workspaceX - pad;

            this._drawLeftTree(pad, bodyY, leftW, bodyH);
            this._drawMainWorkspace(workspaceX, bodyY, workspaceW, bodyH);
            this._drawFooter();
        }
    };

    window.addEventListener('DOMContentLoaded', function() {
        RealmKit._realmStudioCanvas = new RealmStudioCanvas();
    });
})();
