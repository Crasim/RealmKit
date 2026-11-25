(function () {
  const store = window.ClippyCharacterPacks || (window.ClippyCharacterPacks = Object.create(null));
  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;

  store['saucer'] = {
    id: 'saucer',
    label: 'Alien Saucer',
    title: 'Alien Saucer',
    styleUrl: new URL('./saucer.css', scriptUrl).href,
    configUrl: new URL('./saucer.json', scriptUrl).href,
    transitions: { intro: 1180, outro: 1000 },
    svg: String.raw`<svg class="clippy-char saucer-char" viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="overflow: visible">
  <defs>
    <radialGradient id="saucer-aura-grad" cx="50%" cy="48%" r="58%">
      <stop offset="0%" stop-color="#b8fff3" stop-opacity=".85"/>
      <stop offset="55%" stop-color="#66d9ff" stop-opacity=".26"/>
      <stop offset="100%" stop-color="#66d9ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="saucer-dome-grad" x1="48" y1="24" x2="48" y2="62" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#dfffff" stop-opacity=".96"/>
      <stop offset="55%" stop-color="#9fd8ff" stop-opacity=".7"/>
      <stop offset="100%" stop-color="#5da0d8" stop-opacity=".72"/>
    </linearGradient>
    <linearGradient id="saucer-rim-grad" x1="18" y1="64" x2="78" y2="84" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8b93b1"/>
      <stop offset="45%" stop-color="#d7def0"/>
      <stop offset="100%" stop-color="#5e688a"/>
    </linearGradient>
    <linearGradient id="saucer-body-grad" x1="20" y1="68" x2="76" y2="86" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#596179"/>
      <stop offset="48%" stop-color="#b5bdd5"/>
      <stop offset="100%" stop-color="#444c66"/>
    </linearGradient>
    <linearGradient id="saucer-beam-grad" x1="48" y1="78" x2="48" y2="112" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#d4fff4" stop-opacity=".85"/>
      <stop offset="100%" stop-color="#6be4ff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <ellipse class="saucer-ground-shadow" cx="48" cy="106" rx="20" ry="7"/>
  <ellipse class="saucer-aura" cx="48" cy="60" rx="31" ry="22" fill="url(#saucer-aura-grad)"/>
  <g class="saucer-think-signal" opacity="0">
    <path class="saucer-think-wave saucer-think-wave-a" d="M 41.5 10.5 C 38.7 11.2, 37.2 12.3, 36.8 14 C 37.2 15.7, 38.7 16.8, 41.5 17.5"/>
    <path class="saucer-think-wave saucer-think-wave-b" d="M 37.5 8.7 C 33.3 9.9, 31.1 11.6, 30.5 14 C 31.1 16.4, 33.3 18.1, 37.5 19.3"/>
    <path class="saucer-think-wave saucer-think-wave-c" d="M 54.5 10.5 C 57.3 11.2, 58.8 12.3, 59.2 14 C 58.8 15.7, 57.3 16.8, 54.5 17.5"/>
    <path class="saucer-think-wave saucer-think-wave-d" d="M 58.5 8.7 C 62.7 9.9, 64.9 11.6, 65.5 14 C 64.9 16.4, 62.7 18.1, 58.5 19.3"/>
  </g>
  <g class="saucer-permission-signal" opacity="0">
    <circle class="saucer-permission-glow" cx="73" cy="30" r="13"/>
    <circle class="saucer-permission-badge" cx="73" cy="30" r="8.6"/>
    <path class="saucer-permission-question" d="M 70.4 26.2
         C 70.9 23.9, 72.4 22.9, 74 22.9
         C 76.4 22.9, 78 24.2, 78 26.5
         C 78 28, 77.1 29, 75.9 29.8
         C 74.7 30.6, 74.2 31.4, 74.2 32.8
         M 74.2 35.4 L 74.2 35.8"/>
    <line class="saucer-permission-ray saucer-permission-ray-a" x1="61" y1="21" x2="56" y2="17"/>
    <line class="saucer-permission-ray saucer-permission-ray-b" x1="73" y1="16" x2="73" y2="10"/>
    <line class="saucer-permission-ray saucer-permission-ray-c" x1="85" y1="21" x2="90" y2="17"/>
  </g>
  <g class="saucer-beam" opacity="0">
    <path class="saucer-beam-core" d="M 41 77
         C 44 84, 43 93, 38 106
         L 58 106
         C 53 93, 52 84, 55 77 Z"/>
    <path class="saucer-beam-line saucer-beam-line-a" d="M 44 78 C 43 86, 43 94, 44 103"/>
    <path class="saucer-beam-line saucer-beam-line-b" d="M 52 78 C 53 86, 53 94, 52 103"/>
  </g>
  <g class="saucer-craft">
    <path class="saucer-antenna" d="M 48 24 L 48 16"/>
    <circle class="saucer-antenna-tip" cx="48" cy="14" r="2.4"/>
    <path class="saucer-dome" d="M 31 58
         C 31 39, 39 24, 48 24
         C 57 24, 65 39, 65 58
         Z"/>
    <path class="saucer-dome-shine" d="M 38 31
         C 34 37, 34 46, 37 54"/>
    <path class="saucer-neck" d="M 43 57
         C 43 54, 53 54, 53 57
         L 53 62
         C 53 64, 43 64, 43 62 Z"/>
    <ellipse class="saucer-alien-head" cx="48" cy="46" rx="11.5" ry="13.5"/>
    <path class="saucer-alien-cheeks" d="M 39 51
         C 41 56, 55 56, 57 51"/>
    <g transform="translate(43 45)">
      <g class="saucer-eye-slot saucer-eye-slot-left">
        <g class="saucer-eye-blink saucer-eye-blink-left">
          <ellipse class="saucer-eye" cx="0" cy="0" rx="2.5" ry="3.8"/>
          <circle class="saucer-eye-shine" cx="-0.8" cy="-1" r=".9"/>
        </g>
      </g>
    </g>
    <g transform="translate(53 45)">
      <g class="saucer-eye-slot saucer-eye-slot-right">
        <g class="saucer-eye-blink saucer-eye-blink-right">
          <ellipse class="saucer-eye" cx="0" cy="0" rx="2.5" ry="3.8"/>
          <circle class="saucer-eye-shine" cx="-0.8" cy="-1" r=".9"/>
        </g>
      </g>
    </g>
    <path class="saucer-mouth" d="M 44 53 Q 48 56 52 53"/>
    <ellipse class="saucer-rim-shadow" cx="48" cy="67" rx="25" ry="6.8"/>
    <ellipse class="saucer-rim" cx="48" cy="66" rx="29" ry="9"/>
    <path class="saucer-body" d="M 19 67
         C 24 60, 72 60, 77 67
         C 73 78, 60 84, 48 84
         C 36 84, 23 78, 19 67 Z"/>
    <path class="saucer-rim-highlight" d="M 28 63
         C 36 60, 60 60, 68 63"/>
    <circle class="saucer-window saucer-window-a" cx="34" cy="72" r="3.1"/>
    <circle class="saucer-window saucer-window-b" cx="48" cy="75" r="3.2"/>
    <circle class="saucer-window saucer-window-c" cx="62" cy="72" r="3.1"/>
  </g>
</svg>`
  };
})();
