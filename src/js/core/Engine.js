var RealmKit = RealmKit || {};

RealmKit.Engine = class Engine {
    constructor() {
        this.config = RealmKit.Config;
        this.gameLoop = null;
        this.renderer = null;
        this.assetLoader = null;
        this.spriteRenderer = null;
        this.inputHandler = null;
        this.camera = null;
        this.entityManager = null;
        this.partyManager = null;
        this.unitFactory = null;
        this.inputController = null;
        this.player = null; // DEPRECATED: use this.inputController.getControlledUnit()
        
        this.mapBounds = {
            width: 4096,
            height: 4096
        };
        
        this.tileset = null;
        this.tileMap = null;
        this.renderTiles = true;
        this.renderSprite = true;
        
        this.npcMode = true;
        this.autoRefresh = true;
        this.refreshInterval = 60;
        this.refreshTimer = null;
        this.lastRefreshTime = Date.now();

        // URL flags:
        // (no mode) — auto-refresh OFF (default), manual controls
        // ?mode=demo — auto-refresh ON for public demos
        // ?mode=VisualDev — auto-refresh OFF, dev features enabled
        // ?mode=launcher — auto-refresh OFF, story selection UI
        // ?testStory=<id> — load and log a story by ID at startup
        // ?showBuilder — open StoryBuilder at startup
        // ?testCreateStory — create a test story at startup
        // ?testAPI — run API connectivity test at startup
        var _urlParams = new URLSearchParams(window.location.search);
        var _mode = _urlParams.get('mode');
        this.isStudioMode = _urlParams.get('studio') === '1';
        if (_mode === 'demo') {
            this.autoRefresh = true;
            console.log('[Engine] Demo mode — auto-refresh enabled');
        } else if (_mode === 'VisualDev') {
            this.autoRefresh = false;
            console.log('[Engine] VisualDev mode — auto-refresh disabled');
        } else if (_mode === 'launcher' || _mode === 'story' || _mode === 'select') {
            this.autoRefresh = false;
            console.log('[Engine] Launcher mode — auto-refresh disabled');
        } else {
            this.autoRefresh = false;
            console.log('[Engine] Default mode — auto-refresh disabled, manual controls');
        }
        
        // Test hooks
        this._testParams = {
            testStory: _urlParams.get('testStory'),
            showBuilder: _urlParams.has('showBuilder'),
            testCreateStory: _urlParams.has('testCreateStory'),
            testAPI: _urlParams.has('testAPI')
        };
        
        this.dialogVisible = false;
        this.dialogName = '';
        this.dialogText = '';
        this.dialogTime = 0;
        
        this.entityCollisions = 0;
        this.lastEntityCollision = null;
        
        this.particles = new RealmKit.ParticleSystem({ maxParticles: 200 });
        this.projectileSystem = new RealmKit.ProjectileSystem({ maxProjectiles: 200 });
        this.fadeTransition = new RealmKit.FadeTransition({ fadeSpeed: 2 });
        this.weatherSystem = new RealmKit.WeatherSystem({ maxParticles: 500 });
        
        this.projectileSystem.setParticleHandler(this.particles);
        
        this.quadtree = null;
        this.pathfinding = null;
        this.saveManager = new RealmKit.SaveManager({ autoSaveInterval: 60000 });
        this.dialogueSystem = new RealmKit.DialogueSystem();
        this.achievementSystem = new RealmKit.AchievementSystem();
        this.questSystem = new RealmKit.QuestSystem();
        this.npcSpawner = new RealmKit.NPCSpawner({ respawnDelay: 30000 });
        this.spawnerManager = null;
        this.monsterTemplateManager = null;
        this.triggerSystem = null;
        this.locationSystem = null;
        this.zoneManager = null;
        this.effectBarSystem = new RealmKit.EffectBarSystem({ barWidth: 50, barHeight: 4 });
        this.canvasCache = new RealmKit.CanvasCache({ chunkSize: 512, maxCaches: 100, debug: false });
        this.pathRequestManager = new RealmKit.PathRequestManager({ maxPathsPerFrame: 5 });

        // AI System for template-based entities
        this.aiSystem = new RealmKit.AISystem(this);

        this.combatSystem = new RealmKit.CombatSystem();
        this.statusEffectManager = new RealmKit.StatusEffectManager();
        this.threatManager = new RealmKit.ThreatManager();
        this.experienceManager = new RealmKit.ExperienceManager();
        this.inventoryManager = new RealmKit.InventoryManager({ maxSlots: 24 });
        this.itemManager = new RealmKit.ItemManager();
        this.equipmentManager = new RealmKit.EquipmentManager();
        this.equipmentManager.setItemManager(this.itemManager);
        this.equipmentManager.setInventoryManager(this.inventoryManager);
        this.inventoryManager.setEquipmentManager(this.equipmentManager);
        this.combatSystem.setStatusEffectManager(this.statusEffectManager);
        this.combatSystem.setThreatManager(this.threatManager);
        this.combatSystem.setProjectileHandler(this.projectileSystem);
        this.combatSystem.setEquipmentManager(this.equipmentManager);
        this.hudSystem = new RealmKit.HUDSystem();
        this.gameUI = null;
        this.testHarness = new RealmKit.TestHarness(this);
        this.lootDrops = [];
        
        var engineSelf = this;
        this.combatSystem.onStatusEffectApplied = function(targetId, effectType, sourceId, duration) {
            engineSelf.applyStatusEffect(targetId, effectType, sourceId, duration);
        };
        
        this.combatSystem.onCombatEvent = function(event) {
            engineSelf._handleCombatEvent(event);
        };
        
        this.assetsLoaded = false;
        
        this.tileRenderTime = 0;
        this.spriteRenderTime = 0;
        this.totalRenderMs = 0;
        this.frameStartMs = 0;
        this.lastFrameEndMs = 0;
        this.frameGapMs = 0;
        
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.minimapBuilt = false;
        this.minimapLoggedOnce = false;
        this.minimapScale = 1;
        this.minimapBounds = null;
        this.minimapTeleportFlash = null;
        this.minimapOpacity = 1.0;

        // Dev tooling
        this.startTime = performance.now();
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;
        this.terrainConfig = {};
        this.devPanel = null;
        
        this.perfLog = [];
        this.perfLogInterval = 120;
        this.frameCount = 0;
        this.logUrl = 'log.php';
        this.isPaused = false;
        this.actionQueue = new RealmKit.ActionQueue(10);
        this.showActionQueue = true;
        this.sessionId = Date.now();

        // Screen shake
        this.shake = { x: 0, y: 0, intensity: 0, remaining: 0, duration: 0 };

        // Day/night cycle  (seconds into a 24-hour day, starts at 8:00 AM)
        this.dayNight = {
            time: 8 * 3600,      // current time in seconds (0 = midnight)
            speed: 120,          // game seconds per real second (1 real min = 2 game hours)
            cycleSeconds: 86400, // total seconds in one cycle
            paused: false        // pause day/night cycle
        };
        this.timeOfDay = null; // cached TimeOfDay phase string
        this.lightSources = [];   // { x, y, radius, intensity, color, dynamic, id }
        this.lightingCanvas = null;
        this.lightingCtx = null;
        this.lightRadiusMultiplier = 1.0;  // controlled by DevPanel slider
        this.ambientLightOverride = 0.0;   // 0=natural day/night, 1=fully lit

        // Audio system (lazy AudioContext — safe to construct before any user gesture)
        this.audio = new RealmKit.AudioSystem();
        this.studioPanSpeed = 720;

        console.log('[Engine] Initializing RealmKit v' + this.config.version);
    }
    
    init() {
        console.log('[Engine] init() called');
        
        this.renderer = new RealmKit.CanvasRenderer('game-canvas', this.config.viewport);
        this.renderer.init();
        
        this.spriteRenderer = new RealmKit.SpriteRenderer(
            this.renderer.ctx,
            this.renderer.viewport
        );
        
        this.gameLoop = new RealmKit.GameLoop(this.config.gameLoop);
        
        this.entityManager = new RealmKit.EntityManager();
        this.entityManager.setParticles(this.particles);
        
        var self = this;
        this.entityManager.onEntityCollision = function(a, b, overlapX, overlapY) {
            self.entityCollisions++;
            
            var midX = (a.x + b.x) / 2;
            var midY = (a.y + b.y) / 2;
            
            self.particles.createCollisionEffect(midX, midY, '#4488ff');
            
            self.lastEntityCollision = {
                entityA: a.name || a.id,
                entityB: b.name || b.id,
                typeA: a.type,
                typeB: b.type,
                overlapX: overlapX.toFixed(1),
                overlapY: overlapY.toFixed(1)
            };
            // console.log('[ENTITY_COLLISION]', a.type, '<->', b.type, 'overlap:', overlapX.toFixed(1), overlapY.toFixed(1));
        };
        
        this.camera = new RealmKit.Camera({
            viewWidth: this.renderer.viewport.viewWidth || 400,
            viewHeight: this.renderer.viewport.viewHeight || 300,
            deadZoneWidth: 0.4,
            deadZoneHeight: 0.4,
            smoothing: 0.15
        });
        
        // Start ambient audio on first user gesture (required by browser AudioContext policy)
        var self = this;
        if (!this.isStudioMode) {
            this._onFirstGesture = function() {
                if (self.audio) {
                    self.audio.startAmbient();
                    self.audio.playMusic('ambient');
                }
                window.removeEventListener('keydown', self._onFirstGesture, true);
                window.removeEventListener('click',   self._onFirstGesture, true);
                self._onFirstGesture = null;
            };
            window.addEventListener('keydown', this._onFirstGesture, true);
            window.addEventListener('click',   this._onFirstGesture, true);
        } else {
            this._onFirstGesture = null;
        }

        this._onResize = function() {
            if (self.camera && self.renderer && self.renderer.viewport) {
                self.camera.resize(self.renderer.viewport.viewWidth, self.renderer.viewport.viewHeight);
                // Clear minimap so it rebuilds at the new canvas size next render frame
                // (renderer.resize() is triggered separately by its own resize listener,
                //  so displayWidth/Height will be current by the time renderUIOverlay runs)
                self.minimapBuilt = false;
                self.minimapCanvas = null;
                self.minimapLoggedOnce = false;
            }
        };
        window.addEventListener('resize', this._onResize);
        
        this.inputHandler = new RealmKit.InputHandler(this);
        this.inputHandler.init();

        // Minimap click-to-teleport
        var self = this;
        this._onMinimapClick = function(e) {
            self.handleCanvasClick(e);
        };
        this.renderer.canvas.addEventListener('click', this._onMinimapClick);

        // Mouse-world tracking for DevPanel cursor tile readout
        this._onMouseMove = function(e) {
            var rect = self.renderer.canvas.getBoundingClientRect();
            var scaleX = (self.renderer.displayWidth || self.renderer.canvas.width) / rect.width;
            var scaleY = (self.renderer.displayHeight || self.renderer.canvas.height) / rect.height;
            var canvasX = (e.clientX - rect.left) * scaleX;
            var canvasY = (e.clientY - rect.top)  * scaleY;
            if (self.renderer.viewport) {
                self.mouseWorldX = canvasX + self.renderer.viewport.x;
                self.mouseWorldY = canvasY + self.renderer.viewport.y;
            }
        };
        this.renderer.canvas.addEventListener('mousemove', this._onMouseMove);

        // DevPanel
        if (typeof RealmKit.DevPanel === 'function') {
            this.devPanel = new RealmKit.DevPanel(this);
        }

        // Feature Test Panel (F3)
        if (typeof RealmKit.FeatureTestPanel === 'function') {
            this.featureTestPanel = new RealmKit.FeatureTestPanel(this);
        }

        // Story Builder Panel (F4)
        if (typeof RealmKit.StoryBuilder === 'function') {
            this.storyBuilder = new RealmKit.StoryBuilder(this);
        }

        // Map Editor Panel (F5)
        if (typeof RealmKit.MapEditor === 'function') {
            this.mapEditor = new RealmKit.MapEditor(this);
        }

        // World Editor Panel (F6)
        if (typeof RealmKit.WorldEditor === 'function') {
            this.worldEditor = new RealmKit.WorldEditor(this);
        }

        // Quest Tracker (on-screen HUD) - pulls from questSystem
        if (typeof RealmKit.QuestTracker === 'function' && typeof RealmKit.RealmGameUI !== 'function') {
            this.questTracker = new RealmKit.QuestTracker({
                questSystem: this.questSystem
            });
        }

        this.gameLoop.setUpdateCallback(function(delta) {
            try {
                self.update(delta);
            } catch (e) {
                console.error('[Engine] Update error:', e);
                var infoEl = document.getElementById('info-bar');
                if (infoEl) { infoEl.innerHTML = 'ERROR (update): ' + e.message; infoEl.style.color = '#ff4444'; }
            }
        });
        this.gameLoop.setRenderCallback(function(alpha) {
            try {
                self.render(alpha);
            } catch (e) {
                console.error('[Engine] Render error:', e);
                var infoEl = document.getElementById('info-bar');
                if (infoEl) { infoEl.innerHTML = 'ERROR (render): ' + e.message; infoEl.style.color = '#ff4444'; }
            }
        });
        this.gameLoop.setPauseCallback(function(paused) {
            self.isPaused = paused;
            if (paused) {
                console.log('[Engine] Game paused');
            } else {
                console.log('[Engine] Game resumed');
                self.executeQueuedActions();
            }
        });
        
        this.initAssets();
        
        console.log('[Engine] Initialization complete');
        
        return true;
    }
    
    initAssets() {
        var self = this;
        
        console.log('[Engine] Initializing asset loader');
        
        // Update info bar to show loading status
        var infoElement = document.getElementById('info-bar');
        if (infoElement) {
            infoElement.innerHTML = 'Loading assets...';
        }
        
        // Create asset loader
        this.assetLoader = new RealmKit.AssetLoader({
            basePath: this.config.assets.basePath || ''
        });
        
        // Queue test sprite
        var testSprite = this.config.assets.testSprite;
        if (testSprite) {
            this.assetLoader.addImage('test_hero', testSprite.image);
            this.assetLoader.addManifest('test_hero', testSprite.manifest);
        }
        
        // Set callbacks
        this.assetLoader.setProgressCallback(function(loaded, total, key) {
            self.loadProgress = loaded / total;
            self.updateLoadStatus(loaded, total, key);
        });
        
        this.assetLoader.setCompleteCallback(function(successes, failures) {
            self.onAssetsLoaded(successes, failures);
        });
        
        this.assetLoader.setErrorCallback(function(key, type, src) {
            console.error('[Engine] Asset error:', key, type, src);
        });
        
        // Start loading
        console.log('[Engine] Starting asset load');
        this.assetLoader.load().then(function(result) {
            console.log('[Engine] Asset load promise resolved:', result);
        });
    }
    
    updateLoadStatus(loaded, total, key) {
        var percent = Math.round((loaded / total) * 100);
        var infoElement = document.getElementById('info-bar');
        if (infoElement) {
            infoElement.innerHTML = 'Loading: ' + percent + '% - ' + key;
        }
        console.log('[Engine] Load progress:', loaded + '/' + total, key);
    }
    
    async onAssetsLoaded(successes, failures) {
        console.log('[Engine] Assets loaded:', {
            succeeded: successes.length,
            failed: failures.length
        });

        // ── Helpers ────────────────────────────────────────────────────────────
        var _find = function(ppAssets, name) {
            if (!name || !ppAssets) return null;
            var lo = name.toLowerCase();
            return ppAssets.find(function(a) { return a.name && a.name.toLowerCase() === lo; }) || null;
        };
        // Build manifest for humanoid_base (idle/walk/run/death/hurt, 16 cols).
        var _ppManifest = function(a) {
            if (!a) return null;
            var cols = a.cols || 16;

            // humanoid_base region layout ─────────────────────────────────────
            var _regions = [
                { name:'idle_down',     start:  0,  count:4,  fps:2,  loop:true  },
                { name:'idle_up',       start: 16,  count:4,  fps:2,  loop:true  },
                { name:'idle_left',     start: 32,  count:4,  fps:2,  loop:true  },
                { name:'idle_right',    start: 48,  count:4,  fps:2,  loop:true  },
                { name:'idle_diag_ne',  start: 64,  count:4,  fps:2,  loop:true  },
                { name:'idle_diag_nw',  start: 80,  count:4,  fps:2,  loop:true  },
                { name:'idle_diag_sw',  start: 96,  count:4,  fps:2,  loop:true  },
                { name:'idle_diag_se',  start:112,  count:4,  fps:2,  loop:true  },
                { name:'walk_down',     start:128,  count:8,  fps:8,  loop:true  },
                { name:'walk_up',       start:144,  count:8,  fps:8,  loop:true  },
                { name:'walk_left',     start:160,  count:8,  fps:8,  loop:true  },
                { name:'walk_right',    start:176,  count:8,  fps:8,  loop:true  },
                { name:'walk_diag_ne',  start:192,  count:8,  fps:8,  loop:true  },
                { name:'walk_diag_nw',  start:208,  count:8,  fps:8,  loop:true  },
                { name:'walk_diag_sw',  start:224,  count:8,  fps:8,  loop:true  },
                { name:'walk_diag_se',  start:240,  count:8,  fps:8,  loop:true  },
                { name:'run_down',      start:256,  count:8,  fps:12, loop:true  },
                { name:'run_up',        start:272,  count:8,  fps:12, loop:true  },
                { name:'run_left',      start:288,  count:8,  fps:12, loop:true  },
                { name:'run_right',     start:304,  count:8,  fps:12, loop:true  },
                { name:'run_diag_ne',   start:320,  count:8,  fps:12, loop:true  },
                { name:'run_diag_nw',   start:336,  count:8,  fps:12, loop:true  },
                { name:'run_diag_sw',   start:352,  count:8,  fps:12, loop:true  },
                { name:'run_diag_se',   start:368,  count:8,  fps:12, loop:true  },
                { name:'death',         start:384,  count:8,  fps:8,  loop:false },
                { name:'hurt',          start:400,  count:4,  fps:12, loop:false, next:'idle_down' },
                { name:'sleep',         start:416,  count:4,  fps:2,  loop:true  }
            ];

            var animations = {};
            _regions.forEach(function(r) {
                var frames = [];
                for (var fi = 0; fi < r.count; fi++) frames.push(r.start + fi);
                var anim = { frames: frames, fps: r.fps, loop: r.loop };
                if (r.next) anim.nextAnim = r.next;
                animations[r.name] = anim;
            });

            return {
                colsPerRow:  cols,
                frameWidth:  a.frameW,
                frameHeight: a.frameH,
                frameCount:  a.frame_count,
                imageWidth:  a.frameW * cols,
                imageHeight: a.frameH * Math.ceil(a.frame_count / cols),
                directionMirrors: a.direction_mirrors || a.meta?.direction_mirrors || {},
                animations:  animations
            };
        };
        // Build manifest for humanoid_ext (swim/melee/ranged/cast, 8 cols).
        // Regions from tpl_humanoid_ext in sprite_template_regions DB table.
        var _ppExtManifest = function(a) {
            if (!a) return null;
            var cols = a.cols || 8;
            var _regions = [
                { name:'swim_down',      start:  0, count:8, fps:6,  loop:true  },
                { name:'swim_up',        start: 16, count:8, fps:6,  loop:true  },
                { name:'swim_left',      start: 32, count:8, fps:6,  loop:true  },
                { name:'swim_right',     start: 48, count:8, fps:6,  loop:true  },
                { name:'swim_diag_ne',   start: 64, count:8, fps:6,  loop:true  },
                { name:'swim_diag_nw',   start: 80, count:8, fps:6,  loop:true  },
                { name:'swim_diag_sw',   start: 96, count:8, fps:6,  loop:true  },
                { name:'swim_diag_se',   start:112, count:8, fps:6,  loop:true  },
                { name:'melee_down',     start:128, count:6, fps:12, loop:false, next:'idle_down'     },
                { name:'melee_up',       start:144, count:6, fps:12, loop:false, next:'idle_up'       },
                { name:'melee_left',     start:160, count:6, fps:12, loop:false, next:'idle_left'     },
                { name:'melee_right',    start:176, count:6, fps:12, loop:false, next:'idle_right'    },
                { name:'melee_diag_ne',  start:192, count:6, fps:12, loop:false, next:'idle_diag_ne'  },
                { name:'melee_diag_nw',  start:208, count:6, fps:12, loop:false, next:'idle_diag_nw'  },
                { name:'melee_diag_sw',  start:224, count:6, fps:12, loop:false, next:'idle_diag_sw'  },
                { name:'melee_diag_se',  start:240, count:6, fps:12, loop:false, next:'idle_diag_se'  },
                // attack_* aliases — AnimationStateMachine emits 'attack_<dir>'; route them to melee frames
                { name:'attack_down',    start:128, count:6, fps:12, loop:false, next:'idle_down'     },
                { name:'attack_up',      start:144, count:6, fps:12, loop:false, next:'idle_up'       },
                { name:'attack_left',    start:160, count:6, fps:12, loop:false, next:'idle_left'     },
                { name:'attack_right',   start:176, count:6, fps:12, loop:false, next:'idle_right'    },
                { name:'ranged_down',    start:256, count:6, fps:10, loop:false, next:'idle_down'     },
                { name:'ranged_up',      start:272, count:6, fps:10, loop:false, next:'idle_up'       },
                { name:'ranged_left',    start:288, count:6, fps:10, loop:false, next:'idle_left'     },
                { name:'ranged_right',   start:304, count:6, fps:10, loop:false, next:'idle_right'    },
                { name:'ranged_diag_ne', start:320, count:6, fps:10, loop:false, next:'idle_diag_ne'  },
                { name:'ranged_diag_nw', start:336, count:6, fps:10, loop:false, next:'idle_diag_ne'  },
                { name:'ranged_diag_sw', start:352, count:6, fps:10, loop:false, next:'idle_diag_sw'  },
                { name:'ranged_diag_se', start:368, count:6, fps:10, loop:false, next:'idle_diag_se'  },
                { name:'cast_down',      start:384, count:8, fps:8,  loop:false, next:'idle_down'     },
                { name:'cast_up',        start:400, count:8, fps:8,  loop:false, next:'idle_up'       },
                { name:'cast_left',      start:416, count:8, fps:8,  loop:false, next:'idle_left'     },
                { name:'cast_right',     start:432, count:8, fps:8,  loop:false, next:'idle_right'    },
                { name:'cast_diag_ne',   start:448, count:8, fps:8,  loop:false, next:'idle_diag_ne'  },
                { name:'cast_diag_nw',   start:464, count:8, fps:8,  loop:false, next:'idle_diag_nw'  },
                { name:'cast_diag_sw',   start:480, count:8, fps:8,  loop:false, next:'idle_diag_sw'  },
                { name:'cast_diag_se',   start:496, count:8, fps:8,  loop:false, next:'idle_diag_se'  }
            ];
            var animations = {};
            _regions.forEach(function(r) {
                var frames = [];
                for (var fi = 0; fi < r.count; fi++) frames.push(r.start + fi);
                var anim = { frames: frames, fps: r.fps, loop: r.loop };
                if (r.next) anim.nextAnim = r.next;
                animations[r.name] = anim;
            });
            return {
                colsPerRow:  cols,
                frameWidth:  a.frameW,
                frameHeight: a.frameH,
                frameCount:  a.frame_count,
                imageWidth:  a.frameW * cols,
                imageHeight: a.frameH * Math.ceil(a.frame_count / cols),
                directionMirrors: a.direction_mirrors || a.meta?.direction_mirrors || {},
                animations:  animations
            };
        };

        var _loadImg = function(asset) {
            return new Promise(function(resolve) {
                if (!asset || !asset.file_path) { resolve(null); return; }
                var img = new Image();
                img.onload  = function() { resolve(img); };
                img.onerror = function() {
                    console.warn('[Engine] Failed to load server sprite:', asset.name);
                    resolve(null);
                };
                img.src = asset.file_path;
            });
        };

        // ── Fetch server assets (fired in parallel during load) ────────────────
        var ppAssets = dbPPAssets || [];
        console.log('[Engine] Server assets available:', ppAssets.length);

        // ── Fetch DB data: Factions, Units, Sprite Templates ──────────────────
        var db = this.storyDatabase || new RealmKit.StoryDatabase();
        var baseUrl = db._base || 'api';
        var [dbFactions, dbUnitTemplates, dbSpriteTemplates, dbPPAssets] = await Promise.all([
            fetch(baseUrl + '/factions').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(baseUrl + '/unit-templates').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(baseUrl + '/sprite-templates').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(baseUrl + '/pp-assets').then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        console.log('[Engine] DB Data Loaded:', {
            factions: dbFactions.length,
            unitTemplates: dbUnitTemplates.length,
            spriteTemplates: dbSpriteTemplates.length,
            ppAssets: dbPPAssets.length
        });

        // ── Resolve Sprite Manifests from DB ─────────────────────────────────────
        var spriteManifestMap = {};
        for (var st of dbSpriteTemplates) {
            // Fetch full template with regions
            try {
                var fullTpl = await db.getSpriteTemplate(st.id);
                var animations = {};
                if (fullTpl.regions) {
                    fullTpl.regions.forEach(function(r) {
                        var frames = [];
                        for (var fi = 0; fi < r.frame_count; fi++) frames.push(r.start_frame + fi);
                        var anim = { frames: frames, fps: r.fps, loop: r.loop === 1 };
                        if (r.next_anim) anim.nextAnim = r.next_anim;
                        animations[r.anim_name] = anim;
                    });
                }
                spriteManifestMap[st.id] = {
                    id: st.id,
                    colsPerRow: st.cols_per_row || 16,
                    frameWidth: st.frame_w,
                    frameHeight: st.frame_h,
                    directionMirrors: st.direction_mirrors ? JSON.parse(st.direction_mirrors) : {},
                    animations: animations
                };
            } catch (e) {
                console.warn('[Engine] Failed to resolve sprite template:', st.id, e.message);
            }
        }

        // ── Unit definitions (story-driven) ──────────────────────────────────────
        var DEMO_UNITS = {};
        if (dbUnitTemplates.length > 0) {
            dbUnitTemplates.forEach(ut => {
                DEMO_UNITS[ut.name] = {
                    id: ut.id,
                    label: ut.display_name || ut.name,
                    faction: ut.category === 'npc' ? 'friendly' : 'hostile',
                    behavior: ut.default_behavior || 'idle',
                    spriteBase: ut.sprite_asset_key_v2 || ut.sprite_asset_key || ut.name,
                    spriteExt: ut.sprite_ext_asset_id ? (ut.sprite_ext_asset_key_v2 || ut.sprite_ext_asset_key || ut.name + '_Ext') : null,
                    spriteTemplateId: ut.sprite_template_id,
                    spriteExtTemplateId: ut.sprite_ext_template_id,
                    stats: {
                        hp: ut.base_hp,
                        maxHp: ut.base_hp,
                        attack: ut.base_attack,
                        defense: ut.base_defense,
                        speed: ut.base_speed
                    },
                    aggro: ut.aggro_range,
                    attackRange: ut.attack_range,
                    skills: ut.skills || []
                };
            });
        } else {
            DEMO_UNITS = {
                male_hero:   { label:'Male Hero',   faction:'friendly', behavior:'idle',
                               spriteBase:'Male-Hero',           spriteExt:'Male_Hero_Ext_32-bit',
                               stats:{hp:100,maxHp:100,attack:20,defense:8,speed:100},  aggro:0,   attackRange:50 },
                female_hero: { label:'Female Hero', faction:'friendly', behavior:'idle',
                               spriteBase:'Female-Hero',         spriteExt:'Female_Hero_Ext_32-bit',
                               stats:{hp:100,maxHp:100,attack:18,defense:10,speed:110}, aggro:0,   attackRange:50 },
                goblin:      { label:'Goblin',      faction:'hostile',  behavior:'hostile',
                               spriteBase:'Goblin',              spriteExt:'Goblin_Ext_32-bit',
                               stats:{hp:30,maxHp:30,attack:8,defense:3,speed:90},    aggro:200, attackRange:35 },
                skeleton:    { label:'Skeleton',    faction:'hostile',  behavior:'hostile',
                               spriteBase:'Skeleton',            spriteExt:'Skeleton_Ext_32-bit',
                               stats:{hp:40,maxHp:40,attack:12,defense:6,speed:70},   aggro:150, attackRange:45 }
            };
        }

        // ── Faction definitions ──────────────────────────────────────────────────
        var DEMO_FACTIONS = {};
        if (dbFactions.length > 0) {
            dbFactions.forEach(f => {
                DEMO_FACTIONS[f.name] = { label: f.display_name, color: f.color };
            });
        } else {
            DEMO_FACTIONS = {
                friendly: { label: 'Friendly', color: '#44aaff' },
                hostile:  { label: 'Hostile',  color: '#ff4444' }
            };
        }

        // ── Collect all unique sprite names and load them all in parallel ────────
        var _allSpriteNames = ['Grassland Tileset 64-bit'];
        Object.keys(DEMO_UNITS).forEach(function(key) {
            var u = DEMO_UNITS[key];
            if (u.spriteBase && _allSpriteNames.indexOf(u.spriteBase) < 0) _allSpriteNames.push(u.spriteBase);
            if (u.spriteExt  && _allSpriteNames.indexOf(u.spriteExt)  < 0) _allSpriteNames.push(u.spriteExt);
        });

        var _loadedImgs = await Promise.all(_allSpriteNames.map(function(name) {
            return _loadImg(_find(ppAssets, name));
        }));
        var _spriteImgMap = {};
        _allSpriteNames.forEach(function(name, i) { _spriteImgMap[name] = _loadedImgs[i]; });

        // ── Tileset — prefer Grassland server asset ─────────────────────────────
        var grasslandAsset = _find(ppAssets, 'Grassland Tileset 64-bit');
        var grasslandImg   = _spriteImgMap['Grassland Tileset 64-bit'];
        var serverTileset  = null;
        var serverTileSize = 32;
        if (grasslandImg && grasslandAsset) {
            serverTileset = new RealmKit.Tileset({
                name: 'grassland',
                tileWidth:  grasslandAsset.frameW,
                tileHeight: grasslandAsset.frameH
            });
            serverTileset.setImage(grasslandImg);
            serverTileSize = grasslandAsset.frameW;
            console.log('[Engine] Using Grassland Tileset from server (' + serverTileSize + 'px tiles)');
        }

        // ── Resolve units: attach loaded images + manifests ──────────────────────
        if (this.isStudioMode) {
            return this._bootStudioWorkspace(serverTileset, serverTileSize);
        }

        var resolvedUnits = {};
        Object.keys(DEMO_UNITS).forEach(function(key) {
            var def      = DEMO_UNITS[key];
            var baseAsset = _find(ppAssets, def.spriteBase);
            var extAsset  = _find(ppAssets, def.spriteExt);
            
            // Prefer DB-resolved manifest if available, fallback to hardcoded helper
            var manifest = spriteManifestMap[def.spriteTemplateId] || (baseAsset ? _ppManifest(baseAsset) : null);
            var manifestExt = spriteManifestMap[def.spriteExtTemplateId] || (extAsset ? _ppExtManifest(extAsset) : null);

            resolvedUnits[key] = {
                def:         def,
                img:         _spriteImgMap[def.spriteBase] || null,
                manifest:    manifest,
                imgExt:      _spriteImgMap[def.spriteExt]  || null,
                manifestExt: manifestExt
            };
            console.log('[Engine] Resolved unit:', key,
                '| base:', !!resolvedUnits[key].img,
                '| ext:',  !!resolvedUnits[key].imgExt);
        });

        // ── Player: randomly pick a friendly hero unit ────────────────────────────
        var _heroKeys = Object.keys(DEMO_UNITS).filter(function(k) { return DEMO_UNITS[k].faction === 'friendly'; });
        var _heroKey  = _heroKeys.length > 0 ? _heroKeys[Math.floor(Math.random() * _heroKeys.length)] : 'male_hero';
        var _heroUnit = resolvedUnits[_heroKey];

        if (!_heroUnit) {
             console.warn('[Engine] No hero unit resolved for key:', _heroKey);
             // Fallback to manual setup or procedural if necessary
        }

        var sprite            = (_heroUnit && _heroUnit.img)         || RealmKit.AssetCache.getImage('test_hero');
        var spriteManifest    = (_heroUnit && _heroUnit.manifest)     || RealmKit.AssetCache.getManifest('test_hero');
        var spriteExt         = (_heroUnit && _heroUnit.imgExt)       || null;
        var spriteManifestExt = (_heroUnit && _heroUnit.manifestExt)  || null;

        if (!sprite) {
            console.log('[Engine] Generating procedural sprite...');
            var procedural = RealmKit.ProceduralSprite.createTestHero();
            sprite         = procedural.image;
            spriteManifest = procedural.manifest;
        }
        console.log('[Engine] Player unit:', _heroKey, '| sprite:', !!sprite, '| ext:', !!spriteExt);

        this.initTileMap({ tileset: serverTileset, tileSize: serverTileSize, flat: true, mapSize: 32 });
        
        var spawnPoints = this.tileMap.spawns || [];
        console.log('[Engine] Map has', spawnPoints.length, 'spawn points');
        
        var playerSpawn = { x: this.mapBounds.width / 2, y: this.mapBounds.height / 2 };
        
        for (var s = 0; s < spawnPoints.length; s++) {
            if (spawnPoints[s].type === 'player') {
                playerSpawn = { x: spawnPoints[s].x, y: spawnPoints[s].y };
                console.log('[Engine] Using terrain spawn for player:', playerSpawn.x, playerSpawn.y);
                break;
            }
        }
        
        var collisionMap = this.tileMap.collisionData;
        var tileWidth = this.tileMap.tileWidth;
        var tileHeight = this.tileMap.tileHeight;
        var mapWidth = this.tileMap.width;
        var mapHeight = this.tileMap.height;
        
        playerSpawn = this.findSafeSpawnPoint(
            Math.floor(playerSpawn.x / tileWidth),
            Math.floor(playerSpawn.y / tileHeight),
            collisionMap, mapWidth, mapHeight, tileWidth, tileHeight
        );
        
        console.log('[Engine] Final player spawn:', playerSpawn.x, playerSpawn.y);
        
        // Initialize UnitFactory and InputController
        this.unitFactory = new RealmKit.UnitFactory();
        this.inputController = new RealmKit.InputController({
            engine: this,
            inputHandler: this.inputHandler
        });
        this.inputController.setupListeners();

        // Initialize Mobile Touch Handler for tablets/mobile
        // This creates virtual joystick and buttons that map to keyboard inputs
        this.mobileTouchHandler = new RealmKit.MobileTouchHandler(this);
        this.mobileTouchHandler.init();
        
        // Create player using Player class with proper combat/cooldown logic
        this.player = new RealmKit.Player({
            templateId: 'hero_knight',
            id: 'player',
            x: playerSpawn.x,
            y: playerSpawn.y,
            sprite: sprite,
            manifest: spriteManifest,
            playerControlled: true,
            controllable: true
        });

        // Attach extended spritesheet to player (melee/ranged/cast animations)
        this.player.spriteExt    = spriteExt;
        this.player.manifestExt  = spriteManifestExt;
        
        // Register with combat system
        this.player.combatStats = this.combatSystem.registerEntity(this.player, this.player.combatStats || this.player.baseStats);
        
        if (this.experienceManager) {
            this.experienceManager.registerEntity(this.player.id, 0);
        }
        
        // Equip starting weapon
        var playerWeapon = new RealmKit.Weapon({
            id: 'player_sword',
            name: 'Iron Sword',
            type: 'sword',
            damage: 15,
            range: 50,
            length: 25,
            width: 4,
            scale: 0.6,
            color: '#c0c0c0',
            glowColor: '#ffcc00'
        });
        this.player.weapon = playerWeapon;
        
        // Add to entity manager
        this.entityManager.add(this.player);

        // Register player with AI system (even if controlled, for potential AI takeover)
        if (this.aiSystem && this.player.hasAI) {
            this.aiSystem.registerEntity(this.player);
        }
        
        // Set up party manager and attach player
        this.partyManager = new RealmKit.PartyManager({ maxMembers: 6 });
        this.partyManager.addMember(this.player);
        this.partyManager.setLeader(this.player);
        
        // Attach input controller to player
        this.inputController.attach(this.player);
        
        console.log('[Engine] PartyManager initialized with player as leader (max 6 members)');
        
        var npcSprite   = sprite;
        var npcManifest = spriteManifest;

        var enemySpawns   = (this.tileMap.spawns || []).filter(function(s) { return s.type === 'enemy'; });
        var merchantSpawn = (this.tileMap.spawns || []).find(function(s)   { return s.type === 'merchant'; });

        console.log('[Engine] Found', enemySpawns.length, 'enemy spawns from terrain');

        var npcs = [];

        // Merchant (not unit-def driven — it's a service NPC)
        var merchantPos = merchantSpawn ? { x: merchantSpawn.x, y: merchantSpawn.y } : null;
        if (!merchantPos) {
            merchantPos = this.findSafeSpawnPoint(
                Math.floor(this.player.x / this.tileMap.tileWidth) + 3,
                Math.floor(this.player.y / this.tileMap.tileHeight) + 3,
                collisionMap, mapWidth, mapHeight, tileWidth, tileHeight
            );
        }
        if (merchantPos) {
            npcs.push({
                id: 'npc_merchant',
                name: 'Merchant',
                x: merchantPos.x,
                y: merchantPos.y,
                behavior: 'wander',
                faction: 'friendly',
                dialog: ['Hello!', 'Welcome!'],
                wanderRadius: 80
            });
        }

        // ── Hostile NPCs — driven by DEMO_UNITS hostile faction ──────────────────
        var _hostileKeys  = Object.keys(DEMO_UNITS).filter(function(k) { return DEMO_UNITS[k].faction === 'hostile'; });
        var _totalEnemies = 15;
        if (_hostileKeys.length > 0) {
            for (var e = 0; e < _totalEnemies; e++) {
                var _eKey    = _hostileKeys[e % _hostileKeys.length];
                var _eUnit   = resolvedUnits[_eKey];
                var _eDef    = _eUnit.def;
                var spawnPos;
                if (e < enemySpawns.length) {
                    spawnPos = { x: enemySpawns[e].x, y: enemySpawns[e].y };
                } else {
                    var _eAngle = Math.PI * 2 * (e / _totalEnemies);
                    var _eDist  = 250 + Math.random() * 150;
                    spawnPos = this.findSafeSpawnPoint(
                        Math.floor((this.player.x + Math.cos(_eAngle) * _eDist) / tileWidth),
                        Math.floor((this.player.y + Math.sin(_eAngle) * _eDist) / tileHeight),
                        collisionMap, mapWidth, mapHeight, tileWidth, tileHeight
                    );
                }
                npcs.push({
                    id:          'enemy_' + e,
                    name:        _eDef.label,
                    x:           spawnPos.x,
                    y:           spawnPos.y,
                    behavior:    _eDef.behavior,
                    faction:     _eDef.faction,
                    stats:       Object.assign({}, _eDef.stats),
                    aggroRange:  _eDef.aggro,
                    attackRange: _eDef.attackRange,
                    sprite:      _eUnit.img         || null,
                    manifest:    _eUnit.manifest     || null,
                    spriteExt:   _eUnit.imgExt       || null,
                    manifestExt: _eUnit.manifestExt  || null
                });
            }
        }

        // ── Friendly NPCs — driven by DEMO_UNITS friendly faction ────────────────
        var _friendlyKeys = Object.keys(DEMO_UNITS).filter(function(k) { return DEMO_UNITS[k].faction === 'friendly'; });
        var friendlyCount = 4;
        if (_friendlyKeys.length > 0) {
            console.log('[Engine] Spawning', friendlyCount, 'friendly hero NPCs');
            for (var fr = 0; fr < friendlyCount; fr++) {
                var _fKey    = _friendlyKeys[fr % _friendlyKeys.length];
                var _fUnit   = resolvedUnits[_fKey];
                var _fDef    = _fUnit.def;
                var _fAngle  = Math.PI * 2 * (fr / friendlyCount) + Math.random() * 0.5;
                var _fDist   = 150 + Math.random() * 200;
                var friendlySpawn = this.findSafeSpawnPoint(
                    Math.floor((this.player.x + Math.cos(_fAngle) * _fDist) / tileWidth),
                    Math.floor((this.player.y + Math.sin(_fAngle) * _fDist) / tileHeight),
                    collisionMap, mapWidth, mapHeight, tileWidth, tileHeight
                );
                npcs.push({
                    id:           'friendly_' + fr,
                    name:         _fDef.label,
                    x:            friendlySpawn.x,
                    y:            friendlySpawn.y,
                    behavior:     'wander',
                    faction:      _fDef.faction,
                    recruitable:  true,
                    wanderRadius: 40 + Math.random() * 30,
                    stats:        Object.assign({}, _fDef.stats),
                    aggroRange:   120,
                    attackRange:  _fDef.attackRange,
                    interactable: true,
                    sprite:       _fUnit.img         || null,
                    manifest:     _fUnit.manifest     || null,
                    spriteExt:    _fUnit.imgExt       || null,
                    manifestExt:  _fUnit.manifestExt  || null
                });
            }
        }
        
        // Spawn NPCs from templates
        for (var i = 0; i < npcs.length; i++) {
            var cfg = npcs[i];
            var templateId = this._getTemplateForNPC(cfg);
            
            // Create NPC from template using Entity class
            // Use per-entity server sprite if available, fall back to shared npcSprite
            var npc = new RealmKit.Entity({
                templateId: templateId,
                id: cfg.id,
                x: cfg.x,
                y: cfg.y,
                sprite:   cfg.sprite   || npcSprite,
                manifest: cfg.manifest || npcManifest
            });

            // Give every NPC a state machine so AISystem can drive directional animation
            npc.stateMachine = RealmKit.AnimationStateMachine.createForPlayer();
            npc.stateMachine.setState('idle_down');

            // Attach extended spritesheet if the unit def provided one
            if (cfg.spriteExt)   npc.spriteExt   = cfg.spriteExt;
            if (cfg.manifestExt) npc.manifestExt  = cfg.manifestExt;

            // Override template values with spawn config
            if (cfg.behavior) npc.aiBehavior = cfg.behavior;
            if (cfg.wanderRadius) npc.wanderRadius = cfg.wanderRadius;
            if (cfg.dialog) npc.dialog = cfg.dialog;
            if (cfg.faction) npc.faction = cfg.faction;
            if (cfg.recruitable !== undefined) npc.recruitable = cfg.recruitable;
            if (cfg.aggroRange) npc.aggroRange = cfg.aggroRange;
            if (cfg.attackRange) npc.attackRange = cfg.attackRange;
            if (cfg.interactable !== undefined) npc.interactable = cfg.interactable;
            
            // Set up combat stats
            if (npc.combatStats) {
                npc.combatStats = this.combatSystem.registerEntity(npc, this.combatSystem.createStats(npc.combatStats));
            }
            
            // Equip weapon if applicable
            if (npc.combatStats && npc.combatStats.attack) {
                var weaponConfig = RealmKit.Weapon.randomize(npc.combatStats.attack);
                weaponConfig.id = cfg.id + '_weapon';
                weaponConfig.name = cfg.name + ' Weapon';
                weaponConfig.range = cfg.attackRange || npc.attackRange || 40;
                
                var npcWeapon = new RealmKit.Weapon(weaponConfig);
                npc.weapon = npcWeapon;
            }
            
            this.entityManager.add(npc);

            // Register NPC with AI system
            if (this.aiSystem && npc.hasAI) {
                this.aiSystem.registerEntity(npc);
            }
        }

        // Set camera to follow controlled unit
        if (this.inputController) {
            var controlledUnit = this.inputController.getControlledUnit();
            if (controlledUnit) {
                this.camera.setTarget(controlledUnit);
            }
        }
        
        this.assetsLoaded = true;
        
        console.log('[Engine] Player created at:', this.player.x, this.player.y);
        console.log('[Engine] Starting game loop');
        this.gameLoop.start();
        
        this.startFPSCounter();
        this.startAutoRefresh();
        
        this.hudSystem.init('ui-layer');
        this.hudSystem.createCombatLog({
            maxEntries: 10,
            headless: typeof RealmKit.RealmGameUI === 'function'
        });

        if (typeof RealmKit.RealmGameUI === 'function') {
            this.gameUI = new RealmKit.RealmGameUI(this);
            this.gameUI.init('ui-layer');
            if (this.questTracker) {
                this.questTracker.destroy();
                this.questTracker = null;
            }
        }
        
        this.testHarness.runMapGenerationTests();
        
        if (this.config.debug && this.config.debug.enabled) {
            window.combatSystem = this.combatSystem;
            window.testHarness = this.testHarness;
            window.hudSystem = this.hudSystem;
            window.inventoryManager = this.inventoryManager;
            window.storyBuilder = this.storyBuilder;
            window.storyDatabase = this.storyBuilder ? this.storyBuilder.db : null;
            console.log('[Engine] Debug systems exposed to window');
            console.log('[Engine] Test hooks: window.storyBuilder, window.storyDatabase');

            var testPotion = RealmKit.Consumable.create('potion_health');
            this.inventoryManager.addItem(testPotion);
            console.log('[Engine] Gave player starting health potion');
        }
        
        // ── URL Test Hooks ─────────────────────────────────────────────────────
        this._runTestHooks();

        // ── FadeTransition init ─────────────────────────────────────────────
        if (this.fadeTransition && this.renderer) {
            this.fadeTransition.init(this.renderer);
            this._fadeTransitionReady = true;
            console.log('[Engine] FadeTransition initialized');
        }

        // ── AchievementSystem unlock notification ──────────────────────────
        var _self = this;
        if (this.achievementSystem) {
            this.achievementSystem.onUnlock = function(achievement) {
                console.log('[Achievement] Unlocked:', achievement.id, '-', achievement.title);
                if (_self.hudSystem) {
                    _self.hudSystem.addCombatLogEntry('🏆 Achievement: ' + achievement.title, 'achievement');
                }
                if (_self.featureTestPanel) {
                    _self.featureTestPanel.logEvent('🏆 ' + achievement.title, 'achievement');
                }
            };
            console.log('[Engine] AchievementSystem callbacks wired');
        }

        // ── ExperienceManager level-up → AchievementSystem sync ────────
        if (this.experienceManager) {
            this.experienceManager.onLevelUp = function(entityId, oldLevel, newLevel, levelData) {
                console.log('[Engine] Level up:', entityId, oldLevel, '->', newLevel);
                
                // Sync to AchievementSystem
                if (_self.achievementSystem && entityId === (_self.player && _self.player.id)) {
                    _self.achievementSystem.setStat('level', newLevel);
                    
                    // Show level-up notification
                    if (_self.hudSystem) {
                        _self.hudSystem.addCombatLogEntry('⬆️ Level Up! Now level ' + newLevel, 'levelup');
                    }
                    if (_self.featureTestPanel) {
                        _self.featureTestPanel.logEvent('⬆️ Level ' + newLevel + ' (HP+' + levelData.hpBonus + ', ATK+' + levelData.attackBonus + ')', 'levelup');
                    }
                }
            };
            
            this.experienceManager.onXpGain = function(entityId, amount, level, reason) {
                // Track total XP for achievements
                if (_self.achievementSystem && entityId === (_self.player && _self.player.id)) {
                    var data = _self.experienceManager.getXP(entityId);
                    if (data) {
                        _self.achievementSystem.setStat('totalXp', data.totalXp);
                    }
                }
            };
            console.log('[Engine] ExperienceManager callbacks wired');
        }

        // ── QuestSystem — register starter quests ─────────────────────────
        if (this.questSystem) {
            this.questSystem.register({
                id: 'kill_first_enemy',
                title: 'First Blood',
                description: 'Defeat your first enemy.',
                objectives: [{ id: 'kill_any', type: 'kill', target: 'any', required: 1 }],
                rewards: { gold: 25, xp: 50 },
                autoComplete: true
            });
            this.questSystem.register({
                id: 'kill_five_enemies',
                title: 'Warrior Initiate',
                description: 'Defeat 5 enemies.',
                objectives: [{ id: 'kill_any', type: 'kill', target: 'any', required: 5 }],
                rewards: { gold: 75, xp: 150 },
                prerequisites: ['kill_first_enemy'],
                autoComplete: true
            });
            this.questSystem.register({
                id: 'kill_ten_goblins',
                title: 'Goblin Slayer',
                description: 'Defeat 10 Goblins.',
                objectives: [{ id: 'kill_goblin', type: 'kill', target: 'Goblin', required: 10 }],
                rewards: { gold: 150, xp: 300 },
                autoComplete: true
            });
            this.questSystem.start('kill_first_enemy');
            this.questSystem.start('kill_five_enemies');
            this.questSystem.start('kill_ten_goblins');
            this.questSystem.onQuestStart = function(quest) {
                console.log('[Quest] Started:', quest.title);
                if (_self.hudSystem) {
                    _self.hudSystem.addCombatLogEntry('📜 Quest: ' + quest.title, 'quest');
                }
            };
            this.questSystem.onQuestComplete = function(quest, rewards) {
                console.log('[Quest] Complete:', quest.title, 'rewards:', rewards);
                if (_self.hudSystem) {
                    _self.hudSystem.addCombatLogEntry('✅ Quest complete: ' + quest.title, 'quest');
                }
                if (rewards && rewards.gold && _self.inventoryManager) {
                    _self.inventoryManager.addGold(rewards.gold);
                }
                if (_self.featureTestPanel) {
                    _self.featureTestPanel.logEvent('✅ Quest complete: ' + quest.title, 'quest');
                }
            };
            console.log('[Engine] QuestSystem quests registered and started');
        }

        // ── DialogueSystem — NPC dialogue content ─────────────────────────
        if (this.dialogueSystem) {
            this.dialogueSystem.createSimpleDialogue('merchant_talk', 'Merchant', [
                'Welcome, traveler! Fine wares for the discerning adventurer.',
                'These lands grow more dangerous by the day — stay sharp!',
                'Come back when your pockets are heavier with gold.',
                'Safe travels, friend.'
            ]);
            this.dialogueSystem.createSimpleDialogue('guard_talk', 'Guard', [
                'Halt! State your business.',
                'Move along, citizen. Nothing to see here.',
                'These roads aren\'t safe after dark. Be warned.'
            ]);
            this.dialogueSystem.onDialogueEnd = function(dialogue) {
                console.log('[Dialogue] Ended:', dialogue ? dialogue.id : '?');
            };
            // Wire merchant NPC to use dialogue if present
            var merchantNpc = this.entityManager.get('npc_merchant');
            if (merchantNpc) {
                merchantNpc.dialogueId = 'merchant_talk';
            }
            console.log('[Engine] DialogueSystem content loaded');
        }

        // ── NPCSpawner — create spawners at enemy spawn points ────────────
        if (this.npcSpawner && this.tileMap) {
            var enemySpawnPts = (this.tileMap.spawns || []).filter(function(s) { return s.type === 'enemy'; });
            // Create one group spawner at map center if no spawn points available
            if (enemySpawnPts.length === 0) {
                enemySpawnPts = [{ x: this.mapBounds.width / 2 + 200, y: this.mapBounds.height / 2 }];
            }
            for (var sp = 0; sp < Math.min(enemySpawnPts.length, 3); sp++) {
                this.npcSpawner.createSpawner({
                    id: 'auto_spawner_' + sp,
                    x: enemySpawnPts[sp].x,
                    y: enemySpawnPts[sp].y,
                    radius: 150,
                    npcType: 'npc',
                    npcConfig: {
                        name: 'Goblin',
                        width: 32, height: 48,
                        behavior: 'hostile',
                        faction: 'hostile',
                        stats: { hp: 20, maxHp: 20, attack: 10, defense: 3, speed: 80 },
                        aggroRange: 200,
                        attackRange: 38
                    },
                    maxNPCs: 8,
                    respawnDelay: 15000,
                    spawnOnStart: false
                });
            }
            console.log('[Engine] NPCSpawner created', Math.min(enemySpawnPts.length, 3), 'spawners');
        }

        // ── WeatherSystem — set initial weather based on spawn biome ──────
        if (this.weatherSystem && this.tileMap && this.tileMap.layers && this.tileMap.layers[0]) {
            var tw = this.tileMap.tileWidth || 32;
            var th = this.tileMap.tileHeight || 32;
            var cx = Math.floor(playerSpawn.x / tw);
            var cy = Math.floor(playerSpawn.y / th);
            var biomeCounts = {};
            var biomeLayer = this.tileMap.layers[0];
            var mw = this.tileMap.width;
            for (var by = cy - 5; by <= cy + 5; by++) {
                for (var bx = cx - 5; bx <= cx + 5; bx++) {
                    if (bx < 0 || bx >= mw || by < 0 || by >= this.tileMap.height) continue;
                    var tileId = biomeLayer[by * mw + bx];
                    biomeCounts[tileId] = (biomeCounts[tileId] || 0) + 1;
                }
            }
            var dominantTile = 3; // default grass
            var dominantCount = 0;
            for (var tid in biomeCounts) {
                if (biomeCounts[tid] > dominantCount) {
                    dominantCount = biomeCounts[tid];
                    dominantTile = parseInt(tid, 10);
                }
            }
            // Map dominant tile to weather
            var initWeather = 'clear', initIntensity = 0.3, initWind = 0;
            if (dominantTile === 27) { initWeather = 'storm';  initIntensity = 0.4; initWind = 1.2; }     // Desert
            else if (dominantTile === 28) { initWeather = 'snow';   initIntensity = 0.5; initWind = 0.5; } // Tundra
            else if (dominantTile === 26) { initWeather = 'rain';   initIntensity = 0.4; initWind = 0.3; } // Swamp
            else if (dominantTile === 29) { initWeather = 'rain';   initIntensity = 0.3; initWind = 0.2; } // Wetland
            else if (dominantTile === 25) { initWeather = 'rain';   initIntensity = 0.2; initWind = 0.1; } // Forest (light)
            this.weatherSystem.setWeather(initWeather, initIntensity, initWind);
            console.log('[Engine] WeatherSystem set to', initWeather, 'for biome tile', dominantTile);
        }

        // ── SaveManager — start auto-save ─────────────────────────────────
        if (this.saveManager) {
            this.saveManager.startAutoSave(this);
            console.log('[Engine] SaveManager auto-save started');
        }
    }
    
    findSafeSpawnPoint(centerX, centerY, collisionMap, mapWidth, mapHeight, tileWidth, tileHeight) {
        for (var radius = 0; radius < 20; radius++) {
            for (var dy = -radius; dy <= radius; dy++) {
                for (var dx = -radius; dx <= radius; dx++) {
                    var tx = centerX + dx;
                    var ty = centerY + dy;
                    
                    if (tx < 1 || tx >= mapWidth - 1 || ty < 1 || ty >= mapHeight - 1) continue;
                    
                    if (this.is3x3Safe(tx, ty, collisionMap, mapWidth, mapHeight)) {
                        return { x: tx * tileWidth + tileWidth / 2, y: ty * tileHeight + tileHeight / 2 };
                    }
                }
            }
        }
        
        return { x: this.mapBounds.width / 2, y: this.mapBounds.height / 2 };
    }
    
    is3x3Safe(cx, cy, collisionMap, mapWidth, mapHeight) {
        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                var tx = cx + dx;
                var ty = cy + dy;
                if (tx < 0 || tx >= mapWidth || ty < 0 || ty >= mapHeight) return false;
                if (collisionMap[ty * mapWidth + tx] === 1) return false;
            }
        }
        return true;
    }
    
    initTileMap(overrides) {
        overrides = overrides || {};
        var tileSize  = overrides.tileSize  || 32;
        // Auto-scale default tile count so the baked canvas stays ≤ ~4096px per axis
        var defaultTiles = Math.max(32, Math.floor(4096 / tileSize));
        // Support separate mapWidth/mapHeight; fall back to mapSize for back-compat
        var mapWidth  = overrides.mapWidth  || overrides.mapSize || defaultTiles;
        var mapHeight = overrides.mapHeight || overrides.mapSize || defaultTiles;

        // Build terrain config and remember it for DevPanel / regen
        var prev = this.terrainConfig || {};
        this.terrainConfig = {
            tileSize:      tileSize,
            width:         mapWidth,
            height:        mapHeight,
            seed:          overrides.seed          !== undefined ? overrides.seed          : (prev.seed          || Math.random() * 999999),
            waterLevel:    overrides.waterLevel    !== undefined ? overrides.waterLevel    : (prev.waterLevel    || 0.22),
            hillLevel:     overrides.hillLevel     !== undefined ? overrides.hillLevel     : (prev.hillLevel     || 0.78),
            mountainLevel: overrides.mountainLevel !== undefined ? overrides.mountainLevel : (prev.mountainLevel || 0.88),
            elevationScale:overrides.elevationScale!== undefined ? overrides.elevationScale: (prev.elevationScale|| 0.008),
            flat:          overrides.flat          !== undefined ? overrides.flat          : (prev.flat          || false)
        };

        // Use a pre-loaded server tileset if provided, otherwise generate procedurally
        if (overrides.tileset) {
            this.tileset = overrides.tileset;
            console.log('[Engine] Using pre-loaded tileset:', this.tileset.name);
        } else {
            this.tileset = RealmKit.Tileset.createProcedural(tileSize, 8, 16); // 8×16 = 128 frames
        }
        if (overrides.blank) {
            this.tileMap = new RealmKit.TileMap({
                name: 'studio_blank',
                tileWidth: this.tileset.tileWidth,
                tileHeight: this.tileset.tileHeight,
                width: mapWidth,
                height: mapHeight
            });
            this.tileMap.setTileset(this.tileset);
            this.tileMap.addLayer('terrain', new Array(mapWidth * mapHeight).fill(overrides.blankTileId !== undefined ? overrides.blankTileId : 3));
            this.tileMap.setCollisionData(new Array(mapWidth * mapHeight).fill(0));
            this.tileMap.spawns = [];
            this.tileMap.triggers = [];
            this.tileMap.settlements = [];
            this.tileMap.zones = [];
            this.tileMap.buildMapCanvas();
        } else {
            this.tileMap = RealmKit.TileMap.createTestMap(
                this.tileset, mapWidth, mapHeight, this.terrainConfig
            );
        }

        this.mapBounds.width  = mapWidth  * tileSize;
        this.mapBounds.height = mapHeight * tileSize;

        // Initialize quadtree and pathfinding with new map
        if (RealmKit.Quadtree) {
            this.quadtree = new RealmKit.Quadtree({
                x: 0, y: 0,
                width: this.mapBounds.width,
                height: this.mapBounds.height
            }, 10, 5);
            console.log('[Engine] Quadtree initialized for', this.mapBounds.width, 'x', this.mapBounds.height);
        }
        
        if (RealmKit.Pathfinding && this.tileMap) {
            this.pathfinding = new RealmKit.Pathfinding(this.tileMap);
            this.pathfinding.buildGrid();
            console.log('[Engine] Pathfinding grid built');
        }
        
        if (this.pathRequestManager && this.pathfinding) {
            this.pathRequestManager.setPathfinding(this.pathfinding);
            console.log('[Engine] PathRequestManager linked');
        }

        // Register settlement campfire lights (warm orange, large radius)
        this.lightSources = this.lightSources.filter(function(l) { return l.id === 'player'; });
        var settlements = this.tileMap.settlements || [];
        for (var _si = 0; _si < settlements.length; _si++) {
            var _s = settlements[_si];
            this.registerLight(
                'settlement_' + _si,
                _s.x * tileSize + tileSize / 2,
                _s.y * tileSize + tileSize / 2,
                160, '#ffa040', 0.9
            );
        }

        console.log('[Engine] Tile map:', mapWidth + 'x' + mapHeight,
            'tiles,', this.mapBounds.width + 'x' + this.mapBounds.height + 'px');
    }

    _bootStudioWorkspace(serverTileset, serverTileSize) {
        console.log('[Engine] Booting studio workspace');

        this.initTileMap({
            tileset: serverTileset,
            tileSize: serverTileSize || 32,
            mapWidth: 64,
            mapHeight: 64,
            blank: true,
            blankTileId: 30,
            flat: true
        });

        if (this.weatherSystem && this.weatherSystem.clear) {
            this.weatherSystem.clear();
        }
        if (this.particles && this.particles.clear) {
            this.particles.clear();
        }
        if (this.projectileSystem && this.projectileSystem.clear) {
            this.projectileSystem.clear();
        }
        if (this.entityManager && this.entityManager.clear) {
            this.entityManager.clear();
        }
        if (this.npcSpawner && this.npcSpawner.clear) {
            this.npcSpawner.clear();
        }
        if (this.spawnerManager && this.spawnerManager.clear) {
            this.spawnerManager.clear();
        }
        if (this.triggerSystem && this.triggerSystem.clear) {
            this.triggerSystem.clear();
        }
        if (this.zoneManager && this.zoneManager.clear) {
            this.zoneManager.clear();
        }
        if (this.actionQueue && this.actionQueue.clear) {
            this.actionQueue.clear();
        }
        this.dayNight.paused = true;

        this.player = null;
        this.partyManager = null;
        this.inputController = null;
        this.lootDrops = [];
        this.currentPartyMemberId = null;
        if (this.camera) {
            this.camera.setTarget(null);
            this.camera.x = 0;
            this.camera.y = 0;
        }
        if (this.renderer && this.renderer.viewport) {
            this.renderer.viewport.x = 0;
            this.renderer.viewport.y = 0;
        }

        this.assetsLoaded = true;
        this.gameLoop.start();

        console.log('[Engine] Studio workspace ready:', this.tileMap.width + 'x' + this.tileMap.height);
    }

    regenerateWorld(overrides) {
        overrides = overrides || {};
        // Wrap with fade transition if available
        if (this._fadeTransitionReady && this.fadeTransition) {
            var self = this;
            var capturedOverrides = overrides;
            this.fadeTransition.transition({
                onBlack: function() { self._doRegenWorld(capturedOverrides); }
            }, function() {
                console.log('[Engine] Fade-in complete after world regen');
            });
            return;
        }
        this._doRegenWorld(overrides);
    }

    _doRegenWorld(overrides) {
        overrides = overrides || {};
        console.log('[Engine] Regenerating world — seed:', Math.floor(
            overrides.seed !== undefined ? overrides.seed
            : (this.terrainConfig ? this.terrainConfig.seed : 0)
        ));

        // Generate new tilemap (merges overrides with terrainConfig for any unset field)
        this.initTileMap(overrides);

        // Force minimap rebuild on next render frame
        this.minimapBuilt = false;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.minimapLoggedOnce = false;

        // Teleport player to the new map's spawn point
        var spawnPoints = this.tileMap.spawns || [];
        var playerSpawn = null;
        for (var i = 0; i < spawnPoints.length; i++) {
            if (spawnPoints[i].type === 'player') { playerSpawn = spawnPoints[i]; break; }
        }
        if (!playerSpawn && spawnPoints.length > 0) {
            playerSpawn = spawnPoints[0]; // fall back to first spawn of any type
        }
        if (playerSpawn && this.player) {
            this.player.x = playerSpawn.x;
            this.player.y = playerSpawn.y;
            this.player.velocityX = 0;
            this.player.velocityY = 0;
        }
        if (this.camera && this.player) {
            this.camera.x = this.player.x;
            this.camera.y = this.player.y;
        }

        // Invalidate the pre-rendered map canvas so it rebuilds with the new tilemap
        // (the new TileMap instance already starts with mapReady=false, but be explicit)
        if (this.tileMap) {
            this.tileMap.mapReady = false;
            this.tileMap.mapCanvas = null;
        }

        // Update camera map bounds to match the new map size
        if (this.camera) {
            this.camera.mapWidth  = this.mapBounds.width;
            this.camera.mapHeight = this.mapBounds.height;
        }

        console.log('[Engine] World regenerated — map:', this.tileMap.width + 'x' + this.tileMap.height,
            'seed:', Math.floor(this.terrainConfig.seed || 0));
    }
    
    buildMinimap() {
        if (!this.tileMap || !this.tileMap.layers || !this.tileMap.layers[0]) {
            // Layer data not ready yet — leave minimapBuilt = false so we retry next frame
            return;
        }

        var mapW = this.tileMap.width;
        var mapH = this.tileMap.height;

        var canvasW = this.renderer.displayWidth || 800;
        var canvasH = this.renderer.displayHeight || 600;

        // Target longest edge of minimap = 18% of the shorter viewport dimension,
        // capped at 200 px so it never dominates the screen on large viewports.
        var targetSize = Math.min(200, Math.floor(Math.min(canvasW, canvasH) * 0.18));

        // Derive a uniform scale that fits the whole map within targetSize × targetSize
        var scale = targetSize / Math.max(mapW, mapH);
        scale = Math.max(0.01, scale);

        // Final pixel dimensions preserve the map's actual aspect ratio
        var mmW = Math.max(1, Math.round(mapW * scale));
        var mmH = Math.max(1, Math.round(mapH * scale));
        
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = mmW;
        this.minimapCanvas.height = mmH;
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        var groundData = this.tileMap.layers[0].data;
        
        var tileColors = {
            // Base tiles 0-24
            0: '#1a5276', 1: '#2980b9', 2: '#f9e79f', 3: '#27ae60',
            4: '#229954', 5: '#a0522d', 6: '#7f8c8d', 7: '#5d6d7e',
            8: '#626567', 9: '#fdfefe', 10: '#cd853f', 11: '#cd853f',
            12: '#cd853f', 13: '#8b4513', 14: '#8b4513', 15: '#5dade2',
            16: '#95a5a6', 17: '#5d6d7e', 18: '#d4ac0d', 19: '#7d6608',
            20: '#6e2c00', 21: '#1e8449', 22: '#27ae60', 23: '#616a6a',
            24: '#d4ac0d',
            // Biome tiles 25-31
            25: '#0b5345', // FOREST    — deep forest green
            26: '#2c3a1e', // SWAMP     — dark muddy olive
            27: '#c8a951', // DESERT    — warm sand
            28: '#aab7b8', // TUNDRA    — icy blue-grey
            29: '#117a65', // WETLAND   — teal marsh
            30: '#7dbb4a', // MEADOW    — bright meadow green
            31: '#7d6608'  // ANCIENT   — weathered brown stone
        };
        
        var defaultColor = '#27ae60';
        var pixelSize = Math.max(1, Math.ceil(scale));
        
        for (var y = 0; y < mapH; y++) {
            for (var x = 0; x < mapW; x++) {
                var idx = y * mapW + x;
                var tileId = groundData[idx];
                var color = tileColors[tileId] || defaultColor;
                
                this.minimapCtx.fillStyle = color;
                this.minimapCtx.fillRect(
                    Math.floor(x * scale),
                    Math.floor(y * scale),
                    pixelSize,
                    pixelSize
                );
            }
        }
        
        this.minimapBuilt = true;
        this.minimapLoggedOnce = false; // allow one fresh log after each build
        console.log('[MINIMAP] Built size', mmW, 'x', mmH, 'canvas', canvasW, 'x', canvasH);
        this.sendLog('sid=' + this.sessionId + '&type=minimap&size=' + mmW + 'x' + mmH);
    }
    
    start() {
        
        if (!this.init()) {
            console.error('[Engine] Failed to initialize');
            return;
        }
        
        return this;
    }
    
    async loadStory(storyId) {
        var self = this;
        
        if (!this.storyDatabase) {
            this.storyDatabase = new RealmKit.StoryDatabase({
                baseUrl: this.config.apiUrl || '/RealmKit/api'
            });
        }
        
        this.currentStoryId = storyId || null;
        
        try {
            var story = await this.storyDatabase.applyToEngine(storyId, this);
            this.currentStory = story;
            console.log('[Engine] Story loaded from API:', story.title);
            return story;
        } catch (e) {
            console.warn('[Engine] Failed to load story from API:', e.message);
            console.log('[Engine] Falling back to default story');
            return this.loadDefaultStory();
        }
    }
    
    loadDefaultStory() {
        var story = RealmKit.DefaultStory || {
            id: 'default',
            title: 'Default World',
            engine_configs: {
                terrain_water_level: 0.22,
                terrain_hill_level: 0.78,
                terrain_mountain_level: 0.88,
                terrain_elevation_scale: 0.008,
                default_weather: 'clear',
                weather_intensity: 0.3,
                day_night_speed: 120,
                default_map_width: 256,
                default_map_height: 256
            },
            factions: [],
            faction_relations: [],
            story_flag_definitions: []
        };

        this.storyUIConfig = {
            uiMode: 'hybrid',
            themeKey: 'realmkit-parchment',
            resourceLabels: {
                hp: 'HP',
                mp: 'MP',
                xp: 'XP',
                level: 'Level',
                gold: 'Gold'
            },
            panels: {
                inventory: true,
                character: true,
                quests: true,
                dialogue: true,
                pause: true,
                minimap: true
            },
            layout: {
                draggable: true,
                snapToEdges: true,
                rememberPositions: true
            }
        };
        
        var ec = story.engine_configs;
        this.regenerateWorld({
            waterLevel: ec.terrain_water_level,
            hillLevel: ec.terrain_hill_level,
            mountainLevel: ec.terrain_mountain_level,
            elevationScale: ec.terrain_elevation_scale,
            mapWidth: ec.default_map_width,
            mapHeight: ec.default_map_height,
            seed: Math.floor(Math.random() * 100000)
        });
        
        if (this.weatherSystem && ec.default_weather) {
            this.weatherSystem.setWeather(ec.default_weather, ec.weather_intensity || 0.3, 0);
        }
        
        if (story.factions && story.faction_relations) {
            RealmKit.FactionRelations = {};
            var factionIdToName = {};
            for (var i = 0; i < story.factions.length; i++) {
                var fName = story.factions[i].name;
                RealmKit.FactionRelations[fName] = {};
                factionIdToName[story.factions[i].id] = fName;
            }
            for (var i = 0; i < story.faction_relations.length; i++) {
                var rel = story.faction_relations[i];
                var type = rel.relation_type === 'enemy' ? 'foe' : rel.relation_type;
                var nameA = factionIdToName[rel.faction_a_id] || rel.faction_a_id;
                var nameB = factionIdToName[rel.faction_b_id] || rel.faction_b_id;
                RealmKit.FactionRelations[nameA] = RealmKit.FactionRelations[nameA] || {};
                RealmKit.FactionRelations[nameB] = RealmKit.FactionRelations[nameB] || {};
                RealmKit.FactionRelations[nameA][nameB] = type;
                RealmKit.FactionRelations[nameB][nameA] = type;
            }
            console.log('[Engine] Faction relations loaded:', Object.keys(RealmKit.FactionRelations));
        }
        
        if (story.story_flag_definitions) {
            this._storyFlags = {};
            for (var i = 0; i < story.story_flag_definitions.length; i++) {
                var flag = story.story_flag_definitions[i];
                var defaultVal = flag.default_value;
                if (flag.flag_type === 'boolean') {
                    defaultVal = defaultVal === 'true' || defaultVal === true;
                } else if (flag.flag_type === 'integer') {
                    defaultVal = parseInt(defaultVal, 10) || 0;
                }
                this._storyFlags[flag.flag_key] = defaultVal;
            }
        }
        
        this.currentStory = story;
        this.currentStoryId = story.id;
        
        if (RealmKit.MonsterTemplateManager && !this.monsterTemplateManager) {
            this.monsterTemplateManager = new RealmKit.MonsterTemplateManager();
            RealmKit.monsterTemplateManager = this.monsterTemplateManager;
            console.log('[Engine] MonsterTemplateManager initialized');
        }
        
        if (RealmKit.SpawnerManager && !this.spawnerManager) {
            this.spawnerManager = new RealmKit.SpawnerManager({ 
                templateManager: this.monsterTemplateManager 
            });
            this.spawnerManager.setEntityManager(this.entityManager);
            console.log('[Engine] SpawnerManager initialized');
        }
        
        if (RealmKit.TriggerSystem && !this.triggerSystem) {
            this.triggerSystem = new RealmKit.TriggerSystem();
            console.log('[Engine] TriggerSystem initialized');
        }
        
        if (RealmKit.LocationSystem && !this.locationSystem) {
            this.locationSystem = new RealmKit.LocationSystem();
            console.log('[Engine] LocationSystem initialized');
        }
        
        if (RealmKit.ZoneManager && !this.zoneManager) {
            this.zoneManager = new RealmKit.ZoneManager(this);
            console.log('[Engine] ZoneManager initialized');
        }
        
        console.log('[Engine] Default story loaded:', story.title);
        return story;
    }
    
    stop() {
        // Cleanup event listeners
        if (this._onFirstGesture) {
            window.removeEventListener('keydown', this._onFirstGesture, true);
            window.removeEventListener('click',   this._onFirstGesture, true);
            this._onFirstGesture = null;
        }
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this._onMinimapClick) {
            this.renderer.canvas.removeEventListener('click', this._onMinimapClick);
            this._onMinimapClick = null;
        }
        if (this._onMouseMove) {
            this.renderer.canvas.removeEventListener('mousemove', this._onMouseMove);
            this._onMouseMove = null;
        }
        
        if (this.inputHandler) {
            this.inputHandler.destroy();
            this.inputHandler = null;
        }
        
        if (this.gameLoop) {
            this.gameLoop.stop();
        }
        console.log('[Engine] Stopped');
    }
    
    update(deltaTime) {
        if (!this.assetsLoaded) return;
        this.totalElapsed = (this.totalElapsed || 0) + deltaTime;
        
        var world = {
            tileMap: this.tileMap,
            mapBounds: this.mapBounds,
            player: this.player,
            entities: this.entityManager.entities,
            combatSystem: this.combatSystem,
            particles: this.particles,
            audio: this.audio,
            engine: this,
            quadtree: this.quadtree,
            pathfinding: this.pathfinding
        };

        // Update AI system world reference
        if (this.aiSystem) {
            this.aiSystem.setWorld(world);
        }

        // Update controlled unit via InputController
        if (this.inputController) {
            this.inputController.update(deltaTime);
        }
        
        // Update party manager
        if (this.partyManager) {
            this.partyManager.update(deltaTime);
        }
        
        // Update old player reference for backward compatibility
        if (this.inputController) {
            var controlledUnit = this.inputController.getControlledUnit();
            if (controlledUnit) {
                // Update this.player for compatibility
                this.player = controlledUnit;
            }
        }
        
        this.entityManager.update(deltaTime, world);
        
        world.tileMap = this.tileMap;
        
        // Collision logging disabled - too noisy
        // if (this.player && this.player.lastCollision) {
        //     this.logCollision(this.player.lastCollision);
        // }
        
        // if (this.lastEntityCollision) {
        //     this.logEntityCollision(this.lastEntityCollision);
        //     this.lastEntityCollision = null;
        // }
        
        this.particles.update(deltaTime);
        this.projectileSystem.update(deltaTime);

        this.updateLootDrops(deltaTime);
        this.checkEntityDeath();
        this.updateStatusEffects(deltaTime);

        // Fade transition
        if (this.fadeTransition) {
            this.fadeTransition.update(deltaTime);
        }

        // Weather system
        if (this.weatherSystem && !this.isStudioMode) {
            this.weatherSystem.update(deltaTime);
        }

        // NPC spawner (respawn management)
        if (this.npcSpawner && this.entityManager) {
            this.npcSpawner.update(deltaTime, this.entityManager);
        }

        // Monster spawner system
        if (this.spawnerManager && this.entityManager) {
            this.entityManager.timeOfDay = RealmKit.TimeOfDay.getTimeOfDay(this.dayNight.time);
            this.entityManager.hourOfDay = RealmKit.TimeOfDay.getHour(this.dayNight.time);
            this.spawnerManager.update(deltaTime);
        }
        
        // Path request processing
        if (this.pathRequestManager) {
            this.pathRequestManager.update(deltaTime);
        }

        // AI System update for template-based entities
        if (this.aiSystem) {
            this.aiSystem.update(deltaTime);
        }

        // Trigger zone system
        if (this.triggerSystem && this.player) {
            this.triggerSystem.updatePositions(this.entityManager.entities, { 
                engine: this, 
                player: this.player 
            });
            this.triggerSystem.updateTimers({ engine: this, player: this.player });
        }

        // Zone transition system
        if (this.zoneManager && this.player) {
            this.zoneManager.update(deltaTime);
            
            var zoneTransition = this.zoneManager.checkPlayerPosition(this.player, this.inventoryManager);
            if (zoneTransition) {
                this.zoneManager.initiateTransition(zoneTransition, this.player, this.inventoryManager, function(transition) {
                    console.log('[Engine] Zone transition callback:', transition.targetMap);
                    
                    // Handle map change
                    if (transition.targetMap && transition.targetMap !== self.mapId) {
                        // For now, regenerate world with different seed/config
                        // In a full impl, this would load different map files
                        console.log('[Engine] Switching to map:', transition.targetMap);
                        
                        // Generate new map with different seed based on targetMap name
                        var newSeed = self.zoneManager.getMapSeed ? self.zoneManager.getMapSeed(transition.targetMap) : Date.now();
                        self.mapId = transition.targetMap;
                        self.regenerateWorld({ seed: newSeed });
                    }
                    
                    var spawn = self.zoneManager.getSpawnPoint(transition.targetSpawnId);
                    if (spawn && spawn.x !== 0 && spawn.y !== 0) {
                        self.player.x = spawn.x;
                        self.player.y = spawn.y;
                    }
                    
                    if (self.fadeTransition) {
                        self.fadeTransition.fadeIn(500);
                    }
                });
            }
        }

        // Effect bar system (buff/debuff timers)
        if (this.effectBarSystem) {
            this.effectBarSystem.update(deltaTime);
        }

        // Party formation update
        if (this.partyManager) {
            this.partyManager.update(deltaTime);
        }

        // Achievement check (throttled - every 5 seconds)
        if (this.achievementSystem && (!this._lastAchieveCheck || Date.now() - this._lastAchieveCheck > 5000)) {
            this._lastAchieveCheck = Date.now();
            this.achievementSystem.checkAchievements();
        }

        // Quadtree rebuild (for spatial queries)
        if (this.quadtree && this.tileMap) {
            this.quadtree.clear();
            if (this.entityManager && this.entityManager.entities) {
                for (var i = 0; i < this.entityManager.entities.length; i++) {
                    this.quadtree.insert(this.entityManager.entities[i]);
                }
            }
        }

        // Screen shake decay
        this._updateShake(deltaTime);

        // Day/night advancement + dynamic player light
        if (!this.dayNight.paused && !this.isStudioMode) {
            this.dayNight.time = (this.dayNight.time + (deltaTime / 1000) * this.dayNight.speed) % this.dayNight.cycleSeconds;
        }
        
        // Cache timeOfDay phase for spawners/triggers
        if (RealmKit.TimeOfDay) {
            this.timeOfDay = RealmKit.TimeOfDay.getTimeOfDay(this.dayNight.time);
        }
        
        if (this.player) {
            // Player always carries a torch; radius shrinks near noon
            var dn = this.dayNight;
            var cosT = Math.cos((dn.time / dn.cycleSeconds) * Math.PI * 2);
            var nightFactor = 0.5 + cosT * 0.5;   // 0 at noon, 1 at midnight
            var torchRadius = (90 + nightFactor * 110) * (this.lightRadiusMultiplier || 1.0);
            this.registerLight('player', this.player.x, this.player.y, torchRadius, '#ffe0a0', 1.0);
        }

        // Footstep audio
        if (this.audio && this.player && this.player.isMoving) {
            this.audio.tickFootstep(deltaTime);
        }

        if (this.isStudioMode && this.camera && this.inputHandler && this.renderer && this.renderer.viewport) {
            var pan = this.inputHandler.getMovement();
            if (pan.x !== 0 || pan.y !== 0) {
                var step = (this.studioPanSpeed || 720) * (deltaTime / 1000);
                this.camera.x = Math.max(0, Math.min(this.camera.x + pan.x * step, Math.max(0, this.mapBounds.width - this.renderer.viewport.viewWidth)));
                this.camera.y = Math.max(0, Math.min(this.camera.y + pan.y * step, Math.max(0, this.mapBounds.height - this.renderer.viewport.viewHeight)));
                this.renderer.viewport.x = this.camera.x;
                this.renderer.viewport.y = this.camera.y;
            }
        } else if (this.camera && this.player) {
            this.camera.update(
                this.renderer.viewport.viewWidth,
                this.renderer.viewport.viewHeight,
                this.mapBounds.width,
                this.mapBounds.height
            );
            this.renderer.viewport.x = this.camera.x;
            this.renderer.viewport.y = this.camera.y;
        }
    }
    
    render(alpha) {
        var now = performance.now();
        if (this.lastFrameEndMs > 0) {
            this.frameGapMs = now - this.lastFrameEndMs;
        }
        this.frameStartMs = now;
        
        this.renderer.clear();

        this.renderer.ctx.save();
        // Screen shake — applied before scale so it moves the whole world uniformly
        if (this.shake.remaining > 0) {
            this.renderer.ctx.translate(this.shake.x, this.shake.y);
        }
        this.renderer.ctx.scale(this.renderer.viewport.currentScale, this.renderer.viewport.currentScale);
        this.renderer.ctx.translate(-this.renderer.viewport.x, -this.renderer.viewport.y);

        var tileStart = performance.now();
        this.renderGroundLayer();
        this.tileRenderTime = performance.now() - tileStart;

        var spriteStart = performance.now();
        this.renderActorLayer();
        this.spriteRenderTime = performance.now() - spriteStart;

        this.renderer.ctx.restore();

        // Lighting overlay (day/night + light sources) — drawn in screen space
        this.renderLightingLayer();

        // Weather overlay
        if (this.weatherSystem && !this.isStudioMode) {
            this.weatherSystem.render(this.renderer.ctx, this.renderer.viewport);
        }

        // Fade transition overlay — pass screen-space rect so fill covers the whole canvas
        if (this.fadeTransition) {
            var _fadeVP = {
                x: 0, y: 0,
                width:  this.renderer.displayWidth  || this.renderer.canvas.width,
                height: this.renderer.displayHeight || this.renderer.canvas.height
            };
            this.fadeTransition.render(this.renderer.ctx, _fadeVP);
        }

        this.renderUIOverlay();
        
        // Debug overlay for spawners and triggers
        if (this.config && this.config.debug && this.config.debug.showSpawnerDebug) {
            this.renderSpawnerDebug();
        }
        if (this.config && this.config.debug && this.config.debug.showTriggerDebug) {
            this.renderTriggerDebug();
        }
        
        // Zone transitions render
        if (this.zoneManager) {
            this.zoneManager.render(this.renderer.ctx, this.renderer.viewport);
        }
        
        // Map Editor overlay
        if (this.mapEditor && this.mapEditor.editMode) {
            this.mapEditor.renderOverlay(this.renderer.ctx, this.renderer.viewport);
        }

        if (this.worldEditor && this.worldEditor.editMode) {
            this.worldEditor.renderOverlay(this.renderer.ctx, this.renderer.viewport);
        }
        
        this.updateFPSDisplay();
        this.updateDebugInfo();
        
        this.totalRenderMs = performance.now() - this.frameStartMs;
        this.lastFrameEndMs = performance.now();
        this.frameCount++;

        // DevPanel live update (DOM, not canvas — runs after canvas render)
        if (this.devPanel) { this.devPanel.update(this); }
        if (this.featureTestPanel) { this.featureTestPanel.update(); }
        if (this.questTracker && !this.gameUI) { this.questTracker.update(); }
        
        if (this.frameCount % this.perfLogInterval === 0) {
            var logEntry = {
                frame: this.frameCount,
                timestamp: new Date().toISOString().substr(11, 12),
                gapMs: this.frameGapMs.toFixed(1),
                tileMs: this.tileRenderTime.toFixed(2),
                spriteMs: this.spriteRenderTime.toFixed(2),
                totalMs: this.totalRenderMs.toFixed(2),
                fps: this.gameLoop.getFPS(),
                cam: this.cameraMoved ? 'M' : 'S',
                tilesOn: this.renderTiles ? 'Y' : 'N',
                spriteOn: this.renderSprite ? 'Y' : 'N'
            };
            this.perfLog.push(logEntry);
            // console.log('[PERF]', logEntry.timestamp, 'gap:' + logEntry.gapMs + 'ms', 'tile:' + logEntry.tileMs + 'ms', 'spr:' + logEntry.spriteMs + 'ms', 'tot:' + logEntry.totalMs + 'ms', 'fps:' + logEntry.fps);
            this.sendLog(logEntry);
            
            this.sendCombatLogs();
        }
    }
    
    sendCombatLogs() {
        if (!this.combatSystem) return;
        
        var combatLog = this.combatSystem.getCombatLog(10);
        for (var i = 0; i < combatLog.length; i++) {
            var entry = combatLog[i];
            if (!entry.logged) {
                entry.logged = true;
                
                var isPlayer = entry.attackerId === 'player';
                var damage = entry.damage || 0;
                var targetName = entry.targetId || 'unknown';
                var attackerName = entry.attackerId || 'unknown';
                
                if (damage > 0) {
                    var msg = attackerName + ' → ' + targetName + ': ' + damage + ' dmg';
                    var type = isPlayer ? 'player' : 'damage';
                    if (entry.killed) {
                        msg += ' (KILL)';
                        type = 'kill';
                    }
                    if (this.hudSystem) {
                        this.hudSystem.addCombatLogEntry(msg, type);
                    }
                }
                
                this.sendLog({
                    type: 'combat',
                    action: entry.type || entry.abilityId || entry.action || 'attack',
                    attacker: entry.attackerId || entry.entityId || '-',
                    target: entry.targetId || '-',
                    damage: entry.damage || 0,
                    critical: entry.critical ? true : false,
                    killed: entry.killed ? true : false
                });
            }
        }
    }
    
    renderGroundLayer() {
        if (!this.renderTiles || !this.tileMap) {
            this.renderFallbackGround();
            return;
        }
        
        this.tileMap.render(this.renderer.ctx, this.renderer.viewport, this.totalElapsed || Date.now() % 100000);
        
        if (this.config.debug.showGrid) {
            this.renderGridCached();
        }
        
        if (this.config.debug.showTerrainDebug) {
            this.renderTerrainDebug();
        }
        
        if (this.config.debug.showPathDebug && this.pathRequestManager) {
            this.pathRequestManager.renderDebug(this.renderer.ctx, this.renderer.viewport);
        }
    }
    
    renderGridCached() {
        var gridSize = this.tileset ? this.tileset.tileWidth : 32;
        var cacheKey = 'grid_' + gridSize + '_' + this.renderer.viewport.viewWidth + 'x' + this.renderer.viewport.viewHeight;
        
        var cached = this.canvasCache.getCache(cacheKey);
        if (!cached) {
            cached = this.canvasCache.createGridCache(
                gridSize, 
                this.renderer.viewport.viewWidth, 
                this.renderer.viewport.viewHeight,
                'rgba(255,255,255,0.15)',
                0.5
            );
        }
        
        var vx = this.renderer.viewport.x;
        var vy = this.renderer.viewport.y;
        var vw = this.renderer.viewport.viewWidth;
        var vh = this.renderer.viewport.viewHeight;
        
        var offsetX = -(vx % gridSize);
        var offsetY = -(vy % gridSize);
        
        this.renderer.ctx.drawImage(cached, offsetX - gridSize, offsetY - gridSize);
    }
    
    renderFallbackGround() {
        var bounds = this.renderer.viewport.getVisibleBounds();
        
        this.renderer.ctx.fillStyle = '#1a3a2e';
        this.renderer.ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
        
        if (this.config.debug.showGrid) {
            var gridSize = 32;
            this.renderer.ctx.strokeStyle = '#2a4a3e';
            this.renderer.ctx.lineWidth = 0.5;
            
            var startX = Math.floor(bounds.left / gridSize) * gridSize;
            var startY = Math.floor(bounds.top / gridSize) * gridSize;
            
            this.renderer.ctx.beginPath();
            for (var x = startX; x < bounds.right; x += gridSize) {
                this.renderer.ctx.moveTo(x, bounds.top);
                this.renderer.ctx.lineTo(x, bounds.bottom);
            }
            for (var y = startY; y < bounds.bottom; y += gridSize) {
                this.renderer.ctx.moveTo(bounds.left, y);
                this.renderer.ctx.lineTo(bounds.right, y);
            }
            this.renderer.ctx.stroke();
        }
    }
    
    renderActorLayer() {
        if (!this.renderSprite) return;

        // EntityManager.render() handles entity drawing + interaction indicators internally
        this.entityManager.render(this.renderer.ctx, this.spriteRenderer);

        // Render effect bars (buffs/debuffs) above each entity head
        if (this.effectBarSystem) {
            var entities = this.entityManager.entities;
            for (var ei = 0; ei < entities.length; ei++) {
                var ent = entities[ei];
                if (ent && ent.active) {
                    this.effectBarSystem.renderAboveHead(this.renderer.ctx, ent);
                }
            }
        }

        // Render recruitable NPC indicators
        if (this.partyManager && this.player) {
            var npcs = this.entityManager.getByType('npc');
            var recruitableCount = 0;
            for (var ni = 0; ni < npcs.length; ni++) {
                var npc = npcs[ni];
                if (!npc.active || !npc.interactable) continue;
                if (npc.behavior === 'partyMember') continue;
                if (this.partyManager.members.indexOf(npc) !== -1) continue;

                var relation = 'neutral';
                if (RealmKit.FactionRelations && RealmKit.FactionRelations.player) {
                    relation = RealmKit.FactionRelations.player[npc.faction || 'neutral'] || 'neutral';
                }
                var canRecruit = (relation === 'friend' || relation === 'ally' || npc.faction === 'friendly');
                if (!canRecruit) continue;
                
                recruitableCount++;
                var dx = npc.x - this.player.x;
                var dy = npc.y - this.player.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 120) {
                    var screenX = npc.x - this.renderer.viewport.cameraX + this.renderer.viewport.viewWidth / 2;
                    var screenY = npc.y - this.renderer.viewport.cameraY + this.renderer.viewport.viewHeight / 2;

                    this.renderer.ctx.save();
                    this.renderer.ctx.globalAlpha = Math.max(0.3, 1 - dist / 120);

                    this.renderer.ctx.beginPath();
                    this.renderer.ctx.arc(screenX, screenY - 55, 18, 0, Math.PI * 2);
                    this.renderer.ctx.fillStyle = 'rgba(40, 200, 80, 0.7)';
                    this.renderer.ctx.fill();
                    this.renderer.ctx.strokeStyle = '#ffffff';
                    this.renderer.ctx.lineWidth = 2;
                    this.renderer.ctx.stroke();

                    this.renderer.ctx.fillStyle = '#ffffff';
                    this.renderer.ctx.font = 'bold 8px "Press Start 2P", monospace';
                    this.renderer.ctx.textAlign = 'center';
                    this.renderer.ctx.textBaseline = 'middle';
                    this.renderer.ctx.fillText('R', screenX, screenY - 55);

                    this.renderer.ctx.font = '6px "Press Start 2P", monospace';
                    this.renderer.ctx.fillStyle = '#40ff80';
                    this.renderer.ctx.fillText(npc.name || 'Recruit', screenX, screenY - 75);

                    this.renderer.ctx.restore();
                }
            }
            if (recruitableCount > 0 && !this._recruitableLogged) {
                console.log('[Engine] Found', recruitableCount, 'recruitable NPCs');
                this._recruitableLogged = true;
            }
        }

        this.particles.render(this.renderer.ctx, this.renderer.viewport);
        this.projectileSystem.render(this.renderer.ctx, this.renderer.viewport);

        // NOTE: Weather is rendered once in the main render() pass after ctx.restore(),
        // so we do NOT render it here again to avoid double-drawing.

        for (var i = 0; i < this.lootDrops.length; i++) {
            this.lootDrops[i].render(this.renderer.ctx);
        }
    }
    
    renderUIOverlay() {
        if (this.isStudioMode) {
            return;
        }

        // Build the minimap on first render (tiles must be ready at this point).
        // If the condition fails, log WHY so it shows up in the browser console.
        if (!this.minimapBuilt) {
            if (this.tileMap && this.tileMap.layers && this.tileMap.layers[0]) {
                this.buildMinimap(); // sets minimapBuilt = true on success
            } else {
                // Only log once to avoid console spam
                if (!this._minimapWaitLogged) {
                    this._minimapWaitLogged = true;
                    console.log('[MINIMAP] Waiting — tileMap:', !!this.tileMap,
                        'layers:', !!(this.tileMap && this.tileMap.layers),
                        'layer0:', !!(this.tileMap && this.tileMap.layers && this.tileMap.layers[0]));
                }
            }
        }
        
        if (!this.gameUI) {
            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            
            this.renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.renderer.ctx.fillRect(10, 10, 320, 65);
            
            this.renderer.ctx.fillStyle = '#4ecca3';
            this.renderer.ctx.font = 'bold 12px Courier New';
            this.renderer.ctx.textAlign = 'left';
            this.renderer.ctx.textBaseline = 'top';
            var mode = this.npcMode ? 'NPC AUTO' : 'PLAYER';
            var pausedText = this.isPaused ? ' [PAUSED]' : '';
            this.renderer.ctx.fillText('RealmKit v1.1 | ' + mode + pausedText, 15, 15);
            
            this.renderer.ctx.fillStyle = '#aaa';
            this.renderer.ctx.font = '10px Courier New';
            var refresh = this.autoRefresh ? 'ON' : 'OFF';
            this.renderer.ctx.fillText('M:NPC | Y:refresh (' + refresh + ') | SPACE:pause | J:attack', 15, 30);
            this.renderer.ctx.fillText('T:tiles S:sprite G:grid C:coords E:interact | R:recruit F:formation', 15, 44);

            // Status badge indicators at top-right
            var badgeX = this.renderer.canvas.width - 10;
            var badgeY = 14;
            this.renderer.ctx.textAlign = 'right';
            
            // Auto-refresh badge
            this.renderer.ctx.fillStyle = this.autoRefresh ? '#1a5a3a' : '#5a2020';
            this.renderer.ctx.fillRect(badgeX - 70, badgeY - 4, 68, 16);
            this.renderer.ctx.fillStyle = this.autoRefresh ? '#4ecca3' : '#ff6b6b';
            this.renderer.ctx.fillText('AUTO-RFRSH', badgeX - 2, badgeY + 8);
            badgeY += 20;
            
            // Control mode badge
            this.renderer.ctx.fillStyle = this.npcMode ? '#1a3a5a' : '#3a2a1a';
            this.renderer.ctx.fillRect(badgeX - 70, badgeY - 4, 68, 16);
            this.renderer.ctx.fillStyle = this.npcMode ? '#4ecdc4' : '#ffd93d';
            this.renderer.ctx.fillText(this.npcMode ? 'AUTO NPC' : 'PLAYER', badgeX - 2, badgeY + 8);

            // Party indicator
            if (this.partyManager) {
                var partyCount = this.partyManager.members.length;
                var partyMax = this.partyManager.maxMembers;
                this.renderer.ctx.fillStyle = '#40c080';
                this.renderer.ctx.fillText('Party: ' + partyCount + '/' + partyMax + ' [' + this.partyManager.formation + ']', 15, 58);
            }
            
            this._renderDayNightIndicator();
            
            this.renderer.ctx.restore();
            
            if (this.dialogVisible && this.dialogText) {
                this.renderDialog();
            }
            
            this.renderInventoryBar();
            
            if (this.isPaused) {
                this.renderPauseOverlay();
            }
        }

        if (!this.storyUIConfig || !this.storyUIConfig.panels || this.storyUIConfig.panels.minimap !== false) {
            this.renderMinimap();
        }

        if (this.gameUI) {
            this.gameUI.update();
        }
    }
    
    _renderDayNightIndicator() {
        var canvasW = this.renderer.displayWidth || 800;
        
        var dn = this.dayNight;
        var h = Math.floor(dn.time / 3600) % 24;
        var m = Math.floor((dn.time % 3600) / 60);
        var timeStr = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        
        var phase, phaseIcon, phaseColor;
        var isNight = false;
        if (h < 5 || h >= 22) { phase = 'Night'; phaseIcon = '🌙'; phaseColor = '#6688cc'; isNight = true; }
        else if (h < 7) { phase = 'Pre-dawn'; phaseIcon = '🌅'; phaseColor = '#cc8866'; }
        else if (h < 9) { phase = 'Dawn'; phaseIcon = '🌄'; phaseColor = '#ffaa66'; }
        else if (h < 11) { phase = 'Morning'; phaseIcon = '☀'; phaseColor = '#ffcc44'; }
        else if (h < 13) { phase = 'Noon'; phaseIcon = '☀'; phaseColor = '#ffee88'; }
        else if (h < 17) { phase = 'Afternoon'; phaseIcon = '⛅'; phaseColor = '#ffddaa'; }
        else if (h < 19) { phase = 'Dusk'; phaseIcon = '🌇'; phaseColor = '#ff8844'; }
        else { phase = 'Evening'; phaseIcon = '🌆'; phaseColor = '#aa6688'; isNight = true; }
        
        var boxW = 90;
        var boxH = 40;
        var boxX = canvasW - boxW - 10;
        var boxY = 10;
        
        this.renderer.ctx.fillStyle = isNight ? 'rgba(20, 25, 50, 0.75)' : 'rgba(40, 30, 20, 0.65)';
        this.renderer.ctx.fillRect(boxX, boxY, boxW, boxH);
        
        this.renderer.ctx.strokeStyle = isNight ? '#6688cc' : '#ddaa66';
        this.renderer.ctx.lineWidth = 1;
        this.renderer.ctx.strokeRect(boxX, boxY, boxW, boxH);
        
        this.renderer.ctx.fillStyle = isNight ? '#aabbff' : '#ffdd99';
        this.renderer.ctx.font = '16px Arial';
        this.renderer.ctx.textAlign = 'center';
        this.renderer.ctx.fillText(phaseIcon, boxX + boxW / 2, boxY + 15);
        
        this.renderer.ctx.fillStyle = phaseColor;
        this.renderer.ctx.font = '10px Courier New';
        this.renderer.ctx.fillText(timeStr, boxX + boxW / 2, boxY + 28);
        
        this.renderer.ctx.textAlign = 'left';
    }
    
    renderInventoryBar() {
        if (!this.inventoryManager || !this.player) return;
        
        var canvasW = this.renderer.displayWidth || 800;
        var canvasH = this.renderer.displayHeight || 600;
        
        var slotCount = Math.min(9, this.inventoryManager.maxSlots);
        var slotSize = 36;
        var slotSpacing = 4;
        var totalWidth = slotCount * slotSize + (slotCount - 1) * slotSpacing;
        var startX = (canvasW - totalWidth) / 2;
        var startY = canvasH - slotSize - 40;
        
        this.renderer.ctx.save();
        this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        for (var i = 0; i < slotCount; i++) {
            var x = startX + i * (slotSize + slotSpacing);
            var y = startY;
            
            this.renderer.ctx.fillStyle = 'rgba(30, 30, 40, 0.85)';
            this.renderer.ctx.fillRect(x, y, slotSize, slotSize);
            
            this.renderer.ctx.strokeStyle = '#555';
            this.renderer.ctx.lineWidth = 1;
            this.renderer.ctx.strokeRect(x, y, slotSize, slotSize);
            
            this.renderer.ctx.fillStyle = '#444';
            this.renderer.ctx.font = 'bold 9px Courier New';
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.textBaseline = 'top';
            this.renderer.ctx.fillText((i + 1).toString(), x + slotSize / 2, y + 2);
            
            var item = this.inventoryManager.getItem(i);
            if (item) {
                if (item.color) {
                    this.renderer.ctx.fillStyle = item.color;
                    this.renderer.ctx.fillRect(x + 4, y + 12, slotSize - 8, slotSize - 16);
                }
                
                this.renderer.ctx.fillStyle = '#fff';
                this.renderer.ctx.font = 'bold 8px Courier New';
                this.renderer.ctx.textAlign = 'center';
                this.renderer.ctx.textBaseline = 'middle';
                
                var icon = item.icon || item.name ? item.name.substr(0, 3).toUpperCase() : '?';
                this.renderer.ctx.fillText(icon, x + slotSize / 2, y + slotSize / 2);
                
                if (item.quantity && item.quantity > 1) {
                    this.renderer.ctx.fillStyle = '#ffd700';
                    this.renderer.ctx.font = '9px Courier New';
                    this.renderer.ctx.textAlign = 'right';
                    this.renderer.ctx.textBaseline = 'bottom';
                    this.renderer.ctx.fillText(item.quantity.toString(), x + slotSize - 3, y + slotSize - 2);
                }
            }
        }
        
        if (this.inventoryManager.gold > 0) {
            var goldX = startX + totalWidth + 20;
            this.renderer.ctx.fillStyle = 'rgba(30, 30, 40, 0.85)';
            this.renderer.ctx.fillRect(goldX, startY, 70, slotSize);
            
            this.renderer.ctx.strokeStyle = '#555';
            this.renderer.ctx.strokeRect(goldX, startY, 70, slotSize);
            
            this.renderer.ctx.fillStyle = '#ffd700';
            this.renderer.ctx.font = '12px Courier New';
            this.renderer.ctx.textAlign = 'left';
            this.renderer.ctx.textBaseline = 'middle';
            this.renderer.ctx.fillText('$' + this.inventoryManager.gold, goldX + 10, startY + slotSize / 2);
        }
        
        this.renderer.ctx.restore();
    }
    
    renderPauseOverlay() {
        var canvasW = this.renderer.displayWidth || 800;
        var canvasH = this.renderer.displayHeight || 600;
        
        this.renderer.ctx.save();
        this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        this.renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.renderer.ctx.fillRect(0, 0, canvasW, canvasH);
        
        this.renderer.ctx.fillStyle = '#4ecca3';
        this.renderer.ctx.font = 'bold 32px Courier New';
        this.renderer.ctx.textAlign = 'center';
        this.renderer.ctx.textBaseline = 'middle';
        this.renderer.ctx.fillText('PAUSED', canvasW / 2, canvasH / 2 - 40);
        
        this.renderer.ctx.fillStyle = '#aaa';
        this.renderer.ctx.font = '14px Courier New';
        this.renderer.ctx.fillText('Press SPACE to resume', canvasW / 2, canvasH / 2 + 10);
        this.renderer.ctx.fillText('Press J to attack (when resumed)', canvasW / 2, canvasH / 2 + 30);
        
        if (this.actionQueue.length > 0) {
            this.renderer.ctx.fillStyle = '#4ecca3';
            this.renderer.ctx.font = '12px Courier New';
            this.renderer.ctx.fillText('Queued Actions:', canvasW / 2, canvasH / 2 + 70);
            
            var startY = canvasH / 2 + 90;
            for (var i = 0; i < Math.min(this.actionQueue.length, 5); i++) {
                var action = this.actionQueue[i];
                this.renderer.ctx.fillStyle = '#fff';
                this.renderer.ctx.fillText((i + 1) + '. ' + action.type, canvasW / 2, startY + i * 18);
            }
        }
        
        this.renderer.ctx.restore();
    }
    
    renderMinimap() {
        if (!this.minimapCanvas) {
            return;
        }

        var minimapWidth = this.minimapCanvas.width;
        var minimapHeight = this.minimapCanvas.height;
        var margin = 16;
        var framePad = 6;
        var plaqueHeight = 18;
        var captionHeight = 14;
        var cornerSize = 24;
        var cornerOffset = 12;
        var outerWidth = minimapWidth + framePad * 2;
        var outerHeight = minimapHeight + framePad * 2 + plaqueHeight + captionHeight;

        var canvasW = this.renderer.displayWidth || 800;
        var canvasH = this.renderer.displayHeight || 600;

        var x = canvasW - outerWidth - margin - cornerOffset;
        var topMargin = 55;
        var y = topMargin;
        var mapX = x + framePad;
        var mapY = y + framePad + plaqueHeight;

        // Store bounds so handleCanvasClick() can detect minimap clicks
        this.minimapBounds = { x: mapX, y: mapY, width: minimapWidth, height: minimapHeight };

        if (!this.minimapLoggedOnce) {
            console.log('[MINIMAP] Render at', mapX, mapY, 'size', minimapWidth, 'x', minimapHeight, 'canvas', canvasW, 'x', canvasH);
            this.minimapLoggedOnce = true;
        }
        
        this.renderer.ctx.save();
        this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.renderer.ctx.globalAlpha = (this.minimapOpacity !== undefined)
            ? Math.max(0, Math.min(1, this.minimapOpacity)) : 1.0;

        this.renderer.ctx.fillStyle = '#1a0800';
        this.renderer.ctx.fillRect(x, y, outerWidth, outerHeight);

        this.renderer.ctx.fillStyle = '#2a1408';
        this.renderer.ctx.fillRect(x + 3, y + 3, outerWidth - 6, outerHeight - 6);

        this.renderer.ctx.fillStyle = '#4a2810';
        this.renderer.ctx.fillRect(x + 6, y + 6, outerWidth - 12, outerHeight - 12);

        var cornerX = [x - cornerOffset, x + outerWidth - cornerSize + cornerOffset];
        var cornerY = [y - cornerOffset, y + outerHeight - cornerSize + cornerOffset];
        var cx;
        var cy;
        var ix;
        var iy;
        for (ix = 0; ix < 2; ix++) {
            for (iy = 0; iy < 2; iy++) {
                cx = cornerX[ix];
                cy = cornerY[iy];
                this.renderer.ctx.fillStyle = '#3a1808';
                this.renderer.ctx.fillRect(cx, cy, cornerSize, cornerSize);
                this.renderer.ctx.fillStyle = '#5a3818';
                this.renderer.ctx.fillRect(cx + 2, cy + 2, cornerSize - 4, cornerSize - 4);
                this.renderer.ctx.fillStyle = '#4a2808';
                this.renderer.ctx.fillRect(cx + 4, cy + 4, cornerSize - 8, cornerSize - 8);
                this.renderer.ctx.fillStyle = '#2a1000';
                this.renderer.ctx.fillRect(cx + 6, cy + 6, cornerSize - 12, cornerSize - 12);
            }
        }

        this.renderer.ctx.fillStyle = '#2a1408';
        this.renderer.ctx.fillRect(x + framePad, y + framePad, minimapWidth, plaqueHeight);

        var titleWidth = 96;
        var titleHeight = 16;
        var titleX = x + (outerWidth - titleWidth) / 2;
        var titleY = y - 8;
        this.renderer.ctx.fillStyle = '#2d1a08';
        this.renderer.ctx.fillRect(titleX - 2, titleY - 2, titleWidth + 4, titleHeight + 4);
        this.renderer.ctx.fillStyle = '#89662a';
        this.renderer.ctx.fillRect(titleX, titleY, titleWidth, titleHeight);
        this.renderer.ctx.fillStyle = '#6e4e1f';
        this.renderer.ctx.fillRect(titleX, titleY + 2, titleWidth, titleHeight - 2);
        this.renderer.ctx.fillStyle = '#6a4020';
        this.renderer.ctx.fillRect(titleX - 76, titleY + titleHeight / 2 - 1, 60, 3);
        this.renderer.ctx.fillRect(titleX + titleWidth + 16, titleY + titleHeight / 2 - 1, 60, 3);

        this.renderer.ctx.fillStyle = '#e6d6b4';
        this.renderer.ctx.fillRect(mapX - 2, mapY - 2, minimapWidth + 4, minimapHeight + 4);
        this.renderer.ctx.fillStyle = '#dcc79a';
        this.renderer.ctx.fillRect(mapX, mapY, minimapWidth, minimapHeight);

        var baseAlpha = this.renderer.ctx.globalAlpha;
        this.renderer.ctx.globalAlpha = baseAlpha * 0.78;
        this.renderer.ctx.drawImage(this.minimapCanvas, mapX, mapY);
        this.renderer.ctx.globalAlpha = baseAlpha;

        this.renderer.ctx.fillStyle = 'rgba(238, 224, 188, 0.18)';
        this.renderer.ctx.fillRect(mapX, mapY, minimapWidth, minimapHeight);

        this.renderer.ctx.strokeStyle = 'rgba(122, 96, 64, 0.55)';
        this.renderer.ctx.lineWidth = 1;
        this.renderer.ctx.strokeRect(mapX + 2, mapY + 2, minimapWidth - 4, minimapHeight - 4);

        this.renderer.ctx.strokeStyle = '#7a6040';
        this.renderer.ctx.lineWidth = 2;
        this.renderer.ctx.strokeRect(mapX - 1, mapY - 1, minimapWidth + 2, minimapHeight + 2);

        this.renderer.ctx.fillStyle = '#f6e2ae';
        this.renderer.ctx.font = '7px "Press Start 2P", monospace';
        this.renderer.ctx.textAlign = 'center';
        this.renderer.ctx.textBaseline = 'middle';
        this.renderer.ctx.fillText('FIELD MAP', titleX + titleWidth / 2, titleY + titleHeight / 2 + 1);

        var dn = this.dayNight || { time: 0 };
        var hh = Math.floor(dn.time / 3600) % 24;
        var todColor = '#ffcc66';
        if (hh < 5 || hh >= 22) todColor = '#8fb0ff';
        else if (hh < 8) todColor = '#ffb070';
        else if (hh < 17) todColor = '#ffe08a';
        else if (hh < 20) todColor = '#ff9966';
        else todColor = '#c29cff';
        var markerX = titleX + titleWidth - 12;
        var markerY = titleY + titleHeight / 2;
        this.renderer.ctx.beginPath();
        this.renderer.ctx.fillStyle = 'rgba(22, 14, 8, 0.85)';
        this.renderer.ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
        this.renderer.ctx.fill();
        this.renderer.ctx.beginPath();
        this.renderer.ctx.fillStyle = todColor;
        this.renderer.ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        this.renderer.ctx.fill();
        
        if (this.player) {
            var playerX = (this.player.x / this.mapBounds.width) * minimapWidth;
            var playerY = (this.player.y / this.mapBounds.height) * minimapHeight;
            var pulse = 2 + ((Date.now() / 220) % 1) * 2;
            
            this.renderer.ctx.fillStyle = 'rgba(255, 240, 180, 0.35)';
            this.renderer.ctx.beginPath();
            this.renderer.ctx.arc(mapX + playerX, mapY + playerY, pulse + 2, 0, Math.PI * 2);
            this.renderer.ctx.fill();

            this.renderer.ctx.fillStyle = '#b84030';
            this.renderer.ctx.beginPath();
            this.renderer.ctx.arc(mapX + playerX, mapY + playerY, 3, 0, Math.PI * 2);
            this.renderer.ctx.fill();
            
            this.renderer.ctx.strokeStyle = '#fff2d0';
            this.renderer.ctx.lineWidth = 1;
            this.renderer.ctx.stroke();
        }
        
        var vw = (this.renderer.viewport.viewWidth / this.mapBounds.width) * minimapWidth;
        var vh = (this.renderer.viewport.viewHeight / this.mapBounds.height) * minimapHeight;
        var vx = (this.renderer.viewport.x / this.mapBounds.width) * minimapWidth;
        var vy = (this.renderer.viewport.y / this.mapBounds.height) * minimapHeight;
        
        this.renderer.ctx.fillStyle = 'rgba(255, 244, 210, 0.08)';
        this.renderer.ctx.fillRect(mapX + vx, mapY + vy, vw, vh);
        this.renderer.ctx.strokeStyle = 'rgba(255, 240, 200, 0.8)';
        this.renderer.ctx.lineWidth = 1;
        this.renderer.ctx.strokeRect(mapX + vx, mapY + vy, vw, vh);

        // Teleport crosshair: flash where the player will land after a click
        if (this.minimapTeleportFlash && this.minimapTeleportFlash.until > Date.now()) {
            var f = this.minimapTeleportFlash;
            this.renderer.ctx.strokeStyle = '#ffe7a0';
            this.renderer.ctx.lineWidth = 1.5;
            var hs = 5;
            this.renderer.ctx.beginPath();
            this.renderer.ctx.moveTo(mapX + f.mmX - hs, mapY + f.mmY);
            this.renderer.ctx.lineTo(mapX + f.mmX + hs, mapY + f.mmY);
            this.renderer.ctx.moveTo(mapX + f.mmX, mapY + f.mmY - hs);
            this.renderer.ctx.lineTo(mapX + f.mmX, mapY + f.mmY + hs);
            this.renderer.ctx.stroke();
        } else if (this.minimapTeleportFlash && this.minimapTeleportFlash.until <= Date.now()) {
            this.minimapTeleportFlash = null;
        }

        this.renderer.ctx.fillStyle = '#d8c89c';
        this.renderer.ctx.fillRect(x + framePad, y + outerHeight - captionHeight - 4, minimapWidth, captionHeight);
        this.renderer.ctx.strokeStyle = '#8a7060';
        this.renderer.ctx.lineWidth = 1;
        this.renderer.ctx.strokeRect(x + framePad, y + outerHeight - captionHeight - 4, minimapWidth, captionHeight);

        this.renderer.ctx.font = '6px "Press Start 2P", monospace';
        this.renderer.ctx.textAlign = 'left';
        this.renderer.ctx.textBaseline = 'middle';
        if (this.tileMap) {
            this.renderer.ctx.fillStyle = '#4a3020';
            this.renderer.ctx.fillText(
                this.tileMap.width + '\u00d7' + this.tileMap.height,
                x + framePad + 5, y + outerHeight - captionHeight / 2 - 4
            );
        }
        
        this.renderer.ctx.fillStyle = '#6a5040';
        this.renderer.ctx.textAlign = 'right';
        this.renderer.ctx.fillText('CLICK TO MOVE', x + framePad + minimapWidth - 5, y + outerHeight - captionHeight / 2 - 4);

        this.renderer.ctx.restore();
    }

    handleCanvasClick(e) {
        if (!this.minimapBounds || !this.minimapCanvas) return;
        if (!this.player || !this.tileMap) return;

        // Convert mouse event to canvas-space coords (account for CSS scaling)
        var canvas = this.renderer.canvas;
        var rect = canvas.getBoundingClientRect();
        var scaleX = (this.renderer.displayWidth || canvas.width) / rect.width;
        var scaleY = (this.renderer.displayHeight || canvas.height) / rect.height;
        var cx = (e.clientX - rect.left) * scaleX;
        var cy = (e.clientY - rect.top) * scaleY;

        var mb = this.minimapBounds;
        if (cx < mb.x || cx > mb.x + mb.width || cy < mb.y || cy > mb.y + mb.height) return;

        // Map minimap pixel → world pixel
        var relX = (cx - mb.x) / mb.width;
        var relY = (cy - mb.y) / mb.height;
        var worldX = relX * this.mapBounds.width;
        var worldY = relY * this.mapBounds.height;

        // Find the nearest collision-free tile around that world point
        var tw = this.tileMap.tileWidth  || 32;
        var th = this.tileMap.tileHeight || 32;
        var tileX = Math.floor(worldX / tw);
        var tileY = Math.floor(worldY / th);
        var collisionData = this.tileMap.collisionData;
        var mapW = this.tileMap.width;
        var mapH = this.tileMap.height;

        var safe = this.findSafeSpawnPoint(tileX, tileY, collisionData, mapW, mapH, tw, th);

        this.player.x = safe.x;
        this.player.y = safe.y;
        this.player.velocityX = 0;
        this.player.velocityY = 0;

        // Snap camera immediately so the world doesn't scroll weirdly
        if (this.camera) {
            this.camera.x = safe.x;
            this.camera.y = safe.y;
        }

        // Store flash position in minimap-space for visual feedback
        this.minimapTeleportFlash = {
            mmX: Math.floor(relX * mb.width),
            mmY: Math.floor(relY * mb.height),
            until: Date.now() + 600
        };

        console.log('[MINIMAP] Teleport to', Math.floor(safe.x), Math.floor(safe.y));
    }

    renderDialog() {
        var boxWidth = 300;
        var boxHeight = 80;
        var boxX = (this.renderer.viewport.viewWidth - boxWidth) / 2;
        var boxY = this.renderer.viewport.viewHeight - boxHeight - 20;
        
        this.renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.renderer.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        
        this.renderer.ctx.strokeStyle = '#4ecca3';
        this.renderer.ctx.lineWidth = 2;
        this.renderer.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        
        this.renderer.ctx.fillStyle = '#4ecca3';
        this.renderer.ctx.font = 'bold 14px Courier New';
        this.renderer.ctx.textAlign = 'left';
        this.renderer.ctx.textBaseline = 'top';
        this.renderer.ctx.fillText(this.dialogName + ':', boxX + 15, boxY + 12);
        
        this.renderer.ctx.fillStyle = '#fff';
        this.renderer.ctx.font = '12px Courier New';
        this.renderer.ctx.fillText(this.dialogText, boxX + 15, boxY + 35);
        
        this.renderer.ctx.fillStyle = '#888';
        this.renderer.ctx.font = '10px Courier New';
        this.renderer.ctx.fillText('Press E to close', boxX + 15, boxY + 58);
    }
    
    logCollision(c) {
        var entry = {
            timestamp: new Date().toISOString().substr(11, 12),
            type: 'collision',
            tileX: c.tileX,
            tileY: c.tileY,
            x: Math.floor(this.player.x),
            y: Math.floor(this.player.y),
            dir: this.player.direction
        };
        
        var data = 'sid=' + this.sessionId + 
                   '&ts=' + encodeURIComponent(entry.timestamp) +
                   '&type=' + entry.type +
                   '&tileX=' + entry.tileX +
                   '&tileY=' + entry.tileY +
                   '&x=' + entry.x +
                   '&y=' + entry.y +
                   '&dir=' + entry.dir;
        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.logUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(data);
    }
    
    logEntityCollision(c) {
        var entry = {
            timestamp: new Date().toISOString().substr(11, 12),
            type: 'entity_collision',
            entityA: c.entityA,
            entityB: c.entityB,
            typeA: c.typeA,
            typeB: c.typeB,
            overlapX: c.overlapX,
            overlapY: c.overlapY
        };
        
        var data = 'sid=' + this.sessionId + 
                   '&ts=' + encodeURIComponent(entry.timestamp) +
                   '&type=' + entry.type +
                   '&entityA=' + encodeURIComponent(entry.entityA) +
                   '&entityB=' + encodeURIComponent(entry.entityB) +
                   '&overlapX=' + entry.overlapX +
                   '&overlapY=' + entry.overlapY;
        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.logUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(data);
    }
    
    updateDebugInfo() {
        this.debugUpdateCounter++;
        if (this.debugUpdateCounter < 5) return;
        this.debugUpdateCounter = 0;
        
        var infoElement = document.getElementById('info-bar');
        if (!infoElement) return;
        
        var gap = this.frameGapMs.toFixed(0);
        var tot = this.totalRenderMs.toFixed(1);
        var fps = this.gameLoop.getFPS();
        var pos = this.player ? Math.floor(this.player.x) + ',' + Math.floor(this.player.y) : '-';
        var mode = this.npcMode ? 'NPC' : 'PLYR';
        var refresh = this.autoRefresh ? 'R:ON' : 'R:OFF';
        var anim = this.player ? (this.player.animation || '-') : '-';

        infoElement.textContent = refresh + ' | ' + mode + ' | Pos:' + pos + ' | Anim:' + anim + ' | Gap:' + gap + 'ms | Tot:' + tot + 'ms | FPS:' + fps;
    }
    
    startFPSCounter() {
        var fpsElement = document.getElementById('fps-counter');
        
        if (!fpsElement) {
            console.log('[Engine] FPS counter element not found — skipping FPS display');
        } else {
            this.fpsElement = fpsElement;
        }
    }
    
    startAutoRefresh() {
        if (this.refreshTimer) {
            console.log('[Engine] Auto-refresh already running');
            return;
        }
        
        if (!this.autoRefresh) {
            console.log('[Engine] Auto-refresh disabled by mode');
            return;
        }
        
        this.lastRefreshTime = Date.now();
        
        var self = this;
        this.refreshTimer = setInterval(function() {
            if (!self.autoRefresh) return;
            
            var now = Date.now();
            var elapsed = (now - self.lastRefreshTime) / 1000;
            
            if (elapsed >= self.refreshInterval) {
                console.log('[Engine] Auto-refresh triggered after ' + elapsed.toFixed(1) + 's');
                location.reload();
            }
        }, 1000);
        
        console.log('[Engine] Auto-refresh started: ' + this.refreshInterval + 's interval');
    }
    
    // ─── Screen shake ─────────────────────────────────────────────────────────
    triggerShake(intensity, duration) {
        // Only escalate, never dampen an existing stronger shake mid-flight
        if (intensity > this.shake.intensity || this.shake.remaining <= 0) {
            this.shake.intensity  = intensity;
            this.shake.duration   = duration;
            this.shake.remaining  = duration;
        }
    }

    _updateShake(deltaTime) {
        if (this.shake.remaining <= 0) {
            this.shake.x = 0;
            this.shake.y = 0;
            return;
        }
        this.shake.remaining = Math.max(0, this.shake.remaining - deltaTime);
        var t = this.shake.remaining / this.shake.duration;  // 1→0 as it decays
        var mag = this.shake.intensity * t;
        this.shake.x = (Math.random() * 2 - 1) * mag;
        this.shake.y = (Math.random() * 2 - 1) * mag;
    }

    // ─── Light sources ────────────────────────────────────────────────────────
    registerLight(id, x, y, radius, color, intensity) {
        // Replace existing light with same id
        for (var i = 0; i < this.lightSources.length; i++) {
            if (this.lightSources[i].id === id) {
                this.lightSources[i].x = x;
                this.lightSources[i].y = y;
                this.lightSources[i].radius = radius;
                this.lightSources[i].color  = color || '#ffffff';
                this.lightSources[i].intensity = intensity !== undefined ? intensity : 1;
                return;
            }
        }
        this.lightSources.push({ id: id, x: x, y: y, radius: radius,
                                  color: color || '#ffffff', intensity: intensity !== undefined ? intensity : 1 });
    }

    // ─── Day/night lighting layer ─────────────────────────────────────────────

    // Multi-stop sky tint color stops.  t is 0-1 where 0/1 = midnight, 0.5 = noon.
    // Returns { r, g, b } interpolated between the nearest two stops.
    _skyTintAt(t) {
        var stops = [
            { t: 0.00, r:  0, g:  5, b: 25 },   // midnight — deep indigo
            { t: 0.18, r:  3, g:  4, b: 18 },   // pre-dawn
            { t: 0.23, r: 30, g: 12, b:  5 },   // first light — warm amber starts
            { t: 0.27, r: 70, g: 28, b:  4 },   // dawn peak — rich orange
            { t: 0.33, r: 20, g: 10, b: 12 },   // post-dawn fade
            { t: 0.42, r:  2, g:  4, b:  8 },   // morning — nearly clear
            { t: 0.50, r:  0, g:  0, b:  0 },   // noon — no tint at all
            { t: 0.58, r:  2, g:  4, b:  8 },   // afternoon
            { t: 0.67, r: 20, g: 10, b: 12 },   // pre-dusk fade
            { t: 0.73, r: 70, g: 28, b:  4 },   // dusk peak — mirror of dawn
            { t: 0.77, r: 30, g: 12, b:  5 },   // dusk trailing edge
            { t: 0.82, r:  3, g:  4, b: 18 },   // evening
            { t: 1.00, r:  0, g:  5, b: 25 }    // midnight again
        ];

        // Clamp t
        t = Math.max(0, Math.min(1, t));

        // Find bracket
        for (var i = 0; i < stops.length - 1; i++) {
            var a = stops[i], b = stops[i + 1];
            if (t >= a.t && t <= b.t) {
                var frac = (b.t === a.t) ? 0 : (t - a.t) / (b.t - a.t);
                return {
                    r: Math.round(a.r + (b.r - a.r) * frac),
                    g: Math.round(a.g + (b.g - a.g) * frac),
                    b: Math.round(a.b + (b.b - a.b) * frac)
                };
            }
        }
        return { r: 0, g: 0, b: 0 };
    }

    // Parse a CSS hex color '#rrggbb' → { r, g, b }
    _hexToRgb(hex) {
        var c = hex.replace('#', '');
        if (c.length === 3) {
            c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
        }
        return {
            r: parseInt(c.substring(0, 2), 16),
            g: parseInt(c.substring(2, 4), 16),
            b: parseInt(c.substring(4, 6), 16)
        };
    }

    renderLightingLayer() {
        if (!this.renderer) return;

        var canvasW = this.renderer.canvas.width;
        var canvasH = this.renderer.canvas.height;

        // Lazy-create (or resize) the offscreen darkness canvas
        if (!this.lightingCanvas ||
            this.lightingCanvas.width  !== canvasW ||
            this.lightingCanvas.height !== canvasH) {
            this.lightingCanvas = document.createElement('canvas');
            this.lightingCanvas.width  = canvasW;
            this.lightingCanvas.height = canvasH;
            this.lightingCtx = this.lightingCanvas.getContext('2d');
        }

        var lctx = this.lightingCtx;

        // ── Ambient darkness from time of day ──
        // noon (t=0.5) → alpha 0;  midnight (t=0 or 1) → alpha 0.82
        var t = this.dayNight.time / this.dayNight.cycleSeconds;   // 0-1
        var cosT = Math.cos(t * Math.PI * 2);           // 1 at midnight, -1 at noon
        var ambientAlpha = 0.41 + cosT * 0.41;          // 0.0 → 0.82
        ambientAlpha = Math.max(0, ambientAlpha);
        // Dev slider: ambientLightOverride 0=natural, 1=fully lit (no darkness)
        ambientAlpha = ambientAlpha * (1.0 - (this.ambientLightOverride || 0));

        // ── Smooth sky tint (multi-stop, no abrupt jumps) ──
        var tint = this._skyTintAt(t);
        var tintColor;
        if (ambientAlpha < 0.02) {
            tintColor = 'rgba(0,0,0,0)';
        } else {
            tintColor = 'rgba(' + tint.r + ',' + tint.g + ',' + tint.b + ',' +
                        ambientAlpha.toFixed(3) + ')';
        }

        lctx.clearRect(0, 0, canvasW, canvasH);
        lctx.fillStyle = tintColor;
        lctx.fillRect(0, 0, canvasW, canvasH);

        // ── Punch light holes using destination-out ──
        lctx.globalCompositeOperation = 'destination-out';

        var vp    = this.renderer.viewport;
        var scale = vp.currentScale || 1;

        for (var i = 0; i < this.lightSources.length; i++) {
            var light = this.lightSources[i];
            var sx    = (light.x - vp.x) * scale;
            var sy    = (light.y - vp.y) * scale;
            var sr    = light.radius * scale;
            var intens = light.intensity !== undefined ? light.intensity : 1;

            var grad = lctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
            grad.addColorStop(0,   'rgba(0,0,0,' + (intens).toFixed(2) + ')');
            grad.addColorStop(0.4, 'rgba(0,0,0,' + (intens * 0.8).toFixed(2) + ')');
            grad.addColorStop(0.8, 'rgba(0,0,0,' + (intens * 0.25).toFixed(2) + ')');
            grad.addColorStop(1,   'rgba(0,0,0,0)');

            lctx.fillStyle = grad;
            lctx.beginPath();
            lctx.arc(sx, sy, sr, 0, Math.PI * 2);
            lctx.fill();
        }

        lctx.globalCompositeOperation = 'source-over';

        // ── Blit darkness layer onto main canvas ──
        var mctx = this.renderer.ctx;
        mctx.save();
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.drawImage(this.lightingCanvas, 0, 0);

        // ── Colored light glow pass (additive / 'lighter') ──
        // Only visible when it's actually dark — no point glowing at noon.
        if (ambientAlpha > 0.04 && this.lightSources.length > 0) {
            mctx.globalCompositeOperation = 'lighter';

            for (var j = 0; j < this.lightSources.length; j++) {
                var ls  = this.lightSources[j];
                var lx  = (ls.x - vp.x) * scale;
                var ly  = (ls.y - vp.y) * scale;
                // Glow radius is slightly smaller than the darkness hole so the
                // warm color pools in the centre rather than bleeding to the edge.
                var lr  = ls.radius * scale * 0.65;
                var li  = (ls.intensity !== undefined ? ls.intensity : 1);
                // Scale glow by darkness — barely visible at dusk, strong at midnight
                var glowStrength = li * Math.min(1, ambientAlpha * 1.8);
                if (glowStrength < 0.01) continue;

                // Parse the light color
                var rgb = (ls.color && ls.color[0] === '#')
                    ? this._hexToRgb(ls.color)
                    : { r: 255, g: 255, b: 255 };

                var lg = mctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
                lg.addColorStop(0,   'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' +
                                     Math.min(1, glowStrength * 0.35).toFixed(3) + ')');
                lg.addColorStop(0.45,'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' +
                                     Math.min(1, glowStrength * 0.12).toFixed(3) + ')');
                lg.addColorStop(1,   'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');

                mctx.fillStyle = lg;
                mctx.beginPath();
                mctx.arc(lx, ly, lr, 0, Math.PI * 2);
                mctx.fill();
            }

            mctx.globalCompositeOperation = 'source-over';
        }

        mctx.restore();
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('[Engine] Auto-refresh interval stopped');
        }
    }
    
    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        
        if (this.autoRefresh) {
            this.lastRefreshTime = Date.now();
        }
        
        console.log('[Engine] Auto-refresh:', this.autoRefresh ? 'ON' : 'OFF');
    }
    
    tryInteract() {
        if (this.isPaused) {
            console.log('[Engine] Cannot interact while paused');
            return;
        }
        
        if (!this.player) return;
        
        // Check for auto-pickup loot drops (keep this for backwards compatibility with existing drops)
        if (this.config.loot && this.config.loot.autoPickup) {
            var nearbyLoot = null;
            var minLootDist = Infinity;
            
            for (var i = 0; i < this.lootDrops.length; i++) {
                var loot = this.lootDrops[i];
                if (!loot.active) continue;
                
                if (loot.canInteract(this.player)) {
                    var dx = this.player.x - loot.x;
                    var dy = this.player.y - loot.y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < minLootDist) {
                        nearbyLoot = loot;
                        minLootDist = dist;
                    }
                }
            }
            
            if (nearbyLoot) {
                this.collectLoot(nearbyLoot);
                return;
            }
        }
        
        // Check for dead bodies to loot (E-key interaction)
        var entities = this.entityManager.entities;
        var nearestBody = null;
        var nearestBodyDist = Infinity;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (!entity.active) continue;
            if (entity === this.player) continue;
            if (!entity.combatStats || entity.combatStats.hp > 0) continue;
            if (!entity.canLootBody) continue; // Entity must have canLootBody method
            
            if (entity.canLootBody(this.player)) {
                var dx = this.player.x - entity.x;
                var dy = this.player.y - entity.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < nearestBodyDist) {
                    nearestBody = entity;
                    nearestBodyDist = dist;
                }
            }
        }
        
        if (nearestBody) {
            this.lootDeadBody(nearestBody);
            return;
        }
        
        // NPC interaction
        var interactable = null;
        var minDist = Infinity;
        
        var npcs = this.entityManager.getByType('npc');
        for (var i = 0; i < npcs.length; i++) {
            var entity = npcs[i];
            if (!entity.interactable) continue;
            if (entity.combatStats && entity.combatStats.hp <= 0) continue; // Skip dead NPCs
            
            var dx = this.player.x - entity.x;
            var dy = this.player.y - entity.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < entity.interactionRadius && dist < minDist) {
                interactable = entity;
                minDist = dist;
            }
        }
        
        if (interactable) {
            // Try dialogue system first
            if (this.dialogueSystem && interactable.dialogueId) {
                if (this.dialogueSystem.start(interactable.dialogueId, { player: this.player, npc: interactable, engine: this })) {
                    console.log('[DIALOGUE] Started:', interactable.dialogueId);
                    return;
                }
            }
            
            var result = interactable.interact(this.player);
            if (result && result.dialog) {
                console.log('[INTERACT]', interactable.name, ':', result.dialog);
                this.showDialog(interactable.name, result.dialog);
            }
            
            // Check if NPC can be recruited (friendly, not in party)
            if (this.partyManager && interactable.type === 'npc') {
                var relation = 'neutral';
                if (RealmKit.FactionRelations && RealmKit.FactionRelations.player) {
                    relation = RealmKit.FactionRelations.player[interactable.faction || 'neutral'] || 'neutral';
                }
                var canRecruit = !!interactable.recruitable && (relation === 'friend' || relation === 'ally' || interactable.faction === 'friendly');
                var inParty = this.partyManager.members.indexOf(interactable) !== -1;
                
                if (canRecruit && !inParty && this.partyManager.members.length < this.partyManager.maxMembers) {
                    console.log('[PARTY] Press R to recruit', interactable.name);
                }
            }
        }
    }
    
    recruitNearestNPC() {
        var recruiter = (this.inputController && this.inputController.getControlledUnit && this.inputController.getControlledUnit()) || this.player;
        if (!this.partyManager || !recruiter) return;
        
        var npcs = this.entityManager.getByType('npc');
        var nearestRecruitable = null;
        var minDist = 120;
        
        for (var i = 0; i < npcs.length; i++) {
            var npc = npcs[i];
            if (!npc.interactable) continue;
            if (npc.behavior === 'hostile' || npc.behavior === 'caster') continue;
            if (npc.behavior === 'partyMember') continue;
            if (this.partyManager.members.indexOf(npc) !== -1) continue;
            
            var dx = recruiter.x - npc.x;
            var dy = recruiter.y - npc.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            var relation = 'neutral';
            if (RealmKit.FactionRelations && RealmKit.FactionRelations.player) {
                relation = RealmKit.FactionRelations.player[npc.faction || 'neutral'] || 'neutral';
            }
            
            var canRecruit = !!npc.recruitable && (relation === 'friend' || relation === 'ally' || npc.faction === 'friendly');
            
            if (canRecruit && dist < minDist) {
                nearestRecruitable = npc;
                minDist = dist;
            }
        }
        
        if (nearestRecruitable) {
            var success = this.partyManager.recruit(nearestRecruitable, recruiter);
            if (success) {
                this.showDialog('Party', nearestRecruitable.name + ' has joined your party!');
                if (this.gameUI && this.gameUI.sync) {
                    this.gameUI.lastSignature = '';
                    this.gameUI.lastPartySignature = '';
                    this.gameUI.sync(true);
                }
            }
        } else if (this.partyManager.members.length >= this.partyManager.maxMembers) {
            this.showDialog('Party', 'Your party is full.');
        } else {
            console.log('[PARTY] No recruitable NPCs nearby');
        }
    }
    
    playerAttack() {
        // Use InputController if available, otherwise fallback to controlled unit
        var attacker = (this.inputController && this.inputController.getControlledUnit()) || this.player;
        if (!attacker || !this.combatSystem) return;
        
        // Check attack cooldown
        if (attacker.attackCooldown > 0) return;
        
        var weapon = attacker.weapon;
        var isRanged = weapon && weapon.isRanged && weapon.isRanged();
        var attackRange = isRanged ? (weapon.range || 300) : 60;
        var minDist = Infinity;
        var target = null;
        
        var entities = this.entityManager.entities;
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity === attacker) continue;
            if (!entity.active) continue;
            if (!entity.combatStats || entity.combatStats.hp <= 0) continue;
            
            var relation = attacker.faction || 'player';
            var otherFaction = entity.faction || 'neutral';
            if (!RealmKit.FactionRelations || !RealmKit.FactionRelations[relation]) continue;
            var relationType = RealmKit.FactionRelations[relation][otherFaction] || 'neutral';
            if (relationType !== 'foe') continue;
            
            var dx = entity.x - attacker.x;
            var dy = entity.y - attacker.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < attackRange && dist < minDist) {
                target = entity;
                minDist = dist;
            }
        }
        
        if (target) {
            var result;
            
            if (isRanged) {
                var projConfig = weapon.getProjectileConfig ? weapon.getProjectileConfig() : null;
                result = this.combatSystem.rangedAttack(attacker.id, target.id, weapon, projConfig);
                attacker.attackCooldown = 600;
            } else {
                result = this.combatSystem.attack(attacker.id, target.id, 'basic_attack');
                attacker.attackCooldown = 500;
            }
            
            if (attacker.weapon) {
                attacker.weapon.startAttack(attacker.direction);
            }
            if (attacker.stateMachine) {
                attacker.stateMachine.startAttackState(attacker.direction);
            }
            
            var msg = 'Player → ' + (target.name || target.id) + ': ' + result.damage + ' dmg';
            var type = 'player';
            if (result.killed) {
                msg += ' (KILL)';
                type = 'kill';
            }
            if (this.hudSystem) {
                this.hudSystem.addCombatLogEntry(msg, type);
            }
            
            console.log('[Player] Attacked', target.name || target.id, 'for', result.damage, 'damage');

            // Achievement tracking for combat
            if (this.achievementSystem) {
                if (result.critical) {
                    this.achievementSystem.trackStat('criticalHits', 1);
                }
            }

            if (result.damage && this.particles) {
                var attackDir = Math.atan2(target.y - this.player.y, target.x - this.player.x);
                if (result.killed) {
                    this.particles.createDeathEffect(target.x, target.y);
                } else {
                    this.particles.createBloodSplash(target.x, target.y, attackDir, result.critical);
                }
                if (result.critical) {
                    this.particles.createImpactSparks(target.x, target.y);
                }
            }

            var shakeIntensity = result.critical ? 8 : (result.killed ? 10 : 4);
            var shakeDuration  = result.critical ? 280 : (result.killed ? 350 : 150);
            this.triggerShake(shakeIntensity, shakeDuration);

            // Audio
            if (this.audio) { this.audio.playHit(result.critical); }

            // Feature test panel event
            if (this.featureTestPanel) {
                var evMsg = (result.critical ? '⚡ CRIT ' : 'Hit ') +
                    (target.name || target.id) + ' for ' + result.damage + ' dmg' +
                    (result.killed ? ' — KILL' : '');
                this.featureTestPanel.logEvent(evMsg, result.killed ? 'kill' : 'combat');
            }
        } else {
            // Weapon swing animation on miss
            if (this.player && this.player.weapon) {
                this.player.weapon.startAttack(this.player.direction);
            }
            if (this.player && this.player.stateMachine) {
                this.player.stateMachine.startAttackState(this.player.direction);
            }
            if (this.hudSystem) {
                this.hudSystem.addCombatLogEntry('No target in range', 'info');
            }
            if (this.featureTestPanel) {
                this.featureTestPanel.logEvent('Swing — no target in range', 'info');
            }
        }
    }
    
    executeQueuedActions() {
        if (!this.actionQueue || this.actionQueue.isEmpty()) {
            return;
        }
        
        console.log('[Engine] Executing queued actions:', this.actionQueue.getLength());
        
        while (this.actionQueue.hasActions()) {
            var action = this.actionQueue.popAction();
            if (!action || !action.valid) continue;
            
            console.log('[Engine] Executing action:', action.type);
            
            if (action.type === 'attack') {
                this.playerAttack();
            } else if (action.type === 'move') {
                if (action.data && action.data.targetX !== undefined && action.data.targetY !== undefined) {
                    var controlledUnit = (this.inputController && this.inputController.getControlledUnit()) || this.player;
                    if (controlledUnit) {
                        controlledUnit.targetX = action.data.targetX;
                        controlledUnit.targetY = action.data.targetY;
                    }
                }
            } else if (action.type === 'interact') {
                this.tryInteract();
            } else if (action.type === 'use_item') {
                // TODO: Implement item use
                console.log('[Engine] Item use not yet implemented');
            } else if (action.type === 'cast_spell') {
                // TODO: Implement spell casting
                console.log('[Engine] Spell casting not yet implemented');
            }
        }
        
        this.showActionQueue = false;
    }
    
    updateLootDrops(deltaTime) {
        for (var i = this.lootDrops.length - 1; i >= 0; i--) {
            var loot = this.lootDrops[i];
            loot.update(deltaTime);

            if (!loot.active) {
                this.lootDrops.splice(i, 1);
                continue;
            }

            if (this.player && loot.canInteract(this.player)) {
                this.collectLoot(loot);
            }
        }
    }
    
    checkEntityDeath() {
        var entities = this.entityManager ? this.entityManager.entities : [];
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (!entity.active) continue;
            if (entity === this.player) continue;
            
            if (entity.combatStats && entity.combatStats.hp <= 0 && !entity.lootDropped) {
                entity.lootDropped = true;
                entity.dead = true;   // flag used by NPCSpawner death detection
                this.spawnLoot(entity);
                if (this.featureTestPanel) {
                    this.featureTestPanel.logEvent(
                        '☠ ' + (entity.name || entity.id) + ' slain — loot spawned', 'kill'
                    );
                }

                // Track kills for achievements
                if (this.achievementSystem) {
                    this.achievementSystem.trackStat('kills', 1);
                }

                // Notify quest system
                if (this.questSystem) {
                    this.questSystem.onKill(entity.name || 'any');
                    this.questSystem.onKill('any');   // always count toward "any" target quests
                }

                if (this.experienceManager && this.player) {
                    var xpGained = this.experienceManager.calculateXpForKill(entity, entity.combatStats.level || 1);
                    var xpResult = this.experienceManager.addXp(this.player.id, xpGained, 'kill:' + (entity.name || entity.id));
                    
                    if (xpResult && this.hudSystem) {
                        var xpMsg = '+' + xpGained + ' XP';
                        if (xpResult.leveledUp) {
                            xpMsg += ' - Level Up! Now level ' + xpResult.level;
                        }
                        this.hudSystem.addCombatLogEntry(xpMsg, 'xp');
                    }
                }
            }
        }
    }
    
    spawnLoot(entity) {
        var gold = Math.floor(Math.random() * 10) + 5;

        var items = [];
        if (entity.loot && entity.loot.length > 0) {
            for (var i = 0; i < entity.loot.length; i++) {
                if (Math.random() < 0.5) {
                    items.push(entity.loot[i]);
                }
            }
        }

        if (Math.random() < 0.3 && RealmKit.Consumable) {
            var level = entity.combatStats ? entity.combatStats.level : 1;
            var consumable = RealmKit.Consumable.randomDrop(level);
            if (consumable) {
                items.push(consumable);
            }
        }

        // Attach loot to dead body instead of spawning separate drop
        if (gold > 0 || items.length > 0) {
            entity.setDeadBodyLoot(gold, items);
            if (this.particles) {
                this.particles.createSparkle(entity.x, entity.y, '#ffd700', { count: 8, size: 2, speed: 30 });
            }
            console.log('[Engine] Loot attached to body at', entity.x, entity.y, 'gold:', gold, 'items:', items.length);
        }
    }
    
    collectLoot(lootDrop) {
        if (!lootDrop || !lootDrop.active) {
            return { success: false, error: 'invalid_loot' };
        }
        
        if (!this.inventoryManager) {
            console.warn('[Engine] No InventoryManager');
            return { success: false, error: 'no_inventory' };
        }
        
        var result = lootDrop.collect(this.player);
        if (!result) {
            return { success: false, error: 'collect_failed' };
        }
        
        if (result.gold > 0) {
            this.inventoryManager.addGold(result.gold);
            if (this.hudSystem) {
                this.hudSystem.addCombatLogEntry('+' + result.gold + ' gold', 'gold');
            }
        }
        
        for (var i = 0; i < result.items.length; i++) {
            var item = result.items[i];
            var addResult = this.inventoryManager.addItem(item);
            
            if (addResult.success) {
                if (this.hudSystem) {
                    this.hudSystem.addCombatLogEntry('Picked up: ' + (item.name || item.id), 'item');
                }
            } else if (addResult.error === 'inventory_full') {
                if (this.hudSystem) {
                    this.hudSystem.addCombatLogEntry('Inventory full!', 'warning');
                }
            }
        }
        
        var index = this.lootDrops.indexOf(lootDrop);
        if (index !== -1) {
            this.lootDrops.splice(index, 1);
        }
        
        console.log('[Engine] Loot collected - gold:', result.gold, 'items:', result.items.length);
        return { success: true, result: result };
    }
    
    lootDeadBody(entity) {
        if (!entity || !entity.lootBody) {
            console.warn('[Engine] Cannot loot invalid entity');
            return { success: false, error: 'invalid_entity' };
        }
        
        if (!this.inventoryManager) {
            console.warn('[Engine] No InventoryManager');
            return { success: false, error: 'no_inventory' };
        }
        
        var result = entity.lootBody(this.player);
        if (!result.success) {
            return result;
        }
        
        // Add gold
        if (result.gold > 0) {
            this.inventoryManager.addGold(result.gold);
            if (this.hudSystem) {
                this.hudSystem.addCombatLogEntry('+' + result.gold + ' gold (looted from body)', 'gold');
            }
        }
        
        // Add items
        for (var i = 0; i < result.items.length; i++) {
            var item = result.items[i];
            var addResult = this.inventoryManager.addItem(item);
            
            if (addResult.success) {
                if (this.hudSystem) {
                    this.hudSystem.addCombatLogEntry('Looted: ' + (item.name || item.id), 'item');
                }
            } else if (addResult.error === 'inventory_full') {
                if (this.hudSystem) {
                    this.hudSystem.addCombatLogEntry('Inventory full! ' + (item.name || item.id) + ' dropped', 'warning');
                }
            }
        }
        
        console.log('[Engine] Body looted - gold:', result.gold, 'items:', result.items.length);
        return { success: true, result: result };
    }
    
    useInventoryItem(slotId) {
        if (!this.inventoryManager || !this.player) {
            return { success: false, error: 'no_system' };
        }
        
        var item = this.inventoryManager.getItem(slotId);
        if (!item) {
            return { success: false, error: 'no_item' };
        }
        
        if (item.category !== 'consumable') {
            return { success: false, error: 'not_consumable' };
        }
        
        var result = RealmKit.Consumable.use(item, this.player, this.combatSystem, this.statusEffectManager);
        
        if (result.success) {
            if (result.consumed) {
                this.inventoryManager.removeItem(slotId, 1);
            }
            
            var msg = 'Used ' + (item.name || item.type);
            if (result.healed) msg += ' (+' + result.healed + ' HP)';
            if (result.restored) msg += ' (+' + result.restored + ' MP)';
            
            if (this.hudSystem) {
                this.hudSystem.addCombatLogEntry(msg, 'item');
            }
            
            console.log('[Engine] Used item:', item.name || item.type, 'result:', result);
        }
        
        return result;
    }
    
    updateStatusEffects(deltaTime) {
        if (!this.statusEffectManager) return;
        
        var entities = this.entityManager ? this.entityManager.entities : [];
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (!entity.active || !entity.combatStats) continue;
            
            var tickResults = this.statusEffectManager.update(entity.id, deltaTime, this.combatSystem);
            
            for (var j = 0; j < tickResults.length; j++) {
                var result = tickResults[j];
                
                if (result.damage && entity.hitFlashTime !== undefined) {
                    entity.hitFlashTime = 150;
                }
                
                if (this.hudSystem && result.action) {
                    var msg = entity.name + ' ' + result.action + ': ' + (result.damage || result.heal || 0);
                    this.hudSystem.addCombatLogEntry(msg, result.action);
                }
                
                if (result.killed && entity) {
                    entity.combatStats.hp = 0;
                    if (!entity.deathTime) {
                        entity.deathTime = Date.now();
                        entity.lootDropped = false;
                    }
                }
            }
        }
    }
    
    applyStatusEffect(entityId, effectType, source, duration) {
        if (!this.statusEffectManager) return null;
        
        var entity = null;
        if (this.player && this.player.id === entityId) {
            entity = this.player;
        } else if (this.entityManager) {
            entity = this.entityManager.get(entityId);
        }
        
        if (!entity) return null;
        
        var effect = this.statusEffectManager.applyEffect(entity, effectType, source, duration);

        if (effect) {
            if (this.hudSystem) {
                this.hudSystem.addCombatLogEntry(
                    (entity.name || entityId) + ' afflicted with ' + effect.name,
                    'status'
                );
            }
            // Show buff/debuff bar above entity head
            if (this.effectBarSystem) {
                var isDebuff = effect.type === 'dot' || effect.type === 'debuff' ||
                               effectType === 'poison' || effectType === 'burn' ||
                               effectType === 'freeze' || effectType === 'slow';
                this.effectBarSystem.addEffect(
                    entityId,
                    effectType,
                    effect.name || effectType,
                    effect.duration || duration || 5000,
                    isDebuff ? 'debuff' : 'buff'
                );
            }
        }

        return effect;
    }
    
    queueAction(type, data) {
        if (!this.actionQueue) {
            this.actionQueue = new RealmKit.ActionQueue(10);
        }
        
        var success = this.actionQueue.addAction({ type: type, data: data || {} });
        
        if (success) {
            this.showActionQueue = true;
        }
        
        return success;
    }
    
    showDialog(name, text) {
        this.dialogName = name;
        this.dialogText = text;
        this.dialogVisible = true;
        this.dialogTime = Date.now();
        this._dialogAutoDismissTimer = setTimeout(function() {
            if (this.dialogVisible) {
                this.hideDialog();
            }
        }.bind(this), 5000);
    }
    
    hideDialog() {
        if (this._dialogAutoDismissTimer) {
            clearTimeout(this._dialogAutoDismissTimer);
            this._dialogAutoDismissTimer = null;
        }
        this.dialogVisible = false;
    }
    
    _handleCombatEvent(event) {
        if (!event || !event.targetId) return;
        
        if (event.killed) {
            var isPlayer = event.targetId === 'player' || 
                           (this.player && this.player.id === event.targetId) ||
                           (this.player && this.player.combatStats && this.player.combatStats.id === event.targetId);
            
            if (isPlayer) {
                this._onPlayerDeath();
            }
        }
    }
    
    _onPlayerDeath() {
        console.log('[Engine] Player died!');
        this.playerDead = true;
        
        if (this.partyManager && this.partyManager.members.length > 0) {
            var aliveMembers = this.partyManager.members.filter(function(m) {
                return m.combatStats && m.combatStats.hp > 0;
            });
            
            if (aliveMembers.length === 0) {
                this._onPartyWiped();
            }
        } else {
            this._onPartyWiped();
        }
    }
    
    _onPartyWiped() {
        console.log('[Engine] Party wiped! Showing death screen...');
        
        var self = this;
        
        this.showDialog('Game Over', 'Your party has been defeated!');
        
        setTimeout(function() {
            self._showDeathScreen();
        }, 2000);
    }
    
    _showDeathScreen() {
        var container = document.getElementById('death-screen');
        if (container) return;
        
        container = document.createElement('div');
        container.id = 'death-screen';
        container.style.cssText = 
            'position: fixed;' +
            'top: 0; left: 0; right: 0; bottom: 0;' +
            'background: rgba(0, 0, 0, 0.85);' +
            'display: flex;' +
            'flex-direction: column;' +
            'justify-content: center;' +
            'align-items: center;' +
            'z-index: 9999;' +
            'font-family: "Press Start 2P", monospace;' +
            'color: #ff4444;';
        
        container.innerHTML = 
            '<h1 style="font-size: 32px; margin-bottom: 40px; color: #ff0000; text-shadow: 0 0 10px #ff0000;">GAME OVER</h1>' +
            '<div style="display: flex; gap: 20px;">' +
            '<button id="death-restart" style="' +
                'padding: 15px 30px;' +
                'font-family: inherit;' +
                'font-size: 12px;' +
                'background: #8b0000;' +
                'color: #fff;' +
                'border: 2px solid #ff4444;' +
                'cursor: pointer;' +
            '">RESTART</button>' +
            '<button id="death-reload" style="' +
                'padding: 15px 30px;' +
                'font-family: inherit;' +
                'font-size: 12px;' +
                'background: #333;' +
                'color: #fff;' +
                'border: 2px solid #666;' +
                'cursor: pointer;' +
            '">LOAD SAVE</button>' +
            '</div>';
        
        document.body.appendChild(container);
        
        document.getElementById('death-restart').addEventListener('click', function() {
            self._restartGame();
        });
        
        document.getElementById('death-reload').addEventListener('click', function() {
            self._showLoadSaveMenu();
        });
    }
    
    _restartGame() {
        this._closeDeathScreen();
        
        console.log('[Engine] Restarting game...');
        
        // Clear party and managers
        if (this.partyManager) {
            this.partyManager.clear();
        }
        
        if (this.inventoryManager) {
            this.inventoryManager.clear();
        }
        
        if (this.equipmentManager) {
            this.equipmentManager.clear();
        }
        
        // Reset player state
        this.playerDead = false;
        
        // Reset player stats if they exist
        if (this.player) {
            // Restore HP/MP to max
            if (this.player.combatStats) {
                this.player.combatStats.hp = this.player.combatStats.maxHp || 100;
                this.player.combatStats.mp = this.player.combatStats.maxMp || 50;
            }
            this.player.active = true;
            this.player.dead = false;
            this.player.deathTime = 0;
        }
        
        // Regenerate world (creates new map)
        this.regenerateWorld();
        
        // Recreate player at spawn point
        if (this.player) {
            var spawnPoints = this.tileMap.spawns || [];
            var playerSpawn = null;
            for (var i = 0; i < spawnPoints.length; i++) {
                if (spawnPoints[i].type === 'player') { 
                    playerSpawn = spawnPoints[i]; 
                    break; 
                }
            }
            
            if (playerSpawn) {
                this.player.x = playerSpawn.x;
                this.player.y = playerSpawn.y;
            }
            
            // Re-add to party
            if (this.partyManager) {
                this.partyManager.addMember(this.player);
                this.partyManager.setLeader(this.player);
            }
            
            // Update camera
            if (this.camera && this.inputController) {
                this.camera.setTarget(this.player);
            }
        }
        
        // Close any open panels
        if (this.gameUI) {
            this.gameUI.toggleInventory(false);
            this.gameUI.toggleJournal(false);
            this.gameUI.toggleQuests(false);
        }
        
        console.log('[Engine] Game restarted successfully');
    }
    
    _closeDeathScreen() {
        var container = document.getElementById('death-screen');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }
    
    _showLoadSaveMenu() {
        this.showDialog('Load Game', 'Save/Load not yet implemented. Use RESTART to continue.');
    }
    
    updateFPSDisplay() {
        if (this.fpsElement && this.gameLoop) {
            this.fpsElement.textContent = 'FPS: ' + this.gameLoop.getFPS();
        }
    }
    
    _runTestHooks() {
        var self = this;
        var params = this._testParams || {};
        
        console.log('[Engine] Test hooks check:', params);
        
        // ?testAPI — Run API connectivity test
        if (params.testAPI) {
            console.log('[Engine] Running API connectivity test...');
            this._testAPIConnectivity();
        }
        
        // ?testStory=<id> — Load and log a story by ID
        if (params.testStory) {
            console.log('[Engine] Loading test story:', params.testStory);
            this._testLoadStory(params.testStory);
        }
        
        // ?showBuilder — Open StoryBuilder at startup
        if (params.showBuilder && this.storyBuilder) {
            console.log('[Engine] Opening StoryBuilder from URL param');
            setTimeout(function() {
                self.storyBuilder.show();
            }, 500);
        }
        
        // ?testCreateStory — Create a test story at startup
        if (params.testCreateStory) {
            console.log('[Engine] Creating test story from URL param');
            this._testCreateStory();
        }
    }
    
    _testAPIConnectivity() {
        var db = this.storyBuilder ? this.storyBuilder.db : null;
        if (!db) {
            console.error('[Engine] StoryDatabase not available for API test');
            return;
        }
        
        console.log('[Engine] Testing API endpoint:', db._base);
        
        db.listStories().then(function(stories) {
            console.log('[Engine] API OK — Found', stories.length, 'stories');
            console.log('[Engine] Stories:', stories);
        }).catch(function(err) {
            console.error('[Engine] API FAILED:', err.message);
            console.log('[Engine] This is expected if running offline or API server is down');
            console.log('[Engine] Offline story creation will work via fallback');
        });
    }
    
    _testLoadStory(storyId) {
        var self = this;
        var db = this.storyBuilder ? this.storyBuilder.db : null;
        if (!db) {
            console.error('[Engine] StoryDatabase not available');
            return;
        }
        
        db.loadStory(storyId).then(function(story) {
            console.log('[Engine] Test story loaded:', story);
            console.log('[Engine] Story title:', story.title);
            console.log('[Engine] Story ID:', story.id);
            if (story.factions) console.log('[Engine] Factions:', story.factions.length);
            if (story.characters) console.log('[Engine] Characters:', story.characters.length);
            if (story.quests) console.log('[Engine] Quests:', story.quests.length);
            
            if (self.storyBuilder) {
                self.storyBuilder.storyData = story;
                self.storyBuilder.currentStoryId = storyId;
            }
        }).catch(function(err) {
            console.error('[Engine] Failed to load test story:', err.message);
            console.log('[Engine] Using offline fallback...');
            if (self.storyBuilder) {
                self.storyBuilder.storyData = {
                    id: 'offline_' + Date.now(),
                    title: 'Test Story (Offline)',
                    description: 'Loaded offline due to API error: ' + err.message,
                    genre: 'fantasy'
                };
                self.storyBuilder.currentStoryId = self.storyBuilder.storyData.id;
            }
        });
    }
    
    _testCreateStory() {
        var self = this;
        var db = this.storyBuilder ? this.storyBuilder.db : null;
        if (!db) {
            console.error('[Engine] StoryDatabase not available');
            return;
        }
        
        var testData = {
            title: 'Test Story ' + Date.now(),
            description: 'Created via URL test hook for API validation',
            genre: 'fantasy',
            author: 'Test Hook',
            is_published: false
        };
        
        console.log('[Engine] Creating test story with data:', testData);
        
        db.createStory(testData).then(function(result) {
            console.log('[Engine] TEST CREATE SUCCESS!');
            console.log('[Engine] Created story:', result);
            console.log('[Engine] Story ID:', result.id);
            
            if (self.storyBuilder) {
                self.storyBuilder.storyData = result;
                self.storyBuilder.currentStoryId = result.id;
                console.log('[Engine] StoryBuilder updated with new story');
            }
        }).catch(function(err) {
            console.error('[Engine] TEST CREATE FAILED:', err.message);
            console.log('[Engine] Creating offline fallback...');
            
            if (self.storyBuilder) {
                self.storyBuilder.storyData = {
                    id: 'offline_test_' + Date.now(),
                    title: testData.title,
                    description: testData.description + ' (offline fallback)',
                    genre: testData.genre
                };
                self.storyBuilder.currentStoryId = self.storyBuilder.storyData.id;
                console.log('[Engine] Offline story created:', self.storyBuilder.storyData.id);
            }
        });
    }
    
    sendLog(entry) {
        var data;
        
        if (entry.type === 'combat') {
            data = 'sid=' + this.sessionId +
                   '&ts=' + encodeURIComponent(new Date().toISOString().substr(11, 12)) +
                   '&type=combat' +
                   '&action=' + encodeURIComponent(entry.action || '-') +
                   '&attacker=' + encodeURIComponent(entry.attacker || '-') +
                   '&target=' + encodeURIComponent(entry.target || '-') +
                   '&damage=' + (entry.damage || 0) +
                   '&critical=' + (entry.critical ? '1' : '0') +
                   '&killed=' + (entry.killed ? '1' : '0');
        } else {
            data = 'sid=' + this.sessionId + 
                   '&ts=' + encodeURIComponent(entry.timestamp) +
                   '&frm=' + entry.frame + 
                   '&gap=' + entry.gapMs + 
                   '&til=' + entry.tileMs + 
                   '&spr=' + entry.spriteMs + 
                   '&tot=' + entry.totalMs + 
                   '&fps=' + entry.fps + 
                   '&cam=' + entry.cam + 
                   '&tsw=' + entry.tilesOn + 
                   '&ssw=' + entry.spriteOn;
        }
        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.logUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(data);
    }
    
    flushLogs() {
    }
    
    renderTerrainDebug() {
        if (!this.tileMap) return;
        
        var ctx = this.renderer.ctx;
        var bounds = this.renderer.viewport.getVisibleBounds();
        var startX = Math.max(0, Math.floor(bounds.left / 32));
        var startY = Math.max(0, Math.floor(bounds.top / 32));
        var endX = Math.min(this.tileMap.width, Math.ceil(bounds.right / 32));
        var endY = Math.min(this.tileMap.height, Math.ceil(bounds.bottom / 32));
        
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        var legend = [
            { tile: 0, name: 'Deep', color: '#1a5276' },
            { tile: 1, name: 'Water', color: '#2980b9' },
            { tile: 2, name: 'Beach', color: '#f4d03f' },
            { tile: 3, name: 'Grass', color: '#27ae60' },
            { tile: 4, name: 'Grass2', color: '#229954' },
            { tile: 5, name: 'Dirt', color: '#8b7355' },
            { tile: 6, name: 'Stone', color: '#7f8c8d' },
            { tile: 7, name: 'Cliff', color: '#5d6d7e' },
            { tile: 10, name: 'Road', color: '#a0522d' },
            { tile: 21, name: 'Tree', color: '#145a32' }
        ];
        
        for (var i = 0; i < legend.length; i++) {
            var item = legend[i];
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(10, 10 + i * 16, 10, 10);
            ctx.fillStyle = item.color;
            ctx.fillRect(11, 11 + i * 16, 8, 8);
            ctx.fillStyle = '#fff';
            ctx.font = '10px Courier New';
            ctx.fillText(item.name, 35, 15 + i * 16);
        }
        
        if (this.tileMap.roadMap) {
            ctx.fillStyle = '#ff6600';
            ctx.fillText('Roads: ' + this.tileMap.roadMap.filter(function(r) { return r > 0; }).length, 10, 180);
        }
        
        if (this.tileMap.riverMap) {
            ctx.fillStyle = '#3498db';
            ctx.fillText('Rivers: ' + this.tileMap.riverMap.filter(function(r) { return r > 0; }).length, 10, 196);
        }
        
        var collisionCount = 0;
        if (this.tileMap.collisionData) {
            for (var y = startY; y < endY; y++) {
                for (var x = startX; x < endX; x++) {
                    var idx = y * this.tileMap.width + x;
                    if (this.tileMap.collisionData[idx] === 1) collisionCount++;
                }
            }
        }
        
        if (this.player) {
            var px = Math.floor(this.player.x / 32);
            var py = Math.floor(this.player.y / 32);
            var pidx = py * this.tileMap.width + px;
            var pTile = -1;
            if (this.tileMap.layers && this.tileMap.layers[0]) {
                pTile = this.tileMap.layers[0].data[pidx];
            }
            var pColl = this.tileMap.collisionData ? this.tileMap.collisionData[pidx] : 0;
            
            ctx.fillStyle = '#fff';
            ctx.fillText('Player: (' + px + ',' + py + ') Tile:' + pTile + ' Coll:' + pColl, 10, 212);
        }
        
        ctx.restore();
    }
    
    renderSpawnerDebug() {
        if (!this.spawnerManager) return;
        
        var ctx = this.renderer.ctx;
        var viewport = this.renderer.viewport;
        var spawners = this.spawnerManager.getAllSpawners();
        
        ctx.save();
        
        for (var i = 0; i < spawners.length; i++) {
            var sp = spawners[i];
            var sx = sp.x - viewport.x;
            var sy = sp.y - viewport.y;
            
            if (sx < -100 || sx > viewport.viewWidth + 100 || 
                sy < -100 || sy > viewport.viewHeight + 100) {
                continue;
            }
            
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, sp.radius || 50, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.beginPath();
            ctx.arc(sx, sy, sp.radius || 50, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            var label = sp.id.substring(0, 15);
            if (sp.spawnPool && sp.spawnPool[0]) {
                label = sp.spawnPool[0].templateId.substring(0, 10);
            }
            ctx.fillText(label, sx, sy - 8);
            
            ctx.fillStyle = '#88ff88';
            ctx.fillText(sp.activeEntities.length + '/' + sp.maxActive, sx, sy + 12);
        }
        
        ctx.restore();
    }
    
    renderTriggerDebug() {
        if (!this.ctx) return;
        
        var ctx = this.ctx;
        ctx.save();
        
        if (this.triggerSystem && this.triggerSystem.zones) {
            var zones = this.triggerSystem.zones;
            for (var i = 0; i < zones.length; i++) {
                var zone = zones[i];
                if (!zone) continue;
                
                var screenX = zone.x - this.camera.x + this.renderer.displayWidth / 2;
                var screenY = zone.y - this.camera.y + this.renderer.displayHeight / 2;
                
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    screenX - zone.width / 2,
                    screenY - zone.height / 2,
                    zone.width,
                    zone.height
                );
                
                ctx.fillStyle = '#ffff00';
                ctx.font = '10px monospace';
                ctx.fillText('TRIGGER', screenX - 20, screenY - zone.height / 2 - 5);
            }
        }
        
        ctx.restore();
    }
    
    /**
     * Called when input controller switches to a different unit
     * Updates camera to follow the new controlled unit
     * @param {Object} unit - The newly controlled unit
     */
    onUnitControlChanged(unit) {
        if (unit && this.camera) {
            this.camera.setTarget(unit);
            console.log('[Engine] Camera now following:', unit.name);
        }
        
        // Update the deprecated this.player reference for backward compatibility
        this.player = unit;
        if (this.gameUI && this.gameUI.sync) {
            this.gameUI.lastSignature = '';
            this.gameUI.lastPartySignature = '';
            this.gameUI.sync(true);
        }
    }
    
    /**
     * Get appropriate template ID for an NPC based on its configuration
     * @param {Object} cfg - NPC spawn configuration
     * @returns {string} Template ID
     */
    _getTemplateForNPC(cfg) {
        // Map behaviors to templates
        if (cfg.behavior === 'hostile' || cfg.behavior === 'caster') {
            var nameLo = (cfg.name || '').toLowerCase();
            if (nameLo.indexOf('skeleton') !== -1) return 'creature_skeleton';
            if (nameLo.indexOf('goblin')   !== -1) return 'creature_goblin_grunt';
            if (nameLo.indexOf('wolf')     !== -1) return 'creature_wolf';
            if (nameLo.indexOf('bear')     !== -1) return 'creature_bear';
            // Default enemy template
            return 'creature_goblin_grunt';
        }
        
        if (cfg.behavior === 'wander' && cfg.interactable) {
            // Friendly NPCs
            if (cfg.name && cfg.name.toLowerCase().indexOf('merchant') !== -1) {
                return 'civilian_merchant';
            }
            return 'civilian_villager';
        }
        
        // Default to villager
        return 'civilian_villager';
    }
};

console.log('[Engine] Class loaded');
