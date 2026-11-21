// Мальчик 8 лет, рост 1.22 м. Модульная модель с суставами.
//
// Что изменилось по сравнению с воксельной куклой:
//   * конечности собраны из сегментов с СУСТАВАМИ: бедро → колено → ступня,
//     плечо → локоть → кисть. Колено и локоть реально сгибаются, поэтому
//     походка читается как походка, а не как машущие палки.
//   * кисть из ладони и большого пальца — в виде от первого лица рука
//     выглядит рукой, а не бруском.
//   * голова: череп, волосы с чёлкой и затылком, уши, нос, брови, рот.
//   * одежда отдельными объёмами: худи, капюшон, карман, манжеты, шорты,
//     носки с резинкой и нескользящей пяткой.
//
// Пропорции детские: голова ≈ 1/5 роста, короткие ноги, крупные ладони
// и ступни. На силуэте в темноте это читается как ребёнок.
//
// Файл не знает про three.js — только числа и поза. Сборка в меши
// и анимация живут в src/render/character.mjs, проверки — в tests/.

export const BODY = {
  height: 1.22,
  head: 0.235,
  headW: 0.2,
  headD: 0.19,
  neck: 0.05,
  torsoH: 0.325,
  torsoW: 0.3,
  torsoD: 0.17,
  hipH: 0.12,
  legH: 0.34,
  armH: 0.32,
  footL: 0.16,
  handW: 0.075,
  shoulderY: 0.9,
  hipY: 0.46,
  eyeY: 0.06,
  // суставы — в координатах персонажа от пола
  kneeY: 0.23,
  elbowDrop: 0.17,   // от плеча вниз
};

const vox = (w, h, d, x, y, z, mat) => ({ w, h, d, x, y, z, mat });

/**
 * Части тела. pivot — в координатах персонажа (от пола).
 * boxes — в локальных координатах части, y вниз от pivot.
 *
 * Суставы заданы отдельными группами: child — точка вращения относительно
 * pivot родителя.
 */
