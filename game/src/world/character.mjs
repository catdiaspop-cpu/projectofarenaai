// Мальчик 8 лет, воксельная кукла, рост 1.22 м.
//
// Пропорции (по фото детей этого возраста): голова ≈ 1/5 роста, ноги короткие,
// руки короткие, ладони и ступни крупные. Это важно: большая голова и маленькие
// ноги читаются как «ребёнок», даже на силуэте в темноте.
//
// Файл не знает про three.js. Он описывает части тела и позу,
// а сборщик сцены превращает это в меши, и анимация остаётся проверяемой в тестах.

export const BODY = {
  height: 1.22,
  head: 0.235,        // куб-голова; 1/5.2 роста — крупная, детская
  neck: 0.045,
  torsoH: 0.325,
  torsoW: 0.3,
  torsoD: 0.17,
  hipH: 0.12,
  legH: 0.34,         // вместе с бедром
  armH: 0.32,
  footL: 0.16,
  handW: 0.075,
  shoulderY: 0.9,     // от пола
  hipY: 0.46,
  eyeY: 0.06,         // от центра головы
};

const V = 0.235 / 8; // размер «вокселя» — всё кратно ему, чтобы силуэт был ступенчатым

/** Куб в локальных координатах части. */
const vox = (w, h, d, x, y, z, mat) => ({ w, h, d, x, y, z, mat });
const g = (n) => Math.round(n * 8); // сетка, чтобы воксели выравнивались

/**
 * Части тела. pivot — точка вращения в координатах персонажа (от пола).
 * boxes — в локальных координатах части относительно pivot.
 */
export const PARTS = {
  // ── голова: куб + шапка волос + глаза + румянец ──
  head: {
    pivot: [0, BODY.shoulderY + BODY.neck, 0],
    boxes: [
      vox(0.235, 0.225, 0.215, 0, 0.115, 0, 'skin'),
      vox(0.245, 0.07, 0.225, 0, 0.2, -0.005, 'hair'),        // мопс волос
      vox(0.245, 0.05, 0.06, 0, 0.17, -0.09, 'hair'),          // чёлка сзади
      vox(0.22, 0.035, 0.02, 0, 0.14, 0.105, 'hair'),          // чёлка спереди
      vox(0.035, 0.035, 0.012, -0.055, 0.105, 0.109, 'eye'),   // глаза
      vox(0.035, 0.035, 0.012, 0.055, 0.105, 0.109, 'eye'),
      vox(0.014, 0.014, 0.006, -0.05, 0.112, 0.114, 'shinelight'),
      vox(0.014, 0.014, 0.006, 0.06, 0.112, 0.114, 'shinelight'),
      vox(0.05, 0.02, 0.01, 0, 0.055, 0.11, 'mouth'),
      vox(0.03, 0.02, 0.008, -0.085, 0.075, 0.108, 'blush'),
      vox(0.03, 0.02, 0.008, 0.085, 0.075, 0.108, 'blush'),
      vox(0.03, 0.04, 0.03, 0, 0.06, 0.115, 'nose'),           // нос
      vox(0.06, 0.09, 0.06, -0.115, 0.075, 0, 'skin'),         // уши
      vox(0.06, 0.09, 0.06, 0.115, 0.075, 0, 'skin'),
    ],
  },

  // ── туловище: худи с карманом и капюшоном сзади ──
  torso: {
    pivot: [0, BODY.hipY + BODY.hipH, 0],
    boxes: [
      vox(0.3, 0.34, 0.17, 0, 0.17, 0, 'hoodie'),
      vox(0.31, 0.05, 0.18, 0, 0.02, 0, 'hoodieDark'),         // резинка снизу
      vox(0.2, 0.1, 0.02, 0, 0.12, 0.085, 'hoodieDark'),       // карман-кенгуру
      vox(0.24, 0.07, 0.1, 0, 0.3, -0.1, 'hoodie'),            // капюшон
      vox(0.026, 0.18, 0.012, -0.06, 0.26, 0.09, 'string'),
      vox(0.026, 0.18, 0.012, 0.06, 0.26, 0.09, 'string'),
      vox(0.03, 0.03, 0.014, -0.06, 0.16, 0.09, 'stringTip'),
      vox(0.03, 0.03, 0.014, 0.06, 0.16, 0.09, 'stringTip'),
    ],
  },

  // ── руки: рукава худи, кисти ──
  armL: {
    pivot: [-0.155, BODY.shoulderY, 0],
    boxes: [
      vox(0.075, 0.2, 0.08, 0, -0.1, 0, 'hoodie'),
      vox(0.07, 0.13, 0.075, 0, -0.24, 0, 'skin'),             // предплечье
      vox(0.078, 0.07, 0.085, 0, -0.29, 0, 'hand'),            // кисть
      vox(0.08, 0.03, 0.09, 0, -0.16, 0, 'hoodieDark'),        // манжета
    ],
  },
  armR: {
    pivot: [0.155, BODY.shoulderY, 0],
    boxes: [
      vox(0.075, 0.2, 0.08, 0, -0.1, 0, 'hoodie'),
      vox(0.07, 0.13, 0.075, 0, -0.24, 0, 'skin'),
      vox(0.078, 0.07, 0.085, 0, -0.29, 0, 'hand'),
      vox(0.08, 0.03, 0.09, 0, -0.16, 0, 'hoodieDark'),
    ],
  },

  // ── ноги: шорты до колена, носки ──
  legL: {
    pivot: [-0.085, BODY.hipY, 0],
    boxes: [
      vox(0.105, 0.16, 0.11, 0, -0.08, 0, 'shorts'),
      vox(0.095, 0.14, 0.1, 0, -0.23, 0, 'skin'),              // голень
      vox(0.1, 0.11, 0.1, 0, -0.36, 0, 'sock'),                // носок
      vox(0.1, 0.06, 0.155, 0, -0.44, 0.025, 'sock'),          // ступня
      vox(0.104, 0.02, 0.16, 0, -0.48, 0.025, 'sockGrip'),     // нескользящая пятка
    ],
  },
  legR: {
    pivot: [0.085, BODY.hipY, 0],
    boxes: [
      vox(0.105, 0.16, 0.11, 0, -0.08, 0, 'shorts'),
      vox(0.095, 0.14, 0.1, 0, -0.23, 0, 'skin'),
      vox(0.1, 0.11, 0.1, 0, -0.36, 0, 'sock'),
      vox(0.1, 0.06, 0.155, 0, -0.44, 0.025, 'sock'),
      vox(0.104, 0.02, 0.16, 0, -0.48, 0.025, 'sockGrip'),
    ],
  },

  // ── лис Плюш, которого он носит в левой руке ──
  plush: {
    pivot: [-0.155, BODY.shoulderY - 0.36, 0.06],
    boxes: [
      vox(0.1, 0.1, 0.13, 0, 0, 0, 'plush'),
      vox(0.07, 0.07, 0.07, 0, 0.05, 0.075, 'plushLight'),
      vox(0.025, 0.04, 0.025, -0.03, 0.11, 0.06, 'plush'),
      vox(0.025, 0.04, 0.025, 0.03, 0.11, 0.06, 'plush'),
      vox(0.012, 0.012, 0.008, -0.02, 0.06, 0.112, 'eye'),
      vox(0.012, 0.012, 0.008, 0.02, 0.06, 0.112, 'eye'),
      vox(0.05, 0.09, 0.05, 0, 0.02, -0.09, 'plush'),          // хвост
    ],
  },
};

