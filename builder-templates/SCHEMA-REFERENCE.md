# RealmKit Builder — JSON Schema Reference

Paste any of these arrays into the **{ } JSON** import field of the matching Builder tab.
Items with a matching `_id` will **update in place**; new items (no `_id` or unknown `_id`) are **appended**.

---

## How to use with an LLM

1. Open any section below.
2. Copy the **Prompt** block for that section.
3. Paste it into any LLM (Claude, GPT, etc.) and describe what you want.
4. Paste the returned JSON array into the matching Builder tab's **{ } JSON** import field.

> **Tip:** You can combine prompts — ask for factions + characters + quests in one shot, as long as you keep the IDs consistent across sections (e.g. set `faction_id` in characters to match a faction `_id` you defined).

---

## Stories

File: `stories.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted (`story_…`) |
| `title` | string | **Required** |
| `description` | string | Short summary |
| `tags` | string | Comma-separated, e.g. `"rpg, fantasy"` |
| `is_published` | boolean | `false` = draft |
| `created_at` | ISO 8601 string | Auto-filled if omitted |

**Prompt:**
```
Generate a JSON array of RealmKit Story entries. Each entry must follow this exact schema:
{
  "_id": "story_<unique_short_id>",
  "title": "string (required)",
  "description": "short summary string",
  "tags": "comma-separated string e.g. 'fantasy, war'",
  "is_published": false
}

[describe the stories you want here — setting, tone, number of entries, etc.]

Return only the raw JSON array, no explanation.
```

---

## Factions

File: `factions.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted |
| `name` | string | **Required** |
| `color` | string | Hex color, e.g. `"#c8a840"` |
| `alignment` | string | `neutral` `lawful` `chaotic` `good` `evil` |
| `description` | string | Lore blurb |

**Prompt:**
```
Generate a JSON array of RealmKit Faction entries. Each entry must follow this exact schema:
{
  "_id": "faction_<unique_short_id>",
  "name": "string (required)",
  "color": "#rrggbb hex color",
  "alignment": "one of: neutral | lawful | chaotic | good | evil",
  "description": "short lore blurb"
}

[describe the factions you want — setting, political landscape, number of factions, etc.]

Return only the raw JSON array, no explanation.
```

---

## Characters

File: `characters.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted |
| `name` | string | **Required** |
| `class` | string | e.g. `"Paladin"`, `"Rogue"` |
| `portrait` | string | Sprite key or relative URL |
| `faction_id` | string | `_id` of a Faction entry |
| `hp` | number | Max health |
| `mp` | number | Max mana/magic |
| `atk` | number | Attack power |
| `def` | number | Defense rating |
| `spd` | number | Speed / initiative |

**Prompt:**
```
Generate a JSON array of RealmKit Character entries. Each entry must follow this exact schema:
{
  "_id": "chars_<unique_short_id>",
  "name": "string (required)",
  "class": "character class string",
  "portrait": "",
  "faction_id": "faction _id or empty string",
  "hp": number,
  "mp": number,
  "atk": number,
  "def": number,
  "spd": number
}

Stats should be balanced in the 1–200 range. Leave portrait as an empty string.
Use faction_ids from this list if relevant: [paste your faction _ids here]

[describe the characters you want — roles, archetypes, allegiances, number of entries, etc.]

Return only the raw JSON array, no explanation.
```

---

## Unit Templates

File: `units.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted |
| `name` | string | **Required** |
| `type` | string | `infantry` `archer` `cavalry` `mage` `hero` `monster` `npc` |
| `sprite` | string | Sprite key or relative URL |
| `faction_id` | string | `_id` of a Faction (blank = neutral/wild) |
| `hp` | number | Max health |
| `atk` | number | Attack |
| `def` | number | Defense |
| `spd` | number | Speed |
| `cost` | number | Recruit cost in gold (0 = not recruitable) |

