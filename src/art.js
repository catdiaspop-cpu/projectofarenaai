// Рисунки предметов. Каждый — SVG-строка в локальной системе 100×100.
// Цвета подобраны под «мастерскую»: воск, латунь, бумага, свет свечи.

const stroke = '#0d0a08';

const shade = (id, c1, c2) => `
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>`;

const ART = {
  rope: () => `
    ${shade('g-rope', '#b99b66', '#6f5830')}
    <path d="M50 0 C 42 30, 58 60, 46 96"
          fill="none" stroke="url(#g-rope)" stroke-width="15" stroke-linecap="round"/>
    <path d="M50 0 C 42 30, 58 60, 46 96"
          fill="none" stroke="#e5d3a8" stroke-width="2.6" stroke-dasharray="6 7"
          stroke-linecap="round" opacity="0.5"/>
    <path d="M46 92 q-10 8 2 8" fill="none" stroke="#8a6f3c" stroke-width="5" stroke-linecap="round"/>
  `,

  candle: () => `
    ${shade('g-wax', '#f6ead1', '#c9b184')}
    <ellipse cx="50" cy="96" rx="26" ry="5" fill="#000" opacity="0.35"/>
    <rect x="34" y="44" width="32" height="52" rx="5" fill="url(#g-wax)"/>
    <path d="M34 52 q16 10 32 0" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.5"/>
    <rect x="47" y="34" width="6" height="12" fill="#3a2a18"/>
    <path d="M50 10 C 60 26, 62 34, 50 38 C 38 34, 40 26, 50 10 Z" fill="#ffd27a"/>
    <path d="M50 20 C 55 28, 55 32, 50 34 C 45 32, 45 28, 50 20 Z" fill="#fff6d8"/>`,

  jug: () => `
    ${shade('g-jug', '#8fa8ae', '#4d666d')}
    <ellipse cx="52" cy="95" rx="30" ry="5" fill="#000" opacity="0.35"/>
    <path d="M30 34 q-8 8 -2 14 q8 6 2 40 q-2 8 20 8 q22 0 20 -8 q-6 -34 2 -40 q6 -6 -2 -14 Z"
          fill="url(#g-jug)"/>
    <ellipse cx="52" cy="34" rx="22" ry="6" fill="#b9ced3"/>
    <ellipse cx="52" cy="34" rx="16" ry="4" fill="#2c4046"/>
    <path d="M36 52 q-16 6 -12 20 q4 10 14 8" fill="none" stroke="#6d878e" stroke-width="7"/>`,

  key: () => `
    ${shade('g-key', '#e0c179', '#a8873c')}
    <g fill="url(#g-key)" stroke="${stroke}" stroke-width="1.5">
      <circle cx="20" cy="50" r="15"/>
      <circle cx="20" cy="50" r="6" fill="#14100e"/>
      <rect x="34" y="45" width="52" height="10" rx="2"/>
      <rect x="68" y="55" width="8" height="14"/>
      <rect x="82" y="55" width="8" height="10"/>
    </g>`,

  float: () => `
    <circle cx="50" cy="50" r="34" fill="#d64545"/>
    <circle cx="50" cy="50" r="34" fill="none" stroke="${stroke}" stroke-width="2"/>
    <path d="M18 44 q32 -14 64 0" fill="none" stroke="#f7e0d5" stroke-width="7"/>
    <circle cx="50" cy="50" r="12" fill="#f7e0d5"/>
    <rect x="46" y="12" width="8" height="14" rx="3" fill="#8f2c2c"/>`,

  cork: () => `
    ${shade('g-cork', '#d3ac74', '#a07c46')}
    <path d="M30 26 q20 -8 40 0 l-4 50 q-16 6 -32 0 Z" fill="url(#g-cork)" stroke="${stroke}" stroke-width="1.5"/>
    <g fill="#000" opacity="0.16">
      <circle cx="42" cy="42" r="2.4"/><circle cx="58" cy="52" r="3"/><circle cx="48" cy="64" r="2"/>
      <circle cx="60" cy="36" r="1.8"/><circle cx="38" cy="56" r="1.6"/>
    </g>`,

  feather: () => `
    <path d="M62 8 C 34 30, 20 58, 22 86 C 46 78, 66 54, 70 16 Z" fill="#e8e2d4" stroke="${stroke}" stroke-width="1.5"/>
    <path d="M62 8 L 22 86" fill="none" stroke="#b8ae9a" stroke-width="1.6"/>
    <g stroke="#c9c0ad" stroke-width="1" opacity="0.8">
      <path d="M56 20 L 34 32"/><path d="M52 30 L 32 44"/><path d="M46 42 L 30 56"/><path d="M40 54 L 28 68"/>
    </g>`,

  anchor: () => `
    ${shade('g-iron', '#5c6470', '#2c323a')}
    <g stroke="${stroke}" stroke-width="1.6" fill="url(#g-iron)">
      <circle cx="50" cy="20" r="9"/>
      <rect x="45" y="28" width="10" height="52" rx="2"/>
      <rect x="26" y="38" width="48" height="8" rx="2"/>
      <path d="M18 60 q0 26 32 26 q32 0 32 -26 l-8 0 q0 18 -24 18 q-24 0 -24 -18 Z"/>
    </g>`,

  ice: () => `
    ${shade('g-ice', '#cfeaf2', '#7fb6c8')}
    <path d="M20 34 L 50 16 L 80 34 L 80 74 L 50 90 L 20 74 Z" fill="url(#g-ice)"
          stroke="#e8f7fb" stroke-width="2" opacity="0.92"/>
    <path d="M50 16 L 50 90 M20 34 L 80 74 M80 34 L 20 74" stroke="#fff" stroke-width="1.2" opacity="0.5"/>
    <path d="M30 40 L 40 46" stroke="#fff" stroke-width="2.4" opacity="0.7"/>`,

  boiler: () => `
    ${shade('g-boil', '#8a8f96', '#3d4249')}
    <ellipse cx="52" cy="94" rx="34" ry="5" fill="#000" opacity="0.4"/>
    <path d="M26 44 q-6 44 26 44 q32 0 26 -44 Z" fill="url(#g-boil)" stroke="${stroke}" stroke-width="2"/>
    <ellipse cx="52" cy="44" rx="26" ry="7" fill="#5b6169" stroke="${stroke}" stroke-width="1.5"/>
    <ellipse cx="52" cy="44" rx="18" ry="4.5" fill="#1b1f24"/>
    <path d="M40 34 q-8 -12 2 -20 q10 -8 4 -16" fill="none" stroke="#e6e1d6" stroke-width="3" opacity="0.55"/>
    <path d="M58 32 q-6 -12 4 -18 q10 -6 6 -14" fill="none" stroke="#e6e1d6" stroke-width="2.4" opacity="0.4"/>`,

  resin: () => `
    ${shade('g-resin', '#c98b3e', '#6f4517')}
    <path d="M8 92 q10 -34 44 -40 q36 -6 40 12 q4 22 -30 26 q-38 4 -54 2 Z"
          fill="url(#g-resin)" stroke="${stroke}" stroke-width="1.5"/>
    <path d="M24 74 q18 -12 40 -14" fill="none" stroke="#f0c78a" stroke-width="3" opacity="0.5"/>
    <circle cx="66" cy="44" r="4" fill="#e2a961" opacity="0.8"/>`,

  lever: () => `
    ${shade('g-lever', '#b8773f', '#6d4020')}
    <rect x="6" y="42" width="88" height="16" rx="7" fill="url(#g-lever)" stroke="${stroke}" stroke-width="1.6"/>
    <circle cx="20" cy="50" r="9" fill="#3b3630" stroke="${stroke}" stroke-width="1.6"/>
    <circle cx="20" cy="50" r="3" fill="#6d675e"/>
    <rect x="84" y="30" width="14" height="40" rx="6" fill="#8c5327" stroke="${stroke}" stroke-width="1.4"/>`,

  sand: () => `
    ${shade('g-sand', '#dcc48d', '#a58a52')}
    <path d="M6 88 q16 -34 44 -32 q30 -2 44 32 Z" fill="url(#g-sand)" stroke="${stroke}" stroke-width="1.4"/>
    <g fill="#8d7440" opacity="0.6">
      <circle cx="34" cy="78" r="1.6"/><circle cx="50" cy="70" r="1.4"/><circle cx="64" cy="80" r="1.8"/>
      <circle cx="44" cy="84" r="1.2"/><circle cx="58" cy="66" r="1.2"/><circle cx="70" cy="86" r="1.4"/>
    </g>`,

  anvil: () => `
    ${shade('g-anvil', '#6a7178', '#2f343a')}
    <path d="M14 30 h52 q14 0 16 8 h14 v10 h-16 q-4 6 -14 6 h-6 l6 24 h12 v10 h-44 v-10 h12 l6 -24 h-4 q-20 0 -24 -8 h-12 v-10 Z"
          fill="url(#g-anvil)" stroke="${stroke}" stroke-width="1.8" transform="translate(0,4)"/>
    <path d="M20 36 h40" stroke="#9aa2ab" stroke-width="2" opacity="0.55"/>`,

  powder: () => `
    ${shade('g-pow', '#5b5049', '#241d1a')}
    <path d="M22 92 q-8 -30 12 -44 q10 -8 6 -22 l22 0 q-4 14 6 22 q20 14 12 44 Z"
          fill="url(#g-pow)" stroke="${stroke}" stroke-width="1.6"/>
    <path d="M36 40 q14 8 28 0" fill="none" stroke="#8d7f73" stroke-width="2" opacity="0.6"/>
    <g fill="#1a1512" opacity="0.7">
      <circle cx="40" cy="66" r="2"/><circle cx="56" cy="74" r="2.6"/><circle cx="48" cy="84" r="2"/>
      <circle cx="62" cy="60" r="1.8"/>
    </g>`,

  sponge: () => `
    ${shade('g-sp', '#e2c98f', '#b1965a')}
    <path d="M12 46 q6 -22 34 -22 q30 0 38 18 q10 22 -8 34 q-22 14 -44 8 q-22 -6 -20 -38 Z"
          fill="url(#g-sp)" stroke="${stroke}" stroke-width="1.5"/>
    <g fill="#8c7438" opacity="0.55">
      <circle cx="34" cy="44" r="4"/><circle cx="54" cy="38" r="3"/><circle cx="46" cy="60" r="5"/>
      <circle cx="64" cy="56" r="3.4"/><circle cx="30" cy="64" r="3"/>
    </g>`,

  coal: () => `
    ${shade('g-coal', '#4a4038', '#171210')}
    <path d="M10 82 q-4 -26 20 -34 q18 -8 30 -18 q20 -6 26 14 q8 22 -10 36 q-20 16 -40 12 q-22 -2 -26 -10 Z"
          fill="url(#g-coal)" stroke="${stroke}" stroke-width="1.4"/>
    <path d="M26 62 q16 -14 34 -18" fill="none" stroke="#ff9a4a" stroke-width="2.6" opacity="0.85"/>
    <path d="M34 76 q14 -10 28 -12" fill="none" stroke="#ffc46b" stroke-width="1.8" opacity="0.6"/>
    <circle cx="60" cy="46" r="3.4" fill="#ff8a3c" opacity="0.85"/>`,

  bridge: () => `
    ${shade('g-br', '#b99b66', '#7a6234')}
    <path d="M2 20 q48 62 96 0" fill="none" stroke="url(#g-br)" stroke-width="11" stroke-linecap="round"/>
    <path d="M2 40 q48 62 96 0" fill="none" stroke="url(#g-br)" stroke-width="11" stroke-linecap="round"/>
    <g stroke="#e5d3a8" stroke-width="2" opacity="0.55">
      <path d="M20 30 L 22 46"/><path d="M40 48 L 41 64"/><path d="M60 48 L 59 64"/><path d="M80 30 L 78 46"/>
    </g>`,

  stone: () => `
    ${shade('g-st', '#8b8b84', '#4a4a45')}
    <path d="M10 90 q-8 -30 12 -46 q16 -18 40 -14 q26 4 30 26 q4 24 -14 34 q-30 14 -68 0 Z"
          fill="url(#g-st)" stroke="${stroke}" stroke-width="1.6"/>
    <path d="M30 56 q14 -10 30 -6" fill="none" stroke="#b6b6ad" stroke-width="2.4" opacity="0.5"/>
    <path d="M52 74 q10 -4 18 2" fill="none" stroke="#2c2c28" stroke-width="2" opacity="0.4"/>`,

  clay: () => `
    ${shade('g-clay', '#a06a4c', '#6a412c')}
    <path d="M8 88 q0 -32 22 -40 q10 -4 10 -14 l20 0 q0 10 10 14 q22 8 22 40 Z"
          fill="url(#g-clay)" stroke="${stroke}" stroke-width="1.6"/>
    <path d="M26 66 q24 -10 48 0" fill="none" stroke="#c08a68" stroke-width="2.4" opacity="0.6"/>
    <path d="M34 78 q16 -6 32 0" fill="none" stroke="#7d4d34" stroke-width="2" opacity="0.5"/>`,

  blank: () => `
    ${shade('g-blank', '#9aa2aa', '#4c545c')}
    <path d="M50 6 L 82 30 L 82 74 L 50 94 L 18 74 L 18 30 Z"
          fill="url(#g-blank)" stroke="#cfd6dd" stroke-width="2" opacity="0.9"/>
    <path d="M50 6 L 50 94 M18 30 L 82 74 M82 30 L 18 74" stroke="#e9eef3" stroke-width="1" opacity="0.35"/>
    <circle cx="50" cy="50" r="12" fill="none" stroke="#e9eef3" stroke-width="1.4" opacity="0.5"/>`,

  table: () => `
    ${shade('g-tbl', '#8a6138', '#3f2a18')}
    <rect x="0" y="0" width="100" height="11" rx="3" fill="url(#g-tbl)"/>
    <rect x="0" y="11" width="100" height="5" fill="#2b1c11" opacity="0.75"/>
    <rect x="7" y="16" width="9" height="84" rx="2" fill="url(#g-tbl)"/>
    <rect x="84" y="16" width="9" height="84" rx="2" fill="url(#g-tbl)"/>
    <rect x="7" y="70" width="86" height="5" rx="2" fill="#4a3119" opacity="0.85"/>
  `,

  pedestal: () => `
    ${shade('g-ped', '#7d735f', '#33302a')}
    <rect x="0" y="0" width="100" height="14" rx="3" fill="url(#g-ped)"/>
    <path d="M20 14 h60 l-7 74 h-46 Z" fill="url(#g-ped)" opacity="0.92"/>
    <rect x="4" y="86" width="92" height="14" rx="3" fill="#3a352d"/>
  `,

  shelf: () => `
    ${shade('g-shf', '#7a5a37', '#3a2818')}
    <rect x="0" y="0" width="100" height="13" rx="2" fill="url(#g-shf)"/>
    <path d="M9 13 l0 22 l9 0 l0 -22 Z" fill="#4a3119"/>
    <path d="M91 13 l0 22 l-9 0 l0 -22 Z" fill="#4a3119"/>
  `,

  crate: () => `
    ${shade('g-crt', '#96703f', '#4a3320')}
    <rect x="4" y="6" width="92" height="88" rx="4" fill="url(#g-crt)" stroke="#2b1d12" stroke-width="1.6"/>
    <path d="M4 32 h92 M4 62 h92" stroke="#2b1d12" stroke-width="1.6" opacity="0.8"/>
    <path d="M12 12 l76 76" stroke="#c8a06a" stroke-width="2.4" opacity="0.3"/>
  `,

  peg: () => `
    <rect x="28" y="0" width="44" height="15" rx="3" fill="#4a3a2c"/>
    <path d="M48 15 q5 22 13 26" fill="none" stroke="#6f5a45" stroke-width="10" stroke-linecap="round"/>
  `,

  self: () => `
    ${shade('g-self', '#544840', '#141110')}
    <path d="M50 4 q11 0 11 13 q0 10 -5 14 l7 5 q14 8 14 30 v18 h-9 v12 h-8 v-12 h-20 v12 h-8 v-12 h-9 v-18 q0 -22 14 -30 l7 -5 q-5 -4 -5 -14 q0 -13 11 -13 Z"
          fill="url(#g-self)" stroke="#6d5d54" stroke-width="1.3"/>
    <path d="M40 34 q10 6 20 0 l-3 5 q-7 4 -14 0 Z" fill="#7a685d" opacity="0.55"/>
    <path d="M50 39 v30" stroke="#2a211d" stroke-width="1.4" opacity="0.75"/>
    <circle cx="46" cy="15" r="1.9" fill="#f2e6d4" opacity="0.9"/>
    <circle cx="55" cy="15" r="1.9" fill="#f2e6d4" opacity="0.9"/>
  `,
};

// Линейные предметы (верёвка, мост) можно тянуть по форме — они и есть линия.
// Остальные вписываем с сохранением пропорций.
const STRETCH = new Set(['rope', 'bridge']);

export function artSvg(name, x, y, w, h, anchor = 'xMidYMid') {
  const make = ART[name] || ART.stone;
  const fit = anchor === 'stretch' || STRETCH.has(name) ? 'none' : `${anchor} meet`;
  return `<svg class="art" x="${x}" y="${y}" width="${w}" height="${h}"
              viewBox="0 0 100 100" preserveAspectRatio="${fit}"
              overflow="visible">${make()}</svg>`;
}

export const ART_NAMES = Object.keys(ART);