/** Материалы персонажа (короткие имена — не путать с палитрой комнат). */
export const SKIN = {
  skin: 0xe0ac86,
  skinShade: 0xc4886a,
  hair: 0x3a2a20,
  eye: 0x1a1614,
  shinelight: 0xffffff,
  mouth: 0x9a5a52,
  blush: 0xd88a7a,
  nose: 0xd39a78,
  hoodie: 0x3f6a9a,
  hoodieDark: 0x325474,
  string: 0xd8d2c4,
  stringTip: 0x9aa1a7,
  hand: 0xe0ac86,
  shorts: 0x4a5a44,
  sock: 0xd8d2c4,
  sockGrip: 0x6a5f52,
  plush: 0xc0703a,
  plushLight: 0xe0b083,
};

// ───────────────────────────────────────────────────────────────────────────
// Поза. Чистая функция от (состояние, время) — без three.js.
// ───────────────────────────────────────────────────────────────────────────

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const TAU = Math.PI * 2;

/**
 * @param {object} s
 *   speed: 0..1 — насколько быстро идёт
 *   crouch: 0..1 — присел
 *   scared: 0..1 — страх, дрожь и сжатые руки
 *   tiptoe: 0..1 — идёт на носках (медленно, тихо)
 *   look: -1..1 — куда смотрит (влево/вправо)
 *   reach: 0..1 — тянется вверх
 *   held: 'none'|'flashlight'|'plush' — что в руке
 *   breathing: насколько тяжело дышит (0..1)
 * @param {number} t — время в секундах
 */
