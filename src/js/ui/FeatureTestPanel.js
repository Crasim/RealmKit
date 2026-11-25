var RealmKit = RealmKit || {};

/**
 * FeatureTestPanel — Full-height RPG-style developer grimoire.
 * Toggle with F3.  Positioned on the left side.
 *
 * Sections (scrollable):
 *   Performance ─ FPS, frame time, runtime
 *   Attack Anim ─ live phase readout + per-direction trigger buttons
 *   Screen Shake ─ preset + custom controls
 *   Day / Night  ─ time scrubber, speed, quick-set presets
 *   Audio        ─ trigger all sounds, ambient, volume, mute
 *   Hit Flash    ─ player & nearest-NPC flash triggers
 *   Combat       ─ nearest-NPC snapshot (HP, AI state, weapon phase)
 *   Event Log    ─ real-time game events (call logEvent from engine)
 *   Combat Log   ─ mirrored from HUDSystem
 */
RealmKit.FeatureTestPanel = function FeatureTestPanel(engine) {
    this.engine      = engine;
    this.visible     = false;
    this.el          = null;
    this._e          = {};
    this._dragging   = false;
    this._dragOffX   = 0;
    this._dragOffY   = 0;

    this._eventLog   = [];          // { ts, msg, type }
    this._maxEvents  = 60;
    this._lastCombatLogLen = 0;

    this._build();
    this._bindKeys();
    this._bindDrag();
    this._bindControls();
};

// ─── Stylesheet ──────────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._injectStyles = function() {
    // Inject styles only once
    if (document.getElementById('rk-ftp-styles')) return;
    
    var css = [
        /* ── Panel shell ── */
        '#rk-ftp{',
        '  position:fixed;top:0;left:0;width:272px;height:100vh;',
        '  background:repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
        '  border:3px solid #1a0800;',
        '  color:#c8b890;font:7px/1.6 "Press Start 2P",monospace;',
        '  z-index:9999;display:none;flex-direction:column;',
        '  box-shadow:inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);',
        '  user-select:none;',
        '}',

        /* ── Custom scrollbar ── */
        '#rk-ftp-body{',
        '  flex:1;overflow-y:auto;overflow-x:hidden;',
        '  scrollbar-width:thin;scrollbar-color:#5a3818 #1a0c04;',
        '}',
        '#rk-ftp-body::-webkit-scrollbar{width:8px;}',
        '#rk-ftp-body::-webkit-scrollbar-track{background:#1a0c04;}',
        '#rk-ftp-body::-webkit-scrollbar-thumb{background:#5a3818;border:1px solid #3a2818;border-radius:2px;}',
        '#rk-ftp-body::-webkit-scrollbar-thumb:hover{background:#7a4e1e;}',

        /* ── Header ── */
        '#rk-ftp-hdr{',
        '  padding:10px 10px 8px;cursor:move;flex-shrink:0;',
        '  background:linear-gradient(180deg,#3d3326 0%,#2a2218 50%,#17110c 100%);',
        '  border-bottom:2px solid #1a1828;position:relative;',
        '  text-align:center;',
        '}',
        '#rk-ftp-hdr-title{',
        '  color:#c8a84b;font-size:13px;font-weight:bold;letter-spacing:2px;',
        '  text-shadow:0 0 8px rgba(200,168,75,0.5);',
        '}',
        '#rk-ftp-hdr-sub{',
        '  color:#8a7060;font-size:9px;letter-spacing:1px;margin-top:1px;',
        '}',
        '#rk-ftp-hdr-corner-tl,#rk-ftp-hdr-corner-tr{',
        '  position:absolute;top:8px;color:#8a7060;font-size:10px;',
        '}',
        '#rk-ftp-hdr-corner-tl{left:8px;}',
        '#rk-ftp-hdr-corner-tr{right:8px;}',

        /* ── Perf strip ── */
        '#rk-ftp-perf{',
        '  display:flex;gap:0;flex-shrink:0;background:#1a0c04;',
        '  border-bottom:1px solid #3a2818;',
        '}',
        '.ftp-perf-cell{',
        '  flex:1;padding:3px 6px;text-align:center;border-right:1px solid #2a1408;',
        '}',
        '.ftp-perf-cell:last-child{border-right:none;}',
        '.ftp-perf-label{color:#4a3018;font-size:8px;letter-spacing:1px;text-transform:uppercase;}',
        '.ftp-perf-val{color:#c8a84b;font-size:10px;font-weight:bold;}',

        /* ── Sections ── */
        '.ftp-sec{',
        '  border-bottom:1px solid #2a1a08;padding:7px 8px;',
        '}',
        '.ftp-sec-hdr{',
        '  display:flex;align-items:center;gap:0;margin-bottom:5px;',
        '}',
        '.ftp-sec-hdr::before,.ftp-sec-hdr::after{',
        '  content:"";flex:1;height:1px;',
        '  background:linear-gradient(90deg,transparent,#5a3818);',
        '}',
        '.ftp-sec-hdr::after{',
        '  background:linear-gradient(90deg,#5a3818,transparent);',
        '}',
        '.ftp-sec-title{',
        '  color:#c8a84b;font-size:9px;font-weight:bold;letter-spacing:1.5px;',
        '  text-transform:uppercase;padding:0 6px;white-space:nowrap;',
        '  text-shadow:0 0 6px rgba(200,168,75,0.3);',
        '}',

        /* ── Rows ── */
        '.ftp-row{',
        '  display:flex;justify-content:space-between;line-height:1.7;',
        '}',
        '.ftp-lbl{color:#6b5030;font-size:7px;}',
        '.ftp-val{color:#c8b890;font-size:7px;font-weight:bold;}',
        '.ftp-val-hi{color:#c8a84b;}',
        '.ftp-val-ok{color:#c8a84b;}',
        '.ftp-val-warn{color:#e09020;}',
        '.ftp-val-bad{color:#cc4444;}',
        '.ftp-val-dim{color:#4a3018;}',

        /* ── Phase bar ── */
        '.ftp-phase-wrap{',
        '  display:flex;gap:2px;margin:4px 0;height:8px;',
        '}',
        '.ftp-phase-seg{',
        '  flex:1;background:#1a0c04;border:1px solid #3a2818;border-radius:1px;',
        '  position:relative;overflow:hidden;',
        '}',
        '.ftp-phase-seg-fill{',
        '  position:absolute;top:0;left:0;height:100%;width:0%;',
        '  transition:width .04s;',
        '}',
        '.ftp-phase-seg-label{',
        '  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);',
        '  font-size:7px;color:rgba(255,255,255,0.4);white-space:nowrap;',
        '}',

        /* ── Buttons ── */
        '.ftp-btn-row{display:flex;gap:3px;margin:3px 0;}',
        '.ftp-btn{',
        '  flex:1;padding:5px 2px;cursor:pointer;text-align:center;',
        '  font:bold 7px "Press Start 2P";letter-spacing:.5px;',
        '  background:linear-gradient(180deg,#4a4a58 0%,#3a3a48 50%,#2a2a38 100%);border:1px solid #1a0800;color:#e8d8c8;',
        '  transition:all .1s;',
        '}',
        '.ftp-btn:hover{background:linear-gradient(180deg,#5a5a68 0%,#4a4a58 50%,#3a3a38 100%);border-color:#87663b;color:#c8a84b;',
        '  box-shadow:0 0 6px rgba(200,168,75,0.2);}',
        '.ftp-btn:active{background:#2e1e0e;}',
        '.ftp-btn-amber{border-color:#87663b;color:#c8a84b;}',
        '.ftp-btn-amber:hover{border-color:#c8a84b;color:#e8c86b;box-shadow:0 0 8px rgba(200,168,75,0.4);}',
        '.ftp-btn-green{border-color:#5a3818;color:#c8a84b;}',
        '.ftp-btn-green:hover{border-color:#c8a84b;box-shadow:0 0 6px rgba(200,168,75,0.3);}',
        '.ftp-btn-red{border-color:#5a2020;color:#c86060;}',
        '.ftp-btn-red:hover{border-color:#c86060;box-shadow:0 0 6px rgba(200,96,96,0.3);}',
        '.ftp-btn-blue{border-color:#3a3838;color:#a8a8c8;}',
        '.ftp-btn-blue:hover{border-color:#a8a8c8;box-shadow:0 0 6px rgba(168,168,200,0.3);}',

        /* ── Sliders ── */
        '.ftp-slider-row{',
        '  display:flex;align-items:center;gap:5px;margin:3px 0;',
        '}',
        '.ftp-slider-row label{',
        '  width:86px;color:#6b5030;font-size:10px;flex-shrink:0;',
        '}',
        '.ftp-slider-row input[type=range]{',
        '  flex:1;accent-color:#c8a84b;height:14px;',
        '  background:transparent;cursor:pointer;',
        '}',
        '.ftp-slider-row span{',
        '  width:36px;text-align:right;color:#e0ccaa;font-size:10px;',
        '}',

        /* ── Logs ── */
        '#rk-ftp-evlog,#rk-ftp-combatlog{',
        '  font-size:9px;line-height:1.6;',
        '  max-height:120px;overflow-y:auto;',
        '  background:#080604;padding:4px 4px;',
        '  scrollbar-width:thin;scrollbar-color:#3a2008 #080604;',
        '}',
        '#rk-ftp-evlog::-webkit-scrollbar,#rk-ftp-combatlog::-webkit-scrollbar{width:4px;}',
        '#rk-ftp-evlog::-webkit-scrollbar-thumb,#rk-ftp-combatlog::-webkit-scrollbar-thumb',
        '{background:#3a2008;}',
        '.ftp-log-entry{',
        '  padding:1px 0;border-bottom:1px solid #150e06;display:flex;gap:4px;',
        '}',
        '.ftp-log-ts{color:#3a2a14;flex-shrink:0;width:38px;}',
        '.ftp-log-msg{color:#a08060;flex:1;}',
        '.ftp-log-combat{color:#cc7744;}',
        '.ftp-log-kill{color:#cc4444;font-weight:bold;}',
        '.ftp-log-system{color:#c8a84b;}',
        '.ftp-log-warning{color:#c88040;}',
        '.ftp-log-info{color:#a8a8b8;}',

        /* ── Hint badge ── */
        '#rk-ftp-hint{',
        '  position:fixed;bottom:8px;left:8px;',
        '  background:repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);',
        '  border:3px solid #1a0800;color:#c8b890;',
        '  font:bold 7px "Press Start 2P";padding:4px 8px;',
        '  z-index:9998;pointer-events:none;letter-spacing:1px;',
        '  box-shadow:inset 0 2px 0 rgba(255,200,150,.15),inset 0 -4px 0 rgba(0,0,0,.45),0 10px 18px rgba(0,0,0,.35);',
        '}',
    ].join('\n');

    var el = document.createElement('style');
    el.id = 'rk-ftp-styles';
    el.textContent = css;
    document.head.appendChild(el);
};

