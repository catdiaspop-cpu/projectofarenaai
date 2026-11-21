// Палитра и материалы. Всё низкополигональное, «детская книга, которую испортили».
// Цвета заданы в sRGB-шестнадцатеричном виде и конвертируются гаммой в renderer.

export const PALETTE = {
  // стены и пол
  // Обои: раньше это был один серо-коричневый тон на всю игру, и стена
  // читалась как мокрая тряпка. Теперь у обоев есть светлая основа, полоса
  // темнее на 12–18 %, и третий цвет — бордюр и филёнки. Разница между
  // комнатами видна по стене, а не только по мебели.
  wallpaper:   0x8d7f68,  // обои: тёплая пыльная охра
  wallpaper2:  0x7b7f86,  // обои: холодный серо-голубой
  wainscot:    0x4a3c2e,  // панель снизу

  // панели и полосы обоев по комнатам: один цвет на весь дом — это «каша»
  wainscotGreen: 0x50604a,  // детская: зеленоватая панель
  wainscotBlue:  0x46536a,  // спальня: синеватая
  wainscotRed:   0x6a4245,  // гостиная: бордовая
  wainscotCream: 0x8f8674,  // кухня и коридор: светлая
  wainscotStone: 0x6f6d66,  // ванная: камень
  // Поля филёнок: тот же цвет панели, но на 12 % светлее. Белый trim здесь
  // не годится — на тёмной панели он читается как приклеенный лист бумаги,
  // а не как столярка.
  filletGreen:   0x62735b,
  filletCream:   0xa39a86,
  filletRed:     0x7d5154,
  filletBlue:    0x56647e,
  filletStone:   0x82817a,
  stripeRose:    0xa08c7c,  // полоса обоев в детской
  stripeCool:    0x8890a0,  // прохладная полоса
  stripeWarm:    0x9c8b71,  // тёплая полоса
  bathWall:      0x8a8f8c,  // стены ванной: плитка, а не тюль
  ceiling:     0x9a9287,
  floorWood:   0x5a4029,
  floorWood2:  0x6a4c33,
  carpet:      0x38404a,
  carpetRed:   0x5a3030,
  lino:        0x635a50,

  // дерево
  walnut:      0x5d3f24,
  oak:         0x8a6438,
  pine:        0xac875a,
  plywood:     0xb08a5c,
  chipboard:   0x8a7250,

  // двери и наличники
  door:        0x6b4527,  // створка: тёплое дерево
  doorPanel:   0x7a5230,  // филёнка чуть светлее
  doorDark:    0x4e3219,  // торец и низ
  trim:        0xe2dacb,  // наличник, плинтус, косяк
  doorHandle:  0xb99a5c,  // латунная ручка

  // ткань и мягкое
  sheet:       0xd6cdbb,
  sheet2:      0xc4b9a4,
  blanket:     0x3f5566,
  pillow:      0xe2dacb,
  sofa:        0x4c4238,
  curtain:     0x6d5f52,
  tulle:       0xbfc4c2,

  // пластик и металл
  plastic:     0xcfc8ba,
  plasticDark: 0x4a4740,
  metal:       0x9aa1a7,
  metalDark:   0x4d5258,
  steel:       0xb6bcc0,
  brass:       0xa8834a,
  black:       0x1b1815,
  rubber:      0x2b2b2b,

  // стекло и свет
  glass:       0x93b8c6,
  glassDark:   0x40586b,
  bulb:        0xfff0cc,
  candle:      0xf2e3bd,
  ember:       0xff9a4a,

  // детали комнат: книги, картон, плетение, бумага
  bookRed:     0x8c3a30,
  bookBlue:    0x33465f,
  bookGreen:   0x3f5a44,
  bookBrown:   0x6a4a30,
  paperShadow: 0xb8ae98,
  cardboard:   0x9c7a52,
  cardboardDark: 0x7d5f3d,
  tape:        0xc9b98a,
  wicker:      0xa88452,
  teaDark:     0x3a2418,
  cloth1:      0x8f8a80,
  cloth2:      0x6a5f55,

  // еда и мелочи
  bread:       0xc08a4a,
  milk:        0xe8e6de,
  apple:       0xa8342e,
  cookie:      0x9a6b3a,
  paper:       0xe8e2d2,
  paper2:      0xd2c9b2,
  yellow:      0xd8b34a,
  red:         0x9e3b32,
  blue:        0x3c5a7a,
  green:       0x4a6b4a,
  cyan:        0x4a7a86,
  cyanDark:    0x2e5561,
  purple:      0x5a4566,
  plush:       0xc0703a,  // лис Плюш
  plushLight:  0xe0b083,
  toyRed:      0xb84a3a,
  toyBlue:     0x40658c,
  toyGreen:    0x5c8452,
  toyYellow:   0xd6b84e,

  // «снаружи»
  nightSky:    0x0b1424,
  nightSky2:   0x121d33,
  moon:        0xcfdcff,
  star:        0xaebcd6,
  foliage:     0x2c3a2c,
  asphalt:     0x2a2c2e,
  vanWhite:    0xb8b8b4,

  // снаряжение
  flashlight:  0x2f3236,
  battery:     0x8a2f2f,
};