**Prompt:**
```
Generate a JSON array of RealmKit Unit Template entries. Each entry must follow this exact schema:
{
  "_id": "units_<unique_short_id>",
  "name": "string (required)",
  "type": "one of: infantry | archer | cavalry | mage | hero | monster | npc",
  "sprite": "",
  "faction_id": "faction _id or empty string",
  "hp": number,
  "atk": number,
  "def": number,
  "spd": number,
  "cost": number (gold to recruit; 0 if not recruitable)
}

Stats should be balanced in the 1–150 range. Leave sprite as an empty string.
Use faction_ids from this list if relevant: [paste your faction _ids here]

[describe the units you want — army composition, enemy types, special units, number of entries, etc.]

Return only the raw JSON array, no explanation.
```

---

## Dialogues

File: `dialogues.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted |
| `id` | string | **Required** — unique key used in Scene steps, e.g. `"intro_01"` |
| `speaker` | string | Display name shown in dialogue box |
| `portrait` | string | Sprite key for speaker portrait |
| `lines` | array of strings | Each string = one text bubble |
| `choices` | array of objects | Optional branching; each: `{ "text": "…", "next": "dialog_id_or_null" }` |

**Prompt:**
```
Generate a JSON array of RealmKit Dialogue entries. Each entry must follow this exact schema:
{
  "_id": "dialog_<unique_short_id>",
  "id": "short_snake_case_key",
  "speaker": "display name",
  "portrait": "",
  "lines": ["line one text", "line two text"],
  "choices": [
    { "text": "player choice text", "next": "dialog_id_or_null" }
  ]
}

Rules:
- "id" must be a short snake_case key like "intro_gate_01" — used by scenes to trigger this dialogue
- "lines" is an array; each element is one separate text bubble the speaker says
- "choices" is optional; omit or use [] for linear (no branch) dialogues
- Leave portrait as an empty string
- "next" in choices should reference another dialogue "id" or null to end the conversation

[describe the conversations you want — who speaks, what they say, any branching choices, tone, etc.]

Return only the raw JSON array, no explanation.
```

---

## Quests

File: `quests.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted |
| `title` | string | **Required** |
| `description` | string | Full quest description |
| `giver_id` | string | `_id` of the Character or Unit who gives the quest |
| `objectives` | array | Each: `{ "text", "type", "target", "count" }` |
| `objectives[].type` | string | `kill` `collect` `explore` `talk` `deliver` `investigate` |
| `rewards` | object | `{ "gold": 0, "xp": 0, "items": ["item_key"] }` |

**Prompt:**
```
Generate a JSON array of RealmKit Quest entries. Each entry must follow this exact schema:
{
  "_id": "quests_<unique_short_id>",
  "title": "string (required)",
  "description": "full quest description and context",
  "giver_id": "character or unit _id, or empty string",
  "objectives": [
    {
      "text": "what the player must do",
      "type": "one of: kill | collect | explore | talk | deliver | investigate",
      "target": "entity_id or zone_id or item_key",
      "count": number
    }
  ],
  "rewards": {
    "gold": number,
    "xp": number,
    "items": ["item_key_string"]
  }
}

Use giver_ids from this list if relevant: [paste your character _ids here]

[describe the quests you want — themes, difficulty, narrative hooks, faction involvement, number of entries, etc.]

Return only the raw JSON array, no explanation.
```

---

## Scenes

