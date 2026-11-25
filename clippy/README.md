# Clippy - Single Folder Package

This folder is the deployable version of Clippy.

Drop the whole `clippy/` directory into your web root, copy one config file,
and it is ready to run.

## What is in here

- `clippy.js` - browser runtime
- `clippy.css` - widget styles
- `clippy-widget.js` - small module wrapper for easy embedding
- `clippy-widget.css` - wrapper stylesheet entry
- `characters/` - built-in character packs (`*.pack.js` + `*.css` + `*.json`)
- `chat.php` - server-side chat adapter
- `models.php` - provider/model catalog endpoint
- `discover.php` - model discovery endpoint
- `config.sample.json` - config template
- `config.json` - live config
- `providers/` - backend provider adapters
- `index.html` - demo page

## Quick start

1. Copy this entire `clippy/` directory into your web root.
2. Copy `config.sample.json` to `config.json` if you do not already have one.
3. Open `config.json` and confirm the provider settings you want.
4. Open the demo page in your browser.

Example:

```text
http://your-host/Clippy/clippy/
```

With the default sample config, Clippy expects Ollama at:

```text
http://127.0.0.1:11434
```

If Apache/PHP and Ollama are on the same machine, that usually works without
further changes.

## Config

The main file you edit is `config.json`.

Important keys:

- `allowed_origins`
  Use `[]` for same-origin only. Add exact origins if you are embedding the
  widget on a different origin.
- `default_provider`
  Which provider handles requests by default.
- `providers`
  Server-side connection details and the models shown in the browser dropdown.
- `routes`
  Optional model-based routing rules.

Example Ollama block:

```json
"ollama": {
  "label": "Ollama (local)",
  "base_url": "http://127.0.0.1:11434",
  "timeout": 600,
  "models": [
    { "id": "gemma4:e4b", "label": "Gemma 4 e4b" },
    { "id": "llama3.2:3b", "label": "Llama 3.2 3B" }
  ]
}
```

## Use the demo page

After setup, the demo page at `index.html` mounts Clippy automatically through
the local wrapper:

```js
import { mountClippy } from "./clippy-widget.js";
mountClippy();
```

That page is useful for testing:

- characters
- permissions
- model/provider dropdowns
- Markdown page knowledge
- tool execution against a safe sample page

## Embed on another page

Recommended path: import the wrapper module.

```html
<script type="module">
  import { mountClippy } from "/Clippy/clippy/clippy-widget.js";

  mountClippy();
</script>
```

The wrapper auto-loads:

- `./clippy.js`
- `./clippy.css`
- `./characters/*.pack.js`
- `./chat.php`

So most pages only need the import and `mountClippy()` call.

## Common mount options

You can pass the same options you would normally use for the widget runtime.
The most useful ones are:

```html
<script type="module">
  import { mountClippy } from "/Clippy/clippy/clippy-widget.js";

  mountClippy({
    model: "gemma4:e4b",
    provider: "ollama",
    character: "ember",
    autoOpen: false,
    knowledgeFiles: [
      "./docs/page-guide.md",
      "./docs/selectors.md"
    ]
  });
</script>
```

Useful options:

- `model`
- `provider`
- `character`
- `knowledgeFiles`
- `knowledgeSources`
- `endpoint`
- `autoOpen`
- `characterPacks`

Normally you should not need to set `endpoint`, because the wrapper defaults it
to `./chat.php` relative to this folder.

`avatar` is still accepted as a backwards-compatible alias, but new embeds
should prefer `character`.

## Built-in characters and drop-in packs

The built-in visual personas now live in `characters/` as separate pack files.
Each character uses:

- `characters/<id>.pack.js` - registers the character with the runtime
- `characters/<id>.css` - animation/style rules for that character
- `characters/<id>.json` - hidden character config such as the built-in operator prompt and character-specific defaults

The wrapper loads the built-ins automatically. To add your own character pack,
ship a matching `.pack.js`, `.css`, and `.json`, then point `characterPacks` at the
script file:

```html
<script type="module">
  import { mountClippy } from "/Clippy/clippy/clippy-widget.js";

  mountClippy({
    character: "my-helper",
    characterPacks: [
      "./characters/my-helper.pack.js"
    ]
  });
</script>
```

A pack script should register itself on `window.ClippyCharacterPacks` with:

- `id`
- `label`
- `title`
- `styleUrl`
- `configUrl`
- `transitions`
- `svg`