// ─── Build DOM ───────────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._build = function() {
    this._injectStyles();

    var p = document.createElement('div');
    p.id = 'rk-ftp';

    /* ── Header ── */
    var hdr = [
        '<div id="rk-ftp-hdr">',
        '  <span id="rk-ftp-hdr-corner-tl">⚔</span>',
        '  <div id="rk-ftp-hdr-title">DEVELOPER GRIMOIRE</div>',
        '  <div id="rk-ftp-hdr-sub">F3 · TEST HARNESS · v1.1</div>',
        '  <span id="rk-ftp-hdr-corner-tr">⚔</span>',
        '</div>',
    ].join('');

    /* ── Perf strip ── */
    var perf = [
        '<div id="rk-ftp-perf">',
        '  <div class="ftp-perf-cell">',
        '    <div class="ftp-perf-label">FPS</div>',
        '    <div class="ftp-perf-val" id="ftp-p-fps">--</div>',
        '  </div>',
        '  <div class="ftp-perf-cell">',
        '    <div class="ftp-perf-label">Frame</div>',
        '    <div class="ftp-perf-val" id="ftp-p-frame">--</div>',
        '  </div>',
        '  <div class="ftp-perf-cell">',
        '    <div class="ftp-perf-label">Runtime</div>',
        '    <div class="ftp-perf-val" id="ftp-p-runtime">--</div>',
        '  </div>',
        '  <div class="ftp-perf-cell">',
        '    <div class="ftp-perf-label">Entities</div>',
        '    <div class="ftp-perf-val" id="ftp-p-ents">--</div>',
        '  </div>',
        '</div>',
    ].join('');

    /* ── Scrollable body ── */
    var body = '<div id="rk-ftp-body">';

    /* § Attack Animation */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">⚔ Attack Animation</span></div>',

        // 4-segment phase bar
        '  <div class="ftp-phase-wrap">',
        '    <div class="ftp-phase-seg" id="ftp-seg-windup">',
        '      <div class="ftp-phase-seg-fill" id="ftp-seg-windup-fill" style="background:#e0c44e"></div>',
        '      <div class="ftp-phase-seg-label">WIND</div>',
        '    </div>',
        '    <div class="ftp-phase-seg" id="ftp-seg-strike">',
        '      <div class="ftp-phase-seg-fill" id="ftp-seg-strike-fill" style="background:#e07c4e"></div>',
        '      <div class="ftp-phase-seg-label">STRIKE</div>',
        '    </div>',
        '    <div class="ftp-phase-seg" id="ftp-seg-impact">',
        '      <div class="ftp-phase-seg-fill" id="ftp-seg-impact-fill" style="background:#e04e4e"></div>',
        '      <div class="ftp-phase-seg-label">IMP</div>',
        '    </div>',
        '    <div class="ftp-phase-seg" id="ftp-seg-followthrough">',
        '      <div class="ftp-phase-seg-fill" id="ftp-seg-followthrough-fill" style="background:#4e8ce0"></div>',
        '      <div class="ftp-phase-seg-label">FOLLOW</div>',
        '    </div>',
        '  </div>',

        '  <div class="ftp-row"><span class="ftp-lbl">State Machine</span><b class="ftp-val" id="ftp-sm-state">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Phase / t</span><b class="ftp-val" id="ftp-wpn-phase">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Body lunge</span><b class="ftp-val" id="ftp-lunge">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Atk cooldown</span><b class="ftp-val" id="ftp-atk-cd">--</b></div>',

        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-atk-down">↓ DOWN</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-atk-up">↑ UP</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-atk-left">← LEFT</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-atk-right">→ RIGHT</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Screen Shake */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">💥 Screen Shake</span></div>',
        '  <div class="ftp-row">',
        '    <span class="ftp-lbl">Remaining</span><b class="ftp-val" id="ftp-shake-rem">--</b>',
        '  </div>',
        '  <div class="ftp-row">',
        '    <span class="ftp-lbl">Intensity · offset</span>',
        '    <b class="ftp-val" id="ftp-shake-live">--</b>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-shake-normal">HIT</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-shake-crit">CRIT</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-shake-epic">EPIC</button>',
        '  </div>',
        '  <div class="ftp-slider-row">',
        '    <label>Intensity</label>',
        '    <input type="range" id="ftp-shake-ci" min="1" max="30" value="8">',
        '    <span id="ftp-shake-ci-v">8</span>',
        '  </div>',
        '  <div class="ftp-slider-row">',
        '    <label>Duration (ms)</label>',
        '    <input type="range" id="ftp-shake-cd" min="50" max="1000" value="300" step="50">',
        '    <span id="ftp-shake-cd-v">300</span>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-shake-custom">⚡ TRIGGER CUSTOM SHAKE</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Day / Night */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🌙 Day / Night Cycle</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Game Time</span><b class="ftp-val ftp-val-hi" id="ftp-dn-time">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Phase</span><b class="ftp-val" id="ftp-dn-phase">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Ambient α</span><b class="ftp-val" id="ftp-dn-alpha">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Light sources</span><b class="ftp-val" id="ftp-dn-lights">--</b></div>',
        '  <div class="ftp-slider-row">',
        '    <label>Time of day</label>',
        '    <input type="range" id="ftp-dn-tod" min="0" max="86399" value="28800" step="60">',
        '    <span id="ftp-dn-tod-v">08:00</span>',
        '  </div>',
        '  <div class="ftp-slider-row">',
        '    <label>Speed ×</label>',
        '    <input type="range" id="ftp-dn-speed" min="1" max="3600" value="120" step="1">',
        '    <span id="ftp-dn-speed-v">120</span>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-dn-dawn">🌄 DAWN</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-dn-noon">☀ NOON</button>',
        '    <button class="ftp-btn" id="ftp-dn-dusk">🌇 DUSK</button>',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-dn-midnight">🌑 NIGHT</button>',
        '  </div>',
        '  <div class="ftp-sec-hdr" style="margin-top:6px"><span class="ftp-sec-title">💡 Spawn Light Source</span></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-ls-campfire">🔥 CAMPFIRE</button>',
        '    <button class="ftp-btn ftp-btn-blue"  id="ftp-ls-shroom">🍄 SHROOM</button>',
        '    <button class="ftp-btn"               id="ftp-ls-moonwell">🌀 MOONWELL</button>',
        '    <button class="ftp-btn ftp-btn-red"   id="ftp-ls-clear">✖ CLEAR</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Audio */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🔊 Audio</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">AudioContext</span><b class="ftp-val" id="ftp-aud-ctx">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-aud-hit">HIT</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-aud-crit">CRIT HIT</button>',
        '    <button class="ftp-btn" id="ftp-aud-step">FOOTSTEP</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-aud-death">DEATH</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-aud-amb-on">▶ AMBIENT ON</button>',
        '    <button class="ftp-btn" id="ftp-aud-amb-off">■ STOP</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-aud-mute">🔇 MUTE</button>',
        '  </div>',
        '  <div class="ftp-slider-row">',
        '    <label>Master vol.</label>',
        '    <input type="range" id="ftp-aud-vol" min="0" max="100" value="80">',
        '    <span id="ftp-aud-vol-v">80%</span>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Hit Flash */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">✦ Hit Flash</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Player timer</span><b class="ftp-val" id="ftp-flash-player">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Nearest NPC</span><b class="ftp-val" id="ftp-flash-npc-name">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-flash-p-normal">FLASH PLAYER</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-flash-p-crit">CRIT PLAYER</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-flash-npc-normal">FLASH NPC</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-flash-npc-crit">CRIT NPC</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Combat Snapshot */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🗡 Nearest NPC</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Name</span><b class="ftp-val ftp-val-hi" id="ftp-cs-name">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">HP</span><b class="ftp-val" id="ftp-cs-hp">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Faction · Behav.</span><b class="ftp-val" id="ftp-cs-fb">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">AI state</span><b class="ftp-val" id="ftp-cs-aistate">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">SM state</span><b class="ftp-val" id="ftp-cs-smstate">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Weapon phase</span><b class="ftp-val" id="ftp-cs-wphase">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Distance</span><b class="ftp-val" id="ftp-cs-dist">--</b></div>',
        '</div>',
    ].join('');

    /* § Player Stats */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">👤 Player Stats</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">HP</span><b class="ftp-val" id="ftp-p-hp">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">MP</span><b class="ftp-val" id="ftp-p-mp">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Level</span><b class="ftp-val ftp-val-hi" id="ftp-p-lvl">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">XP</span><b class="ftp-val" id="ftp-p-xp">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Gold</span><b class="ftp-val ftp-val-hi" id="ftp-p-gold">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Inventory</span><b class="ftp-val" id="ftp-p-inv">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Status FX</span><b class="ftp-val" id="ftp-p-fx">--</b></div>',
        '</div>',
    ].join('');

    /* § Inventory Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🎒 Inventory Tests</span></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-inv-hp">+ HP POT</button>',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-inv-mp">+ MP POT</button>',
        '    <button class="ftp-btn" id="ftp-inv-food">+ FOOD</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-inv-gold100">+100 GOLD</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-inv-gold1000">+1000 GOLD</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-inv-clear">CLEAR INV</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Consumable Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🧪 Consumable Tests</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Potions in inv</span><b class="ftp-val" id="ftp-cons-count">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-use-hp">USE HP(1)</button>',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-use-mp">USE MP(2)</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-use-cure">USE CURE(3)</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-use-buff">USE STR(4)</button>',
        '  </div>',
        '  <div class="ftp-row" style="margin-top:4px"><span class="ftp-lbl">Harmful effects</span><b class="ftp-val" id="ftp-cons-harmful">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-add-poison">+ POISON</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-add-burn">+ BURN</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Threat / Aggro */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">⚠ Threat / Aggro</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Threat table</span><b class="ftp-val" id="ftp-threat-count">0 entries</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Highest target</span><b class="ftp-val" id="ftp-threat-top">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-threat-sim">SIM THREAT</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-threat-clear">CLEAR</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Combat Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">⚔ Combat Tests</span></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-dmg-player">DMG PLAYER -25</button>',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-heal-player">HEAL +50</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-dmg-npc">DMG NEAREST NPC</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-kill-npc">KILL NEAREST</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-spawn-loot">SPAWN LOOT</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § XP / Leveling Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">⭐ XP / Leveling</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Current XP</span><b class="ftp-val ftp-val-hi" id="ftp-xp-val">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Level</span><b class="ftp-val" id="ftp-xp-lvl">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">XP to next</span><b class="ftp-val" id="ftp-xp-next">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-xp-add50">+50 XP</button>',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-xp-add200">+200 XP</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-xp-cheat">CHEAT LVL UP</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Entity Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🧟 Entity Tests</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Entity count</span><b class="ftp-val" id="ftp-ent-count">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">NPC count</span><b class="ftp-val" id="ftp-npc-count">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-ent-spawn-npc">SPAWN NPC</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-ent-kill-all">KILL ALL NPC</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-ent-teleport">TELEPORT PLAYER</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Tile / World Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🗺 World Tests</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Player tile</span><b class="ftp-val" id="ftp-tile-pos">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Tile type</span><b class="ftp-val" id="ftp-tile-type">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Collision</span><b class="ftp-val" id="ftp-tile-col">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-tile-check">CHECK COLLISION</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § System Verification */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🔧 System Check</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">CombatSystem</span><b class="ftp-val" id="ftp-sys-combat">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">StatusEffects</span><b class="ftp-val" id="ftp-sys-status">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">ThreatManager</span><b class="ftp-val" id="ftp-sys-threat">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">ExperienceMgr</span><b class="ftp-val" id="ftp-sys-xp">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">InventoryMgr</span><b class="ftp-val" id="ftp-sys-inv">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Audio</span><b class="ftp-val" id="ftp-sys-audio">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-sys-check">RUN SYSTEM CHECK</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Particle Effects */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">✨ Particle Effects</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Active</span><b class="ftp-val" id="ftp-part-count">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-part-blood">BLOOD SPLASH</button>',
        '    <button class="ftp-btn" id="ftp-part-sparkle">SPARKLE</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-part-smoke">SMOKE</button>',
        '    <button class="ftp-btn" id="ftp-part-impact">IMPACT SPARKS</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-part-death">DEATH EFFECT</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-part-clear">CLEAR ALL</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Projectiles */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🎯 Projectiles</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Active</span><b class="ftp-val" id="ftp-proj-count">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-proj-arrow">ARROW</button>',
        '    <button class="ftp-btn" id="ftp-proj-bolt">BOLT</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-proj-magic">MAGIC</button>',
        '    <button class="ftp-btn" id="ftp-proj-fireball">FIREBALL</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-proj-miss">MISS</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-proj-clear">CLEAR ALL</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Systems Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🔧 Systems</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Fade</span><b class="ftp-val" id="ftp-sys-fade">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Weather</span><b class="ftp-val" id="ftp-sys-weather">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Quadtree</span><b class="ftp-val" id="ftp-sys-quad">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Pathfinding</span><b class="ftp-val" id="ftp-sys-path">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">SaveMgr</span><b class="ftp-val" id="ftp-sys-save">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Dialogue</span><b class="ftp-val" id="ftp-sys-dialog">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Achieve</span><b class="ftp-val" id="ftp-sys-achieve">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Quest</span><b class="ftp-val" id="ftp-sys-quest">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Spawner</span><b class="ftp-val" id="ftp-sys-spawner">--</b></div>',
        '</div>',
    ].join('');

    /* § Fade Transition Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🎬 Fade Transition</span></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-fade-out">FADE OUT</button>',
        '    <button class="ftp-btn" id="ftp-fade-in">FADE IN</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-fade-trans">TRANSITION</button>',
        '    <button class="ftp-btn" id="ftp-fade-force">FORCE COMPLETE</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Weather Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🌧️ Weather</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Type</span><b class="ftp-val" id="ftp-w-type">clear</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Particles</span><b class="ftp-val" id="ftp-w-count">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-w-clear">CLEAR</button>',
        '    <button class="ftp-btn" id="ftp-w-rain">RAIN</button>',
        '    <button class="ftp-btn" id="ftp-w-snow">SNOW</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-w-storm">STORM</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Save/Load Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">💾 Save/Load</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Slot 0</span><b class="ftp-val" id="ftp-save-slot0">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-save-save">SAVE</button>',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-save-load">LOAD</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-save-info">INFO</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-save-delete">DELETE</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Quest Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">📜 Quests</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Active</span><b class="ftp-val" id="ftp-q-active">0</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Completed</span><b class="ftp-val" id="ftp-q-done">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-q-start">START QUEST</button>',
        '    <button class="ftp-btn" id="ftp-q-test">TEST KILL OBJ</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Achievement Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🏆 Achievements</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Unlocked</span><b class="ftp-val" id="ftp-ach-count">0</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Level</span><b class="ftp-val" id="ftp-ach-level">1</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Total XP</span><b class="ftp-val" id="ftp-ach-xp">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-ach-kill">+1 KILL</button>',
        '    <button class="ftp-btn" id="ftp-ach-gold">+100 GOLD</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-ach-level">SET LVL 5</button>',
        '    <button class="ftp-btn" id="ftp-ach-list">LIST ALL</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-ach-xp-add">+500 XP</button>',
        '    <button class="ftp-btn" id="ftp-ach-xp-big">+5000 XP</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Story Builder */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">📖 Story Builder</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Current Story</span><b class="ftp-val" id="ftp-sb-story">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Factions</span><b class="ftp-val" id="ftp-sb-factions">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Characters</span><b class="ftp-val" id="ftp-sb-chars">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Dialogues</span><b class="ftp-val" id="ftp-sb-dialogues">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Quests</span><b class="ftp-val" id="ftp-sb-quests">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Scenes</span><b class="ftp-val" id="ftp-sb-scenes">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-sb-open">📖 OPEN BUILDER (F4)</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-sb-offline">+ OFFLINE STORY</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § API Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🔌 API Tests</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">API Status</span><b class="ftp-val" id="ftp-api-status">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-api-ping">PING API</button>',
        '    <button class="ftp-btn" id="ftp-api-list">LIST STORIES</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-api-create">+ CREATE TEST</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-api-clear">CLEAR</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Spawner Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">👹 Monster Spawners</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Spawners</span><b class="ftp-val" id="ftp-spawn-count">0</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Active</span><b class="ftp-val" id="ftp-spawn-active">0</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Killed</span><b class="ftp-val" id="ftp-spawn-killed">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-spawn-goblin">SPAWN GOBLIN</button>',
        '    <button class="ftp-btn" id="ftp-spawn-skeleton">SPAWN SKELETON</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-spawn-wolf">SPAWN WOLF</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-spawn-orc">SPAWN ORC</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-spawn-area">SPAWN AREA (5)</button>',
        '    <button class="ftp-btn" id="ftp-spawn-clear">CLEAR ALL</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-spawn-boss">SPAWN BOSS</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Night Spawners (Time-Conditioned) */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">🌙 Night Spawners</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Current Time</span><b class="ftp-val" id="ftp-night-time">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Phase</span><b class="ftp-val" id="ftp-night-phase">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Night OK</span><b class="ftp-val" id="ftp-night-ok">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-night-spawn">SPAWN NIGHT ONLY</button>',
        '    <button class="ftp-btn" id="ftp-night-skeleton">NIGHT SKELETON</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-night-dungeon">DUNGEON SPAWNER</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-night-boss">NIGHT BOSS</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-night-time-set">SET MIDNIGHT</button>',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-night-time-noon">SET NOON</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § NPC Schedule Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">📅 NPC Schedules</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Nearest NPC</span><b class="ftp-val" id="ftp-sched-npc">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Preset</span><b class="ftp-val" id="ftp-sched-type">--</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Current Action</span><b class="ftp-val" id="ftp-sched-action">--</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-sched-merchant">MERCHANT</button>',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-sched-guard">GUARD</button>',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-sched-villager">VILLAGER</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-amber" id="ftp-sched-nightguard">NIGHT GUARD</button>',
        '    <button class="ftp-btn" id="ftp-sched-innkeeper">INNKEEPER</button>',
        '    <button class="ftp-btn" id="ftp-sched-blacksmith">BLACKSMITH</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-sched-wizard">WIZARD</button>',
        '    <button class="ftp-btn" id="ftp-sched-farmer">FARMER</button>',
        '    <button class="ftp-btn ftp-btn-blue" id="ftp-sched-traveler">TRAVELER</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-sched-clear">CLEAR OVERRIDE</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Trigger System Tests */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">⚡ Trigger System</span></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">Triggers</span><b class="ftp-val" id="ftp-trig-count">0</b></div>',
        '  <div class="ftp-row"><span class="ftp-lbl">In Zone</span><b class="ftp-val" id="ftp-trig-inzone">0</b></div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn" id="ftp-trig-enter">ENTER ZONE</button>',
        '    <button class="ftp-btn" id="ftp-trig-exit">EXIT ZONE</button>',
        '  </div>',
        '  <div class="ftp-btn-row">',
        '    <button class="ftp-btn ftp-btn-green" id="ftp-trig-create">CREATE TRIGGER</button>',
        '    <button class="ftp-btn ftp-btn-red" id="ftp-trig-clear">CLEAR ALL</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Event Log */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">📜 Event Log</span></div>',
        '  <div id="rk-ftp-evlog"></div>',
        '  <div class="ftp-btn-row" style="margin-top:4px">',
        '    <button class="ftp-btn" id="ftp-evlog-clear">✕ CLEAR LOG</button>',
        '  </div>',
        '</div>',
    ].join('');

    /* § Combat Log */
    body += [
        '<div class="ftp-sec">',
        '  <div class="ftp-sec-hdr"><span class="ftp-sec-title">⚔ Combat Log</span></div>',
        '  <div id="rk-ftp-combatlog"></div>',
        '</div>',
    ].join('');

    body += '</div>'; /* end #rk-ftp-body */

    p.innerHTML = hdr + perf + body;
    document.body.appendChild(p);
    this.el = p;

    /* cache refs */
    var ids = [
        'ftp-p-fps','ftp-p-frame','ftp-p-runtime','ftp-p-ents',
        'ftp-sm-state','ftp-wpn-phase','ftp-lunge','ftp-atk-cd',
        'ftp-seg-windup-fill','ftp-seg-strike-fill','ftp-seg-impact-fill','ftp-seg-followthrough-fill',
        'ftp-atk-down','ftp-atk-up','ftp-atk-left','ftp-atk-right',
        'ftp-shake-rem','ftp-shake-live',
        'ftp-shake-normal','ftp-shake-crit','ftp-shake-epic',
        'ftp-shake-ci','ftp-shake-ci-v','ftp-shake-cd','ftp-shake-cd-v','ftp-shake-custom',
        'ftp-dn-time','ftp-dn-phase','ftp-dn-alpha','ftp-dn-lights',
        'ftp-dn-tod','ftp-dn-tod-v','ftp-dn-speed','ftp-dn-speed-v',
        'ftp-dn-dawn','ftp-dn-noon','ftp-dn-dusk','ftp-dn-midnight',
        'ftp-dn-pause','ftp-night-spawn','ftp-time-zone',
        'ftp-ls-campfire','ftp-ls-shroom','ftp-ls-moonwell','ftp-ls-clear',
        'ftp-aud-ctx',
        'ftp-aud-hit','ftp-aud-crit','ftp-aud-step','ftp-aud-death',
        'ftp-aud-amb-on','ftp-aud-amb-off','ftp-aud-mute',
        'ftp-aud-vol','ftp-aud-vol-v',
        'ftp-flash-player','ftp-flash-npc-name',
        'ftp-flash-p-normal','ftp-flash-p-crit',
        'ftp-flash-npc-normal','ftp-flash-npc-crit',
        'ftp-cs-name','ftp-cs-hp','ftp-cs-fb',
        'ftp-cs-aistate','ftp-cs-smstate','ftp-cs-wphase','ftp-cs-dist',
        'ftp-p-hp','ftp-p-mp','ftp-p-lvl','ftp-p-xp','ftp-p-gold','ftp-p-inv','ftp-p-fx',
        'ftp-inv-hp','ftp-inv-mp','ftp-inv-food','ftp-inv-gold100','ftp-inv-gold1000','ftp-inv-clear',
        'ftp-cons-count','ftp-use-hp','ftp-use-mp','ftp-use-cure','ftp-use-buff',
        'ftp-cons-harmful','ftp-add-poison','ftp-add-burn',
        'ftp-threat-count','ftp-threat-top','ftp-threat-sim','ftp-threat-clear',
        'ftp-dmg-player','ftp-heal-player','ftp-dmg-npc','ftp-kill-npc','ftp-spawn-loot',
        'ftp-xp-val','ftp-xp-lvl','ftp-xp-next','ftp-xp-add50','ftp-xp-add200','ftp-xp-cheat',
        'ftp-ent-count','ftp-npc-count','ftp-ent-spawn-npc','ftp-ent-kill-all','ftp-ent-teleport',
        'ftp-part-count','ftp-part-blood','ftp-part-sparkle','ftp-part-smoke','ftp-part-impact','ftp-part-death','ftp-part-clear',
        'ftp-proj-count','ftp-proj-arrow','ftp-proj-bolt','ftp-proj-magic','ftp-proj-fireball','ftp-proj-miss','ftp-proj-clear',
        'ftp-sys-fade','ftp-sys-weather','ftp-sys-quad','ftp-sys-path','ftp-sys-save','ftp-sys-dialog','ftp-sys-achieve','ftp-sys-quest','ftp-sys-spawner',
        'ftp-fade-out','ftp-fade-in','ftp-fade-trans','ftp-fade-force',
        'ftp-w-clear','ftp-w-rain','ftp-w-snow','ftp-w-storm','ftp-w-type','ftp-w-count',
        'ftp-save-slot0','ftp-save-save','ftp-save-load','ftp-save-info','ftp-save-delete',
        'ftp-q-active','ftp-q-done','ftp-q-start','ftp-q-test',
        'ftp-ach-count','ftp-ach-level','ftp-ach-xp','ftp-ach-kill','ftp-ach-gold','ftp-ach-level','ftp-ach-list','ftp-ach-xp-add','ftp-ach-xp-big',
        'ftp-tile-pos','ftp-tile-type','ftp-tile-col','ftp-tile-check',
        'ftp-sys-combat','ftp-sys-status','ftp-sys-threat','ftp-sys-xp','ftp-sys-inv','ftp-sys-audio','ftp-sys-check',
        'ftp-sb-story','ftp-sb-factions','ftp-sb-chars','ftp-sb-dialogues','ftp-sb-quests','ftp-sb-scenes',
        'ftp-sb-open','ftp-sb-offline',
        'ftp-api-status','ftp-api-ping','ftp-api-list','ftp-api-create','ftp-api-clear',
        'ftp-spawn-count','ftp-spawn-active','ftp-spawn-killed',
        'ftp-spawn-goblin','ftp-spawn-skeleton','ftp-spawn-wolf','ftp-spawn-orc',
        'ftp-spawn-area','ftp-spawn-clear','ftp-spawn-boss',
        'ftp-night-time','ftp-night-phase','ftp-night-ok',
        'ftp-night-spawn','ftp-night-skeleton','ftp-night-dungeon','ftp-night-boss',
        'ftp-night-time-set','ftp-night-time-noon',
        'ftp-sched-npc','ftp-sched-type','ftp-sched-action',
        'ftp-sched-merchant','ftp-sched-guard','ftp-sched-villager','ftp-sched-nightguard',
        'ftp-sched-innkeeper','ftp-sched-blacksmith','ftp-sched-wizard','ftp-sched-farmer','ftp-sched-traveler',
        'ftp-sched-clear',
        'ftp-trig-count','ftp-trig-inzone','ftp-trig-enter','ftp-trig-exit',
        'ftp-trig-create','ftp-trig-clear',
        'rk-ftp-evlog','rk-ftp-combatlog','ftp-evlog-clear'
    ];
    for (var i = 0; i < ids.length; i++) {
        this._e[ids[i]] = document.getElementById(ids[i]);
    }
};

