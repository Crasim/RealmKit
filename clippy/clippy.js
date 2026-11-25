/* =========================================================
 * Clippy (web) — proof of concept
 * ---------------------------------------------------------
 * A floating AI assistant that talks to a local Ollama server
 * and can read/modify the DOM + run JS, gated by per-capability
 * permissions.
 *
 * Usage:
 *   <link rel="stylesheet" href="clippy.css">
 *   <script src="clippy.js" defer></script>
 *   <script>window.Clippy.mount();</script>
 *
 * The assistant "speaks" by outputting fenced JSON blocks of the
 * form:
 *   ```clippy-tool
 *   {"tool":"read_dom","args":{"selector":"h1"}}
 *   ```
 * and/or normal prose for the user. The loop executes the tool
 * calls, feeds results back as another turn, and continues until
 * the model replies without any tool calls.
 * ========================================================= */

(function () {
  "use strict";

  // ---------- Defaults & persistence ----------
  const LS_KEY = "clippy_settings_v1";
  const LS_POS_KEY = "clippy_position_v1";
  const SS_RUNTIME_KEY = "clippy_runtime_v1";
  // User-added models live in the browser, per-provider, merged into the
  // Model dropdown alongside entries from the server-side catalog. Kept in
  // localStorage (not config.json) because the adapter has no authenticated
  // write endpoint and we don't want the public POST surface to mutate
  // server state. Shape: { [providerName]: [{ id, label }] }
  const LS_MODELS_KEY = "clippy_models_v1";
  // Bump when you meaningfully change DEFAULT_SYSTEM_PROMPT. On load, if the
  // user's saved version is older we'll refresh their prompt to the new
  // default (all other settings are preserved). Custom prompts are lost on
  // bumps — acceptable for a PoC; the settings panel has a big "Reset" too.
  //
  // Revision history:
  //   2026-04-19-manual  — long operator manual. Verbose for small models.
  //   2026-04-19-empty   — diagnostic: no prompt. Model fell back to its
  //                         "I am just a language model, I cannot see the
  //                         page" refusal reflex. Confirmed we need an
  //                         active prompt.
  //   2026-04-19-action  — original action-forward prompt.
  //   2026-04-20-action  — clarifies "use the page normally" vs stronger
  //                         DOM alteration so the model reaches for
  //                         fills/clicks before heavier mutations.
  //   2026-04-20-nav     — current. Adds same-tab page-navigation resume
  //                         guidance and a safe scroll tool.
  const SYSTEM_PROMPT_VERSION = "2026-04-21-parser-selectors-pattern-breaker";
  const DEFAULT_CHARACTER_ID = "clippy";
  const DEFAULT_AVATAR_ID = DEFAULT_CHARACTER_ID;
  const LEGACY_DEFAULT_PERMS = {
    read: true,
    interact: false,
    navigate: false,
    modify: false,
    create: false,
    remove: false,
    runJs: false,
    inject: false,
  };
  const DEFAULT_PERMISSION_POLICY = {
    read: "allow",
    interact: "prompt",
    navigate: "prompt",
    modify: "prompt",
    create: "prompt",
    remove: "prompt",
    runJs: "ignore",
    inject: "ignore",
  };
  const DEFAULTS = {
    // Default endpoint points at the same-origin PHP backend adapter, using a
    // **page-relative** path so it works no matter how Apache aliases the
    // parent folder. Layout assumed:
    //   <webroot>/<alias>/clippy/index.html       ← page
    //   <webroot>/<alias>/clippy/chat.php         ← adapter
    // For a direct-to-Ollama setup, change this to "http://host:11434" or
    // the Apache reverse-proxy path "/ollama" in the gear panel.
    endpoint: "./chat.php",
    // provider + model are driven by the catalog served by models.php (same
    // directory as the chat endpoint). The widget populates Provider/Model
    // dropdowns from that catalog at mount time. The initial defaults here
    // are the last-resort fallback for a missing or unreachable catalog.
    provider: "ollama",
    model: "gemma4:e4b",
    character: DEFAULT_CHARACTER_ID,
    avatar: DEFAULT_AVATAR_ID,
    knowledgeSources: [],
    temperature: 0.3,
    maxToolLoops: 8,
    permissionPolicy: { ...DEFAULT_PERMISSION_POLICY },
    // Legacy fields kept for migration from older saves.
    perms: { ...LEGACY_DEFAULT_PERMS },
    alwaysConfirm: true,
    debugEnabled: true,
    userPrompt: "",
    systemPrompt: "",
    systemPromptVersion: SYSTEM_PROMPT_VERSION,
  };

  // Currently active: action-forward prompt. Compact, concrete, and
  // explicitly overrides the "I am just an LLM, I cannot see the page"
  // refusal reflex that small chat-tuned models fall into. Swap in
  // DEFAULT_SYSTEM_PROMPT_MANUAL() below if you want the full operator
  // manual version instead.
  function DEFAULT_SYSTEM_PROMPT(characterTitle = "Clippy") {
    return [
      `You are ${characterTitle}, an AI assistant RUNNING INSIDE the user's web browser,`,
      "attached to the page they are currently viewing. You have real tools that",
      "read and change the page's DOM in real time.",
      "",
      "=== CRITICAL — DO NOT REFUSE THESE ===",
      "• You CAN see the page. Call `read_dom` or `query_all` to look at it.",
      "• You CAN use the page normally: fill fields, click controls, and submit forms.",
      "• You CAN alter the page when asked: text, styles, classes, attributes, new elements.",
      "• NEVER say \"I am just a language model\" or \"I cannot see the page\" or",
      "  \"I cannot interact with the page\" — in this environment those are false.",
      "• NEVER ask the user to paste HTML, describe the page, or tell you what's on",
      "  it. If you need to know something about the page, CALL `read_dom` and",
      "  find out for yourself.",
      "• When the user asks about the page (\"find the form\", \"what's the heading\",",
      "  \"fill in X\"), your FIRST turn must contain a tool call.",
      "• If a tool returns {\"ok\":false,\"error\":\"denied by user\"} or",
      "  {\"ok\":false,\"error\":\"ignored by permission policy\"}, acknowledge briefly",
      "  and try another approach or stop.",
      "",
      "=== HOW TO CALL A TOOL ===",
      "Emit a fenced JSON block tagged `clippy-tool`. The runtime strips these",
      "out, runs them, and feeds the results back as the next turn. Anything",
      "outside the fences is prose shown in the user's speech bubble.",
      "",
      "```clippy-tool",
      "{\"tool\":\"read_dom\",\"args\":{\"selector\":\"h1\"}}",
      "```",
      "",
      "You can emit multiple blocks in one turn; they execute in order.",
      "",
      "=== TOOLS ===",
      "read_dom       { selector, limit? }              — text, outerHTML, .value",
      "query_all      { selector }                       — compact list of matches",
      "find_text      { query, selector?, limit? }       — search page text for relevant sections",
      "search_site    { query, limit?, pageLimit? }      — search current + linked same-origin pages",
      "modify_element { selector,",
      "                 text?,       // textContent for non-form elements",
      "                 value?,      // .value for <input>/<textarea>/<select>",
      "                 checked?,    // checkboxes/radios",
      "                 html?,       // innerHTML replacement",
      "                 style?,      // { color: 'crimson', fontSize: '20px' }",
      "                 attrs?,      // { href: '...', 'data-x': null /*remove*/ }",
      "                 classAdd?, classRemove? }",
      "dispatch_event { selector, type }                 — 'click' | 'submit' | 'focus' | 'blur' | …",
      "scroll_into_view { selector, behavior?, block? }  — scroll an element into view",
      "create_element { parentSelector, html, position? } position: append|prepend|before|after",
      "remove_element { selector, all? }",
      "run_js         { code }                           — escape hatch; async IIFE; last value",
      "inject_script  { code, id? }                      — persistent <script> tag",
      "done           { }                                — optional; nothing more to do",
      "",
      "IMPORTANT: <input>, <textarea>, and <select> are filled with `value`, NOT",
      "`text`. Setting textContent on a form field visibly does nothing. For",
      "<select>, `value` matches an option by value first, then by visible label",
      "(case-insensitive).",
      "Prefer normal interaction when possible: fill fields with `value`/`checked`,",
      "click visible controls, and submit forms before reaching for stronger DOM edits",
      "or arbitrary JavaScript.",
      "When the user asks you to find something on the current page, prefer",
      "`find_text` or a targeted `read_dom` before broad page dumps or navigation.",
      "Before you provide factual information from the page or site, verify it against",
      "a specific source section or page instead of answering from a hunch.",
      "If the user asks you to help find, show, or take them to information, treat",
      "that as a location task first: locate the source section or page, THEN STOP —",
      "the runtime will handle the rest. Do not write a follow-up offer in prose.",
      "",
      "=== SOURCE-NAVIGATION HANDOFF (IMPORTANT) ===",
      "After a successful `search_site` or `find_text` that produces a clear best",
      "match, the RUNTIME — not you — shows the user an inline \"Open it / Not now\"",
      "card. You must NOT:",
      "  • Ask the user 'would you like me to open it?' or 'want me to take you there?'",
      "  • Emit a `dispatch_event` on a link to navigate yourself.",
      "  • Call `search_site` again on a follow-up to re-confirm you found it.",
      "You MAY briefly summarise what you found in one sentence (e.g. \"That's",
      "covered on the FAQ page under the permissions answer.\") and then stop.",
      "Stopping means: produce no more tool calls this turn. The user will click",
      "the card button or type yes/no, and your next turn will either resume on",
      "a new page (for cross-page) or begin after a scroll (for same-page).",
      "",
      "If the source is already on the current page the runtime will auto-scroll",
      "to it — again, stop after the search call produces a match; no further",
      "tool calls needed on your side.",
      "",
      "Do not answer from a weak partial match when the user asked you to find the",
      "source. If `search_site`'s top match has a low score or sits on a broad",
      "body/main selector, it's better to say \"I couldn't find a confident match\"",
      "than to paraphrase a loose hit as if it were the answer.",
      "If the user says 'there', 'that section', or another ambiguous reference and",
      "more than one page or section could fit, ask one short clarifying question",
      "instead of guessing.",
      "Do not navigate away from the current page just because you found a link.",
      "For requests to find examples, prompts, or documentation, inspect the current",
      "page first before proposing a different page.",
      "If you independently decide to click a link or submit a form that leaves the",
      "page (outside of the search-based flow), the `navigate` permission will gate",
      "it and ask the user directly — that is still available when the user's",
      "intent is clearly \"go to page X\" rather than \"find information about X\".",
      "After navigation, re-read the new page before acting further. Use",
      "`scroll_into_view` to bring the relevant answer or section onscreen.",
      "",
      "=== SELECTORS & EVENT TYPES — COMMON MISTAKES ===",
      "Selectors must be plain CSS. The runtime rejects anything else with a",
      "clear error — keep retrying with invalid selectors and the runtime's",
      "circuit breaker will cut you off after a few repeats. Specifically:",
      "  • `:contains(\"...\")` is a jQuery extension, NOT valid CSS. If you",
      "    need to locate by text, call `find_text` first and use the exact",
      "    selector it returns.",
      "  • XPath (strings starting with `//`, `./`, or `(//…)`) is NOT",
      "    supported. CSS only.",
      "  • `:has(:contains(...))` is a composite of the two above and is",
      "    equally invalid.",
      "  • Prefer `#id`, then `tag.class`, then a container-plus-child path.",
      "    Avoid brittle full paths from <body>.",
      "",
      "`dispatch_event` takes `type` — not `event`, `eventType`, or `kind`.",
      "The runtime accepts those as aliases, but the canonical key is `type`,",
      "and the documented examples use it. Required fields:",
      "  • `selector` — non-empty CSS selector string.",
      "  • `type`     — non-empty event name string (e.g. \"click\").",
      "A missing or empty selector or type returns an error — do not retry",
      "the same broken call, fix the shape of the args.",
      "",
      "If a tool result reports `{\"ok\":false,\"error\":\"circuit_breaker\",...}`,",
      "the runtime has detected you're repeating the SAME exact call. Switch",
      "approach: locate with `find_text` / `query_all`, pick a different",
      "selector, try a different tool, or stop and explain the limitation in",
      "plain text.",
      "",
      "If a tool result reports `{\"ok\":false,\"error\":\"circuit_breaker_pattern\",",
      "\"category\":\"invalid-selector\" | \"no-match\", ...}`, you have produced",
      "the same KIND of failure repeatedly even though the selectors differed.",
      "Do not try another variation of the same idea. Follow the `hint` field",
      "verbatim — usually that means: run `find_text` with a plain-text query,",
      "then feed the EXACT selector it returns into your next call.",
      "",
      "Tool formatting. Prefer a single fenced block:",
      "```clippy-tool",
      "{\"tool\":\"read_dom\",\"args\":{\"selector\":\"h1\"}}",
      "```",
      "The runtime also accepts a bare `clippy-tool` line followed by a JSON",
      "object (with or without an inner ```json fence), but one clean fenced",
      "block is easiest to get right.",
      "",
      "Hidden elements (display:none, visibility:hidden) are skipped by",
      "`find_text` and `search_site`, and clicking them via `dispatch_event`",
      "typically does nothing. If you need a panel that's currently hidden,",
      "look for the trigger (button, tab, link) that reveals it first.",
      "",
      "=== WORKFLOW: observe → act → verify ===",
      "1. Observe. Read the relevant region BEFORE acting.",
      "2. Act with the LEAST powerful tool that does the job.",
      "3. Verify. Every tool_result echoes the final state — check it before",
      "   claiming success.",
      "",
      "=== WORKED EXAMPLES ===",
      "",
      "User: \"find the form on this page\"",
      "```clippy-tool",
      "{\"tool\":\"query_all\",\"args\":{\"selector\":\"form\"}}",
      "```",
      "(…then read the interesting one with read_dom.)",
      "",
      "User: \"find the suggested prompts on this page\"",
      "```clippy-tool",
      "{\"tool\":\"find_text\",\"args\":{\"query\":\"suggested test prompts\",\"selector\":\"main\",\"limit\":5}}",
      "```",
      "(then read the best matching section and bring it into view with",
      "`scroll_into_view` rather than only paraphrasing it.)",
      "",
      "User: \"help me find information on why am I seeing permission prompts\"",
      "```clippy-tool",
      "{\"tool\":\"search_site\",\"args\":{\"query\":\"Why am I seeing permission prompts?\",\"limit\":5,\"pageLimit\":8}}",
      "```",
      "(then STOP. The runtime will show the user an Open/Not now card for the best",
      "match. You may add one short sentence after the tool call — e.g. \"That's on",
      "the FAQ page under the permissions answer.\" — but do not emit more tool",
      "calls, do not re-run search_site, and do not ask the user to confirm in prose.",
      "If they click Open, you'll pick up on the destination page scrolled to the",
      "right section.)",
      "",
      "User: \"fill out the contact form with name Jimmy, topic Compliment, and submit it\"",
      "```clippy-tool",
      "{\"tool\":\"read_dom\",\"args\":{\"selector\":\"form\"}}",
      "```",
      "(inspect the fields, then:)",
      "```clippy-tool",
      "{\"tool\":\"modify_element\",\"args\":{\"selector\":\"#f-name\",\"value\":\"Jimmy\"}}",
      "```",
      "```clippy-tool",
      "{\"tool\":\"modify_element\",\"args\":{\"selector\":\"#f-topic\",\"value\":\"Compliment\"}}",
      "```",
      "```clippy-tool",
      "{\"tool\":\"dispatch_event\",\"args\":{\"selector\":\"form\",\"type\":\"submit\"}}",
      "```",
      "",
      "User: \"make the heading red\"",
      "```clippy-tool",
      "{\"tool\":\"modify_element\",\"args\":{\"selector\":\"h1\",\"style\":{\"color\":\"crimson\"}}}",
      "```",
      "",
      "User: \"click the increment button\"",
      "```clippy-tool",
      "{\"tool\":\"dispatch_event\",\"args\":{\"selector\":\"#btn-inc\",\"type\":\"click\"}}",
      "```",
      "",
      "User: \"take me to the FAQ answer about refunds\"",
      "```clippy-tool",
      "{\"tool\":\"search_site\",\"args\":{\"query\":\"refund\",\"limit\":5,\"pageLimit\":8}}",
      "```",
      "(then STOP — the runtime will offer the FAQ page's refund section as a card.",
      "Prefer `search_site` over manually clicking a link: search gives you an anchor",
      "to land on, which the runtime uses to scroll after the page loads.)",
      "",
      "=== STYLE ===",
      "Keep spoken replies short and friendly — the bubble is small. Ideal shape:",
      "one sentence of intent, a burst of tool calls, one line of confirmation",
      "after you see the results. Classic Clippy enthusiasm welcome, sparingly.",
    ].join("\n");
  }

  // Preserved for later reuse — NOT currently wired into DEFAULTS.
  function looksLikeLegacyOperatorPrompt(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    return /RUNNING INSIDE the user's web browser/i.test(value) &&
      /=== HOW TO CALL A TOOL ===/i.test(value);
  }

  function DEFAULT_SYSTEM_PROMPT_MANUAL() {
    return [
      "You are Clippy, a friendly assistant embedded directly in the user's web page.",
      "This message is your operator manual — read it carefully; it describes your body,",
      "your senses, and your tools.",
      "",
      "─── WHO YOU ARE ───",
      "You are a software agent running inside the user's browser, attached to the page",
      "they're currently viewing. You don't see a screenshot; you see (and change) the",
      "page by calling tools. Think of yourself as a pair of eyes and hands wired into",
      "the document. Anything you want to know about the page, you have to ask for;",
      "anything you want to change, you have to do through a tool.",
      "",
      "─── YOUR ENVIRONMENT ───",
      "The page is a live DOM (Document Object Model) — a tree of elements that the",
      "browser renders in real time. Useful facts:",
      "",
      "• Every element has a tag (e.g. 'div', 'h1', 'input'), optionally an id, a list",
      "  of CSS classes, attributes (href, type, data-*, style, ...), children, and text.",
      "• CSS selectors are how you address things:",
      "    'h1'                all h1 elements",
      "    '#main'             the element with id='main'",
      "    '.card'             every element with class 'card'",
      "    'form#x input'      inputs descended from form#x",
      "    'button[type=submit]'  attribute filter",
      "• Form fields (<input>, <textarea>, <select>) have a .value that is SEPARATE from",
      "  their textContent. Setting .value is how you 'type into' them. Setting",
      "  textContent on an <input> visibly does nothing.",
      "• Events drive interactivity. Clicks, submits, focus, keypress, etc. are fired as",
      "  Event objects; handlers registered on elements respond. Writing a new value",
      "  into a field does NOT auto-fire 'input'/'change' — the tool does that for you.",
      "• The page is LIVE. Other scripts or the user can change it under you. If a",
      "  selector that worked before suddenly returns nothing, re-read the DOM instead",
      "  of assuming.",
      "• Some things are hidden from your selectors: content inside <iframe> is a",
      "  separate document you cannot reach with querySelector, and shadow DOM (custom",
      "  elements with a shadow root) encapsulates its children. If you can't find",
      "  something you can see on screen, suspect one of these.",
      "",
      "─── HOW TO WORK: OBSERVE → ACT → VERIFY ───",
      "Always gather information before acting, and check your work after.",
      "",
      "1. OBSERVE. Before you change anything, read the relevant region.",
      "   • read_dom({selector}) for one or a few elements — returns outerHTML, text,",
      "     and (for form fields) .value.",
      "   • query_all({selector}) for a quick index of many matches.",
      "   • Explore broadly first ('form', 'main', 'nav'), then narrow.",
      "",
      "2. ACT. Use the LEAST POWERFUL tool that does the job.",
      "   • Normal page use:  fill fields with modify_element({selector, value}) /",
      "                       checked, and click/submit with dispatch_event.",
      "   • Text or styling:  modify_element with text / style / classAdd / classRemove.",
      "   • Filling forms:    modify_element({selector, value}) for each field. For",
      "                       <select>, 'value' matches an option by value first, then by",
      "                       visible label (case-insensitive), so {value:'Compliment'}",
      "                       works as well as {value:'compliment'}.",
      "   • Clicking/submit:  dispatch_event({selector, type:'click'}) or",
      "                       dispatch_event({selector:'form#x', type:'submit'}) — the",
      "                       submit path runs HTML5 validation AND the form's onsubmit.",
      "   • Scrolling:        scroll_into_view({selector}) to bring the relevant content",
      "                       into view without needing arbitrary JavaScript.",
      "   • Cross-page work:  if a normal click/submit navigates to another page on the",
      "                       same site, your task history is resumed automatically in",
      "                       this tab after the next page loads. If the user refers to",
      "                       'there', 'that section', or another ambiguous target, ask",
      "                       one short clarifying question before leaving the page.",
      "                       Also ask for confirmation in plain text before you",
      "                       navigate to a different page.",
      "   • Adding content:   create_element with an HTML string, positioned relative to",
      "                       a parent.",
      "   • Removing content: remove_element.",
      "   • Escape hatch:     run_js for anything the above can't express (e.g. reading",
      "                       computed styles, iterating a large set with custom logic).",
      "                       Use it LAST, not first — it's opaque to the user.",
      "   • inject_script:    only when you genuinely need code to persist and run on",
      "                       future events (event listeners, intervals). Rare.",
      "",
      "3. VERIFY. Every tool result echoes the final state (updated .value for form",
      "   fields, new outerHTML fragments, etc.). If the result doesn't look right,",
      "   read_dom again to confirm, and course-correct. Don't claim success based on",
      "   hope — claim it based on what the tool returned.",
      "",
      "─── COMMON PATTERNS ───",
      "",
      "Fill a form and submit it:",
      "```clippy-tool",
      "{\"tool\":\"read_dom\",\"args\":{\"selector\":\"form#demo-form\"}}",
      "```",
      "(...inspect the result, then...)",
      "```clippy-tool",
      "{\"tool\":\"modify_element\",\"args\":{\"selector\":\"#f-name\",\"value\":\"Jimmy\"}}",
      "```",
      "```clippy-tool",
      "{\"tool\":\"modify_element\",\"args\":{\"selector\":\"#f-topic\",\"value\":\"Compliment\"}}",
      "```",
      "```clippy-tool",
      "{\"tool\":\"dispatch_event\",\"args\":{\"selector\":\"form#demo-form\",\"type\":\"submit\"}}",
      "```",
      "",
      "Restyle something (prefer classes if the page defines them):",
      "```clippy-tool",
      "{\"tool\":\"modify_element\",\"args\":{\"selector\":\"h1\",\"style\":{\"color\":\"crimson\"}}}",
      "```",
      "",
      "Add a card to the page:",
      "```clippy-tool",
      "{\"tool\":\"create_element\",\"args\":{\"parentSelector\":\"main\",\"position\":\"append\",\"html\":\"<section class='card'><h2>Hi</h2><p>Added by Clippy.</p></section>\"}}",
      "```",
      "",
      "Click a button:",
      "```clippy-tool",
      "{\"tool\":\"dispatch_event\",\"args\":{\"selector\":\"#btn-inc\",\"type\":\"click\"}}",
      "```",
      "",
      "─── TOOL-CALL FORMAT ───",
      "Output fenced JSON blocks tagged `clippy-tool`. You can emit multiple blocks per",
      "turn; the runtime executes them in order and replies with one tool_result per",
      "call in the next user turn. Anything outside the fences is prose the user sees",
      "in your speech bubble.",
      "",
      "─── TOOL REFERENCE ───",
      "(Each tool is gated behind a permission the user has granted. If a call is",
      "denied or ignored, the tool_result contains",
      "{ok:false,error:'denied by user'} or",
      "{ok:false,error:'ignored by permission policy'} — acknowledge briefly and",
      "either try another approach or stop.)",
      "",
      "  read_dom       { selector: string, limit?: number }",
      "  query_all      { selector: string }",
      "  modify_element { selector: string,",
      "                   text?: string,    // textContent for plain elements;",
      "                                     // .value for form fields (alias for 'value')",
      "                   value?: string,   // form-field .value (preferred spelling)",
      "                   checked?: boolean,// checkboxes/radios",
      "                   html?: string,    // replaces innerHTML (drops child listeners)",
      "                   style?: object,   // key/value CSS, camelCased",
      "                   attrs?: object,   // set or remove (null) attributes",
      "                   classAdd?: string[], classRemove?: string[] }",
      "  dispatch_event { selector: string, type: string,",
      "                   bubbles?: boolean, cancelable?: boolean }",
      "  scroll_into_view { selector: string, behavior?: 'auto'|'smooth',",
      "                     block?: 'start'|'center'|'end'|'nearest' }",
      "  create_element { parentSelector: string, html: string,",
      "                   position?: 'append'|'prepend'|'before'|'after' }",
      "  remove_element { selector: string, all?: boolean }",
      "  run_js         { code: string }         // runs in an async IIFE; returns last value",
      "  inject_script  { code: string, id?: string }",
      "  done           { }                      // optional — nothing more to do",
      "",
      "─── STYLE ───",
      "Keep spoken replies short and friendly; the bubble is small. It's fine — even",
      "preferable — to output a brief sentence of intent, then a burst of tool calls,",
      "then a one-line confirmation after you see the results. Don't narrate each step",
      "separately. Clippy-style enthusiasm is welcome sparingly; don't overdo it.",
    ].join("\n");
  }

  function normalizePermissionMode(mode) {
    return mode === "allow" || mode === "prompt" || mode === "ignore" ? mode : null;
  }

  function derivePermissionPolicy(saved = {}) {
    const policy = { ...DEFAULT_PERMISSION_POLICY };
    const explicit = saved && saved.permissionPolicy;
    if (explicit && typeof explicit === "object") {
      for (const key of Object.keys(DEFAULT_PERMISSION_POLICY)) {
        const mode = normalizePermissionMode(explicit[key]);
        if (mode) policy[key] = mode;
      }
      return policy;
    }

    const legacyPerms = { ...LEGACY_DEFAULT_PERMS, ...((saved && saved.perms) || {}) };
    const legacyAlwaysConfirm =
      typeof saved.alwaysConfirm === "boolean" ? saved.alwaysConfirm : DEFAULTS.alwaysConfirm;
    for (const key of Object.keys(DEFAULT_PERMISSION_POLICY)) {
      if (legacyPerms[key]) {
        policy[key] = legacyAlwaysConfirm ? "prompt" : "allow";
      } else if (Object.prototype.hasOwnProperty.call(legacyPerms, key)) {
        policy[key] = "prompt";
      }
    }
    return policy;
  }

  function getPermissionMode(settings, permKey) {
    if (permKey == null) return "allow";
    const mode = settings && settings.permissionPolicy && normalizePermissionMode(settings.permissionPolicy[permKey]);
    return mode || DEFAULT_PERMISSION_POLICY[permKey] || "prompt";
  }

  function setPermissionMode(settings, permKey, mode) {
    if (!settings || permKey == null) return "allow";
    if (!settings.permissionPolicy || typeof settings.permissionPolicy !== "object") {
      settings.permissionPolicy = { ...DEFAULT_PERMISSION_POLICY };
    }
    const normalized = normalizePermissionMode(mode) || DEFAULT_PERMISSION_POLICY[permKey] || "prompt";
    settings.permissionPolicy[permKey] = normalized;
    return normalized;
  }

  function getSelectedCharacterId(settings) {
    const characterId = settings && typeof settings.character === "string"
      ? settings.character.trim()
      : "";
    if (characterId) return characterId;
    const legacyAvatarId = settings && typeof settings.avatar === "string"
      ? settings.avatar.trim()
      : "";
    if (legacyAvatarId) return legacyAvatarId;
    return DEFAULT_CHARACTER_ID;
  }

  function syncCharacterSettingFields(settings) {
    const characterId = getSelectedCharacterId(settings);
    return {
      ...(settings || {}),
      character: characterId,
      avatar: characterId,
    };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const saved = JSON.parse(raw);
      const merged = {
        ...structuredClone(DEFAULTS),
        ...saved,
        perms: { ...LEGACY_DEFAULT_PERMS, ...(saved.perms || {}) },
        permissionPolicy: derivePermissionPolicy(saved),
      };
      // --- Prompt-layer migration ----------------------------------------
      // Older saves stored the entire operator prompt in `systemPrompt`.
      // The visible settings field is now just user directions. Preserve
      // hand-written directions when they do not look like the built-in
      // operator manual; otherwise start with a blank directions field.
      if (typeof saved.userPrompt !== "string") {
        const legacyPrompt = typeof saved.systemPrompt === "string" ? saved.systemPrompt.trim() : "";
        merged.userPrompt = legacyPrompt && !looksLikeLegacyOperatorPrompt(legacyPrompt)
          ? legacyPrompt
          : "";
      }
      merged.systemPrompt = "";
      if (saved.systemPromptVersion !== SYSTEM_PROMPT_VERSION) {
        merged.systemPromptVersion = SYSTEM_PROMPT_VERSION;
        try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch {}
      }
      // --- Provider migration --------------------------------------------
      // Older saves only stored `model` (single text field). Any saved
      // settings without a provider are assumed to be targeting Ollama —
      // that's the only backend the widget could speak to before this
      // migration. The catalog fetch will reconcile the model name later
      // (if it's not in the catalog, the dropdown still lets the user
      // pick something that is).
      if (typeof saved.provider !== "string" || saved.provider === "") {
        merged.provider = DEFAULTS.provider;
      }
      merged.character = getSelectedCharacterId(saved);
      merged.avatar = merged.character;
      merged.knowledgeSources = normalizeKnowledgeSources(saved.knowledgeSources);
      return syncCharacterSettingFields(merged);
    } catch { return structuredClone(DEFAULTS); }
  }
  function saveSettings(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(syncCharacterSettingFields(s))); } catch {}
  }

  // ---------- User-added models ----------
  // Kept separate from `settings` because they're catalog data, not user
  // preferences, and because we re-merge them every time the catalog is
  // refreshed. Load/save are one-shot; callers pass the whole map.
  function loadUserModels() {
    try {
      const raw = localStorage.getItem(LS_MODELS_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : {};
    } catch { return {}; }
  }
  function saveUserModels(map) {
    try { localStorage.setItem(LS_MODELS_KEY, JSON.stringify(map || {})); } catch {}
  }
  function loadRuntimeSession() {
    try {
      const raw = sessionStorage.getItem(SS_RUNTIME_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : null;
    } catch { return null; }
  }
  function saveRuntimeSession(state) {
    try {
      if (!state) sessionStorage.removeItem(SS_RUNTIME_KEY);
      else sessionStorage.setItem(SS_RUNTIME_KEY, JSON.stringify(state));
    } catch {}
  }
  function clearPersistedBrowserState() {
    try { localStorage.removeItem(LS_KEY); } catch {}
    try { localStorage.removeItem(LS_POS_KEY); } catch {}
    try { localStorage.removeItem(LS_MODELS_KEY); } catch {}
    try { sessionStorage.removeItem(SS_RUNTIME_KEY); } catch {}
  }
  async function copyTextToClipboard(text) {
    const value = String(text || "");
    if (!value) throw new Error("Debug log is empty.");
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try {
      ok = !!document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
    if (!ok) throw new Error("Clipboard access is unavailable in this browser context.");
  }
  function userModelsFor(map, providerName) {
    return Array.isArray(map && map[providerName]) ? map[providerName] : [];
  }

  // ---------- Character packs ----------
  const DEFAULT_CHARACTER_STATES = {
    intro:      ["intro-a"],
    outro:      ["outro-a"],
    idle:       ["idle-a", "idle-b"],
    thinking:   ["thinking-a", "thinking-b"],
    permission: ["permission-a", "permission-b"],
    acting:     ["acting-a", "acting-b"],
  };
  const DEFAULT_AVATAR_STATES = DEFAULT_CHARACTER_STATES;
  const AUTO_CYCLE_CHARACTER_MODES = new Set(["idle", "thinking"]);
  const AUTO_CYCLE_AVATAR_MODES = AUTO_CYCLE_CHARACTER_MODES;

  function getCharacterPackStore() {
    return window.ClippyCharacterPacks || (window.ClippyCharacterPacks = Object.create(null));
  }

  function findCharacterStyleLink(href) {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find(node => node.href === href || node.dataset.clippyCharacterStyle === href);
  }

  function ensureCharacterPackStyle(styleUrl) {
    if (!styleUrl) return null;
    let href;
    try {
      href = new URL(styleUrl, document.baseURI).href;
    } catch {
      return null;
    }
    const existing = findCharacterStyleLink(href);
    if (existing) return existing;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.clippyCharacterStyle = href;
    (document.head || document.documentElement).appendChild(link);
    return link;
  }

  function resolveCharacterAssetUrl(url) {
    if (!url || typeof url !== "string" || !url.trim()) return null;
    try {
      return new URL(url, document.baseURI).href;
    } catch {
      return url;
    }
  }

  function normalizeCharacterPack(pack) {
    if (!pack || typeof pack !== "object") return null;
    const id = typeof pack.id === "string" ? pack.id.trim() : "";
    const svg = typeof pack.svg === "string" ? pack.svg.trim() : "";
    if (!id || !svg) return null;
    const styleUrl = resolveCharacterAssetUrl(pack.styleUrl);
    const configUrl = resolveCharacterAssetUrl(pack.configUrl);
    const states = { ...DEFAULT_CHARACTER_STATES };
    if (pack.states && typeof pack.states === "object") {
      for (const [mode, variants] of Object.entries(pack.states)) {
        if (Array.isArray(variants) && variants.length) states[mode] = variants.slice();
      }
    }
    return {
      ...pack,
      id,
      label: typeof pack.label === "string" && pack.label.trim() ? pack.label.trim() : id,
      title: typeof pack.title === "string" && pack.title.trim() ? pack.title.trim() : ((typeof pack.label === "string" && pack.label.trim()) ? pack.label.trim() : id),
      svg,
      styleUrl,
      configUrl,
      config: pack.config && typeof pack.config === "object" ? { ...pack.config } : null,
      states,
      transitions: { ...(pack.transitions || {}) },
    };
  }

  function registerCharacterPack(pack) {
    const normalized = normalizeCharacterPack(pack);
    if (!normalized) return null;
    const store = getCharacterPackStore();
    store[normalized.id] = normalized;
    return normalized;
  }

  function primeCharacterPackRegistry() {
    const store = getCharacterPackStore();
    for (const key of Object.keys(store)) {
      const normalized = normalizeCharacterPack(store[key]);
      if (!normalized) {
        delete store[key];
        continue;
      }
      if (normalized.id !== key) delete store[key];
      store[normalized.id] = normalized;
    }
    return store;
  }

  const CHARACTERS = getCharacterPackStore();
  const AVATARS = CHARACTERS;
  const CHARACTER_CONFIG_CACHE = new Map();

  function listCharacterDefinitions() {
    return Object.values(primeCharacterPackRegistry());
  }

  function getCharacterDefinition(id) {
    const store = primeCharacterPackRegistry();
    if (id && store[id]) return store[id];
    const defs = Object.values(store);
    return defs[0] || null;
  }

  function getCharacterStates(character, mode) {
    if (!character) return DEFAULT_CHARACTER_STATES[mode] || [mode];
    return (character.states && character.states[mode]) || DEFAULT_CHARACTER_STATES[mode] || [mode];
  }

  function buildDefaultCharacterConfig(character) {
    const title = (character && (character.title || character.label || character.id)) || "Clippy";
    return {
      systemPrompt: DEFAULT_SYSTEM_PROMPT(title),
      userPromptLabel: `Directions for ${title}`,
      userPromptPlaceholder: `Tell ${title} how you want it to behave on this site or page.`,
      settings: {},
    };
  }

  function normalizeCharacterConfig(config, character) {
    const fallback = buildDefaultCharacterConfig(character);
    if (!config || typeof config !== "object") return fallback;
    return {
      ...fallback,
      ...config,
      systemPrompt: typeof config.systemPrompt === "string" && config.systemPrompt.trim()
        ? config.systemPrompt.trim()
        : fallback.systemPrompt,
      userPromptLabel: typeof config.userPromptLabel === "string" && config.userPromptLabel.trim()
        ? config.userPromptLabel.trim()
        : fallback.userPromptLabel,
      userPromptPlaceholder: typeof config.userPromptPlaceholder === "string" && config.userPromptPlaceholder.trim()
        ? config.userPromptPlaceholder.trim()
        : fallback.userPromptPlaceholder,
      settings: config.settings && typeof config.settings === "object"
        ? { ...config.settings }
        : fallback.settings,
    };
  }

  async function loadCharacterConfig(character) {
    if (!character) return buildDefaultCharacterConfig(character);
    if (character.config) return normalizeCharacterConfig(character.config, character);
    const cacheKey = character.id || character.configUrl || "__default__";
    if (CHARACTER_CONFIG_CACHE.has(cacheKey)) {
      return CHARACTER_CONFIG_CACHE.get(cacheKey);
    }
    const promise = (async () => {
      if (!character.configUrl) return buildDefaultCharacterConfig(character);
      try {
        const res = await fetch(character.configUrl, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return normalizeCharacterConfig(data, character);
      } catch {
        return buildDefaultCharacterConfig(character);
      }
    })();
    CHARACTER_CONFIG_CACHE.set(cacheKey, promise);
    return promise;
  }

  function listAvatarDefinitions() {
    return listCharacterDefinitions();
  }

  function getAvatarDefinition(id) {
    return getCharacterDefinition(id);
  }

  function getAvatarStates(avatar, mode) {
    return getCharacterStates(avatar, mode);
  }

  function getAvatarMetaId(meta) {
    return (meta && (meta.characterId || meta.avatarId)) || "";
  }

  function syncAvatarRefs(ui) {
    ui.char = ui.avatarHost ? ui.avatarHost.querySelector(".clippy-char") : null;
    return ui.char;
  }

  function renderAvatar(ui, settings, opts = {}) {
    const characterId = getSelectedCharacterId(settings);
    const avatar = getCharacterDefinition(characterId);
    if (!ui || !ui.avatarHost || !avatar) return avatar;
    ensureCharacterPackStyle(avatar.styleUrl);
    const alreadyRendered = ui.avatarMeta &&
      getAvatarMetaId(ui.avatarMeta) === avatar.id &&
      ui.avatarHost.firstElementChild;
    if (!opts.force && alreadyRendered) {
      if (ui.title) ui.title.textContent = avatar.title || avatar.label || avatar.id;
      if (ui.bubble) ui.bubble.setAttribute("aria-label", avatar.title || avatar.label || avatar.id);
      if (ui.input) ui.input.placeholder = `Ask ${avatar.title || avatar.label || "your assistant"}... (Enter to send, Shift+Enter for newline)`;
      if (ui.confirmTitle) ui.confirmTitle.textContent = `${avatar.title || avatar.label || avatar.id} wants permission:`;
      if (ui.confirmTool) ui.confirmTool.textContent = "";
      syncAvatarRefs(ui);
      return avatar;
    }
    ui.avatarHost.innerHTML = avatar.svg;
    ui.avatarHost.dataset.character = avatar.id;
    ui.avatarHost.dataset.avatar = avatar.id;
    ui.avatarHost.dataset.characterMode = "";
    ui.avatarHost.dataset.avatarMode = "";
    ui.avatarHost.dataset.characterState = "";
    ui.avatarHost.dataset.avatarState = "";
    if (ui.title) ui.title.textContent = avatar.title || avatar.label || avatar.id;
    if (ui.bubble) ui.bubble.setAttribute("aria-label", avatar.title || avatar.label || avatar.id);
    if (ui.input) ui.input.placeholder = `Ask ${avatar.title || avatar.label || "your assistant"}... (Enter to send, Shift+Enter for newline)`;
    if (ui.confirmTitle) ui.confirmTitle.textContent = `${avatar.title || avatar.label || avatar.id} wants permission:`;
    if (ui.confirmTool) ui.confirmTool.textContent = "";
    syncAvatarRefs(ui);
    ui.avatarMeta = { characterId: avatar.id, avatarId: avatar.id, mode: "", state: "" };
    return avatar;
  }

  function nextAvatarState(ui, avatar, mode) {
    const variants = getAvatarStates(avatar, mode);
    if (!variants.length) return mode;
    if (!ui.avatarStateCounts) ui.avatarStateCounts = Object.create(null);
    const key = `${avatar.id}:${mode}`;
    const idx = ui.avatarStateCounts[key] || 0;
    ui.avatarStateCounts[key] = idx + 1;
    return variants[idx % variants.length];
  }

  function clearAvatarVariantTimer(ui) {
    if (!ui) return;
    if (ui.avatarVariantTimer) {
      clearTimeout(ui.avatarVariantTimer);
      ui.avatarVariantTimer = null;
    }
    if (ui.avatarVariantChar && ui.avatarVariantIterationHandler) {
      ui.avatarVariantChar.removeEventListener("animationiteration", ui.avatarVariantIterationHandler);
    }
    ui.avatarVariantChar = null;
    ui.avatarVariantIterationHandler = null;
  }

  function clearAvatarTransition(ui) {
    if (!ui) return;
    ui.avatarTransitionActive = false;
    if (ui.avatarTransitionTimer) {
      clearTimeout(ui.avatarTransitionTimer);
      ui.avatarTransitionTimer = null;
    }
    ui.avatarTransitionToken = (ui.avatarTransitionToken || 0) + 1;
  }

  function getAvatarTransitionDuration(avatar, mode) {
    if (!avatar || !avatar.transitions) return 720;
    return Number(avatar.transitions[mode]) || 720;
  }

  function scheduleAvatarVariantRotation(ui, settings, avatar, mode) {
    if (!ui) return;
    if (!AUTO_CYCLE_CHARACTER_MODES.has(mode)) {
      clearAvatarVariantTimer(ui);
      return;
    }
    ui.avatarVariantSettings = settings;
    const char = syncAvatarRefs(ui);
    if (!char || ui.avatarVariantChar === char) return;
    if (ui.avatarVariantChar && ui.avatarVariantIterationHandler) {
      ui.avatarVariantChar.removeEventListener("animationiteration", ui.avatarVariantIterationHandler);
    }
    const onIteration = (event) => {
      if (event.target !== char) return;
      const current = ui.avatarMeta || {};
      const currentAvatar = getAvatarDefinition(getAvatarMetaId(current));
      const currentVariants = getAvatarStates(currentAvatar, current.mode);
      if (!AUTO_CYCLE_CHARACTER_MODES.has(current.mode) || currentVariants.length < 2) return;
      setAvatarMode(ui, ui.avatarVariantSettings || settings, current.mode, { force: true });
    };
    char.addEventListener("animationiteration", onIteration);
    ui.avatarVariantChar = char;
    ui.avatarVariantIterationHandler = onIteration;
  }

  function setAvatarMode(ui, settings, mode, opts = {}) {
    const avatar = renderAvatar(ui, settings);
    if (!avatar || !ui || !ui.avatarHost) return mode;
    const variants = getAvatarStates(avatar, mode);
    let state = opts.state;
    const current = ui.avatarMeta || {};
    if (!state || !variants.includes(state)) {
      const keepCurrent = !opts.force &&
        getAvatarMetaId(current) === avatar.id &&
        current.mode === mode &&
        current.state &&
        variants.includes(current.state);
      state = keepCurrent ? current.state : nextAvatarState(ui, avatar, mode);
    }
    if (!opts.force &&
        getAvatarMetaId(current) === avatar.id &&
        current.mode === mode &&
        current.state === state) {
      scheduleAvatarVariantRotation(ui, settings, avatar, mode);
      return state;
    }
    ui.avatarHost.dataset.character = avatar.id;
    ui.avatarHost.dataset.avatar = avatar.id;
    ui.avatarHost.dataset.characterMode = mode;
    ui.avatarHost.dataset.avatarMode = mode;
    ui.avatarHost.dataset.characterState = state;
    ui.avatarHost.dataset.avatarState = state;
    ui.avatarMeta = { characterId: avatar.id, avatarId: avatar.id, mode, state };
    scheduleAvatarVariantRotation(ui, settings, avatar, mode);
    return state;
  }

  function restoreDesiredAvatarMode(ui, settings) {
    if (!ui) return;
    const desired = ui.avatarDesired || { text: "", thinking: false, avatarMode: "idle" };
    setStatus(ui, desired.text || "", !!desired.thinking, settings, desired.avatarMode);
  }

  function playAvatarModeOnce(ui, settings, avatarId, mode, opts = {}) {
    if (!ui) return;
    clearAvatarTransition(ui);
    ui.avatarTransitionActive = true;
    const renderSettings = avatarId
      ? syncCharacterSettingFields({ ...settings, character: avatarId, avatar: avatarId })
      : syncCharacterSettingFields(settings);
    const avatar = getAvatarDefinition(getSelectedCharacterId(renderSettings));
    const token = (ui.avatarTransitionToken || 0) + 1;
    ui.avatarTransitionToken = token;
    setAvatarMode(ui, renderSettings, mode, { force: true, state: `${mode}-a` });
    const duration = opts.duration || getAvatarTransitionDuration(avatar, mode);
    ui.avatarTransitionTimer = setTimeout(() => {
      if (ui.avatarTransitionToken !== token) return;
      ui.avatarTransitionTimer = null;
      ui.avatarTransitionActive = false;
      if (typeof opts.onComplete === "function") {
        opts.onComplete();
        return;
      }
      restoreDesiredAvatarMode(ui, settings);
    }, duration);
  }

  function playAvatarIntro(ui, settings, avatarId) {
    playAvatarModeOnce(ui, settings, avatarId || getSelectedCharacterId(settings), "intro");
  }

  function playAvatarOutro(ui, settings, avatarId) {
    playAvatarModeOnce(ui, settings, avatarId || getSelectedCharacterId(settings), "outro");
  }

  function transitionAvatarChange(ui, previousAvatarId, settings) {
    if (!ui) return;
    const nextAvatarId = getSelectedCharacterId(settings);
    if (!previousAvatarId || previousAvatarId === nextAvatarId) {
      playAvatarIntro(ui, settings);
      return;
    }
    clearAvatarTransition(ui);
    const previousAvatar = getAvatarDefinition(previousAvatarId);
    const nextAvatar = getAvatarDefinition(nextAvatarId);
    const token = (ui.avatarTransitionToken || 0) + 1;
    ui.avatarTransitionToken = token;
    ui.avatarTransitionActive = true;
    setAvatarMode(ui, { ...settings, character: previousAvatarId, avatar: previousAvatarId }, "outro", { force: true, state: "outro-a" });
    ui.avatarTransitionTimer = setTimeout(() => {
      if (ui.avatarTransitionToken !== token) return;
      renderAvatar(ui, settings, { force: true });
      setAvatarMode(ui, settings, "intro", { force: true, state: "intro-a" });
      ui.avatarTransitionTimer = setTimeout(() => {
        if (ui.avatarTransitionToken !== token) return;
        ui.avatarTransitionTimer = null;
        ui.avatarTransitionActive = false;
        restoreDesiredAvatarMode(ui, settings);
      }, getAvatarTransitionDuration(nextAvatar, "intro"));
    }, getAvatarTransitionDuration(previousAvatar, "outro"));
  }

  const KNOWLEDGE_CHUNK_TARGET = 1100;
  const KNOWLEDGE_TOP_K = 4;
  const KNOWLEDGE_MAX_CONTEXT_CHARS = 3600;
  const KNOWLEDGE_STOP_WORDS = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "your",
    "have", "will", "when", "what", "where", "how", "about", "just",
    "then", "than", "them", "they", "page", "clippy", "assistant",
  ]);
  function normalizeKnowledgeSources(value) {
    const arr = Array.isArray(value)
      ? value
      : (value == null ? [] : [value]);
    const out = [];
    const seen = new Set();
    for (const item of arr) {
      const parts = String(item || "")
        .split(/\r?\n|,/)
        .map(part => part.trim())
        .filter(Boolean);
      for (const src of parts) {
        if (seen.has(src)) continue;
        seen.add(src);
        out.push(src);
      }
    }
    return out;
  }
  function parseKnowledgeSourcesInput(text) {
    return normalizeKnowledgeSources(
      String(text || "")
        .split(/\r?\n/)
        .flatMap(line => line.split(","))
        .map(line => line.trim())
    );
  }
  function formatKnowledgeSourcesInput(sources) {
    return normalizeKnowledgeSources(sources).join("\n");
  }
  function resolveKnowledgeSource(source) {
    try {
      return new URL(source, document.baseURI).href;
    } catch {
      return null;
    }
  }
  function tokenizeKnowledgeText(text) {
    const matches = String(text || "").toLowerCase().match(/[a-z0-9_#.-]{2,}/g) || [];
    const out = [];
    for (const token of matches) {
      if (KNOWLEDGE_STOP_WORDS.has(token)) continue;
      out.push(token);
    }
    return out;
  }
  function splitMarkdownKnowledge(md, source, href) {
    const text = String(md || "").replace(/\r\n?/g, "\n").trim();
    if (!text) return [];
    const lines = text.split("\n");
    const sections = [];
    let heading = "";
    let buf = [];
    const pushSection = () => {
      const body = buf.join("\n").trim();
      if (!body && !heading) return;
      sections.push({ heading, body });
      buf = [];
    };
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (m) {
        pushSection();
        heading = m[2].trim();
        continue;
      }
      buf.push(line);
    }
    pushSection();
    if (!sections.length) sections.push({ heading: "", body: text });

    const chunks = [];
    let index = 0;
    const emitChunk = (headingText, bodyText) => {
      const body = String(bodyText || "").trim();
      if (!body) return;
      const combined = headingText ? `# ${headingText}\n\n${body}` : body;
      chunks.push({
        source,
        href,
        heading: headingText || "",
        index: index++,
        text: combined,
        tokens: new Set(tokenizeKnowledgeText(combined)),
      });
    };

    for (const section of sections) {
      const paragraphs = String(section.body || "")
        .split(/\n{2,}/)
        .map(part => part.trim())
        .filter(Boolean);
      if (!paragraphs.length) {
        if (section.heading) emitChunk(section.heading, "");
        continue;
      }
      let current = "";
      for (const paragraph of paragraphs) {
        const next = current ? `${current}\n\n${paragraph}` : paragraph;
        if (current && next.length > KNOWLEDGE_CHUNK_TARGET) {
          emitChunk(section.heading, current);
          current = paragraph;
        } else if (!current && paragraph.length > KNOWLEDGE_CHUNK_TARGET) {
          for (let start = 0; start < paragraph.length; start += KNOWLEDGE_CHUNK_TARGET) {
            emitChunk(section.heading, paragraph.slice(start, start + KNOWLEDGE_CHUNK_TARGET));
          }
          current = "";
        } else {
          current = next;
        }
      }
      emitChunk(section.heading, current);
    }
    return chunks;
  }
  function buildKnowledgeQuery(history) {
    const recentUserTurns = (history || [])
      .filter(msg => msg.role === "user" && !/^\[tool_result:/i.test(String(msg.content || "").trim()))
      .slice(-3)
      .map(msg => msg.content);
    return [document.title || "", location.pathname || "", ...recentUserTurns].join("\n");
  }
  function scoreKnowledgeChunk(chunk, queryTokens) {
    let score = 0;
    if (!chunk || !chunk.tokens) return score;
    for (const token of queryTokens) {
      if (!chunk.tokens.has(token)) continue;
      score += 1;
      if (chunk.heading && chunk.heading.toLowerCase().includes(token)) score += 2;
    }
    if (chunk.index === 0) score += 0.15;
    return score;
  }
  function buildKnowledgeContext(knowledgeBase, history) {
    if (!knowledgeBase || !knowledgeBase.chunks || !knowledgeBase.chunks.length) return "";
    const queryTokens = tokenizeKnowledgeText(buildKnowledgeQuery(history));
    const ranked = knowledgeBase.chunks
      .map(chunk => ({ chunk, score: scoreKnowledgeChunk(chunk, queryTokens) }))
      .sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index);
    const picked = [];
    let usedChars = 0;
    for (const entry of ranked) {
      if (picked.length >= KNOWLEDGE_TOP_K) break;
      if (queryTokens.length && entry.score <= 0) continue;
      const extra = entry.chunk.text.length;
      if (picked.length && usedChars + extra > KNOWLEDGE_MAX_CONTEXT_CHARS) break;
      picked.push(entry.chunk);
      usedChars += extra;
    }
    if (!picked.length) {
      for (const chunk of knowledgeBase.chunks.slice(0, 2)) {
        if (picked.length && usedChars + chunk.text.length > KNOWLEDGE_MAX_CONTEXT_CHARS) break;
        picked.push(chunk);
        usedChars += chunk.text.length;
      }
    }
    if (!picked.length) return "";
    return [
      "=== PAGE KNOWLEDGE (Markdown) ===",
      "The page author provided these Markdown notes as background for this page. Use them as guidance, but trust live DOM reads over stale documentation.",
      ...picked.map((chunk, i) => {
        const label = chunk.heading
          ? `${chunk.source} — ${chunk.heading}`
          : chunk.source;
        return `[Knowledge ${i + 1}: ${label}]\n${chunk.text}`;
      }),
    ].join("\n\n");
  }

  // ---------- DOM helpers ----------
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  const TEXT_SEARCH_STOPWORDS = new Set([
    "a", "an", "and", "are", "at", "be", "for", "from", "how", "i", "if",
    "in", "is", "it", "me", "my", "of", "on", "or", "please", "some",
    "somewhere", "that", "the", "there", "this", "to", "what", "where",
    "with", "you",
  ]);
  const TEXT_SEARCH_SYNONYMS = {
    prompt: ["ask", "asking", "example", "examples", "idea", "ideas", "suggestion", "suggestions", "try"],
    prompts: ["ask", "asking", "example", "examples", "idea", "ideas", "prompt", "suggestion", "suggestions", "try"],
    sample: ["example", "examples", "try"],
    samples: ["example", "examples", "sample", "try"],
    suggested: ["example", "examples", "idea", "ideas", "suggestion", "suggestions", "try"],
    suggestion: ["example", "examples", "idea", "ideas", "suggested", "suggestions", "try"],
    suggestions: ["example", "examples", "idea", "ideas", "suggested", "suggestion", "try"],
    test: ["demo", "example", "examples", "try"],
    tests: ["demo", "example", "examples", "test", "try"],
  };
  const TEXT_SEARCH_SELECTOR = "section, article, aside, nav, form, header, footer, main, li, p, div, h1, h2, h3, h4, h5, h6";
  function normalizeSearchText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[\u2018\u2019\u201c\u201d"'`?!.:,;()[\]{}<>/\\|+-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function tokenizeSearchQuery(query) {
    const base = normalizeSearchText(query)
      .split(/[^a-z0-9]+/)
      .filter(token => token && token.length > 1 && !TEXT_SEARCH_STOPWORDS.has(token));
    const expanded = [];
    for (const token of base) {
      expanded.push(token);
      if (token.endsWith("s") && token.length > 3) expanded.push(token.slice(0, -1));
      const synonyms = TEXT_SEARCH_SYNONYMS[token];
      if (synonyms) expanded.push(...synonyms);
    }
    return Array.from(new Set(expanded));
  }
  function cssEscapeIdent(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
  function selectorForNode(node, stopAtNode) {
    if (!node || node.nodeType !== 1) return "";
    if (node.id) return `#${cssEscapeIdent(node.id)}`;
    const parts = [];
    let current = node;
    const boundary = stopAtNode || (node.ownerDocument && node.ownerDocument.body) || document.body;
    while (current && current.nodeType === 1 && current !== boundary) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part = `#${cssEscapeIdent(current.id)}`;
        parts.unshift(part);
        break;
      }
      const classNames = current.classList ? Array.from(current.classList).slice(0, 2) : [];
      if (classNames.length) {
        part += classNames.map(cls => `.${cssEscapeIdent(cls)}`).join("");
      } else if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children)
          .filter(sibling => sibling.tagName === current.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }
  function getSearchHeading(node) {
    if (!node || node.nodeType !== 1) return "";
    if (/^h[1-6]$/i.test(node.tagName || "")) return (node.textContent || "").trim();
    const heading = node.querySelector && node.querySelector("h1, h2, h3, h4, h5, h6");
    return heading ? (heading.textContent || "").trim() : "";
  }
  function isInsideClippyWidget(node) {
    const root = document.getElementById("clippy-root");
    return !!(root && node && node.nodeType === 1 && root.contains(node));
  }
  function extractSearchText(node) {
    if (!node) return "";
    const clippyRoot = document.getElementById("clippy-root");
    if (!clippyRoot || !node.contains || !node.contains(clippyRoot)) {
      return (node.textContent || "").replace(/\s+/g, " ").trim();
    }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const parts = [];
    let current;
    while ((current = walker.nextNode())) {
      const parent = current.parentElement || current.parentNode;
      if (parent && clippyRoot.contains(parent)) continue;
      const value = String(current.nodeValue || "").trim();
      if (value) parts.push(value);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  function scoreTextSearch(normalizedText, tokens, normalizedQuery) {
    if (!normalizedText || !tokens.length) return 0;
    let score = 0;
    if (normalizedQuery && normalizedText.includes(normalizedQuery)) score += 8;
    let matchedTerms = 0;
    for (const token of tokens) {
      if (!token) continue;
      const hits = normalizedText.split(token).length - 1;
      if (hits > 0) {
        matchedTerms += 1;
        score += Math.min(hits, 3) * 2;
      }
    }
    if (matchedTerms >= Math.min(tokens.length, 2)) score += 3;
    score -= Math.min(normalizedText.length / 1200, 2);
    return score;
  }
  // Hidden-element filter for find_text / search_site. Real testing on
  // RealmKit surfaced a bug where a `display:none` panel (#rk-storybuilder)
  // matched a text search because `textContent` walks hidden subtrees — the
  // model then tried to dispatch_event on the invisible element and the
  // click did nothing. A text search should mean "text the user can
  // actually see". For fetched docs (search_site uses DOMParser, no layout)
  // we can only inspect inline style / hidden attribute, which is
  // sufficient for the common case.
  function isLiveElementHidden(node) {
    if (!node || node.nodeType !== 1) return false;
    try {
      if (node.hidden) return true;
      const cs = window.getComputedStyle(node);
      if (!cs) return false;
      if (cs.display === "none") return true;
      if (cs.visibility === "hidden" || cs.visibility === "collapse") return true;
      // Some sites stash hidden panels off-screen with opacity:0 + zero
      // hit box. Only treat as hidden when offset dims are also zero so
      // fixed-position overlays don't get miscategorized.
      if (cs.opacity === "0" && node.offsetWidth === 0 && node.offsetHeight === 0) return true;
    } catch {}
    return false;
  }
  function isParsedElementHidden(node) {
    if (!node || node.nodeType !== 1) return false;
    try {
      if (node.hasAttribute && node.hasAttribute("hidden")) return true;
      const style = node.getAttribute && node.getAttribute("style");
      if (style && /(^|;)\s*display\s*:\s*none\b/i.test(style)) return true;
      if (style && /(^|;)\s*visibility\s*:\s*(hidden|collapse)\b/i.test(style)) return true;
    } catch {}
    return false;
  }
  function isNodeHiddenForSearch(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.ownerDocument === document) return isLiveElementHidden(node);
    return isParsedElementHidden(node);
  }
  function collectTextMatches(root, query, options = {}) {
    const {
      limit = 5,
      pageUrl = "",
      pageTitle = "",
      includeElement = true,
    } = options;
    if (!root) return [];
    const normalizedQuery = normalizeSearchText(query);
    const tokens = tokenizeSearchQuery(query);
    if (!normalizedQuery && !tokens.length) return [];
    const seen = new Set();
    const candidates = [];
    const nodes = [root, ...Array.from(root.querySelectorAll(TEXT_SEARCH_SELECTOR))];
    for (const node of nodes) {
      if (!node || node.nodeType !== 1) continue;
      if (node.ownerDocument === document && isInsideClippyWidget(node)) continue;
      // Skip display:none / visibility:hidden / hidden nodes. Text search
      // is about what the user can see; hidden panels confuse the model
      // into dispatching clicks on invisible controls.
      if (isNodeHiddenForSearch(node)) continue;
      const tag = (node.tagName || "").toLowerCase();
      if (["html", "head", "script", "style", "noscript", "template"].includes(tag)) continue;
      const text = node.ownerDocument === document ? extractSearchText(node) : (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 24 || text.length > 1800) continue;
      const normalizedText = normalizeSearchText(text);
      let score = scoreTextSearch(normalizedText, tokens, normalizedQuery);
      const heading = getSearchHeading(node) || null;
      const normalizedHeading = normalizeSearchText(heading || "");
      if (heading) score += 1.5;
      if (normalizedQuery && normalizedHeading && normalizedHeading.includes(normalizedQuery)) score += 12;
      if (node.id) score += 0.6;
      if (node.classList && node.classList.contains("card")) score += 1.2;
      if (tag === "section" || tag === "article" || tag === "li") score += 1.4;
      if (tag === "body" || tag === "main" || tag === "div") score -= 1.5;
      if (score <= 0) continue;
      const selectorText = selectorForNode(node, root);
      if (!selectorText || seen.has(selectorText)) continue;
      seen.add(selectorText);
      const match = {
        selector: selectorText,
        heading,
        score: Number(score.toFixed(2)),
        snippet: text.slice(0, 320),
        pageUrl,
        pageTitle,
        anchor: node.id ? `#${node.id}` : "",
        node,
      };
      if (includeElement) match.element = describeNode(node, 180);
      candidates.push(match);
    }
    candidates.sort((a, b) => b.score - a.score || a.snippet.length - b.snippet.length);
    return candidates.slice(0, Math.max(1, Math.min(limit, 10)));
  }
  function collectSameOriginPageUrls(pageLimit = 8) {
    const urls = [];
    const seen = new Set();
    const push = (href) => {
      if (!href || seen.has(href)) return;
      seen.add(href);
      urls.push(href);
    };
    push(location.href);
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    for (const anchor of anchors) {
      const rawHref = anchor.getAttribute("href") || "";
      const target = (anchor.getAttribute("target") || "").trim().toLowerCase();
      if (!rawHref || rawHref.startsWith("#") || /^javascript:/i.test(rawHref) || (target && target !== "_self")) continue;
      try {
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin) continue;
        url.hash = "";
        push(url.href);
      } catch {}
      if (urls.length >= Math.max(1, pageLimit)) break;
    }
    return urls.slice(0, Math.max(1, pageLimit));
  }
  function describeNode(n, maxText = 120) {
    const text = (n.textContent || "").trim().slice(0, maxText);
    const tag = n.tagName ? n.tagName.toLowerCase() : String(n.nodeName);
    const out = {
      tag,
      id: n.id || null,
      classes: n.classList ? Array.from(n.classList) : [],
      text,
    };
    // Surface form-field state so the LLM can verify its writes landed.
    if (tag === "input" || tag === "textarea" || tag === "select") {
      out.value = typeof n.value === "string" ? n.value : null;
      if ("checked" in n) out.checked = !!n.checked;
      if (n.name) out.name = n.name;
      if (n.type) out.type = n.type;
    }
    return out;
  }
  function isFormField(n) {
    const t = n && n.tagName && n.tagName.toLowerCase();
    return t === "input" || t === "textarea" || t === "select";
  }
  function hasOwnEntries(obj) {
    return !!(obj && typeof obj === "object" && Object.keys(obj).length);
  }
  const INTERACTION_EVENTS = new Set(["click", "submit", "focus", "blur"]);
  // Smaller models repeatedly emit `event: "click"` (or `eventType`/`kind`)
  // instead of the documented `type`. Accepting these aliases everywhere
  // the event name is read keeps permission classification, nav-target
  // detection, and the tool itself consistent.
  function getDispatchEventType(args = {}) {
    const raw = args && (args.type || args.event || args.eventType || args.kind);
    return typeof raw === "string" ? raw.toLowerCase() : "";
  }
  // Reject jQuery/XPath-style selectors with guidance that points the model
  // at the right tool. Real models have been observed emitting `:contains()`
  // (jQuery extension) and `//button[...]` (XPath). `document.querySelector`
  // throws a generic "unknown pseudo-class" on these, which the model then
  // retries verbatim. A focused error with a concrete next step breaks the
  // loop faster than `Invalid selector: ...`.
  function validateCssSelector(selector) {
    if (typeof selector !== "string" || !selector.trim()) {
      return "Selector is required (a CSS selector string).";
    }
    const s = selector.trim();
    if (s.startsWith("//") || s.startsWith("(//") || s.startsWith("./")) {
      return "That looks like an XPath expression. Only CSS selectors are supported. " +
        "Use `find_text` to locate the element, then pass a CSS selector like `#id`, `.class`, or `tag.class`.";
    }
    if (/:contains\s*\(/i.test(s)) {
      return "`:contains()` is a jQuery extension and is not a valid CSS selector. " +
        "Use `find_text` with a query string to locate elements by their visible text, " +
        "then dispatch on the returned selector.";
    }
    if (/:has\s*\(\s*:contains/i.test(s)) {
      return "`:has(:contains(...))` is not a valid CSS selector. " +
        "Use `find_text` to locate elements by text, then use the exact selector it returns.";
    }
    return null;
  }
  const PERMISSION_EXPLANATIONS = {
    read: "Inspect the page without changing it.",
    interact: "Fill fields, click controls, and submit forms through the normal UI path.",
    navigate: "Follow links or form submissions to another page. This can leave the current page and may discard unsaved work.",
    modify: "Change page text, styling, classes, or attributes.",
    create: "Add new elements to the page.",
    remove: "Remove elements from the page.",
    runJs: "Run arbitrary JavaScript on the page.",
    inject: "Inject a persistent script into the page.",
  };
  function permissionForModifyElement(args = {}) {
    const node = args.selector ? document.querySelector(args.selector) : null;
    if (!node) return "modify";
    const nodeIsFormField = isFormField(node);
    const writesFormValue =
      (typeof args.value === "string" && nodeIsFormField) ||
      (typeof args.text === "string" && nodeIsFormField);
    const togglesChecked = typeof args.checked === "boolean" && "checked" in node;
    const changesMarkupOrBehavior =
      (typeof args.text === "string" && !nodeIsFormField) ||
      typeof args.html === "string" ||
      hasOwnEntries(args.style) ||
      hasOwnEntries(args.attrs) ||
      (Array.isArray(args.classAdd) && args.classAdd.length > 0) ||
      (Array.isArray(args.classRemove) && args.classRemove.length > 0);
    return (writesFormValue || togglesChecked) && !changesMarkupOrBehavior
      ? "interact"
      : "modify";
  }
  function permissionForDispatchEvent(args = {}) {
    const type = getDispatchEventType(args);
    if ((type === "click" || type === "submit") &&
        summarizeNavigationTarget({ tool: "dispatch_event", args }, { sameOriginOnly: false })) {
      return "navigate";
    }
    return INTERACTION_EVENTS.has(type) ? "interact" : "modify";
  }
  function formatNavigationDetail(nav) {
    if (!nav || !nav.targetUrl) return "";
    try {
      const url = new URL(nav.targetUrl, location.href);
      const path = `${url.pathname}${url.search}${url.hash}`;
      const destination = url.origin === location.origin ? path : `${url.origin}${path}`;
      if (nav.label && nav.label !== nav.targetUrl) {
        return `Destination: ${destination} (${nav.label})`;
      }
      return `Destination: ${destination}`;
    } catch {
      return nav.label ? `Destination: ${nav.targetUrl} (${nav.label})` : `Destination: ${nav.targetUrl}`;
    }
  }
  function formatPermissionAction(call) {
    if (!call || !call.tool) return { headline: "use this page", detail: "" };
    const args = call.args || {};
    if (call.tool === "modify_element") {
      const node = args.selector ? document.querySelector(args.selector) : null;
      const nodeIsFormField = isFormField(node);
      if ((typeof args.value === "string" && nodeIsFormField) ||
          (typeof args.text === "string" && nodeIsFormField)) {
        return {
          headline: "fill in a form field",
          detail: args.selector ? `Field: ${args.selector}` : "Form field update",
        };
      }
      if (typeof args.checked === "boolean" && node && "checked" in node) {
        return {
          headline: args.checked ? "check a form control" : "uncheck a form control",
          detail: args.selector ? `Control: ${args.selector}` : "Form control toggle",
        };
      }
      if (typeof args.html === "string") {
        return {
          headline: "replace part of the page content",
          detail: args.selector ? `Target: ${args.selector}` : "HTML replacement",
        };
      }
      if (hasOwnEntries(args.style)) {
        return {
          headline: "change page styling",
          detail: args.selector ? `Target: ${args.selector}` : "Style update",
        };
      }
      if (hasOwnEntries(args.attrs)) {
        return {
          headline: "change element attributes",
          detail: args.selector ? `Target: ${args.selector}` : "Attribute update",
        };
      }
      if ((Array.isArray(args.classAdd) && args.classAdd.length > 0) ||
          (Array.isArray(args.classRemove) && args.classRemove.length > 0)) {
        return {
          headline: "change element classes",
          detail: args.selector ? `Target: ${args.selector}` : "Class update",
        };
      }
      if (typeof args.text === "string") {
        return {
          headline: "change visible page text",
          detail: args.selector ? `Target: ${args.selector}` : "Text update",
        };
      }
      return {
        headline: "change part of the page",
        detail: args.selector ? `Target: ${args.selector}` : "Element update",
      };
    }
    if (call.tool === "dispatch_event") {
      const type = getDispatchEventType(args);
      const navigation = summarizeNavigationTarget(call, { sameOriginOnly: false });
      if (navigation) {
        return {
          headline: navigation.kind === "form" ? "navigate by submitting a form" : "navigate to another page",
          detail: formatNavigationDetail(navigation),
        };
      }
      const target = args.selector ? `Target: ${args.selector}` : "";
      if (type === "click") return { headline: "click a page control", detail: target };
      if (type === "submit") return { headline: "submit a form", detail: target };
      if (type === "focus") return { headline: "focus a field", detail: target };
      if (type === "blur") return { headline: "leave a field", detail: target };
      return { headline: `trigger the '${type || "event"}' event`, detail: target };
    }
    if (call.tool === "scroll_into_view") {
      return {
        headline: "scroll the page to relevant content",
        detail: args.selector ? `Target: ${args.selector}` : "Scroll target",
      };
    }
    if (call.tool === "create_element") {
      return {
        headline: "add new elements to the page",
        detail: args.parentSelector ? `Parent: ${args.parentSelector}` : "Element creation",
      };
    }
    if (call.tool === "remove_element") {
      return {
        headline: "remove elements from the page",
        detail: args.selector ? `Target: ${args.selector}` : "Element removal",
      };
    }
    if (call.tool === "read_dom") {
      return {
        headline: "read part of the page",
        detail: args.selector ? `Target: ${args.selector}` : "DOM read",
      };
    }
    if (call.tool === "query_all") {
      return {
        headline: "scan the page for matching elements",
        detail: args.selector ? `Selector: ${args.selector}` : "DOM query",
      };
    }
    if (call.tool === "find_text") {
      return {
        headline: "search page text for relevant content",
        detail: args.query ? `Query: ${args.query}` : "Page text search",
      };
    }
    if (call.tool === "search_site") {
      return {
        headline: "search same-site pages for relevant information",
        detail: args.query ? `Query: ${args.query}` : "Site search",
      };
    }
    if (call.tool === "run_js") return { headline: "run JavaScript on the page", detail: "" };
    if (call.tool === "inject_script") return { headline: "inject a persistent script", detail: "" };
    return { headline: `run ${call.tool}`, detail: "" };
  }
  function buildNavigationConfirmationText(nav) {
    const detail = formatNavigationDetail(nav) || "Destination: another page";
    const lead = nav && nav.kind === "form"
      ? "I found a form submission that will leave this page."
      : "I found a page that might help.";
    return `${lead} ${detail}. Do you want me to open it in this tab?`;
  }
  function classifyNavigationReply(text) {
    const value = String(text || "").trim().toLowerCase();
    if (!value) return null;
    if (/^(yes|yep|yeah|sure|ok|okay|do it|go ahead|please do|open it|take me there|navigate there|sounds good)\b/.test(value)) {
      return "approve";
    }
    if (/^(no|nope|nah|don't|do not|stay here|cancel|never mind|nevermind|not now)\b/.test(value)) {
      return "deny";
    }
    return null;
  }
  function isShortNavigationReply(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    return value.split(/\s+/).length <= 5;
  }
  function stripToolBlocks(text) {
    return String(text || "").replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  }
  function assistantOfferedSourceNavigation(history) {
    if (!Array.isArray(history)) return false;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (!entry || entry.role !== "assistant") continue;
      const text = stripToolBlocks(entry.content).toLowerCase();
      if (!text) continue;
      return /(would you like me to take you there|would you like me to open it|would you like me to open that page|want me to take you there|want me to open it|want me to open that page|would you like me to bring it into view|want me to bring it into view)/i.test(text);
    }
    return false;
  }
  function userRequestedSourceNavigation(history) {
    if (!Array.isArray(history)) return false;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (!entry || entry.role !== "user") continue;
      const text = stripToolBlocks(entry.content).toLowerCase();
      if (!text || text.startsWith("[tool_result:") || text.startsWith("[navigation_resume]")) continue;
      return /(help me find|find information|find .* on (this page|this site)|show me|take me to|where .*|bring me to|scroll me to)/i.test(text);
    }
    return false;
  }
  function isBroadSourceSelector(selector) {
    const value = String(selector || "").trim().toLowerCase();
    return !value || value === "body" || value === "main" || value === "html";
  }
  function pickBestSourceMatch(matches = []) {
    if (!Array.isArray(matches) || !matches.length) return null;
    const ranked = matches
      .filter(match => match && (match.selector || match.pageUrl))
      .map(match => {
        let bonus = 0;
        if (match.anchor) bonus += 4;
        if (match.selector && match.selector.startsWith("#")) bonus += 3;
        if (match.heading) bonus += 1.5;
        if (match.pageUrl && match.pageUrl !== location.href) bonus += 1;
        if (match.pageUrl === location.href) bonus += 2;
        if (isBroadSourceSelector(match.selector)) bonus -= 3;
        return { match, rank: (Number(match.score) || 0) + bonus };
      })
      .sort((a, b) => b.rank - a.rank);
    if (!ranked.length) return null;
    const best = ranked[0];
    const currentPageSpecific = ranked.find(entry =>
      entry.match &&
      entry.match.pageUrl === location.href &&
      !isBroadSourceSelector(entry.match.selector));
    if (currentPageSpecific && currentPageSpecific.rank >= best.rank - 4) {
      return currentPageSpecific.match;
    }
    return best.match;
  }
  function capitalizeFirst(text) {
    const value = String(text || "");
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }
  function lowerFirst(text) {
    const value = String(text || "");
    return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
  }

  // ---------- Tool implementations ----------
  const TOOLS = {
    read_dom({ selector, limit = 5 }) {
      const selectorIssue = validateCssSelector(selector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let nodes;
      try { nodes = Array.from(document.querySelectorAll(selector)).slice(0, limit); }
      catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      if (!nodes.length) return { ok: true, matches: 0, note: "No elements match." };
      return {
        ok: true,
        matches: nodes.length,
        elements: nodes.map(n => ({
          ...describeNode(n, 400),
          outerHTML: (n.outerHTML || "").slice(0, 1500),
        })),
      };
    },
    query_all({ selector }) {
      const selectorIssue = validateCssSelector(selector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let nodes;
      try { nodes = Array.from(document.querySelectorAll(selector)); }
      catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      return { ok: true, count: nodes.length, items: nodes.slice(0, 50).map(n => describeNode(n)) };
    },
    find_text({ query, selector = "body", limit = 5 }) {
      const selectorIssue = validateCssSelector(selector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let root;
      try { root = document.querySelector(selector); }
      catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      if (!root) return { ok: false, error: `No element matches ${selector}` };
      if (isInsideClippyWidget(root)) {
        return { ok: false, error: "Search inside Clippy's own UI is not supported." };
      }
      const normalizedQuery = normalizeSearchText(query);
      const tokens = tokenizeSearchQuery(query);
      if (!normalizedQuery && !tokens.length) {
        return { ok: false, error: "Query is empty." };
      }
      const matches = collectTextMatches(root, query, {
        limit,
        pageUrl: location.href,
        pageTitle: document.title || "",
        includeElement: true,
      });
      return {
        ok: true,
        query,
        selector,
        matches,
      };
    },
    async search_site({ query, limit = 5, pageLimit = 8 }) {
      const normalizedQuery = normalizeSearchText(query);
      const tokens = tokenizeSearchQuery(query);
      if (!normalizedQuery && !tokens.length) {
        return { ok: false, error: "Query is empty." };
      }
      const urls = collectSameOriginPageUrls(pageLimit);
      const pageResults = [];
      for (const href of urls) {
        try {
          if (href === location.href) {
            const matches = collectTextMatches(document.body, query, {
              limit,
              pageUrl: href,
              pageTitle: document.title || "",
              includeElement: false,
            });
            pageResults.push(...matches.map(match => ({ ...match, source: "current-page" })));
            continue;
          }
          const res = await fetch(href, { headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1" } });
          if (!res.ok) continue;
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const root = doc.body || doc.documentElement;
          if (!root) continue;
          const matches = collectTextMatches(root, query, {
            limit,
            pageUrl: href,
            pageTitle: doc.title || "",
            includeElement: false,
          });
          pageResults.push(...matches.map(match => ({ ...match, source: "linked-page" })));
        } catch {}
      }
      pageResults.sort((a, b) => b.score - a.score || a.snippet.length - b.snippet.length);
      return {
        ok: true,
        query,
        searchedPages: urls.length,
        matches: pageResults.slice(0, Math.max(1, Math.min(limit, 10))).map(({ node, ...match }) => match),
      };
    },
    modify_element({ selector, text, value, html, style, attrs, classAdd, classRemove, checked }) {
      const selectorIssue = validateCssSelector(selector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let node;
      try { node = document.querySelector(selector); }
      catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      if (!node) return { ok: false, error: `No element matches ${selector}` };

      // For form fields, "text" is an alias for "value" (common LLM phrasing:
      // "set the text of the input"). Writing to textContent on an <input>
      // visibly does nothing, which is exactly the bug we're fixing here.
      let effectiveValue;
      if (typeof value === "string") effectiveValue = value;
      else if (typeof text === "string" && isFormField(node)) effectiveValue = text;

      if (effectiveValue !== undefined) {
        if (node.tagName.toLowerCase() === "select") {
          // Match an option by value first, then by visible label (case-insensitive).
          const target = String(effectiveValue).trim().toLowerCase();
          let matched = false;
          for (const opt of node.options) {
            if (opt.value === effectiveValue) { opt.selected = true; matched = true; break; }
          }
          if (!matched) {
            for (const opt of node.options) {
              if ((opt.textContent || "").trim().toLowerCase() === target) {
                opt.selected = true; matched = true; break;
              }
            }
          }
          if (!matched) {
            return { ok: false, error: `No <option> matched "${effectiveValue}" in ${selector}`,
                     options: Array.from(node.options).map(o => ({ value: o.value, label: (o.textContent || "").trim() })) };
          }
          node.value = node.options[node.selectedIndex].value;
        } else {
          node.value = effectiveValue;
        }
        // Fire the events UIs typically listen for.
        node.dispatchEvent(new Event("input",  { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (typeof text === "string") {
        // Plain text node — set textContent as before.
        node.textContent = text;
      }

      if (typeof checked === "boolean" && "checked" in node) {
        node.checked = checked;
        node.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (typeof html === "string") node.innerHTML = html;
      if (style && typeof style === "object") {
        for (const [k, v] of Object.entries(style)) node.style[k] = v;
      }
      if (attrs && typeof attrs === "object") {
        for (const [k, v] of Object.entries(attrs)) {
          if (v == null) node.removeAttribute(k);
          else node.setAttribute(k, String(v));
        }
      }
      if (Array.isArray(classAdd)) classAdd.forEach(c => node.classList.add(c));
      if (Array.isArray(classRemove)) classRemove.forEach(c => node.classList.remove(c));
      return { ok: true, applied: describeNode(node) };
    },
    dispatch_event(rawArgs = {}) {
      // Small models (gemma4:e2b/e4b) consistently emit `event: "click"`
      // instead of `type: "click"` here, because "dispatch_event"
      // semantically suggests `event` as the parameter name. Accept both
      // rather than silently falling through to a useless generic
      // Event(undefined) that tricked the model into thinking the click
      // worked. Same for missing selectors — return a clear error instead
      // of `No element matches undefined`.
      const selector = rawArgs.selector;
      const rawType = rawArgs.type || rawArgs.event || rawArgs.eventType || rawArgs.kind;
      const bubbles = rawArgs.bubbles !== undefined ? rawArgs.bubbles : true;
      const cancelable = rawArgs.cancelable !== undefined ? rawArgs.cancelable : true;
      const init = rawArgs.init;
      if (typeof selector !== "string" || !selector.trim()) {
        return {
          ok: false,
          error: "dispatch_event requires `selector` (a CSS selector). Example: {\"selector\":\"#my-button\",\"type\":\"click\"}",
        };
      }
      if (typeof rawType !== "string" || !rawType.trim()) {
        return {
          ok: false,
          error: "dispatch_event requires `type` (e.g. 'click', 'submit', 'focus', 'blur', 'keydown'). Example: {\"selector\":\"#my-button\",\"type\":\"click\"}",
        };
      }
      const selectorIssue = validateCssSelector(selector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let node;
      try { node = document.querySelector(selector); }
      catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      if (!node) return { ok: false, error: `No element matches ${selector}` };
      const type = String(rawType).toLowerCase();
      try {
        if (type === "click" && typeof node.click === "function") {
          node.click();
          return { ok: true, dispatched: "click", on: describeNode(node) };
        }
        if (type === "submit" && node.tagName && node.tagName.toLowerCase() === "form") {
          if (typeof node.requestSubmit === "function") node.requestSubmit();
          else node.submit();
          return { ok: true, dispatched: "submit", on: describeNode(node) };
        }
        if (type === "focus" && typeof node.focus === "function") { node.focus(); return { ok: true, dispatched: "focus" }; }
        if (type === "blur"  && typeof node.blur  === "function") { node.blur();  return { ok: true, dispatched: "blur"  }; }
        // Generic dispatch. `init` (optional) is forwarded to the Event constructor.
        const ev = new Event(type, { bubbles, cancelable, ...(init || {}) });
        const result = node.dispatchEvent(ev);
        return { ok: true, dispatched: type, defaultPrevented: !result, on: describeNode(node) };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    },
    scroll_into_view({ selector, behavior = "smooth", block = "center", inline = "nearest" }) {
      const selectorIssue = validateCssSelector(selector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let node;
      try { node = document.querySelector(selector); }
      catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      if (!node) return { ok: false, error: `No element matches ${selector}` };
      const safeBehavior = behavior === "auto" ? "auto" : "smooth";
      const safeBlock = ["start", "center", "end", "nearest"].includes(block) ? block : "center";
      const safeInline = ["start", "center", "end", "nearest"].includes(inline) ? inline : "nearest";
      try {
        node.scrollIntoView({ behavior: safeBehavior, block: safeBlock, inline: safeInline });
        return { ok: true, scrolled: describeNode(node), behavior: safeBehavior, block: safeBlock, inline: safeInline };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    },
    create_element({ parentSelector, html, position = "append" }) {
      const selectorIssue = validateCssSelector(parentSelector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let parent;
      try { parent = document.querySelector(parentSelector); }
      catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      if (!parent) return { ok: false, error: `No parent matches ${parentSelector}` };
      const frag = document.createRange().createContextualFragment(html);
      const created = Array.from(frag.children).map(describeNode);
      switch (position) {
        case "prepend": parent.prepend(frag); break;
        case "before":  parent.parentNode.insertBefore(frag, parent); break;
        case "after":   parent.parentNode.insertBefore(frag, parent.nextSibling); break;
        case "append":
        default:        parent.appendChild(frag); break;
      }
      return { ok: true, created };
    },
    remove_element({ selector, all = false }) {
      const selectorIssue = validateCssSelector(selector);
      if (selectorIssue) return { ok: false, error: selectorIssue };
      let nodes;
      try {
        nodes = all
          ? Array.from(document.querySelectorAll(selector))
          : [document.querySelector(selector)].filter(Boolean);
      } catch (e) { return { ok: false, error: `Invalid selector: ${String(e && e.message || e)}` }; }
      if (!nodes.length) return { ok: false, error: `No element matches ${selector}` };
      // refuse to delete the Clippy root
      const clippyRoot = document.getElementById("clippy-root");
      for (const n of nodes) if (clippyRoot && clippyRoot.contains(n)) {
        return { ok: false, error: "Refusing to remove Clippy's own widget." };
      }
      nodes.forEach(n => n.remove());
      return { ok: true, removed: nodes.length };
    },
    run_js({ code }) {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`"use strict"; return (async () => { ${code} })();`);
        return Promise.resolve(fn()).then(
          v => ({ ok: true, result: safeSerialize(v) }),
          e => ({ ok: false, error: String(e && e.message || e) })
        );
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    },
    inject_script({ code, id }) {
      const s = document.createElement("script");
      if (id) s.id = id;
      s.textContent = code;
      document.body.appendChild(s);
      return { ok: true, injected: true, id: id || null };
    },
    done() { return { ok: true, done: true }; },
  };

  // Map of tool -> required permission key
  const TOOL_PERMS = {
    read_dom: "read",
    query_all: "read",
    find_text: "read",
    search_site: "read",
    scroll_into_view: "interact",
    create_element: "create",
    remove_element: "remove",
    run_js: "runJs",
    inject_script: "inject",
    done: null,
  };
  function getPermissionKeyForCall(call) {
    if (!call || !call.tool) return undefined;
    if (call.tool === "modify_element") return permissionForModifyElement(call.args || {});
    if (call.tool === "dispatch_event") return permissionForDispatchEvent(call.args || {});
    return TOOL_PERMS[call.tool];
  }
  const PERMISSION_DEFS = [
    { key: "read",   label: "Read" },
    { key: "interact", label: "Interact" },
    { key: "navigate", label: "Navigate" },
    { key: "modify", label: "Modify" },
    { key: "create", label: "Create" },
    { key: "remove", label: "Remove" },
    { key: "runJs",  label: "Run JavaScript" },
    { key: "inject", label: "Inject script" },
  ];
  const PERMISSION_LABELS = Object.fromEntries(PERMISSION_DEFS.map(({ key, label }) => [key, label]));

  function safeSerialize(v) {
    try {
      if (v === undefined) return "undefined";
      if (v === null || typeof v !== "object") return v;
      return JSON.parse(JSON.stringify(v, (_, x) => {
        if (x instanceof Node) return describeNode(x);
        return x;
      }));
    } catch { return String(v); }
  }
  const RUNTIME_HISTORY_LIMIT = 40;
  const RUNTIME_LOG_LIMIT = 120;
  const RUNTIME_DEBUG_LIMIT = 250;
  const PENDING_NAV_TTL_MS = 45000;
  const PENDING_NAV_CLEAR_DELAY_MS = 1200;
  const PENDING_SOURCE_TTL_MS = 120000;
  function trimRuntimeHistory(history) {
    return Array.isArray(history) ? history.slice(-RUNTIME_HISTORY_LIMIT) : [];
  }
  function trimRuntimeLogs(logEntries) {
    return Array.isArray(logEntries) ? logEntries.slice(-RUNTIME_LOG_LIMIT) : [];
  }
  function trimRuntimeDebug(debugEntries) {
    return Array.isArray(debugEntries) ? debugEntries.slice(-RUNTIME_DEBUG_LIMIT) : [];
  }
  function summarizeNavigationTarget(call, { sameOriginOnly = true } = {}) {
    if (!call || call.tool !== "dispatch_event") return null;
    const args = call.args || {};
    const type = getDispatchEventType(args);
    if (!type) return null;
    const node = args.selector ? document.querySelector(args.selector) : null;
    if (!node) return null;
    const sourceUrl = location.href;
    if (type === "click") {
      const anchor = node.closest && node.closest("a[href]");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        const target = (anchor.getAttribute("target") || "").trim().toLowerCase();
        if (!href || href.startsWith("#") || /^javascript:/i.test(href) || (target && target !== "_self")) return null;
        try {
          const url = new URL(anchor.href, location.href);
          if (sameOriginOnly && url.origin !== location.origin) return null;
          return {
            kind: "link",
            sourceUrl,
            targetUrl: url.href,
            label: (anchor.textContent || "").trim().slice(0, 120) || anchor.href,
          };
        } catch { return null; }
      }
      const form = node.form || (node.closest && node.closest("form"));
      const nodeTag = node.tagName ? node.tagName.toLowerCase() : "";
      const typeAttr = (node.getAttribute && (node.getAttribute("type") || "")) || "";
      const actsLikeSubmit =
        !!form &&
        ((nodeTag === "button" && (!typeAttr || typeAttr.toLowerCase() === "submit")) ||
         (nodeTag === "input" && typeAttr.toLowerCase() === "submit"));
      if (actsLikeSubmit) {
        try {
          const url = new URL(form.getAttribute("action") || location.href, location.href);
          if (sameOriginOnly && url.origin !== location.origin) return null;
          return {
            kind: "form",
            sourceUrl,
            targetUrl: url.href,
            label: args.selector || "form submit button",
          };
        } catch { return null; }
      }
      return null;
    }
    if (type === "submit") {
      const form = (node.tagName && node.tagName.toLowerCase() === "form") ? node : (node.closest && node.closest("form"));
      if (!form) return null;
      try {
        const url = new URL(form.getAttribute("action") || location.href, location.href);
        if (sameOriginOnly && url.origin !== location.origin) return null;
        return {
          kind: "form",
          sourceUrl,
          targetUrl: url.href,
          label: form.id ? `form#${form.id}` : (args.selector || "form"),
        };
      } catch { return null; }
    }
    return null;
  }

  // ---------- Tool call parser ----------
  function parseToolObjectBody(body, calls) {
    try {
      const obj = JSON.parse(String(body || "").trim());
      if (obj && typeof obj === "object" && obj.tool) {
        calls.push({ tool: obj.tool, args: obj.args || {} });
      }
    } catch (e) {
      calls.push({ tool: "__parse_error", args: { body: String(body || "").trim(), error: String(e.message || e) } });
    }
  }

  function extractJsonObjectAt(text, startIndex) {
    let i = startIndex;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== "{") return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth++;
        continue;
      }
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return { body: text.slice(i, j + 1), start: i, end: j + 1 };
        }
      }
    }
    return null;
  }

  function mergeRanges(ranges) {
    const ordered = (ranges || [])
      .filter(r => r && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
      .sort((a, b) => a.start - b.start);
    if (!ordered.length) return [];
    const merged = [ordered[0]];
    for (let i = 1; i < ordered.length; i++) {
      const prev = merged[merged.length - 1];
      const next = ordered[i];
      if (next.start <= prev.end) {
        prev.end = Math.max(prev.end, next.end);
      } else {
        merged.push({ start: next.start, end: next.end });
      }
    }
    return merged;
  }

  function stripRanges(text, ranges) {
    if (!ranges.length) return String(text || "").trim();
    let cursor = 0;
    let out = "";
    for (const range of ranges) {
      if (cursor < range.start) out += text.slice(cursor, range.start);
      cursor = Math.max(cursor, range.end);
    }
    if (cursor < text.length) out += text.slice(cursor);
    return out.trim();
  }

  // Finds fenced ```clippy-tool ... ``` blocks (also accepts ```tool or ```json-tool as fallbacks).
  // Some local models occasionally omit the code fences and emit:
  // clippy-tool
  // { ...json... }
  // Accept that variant too so tool execution does not silently fail.
  //
  // Additionally, some models prefer the generic ```json fence over ```clippy-tool
  // even when told otherwise. We treat a ```json block as a tool call ONLY when
  // its body parses to an object with a string `tool` field AND an `args` field
  // — that combination is specific enough that plain JSON examples in chat
  // (snippets, API payloads, etc.) are extremely unlikely to be misidentified.
  function parseToolCalls(text) {
    const source = String(text || "");
    const calls = [];
    const consumedRanges = [];
    const fencedRe = /```(?:clippy-tool|tool|json-tool)\s*\n([\s\S]*?)```/g;
    let m;
    while ((m = fencedRe.exec(source)) !== null) {
      consumedRanges.push({ start: m.index, end: fencedRe.lastIndex });
      parseToolObjectBody(m[1], calls);
    }

    const isInsideConsumedRange = index => consumedRanges.some(r => index >= r.start && index < r.end);
    const rawLabelRe = /(^|\n)(clippy-tool|tool|json-tool)[ \t]*\r?\n/g;
    while ((m = rawLabelRe.exec(source)) !== null) {
      const labelStart = m.index + (m[1] ? m[1].length : 0);
      if (isInsideConsumedRange(labelStart)) continue;
      let afterLabel = m.index + m[0].length;
      // Accept an optional fence-open between the raw label and the JSON body.
      // Real models have been observed emitting:
      //   clippy-tool
      //   ```json
      //   { ...json... }
      //   ```
      // The old parser's extractJsonObjectAt would hit the backticks and return
      // null, silently dropping the tool call. Skip a single fence-open here
      // (```, ```json, ```js, etc.), then consume the matching fence-close
      // after the JSON body so we don't leak the trailing ``` back into
      // `spoken` as stray text.
      const fenceOpenMatch = source.slice(afterLabel).match(/^[ \t]*\r?\n?[ \t]*```[a-zA-Z0-9_-]*[ \t]*\r?\n/);
      let fenceOpened = false;
      if (fenceOpenMatch) {
        afterLabel += fenceOpenMatch[0].length;
        fenceOpened = true;
      }
      const extracted = extractJsonObjectAt(source, afterLabel);
      if (!extracted) continue;
      let consumedEnd = extracted.end;
      if (fenceOpened) {
        const closeMatch = source.slice(consumedEnd).match(/^[ \t]*\r?\n?[ \t]*```/);
        if (closeMatch) consumedEnd += closeMatch[0].length;
      }
      consumedRanges.push({ start: labelStart, end: consumedEnd });
      parseToolObjectBody(extracted.body, calls);
      rawLabelRe.lastIndex = consumedEnd;
    }

    // Fallback: ```json fences that happen to carry a tool call. Gated on the
    // body actually being a {tool, args} object so we don't swallow arbitrary
    // JSON examples. Anything that doesn't look like a tool call is left in
    // `spoken` unchanged.
    const jsonFenceRe = /```json\s*\r?\n([\s\S]*?)```/gi;
    while ((m = jsonFenceRe.exec(source)) !== null) {
      if (isInsideConsumedRange(m.index)) continue;
      let parsed;
      try {
        parsed = JSON.parse(String(m[1] || "").trim());
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      if (typeof parsed.tool !== "string" || !parsed.tool) continue;
      if (!("args" in parsed)) continue;
      consumedRanges.push({ start: m.index, end: jsonFenceRe.lastIndex });
      const args = (parsed.args && typeof parsed.args === "object" && !Array.isArray(parsed.args))
        ? parsed.args
        : {};
      calls.push({ tool: parsed.tool, args });
    }

    const spoken = stripRanges(source, mergeRanges(consumedRanges));
    return { spoken, calls };
  }

  function normalizeToolArgs(toolName, args) {
    let value = args;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = { value };
      }
    }
    const out = (value && typeof value === "object" && !Array.isArray(value)) ? { ...value } : {};
    if ((toolName === "find_text" || toolName === "search_site") && !out.query) {
      out.query = out.keywords || out.text || out.search || out.term || out.value || "";
    }
    if (toolName === "dispatch_event") {
      // Accept the same aliases as the dispatch_event tool itself so
      // native tool_calls from models that used `event`/`eventType`/`kind`
      // survive the normalization. Default to "click" only when nothing
      // else is provided; the tool still validates the final value.
      if (!out.type) out.type = out.event || out.eventType || out.kind || "click";
    }
    if (toolName === "modify_element") {
      if (out.text != null && out.value == null) out.value = out.text;
    }
    delete out.keywords;
    delete out.search;
    delete out.term;
    delete out.event;
    delete out.eventType;
    delete out.kind;
    return out;
  }

  function normalizeNativeToolCalls(rawCalls) {
    if (!Array.isArray(rawCalls)) return [];
    return rawCalls
      .map(call => {
        const fn = call && call.function;
        const tool = fn && typeof fn.name === "string" ? fn.name : "";
        if (!tool) return null;
        return {
          tool,
          args: normalizeToolArgs(tool, fn.arguments),
        };
      })
      .filter(Boolean);
  }

  function encodeToolCallsAsContent(calls) {
    if (!Array.isArray(calls) || !calls.length) return "";
    return calls.map(call =>
      "```clippy-tool\n" +
      JSON.stringify({ tool: call.tool, args: call.args || {} }) +
      "\n```"
    ).join("\n\n");
  }

  // Resolve the configured endpoint into the actual URL to POST to.
  // - Endpoints ending in .php / .cgi / .aspx / .json, or containing a ?query,
  //   are treated as the full chat URL and used as-is. This is what the PHP
  //   adapter and other server-side handlers want.
  // - Anything else (e.g. "http://host:11434" or "/ollama") has "/api/chat"
  //   appended — Ollama's native path, which also works through the Apache
  //   reverse-proxy.
  function resolveChatUrl(endpoint) {
    const e = (endpoint || "").replace(/\/+$/, "");
    if (/\.(php|cgi|aspx|asp|json)(\?|$)/i.test(e) || e.includes("?")) return e;
    return e + "/api/chat";
  }

  // Derive the catalog URL from the chat endpoint. If the user is pointing at
  // a PHP adapter (…/chat.php), the catalog lives next to it as models.php.
  // Direct-to-Ollama setups (http://host:11434) have no catalog endpoint;
  // return null and let the caller fall back to FALLBACK_CATALOG.
  function resolveCatalogUrl(endpoint) {
    if (!endpoint) return null;
    if (/chat\.php(\?|$)/i.test(endpoint)) {
      return endpoint.replace(/chat\.php(\?|$)/i, "models.php$1");
    }
    return null;
  }

  // Same trick for the live-discovery endpoint (discover.php). Only makes
  // sense for adapter-backed deploys — direct-to-Ollama setups would also
  // need an auth/CORS story we deliberately ducked by funneling through PHP.
  function resolveDiscoverUrl(endpoint) {
    if (!endpoint) return null;
    if (/chat\.php(\?|$)/i.test(endpoint)) {
      return endpoint.replace(/chat\.php(\?|$)/i, "discover.php$1");
    }
    return null;
  }

  // Ask the server what models the named provider currently exposes. The
  // adapter does the actual provider-specific API call (e.g. Ollama's
  // /api/tags) so we don't have to teach the widget about every backend.
  // Returns { models: [{id,label}], source, warning? } or throws.
  async function discoverModels(endpoint, provider) {
    const base = resolveDiscoverUrl(endpoint);
    if (!base) {
      throw new Error("Discovery requires the PHP adapter (endpoint ending in chat.php).");
    }
    const url = base + (base.includes("?") ? "&" : "?") + "provider=" + encodeURIComponent(provider);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + ": " + body.slice(0, 200));
    }
    const data = await res.json();
    if (!data || typeof data !== "object") throw new Error("Discovery returned non-object response.");
    return data;
  }

  // Shape matches the sanitised payload emitted by models.php.
  const FALLBACK_CATALOG = {
    default_provider: "ollama",
    providers: {
      ollama: {
        label: "Ollama (local)",
        models: [{ id: "gemma4:e4b", label: "Gemma 4 e4b" }],
      },
    },
  };

  async function fetchCatalog(endpoint) {
    const url = resolveCatalogUrl(endpoint);
    if (!url) return { catalog: FALLBACK_CATALOG, source: "fallback (no catalog endpoint for this setup)" };
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || typeof data !== "object" || !data.providers) {
        throw new Error("unexpected shape");
      }
      return { catalog: data, source: url };
    } catch (e) {
      return { catalog: FALLBACK_CATALOG, source: "fallback — catalog fetch failed: " + (e && e.message || e) };
    }
  }

  // ---------- Ollama client ----------
  async function ollamaChat(settings, messages, signal, debug) {
    const base = settings.endpoint.replace(/\/+$/, "");
    const url = resolveChatUrl(settings.endpoint);
    const body = {
      model: settings.model,
      stream: false,
      messages,
      options: { temperature: settings.temperature },
    };
    let res;
    try {
      // The PHP adapter routes by X-Clippy-Provider first, then by the
      // `routes` pattern table, then by `default_provider`. Sending the
      // header makes routing predictable and takes the regex table out of
      // the hot path. Direct-to-Ollama deploys just ignore the header.
      const headers = { "Content-Type": "application/json" };
      if (settings.provider) headers["X-Clippy-Provider"] = settings.provider;
      if (typeof debug === "function") {
        debug("model.request", {
          url,
          provider: settings.provider || "",
          model: settings.model,
          messages: Array.isArray(messages) ? messages.length : 0,
          lastRole: Array.isArray(messages) && messages.length ? messages[messages.length - 1].role : "",
        });
      }
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
      if (typeof debug === "function") {
        debug("model.http", { status: res.status, ok: res.ok, url });
      }
    } catch (e) {
      // fetch() threw before getting a response. Don't speculate about the
      // cause — tell the user where to look and offer the diagnostic button.
      throw new Error(
        `fetch() to ${url} threw: ${e && e.message || e}. ` +
        `Open DevTools → Console (F12) to see the underlying reason, or click ` +
        `"Test connection" in Clippy's settings (gear icon) for a focused probe.`
      );
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (typeof debug === "function") {
        debug("model.http.error", { status: res.status, body: errText.slice(0, 400) });
      }
      throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 400)}`);
    }
    const data = await res.json();
    // Ollama /api/chat returns { message: { role, content }, ... }
    if (!data || typeof data !== "object") {
      if (typeof debug === "function") debug("model.response.invalid", { received: debugPreview(data, 200) });
      throw new Error("Model returned a non-object JSON response.");
    }
    const nativeToolCalls = normalizeNativeToolCalls(data && data.message && data.message.tool_calls);
    const content = (data && data.message && typeof data.message.content === "string")
      ? data.message.content
      : "";
    const normalizedContent = [content, encodeToolCallsAsContent(nativeToolCalls)].filter(Boolean).join("\n\n");
    if (typeof debug === "function") {
      debug("model.response", {
        chars: content.length,
        normalizedChars: normalizedContent.length,
        done: data.done,
        done_reason: data.done_reason || "",
        hasMessage: !!data.message,
        toolCalls: nativeToolCalls.length,
        thinkingChars: (data && data.message && typeof data.message.thinking === "string") ? data.message.thinking.length : 0,
      });
    }
    return normalizedContent;
  }

  // ---------- Connection diagnostics ----------
  // Runs a sequence of probes and returns human-readable lines describing
  // exactly what the browser did and what it got back. No interpretation —
  // that's the user's job. Probes are tailored to the endpoint shape:
  //   • adapter mode (…/chat.php) → GET models.php, POST chat.php
  //   • direct Ollama mode        → GET /, GET /api/tags, POST /api/chat
  // Prior versions blindly hit base+"/" and base+"/api/tags" which produced
  // meaningless 405s when base ended in chat.php.
  async function diagnoseOllama(settings) {
    const endpoint = (settings.endpoint || "").replace(/\/+$/, "");
    const chatUrl = resolveChatUrl(settings.endpoint);
    const catalogUrl = resolveCatalogUrl(settings.endpoint);
    const isAdapter = /\.(php|cgi|aspx|asp)(\?|$)/i.test(endpoint);
    const lines = [];
    const pageOrigin = (typeof location !== "undefined" && location.origin) || "(none)";
    const isSecurePage = pageOrigin.startsWith("https://");
    const endpointSecure = endpoint.startsWith("https://");

    lines.push(`Page origin : ${pageOrigin}`);
    lines.push(`Endpoint    : ${endpoint}`);
    lines.push(`Mode        : ${isAdapter ? "PHP adapter" : "direct Ollama"}`);
    if (isSecurePage && !endpointSecure && !endpoint.startsWith("/") && !endpoint.startsWith(".")) {
      lines.push(`⚠ Page is https but endpoint is http — browser will block this as mixed content before any request goes out.`);
    }
    lines.push("");

    const probe = async (label, url, init) => {
      const t0 = performance.now();
      try {
        const res = await fetch(url, init);
        const dt = Math.round(performance.now() - t0);
        const body = await res.text().catch(() => "");
        lines.push(`[${label}] ${init.method || "GET"} ${url}`);
        lines.push(`  → HTTP ${res.status} ${res.statusText}  (${dt} ms)`);
        const corsHdr = res.headers.get("access-control-allow-origin");
        if (corsHdr) lines.push(`  access-control-allow-origin: ${corsHdr}`);
        lines.push(`  body: ${body.slice(0, 200).replace(/\s+/g, " ")}`);
      } catch (e) {
        const dt = Math.round(performance.now() - t0);
        lines.push(`[${label}] ${init.method || "GET"} ${url}`);
        lines.push(`  → threw: ${e && e.message || e}  (${dt} ms)`);
      }
      lines.push("");
    };

    if (isAdapter) {
      // PHP adapter: the only GET we can make is to the catalog endpoint.
      // Hitting chat.php with GET will always be a 405, which is a correct
      // response but not useful for diagnosing connectivity.
      if (catalogUrl) {
        await probe("catalog", catalogUrl, { method: "GET" });
      }
      // Real chat round-trip — the one that matters. Sends the provider
      // header so routing is exercised too.
      const headers = { "Content-Type": "application/json" };
      if (settings.provider) headers["X-Clippy-Provider"] = settings.provider;
      await probe("chat", chatUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: settings.model,
          stream: false,
          messages: [{ role: "user", content: "say hi in one word" }],
        }),
      });
    } else {
      // Direct-to-Ollama fallback path — preserves the old diagnostic for
      // deployments that bypass the PHP adapter.
      await probe("root", endpoint + "/",          { method: "GET" });
      await probe("tags", endpoint + "/api/tags",  { method: "GET" });
      await probe("chat", chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          stream: false,
          messages: [{ role: "user", content: "say hi in one word" }],
        }),
      });
    }

    return lines.join("\n");
  }

  // ---------- Drag support ----------
  function loadPosition() {
    try {
      const raw = localStorage.getItem(LS_POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p.left === "number" && typeof p.top === "number") return p;
    } catch {}
    return null;
  }
  function savePosition(pos) {
    try { localStorage.setItem(LS_POS_KEY, JSON.stringify(pos)); } catch {}
  }
  function clampToViewport(left, top, w, h) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const margin = 4;
    return {
      left: Math.max(margin, Math.min(vw - w - margin, left)),
      top:  Math.max(margin, Math.min(vh - h - margin, top)),
    };
  }
  function makeDraggable(root, handle, onReposition) {
    let pointerActive = false;
    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0;
    let origLeft = 0, origTop = 0;
    const dragThreshold = 6;

    const applyPosition = (left, top) => {
      const rect = root.getBoundingClientRect();
      const c = clampToViewport(left, top, rect.width, rect.height);
      root.style.left = c.left + "px";
      root.style.top  = c.top  + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      if (typeof onReposition === "function") onReposition();
    };

    // Restore saved position (if any) on mount
    const saved = loadPosition();
    if (saved) {
      // Defer until rendered so we know the widget's size
      requestAnimationFrame(() => applyPosition(saved.left, saved.top));
    }

    const beginDrag = () => {
      if (dragging) return;
      dragging = true;
      root.style.left = origLeft + "px";
      root.style.top  = origTop  + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.classList.add("dragging");
    };

    const onDown = (e) => {
      // Only left button for mouse
      if (e.type === "mousedown" && e.button !== 0) return;
      const p = (e.touches && e.touches[0]) || e;
      pointerActive = true;
      dragging = false;
      moved = false;
      startX = p.clientX;
      startY = p.clientY;
      const rect = root.getBoundingClientRect();
      origLeft = rect.left;
      origTop  = rect.top;
      if (e.type === "mousedown") e.preventDefault();
    };
    const onMove = (e) => {
      if (!pointerActive) return;
      const p = (e.touches && e.touches[0]) || e;
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      if (!dragging && Math.abs(dx) + Math.abs(dy) >= dragThreshold) {
        moved = true;
        beginDrag();
      }
      if (!dragging) return;
      applyPosition(origLeft + dx, origTop + dy);
      e.preventDefault();
    };
    const onUp = () => {
      if (!pointerActive) return;
      pointerActive = false;
      dragging = false;
      root.classList.remove("dragging");
      if (moved) {
        const rect = root.getBoundingClientRect();
        savePosition({ left: rect.left, top: rect.top });
      }
      // If it was basically a click (no movement), let the click event through
      // so toggleBubble still fires via the existing handler.
    };

    handle.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    handle.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);

    // If the viewport changes size, keep Clippy on-screen and let the bubble
    // recompute which side to open on / how tall it's allowed to be.
    window.addEventListener("resize", () => {
      const rect = root.getBoundingClientRect();
      const c = clampToViewport(rect.left, rect.top, rect.width, rect.height);
      if (c.left !== rect.left || c.top !== rect.top) {
        root.style.left = c.left + "px";
        root.style.top  = c.top  + "px";
      }
      if (typeof onReposition === "function") onReposition();
    });

    // Expose a helper used by the click handler to suppress a click when dragging
    return { wasDragMove: () => moved };
  }

  // ---------- UI ----------
  function buildUI(root, settings, api) {
    const permissionRowsHtml = PERMISSION_DEFS.map(({ key, label }) => `
            <label class="clippy-perm-row">
              <span>${label}</span>
              <select data-perm-mode="${key}">
                <option value="prompt">Prompt</option>
                <option value="allow">Just do</option>
                <option value="ignore">Ignore</option>
              </select>
            </label>`).join("");
    const bubble = el(`
      <div class="clippy-bubble" id="clippy-bubble" role="dialog" aria-label="Clippy">
        <div class="clippy-header">
          <div>
            <div class="clippy-title" id="clippy-title">Clippy</div>
            <div class="clippy-subtitle" id="clippy-sub">idle</div>
          </div>
          <div class="clippy-btns">
            <button class="clippy-btn" id="clippy-gear" title="Settings">⚙</button>
            <button class="clippy-btn" id="clippy-clear" title="Clear conversation">↺</button>
            <button class="clippy-btn" id="clippy-close" title="Close">✕</button>
          </div>
        </div>

        <div class="clippy-settings" id="clippy-settings">
          <details class="clippy-settings-group">
            <summary class="clippy-settings-summary">Character</summary>
            <div class="clippy-settings-body">
          <label>Character <select id="cs-character"></select></label>
            </div>
          </details>
          <details class="clippy-settings-group">
            <summary class="clippy-settings-summary">Page Knowledge</summary>
            <div class="clippy-settings-body">
          <label>Markdown files
            <textarea id="cs-knowledge" placeholder="./docs/page-guide.md&#10;./docs/selectors.md"></textarea>
          </label>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="clippy-btn" id="cs-refresh-knowledge" title="Fetch Markdown files and rebuild page knowledge">Load Markdown</button>
            <span id="cs-knowledge-status" style="font-size:11px;color:#666"></span>
          </div>
            </div>
          </details>
          <details class="clippy-settings-group">
            <summary class="clippy-settings-summary">LLM</summary>
            <div class="clippy-settings-body">
          <label>Endpoint <input type="text" id="cs-endpoint" placeholder="./chat.php"></label>
          <label>Provider <select id="cs-provider"></select></label>
          <label>Model <select id="cs-model"></select></label>
          <div style="display:flex;gap:6px;align-items:center;margin-top:-2px;flex-wrap:wrap">
            <button class="clippy-btn" id="cs-add-model" title="Add a custom model to this provider">+ Add model</button>
            <button class="clippy-btn" id="cs-discover" title="Ask the provider which models it has installed">🔎 Discover</button>
            <button class="clippy-btn" id="cs-remove-model" title="Remove this custom model" style="display:none">× Remove</button>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="clippy-btn" id="cs-test" style="background:#e8f0ff;border:1px solid #b0c4ff">Test connection</button>
            <button class="clippy-btn" id="cs-refresh-catalog" title="Re-fetch provider/model list">⟳ Catalog</button>
            <span id="cs-catalog-status" style="font-size:11px;color:#666"></span>
          </div>
          <pre id="cs-test-out" style="display:none;background:#1e1e1e;color:#eee;padding:8px;border-radius:6px;font-size:11px;white-space:pre-wrap;max-height:220px;overflow:auto;margin:0"></pre>
            </div>
          </details>
          <details class="clippy-settings-group">
            <summary class="clippy-settings-summary">Debug</summary>
            <div class="clippy-settings-body">
          <label class="clippy-check">
            <input type="checkbox" id="cs-debug-enabled">
            <span>Enable runtime debug log</span>
          </label>
          <div class="clippy-debug-actions">
            <button class="clippy-btn" id="cs-debug-copy" title="Copy the debug log to the clipboard">Copy debug log</button>
            <button class="clippy-btn" id="cs-debug-clear" title="Clear the current debug log">Clear debug log</button>
            <button class="clippy-btn" id="cs-debug-purge" title="Clear saved settings, position, runtime session, and custom models for this browser">Clear saved browser data</button>
          </div>
          <pre id="cs-debug-out" class="clippy-debug-out"></pre>
            </div>
          </details>
          <details class="clippy-settings-group">
            <summary class="clippy-settings-summary">Permissions</summary>
            <div class="clippy-settings-body">
          <div class="clippy-perms">${permissionRowsHtml}
          </div>
          <div class="clippy-perm-help">
            <strong>Prompt</strong> asks first, <strong>Just do</strong> runs without asking,
            and <strong>Ignore</strong> auto-denies the request. <strong>Interact</strong>
            covers filling fields, clicking controls, and submitting forms.
          </div>
            </div>
          </details>
          <details class="clippy-settings-group">
            <summary class="clippy-settings-summary" id="cs-directions-title">Directions</summary>
            <div class="clippy-settings-body">
          <label id="cs-directions-label">Directions for this character
            <textarea id="cs-directions" placeholder="Tell this character how you want it to behave on this site or page."></textarea>
          </label>
          <div class="clippy-perm-help" id="cs-directions-help">
            These directions are appended after the character's built-in instructions.
          </div>
            </div>
          </details>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="clippy-btn" id="cs-reset">Reset</button>
            <button class="clippy-btn" id="cs-save" style="background:var(--clippy-accent);">Save</button>
          </div>
        </div>

        <div class="clippy-log" id="clippy-log"></div>

        <div class="clippy-input-row">
          <textarea class="clippy-input" id="clippy-input"
            placeholder="Ask Clippy... (Enter to send, Shift+Enter for newline)"></textarea>
          <button class="clippy-send" id="clippy-send">Send</button>
        </div>

        <div class="clippy-confirm" id="clippy-confirm">
          <div><strong id="clippy-confirm-title">Permission request:</strong>
               <span id="clippy-confirm-tool"></span></div>
          <pre id="clippy-confirm-body"></pre>
          <div class="clippy-confirm-row">
            <button class="deny"    id="clippy-confirm-deny">Deny</button>
            <button class="always"  id="clippy-confirm-always">Always allow this permission</button>
            <button class="approve" id="clippy-confirm-approve">Allow once</button>
          </div>
        </div>
      </div>
    `);
    const charWrap = el(`
      <div class="clippy-avatar-wrap">
        <div class="clippy-avatar-host" id="clippy-avatar-host"></div>
        <div class="clippy-status" id="clippy-status" style="display:none">…</div>
      </div>
    `);

    root.appendChild(bubble);
    root.appendChild(charWrap);

    const ui = {
      bubble,
      avatarWrap: charWrap,
      avatarHost: charWrap.querySelector("#clippy-avatar-host"),
      char: null,
      status: charWrap.querySelector("#clippy-status"),
      title: bubble.querySelector("#clippy-title"),
      sub: bubble.querySelector("#clippy-sub"),
      log: bubble.querySelector("#clippy-log"),
      input: bubble.querySelector("#clippy-input"),
      send: bubble.querySelector("#clippy-send"),
      gear: bubble.querySelector("#clippy-gear"),
      clear: bubble.querySelector("#clippy-clear"),
      close: bubble.querySelector("#clippy-close"),
      settings: bubble.querySelector("#clippy-settings"),
      csCharacter: bubble.querySelector("#cs-character"),
      csKnowledge: bubble.querySelector("#cs-knowledge"),
      csKnowledgeRefresh: bubble.querySelector("#cs-refresh-knowledge"),
      csKnowledgeStatus: bubble.querySelector("#cs-knowledge-status"),
      csEndpoint: bubble.querySelector("#cs-endpoint"),
      csProvider: bubble.querySelector("#cs-provider"),
      csModel: bubble.querySelector("#cs-model"),
      csDirectionsTitle: bubble.querySelector("#cs-directions-title"),
      csDirectionsLabel: bubble.querySelector("#cs-directions-label"),
      csDirections: bubble.querySelector("#cs-directions"),
      csDirectionsHelp: bubble.querySelector("#cs-directions-help"),
      csSave: bubble.querySelector("#cs-save"),
      csReset: bubble.querySelector("#cs-reset"),
      csTest: bubble.querySelector("#cs-test"),
      csTestOut: bubble.querySelector("#cs-test-out"),
      csDebugEnabled: bubble.querySelector("#cs-debug-enabled"),
      csDebugCopy: bubble.querySelector("#cs-debug-copy"),
      csDebugClear: bubble.querySelector("#cs-debug-clear"),
      csDebugPurge: bubble.querySelector("#cs-debug-purge"),
      csDebugOut: bubble.querySelector("#cs-debug-out"),
      csRefresh: bubble.querySelector("#cs-refresh-catalog"),
      csCatStatus: bubble.querySelector("#cs-catalog-status"),
      csAddModel: bubble.querySelector("#cs-add-model"),
      csDiscover: bubble.querySelector("#cs-discover"),
      csRemoveModel: bubble.querySelector("#cs-remove-model"),
      permModeInputs: bubble.querySelectorAll('select[data-perm-mode]'),
      confirm: bubble.querySelector("#clippy-confirm"),
      confirmTitle: bubble.querySelector("#clippy-confirm-title"),
      confirmTool: bubble.querySelector("#clippy-confirm-tool"),
      confirmBody: bubble.querySelector("#clippy-confirm-body"),
      confirmApprove: bubble.querySelector("#clippy-confirm-approve"),
      confirmDeny: bubble.querySelector("#clippy-confirm-deny"),
      confirmAlways: bubble.querySelector("#clippy-confirm-always"),
    };
    renderAvatar(ui, settings, { force: true });
    setAvatarMode(ui, settings, "idle", { force: true });

    // Viewport-aware bubble layout. Runs on open, after a drag, and on
    // window resize. Decides which side of the character to open on (left
    // by default; right when there isn't enough room on the left) and
    // clamps the bubble's max width/height to the available space.
    function repositionBubble() {
      if (!bubble.classList.contains("open")) return;
      const rootRect = root.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const margin = 12;        // breathing room from viewport edge
      const tail   = 14;        // gap between bubble edge and character
      const charW  = rootRect.width  || 96;
      const charH  = rootRect.height || 120;

      // Horizontal space available on each side of the character.
      const spaceLeft  = Math.max(0, rootRect.left  - margin);
      const spaceRight = Math.max(0, vw - rootRect.right - margin);
      // Vertical space: bubble anchors to the character's bottom and grows
      // upward, so the relevant measurement is how much is above the bottom
      // of the character (minus the tiny inset the CSS default uses).
      const spaceAbove = Math.max(0, rootRect.bottom - margin);

      // Reset inline overrides so we start from the CSS defaults each pass.
      bubble.style.left = "";
      bubble.style.right = "";
      bubble.style.top = "";
      bubble.style.bottom = "";
      bubble.style.maxWidth = "";
      bubble.style.maxHeight = "";

      // Prefer opening on the left (that's the design default); flip to the
      // right only if the left side is meaningfully smaller. The 40 px slop
      // keeps the bubble from thrashing sides when Clippy sits near centre.
      const useRight = spaceRight > spaceLeft + 40;
      if (useRight) {
        bubble.classList.add("flipped");
        // Anchor the bubble's LEFT edge just past the character's right
        // edge. Inline positions are relative to .clippy-root, so `left`
        // here means distance from the root's left edge.
        bubble.style.left = (charW + tail) + "px";
        bubble.style.bottom = "20px"; // match CSS default vertical anchor
        bubble.style.maxWidth = Math.max(220, spaceRight - tail) + "px";
      } else {
        bubble.classList.remove("flipped");
        // Use the CSS defaults (right: 110px; bottom: 20px;) but cap the
        // width so the bubble can't spill past the left viewport edge.
        // With right: 110px and the root being charW wide, the bubble's
        // right edge sits `tail` (14px) to the LEFT of root.left in viewport
        // coords. Available width = rootRect.left - tail - margin.
        const cap = rootRect.left - tail - margin;
        bubble.style.maxWidth = Math.max(220, cap) + "px";
      }

      // Vertical cap: bubble grows upward from near the character's bottom.
      bubble.style.maxHeight = Math.max(180, spaceAbove - 20) + "px";
    }

    // wire up drag (must come before click so we can suppress click-after-drag)
    const drag = makeDraggable(root, ui.avatarWrap, repositionBubble);
    ui.avatarWrap.addEventListener("click", (e) => {
      if (drag.wasDragMove()) { e.stopPropagation(); return; }
      toggleBubble(true);
    });
    ui.close.addEventListener("click", () => toggleBubble(false));
    ui.clear.addEventListener("click", () => api.clear());
    ui.gear.addEventListener("click", () => {
      ui.settings.classList.toggle("open");
      loadSettingsIntoUI();
    });
    ui.send.addEventListener("click", () => api.send(ui.input.value));
    ui.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        api.send(ui.input.value);
      }
    });
    ui.csSave.addEventListener("click", () => { saveSettingsFromUI(); ui.settings.classList.remove("open"); });
    ui.csReset.addEventListener("click", () => {
      const result = api.setSettings(structuredClone(DEFAULTS));
      loadSettingsIntoUI();
      ensureKnowledgeBase(true);
      if (!result || !result.avatarChanged) setStatus(ui, "", false, api.getSettings());
    });
    ui.csKnowledgeRefresh.addEventListener("click", async () => {
      const sources = parseKnowledgeSourcesInput(ui.csKnowledge.value);
      const s = api.getSettings();
      s.knowledgeSources = sources;
      await ensureKnowledgeBase(true, sources);
      setStatus(ui, "", false, s);
    });
    ui.csTest.addEventListener("click", async () => {
      // Use the fields' current values, not just saved settings — lets you
      // test a new endpoint before saving.
      const probeSettings = {
        ...api.getSettings(),
        endpoint: ui.csEndpoint.value.trim() || DEFAULTS.endpoint,
        provider: ui.csProvider.value || DEFAULTS.provider,
        model:    ui.csModel.value    || DEFAULTS.model,
      };
      ui.csTestOut.style.display = "block";
      ui.csTestOut.textContent = "Probing " + probeSettings.endpoint + " ...";
      try {
        ui.csTestOut.textContent = await diagnoseOllama(probeSettings);
      } catch (e) {
        ui.csTestOut.textContent = "Probe harness crashed: " + (e && e.message || e);
      }
    });
    if (ui.csDebugEnabled) {
      ui.csDebugEnabled.addEventListener("change", () => {
        const s = structuredClone(api.getSettings());
        s.debugEnabled = !!ui.csDebugEnabled.checked;
        api.setSettings(s);
        renderDebugLog(ui, s);
      });
    }
    if (ui.csDebugCopy) {
      ui.csDebugCopy.addEventListener("click", async () => {
        const content = Array.isArray(ui._runtimeDebugEntries)
          ? ui._runtimeDebugEntries.map(entry => entry.text || "").join("\n")
          : (ui.csDebugOut ? ui.csDebugOut.textContent : "");
        if (!content) return;
        try {
          await copyTextToClipboard(content);
          ui.csDebugCopy.textContent = "Copied";
          setTimeout(() => { ui.csDebugCopy.textContent = "Copy debug log"; }, 900);
        } catch (e) {
          window.alert("Could not copy the debug log: " + String((e && e.message) || e || "unknown error"));
        }
      });
    }
    if (ui.csDebugClear) {
      ui.csDebugClear.addEventListener("click", () => {
        if (Array.isArray(ui._runtimeDebugEntries)) ui._runtimeDebugEntries.length = 0;
        if (typeof ui._persistRuntimeState === "function") ui._persistRuntimeState();
        renderDebugLog(ui, api.getSettings());
      });
    }
    if (ui.csDebugPurge) {
      ui.csDebugPurge.addEventListener("click", () => {
        const ok = window.confirm("Clear Clippy's saved settings, position, runtime session, and custom models for this browser, then reload?");
        if (!ok) return;
        clearPersistedBrowserState();
        location.reload();
      });
    }
    ui.csRefresh.addEventListener("click", () => {
      // Re-fetch the catalog against whatever endpoint is currently in the
      // Endpoint box (not the saved one) so users can point at a new adapter
      // and repopulate the dropdowns without a full save-reload cycle.
      refreshCatalog(ui.csEndpoint.value.trim() || DEFAULTS.endpoint);
    });
    ui.csCharacter.addEventListener("change", () => {
      refreshCharacterDirectionsUI(ui.csCharacter.value);
    });
    ui.csProvider.addEventListener("change", () => {
      // Re-render the Model dropdown against the newly-selected provider.
      populateModelSelect(ui.csProvider.value, /*keepIfValid*/ null);
      updateRemoveModelVisibility();
    });
    ui.csModel.addEventListener("change", () => {
      updateRemoveModelVisibility();
    });
    ui.csAddModel.addEventListener("click", () => {
      const provider = ui.csProvider.value;
      if (!provider) return;
      // Simple prompt flow — PoC-grade but reliable and dependency-free.
      // Validation: id is required, label defaults to id, dupes rejected.
      const id = (window.prompt(
        "Model id (as the provider knows it, e.g. 'gemma4:e4b' or 'llama3.2:3b'):"
      ) || "").trim();
      if (!id) return;
      const label = (window.prompt(
        "Display label for the dropdown:", id
      ) || "").trim() || id;
      const map = loadUserModels();
      const existing = userModelsFor(map, provider);
      const inCatalog = ((catalog.providers || {})[provider] || {}).models || [];
      if (inCatalog.some(m => m.id === id) || existing.some(m => m.id === id)) {
        window.alert("That model id is already in the list.");
        return;
      }
      map[provider] = existing.concat([{ id, label }]);
      saveUserModels(map);
      populateModelSelect(provider, id);
      updateRemoveModelVisibility();
    });
    ui.csDiscover.addEventListener("click", async () => {
      const provider = ui.csProvider.value;
      if (!provider) return;
      // Use whatever endpoint is currently in the box (not saved) so a user
      // can test a new adapter before saving settings. Matches the rest of
      // the settings controls.
      const endpoint = ui.csEndpoint.value.trim() || DEFAULTS.endpoint;
      const orig = ui.csDiscover.textContent;
      ui.csDiscover.disabled = true;
      ui.csDiscover.textContent = "🔎 …";
      try {
        const data = await discoverModels(endpoint, provider);
        const found = Array.isArray(data.models) ? data.models : [];
        if (data.warning) {
          // Discovery reached the adapter but the adapter's upstream call
          // failed — show exactly what went wrong so users can fix config
          // rather than just seeing an empty list.
          window.alert(
            "Discovery returned no models.\n\n" +
            "Adapter said: " + data.warning + "\n\n" +
            "If your provider needs to be pointed at a different host, edit config.json."
          );
          return;
        }
        if (!found.length) {
          window.alert("No models reported by " + provider + " at " + (data.source || "(unknown source)") + ".");
          return;
        }
        // Filter out ones already in the catalog OR already added locally —
        // no point in offering duplicates.
        const inCatalog = ((catalog.providers || {})[provider] || {}).models || [];
        const existing  = userModelsFor(loadUserModels(), provider);
        const known = new Set([
          ...inCatalog.map(m => m.id),
          ...existing.map(m => m.id),
        ]);
        const fresh = found.filter(m => !known.has(m.id));
        if (!fresh.length) {
          window.alert(
            "Discovered " + found.length + " model(s), all already in the dropdown:\n\n" +
            found.map(m => "• " + m.label).join("\n")
          );
          return;
        }
        // Keep the picker simple: numbered prompt, space/comma-separated
        // indexes, or * for all. Good enough for a PoC; can upgrade to an
        // inline listbox later if the flow sees real use.
        const lines = fresh.map((m, i) => `${i + 1}. ${m.label}`);
        const answer = (window.prompt(
          "Discovered models (from " + (data.source || provider) + "):\n\n" +
          lines.join("\n") + "\n\n" +
          "Which to add? Enter numbers separated by spaces/commas, or * for all:",
          "*"
        ) || "").trim();
        if (!answer) return;
        let picks;
        if (answer === "*") {
          picks = fresh.slice();
        } else {
          const idxs = answer.split(/[\s,]+/).map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= fresh.length);
          picks = idxs.map(i => fresh[i - 1]);
        }
        if (!picks.length) return;
        const map = loadUserModels();
        const list = userModelsFor(map, provider).slice();
        for (const m of picks) {
          if (!list.some(x => x.id === m.id)) list.push({ id: m.id, label: m.label || m.id });
        }
        map[provider] = list;
        saveUserModels(map);
        // Select the first freshly-added model so the user can immediately
        // see the effect of their click.
        populateModelSelect(provider, picks[0].id);
        updateRemoveModelVisibility();
      } catch (e) {
        window.alert("Discovery failed: " + (e && e.message || e));
      } finally {
        ui.csDiscover.disabled = false;
        ui.csDiscover.textContent = orig;
      }
    });
    ui.csRemoveModel.addEventListener("click", () => {
      const provider = ui.csProvider.value;
      const id = ui.csModel.value;
      if (!provider || !id) return;
      const map = loadUserModels();
      const list = userModelsFor(map, provider);
      const filtered = list.filter(m => m.id !== id);
      if (filtered.length === list.length) return; // not a user model
      map[provider] = filtered;
      saveUserModels(map);
      populateModelSelect(provider, null); // fall back to first available
      updateRemoveModelVisibility();
    });

    // ---- Catalog state + populate helpers -------------------------------
    // Held on the closure (rather than on settings) because it's ephemeral —
    // refetched on mount and on the refresh button. If the fetch fails we
    // fall back to a minimal hardcoded catalog so the widget stays usable.
    let catalog = FALLBACK_CATALOG;
    let knowledgeBase = {
      key: "",
      status: "idle",
      sources: [],
      chunks: [],
      errors: [],
      loadedAt: 0,
    };

    function setCatalogStatus(text, ok) {
      if (!ui.csCatStatus) return;
      ui.csCatStatus.textContent = text || "";
      ui.csCatStatus.style.color = ok ? "#2e7d32" : "#777";
    }
    function setKnowledgeStatus(text, ok) {
      if (!ui.csKnowledgeStatus) return;
      ui.csKnowledgeStatus.textContent = text || "";
      ui.csKnowledgeStatus.style.color = ok ? "#2e7d32" : "#777";
    }
    async function ensureKnowledgeBase(force = false, sourcesOverride) {
      const sources = normalizeKnowledgeSources(
        sourcesOverride !== undefined ? sourcesOverride : api.getSettings().knowledgeSources
      );
      const key = JSON.stringify(sources);
      if (!force && knowledgeBase.key === key && knowledgeBase.status === "ready") {
        return knowledgeBase;
      }
      if (!sources.length) {
        knowledgeBase = {
          key,
          status: "ready",
          sources: [],
          chunks: [],
          errors: [],
          loadedAt: Date.now(),
        };
        setKnowledgeStatus("no Markdown loaded", false);
        return knowledgeBase;
      }
      knowledgeBase = {
        key,
        status: "loading",
        sources: [],
        chunks: [],
        errors: [],
        loadedAt: 0,
      };
      setKnowledgeStatus("loading Markdown…", false);
      const results = await Promise.all(sources.map(async (source) => {
        const href = resolveKnowledgeSource(source);
        if (!href) {
          return { ok: false, source, error: "invalid path or URL" };
        }
        if (!/\.md($|[?#])/i.test(href)) {
          return { ok: false, source, href, error: "only .md files are supported right now" };
        }
        try {
          const res = await fetch(href, { headers: { Accept: "text/markdown, text/plain;q=0.9, */*;q=0.1" } });
          if (!res.ok) {
            return { ok: false, source, href, error: `HTTP ${res.status}` };
          }
          const text = await res.text();
          const chunks = splitMarkdownKnowledge(text, source, href);
          if (!chunks.length) {
            return { ok: false, source, href, error: "Markdown file was empty" };
          }
          return { ok: true, source, href, chunks };
        } catch (e) {
          return { ok: false, source, href, error: String(e && e.message || e) };
        }
      }));
      const loaded = results.filter(r => r.ok);
      const errors = results.filter(r => !r.ok);
      knowledgeBase = {
        key,
        status: "ready",
        sources: loaded.map(r => ({ source: r.source, href: r.href, chunkCount: r.chunks.length })),
        chunks: loaded.flatMap(r => r.chunks),
        errors,
        loadedAt: Date.now(),
      };
      const parts = [];
      parts.push(`loaded ${loaded.length}/${sources.length} Markdown file${sources.length === 1 ? "" : "s"}`);
      if (knowledgeBase.chunks.length) parts.push(`${knowledgeBase.chunks.length} chunk${knowledgeBase.chunks.length === 1 ? "" : "s"}`);
      if (errors.length) parts.push(`${errors.length} failed`);
      if (errors.length && !loaded.length) parts.push(errors[0].error);
      setKnowledgeStatus(parts.join(" • "), loaded.length > 0 && errors.length === 0);
      return knowledgeBase;
    }

    function populateCharacterSelect(preferred) {
      const sel = ui.csCharacter;
      sel.innerHTML = "";
      for (const avatar of listCharacterDefinitions()) {
        const opt = document.createElement("option");
        opt.value = avatar.id;
        opt.textContent = avatar.label || avatar.id;
        sel.appendChild(opt);
      }
      const fallback = getCharacterDefinition(preferred || getSelectedCharacterId(settings));
      sel.value = fallback ? fallback.id : DEFAULT_CHARACTER_ID;
    }

    function populateProviderSelect(preferred) {
      const sel = ui.csProvider;
      sel.innerHTML = "";
      const names = Object.keys(catalog.providers || {});
      if (names.length === 0) {
        const opt = document.createElement("option");
        opt.value = ""; opt.textContent = "(no providers in catalog)";
        sel.appendChild(opt);
        return;
      }
      for (const name of names) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = catalog.providers[name].label || name;
        sel.appendChild(opt);
      }
      // Prefer the caller's hint, else the catalog's declared default, else first.
      const want = preferred && names.includes(preferred)
        ? preferred
        : (catalog.default_provider && names.includes(catalog.default_provider)
            ? catalog.default_provider : names[0]);
      sel.value = want;
    }

    function populateModelSelect(providerName, keepIfValid) {
      const sel = ui.csModel;
      sel.innerHTML = "";
      const provider = (catalog.providers || {})[providerName];
      const catModels = (provider && provider.models) || [];
      const userModels = userModelsFor(loadUserModels(), providerName);
      // Catalog models first, then user additions suffixed with "(custom)"
      // so they're visually distinguishable. data-custom drives the Remove
      // button's visibility on change.
      const merged = [];
      for (const m of catModels) merged.push({ id: m.id, label: m.label || m.id, custom: false });
      for (const m of userModels) merged.push({ id: m.id, label: (m.label || m.id) + " (custom)", custom: true });

      if (merged.length === 0) {
        const opt = document.createElement("option");
        opt.value = ""; opt.textContent = "(no models — click + Add model)";
        sel.appendChild(opt);
        return;
      }
      for (const m of merged) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label;
        if (m.custom) opt.dataset.custom = "1";
        sel.appendChild(opt);
      }
      // If the caller passed a model id that's in the merged list, keep it.
      // Otherwise pick the first entry — better than a stale selection from
      // the previous provider.
      if (keepIfValid && merged.some(m => m.id === keepIfValid)) {
        sel.value = keepIfValid;
      } else {
        sel.value = merged[0].id;
      }
    }

    // The Remove button is only meaningful when the currently-selected
    // <option> is a user-added one. Catalog entries have to be removed from
    // config.json on the server and aren't the widget's business.
    function updateRemoveModelVisibility() {
      const sel = ui.csModel;
      const opt = sel.options[sel.selectedIndex];
      const isCustom = !!(opt && opt.dataset && opt.dataset.custom);
      ui.csRemoveModel.style.display = isCustom ? "" : "none";
    }

    async function refreshCatalog(endpoint) {
      setCatalogStatus("fetching…", false);
      const { catalog: c, source } = await fetchCatalog(endpoint);
      catalog = c;
      const ok = source && source.indexOf("fallback") !== 0;
      setCatalogStatus(ok ? "catalog OK" : source, ok);
      // Re-render dropdowns against whatever's currently in the saved
      // settings, so we don't clobber the user's selection on refresh.
      const s = api.getSettings();
      populateProviderSelect(s.provider);
      populateModelSelect(ui.csProvider.value, s.model);
      updateRemoveModelVisibility();
    }

    function toggleBubble(open) {
      bubble.classList.toggle("open", open);
      if (open) {
        // Layout has to happen AFTER the .open class lands so we measure
        // real on-screen sizes, not the collapsed ones.
        requestAnimationFrame(repositionBubble);
        setTimeout(() => ui.input.focus(), 50);
      } else {
        playAvatarOutro(ui, api.getSettings());
      }
      if (typeof ui._persistRuntimeState === "function") ui._persistRuntimeState();
    }
    function syncPermissionModeControls(s) {
      ui.permModeInputs.forEach(input => {
        input.value = getPermissionMode(s, input.dataset.permMode);
      });
    }
    let characterConfigUiToken = 0;
    async function refreshCharacterDirectionsUI(characterId) {
      const token = ++characterConfigUiToken;
      const character = getCharacterDefinition(characterId);
      const config = await loadCharacterConfig(character);
      if (token !== characterConfigUiToken) return;
      const title = (character && (character.title || character.label || character.id)) || "this character";
      if (ui.csDirectionsTitle) ui.csDirectionsTitle.textContent = "Directions";
      if (ui.csDirectionsLabel) {
        const labelNode = Array.from(ui.csDirectionsLabel.childNodes || [])
          .find(node => node && node.nodeType === Node.TEXT_NODE);
        if (labelNode) labelNode.textContent = (config.userPromptLabel || `Directions for ${title}`) + "\n            ";
      }
      if (ui.csDirections) ui.csDirections.placeholder = config.userPromptPlaceholder || `Tell ${title} how you want it to behave on this site or page.`;
      if (ui.csDirectionsHelp) {
        ui.csDirectionsHelp.textContent = "These directions are appended after the character's built-in instructions.";
      }
    }
    function loadSettingsIntoUI() {
      const s = api.getSettings();
      populateCharacterSelect(s.character);
      ui.csKnowledge.value = formatKnowledgeSourcesInput(s.knowledgeSources);
      ui.csEndpoint.value = s.endpoint;
      // Provider + model dropdowns are catalog-driven; re-render against
      // the current catalog, preferring the saved selection.
      populateProviderSelect(s.provider);
      populateModelSelect(ui.csProvider.value, s.model);
      updateRemoveModelVisibility();
      if (ui.csDebugEnabled) ui.csDebugEnabled.checked = !(s.debugEnabled === false);
      ui.csDirections.value = s.userPrompt || "";
      refreshCharacterDirectionsUI(s.character);
      syncPermissionModeControls(s);
      renderDebugLog(ui, s);
    }
    function saveSettingsFromUI() {
      const s = structuredClone(api.getSettings());
      s.character = ui.csCharacter.value || DEFAULTS.character;
      s.avatar = s.character;
      s.knowledgeSources = parseKnowledgeSourcesInput(ui.csKnowledge.value);
      s.endpoint = ui.csEndpoint.value.trim() || DEFAULTS.endpoint;
      s.provider = ui.csProvider.value || DEFAULTS.provider;
      s.model    = ui.csModel.value    || DEFAULTS.model;
      s.debugEnabled = !ui.csDebugEnabled || !!ui.csDebugEnabled.checked;
      s.userPrompt = ui.csDirections.value;
      s.systemPrompt = "";
      s.systemPromptVersion = SYSTEM_PROMPT_VERSION;
      s.permissionPolicy = { ...DEFAULT_PERMISSION_POLICY };
      ui.permModeInputs.forEach(input => {
        setPermissionMode(s, input.dataset.permMode, input.value);
      });
      const result = api.setSettings(s);
      ensureKnowledgeBase(true);
      renderDebugLog(ui, s);
      // Refresh the subtitle so the newly-selected model is reflected
      // immediately — otherwise it stays stale until the next send/idle flip.
      if (!result || !result.avatarChanged) setStatus(ui, "", false, s);
    }

    // Kick off an initial catalog fetch as soon as the UI is mounted, using
    // the saved endpoint. Deliberately fire-and-forget — dropdowns work
    // immediately against the fallback; they just re-render when the real
    // catalog lands.
    refreshCatalog(settings.endpoint);
    ensureKnowledgeBase(false);

    return { ui, toggleBubble, loadSettingsIntoUI, refreshCatalog, ensureKnowledgeBase };
  }

  function addLogMessage(ui, kind, text, opts = {}) {
    const node = el(`<div class="clippy-msg ${kind}"></div>`);
    node.textContent = text;
    ui.log.appendChild(node);
    ui.log.scrollTop = ui.log.scrollHeight;
    if (ui && Array.isArray(ui._runtimeLogEntries) && opts.record !== false) {
      ui._runtimeLogEntries.push({ kind, text });
      if (typeof ui._persistRuntimeState === "function") ui._persistRuntimeState();
    }
    return node;
  }

  function debugPreview(value, maxLen = 800) {
    if (value == null) return "";
    let text = "";
    if (typeof value === "string") {
      text = value;
    } else {
      try {
        text = JSON.stringify(value);
      } catch (e) {
        text = String(value);
      }
    }
    return text.length > maxLen ? (text.slice(0, maxLen) + "…") : text;
  }

  function renderDebugLog(ui, settings) {
    if (!ui || !ui.csDebugOut) return;
    const enabled = !(settings && settings.debugEnabled === false);
    if (ui.csDebugEnabled) ui.csDebugEnabled.checked = enabled;
    if (!enabled) {
      ui.csDebugOut.textContent = "Debug log disabled.";
      return;
    }
    const entries = Array.isArray(ui._runtimeDebugEntries) ? ui._runtimeDebugEntries : [];
    ui.csDebugOut.textContent = entries.length
      ? entries.map(entry => entry.text || "").join("\n")
      : "(no debug events yet)";
    ui.csDebugOut.scrollTop = ui.csDebugOut.scrollHeight;
  }

  function addDebugEntry(ui, settings, event, data) {
    const stamp = new Date();
    const line = `[${stamp.toLocaleTimeString("en-US", { hour12: false })}.${String(stamp.getMilliseconds()).padStart(3, "0")}] ${event}${data == null ? "" : " " + debugPreview(data)}`;
    try {
      console.debug("[Clippy]", event, data);
    } catch {}
    if (!ui || !Array.isArray(ui._runtimeDebugEntries)) return line;
    ui._runtimeDebugEntries.push({ text: line });
    const extra = ui._runtimeDebugEntries.length - RUNTIME_DEBUG_LIMIT;
    if (extra > 0) ui._runtimeDebugEntries.splice(0, extra);
    if (typeof ui._persistRuntimeState === "function") ui._persistRuntimeState();
    renderDebugLog(ui, settings);
    return line;
  }

  // ---------- Source-navigation offer card ----------
  // Build a short, human-friendly caption for where a searched-up match lives.
  // Returns four strings the card template renders directly:
  //   lead         — "I found an answer…" framing sentence
  //   title        — the heading / query / fallback
  //   meta         — small-text location string (already safe HTML)
  //   primaryLabel — text for the main action button, destination-aware
  // Deliberately terse: the card has room for three lines of content before
  // it starts looking like a paragraph.
  function describeSourceTarget(target) {
    if (!target) return { lead: "", title: "", meta: "", primaryLabel: "Take me there" };
    const heading = (target.heading || "").trim();
    const query = (target.query || "").trim();
    const samePage = !target.pageUrl || target.pageUrl === location.href;

    // Title: prefer a real heading, else quote the user's search phrase,
    // else a generic label. We quote the query so "Why am I seeing
    // permission prompts?" doesn't read as if the card itself were asking.
    const title = heading
      ? heading
      : (query ? `"${query}"` : "The section you asked about");

    // Resolve a short, human-friendly page name for use in both the meta
    // line and the primary button label.
    let pageLabel = "";
    if (!samePage && target.pageUrl) {
      if (target.pageTitle) {
        pageLabel = target.pageTitle;
      } else {
        try {
          const url = new URL(target.pageUrl, location.href);
          pageLabel = url.pathname.replace(/^\//, "") || url.host;
        } catch {
          pageLabel = target.pageUrl;
        }
      }
    }

    // Lead line: explicit so the user knows what the card is offering
    // before they scan the title. Separate from the title so the title
    // can stay a clean heading/quote.
    const lead = samePage
      ? "I found this on this page:"
      : (pageLabel
          ? `I found this on <strong>${escapeHtml(pageLabel)}</strong>:`
          : "I found this on another page:");

    // Meta line: the anchor/selector, so technically-inclined users know
    // exactly where we'll land. Hidden behind a monospace code-chip.
    const anchorOrSelector = target.anchor || target.selector || "";
    const meta = anchorOrSelector
      ? `Section <code>${escapeHtml(anchorOrSelector)}</code>`
      : "";

    // Primary button text: make the destination / action concrete. The
    // old "Open it" was ambiguous — "open what?" was Jimmy's direct
    // feedback. For cross-page we name the page; for same-page we say
    // scroll, which is what we actually do.
    let primaryLabel;
    if (samePage) {
      primaryLabel = "Scroll to it";
    } else if (pageLabel) {
      // Keep it short — pageLabel could be a long title.
      const shortLabel = pageLabel.length > 28 ? pageLabel.slice(0, 27) + "…" : pageLabel;
      primaryLabel = `Open ${shortLabel}`;
    } else {
      primaryLabel = "Take me there";
    }

    return { lead, title, meta, primaryLabel };
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  // Render the deterministic Open / Not now card in the chat log. Returns the
  // card node so the caller can resolve it (swap buttons for a note) when the
  // user picks an action — either by clicking a button here or by typing a
  // short "yes" / "no" in the input as a fallback path.
  function addOfferCard(ui, target, handlers = {}) {
    const { lead, title, meta, primaryLabel } = describeSourceTarget(target);
    const card = el(`
      <div class="clippy-msg clippy-offer-card" role="group" aria-label="Source navigation offer">
        <div class="clippy-offer-card__lead"></div>
        <div class="clippy-offer-card__title"></div>
        <div class="clippy-offer-card__meta"></div>
        <div class="clippy-offer-card__actions">
          <button type="button" class="clippy-offer-card__btn primary" data-action="open"></button>
          <button type="button" class="clippy-offer-card__btn" data-action="dismiss">Not now</button>
        </div>
      </div>
    `);
    // lead and meta use innerHTML so we can bold the page name and <code>-
    // style the anchor. describeSourceTarget escapes any user-controlled
    // content it embeds, so this is safe.
    card.querySelector(".clippy-offer-card__lead").innerHTML = lead;
    card.querySelector(".clippy-offer-card__title").textContent = title;
    const metaEl = card.querySelector(".clippy-offer-card__meta");
    if (meta) metaEl.innerHTML = meta;
    else metaEl.remove();
    const openBtn = card.querySelector('[data-action="open"]');
    const dismissBtn = card.querySelector('[data-action="dismiss"]');
    openBtn.textContent = primaryLabel;
    openBtn.addEventListener("click", () => {
      if (card.classList.contains("resolved")) return;
      if (typeof handlers.onOpen === "function") handlers.onOpen(target, card);
    });
    dismissBtn.addEventListener("click", () => {
      if (card.classList.contains("resolved")) return;
      if (typeof handlers.onDismiss === "function") handlers.onDismiss(target, card);
    });
    ui.log.appendChild(card);
    ui.log.scrollTop = ui.log.scrollHeight;
    // Log persistence: we record the card as a plain system message in the
    // replayable log so a reload still shows a sensible transcript, but the
    // live interactive buttons are only attached to the fresh DOM element —
    // reloads don't try to re-wire stale targets (the flow will have already
    // resolved by then).
    if (ui && Array.isArray(ui._runtimeLogEntries)) {
      const samePage = !target.pageUrl || target.pageUrl === location.href;
      // Strip any HTML tags from meta before persisting — the plain-text log
      // stream doesn't render HTML and we don't want raw <strong> showing up.
      const plainMeta = meta ? meta.replace(/<[^>]+>/g, "") : "";
      const fallbackText = samePage
        ? `Offered to scroll to "${title}"${plainMeta ? ` (${plainMeta})` : ""}.`
        : `Offered to open "${title}"${plainMeta ? ` (${plainMeta})` : ""}.`;
      ui._runtimeLogEntries.push({ kind: "system", text: fallbackText });
      if (typeof ui._persistRuntimeState === "function") ui._persistRuntimeState();
    }
    return card;
  }
  function resolveOfferCard(card, note) {
    if (!card || card.classList.contains("resolved")) return;
    card.classList.add("resolved");
    const actions = card.querySelector(".clippy-offer-card__actions");
    if (actions) {
      actions.innerHTML = "";
      if (note) {
        const span = document.createElement("span");
        span.className = "clippy-offer-card__resolved-note";
        span.textContent = note;
        actions.appendChild(span);
      }
    }
  }
  function buildRuntimeSystemPrompt(settings, characterConfig, knowledgeContext) {
    const identity = `You are currently running on the '${settings.model}' model via the '${settings.provider}' provider.`;
    const internalPrompt = characterConfig && typeof characterConfig.systemPrompt === "string"
      ? characterConfig.systemPrompt.trim()
      : "";
    const userPrompt = settings && typeof settings.userPrompt === "string"
      ? settings.userPrompt.trim()
      : "";
    const userDirections = userPrompt
      ? `=== USER DIRECTIONS ===\n${userPrompt}`
      : "";
    return [identity, internalPrompt, userDirections, knowledgeContext].filter(Boolean).join("\n\n");
  }
  function buildGreetingText(settings) {
    const character = getCharacterDefinition(getSelectedCharacterId(settings));
    const characterTitle = (character && (character.title || character.label || character.id)) || "your assistant";
    return `Hi! I'm ${characterTitle}. I can read and change this page for you - I'll ask permission before running anything risky. Try: "make the heading red".`;
  }
  // `settings` lets the subtitle echo the currently-active model so Jimmy
  // can see at a glance which brain is in the driver's seat. The third
  // argument is backwards-compatible: callers that don't pass it fall back
  // to the old "just show the status" behaviour.
  function setStatus(ui, text, thinking, settings, avatarMode) {
    const model = settings && settings.model ? settings.model : null;
    const mode = avatarMode || (thinking ? "thinking" : "idle");
    ui.avatarDesired = { text: text || "", thinking: !!thinking, avatarMode: mode };
    // Subtitle: "<status> · <model>" when both exist, otherwise whichever
    // one we have. Status badge on the paperclip keeps just the status text.
    let subText = text || "";
    if (model) subText = subText ? `${subText} · ${model}` : model;
    ui.sub.textContent = subText;
    ui.status.textContent = text || "";
    ui.status.style.display = text ? "inline-block" : "none";
    if (ui.avatarTransitionActive && mode !== "intro" && mode !== "outro") return;
    setAvatarMode(ui, settings, mode);
  }

  // ---------- Permission dialog ----------
  function askPermission(ui, call, permKey) {
    return new Promise(resolve => {
      const avatar = getAvatarDefinition(getAvatarMetaId(ui && ui.avatarMeta));
      const avatarTitle = (avatar && (avatar.title || avatar.label || avatar.id)) || "Clippy";
      const permLabel = PERMISSION_LABELS[permKey] || call.tool;
      const permExplanation = PERMISSION_EXPLANATIONS[permKey] || "Allow this capability for the current page.";
      const action = formatPermissionAction(call);
      ui.confirm.classList.add("open");
      ui.confirmTitle.textContent = `${avatarTitle} wants permission to ${lowerFirst(permLabel)}:`;
      ui.confirmTool.textContent = action.detail || `This request: ${capitalizeFirst(action.headline)}.`;
      ui.confirmBody.textContent = [
        `Permission: ${permLabel}`,
        `What this allows: ${permExplanation}`,
        `This request: ${capitalizeFirst(action.headline)}.`,
        "",
        "Arguments:",
        JSON.stringify(call.args, null, 2),
      ].filter(Boolean).join("\n");
      ui.confirmAlways.textContent = `Always allow ${permLabel}`;
      const cleanup = () => {
        ui.confirm.classList.remove("open");
        ui.confirmApprove.onclick = ui.confirmDeny.onclick = ui.confirmAlways.onclick = null;
      };
      ui.confirmApprove.onclick = () => { cleanup(); resolve({ allow: true, remember: false }); };
      ui.confirmDeny.onclick    = () => { cleanup(); resolve({ allow: false, remember: false }); };
      ui.confirmAlways.onclick  = () => { cleanup(); resolve({ allow: true, remember: true }); };
    });
  }

  // ---------- Main controller ----------
  function mount(opts = {}) {
    // Prevent double-mount
    if (document.getElementById("clippy-root")) return window.Clippy;

    let settings = loadSettings();
    if (Array.isArray(opts.characterPacks)) {
      for (const pack of opts.characterPacks) {
        if (pack && typeof pack === "object") registerCharacterPack(pack);
      }
    }
    primeCharacterPackRegistry();
    if (opts.endpoint) settings.endpoint = opts.endpoint;
    if (opts.model) settings.model = opts.model;
    if (opts.character) settings.character = opts.character;
    if (opts.avatar && !opts.character) settings.character = opts.avatar;
    if (opts.knowledgeSources) settings.knowledgeSources = normalizeKnowledgeSources(opts.knowledgeSources);
    if (opts.knowledgeFiles) settings.knowledgeSources = normalizeKnowledgeSources(opts.knowledgeFiles);
    settings = syncCharacterSettingFields(settings);

    const root = el(`<div class="clippy-root" id="clippy-root"></div>`);
    document.body.appendChild(root);

    const history = []; // [{role, content}]
    const logEntries = [];
    const debugEntries = [];
    let abortController = null;
    let pendingNavigation = null;
    let pendingNavigationRequest = null;
    let pendingSourceTarget = null;
    let pendingNavigationClearTimer = null;
    const restoredRuntime = loadRuntimeSession();

    function clearPendingNavigationTimer() {
      if (!pendingNavigationClearTimer) return;
      clearTimeout(pendingNavigationClearTimer);
      pendingNavigationClearTimer = null;
    }
    function persistRuntimeState() {
      saveRuntimeSession({
        savedAt: Date.now(),
        pageUrl: location.href,
        history: trimRuntimeHistory(history),
        logEntries: trimRuntimeLogs(logEntries),
        debugEntries: trimRuntimeDebug(debugEntries),
        bubbleOpen: !!(_ui && _ui.bubble && _ui.bubble.classList.contains("open")),
        pendingNavigation,
      });
    }
    function pushHistory(role, content) {
      history.push({ role, content });
      persistRuntimeState();
    }
    function schedulePendingNavigationClear(sourceUrl) {
      clearPendingNavigationTimer();
      pendingNavigationClearTimer = setTimeout(() => {
        if (pendingNavigation && pendingNavigation.sourceUrl === sourceUrl && location.href === sourceUrl) {
          pendingNavigation = null;
          persistRuntimeState();
        }
      }, PENDING_NAV_CLEAR_DELAY_MS);
    }
    function markPendingNavigation(call) {
      const target = summarizeNavigationTarget(call);
      if (!target) return null;
      pendingNavigation = {
        ...target,
        createdAt: Date.now(),
        expiresAt: Date.now() + PENDING_NAV_TTL_MS,
      };
      persistRuntimeState();
      schedulePendingNavigationClear(target.sourceUrl);
      return pendingNavigation;
    }
    function clearPendingNavigation() {
      clearPendingNavigationTimer();
      pendingNavigation = null;
      persistRuntimeState();
    }
    function clearPendingNavigationRequest() {
      pendingNavigationRequest = null;
    }
    function clearPendingSourceTarget() {
      pendingSourceTarget = null;
    }
    // Live reference to the offer card currently in the log (if any). Used so
    // approve/dismiss — whether it comes from a button click or a typed
    // "yes" / "no" reply — can resolve the card back to a passive note so the
    // user can see what they picked instead of the buttons just vanishing.
    let pendingSourceOfferCard = null;
    function clearPendingSourceOfferCard() {
      pendingSourceOfferCard = null;
    }
    // Decide whether to show a deterministic "open it / not now" card for a
    // freshly located source. The card replaces the old "model writes prose
    // asking, user types yes, handleSend forwards yes to model, model
    // hopefully figures out to emit dispatch_event on a link" chain — which
    // had a half-dozen failure modes that were directly observed in Jimmy's
    // testing (no offer, tool-loop exhaustion, model paraphrases instead of
    // navigating, etc.).
    //
    // Two suppression rules:
    //   • navigate permission === "ignore": user has explicitly said never
    //     navigate. Respect that — no offer.
    //   • cross-page match with no pageUrl / selector / anchor we can resolve
    //     back to an element. Without those, clicking Open would leave us on
    //     a page with no target to scroll to, which is worse than nothing.
    function shouldOfferSourceNavigation(target) {
      if (!target) return false;
      const navMode = getPermissionMode(settings, "navigate");
      if (navMode === "ignore") return false;
      const samePage = !target.pageUrl || target.pageUrl === location.href;
      if (samePage) {
        // Same-page handoff is better served by autoRevealCurrentSource —
        // the scroll is cheap and doesn't need confirmation. Skip the card
        // when we have a narrow selector (auto-reveal will handle it).
        const hasNarrowSelector = target.selector && !isBroadSourceSelector(target.selector);
        if (hasNarrowSelector) return false;
        // Broad selector or none: only worth offering if we have an anchor
        // to jump to — otherwise "Scroll to it" would do nothing meaningful.
        return !!target.anchor;
      }
      // Cross-page: we need at minimum a page URL to open, and either an
      // anchor or a resolvable selector for the post-load scroll. Anchors
      // are most reliable across a DOMParser-parsed remote document.
      if (!target.pageUrl) return false;
      return !!(target.anchor || target.selector);
    }
    function offerSourceNavigation(target) {
      if (!shouldOfferSourceNavigation(target)) return null;
      // If a previous card is still live (e.g. two searches in a row), resolve
      // it as superseded so the log reads sensibly rather than showing two
      // competing "open it" buttons.
      if (pendingSourceOfferCard) {
        resolveOfferCard(pendingSourceOfferCard, "Superseded by a newer result.");
        pendingSourceOfferCard = null;
      }
      const card = addOfferCard(ui, target, {
        onOpen: async (pickedTarget, node) => {
          resolveOfferCard(node, "Opening it now.");
          if (pendingSourceOfferCard === node) pendingSourceOfferCard = null;
          setStatus(ui, "opening…", true, settings, "acting");
          try {
            await executeConfirmedSourceNavigation(pickedTarget);
          } catch (e) {
            addLogMessage(ui, "error", "Could not open that: " + (e && e.message || e));
          } finally {
            setStatus(ui, "idle", false, settings);
          }
        },
        onDismiss: (_pickedTarget, node) => {
          resolveOfferCard(node, "Not now — staying on this page.");
          if (pendingSourceOfferCard === node) pendingSourceOfferCard = null;
          clearPendingSourceTarget();
          addLogMessage(ui, "assistant", "Okay, I'll leave that where it is.");
          pushHistory("assistant", "Okay, I'll leave that where it is.");
          setStatus(ui, "idle", false, settings);
        },
      });
      pendingSourceOfferCard = card;
      return card;
    }
    function rememberLocatedSource(call, result) {
      if (!call || !result || result.ok !== true) return;
      if (call.tool === "search_site") {
        const match = pickBestSourceMatch(result.matches || []);
        if (!match) return;
        pendingSourceTarget = {
          pageUrl: match.pageUrl || location.href,
          pageTitle: match.pageTitle || "",
          selector: match.selector || "",
          anchor: match.anchor || "",
          heading: match.heading || "",
          query: result.query || "",
          createdAt: Date.now(),
        };
        return;
      }
      if (call.tool === "find_text") {
        const match = pickBestSourceMatch(result.matches || []);
        if (!match) return;
        pendingSourceTarget = {
          pageUrl: location.href,
          pageTitle: document.title || "",
          selector: match.selector || "",
          anchor: match.anchor || "",
          heading: match.heading || "",
          query: result.query || "",
          createdAt: Date.now(),
        };
        return;
      }
      if ((call.tool === "read_dom" || call.tool === "scroll_into_view") &&
          call.args && typeof call.args.selector === "string" &&
          !isBroadSourceSelector(call.args.selector)) {
        pendingSourceTarget = {
          pageUrl: location.href,
          pageTitle: document.title || "",
          selector: call.args.selector,
          anchor: "",
          heading: "",
          query: "",
          createdAt: Date.now(),
        };
        return;
      }
      // query_all is a legitimate "find" call — the model uses it to locate
      // the contact form, a heading, a button, etc. on the current page.
      // If it returns a single match (or a match with a usable id), treat
      // the hit as a source target so the auto-reveal path can scroll to it.
      // Multiple matches without ids stay ambiguous and fall through.
      if (call.tool === "query_all" &&
          Array.isArray(result.items) && result.items.length > 0) {
        const first = result.items[0];
        const firstId = first && typeof first.id === "string" && first.id ? first.id : "";
        const originalSelector = call.args && typeof call.args.selector === "string" ? call.args.selector : "";
        // Prefer an id-based selector — it's stable across re-reads. Fall
        // back to the original selector only when there's exactly one match,
        // so it uniquely identifies the node.
        let selector = "";
        if (firstId) {
          selector = `#${firstId}`;
        } else if (result.items.length === 1 && originalSelector && !isBroadSourceSelector(originalSelector)) {
          selector = originalSelector;
        }
        if (selector) {
          pendingSourceTarget = {
            pageUrl: location.href,
            pageTitle: document.title || "",
            selector,
            anchor: firstId ? `#${firstId}` : "",
            heading: (first && typeof first.text === "string" ? first.text : "").slice(0, 80),
            query: "",
            createdAt: Date.now(),
          };
        }
      }
    }
    async function executeConfirmedSourceNavigation(target) {
      if (!target || (!target.pageUrl && !target.selector)) return;
      clearPendingSourceTarget();
      const samePage = !target.pageUrl || target.pageUrl === location.href;
      if (samePage && target.selector) {
        addLogMessage(ui, "assistant", "Bringing it into view now.");
        pushHistory("assistant", "Bringing it into view now.");
        addLogMessage(ui, "tool",
          `→ scroll_into_view(${JSON.stringify({ selector: target.selector, behavior: "smooth", block: "center" })})  [confirmed source navigation]`);
        let result;
        try {
          setStatus(ui, "interacting… scroll_into_view", false, settings, "acting");
          result = await Promise.resolve(TOOLS.scroll_into_view({
            selector: target.selector,
            behavior: "smooth",
            block: "center",
          }));
        } catch (e) {
          result = { ok: false, error: String(e && e.message || e) };
        }
        addLogMessage(ui, "tool", "  = " + JSON.stringify(result).slice(0, 600));
        pushHistory("user", `[tool_result: scroll_into_view] ${JSON.stringify(result)}`);
        setStatus(ui, "idle", false, settings);
        return;
      }
      const finalUrl = `${target.pageUrl || location.href}${target.anchor || ""}`;
      const nav = {
        kind: "link",
        sourceUrl: location.href,
        targetUrl: finalUrl,
        label: target.heading || target.pageTitle || finalUrl,
        createdAt: Date.now(),
        expiresAt: Date.now() + PENDING_NAV_TTL_MS,
        // Mark this as a user-confirmed source reveal so the post-reload
        // resume path knows to just land + scroll + say hi, instead of
        // restarting the full conversation loop (which is what was
        // causing the model to re-propose the navigation or get stuck
        // calling more tools after arriving).
        sourceReveal: true,
        revealSelector: target.selector || "",
        revealAnchor: target.anchor || "",
        revealHeading: target.heading || "",
        revealQuery: target.query || "",
      };
      pendingNavigation = nav;
      persistRuntimeState();
      clearPendingNavigationTimer();
      addLogMessage(ui, "assistant", "Opening it now.");
      pushHistory("assistant", "Opening it now.");
      addLogMessage(ui, "tool",
        `→ navigate_to(${JSON.stringify({ url: finalUrl })})  [confirmed source navigation]`);
      addLogMessage(ui, "tool", "  = " + JSON.stringify({ ok: true, navigating: finalUrl }).slice(0, 600));
      pushHistory("user", `[tool_result: navigate_to] ${JSON.stringify({ ok: true, navigating: finalUrl })}`);
      window.location.href = finalUrl;
    }
    async function autoRevealCurrentSource(target, results) {
      if (!target || !target.selector) return false;
      if (target.pageUrl && target.pageUrl !== location.href) return false;
      if (isBroadSourceSelector(target.selector)) return false;
      let result;
      addLogMessage(ui, "tool",
        `→ scroll_into_view(${JSON.stringify({ selector: target.selector, behavior: "smooth", block: "center" })})  [auto source reveal]`);
      try {
        setStatus(ui, "interacting… scroll_into_view", false, settings, "acting");
        result = await Promise.resolve(TOOLS.scroll_into_view({
          selector: target.selector,
          behavior: "smooth",
          block: "center",
        }));
      } catch (e) {
        result = { ok: false, error: String(e && e.message || e) };
      }
      addLogMessage(ui, "tool", "  = " + JSON.stringify(result).slice(0, 600));
      if (Array.isArray(results)) {
        results.push(`[tool_result: scroll_into_view] ${JSON.stringify(result)}`);
      }
      if (result && result.ok) {
        addLogMessage(ui, "assistant", "I found it and brought that section into view.");
      }
      return !!(result && result.ok);
    }
    async function executeConfirmedNavigationRequest(request) {
      if (!request || !request.call) return;
      clearPendingNavigationRequest();
      const call = request.call;
      addLogMessage(ui, "assistant", "Opening it now.");
      pushHistory("assistant", "Opening it now.");
      addLogMessage(ui, "tool",
        `→ ${call.tool}(${JSON.stringify(call.args)})  [confirmed navigation]`);
      let result;
      try {
        markPendingNavigation(call);
        setStatus(ui, `interacting… ${call.tool}`, false, settings, "acting");
        result = await Promise.resolve(TOOLS[call.tool](call.args || {}));
      } catch (e) {
        result = { ok: false, error: String(e && e.message || e) };
      }
      addLogMessage(ui, "tool", "  = " + JSON.stringify(result).slice(0, 600));
      pushHistory("user", `[tool_result: ${call.tool}] ${JSON.stringify(result)}`);
      if (!result || !result.ok) {
        addLogMessage(ui, "assistant", "I couldn't open that page. I'll stay here.");
      }
      setStatus(ui, "idle", false, settings);
    }

    const api = {
      getSettings: () => settings,
      setSettings: (s) => {
        const previousSettings = settings;
        settings = {
          ...s,
          knowledgeSources: normalizeKnowledgeSources(s && s.knowledgeSources),
          permissionPolicy: derivePermissionPolicy(s || {}),
        };
        settings = syncCharacterSettingFields(settings);
        saveSettings(settings);
        persistRuntimeState();
        const previousCharacter = getSelectedCharacterId(previousSettings);
        const characterChanged = previousCharacter !== getSelectedCharacterId(settings);
        if (characterChanged && _ui) {
          transitionAvatarChange(_ui, previousCharacter, settings);
        }
        return {
          characterChanged,
          avatarChanged: characterChanged,
          previousCharacter,
          previousAvatar: previousCharacter,
          character: getSelectedCharacterId(settings),
          avatar: settings.avatar,
        };
      },
      clear: () => {
        history.length = 0;
        logEntries.length = 0;
        clearPendingNavigationTimer();
        pendingNavigation = null;
        pendingNavigationRequest = null;
        pendingSourceTarget = null;
        pendingSourceOfferCard = null;
        _ui.log.innerHTML = "";
        addLogMessage(_ui, "assistant", buildGreetingText(settings));
        setStatus(_ui, "", false, settings);
      },
      send: (text) => handleSend(text),
    };

    const { ui, toggleBubble, ensureKnowledgeBase } = buildUI(root, settings, api);
    const _ui = ui;
    ui._runtimeLogEntries = logEntries;
    ui._runtimeDebugEntries = debugEntries;
    ui._persistRuntimeState = persistRuntimeState;

    let resumeNavigation = null;
    if (restoredRuntime) {
      trimRuntimeHistory(restoredRuntime.history).forEach(entry => {
        if (entry && typeof entry.role === "string" && typeof entry.content === "string") {
          history.push({ role: entry.role, content: entry.content });
        }
      });
      trimRuntimeLogs(restoredRuntime.logEntries).forEach(entry => {
        if (entry && typeof entry.kind === "string" && typeof entry.text === "string") {
          logEntries.push({ kind: entry.kind, text: entry.text });
          addLogMessage(ui, entry.kind, entry.text, { record: false });
        }
      });
      trimRuntimeDebug(restoredRuntime.debugEntries).forEach(entry => {
        if (entry && typeof entry.text === "string") {
          debugEntries.push({ text: entry.text });
        }
      });
      if (restoredRuntime.bubbleOpen) toggleBubble(true);
      const candidate = restoredRuntime.pendingNavigation;
      if (candidate && candidate.expiresAt > Date.now()) {
        pendingNavigation = candidate;
        resumeNavigation = candidate;
      }
    }

    // Initial greeting
    if (!logEntries.length && !history.length) {
      addLogMessage(ui, "assistant", buildGreetingText(settings));
    }
    renderDebugLog(ui, settings);

    // Show the active model in the subtitle from the start, so it's visible
    // before the first message. "" as the status means "not busy" — the
    // subtitle will just read the model name.
    setStatus(ui, "", false, settings);
    playAvatarIntro(ui, settings);
    persistRuntimeState();
    window.addEventListener("pagehide", persistRuntimeState);

    async function handleSend(text) {
      text = (text || "").trim();
      if (!text) return;
      addDebugEntry(ui, settings, "user.send", { chars: text.length, preview: text.slice(0, 180) });
      ui.input.value = "";
      addLogMessage(ui, "user", text);
      pushHistory("user", text);
      if (pendingNavigationRequest) {
        const navReply = classifyNavigationReply(text);
        if (navReply === "approve") {
          await executeConfirmedNavigationRequest(pendingNavigationRequest);
          return;
        }
        if (navReply === "deny") {
          clearPendingNavigationRequest();
          if (isShortNavigationReply(text)) {
            addLogMessage(ui, "assistant", "Okay, I'll stay on this page.");
            pushHistory("assistant", "Okay, I'll stay on this page.");
            setStatus(ui, "idle", false, settings);
            return;
          }
        } else {
          clearPendingNavigationRequest();
        }
      }

      // Typed-reply fallback for the source-offer card. If a card is live and
      // the user typed a short yes / no instead of clicking, treat that the
      // same way the buttons would. Only shortcut on clearly-approving or
      // clearly-denying replies — ambiguous answers fall through so the
      // model can use the typed text as additional context (e.g. "yes but
      // also find X").
      if (pendingSourceTarget &&
          pendingSourceTarget.createdAt + PENDING_SOURCE_TTL_MS > Date.now()) {
        const navReply = classifyNavigationReply(text);
        if (navReply === "approve" && isShortNavigationReply(text)) {
          if (pendingSourceOfferCard) {
            resolveOfferCard(pendingSourceOfferCard, "Opening it now.");
            pendingSourceOfferCard = null;
          }
          const target = pendingSourceTarget;
          setStatus(ui, "opening…", true, settings, "acting");
          try {
            await executeConfirmedSourceNavigation(target);
          } catch (e) {
            addLogMessage(ui, "error", "Could not open that: " + (e && e.message || e));
          } finally {
            setStatus(ui, "idle", false, settings);
          }
          return;
        }
        if (navReply === "deny" && isShortNavigationReply(text)) {
          if (pendingSourceOfferCard) {
            resolveOfferCard(pendingSourceOfferCard, "Not now — staying on this page.");
            pendingSourceOfferCard = null;
          }
          clearPendingSourceTarget();
          addLogMessage(ui, "assistant", "Okay, I'll leave it here and stay on this page.");
          pushHistory("assistant", "Okay, I'll leave it here and stay on this page.");
          setStatus(ui, "idle", false, settings);
          return;
        }
      }

      setStatus(ui, "thinking…", true, settings);
      ui.send.disabled = true;
      abortController = new AbortController();

      try {
        await conversationLoop(abortController.signal);
      } catch (e) {
        addLogMessage(ui, "error", "Error: " + (e && e.message || e));
      } finally {
        setStatus(ui, "idle", false, settings);
        ui.send.disabled = false;
        abortController = null;
      }
    }

    // Lightweight landing path for a user-confirmed source navigation — the
    // user already told us what they want to see, so restarting the model
    // loop (the original resume behavior) just gave the model more rope to
    // re-propose, re-search, or churn. This variant just lands, scrolls the
    // target into view, and prints a short note; if it can't find the
    // target it hands off to the regular resume.
    async function landOnConfirmedSource(nav) {
      if (!nav) return;
      clearPendingNavigation();
      toggleBubble(true);
      // Prefer the anchor (sits on a real id, most reliable) then fall back
      // to the selector captured at search time. We schedule the scroll
      // through requestAnimationFrame so the browser finishes laying out
      // the new page first — scrolling before layout settles is a common
      // "it didn't scroll" source of bugs.
      const anchor = nav.revealAnchor || "";
      const selector = anchor || nav.revealSelector || "";
      const landMsg = nav.revealHeading
        ? `Here we are — "${nav.revealHeading}".`
        : (nav.revealQuery
            ? `Here's where the answer lives for "${nav.revealQuery}".`
            : "Here's the section you asked for.");
      addLogMessage(ui, "system", "Landed on the page you asked for.");
      if (!selector) {
        // No target to scroll to. Fall back to a normal resume so the model
        // can decide what to do on the new page.
        return resumeNavigationTask(nav);
      }
      let scrolled = false;
      for (let attempt = 0; attempt < 3 && !scrolled; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 120));
        }
        try {
          const res = TOOLS.scroll_into_view({ selector, behavior: "smooth", block: "center" });
          if (res && res.ok) scrolled = true;
        } catch {}
      }
      if (scrolled) {
        addLogMessage(ui, "assistant", landMsg);
        pushHistory("assistant", landMsg);
        pushHistory("user",
          `[tool_result: scroll_into_view] ${JSON.stringify({ ok: true, selector })}`);
      } else {
        addLogMessage(ui, "assistant",
          "I opened the page but couldn't find the exact section to scroll to.");
        pushHistory("assistant",
          "I opened the page but couldn't find the exact section to scroll to.");
      }
      setStatus(ui, "idle", false, settings);
    }

    async function resumeNavigationTask(nav) {
      if (!nav) return;
      clearPendingNavigation();
      toggleBubble(true);
      addLogMessage(ui, "system", "Resuming your task on this page.");
      const summary = nav.label ? `Navigation target: ${nav.label}.` : "";
      const resumeMessage = [
        "[navigation_resume]",
        `The page reloaded after a same-site ${nav.kind || "navigation"} from '${nav.sourceUrl}' to '${location.href}'.`,
        summary,
        "Continue helping with the same user request on this new page.",
        "Read the relevant DOM on this page before acting further.",
      ].filter(Boolean).join(" ");
      pushHistory("user", resumeMessage);

      setStatus(ui, "thinking...", true, settings);
      ui.send.disabled = true;
      abortController = new AbortController();
      try {
        await conversationLoop(abortController.signal);
      } catch (e) {
        addLogMessage(ui, "error", "Error: " + (e && e.message || e));
      } finally {
        setStatus(ui, "idle", false, settings);
        ui.send.disabled = false;
        abortController = null;
      }
    }

    async function conversationLoop(signal) {
      // If the user has cleared the system prompt (or we're running with the
      // empty default), skip the system turn entirely rather than sending an
      // empty one — some models read an empty system message as a cue to be
      // terse / refuse.
      const knowledge = await ensureKnowledgeBase(false);
      const knowledgeContext = buildKnowledgeContext(knowledge, history);
      const character = getCharacterDefinition(getSelectedCharacterId(settings));
      const characterConfig = await loadCharacterConfig(character);
      const fullSys = buildRuntimeSystemPrompt(settings, characterConfig, knowledgeContext);
      const messages = fullSys
        ? [{ role: "system", content: fullSys }, ...history]
        : [...history];

      // Circuit breaker for identical tool calls. Real-world testing on
      // RealmKit showed the model repeating the exact same dispatch_event
      // (wrong selector, or dispatched on a hidden element) until
      // maxToolLoops ran out. Once we've seen the same (tool, args) twice,
      // the third+ attempt is short-circuited with a targeted hint in
      // place of executing the tool again — which breaks the loop faster
      // and gives the model something concrete to react to.
      const CIRCUIT_BREAKER_THRESHOLD = 2;
      const callSignatures = new Map();
      const signatureForCall = (call) => {
        try {
          return JSON.stringify({ t: call.tool || "", a: call.args || {} });
        } catch {
          return `${call.tool || ""}|[unserializable args]`;
        }
      };

      // Pattern-based breaker: the signature breaker above only catches
      // repeated EXACT calls. Observed failure on RealmKit — the model
      // rotated selectors (div:contains(...) → button.rs-btn-gold:contains(...)
      // → …) so every signature was unique, yet every call produced the same
      // category of error ("invalid selector"). Track (tool, error-category)
      // across ALL args and trip once the same category hits the threshold.
      const PATTERN_BREAKER_THRESHOLD = 2;
      const errorPatternCounts = new Map();
      const categorizeToolError = (result) => {
        if (!result || result.ok) return null;
        const msg = String(result.error || "").toLowerCase();
        if (!msg) return null;
        if (msg.includes("xpath") ||
            msg.includes(":contains") ||
            msg.includes("jquery") ||
            msg.includes("not a valid selector") ||
            msg.startsWith("invalid selector") ||
            msg.includes("unknown pseudo-class") ||
            msg.includes("failed to execute 'queryselector")) {
          return "invalid-selector";
        }
        if (msg.startsWith("no element matches") ||
            msg.startsWith("no parent matches") ||
            msg.includes("no <option> matched")) {
          return "no-match";
        }
        return null;
      };

      for (let i = 0; i < settings.maxToolLoops; i++) {
        if (signal.aborted) throw new Error("aborted");

        setStatus(ui, `thinking… (${i + 1})`, true, settings);
        const reply = await ollamaChat(settings, messages, signal);
        const { spoken, calls } = parseToolCalls(reply);

        // Record assistant turn (full raw, so the model sees its own tool calls next turn)
        pushHistory("assistant", reply);
        messages.push({ role: "assistant", content: reply });

        if (spoken) addLogMessage(ui, "assistant", spoken);
        if (!calls.length) return;

        // Execute each tool call, appending a tool_result user turn per call
        const results = [];
        for (const call of calls) {
          if (call.tool === "__parse_error") {
            addLogMessage(ui, "error", "Malformed tool JSON: " + call.args.error);
            results.push(`[tool_result: __parse_error] ${JSON.stringify(call.args)}`);
            continue;
          }
          const permKey = getPermissionKeyForCall(call);
          if (permKey === undefined) {
            addLogMessage(ui, "error", "Unknown tool: " + call.tool);
            results.push(`[tool_result: ${call.tool}] {"ok":false,"error":"unknown tool"}`);
            continue;
          }
          // Circuit breaker: detect the same exact (tool, args) being
          // re-issued. Don't execute on the third+ attempt — just feed a
          // concrete hint back. `done` is never rate-limited because
          // repeated `done` is harmless (the first one returns anyway).
          if (call.tool !== "done") {
            const signature = signatureForCall(call);
            const priorCount = callSignatures.get(signature) || 0;
            callSignatures.set(signature, priorCount + 1);
            if (priorCount >= CIRCUIT_BREAKER_THRESHOLD) {
              const hint =
                `You have called ${call.tool} with these exact arguments ${priorCount + 1} times and got the same result. ` +
                "Stop repeating. Try one of: " +
                "(a) use `find_text` or `query_all` to locate a different selector, " +
                "(b) switch to a different tool, or " +
                "(c) explain to the user in plain text that you cannot complete this step.";
              addLogMessage(ui, "system",
                `Circuit breaker: ${call.tool} repeated ${priorCount + 1}× — skipping execution.`);
              addDebugEntry(ui, settings, "loop.circuit_breaker",
                { tool: call.tool, count: priorCount + 1 });
              addLogMessage(ui, "tool",
                `→ ${call.tool}(${JSON.stringify(call.args)})  [circuit-breaker]`);
              results.push(`[tool_result: ${call.tool}] ${JSON.stringify({
                ok: false,
                error: "circuit_breaker",
                repeatedCount: priorCount + 1,
                hint,
              })}`);
              continue;
            }
          }
          const permissionMode = getPermissionMode(settings, permKey);
          const promptForPermission = permKey != null && permissionMode === "prompt" && permKey !== "navigate";
          const ignoredByPolicy = permKey != null && permissionMode === "ignore";
          const originalAlwaysConfirm = settings.alwaysConfirm;
          // "done" has no perm
          let allowed = permKey == null || !ignoredByPolicy;
          settings.alwaysConfirm = promptForPermission;
          if (allowed && settings.alwaysConfirm && permKey != null) {
            setStatus(ui, "waiting for permission", false, settings, "permission");
            const { allow, remember } = await askPermission(ui, call, permKey);
            setStatus(ui, "thinking…", true, settings);
            if (!allow) allowed = false;
            else if (remember) {
              setPermissionMode(settings, permKey, "allow");
              saveSettings(settings);
              ui.permModeInputs.forEach(input => {
                if (input.dataset.permMode === permKey) input.value = "allow";
              });
            }
          } else if (!allowed && !ignoredByPolicy) {
            // Permission disabled entirely — prompt the user to optionally enable
            setStatus(ui, "permission needed", false, settings, "permission");
            const { allow, remember } = await askPermission(ui, call, permKey);
            setStatus(ui, "thinking…", true, settings);
            if (allow) {
              allowed = true;
              if (remember) {
                setPermissionMode(settings, permKey, "allow");
                saveSettings(settings);
                ui.permModeInputs.forEach(input => {
                  if (input.dataset.permMode === permKey) input.value = "allow";
                });
              }
            }
          }

          settings.alwaysConfirm = originalAlwaysConfirm;
          const navigationTarget = permKey === "navigate"
            ? summarizeNavigationTarget(call, { sameOriginOnly: false })
            : null;
          // Navigate-confirmation gate. Three modes per the permission policy:
          //   • "ignore" → `allowed` is already false above, never enters here.
          //   • "prompt" → show the prose "I found a page that might help.
          //     Do you want me to open it in this tab?" confirmation and
          //     block the tool until the user says yes/no.
          //   • "allow"  → "Just do": skip the extra confirmation entirely
          //     and let the dispatch_event execute normally below. The
          //     anchor click / form submit drives a real browser navigation
          //     and the post-reload resume path rehydrates the conversation.
          // Without the `permissionMode !== "allow"` guard, navigate=allow
          // was still getting gated by the prose confirmation — which was
          // the bug Jimmy reported ("set to Just do, it still prompts").
          if (allowed && navigationTarget && permissionMode !== "allow") {
            pendingNavigationRequest = {
              call,
              target: navigationTarget,
              createdAt: Date.now(),
            };
            addLogMessage(ui, "tool",
              `â†’ ${call.tool}(${JSON.stringify(call.args)})  [awaiting navigation confirmation]`);
            const result = {
              ok: false,
              error: "awaiting navigation confirmation",
              navigation: {
                kind: navigationTarget.kind,
                targetUrl: navigationTarget.targetUrl,
                label: navigationTarget.label || "",
              },
            };
            addLogMessage(ui, "tool", "  = " + JSON.stringify(result).slice(0, 600));
            results.push(`[tool_result: ${call.tool}] ${JSON.stringify(result)}`);
            const askText = buildNavigationConfirmationText(navigationTarget);
            addLogMessage(ui, "assistant", askText);
            pushHistory("assistant", askText);
            setStatus(ui, "awaiting navigation confirmation", false, settings, "permission");
            const toolTurn = results.join("\n");
            pushHistory("user", toolTurn);
            messages.push({ role: "user", content: toolTurn });
            return;
          }
          const blockReason = ignoredByPolicy ? "ignored by permission policy" : "denied by user";
          const blockedTag = allowed ? "" : (ignoredByPolicy ? "  [ignored]" : "  [denied]");
          addLogMessage(ui, "tool",
            `→ ${call.tool}(${JSON.stringify(call.args)})${blockedTag}`);

          let result;
          if (!allowed) {
            result = { ok: false, error: blockReason };
          } else {
            markPendingNavigation(call);
            if (call.tool !== "done") {
              setStatus(ui, `interacting… ${call.tool}`, false, settings, "acting");
            }
            try {
              result = await Promise.resolve(TOOLS[call.tool](call.args || {}));
            } catch (e) {
              result = { ok: false, error: String(e && e.message || e) };
            }
          }
          // Pattern-based circuit breaker — track repeated error categories
          // across varying args. Only applies to tools with selector inputs;
          // `done` and unknown tools are already handled above.
          if (allowed && call.tool !== "done") {
            const category = categorizeToolError(result);
            if (category) {
              const key = `${call.tool}|${category}`;
              const priorCount = errorPatternCounts.get(key) || 0;
              errorPatternCounts.set(key, priorCount + 1);
              if (priorCount >= PATTERN_BREAKER_THRESHOLD) {
                const hint = category === "invalid-selector"
                  ? `You have produced an invalid CSS selector for ${call.tool} ${priorCount + 1} times with different arguments. ` +
                    "Stop trying new selectors. Use `find_text` with a plain-text query to locate the element — it returns the exact selector to use. " +
                    "Do not use `:contains()`, XPath (`//button[...]`), or other non-CSS extensions."
                  : `${call.tool} has returned \"no match\" ${priorCount + 1} times with different selectors. ` +
                    "The element may not exist on this page, may be hidden, or may be inside an iframe. " +
                    "Use `search_site` to check linked pages, or tell the user you cannot find the element.";
                addLogMessage(ui, "system",
                  `Circuit breaker (pattern): ${call.tool}/${category} ${priorCount + 1}× — overriding result.`);
                addDebugEntry(ui, settings, "loop.circuit_breaker_pattern",
                  { tool: call.tool, category, count: priorCount + 1, originalError: result && result.error });
                result = {
                  ok: false,
                  error: "circuit_breaker_pattern",
                  category,
                  repeatedCount: priorCount + 1,
                  hint,
                };
              }
            }
          }
          addLogMessage(ui, "tool", "  = " + JSON.stringify(result).slice(0, 600));
          // Snapshot the source target's createdAt before rememberLocatedSource
          // so we can tell whether THIS specific tool call updated it. Using a
          // createdAt-comparison lets us gate reveal on "this call just
          // produced a locate" without hard-coding a tool whitelist — so
          // query_all, find_text, search_site, read_dom all work the same.
          const sourceTargetBeforeTs = pendingSourceTarget ? pendingSourceTarget.createdAt : 0;
          rememberLocatedSource(call, result);
          const sourceTargetJustUpdated =
            !!pendingSourceTarget && pendingSourceTarget.createdAt > sourceTargetBeforeTs;
          results.push(`[tool_result: ${call.tool}] ${JSON.stringify(result)}`);

          // Source-navigation handoff. After any tool call that successfully
          // locates a target AND the user's original ask was a find/take-me
          // request, one of two paths fires — and either way the model does
          // NOT get another turn to "offer" in prose (which is where the
          // old flow got stuck making the model emit a dispatch_event that
          // then re-prompted the user for navigation permission on top of
          // the yes they already said):
          //
          //   • Same-page hit with a narrow selector → autoRevealCurrentSource
          //     scrolls directly. Loop continues so the model can narrate.
          //   • Cross-page hit OR same-page hit without a narrow selector →
          //     render the Open / Not now card and RETURN from the loop.
          //     The user's button click (or typed yes/no) drives the next step.
          if (sourceTargetJustUpdated &&
              result && result.ok &&
              userRequestedSourceNavigation(history)) {
            const target = pendingSourceTarget;
            const samePage = !target.pageUrl || target.pageUrl === location.href;
            const autoRevealed = samePage
              ? await autoRevealCurrentSource(target, results)
              : false;
            if (!autoRevealed) {
              const navMode = getPermissionMode(settings, "navigate");
              // navigate=allow ("Just do") → skip the Open / Not now card
              // for a cross-page hit and drive the navigation ourselves.
              // executeConfirmedSourceNavigation handles the same-page
              // anchor-scroll case too, which keeps behavior consistent
              // for users who want the widget to act without asking.
              if (navMode === "allow" &&
                  (!samePage || (samePage && target.anchor))) {
                results.push(
                  `[tool_result: __auto_navigate_source] ${JSON.stringify({
                    ok: true,
                    handledBy: "runtime",
                    reason: "navigate=allow",
                    target: {
                      pageUrl: target.pageUrl || location.href,
                      anchor: target.anchor || "",
                      heading: target.heading || "",
                    },
                  })}`
                );
                const toolTurn = results.join("\n");
                pushHistory("user", toolTurn);
                messages.push({ role: "user", content: toolTurn });
                setStatus(ui, "opening…", true, settings, "acting");
                // Same-page scroll resolves fast; cross-page sets
                // window.location.href and the pending runtime state is
                // persisted before the page tears down. Either way, we're
                // done with this tool loop.
                try { await executeConfirmedSourceNavigation(target); }
                catch (e) {
                  addLogMessage(ui, "error", "Could not open that: " + (e && e.message || e));
                }
                return;
              }
              if (shouldOfferSourceNavigation(target)) {
                offerSourceNavigation(target);
                // Seal the tool-result stream with an explicit synthetic
                // turn so if the model is replayed later it sees that the
                // runtime already handled the offer. This keeps a future
                // model turn from re-proposing the same navigation.
                results.push(
                  `[tool_result: __offer_source_nav] ${JSON.stringify({
                    ok: true,
                    handledBy: "runtime",
                    target: {
                      pageUrl: target.pageUrl || location.href,
                      anchor: target.anchor || "",
                      heading: target.heading || "",
                    },
                  })}`
                );
                const toolTurn = results.join("\n");
                pushHistory("user", toolTurn);
                messages.push({ role: "user", content: toolTurn });
                setStatus(ui, "awaiting your choice", false, settings, "permission");
                return;
              }
            }
          }

          if (call.tool === "done") return;
        }

        // Feed tool results back as one user turn and loop again
        const toolTurn = results.join("\n");
        pushHistory("user", toolTurn);
        messages.push({ role: "user", content: toolTurn });
      }

      addLogMessage(ui, "system", `Stopped after ${settings.maxToolLoops} tool loops.`);
    }

    if (resumeNavigation) {
      // Source-reveal navigations arrived because the user explicitly agreed
      // to a card. They want to see the target — they do not want another
      // round of the model thinking about it. Everything else (model-driven
      // link clicks, form submits that redirected) still goes through the
      // full conversation-resume path so the model can continue the task.
      if (resumeNavigation.sourceReveal) {
        setTimeout(() => { landOnConfirmedSource(resumeNavigation); }, 60);
      } else {
        setTimeout(() => { resumeNavigationTask(resumeNavigation); }, 60);
      }
    }

    // Expose public API
    const publicApi = {
      mount: () => publicApi,
      open: () => toggleBubble(true),
      close: () => toggleBubble(false),
      say: (t) => addLogMessage(ui, "assistant", t),
      send: api.send,
      setSettings: api.setSettings,
      getSettings: api.getSettings,
      registerCharacterPack,
      getCharacters: () => listCharacterDefinitions().map(({ id, label, title }) => ({ id, label, title })),
      getAvatars: () => listAvatarDefinitions().map(({ id, label, title }) => ({ id, label, title })),
      // Expose tools for manual testing from devtools
      _tools: TOOLS,
      _parseToolCalls: parseToolCalls,
      _characters: CHARACTERS,
      _avatars: AVATARS,
    };
    window.Clippy = publicApi;
    return publicApi;
  }

  // Stub global so the page can call Clippy.mount() before this script fully initialises
  const bootstrap = {
    mount,
    registerCharacterPack,
    getCharacters: () => listCharacterDefinitions().map(({ id, label, title }) => ({ id, label, title })),
    getAvatars: () => listAvatarDefinitions().map(({ id, label, title }) => ({ id, label, title })),
    _tools: TOOLS,
    _parseToolCalls: parseToolCalls,
    _characters: CHARACTERS,
    _avatars: AVATARS,
  };
  if (!window.Clippy) window.Clippy = bootstrap;
  // Auto-mount if a <meta name="clippy-automount" content="1"> is present
  document.addEventListener("DOMContentLoaded", () => {
    const auto = document.querySelector('meta[name="clippy-automount"]');
    if (auto && auto.content === "1") mount();
  });
})();