export const PARTS = {
  // ─────────────────────────── голова ───────────────────────────
  head: {
    pivot: [0, BODY.shoulderY + BODY.neck, 0],
    boxes: [
      // череп чуть скруглён ступеньками: шире в середине
      vox(0.19, 0.16, 0.175, 0, 0.115, 0, 'skin'),
      vox(0.2, 0.08, 0.185, 0, 0.08, 0, 'skin'),      // щёки
      vox(0.175, 0.09, 0.165, 0, 0.175, 0, 'skin'),   // лоб и темя
      // волосы: мопс, чёлка, виски, затылок
      vox(0.205, 0.075, 0.19, 0, 0.215, -0.005, 'hair'),
      vox(0.185, 0.03, 0.03, 0, 0.19, 0.088, 'hair'),  // чёлка спереди
      vox(0.03, 0.12, 0.17, -0.098, 0.14, -0.01, 'hair'), // виски
      vox(0.03, 0.12, 0.17, 0.098, 0.14, -0.01, 'hair'),
      vox(0.19, 0.13, 0.035, 0, 0.13, -0.092, 'hair'),   // затылок
      vox(0.055, 0.025, 0.02, 0, 0.24, 0.05, 'hair'),    // вихор
      // лицо
      vox(0.028, 0.032, 0.012, -0.048, 0.1, 0.093, 'eye'),
      vox(0.028, 0.032, 0.012, 0.048, 0.1, 0.093, 'eye'),
      vox(0.011, 0.011, 0.006, -0.042, 0.107, 0.098, 'shinelight'),
      vox(0.011, 0.011, 0.006, 0.054, 0.107, 0.098, 'shinelight'),
      vox(0.014, 0.008, 0.008, -0.048, 0.132, 0.093, 'brow'),
      vox(0.014, 0.008, 0.008, 0.048, 0.132, 0.093, 'brow'),
      vox(0.026, 0.03, 0.024, 0, 0.072, 0.096, 'nose'),      // нос
      vox(0.042, 0.012, 0.01, 0, 0.045, 0.092, 'mouth'),     // рот
      vox(0.026, 0.016, 0.008, -0.072, 0.062, 0.09, 'blush'), // румянец
      vox(0.026, 0.016, 0.008, 0.072, 0.062, 0.09, 'blush'),
      vox(0.02, 0.05, 0.05, -0.1, 0.085, 0, 'skin'),         // уши
      vox(0.02, 0.05, 0.05, 0.1, 0.085, 0, 'skin'),
    ],
  },

  // ─────────────────────────── туловище ───────────────────────────
  torso: {
    pivot: [0, BODY.hipY + BODY.hipH, 0],
    boxes: [
      vox(0.28, 0.3, 0.165, 0, 0.16, 0, 'hoodie'),
      vox(0.3, 0.06, 0.175, 0, 0.315, -0.005, 'hoodie'),     // плечи шире
      vox(0.29, 0.045, 0.17, 0, 0.015, 0, 'hoodieDark'),     // резинка
      vox(0.17, 0.09, 0.018, 0, 0.1, 0.086, 'hoodieDark'),   // карман
      vox(0.22, 0.075, 0.09, 0, 0.28, -0.095, 'hoodie'),     // капюшон сзади
      vox(0.2, 0.03, 0.06, 0, 0.325, -0.06, 'hoodieDark'),   // отворот капюшона
      vox(0.022, 0.15, 0.012, -0.05, 0.24, 0.088, 'string'),
      vox(0.022, 0.15, 0.012, 0.05, 0.24, 0.088, 'string'),
      vox(0.026, 0.026, 0.014, -0.05, 0.155, 0.088, 'stringTip'),
      vox(0.026, 0.026, 0.014, 0.05, 0.155, 0.088, 'stringTip'),
    ],
  },

  // ─────────────────────────── руки ───────────────────────────
  // плечо → локоть → кисть, каждая часть — своя группа вращения
  armULL: {   // upper-left: плечо
    pivot: [-0.155, BODY.shoulderY, 0],
    boxes: [
      vox(0.082, 0.17, 0.086, 0, -0.075, 0, 'hoodie'),
      vox(0.086, 0.03, 0.09, 0, -0.005, 0, 'hoodie'),        // плечевой шов
    ],
  },
  armFLL: {
    pivot: [0, -BODY.elbowDrop, 0],
    boxes: [
      vox(0.072, 0.12, 0.076, 0, -0.055, 0, 'skin'),
      vox(0.078, 0.028, 0.082, 0, -0.115, 0, 'hoodieDark'),  // манжета
    ],
  },
  handL: {
    pivot: [0, -BODY.elbowDrop - 0.13, 0],
    boxes: [
      vox(0.062, 0.075, 0.052, 0, -0.035, 0, 'hand'),        // ладонь
      vox(0.024, 0.045, 0.026, -0.035, -0.045, 0.005, 'hand'), // большой палец
      vox(0.052, 0.022, 0.046, 0, -0.082, 0.004, 'hand'),    // пальцы
    ],
  },
  armULR: {
    pivot: [0.155, BODY.shoulderY, 0],
    boxes: [
      vox(0.082, 0.17, 0.086, 0, -0.075, 0, 'hoodie'),
      vox(0.086, 0.03, 0.09, 0, -0.005, 0, 'hoodie'),
    ],
  },
  armFLR: {
    pivot: [0, -BODY.elbowDrop, 0],
    boxes: [
      vox(0.072, 0.12, 0.076, 0, -0.055, 0, 'skin'),
      vox(0.078, 0.028, 0.082, 0, -0.115, 0, 'hoodieDark'),
    ],
  },
  handR: {
    pivot: [0, -BODY.elbowDrop - 0.13, 0],
    boxes: [
      vox(0.062, 0.075, 0.052, 0, -0.035, 0, 'hand'),
      vox(0.024, 0.045, 0.026, 0.035, -0.045, 0.005, 'hand'),
      vox(0.052, 0.022, 0.046, 0, -0.082, 0.004, 'hand'),
    ],
  },

  // ─────────────────────────── ноги ───────────────────────────
  // бедро → голень → ступня
  legULL: {
    pivot: [-0.082, BODY.hipY, 0],   // бедро: вращается в бедре
    boxes: [
      vox(0.105, 0.14, 0.11, 0, -0.06, 0, 'shorts'),         // шорты
      vox(0.098, 0.08, 0.102, 0, -0.13, 0, 'skin'),          // бедро
    ],
  },
  legFLL: {
    pivot: [0, -BODY.hipY + BODY.kneeY, 0],   // колено
    boxes: [
      vox(0.088, 0.14, 0.092, 0, -0.065, 0, 'skin'),         // голень
      vox(0.094, 0.075, 0.096, 0, -0.16, 0, 'sock'),         // носок
      vox(0.098, 0.022, 0.1, 0, -0.125, 0, 'sockGrip'),      // резинка носка
    ],
  },
  // pivot — ЩИКОЛОТКА в 4.5 см над полом. Раньше здесь стояло смещение
  // от колена, и ступни висели в 22 см над полом: мальчик «парил».
  footL: {
    pivot: [0, -0.185, 0],
    boxes: [
      vox(0.094, 0.05, 0.145, 0, -0.02, 0.028, 'sock'),        // ступня
      vox(0.09, 0.045, 0.03, 0, -0.0175, 0.1, 'sock'),         // носок
      vox(0.098, 0.012, 0.15, 0, -0.039, 0.028, 'sockGrip'),   // подошва
    ],
  },
  legULR: {
    pivot: [0.082, BODY.hipY, 0],
    boxes: [
      vox(0.105, 0.14, 0.11, 0, -0.06, 0, 'shorts'),
      vox(0.098, 0.08, 0.102, 0, -0.13, 0, 'skin'),
    ],
  },
  legFLR: {
    pivot: [0, -BODY.hipY + BODY.kneeY, 0],
    boxes: [
      vox(0.088, 0.14, 0.092, 0, -0.065, 0, 'skin'),
      vox(0.094, 0.075, 0.096, 0, -0.16, 0, 'sock'),
      vox(0.098, 0.022, 0.1, 0, -0.125, 0, 'sockGrip'),
    ],
  },
  footR: {
    pivot: [0, -0.185, 0],
    boxes: [
      vox(0.094, 0.05, 0.145, 0, -0.02, 0.028, 'sock'),
      vox(0.09, 0.045, 0.03, 0, -0.0175, 0.1, 'sock'),
      vox(0.098, 0.012, 0.15, 0, -0.039, 0.028, 'sockGrip'),
    ],
  },

  // ─────────────────── лис Плюш в левой руке ───────────────────
  plush: {
    pivot: [0, -0.05, 0.05],
    boxes: [
      vox(0.09, 0.09, 0.115, 0, 0, 0, 'plush'),
      vox(0.065, 0.065, 0.065, 0, 0.045, 0.065, 'plushLight'),
      vox(0.022, 0.035, 0.022, -0.026, 0.098, 0.052, 'plush'),
      vox(0.022, 0.035, 0.022, 0.026, 0.098, 0.052, 'plush'),
      vox(0.011, 0.011, 0.008, -0.018, 0.052, 0.098, 'eye'),
      vox(0.011, 0.011, 0.008, 0.018, 0.052, 0.098, 'eye'),
      vox(0.045, 0.08, 0.045, 0, 0.015, -0.08, 'plush'),     // хвост
    ],
  },
};

