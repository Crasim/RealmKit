# RealmKit TODO — Items Not Yet Wired

These systems were created but need integration work. Priority order:

---

## ✅ COMPLETED — Already Wired In Engine

| Item | File | Status |
|------|------|--------|
| Quadtree Entity Queries | `EntityManager.js:71-102` | ✅ Integrated in `checkEntityCollisions()` |
| Pathfinding NPC Integration | `NPC.js:426-443` | ✅ Combat AI uses `pathfinding.getNextWaypoint()` |
| Effect Bar Rendering | `Engine.js:1389` | ✅ `effectBarSystem.renderAboveHead()` called |
| Combat → Achievement System | `Engine.js:2378-2379` | ✅ `trackStat('kills')` on NPC death |
| Combat → Quest System | `Engine.js:2384-2385` | ✅ `questSystem.onKill()` on NPC death |
| NPC Spawners | `Engine.js:670-688` | ✅ Spawners created at game start |
| Background Music | `Engine.js:194` | ✅ `audio.playMusic('ambient')` |
| Auto-Save | `Engine.js:730` | ✅ `saveManager.startAutoSave(this)` |
| EffectBarSystem → StatusEffectManager | `Engine.js:2581-2591` | ✅ `effectBarSystem.addEffect()` on status apply |
| Story API Test Hooks | `Engine.js:564-578` | ✅ URL params for story testing |

---

## 🧪 TEST HOOKS — How to Test Story Creation

### URL Parameters

Add these to the URL to test story functionality:

| URL Parameter | What It Does |
|---------------|--------------|
| `?testAPI` | Tests API connectivity at startup, logs results |
| `?showBuilder` | Opens StoryBuilder panel on game load |
| `?testCreateStory` | Creates a test story via API at startup |
| `?testStory=<id>` | Loads a specific story by ID at startup |

**Examples:**
```
http://localhost/RealmKit/?testAPI
http://localhost/RealmKit/?showBuilder
http://localhost/RealmKit/?testCreateStory
http://localhost/RealmKit/?testStory=1
http://localhost/RealmKit/?showBuilder&testAPI
```

### F3 Panel — API Tests Section

Press **F3** to open the Developer Grimoire, then scroll to **🔌 API Tests**:

| Button | Action |
|--------|--------|
| **PING API** | Tests connectivity to the API server, shows ONLINE/OFFLINE |
| **LIST STORIES** | Fetches and logs all stories from the API |
| **+ CREATE TEST** | Creates a test story via API (falls back to offline if API fails) |
| **CLEAR** | Clears current story data |

### F3 Panel — Story Builder Section

| Button | Action |
|--------|--------|
| **📖 OPEN BUILDER (F4)** | Opens the StoryBuilder UI |
| **+ OFFLINE STORY** | Creates an offline story (no API needed) |

### Console Commands (in browser DevTools)

```javascript
// Check API connectivity
window.storyDatabase.listStories().then(console.log).catch(console.error);

// Create a test story
window.storyDatabase.createStory({
    title: 'Test ' + Date.now(),
    description: 'Created via console',
    genre: 'fantasy'
}).then(console.log).catch(console.error);

// View current story
window.storyBuilder.storyData;
```

---

## 🔴 REMAINING — Not Yet Wired

### 1. Entity Pool Integration
- **File**: `src/js/fx/ParticleSystem.js`
- **Status**: NOT WIRED — still uses `this.particles.push()` array
- **Task**: Replace `particles` array with ObjectPool for better GC performance
- **How**: 
  ```javascript
  // In ParticleSystem constructor:
  this.pool = new RealmKit.ObjectPool(
    function() { return { x:0, y:0, vx:0, vy:0, size:0, color:'#fff', alpha:1, lifetime:0, maxLifetime:0, gravity:0 }; },
    function(p) { p.lifetime = 0; return p; },
    200
  );
  // In emit(): use pool.acquire() instead of push
  // In update(): use pool.release() instead of splice
  ```

### 2. Register Sample Dialogues
- **File**: `src/js/core/Engine.js` - `start()`
- **Status**: NOT WIRED — DialogueSystem exists but has no content
- **Task**: Create dialogue trees for NPCs
- **How**:
  ```javascript
  this.dialogueSystem.createDialogueWithChoices('npc_villager', {
    start: {
      speaker: 'Villager',
      text: 'Hello traveler! What brings you here?',
      choices: [
        { text: 'Looking for work', next: 'quest_offer', condition: function(ctx) { return ctx.player.level >= 1; } },
        { text: 'Just passing through', next: 'goodbye' }
      ]
    },
    quest_offer: {
      speaker: 'Villager',
      text: 'I have a task for you...',
      choices: [
        { text: 'I accept', action: function(ctx) { ctx.engine.questSystem.start('kill_goblins'); } }
      ]
    }
  });
  ```

### 3. Add Fade Transition to World Regen
- **File**: `src/js/core/Engine.js` - `regenerateWorld()`
- **Status**: NOT WIRED — instant map changes
- **Task**: Wrap regeneration in fade transition
- **How**:
  ```javascript
  this.fadeTransition.transition({
    onBlack: function() {
      this.initTileMap(overrides);
      this.buildMinimap();
    }
  });
  ```

### 4. Biome-Based Weather
- **File**: `src/js/core/Engine.js` - `update()`
- **Status**: NOT WIRED — weather is manual only
- **Task**: Auto-set weather based on player biome
- **How**:
  ```javascript
  var biome = this.getBiomeAt(this.player.x, this.player.y);
  if (biome === 'tundra' && this.weatherSystem.currentWeather !== 'snow') {
    this.weatherSystem.setWeather('snow', 0.5, 0);
  }
  ```

### 5. Sync XP to Achievement Level
- **File**: `src/js/systems/ExperienceManager.js`
- **Status**: NOT VERIFIED — may need integration
- **Task**: Sync level to achievement system on XP gain
- **How**:
  ```javascript
  if (this.engine && this.engine.achievementSystem) {
    this.engine.achievementSystem.setStat('level', data.level);
  }
  ```

### 6. Test Music in F3 Panel
- **File**: `src/js/ui/FeatureTestPanel.js`
- **Status**: NEEDS VERIFICATION — check if music buttons exist
- **Task**: Add "START MUSIC" / "STOP MUSIC" buttons to F3 audio section

---

## Files Created (Reference)

| File | Lines | Purpose |
|------|-------|---------|
| `fx/FadeTransition.js` | 75 | Screen fades |
| `fx/WeatherSystem.js` | 130 | Rain/snow/storm |
| `utils/Quadtree.js` | 115 | Spatial partitioning |
| `utils/ObjectPool.js` | 80 | Object pooling |
| `utils/Pathfinding.js` | 165 | A* pathfinding |
| `utils/SaveManager.js` | 135 | Save/load |
| `systems/DialogueSystem.js` | 170 | Branching dialogue |
| `systems/AchievementSystem.js` | 150 | Achievement tracking |
| `systems/QuestSystem.js` | 200 | Quest objectives |
| `systems/NPCSpawner.js` | 130 | Respawn management |
| `ui/EffectBarSystem.js` | 140 | Buff/debuff timers |
| `AudioSystem.js` (music) | +80 | Background music |

---

## Estimated Work

| Priority | Hours |
|----------|-------|
| High (4 items) | 2-3h |
| Medium (4 items) | 2-3h |
| Low (4 items) | 1-2h |
| Quick wins (3 items) | 15 min |

**Total**: ~6 hours to fully integrate all systems