export function pose(s, t) {
  const speed = s.speed ?? 0;
  const crouch = s.crouch ?? 0;
  const scared = s.scared ?? 0;
  const tiptoe = s.tiptoe ?? 0;
  const look = s.look ?? 0;
  const reach = s.reach ?? 0;
  const breathing = s.breathing ?? 0.3;

  // шаг: фаза бега от скорости
  const stride = speed > 0.02 ? t * (5.2 + speed * 2.5) * TAU : 0;
  const swing = Math.sin(stride) * (0.28 + speed * 0.55) * (speed > 0.02 ? 1 : 0);
  const bob = Math.abs(Math.cos(stride)) * (0.012 + speed * 0.022);
  const sway = Math.sin(stride) * 0.035 * speed;

  // дыхание: грудь и плечи
  const breath = Math.sin(t * (1.1 + breathing * 1.3)) * (0.008 + breathing * 0.012);

  // дрожь от страха
  const shake = scared * 0.006;
  const shX = Math.sin(t * 23.1) * shake;
  const shY = Math.sin(t * 19.7 + 1.3) * shake * 0.7;

  // присед: опускаем корень, наклоняем корпус, сгибаем ноги
  const rootY = -crouch * 0.2 + bob + breath * 0.4;
  const lean = crouch * 0.32 + speed * 0.1 + scared * 0.06;

  // руки: при страхе поднимаются к груди, при ходьбе качаются
  const armBase = -crouch * 0.5 - scared * 0.9;
  const armL = {
    x: -swing + armBase - reach * 2.2,
    z: -0.16 - scared * 0.5 - crouch * 0.12,
  };
  const armR = {
    x: swing + armBase - reach * 1.9,
    z: 0.16 + scared * 0.5 + crouch * 0.12,
  };

  // ноги: шаг, присед, носки
  const legBend = crouch * 0.55;
  const tiptoeLift = tiptoe * Math.max(0, Math.sin(stride * 0.5)) * 0.03;
  const legL = { x: swing + legBend * 0.4, z: -0.03 - tiptoe * 0.02 };
  const legR = { x: -swing + legBend * 0.4, z: 0.03 + tiptoe * 0.02 };

  // голова: смотрит по сторонам, наклоняется, кивает при ходьбе
  const head = {
    x: -lean * 0.35 + Math.sin(stride * 2) * 0.01 * speed - reach * 0.25,
    y: look * 0.7 + Math.sin(t * 0.31) * 0.06 * (1 - speed),
    z: Math.sin(t * 0.7) * 0.015 + scared * Math.sin(t * 9) * 0.01,
  };

  // дыхание читается по животу и плечам: масштаб туловища
  const torsoScale = { x: 1 + breath * 0.9, y: 1 + breath * 1.6, z: 1 + breath * 1.2 };

  // усталость: на поздних ночах походка становится тяжелее
  const tiredDrop = s.tired ? s.tired * 0.03 : 0;

  return {
    root: {
      x: shX + sway * 0.5,
      y: rootY - tiredDrop + shY + tiptoeLift,
      z: Math.sin(stride) * 0.01 * speed,
      rotY: s.facing ?? 0,
      lean,
    },
    head,
    torso: { x: -lean * 0.5, scale: torsoScale },
    armL,
    armR,
    legL,
    legR,
    plush: { x: armL.x * 0.8, z: armL.z * 0.8 },
    blink: blinkAmount(t + (s.blinkSeed ?? 0)),
    walkPhase: stride,
    footfall: speed > 0.02 && Math.sin(stride) > 0.94,
  };
}

/** Моргание: раз в 3–6 секунд, 90 мс закрыты. */
export function blinkAmount(t) {
  const period = 4.2;
  const p = (t % period) / period;
  const start = 0.35;
  const dur = 0.028;
  if (p < start || p > start + dur) return 0;
  const k = (p - start) / dur;
  return Math.sin(k * Math.PI);
}

/** Состояния персонажа из ввода — маленький автомат. */
export const CHAR_STATES = ['idle', 'walk', 'sneak', 'run', 'listen', 'peek', 'hide', 'sleep', 'scared', 'reach'];

export function stateToPose(name, t, extra = {}) {
  switch (name) {
    case 'walk':   return pose({ speed: 0.55, ...extra }, t);
    case 'run':    return pose({ speed: 1.0, ...extra, breathing: 0.8 }, t);
    case 'sneak':  return pose({ speed: 0.22, crouch: 0.55, tiptoe: 1, ...extra }, t);
    case 'listen': return pose({ speed: 0, look: extra.look ?? 0, breathing: 0.2, ...extra }, t);
    case 'peek':   return pose({ speed: 0, crouch: 0.75, lean: 0, look: extra.look ?? 0, ...extra }, t);
    case 'hide':   return pose({ speed: 0, crouch: 1, scared: 0.8, ...extra }, t);
    case 'sleep':  return pose({ speed: 0, breathing: 0.55, ...extra }, t);
    case 'scared': return pose({ speed: 0, scared: 1, breathing: 1, ...extra }, t);
    case 'reach':  return pose({ speed: 0, reach: 1, ...extra }, t);
    default:       return pose({ speed: 0, breathing: 0.25, ...extra }, t);
  }
}

/** Габариты для коллизий: мальчик — цилиндр радиусом 0.16 м. */
export const COLLIDER = { radius: 0.16, height: 1.22, crouchHeight: 0.75 };
