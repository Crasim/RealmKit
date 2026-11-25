var RealmKit = RealmKit || {};

RealmKit.RealmGameUI = class RealmGameUI {
    constructor(engine) {
        this.engine = engine;
        this.root = null;
        this.refs = {};
        this.codexOpen = false;
        this.pauseOpen = false;
        this.codexTab = 'summary';
        this.selectedHotbarSlot = 0;
        this.selectedInventorySlot = 0;
        this.lastSignature = '';
        this.lastPartySignature = '';
        this.lastSyncAt = 0;
        this._boundResize = null;
    }

    init(containerId) {
        var container = document.getElementById(containerId) || document.body;

        if (!document.getElementById('rgui-style')) {
            this._installStyles();
        }

        this.root = document.createElement('div');
        this.root.id = 'rgui-root';
        this.root.innerHTML = [
            '<div id="rgui-codex" class="rgui-window">',
            '  <div class="rgui-frame-corner rgui-corner-nw"></div>',
            '  <div class="rgui-frame-corner rgui-corner-ne"></div>',
            '  <div class="rgui-frame-corner rgui-corner-sw"></div>',
            '  <div class="rgui-frame-corner rgui-corner-se"></div>',
            '  <div class="rgui-window-inner rgui-codex-inner">',
            '    <button class="rgui-close" data-action="close-codex">Close</button>',
            '    <div class="rgui-crest rgui-window-title"><span class="rgui-crest-gem">◆</span><span class="rgui-crest-label">Character Codex</span><span class="rgui-crest-gem">◆</span></div>',
            '    <div class="rgui-book">',
            '      <section class="rgui-page">',
            '        <div class="rgui-page-head"><span class="rgui-page-line"></span><div class="rgui-page-title">Adventurer</div><span class="rgui-page-line"></span></div>',
            '        <div id="rgui-codex-left" class="rgui-scroll"></div>',
            '      </section>',
            '      <section class="rgui-page rgui-page-notes">',
            '        <div class="rgui-page-head"><span class="rgui-page-line"></span><div class="rgui-page-title" id="rgui-codex-title">Summary</div><span class="rgui-page-line"></span></div>',
            '        <div class="rgui-page-body">',
            '          <div id="rgui-codex-right" class="rgui-scroll"></div>',
            '          <div class="rgui-side-tabs">',
            '            <button class="rgui-tab is-active" data-tab="summary" id="rgui-tab-summary" title="Summary">S</button>',
            '            <button class="rgui-tab" data-tab="gear" id="rgui-tab-gear" title="Backpack">B</button>',
            '            <button class="rgui-tab" data-tab="quests" id="rgui-tab-quests" title="Quests">Q</button>',
            '            <button class="rgui-tab" data-tab="factions" id="rgui-tab-factions" title="Factions">F</button>',
            '            <button class="rgui-tab" data-tab="codex" id="rgui-tab-codex" title="Codex">C</button>',
            '            <button class="rgui-tab" data-tab="magic" id="rgui-tab-magic" title="Magic">M</button>',
            '          </div>',
            '        </div>',
            '      </section>',
            '    </div>',
            '  </div>',
            '</div>',
            '<div id="rgui-dialog" class="rgui-dialog">',
            '  <div class="rgui-frame-corner rgui-corner-nw"></div>',
            '  <div class="rgui-frame-corner rgui-corner-ne"></div>',
            '  <div class="rgui-frame-corner rgui-corner-sw"></div>',
            '  <div class="rgui-frame-corner rgui-corner-se"></div>',
            '  <div class="rgui-window-inner">',
            '    <div class="rgui-crest rgui-window-title rgui-dialog-title" id="rgui-dialog-speaker">Dialogue</div>',
            '    <div id="rgui-dialog-text" class="rgui-dialog-text"></div>',
            '    <div id="rgui-dialog-actions" class="rgui-dialog-actions"></div>',
            '  </div>',
            '</div>',
            '<div id="rgui-backdrop" class="rgui-backdrop"></div>',
            '<div id="rgui-pause" class="rgui-modal">',
            '  <div class="rgui-window-inner rgui-modal-inner">',
            '    <div class="rgui-crest">Camp Menu</div>',
            '    <button class="rgui-btn" data-action="resume">Resume</button>',
            '    <button class="rgui-btn rgui-btn-gold" data-action="save">Save Journey</button>',
            '    <button class="rgui-btn" data-action="open-help">Help</button>',
            '    <button class="rgui-btn" data-action="close-menu">Close</button>',
            '  </div>',
            '</div>',
            '<div id="rgui-help" class="rgui-window">',
            '  <div class="rgui-frame-corner rgui-corner-nw"></div>',
            '  <div class="rgui-frame-corner rgui-corner-ne"></div>',
            '  <div class="rgui-frame-corner rgui-corner-sw"></div>',
            '  <div class="rgui-frame-corner rgui-corner-se"></div>',
            '  <div class="rgui-window-inner rgui-help-inner">',
            '    <button class="rgui-close" data-action="close-help">Close</button>',
            '    <div class="rgui-crest rgui-window-title"><span class="rgui-crest-gem">◆</span><span class="rgui-crest-label">Controls & Key Mappings</span><span class="rgui-crest-gem">◆</span></div>',
            '    <div id="rgui-help-content" class="rgui-scroll rgui-help-content"></div>',
            '  </div>',
            '</div>',
            '<div id="rgui-hud-dock" class="rgui-hud-dock">',
            '  <div id="rgui-partyhud" class="rgui-partyhud"></div>',
            '  <div id="rgui-hud" class="rgui-hud">',
            '    <div class="rgui-frame-corner rgui-corner-nw"></div>',
            '    <div class="rgui-frame-corner rgui-corner-ne"></div>',
            '    <div class="rgui-frame-corner rgui-corner-sw"></div>',
            '    <div class="rgui-frame-corner rgui-corner-se"></div>',
            '    <div class="rgui-crest rgui-window-title rgui-hud-title rgui-hud-crest">Realm Kit</div>',
            '    <div class="rgui-hud-inner">',
            '      <div id="rgui-hotbar" class="rgui-hotbar"></div>',
            '      <div class="rgui-actions">',
            '        <button class="rgui-btn" data-action="open-summary">Codex</button>',
            '        <button class="rgui-btn" data-action="open-menu">Menu</button>',
            '      </div>',
            '      <div id="rgui-effects" class="rgui-effects"></div>',
            '    </div>',
            '    <button class="rgui-fs-btn" data-action="toggle-fullscreen" title="Toggle Fullscreen">⛶</button>',
            '  </div>',
            '</div>'
        ].join('');

        container.appendChild(this.root);

        this.refs.codex = document.getElementById('rgui-codex');
        this.refs.codexLeft = document.getElementById('rgui-codex-left');
        this.refs.codexRight = document.getElementById('rgui-codex-right');
        this.refs.codexTitle = document.getElementById('rgui-codex-title');
        this.refs.dialog = document.getElementById('rgui-dialog');
        this.refs.dialogSpeaker = document.getElementById('rgui-dialog-speaker');
        this.refs.dialogText = document.getElementById('rgui-dialog-text');
        this.refs.dialogActions = document.getElementById('rgui-dialog-actions');
        this.refs.pause = document.getElementById('rgui-pause');
        this.refs.help = document.getElementById('rgui-help');
        this.refs.helpContent = document.getElementById('rgui-help-content');
        this.refs.backdrop = document.getElementById('rgui-backdrop');
        this.refs.partyhud = document.getElementById('rgui-partyhud');
        this.refs.hud = document.getElementById('rgui-hud');
        this.refs.hotbar = document.getElementById('rgui-hotbar');
        this.refs.effects = document.getElementById('rgui-effects');
        this.refs.dock = document.getElementById('rgui-hud-dock');

        this._bindEvents();
        this._bindResize();
        this._suppressLegacyUI();
        this.sync(true);
        return this;
    }

    _installStyles() {
        var style = document.createElement('style');
        style.id = 'rgui-style';
        style.textContent = [
            ':root{--rgui-frame:repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.28) 5px,rgba(80,50,20,.28) 6px),linear-gradient(180deg,#4a2810 0%,#2a1408 50%,#1a0c04 100%);--rgui-paper:radial-gradient(circle at top left,rgba(255,248,228,.35) 0%,rgba(255,248,228,0) 28%),repeating-linear-gradient(0deg,transparent 0px,transparent 3px,rgba(120,90,48,.04) 3px,rgba(120,90,48,.04) 4px),linear-gradient(180deg,#dccba9 0%,#cfbb94 100%);--rgui-paper-edge:#8a7060;--rgui-ink:#2a1408;--rgui-muted:#6a5040;--rgui-card-width:132px;}',
            '#rgui-root{position:absolute;inset:0;pointer-events:none;z-index:350;font-family:"Press Start 2P",monospace;image-rendering:pixelated;}',
            '#hud_combatlog,#quest-tracker,#info-bar,[id^="hud_slot_"],[id^="hud_healthbar_"],[id^="hud_button_"],[id^="hud_text_"]{display:none!important;}',
            '.rgui-window,.rgui-dialog,.rgui-modal,.rgui-party-card,.rgui-hud{position:absolute;pointer-events:auto;background:#2a1408;border:3px solid #1a0800;box-shadow:inset 0 3px 0 rgba(255,200,150,.18),inset 0 -6px 0 rgba(0,0,0,.5),inset 3px 0 0 rgba(255,200,150,.12),inset -3px 0 0 rgba(0,0,0,.28),0 0 0 4px #3a2008,0 12px 22px rgba(0,0,0,.38);}',
            '.rgui-window:before,.rgui-dialog:before,.rgui-modal:before,.rgui-party-card:before,.rgui-hud:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(80,50,20,.38) 5px,rgba(80,50,20,.38) 6px),repeating-linear-gradient(0deg,transparent 0px,transparent 12px,rgba(60,35,15,.22) 12px,rgba(60,35,15,.22) 18px),linear-gradient(180deg,#4a2810 0%,#341808 52%,#261000 100%);pointer-events:none;}',
            '.rgui-window-inner,.rgui-hud-inner,.rgui-party-card-inner{position:relative;z-index:1;margin:var(--rk-inner-inset,5px);border:2px solid var(--rgui-paper-edge);background:radial-gradient(circle at top left,rgba(255,248,228,.42) 0%,rgba(255,248,228,0) 30%),repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(139,90,43,.05) 2px,rgba(139,90,43,.05) 3px),repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(139,90,43,.03) 5px,rgba(139,90,43,.03) 6px),linear-gradient(180deg,#eadbbe 0%,#d8c59f 42%,#cbb790 100%);box-shadow:inset 5px 5px 0 rgba(0,0,0,.08),inset -4px -4px 0 rgba(255,255,255,.18),inset 0 0 18px rgba(0,0,0,.08);}',
            '.rgui-codex-inner{margin:var(--rk-inner-inset,5px);height:calc(100% - var(--rk-inner-offset,10px));padding:18px 16px 14px;display:flex;flex-direction:column;}',
            '.rgui-crest{position:absolute;top:-14px;left:50%;transform:translateX(-50%);padding:4px 14px;background:linear-gradient(180deg,#7f5f2a 0%,#5d4319 100%);border:2px solid #2d1a08;color:#f6e2ae;font-size:6px;letter-spacing:2px;text-transform:uppercase;box-shadow:0 4px 0 #1d1106;z-index:4;}',
            '.rgui-window-title{top:-24px;min-width:228px;padding:5px 18px 4px;display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,#89662a 0%,#6e4e1f 45%,#5b3e16 100%);box-shadow:0 4px 0 #1d1106,0 0 0 2px #3b210a;}',
            '.rgui-window-title:before,.rgui-window-title:after{content:"";position:absolute;top:50%;width:92px;height:5px;background:linear-gradient(90deg,transparent 0%,#6a4020 30%,#5a3010 50%,#6a4020 70%,transparent 100%);opacity:.95;transform:translateY(-50%);}',
            '.rgui-window-title:before{right:100%;margin-right:14px;}',
            '.rgui-window-title:after{left:100%;margin-left:14px;}',
            '.rgui-hud-title{top:-20px;min-width:156px;padding:4px 14px 4px;}',
            '.rgui-hud-title:before,.rgui-hud-title:after{width:60px;}',
            '.rgui-dialog-title{top:-20px;min-width:178px;padding:4px 14px 4px;}',
            '.rgui-dialog-title:before,.rgui-dialog-title:after{width:64px;}',
            '.rgui-crest-label{white-space:nowrap;}',
            '.rgui-crest-gem{font-size:7px;color:#f7e7b4;text-shadow:0 1px 0 #2f1707;}',
            '.rgui-close,.rgui-btn,.rgui-tab{font-family:"Press Start 2P",monospace;font-size:6px;border:none;cursor:pointer;}',
            '.rgui-close,.rgui-btn{padding:7px 8px;background:linear-gradient(180deg,#4a4a58 0%,#2e2e3b 100%);color:#efe6d4;box-shadow:0 3px 0 #161620;}.rgui-btn-gold{background:linear-gradient(180deg,#a87030 0%,#885020 100%);color:#ffe7b2;box-shadow:0 3px 0 #4b260b;}.rgui-close{position:absolute;top:13px;right:16px;z-index:6;padding:4px 6px;background:rgba(233,220,191,.82);color:#5a4028;border:1px solid rgba(112,82,44,.48);box-shadow:none;}',
            '.rgui-frame-corner{position:absolute;width:24px;height:24px;background:#3a1808;box-shadow:inset 0 0 0 2px #5a3818,inset 0 0 0 4px #4a2808;z-index:5;pointer-events:none;}',
            '.rgui-frame-corner:before{content:"";position:absolute;top:5px;left:5px;right:5px;bottom:5px;background:#2a1000;box-shadow:inset 2px 2px 0 rgba(255,200,150,.14);}',
            '.rgui-corner-nw{top:-12px;left:-12px;}.rgui-corner-ne{top:-12px;right:-12px;}.rgui-corner-sw{bottom:-12px;left:-12px;}.rgui-corner-se{bottom:-12px;right:-12px;}',
            '.rgui-hud-dock{position:absolute;left:18px;right:18px;bottom:18px;height:116px;display:flex;align-items:stretch;justify-content:center;gap:42px;}.rgui-partyhud{position:relative;display:flex;gap:8px;height:100%;pointer-events:auto;margin:10px;padding:0 10px;}',
            '.rgui-party-card{position:relative;width:var(--rgui-card-width);height:100%;padding:0;}.rgui-party-card-inner{margin:var(--rk-inner-inset,5px);height:calc(100% - var(--rk-inner-offset,10px));padding:7px;display:flex;flex-direction:column;gap:4px;}.rgui-party-top{display:grid;grid-template-columns:34px 1fr;gap:6px;align-items:start;}',
            '.rgui-party-portrait{position:relative;width:34px;height:34px;border:2px solid var(--rgui-paper-edge);background:linear-gradient(180deg,#6a5040 0%,#4a3020 100%);color:#f5e7c6;display:flex;align-items:center;justify-content:center;font-size:11px;}.rgui-party-statuses{position:absolute;left:2px;right:2px;bottom:2px;display:flex;gap:2px;flex-wrap:wrap;}.rgui-party-status{min-width:8px;height:8px;padding:0 1px;background:rgba(24,18,12,.82);border:1px solid rgba(233,212,170,.45);color:#f4e7c4;font-size:5px;line-height:8px;text-align:center;}',
            '.rgui-party-name{color:var(--rgui-ink);font-size:7px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.rgui-party-level{color:var(--rgui-muted);font-size:6px;margin-top:1px;}.rgui-party-bars{display:flex;flex-direction:column;gap:3px;margin-top:auto;}.rgui-party-barline{display:grid;grid-template-columns:14px 1fr auto;gap:3px;align-items:center;}.rgui-party-label,.rgui-party-value{color:#5f4526;font-size:6px;}.rgui-party-track{height:6px;background:rgba(0,0,0,.14);border:1px solid var(--rgui-paper-edge);overflow:hidden;}.rgui-party-fill{height:100%;}.rgui-party-fill.hp{background:linear-gradient(90deg,#a04030 0%,#c06030 55%,#6a8a30 100%);}.rgui-party-fill.mp{background:linear-gradient(90deg,#3050a0 0%,#4080c0 100%);}.rgui-party-fill.xp{background:linear-gradient(90deg,#907030 0%,#c8a840 100%);}.rgui-party-card.is-controlled{box-shadow:inset 0 3px 0 rgba(255,226,154,.32),inset 0 -6px 0 rgba(0,0,0,.5),inset 3px 0 0 rgba(255,226,154,.14),inset -3px 0 0 rgba(0,0,0,.28),0 0 0 4px #5e4320,0 12px 22px rgba(0,0,0,.42);}.rgui-party-control-crest{position:absolute;top:6px;right:6px;width:18px;height:18px;background:linear-gradient(180deg,#a97630 0%,#6c4717 100%);border:2px solid #2e1608;color:#ffe7af;font-size:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 #1d1106;}',
            '.rgui-hud{position:relative;width:max-content;max-width:520px;height:100%;}.rgui-hud-crest{top:-14px;}.rgui-hud-inner{height:calc(100% - var(--rk-inner-offset,10px));padding:10px 8px 6px;display:flex;flex-direction:column;gap:5px;}.rgui-hotbar{display:grid;grid-template-columns:repeat(6,52px);gap:5px;justify-content:center;}',
            '.rgui-slot{position:relative;min-height:44px;padding:4px 4px 3px;border:1px solid var(--rgui-paper-edge);background:#f0e8d8;color:#3a2818;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;}.rgui-slot.is-selected{box-shadow:inset 0 0 0 2px #5868a8;}.rgui-slot-num{position:absolute;top:3px;left:3px;font-size:6px;color:#7a6048;}.rgui-slot-qty{position:absolute;right:3px;bottom:3px;font-size:6px;color:#7a5020;}.rgui-slot-icon{font-size:12px;}.rgui-slot-name{font-size:6px;text-align:center;line-height:1.3;}',
            '.rgui-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;}.rgui-effects{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;min-height:16px;}.rgui-chip{padding:3px 6px;background:#f0e8d8;border:1px solid var(--rgui-paper-edge);color:#3a2818;font-size:6px;}',
            '.rgui-window{display:none;left:22px;top:68px;width:820px;height:520px;}.rgui-window.is-open{display:block;}.rgui-book{display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1;min-height:0;position:relative;}.rgui-book:before{content:"";position:absolute;top:8px;bottom:8px;left:calc(50% - 8px);width:16px;background:linear-gradient(180deg,#743e2a 0%,#542817 100%);box-shadow:inset 2px 0 0 rgba(255,228,196,.14),inset -2px 0 0 rgba(0,0,0,.18);border-radius:2px;}',
            '.rgui-page{position:relative;min-width:0;min-height:0;height:100%;padding:10px 12px 12px;background:radial-gradient(circle at top left,rgba(255,250,235,.38) 0%,rgba(255,250,235,0) 28%),repeating-linear-gradient(0deg,transparent 0px,transparent 3px,rgba(120,90,48,.04) 3px,rgba(120,90,48,.04) 4px),linear-gradient(180deg,#e1d1b0 0%,#d4c19c 100%);border:1px solid rgba(112,82,44,.28);overflow:hidden;display:flex;flex-direction:column;}.rgui-page:before{content:"";position:absolute;left:8px;right:8px;top:8px;bottom:8px;border:1px solid rgba(132,101,58,.18);pointer-events:none;}.rgui-page-head{display:flex;align-items:center;justify-content:center;gap:10px;padding-bottom:8px;margin-bottom:10px;flex:0 0 auto;}.rgui-page-line{flex:1;height:4px;max-width:84px;background:linear-gradient(90deg,transparent 0%,#8a6843 35%,#7a5530 50%,#8a6843 65%,transparent 100%);opacity:.85;}.rgui-page-title{position:relative;color:#5f4526;font-size:8px;text-align:center;letter-spacing:1px;padding:0 4px;}.rgui-page-body{display:flex;gap:8px;flex:1;min-height:0;align-items:stretch;}.rgui-scroll{flex:1;min-width:0;min-height:0;overflow:auto;padding-right:6px;color:#3a2818;font-size:6px;line-height:1.65;scrollbar-width:thin;scrollbar-color:#8a6843 rgba(72,48,28,.08);}.rgui-scroll::-webkit-scrollbar{width:8px;}.rgui-scroll::-webkit-scrollbar-track{background:rgba(72,48,28,.08);}.rgui-scroll::-webkit-scrollbar-thumb{background:#8a6843;border:1px solid #6a4a28;}.rgui-side-tabs{display:flex;flex-direction:column;gap:6px;flex:0 0 34px;padding-top:6px;}.rgui-tab{width:34px;height:34px;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--rgui-paper-edge);background:linear-gradient(180deg,#eadbbe 0%,#d7c39b 100%);color:#5a4028;box-shadow:0 2px 0 rgba(75,44,18,.25);}.rgui-tab.is-active{background:linear-gradient(180deg,#a87030 0%,#885020 100%);color:#ffe8b0;border-color:#683010;box-shadow:0 2px 0 #4b260b;}',
            '.rgui-hero{display:grid;grid-template-columns:88px 1fr;gap:10px;margin-bottom:10px;}.rgui-portrait-large{height:110px;border:2px solid var(--rgui-paper-edge);background:linear-gradient(180deg,#7a6648 0%,#4e3c27 100%);display:flex;align-items:center;justify-content:center;color:#f3e3bc;font-size:24px;}.rgui-heading{font-size:8px;color:var(--rgui-ink);margin-bottom:4px;}.rgui-subheading{font-size:6px;color:var(--rgui-muted);margin-bottom:6px;}.rgui-statline{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;}.rgui-statlabel{color:var(--rgui-muted);}.rgui-statvalue{color:var(--rgui-ink);}.rgui-section{margin-top:10px;padding-top:8px;border-top:1px solid rgba(112,82,44,.28);}.rgui-section-title,.rgui-detail-title{font-size:7px;color:var(--rgui-ink);margin-bottom:6px;}',
            '.rgui-equipment-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}.rgui-equip-slot,.rgui-pack-slot,.rgui-detail-card,.rgui-list-card{padding:8px;background:rgba(255,247,224,.42);border:1px solid rgba(112,82,44,.28);}.rgui-equip-slot{text-align:center;color:var(--rgui-muted);min-height:34px;}.rgui-backpack-header{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;color:#5f4526;}.rgui-backpack-layout{display:grid;grid-template-columns:1.35fr .9fr;gap:8px;}.rgui-backpack-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}.rgui-pack-slot{min-height:54px;padding:4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;}.rgui-pack-slot.is-selected{box-shadow:inset 0 0 0 2px #5868a8;}.rgui-pack-icon{font-size:13px;}.rgui-pack-name{font-size:6px;text-align:center;line-height:1.35;}.rgui-pack-qty,.rgui-muted{font-size:6px;color:var(--rgui-muted);}.rgui-list-stack{display:flex;flex-direction:column;gap:6px;}.rgui-list-card h4,.rgui-detail-card h4{margin:0 0 4px;font-size:7px;color:#2a1408;}.rgui-list-card p,.rgui-detail-card p{margin:0 0 4px;}.rgui-detail-card .rgui-btn{margin-top:6px;width:100%;}',
            '.rgui-dialog{position:fixed;left:50%;bottom:140px;transform:translateX(-50%);width:min(520px,calc(100vw - 32px));display:none;z-index:420;}.rgui-dialog.is-open{display:block;}.rgui-dialog-text{padding:34px 10px 10px;min-height:88px;color:var(--rgui-ink);font-size:7px;line-height:1.7;}.rgui-dialog-actions{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px;}',
            '.rgui-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:430;}.rgui-backdrop.is-open{display:block;}.rgui-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(320px,calc(100vw - 28px));display:none;z-index:440;}.rgui-modal.is-open{display:block;}.rgui-modal-inner{padding:28px 12px 12px;display:flex;flex-direction:column;gap:8px;}',
            '#rgui-help{left:50%;top:56px;transform:translateX(-50%);width:min(620px,calc(100vw - 40px));height:calc(100vh - 200px);display:none;z-index:450;}#rgui-help.is-open{display:flex;flex-direction:column;}.rgui-help-inner{height:100%;display:flex;flex-direction:column;overflow:hidden;}.rgui-help-content{flex:1;min-height:0;overflow:auto;padding:20px 16px 16px;font-size:7px;line-height:1.8;}',
            '.rgui-help-section{margin-bottom:14px;}.rgui-help-title{font-size:8px;color:#5f4526;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(112,82,44,.28);}.rgui-help-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}.rgui-help-item{display:flex;gap:8px;align-items:center;padding:6px;background:rgba(255,247,224,.35);border:1px solid rgba(112,82,44,.28);}.rgui-help-key{min-width:50px;padding:3px 5px;background:#3a2818;color:#f0e8d8;font-size:6px;text-align:center;border:1px solid #5a4028;}.rgui-help-desc{flex:1;color:#3a2818;font-size:6px;}',
            '.rgui-hud.compact-4 .rgui-slot-name,.rgui-hud.compact-5 .rgui-slot-name,.rgui-hud.compact-6 .rgui-slot-name{display:none;}.rgui-hud.compact-5 .rgui-effects,.rgui-hud.compact-6 .rgui-effects{display:none;}.rgui-fs-btn{position:absolute;right:-36px;bottom:0;width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#3a3848 0%,#2a2838 50%,#1a1828 100%);border:1px solid #5a5868;color:#8a8898;font-size:10px;cursor:pointer;box-shadow:0 2px 0 #0a0810;transition:all 0.2s;z-index:10;}.rgui-fs-btn:hover{background:linear-gradient(180deg,#4a4858 0%,#3a3848 50%,#2a2838 100%);color:#c8c6d8;box-shadow:0 2px 0 #1a1828;}.rgui-fs-btn.active{color:#4ecca3;}',
            '@media (max-width:980px){.rgui-hud-dock{left:12px;right:12px;bottom:16px;height:auto;flex-direction:column;}.rgui-partyhud{flex-wrap:wrap;}.rgui-party-card{height:98px;}.rgui-window{left:12px;top:56px;width:calc(100vw - 24px);height:calc(100vh - 220px);}.rgui-book{grid-template-columns:1fr;gap:10px;}.rgui-book:before{display:none;}.rgui-page-body{flex-direction:column;}.rgui-side-tabs{flex-direction:row;flex:0 0 auto;padding-top:0;justify-content:center;}.rgui-backpack-layout{grid-template-columns:1fr;}}'
        ].join('\n');
        document.head.appendChild(style);
    }

    _bindEvents() {
        var self = this;
        if (!this.root) return;

        this.root.addEventListener('click', function(event) {
            var target = event.target;
            if (!target) return;

            var actionEl = target.closest('[data-action],[data-tab],[data-slot],[data-pack-slot],[data-choice],[data-party-index]');
            if (!actionEl) return;
            event.preventDefault();
            event.stopPropagation();

            try {
                var tab = actionEl.getAttribute('data-tab');
                if (tab) {
                    self.openCodexPage(tab);
                    return;
                }

                var partyIndex = actionEl.getAttribute('data-party-index');
                if (partyIndex !== null) {
                    var members = self._getPartyMembers();
                    var member = members[parseInt(partyIndex, 10)];
                    if (member && self.engine.inputController && self.engine.inputController.switchTo) {
                        self.engine.inputController.switchTo(member);
                        self.sync(true);
                    }
                    return;
                }

                var packSlot = actionEl.getAttribute('data-pack-slot');
                if (packSlot !== null) {
                    self.selectedInventorySlot = parseInt(packSlot, 10) || 0;
                    self.sync(true);
                    return;
                }

                var choice = actionEl.getAttribute('data-choice');
                if (choice !== null && self.engine.dialogueSystem) {
                    self.engine.dialogueSystem.selectChoice(parseInt(choice, 10) || 0);
                    self.sync(true);
                    return;
                }

                var slot = actionEl.getAttribute('data-slot');
                if (slot !== null) {
                    self.selectedHotbarSlot = parseInt(slot, 10) || 0;
                    if (self.engine.useInventoryItem) {
                        self.engine.useInventoryItem(self.selectedHotbarSlot);
                    }
                    self.sync(true);
                    return;
                }

                var action = actionEl.getAttribute('data-action');
                if (!action) return;

                if (action === 'close-codex') {
                    self.closeCodex();
                } else if (action === 'resume' || action === 'close-menu') {
                    self.togglePause(false);
                } else if (action === 'save') {
                    self._saveGame();
                } else if (action === 'open-summary') {
                    self.openCodexPage('summary');
                } else if (action === 'open-gear') {
                    self.openCodexPage('gear');
                } else if (action === 'open-menu') {
                    self.togglePause(true);
                } else if (action === 'dialog-advance') {
                    if (self.engine.dialogueSystem) {
                        self.engine.dialogueSystem.advance();
                        self.sync(true);
                    }
                } else if (action === 'dialog-end') {
                    if (self.engine.dialogueSystem) {
                        self.engine.dialogueSystem.end();
                        self.sync(true);
                    }
                } else if (action === 'use-selected-item') {
                    if (self.engine.useInventoryItem) {
                        self.engine.useInventoryItem(self.selectedInventorySlot);
                        self.sync(true);
                    }
                } else if (action === 'open-help') {
                    self.toggleHelp(true);
                } else if (action === 'close-help') {
                    self.toggleHelp(false);
                } else if (action === 'toggle-fullscreen') {
                    self._toggleFullscreen();
                }
            } catch (err) {
                console.error('[RealmGameUI] Click action failed:', err);
            }
        });
    }

    _bindResize() {
        var self = this;
        this._boundResize = function() {
            self.sync(true);
        };
        window.addEventListener('resize', this._boundResize);
    }

    _suppressLegacyUI() {
        var hiddenSelectors = ['hud_combatlog', 'quest-tracker', 'info-bar'];
        var i;

        for (i = 0; i < hiddenSelectors.length; i++) {
            var node = document.getElementById(hiddenSelectors[i]);
            if (node) {
                node.style.display = 'none';
            }
        }

        if (this.engine && this.engine.questTracker) {
            if (this.engine.questTracker.destroy) {
                this.engine.questTracker.destroy();
            } else if (this.engine.questTracker.hide) {
                this.engine.questTracker.hide();
            }
            this.engine.questTracker = null;
        }

        if (this.engine && this.engine.hudSystem && this.engine.hudSystem.elements) {
            var combatLog = this.engine.hudSystem.elements.get('combatlog');
            if (combatLog) {
                combatLog.headless = true;
                if (combatLog.element && combatLog.element.parentNode) {
                    combatLog.element.parentNode.removeChild(combatLog.element);
                }
                combatLog.element = null;
                combatLog.entriesDiv = null;
            }
        }
    }

    update(force) {
        if (!this.root) return;

        var signature = this._buildSignature();
        var now = Date.now();
        if (!force && signature === this.lastSignature) {
            return;
        }

        this.lastSignature = signature;
        this.lastSyncAt = now;
        this.sync(force);
    }

    sync(force) {
        this._suppressLegacyUI();
        this._layoutHud();
        this._layoutCodexWindow();
        this._syncPartyCards(force);
        this._syncHotbar();
        this._syncCodex(force);
        this._syncDialogue();
        this._syncPause();
        this._syncHelp();
    }

    _buildSignature() {
        var player = this._getCurrentMember();
        var stats = player && player.combatStats ? player.combatStats : {};
        var xp = this._getXpData(player);
        var inventory = this.engine.inventoryManager ? this.engine.inventoryManager.items : [];
        var activeQuests = this.engine.questSystem ? this.engine.questSystem.getActiveQuests() : [];
        var dialogueActive = this.engine.dialogueSystem && this.engine.dialogueSystem.isActive ? this.engine.dialogueSystem.isActive() : false;

        return [
            this.codexOpen ? 1 : 0,
            this.pauseOpen ? 1 : 0,
            this.codexTab,
            this.selectedInventorySlot,
            stats.hp || 0,
            stats.mp || 0,
            xp.level || 1,
            xp.xp || 0,
            inventory.length,
            this.engine.inventoryManager ? this.engine.inventoryManager.gold : 0,
            activeQuests.length,
            dialogueActive ? 1 : 0,
            this._getPartyMembers().length
        ].join('|');
    }

    _layoutHud() {
        var members = this._getPartyMembers();
        var count = members.length || 1;
        var dock = this.refs.dock;
        var hud = this.refs.hud;
        if (!dock || !hud) return;

        dock.style.justifyContent = 'center';
        dock.style.height = '116px';

        hud.className = 'rgui-hud compact-' + count;

        var hudWidth = 520;
        if (count >= 4) {
            hudWidth = 372;
        } else if (count === 3) {
            hudWidth = 416;
        } else if (count === 2) {
            hudWidth = 470;
        }
        hud.style.maxWidth = hudWidth + 'px';
        hud.style.width = 'max-content';
    }

    _layoutCodexWindow() {
        var codex = this.refs.codex;
        if (!codex) return;

        var ratio = 1.56;
        var top = 56;
        var maxWidth = Math.max(620, Math.min(960, window.innerWidth - 48));
        var maxHeight = window.innerHeight - top - 160;

        if (this.refs.dock) {
            var dockRect = this.refs.dock.getBoundingClientRect();
            maxHeight = Math.max(360, Math.floor(dockRect.top - top - 18));
        }

        var width = Math.min(maxWidth, Math.floor(maxHeight * ratio));
        width = Math.max(Math.min(620, maxWidth), width);
        var height = Math.floor(width / ratio);
        var left = Math.max(22, Math.floor((window.innerWidth - width) / 2));

        codex.style.width = width + 'px';
        codex.style.height = height + 'px';
        codex.style.left = left + 'px';
        codex.style.top = top + 'px';
    }

    _getPartyMembers() {
        var members = [];
        var seen = {};
        var i;

        if (this.engine && this.engine.partyManager && this.engine.partyManager.getMembers) {
            var partyMembers = this.engine.partyManager.getMembers();
            for (i = 0; i < partyMembers.length; i++) {
                if (partyMembers[i] && !seen[partyMembers[i].id]) {
                    members.push(partyMembers[i]);
                    seen[partyMembers[i].id] = true;
                }
            }
        }

        if (this.engine && this.engine.player && !seen[this.engine.player.id]) {
            members.unshift(this.engine.player);
        }

        if (members.length === 0 && this.engine && this.engine.player) {
            members.push(this.engine.player);
        }

        return members;
    }

    _getCurrentMember() {
        if (this.engine && this.engine.inputController && this.engine.inputController.getControlledUnit) {
            return this.engine.inputController.getControlledUnit() || this.engine.player;
        }
        return this.engine ? this.engine.player : null;
    }

    _buildPartySignature() {
        var members = this._getPartyMembers();
        var current = this._getCurrentMember();
        var parts = [current ? current.id : 'none'];
        var i;

        for (i = 0; i < members.length; i++) {
            var member = members[i];
            var stats = member && member.combatStats ? member.combatStats : {};
            var xp = this._getXpData(member);
            parts.push([
                member ? member.id : ('slot' + i),
                this._safeNumber(stats.hp, 0),
                this._safeNumber(stats.maxHp, 0),
                this._safeNumber(stats.mp, 0),
                this._safeNumber(stats.maxMp, 0),
                this._safeNumber(xp.level, member && member.level ? member.level : 1)
            ].join(':'));
        }

        return parts.join('|');
    }

    _syncPartyCards(force) {
        if (!this.refs.partyhud) return;

        var members = this._getPartyMembers();
        var current = this._getCurrentMember();
        var signature = this._buildPartySignature();
        if (signature === this.lastPartySignature) {
            return;
        }
        this.lastPartySignature = signature;
        var html = [];
        var i;

        for (i = 0; i < members.length; i++) {
            var member = members[i];
            var stats = member && member.combatStats ? member.combatStats : {};
            var xp = this._getXpData(member);
            var name = member ? (member.displayName || member.name || ('Member ' + (i + 1))) : ('Member ' + (i + 1));
            var hp = this._safeNumber(stats.hp, 0);
            var maxHp = Math.max(1, this._safeNumber(stats.maxHp, hp || 1));
            var mp = this._safeNumber(stats.mp, 0);
            var maxMp = Math.max(1, this._safeNumber(stats.maxMp, mp || 1));
            var xpCurrent = this._safeNumber(xp.xp, 0);
            var xpNeeded = Math.max(1, xpCurrent + this._safeNumber(xp.xpToNext, 1));

            html.push(
                '<div class="rgui-party-card' + (current && member && current.id === member.id ? ' is-controlled' : '') + '" data-party-index="' + i + '">' +
                '  <div class="rgui-frame-corner rgui-corner-nw"></div>' +
                '  <div class="rgui-frame-corner rgui-corner-ne"></div>' +
                '  <div class="rgui-frame-corner rgui-corner-sw"></div>' +
                '  <div class="rgui-frame-corner rgui-corner-se"></div>' +
                '  <div class="rgui-party-card-inner">' +
                (current && member && current.id === member.id ? '    <div class="rgui-party-control-crest" title="Controlled Member">◆</div>' : '') +
                '    <div class="rgui-party-top">' +
                '      <div class="rgui-party-portrait">' + this._esc(this._getInitials(name)) + this._renderStatusIcons(member) + '</div>' +
                '      <div>' +
                '        <div class="rgui-party-name">' + this._esc(name) + '</div>' +
                '        <div class="rgui-party-level">' + this._label('level', 'Level') + ' ' + this._safeNumber(xp.level, member.level || 1) + '</div>' +
                '      </div>' +
                '    </div>' +
                '    <div class="rgui-party-bars">' +
                this._partyBar(this._label('hp', 'HP'), 'hp', hp, maxHp) +
                this._partyBar(this._label('mp', 'MP'), 'mp', mp, maxMp) +
                this._partyBar(this._label('xp', 'XP'), 'xp', xpCurrent, xpNeeded) +
                '    </div>' +
                '  </div>' +
                '</div>'
            );
        }

        this.refs.partyhud.innerHTML = html.join('');
    }

    _partyBar(label, fillClass, current, max) {
        var pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
        return [
            '<div class="rgui-party-barline">',
            '  <span class="rgui-party-label">' + this._esc(label) + '</span>',
            '  <span class="rgui-party-track"><span class="rgui-party-fill ' + fillClass + '" style="width:' + pct + '%"></span></span>',
            '  <span class="rgui-party-value">' + this._safeNumber(current, 0) + '/' + this._safeNumber(max, 0) + '</span>',
            '</div>'
        ].join('');
    }

    _syncHotbar() {
        if (!this.refs.hotbar) return;

        var inventory = this.engine.inventoryManager ? this.engine.inventoryManager.items : [];
        var effects = this._collectEffects(this._getCurrentMember());
        var slots = [];
        var i;

        for (i = 0; i < 6; i++) {
            var item = inventory[i] || null;
            slots.push(
                '<button class="rgui-slot' + (this.selectedHotbarSlot === i ? ' is-selected' : '') + '" data-slot="' + i + '">' +
                '  <span class="rgui-slot-num">' + (i + 1) + '</span>' +
                '  <span class="rgui-slot-icon">' + this._esc(this._itemIcon(item)) + '</span>' +
                '  <span class="rgui-slot-name">' + this._esc(item ? (item.name || item.id || 'Item') : 'Empty') + '</span>' +
                (item && item.quantity && item.quantity > 1 ? '<span class="rgui-slot-qty">' + item.quantity + '</span>' : '') +
                '</button>'
            );
        }

        this.refs.hotbar.innerHTML = slots.join('');

        if (this.refs.effects) {
            if (!effects.length) {
                this.refs.effects.innerHTML = '';
            } else {
                var chips = [];
                for (i = 0; i < effects.length && i < 6; i++) {
                    var effect = effects[i];
                    var name = effect.displayName || effect.name || effect.type || effect.id || ('Effect ' + (i + 1));
                    chips.push('<span class="rgui-chip" title="' + this._escAttr(name) + '">' + this._esc(this._effectIcon(name)) + '</span>');
                }
                this.refs.effects.innerHTML = chips.join('');
            }
        }
    }

    _syncCodex() {
        if (!this.refs.codex) return;

        this.refs.codex.classList.toggle('is-open', !!this.codexOpen);
        if (!this.codexOpen) return;

        try {
            this.refs.codexTitle.textContent = this._codexTitle(this.codexTab);
            this.refs.codexLeft.innerHTML = this._renderLeftPage();
            this.refs.codexRight.innerHTML = this._renderRightPage();
            this._syncTabs();
        } catch (err) {
            console.error('[RealmGameUI] Codex render failed:', err);
            this.refs.codexTitle.textContent = 'Codex Error';
            this.refs.codexLeft.innerHTML = '<div class="rgui-muted">The current page could not be drawn.</div>';
            this.refs.codexRight.innerHTML = '<div class="rgui-detail-card"><h4>Render Error</h4><p class="rgui-muted">Try another tab or close the codex.</p></div>';
        }
    }

    _syncTabs() {
        var tabs = ['summary', 'gear', 'quests', 'factions', 'codex', 'magic'];
        var i;
        for (i = 0; i < tabs.length; i++) {
            var button = document.getElementById('rgui-tab-' + tabs[i]);
            if (!button) continue;
            button.classList.toggle('is-active', tabs[i] === this.codexTab);
        }
    }

    _renderLeftPage() {
        var member = this._getCurrentMember();
        if (!member) {
            return '<div class="rgui-muted">No active adventurer.</div>';
        }

        var stats = member.combatStats || {};
        var xp = this._getXpData(member);
        var equipment = this.engine.equipmentManager ? this.engine.equipmentManager.equipment : {};
        var story = this.engine.currentStory || {};
        var slotNames = [
            { key: 'head', label: 'Head' },
            { key: 'mainHand', label: 'Main Hand' },
            { key: 'offHand', label: 'Off Hand' },
            { key: 'chest', label: 'Chest' },
            { key: 'legs', label: 'Legs' },
            { key: 'feet', label: 'Feet' },
            { key: 'accessory', label: 'Charm' }
        ];
        var equipHtml = [];
        var i;

        for (i = 0; i < slotNames.length; i++) {
            var eqItem = equipment ? equipment[slotNames[i].key] : null;
            equipHtml.push(
                '<div class="rgui-equip-slot">' +
                '  <div>' + this._esc(slotNames[i].label) + '</div>' +
                '  <div>' + this._esc(eqItem ? (eqItem.name || eqItem.id || 'Equipped') : '--') + '</div>' +
                '</div>'
            );
        }

        return [
            '<div class="rgui-hero">',
            '  <div class="rgui-portrait-large">' + this._esc(this._getInitials(member.displayName || member.name || 'P')) + '</div>',
            '  <div>',
            '    <div class="rgui-heading">' + this._esc(member.displayName || member.name || 'Player') + '</div>',
            '    <div class="rgui-subheading">' + this._esc(story.title || 'Story') + '</div>',
            '    <div class="rgui-subheading">' + this._label('level', 'Level') + ' ' + this._safeNumber(xp.level, member.level || 1) + '</div>',
            '    <div class="rgui-subheading">' + this._label('hp', 'HP') + ' ' + this._safeNumber(stats.hp, 0) + '/' + this._safeNumber(stats.maxHp, 0) + '</div>',
            '    <div class="rgui-subheading">' + this._label('mp', 'MP') + ' ' + this._safeNumber(stats.mp, 0) + '/' + this._safeNumber(stats.maxMp, 0) + '</div>',
            '  </div>',
            '</div>',
            '<div class="rgui-statline"><span class="rgui-statlabel">Attack</span><span class="rgui-statvalue">' + this._safeNumber(stats.attack, 0) + '</span></div>',
            '<div class="rgui-statline"><span class="rgui-statlabel">Defense</span><span class="rgui-statvalue">' + this._safeNumber(stats.defense, 0) + '</span></div>',
            '<div class="rgui-statline"><span class="rgui-statlabel">Speed</span><span class="rgui-statvalue">' + this._safeNumber(stats.speed, 0) + '</span></div>',
            '<div class="rgui-statline"><span class="rgui-statlabel">XP To Next</span><span class="rgui-statvalue">' + this._safeNumber(xp.xpToNext, 0) + '</span></div>',
            '<div class="rgui-section">',
            '  <div class="rgui-section-title">Equipment</div>',
            '  <div class="rgui-equipment-grid">' + equipHtml.join('') + '</div>',
            '</div>'
        ].join('');
    }

    _renderRightPage() {
        if (this.codexTab === 'gear') {
            return this._renderBackpackPage();
        }
        if (this.codexTab === 'quests') {
            return this._renderQuestsPage();
        }
        if (this.codexTab === 'factions') {
            return this._renderFactionsPage();
        }
        if (this.codexTab === 'codex') {
            return this._renderCodexPage();
        }
        if (this.codexTab === 'magic') {
            return this._renderMagicPage();
        }
        return this._renderSummaryPage();
    }

    _renderSummaryPage() {
        var member = this._getCurrentMember();
        var stats = member && member.combatStats ? member.combatStats : {};
        var effects = this._collectEffects(member);
        var weather = this.engine.weatherSystem ? this.engine.weatherSystem.currentWeather : null;
        var story = this.engine.currentStory || {};

        return [
            '<div class="rgui-list-stack">',
            '  <div class="rgui-list-card">',
            '    <h4>Summary</h4>',
            '    <p>' + this._label('hp', 'HP') + ' ' + this._safeNumber(stats.hp, 0) + ' / ' + this._safeNumber(stats.maxHp, 0) + '</p>',
            '    <p>' + this._label('mp', 'MP') + ' ' + this._safeNumber(stats.mp, 0) + ' / ' + this._safeNumber(stats.maxMp, 0) + '</p>',
            '    <p>Attack ' + this._safeNumber(stats.attack, 0) + '  Defense ' + this._safeNumber(stats.defense, 0) + '  Speed ' + this._safeNumber(stats.speed, 0) + '</p>',
            '  </div>',
            '  <div class="rgui-list-card">',
            '    <h4>Conditions</h4>',
            (effects.length ? this._renderEffectList(effects) : '<p class="rgui-muted">No active effects tracked.</p>'),
            '  </div>',
            '  <div class="rgui-list-card">',
            '    <h4>World</h4>',
            '    <p>Story: ' + this._esc(story.title || 'Uncharted Realm') + '</p>',
            '    <p>Weather: ' + this._esc(weather || 'clear') + '</p>',
            '    <p>Time: ' + this._esc(this._timeOfDayText()) + '</p>',
            '  </div>',
            '</div>'
        ].join('');
    }

    _renderBackpackPage() {
        var inventory = this.engine.inventoryManager ? this.engine.inventoryManager.items : [];
        var gold = this.engine.inventoryManager ? this.engine.inventoryManager.gold : 0;
        var maxSlots = this.engine.inventoryManager ? this.engine.inventoryManager.maxSlots : 20;
        var items = inventory.slice(0, maxSlots);
        var html = [];
        var i;

        if (items.length === 0) {
            this.selectedInventorySlot = 0;
        } else if (this.selectedInventorySlot >= items.length) {
            this.selectedInventorySlot = items.length - 1;
        }

        for (i = 0; i < maxSlots; i++) {
            var item = items[i] || null;
            html.push(
                '<button class="rgui-pack-slot' + (this.selectedInventorySlot === i ? ' is-selected' : '') + '" data-pack-slot="' + i + '">' +
                '  <span class="rgui-pack-icon">' + this._esc(this._slotIcon(item)) + '</span>' +
                '  <span class="rgui-pack-name">' + this._esc(item ? (item.name || item.id || 'Item') : 'Empty') + '</span>' +
                '  <span class="rgui-pack-qty">' + (item && item.quantity ? ('x' + item.quantity) : '--') + '</span>' +
                '</button>'
            );
        }

        var selected = items[this.selectedInventorySlot] || null;
        var detail = selected ? [
            '<div class="rgui-detail-card">',
            '  <h4>' + this._esc(selected.name || selected.id || 'Item') + '</h4>',
            '  <p>Type: ' + this._esc(selected.category || selected.type || 'misc') + '</p>',
            '  <p>Qty: ' + this._safeNumber(selected.quantity, 1) + '</p>',
            '  <p>Weight: ' + this._safeNumber(selected.weight, 0) + '</p>',
            (selected.description ? '<p>' + this._esc(selected.description) + '</p>' : ''),
            (selected.category === 'consumable' ? '<button class="rgui-btn rgui-btn-gold" data-action="use-selected-item">Use Item</button>' : ''),
            '</div>'
        ].join('') : [
            '<div class="rgui-detail-card">',
            '  <h4>Backpack</h4>',
            '  <p class="rgui-muted">Select an item to inspect it.</p>',
            '</div>'
        ].join('');

        return [
            '<div class="rgui-backpack-header">',
            '  <span>Backpack</span>',
            '  <span>Gold ' + this._safeNumber(gold, 0) + '</span>',
            '</div>',
            '<div class="rgui-backpack-layout">',
            '  <div class="rgui-backpack-grid">' + html.join('') + '</div>',
            '  <div>' + detail + '</div>',
            '</div>'
        ].join('');
    }

    _renderQuestsPage() {
        var questSystem = this.engine.questSystem;
        if (!questSystem) {
            return '<div class="rgui-muted">Quest system unavailable.</div>';
        }

        var active = questSystem.getActiveQuests ? questSystem.getActiveQuests() : [];
        var completed = [];
        if (questSystem.getCompletedQuests) {
            completed = questSystem.getCompletedQuests();
        } else if (questSystem.completedQuests && questSystem.getQuest) {
            var i;
            for (i = 0; i < questSystem.completedQuests.length; i++) {
                var completedQuest = questSystem.getQuest(questSystem.completedQuests[i]);
                if (completedQuest) {
                    completed.push(completedQuest);
                }
            }
        }
        var html = [];

        html.push('<div class="rgui-list-stack">');
        html.push('<div class="rgui-list-card"><h4>Active Quests</h4>');
        if (!active.length) {
            html.push('<p class="rgui-muted">No active quests.</p>');
        } else {
            html.push(this._renderQuestCards(active, false));
        }
        html.push('</div>');

        html.push('<div class="rgui-list-card"><h4>Completed Quests</h4>');
        if (!completed.length) {
            html.push('<p class="rgui-muted">No completed quests yet.</p>');
        } else {
            html.push(this._renderQuestCards(completed, true));
        }
        html.push('</div>');
        html.push('</div>');

        return html.join('');
    }

    _renderQuestCards(quests, completed) {
        var html = [];
        var i;
        for (i = 0; i < quests.length; i++) {
            var quest = quests[i];
            var objectives = quest.objectives || [];
            var objectiveHtml = [];
            var j;

            for (j = 0; j < objectives.length; j++) {
                var objective = objectives[j];
                var progress = quest.progress && quest.progress[objective.id] ? quest.progress[objective.id] : { current: 0, required: objective.required || 1 };
                objectiveHtml.push(
                    '<p>' + this._esc(objective.description || objective.target || objective.item || objective.id) +
                    ' (' + this._safeNumber(progress.current, 0) + '/' + this._safeNumber(progress.required, 1) + ')</p>'
                );
            }

            html.push(
                '<div class="rgui-list-card">' +
                '  <h4>' + this._esc(quest.title || quest.id || 'Quest') + '</h4>' +
                '  <p>' + this._esc(quest.description || (completed ? 'Completed.' : 'In progress.')) + '</p>' +
                (objectiveHtml.length ? objectiveHtml.join('') : '') +
                (quest.rewards ? '<p class="rgui-muted">Rewards: ' + this._esc(this._questRewardText(quest.rewards)) + '</p>' : '') +
                '</div>'
            );
        }
        return html.join('');
    }

    _renderFactionsPage() {
        var story = this.engine.currentStory || {};
        var factions = story.factions || [];
        var currentFaction = this.engine.player ? (this.engine.player.faction || 'player') : 'player';
        var html = [];
        var i;

        if (!factions.length) {
            return '<div class="rgui-muted">No faction data is loaded for this story.</div>';
        }

        html.push('<div class="rgui-list-stack">');
        html.push('<div class="rgui-list-card"><h4>Faction Ledger</h4><p class="rgui-muted">Current allegiance: ' + this._esc(currentFaction) + '</p></div>');

        for (i = 0; i < factions.length; i++) {
            var faction = factions[i];
            var name = faction.display_name || faction.name || faction.id;
            var relation = 'neutral';
            if (RealmKit.FactionRelations && RealmKit.FactionRelations[currentFaction]) {
                relation = RealmKit.FactionRelations[currentFaction][faction.name || faction.id] || relation;
            }
            html.push(
                '<div class="rgui-list-card">' +
                '  <h4>' + this._esc(name) + '</h4>' +
                '  <p>Relation: ' + this._esc(this._prettyRelation(relation)) + '</p>' +
                (faction.color ? '<p class="rgui-muted">Color: ' + this._esc(faction.color) + '</p>' : '') +
                '</div>'
            );
        }

        html.push('</div>');
        return html.join('');
    }

    _renderCodexPage() {
        var story = this.engine.currentStory || {};
        var entities = this.engine.entityManager ? this.engine.entityManager.entities : [];
        var npcs = [];
        var hostiles = [];
        var i;

        for (i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (!entity || entity === this.engine.player) continue;
            if (entity.behavior === 'hostile' || entity.faction === 'hostile') {
                hostiles.push(entity);
            } else if (entity.name) {
                npcs.push(entity);
            }
        }

        return [
            '<div class="rgui-list-stack">',
            '<div class="rgui-list-card"><h4>People and Allies</h4>' + (npcs.length ? this._renderEntityList(npcs.slice(0, 6), false) : '<p class="rgui-muted">No notable allies recorded.</p>') + '</div>',
            '<div class="rgui-list-card"><h4>Mobs and Monsters</h4>' + (hostiles.length ? this._renderEntityList(hostiles.slice(0, 6), true) : '<p class="rgui-muted">No hostile entries recorded.</p>') + '</div>',
            '<div class="rgui-list-card"><h4>Environment</h4>' +
            '<p>Weather: ' + this._esc((this.engine.weatherSystem && this.engine.weatherSystem.currentWeather) || 'clear') + '</p>' +
            '<p>Time: ' + this._esc(this._timeOfDayText()) + '</p>' +
            '<p>World Size: ' + this._safeNumber(this.engine.tileMap ? this.engine.tileMap.width : 0, 0) + ' x ' + this._safeNumber(this.engine.tileMap ? this.engine.tileMap.height : 0, 0) + '</p>' +
            '<p>Genre: ' + this._esc(story.genre || 'medieval_fantasy') + '</p>' +
            '</div>',
            '</div>'
        ].join('');
    }

    _renderMagicPage() {
        var member = this._getCurrentMember();
        var stats = member && member.combatStats ? member.combatStats : {};
        var effects = this._collectEffects(member);

        return [
            '<div class="rgui-list-stack">',
            '<div class="rgui-list-card">',
            '  <h4>Arcane Reserve</h4>',
            '  <p>Resource ' + this._safeNumber(stats.mp, 0) + ' / ' + this._safeNumber(stats.maxMp, 0) + '</p>',
            '</div>',
            '<div class="rgui-list-card">',
            '  <h4>Spellbook</h4>',
            '  <p>This page can become a spell list, power catalog, or narrative abilities page depending on the story rules profile.</p>',
            '</div>',
            '<div class="rgui-list-card">',
            '  <h4>Active Arcana</h4>',
            (effects.length ? this._renderEffectList(effects) : '<p class="rgui-muted">No magical effects tracked.</p>'),
            '</div>',
            '</div>'
        ].join('');
    }

    _syncDialogue() {
        if (!this.refs.dialog || !this.engine.dialogueSystem) return;

        var dialogueSystem = this.engine.dialogueSystem;
        var active = dialogueSystem.isActive && dialogueSystem.isActive();

        this.refs.dialog.classList.toggle('is-open', !!active);
        if (!active) {
            this.refs.dialogText.innerHTML = '';
            this.refs.dialogActions.innerHTML = '';
            return;
        }

        var speaker = dialogueSystem.getCurrentSpeaker ? dialogueSystem.getCurrentSpeaker() : 'Dialogue';
        var text = dialogueSystem.getCurrentText ? dialogueSystem.getCurrentText() : '';
        var choices = dialogueSystem.getChoices ? dialogueSystem.getChoices() : [];
        var actions = [];
        var i;

        this.refs.dialogSpeaker.textContent = speaker || 'Dialogue';
        this.refs.dialogText.innerHTML = this._esc(text || '');

        if (choices && choices.length) {
            for (i = 0; i < choices.length; i++) {
                actions.push('<button class="rgui-btn" data-choice="' + choices[i].index + '">' + this._esc(choices[i].text || ('Choice ' + (i + 1))) + '</button>');
            }
        } else {
            actions.push('<button class="rgui-btn" data-action="dialog-advance">Continue</button>');
            actions.push('<button class="rgui-btn" data-action="dialog-end">End</button>');
        }

        this.refs.dialogActions.innerHTML = actions.join('');
    }

    _syncPause() {
        if (!this.refs.pause || !this.refs.backdrop) return;

        var isOpen = !!this.pauseOpen || !!this.engine.isPaused;
        this.pauseOpen = isOpen;

        this.refs.pause.classList.toggle('is-open', isOpen);
        this.refs.backdrop.classList.toggle('is-open', isOpen || !!this.helpOpen);
    }

    openCodexPage(tab) {
        this.codexTab = this._normalizeTab(tab);
        this.codexOpen = true;
        this.sync(true);
    }

    openJournal(tab) {
        this.openCodexPage(tab || 'summary');
    }

    openQuests() {
        this.openCodexPage('quests');
    }

    closeCodex() {
        this.codexOpen = false;
        this.sync(true);
    }

    toggleJournal(show) {
        if (show === undefined) {
            if (this.codexOpen) {
                this.closeCodex();
            } else {
                this.openCodexPage('summary');
            }
            return;
        }

        if (show) {
            this.openCodexPage('summary');
        } else {
            this.closeCodex();
        }
    }

    toggleInventory(show) {
        if (show === undefined) {
            if (this.codexOpen && this.codexTab === 'gear') {
                this.closeCodex();
            } else {
                this.openCodexPage('gear');
            }
            return;
        }

        if (show) {
            this.openCodexPage('gear');
        } else if (this.codexTab === 'gear') {
            this.closeCodex();
        }
    }

    toggleQuests(show) {
        if (show === undefined) {
            if (this.codexOpen && this.codexTab === 'quests') {
                this.closeCodex();
            } else {
                this.openCodexPage('quests');
            }
            return;
        }

        if (show) {
            this.openCodexPage('quests');
        } else if (this.codexTab === 'quests') {
            this.closeCodex();
        }
    }

    togglePause(show) {
        var shouldOpen = show;
        if (shouldOpen === undefined) {
            shouldOpen = !(this.pauseOpen || this.engine.isPaused);
        }

        this.pauseOpen = !!shouldOpen;

        if (this.engine && this.engine.gameLoop) {
            if (this.pauseOpen && !this.engine.gameLoop.isPaused()) {
                this.engine.gameLoop.pause();
            } else if (!this.pauseOpen && this.engine.gameLoop.isPaused()) {
                this.engine.gameLoop.resume();
            }
        }

        this.sync(true);
        return this.pauseOpen;
    }

    toggleHelp(show) {
        var shouldOpen = show;
        if (shouldOpen === undefined) {
            shouldOpen = !this.helpOpen;
        }

        this.helpOpen = !!shouldOpen;

        if (this.helpOpen) {
            this._syncHelp();
        }

        this.sync(true);
        return this.helpOpen;
    }

    _syncHelp() {
        if (!this.refs.help) return;

        // Toggle visibility
        this.refs.help.classList.toggle('is-open', !!this.helpOpen);
        this.refs.backdrop.classList.toggle('is-open', !!this.helpOpen || !!this.pauseOpen);
        
        // Populate content if opening
        if (!this.helpOpen || !this.refs.helpContent) return;

        var sections = [
            {
                title: 'Movement & Combat',
                items: [
                    { key: 'W/A/S/D', desc: 'Move character' },
                    { key: 'SPACE', desc: 'Attack / Interact' },
                    { key: 'E', desc: 'Use ability/item' },
                    { key: 'Q', desc: 'Quick use item' }
                ]
            },
            {
                title: 'Party Management',
                items: [
                    { key: 'TAB', desc: 'Switch to next party member' },
                    { key: 'N', desc: 'Toggle manual/auto control' },
                    { key: 'R', desc: 'Recruit nearby NPC' },
                    { key: 'F', desc: 'Change formation' }
                ]
            },
            {
                title: 'UI Panels',
                items: [
                    { key: 'I', desc: 'Inventory (Travel Satchel)' },
                    { key: 'J', desc: 'Character Codex' },
                    { key: 'L', desc: 'Quest Log' },
                    { key: 'K', desc: 'Overview' },
                    { key: 'M', desc: 'Toggle Map' },
                    { key: 'ESC', desc: 'Close panels / Open Menu' }
                ]
            },
            {
                title: 'Debug (Dev Mode)',
                items: [
                    { key: 'G', desc: 'Toggle grid' },
                    { key: 'C', desc: 'Toggle coordinates' },
                    { key: 'T', desc: 'Toggle tiles' },
                    { key: 'D', desc: 'Terrain debug' },
                    { key: 'P', desc: 'Path debug' },
                    { key: 'S', desc: 'Sprite toggle' },
                    { key: 'Y', desc: 'Auto refresh' }
                ]
            }
        ];

        var html = '<div class="rgui-help-sections">';
        var i, j;
        
        for (i = 0; i < sections.length; i++) {
            var section = sections[i];
            html += '<div class="rgui-help-section">';
            html += '<div class="rgui-help-title">' + this._esc(section.title) + '</div>';
            html += '<div class="rgui-help-grid">';
            
            for (j = 0; j < section.items.length; j++) {
                var item = section.items[j];
                html += '<div class="rgui-help-item">';
                html += '<span class="rgui-help-key">' + this._esc(item.key) + '</span>';
                html += '<span class="rgui-help-desc">' + this._esc(item.desc) + '</span>';
                html += '</div>';
            }
            
            html += '</div></div>';
        }
        
        html += '</div>';
        this.refs.helpContent.innerHTML = html;
    }

    handleEscape() {
        if (this.engine && this.engine.dialogueSystem && this.engine.dialogueSystem.isActive && this.engine.dialogueSystem.isActive()) {
            this.engine.dialogueSystem.end();
            this.sync(true);
            return true;
        }

        if (this.helpOpen) {
            this.toggleHelp(false);
            return true;
        }

        if (this.pauseOpen || this.engine.isPaused) {
            this.togglePause(false);
            return true;
        }

        if (this.codexOpen) {
            this.closeCodex();
            return true;
        }

        this.togglePause(true);
        return true;
    }

    _saveGame() {
        if (!this.engine || !this.engine.saveManager) {
            return;
        }

        var result = this.engine.saveManager.save(0, this.engine.saveManager.serializeWorld(this.engine));
        if (this.engine.hudSystem && this.engine.hudSystem.addCombatLogEntry) {
            this.engine.hudSystem.addCombatLogEntry(result && result.success ? 'Journey saved.' : 'Save failed.', result && result.success ? 'item' : 'warning');
        }
        this.togglePause(false);
    }

    _normalizeTab(tab) {
        if (tab === 'overview') return 'summary';
        if (tab === 'inventory') return 'gear';
        if (tab === 'backpack') return 'gear';
        if (tab === 'pack') return 'gear';
        return tab || 'summary';
    }

    _codexTitle(tab) {
        if (tab === 'gear') return 'Backpack';
        if (tab === 'quests') return 'Quest Ledger';
        if (tab === 'factions') return 'Faction Ledger';
        if (tab === 'codex') return 'World Codex';
        if (tab === 'magic') return 'Magic';
        return 'Summary';
    }

    _label(key, fallback) {
        var labels = this.engine && this.engine.storyUIConfig ? this.engine.storyUIConfig.resourceLabels : null;
        return labels && labels[key] ? labels[key] : fallback;
    }

    _getXpData(entity) {
        if (this.engine && this.engine.experienceManager && entity && entity.id) {
            var data = this.engine.experienceManager.getXP(entity.id);
            if (data) return data;
        }

        return {
            xp: 0,
            level: entity && entity.level ? entity.level : 1,
            xpToNext: 100,
            totalXp: 0
        };
    }

    _collectEffects(member) {
        if (!member) return [];
        if (this.engine && this.engine.statusEffectManager && this.engine.statusEffectManager.getEffects && member.id) {
            return this.engine.statusEffectManager.getEffects(member.id) || [];
        }
        if (member.statusEffects && member.statusEffects.length) {
            return member.statusEffects.slice();
        }
        return [];
    }

    _renderEffectList(effects) {
        var html = [];
        var i;
        for (i = 0; i < effects.length; i++) {
            var effect = effects[i];
            var name = effect.displayName || effect.name || effect.type || effect.id || ('Effect ' + (i + 1));
            html.push('<p>' + this._esc(name) + '</p>');
        }
        return html.join('');
    }

    _renderStatusIcons(member) {
        var effects = this._collectEffects(member);
        var html = ['<span class="rgui-party-statuses">'];
        var i;
        for (i = 0; i < effects.length && i < 4; i++) {
            var effect = effects[i];
            var name = effect.displayName || effect.name || effect.type || effect.id || ('Effect ' + (i + 1));
            html.push('<span class="rgui-party-status" title="' + this._escAttr(name) + '">' + this._esc(this._effectIcon(name)) + '</span>');
        }
        html.push('</span>');
        return html.join('');
    }

    _renderEntityList(entities, hostile) {
        var html = [];
        var i;
        for (i = 0; i < entities.length; i++) {
            var entity = entities[i];
            var stats = entity.combatStats || {};
            html.push(
                '<p>' + this._esc(entity.displayName || entity.name || entity.id || ('Entry ' + (i + 1))) +
                (entity.behavior ? ' - ' + this._esc(entity.behavior) : '') +
                (hostile ? ' - ATK ' + this._safeNumber(stats.attack, 0) + ' DEF ' + this._safeNumber(stats.defense, 0) : '') +
                '</p>'
            );
        }
        return html.join('');
    }

    _questRewardText(rewards) {
        var parts = [];
        if (rewards.gold) parts.push(rewards.gold + ' gold');
        if (rewards.xp) parts.push(rewards.xp + ' xp');
        return parts.length ? parts.join(', ') : 'none';
    }

    _timeOfDayText() {
        var dayNight = this.engine ? this.engine.dayNight : null;
        if (!dayNight) return 'Unknown';

        var time = this._safeNumber(dayNight.time, 0);
        var hour = Math.floor(time / 3600) % 24;
        var minute = Math.floor((time % 3600) / 60);
        var label = 'Night';

        if (hour >= 5 && hour < 7) label = 'Pre-dawn';
        else if (hour >= 7 && hour < 9) label = 'Dawn';
        else if (hour >= 9 && hour < 12) label = 'Morning';
        else if (hour >= 12 && hour < 14) label = 'Noon';
        else if (hour >= 14 && hour < 18) label = 'Afternoon';
        else if (hour >= 18 && hour < 20) label = 'Dusk';
        else if (hour >= 20 && hour < 22) label = 'Evening';

        return label + ' (' + (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute + ')';
    }

    _slotIcon(item) {
        return this._itemIcon(item);
    }

    _itemIcon(item) {
        if (!item) return '--';

        var name = (item.id || item.type || item.name || '').toLowerCase();
        var category = (item.category || '').toLowerCase();

        if (name.indexOf('health') !== -1 || name.indexOf('heal') !== -1) return 'HP';
        if (name.indexOf('mana') !== -1 || name.indexOf('mp') !== -1) return 'MP';
        if (category === 'weapon' || item.slot === 'mainHand') return 'AT';
        if (category === 'armor' || item.slot === 'chest') return 'AR';
        if (category === 'consumable') return 'IT';
        if (category === 'ammo') return 'AM';
        if (category === 'currency' || name === 'gold') return 'GD';
        return (item.name || item.id || 'IT').substr(0, 2).toUpperCase();
    }

    _effectIcon(name) {
        var key = (name || '').toLowerCase();
        if (key.indexOf('poison') !== -1) return 'PS';
        if (key.indexOf('burn') !== -1) return 'BR';
        if (key.indexOf('freeze') !== -1) return 'FR';
        if (key.indexOf('slow') !== -1) return 'SL';
        if (key.indexOf('stun') !== -1) return 'ST';
        if (key.indexOf('shield') !== -1) return 'SH';
        if (key.indexOf('regen') !== -1) return 'RG';
        return (name || 'FX').substr(0, 2).toUpperCase();
    }

    _prettyRelation(relation) {
        if (relation === 'foe' || relation === 'enemy' || relation === 'hostile') return 'Hostile';
        if (relation === 'ally' || relation === 'friendly') return 'Allied';
        if (relation === 'neutral') return 'Neutral';
        return relation ? relation.charAt(0).toUpperCase() + relation.slice(1) : 'Unknown';
    }

    _getInitials(name) {
        var text = (name || 'Player').trim();
        if (!text) return 'P';
        var parts = text.split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substr(0, 1).toUpperCase();
        }
        return (parts[0].substr(0, 1) + parts[1].substr(0, 1)).toUpperCase();
    }

    _safeNumber(value, fallback) {
        var num = Number(value);
        if (isNaN(num)) return fallback || 0;
        return Math.round(num);
    }

    _esc(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _escAttr(value) {
        return this._esc(value);
    }

    destroy() {
        if (this._boundResize) {
            window.removeEventListener('resize', this._boundResize);
            this._boundResize = null;
        }

        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }

        this.root = null;
        this.refs = {};
    }

    // ─── Fullscreen toggle ────────────────────────────────────────────────
    _toggleFullscreen() {
        var doc = document.documentElement;

        if (!document.fullscreenElement) {
            if (doc.requestFullscreen) {
                doc.requestFullscreen().catch(function(err) {
                    console.log('[RealmGameUI] Fullscreen error:', err);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
};
