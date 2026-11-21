// Походка: фаза шага привязана к ПРОЙДЕННЫМ МЕТРАМ, а не к секундам.
//
// Почему так. Раньше фаза была `t * 6.6` — то есть 6.6 цикла в секунду.
// При скорости 0.95 м/с это 13 шагов в секунду: ноги мелькали в 5.5 раза
// быстрее, чем тело двигалось. Никакая «настройка скорости анимации» это
// не лечит: две величины жили независимо.
//
// Здесь единственный источник истины — расстояние. Походка физически не может
// разойтись с движением: сколько метров прошёл, столько и прошагал.
//
//   strideLength — сколько метров занимает ПОЛНЫЙ цикл (два шага)
//   phase       — 0..1 внутри цикла
//   feet        — где в этот момент каждая ступня
//
// Файл не знает про three.js: чистая математика, проверяется в node.

/** Длина полного цикла (два шага) для ребёнка 1.22 м. */
export const GAIT = {
  strideWalk: 0.72,   // спокойный шаг: 0.36 м на шаг — как у детей 8 лет
  strideSneak: 0.46,  // крадётся: короткие шаги, носки
  strideRun: 1.02,    // бежит: длиннее, но не «взрослый» бег
  minSpeed: 0.02,     // ниже — стоим
  footLiftWalk: 0.045,
  footLiftRun: 0.085,
  footLiftSneak: 0.025,
};

/** Длина цикла для режима. */
export function strideFor(mode) {
  if (mode === 'run') return GAIT.strideRun;
  if (mode === 'sneak') return GAIT.strideSneak;
  return GAIT.strideWalk;
}

/**
 * Накопить фазу по пройденному расстоянию.
 * @param {number} phase — текущая фаза 0..1
 * @param {number} distance — сколько метров прошли за кадр
 * @param {number} stride — длина полного цикла в метрах
 * @returns {number} новая фаза 0..1
 */
export function advancePhase(phase, distance, stride) {
  if (!(stride > 0.05) || !(distance > 0)) return phase;
  const next = phase + distance / stride;
  return next - Math.floor(next);
}

/** Сколько шагов в секунду при такой скорости — для проверок и звука. */
export function stepsPerSecond(speed, stride) {
  if (!(speed > 0) || !(stride > 0.05)) return 0;
  return (speed / stride) * 2;   // два шага в цикле
}

/**
 * Положение ступней в фазе.
 *
 * Ноги в противофазе. Ступня идёт назад по земле (опора) и возвращается
 * вперёд по дуге (перенос). Именно дуга отличает ходьбу от «ножниц».
 *
 * @returns {{ left: {back, lift}, right: {back, lift} }} back: -1..1, lift: 0..1
 */
export function footCycle(phase, mode = 'walk') {
  const lift = mode === 'run' ? GAIT.footLiftRun : mode === 'sneak' ? GAIT.footLiftSneak : GAIT.footLiftWalk;
  const p = phase - Math.floor(phase);
  // левая нога: перенос в первой половине цикла, опора во второй
  const leftBack = Math.cos(p * Math.PI * 2);
  const rightBack = Math.cos(p * Math.PI * 2 + Math.PI);
  // подъём — только на переносе (когда нога идёт вперёд)
  const leftLift = Math.max(0, Math.sin(p * Math.PI * 2)) * lift;
  const rightLift = Math.max(0, Math.sin(p * Math.PI * 2 + Math.PI)) * lift;
  return {
    left: { back: leftBack, lift: leftLift },
    right: { back: rightBack, lift: rightLift },
  };
}

/**
 * Покачивание корпуса по фазе: два «приседания» за цикл, на каждый шаг.
 * Возвращает 0..1 (0 — самая низкая точка, 1 — самая высокая).
 */
export function bobCycle(phase) {
  const p = phase - Math.floor(phase);
  return Math.abs(Math.sin(p * Math.PI * 2));
}

/**
 * Момент касания пола: нога проходит низ. Нужен для звука шага.
 *
 * Внимание: фаза 0 — это тоже касание (левая ступня внизу). Если считать
 * только 0.5, на каждом обороте теряется один шаг, и звук отстаёт вдвое.
 */
export function footfalls(phase, prevPhase) {
  let hits = 0;
  if (prevPhase <= phase) {
    // обычный ход: смотрим, что перескочили
    if (prevPhase < 0.5 && phase >= 0.5) hits++;
    if (phase >= 1 - 1e-9 || phase < prevPhase) hits++;   // обернулись через 0
  } else {
    // фаза обернулась через 1 — значит, точно прошли 0 (шаг) и, возможно, 0.5
    hits++;
    if (prevPhase < 0.5 && phase >= 0.5) hits++;
  }
  return hits;
}