The visible settings field is now `Directions`, not the full operator prompt.
Clippy builds the final system message like this:

1. hidden character prompt from `characters/<id>.json`
2. user directions from the settings panel
3. page knowledge context

That keeps the \"how the widget works\" prompt hidden from end users while
still letting them steer the character's tone and priorities per site.

## Embed without the wrapper

If you do not want the module wrapper, you can mount the raw runtime directly:

```html
<link rel="stylesheet" href="/Clippy/clippy/clippy.css">
<script src="/Clippy/clippy/characters/clippy.pack.js" defer></script>
<script src="/Clippy/clippy/characters/ember.pack.js" defer></script>
<script src="/Clippy/clippy/characters/saucer.pack.js" defer></script>
<script src="/Clippy/clippy/clippy.js" defer></script>
<script>
  window.addEventListener("DOMContentLoaded", () => {
    window.Clippy.mount({
      endpoint: "/Clippy/clippy/chat.php",
      character: "clippy"
    });
  });
</script>
```

## Cross-origin embedding

If the page using Clippy is not served from the same origin as this folder,
add the host page's origin to `allowed_origins` in `config.json`.

Example:

```json
"allowed_origins": [
  "https://docs.example.com"
]
```

Leave it as `[]` when everything is same-origin.

## Markdown page knowledge

Clippy can load Markdown files and use them as page-specific context.

You can provide them:

- in code with `knowledgeFiles` or `knowledgeSources`
- in the widget settings under `Page Knowledge`

Right now this path is Markdown-only.

## Files you will usually touch

- `config.json` - provider and origin config
- `clippy-widget.js` - wrapper defaults if you want different auto paths
- `clippy.js` - runtime behavior, character registry, permissions, tools
- `characters/` - built-in and custom character packs
- `index.html` - local demo page

## Permissions

Permissions are split by intent and each has three modes: `Prompt`,
`Just do`, and `Ignore`.

- `Read` - inspect the DOM. Default `Just do`.
- `Interact` - fill fields, click controls, submit forms that stay on
  the current page. Default `Prompt`.
- `Navigate` - follow a link or a form submission that would leave the
  current page. Default `Prompt`. See the next section for what the
  three modes do.
- `Modify` - change text, styles, classes, or attributes.
- `Create` / `Remove` - add or delete elements.
- `Run JavaScript` / `Inject script` - high risk, default `Ignore`.
  Leave these off unless you trust the page.

`Prompt` asks first, `Just do` runs without asking, and `Ignore`
auto-denies the request.

## How source navigation works

Clippy can act as an interactive guide - find an answer, tell the user
where it lives, and offer to take them there. The runtime drives this
deterministically rather than relying on the model to remember the
handshake, which cleans up a lot of the old "it told me but it wouldn't
take me there" bugs.

The flow:

1. User asks something like *"help me find the refund policy"* or
   *"take me to the FAQ about exports"*.
2. Clippy calls `search_site` (or `find_text` / `query_all` / `read_dom`
   with a narrow selector) and locates the target.
3. The runtime decides what to do based on where the answer lives and
   the `Navigate` permission:

   | Where the answer is                         | `Navigate = Prompt`                              | `Navigate = Just do`                       | `Navigate = Ignore`       |
   | ------------------------------------------- | ------------------------------------------------ | ------------------------------------------ | ------------------------- |
   | Same page, narrow selector (id, form, etc.) | Auto-scrolls into view                           | Auto-scrolls into view                     | Auto-scrolls into view    |
   | Same page, broad selector + anchor          | Shows an **Open / Not now** card                 | Auto-scrolls to the anchor                 | No card, no scroll        |
   | Another page on this site                   | Shows an **Open / Not now** card                 | Auto-navigates + scrolls on arrival        | No card, no navigation    |

   Same-page scrolls never ask - they're cheap and reversible. Only
   page-leaving actions are gated by the `Navigate` permission.

4. When the card is shown, the user can click **Open <page name>**,
   click **Not now**, or type a short yes/no reply. Any of those
   resolve the card. Typing an unrelated follow-up leaves the card
   passive in the log and continues a normal turn.

5. On arrival at the destination page, Clippy re-mounts, prints
   *"Landed on the page you asked for"*, scrolls the matched section
   into view, and stops - it does not restart the tool loop or
   re-propose anything.

## Tools you will see in the log