// ─── Wire controls ───────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._bindControls = function() {
    var self = this;
    var eng  = this.engine;
    var e    = this._e;

    /* Attack direction buttons */
    ['down','up','left','right'].forEach(function(dir) {
        e['ftp-atk-' + dir].addEventListener('click', function() {
            if (!eng.player) return;
            eng.player.setDirection(dir);
            if (eng.player.weapon) { eng.player.weapon.startAttack(dir); }
            if (eng.player.stateMachine) { eng.player.stateMachine.startAttackState(dir); }
            self.logEvent('Attack triggered: ' + dir.toUpperCase(), 'combat');
        });
    });

    /* Shake presets */
    e['ftp-shake-normal'].addEventListener('click', function() {
        eng.triggerShake(3, 130);
        self.logEvent('Shake: HIT (i=3, d=130ms)', 'system');
    });
    e['ftp-shake-crit'].addEventListener('click', function() {
        eng.triggerShake(6, 220);
        self.logEvent('Shake: CRIT (i=6, d=220ms)', 'warning');
    });
    e['ftp-shake-epic'].addEventListener('click', function() {
        eng.triggerShake(14, 600);
        self.logEvent('Shake: EPIC (i=14, d=600ms)', 'warning');
    });
    e['ftp-shake-ci'].addEventListener('input', function() {
        e['ftp-shake-ci-v'].textContent = e['ftp-shake-ci'].value;
    });
    e['ftp-shake-cd'].addEventListener('input', function() {
        e['ftp-shake-cd-v'].textContent = e['ftp-shake-cd'].value;
    });
    e['ftp-shake-custom'].addEventListener('click', function() {
        var i = Number(e['ftp-shake-ci'].value);
        var d = Number(e['ftp-shake-cd'].value);
        eng.triggerShake(i, d);
        self.logEvent('Shake: custom i=' + i + ' d=' + d + 'ms', 'system');
    });

    /* Day/Night scrubber */
    e['ftp-dn-tod'].addEventListener('input', function() {
        var secs = Number(e['ftp-dn-tod'].value);
        if (eng.dayNight) { eng.dayNight.time = secs; }
        e['ftp-dn-tod-v'].textContent = self._fmtTime(secs);
    });
    e['ftp-dn-speed'].addEventListener('input', function() {
        var spd = Number(e['ftp-dn-speed'].value);
        if (eng.dayNight) { eng.dayNight.speed = spd; }
        e['ftp-dn-speed-v'].textContent = spd;
    });
    var timePresets = { dawn: 21600, noon: 43200, dusk: 64800, midnight: 0 };
    ['dawn','noon','dusk','midnight'].forEach(function(name) {
        e['ftp-dn-' + name].addEventListener('click', function() {
            if (eng.dayNight) {
                eng.dayNight.time = timePresets[name];
                self.logEvent('Time set: ' + name.toUpperCase() + ' (' + self._fmtTime(timePresets[name]) + ')', 'info');
            }
        });
    });

    /* Colored light-source spawner */
    var _lsCounter = 0;
    var _lightDefs = {
        campfire: { color: '#ff7020', radius: 140, intensity: 1.0, label: '🔥 CAMPFIRE' },
        shroom:   { color: '#40e0ff', radius:  90, intensity: 0.85, label: '🍄 SHROOM'  },
        moonwell: { color: '#c080ff', radius: 120, intensity: 0.9,  label: '🌀 MOONWELL' }
    };
    ['campfire','shroom','moonwell'].forEach(function(key) {
        e['ftp-ls-' + key].addEventListener('click', function() {
            if (!eng.registerLight || !eng.player) return;
            var def = _lightDefs[key];
            var id  = key + '_' + (++_lsCounter);
            // Place it offset from the player so you can see it separately
            var ox  = (Math.random() - 0.5) * 80;
            var oy  = (Math.random() - 0.5) * 80;
            eng.registerLight(id, eng.player.x + ox, eng.player.y + oy,
                              def.radius, def.color, def.intensity);
            self.logEvent('Light spawned: ' + def.label + ' id=' + id, 'info');
        });
    });
    e['ftp-ls-clear'].addEventListener('click', function() {
        if (!eng.lightSources) return;
        // Keep the player torch; remove all manually-spawned extras
        eng.lightSources = eng.lightSources.filter(function(l) {
            return l.id === 'player' || l.id.indexOf('settlement_') === 0;
        });
        self.logEvent('Extra lights cleared', 'system');
    });

    /* Audio */
    e['ftp-aud-hit'].addEventListener('click', function() {
        if (eng.audio) { eng.audio.playHit(false); }
        self.logEvent('Audio: playHit(normal)', 'info');
    });
    e['ftp-aud-crit'].addEventListener('click', function() {
        if (eng.audio) { eng.audio.playHit(true); }
        self.logEvent('Audio: playHit(CRIT)', 'warning');
    });
    e['ftp-aud-step'].addEventListener('click', function() {
        if (eng.audio) { eng.audio.playFootstep(); }
        self.logEvent('Audio: playFootstep()', 'info');
    });
    e['ftp-aud-death'].addEventListener('click', function() {
        if (eng.audio) { eng.audio.playDeath(); }
        self.logEvent('Audio: playDeath()', 'warning');
    });
    e['ftp-aud-amb-on'].addEventListener('click', function() {
        if (eng.audio) { eng.audio.startAmbient(); }
        self.logEvent('Audio: ambient START', 'system');
    });
    e['ftp-aud-amb-off'].addEventListener('click', function() {
        if (eng.audio) { eng.audio.stopAmbient(); }
        self.logEvent('Audio: ambient STOP', 'system');
    });
    e['ftp-aud-mute'].addEventListener('click', function() {
        if (eng.audio) {
            eng.audio.toggleMute();
            var muted = eng.audio._muted;
            e['ftp-aud-mute'].textContent = muted ? '🔇 UNMUTE' : '🔇 MUTE';
            self.logEvent('Audio: ' + (muted ? 'MUTED' : 'UNMUTED'), 'system');
        }
    });
    e['ftp-aud-vol'].addEventListener('input', function() {
        var v = Number(e['ftp-aud-vol'].value) / 100;
        if (eng.audio) { eng.audio.setMasterVolume(v); }
        e['ftp-aud-vol-v'].textContent = e['ftp-aud-vol'].value + '%';
    });

    /* Hit Flash */
    e['ftp-flash-p-normal'].addEventListener('click', function() {
        if (eng.player) { eng.player.hitFlashTime = 200; }
        self.logEvent('Flash: PLAYER normal', 'info');
    });
    e['ftp-flash-p-crit'].addEventListener('click', function() {
        if (eng.player) { eng.player.hitFlashTime = 350; }
        self.logEvent('Flash: PLAYER crit (gold)', 'warning');
    });
    e['ftp-flash-npc-normal'].addEventListener('click', function() {
        var npc = self._nearestNPC();
        if (npc) { npc.hitFlashTime = 200; self.logEvent('Flash: NPC ' + (npc.name||npc.id) + ' normal', 'info'); }
        else { self.logEvent('Flash: no NPC in range', 'warning'); }
    });
    e['ftp-flash-npc-crit'].addEventListener('click', function() {
        var npc = self._nearestNPC();
        if (npc) { npc.hitFlashTime = 350; self.logEvent('Flash: NPC ' + (npc.name||npc.id) + ' crit', 'warning'); }
        else { self.logEvent('Flash: no NPC in range', 'warning'); }
    });

    /* ── Inventory Tests ── */
    e['ftp-inv-hp'].addEventListener('click', function() {
        if (!eng.inventoryManager || !RealmKit.Consumable) { self.logEvent('Inventory: system not ready', 'warning'); return; }
        var potion = RealmKit.Consumable.create('potion_health');
        var result = eng.inventoryManager.addItem(potion);
        self.logEvent('Added HP potion: ' + (result.success ? 'OK' : result.error), result.success ? 'info' : 'warning');
    });
    e['ftp-inv-mp'].addEventListener('click', function() {
        if (!eng.inventoryManager || !RealmKit.Consumable) { self.logEvent('Inventory: system not ready', 'warning'); return; }
        var potion = RealmKit.Consumable.create('potion_mana');
        var result = eng.inventoryManager.addItem(potion);
        self.logEvent('Added MP potion: ' + (result.success ? 'OK' : result.error), result.success ? 'info' : 'warning');
    });
    e['ftp-inv-food'].addEventListener('click', function() {
        if (!eng.inventoryManager || !RealmKit.Consumable) { self.logEvent('Inventory: system not ready', 'warning'); return; }
        var food = RealmKit.Consumable.create('food_bread');
        var result = eng.inventoryManager.addItem(food);
        self.logEvent('Added bread: ' + (result.success ? 'OK' : result.error), result.success ? 'info' : 'warning');
    });
    e['ftp-inv-gold100'].addEventListener('click', function() {
        if (!eng.inventoryManager) { self.logEvent('Inventory: system not ready', 'warning'); return; }
        var result = eng.inventoryManager.addGold(100);
        self.logEvent('Added 100 gold, total: ' + result.gold, 'info');
    });
    e['ftp-inv-gold1000'].addEventListener('click', function() {
        if (!eng.inventoryManager) { self.logEvent('Inventory: system not ready', 'warning'); return; }
        var result = eng.inventoryManager.addGold(1000);
        self.logEvent('Added 1000 gold, total: ' + result.gold, 'info');
    });
    e['ftp-inv-clear'].addEventListener('click', function() {
        if (!eng.inventoryManager) { self.logEvent('Inventory: system not ready', 'warning'); return; }
        eng.inventoryManager.clear();
        self.logEvent('Inventory cleared', 'system');
    });

    /* ── Consumable Use Tests ── */
    e['ftp-use-hp'].addEventListener('click', function() {
        if (!eng.player || !eng.inventoryManager) { self.logEvent('Use: no player/inventory', 'warning'); return; }
        var result = eng.useInventoryItem(0);
        if (result && result.success) {
            self.logEvent('Used slot 1: ' + (result.healed ? '+' + result.healed + ' HP' : 'OK'), 'info');
        } else {
            self.logEvent('Use slot 1: ' + (result ? result.error : 'failed'), 'warning');
        }
    });
    e['ftp-use-mp'].addEventListener('click', function() {
        if (!eng.player || !eng.inventoryManager) { self.logEvent('Use: no player/inventory', 'warning'); return; }
        var result = eng.useInventoryItem(1);
        if (result && result.success) {
            self.logEvent('Used slot 2: ' + (result.restored ? '+' + result.restored + ' MP' : 'OK'), 'info');
        } else {
            self.logEvent('Use slot 2: ' + (result ? result.error : 'failed'), 'warning');
        }
    });
    e['ftp-use-cure'].addEventListener('click', function() {
        if (!eng.player || !eng.inventoryManager) { self.logEvent('Use: no player/inventory', 'warning'); return; }
        var result = eng.useInventoryItem(2);
        if (result && result.success) {
            self.logEvent('Used slot 3 (cure): ' + (result.removedEffects ? result.removedEffects.length + ' removed' : 'OK'), 'info');
        } else {
            self.logEvent('Use slot 3: ' + (result ? result.error : 'failed'), 'warning');
        }
    });
    e['ftp-use-buff'].addEventListener('click', function() {
        if (!eng.player || !eng.inventoryManager || !eng.statusEffectManager) { self.logEvent('Use: no player/inventory/status', 'warning'); return; }
        var buffItem = RealmKit.Consumable.create('elixir_strength');
        eng.inventoryManager.addItem(buffItem);
        var slot = eng.inventoryManager.findByType('elixir_strength');
        if (slot) {
            var result = eng.useInventoryItem(slot.slot);
            self.logEvent('Used strength elixir: ' + (result.success ? 'OK, duration ' + result.duration + 'ms' : result.error), 'info');
        } else {
            self.logEvent('Could not find buff item in inventory', 'warning');
        }
    });
    e['ftp-add-poison'].addEventListener('click', function() {
        if (!eng.player || !eng.statusEffectManager) { self.logEvent('Status: no player/status system', 'warning'); return; }
        eng.statusEffectManager.applyEffect(eng.player, 'poison', 'test_panel', 10000);
        self.logEvent('Applied poison to player (10s)', 'warning');
    });
    e['ftp-add-burn'].addEventListener('click', function() {
        if (!eng.player || !eng.statusEffectManager) { self.logEvent('Status: no player/status system', 'warning'); return; }
        eng.statusEffectManager.applyEffect(eng.player, 'burn', 'test_panel', 8000);
        self.logEvent('Applied burn to player (8s)', 'warning');
    });

    /* ── Threat Tests ── */
    e['ftp-threat-sim'].addEventListener('click', function() {
        if (!eng.threatManager || !eng.player) { self.logEvent('Threat: no system', 'warning'); return; }
        var npc = self._nearestNPC();
        if (!npc) { self.logEvent('Threat: no NPC nearby', 'warning'); return; }
        eng.threatManager.addThreat(eng.player.id, npc.id, 50, 'test');
        var topTarget = eng.threatManager.getHighestThreatTarget(npc.id);
        self.logEvent('Threat sim: player → ' + npc.id + ' = 50, top: ' + (topTarget || 'none'), 'info');
    });
    e['ftp-threat-clear'].addEventListener('click', function() {
        if (!eng.threatManager) { self.logEvent('Threat: no system', 'warning'); return; }
        eng.threatManager.clear();
        self.logEvent('Threat table cleared', 'system');
    });

    /* ── Combat Tests ── */
    e['ftp-dmg-player'].addEventListener('click', function() {
        if (!eng.player || !eng.player.combatStats) { self.logEvent('Combat: no player', 'warning'); return; }
        eng.player.combatStats.hp = Math.max(1, eng.player.combatStats.hp - 25);
        self.logEvent('Player damaged: -25 HP, now ' + eng.player.combatStats.hp.toFixed(0), 'warning');
    });
    e['ftp-heal-player'].addEventListener('click', function() {
        if (!eng.player || !eng.player.combatStats) { self.logEvent('Combat: no player', 'warning'); return; }
        eng.player.combatStats.hp = Math.min(eng.player.combatStats.maxHp, eng.player.combatStats.hp + 50);
        self.logEvent('Player healed: +50 HP, now ' + eng.player.combatStats.hp.toFixed(0), 'info');
    });
    e['ftp-dmg-npc'].addEventListener('click', function() {
        var npc = self._nearestNPC();
        if (!npc || !npc.combatStats) { self.logEvent('Combat: no NPC nearby', 'warning'); return; }
        npc.combatStats.hp = Math.max(1, npc.combatStats.hp - 30);
        npc.hitFlashTime = 200;
        self.logEvent('NPC ' + (npc.name||npc.id) + ' damaged: -30 HP, now ' + npc.combatStats.hp.toFixed(0), 'warning');
    });
    e['ftp-kill-npc'].addEventListener('click', function() {
        var npc = self._nearestNPC();
        if (!npc || !npc.combatStats) { self.logEvent('Combat: no NPC nearby', 'warning'); return; }
        npc.combatStats.hp = 0;
        npc.active = false;
        if (npc.deathTime === undefined) npc.deathTime = Date.now();
        npc.hitFlashTime = 350;
        self.logEvent('NPC ' + (npc.name||npc.id) + ' KILLED', 'kill');
    });
    e['ftp-spawn-loot'].addEventListener('click', function() {
        if (!eng.player || !eng.lootDrops) { self.logEvent('Loot: no player/system', 'warning'); return; }
        var gold = Math.floor(Math.random() * 50) + 10;
        var items = [];
        if (Math.random() > 0.5 && RealmKit.Consumable) {
            items.push(RealmKit.Consumable.randomDrop(1));
        }
        var loot = new RealmKit.LootDrop({
            x: eng.player.x + (Math.random() - 0.5) * 100,
            y: eng.player.y + (Math.random() - 0.5) * 100,
            gold: gold,
            items: items
        });
        eng.lootDrops.push(loot);
        self.logEvent('Spawned loot: ' + gold + 'g, ' + items.length + ' items', 'info');
    });

    /* ── XP / Leveling Tests ── */
    e['ftp-xp-add50'].addEventListener('click', function() {
        if (!eng.experienceManager || !eng.player) { self.logEvent('XP: no system/player', 'warning'); return; }
        var result = eng.experienceManager.addXp(eng.player.id, 50, 'test_panel');
        self.logEvent('+50 XP: total=' + result.totalXp + ' lvl=' + result.level + (result.leveledUp ? ' LEVEL UP!' : ''), result.leveledUp ? 'system' : 'info');
    });
    e['ftp-xp-add200'].addEventListener('click', function() {
        if (!eng.experienceManager || !eng.player) { self.logEvent('XP: no system/player', 'warning'); return; }
        var result = eng.experienceManager.addXp(eng.player.id, 200, 'test_panel');
        self.logEvent('+200 XP: total=' + result.totalXp + ' lvl=' + result.level + (result.leveledUp ? ' LEVEL UP!' : ''), result.leveledUp ? 'system' : 'info');
    });
    e['ftp-xp-cheat'].addEventListener('click', function() {
        if (!eng.experienceManager || !eng.player) { self.logEvent('XP: no system/player', 'warning'); return; }
        var data = eng.experienceManager.getEntityData(eng.player.id);
        var currentLevel = data ? data.level : 1;
        var xpForNext = eng.experienceManager.getXPForLevel(currentLevel + 1);
        var needed = xpForNext - (data ? data.xp : 0);
        if (needed > 0) {
            var result = eng.experienceManager.addXp(eng.player.id, needed + 1, 'cheat');
            self.logEvent('CHEAT LVL UP: ' + currentLevel + ' -> ' + result.level, 'system');
        } else {
            self.logEvent('Already at max level or error', 'warning');
        }
    });

    /* ── Entity Tests ── */
    e['ftp-ent-spawn-npc'].addEventListener('click', function() {
        if (!eng.player || !eng.entityManager) { self.logEvent('Entity: no player/manager', 'warning'); return; }
        var templates = RealmKit.EntityTemplates || {};
        var templateKeys = Object.keys(templates);
        if (templateKeys.length === 0) { self.logEvent('Entity: no templates', 'warning'); return; }
        var templateKey = templateKeys[Math.floor(Math.random() * templateKeys.length)];
        var template = templates[templateKey];
        var npc = new RealmKit.NPC({
            id: 'test_npc_' + Date.now(),
            name: template.name || templateKey,
            x: eng.player.x + (Math.random() - 0.5) * 200,
            y: eng.player.y + (Math.random() - 0.5) * 200,
            sprite: eng.playerSprite,
            behavior: template.behavior || 'idle',
            stats: template.stats || { hp: 50, maxHp: 50, attack: 10, defense: 5 }
        });
        eng.entityManager.add(npc);
        self.logEvent('Spawned NPC: ' + npc.name + ' at ' + Math.round(npc.x) + ',' + Math.round(npc.y), 'info');
    });
    e['ftp-ent-kill-all'].addEventListener('click', function() {
        if (!eng.entityManager) { self.logEvent('Entity: no manager', 'warning'); return; }
        var entities = eng.entityManager.getByType('npc');
        var count = 0;
        for (var i = entities.length - 1; i >= 0; i--) {
            var ent = entities[i];
            if (ent.active && ent.combatStats) {
                ent.combatStats.hp = 0;
                ent.active = false;
                count++;
            }
        }
        self.logEvent('Killed ' + count + ' NPCs', 'warning');
    });
    e['ftp-ent-teleport'].addEventListener('click', function() {
        if (!eng.player || !eng.tileMap) { self.logEvent('Teleport: no player/tileMap', 'warning'); return; }
        var mapW = eng.tileMap.width * eng.tileMap.tileWidth;
        var mapH = eng.tileMap.height * eng.tileMap.tileHeight;
        eng.player.x = Math.random() * (mapW - 100) + 50;
        eng.player.y = Math.random() * (mapH - 100) + 50;
        self.logEvent('Teleported to ' + Math.round(eng.player.x) + ',' + Math.round(eng.player.y), 'info');
    });

    /* ── Tile / World Tests ── */
    e['ftp-tile-check'].addEventListener('click', function() {
        if (!eng.player || !eng.tileMap) { self.logEvent('Tile: no player/tileMap', 'warning'); return; }
        var tx = Math.floor(eng.player.x / eng.tileMap.tileWidth);
        var ty = Math.floor(eng.player.y / eng.tileMap.tileHeight);
        var idx = ty * eng.tileMap.width + tx;
        var collision = eng.tileMap.collisionData ? (eng.tileMap.collisionData[idx] ? 'YES' : 'NO') : 'unknown';
        self.logEvent('Tile ' + tx + ',' + ty + ' collision: ' + collision, 'info');
    });

    /* ── System Check ── */
    e['ftp-sys-check'].addEventListener('click', function() {
        var results = [];
        results.push('CombatSystem: ' + (eng.combatSystem ? 'OK' : 'MISSING'));
        results.push('StatusEffects: ' + (eng.statusEffectManager ? 'OK' : 'MISSING'));
        results.push('ThreatManager: ' + (eng.threatManager ? 'OK' : 'MISSING'));
        results.push('ExperienceMgr: ' + (eng.experienceManager ? 'OK' : 'MISSING'));
        results.push('InventoryMgr: ' + (eng.inventoryManager ? 'OK' : 'MISSING'));
        results.push('Audio: ' + (eng.audio ? 'OK' : 'MISSING'));
        self.logEvent('Systems checked', 'system');
        console.log('[SYSTEM CHECK]\n' + results.join('\n'));
    });

    /* ── Particle Effects ── */
    var playerCenterX = function() { return eng.player ? eng.player.x : 400; };
    var playerCenterY = function() { return eng.player.y ? eng.player.y : 300; };
    
    e['ftp-part-blood'].addEventListener('click', function() {
        if (!eng.particles) { self.logEvent('Particles: no system', 'warning'); return; }
        eng.particles.createBloodSplash(playerCenterX(), playerCenterY(), Math.PI / 4, false);
        self.logEvent('Blood splash effect', 'info');
    });
    e['ftp-part-sparkle'].addEventListener('click', function() {
        if (!eng.particles) { self.logEvent('Particles: no system', 'warning'); return; }
        eng.particles.createSparkle(playerCenterX(), playerCenterY(), '#ffd700', { count: 15, size: 3 });
        self.logEvent('Sparkle effect', 'info');
    });
    e['ftp-part-smoke'].addEventListener('click', function() {
        if (!eng.particles) { self.logEvent('Particles: no system', 'warning'); return; }
        eng.particles.createSmoke(playerCenterX(), playerCenterY(), { count: 8, color: '#555555' });
        self.logEvent('Smoke effect', 'info');
    });
    e['ftp-part-impact'].addEventListener('click', function() {
        if (!eng.particles) { self.logEvent('Particles: no system', 'warning'); return; }
        eng.particles.createImpactSparks(playerCenterX(), playerCenterY());
        self.logEvent('Impact sparks effect', 'info');
    });
    e['ftp-part-death'].addEventListener('click', function() {
        if (!eng.particles) { self.logEvent('Particles: no system', 'warning'); return; }
        eng.particles.createDeathEffect(playerCenterX(), playerCenterY());
        self.logEvent('Death effect', 'info');
    });
    e['ftp-part-clear'].addEventListener('click', function() {
        if (!eng.particles) { self.logEvent('Particles: no system', 'warning'); return; }
        eng.particles.clear();
        self.logEvent('Particles cleared', 'system');
    });

    /* ── Projectiles ── */
    e['ftp-proj-arrow'].addEventListener('click', function() {
        if (!eng.projectileSystem) { self.logEvent('Projectiles: no system', 'warning'); return; }
        var targetX = playerCenterX() + 200;
        var targetY = playerCenterY();
        eng.projectileSystem.fire({
            x: playerCenterX(),
            y: playerCenterY(),
            targetX: targetX,
            targetY: targetY,
            speed: 350,
            color: '#8b4513',
            hit: true,
            damage: 10,
            onComplete: function(proj, hit) {
                self.logEvent('Arrow ' + (hit ? 'HIT' : 'MISS'), hit ? 'info' : 'warning');
            }
        });
    });
    e['ftp-proj-bolt'].addEventListener('click', function() {
        if (!eng.projectileSystem) { self.logEvent('Projectiles: no system', 'warning'); return; }
        var targetX = playerCenterX() + 250;
        var targetY = playerCenterY() - 50;
        eng.projectileSystem.fire({
            x: playerCenterX(),
            y: playerCenterY(),
            targetX: targetX,
            targetY: targetY,
            speed: 450,
            color: '#666666',
            hit: true,
            damage: 15,
            critical: Math.random() < 0.2,
            onComplete: function(proj, hit) {
                self.logEvent('Bolt ' + (hit ? 'HIT' : 'MISS') + (proj.critical ? ' CRIT' : ''), 'info');
            }
        });
    });
    e['ftp-proj-magic'].addEventListener('click', function() {
        if (!eng.projectileSystem) { self.logEvent('Projectiles: no system', 'warning'); return; }
        var targetX = playerCenterX() + 150;
        var targetY = playerCenterY() + 100;
        eng.projectileSystem.fire({
            x: playerCenterX(),
            y: playerCenterY(),
            targetX: targetX,
            targetY: targetY,
            speed: 500,
            color: '#9932cc',
            frames: 4,
            frameTime: 50,
            hit: true,
            damage: 20,
            onComplete: function(proj, hit) {
                self.logEvent('Magic ' + (hit ? 'HIT' : 'MISS'), 'info');
            }
        });
    });
    e['ftp-proj-fireball'].addEventListener('click', function() {
        if (!eng.projectileSystem) { self.logEvent('Projectiles: no system', 'warning'); return; }
        var angle = Math.random() * Math.PI * 2;
        var dist = 150 + Math.random() * 100;
        var targetX = playerCenterX() + Math.cos(angle) * dist;
        var targetY = playerCenterY() + Math.sin(angle) * dist;
        eng.projectileSystem.fire({
            x: playerCenterX(),
            y: playerCenterY(),
            targetX: targetX,
            targetY: targetY,
            speed: 400,
            color: '#ff4400',
            frames: 4,
            frameTime: 60,
            hit: true,
            damage: 25,
            onComplete: function(proj, hit) {
                if (eng.particles) {
                    eng.particles.createSparkle(proj.targetX, proj.targetY, '#ff6600', { count: 10, size: 4 });
                }
                self.logEvent('Fireball ' + (hit ? 'HIT' : 'MISS'), 'info');
            }
        });
    });
    e['ftp-proj-miss'].addEventListener('click', function() {
        if (!eng.projectileSystem) { self.logEvent('Projectiles: no system', 'warning'); return; }
        var targetX = playerCenterX() + 200;
        var targetY = playerCenterY() - 80;
        eng.projectileSystem.fire({
            x: playerCenterX(),
            y: playerCenterY(),
            targetX: targetX,
            targetY: targetY,
            speed: 380,
            color: '#888888',
            hit: false,
            onComplete: function(proj, hit) {
                self.logEvent('Projectile MISS', 'warning');
            }
        });
    });
    e['ftp-proj-clear'].addEventListener('click', function() {
        if (!eng.projectileSystem) { self.logEvent('Projectiles: no system', 'warning'); return; }
        eng.projectileSystem.clear();
        self.logEvent('Projectiles cleared', 'system');
    });

    /* ── Fade Transition ── */
    e['ftp-fade-out'].addEventListener('click', function() {
        if (!eng.fadeTransition) { self.logEvent('Fade: no system', 'warning'); return; }
        eng.fadeTransition.fadeOut(500, function() { self.logEvent('Fade out complete', 'system'); });
    });
    e['ftp-fade-in'].addEventListener('click', function() {
        if (!eng.fadeTransition) { self.logEvent('Fade: no system', 'warning'); return; }
        eng.fadeTransition.fadeIn(500, function() { self.logEvent('Fade in complete', 'system'); });
    });
    e['ftp-fade-trans'].addEventListener('click', function() {
        if (!eng.fadeTransition) { self.logEvent('Fade: no system', 'warning'); return; }
        eng.fadeTransition.transition({}, function() { self.logEvent('Transition complete', 'system'); });
    });
    e['ftp-fade-force'].addEventListener('click', function() {
        if (!eng.fadeTransition) { self.logEvent('Fade: no system', 'warning'); return; }
        eng.fadeTransition.forceComplete();
        self.logEvent('Fade force completed', 'system');
    });

    /* ── Weather ── */
    e['ftp-w-clear'].addEventListener('click', function() {
        if (!eng.weatherSystem) { self.logEvent('Weather: no system', 'warning'); return; }
        eng.weatherSystem.clear();
        self.logEvent('Weather cleared', 'system');
    });
    e['ftp-w-rain'].addEventListener('click', function() {
        if (!eng.weatherSystem) { self.logEvent('Weather: no system', 'warning'); return; }
        eng.weatherSystem.setWeather('rain', 1.0, 0);
        self.logEvent('Rain started', 'info');
    });
    e['ftp-w-snow'].addEventListener('click', function() {
        if (!eng.weatherSystem) { self.logEvent('Weather: no system', 'warning'); return; }
        eng.weatherSystem.setWeather('snow', 1.0, Math.PI / 4);
        self.logEvent('Snow started', 'info');
    });
    e['ftp-w-storm'].addEventListener('click', function() {
        if (!eng.weatherSystem) { self.logEvent('Weather: no system', 'warning'); return; }
        eng.weatherSystem.setWeather('storm', 1.0, Math.PI / 6);
        self.logEvent('Storm started', 'warning');
    });

    /* ── Save/Load ── */
    e['ftp-save-save'].addEventListener('click', function() {
        if (!eng.saveManager) { self.logEvent('Save: no system', 'warning'); return; }
        var state = eng.saveManager.serializeWorld(eng);
        var result = eng.saveManager.save(0, state);
        self.logEvent(result.success ? 'Saved to slot 0' : 'Save failed: ' + result.error, result.success ? 'system' : 'warning');
    });
    e['ftp-save-load'].addEventListener('click', function() {
        if (!eng.saveManager) { self.logEvent('Load: no system', 'warning'); return; }
        var result = eng.saveManager.load(0);
        self.logEvent(result.success ? 'Loaded from slot 0' : 'Load failed: ' + result.error, result.success ? 'system' : 'warning');
    });
    e['ftp-save-info'].addEventListener('click', function() {
        if (!eng.saveManager) { self.logEvent('Save: no system', 'warning'); return; }
        var info = eng.saveManager.getSlotInfo(0);
        self.logEvent(info ? 'Slot 0: ' + new Date(info.timestamp).toLocaleString() : 'Slot 0: empty', 'info');
    });
    e['ftp-save-delete'].addEventListener('click', function() {
        if (!eng.saveManager) { self.logEvent('Save: no system', 'warning'); return; }
        eng.saveManager.delete(0);
        self.logEvent('Slot 0 deleted', 'warning');
    });

    /* ── Quest ── */
    e['ftp-q-start'].addEventListener('click', function() {
        if (!eng.questSystem) { self.logEvent('Quest: no system', 'warning'); return; }
        eng.questSystem.register({
            id: 'test_quest_' + Date.now(),
            title: 'Test Quest',
            description: 'A test quest for debugging',
            objectives: [
                { id: 'obj1', type: 'kill', target: 'goblin', required: 3 },
                { id: 'obj2', type: 'collect', item: 'herb', required: 5 }
            ]
        });
        var started = eng.questSystem.start('test_quest_' + Date.now());
        self.logEvent(started ? 'Quest started' : 'Quest start failed', started ? 'info' : 'warning');
    });
    e['ftp-q-test'].addEventListener('click', function() {
        if (!eng.questSystem) { self.logEvent('Quest: no system', 'warning'); return; }
        eng.questSystem.onKill('goblin');
        self.logEvent('Quest objective tested: kill goblin', 'info');
    });

    /* ── Achievement ── */
    e['ftp-ach-kill'].addEventListener('click', function() {
        if (!eng.achievementSystem) { self.logEvent('Achievement: no system', 'warning'); return; }
        eng.achievementSystem.trackStat('kills', 1);
        self.logEvent('+1 kill (total: ' + eng.achievementSystem.getStat('kills') + ')', 'info');
    });
    e['ftp-ach-gold'].addEventListener('click', function() {
        if (!eng.achievementSystem) { self.logEvent('Achievement: no system', 'warning'); return; }
        eng.achievementSystem.trackStat('goldCollected', 100);
        self.logEvent('+100 gold (total: ' + eng.achievementSystem.getStat('goldCollected') + ')', 'info');
    });
    e['ftp-ach-level'].addEventListener('click', function() {
        if (!eng.achievementSystem) { self.logEvent('Achievement: no system', 'warning'); return; }
        eng.achievementSystem.setStat('level', 5);
        self.logEvent('Level set to 5', 'info');
    });
    e['ftp-ach-list'].addEventListener('click', function() {
        if (!eng.achievementSystem) { self.logEvent('Achievement: no system', 'warning'); return; }
        var unlocked = eng.achievementSystem.getUnlocked();
        self.logEvent('Unlocked: ' + unlocked.length + ' achievements', 'system');
        for (var i = 0; i < unlocked.length; i++) {
            var a = eng.achievementSystem.achievements.get(unlocked[i]);
            if (a) self.logEvent('  ' + a.name, 'info');
        }
    });
    e['ftp-ach-xp-add'].addEventListener('click', function() {
        if (!eng.experienceManager || !eng.player) { self.logEvent('XP: no system', 'warning'); return; }
        var result = eng.experienceManager.addXp(eng.player.id, 500, 'test_panel');
        self.logEvent('+500 XP (total: ' + result.totalXp + ', level: ' + result.level + ')', 'info');
        if (result.leveledUp) {
            self.logEvent('⬆️ LEVEL UP! ' + result.oldLevel + ' -> ' + result.newLevel, 'levelup');
        }
    });
    e['ftp-ach-xp-big'].addEventListener('click', function() {
        if (!eng.experienceManager || !eng.player) { self.logEvent('XP: no system', 'warning'); return; }
        var result = eng.experienceManager.addXp(eng.player.id, 5000, 'test_panel_big');
        self.logEvent('+5000 XP (total: ' + result.totalXp + ', level: ' + result.level + ')', 'info');
        if (result.leveledUp) {
            self.logEvent('⬆️ LEVEL UP! ' + result.oldLevel + ' -> ' + result.newLevel, 'levelup');
        }
    });

    /* ── Story Builder ── */
    e['ftp-sb-open'].addEventListener('click', function() {
        if (!eng.storyBuilder) { self.logEvent('StoryBuilder: not loaded', 'warning'); return; }
        eng.storyBuilder.show();
        self.logEvent('StoryBuilder opened', 'system');
    });
    e['ftp-sb-offline'].addEventListener('click', function() {
        if (!eng.storyBuilder) { self.logEvent('StoryBuilder: not loaded', 'warning'); return; }
        eng.storyBuilder.storyData = {
            id: 'offline_' + Date.now(),
            title: 'Offline Story',
            description: 'Created via test panel',
            genre: 'fantasy',
            factions: [],
            characters: [],
            dialogues: [],
            quests: [],
            scenes: [],
            engine_configs: {}
        };
        eng.storyBuilder.currentStoryId = eng.storyBuilder.storyData.id;
        self.logEvent('Created offline story: ' + eng.storyBuilder.storyData.id, 'info');
        self._updateStoryBuilder();
    });

    /* API Test buttons */
    e['ftp-api-ping'].addEventListener('click', function() {
        self.logEvent('API PING...', 'system');
        if (!eng.storyBuilder || !eng.storyBuilder.db) {
            self.logEvent('API: StoryDatabase not available', 'error');
            e['ftp-api-status'].textContent = 'NO DB';
            e['ftp-api-status'].className = 'ftp-val ftp-val-warn';
            return;
        }
        var db = eng.storyBuilder.db;
        self.logEvent('API endpoint: ' + db._base, 'info');
        e['ftp-api-status'].textContent = 'PINGING...';
        e['ftp-api-status'].className = 'ftp-val';
        
        db.listStories().then(function(stories) {
            self.logEvent('API OK — ' + stories.length + ' stories found', 'info');
            e['ftp-api-status'].textContent = 'ONLINE (' + stories.length + ')';
            e['ftp-api-status'].className = 'ftp-val ftp-val-ok';
        }).catch(function(err) {
            self.logEvent('API FAILED: ' + err.message, 'error');
            e['ftp-api-status'].textContent = 'OFFLINE';
            e['ftp-api-status'].className = 'ftp-val ftp-val-warn';
        });
    });

    e['ftp-api-list'].addEventListener('click', function() {
        self.logEvent('Fetching stories...', 'system');
        if (!eng.storyBuilder || !eng.storyBuilder.db) {
            self.logEvent('API: StoryDatabase not available', 'error');
            return;
        }
        var db = eng.storyBuilder.db;
        db.listStories().then(function(stories) {
            self.logEvent('Found ' + stories.length + ' stories:', 'info');
            for (var i = 0; i < stories.length && i < 5; i++) {
                var s = stories[i];
                self.logEvent('  [' + s.id + '] ' + s.title + ' (' + (s.genre_name || s.genre || '?') + ')', 'info');
            }
            if (stories.length > 5) {
                self.logEvent('  ... and ' + (stories.length - 5) + ' more', 'info');
            }
        }).catch(function(err) {
            self.logEvent('LIST FAILED: ' + err.message, 'error');
        });
    });

    e['ftp-api-create'].addEventListener('click', function() {
        self.logEvent('Creating test story...', 'system');
        if (!eng.storyBuilder || !eng.storyBuilder.db) {
            self.logEvent('API: StoryDatabase not available', 'error');
            return;
        }
        var db = eng.storyBuilder.db;
        var testData = {
            title: 'Test Story ' + Date.now(),
            description: 'Created via F3 API test button',
            genre: 'fantasy',
            author: 'FeatureTestPanel',
            is_published: false
        };
        db.createStory(testData).then(function(result) {
            self.logEvent('CREATED story: ' + result.id, 'info');
            self.logEvent('  Title: ' + testData.title, 'info');
            eng.storyBuilder.storyData = result;
            eng.storyBuilder.currentStoryId = result.id;
            self._updateStoryBuilder();
        }).catch(function(err) {
            self.logEvent('CREATE FAILED: ' + err.message, 'error');
            self.logEvent('Using offline fallback...', 'warning');
            eng.storyBuilder.storyData = {
                id: 'offline_' + Date.now(),
                title: testData.title,
                description: testData.description + ' (offline)',
                genre: testData.genre
            };
            eng.storyBuilder.currentStoryId = eng.storyBuilder.storyData.id;
            self._updateStoryBuilder();
        });
    });

    e['ftp-api-clear'].addEventListener('click', function() {
        if (eng.storyBuilder) {
            eng.storyBuilder.storyData = null;
            eng.storyBuilder.currentStoryId = null;
        }
        e['ftp-api-status'].textContent = '--';
        e['ftp-api-status'].className = 'ftp-val';
        self.logEvent('Cleared story data', 'system');
    });

    /* Spawner System */
    e['ftp-spawn-goblin'].addEventListener('click', function() {
        self._spawnMonster('goblin_scout');
    });
    e['ftp-spawn-skeleton'].addEventListener('click', function() {
        self._spawnMonster('skeleton');
    });
    e['ftp-spawn-wolf'].addEventListener('click', function() {
        self._spawnMonster('wolf');
    });
    e['ftp-spawn-orc'].addEventListener('click', function() {
        self._spawnMonster('orc_grunt');
    });
    e['ftp-spawn-area'].addEventListener('click', function() {
        self._spawnArea(5);
    });
    e['ftp-spawn-clear'].addEventListener('click', function() {
        self._clearSpawners();
    });
    e['ftp-spawn-boss'].addEventListener('click', function() {
        self._spawnMonster('boss_goblin_king');
    });

    /* Night Spawners (Time-Conditioned) */
    e['ftp-night-spawn'].addEventListener('click', function() {
        self._spawnNightOnly();
    });
    e['ftp-night-skeleton'].addEventListener('click', function() {
        self._spawnNightSkeleton();
    });
    e['ftp-night-dungeon'].addEventListener('click', function() {
        self._spawnDungeonSpawner();
    });
    e['ftp-night-boss'].addEventListener('click', function() {
        self._spawnNightBoss();
    });
    e['ftp-night-time-set'].addEventListener('click', function() {
        if (eng.dayNight) {
            eng.dayNight.time = 0;
            self.logEvent('Time set to MIDNIGHT (00:00)', 'info');
        }
    });
    e['ftp-night-time-noon'].addEventListener('click', function() {
        if (eng.dayNight) {
            eng.dayNight.time = 43200;
            self.logEvent('Time set to NOON (12:00)', 'info');
        }
    });

    /* Trigger System */
    e['ftp-trig-enter'].addEventListener('click', function() {
        self._testTriggerEnter();
    });
    e['ftp-trig-exit'].addEventListener('click', function() {
        self._testTriggerExit();
    });
    e['ftp-trig-create'].addEventListener('click', function() {
        self._createTestTrigger();
    });
    e['ftp-trig-clear'].addEventListener('click', function() {
        self._clearTriggers();
    });

    /* NPC Schedule Tests */
    e['ftp-sched-merchant'].addEventListener('click', function() {
        self._spawnScheduledNPC('merchant');
    });
    e['ftp-sched-guard'].addEventListener('click', function() {
        self._spawnScheduledNPC('guard');
    });
    e['ftp-sched-villager'].addEventListener('click', function() {
        self._spawnScheduledNPC('villager');
    });
    e['ftp-sched-nightguard'].addEventListener('click', function() {
        self._spawnScheduledNPC('night_guard');
    });
    e['ftp-sched-innkeeper'].addEventListener('click', function() {
        self._spawnScheduledNPC('innkeeper');
    });
    e['ftp-sched-blacksmith'].addEventListener('click', function() {
        self._spawnScheduledNPC('blacksmith');
    });
    e['ftp-sched-wizard'].addEventListener('click', function() {
        self._spawnScheduledNPC('wizard');
    });
    e['ftp-sched-farmer'].addEventListener('click', function() {
        self._spawnScheduledNPC('farmer');
    });
    e['ftp-sched-traveler'].addEventListener('click', function() {
        self._spawnScheduledNPC('traveler');
    });
    e['ftp-sched-clear'].addEventListener('click', function() {
        self._clearScheduleOverride();
    });

    /* Event log clear */
    e['ftp-evlog-clear'].addEventListener('click', function() {
        self._eventLog = [];
        e['rk-ftp-evlog'].innerHTML = '';
        self.logEvent('Log cleared', 'system');
    });
};