File: `scenes.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted |
| `id` | string | **Required** — unique key referenced by triggers |
| `name` | string | Human-readable label |
| `trigger` | object | When this scene fires (see below) |
| `steps` | array | Ordered list of scene actions (see below) |

**Trigger types:**

| `type` | Fires when… |
|---|---|
| `once` + `"condition": "game_start"` | Game loads for the first time |
| `enter` + `"zone": "zone_id"` | Player enters a named zone |
| `flag` + `"condition": "flagKey == value"` | A game flag matches a condition |
| `interact` + `"target": "entity_id"` | Player interacts with an entity |

**Step types:**

| `type` | Effect |
|---|---|
| `dialog` | Show dialogue. Requires `"id": "dialog_id"` |
| `blackout` / `fadein` / `fadeout` | Screen transition. Optional `"duration"` ms |
| `text` | Full-screen caption. `"text"`, `"duration"` |
| `wait` | Pause. `"ms"` |
| `sound` | Play sound. `"id"`, optional `"loop"` |
| `flag` | Set a flag. `"key"`, `"value"` |
| `spawn` | Spawn a unit. `"unit"` (char _id), `"x"`, `"y"` |
| `combat` | Trigger a fight. `"enemy"` (char _id), `"flee_allowed"` |
| `reward` | Give items/gold/xp directly |
| `quest_update` | Advance a quest objective. `"quest_id"`, `"objective"` (0-based index) |

**Prompt:**
```
Generate a JSON array of RealmKit Scene entries. Each entry must follow this exact schema:
{
  "_id": "scene_<unique_short_id>",
  "id": "short_snake_case_key",
  "name": "human readable name",
  "trigger": {
    "type": "once | enter | flag | interact",
    "condition": "game_start  (for once type)",
    "zone": "zone_id  (for enter type)",
    "target": "entity_id  (for interact type)"
  },
  "steps": [
    { "type": "fadeout", "duration": 800 },
    { "type": "dialog",  "id": "dialog_id_key" },
    { "type": "fadein",  "duration": 600 },
    { "type": "flag",    "key": "flag_name", "value": "true" },
    { "type": "quest_update", "quest_id": "quests_xxx", "objective": 0 }
  ]
}

Step types available: dialog, blackout, fadein, fadeout, text, wait, sound, flag, spawn, combat, reward, quest_update
For dialog steps, reference dialogue "id" keys (not _id).
For quest_update steps, reference quest "_id" values.

Dialogue ids available: [paste your dialogue id keys here]
Quest ids available: [paste your quest _id values here]

[describe the scenes you want — cutscenes, zone entry events, NPC interactions, combat triggers, number of entries, etc.]

Return only the raw JSON array, no explanation.
```

---

## Tilesets

File: `tilesets.example.json`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Auto-generated if omitted |
| `name` | string | **Required** — display name |
| `path` | string | Relative path to the PNG from the game's root, e.g. `"assets/tilesets/overworld.png"` |
| `tileWidth` | number | Width of one tile in pixels (default 32) |
| `tileHeight` | number | Height of one tile in pixels (default 32) |
| `cols` | number | Number of tile columns in the sheet |

**Prompt:**
```
Generate a JSON array of RealmKit Tileset entries. Each entry must follow this exact schema:
{
  "_id": "tiles_<unique_short_id>",
  "name": "display name",
  "path": "assets/tilesets/filename.png",
  "tileWidth": 32,
  "tileHeight": 32,
  "cols": 8
}

Note: tileWidth and tileHeight are the size of a single tile in pixels (typically 16, 32, or 64).
cols is how many tile columns fit horizontally across the spritesheet.

[describe the tilesets you need — biomes, styles, tile sizes, etc.]

Return only the raw JSON array, no explanation.
```

> Create tileset images in **🎨 Pixel Painter** (`sprite-builder.html`), then register them here. Pixel Painter assets saved to the server are automatically available in the Tiles tab under "Import from Pixel Painter".

---

## Workflow: Building a full scenario with an LLM

The most efficient order when generating a whole scenario from scratch:

1. **Factions** first — everything else references faction `_id` values
2. **Characters** — reference faction `_id`s; keep a list of the `_id`s you get back
3. **Unit Templates** — reference faction `_id`s
4. **Dialogues** — reference character names; keep a list of the `id` keys you get back
5. **Quests** — reference character `_id`s as `giver_id`; keep the quest `_id`s
6. **Scenes** — reference dialogue `id` keys and quest `_id`s
7. **Tilesets** — independent, can be done any time

> **Cross-reference tip:** After generating each section, paste the `_id` list into the next prompt so the LLM can wire things together correctly.
