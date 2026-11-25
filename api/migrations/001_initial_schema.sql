-- ============================================================
--  RealmKit Platform — Initial Schema
--  Database: SQLite (better-sqlite3)
--  Migration: 001
--
--  Notes:
--   • UUIDs are generated in PHP (random_bytes(16)) and passed
--     as TEXT. No extension needed.
--   • Timestamps stored as TEXT in ISO-8601 format.
--     CURRENT_TIMESTAMP produces 'YYYY-MM-DD HH:MM:SS'.
--   • BOOLEAN columns stored as INTEGER (0/1).
--   • FOREIGN KEY enforcement requires PRAGMA foreign_keys=ON
--     (set in db.php at startup).
--   • updated_at triggers use SQLite AFTER UPDATE syntax.
--   • Schema is idempotent: CREATE TABLE IF NOT EXISTS means
--     re-running on an existing database is safe.
-- ============================================================

-- ============================================================
--  GENRES  (shared lookup — read-only after seed)
-- ============================================================
CREATE TABLE IF NOT EXISTS genres (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,      -- 'medieval_fantasy', 'sci_fi' ...
    display_name TEXT NOT NULL,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed genres (INSERT OR IGNORE is idempotent)
INSERT OR IGNORE INTO genres (id, name, display_name) VALUES
    ('genre-medieval-fantasy', 'medieval_fantasy', 'Medieval Fantasy'),
    ('genre-high-fantasy',     'high_fantasy',     'High Fantasy'),
    ('genre-post-apocalyptic', 'post_apocalyptic',  'Post-Apocalyptic'),
    ('genre-modern-sci-fi',    'modern_sci_fi',     'Modern Sci-Fi'),
    ('genre-future-sci-fi',    'future_sci_fi',     'Future Sci-Fi'),
    ('genre-horror',           'horror',            'Horror'),
    ('genre-western',          'western',           'Western'),
    ('genre-steampunk',        'steampunk',         'Steampunk');

-- ============================================================
--  USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id           TEXT    PRIMARY KEY,
    username     TEXT    UNIQUE,
    email        TEXT    UNIQUE,
    is_anonymous INTEGER DEFAULT 0,
    created_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
    AFTER UPDATE ON users FOR EACH ROW
BEGIN UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  STORIES  (top-level container — one per game world)
-- ============================================================
CREATE TABLE IF NOT EXISTS stories (
    id           TEXT    PRIMARY KEY,
    title        TEXT    NOT NULL,
    slug         TEXT    NOT NULL UNIQUE,
    genre_id     TEXT    REFERENCES genres(id),
    description  TEXT,
    is_published INTEGER DEFAULT 0,
    created_by   TEXT    REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_stories_updated_at
    AFTER UPDATE ON stories FOR EACH ROW
BEGIN UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  ENGINE CONFIGS  (one row per story)
-- ============================================================
CREATE TABLE IF NOT EXISTS engine_configs (
    id                      TEXT  PRIMARY KEY,
    story_id                TEXT  NOT NULL UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
    terrain_water_level     REAL  DEFAULT 0.22  CHECK (terrain_water_level     BETWEEN 0 AND 1),
    terrain_hill_level      REAL  DEFAULT 0.78  CHECK (terrain_hill_level      BETWEEN 0 AND 1),
    terrain_mountain_level  REAL  DEFAULT 0.88  CHECK (terrain_mountain_level  BETWEEN 0 AND 1),
    terrain_elevation_scale REAL  DEFAULT 0.008 CHECK (terrain_elevation_scale > 0),
    default_weather         TEXT  DEFAULT 'clear'
                                CHECK (default_weather IN ('clear','rain','snow','storm','fog','ash')),
    weather_intensity       REAL  DEFAULT 0.3   CHECK (weather_intensity BETWEEN 0 AND 1),
    day_night_speed         INTEGER DEFAULT 120  CHECK (day_night_speed > 0),
    lighting_theme          TEXT  DEFAULT 'warm',
    ui_theme                TEXT  DEFAULT 'parchment',
    ambient_audio_key       TEXT,
    default_map_width       INTEGER DEFAULT 256  CHECK (default_map_width > 0),
    default_map_height      INTEGER DEFAULT 256  CHECK (default_map_height > 0)
);

-- ============================================================
--  UI CONFIGS  (one row per story; shared authored presentation)
-- ============================================================
CREATE TABLE IF NOT EXISTS ui_configs (
    id                    TEXT PRIMARY KEY,
    story_id              TEXT NOT NULL UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
    ui_mode               TEXT DEFAULT 'hybrid'
                          CHECK (ui_mode IN ('dnd','hybrid','narrative')),
    theme_key             TEXT DEFAULT 'realmkit-parchment',
    resource_labels_json  TEXT DEFAULT '{"hp":"HP","mp":"MP","xp":"XP","level":"Level","gold":"Gold"}',
    panel_config_json     TEXT DEFAULT '{"inventory":true,"character":true,"quests":true,"dialogue":true,"pause":true,"minimap":true}',
    layout_config_json    TEXT DEFAULT '{"draggable":true,"snapToEdges":true,"rememberPositions":true,"zones":{"bottomDock":true,"rightDock":true,"leftDock":true}}',
    created_at            TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at            TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_ui_configs_updated_at
    AFTER UPDATE ON ui_configs FOR EACH ROW
BEGIN UPDATE ui_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============================================================
--  FACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS factions (
    id           TEXT PRIMARY KEY,
    story_id     TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    display_name TEXT NOT NULL,
    color        TEXT,           -- hex e.g. '#4ecca3'
    UNIQUE (story_id, name)
);

CREATE TABLE IF NOT EXISTS faction_relations (
    story_id      TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    faction_a_id  TEXT NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    faction_b_id  TEXT NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL CHECK (relation_type IN ('ally','enemy','neutral')),
    PRIMARY KEY (faction_a_id, faction_b_id),
    CHECK (faction_a_id <> faction_b_id)
);

-- ============================================================
--  SPRITE TEMPLATES
--  Define standard spritesheet grid layouts.
--  Characters reference a template; the engine derives every
--  animation's frame range from sprite_template_regions.
--  Slots that don't apply to a character are simply left blank
--  (transparent frames) — the engine falls back to fallback_anim.
-- ============================================================
CREATE TABLE IF NOT EXISTS sprite_templates (
    id                TEXT    PRIMARY KEY,
    name              TEXT    NOT NULL UNIQUE,   -- e.g. 'humanoid_standard'
    description       TEXT,
    category          TEXT    NOT NULL DEFAULT 'character'
                          CHECK (category IN ('character','creature','object','tileset','ui','projectile')),
    frame_w           INTEGER NOT NULL CHECK (frame_w > 0),   -- base px per frame (at 1× / 16-bit tier)
    frame_h           INTEGER NOT NULL CHECK (frame_h > 0),
    cols_per_row      INTEGER NOT NULL DEFAULT 16 CHECK (cols_per_row > 0),
    has_directions    INTEGER DEFAULT 1,   -- 1 = sheet has per-direction animation rows
    directions        TEXT    DEFAULT '["down","up","left","right"]',  -- JSON array of stored directions
    direction_mirrors TEXT    DEFAULT '{}',  -- JSON {"right":"left","diag_nw":"diag_ne",...} — engine mirrors these at render time
    rows_per_sheet    INTEGER DEFAULT 64    CHECK (rows_per_sheet > 0),
                                           -- base row count per spritesheet file at 1× scale.
                                           -- Scales as: localRows = rows_per_sheet >> log2(scale).
                                           -- Physical sheet height stays constant: rows_per_sheet × frame_h.
                                           -- Use power-of-2 values (16, 32, 64, 128).
    created_at        TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sprite_template_regions (
    id              TEXT    PRIMARY KEY,
    template_id     TEXT    NOT NULL REFERENCES sprite_templates(id) ON DELETE CASCADE,
    anim_name       TEXT    NOT NULL,   -- 'walk_down','attack_up','emote_wave','death'…
    display_name    TEXT    NOT NULL,   -- human label shown in builder UI
    start_frame     INTEGER NOT NULL CHECK (start_frame >= 0),  -- absolute flat frame index (frame 0 = top-left of sheet)
    frame_count     INTEGER NOT NULL CHECK (frame_count > 0),
    fps             REAL    NOT NULL DEFAULT 8.0 CHECK (fps > 0),
    loop            INTEGER DEFAULT 1,           -- 1 = looping, 0 = play-once
    next_anim       TEXT,                        -- anim_name to transition to on completion (e.g. idle_down after attack_down)
    is_required     INTEGER DEFAULT 0,           -- 1 = engine error if blank, 0 = optional
    fallback_anim   TEXT,                        -- anim_name to play when this slot is empty
    sort_order      INTEGER DEFAULT 0,           -- display order in builder overview panel
    UNIQUE (template_id, anim_name)
);

-- ============================================================
--  ASSETS  (key references only — never store blobs in SQL)
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id             TEXT PRIMARY KEY,
    story_id       TEXT REFERENCES stories(id) ON DELETE CASCADE,   -- NULL = global
    asset_key      TEXT NOT NULL,   -- 'tileset.primary', 'sprite.player', 'audio.ambient'
    asset_type     TEXT NOT NULL    CHECK (asset_type IN ('tileset','sprite','audio','ui_skin','thumbnail')),
    source_type    TEXT NOT NULL    CHECK (source_type IN ('url','procedural')),
    source_url     TEXT,
    proc_tile_size INTEGER,
    proc_cols      INTEGER,
    proc_rows      INTEGER,
    proc_seed      INTEGER,
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (story_id, asset_key)
);

-- ============================================================
--  CHARACTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS characters (
    id               TEXT    PRIMARY KEY,
    story_id         TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    name             TEXT    NOT NULL,
    display_name     TEXT,
    faction_id       TEXT    REFERENCES factions(id) ON DELETE SET NULL,
    behavior         TEXT    DEFAULT 'idle'
                        CHECK (behavior IN ('idle','wander','patrol','follow','hostile','friendly','caster')),
    sprite_asset_id        TEXT    REFERENCES assets(id) ON DELETE SET NULL,
    sprite_template_id     TEXT    REFERENCES sprite_templates(id) ON DELETE SET NULL,
    sprite_ext_asset_id    TEXT    REFERENCES assets(id) ON DELETE SET NULL,    -- optional extended-animation sheet (PC/combat NPCs)
    sprite_ext_template_id TEXT    REFERENCES sprite_templates(id) ON DELETE SET NULL,
                                   -- NULL = NPC uses base sheet only.
                                   -- Set to e.g. 'tpl_humanoid_ext' for PCs, bosses, combat NPCs.
                                   -- Engine loads this texture on-demand when a combat/emote anim is triggered.
    sprite_frame_w         INTEGER CHECK (sprite_frame_w > 0),   -- px width per frame; inherits from template if NULL
    sprite_frame_h         INTEGER CHECK (sprite_frame_h > 0),   -- px height per frame; inherits from template if NULL
    is_unique        INTEGER DEFAULT 0,
    aggro_range      INTEGER DEFAULT 150  CHECK (aggro_range >= 0),
    attack_range     INTEGER DEFAULT 40   CHECK (attack_range >= 0),
    base_hp          INTEGER DEFAULT 40   CHECK (base_hp > 0),
    base_attack      INTEGER DEFAULT 10   CHECK (base_attack >= 0),
    base_defense     INTEGER DEFAULT 5    CHECK (base_defense >= 0),
    base_speed       INTEGER DEFAULT 80   CHECK (base_speed > 0),
    backstory        TEXT,
    created_at       TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_relationships (
    story_id          TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    character_a_id    TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    character_b_id    TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
                        CHECK (relationship_type IN ('ally','rival','family','employer','enemy','mentor')),
    description       TEXT,
    PRIMARY KEY (character_a_id, character_b_id),
    CHECK (character_a_id <> character_b_id)
);

-- ============================================================
--  DIALOGUES  (tree structure: dialogue → nodes → choices)
--
--  Note: entry_node_id is a forward reference to dialogue_nodes
--  which is created below. SQLite enforces FKs only when the
--  referenced table exists, so we define entry_node_id WITHOUT
--  an FK constraint here. The cascade is handled by
--  dialogue_nodes.dialogue_id → dialogues ON DELETE CASCADE.
-- ============================================================
CREATE TABLE IF NOT EXISTS dialogues (
    id            TEXT PRIMARY KEY,
    story_id      TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    character_id  TEXT REFERENCES characters(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    entry_node_id TEXT,     -- FK to dialogue_nodes; set after first node is created
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (story_id, name)
);

CREATE TABLE IF NOT EXISTS dialogue_nodes (
    id                   TEXT    PRIMARY KEY,
    dialogue_id          TEXT    NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    story_id             TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    speaker_character_id TEXT    REFERENCES characters(id) ON DELETE SET NULL,
    text                 TEXT    NOT NULL,
    node_type            TEXT    NOT NULL CHECK (node_type IN ('line','choice','branch','end')),
    condition_flag       TEXT,
    condition_value      TEXT,
    set_flag             TEXT,
    set_flag_value       TEXT,
    sort_order           INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dialogue_choices (
    id               TEXT    PRIMARY KEY,
    node_id          TEXT    NOT NULL REFERENCES dialogue_nodes(id) ON DELETE CASCADE,
    story_id         TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    text             TEXT    NOT NULL,
    next_node_id     TEXT    REFERENCES dialogue_nodes(id) ON DELETE SET NULL,
    condition_flag   TEXT,
    condition_value  TEXT,
    sort_order       INTEGER DEFAULT 0
);

-- ============================================================
--  STORY FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS story_flag_definitions (
    id            TEXT PRIMARY KEY,
    story_id      TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    flag_key      TEXT NOT NULL,
    flag_type     TEXT NOT NULL CHECK (flag_type IN ('boolean','integer','string')),
    default_value TEXT DEFAULT 'false',
    description   TEXT,
    UNIQUE (story_id, flag_key)
);

-- ============================================================
--  QUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS quests (
    id                    TEXT    PRIMARY KEY,
    story_id              TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title                 TEXT    NOT NULL,
    description           TEXT,
    giver_character_id    TEXT    REFERENCES characters(id) ON DELETE SET NULL,
    prerequisite_quest_id TEXT    REFERENCES quests(id) ON DELETE SET NULL,
    reward_gold           INTEGER DEFAULT 0  CHECK (reward_gold >= 0),
    reward_xp             INTEGER DEFAULT 0  CHECK (reward_xp >= 0),
    auto_complete         INTEGER DEFAULT 1,
    sort_order            INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quest_objectives (
    id             TEXT    PRIMARY KEY,
    quest_id       TEXT    NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    story_id       TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    objective_type TEXT    NOT NULL
                        CHECK (objective_type IN ('kill','collect','visit','talk','escort')),
    target_name    TEXT,
    required_count INTEGER DEFAULT 1 CHECK (required_count > 0),
    description    TEXT,
    sort_order     INTEGER DEFAULT 0
);

-- ============================================================
--  SCENES
-- ============================================================
CREATE TABLE IF NOT EXISTS scenes (
    id               TEXT    PRIMARY KEY,
    story_id         TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    name             TEXT    NOT NULL,
    description      TEXT,
    map_seed         INTEGER,
    map_width        INTEGER DEFAULT 256 CHECK (map_width > 0),
    map_height       INTEGER DEFAULT 256 CHECK (map_height > 0),
    weather_override TEXT    CHECK (weather_override IN ('clear','rain','snow','storm','fog','ash')),
    music_asset_id   TEXT    REFERENCES assets(id) ON DELETE SET NULL,
    is_entry_point   INTEGER DEFAULT 0,
    UNIQUE (story_id, name)
);

CREATE TABLE IF NOT EXISTS scene_triggers (
    id               TEXT    PRIMARY KEY,
    scene_id         TEXT    NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    story_id         TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    trigger_type     TEXT    NOT NULL
                        CHECK (trigger_type IN
                            ('ON_ENTER','ON_KILL','ON_INTERACT','ON_QUEST_COMPLETE','ON_FLAG_SET','ON_ITEM_COLLECT')),
    trigger_target   TEXT,
    action_type      TEXT    NOT NULL
                        CHECK (action_type IN
                            ('START_DIALOGUE','START_QUEST','LOAD_SCENE','SET_FLAG','SPAWN_CHARACTER','PLAY_AUDIO')),
    action_target_id TEXT,
    condition_flag   TEXT,
    condition_value  TEXT,
    sort_order       INTEGER DEFAULT 0
);

-- ============================================================
--  SPAWN TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS spawn_templates (
    id                TEXT    PRIMARY KEY,
    story_id          TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    scene_id          TEXT    REFERENCES scenes(id) ON DELETE CASCADE,
    character_id      TEXT    NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    spawn_x           INTEGER,
    spawn_y           INTEGER,
    spawn_radius      INTEGER DEFAULT 100  CHECK (spawn_radius >= 0),
    max_count         INTEGER DEFAULT 3    CHECK (max_count > 0),
    respawn_delay_ms  INTEGER DEFAULT 30000 CHECK (respawn_delay_ms >= 0),
    spawn_on_start    INTEGER DEFAULT 1
);

-- ============================================================
--  LORE / CODEX  (shared village knowledge pool)
--
--  Holds both author-written canonical truths AND NPC-generated
--  assertions. An NPC who was nearly killed by "a wolf" (actually
--  a bandit's dog) can create an entry here. That entry spreads
--  to other villagers, each gaining an npc_memory row pointing
--  back to it. is_verified=0 means it is unconfirmed — the player
--  can discover the gap between rumor and reality.
--
--  source_type:
--    canonical    — written by the story author; ground truth
--    npc_observed — NPC witnessed something directly
--    npc_inferred — NPC drew a conclusion from observations
--    npc_rumor    — NPC heard it from someone else
--
--  parent_lore_id — optionally links to an entry this one
--    contradicts or elaborates on (e.g. a correction to a rumor)
-- ============================================================
CREATE TABLE IF NOT EXISTS lore_entries (
    id              TEXT    PRIMARY KEY,
    story_id        TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title           TEXT    NOT NULL,
    category        TEXT    NOT NULL
                        CHECK (category IN ('history','character','location','item','faction','world','rumor')),
    content         TEXT    NOT NULL,
    source_type     TEXT    NOT NULL DEFAULT 'canonical'
                        CHECK (source_type IN ('canonical','npc_observed','npc_inferred','npc_rumor')),
    asserted_by     TEXT    REFERENCES characters(id) ON DELETE SET NULL,  -- NULL = author/canonical
    is_verified     INTEGER DEFAULT 0,   -- 1 = author-confirmed true; 0 = unverified / may be wrong
    spread_count    INTEGER DEFAULT 0    CHECK (spread_count >= 0),  -- # NPCs who have heard & repeated this
    parent_lore_id  TEXT    REFERENCES lore_entries(id) ON DELETE SET NULL,  -- contradicts/elaborates
    is_discoverable INTEGER DEFAULT 1,
    unlock_flag     TEXT                 -- flag_key that reveals this to the player; NULL = always visible
);

-- ============================================================
--  STORY PUBLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS story_publications (
    id             TEXT    PRIMARY KEY,
    story_id       TEXT    NOT NULL UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
    published_by   TEXT    REFERENCES users(id) ON DELETE SET NULL,
    published_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
    version_number TEXT    DEFAULT '1.0',
    is_featured    INTEGER DEFAULT 0,
    play_count     INTEGER DEFAULT 0   CHECK (play_count >= 0),
    rating_average REAL    DEFAULT 0.0 CHECK (rating_average BETWEEN 0 AND 5)
);

-- ============================================================
--  SAVES
-- ============================================================
CREATE TABLE IF NOT EXISTS saves (
    id                TEXT    PRIMARY KEY,
    story_id          TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id           TEXT    REFERENCES users(id) ON DELETE CASCADE,   -- NULL = anonymous
    device_id         TEXT,
    slot_number       INTEGER DEFAULT 0  CHECK (slot_number BETWEEN 0 AND 9),
    display_name      TEXT,
    player_x          REAL,
    player_y          REAL,
    player_hp         INTEGER CHECK (player_hp >= 0),
    player_max_hp     INTEGER CHECK (player_max_hp > 0),
    player_gold       INTEGER DEFAULT 0  CHECK (player_gold >= 0),
    player_xp         INTEGER DEFAULT 0  CHECK (player_xp >= 0),
    player_level      INTEGER DEFAULT 1  CHECK (player_level > 0),
    scene_id          TEXT    REFERENCES scenes(id) ON DELETE SET NULL,
    play_time_seconds INTEGER DEFAULT 0  CHECK (play_time_seconds >= 0),
    sync_status       TEXT    DEFAULT 'local_only'
                        CHECK (sync_status IN ('local_only','synced','pending_sync')),
    created_at        TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_saves_updated_at
    AFTER UPDATE ON saves FOR EACH ROW
BEGIN UPDATE saves SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TABLE IF NOT EXISTS save_flags (
    save_id    TEXT NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
    story_id   TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    flag_key   TEXT NOT NULL,
    flag_value TEXT NOT NULL DEFAULT 'false',
    PRIMARY KEY (save_id, flag_key)
);

CREATE TABLE IF NOT EXISTS save_quest_progress (
    save_id  TEXT NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    status   TEXT NOT NULL DEFAULT 'not_started'
                CHECK (status IN ('not_started','active','complete','failed')),
    PRIMARY KEY (save_id, quest_id)
);

CREATE TABLE IF NOT EXISTS save_objective_progress (
    save_id       TEXT    NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
    objective_id  TEXT    NOT NULL REFERENCES quest_objectives(id) ON DELETE CASCADE,
    current_count INTEGER DEFAULT 0 CHECK (current_count >= 0),
    PRIMARY KEY (save_id, objective_id)
);

-- ============================================================
--  NPC MEMORY  (dynamic per-character fact store — RAG source)
--
--  Stores observations, goals, and learned facts for each NPC.
--  Injected into the LLM context via FTS5 relevance search.
--  Distinct from agent_messages (conversation history) —
--  this is structured knowledge, not dialogue.
-- ============================================================

CREATE TABLE IF NOT EXISTS npc_memory (
    id               TEXT    PRIMARY KEY,
    story_id         TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    character_id     TEXT    NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    memory_type      TEXT    NOT NULL
                        CHECK (memory_type IN
                            ('observation','relationship','goal','knowledge','player_interaction')),
    subject          TEXT,               -- who/what this memory is about (free text tag)
    content          TEXT    NOT NULL,   -- the fact in natural language, used in RAG retrieval
    emotional_weight REAL    DEFAULT 0.0 CHECK (emotional_weight BETWEEN -1.0 AND 1.0),
    lore_entry_id    TEXT    REFERENCES lore_entries(id) ON DELETE SET NULL,
                                         -- set when this private memory has been shared and
                                         -- promoted to the community lore pool; NULL = still private
    expires_at       TEXT,               -- NULL = permanent; ISO-8601 for short-term memories
    created_at       TEXT    DEFAULT CURRENT_TIMESTAMP
);

-- FTS5 virtual table for fast semantic search over npc_memory.content
-- Used by the RAG pipeline to retrieve relevant memories given a query.
-- Requires FTS5 (compiled into SQLite in XAMPP/WAMP by default).
CREATE VIRTUAL TABLE IF NOT EXISTS npc_memory_fts USING fts5(
    content,
    subject,
    content='npc_memory',
    content_rowid='rowid'
);

-- FTS5 over the shared lore pool — used by BOTH the player codex
-- and NPC RAG. Filter by source_type / is_verified to control what
-- each consumer sees:
--   Player codex: WHERE is_discoverable = 1 (truths + discovered rumors)
--   NPC RAG:      WHERE source_type != 'canonical' OR is_verified = 1
--                 (NPCs have access to community knowledge, not hidden author truths)
CREATE VIRTUAL TABLE IF NOT EXISTS lore_fts USING fts5(
    title,
    content,
    content='lore_entries',
    content_rowid='rowid'
);

-- ============================================================
--  LLM AGENTS
--
--  story_agents   — one config row per agent per story
--  agent_sessions — one session per conversation context
--                   (tied to a save for persistent NPC memory,
--                    or save_id IS NULL for world-gen / ad-hoc runs)
--  agent_messages — full message history per session
--  agent_actions  — log of structured outputs executed by the engine
--                   (other NPCs read this to observe each other)
-- ============================================================

CREATE TABLE IF NOT EXISTS story_agents (
    id             TEXT    PRIMARY KEY,
    story_id       TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    agent_key      TEXT    NOT NULL,    -- e.g. 'narrator', 'blacksmith', 'dungeon_master'
    agent_role     TEXT    NOT NULL
                        CHECK (agent_role IN
                            ('npc','narrator','world_builder','quest_generator','dungeon_master')),
    character_id   TEXT    REFERENCES characters(id) ON DELETE SET NULL, -- for npc agents
    provider       TEXT    NOT NULL DEFAULT 'anthropic'
                        CHECK (provider IN ('anthropic','openai','ollama','custom')),
    model          TEXT    NOT NULL,    -- 'claude-haiku-4-5-20251001', 'llama3', etc.
    system_prompt  TEXT,
    temperature    REAL    DEFAULT 0.7  CHECK (temperature BETWEEN 0 AND 2),
    max_tokens     INTEGER DEFAULT 512  CHECK (max_tokens > 0),
    api_endpoint   TEXT,               -- override for ollama / custom providers; NULL = provider default
    context_limit  INTEGER DEFAULT 10  CHECK (context_limit > 0),   -- max messages kept in rolling window
    tools_config   TEXT,               -- JSON: tool definitions passed to the model (world_builder, etc.)
    enabled        INTEGER DEFAULT 1,
    created_at     TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (story_id, agent_key)
);

CREATE TRIGGER IF NOT EXISTS trg_story_agents_updated_at
    AFTER UPDATE ON story_agents FOR EACH ROW
BEGIN UPDATE story_agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- A session is one continuous conversation context.
-- save_id ties it to a player save (NPC memory persists across sessions).
-- save_id IS NULL for world-gen, narrator, and ad-hoc adventure sessions.
CREATE TABLE IF NOT EXISTS agent_sessions (
    id              TEXT    PRIMARY KEY,
    story_id        TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    agent_id        TEXT    NOT NULL REFERENCES story_agents(id) ON DELETE CASCADE,
    save_id         TEXT    REFERENCES saves(id) ON DELETE CASCADE,   -- NULL = world-gen / standalone
    session_type    TEXT    NOT NULL
                        CHECK (session_type IN
                            ('npc_dialogue','world_gen','quest_gen','narration','dungeon_master')),
    context_data    TEXT,              -- JSON: world state / player context injected as system context
    total_tokens    INTEGER DEFAULT 0  CHECK (total_tokens >= 0),
    started_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
    last_active_at  TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_agent_sessions_last_active
    AFTER UPDATE ON agent_sessions FOR EACH ROW
BEGIN UPDATE agent_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- Individual messages within a session — stored oldest-first.
-- The engine trims to context_limit most-recent messages when building
-- the prompt, but retains the full history here for logging / replay.
CREATE TABLE IF NOT EXISTS agent_messages (
    id           TEXT    PRIMARY KEY,
    session_id   TEXT    NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    story_id     TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    role         TEXT    NOT NULL CHECK (role IN ('system','user','assistant')),
    content      TEXT    NOT NULL,
    tokens_used  INTEGER DEFAULT 0 CHECK (tokens_used >= 0),
    created_at   TEXT    DEFAULT CURRENT_TIMESTAMP
);

-- Structured output action log.
-- When the LLM returns a structured action, the engine executes it and
-- writes a row here. Other NPCs query this table (filtered by proximity /
-- scene) to build awareness of what's happening around them.
--
-- action_type mirrors the engine subroutine vocabulary:
--   idle | wander | follow_player | flee | attack | explore |
--   give_quest | start_dialogue | trade | patrol |
--   call_for_help | observe
--
-- action_params: JSON of subroutine arguments (target_id, quest_id, etc.)
-- speech: the NPC's spoken line accompanying the action (may be null)
-- scene_id / world_x / world_y: where this happened (for proximity queries)
CREATE TABLE IF NOT EXISTS agent_actions (
    id             TEXT    PRIMARY KEY,
    story_id       TEXT    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    session_id     TEXT    NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    character_id   TEXT    NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    save_id        TEXT    REFERENCES saves(id) ON DELETE CASCADE,
    action_type    TEXT    NOT NULL
                        CHECK (action_type IN (
                            'idle','wander','follow_player','flee','attack','explore',
                            'give_quest','start_dialogue','trade','patrol',
                            'call_for_help','observe')),
    action_params  TEXT,               -- JSON: subroutine arguments
    speech         TEXT,               -- NPC's spoken line, if any
    emotion        TEXT,               -- e.g. 'curious', 'afraid', 'friendly'
    scene_id       TEXT    REFERENCES scenes(id) ON DELETE SET NULL,
    world_x        REAL,
    world_y        REAL,
    created_at     TEXT    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_stories_genre         ON stories(genre_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_by    ON stories(created_by);
CREATE INDEX IF NOT EXISTS idx_stories_published     ON stories(is_published);
CREATE INDEX IF NOT EXISTS idx_factions_story        ON factions(story_id);
CREATE INDEX IF NOT EXISTS idx_assets_story          ON assets(story_id);
CREATE INDEX IF NOT EXISTS idx_characters_story      ON characters(story_id);
CREATE INDEX IF NOT EXISTS idx_characters_faction    ON characters(faction_id);
CREATE INDEX IF NOT EXISTS idx_dialogues_story       ON dialogues(story_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_nodes_dlg    ON dialogue_nodes(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_choices_node ON dialogue_choices(node_id);
CREATE INDEX IF NOT EXISTS idx_quests_story          ON quests(story_id);
CREATE INDEX IF NOT EXISTS idx_quest_objs_quest      ON quest_objectives(quest_id);
CREATE INDEX IF NOT EXISTS idx_scenes_story          ON scenes(story_id);
CREATE INDEX IF NOT EXISTS idx_scene_triggers_scene  ON scene_triggers(scene_id);
CREATE INDEX IF NOT EXISTS idx_spawn_templates_scene ON spawn_templates(scene_id);
CREATE INDEX IF NOT EXISTS idx_lore_story            ON lore_entries(story_id);
CREATE INDEX IF NOT EXISTS idx_saves_story_user      ON saves(story_id, user_id);
CREATE INDEX IF NOT EXISTS idx_saves_device          ON saves(device_id);
CREATE INDEX IF NOT EXISTS idx_save_flags_save       ON save_flags(save_id);
CREATE INDEX IF NOT EXISTS idx_flag_defs_story        ON story_flag_definitions(story_id);
CREATE INDEX IF NOT EXISTS idx_agents_story             ON story_agents(story_id);
CREATE INDEX IF NOT EXISTS idx_agents_character         ON story_agents(character_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent     ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_save      ON agent_sessions(save_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_story     ON agent_sessions(story_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session   ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_story     ON agent_messages(story_id);
CREATE INDEX IF NOT EXISTS idx_npc_memory_character     ON npc_memory(character_id);
CREATE INDEX IF NOT EXISTS idx_npc_memory_story         ON npc_memory(story_id);
CREATE INDEX IF NOT EXISTS idx_npc_memory_lore          ON npc_memory(lore_entry_id);
CREATE INDEX IF NOT EXISTS idx_lore_asserted_by         ON lore_entries(asserted_by);
CREATE INDEX IF NOT EXISTS idx_lore_source_verified     ON lore_entries(source_type, is_verified);
CREATE INDEX IF NOT EXISTS idx_lore_parent             ON lore_entries(parent_lore_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_character  ON agent_actions(character_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_scene      ON agent_actions(scene_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_save       ON agent_actions(save_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created    ON agent_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_sprite_regions_template  ON sprite_template_regions(template_id);
CREATE INDEX IF NOT EXISTS idx_sprite_regions_frame     ON sprite_template_regions(template_id, start_frame);
CREATE INDEX IF NOT EXISTS idx_characters_template      ON characters(sprite_template_id);

-- ============================================================
--  SEED: humanoid_standard sprite template  (v2)
--
--  Source of truth: docs/asset-standard.md
--  Frame size (base / 16-bit tier):  32×48 px
--  Frame size (32-bit tier):         64×96 px  (primary target)
--  cols_per_row: 16  (1 row per animation — clean power-of-2 sheet width)
--  Total rows:   53
--  Total frames: 848  (16 × 53)
--
--  Direction convention (symmetric characters):
--    STORED:  down · up · left · diag_ne · diag_sw   (5 directions)
--    MIRRORED by engine at render time:
--      right     ← mirror of left
--      diag_nw   ← mirror of diag_ne
--      diag_se   ← mirror of diag_sw
--
--  Sheet layout  (start_frame = row × 16):
--  ─────────────────────────────────────────────────────────────
--  Rows  0- 4  │ idle       × 5 dirs  [4f  @ 2 fps,  loop]
--  Rows  5- 9  │ walk       × 5 dirs  [8f  @ 8 fps,  loop]
--  Rows 10-14  │ run        × 5 dirs  [8f  @ 12 fps, loop]
--  Rows 15-19  │ swim       × 5 dirs  [8f  @ 6 fps,  loop]
--  Rows 20-24  │ melee      × 5 dirs  [6f  @ 12 fps, once → idle]
--  Rows 25-29  │ ranged     × 5 dirs  [6f  @ 10 fps, once → idle]
--  Rows 30-34  │ cast       × 5 dirs  [8f  @ 8 fps,  once → idle]
--  Row  35     │ death              [8f  @ 8 fps,  once]
--  Row  36     │ hurt               [4f  @ 12 fps, once → idle_down]
--  Row  37     │ victory            [6f  @ 8 fps,  once → idle_down]
--  Row  38     │ sleep              [4f  @ 2 fps,  loop]
--  Rows 39-50  │ emotes ×12         [4–8f, once → idle_down]
--  Rows 51-52  │ special_1, special_2  [8f each]
--  ─────────────────────────────────────────────────────────────
--
--  Sheet dimensions:
--    16-bit (1×):  512 × 2544 px  (1 sheet,  rows_per_sheet=64 cap = 3072 px)
--    32-bit (2×): 1024 × 5088 px  (2 sheets, 32 rows each = 3072 px/sheet)
--    64-bit (4×): 2048 × 3072 px  (4 sheets, 16 rows each = 3072 px/sheet)
--   128-bit (8×): 4096 × 3072 px  (7 sheets,  8 rows each = 3072 px/sheet)
--
--  Required: idle_down, walk_down, death
-- ============================================================

-- Wipe old version before re-inserting (idempotent: no-op on fresh DB)
DELETE FROM sprite_template_regions WHERE template_id = 'tpl_humanoid_std';
DELETE FROM sprite_templates           WHERE id        = 'tpl_humanoid_std';

INSERT INTO sprite_templates
    (id, name, description, category, frame_w, frame_h, cols_per_row,
     has_directions, directions, direction_mirrors, rows_per_sheet)
VALUES
    ('tpl_humanoid_std', 'humanoid_standard',
     'Full-featured humanoid (heroes, NPCs, enemies). 32x48 px base (64x96 at 32-bit). 16 cols x 53 rows = 848 frames. 5-direction symmetric layout; engine mirrors left->right, diag_ne->diag_nw, diag_sw->diag_se. 7 directed anim types + 4 shared states + 12 emotes + 2 specials. Source: docs/asset-standard.md.',
     'character', 32, 48, 16, 1,
     '["down","up","left","diag_ne","diag_sw"]',
     '{"right":"left","diag_nw":"diag_ne","diag_se":"diag_sw"}',
     64);

INSERT INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
    -- ── IDLE  (rows 0-4, 4 frames each) ────────────────────────────────────────────────────
    ('rh_idle_d',    'tpl_humanoid_std', 'idle_down',     'Idle ↓',        0,   4,  2.0, 1, NULL,          1, NULL,          0),
    ('rh_idle_u',    'tpl_humanoid_std', 'idle_up',       'Idle ↑',        16,  4,  2.0, 1, NULL,          1, NULL,          1),
    ('rh_idle_l',    'tpl_humanoid_std', 'idle_left',     'Idle ←',        32,  4,  2.0, 1, NULL,          1, NULL,          2),
    ('rh_idle_ne',   'tpl_humanoid_std', 'idle_diag_ne',  'Idle ↗',        48,  4,  2.0, 1, NULL,          0, 'idle_down',   3),
    ('rh_idle_sw',   'tpl_humanoid_std', 'idle_diag_sw',  'Idle ↙',        64,  4,  2.0, 1, NULL,          0, 'idle_down',   4),
    -- ── WALK  (rows 5-9, 8 frames each) ────────────────────────────────────────────────────
    ('rh_walk_d',    'tpl_humanoid_std', 'walk_down',     'Walk ↓',        80,  8,  8.0, 1, NULL,          1, NULL,          5),
    ('rh_walk_u',    'tpl_humanoid_std', 'walk_up',       'Walk ↑',        96,  8,  8.0, 1, NULL,          1, NULL,          6),
    ('rh_walk_l',    'tpl_humanoid_std', 'walk_left',     'Walk ←',        112, 8,  8.0, 1, NULL,          1, NULL,          7),
    ('rh_walk_ne',   'tpl_humanoid_std', 'walk_diag_ne',  'Walk ↗',        128, 8,  8.0, 1, NULL,          0, 'walk_down',   8),
    ('rh_walk_sw',   'tpl_humanoid_std', 'walk_diag_sw',  'Walk ↙',        144, 8,  8.0, 1, NULL,          0, 'walk_down',   9),
    -- ── RUN  (rows 10-14, 8 frames each) ───────────────────────────────────────────────────
    ('rh_run_d',     'tpl_humanoid_std', 'run_down',      'Run ↓',         160, 8, 12.0, 1, NULL,          0, 'walk_down',  10),
    ('rh_run_u',     'tpl_humanoid_std', 'run_up',        'Run ↑',         176, 8, 12.0, 1, NULL,          0, 'walk_up',    11),
    ('rh_run_l',     'tpl_humanoid_std', 'run_left',      'Run ←',         192, 8, 12.0, 1, NULL,          0, 'walk_left',  12),
    ('rh_run_ne',    'tpl_humanoid_std', 'run_diag_ne',   'Run ↗',         208, 8, 12.0, 1, NULL,          0, 'walk_diag_ne', 13),
    ('rh_run_sw',    'tpl_humanoid_std', 'run_diag_sw',   'Run ↙',         224, 8, 12.0, 1, NULL,          0, 'walk_diag_sw', 14),
    -- ── SWIM  (rows 15-19, 8 frames each) ──────────────────────────────────────────────────
    ('rh_swim_d',    'tpl_humanoid_std', 'swim_down',     'Swim ↓',        240, 8,  6.0, 1, NULL,          0, 'idle_down',  15),
    ('rh_swim_u',    'tpl_humanoid_std', 'swim_up',       'Swim ↑',        256, 8,  6.0, 1, NULL,          0, 'idle_up',    16),
    ('rh_swim_l',    'tpl_humanoid_std', 'swim_left',     'Swim ←',        272, 8,  6.0, 1, NULL,          0, 'idle_left',  17),
    ('rh_swim_ne',   'tpl_humanoid_std', 'swim_diag_ne',  'Swim ↗',        288, 8,  6.0, 1, NULL,          0, 'swim_down',  18),
    ('rh_swim_sw',   'tpl_humanoid_std', 'swim_diag_sw',  'Swim ↙',        304, 8,  6.0, 1, NULL,          0, 'swim_down',  19),
    -- ── MELEE ATTACK  (rows 20-24, 6 frames each, play-once) ───────────────────────────────
    ('rh_mel_d',     'tpl_humanoid_std', 'melee_down',    'Melee ↓',       320, 6, 12.0, 0, 'idle_down',   0, 'idle_down',  20),
    ('rh_mel_u',     'tpl_humanoid_std', 'melee_up',      'Melee ↑',       336, 6, 12.0, 0, 'idle_up',     0, 'idle_up',    21),
    ('rh_mel_l',     'tpl_humanoid_std', 'melee_left',    'Melee ←',       352, 6, 12.0, 0, 'idle_left',   0, 'idle_left',  22),
    ('rh_mel_ne',    'tpl_humanoid_std', 'melee_diag_ne', 'Melee ↗',       368, 6, 12.0, 0, 'idle_diag_ne',0, 'idle_diag_ne', 23),
    ('rh_mel_sw',    'tpl_humanoid_std', 'melee_diag_sw', 'Melee ↙',       384, 6, 12.0, 0, 'idle_diag_sw',0, 'idle_diag_sw', 24),
    -- ── RANGED ATTACK  (rows 25-29, 6 frames each, play-once) ──────────────────────────────
    ('rh_rng_d',     'tpl_humanoid_std', 'ranged_down',   'Ranged ↓',      400, 6, 10.0, 0, 'idle_down',   0, 'idle_down',  25),
    ('rh_rng_u',     'tpl_humanoid_std', 'ranged_up',     'Ranged ↑',      416, 6, 10.0, 0, 'idle_up',     0, 'idle_up',    26),
    ('rh_rng_l',     'tpl_humanoid_std', 'ranged_left',   'Ranged ←',      432, 6, 10.0, 0, 'idle_left',   0, 'idle_left',  27),
    ('rh_rng_ne',    'tpl_humanoid_std', 'ranged_diag_ne','Ranged ↗',      448, 6, 10.0, 0, 'idle_diag_ne',0, 'idle_diag_ne', 28),
    ('rh_rng_sw',    'tpl_humanoid_std', 'ranged_diag_sw','Ranged ↙',      464, 6, 10.0, 0, 'idle_diag_sw',0, 'idle_diag_sw', 29),
    -- ── CAST / SPELL  (rows 30-34, 8 frames each, play-once) ───────────────────────────────
    ('rh_cast_d',    'tpl_humanoid_std', 'cast_down',     'Cast ↓',        480, 8,  8.0, 0, 'idle_down',   0, 'idle_down',  30),
    ('rh_cast_u',    'tpl_humanoid_std', 'cast_up',       'Cast ↑',        496, 8,  8.0, 0, 'idle_up',     0, 'idle_up',    31),
    ('rh_cast_l',    'tpl_humanoid_std', 'cast_left',     'Cast ←',        512, 8,  8.0, 0, 'idle_left',   0, 'idle_left',  32),
    ('rh_cast_ne',   'tpl_humanoid_std', 'cast_diag_ne',  'Cast ↗',        528, 8,  8.0, 0, 'idle_diag_ne',0, 'idle_diag_ne', 33),
    ('rh_cast_sw',   'tpl_humanoid_std', 'cast_diag_sw',  'Cast ↙',        544, 8,  8.0, 0, 'idle_diag_sw',0, 'idle_diag_sw', 34),
    -- ── SHARED STATES  (non-directional, rows 35-38) ────────────────────────────────────────
    ('rh_death',     'tpl_humanoid_std', 'death',         'Death',         560, 8,  8.0, 0, NULL,          1, NULL,         35),
    ('rh_hurt',      'tpl_humanoid_std', 'hurt',          'Hurt',          576, 4, 12.0, 0, 'idle_down',   0, NULL,         36),
    ('rh_victory',   'tpl_humanoid_std', 'victory',       'Victory',       592, 6,  8.0, 0, 'idle_down',   0, 'idle_down',  37),
    ('rh_sleep',     'tpl_humanoid_std', 'sleep',         'Sleep',         608, 4,  2.0, 1, NULL,          0, 'idle_down',  38),
    -- ── EMOTES  (rows 39-50, play-once → idle_down) ─────────────────────────────────────────
    ('rh_em_wave',   'tpl_humanoid_std', 'emote_wave',    'Emote: Wave',   624, 4,  8.0, 0, NULL,          0, 'idle_down',  39),
    ('rh_em_nod',    'tpl_humanoid_std', 'emote_nod',     'Emote: Nod',    640, 4,  8.0, 0, NULL,          0, 'idle_down',  40),
    ('rh_em_shake',  'tpl_humanoid_std', 'emote_shake',   'Emote: Shake',  656, 4,  8.0, 0, NULL,          0, 'idle_down',  41),
    ('rh_em_cheer',  'tpl_humanoid_std', 'emote_cheer',   'Emote: Cheer',  672, 4,  8.0, 0, NULL,          0, 'idle_down',  42),
    ('rh_em_dance',  'tpl_humanoid_std', 'emote_dance',   'Emote: Dance',  688, 8,  8.0, 0, NULL,          0, 'idle_down',  43),
    ('rh_em_think',  'tpl_humanoid_std', 'emote_think',   'Emote: Think',  704, 4,  6.0, 0, NULL,          0, 'idle_down',  44),
    ('rh_em_drink',  'tpl_humanoid_std', 'emote_drink',   'Emote: Drink',  720, 4,  8.0, 0, NULL,          0, 'idle_down',  45),
    ('rh_em_eat',    'tpl_humanoid_std', 'emote_eat',     'Emote: Eat',    736, 4,  8.0, 0, NULL,          0, 'idle_down',  46),
    ('rh_em_taunt',  'tpl_humanoid_std', 'emote_taunt',   'Emote: Taunt',  752, 4,  8.0, 0, NULL,          0, 'idle_down',  47),
    ('rh_em_laugh',  'tpl_humanoid_std', 'emote_laugh',   'Emote: Laugh',  768, 4,  8.0, 0, NULL,          0, 'idle_down',  48),
    ('rh_em_gesture','tpl_humanoid_std', 'emote_gesture', 'Emote: Gesture',784, 4,  8.0, 0, NULL,          0, 'idle_down',  49),
    ('rh_em_mock',   'tpl_humanoid_std', 'emote_mock',    'Emote: Mock',   800, 4,  8.0, 0, NULL,          0, 'idle_down',  50),
    -- ── SPECIALS  (rows 51-52, 8 frames each) ───────────────────────────────────────────────
    ('rh_sp1',       'tpl_humanoid_std', 'special_1',     'Special 1',     816, 8,  8.0, 0, 'idle_down',   0, 'idle_down',  51),
    ('rh_sp2',       'tpl_humanoid_std', 'special_2',     'Special 2',     832, 8,  8.0, 0, 'idle_down',   0, 'idle_down',  52);

-- ============================================================
--  HUMANOID: BASE  (lightweight NPC sheet — load for every humanoid)
--
--  Frame size (base / 16-bit tier):  32×48 px
--  cols_per_row: 16 · rows: 27 · frames: 432
--
--  Full 8-direction layout. Symmetric characters use direction_mirrors
--  so artists only paint 5 rows per animation set; the engine flips
--  right/diag_nw/diag_se at load time. Asymmetric chars paint all 8.
--
--  direction_mirrors: {"right":"left","diag_nw":"diag_ne","diag_se":"diag_sw"}
--
--  Sheet dimensions:
--    16-bit (1×):   512 × 1296 px  (1 sheet)
--    32-bit (2×):  1024 × 2592 px  (1 sheet — fits in 8192 GPU limit)
--    64-bit (4×):  2048 × 5184 px  (1 sheet — fits in 16384 GPU limit)
--   128-bit (8×):  4096 × 10368 px (split recommended, MAX_TEXTURE_SIZE=16384)
--
--  Row layout  (start_frame = row × 16):
--    Rows  0-7   idle  × 8 dirs  [4f @ 2 fps,  loop]
--    Rows  8-15  walk  × 8 dirs  [8f @ 8 fps,  loop]
--    Rows 16-23  run   × 8 dirs  [8f @ 12 fps, loop]
--    Row  24     death           [8f @ 8 fps,  once]
--    Row  25     hurt            [4f @ 12 fps, once → idle_down]
--    Row  26     sleep           [4f @ 2 fps,  loop]
-- ============================================================

DELETE FROM sprite_template_regions WHERE template_id = 'tpl_humanoid_base';
DELETE FROM sprite_templates           WHERE id        = 'tpl_humanoid_base';

INSERT INTO sprite_templates
    (id, name, description, category, frame_w, frame_h, cols_per_row,
     has_directions, directions, direction_mirrors, rows_per_sheet)
VALUES
    ('tpl_humanoid_base', 'humanoid_base',
     'Lightweight humanoid NPC sheet. 32x48 px base. 16 cols x 27 rows = 432 frames. Covers idle/walk/run/death/hurt/sleep across all 8 directions. Symmetric chars skip painting right/diag_nw/diag_se (mirrored at runtime). Load for every humanoid; pair with humanoid_ext for PCs and combat NPCs.',
     'character', 32, 48, 16, 1,
     '["down","up","left","right","diag_ne","diag_nw","diag_sw","diag_se"]',
     '{"right":"left","diag_nw":"diag_ne","diag_se":"diag_sw"}',
     32);

INSERT INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
    -- ── IDLE  (rows 0-7) ────────────────────────────────────────────────
    ('rb_idle_d',    'tpl_humanoid_base', 'idle_down',     'Idle ↓',     0,   4,  2.0, 1, NULL,          1, NULL,            0),
    ('rb_idle_u',    'tpl_humanoid_base', 'idle_up',       'Idle ↑',     16,  4,  2.0, 1, NULL,          1, NULL,            1),
    ('rb_idle_l',    'tpl_humanoid_base', 'idle_left',     'Idle ←',     32,  4,  2.0, 1, NULL,          1, NULL,            2),
    ('rb_idle_r',    'tpl_humanoid_base', 'idle_right',    'Idle →',     48,  4,  2.0, 1, NULL,          0, 'idle_left',     3),
    ('rb_idle_ne',   'tpl_humanoid_base', 'idle_diag_ne',  'Idle ↗',     64,  4,  2.0, 1, NULL,          0, 'idle_down',     4),
    ('rb_idle_nw',   'tpl_humanoid_base', 'idle_diag_nw',  'Idle ↖',     80,  4,  2.0, 1, NULL,          0, 'idle_diag_ne',  5),
    ('rb_idle_sw',   'tpl_humanoid_base', 'idle_diag_sw',  'Idle ↙',     96,  4,  2.0, 1, NULL,          0, 'idle_down',     6),
    ('rb_idle_se',   'tpl_humanoid_base', 'idle_diag_se',  'Idle ↘',     112, 4,  2.0, 1, NULL,          0, 'idle_diag_sw',  7),
    -- ── WALK  (rows 8-15) ───────────────────────────────────────────────
    ('rb_walk_d',    'tpl_humanoid_base', 'walk_down',     'Walk ↓',     128, 8,  8.0, 1, NULL,          1, NULL,            8),
    ('rb_walk_u',    'tpl_humanoid_base', 'walk_up',       'Walk ↑',     144, 8,  8.0, 1, NULL,          1, NULL,            9),
    ('rb_walk_l',    'tpl_humanoid_base', 'walk_left',     'Walk ←',     160, 8,  8.0, 1, NULL,          1, NULL,           10),
    ('rb_walk_r',    'tpl_humanoid_base', 'walk_right',    'Walk →',     176, 8,  8.0, 1, NULL,          0, 'walk_left',    11),
    ('rb_walk_ne',   'tpl_humanoid_base', 'walk_diag_ne',  'Walk ↗',     192, 8,  8.0, 1, NULL,          0, 'walk_down',    12),
    ('rb_walk_nw',   'tpl_humanoid_base', 'walk_diag_nw',  'Walk ↖',     208, 8,  8.0, 1, NULL,          0, 'walk_diag_ne', 13),
    ('rb_walk_sw',   'tpl_humanoid_base', 'walk_diag_sw',  'Walk ↙',     224, 8,  8.0, 1, NULL,          0, 'walk_down',    14),
    ('rb_walk_se',   'tpl_humanoid_base', 'walk_diag_se',  'Walk ↘',     240, 8,  8.0, 1, NULL,          0, 'walk_diag_sw', 15),
    -- ── RUN  (rows 16-23) ───────────────────────────────────────────────
    ('rb_run_d',     'tpl_humanoid_base', 'run_down',      'Run ↓',      256, 8, 12.0, 1, NULL,          0, 'walk_down',    16),
    ('rb_run_u',     'tpl_humanoid_base', 'run_up',        'Run ↑',      272, 8, 12.0, 1, NULL,          0, 'walk_up',      17),
    ('rb_run_l',     'tpl_humanoid_base', 'run_left',      'Run ←',      288, 8, 12.0, 1, NULL,          0, 'walk_left',    18),
    ('rb_run_r',     'tpl_humanoid_base', 'run_right',     'Run →',      304, 8, 12.0, 1, NULL,          0, 'run_left',     19),
    ('rb_run_ne',    'tpl_humanoid_base', 'run_diag_ne',   'Run ↗',      320, 8, 12.0, 1, NULL,          0, 'walk_diag_ne', 20),
    ('rb_run_nw',    'tpl_humanoid_base', 'run_diag_nw',   'Run ↖',      336, 8, 12.0, 1, NULL,          0, 'run_diag_ne',  21),
    ('rb_run_sw',    'tpl_humanoid_base', 'run_diag_sw',   'Run ↙',      352, 8, 12.0, 1, NULL,          0, 'walk_diag_sw', 22),
    ('rb_run_se',    'tpl_humanoid_base', 'run_diag_se',   'Run ↘',      368, 8, 12.0, 1, NULL,          0, 'run_diag_sw',  23),
    -- ── SHARED STATES  (rows 24-26) ─────────────────────────────────────
    ('rb_death',     'tpl_humanoid_base', 'death',         'Death',      384, 8,  8.0, 0, NULL,          0, NULL,           24),
    ('rb_hurt',      'tpl_humanoid_base', 'hurt',          'Hurt',       400, 4, 12.0, 0, 'idle_down',   0, NULL,           25),
    ('rb_sleep',     'tpl_humanoid_base', 'sleep',         'Sleep',      416, 4,  2.0, 1, NULL,          0, 'idle_down',    26);

-- ============================================================
--  HUMANOID: EXTENDED  (combat + social supplement sheet)
--
--  Frame size (base / 16-bit tier):  32×48 px
--  cols_per_row: 16 · rows: 64 · frames: 1024
--
--  Load on-demand for PCs and any NPC that uses combat or emotes.
--  Engine triggers a lazy texture load when sprite_ext_template_id
--  is set and a combat/emote/swim animation is first requested.
--
--  Full 8-direction layout for all combat animations.
--  direction_mirrors: {"right":"left","diag_nw":"diag_ne","diag_se":"diag_sw"}
--
--  Sheet dimensions:
--    16-bit (1×):   512 × 3072 px  (1 sheet — fits in 4096 limit)
--    32-bit (2×):  1024 × 6144 px  (fits in 8192 limit)
--    64-bit (4×):  2048 × 12288 px (fits in 16384 limit)
--   128-bit (8×):  4096 × 24576 px (exceeds 16384 → split into 2–3 sheets)
--
--  Row layout  (start_frame = row × 16):
--    Rows  0-7   swim    × 8 dirs  [8f @ 6 fps,  loop]
--    Rows  8-15  melee   × 8 dirs  [6f @ 12 fps, once → idle]
--    Rows 16-23  ranged  × 8 dirs  [6f @ 10 fps, once → idle]
--    Rows 24-31  cast    × 8 dirs  [8f @ 8 fps,  once → idle]
--    Row  32     victory            [6f @ 8 fps,  once → idle_down]
--    Rows 33-44  emotes × 12       [4-8f, once]
--    Rows 45-63  specials × 19     [8f @ 8 fps,  once → idle_down]
-- ============================================================

DELETE FROM sprite_template_regions WHERE template_id = 'tpl_humanoid_ext';
DELETE FROM sprite_templates           WHERE id        = 'tpl_humanoid_ext';

INSERT INTO sprite_templates
    (id, name, description, category, frame_w, frame_h, cols_per_row,
     has_directions, directions, direction_mirrors, rows_per_sheet)
VALUES
    ('tpl_humanoid_ext', 'humanoid_ext',
     'Extended humanoid sheet for PCs and combat NPCs. 32x48 px base. 16 cols x 64 rows = 1024 frames. Supplements humanoid_base with swim/melee/ranged/cast (all 8 dirs) + victory + 12 emotes + 19 specials. Set sprite_ext_template_id = tpl_humanoid_ext on characters that need combat or social animations.',
     'character', 32, 48, 16, 1,
     '["down","up","left","right","diag_ne","diag_nw","diag_sw","diag_se"]',
     '{"right":"left","diag_nw":"diag_ne","diag_se":"diag_sw"}',
     32);

INSERT INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
    -- ── SWIM  (rows 0-7) ─────────────────────────────────────────────────
    ('re_swim_d',    'tpl_humanoid_ext', 'swim_down',       'Swim ↓',         0,    8,  6.0, 1, NULL,           0, 'idle_down',     0),
    ('re_swim_u',    'tpl_humanoid_ext', 'swim_up',         'Swim ↑',         16,   8,  6.0, 1, NULL,           0, 'idle_up',       1),
    ('re_swim_l',    'tpl_humanoid_ext', 'swim_left',       'Swim ←',         32,   8,  6.0, 1, NULL,           0, 'idle_left',     2),
    ('re_swim_r',    'tpl_humanoid_ext', 'swim_right',      'Swim →',         48,   8,  6.0, 1, NULL,           0, 'swim_left',     3),
    ('re_swim_ne',   'tpl_humanoid_ext', 'swim_diag_ne',    'Swim ↗',         64,   8,  6.0, 1, NULL,           0, 'swim_down',     4),
    ('re_swim_nw',   'tpl_humanoid_ext', 'swim_diag_nw',    'Swim ↖',         80,   8,  6.0, 1, NULL,           0, 'swim_diag_ne',  5),
    ('re_swim_sw',   'tpl_humanoid_ext', 'swim_diag_sw',    'Swim ↙',         96,   8,  6.0, 1, NULL,           0, 'swim_down',     6),
    ('re_swim_se',   'tpl_humanoid_ext', 'swim_diag_se',    'Swim ↘',         112,  8,  6.0, 1, NULL,           0, 'swim_diag_sw',  7),
    -- ── MELEE  (rows 8-15) ───────────────────────────────────────────────
    ('re_mel_d',     'tpl_humanoid_ext', 'melee_down',      'Melee ↓',        128,  6, 12.0, 0, 'idle_down',    0, 'idle_down',     8),
    ('re_mel_u',     'tpl_humanoid_ext', 'melee_up',        'Melee ↑',        144,  6, 12.0, 0, 'idle_up',      0, 'idle_up',       9),
    ('re_mel_l',     'tpl_humanoid_ext', 'melee_left',      'Melee ←',        160,  6, 12.0, 0, 'idle_left',    0, 'idle_left',    10),
    ('re_mel_r',     'tpl_humanoid_ext', 'melee_right',     'Melee →',        176,  6, 12.0, 0, 'idle_right',   0, 'melee_left',   11),
    ('re_mel_ne',    'tpl_humanoid_ext', 'melee_diag_ne',   'Melee ↗',        192,  6, 12.0, 0, 'idle_diag_ne', 0, 'idle_diag_ne', 12),
    ('re_mel_nw',    'tpl_humanoid_ext', 'melee_diag_nw',   'Melee ↖',        208,  6, 12.0, 0, 'idle_diag_nw', 0, 'melee_diag_ne',13),
    ('re_mel_sw',    'tpl_humanoid_ext', 'melee_diag_sw',   'Melee ↙',        224,  6, 12.0, 0, 'idle_diag_sw', 0, 'idle_diag_sw', 14),
    ('re_mel_se',    'tpl_humanoid_ext', 'melee_diag_se',   'Melee ↘',        240,  6, 12.0, 0, 'idle_diag_se', 0, 'melee_diag_sw',15),
    -- ── RANGED  (rows 16-23) ─────────────────────────────────────────────
    ('re_rng_d',     'tpl_humanoid_ext', 'ranged_down',     'Ranged ↓',       256,  6, 10.0, 0, 'idle_down',    0, 'idle_down',    16),
    ('re_rng_u',     'tpl_humanoid_ext', 'ranged_up',       'Ranged ↑',       272,  6, 10.0, 0, 'idle_up',      0, 'idle_up',      17),
    ('re_rng_l',     'tpl_humanoid_ext', 'ranged_left',     'Ranged ←',       288,  6, 10.0, 0, 'idle_left',    0, 'idle_left',    18),
    ('re_rng_r',     'tpl_humanoid_ext', 'ranged_right',    'Ranged →',       304,  6, 10.0, 0, 'idle_right',   0, 'ranged_left',  19),
    ('re_rng_ne',    'tpl_humanoid_ext', 'ranged_diag_ne',  'Ranged ↗',       320,  6, 10.0, 0, 'idle_diag_ne', 0, 'idle_diag_ne', 20),
    ('re_rng_nw',    'tpl_humanoid_ext', 'ranged_diag_nw',  'Ranged ↖',       336,  6, 10.0, 0, 'idle_diag_nw', 0, 'ranged_diag_ne',21),
    ('re_rng_sw',    'tpl_humanoid_ext', 'ranged_diag_sw',  'Ranged ↙',       352,  6, 10.0, 0, 'idle_diag_sw', 0, 'idle_diag_sw', 22),
    ('re_rng_se',    'tpl_humanoid_ext', 'ranged_diag_se',  'Ranged ↘',       368,  6, 10.0, 0, 'idle_diag_se', 0, 'ranged_diag_sw',23),
    -- ── CAST  (rows 24-31) ───────────────────────────────────────────────
    ('re_cast_d',    'tpl_humanoid_ext', 'cast_down',       'Cast ↓',         384,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    24),
    ('re_cast_u',    'tpl_humanoid_ext', 'cast_up',         'Cast ↑',         400,  8,  8.0, 0, 'idle_up',      0, 'idle_up',      25),
    ('re_cast_l',    'tpl_humanoid_ext', 'cast_left',       'Cast ←',         416,  8,  8.0, 0, 'idle_left',    0, 'idle_left',    26),
    ('re_cast_r',    'tpl_humanoid_ext', 'cast_right',      'Cast →',         432,  8,  8.0, 0, 'idle_right',   0, 'cast_left',    27),
    ('re_cast_ne',   'tpl_humanoid_ext', 'cast_diag_ne',    'Cast ↗',         448,  8,  8.0, 0, 'idle_diag_ne', 0, 'idle_diag_ne', 28),
    ('re_cast_nw',   'tpl_humanoid_ext', 'cast_diag_nw',    'Cast ↖',         464,  8,  8.0, 0, 'idle_diag_nw', 0, 'cast_diag_ne', 29),
    ('re_cast_sw',   'tpl_humanoid_ext', 'cast_diag_sw',    'Cast ↙',         480,  8,  8.0, 0, 'idle_diag_sw', 0, 'idle_diag_sw', 30),
    ('re_cast_se',   'tpl_humanoid_ext', 'cast_diag_se',    'Cast ↘',         496,  8,  8.0, 0, 'idle_diag_se', 0, 'cast_diag_sw', 31),
    -- ── NON-DIRECTIONAL  (row 32) ────────────────────────────────────────
    ('re_victory',   'tpl_humanoid_ext', 'victory',         'Victory',        512,  6,  8.0, 0, 'idle_down',    0, 'idle_down',    32),
    -- ── EMOTES  (rows 33-44) ─────────────────────────────────────────────
    ('re_em_wave',   'tpl_humanoid_ext', 'emote_wave',      'Emote: Wave',    528,  4,  8.0, 0, NULL,           0, 'idle_down',    33),
    ('re_em_nod',    'tpl_humanoid_ext', 'emote_nod',       'Emote: Nod',     544,  4,  8.0, 0, NULL,           0, 'idle_down',    34),
    ('re_em_shake',  'tpl_humanoid_ext', 'emote_shake',     'Emote: Shake',   560,  4,  8.0, 0, NULL,           0, 'idle_down',    35),
    ('re_em_cheer',  'tpl_humanoid_ext', 'emote_cheer',     'Emote: Cheer',   576,  4,  8.0, 0, NULL,           0, 'idle_down',    36),
    ('re_em_dance',  'tpl_humanoid_ext', 'emote_dance',     'Emote: Dance',   592,  8,  8.0, 0, NULL,           0, 'idle_down',    37),
    ('re_em_think',  'tpl_humanoid_ext', 'emote_think',     'Emote: Think',   608,  4,  6.0, 0, NULL,           0, 'idle_down',    38),
    ('re_em_drink',  'tpl_humanoid_ext', 'emote_drink',     'Emote: Drink',   624,  4,  8.0, 0, NULL,           0, 'idle_down',    39),
    ('re_em_eat',    'tpl_humanoid_ext', 'emote_eat',       'Emote: Eat',     640,  4,  8.0, 0, NULL,           0, 'idle_down',    40),
    ('re_em_taunt',  'tpl_humanoid_ext', 'emote_taunt',     'Emote: Taunt',   656,  4,  8.0, 0, NULL,           0, 'idle_down',    41),
    ('re_em_laugh',  'tpl_humanoid_ext', 'emote_laugh',     'Emote: Laugh',   672,  4,  8.0, 0, NULL,           0, 'idle_down',    42),
    ('re_em_gesture','tpl_humanoid_ext', 'emote_gesture',   'Emote: Gesture', 688,  4,  8.0, 0, NULL,           0, 'idle_down',    43),
    ('re_em_mock',   'tpl_humanoid_ext', 'emote_mock',      'Emote: Mock',    704,  4,  8.0, 0, NULL,           0, 'idle_down',    44),
    -- ── SPECIALS  (rows 45-63) ───────────────────────────────────────────
    ('re_sp1',       'tpl_humanoid_ext', 'special_1',       'Special 1',      720,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    45),
    ('re_sp2',       'tpl_humanoid_ext', 'special_2',       'Special 2',      736,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    46),
    ('re_sp3',       'tpl_humanoid_ext', 'special_3',       'Special 3',      752,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    47),
    ('re_sp4',       'tpl_humanoid_ext', 'special_4',       'Special 4',      768,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    48),
    ('re_sp5',       'tpl_humanoid_ext', 'special_5',       'Special 5',      784,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    49),
    ('re_sp6',       'tpl_humanoid_ext', 'special_6',       'Special 6',      800,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    50),
    ('re_sp7',       'tpl_humanoid_ext', 'special_7',       'Special 7',      816,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    51),
    ('re_sp8',       'tpl_humanoid_ext', 'special_8',       'Special 8',      832,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    52),
    ('re_sp9',       'tpl_humanoid_ext', 'special_9',       'Special 9',      848,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    53),
    ('re_sp10',      'tpl_humanoid_ext', 'special_10',      'Special 10',     864,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    54),
    ('re_sp11',      'tpl_humanoid_ext', 'special_11',      'Special 11',     880,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    55),
    ('re_sp12',      'tpl_humanoid_ext', 'special_12',      'Special 12',     896,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    56),
    ('re_sp13',      'tpl_humanoid_ext', 'special_13',      'Special 13',     912,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    57),
    ('re_sp14',      'tpl_humanoid_ext', 'special_14',      'Special 14',     928,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    58),
    ('re_sp15',      'tpl_humanoid_ext', 'special_15',      'Special 15',     944,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    59),
    ('re_sp16',      'tpl_humanoid_ext', 'special_16',      'Special 16',     960,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    60),
    ('re_sp17',      'tpl_humanoid_ext', 'special_17',      'Special 17',     976,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    61),
    ('re_sp18',      'tpl_humanoid_ext', 'special_18',      'Special 18',     992,  8,  8.0, 0, 'idle_down',    0, 'idle_down',    62),
    ('re_sp19',      'tpl_humanoid_ext', 'special_19',      'Special 19',     1008, 8,  8.0, 0, 'idle_down',    0, 'idle_down',    63);

-- ============================================================
--  BIOME TERRAIN TILESETS
--
--  Architecture: 8 cols × 16 rows = 128 frames per biome.
--  The layout is SEMANTIC — each row has the same PURPOSE across all biomes.
--  The art changes per biome; the row/slot meaning stays constant so
--  TerrainGenerator can address tiles by (row, variant) regardless of biome.
--
--  STATIC ROWS 0–7  (frames 0–63):
--    Row 0 [ 0– 7]  PRIMARY GROUND     — e.g. grass×6 + highland + dry
--    Row 1 [ 8–15]  SECONDARY GROUND   — e.g. dirt×3, gravel×2, mud, sand, spare
--    Row 2 [16–23]  ROCK / STONE       — e.g. stone×2, mossy, rock_sm, rock_lg, cliff, boulder, peak
--    Row 3 [24–31]  WATER + EDGES      — shores, beach, water statics, waterfall static, spare
--    Row 4 [32–39]  PATHS + BRIDGE     — path_dirt(H+V), path_stone(H+V), road_h, road_v, corner, bridge
--    Row 5 [40–47]  FLORA              — flowers×2, tall_grass, reeds, lilypad, shrub×2, fern
--    Row 6 [48–55]  OBJECTS / DECOR    — rock_obj, stump, log, hay_bale, fence_h, fence_v, sign, crate
--    Row 7 [56–63]  STRUCTURES         — tree_sm, tree_lg, bush, ruin_floor, ruin_wall, door, bldg_wall, chest
--
--  ANIMATED ROWS 8–15  (frames 64–127):
--    2 animations per row, 4 frames each  →  16 animation slots per biome.
--    Biomes fill slots with their thematic animations; spare slots stay blank.
--    Row 8  [ 64– 71]  Anim 0: primary water / Anim 1: secondary water
--    Row 9  [ 72– 79]  Anim 2: waterfall   / Anim 3: stream/river
--    Row 10 [ 80– 87]  Anim 4: wind/foliage / Anim 5: ground effect (dust, sand)
--    Row 11 [ 88– 95]  Anim 6: torch/fire   / Anim 7: magic/portal
--    Row 12 [ 96–103]  Anim 8–9:  biome-specific A (aurora, miasma, shimmer…)
--    Row 13 [104–111]  Anim 10–11: biome-specific B
--    Row 14 [112–119]  Anim 12–13: biome-specific C
--    Row 15 [120–127]  Anim 14–15: biome-specific D / spare
--
--  Engine tile ID = frame index.
--  getTile(id) → col = id % 8,  row = Math.floor(id / 8)
--  Scale: 1×=16-bit (16px), 2×=32-bit, 4×=64-bit, 8×=128-bit
--
--  Sprite-builder sort_order bands (UI display order):
--    0– 9  → 💧 Animated       20–29 → Secondary Ground
--    10–19 → Primary Ground     30–39 → Rock / Stone
--    40–49 → Water + Edges      50–59 → Paths
--    60–69 → Flora              70–79 → Objects
--    80–89 → Structures
-- ============================================================

-- Remove legacy flat tileset and any existing biome templates so the
-- INSERT OR IGNORE below picks up fresh rows on a schema reset.
DELETE FROM sprite_template_regions WHERE template_id IN
    ('tpl_tileset_std','tpl_ts_grassland','tpl_ts_tundra',
     'tpl_ts_desert','tpl_ts_forest','tpl_ts_swamp','tpl_ts_volcanic',
     'tpl_ts_custom');
DELETE FROM sprite_templates WHERE id IN
    ('tpl_tileset_std','tpl_ts_grassland','tpl_ts_tundra',
     'tpl_ts_desert','tpl_ts_forest','tpl_ts_swamp','tpl_ts_volcanic',
     'tpl_ts_custom');

INSERT OR IGNORE INTO sprite_templates
    (id, name, description, category, frame_w, frame_h, cols_per_row,
     has_directions, directions, direction_mirrors, rows_per_sheet)
VALUES
-- ── Grassland ───────────────────────────────────────────────────────────────
    ('tpl_ts_grassland', 'Grassland',
     'Temperate grassland biome. Rows 0-7: grass/dirt/rock/water/paths/flora/objects/structures. Rows 8-15: animated water, waterfall, wind-grass, dust, torch, magic + 8 spare slots.',
     'tileset', 16, 16, 8, 0, '[]', '{}', 16),
-- ── Tundra ──────────────────────────────────────────────────────────────────
    ('tpl_ts_tundra', 'Tundra / Frozen',
     'Cold / frozen biome. Same semantic row layout as Grassland but filled with snow, ice and frost variants. Water is frozen; flora is sparse arctic vegetation.',
     'tileset', 16, 16, 8, 0, '[]', '{}', 16),
-- ── Desert ──────────────────────────────────────────────────────────────────
    ('tpl_ts_desert', 'Desert / Arid',
     'Hot arid biome. Sand/dune variants in ground rows; oasis edges for water; cacti and tumbleweed for flora; heat shimmer and sandstorm animations.',
     'tileset', 16, 16, 8, 0, '[]', '{}', 16),
-- ── Forest ──────────────────────────────────────────────────────────────────
    ('tpl_ts_forest', 'Forest / Woodland',
     'Dense forest biome. Moss/undergrowth ground; forest stream water; ferns, mushrooms and canopy flora; firefly and spore-cloud animations.',
     'tileset', 16, 16, 8, 0, '[]', '{}', 16),
-- ── Swamp ───────────────────────────────────────────────────────────────────
    ('tpl_ts_swamp', 'Swamp / Bog',
     'Murky swamp biome. Peat/mud ground variants; algae-covered murky water; reeds, cattails and water-lilies; will-o-wisp and bog-bubble animations.',
     'tileset', 16, 16, 8, 0, '[]', '{}', 16),
-- ── Volcanic ────────────────────────────────────────────────────────────────
    ('tpl_ts_volcanic', 'Volcanic / Lava',
     'Volcanic / hellscape biome. Obsidian and ash ground; lava edges and pools; fire, ember and steam-vent animations. Chain Anim 6+7 for epic lava cascade.',
     'tileset', 16, 16, 8, 0, '[]', '{}', 16),
-- ── Custom / Generic ─────────────────────────────────────────────────────────
    ('tpl_ts_custom', 'Custom / Generic',
     'Blank-slate template for any theme (steampunk, sci-fi, fantasy, etc.). Eight generic static rows: Primary, Secondary, Tertiary, Liquid, Path, Detail, Object, Structure — each with 8 individually-labelled tiles. Plus 10 animation strip slots (Loop A-D, FX A-D, Spare 0-1).',
     'tileset', 16, 16, 8, 0, '[]', '{}', 16);

-- ============================================================
--  GRASSLAND REGIONS
-- ============================================================
INSERT OR IGNORE INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
-- ── ANIMATED (rows 8-15, shown first in UI) ─────────────────────────────────
--   Anim 0-1 · Row 8 [64-71]
    ('gl_a0', 'tpl_ts_grassland', 'water_deep_anim',    '💧 Deep Water',          64, 4, 8.0, 1, NULL, 1, NULL,  0),
    ('gl_a1', 'tpl_ts_grassland', 'water_shallow_anim', '💧 Shallow Water',       68, 4, 8.0, 1, NULL, 1, NULL,  1),
--   Anim 2-3 · Row 9 [72-79]
    ('gl_a2', 'tpl_ts_grassland', 'waterfall_anim',     '💧 Waterfall',           72, 4, 8.0, 1, NULL, 0, NULL,  2),
    ('gl_a3', 'tpl_ts_grassland', 'stream_anim',        '💧 Stream',              76, 4, 8.0, 1, NULL, 0, NULL,  3),
--   Anim 4-5 · Row 10 [80-87]
    ('gl_a4', 'tpl_ts_grassland', 'wind_grass_anim',    '🌿 Wind Grass',          80, 4, 6.0, 1, NULL, 0, NULL,  4),
    ('gl_a5', 'tpl_ts_grassland', 'dust_path_anim',     '🌿 Dust on Path',        84, 4, 5.0, 1, NULL, 0, NULL,  5),
--   Anim 6-7 · Row 11 [88-95]
    ('gl_a6', 'tpl_ts_grassland', 'torch_anim',         '🔥 Torch / Campfire',    88, 4,12.0, 1, NULL, 0, NULL,  6),
    ('gl_a7', 'tpl_ts_grassland', 'magic_anim',         '✨ Magic Portal',         92, 4,12.0, 1, NULL, 0, NULL,  7),
--   Anim 8-15 · Rows 12-15 (spare, biome-specific extras)
    ('gl_a8', 'tpl_ts_grassland', 'spare_anim_0',       '⬜ Spare Anim A',         96, 4, 8.0, 1, NULL, 0, NULL,  8),
    ('gl_a9', 'tpl_ts_grassland', 'spare_anim_1',       '⬜ Spare Anim B',        100, 4, 8.0, 1, NULL, 0, NULL,  9),

-- ── PRIMARY GROUND · Row 0 [0-7] ────────────────────────────────────────────
    ('gl_g0', 'tpl_ts_grassland', 'grass_base',         'Grass',                   0, 1, 1.0, 0, NULL, 1, NULL, 10),
    ('gl_g1', 'tpl_ts_grassland', 'grass_lush',         'Grass (Lush)',             1, 1, 1.0, 0, NULL, 0, NULL, 11),
    ('gl_g2', 'tpl_ts_grassland', 'grass_pale',         'Grass (Pale)',             2, 1, 1.0, 0, NULL, 0, NULL, 12),
    ('gl_g3', 'tpl_ts_grassland', 'grass_wild',         'Grass (Wild / Tall)',      3, 1, 1.0, 0, NULL, 0, NULL, 13),
    ('gl_g4', 'tpl_ts_grassland', 'grass_flower',       'Grass with Flowers',       4, 1, 1.0, 0, NULL, 0, NULL, 14),
    ('gl_g5', 'tpl_ts_grassland', 'grass_sparse',       'Grass (Sparse)',           5, 1, 1.0, 0, NULL, 0, NULL, 15),
    ('gl_g6', 'tpl_ts_grassland', 'grass_highland',     'Grass (Highland)',         6, 1, 1.0, 0, NULL, 0, NULL, 16),
    ('gl_g7', 'tpl_ts_grassland', 'grass_dry',          'Grass (Dry)',              7, 1, 1.0, 0, NULL, 0, NULL, 17),

-- ── SECONDARY GROUND · Row 1 [8-15] ─────────────────────────────────────────
    ('gl_s0', 'tpl_ts_grassland', 'dirt_packed',        'Dirt (Packed)',            8, 1, 1.0, 0, NULL, 1, NULL, 20),
    ('gl_s1', 'tpl_ts_grassland', 'dirt_loose',         'Dirt (Loose)',             9, 1, 1.0, 0, NULL, 0, NULL, 21),
    ('gl_s2', 'tpl_ts_grassland', 'dirt_cracked',       'Dirt (Cracked)',          10, 1, 1.0, 0, NULL, 0, NULL, 22),
    ('gl_s3', 'tpl_ts_grassland', 'gravel_fine',        'Gravel (Fine)',           11, 1, 1.0, 0, NULL, 0, NULL, 23),
    ('gl_s4', 'tpl_ts_grassland', 'gravel_coarse',      'Gravel (Coarse)',         12, 1, 1.0, 0, NULL, 0, NULL, 24),
    ('gl_s5', 'tpl_ts_grassland', 'mud',                'Mud',                     13, 1, 1.0, 0, NULL, 0, NULL, 25),
    ('gl_s6', 'tpl_ts_grassland', 'sand',               'Sand',                    14, 1, 1.0, 0, NULL, 0, NULL, 26),
    ('gl_s7', 'tpl_ts_grassland', 'frozen_patch',       'Frozen Patch',            15, 1, 1.0, 0, NULL, 0, NULL, 27),

-- ── ROCK / STONE · Row 2 [16-23] ─────────────────────────────────────────────
    ('gl_r0', 'tpl_ts_grassland', 'stone_smooth',       'Stone (Smooth)',          16, 1, 1.0, 0, NULL, 0, NULL, 30),
    ('gl_r1', 'tpl_ts_grassland', 'stone_rough',        'Stone (Rough)',           17, 1, 1.0, 0, NULL, 0, NULL, 31),
    ('gl_r2', 'tpl_ts_grassland', 'stone_mossy',        'Stone (Mossy)',           18, 1, 1.0, 0, NULL, 0, NULL, 32),
    ('gl_r3', 'tpl_ts_grassland', 'rock_small',         'Rock (Small)',            19, 1, 1.0, 0, NULL, 0, NULL, 33),
    ('gl_r4', 'tpl_ts_grassland', 'rock_large',         'Rock (Large)',            20, 1, 1.0, 0, NULL, 0, NULL, 34),
    ('gl_r5', 'tpl_ts_grassland', 'cliff_face',         'Cliff Face',             21, 1, 1.0, 0, NULL, 0, NULL, 35),
    ('gl_r6', 'tpl_ts_grassland', 'boulder',            'Boulder',                22, 1, 1.0, 0, NULL, 0, NULL, 36),
    ('gl_r7', 'tpl_ts_grassland', 'mountain_peak',      'Mountain Peak',          23, 1, 1.0, 0, NULL, 0, NULL, 37),

-- ── WATER + EDGES · Row 3 [24-31] ────────────────────────────────────────────
    ('gl_w0', 'tpl_ts_grassland', 'shore_sand',         'Shore (Sandy)',           24, 1, 1.0, 0, NULL, 0, NULL, 40),
    ('gl_w1', 'tpl_ts_grassland', 'shore_wet',          'Shore (Wet)',             25, 1, 1.0, 0, NULL, 0, NULL, 41),
    ('gl_w2', 'tpl_ts_grassland', 'water_edge',         'Water Edge',             26, 1, 1.0, 0, NULL, 0, NULL, 42),
    ('gl_w3', 'tpl_ts_grassland', 'beach',              'Beach',                  27, 1, 1.0, 0, NULL, 0, NULL, 43),
    ('gl_w4', 'tpl_ts_grassland', 'deep_water_static',  'Deep Water (static)',    28, 1, 1.0, 0, NULL, 0, NULL, 44),
    ('gl_w5', 'tpl_ts_grassland', 'shallow_water_static','Shallow Water (static)',29, 1, 1.0, 0, NULL, 0, NULL, 45),
    ('gl_w6', 'tpl_ts_grassland', 'waterfall_static',   'Waterfall (static)',     30, 1, 1.0, 0, NULL, 0, NULL, 46),
    ('gl_w7', 'tpl_ts_grassland', 'water_spare',        'Water (Spare)',          31, 1, 1.0, 0, NULL, 0, NULL, 47),

-- ── PATHS + BRIDGE · Row 4 [32-39] ───────────────────────────────────────────
    ('gl_p0', 'tpl_ts_grassland', 'path_dirt_h',        'Dirt Path (H)',          32, 1, 1.0, 0, NULL, 0, NULL, 50),
    ('gl_p1', 'tpl_ts_grassland', 'path_dirt_v',        'Dirt Path (V)',          33, 1, 1.0, 0, NULL, 0, NULL, 51),
    ('gl_p2', 'tpl_ts_grassland', 'path_stone_h',       'Stone Path (H)',         34, 1, 1.0, 0, NULL, 0, NULL, 52),
    ('gl_p3', 'tpl_ts_grassland', 'path_stone_v',       'Stone Path (V)',         35, 1, 1.0, 0, NULL, 0, NULL, 53),
    ('gl_p4', 'tpl_ts_grassland', 'road_h',             'Road (H)',               36, 1, 1.0, 0, NULL, 0, NULL, 54),
    ('gl_p5', 'tpl_ts_grassland', 'road_v',             'Road (V)',               37, 1, 1.0, 0, NULL, 0, NULL, 55),
    ('gl_p6', 'tpl_ts_grassland', 'road_corner',        'Road (Corner)',          38, 1, 1.0, 0, NULL, 0, NULL, 56),
    ('gl_p7', 'tpl_ts_grassland', 'bridge',             'Bridge',                 39, 1, 1.0, 0, NULL, 0, NULL, 57),

-- ── FLORA · Row 5 [40-47] ────────────────────────────────────────────────────
    ('gl_f0', 'tpl_ts_grassland', 'flower_red',         'Flowers (Red)',          40, 1, 1.0, 0, NULL, 0, NULL, 60),
    ('gl_f1', 'tpl_ts_grassland', 'flower_yellow',      'Flowers (Yellow)',       41, 1, 1.0, 0, NULL, 0, NULL, 61),
    ('gl_f2', 'tpl_ts_grassland', 'tall_grass',         'Tall Grass',             42, 1, 1.0, 0, NULL, 0, NULL, 62),
    ('gl_f3', 'tpl_ts_grassland', 'reeds',              'Reeds',                  43, 1, 1.0, 0, NULL, 0, NULL, 63),
    ('gl_f4', 'tpl_ts_grassland', 'lilypad',            'Lily Pad',               44, 1, 1.0, 0, NULL, 0, NULL, 64),
    ('gl_f5', 'tpl_ts_grassland', 'shrub_small',        'Shrub (Small)',          45, 1, 1.0, 0, NULL, 0, NULL, 65),
    ('gl_f6', 'tpl_ts_grassland', 'shrub_large',        'Shrub (Large)',          46, 1, 1.0, 0, NULL, 0, NULL, 66),
    ('gl_f7', 'tpl_ts_grassland', 'fern',               'Fern',                   47, 1, 1.0, 0, NULL, 0, NULL, 67),

-- ── OBJECTS / DECOR · Row 6 [48-55] ──────────────────────────────────────────
    ('gl_o0', 'tpl_ts_grassland', 'rock_obj',           'Rock (Object)',          48, 1, 1.0, 0, NULL, 0, NULL, 70),
    ('gl_o1', 'tpl_ts_grassland', 'stump',              'Tree Stump',             49, 1, 1.0, 0, NULL, 0, NULL, 71),
    ('gl_o2', 'tpl_ts_grassland', 'log',                'Fallen Log',             50, 1, 1.0, 0, NULL, 0, NULL, 72),
    ('gl_o3', 'tpl_ts_grassland', 'hay_bale',           'Hay Bale',               51, 1, 1.0, 0, NULL, 0, NULL, 73),
    ('gl_o4', 'tpl_ts_grassland', 'fence_h',            'Fence (H)',              52, 1, 1.0, 0, NULL, 0, NULL, 74),
    ('gl_o5', 'tpl_ts_grassland', 'fence_v',            'Fence (V)',              53, 1, 1.0, 0, NULL, 0, NULL, 75),
    ('gl_o6', 'tpl_ts_grassland', 'signpost',           'Signpost',               54, 1, 1.0, 0, NULL, 0, NULL, 76),
    ('gl_o7', 'tpl_ts_grassland', 'crate',              'Crate',                  55, 1, 1.0, 0, NULL, 0, NULL, 77),

-- ── STRUCTURES · Row 7 [56-63] ───────────────────────────────────────────────
    ('gl_st0','tpl_ts_grassland', 'tree_small',         'Tree (Small)',           56, 1, 1.0, 0, NULL, 0, NULL, 80),
    ('gl_st1','tpl_ts_grassland', 'tree_large',         'Tree (Large)',           57, 1, 1.0, 0, NULL, 0, NULL, 81),
    ('gl_st2','tpl_ts_grassland', 'bush',               'Bush',                   58, 1, 1.0, 0, NULL, 0, NULL, 82),
    ('gl_st3','tpl_ts_grassland', 'ruin_floor',         'Ruin Floor',             59, 1, 1.0, 0, NULL, 0, NULL, 83),
    ('gl_st4','tpl_ts_grassland', 'ruin_wall',          'Ruin Wall',              60, 1, 1.0, 0, NULL, 0, NULL, 84),
    ('gl_st5','tpl_ts_grassland', 'door',               'Door',                   61, 1, 1.0, 0, NULL, 0, NULL, 85),
    ('gl_st6','tpl_ts_grassland', 'building_wall',      'Building Wall',          62, 1, 1.0, 0, NULL, 0, NULL, 86),
    ('gl_st7','tpl_ts_grassland', 'chest',              'Chest',                  63, 1, 1.0, 0, NULL, 0, NULL, 87);

-- ============================================================
--  TUNDRA REGIONS
-- ============================================================
INSERT OR IGNORE INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
-- ── ANIMATED ─────────────────────────────────────────────────────────────────
    ('tn_a0', 'tpl_ts_tundra', 'frozen_water_anim',  '❄️ Frozen Water',          64, 4, 6.0, 1, NULL, 1, NULL,  0),
    ('tn_a1', 'tpl_ts_tundra', 'icy_shallow_anim',   '❄️ Icy Shallow',           68, 4, 5.0, 1, NULL, 1, NULL,  1),
    ('tn_a2', 'tpl_ts_tundra', 'blizzard_anim',      '❄️ Blizzard',              72, 4, 8.0, 1, NULL, 0, NULL,  2),
    ('tn_a3', 'tpl_ts_tundra', 'icicle_drip_anim',   '❄️ Icicle Drip',           76, 4, 6.0, 1, NULL, 0, NULL,  3),
    ('tn_a4', 'tpl_ts_tundra', 'snowfall_anim',      '❄️ Snowfall',              80, 4, 6.0, 1, NULL, 0, NULL,  4),
    ('tn_a5', 'tpl_ts_tundra', 'aurora_anim',        '❄️ Aurora',                84, 4, 3.0, 1, NULL, 0, NULL,  5),
    ('tn_a6', 'tpl_ts_tundra', 'torch_anim',         '🔥 Torch / Campfire',      88, 4,12.0, 1, NULL, 0, NULL,  6),
    ('tn_a7', 'tpl_ts_tundra', 'magic_anim',         '✨ Magic Portal',           92, 4,12.0, 1, NULL, 0, NULL,  7),
    ('tn_a8', 'tpl_ts_tundra', 'frost_crackle_anim', '❄️ Frost Crackle',         96, 4, 8.0, 1, NULL, 0, NULL,  8),
    ('tn_a9', 'tpl_ts_tundra', 'ice_shimmer_anim',   '❄️ Ice Shimmer',          100, 4, 8.0, 1, NULL, 0, NULL,  9),
-- ── PRIMARY GROUND (Snow variants) · Row 0 ────────────────────────────────────
    ('tn_g0', 'tpl_ts_tundra', 'snow_packed',        'Snow (Packed)',             0, 1, 1.0, 0, NULL, 1, NULL, 10),
    ('tn_g1', 'tpl_ts_tundra', 'snow_fresh',         'Snow (Fresh)',              1, 1, 1.0, 0, NULL, 0, NULL, 11),
    ('tn_g2', 'tpl_ts_tundra', 'snow_deep',          'Snow (Deep)',               2, 1, 1.0, 0, NULL, 0, NULL, 12),
    ('tn_g3', 'tpl_ts_tundra', 'snow_windswept',     'Snow (Windswept)',          3, 1, 1.0, 0, NULL, 0, NULL, 13),
    ('tn_g4', 'tpl_ts_tundra', 'snow_sparse',        'Snow (Sparse)',             4, 1, 1.0, 0, NULL, 0, NULL, 14),
    ('tn_g5', 'tpl_ts_tundra', 'frost_ground',       'Frost Ground',              5, 1, 1.0, 0, NULL, 0, NULL, 15),
    ('tn_g6', 'tpl_ts_tundra', 'frost_light',        'Frost (Light)',             6, 1, 1.0, 0, NULL, 0, NULL, 16),
    ('tn_g7', 'tpl_ts_tundra', 'snow_transition',    'Snow (Transition)',         7, 1, 1.0, 0, NULL, 0, NULL, 17),
-- ── SECONDARY GROUND (Ice / frozen dirt) · Row 1 ──────────────────────────────
    ('tn_s0', 'tpl_ts_tundra', 'ice_smooth',         'Ice (Smooth)',              8, 1, 1.0, 0, NULL, 1, NULL, 20),
    ('tn_s1', 'tpl_ts_tundra', 'ice_cracked',        'Ice (Cracked)',             9, 1, 1.0, 0, NULL, 0, NULL, 21),
    ('tn_s2', 'tpl_ts_tundra', 'ice_thin',           'Ice (Thin)',               10, 1, 1.0, 0, NULL, 0, NULL, 22),
    ('tn_s3', 'tpl_ts_tundra', 'permafrost',         'Permafrost',               11, 1, 1.0, 0, NULL, 0, NULL, 23),
    ('tn_s4', 'tpl_ts_tundra', 'permafrost_thaw',    'Permafrost (Thawing)',      12, 1, 1.0, 0, NULL, 0, NULL, 24),
    ('tn_s5', 'tpl_ts_tundra', 'frozen_dirt',        'Frozen Dirt',              13, 1, 1.0, 0, NULL, 0, NULL, 25),
    ('tn_s6', 'tpl_ts_tundra', 'slush',              'Slush',                    14, 1, 1.0, 0, NULL, 0, NULL, 26),
    ('tn_s7', 'tpl_ts_tundra', 'frozen_mud',         'Frozen Mud',               15, 1, 1.0, 0, NULL, 0, NULL, 27),
-- ── ROCK / STONE (Icy rocks) · Row 2 ──────────────────────────────────────────
    ('tn_r0', 'tpl_ts_tundra', 'stone_icy',          'Stone (Icy)',              16, 1, 1.0, 0, NULL, 0, NULL, 30),
    ('tn_r1', 'tpl_ts_tundra', 'stone_frost',        'Stone (Frost-covered)',    17, 1, 1.0, 0, NULL, 0, NULL, 31),
    ('tn_r2', 'tpl_ts_tundra', 'rock_frozen',        'Rock (Frozen)',            18, 1, 1.0, 0, NULL, 0, NULL, 32),
    ('tn_r3', 'tpl_ts_tundra', 'rock_icy',           'Rock (Icy)',               19, 1, 1.0, 0, NULL, 0, NULL, 33),
    ('tn_r4', 'tpl_ts_tundra', 'cliff_ice',          'Cliff (Ice-covered)',      20, 1, 1.0, 0, NULL, 0, NULL, 34),
    ('tn_r5', 'tpl_ts_tundra', 'cliff_bare',         'Cliff (Bare Rock)',        21, 1, 1.0, 0, NULL, 0, NULL, 35),
    ('tn_r6', 'tpl_ts_tundra', 'ice_boulder',        'Ice Boulder',              22, 1, 1.0, 0, NULL, 0, NULL, 36),
    ('tn_r7', 'tpl_ts_tundra', 'peak_icy',           'Mountain Peak (Icy)',      23, 1, 1.0, 0, NULL, 0, NULL, 37),
-- ── WATER + EDGES · Row 3 ─────────────────────────────────────────────────────
    ('tn_w0', 'tpl_ts_tundra', 'snow_shore',         'Shore (Snow)',             24, 1, 1.0, 0, NULL, 0, NULL, 40),
    ('tn_w1', 'tpl_ts_tundra', 'ice_edge',           'Ice Edge',                25, 1, 1.0, 0, NULL, 0, NULL, 41),
    ('tn_w2', 'tpl_ts_tundra', 'frozen_shore',       'Frozen Shore',            26, 1, 1.0, 0, NULL, 0, NULL, 42),
    ('tn_w3', 'tpl_ts_tundra', 'ice_beach',          'Ice Beach',               27, 1, 1.0, 0, NULL, 0, NULL, 43),
    ('tn_w4', 'tpl_ts_tundra', 'frozen_deep_static', 'Frozen Deep (static)',    28, 1, 1.0, 0, NULL, 0, NULL, 44),
    ('tn_w5', 'tpl_ts_tundra', 'frozen_shallow_static','Frozen Shallow (static)',29, 1, 1.0, 0, NULL, 0, NULL, 45),
    ('tn_w6', 'tpl_ts_tundra', 'frozen_fall_static', 'Frozen Fall (static)',    30, 1, 1.0, 0, NULL, 0, NULL, 46),
    ('tn_w7', 'tpl_ts_tundra', 'slush_pool',         'Slush Pool',              31, 1, 1.0, 0, NULL, 0, NULL, 47),
-- ── PATHS + BRIDGE · Row 4 ────────────────────────────────────────────────────
    ('tn_p0', 'tpl_ts_tundra', 'path_snow_h',        'Snow Path (H)',            32, 1, 1.0, 0, NULL, 0, NULL, 50),
    ('tn_p1', 'tpl_ts_tundra', 'path_snow_v',        'Snow Path (V)',            33, 1, 1.0, 0, NULL, 0, NULL, 51),
    ('tn_p2', 'tpl_ts_tundra', 'path_ice_h',         'Ice Path (H)',             34, 1, 1.0, 0, NULL, 0, NULL, 52),
    ('tn_p3', 'tpl_ts_tundra', 'path_ice_v',         'Ice Path (V)',             35, 1, 1.0, 0, NULL, 0, NULL, 53),
    ('tn_p4', 'tpl_ts_tundra', 'road_h',             'Road (H)',                 36, 1, 1.0, 0, NULL, 0, NULL, 54),
    ('tn_p5', 'tpl_ts_tundra', 'road_v',             'Road (V)',                 37, 1, 1.0, 0, NULL, 0, NULL, 55),
    ('tn_p6', 'tpl_ts_tundra', 'road_corner',        'Road (Corner)',            38, 1, 1.0, 0, NULL, 0, NULL, 56),
    ('tn_p7', 'tpl_ts_tundra', 'ice_bridge',         'Ice Bridge',               39, 1, 1.0, 0, NULL, 0, NULL, 57),
-- ── FLORA (Arctic plants) · Row 5 ─────────────────────────────────────────────
    ('tn_f0', 'tpl_ts_tundra', 'frost_flower',       'Frost Flower',             40, 1, 1.0, 0, NULL, 0, NULL, 60),
    ('tn_f1', 'tpl_ts_tundra', 'snow_heather',       'Snow Heather',             41, 1, 1.0, 0, NULL, 0, NULL, 61),
    ('tn_f2', 'tpl_ts_tundra', 'ice_reed',           'Ice Reed',                 42, 1, 1.0, 0, NULL, 0, NULL, 62),
    ('tn_f3', 'tpl_ts_tundra', 'frozen_lily',        'Frozen Lily',              43, 1, 1.0, 0, NULL, 0, NULL, 63),
    ('tn_f4', 'tpl_ts_tundra', 'snow_shrub',         'Snow Shrub',               44, 1, 1.0, 0, NULL, 0, NULL, 64),
    ('tn_f5', 'tpl_ts_tundra', 'ice_crystal_small',  'Ice Crystal (Small)',      45, 1, 1.0, 0, NULL, 0, NULL, 65),
    ('tn_f6', 'tpl_ts_tundra', 'bare_fern',          'Bare Fern',                46, 1, 1.0, 0, NULL, 0, NULL, 66),
    ('tn_f7', 'tpl_ts_tundra', 'tundra_moss',        'Tundra Moss',              47, 1, 1.0, 0, NULL, 0, NULL, 67),
-- ── OBJECTS / DECOR · Row 6 ───────────────────────────────────────────────────
    ('tn_o0', 'tpl_ts_tundra', 'ice_rock',           'Ice Rock',                 48, 1, 1.0, 0, NULL, 0, NULL, 70),
    ('tn_o1', 'tpl_ts_tundra', 'bare_stump',         'Bare Stump',               49, 1, 1.0, 0, NULL, 0, NULL, 71),
    ('tn_o2', 'tpl_ts_tundra', 'frozen_log',         'Frozen Log',               50, 1, 1.0, 0, NULL, 0, NULL, 72),
    ('tn_o3', 'tpl_ts_tundra', 'snow_pile',          'Snow Pile',                51, 1, 1.0, 0, NULL, 0, NULL, 73),
    ('tn_o4', 'tpl_ts_tundra', 'ice_fence_h',        'Ice Fence (H)',            52, 1, 1.0, 0, NULL, 0, NULL, 74),
    ('tn_o5', 'tpl_ts_tundra', 'ice_fence_v',        'Ice Fence (V)',            53, 1, 1.0, 0, NULL, 0, NULL, 75),
    ('tn_o6', 'tpl_ts_tundra', 'frozen_sign',        'Frozen Sign',              54, 1, 1.0, 0, NULL, 0, NULL, 76),
    ('tn_o7', 'tpl_ts_tundra', 'ice_crystal_large',  'Ice Crystal (Large)',      55, 1, 1.0, 0, NULL, 0, NULL, 77),
-- ── STRUCTURES · Row 7 ────────────────────────────────────────────────────────
    ('tn_st0','tpl_ts_tundra', 'bare_tree',          'Bare Tree',                56, 1, 1.0, 0, NULL, 0, NULL, 80),
    ('tn_st1','tpl_ts_tundra', 'pine_snowy',         'Pine (Snow-covered)',      57, 1, 1.0, 0, NULL, 0, NULL, 81),
    ('tn_st2','tpl_ts_tundra', 'frost_bush',         'Frost Bush',               58, 1, 1.0, 0, NULL, 0, NULL, 82),
    ('tn_st3','tpl_ts_tundra', 'frozen_ruin_floor',  'Frozen Ruin Floor',        59, 1, 1.0, 0, NULL, 0, NULL, 83),
    ('tn_st4','tpl_ts_tundra', 'ice_wall',           'Ice Wall',                 60, 1, 1.0, 0, NULL, 0, NULL, 84),
    ('tn_st5','tpl_ts_tundra', 'frozen_door',        'Frozen Door',              61, 1, 1.0, 0, NULL, 0, NULL, 85),
    ('tn_st6','tpl_ts_tundra', 'snow_fort_wall',     'Snow Fort Wall',           62, 1, 1.0, 0, NULL, 0, NULL, 86),
    ('tn_st7','tpl_ts_tundra', 'buried_chest',       'Buried Chest',             63, 1, 1.0, 0, NULL, 0, NULL, 87);

-- ============================================================
--  DESERT, FOREST, SWAMP, VOLCANIC — STUB REGIONS
--  (Same semantic slot layout; placeholder display names shown in sprite builder.
--   Art teams fill slots via import. Only the most distinctive regions listed;
--   remaining slots are auto-shown as unnamed in the builder.)
-- ============================================================
INSERT OR IGNORE INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
-- ── DESERT ANIMATED ──────────────────────────────────────────────────────────
    ('ds_a0','tpl_ts_desert','heat_shimmer_anim',  '🏜️ Heat Shimmer',       64, 4, 8.0, 1, NULL, 0, NULL,  0),
    ('ds_a1','tpl_ts_desert','sandstorm_anim',     '🏜️ Sandstorm',          68, 4, 8.0, 1, NULL, 0, NULL,  1),
    ('ds_a2','tpl_ts_desert','oasis_water_anim',   '🏜️ Oasis Water',        72, 4, 6.0, 1, NULL, 0, NULL,  2),
    ('ds_a3','tpl_ts_desert','dust_devil_anim',    '🏜️ Dust Devil',         76, 4,10.0, 1, NULL, 0, NULL,  3),
    ('ds_a4','tpl_ts_desert','torch_anim',         '🔥 Torch',              88, 4,12.0, 1, NULL, 0, NULL,  6),
-- ── DESERT PRIMARY GROUND (Sand variants) ─────────────────────────────────────
    ('ds_g0','tpl_ts_desert','sand_base',          'Sand',                   0, 1, 1.0, 0, NULL, 1, NULL, 10),
    ('ds_g1','tpl_ts_desert','sand_ripple',        'Sand (Rippled)',          1, 1, 1.0, 0, NULL, 0, NULL, 11),
    ('ds_g2','tpl_ts_desert','sand_coarse',        'Sand (Coarse)',           2, 1, 1.0, 0, NULL, 0, NULL, 12),
    ('ds_g3','tpl_ts_desert','sand_dune',          'Sand Dune',               3, 1, 1.0, 0, NULL, 0, NULL, 13),
    ('ds_g4','tpl_ts_desert','sand_pale',          'Sand (Pale)',             4, 1, 1.0, 0, NULL, 0, NULL, 14),
    ('ds_g5','tpl_ts_desert','dust',               'Dust',                    5, 1, 1.0, 0, NULL, 0, NULL, 15),
    ('ds_g6','tpl_ts_desert','cracked_earth',      'Cracked Earth',           6, 1, 1.0, 0, NULL, 0, NULL, 16),
    ('ds_g7','tpl_ts_desert','cracked_dry',        'Cracked Earth (Dry)',     7, 1, 1.0, 0, NULL, 0, NULL, 17),
-- ── DESERT SECONDARY GROUND ───────────────────────────────────────────────────
    ('ds_s0','tpl_ts_desert','gravel_desert',      'Desert Gravel',           8, 1, 1.0, 0, NULL, 0, NULL, 20),
    ('ds_s1','tpl_ts_desert','pebbles',            'Pebbles',                 9, 1, 1.0, 0, NULL, 0, NULL, 21),
    ('ds_s2','tpl_ts_desert','red_gravel',         'Red Gravel',             10, 1, 1.0, 0, NULL, 0, NULL, 22),

-- ── FOREST ANIMATED ───────────────────────────────────────────────────────────
    ('fs_a0','tpl_ts_forest','forest_stream_anim', '🌲 Forest Stream',       64, 4, 8.0, 1, NULL, 0, NULL,  0),
    ('fs_a1','tpl_ts_forest','pond_ripple_anim',   '🌲 Pond Ripple',         68, 4, 6.0, 1, NULL, 0, NULL,  1),
    ('fs_a2','tpl_ts_forest','firefly_anim',       '🌲 Fireflies',           72, 4, 4.0, 1, NULL, 0, NULL,  2),
    ('fs_a3','tpl_ts_forest','spore_cloud_anim',   '🌲 Spore Cloud',         76, 4, 5.0, 1, NULL, 0, NULL,  3),
    ('fs_a4','tpl_ts_forest','light_shaft_anim',   '🌲 Light Shaft',         80, 4, 3.0, 1, NULL, 0, NULL,  4),
    ('fs_a5','tpl_ts_forest','leaf_fall_anim',     '🌲 Falling Leaves',      84, 4, 4.0, 1, NULL, 0, NULL,  5),
    ('fs_a6','tpl_ts_forest','torch_anim',         '🔥 Torch',               88, 4,12.0, 1, NULL, 0, NULL,  6),
-- ── FOREST PRIMARY GROUND (Moss/undergrowth) ──────────────────────────────────
    ('fs_g0','tpl_ts_forest','moss_base',          'Moss',                    0, 1, 1.0, 0, NULL, 1, NULL, 10),
    ('fs_g1','tpl_ts_forest','moss_lush',          'Moss (Lush)',             1, 1, 1.0, 0, NULL, 0, NULL, 11),
    ('fs_g2','tpl_ts_forest','undergrowth',        'Undergrowth',             2, 1, 1.0, 0, NULL, 0, NULL, 12),
    ('fs_g3','tpl_ts_forest','leaf_litter',        'Leaf Litter',             3, 1, 1.0, 0, NULL, 0, NULL, 13),
    ('fs_g4','tpl_ts_forest','damp_soil',          'Damp Soil',               4, 1, 1.0, 0, NULL, 0, NULL, 14),
    ('fs_g5','tpl_ts_forest','forest_floor',       'Forest Floor',            5, 1, 1.0, 0, NULL, 0, NULL, 15),
    ('fs_g6','tpl_ts_forest','root_ground',        'Root Ground',             6, 1, 1.0, 0, NULL, 0, NULL, 16),
    ('fs_g7','tpl_ts_forest','mulch',              'Mulch',                   7, 1, 1.0, 0, NULL, 0, NULL, 17),

-- ── SWAMP ANIMATED ────────────────────────────────────────────────────────────
    ('sw_a0','tpl_ts_swamp','murky_water_anim',    '🌿 Murky Water',         64, 4, 5.0, 1, NULL, 0, NULL,  0),
    ('sw_a1','tpl_ts_swamp','bog_bubble_anim',     '🌿 Bog Bubbles',         68, 4, 4.0, 1, NULL, 0, NULL,  1),
    ('sw_a2','tpl_ts_swamp','will_o_wisp_anim',    '🌿 Will-o-wisp',         72, 4, 6.0, 1, NULL, 0, NULL,  2),
    ('sw_a3','tpl_ts_swamp','miasma_anim',         '🌿 Miasma',              76, 4, 3.0, 1, NULL, 0, NULL,  3),
    ('sw_a4','tpl_ts_swamp','reed_sway_anim',      '🌿 Reed Sway',           80, 4, 5.0, 1, NULL, 0, NULL,  4),
    ('sw_a5','tpl_ts_swamp','algae_ripple_anim',   '🌿 Algae Ripple',        84, 4, 4.0, 1, NULL, 0, NULL,  5),
-- ── SWAMP PRIMARY GROUND (Mud/peat variants) ──────────────────────────────────
    ('sw_g0','tpl_ts_swamp','swamp_ground',        'Swamp Ground',            0, 1, 1.0, 0, NULL, 1, NULL, 10),
    ('sw_g1','tpl_ts_swamp','peat_base',           'Peat',                    1, 1, 1.0, 0, NULL, 0, NULL, 11),
    ('sw_g2','tpl_ts_swamp','peat_wet',            'Peat (Wet)',              2, 1, 1.0, 0, NULL, 0, NULL, 12),
    ('sw_g3','tpl_ts_swamp','bog_ground',          'Bog Ground',              3, 1, 1.0, 0, NULL, 0, NULL, 13),
    ('sw_g4','tpl_ts_swamp','black_soil',          'Black Soil',              4, 1, 1.0, 0, NULL, 0, NULL, 14),
    ('sw_g5','tpl_ts_swamp','mulch_wet',           'Wet Mulch',               5, 1, 1.0, 0, NULL, 0, NULL, 15),
    ('sw_g6','tpl_ts_swamp','algae_mat',           'Algae Mat',               6, 1, 1.0, 0, NULL, 0, NULL, 16),
    ('sw_g7','tpl_ts_swamp','ooze',                'Ooze',                    7, 1, 1.0, 0, NULL, 0, NULL, 17),

-- ── VOLCANIC ANIMATED ─────────────────────────────────────────────────────────
    ('vl_a0','tpl_ts_volcanic','lava_flow_anim',   '🌋 Lava Flow',           64, 4,10.0, 1, 'vl_a1', 0, NULL,  0),
    ('vl_a1','tpl_ts_volcanic','lava_bubble_anim', '🌋 Lava Bubble',         68, 4, 8.0, 1, NULL, 0, NULL,  1),
    ('vl_a2','tpl_ts_volcanic','fire_anim',        '🔥 Fire',                72, 4,12.0, 1, NULL, 0, NULL,  2),
    ('vl_a3','tpl_ts_volcanic','smoke_anim',       '🌋 Smoke',               76, 4, 5.0, 1, NULL, 0, NULL,  3),
    ('vl_a4','tpl_ts_volcanic','ember_anim',       '🌋 Embers',              80, 4, 8.0, 1, NULL, 0, NULL,  4),
    ('vl_a5','tpl_ts_volcanic','steam_vent_anim',  '🌋 Steam Vent',          84, 4, 6.0, 1, NULL, 0, NULL,  5),
-- ── VOLCANIC PRIMARY GROUND (Obsidian/ash) ────────────────────────────────────
    ('vl_g0','tpl_ts_volcanic','obsidian_base',    'Obsidian',                0, 1, 1.0, 0, NULL, 1, NULL, 10),
    ('vl_g1','tpl_ts_volcanic','obsidian_rough',   'Obsidian (Rough)',         1, 1, 1.0, 0, NULL, 0, NULL, 11),
    ('vl_g2','tpl_ts_volcanic','obsidian_cracked', 'Obsidian (Cracked)',       2, 1, 1.0, 0, NULL, 0, NULL, 12),
    ('vl_g3','tpl_ts_volcanic','scorched_earth',   'Scorched Earth',           3, 1, 1.0, 0, NULL, 0, NULL, 13),
    ('vl_g4','tpl_ts_volcanic','ash_light',        'Ash (Light)',              4, 1, 1.0, 0, NULL, 0, NULL, 14),
    ('vl_g5','tpl_ts_volcanic','ash_deep',         'Ash (Deep)',               5, 1, 1.0, 0, NULL, 0, NULL, 15),
    ('vl_g6','tpl_ts_volcanic','pumice',           'Pumice',                   6, 1, 1.0, 0, NULL, 0, NULL, 16),
    ('vl_g7','tpl_ts_volcanic','basalt',           'Basalt',                   7, 1, 1.0, 0, NULL, 0, NULL, 17),

-- ── CUSTOM / GENERIC  (4 categories × 2 rows each + 10 anim strips) ───────────
--
--  Static layout (rows 0-7, frames 0-63):
--    Row 0: Primary 1-8           — main surface tiles
--    Row 1: Primary Edge 1-4, Primary Corner 1-4  — transition pieces
--    Row 2: Secondary 1-8         — second surface type
--    Row 3: Secondary Edge 1-4, Secondary Corner 1-4
--    Row 4: Tertiary 1-8          — third surface / accent
--    Row 5: Tertiary Edge 1-4, Tertiary Corner 1-4
--    Row 6: Liquid / FX 1-8       — water, lava, acid, etc.
--    Row 7: Liquid Edge 1-4, Liquid Corner 1-4
--
--  Animated layout (rows 8-15, frames 64-127):
--    Loop A-D (fx_a-d), FX A-D, Spare 0-1
--
-- ── ANIMATED (rows 8-15, frames 64-127) ───────────────────────────────────────
    ('cx_a0','tpl_ts_custom','loop_a_anim',        'Loop A',                  64, 4, 8.0, 1, NULL, 0, NULL,  0),
    ('cx_a1','tpl_ts_custom','loop_b_anim',        'Loop B',                  68, 4, 8.0, 1, NULL, 0, NULL,  1),
    ('cx_a2','tpl_ts_custom','loop_c_anim',        'Loop C',                  72, 4, 8.0, 1, NULL, 0, NULL,  2),
    ('cx_a3','tpl_ts_custom','loop_d_anim',        'Loop D',                  76, 4, 8.0, 1, NULL, 0, NULL,  3),
    ('cx_a4','tpl_ts_custom','fx_a_anim',          'FX A',                    80, 4, 8.0, 1, NULL, 0, NULL,  4),
    ('cx_a5','tpl_ts_custom','fx_b_anim',          'FX B',                    84, 4, 8.0, 1, NULL, 0, NULL,  5),
    ('cx_a6','tpl_ts_custom','fx_c_anim',          'FX C',                    88, 4, 8.0, 1, NULL, 0, NULL,  6),
    ('cx_a7','tpl_ts_custom','fx_d_anim',          'FX D',                    92, 4, 8.0, 1, NULL, 0, NULL,  7),
    ('cx_a8','tpl_ts_custom','spare_0_anim',       'Spare 0',                 96, 4, 8.0, 1, NULL, 0, NULL,  8),
    ('cx_a9','tpl_ts_custom','spare_1_anim',       'Spare 1',                100, 4, 8.0, 1, NULL, 0, NULL,  9),
-- ── ROW 0 — PRIMARY tiles (frames 0-7) ────────────────────────────────────────
    ('cx_p0','tpl_ts_custom','primary_1',          'Primary 1',                0, 1, 1.0, 0, NULL, 1, NULL, 10),
    ('cx_p1','tpl_ts_custom','primary_2',          'Primary 2',                1, 1, 1.0, 0, NULL, 0, NULL, 11),
    ('cx_p2','tpl_ts_custom','primary_3',          'Primary 3',                2, 1, 1.0, 0, NULL, 0, NULL, 12),
    ('cx_p3','tpl_ts_custom','primary_4',          'Primary 4',                3, 1, 1.0, 0, NULL, 0, NULL, 13),
    ('cx_p4','tpl_ts_custom','primary_5',          'Primary 5',                4, 1, 1.0, 0, NULL, 0, NULL, 14),
    ('cx_p5','tpl_ts_custom','primary_6',          'Primary 6',                5, 1, 1.0, 0, NULL, 0, NULL, 15),
    ('cx_p6','tpl_ts_custom','primary_7',          'Primary 7',                6, 1, 1.0, 0, NULL, 0, NULL, 16),
    ('cx_p7','tpl_ts_custom','primary_8',          'Primary 8',                7, 1, 1.0, 0, NULL, 0, NULL, 17),
-- ── ROW 1 — PRIMARY transitions: edges (8-11) + corners (12-15) ───────────────
    ('cx_pe0','tpl_ts_custom','primary_edge_1',    'Primary Edge 1',           8, 1, 1.0, 0, NULL, 0, NULL, 18),
    ('cx_pe1','tpl_ts_custom','primary_edge_2',    'Primary Edge 2',           9, 1, 1.0, 0, NULL, 0, NULL, 18),
    ('cx_pe2','tpl_ts_custom','primary_edge_3',    'Primary Edge 3',          10, 1, 1.0, 0, NULL, 0, NULL, 18),
    ('cx_pe3','tpl_ts_custom','primary_edge_4',    'Primary Edge 4',          11, 1, 1.0, 0, NULL, 0, NULL, 18),
    ('cx_pc0','tpl_ts_custom','primary_corner_1',  'Primary Corner 1',        12, 1, 1.0, 0, NULL, 0, NULL, 18),
    ('cx_pc1','tpl_ts_custom','primary_corner_2',  'Primary Corner 2',        13, 1, 1.0, 0, NULL, 0, NULL, 18),
    ('cx_pc2','tpl_ts_custom','primary_corner_3',  'Primary Corner 3',        14, 1, 1.0, 0, NULL, 0, NULL, 18),
    ('cx_pc3','tpl_ts_custom','primary_corner_4',  'Primary Corner 4',        15, 1, 1.0, 0, NULL, 0, NULL, 18),
-- ── ROW 2 — SECONDARY tiles (frames 16-23) ────────────────────────────────────
    ('cx_s0','tpl_ts_custom','secondary_1',        'Secondary 1',             16, 1, 1.0, 0, NULL, 0, NULL, 20),
    ('cx_s1','tpl_ts_custom','secondary_2',        'Secondary 2',             17, 1, 1.0, 0, NULL, 0, NULL, 21),
    ('cx_s2','tpl_ts_custom','secondary_3',        'Secondary 3',             18, 1, 1.0, 0, NULL, 0, NULL, 22),
    ('cx_s3','tpl_ts_custom','secondary_4',        'Secondary 4',             19, 1, 1.0, 0, NULL, 0, NULL, 23),
    ('cx_s4','tpl_ts_custom','secondary_5',        'Secondary 5',             20, 1, 1.0, 0, NULL, 0, NULL, 24),
    ('cx_s5','tpl_ts_custom','secondary_6',        'Secondary 6',             21, 1, 1.0, 0, NULL, 0, NULL, 25),
    ('cx_s6','tpl_ts_custom','secondary_7',        'Secondary 7',             22, 1, 1.0, 0, NULL, 0, NULL, 26),
    ('cx_s7','tpl_ts_custom','secondary_8',        'Secondary 8',             23, 1, 1.0, 0, NULL, 0, NULL, 27),
-- ── ROW 3 — SECONDARY transitions: edges (24-27) + corners (28-31) ────────────
    ('cx_se0','tpl_ts_custom','secondary_edge_1',  'Secondary Edge 1',        24, 1, 1.0, 0, NULL, 0, NULL, 28),
    ('cx_se1','tpl_ts_custom','secondary_edge_2',  'Secondary Edge 2',        25, 1, 1.0, 0, NULL, 0, NULL, 28),
    ('cx_se2','tpl_ts_custom','secondary_edge_3',  'Secondary Edge 3',        26, 1, 1.0, 0, NULL, 0, NULL, 28),
    ('cx_se3','tpl_ts_custom','secondary_edge_4',  'Secondary Edge 4',        27, 1, 1.0, 0, NULL, 0, NULL, 28),
    ('cx_sc0','tpl_ts_custom','secondary_corner_1','Secondary Corner 1',      28, 1, 1.0, 0, NULL, 0, NULL, 28),
    ('cx_sc1','tpl_ts_custom','secondary_corner_2','Secondary Corner 2',      29, 1, 1.0, 0, NULL, 0, NULL, 28),
    ('cx_sc2','tpl_ts_custom','secondary_corner_3','Secondary Corner 3',      30, 1, 1.0, 0, NULL, 0, NULL, 28),
    ('cx_sc3','tpl_ts_custom','secondary_corner_4','Secondary Corner 4',      31, 1, 1.0, 0, NULL, 0, NULL, 28),
-- ── ROW 4 — TERTIARY tiles (frames 32-39) ─────────────────────────────────────
    ('cx_t0','tpl_ts_custom','tertiary_1',         'Tertiary 1',              32, 1, 1.0, 0, NULL, 0, NULL, 30),
    ('cx_t1','tpl_ts_custom','tertiary_2',         'Tertiary 2',              33, 1, 1.0, 0, NULL, 0, NULL, 31),
    ('cx_t2','tpl_ts_custom','tertiary_3',         'Tertiary 3',              34, 1, 1.0, 0, NULL, 0, NULL, 32),
    ('cx_t3','tpl_ts_custom','tertiary_4',         'Tertiary 4',              35, 1, 1.0, 0, NULL, 0, NULL, 33),
    ('cx_t4','tpl_ts_custom','tertiary_5',         'Tertiary 5',              36, 1, 1.0, 0, NULL, 0, NULL, 34),
    ('cx_t5','tpl_ts_custom','tertiary_6',         'Tertiary 6',              37, 1, 1.0, 0, NULL, 0, NULL, 35),
    ('cx_t6','tpl_ts_custom','tertiary_7',         'Tertiary 7',              38, 1, 1.0, 0, NULL, 0, NULL, 36),
    ('cx_t7','tpl_ts_custom','tertiary_8',         'Tertiary 8',              39, 1, 1.0, 0, NULL, 0, NULL, 37),
-- ── ROW 5 — TERTIARY transitions: edges (40-43) + corners (44-47) ─────────────
    ('cx_te0','tpl_ts_custom','tertiary_edge_1',   'Tertiary Edge 1',         40, 1, 1.0, 0, NULL, 0, NULL, 38),
    ('cx_te1','tpl_ts_custom','tertiary_edge_2',   'Tertiary Edge 2',         41, 1, 1.0, 0, NULL, 0, NULL, 38),
    ('cx_te2','tpl_ts_custom','tertiary_edge_3',   'Tertiary Edge 3',         42, 1, 1.0, 0, NULL, 0, NULL, 38),
    ('cx_te3','tpl_ts_custom','tertiary_edge_4',   'Tertiary Edge 4',         43, 1, 1.0, 0, NULL, 0, NULL, 38),
    ('cx_tc0','tpl_ts_custom','tertiary_corner_1', 'Tertiary Corner 1',       44, 1, 1.0, 0, NULL, 0, NULL, 38),
    ('cx_tc1','tpl_ts_custom','tertiary_corner_2', 'Tertiary Corner 2',       45, 1, 1.0, 0, NULL, 0, NULL, 38),
    ('cx_tc2','tpl_ts_custom','tertiary_corner_3', 'Tertiary Corner 3',       46, 1, 1.0, 0, NULL, 0, NULL, 38),
    ('cx_tc3','tpl_ts_custom','tertiary_corner_4', 'Tertiary Corner 4',       47, 1, 1.0, 0, NULL, 0, NULL, 38),
-- ── ROW 6 — LIQUID / FX tiles (frames 48-55) ──────────────────────────────────
    ('cx_l0','tpl_ts_custom','liquid_1',           'Liquid 1',                48, 1, 1.0, 0, NULL, 0, NULL, 40),
    ('cx_l1','tpl_ts_custom','liquid_2',           'Liquid 2',                49, 1, 1.0, 0, NULL, 0, NULL, 41),
    ('cx_l2','tpl_ts_custom','liquid_3',           'Liquid 3',                50, 1, 1.0, 0, NULL, 0, NULL, 42),
    ('cx_l3','tpl_ts_custom','liquid_4',           'Liquid 4',                51, 1, 1.0, 0, NULL, 0, NULL, 43),
    ('cx_l4','tpl_ts_custom','liquid_5',           'Liquid 5',                52, 1, 1.0, 0, NULL, 0, NULL, 44),
    ('cx_l5','tpl_ts_custom','liquid_6',           'Liquid 6',                53, 1, 1.0, 0, NULL, 0, NULL, 45),
    ('cx_l6','tpl_ts_custom','liquid_7',           'Liquid 7',                54, 1, 1.0, 0, NULL, 0, NULL, 46),
    ('cx_l7','tpl_ts_custom','liquid_8',           'Liquid 8',                55, 1, 1.0, 0, NULL, 0, NULL, 47),
-- ── ROW 7 — LIQUID transitions: edges (56-59) + corners (60-63) ───────────────
    ('cx_le0','tpl_ts_custom','liquid_edge_1',     'Liquid Edge 1',           56, 1, 1.0, 0, NULL, 0, NULL, 48),
    ('cx_le1','tpl_ts_custom','liquid_edge_2',     'Liquid Edge 2',           57, 1, 1.0, 0, NULL, 0, NULL, 48),
    ('cx_le2','tpl_ts_custom','liquid_edge_3',     'Liquid Edge 3',           58, 1, 1.0, 0, NULL, 0, NULL, 48),
    ('cx_le3','tpl_ts_custom','liquid_edge_4',     'Liquid Edge 4',           59, 1, 1.0, 0, NULL, 0, NULL, 48),
    ('cx_lc0','tpl_ts_custom','liquid_corner_1',   'Liquid Corner 1',         60, 1, 1.0, 0, NULL, 0, NULL, 48),
    ('cx_lc1','tpl_ts_custom','liquid_corner_2',   'Liquid Corner 2',         61, 1, 1.0, 0, NULL, 0, NULL, 48),
    ('cx_lc2','tpl_ts_custom','liquid_corner_3',   'Liquid Corner 3',         62, 1, 1.0, 0, NULL, 0, NULL, 48),
    ('cx_lc3','tpl_ts_custom','liquid_corner_4',   'Liquid Corner 4',         63, 1, 1.0, 0, NULL, 0, NULL, 48);


-- ============================================================
--  OBJECT: CONTAINER  (chest, box, crate)
--  32×32 px base · 4 cols × 2 rows = 8 frames
--  Scale: 1×=16bit, 2×=32bit, 4×=64bit, 8×=128bit
-- ============================================================
INSERT OR IGNORE INTO sprite_templates
    (id, name, description, category, frame_w, frame_h, cols_per_row,
     has_directions, directions, direction_mirrors, rows_per_sheet)
VALUES
    ('tpl_obj_container', 'object_container',
     'Container object (chest, box, crate). 32×32 base · 4 cols × 2 rows = 8 frames. States: closed idle (2f), opening animation (4f), open idle (2f).',
     'object', 32, 32, 4, 0, '[]', '{}', 64);

INSERT OR IGNORE INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
    ('reg_obj_con_closed',  'tpl_obj_container', 'closed',  'Closed',   0, 2,  2.0, 1, NULL,   1, NULL, 0),
    ('reg_obj_con_opening', 'tpl_obj_container', 'opening', 'Opening',  2, 4, 10.0, 0, 'open', 0, NULL, 1),
    ('reg_obj_con_open',    'tpl_obj_container', 'open',    'Open',     6, 2,  2.0, 1, NULL,   1, NULL, 2);

-- ============================================================
--  OBJECT: SIMPLE  (crystal, barrel, sign, ground item)
--  32×32 px base · 4 cols × 4 rows = 16 frames
--  Scale: 1×=16bit, 2×=32bit, 4×=64bit, 8×=128bit
-- ============================================================
INSERT OR IGNORE INTO sprite_templates
    (id, name, description, category, frame_w, frame_h, cols_per_row,
     has_directions, directions, direction_mirrors, rows_per_sheet)
VALUES
    ('tpl_obj_simple', 'object_simple',
     'Simple interactive/decorative object (crystal, barrel, sign, item). 32×32 base · 4 cols × 4 rows = 16 frames. States: idle (2f), highlight (2f), interact (4f), destroyed (4f). Extra 4 frames reserved.',
     'object', 32, 32, 4, 0, '[]', '{}', 64);

INSERT OR IGNORE INTO sprite_template_regions
    (id, template_id, anim_name, display_name, start_frame, frame_count, fps, loop, next_anim, is_required, fallback_anim, sort_order)
VALUES
    ('reg_obj_sim_idle',      'tpl_obj_simple', 'idle',      'Idle',       0, 2,  2.0, 1, NULL,   1, NULL, 0),
    ('reg_obj_sim_highlight', 'tpl_obj_simple', 'highlight', 'Highlight',  2, 2,  8.0, 1, NULL,   0, 'idle', 1),
    ('reg_obj_sim_interact',  'tpl_obj_simple', 'interact',  'Interact',   4, 4, 10.0, 0, 'idle', 0, NULL, 2),
    ('reg_obj_sim_destroyed', 'tpl_obj_simple', 'destroyed', 'Destroyed',  8, 4,  8.0, 0, NULL,   0, NULL, 3);