// Материал по ключу: цвет + шероховатость/металличность. Ключей может не быть — сработает цвет.
export const MATERIALS = {
  wallpaper:   { rough: 0.95, metal: 0.0 },
  wainscot:    { rough: 0.85, metal: 0.0 },
  ceiling:     { rough: 1.0,  metal: 0.0 },
  floorWood:   { rough: 0.78, metal: 0.0 },
  carpet:      { rough: 1.0,  metal: 0.0 },
  walnut:      { rough: 0.62, metal: 0.0 },
  oak:         { rough: 0.7,  metal: 0.0 },
  pine:        { rough: 0.8,  metal: 0.0 },
  sheet:       { rough: 1.0,  metal: 0.0 },
  blanket:     { rough: 1.0,  metal: 0.0 },
  curtain:     { rough: 1.0,  metal: 0.0 },
  tulle:       { rough: 1.0,  metal: 0.0, transparent: 0.55 },
  plastic:     { rough: 0.55, metal: 0.0 },
  plasticDark: { rough: 0.6,  metal: 0.0 },
  metal:       { rough: 0.35, metal: 0.85 },
  metalDark:   { rough: 0.45, metal: 0.7 },
  brass:       { rough: 0.3,  metal: 0.95 },
  glass:       { rough: 0.1,  metal: 0.0, transparent: 0.28 },
  glassDark:   { rough: 0.15, metal: 0.2, transparent: 0.45 },
  bulb:        { rough: 0.4,  metal: 0.0, emissive: 1.0 },
  // ночь за окном: без свечения окно днём превращается в чёрный прямоугольник,
  // а ночью его вообще не видно — свет снаружи физически «не наш»
  nightSky:    { rough: 1.0,  metal: 0.0, emissive: 0.55 },
  moon:        { rough: 1.0,  metal: 0.0, emissive: 1.35 },
  star:        { rough: 1.0,  metal: 0.0, emissive: 0.95 },
  ember:       { rough: 0.6,  metal: 0.0, emissive: 0.6 },
  paper:       { rough: 1.0,  metal: 0.0 },
  plush:       { rough: 1.0,  metal: 0.0 },
  rubber:      { rough: 0.95, metal: 0.0 },
};

/** Цвет материала по ключу: сначала палитра, иначе сам ключ считаем числом. */
export function colorOf(key, fallback = 0x777777) {
  if (typeof key === 'number') return key;
  return PALETTE[key] ?? fallback;
}

export function materialOf(key) {
  return MATERIALS[key] ?? { rough: 0.85, metal: 0.0 };
}
