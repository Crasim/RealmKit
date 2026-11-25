# RealmKit Development Roadmap

## Current Status: Phase 7 COMPLETE

---

## Phase 0: Foundation ✓ COMPLETE

### Phase 0.1: Core Engine ✓
- [x] Project scaffold (index.html, config/, src/)
- [x] Canvas renderer (full viewport)
- [x] Game loop (fixed timestep, 60 FPS target)
- [x] Viewport system (coordinate transformation, camera follow)
- [x] Layer structure (Ground, Actors, UI)
- [x] Debug overlay (FPS counter, info bar)

### Phase 0.2: Asset Pipeline ✓
- [x] AssetCache module (image/manifest caching)
- [x] AssetLoader module (queue-based async loading)
- [x] SpriteRenderer module (spritesheet drawing)
- [x] ProceduralSprite module (test sprite generation)
- [x] InputHandler module (keyboard input, toggleable debug)
- [x] Test sprite manifest (JSON)
- [x] Animation playback (walk cycles, frame advancement)

### Phase 0.3: Camera & Optimization ✓
- [x] Dead-zone camera (camera only moves when player exits center)
- [x] Grid optimization (only redraw when camera moves)
- [x] Edge zone detection (preload trigger points)
- [x] Performance logging (timestamped, file-based)
- [x] Map canvas caching (render once, blit on scroll)

### Phase 0.4: Input Handling ✓
- [x] Keyboard input module
- [x] Key binding system (G = grid, C = coordinates, T = tiles, S = sprite, M = auto-move)
- [x] Player movement control (WASD/arrows)
- [x] Input state tracking (held keys)
- [x] Auto-move mode for testing

### Phase 1.0: Tile/Map System ✓
- [x] Tileset class with procedural generation
- [x] TileMap class with layers and collision data
- [x] Map canvas caching (4096x4096 map renders fast)
- [x] Viewport culling (only draw visible tiles)
- [x] Collision data structure (per-tile collision flags)
- [x] 128x128 tile test map

---

## Phase 1: Entity & Collision System ✓ COMPLETE

### Phase 1.1: Entity Framework ✓
- [x] Entity base class (position, velocity, sprite, collision)
- [x] Player entity (extends Entity)
- [x] Entity manager (spawn, update, destroy)
- [x] State machine for animations

### Phase 1.2: Collision System ✓
- [x] AABB collision detection
- [x] Tile collision checking (solid tiles)
- [x] Entity-to-tile collision response
- [x] Player movement blocked by collision

### Phase 1.3: Camera Polish ✓
- [x] Camera bounds clamping
- [x] Smooth camera easing options
- [x] Manual camera debug controls (via dead zone)

---

## Phase 2: Actor System (Current)

### Phase 2.1: Entity Framework ✓
- [x] Entity base class (position, velocity, sprite, collision)
- [x] NPC entity class
- [x] AnimationStateMachine for states
- [x] Y-sorting for proper depth rendering

### Phase 2.2: NPC Behaviors ✓
- [x] Wander AI (random walk within radius)
- [x] Patrol AI (fixed path)
- [x] Follow AI (follow player)
- [x] Collision response (stop, redirect)

### Phase 2.3: Interaction System ✓
- [x] Player proximity detection
- [x] Interaction key handler (E key)
- [x] Basic dialog overlay
- [x] Entity collision with nudge mechanic

---

## Phase 3: Terrain, Biomes & Developer Tools ✓ (mostly complete)

### Phase 3.1: Procedural Terrain ✓
- [x] Perlin noise elevation + moisture + temperature maps
- [x] Whittaker-style biome classification (Forest, Swamp, Desert, Tundra, Wetland, Meadow, Ancient)
- [x] Continental noise (2-layer) replacing island edge-factor
- [x] Rivers (3-5, flow downhill), Lakes (2-4), Erosion passes
- [x] Roads — ring topology, directional tiles (ROAD_H/V/CORNER), split-path via lowest-elevation midpoint
- [x] Procedural tileset canvas (immediate, no async Image decode)
- [x] Dynamic snow/cliff/beach thresholds
- [x] Spawn points for player + settlements