// ─── F3 toggle ───────────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._bindKeys = function() {
    var self = this;
    window.addEventListener('keydown', function(ev) {
        if (ev.key === 'F3') {
            ev.preventDefault();
            self.toggle();
        }
    });
};

// ─── Drag ────────────────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._bindDrag = function() {
    var self = this;
    var hdr = document.getElementById('rk-ftp-hdr');
    if (!hdr) return;
    hdr.addEventListener('mousedown', function(ev) {
        self._dragging = true;
        self._dragOffX = ev.clientX - self.el.getBoundingClientRect().left;
        self._dragOffY = ev.clientY - self.el.getBoundingClientRect().top;
        ev.preventDefault();
    });
    window.addEventListener('mousemove', function(ev) {
        if (!self._dragging) return;
        self.el.style.left = (ev.clientX - self._dragOffX) + 'px';
        self.el.style.top  = (ev.clientY - self._dragOffY) + 'px';
    });
    window.addEventListener('mouseup', function() { self._dragging = false; });
};

// ─── Toggle ──────────────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype.toggle = function() {
    this.visible = !this.visible;
    this.el.style.display    = this.visible ? 'flex' : 'none';
    this._hint.style.display = this.visible ? 'none' : 'block';
    if (this.visible) {
        this.logEvent('Grimoire opened', 'system');
    }
};

