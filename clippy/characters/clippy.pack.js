(function () {
  const store = window.ClippyCharacterPacks || (window.ClippyCharacterPacks = Object.create(null));
  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;

  store['clippy'] = {
    id: 'clippy',
    label: 'Clippy',
    title: 'Clippy',
    styleUrl: new URL('./clippy.css', scriptUrl).href,
    configUrl: new URL('./clippy.json', scriptUrl).href,
    transitions: { intro: 760, outro: 620 },
    svg: String.raw`<svg class="clippy-char" viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" aria-label="Clippy">
  <defs>
    <linearGradient id="clip-grad" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#e6e9ef"/>
      <stop offset="55%" stop-color="#9aa3b2"/>
      <stop offset="100%" stop-color="#6b7485"/>
    </linearGradient>
  </defs>
  <!-- Paperclip body â€” four vertical legs drawn as a single continuous wire:
         line 1  outer-left   x=24
         line 2  inner-left   x=40
         line 3  inner-right  x=56
         line 4  outer-right  x=72
       Connectors:
         â€¢ top-outer arc 1â†’4  (wraps over the whole paperclip)
         â€¢ top-inner arc 2â†’3  (smaller loop, sits below the outer wrap)
         â€¢ bottom diagonal 2â†’4 (single bottom connector)
       Wire ends at the bottom of line 1 and bottom of line 3. Lines 1 and 4
       extend above the inner 2â†’3 arc to meet the outer 1â†’4 wrap, giving
       the classic paperclip silhouette. -->
  <path d="M 24 88
           L 24 30
           A 24 24 0 0 1 72 30
           L 72 88
           C 72 112, 40 112, 40 88
           L 40 38
           A 8 8 0 0 1 56 38
           L 56 88"
         fill="none" stroke="url(#clip-grad)" stroke-width="10"
         stroke-linecap="round" stroke-linejoin="round"/>
  <!-- highlight tracing the inside of the outer top wrap -->
  <path class="clippy-clip-highlight" d="M 30 20 A 18 10 0 0 1 66 20"
        fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="2"
        stroke-linecap="round"/>
  <!-- idea bulb: appears during thinking -->
  <g transform="translate(74 18)">
    <g class="clippy-think-bulb" opacity="0">
      <circle class="clippy-think-bulb-glow" cx="0" cy="0" r="12" fill="#ffe780"/>
      <line class="clippy-think-ray clippy-think-ray-a" x1="0" y1="-13" x2="0" y2="-18"/>
      <line class="clippy-think-ray clippy-think-ray-b" x1="9" y1="-9" x2="13" y2="-13"/>
      <line class="clippy-think-ray clippy-think-ray-c" x1="13" y1="0" x2="18" y2="0"/>
      <path class="clippy-think-bulb-body" d="M 0 -8
           C 4.8 -8, 8 -4.4, 8 0
           C 8 3.2, 6.4 5.1, 4.8 6.8
           L -4.8 6.8
           C -6.4 5.1, -8 3.2, -8 0
           C -8 -4.4, -4.8 -8, 0 -8 Z"/>
      <rect class="clippy-think-bulb-base" x="-3.5" y="6.8" width="7" height="4" rx="1.4"/>
      <path class="clippy-think-bulb-filament" d="M -2.2 0.2 Q 0 3.1 2.2 0.2"/>
      <path class="clippy-think-bulb-shine" d="M -4.2 -4.2 Q -1.8 -6.5 1.2 -5.2"/>
    </g>
  </g>
  <!-- permission prompt: appears while waiting for approval -->
  <g transform="translate(18 22)">
    <g class="clippy-permission-prompt" opacity="0">
      <circle class="clippy-permission-prompt-glow" cx="0" cy="0" r="11" fill="#ffe39a"/>
      <path class="clippy-permission-prompt-body" d="M -8 -5
           C -8 -9, -4.8 -12, 0 -12
           C 4.8 -12, 8 -9, 8 -5
           L 8 1
           C 8 5, 4.8 8, 0 8
           L -1.6 8
           L -6 12
           L -4.8 7
           C -6.8 5.8, -8 3.7, -8 1 Z"/>
      <path class="clippy-permission-question" d="M -2.8 -4.7
           C -2.3 -7.1, -0.5 -8.2, 1.2 -8.2
           C 3.8 -8.2, 5.8 -6.8, 5.8 -4.1
           C 5.8 -2.4, 4.8 -1.2, 3.1 -0.1
           C 1.5 0.9, 0.9 1.8, 0.9 3.4
           M 0.9 6.2 L 0.9 6.6"/>
      <line class="clippy-permission-prompt-ray clippy-permission-prompt-ray-a" x1="-10" y1="-8" x2="-14" y2="-12"/>
      <line class="clippy-permission-prompt-ray clippy-permission-prompt-ray-b" x1="0" y1="-14" x2="0" y2="-19"/>
      <line class="clippy-permission-prompt-ray clippy-permission-prompt-ray-c" x1="10" y1="-8" x2="14" y2="-12"/>
    </g>
  </g>
  <!-- eyes -->
  <g transform="translate(42 40)">
    <g class="clippy-eye-slot clippy-eye-slot-left">
      <g class="clippy-eye-blink clippy-eye-blink-left">
        <ellipse class="clippy-eye" cx="0" cy="0" rx="3" ry="4" fill="#1b1b1b"/>
        <circle class="clippy-eye-shine" cx="-1" cy="-1" r="1" fill="#fff"/>
      </g>
    </g>
  </g>
  <g transform="translate(56 40)">
    <g class="clippy-eye-slot clippy-eye-slot-right">
      <g class="clippy-eye-blink clippy-eye-blink-right">
        <ellipse class="clippy-eye" cx="0" cy="0" rx="3" ry="4" fill="#1b1b1b"/>
        <circle class="clippy-eye-shine" cx="-1" cy="-1" r="1" fill="#fff"/>
      </g>
    </g>
  </g>
  <!-- mouth -->
  <path class="clippy-mouth" d="M44 52 Q 49 56 54 52" stroke="#1b1b1b" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`
  };
})();