- `read_dom` / `query_all` - inspect elements.
- `find_text` - keyword search over the current page's visible copy.
- `search_site` - same-origin crawl (current page plus linked pages,
  DOMParser-based, no cross-origin fetches). Returns matches with
  `pageUrl`, `selector`, `anchor`, `heading`.
- `scroll_into_view` - smooth scroll to a selector. Preferred over
  arbitrary JavaScript for bringing a section onscreen.
- `modify_element` / `dispatch_event` / `create_element` /
  `remove_element` - DOM write operations, gated by their permission.
- `run_js` / `inject_script` - last-resort escape hatches, default off.

## Embedding Clippy on another site

The widget is designed to be dropped onto any page. A few things to
check before you wire it up:

1. **Serve the files from somewhere reachable.** Either same-origin
   with the host page, or a different origin you've listed in
   `allowed_origins` in `config.json`.
2. **Point the endpoint at `chat.php`.** The wrapper defaults to
   `./chat.php` relative to the folder it was imported from, so if
   you import `clippy-widget.js` from `/Clippy/clippy/`, the backend
   URL resolves to `/Clippy/clippy/chat.php` automatically. Override
   with `endpoint: "https://your-host/Clippy/clippy/chat.php"` if
   the adapter lives on a different origin.
3. **Pick sensible default permissions for that site.** See the
   per-site recommendations below.
4. **Give Clippy anchors to land on.** Source navigation works best
   when every section that might be a destination has a stable `id`
   on its wrapper element. Pages that only use class names or raw
   text headings still work, but Clippy may have to fall back to
   broad-selector offers or scroll to the heading text instead of a
   precise section.

### Per-site permission recommendations

- **Documentation / FAQ / help site.** `Navigate = Just do` is the
  sweet spot - the user *wants* Clippy to move them around the site.
  Leave `Modify` / `Create` / `Remove` / `Run JavaScript` on `Prompt`
  or `Ignore` - there's no reason a docs assistant should change the
  page.
- **Form-heavy app (checkout, onboarding, settings).** Keep `Navigate`
  on `Prompt`. Leaving a partially-filled form is the single worst
  user experience Clippy can produce, and the card gives the user a
  chance to say "not now". `Interact` on `Just do` is fine if you
  trust the model to fill fields sensibly.
- **Public marketing site.** `Navigate = Just do`, `Interact = Just do`,
  everything else off or on `Prompt`. The cost of a wrong click is
  low and the value of fast guided tours is high.
- **Internal / admin dashboards.** Default everything to `Prompt`.
  High-impact actions (deletions, settings changes) happen on these
  pages and a confirmation step is worth the friction.
- **Untrusted pages.** Keep `Run JavaScript` and `Inject script` on
  `Ignore`. Both capabilities use `new Function(code)` with no
  sandboxing - treat them as you would a browser console.

### How to tell it's working

- Open the gear panel and pick a model + provider.
- Send a find query, e.g. *"help me find the refund policy"*.
- The log should show a tool line (`search_site` or similar), then
  either a scroll or an **Open <page name>** card - not a generic
  "I found this" message that leaves the user stuck.
- Click **Open**. The browser should navigate, Clippy should say
  *"Landed on the page you asked for"*, and the target section should
  scroll into view. No runaway tool loops, no "Stopped after 8 tool
  loops" message.
- Settings gear -> Navigate = `Just do`. Re-run the same query. No
  card should appear - Clippy navigates directly.

### Markdown page knowledge

Clippy can load Markdown files and use them as page-specific context
(useful for steering the model towards a product's vocabulary, or for
giving it a selector map of the page it's on).

You can provide them:

- in code with `knowledgeFiles` or `knowledgeSources`
- in the widget settings under `Page Knowledge`

Right now this path is Markdown-only.

## Notes

- The older `clippy-api`, `clippy-poc`, and `clippy-widget` folders can
  remain for development, but this folder is the single-folder
  deployment target.
- Prompt layering is versioned (`SYSTEM_PROMPT_VERSION` at the top of
  `clippy.js`). It now migrates older saved full prompts into the new
  user-directions field when possible, while hidden operator prompts live
  with each character's JSON config.
- Runtime state (history, log entries, pending navigation) persists
  through same-tab navigations via `sessionStorage`. Hard-reloading
  the page clears the live offer card but keeps the log; the
  transcript records that an offer was made so the history stays
  coherent.