// ─── Public: logEvent ────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype.logEvent = function(msg, type) {
    var now  = new Date();
    var ts   = (now.getMinutes() < 10 ? '0' : '') + now.getMinutes() + ':' +
               (now.getSeconds() < 10 ? '0' : '') + now.getSeconds() + '.' +
               String(now.getMilliseconds()).padStart(3,'0').slice(0,2);
    this._eventLog.push({ ts: ts, msg: msg, type: type || 'info' });
    if (this._eventLog.length > this._maxEvents) {
        this._eventLog.shift();
    }
    this._flushEventLog();
};

RealmKit.FeatureTestPanel.prototype._flushEventLog = function() {
    var el = this._e['rk-ftp-evlog'];
    if (!el) return;
    var log = this._eventLog;
    var html = '';
    for (var i = log.length - 1; i >= 0; i--) {
        var entry = log[i];
        var cls = 'ftp-log-' + (entry.type || 'info');
        html += '<div class="ftp-log-entry">' +
            '<span class="ftp-log-ts">' + entry.ts + '</span>' +
            '<span class="ftp-log-msg ' + cls + '">' + entry.msg + '</span>' +
            '</div>';
    }
    el.innerHTML = html;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._fmtTime = function(secs) {
    var h = Math.floor(secs / 3600) % 24;
    var m = Math.floor((secs % 3600) / 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
};

RealmKit.FeatureTestPanel.prototype._dayPhaseLabel = function(secs) {
    var h = Math.floor(secs / 3600) % 24;
    if (h < 5  || h >= 22) return '🌑 Night';
    if (h < 7)             return '🌄 Pre-dawn';
    if (h < 9)             return '🌅 Dawn';
    if (h < 11)            return '☀ Morning';
    if (h < 13)            return '☀ Noon';
    if (h < 17)            return '⛅ Afternoon';
    if (h < 19)            return '🌇 Dusk';
    if (h < 21)            return '🌆 Evening';
    return '🌙 Late night';
};

RealmKit.FeatureTestPanel.prototype._nearestNPC = function() {
    var eng = this.engine;
    if (!eng.player || !eng.entityManager) return null;
    var px = eng.player.x, py = eng.player.y;
    var best = null, bestDist = Infinity;
    var ents = eng.entityManager.entities || [];
    for (var i = 0; i < ents.length; i++) {
        var ent = ents[i];
        if (!ent.active || ent === eng.player || ent.type !== 'npc') continue;
        var dx = ent.x - px, dy = ent.y - py;
        var d = dx*dx + dy*dy;
        if (d < bestDist) { bestDist = d; best = ent; }
    }
    return best;
};

// ─── Per-frame update ────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype.update = function() {
    if (!this.visible) return;

    var eng = this.engine;
    var e   = this._e;
    var p   = eng.player;

    /* ── Perf strip ── */
    var fps = eng.totalRenderMs > 0 ? Math.round(1000 / eng.totalRenderMs) : 0;
    e['ftp-p-fps'].textContent     = fps;
    e['ftp-p-frame'].textContent   = (eng.totalRenderMs || 0).toFixed(1) + 'ms';
    var elapsed = Math.floor((performance.now() - (eng.startTime || 0)) / 1000);
    e['ftp-p-runtime'].textContent = Math.floor(elapsed/60) + 'm' + (elapsed%60) + 's';
    e['ftp-p-ents'].textContent    = eng.entityManager ? (eng.entityManager.entities||[]).length : '--';

    /* ── Attack Animation ── */
    if (p) {
        var smState = p.stateMachine ? (p.stateMachine.currentState || 'none') : 'none';
        e['ftp-sm-state'].textContent = smState;

        // Phase segments — each segment shows its own fill %
        var phases = ['windup','strike','impact','followthrough'];
        var phasePcts = { windup:0, strike:0, impact:0, followthrough:0 };
        var phaseLbl = 'idle';

        if (p.weapon && p.weapon.isAttacking) {
            var pi = p.weapon.getPhaseInfo();
            phasePcts[pi.name] = pi.t;
            phaseLbl = pi.name + '  t=' + pi.t.toFixed(3);
        }
        for (var i = 0; i < phases.length; i++) {
            var fillEl = e['ftp-seg-' + phases[i] + '-fill'];
            if (fillEl) fillEl.style.width = (phasePcts[phases[i]] * 100).toFixed(1) + '%';
        }
        e['ftp-wpn-phase'].textContent = phaseLbl;

        var lunge = p.getAttackBodyOffset ? p.getAttackBodyOffset() : {dx:0,dy:0};
        e['ftp-lunge'].textContent = 'dx:' + lunge.dx.toFixed(1) + '  dy:' + lunge.dy.toFixed(1);

        var cd = p.attackCooldown > 0 ? p.attackCooldown.toFixed(0) + ' ms' : '✓ ready';
        e['ftp-atk-cd'].textContent = cd;
        e['ftp-atk-cd'].className = 'ftp-val ' + (p.attackCooldown > 0 ? 'ftp-val-warn' : 'ftp-val-ok');
    }

    /* ── Screen Shake ── */
    if (eng.shake) {
        var rem = eng.shake.remaining > 0 ? eng.shake.remaining.toFixed(0) + ' ms' : '✓ calm';
        e['ftp-shake-rem'].textContent = rem;
        e['ftp-shake-rem'].className = 'ftp-val ' + (eng.shake.remaining > 0 ? 'ftp-val-warn' : 'ftp-val-ok');
        if (eng.shake.remaining > 0) {
            e['ftp-shake-live'].textContent =
                'i=' + eng.shake.intensity.toFixed(1) +
                '  x=' + eng.shake.x.toFixed(1) +
                '  y=' + eng.shake.y.toFixed(1);
        } else {
            e['ftp-shake-live'].textContent = '--';
        }
    }

    /* ── Day / Night ── */
    if (eng.dayNight) {
        var dn     = eng.dayNight;
        var cosT   = Math.cos((dn.time / dn.cycleSeconds) * Math.PI * 2);
        var alpha  = Math.max(0, 0.41 + cosT * 0.41);
        var alphaClr = alpha < 0.1 ? 'ftp-val-ok' : alpha > 0.6 ? 'ftp-val-bad' : 'ftp-val-warn';

        e['ftp-dn-time'].textContent  = this._fmtTime(dn.time);
        e['ftp-dn-phase'].textContent = this._dayPhaseLabel(dn.time);
        e['ftp-dn-alpha'].textContent = alpha.toFixed(3);
        e['ftp-dn-alpha'].className   = 'ftp-val ' + alphaClr;
        e['ftp-dn-lights'].textContent = (eng.lightSources||[]).length + ' sources';

        if (document.activeElement !== e['ftp-dn-tod']) {
            e['ftp-dn-tod'].value         = Math.floor(dn.time);
            e['ftp-dn-tod-v'].textContent = this._fmtTime(dn.time);
        }
        if (document.activeElement !== e['ftp-dn-speed']) {
            e['ftp-dn-speed'].value         = dn.speed;
            e['ftp-dn-speed-v'].textContent = dn.speed;
        }
    }

    /* ── Audio ── */
    if (eng.audio) {
        var ctx = eng.audio._ctx;
        var ctxState = ctx ? ctx.state : 'not created';
        var ctxClr   = ctxState === 'running' ? 'ftp-val-ok' : 'ftp-val-warn';
        e['ftp-aud-ctx'].textContent  = ctxState;
        e['ftp-aud-ctx'].className    = 'ftp-val ' + ctxClr;
    }

    /* ── Hit Flash ── */
    if (p) {
        var pft = p.hitFlashTime > 0 ? p.hitFlashTime.toFixed(0) + ' ms' : '✓ none';
        e['ftp-flash-player'].textContent = pft;
        e['ftp-flash-player'].className   = 'ftp-val ' + (p.hitFlashTime > 0 ? 'ftp-val-warn' : '');
    }
    var nearNPC = this._nearestNPC();
    e['ftp-flash-npc-name'].textContent = nearNPC ? (nearNPC.name || nearNPC.id) : '--';

    /* ── Combat Snapshot ── */
    if (nearNPC) {
        var cs   = nearNPC.combatStats;
        var dx2  = nearNPC.x - (p ? p.x : 0);
        var dy2  = nearNPC.y - (p ? p.y : 0);
        var dist = Math.round(Math.sqrt(dx2*dx2 + dy2*dy2));

        e['ftp-cs-name'].textContent    = nearNPC.name || nearNPC.id;
        if (cs) {
            var hpPct = cs.maxHp > 0 ? cs.hp / cs.maxHp : 0;
            var hpClr = hpPct > 0.6 ? 'ftp-val-ok' : hpPct > 0.3 ? 'ftp-val-warn' : 'ftp-val-bad';
            e['ftp-cs-hp'].textContent  = Math.ceil(cs.hp) + '/' + cs.maxHp;
            e['ftp-cs-hp'].className    = 'ftp-val ' + hpClr;
        } else {
            e['ftp-cs-hp'].textContent = '--';
        }
        e['ftp-cs-fb'].textContent      = (nearNPC.faction||'?') + ' · ' + (nearNPC.behavior||'?');
        e['ftp-cs-aistate'].textContent = nearNPC.aiState || (nearNPC.inCombat ? 'combat' : 'idle');
        e['ftp-cs-smstate'].textContent = nearNPC.stateMachine ? (nearNPC.stateMachine.currentState||'--') : '--';
        if (nearNPC.weapon && nearNPC.weapon.isAttacking) {
            var npi = nearNPC.weapon.getPhaseInfo();
            e['ftp-cs-wphase'].textContent = npi.name + ' t=' + npi.t.toFixed(2);
            e['ftp-cs-wphase'].className   = 'ftp-val ftp-val-warn';
        } else {
            e['ftp-cs-wphase'].textContent = 'idle';
            e['ftp-cs-wphase'].className   = 'ftp-val ftp-val-dim';
        }
        e['ftp-cs-dist'].textContent = dist + ' px';
    } else {
        ['ftp-cs-name','ftp-cs-hp','ftp-cs-fb','ftp-cs-aistate',
         'ftp-cs-smstate','ftp-cs-wphase','ftp-cs-dist'].forEach(function(id) {
            e[id].textContent = '--';
        });
    }

    /* ── Player Stats ── */
    if (p && p.combatStats) {
        var pcs = p.combatStats;
        var hpPct = pcs.maxHp > 0 ? pcs.hp / pcs.maxHp : 0;
        var hpClr = hpPct > 0.6 ? 'ftp-val-ok' : hpPct > 0.3 ? 'ftp-val-warn' : 'ftp-val-bad';
        e['ftp-p-hp'].textContent = Math.ceil(pcs.hp) + '/' + pcs.maxHp;
        e['ftp-p-hp'].className = 'ftp-val ' + hpClr;

        var mpVal = pcs.mp || 0;
        var mpMax = pcs.maxMp || 100;
        e['ftp-p-mp'].textContent = mpVal + '/' + mpMax;
        e['ftp-p-mp'].className = 'ftp-val ' + (mpVal > mpMax * 0.3 ? '' : 'ftp-val-warn');

        // Level/XP
        var xpData = eng.experienceManager ? eng.experienceManager.getEntityData(p.id) : null;
        if (xpData) {
            e['ftp-p-lvl'].textContent = 'Lv ' + xpData.level;
            var xpForNext = eng.experienceManager.getXPForLevel(xpData.level + 1);
            var xpInLevel = eng.experienceManager.getXPForLevel(xpData.level);
            var xpNeeded = xpForNext - xpInLevel;
            var xpProgress = xpData.xp - xpInLevel;
            var xpPct = xpNeeded > 0 ? Math.floor((xpProgress / xpNeeded) * 100) : 0;
            e['ftp-p-xp'].textContent = xpData.xp + ' (' + xpPct + '% to ' + (xpData.level + 1) + ')';
        } else {
            e['ftp-p-lvl'].textContent = '--';
            e['ftp-p-xp'].textContent = '--';
        }

        // Gold/Inventory
        if (eng.inventoryManager) {
            e['ftp-p-gold'].textContent = eng.inventoryManager.gold;
            e['ftp-p-inv'].textContent = eng.inventoryManager.getTotalItems() + '/' + eng.inventoryManager.maxSlots;
        } else {
            e['ftp-p-gold'].textContent = '--';
            e['ftp-p-inv'].textContent = '--';
        }

        // Status effects count
        if (eng.statusEffectManager) {
            var effects = eng.statusEffectManager.getEffects(p.id);
            var harmful = 0, beneficial = 0;
            for (var ei = 0; ei < effects.length; ei++) {
                if (effects[ei].harmful) harmful++;
                else beneficial++;
            }
            e['ftp-p-fx'].textContent = (harmful > 0 ? harmful + ' bad' : '') + (beneficial > 0 ? (harmful > 0 ? ' ' : '') + beneficial + ' buff' : '') || 'none';
            e['ftp-p-fx'].className = 'ftp-val ' + (harmful > 0 ? 'ftp-val-bad' : beneficial > 0 ? 'ftp-val-ok' : '');
        } else {
            e['ftp-p-fx'].textContent = '--';
        }
    } else {
        ['ftp-p-hp','ftp-p-mp','ftp-p-lvl','ftp-p-xp','ftp-p-gold','ftp-p-inv','ftp-p-fx'].forEach(function(id) {
            e[id].textContent = '--';
        });
    }

    /* ── Consumables Count ── */
    if (eng.inventoryManager) {
        var hpPots = eng.inventoryManager.findByType('potion_health');
        var mpPots = eng.inventoryManager.findByType('potion_mana');
        var hpCount = hpPots ? hpPots.reduce(function(s, i) { return s + (i.item.quantity || 1); }, 0) : 0;
        var mpCount = mpPots ? mpPots.reduce(function(s, i) { return s + (i.item.quantity || 1); }, 0) : 0;
        e['ftp-cons-count'].textContent = 'HP:' + hpCount + ' MP:' + mpCount;

        var harmfulCount = 0;
        if (p && eng.statusEffectManager) {
            var fx = eng.statusEffectManager.getEffects(p.id);
            for (var fi = 0; fi < fx.length; fi++) {
                if (fx[fi].harmful) harmfulCount++;
            }
        }
        e['ftp-cons-harmful'].textContent = harmfulCount;
    } else {
        e['ftp-cons-count'].textContent = '--';
        e['ftp-cons-harmful'].textContent = '--';
    }

    /* ── Threat Table ── */
    if (eng.threatManager && nearNPC) {
        var threatTable = eng.threatManager.getThreatTable(nearNPC.id);
        var threatCount = threatTable ? threatTable.size : 0;
        e['ftp-threat-count'].textContent = threatCount + (threatCount === 1 ? ' entry' : ' entries');
        var topTarget = eng.threatManager.getHighestThreatTarget(nearNPC.id);
        e['ftp-threat-top'].textContent = topTarget ? topTarget.substr(0, 12) : '--';
    } else {
        e['ftp-threat-count'].textContent = '0 entries';
        e['ftp-threat-top'].textContent = '--';
    }

    /* ── XP Display ── */
    if (p && eng.experienceManager) {
        var xpData = eng.experienceManager.getEntityData(p.id);
        if (xpData) {
            e['ftp-xp-val'].textContent = xpData.xp;
            e['ftp-xp-lvl'].textContent = xpData.level;
            var xpForNext = eng.experienceManager.getXPForLevel(xpData.level + 1);
            var xpForCurrent = eng.experienceManager.getXPForLevel(xpData.level);
            var needed = xpForNext - xpForCurrent;
            var progress = xpData.xp - xpForCurrent;
            e['ftp-xp-next'].textContent = progress + '/' + needed;
        } else {
            e['ftp-xp-val'].textContent = '--';
            e['ftp-xp-lvl'].textContent = '--';
            e['ftp-xp-next'].textContent = '--';
        }
    } else {
        e['ftp-xp-val'].textContent = '--';
        e['ftp-xp-lvl'].textContent = '--';
        e['ftp-xp-next'].textContent = '--';
    }

    /* ── Entity Counts ── */
    if (eng.entityManager) {
        var allEntities = eng.entityManager.entities || [];
        var npcEntities = eng.entityManager.getByType('npc') || [];
        e['ftp-ent-count'].textContent = allEntities.length;
        e['ftp-npc-count'].textContent = npcEntities.length;
    } else {
        e['ftp-ent-count'].textContent = '--';
        e['ftp-npc-count'].textContent = '--';
    }

    /* ── Particle Count ── */
    if (eng.particles) {
        e['ftp-part-count'].textContent = eng.particles.count();
    } else {
        e['ftp-part-count'].textContent = '--';
    }

    /* ── Projectile Count ── */
    if (eng.projectileSystem) {
        e['ftp-proj-count'].textContent = eng.projectileSystem.count();
    } else {
        e['ftp-proj-count'].textContent = '--';
    }

    /* ── Tile Info ── */
    if (p && eng.tileMap) {
        var tx = Math.floor(p.x / eng.tileMap.tileWidth);
        var ty = Math.floor(p.y / eng.tileMap.tileHeight);
        e['ftp-tile-pos'].textContent = tx + ', ' + ty;
        
        if (tx >= 0 && tx < eng.tileMap.width && ty >= 0 && ty < eng.tileMap.height) {
            var idx = ty * eng.tileMap.width + tx;
            var tileType = eng.tileMap.layers && eng.tileMap.layers[0] ? eng.tileMap.layers[0].data[idx] : -1;
            var tileNames = ['Deep Water','Shallow Water','Beach','Grass','Grass 2','Dirt','Stone','Cliff','Mountain','Snow','Road H','Road V','Road Corner','Bridge H','Bridge V','Waterfall','Ruin Floor','Ruin Wall','Bldg Floor','Bldg Wall','Door','Tree','Bush','Rock','Chest','Forest','Swamp','Desert','Tundra','Wetland','Meadow','Ancient'];
            e['ftp-tile-type'].textContent = tileNames[tileType] || ('ID ' + tileType);
            
            var collision = eng.tileMap.collisionData ? (eng.tileMap.collisionData[idx] ? 'YES' : 'NO') : 'unknown';
            e['ftp-tile-col'].textContent = collision;
        } else {
            e['ftp-tile-type'].textContent = 'OOB';
            e['ftp-tile-col'].textContent = '--';
        }
    } else {
        e['ftp-tile-pos'].textContent = '--';
        e['ftp-tile-type'].textContent = '--';
        e['ftp-tile-col'].textContent = '--';
    }

    /* ── System Status ── */
    e['ftp-sys-combat'].textContent = eng.combatSystem ? 'OK' : 'MISSING';
    e['ftp-sys-combat'].className = 'ftp-val ' + (eng.combatSystem ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-status'].textContent = eng.statusEffectManager ? 'OK' : 'MISSING';
    e['ftp-sys-status'].className = 'ftp-val ' + (eng.statusEffectManager ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-threat'].textContent = eng.threatManager ? 'OK' : 'MISSING';
    e['ftp-sys-threat'].className = 'ftp-val ' + (eng.threatManager ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-xp'].textContent = eng.experienceManager ? 'OK' : 'MISSING';
    e['ftp-sys-xp'].className = 'ftp-val ' + (eng.experienceManager ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-inv'].textContent = eng.inventoryManager ? 'OK' : 'MISSING';
    e['ftp-sys-inv'].className = 'ftp-val ' + (eng.inventoryManager ? 'ftp-val-ok' : 'ftp-val-bad');
    if (eng.audio && eng.audio._ctx) {
        e['ftp-sys-audio'].textContent = eng.audio._ctx.state;
        e['ftp-sys-audio'].className = 'ftp-val ' + (eng.audio._ctx.state === 'running' ? 'ftp-val-ok' : 'ftp-val-warn');
    } else {
        e['ftp-sys-audio'].textContent = 'N/A';
        e['ftp-sys-audio'].className = 'ftp-val';
    }

    /* ── New Systems Status ── */
    e['ftp-sys-fade'].textContent = eng.fadeTransition ? 'OK' : 'MISSING';
    e['ftp-sys-fade'].className = 'ftp-val ' + (eng.fadeTransition ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-weather'].textContent = eng.weatherSystem ? 'OK' : 'MISSING';
    e['ftp-sys-weather'].className = 'ftp-val ' + (eng.weatherSystem ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-quad'].textContent = eng.quadtree ? 'OK' : 'N/A';
    e['ftp-sys-quad'].className = 'ftp-val ' + (eng.quadtree ? 'ftp-val-ok' : 'ftp-val');
    e['ftp-sys-path'].textContent = eng.pathfinding ? 'OK' : 'N/A';
    e['ftp-sys-path'].className = 'ftp-val ' + (eng.pathfinding ? 'ftp-val-ok' : 'ftp-val');
    e['ftp-sys-save'].textContent = eng.saveManager ? 'OK' : 'MISSING';
    e['ftp-sys-save'].className = 'ftp-val ' + (eng.saveManager ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-dialog'].textContent = eng.dialogueSystem ? 'OK' : 'MISSING';
    e['ftp-sys-dialog'].className = 'ftp-val ' + (eng.dialogueSystem ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-achieve'].textContent = eng.achievementSystem ? 'OK' : 'MISSING';
    e['ftp-sys-achieve'].className = 'ftp-val ' + (eng.achievementSystem ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-quest'].textContent = eng.questSystem ? 'OK' : 'MISSING';
    e['ftp-sys-quest'].className = 'ftp-val ' + (eng.questSystem ? 'ftp-val-ok' : 'ftp-val-bad');
    e['ftp-sys-spawner'].textContent = eng.npcSpawner ? 'OK' : 'MISSING';
    e['ftp-sys-spawner'].className = 'ftp-val ' + (eng.npcSpawner ? 'ftp-val-ok' : 'ftp-val-bad');

    /* ── Night Spawner Status ── */
    this._updateNightSpawnerStatus();

    /* ── Fade Status ── */
    if (eng.fadeTransition) {
        e['ftp-fade-out'].disabled = eng.fadeTransition.isTransitioning();
    }

    /* ── Weather Status ── */
    if (eng.weatherSystem) {
        var wInfo = eng.weatherSystem.getWeatherInfo();
        e['ftp-w-type'].textContent = wInfo.type;
        e['ftp-w-count'].textContent = eng.weatherSystem.getParticleCount();
    } else {
        e['ftp-w-type'].textContent = '--';
        e['ftp-w-count'].textContent = '--';
    }

    /* ── Save Status ── */
    if (eng.saveManager) {
        var slotInfo = eng.saveManager.getSlotInfo(0);
        e['ftp-save-slot0'].textContent = slotInfo ? new Date(slotInfo.timestamp).toLocaleTimeString() : 'empty';
    } else {
        e['ftp-save-slot0'].textContent = '--';
    }

    /* ── Quest Status ── */
    if (eng.questSystem) {
        e['ftp-q-active'].textContent = eng.questSystem.activeQuests.length;
        e['ftp-q-done'].textContent = eng.questSystem.completedQuests.length;
    } else {
        e['ftp-q-active'].textContent = '--';
        e['ftp-q-done'].textContent = '--';
    }

    /* ── Achievement Status ── */
    if (eng.achievementSystem) {
        e['ftp-ach-count'].textContent = eng.achievementSystem.getUnlocked().length;
    } else {
        e['ftp-ach-count'].textContent = '--';
    }

    /* ── XP/Level Status ── */
    if (eng.experienceManager && eng.player) {
        var xpData = eng.experienceManager.getXP(eng.player.id);
        if (xpData) {
            e['ftp-ach-level'].textContent = xpData.level;
            e['ftp-ach-xp'].textContent = xpData.totalXp;
        }
    } else {
        e['ftp-ach-level'].textContent = '--';
        e['ftp-ach-xp'].textContent = '--';
    }

    /* ── Story Builder Status ── */
    this._updateStoryBuilder();

    /* ── Combat Log (mirror from HUDSystem) ── */
    this._syncCombatLog();
};

RealmKit.FeatureTestPanel.prototype._syncCombatLog = function() {
    var eng = this.engine;
    var el  = this._e['rk-ftp-combatlog'];
    if (!el || !eng.hudSystem || !eng.hudSystem.elements) return;

    // HUDSystem stores entries at elements.get('combatlog').entries
    var log = eng.hudSystem.elements.get('combatlog');
    if (!log || !log.entries) return;
    var entries = log.entries;
    if (entries.length === this._lastCombatLogLen) return;
    this._lastCombatLogLen = entries.length;

    var clsMap = {
        player: 'ftp-log-combat', kill: 'ftp-log-kill',
        enemy:  'ftp-log-warning', info: 'ftp-log-info'
    };
    var html = '';
    for (var i = entries.length - 1; i >= 0; i--) {
        var entry = entries[i];
        // entry.time is already a locale time string e.g. "3:04:05 PM"
        var ts = typeof entry.time === 'string' ? entry.time.split(' ')[0] : '';
        var cls = clsMap[entry.type] || 'ftp-log-info';
        html += '<div class="ftp-log-entry">' +
            '<span class="ftp-log-ts">' + ts + '</span>' +
            '<span class="ftp-log-msg ' + cls + '">' + (entry.message || '') + '</span>' +
            '</div>';
    }
    el.innerHTML = html;
};

RealmKit.FeatureTestPanel.prototype._updateStoryBuilder = function() {
    var eng = this.engine;
    var e = this._e;
    
    if (!eng.storyBuilder) {
        e['ftp-sb-story'].textContent = 'N/A';
        e['ftp-sb-story'].className = 'ftp-val ftp-val-dim';
        e['ftp-sb-factions'].textContent = '--';
        e['ftp-sb-chars'].textContent = '--';
        e['ftp-sb-dialogues'].textContent = '--';
        e['ftp-sb-quests'].textContent = '--';
        e['ftp-sb-scenes'].textContent = '--';
        return;
    }
    
    var sb = eng.storyBuilder;
    var story = sb.storyData;
    
    if (story) {
        e['ftp-sb-story'].textContent = story.title || 'Untitled';
        e['ftp-sb-story'].className = 'ftp-val ftp-val-hi';
        e['ftp-sb-factions'].textContent = (story.factions || []).length;
        e['ftp-sb-chars'].textContent = (story.characters || []).length;
        e['ftp-sb-dialogues'].textContent = (story.dialogues || []).length;
        e['ftp-sb-quests'].textContent = (story.quests || []).length;
        e['ftp-sb-scenes'].textContent = (story.scenes || []).length;
    } else {
        e['ftp-sb-story'].textContent = 'No story loaded';
        e['ftp-sb-story'].className = 'ftp-val';
        e['ftp-sb-factions'].textContent = '--';
        e['ftp-sb-chars'].textContent = '--';
        e['ftp-sb-dialogues'].textContent = '--';
        e['ftp-sb-quests'].textContent = '--';
        e['ftp-sb-scenes'].textContent = '--';
    }
};

// ─── Spawner Methods ─────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._spawnMonster = function(templateId) {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player to spawn near', 'error');
        return;
    }
    
    if (!RealmKit.MonsterTemplateManager) {
        this.logEvent('MonsterTemplateManager not loaded', 'error');
        return;
    }
    
    var mgr = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
    
    if (!eng.spawnerManager) {
        eng.spawnerManager = new RealmKit.SpawnerManager({ templateManager: mgr });
        eng.spawnerManager.setEntityManager(eng.entityManager);
        console.log('[FeatureTestPanel] Created SpawnerManager');
    }
    
    var spawner = eng.spawnerManager.createSpawner({
        id: 'test_' + templateId + '_' + Date.now(),
        x: eng.player.x + (Math.random() - 0.5) * 200,
        y: eng.player.y + (Math.random() - 0.5) * 200,
        radius: 50,
        maxActive: 1,
        minActive: 0,
        spawnOnStart: false
    });
    
    spawner.addToSpawnPool(templateId, 1);
    
    var entity = spawner.spawn(eng.entityManager, mgr);
    
    if (entity) {
        this.logEvent('Spawned ' + templateId + ' (' + entity.id + ')', 'info');
    } else {
        this.logEvent('Failed to spawn ' + templateId, 'error');
    }
    
    this._updateSpawners();
};

RealmKit.FeatureTestPanel.prototype._spawnArea = function(count) {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player to spawn near', 'error');
        return;
    }
    
    if (!RealmKit.MonsterTemplateManager) {
        this.logEvent('MonsterTemplateManager not loaded', 'error');
        return;
    }
    
    var mgr = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
    
    if (!eng.spawnerManager) {
        eng.spawnerManager = new RealmKit.SpawnerManager({ templateManager: mgr });
        eng.spawnerManager.setEntityManager(eng.entityManager);
    }
    
    var templates = ['goblin_scout', 'skeleton', 'wolf'];
    var spawner = eng.spawnerManager.createSpawner({
        id: 'area_spawn_' + Date.now(),
        x: eng.player.x,
        y: eng.player.y,
        radius: 150,
        maxActive: count,
        minActive: count,
        spawnOnStart: false
    });
    
    for (var i = 0; i < count; i++) {
        var tpl = templates[i % templates.length];
        spawner.addToSpawnPool(tpl, 1);
    }
    
    spawner.spawnOnStart = true;
    spawner.initialSpawn(eng.entityManager, mgr);
    
    this.logEvent('Spawned area with ' + count + ' monsters', 'info');
    this._updateSpawners();
};

RealmKit.FeatureTestPanel.prototype._clearSpawners = function() {
    var eng = this.engine;
    
    if (eng.spawnerManager) {
        var stats = eng.spawnerManager.getStats();
        var killed = 0;
        
        for (var i = 0; i < eng.spawnerManager.spawners.length; i++) {
            var spawner = eng.spawnerManager.spawners[i];
            for (var j = 0; j < spawner.activeEntities.length; j++) {
                var ent = spawner.activeEntities[j].entity;
                if (ent && !ent.dead && ent.hp > 0) {
                    ent.hp = 0;
                    ent.dead = true;
                    killed++;
                }
            }
        }
        
        eng.spawnerManager.clear();
        this.logEvent('Cleared spawners, killed ' + killed + ' entities', 'system');
    }
    
    this._updateSpawners();
};

RealmKit.FeatureTestPanel.prototype._updateSpawners = function() {
    var eng = this.engine;
    var e = this._e;
    
    if (!eng.spawnerManager) {
        e['ftp-spawn-count'].textContent = '0';
        e['ftp-spawn-active'].textContent = '0';
        e['ftp-spawn-killed'].textContent = '0';
        return;
    }
    
    var stats = eng.spawnerManager.getStats();
    e['ftp-spawn-count'].textContent = stats.totalSpawners;
    e['ftp-spawn-active'].textContent = stats.totalActive;
    e['ftp-spawn-killed'].textContent = stats.totalKilled;
};

// ─── Trigger Methods ──────────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._testTriggerEnter = function() {
    var eng = this.engine;
    
    if (!eng.triggerSystem) {
        eng.triggerSystem = new RealmKit.TriggerSystem();
        console.log('[FeatureTestPanel] Created TriggerSystem');
    }
    
    for (var i = 0; i < eng.triggerSystem.triggers.length; i++) {
        var trigger = eng.triggerSystem.triggers[i];
        if (trigger.containsPoint(eng.player.x, eng.player.y)) {
            this.logEvent('Player in trigger zone: ' + trigger.id, 'info');
            return;
        }
    }
    
    this.logEvent('Player not in any trigger zone', 'warning');
};

RealmKit.FeatureTestPanel.prototype._testTriggerExit = function() {
    this.logEvent('Trigger exit check (would fire on_exit triggers)', 'info');
};

RealmKit.FeatureTestPanel.prototype._createTestTrigger = function() {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player to create trigger near', 'error');
        return;
    }
    
    if (!eng.triggerSystem) {
        eng.triggerSystem = new RealmKit.TriggerSystem();
    }
    
    var trigger = eng.triggerSystem.createTrigger({
        id: 'test_trigger_' + Date.now(),
        name: 'Test Trigger',
        type: 'on_enter',
        shape: 'circle',
        x: eng.player.x - 50,
        y: eng.player.y - 50,
        radius: 80,
        triggerOnce: false,
        cooldown: 5000,
        actions: [
            {
                type: 'message',
                text: 'Trigger activated! You entered the zone.',
                style: 'warning'
            },
            {
                type: 'giveXP',
                amount: 25
            }
        ]
    });
    
    this.logEvent('Created trigger: ' + trigger.id + ' at player position', 'info');
    this._updateTriggers();
};

RealmKit.FeatureTestPanel.prototype._clearTriggers = function() {
    var eng = this.engine;
    
    if (eng.triggerSystem) {
        var count = eng.triggerSystem.triggers.length;
        eng.triggerSystem.clear();
        this.logEvent('Cleared ' + count + ' triggers', 'system');
    }
    
    this._updateTriggers();
};

RealmKit.FeatureTestPanel.prototype._updateTriggers = function() {
    var eng = this.engine;
    var e = this._e;
    
    if (!eng.triggerSystem) {
        e['ftp-trig-count'].textContent = '0';
        e['ftp-trig-inzone'].textContent = '0';
        return;
    }
    
    e['ftp-trig-count'].textContent = eng.triggerSystem.triggers.length;
    
    var inZone = 0;
    if (eng.player) {
        for (var i = 0; i < eng.triggerSystem.triggers.length; i++) {
            if (eng.triggerSystem.triggers[i].containsPoint(eng.player.x, eng.player.y)) {
                inZone++;
            }
        }
    }
    e['ftp-trig-inzone'].textContent = inZone;
};

// Spawner/Trigger update loop integration
RealmKit.FeatureTestPanel.prototype._updateSpawnerTrigger = function() {
    var eng = this.engine;
    
    if (eng.spawnerManager) {
        eng.spawnerManager.update(16);
    }
    
    if (eng.triggerSystem && eng.player) {
        eng.triggerSystem.updatePositions([eng.player], { engine: eng, player: eng.player });
    }
    
    this._updateSpawners();
    this._updateTriggers();
    this._updateNightSpawnerStatus();
    this._updateScheduleStatus();
};

RealmKit.FeatureTestPanel.prototype._updateNightSpawnerStatus = function() {
    var eng = this.engine;
    var e = this._e;
    
    if (!eng.dayNight) {
        e['ftp-night-time'].textContent = '--';
        e['ftp-night-phase'].textContent = '--';
        e['ftp-night-ok'].textContent = '--';
        return;
    }
    
    var time = eng.dayNight.time;
    var phase = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.getTimeOfDay(time) : 'unknown';
    var hour = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.getHour(time) : Math.floor(time / 3600);
    var isNight = phase === 'night' || phase === 'midnight' || phase === 'pre_dawn';
    
    e['ftp-night-time'].textContent = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.formatTime(time) : hour + ':00';
    e['ftp-night-phase'].textContent = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.getPhaseLabel(time) : phase;
    e['ftp-night-ok'].textContent = isNight ? 'YES' : 'NO';
    e['ftp-night-ok'].className = 'ftp-val ' + (isNight ? 'ftp-val-ok' : 'ftp-val-warn');
};

RealmKit.FeatureTestPanel.prototype._updateScheduleStatus = function() {
    var eng = this.engine;
    var e = this._e;
    
    var nearNPC = this._nearestNPC();
    
    if (!nearNPC) {
        e['ftp-sched-npc'].textContent = '--';
        e['ftp-sched-type'].textContent = '--';
        e['ftp-sched-action'].textContent = '--';
        return;
    }
    
    e['ftp-sched-npc'].textContent = nearNPC.name || nearNPC.id;
    e['ftp-sched-type'].textContent = nearNPC.schedulePreset || 'custom';
    
    if (nearNPC.schedule && eng.dayNight) {
        var behavior = nearNPC.schedule.getBehavior(eng.dayNight.time);
        e['ftp-sched-action'].textContent = behavior.action + ' @ ' + behavior.location;
    } else {
        e['ftp-sched-action'].textContent = nearNPC.behavior || '--';
    }
};

// ─── Night Spawner Methods ─────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._spawnNightOnly = function() {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player to spawn near', 'error');
        return;
    }
    
    if (!RealmKit.MonsterTemplateManager) {
        this.logEvent('MonsterTemplateManager not loaded', 'error');
        return;
    }
    
    var mgr = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
    
    if (!eng.spawnerManager) {
        eng.spawnerManager = new RealmKit.SpawnerManager({ templateManager: mgr });
        eng.spawnerManager.setEntityManager(eng.entityManager);
    }
    
    var timeOfDay = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.getTimeOfDay(eng.dayNight.time) : 'night';
    var canSpawn = (timeOfDay === 'night' || timeOfDay === 'midnight' || timeOfDay === 'pre_dawn');
    
    if (!canSpawn) {
        this.logEvent('Blocked: not night time (current: ' + timeOfDay + ')', 'warning');
        this.logEvent('Set time to midnight to allow spawn', 'info');
    }
    
    var spawner = eng.spawnerManager.createSpawner({
        id: 'night_only_' + Date.now(),
        x: eng.player.x + (Math.random() - 0.5) * 200,
        y: eng.player.y + (Math.random() - 0.5) * 200,
        radius: 50,
        maxActive: 1,
        minActive: 0,
        spawnOnStart: false,
        spawnConditions: {
            timeOfDay: ['night', 'midnight', 'pre_dawn']
        }
    });
    
    spawner.addToSpawnPool('skeleton', 1);
    
    if (canSpawn) {
        var entity = spawner.spawn(eng.entityManager, mgr);
        if (entity) {
            this.logEvent('Night spawner created, spawned: ' + entity.id, 'info');
        } else {
            this.logEvent('Night spawner created but spawn blocked', 'warning');
        }
    } else {
        this.logEvent('Night spawner created (will spawn at night)', 'info');
    }
    
    this._updateSpawners();
};

RealmKit.FeatureTestPanel.prototype._spawnNightSkeleton = function() {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player', 'error');
        return;
    }
    
    if (!RealmKit.MonsterTemplateManager) {
        this.logEvent('MonsterTemplateManager not loaded', 'error');
        return;
    }
    
    var mgr = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
    
    if (!eng.spawnerManager) {
        eng.spawnerManager = new RealmKit.SpawnerManager({ templateManager: mgr });
        eng.spawnerManager.setEntityManager(eng.entityManager);
    }
    
    var timeOfDay = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.getTimeOfDay(eng.dayNight.time) : 'unknown';
    var timeOk = (timeOfDay === 'night' || timeOfDay === 'midnight' || timeOfDay === 'pre_dawn');
    
    if (!timeOk) {
        this.logEvent('Cannot spawn skeleton: time is ' + timeOfDay + ' (need night)', 'warning');
        this.logEvent('Click "SET MIDNIGHT" then try again', 'info');
        return;
    }
    
    var spawner = eng.spawnerManager.createSpawner({
        id: 'night_skeleton_' + Date.now(),
        x: eng.player.x + (Math.random() - 0.5) * 200,
        y: eng.player.y + (Math.random() - 0.5) * 200,
        radius: 50,
        maxActive: 1,
        minActive: 0,
        spawnOnStart: false,
        spawnConditions: {
            timeOfDay: ['night', 'midnight', 'pre_dawn']
        }
    });
    
    spawner.addToSpawnPool('skeleton', 1);
    
    var entity = spawner.spawn(eng.entityManager, mgr);
    if (entity) {
        this.logEvent('Spawned skeleton at night: ' + entity.id, 'info');
    }
    
    this._updateSpawners();
};

RealmKit.FeatureTestPanel.prototype._spawnDungeonSpawner = function() {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player', 'error');
        return;
    }
    
    if (!RealmKit.MonsterTemplateManager) {
        this.logEvent('MonsterTemplateManager not loaded', 'error');
        return;
    }
    
    var mgr = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
    
    if (!eng.spawnerManager) {
        eng.spawnerManager = new RealmKit.SpawnerManager({ templateManager: mgr });
        eng.spawnerManager.setEntityManager(eng.entityManager);
    }
    
    var spawner = eng.spawnerManager.createSpawner({
        id: 'dungeon_' + Date.now(),
        x: eng.player.x + (Math.random() - 0.5) * 200,
        y: eng.player.y + (Math.random() - 0.5) * 200,
        radius: 100,
        maxActive: 3,
        minActive: 2,
        spawnOnStart: true,
        spawnConditions: {
            timeOfDay: ['night', 'midnight', 'pre_dawn', 'dungeon']
        }
    });
    
    spawner.addToSpawnPool('skeleton', 3);
    spawner.addToSpawnPool('dark_mage', 1);
    
    this.logEvent('Dungeon spawner created (skeleton + dark_mage)', 'info');
    
    spawner.initialSpawn(eng.entityManager, mgr);
    this._updateSpawners();
};

RealmKit.FeatureTestPanel.prototype._spawnNightBoss = function() {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player', 'error');
        return;
    }
    
    if (!RealmKit.MonsterTemplateManager) {
        this.logEvent('MonsterTemplateManager not loaded', 'error');
        return;
    }
    
    var mgr = RealmKit.monsterTemplateManager || new RealmKit.MonsterTemplateManager();
    
    if (!eng.spawnerManager) {
        eng.spawnerManager = new RealmKit.SpawnerManager({ templateManager: mgr });
        eng.spawnerManager.setEntityManager(eng.entityManager);
    }
    
    var timeOfDay = RealmKit.TimeOfDay ? RealmKit.TimeOfDay.getTimeOfDay(eng.dayNight.time) : 'unknown';
    var timeOk = (timeOfDay === 'night' || timeOfDay === 'midnight' || timeOfDay === 'pre_dawn');
    
    if (!timeOk) {
        this.logEvent('Cannot spawn boss: time is ' + timeOfDay + ' (need night)', 'warning');
        this.logEvent('Click "SET MIDNIGHT" then try again', 'info');
        return;
    }
    
    var spawner = eng.spawnerManager.createSpawner({
        id: 'boss_night_' + Date.now(),
        x: eng.player.x + (Math.random() - 0.5) * 300,
        y: eng.player.y + (Math.random() - 0.5) * 300,
        radius: 150,
        maxActive: 1,
        minActive: 0,
        spawnOnStart: false,
        oneTime: true,
        spawnConditions: {
            timeOfDay: ['night', 'midnight']
        }
    });
    
    spawner.addToSpawnPool('boss_goblin_king', 1);
    
    var entity = spawner.spawn(eng.entityManager, mgr);
    if (entity) {
        this.logEvent('SPAWNED NIGHT BOSS: ' + entity.id, 'kill');
    }
    
    this._updateSpawners();
};