### Phase 3.2: DevPanel & Minimap ✓
- [x] Floating DevPanel (` or F2) — draggable, dark teal theme
- [x] World stats: runtime hh:mm:ss, FPS (30-frame rolling avg), frame ms, map size
- [x] Player stats: world XY, tile XY, tile type, HP/MP colour bars
- [x] Cursor tile readout: elevation, moisture, temperature, collision
- [x] Minimap: offscreen canvas, correct aspect-ratio for non-square maps, opacity slider
- [x] Minimap click-to-teleport with crosshair flash
- [x] Terrain sliders: water/hill/mtn level, elevation scale
- [x] Free-form map dimensions (W × H presets + manual inputs)
- [x] "Regenerate World" (new seed) + "Regen Same Seed" buttons
- [x] Pending-changes highlight on Regen button when inputs differ from live map
- [x] Map W×H label drawn on minimap so current map size is always visible

### Phase 3.3: Combat System (IN PROGRESS)
- [x] CombatSystem class (damage calculation, combat log)
- [x] HUDSystem (HP/MP bars, combat log overlay)
- [x] Player attackCooldown + basic attack input
- [x] Enemy aggro radius + chase / return-to-patrol
- [x] Hit flash on target (white/gold overlay on damage)
- [x] LootDrop class (spawn on death, gold/items, sparkle effect)
- [x] PartyManager stub (add/remove members, formations, gold/inventory)
- [x] StatusEffectManager class (15 effect types, DOT/HOT ticks, stat modifiers, stacking)
- [x] Status effect integration with combat (weapons can apply effects, visual indicators)
- [x] InventoryManager class (24 slots, stacking, gold tracking)
- [x] Consumable class (potions, food, buffs, teleport scroll)
- [x] E key pickup for LootDrop items + gold
- [x] Hotkey bar (1-9 keys) for consumable use
- [x] Inventory UI overlay (slot icons, quantities, gold display)
- [ ] **Baldur's Gate 2-style realtime-with-pause combat**
   - [x] Pause mode (Space) — game freezes, player can queue actions
   - [x] Action queue: Attack, Move-to, Use-item, Cast-spell
   - [x] Hit flash on target (white/gold overlay on damage)
   - [x] Attack animation (4-phase: wind-up/strike/impact/follow-through — body lunge + phase-eased weapon swing + AnimationStateMachine attack states)
   - [x] Death animation (fade out over 3s, 'DEAD' indicator)
   - [x] Loot drop placeholder
   - [x] Party member stubs (future expansion point)

### Phase 3.4: Visual Polish
- [x] Screen shake on hit (trauma-decay, escalates on crit; player hit also triggers shake)
- [x] Particle effects (blood splash, sparkle, smoke, impact sparks, death effect)
- [x] Fade transitions (screen fade in/out, scene transitions)
- [x] Basic lighting overlay (day/night cycle, player torch, settlement campfires, LFO sky tint)
- [x] Weather system (rain, snow, storm effects)

### Phase 3.5: Audio
- [x] Web Audio API sound effects (hit/crit, footstep, ambient wind, death)
- [x] Background music (procedural ambient drone loop)
- [x] Volume/mute toggle (setMasterVolume / toggleMute)

### Phase 3.6: Projectiles & Ranged Combat
- [x] ProjectileSystem class (in-flight projectile visuals)
  - [x] Projectile config: speed, sprite, color, hit/miss result
  - [x] Update loop: move toward target, check arrival
  - [x] Render loop: sprite or procedural fallback
  - [x] On-arrival callback: apply damage, particles, audio
- [x] Weapon.js ranged support
  - [x] `attackType: 'melee' | 'ranged' | 'magic'`
  - [x] `projectile.speed` (pixels/second, weapon-defined)
  - [x] `projectile.sprite` (asset key)
  - [x] `projectile.accuracy` (base to-hit chance)
  - [x] `fireRate`, `loadingTime` (for muskets, etc.)
- [x] CombatSystem.js ranged attack
  - [x] `rangedAttack()` method (to-hit roll, create projectile)
  - [x] Hit/miss determined at fire time, visual shows result
- [x] InventoryManager.js ammo
  - [x] `hasAmmo(ammoType, count)`
  - [x] `consumeAmmo(ammoType, count)`
  - [x] `unlimitedAmmo` config option
  - [x] Magic weapons use MP instead of ammo
- [x] F3 panel projectile test buttons

### Phase 3.7: Engine Bootstrap & Story Launcher
- [x] StoryDatabase.js baseUrl fix (point to live API)
- [x] DefaultStory.js (hardcoded fallback for offline/no-story)
- [x] Engine.loadStory(storyId) method
  - [x] Fetch story from API via StoryDatabase
  - [x] Apply engine_config, factions, flag definitions
  - [x] Fallback to DefaultStory if offline
- [x] StoryLauncher.js UI
  - [x] Story card grid (title, genre, description, play count)
  - [x] "Play Offline" button
  - [x] Load → select → start flow
- [x] index.html launcher overlay
- [x] config/engine.js apiUrl option

---

## Phase 4: Systems & Infrastructure ✓ COMPLETE

### Phase 4.1: Core Systems
- [x] FadeTransition class (fade in/out, transitions, color control)
- [x] Quadtree spatial partitioning (entity retrieval, proximity queries)
- [x] ObjectPool for particles/entities (acquire/release pattern)
- [x] A* Pathfinding (grid-based pathfinding, line-of-sight checks)
- [x] SaveManager (localStorage persistence, slot system, auto-save)
- [x] EffectBarSystem (buff/debuff timer bars above entities)

### Phase 4.2: Game Systems
- [x] DialogueSystem (branching trees, conditions, callbacks)
- [x] AchievementSystem (tracking stats, condition checking, unlock events)
- [x] QuestSystem (objectives, progress tracking, completion rewards)
- [x] NPCSpawner (respawn system, max NPCs per spawner, timed respawns)
- [x] WeatherSystem (rain/snow/storm particles, intensity control)
- [x] Background music system (procedural drone layers, volume control)

### Phase 4.3: Story/World Builder UI ✓ COMPLETE
- [x] StoryBuilder.js (tab-based editor container, F4 toggle)
- [x] Story tab (list/create/edit stories, offline story support)
- [x] Factions tab (create factions with name, description, color)
- [x] Characters tab (create NPCs with role, level, faction, dialogue link)
- [x] Dialogues tab (create dialogue trees with nodes and choices)
- [x] Quests tab (create quests with objectives and rewards)
- [x] Scenes tab (create scenes with dimensions and biome bias)
- [x] Debug logging integration (sendLog for all builder actions)
- [x] SNES-style pixel art UI (Press Start 2P font, wood frame)
- [x] WebSocket client module (src/js/network/WebSocketClient.js)
- [x] Connection management (connect, disconnect, reconnect)
- [x] Event-based message protocol
- [x] Binary message encoding (optional)

### Phase 4.2: State Synchronization
- [x] Entity state sync (position, velocity, animation)
- [x] Client prediction
- [x] Server reconciliation
- [x] Interpolation for remote entities

### Phase 4.3: Multiplayer Features
- [x] Player join/leave events
- [x] Other player rendering
- [x] Chat system (basic)
- [x] Room/zone management

---

## Phase 5: Production Ready

### Phase 5.1: Performance Optimization
- [x] Spatial partitioning (quadtree/grid)
- [x] Frustum culling for entities (only render visible)
- [x] Spawner/trigger debug visualization (`showSpawnerDebug`, `showTriggerDebug`)
- [x] Offscreen canvas caching (grid, static tiles) — CanvasCache utility added
- [x] Asset preloading strategies — PreloadManager with progress UI

### Phase 5.2: Developer Tools
- [x] In-browser debug overlay (entity inspector)
- [x] Map editor basics — terrain/collision/spawner/trigger painting, drag-to-move, save/load
- [x] Hot reload support — HotReload utility for development

### Phase 5.3: Documentation & Examples ✓ COMPLETE
- [x] API documentation — docs/api/ (Engine, Entity, CombatSystem, DialogueSystem, TileMap, Utils)
- [x] Integration guide — docs/integration.md
- [x] Example game project — examples/my-first-game/
- [x] Asset pipeline guide — docs/asset-pipeline.md

---

## Phase 6: World Editor & Monster System ✓ COMPLETE

### Phase 6.1: Monster Templates & Spawners
- [x] MonsterTemplates.js with 15+ monster definitions
- [x] LootTables with drop probability system
- [x] MonsterTemplateManager class (create, roll loot, templates by level/terrain)
- [x] MonsterSpawner class (spawn pool, radius, patrol paths, conditions)
- [x] SpawnerManager class (multi-spawner orchestration)
- [x] FeatureTestPanel spawner controls (spawn goblin/skeleton/wolf/orc/boss)
- [x] WorldEditor UI for spawner placement (F6) — drag/drop, property editing, save/load

### Phase 6.2: Trigger System
- [x] TriggerZone class (rect/circle/polygon shapes)
- [x] Trigger conditions (level, quest, flags, items, time)
- [x] Trigger actions (spawn, dialogue, teleport, flags, quests, items, XP, gold, weather, spawners)
- [x] TriggerSystem class (position tracking, enter/exit events)
- [x] FeatureTestPanel trigger controls
- [x] Trigger visualization overlay

### Phase 6.3: Day/Night & Spawn Conditions
- [x] TimeOfDay utility module (getTimeOfDay, getHour, formatTime, getLightLevel, getAmbientColor)
- [x] TimeOfDay integration with spawn conditions (entityManager.timeOfDay set each frame)
- [x] Spawner time-of-day conditions (canSpawn checks timeOfDay array)
- [x] FeatureTestPanel night spawner test buttons (SPAWN NIGHT ONLY, NIGHT SKELETON, DUNGEON SPAWNER, NIGHT BOSS)
- [x] Time preset buttons (SET MIDNIGHT, SET NOON) for testing
- [x] NPCSchedule utility module (schedule types: merchant, guard, villager, night_guard)
- [x] NPC schedule support (scheduleType config, auto behavior changes based on time)
- [x] NPC sleep behavior (💤 indicator, velocity frozen during sleep)
- [x] FeatureTestPanel schedule test buttons (MERCHANT NPC, GUARD NPC, VILLAGER NPC, NIGHT GUARD)
- [x] Boss spawn oneTime flag (only spawns once per spawner)
- [x] Loot quality scaling by level (quality tiers: common/uncommon/rare/epic/legendary)
- [x] rollLootWithKillData() combines killer + victim levels for loot scaling
- [x] Boss location requirements (locationId spawn condition, LocationSystem module)
- [x] WorldEditor location + time-of-day spawn condition fields

---

## Phase 7: AI & World Systems ✓ COMPLETE

### Phase 7.1: NPC Pathfinding Integration
- [x] NPCs use A* pathfinding for navigation (wander, patrol, chase)
- [x] PathRequestManager for efficient path caching
- [x] Pathfinding requests throttled per frame
- [x] Path recalculation when target moves
- [x] Visual debug overlay for paths (P key toggle)
- [x] NPCs avoid obstacles and other entities

### Phase 7.2: Equipment & Item System
- [x] Equipment slots (head, chest, legs, feet, mainHand, offHand, accessory)
- [x] Item stat modifiers (STR, DEX, INT, CON) — implemented as attack/defense/hp/mp/speed/critChance/blockChance
- [x] Equipment UI panel (basic tooltip, right-click to unequip) — U key to toggle
- [x] Item rarities with visual indicators (common → legendary colors)
- [x] LootDrop equipment drops from monsters (CreateFromLootTable static method)
- [x] Item tooltips with detailed stats
- [x] Equipment stat bonuses applied to combat
- [x] Equipment context menu (right-click unequip)

### Phase 7.3: Story Integration
- [x] QuestSystem trigger actions (startQuest, completeQuest, advanceQuest in TriggerZone)
- [x] NPC dialogue triggers quests (dialogue choices can start/complete/advance quests)
- [x] Quest completion triggers (kill/collect/talk/reach/explore objectives)
- [x] Quest rewards (items, gold, XP, flags — in DialogueSystem choices)
- [x] Quest log UI (QuestPanel — L key)
- [x] Quest tracker on HUD (QuestTracker — active objectives display)
- [x] Dialogue conditions check quest state (questState condition in canShowChoice)
- [x] Dialogue conditions check flags (hasFlag condition)
- [x] NPC schedules linked to story events (questRequired, questInProgress, flagRequired, minLevel)

### Phase 7.4: Zone Transitions
- [x] ZoneTransition entity (door, portal, cave entrance)
- [x] ZoneManager for managing zone transitions
- [x] ZoneTriggerSystem (player enters zone → check transition)
- [x] Map transition with fade effect (via fadeTransition)
- [x] Zone config: targetMap, targetSpawn, requiresLevel, costGold
- [x] WorldEditor zone placement (F6 add zone transition)
- [x] Zone visual rendering (different types: door/portal/cave/stairs)
- [x] Player position preservation across zones (spawn point system)
- [x] Zone persistence in save/load (visitedZones serialized)

---

## Quick Reference: File Structure

```
RealmKit/
├── index.html              # Entry point
├── config/
│   └── engine.js           # Engine config (debug flags, resolution)
├── assets/
│   └── sprites/
│       └── test_hero.json  # Sprite manifest
├── src/js/
│   ├── core/
│   │   ├── Engine.js       # Main engine orchestrator
│   │   ├── GameLoop.js      # Fixed timestep loop
│   │   ├── Viewport.js      # Camera/coordinate transform
│   │   ├── AssetCache.js    # Image/manifest cache
│   │   ├── AssetLoader.js   # Async asset loading
│   │   ├── ProceduralSprite.js  # Test sprite generation
│   │   └── InputHandler.js  # Keyboard input
│   ├── fx/
│   │   ├── ParticleSystem.js    # Particle effects
│   │   ├── FadeTransition.js    # Screen fade transitions
│   │   └── WeatherSystem.js      # Rain/snow/storm weather
│   ├── systems/
│   │   ├── AudioSystem.js       # Sound effects & music
│   │   ├── CombatSystem.js      # Damage, aggro, loot
│   │   ├── StatusEffectManager.js # Buffs/debuffs
│   │   ├── ThreatManager.js     # Aggro/threat tables
│   │   ├── ExperienceManager.js # XP/leveling
│   │   ├── InventoryManager.js  # Items/gold
│   │   ├── HUDSystem.js         # HP/MP bars, combat log
│   │   ├── DialogueSystem.js    # Branching conversations
│   │   ├── AchievementSystem.js # Achievement tracking
│   │   ├── QuestSystem.js       # Quest objectives
│   │   ├── NPCSpawner.js        # Respawn management
│   │   ├── MonsterSpawner.js    # Monster spawn pools, templates
│   │   ├── TriggerSystem.js     # Zone-based triggers, actions
│   │   └── SaveManager.js       # localStorage persistence
│   ├── data/
│   │   ├── DefaultStory.js      # Fallback story config
│   │   ├── EntityFactory.js     # Entity templates
│   │   ├── MapData.js           # Procedural map data
│   │   └── MonsterTemplates.js  # Monster definitions, loot tables
│   ├── network/
│   │   ├── WebSocketClient.js   # WebSocket client with reconnect
│   │   └── MultiplayerManager.js # State sync, interpolation
│   ├── utils/
│   │   ├── Quadtree.js      # Spatial partitioning
│   │   ├── ObjectPool.js    # Object pooling
│   │   ├── Pathfinding.js   # A* pathfinding
│   │   ├── TimeOfDay.js     # Day/night phase calculations
│   │   ├── NPCSchedule.js   # NPC time-based schedules
│   │   ├── CanvasCache.js   # Offscreen canvas caching
│   │   ├── PreloadManager.js # Asset preloading with progress UI
│   │   ├── HotReload.js     # Development hot reload
│   │   └── SaveManager.js    # localStorage persistence
│   ├── ui/
│   │   ├── DevPanel.js      # F2 dev panel
│   │   ├── FeatureTestPanel.js # F3 test harness
│   │   └── EffectBarSystem.js  # Buff/debuff timers
│   └── entity/
│       ├── Entity.js
│       ├── Player.js
│       ├── NPC.js
│       ├── LootDrop.js
│       └── EntityManager.js
└── AGENTS.md               # Development notes
```

---

## Next Session Priorities

1. **Phase 3.6**: Projectiles & ranged combat (Weapon.js, CombatSystem.js, ProjectileSystem.js)
2. **Phase 3.7**: Engine bootstrap + story launcher (StoryDatabase.js, StoryLauncher.js)
3. **Phase 4**: Wire up DialogueSystem with E key NPC interactions
4. **Phase 4**: Performance optimization (quadtree for entity queries)
5. **Phase 5**: Story/World Builder UI (editors for factions, characters, dialogues, quests)

---

## Backend Infrastructure (Complete)

Local PHP API at `http://localhost/RealmKit/api/`

| Route | Purpose |
|-------|---------|
| `GET /stories` | List published stories |
| `GET /stories/:id` | Get full story (config, factions, flags) |
| `POST /stories` | Create story |
| `PUT /stories/:id/engine-config` | Update engine config |
| `GET /saves/story/:id` | List saves for story |
| `PUT /saves/story/:id/slot/:slot` | Save game |
| `GET /characters/story/:id` | List characters |
| `GET /dialogues/:id/tree` | Get dialogue tree |
| `GET /quests/story/:id` | List quests |
| `GET /scenes/story/:id` | List scenes |
| `GET /assets/story/:id` | List assets |

Client wrappers: `StoryDatabase.js`, `SaveDatabase.js`

LLM tables ready: `story_agents`, `agent_sessions`, `agent_messages`, `agent_actions`, `npc_memory` (FTS5)

---

## Architecture Reference

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | HTML5 Canvas + Vanilla JS |
| Backend | PHP 8 + PDO SQLite |
| Database | SQLite with FTS5 |
| Assets | Key-based references (no blobs) |
| LLM | Ollama (local), Anthropic/OpenAI (cloud) |

### Save Strategy
- Anonymous users: IndexedDB only
- Authenticated users: IndexedDB + API sync
- Cloud wins on slot conflict

### Story Loading Flow
```
Engine.start()
  └── StoryLauncher.show()
        ├── API: GET /stories → display cards
        ├── On select: Engine.loadStory(id)
        │     └── StoryDatabase.applyToEngine(id, engine)
        │           ├── regenerateWorld(terrain config)
        │           ├── weatherSystem.setWeather(config)
        │           ├── FactionRelations ← faction_relations rows
        │           └── _storyFlags ← flag definitions
        └── If offline: Engine.loadDefaultStory()
```

### Projectile Combat Flow (D&D-style)
```
Player presses J (attack)
  └── CombatSystem.rangedAttack(attacker, target, weapon)
        ├── To-hit roll: d20 + attack_bonus vs AC
        ├── Calculate damage (if hit)
        ├── Create Projectile { x, y, targetX, targetY, speed, hit, damage }
        └── ProjectileSystem.add(projectile)

Each frame:
  └── ProjectileSystem.update(dt)
        ├── Move projectile toward target
        ├── Check arrival (distance < threshold)
        └── On arrival:
              ├── If hit: apply damage, particles, audio
              └── If miss: miss effect at target location
```