(function () {
  const store = window.ClippyCharacterPacks || (window.ClippyCharacterPacks = Object.create(null));
  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;

  store['ember'] = {
    id: 'ember',
    label: 'Ember',
    title: 'Ember',
    styleUrl: new URL('./ember.css', scriptUrl).href,
    configUrl: new URL('./ember.json', scriptUrl).href,
    transitions: { intro: 1220, outro: 1020 },
    svg: String.raw`<svg class="clippy-char ember-char" viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="overflow: visible">
  <defs>
    <radialGradient id="ember-halo-grad" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#ffe6a6" stop-opacity=".95"/>
      <stop offset="55%" stop-color="#ffb655" stop-opacity=".45"/>
      <stop offset="100%" stop-color="#ff7b2f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ember-halo-think-grad" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#fff8df" stop-opacity=".98"/>
      <stop offset="34%" stop-color="#ffe6ab" stop-opacity=".68"/>
      <stop offset="72%" stop-color="#bbefff" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#8fd0ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ember-flame-outer-grad" x1="48" y1="20" x2="48" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fff4b8"/>
      <stop offset="28%" stop-color="#ffc85d"/>
      <stop offset="68%" stop-color="#ff8c39"/>
      <stop offset="100%" stop-color="#d54d18"/>
    </linearGradient>
    <linearGradient id="ember-flame-outer-think-grad" x1="48" y1="20" x2="48" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fff8d6"/>
      <stop offset="24%" stop-color="#ffe49a"/>
      <stop offset="54%" stop-color="#ffb864"/>
      <stop offset="80%" stop-color="#ff8937"/>
      <stop offset="100%" stop-color="#d1551c"/>
    </linearGradient>
    <linearGradient id="ember-flame-inner-grad" x1="48" y1="32" x2="48" y2="74" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fff8db"/>
      <stop offset="45%" stop-color="#ffd877"/>
      <stop offset="100%" stop-color="#ff9443"/>
    </linearGradient>
    <linearGradient id="ember-flame-inner-think-grad" x1="48" y1="32" x2="48" y2="74" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fffdf7"/>
      <stop offset="26%" stop-color="#fff4d5"/>
      <stop offset="48%" stop-color="#f0fbff"/>
      <stop offset="72%" stop-color="#ffe0a2"/>
      <stop offset="100%" stop-color="#ffa459"/>
    </linearGradient>
    <linearGradient id="ember-core-grad" x1="48" y1="44" x2="48" y2="66" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fffcef"/>
      <stop offset="100%" stop-color="#ffd57f"/>
    </linearGradient>
    <linearGradient id="ember-core-think-grad" x1="48" y1="44" x2="48" y2="66" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="34%" stop-color="#f4fbff"/>
      <stop offset="68%" stop-color="#d9f1ff"/>
      <stop offset="100%" stop-color="#ffd99d"/>
    </linearGradient>
    <radialGradient id="ember-halo-white-grad" cx="50%" cy="44%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".96"/>
      <stop offset="45%" stop-color="#eef8ff" stop-opacity=".5"/>
      <stop offset="100%" stop-color="#d9eeff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ember-halo-blue-grad" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#eefbff" stop-opacity=".92"/>
      <stop offset="42%" stop-color="#cdefff" stop-opacity=".54"/>
      <stop offset="100%" stop-color="#7ecfff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ember-flame-outer-white-grad" x1="48" y1="20" x2="48" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="34%" stop-color="#eef8ff"/>
      <stop offset="70%" stop-color="#d6eeff"/>
      <stop offset="100%" stop-color="#9edbff"/>
    </linearGradient>
    <linearGradient id="ember-flame-outer-blue-grad" x1="48" y1="20" x2="48" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fbfeff"/>
      <stop offset="28%" stop-color="#e8f9ff"/>
      <stop offset="62%" stop-color="#bcecff"/>
      <stop offset="100%" stop-color="#78caff"/>
    </linearGradient>
    <linearGradient id="ember-flame-inner-white-grad" x1="48" y1="32" x2="48" y2="74" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="42%" stop-color="#f1faff"/>
      <stop offset="100%" stop-color="#cfeeff"/>
    </linearGradient>
    <linearGradient id="ember-flame-inner-blue-grad" x1="48" y1="32" x2="48" y2="74" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="36%" stop-color="#eefcff"/>
      <stop offset="74%" stop-color="#cdefff"/>
      <stop offset="100%" stop-color="#91d6ff"/>
    </linearGradient>
    <linearGradient id="ember-core-white-grad" x1="48" y1="44" x2="48" y2="66" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e5f6ff"/>
    </linearGradient>
    <linearGradient id="ember-core-blue-grad" x1="48" y1="44" x2="48" y2="66" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#effbff"/>
      <stop offset="100%" stop-color="#c6ebff"/>
    </linearGradient>
    <linearGradient id="ember-wax-grad" x1="35" y1="71" x2="61" y2="91" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fff5e8"/>
      <stop offset="100%" stop-color="#f2dcc8"/>
    </linearGradient>
    <linearGradient id="ember-holder-grad" x1="28" y1="82" x2="68" y2="98" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8d5a29"/>
      <stop offset="48%" stop-color="#d39143"/>
      <stop offset="100%" stop-color="#744118"/>
    </linearGradient>
  </defs>
  <ellipse class="ember-ground-shadow" cx="48" cy="104" rx="19" ry="7" fill="#4d1908" fill-opacity=".18"/>
  <g class="ember-permission-seal" opacity="0">
    <circle class="ember-permission-glow" cx="73" cy="31" r="14"/>
    <circle class="ember-permission-badge" cx="73" cy="31" r="9.2"/>
    <path class="ember-permission-question" d="M 70.4 27.2
         C 70.9 24.8, 72.5 23.8, 74.1 23.8
         C 76.6 23.8, 78.3 25.1, 78.3 27.6
         C 78.3 29.1, 77.4 30.1, 76.1 31
         C 74.8 31.8, 74.3 32.6, 74.3 34
         M 74.3 36.8 L 74.3 37.2"/>
    <path class="ember-permission-dot" d="M 74.3 37.2 L 74.3 37.2"/>
    <line class="ember-permission-ray ember-permission-ray-a" x1="61" y1="21" x2="56" y2="17"/>
    <line class="ember-permission-ray ember-permission-ray-b" x1="73" y1="16" x2="73" y2="10"/>
    <line class="ember-permission-ray ember-permission-ray-c" x1="85" y1="21" x2="90" y2="17"/>
  </g>
  <g class="ember-candle-base">
    <path class="ember-holder-shadow" d="M 29 83
         C 29 79, 67 79, 67 83
         C 67 88, 29 88, 29 83 Z"/>
    <path class="ember-holder" d="M 28 83
         C 28 77, 68 77, 68 83
         L 68 95
         C 68 101, 28 101, 28 95 Z"/>
    <path class="ember-holder-rim" d="M 28 83
         C 28 77, 68 77, 68 83
         C 68 88, 28 88, 28 83 Z"/>
    <path class="ember-wax" d="M 37 71
         C 40 68, 56 68, 59 71
         L 60 84
         C 60 88, 36 88, 36 84 Z"/>
    <path class="ember-wax-drip" d="M 40 73
         C 39.3 76.5, 39.5 81.2, 41.4 84.1
         C 43.1 86.7, 46.4 87.8, 48.8 86.2
         C 51.2 84.7, 50.7 80.8, 48.9 78.5
         C 47.1 76.2, 44.2 75.3, 43.7 72.6 Z"/>
  </g>
  <path class="ember-wick" d="M 48 67
       C 46.8 70.1, 46.8 73.5, 48 76
       C 49.2 73.5, 49.2 70.1, 48 67 Z"/>
  <g class="ember-flame-stack" transform="translate(0 -10)">
    <g class="ember-heat">
      <circle class="ember-halo" cx="48" cy="50" r="28" fill="url(#ember-halo-grad)"/>
      <g class="ember-spark-ring" opacity="0">
        <circle class="ember-spark ember-spark-a" cx="48" cy="16" r="2.5"/>
        <circle class="ember-spark ember-spark-b" cx="66" cy="28" r="2.1"/>
        <circle class="ember-spark ember-spark-c" cx="60" cy="16" r="1.7"/>
        <circle class="ember-spark ember-spark-d" cx="28" cy="31" r="2.2"/>
        <circle class="ember-spark ember-spark-e" cx="33" cy="18" r="1.6"/>
      </g>
      <path class="ember-flame-outer" d="M 48 12
           C 57.5 20.5, 64 31.5, 64 45
           C 64 57.8, 58.6 68.2, 52 76
           A 8 8 0 0 1 44 76
           C 37.4 68.2, 32 57.8, 32 45
           C 32 31.5, 38.5 20.5, 48 12 Z"/>
      <path class="ember-flame-inner" d="M 48 26
           C 53.2 32.6, 56.4 41.2, 55.6 50.5
           C 54.9 57.3, 52.2 63.3, 50.2 68
           A 5.2 5.2 0 0 1 45.8 68
           C 43.8 63.3, 41.1 57.3, 40.4 50.5
           C 39.6 41.2, 42.8 32.6, 48 26 Z"/>
      <path class="ember-core" d="M 48 37
           C 51 41.6, 52.6 46.7, 51.9 52.1
           C 51.4 56.5, 49.8 60.1, 49.3 61.8
           A 3.2 3.2 0 0 1 46.7 61.8
           C 46.2 60.1, 44.6 56.5, 44.1 52.1
           C 43.4 46.7, 45 41.6, 48 37 Z"/>
    </g>
    <g class="ember-heat-shift ember-heat-shift-white" aria-hidden="true">
      <circle class="ember-shift-halo ember-shift-halo-white" cx="48" cy="50" r="28"/>
      <path class="ember-shift-outer ember-shift-outer-white" d="M 48 12
           C 57.5 20.5, 64 31.5, 64 45
           C 64 57.8, 58.6 68.2, 52 76
           A 8 8 0 0 1 44 76
           C 37.4 68.2, 32 57.8, 32 45
           C 32 31.5, 38.5 20.5, 48 12 Z"/>
      <path class="ember-shift-inner ember-shift-inner-white" d="M 48 26
           C 53.2 32.6, 56.4 41.2, 55.6 50.5
           C 54.9 57.3, 52.2 63.3, 50.2 68
           A 5.2 5.2 0 0 1 45.8 68
           C 43.8 63.3, 41.1 57.3, 40.4 50.5
           C 39.6 41.2, 42.8 32.6, 48 26 Z"/>
      <path class="ember-shift-core ember-shift-core-white" d="M 48 37
           C 51 41.6, 52.6 46.7, 51.9 52.1
           C 51.4 56.5, 49.8 60.1, 49.3 61.8
           A 3.2 3.2 0 0 1 46.7 61.8
           C 46.2 60.1, 44.6 56.5, 44.1 52.1
           C 43.4 46.7, 45 41.6, 48 37 Z"/>
    </g>
    <g class="ember-heat-shift ember-heat-shift-blue" aria-hidden="true">
      <circle class="ember-shift-halo ember-shift-halo-blue" cx="48" cy="50" r="28"/>
      <path class="ember-shift-outer ember-shift-outer-blue" d="M 48 12
           C 57.5 20.5, 64 31.5, 64 45
           C 64 57.8, 58.6 68.2, 52 76
           A 8 8 0 0 1 44 76
           C 37.4 68.2, 32 57.8, 32 45
           C 32 31.5, 38.5 20.5, 48 12 Z"/>
      <path class="ember-shift-inner ember-shift-inner-blue" d="M 48 26
           C 53.2 32.6, 56.4 41.2, 55.6 50.5
           C 54.9 57.3, 52.2 63.3, 50.2 68
           A 5.2 5.2 0 0 1 45.8 68
           C 43.8 63.3, 41.1 57.3, 40.4 50.5
           C 39.6 41.2, 42.8 32.6, 48 26 Z"/>
      <path class="ember-shift-core ember-shift-core-blue" d="M 48 37
           C 51 41.6, 52.6 46.7, 51.9 52.1
           C 51.4 56.5, 49.8 60.1, 49.3 61.8
           A 3.2 3.2 0 0 1 46.7 61.8
           C 46.2 60.1, 44.6 56.5, 44.1 52.1
           C 43.4 46.7, 45 41.6, 48 37 Z"/>
    </g>
    <path class="ember-brow ember-brow-left" d="M39.5 48.3 Q 43 46.3 46 47.8" fill="none" stroke-linecap="round"/>
    <path class="ember-brow ember-brow-right" d="M50.3 47.8 Q 53.2 46 56.8 47.6" fill="none" stroke-linecap="round"/>
    <g transform="translate(43 55)">
      <g class="ember-eye-slot ember-eye-slot-left">
        <g class="ember-eye-blink ember-eye-blink-left">
          <ellipse class="ember-eye" cx="0" cy="0" rx="2.8" ry="3.6"/>
          <circle class="ember-eye-shine" cx="-0.9" cy="-1" r="0.95"/>
        </g>
      </g>
    </g>
    <g transform="translate(54 54)">
      <g class="ember-eye-slot ember-eye-slot-right">
        <g class="ember-eye-blink ember-eye-blink-right">
          <ellipse class="ember-eye" cx="0" cy="0" rx="2.8" ry="3.6"/>
          <circle class="ember-eye-shine" cx="-0.9" cy="-1" r="0.95"/>
        </g>
      </g>
    </g>
    <path class="ember-mouth" d="M42 64 Q 48 69 54 64" fill="none" stroke-linecap="round"/>
    <g class="ember-smoke" opacity="0" aria-hidden="true">
      <path class="ember-smoke-wisp ember-smoke-wisp-a" d="M 48 72
           C 45 66, 45 61, 42 56
           C 40 53, 40.5 49, 43.3 46"/>
      <path class="ember-smoke-wisp ember-smoke-wisp-b" d="M 49 72
           C 52 66, 52 61, 55 56
           C 57 53, 56.4 49, 53.7 46"/>
    </g>
  </g>
</svg>`
  };
})();