// ─── NPC Schedule Methods ───────────────────────────────────────────────────────
RealmKit.FeatureTestPanel.prototype._spawnScheduledNPC = function(presetName) {
    var eng = this.engine;
    var self = this;
    
    if (!eng.player) {
        this.logEvent('No player', 'error');
        return;
    }
    
    if (!RealmKit.NPC) {
        this.logEvent('NPC class not loaded', 'error');
        return;
    }
    
    var presetNames = {
        merchant: 'Merchant',
        guard: 'Guard', 
        villager: 'Villager',
        night_guard: 'Night Guard',
        innkeeper: 'Innkeeper',
        blacksmith: 'Blacksmith',
        wizard: 'Wizard',
        farmer: 'Farmer',
        traveler: 'Traveler'
    };
    
    var defaultBehaviors = {
        merchant: 'wander',
        guard: 'patrol',
        villager: 'wander',
        night_guard: 'patrol',
        innkeeper: 'idle',
        blacksmith: 'wander',
        wizard: 'idle',
        farmer: 'wander',
        traveler: 'wander'
    };
    
    var npc = new RealmKit.NPC({
        id: 'sched_' + presetName + '_' + Date.now(),
        name: presetNames[presetName] || 'NPC',
        x: eng.player.x + (Math.random() - 0.5) * 100,
        y: eng.player.y + (Math.random() - 0.5) * 100,
        width: 32,
        height: 48,
        behavior: defaultBehaviors[presetName] || 'wander',
        schedulePreset: presetName,
        scheduleLocations: {
            home: { x: eng.player.x, y: eng.player.y },
            shop: { x: eng.player.x + 50, y: eng.player.y },
            tavern: { x: eng.player.x - 50, y: eng.player.y },
            barracks: { x: eng.player.x, y: eng.player.y + 50 },
            forge: { x: eng.player.x + 100, y: eng.player.y },
            tower: { x: eng.player.x - 100, y: eng.player.y },
            farm: { x: eng.player.x + 50, y: eng.player.y + 50 },
            inn: { x: eng.player.x, y: eng.player.y - 50 },
            square: { x: eng.player.x, y: eng.player.y },
            road: { x: eng.player.x, y: eng.player.y },
            route: [
                { x: eng.player.x, y: eng.player.y },
                { x: eng.player.x + 100, y: eng.player.y },
                { x: eng.player.x + 100, y: eng.player.y + 100 },
                { x: eng.player.x, y: eng.player.y + 100 }
            ]
        },
        wanderRadius: 60,
        stats: { hp: 30, maxHp: 30, attack: 8, defense: 4, speed: 70 },
        faction: (presetName === 'guard' || presetName === 'night_guard') ? 'friendly' : 'neutral'
    });
    
    if (eng.combatSystem) {
        npc.combatStats = eng.combatSystem.registerEntity(npc, npc.stats);
    }
    
    eng.entityManager.add(npc);
    
    var phase = RealmKit.NPCSchedule && eng.dayNight ? RealmKit.NPCSchedule.getPhase(eng.dayNight.time) : 'unknown';
    
    this.logEvent('Spawned ' + presetNames[presetName] + ' (preset: ' + presetName + ')', 'info');
    
    if (npc.schedule) {
        var behavior = npc.schedule.getBehavior(eng.dayNight.time);
        this.logEvent('Phase: ' + phase + ' → ' + behavior.action + ' @ ' + behavior.location, 'info');
    }
};

RealmKit.FeatureTestPanel.prototype._clearScheduleOverride = function() {
    var eng = this.engine;
    var nearNPC = this._nearestNPC();
    
    if (!nearNPC) {
        this.logEvent('No NPC nearby', 'warning');
        return;
    }
    
    if (nearNPC.schedule) {
        nearNPC.schedule.clearAllOverrides();
        nearNPC.scheduleOverride = false;
        this.logEvent('Cleared schedule override for ' + (nearNPC.name || nearNPC.id), 'system');
    } else {
        this.logEvent('NPC has no schedule', 'warning');
    }
};

console.log('[FeatureTestPanel] Loaded — press F3 to open the Grimoire');
