// Палитра и материалы. Всё низкополигональное, «детская книга, которую испортили».
// Цвета заданы в sRGB-шестнадцатеричном виде и конвертируются гаммой в renderer.

export const PALETTE = {
  // стены и пол
  wallpaper:   0x6a5d4b,  // обои с утятами: тёплый серо-коричневый
  wallpaper2:  0x7a6b55,  // полоса обоев
  wainscot:    0x4a3c2e,  // панель снизу
  ceiling:     0x8a8278,
  floorWood:   0x4b3627,
  floorWood2:  0x5a4130,
  carpet:      0x38404a,
  carpetRed:   0x5a3030,
  lino:        0x585048,

  // дерево
  walnut:      0x53381f,
  oak:         0x7d5a33,
  pine:        0xa07c4f,
  plywood:     0xb08a5c,
  chipboard:   0x8a7250,

  // двери и наличники
  door:        0x6b4527,  // створка: тёплое дерево
  doorPanel:   0x7a5230,  // филёнка чуть светлее
  doorDark:    0x4e3219,  // торец и низ
  trim:        0xd8d0c0,  // наличник, плинтус, косяк
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