/** Материалы персонажа. */
export const SKIN = {
  skin: 0xe0ac86,
  skinShade: 0xc4886a,
  hair: 0x3a2a20,
  eye: 0x1a1614,
  shinelight: 0xffffff,
  brow: 0x2c2018,
  mouth: 0x8a4a44,
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
// Поза. Чистая функция от (состояние, фаза шага) — без three.js.
// ───────────────────────────────────────────────────────────────────────────

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const TAU = Math.PI * 2;

/**
 * @param {object} s
 *   speed: 0..1 — насколько быстро идёт (для наклона и размаха)
 *   phase: 0..1 — фаза шага, привязанная к пройденным метрам (gait.mjs)
 *   mode: 'walk'|'run'|'sneak' — от него зависят подъём ступни и наклон
 *   crouch, scared, tiptoe, look, reach, breathing — как раньше
 * @param {number} t — время в секундах (для дыхания, дрожи, моргания)
 */
export function pose(s, t) {
  const speed = s.speed ?? 0;
  const phase = s.phase ?? 0;
  const mode = s.mode ?? 'walk';
  const crouch = s.crouch ?? 0;
  const scared = s.scared ?? 0;
  const tiptoe = s.tiptoe ?? 0;
  const look = s.look ?? 0;
  const reach = s.reach ?? 0;
  const breathing = s.breathing ?? 0.3;

  const moving = speed > 0.02;
  const p = phase - Math.floor(phase);
  const ang = p * TAU;

  // ── шаг: ступни в противофазе, подъём только на переносе
  const lift = mode === 'run' ? 0.085 : mode === 'sneak' ? 0.025 : 0.045;
  const swingAmp = mode === 'run' ? 0.85 : mode === 'sneak' ? 0.3 : 0.52;
  const swing = moving ? Math.sin(ang) * swingAmp : 0;
  const kneeL = moving ? Math.max(0, Math.sin(ang)) * (mode === 'run' ? 1.15 : 0.62) : 0;
  const kneeR = moving ? Math.max(0, Math.sin(ang + Math.PI)) * (mode === 'run' ? 1.15 : 0.62) : 0;
  const liftL = moving ? Math.max(0, Math.sin(ang)) * lift : 0;
  const liftR = moving ? Math.max(0, Math.sin(ang + Math.PI)) * lift : 0;

  // ── корпус: два приседания за цикл, ровно на каждый шаг

  const sway = moving ? Math.sin(ang) * 0.028 * speed : 0;
  const roll = moving ? Math.sin(ang) * 0.035 * speed : 0;

  // ── дыхание и страх
  const breath = Math.sin(t * (1.1 + breathing * 1.3)) * (0.008 + breathing * 0.012);
  const shake = scared * 0.006;
  const shX = Math.sin(t * 23.1) * shake;
  const shY = Math.sin(t * 19.7 + 1.3) * shake * 0.7;

  // присед: бедро вперёд, колено сгибается сильнее — нога укорачивается,
  // и таз опускается сам, без отдельной «высоты приседа»
  const legBend = crouch * 1.05;
  const legLx = swing + legBend * 0.55;
  const legRx = -swing + legBend * 0.55;
  const kneeLx = -kneeL - legBend * 1.35;
  const kneeRx = -kneeR - legBend * 1.35;

  // ── приземление: таз ставим так, чтобы НИЖНЯЯ ступня касалась пола
  // Это честная геометрия: угол бедра и колена определяют, насколько
  // нога стала короче. Никаких «на глаз» — поэтому ступни не тонут в полу
  // и мальчик не парит.
  // Ниже считаем только ту ногу, которая ОПОРНАЯ: подошва обязана стоять на
  // полу, а переносимая нога в это время поднимается. Если брать min или max
  // по двум ногам, получается систематический провал на 2 см (walk) и 3 см
  // (run) — ноги уходят в пол, и это видно.
  const legAngles = (A, B) => BODY.hipY - 0.23 * Math.cos(A) - 0.185 * Math.cos(A + B) - 0.045;
  const groundL = legAngles(legLx, kneeLx) + liftL;
  const groundR = legAngles(legRx, kneeRx) + liftR;
  // Опора — это ОДНА нога: та, что сейчас внизу. Ставим её подошву на пол.
  // (Брать min по двум ногам — значит ставить на пол поднятую ногу, и тогда
  // опорная уходит в пол на 4 см; это и было.)
  const support = moving || crouch > 0 ? Math.min(groundL, groundR) : Math.max(groundL, groundR);
  const rootY = -support + breath * 0.4;
  const lean = crouch * 0.32 + speed * (mode === 'run' ? 0.16 : 0.08) + scared * 0.06;
  const tiredDrop = s.tired ? s.tired * 0.03 : 0;

  // ── руки: противофаза ногам, локти сгибаются тем сильнее, чем быстрее
  const armSwing = moving ? -Math.sin(ang) * swingAmp * 0.9 : 0;
  const elbowBend = mode === 'run' ? 1.15 : mode === 'sneak' ? 0.35 : 0.42;
  const elbowL = moving ? elbowBend * (0.7 + 0.3 * Math.sin(ang)) : elbowBend * 0.6;
  const elbowR = moving ? elbowBend * (0.7 + 0.3 * Math.sin(ang + Math.PI)) : elbowBend * 0.6;

  const armBase = -crouch * 0.5 - scared * 0.9 - tiptoe * 0.1;
  const armL = { x: armSwing + armBase - reach * 2.2, z: -0.1 - scared * 0.45 - crouch * 0.12 };
  const armR = { x: -armSwing + armBase - reach * 1.9, z: 0.1 + scared * 0.45 + crouch * 0.12 };


  // ── голова: смотрит, кивает на шаге, чуть отстаёт от корпуса
  const head = {
    x: -lean * 0.35 + (moving ? Math.sin(ang * 2) * 0.012 * speed : 0) - reach * 0.25,
    y: look * 0.7 + Math.sin(t * 0.31) * 0.06 * (1 - speed),
    z: Math.sin(t * 0.7) * 0.015 + scared * Math.sin(t * 9) * 0.01,
  };

  return {
    root: {
      x: shX + sway * 0.5,
      y: rootY - tiredDrop + shY,
      z: moving ? Math.sin(ang) * 0.008 * speed : 0,
      lean,
      roll,
    },
    head,
    torso: { x: -lean * 0.5, roll: -roll * 0.6, scale: { x: 1 + breath * 0.9, y: 1 + breath * 1.6, z: 1 + breath * 1.2 } },
    armL,
    armR,
    elbowL: { x: elbowL },
    elbowR: { x: elbowR },
    handL: { x: -elbowL * 0.35 },
    handR: { x: -elbowR * 0.35 },
    legL: { x: legLx, z: -0.02 },
    legR: { x: legRx, z: 0.02 },
    kneeL: { x: kneeLx },
    kneeR: { x: kneeRx },
    footL: { x: -liftL * 3 - swing * 0.18 + tiptoe * 0.5 },
    footR: { x: -liftR * 3 + swing * 0.18 + tiptoe * 0.5 },
    plush: { x: armL.x * 0.8, z: armL.z * 0.8 },
    blink: blinkAmount(t + (s.blinkSeed ?? 0)),
    phase: p,
    moving,
    // событие шага — ровно на касании пола, дважды за цикл
    footfall: moving && (Math.sin(ang) > 0.97 || Math.sin(ang + Math.PI) > 0.97),
  };
}

/** Моргание: раз в ~4 секунды, короткое. */
export function blinkAmount(t) {
  const period = 4.1;
  const p = (t % period) / period;
  const start = 0.35;
  const dur = 0.028;
  if (p < start || p > start + dur) return 0;
  const k = (p - start) / dur;
  return Math.sin(k * Math.PI);
}

/** Состояния персонажа из ввода — маленький автомат. */
export const CHAR_STATES = ['idle', 'walk', 'sneak', 'run', 'listen', 'peek', 'hide', 'sleep', 'scared', 'reach'];

/**
 * Поза по состоянию. phase передаётся снаружи — она приходит из пройденных
 * метров, поэтому анимация не может разойтись с движением.
 */
export function stateToPose(name, t, extra = {}) {
  const phase = extra.phase ?? 0;
  switch (name) {
    case 'walk':   return pose({ speed: 0.55, phase, mode: 'walk', ...extra }, t);
    case 'run':    return pose({ speed: 1.0, phase, mode: 'run', ...extra, breathing: 0.8 }, t);
    case 'sneak':  return pose({ speed: 0.22, phase, mode: 'sneak', crouch: 0.55, tiptoe: 1, ...extra }, t);
    case 'listen': return pose({ speed: 0, phase, look: extra.look ?? 0, breathing: 0.2, ...extra }, t);
    case 'peek':   return pose({ speed: 0, phase, crouch: 0.75, look: extra.look ?? 0, ...extra }, t);
    case 'hide':   return pose({ speed: 0, phase, crouch: 1, scared: 0.8, ...extra }, t);
    case 'sleep':  return pose({ speed: 0, phase, breathing: 0.55, ...extra }, t);
    case 'scared': return pose({ speed: 0, phase, scared: 1, breathing: 1, ...extra }, t);
    case 'reach':  return pose({ speed: 0, phase, reach: 1, ...extra }, t);
    default:       return pose({ speed: 0, phase, breathing: 0.25, ...extra }, t);
  }
}

/** Габариты для коллизий: мальчик — цилиндр радиусом 0.16 м. */
export const COLLIDER = { radius: 0.16, height: 1.22, crouchHeight: 0.75 };
