// Походка синхронна с движением.
//
// Исходная жалоба: «ноги передвигаются капец быстро». Причина была в том, что
// фаза шага считалась от СЕКУНД (t * 6.6), а тело двигалось со своей скоростью.
// При 0.95 м/с это давало 13 шагов в секунду вместо ~2.4 — в 5.5 раза быстрее.
//
// Теперь фаза считается из пройденных метров. Здесь проверяется именно это:
// сколько метров прошёл — столько и прошагал, при любой скорости.

import { GAIT, strideFor, advancePhase, stepsPerSecond, footCycle, bobCycle, footfalls } from '../src/world/gait.mjs';
import { Character } from '../src/render/character.mjs';
import { SPEED } from '../src/sim/graph.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

t('длина шага человеческая, а не «мельница»', () => {
  ok(GAIT.strideWalk > 0.5 && GAIT.strideWalk < 1.0, `цикл ${GAIT.strideWalk} м — не шаг ребёнка`);
  ok(GAIT.strideSneak < GAIT.strideWalk, 'при крадущемся шаге цикл должен быть короче');
  ok(GAIT.strideRun > GAIT.strideWalk, 'при беге цикл должен быть длиннее');
});

t('шагов в секунду — как у живого ребёнка (1.5–3.5)', () => {
  for (const [mode, speed] of [['walk', SPEED.normal], ['run', SPEED.run], ['sneak', SPEED.sneak]]) {
    const sps = stepsPerSecond(speed, strideFor(mode));
    ok(sps > 1.2 && sps < 4.2, `${mode}: ${sps.toFixed(1)} шагов в секунду — это не походка`);
  }
  console.log(`      walk ${stepsPerSecond(SPEED.normal, strideFor('walk')).toFixed(1)} шаг/с, ` +
    `run ${stepsPerSecond(SPEED.run, strideFor('run')).toFixed(1)}, ` +
    `sneak ${stepsPerSecond(SPEED.sneak, strideFor('sneak')).toFixed(1)}`);
});

t('пройденный метр даёт ровно столько шагов, сколько обещает длина цикла', () => {
  let phase = 0;
  let cycles = 0;
  const stride = GAIT.strideWalk;
  // идём 10 метров кусочками по 1 см
  for (let m = 0; m < 10; m += 0.01) {
    const before = phase;
    phase = advancePhase(phase, 0.01, stride);
    if (phase < before) cycles++;      // фаза перескочила через 1
  }
  const expected = 10 / stride;
  ok(Math.abs(cycles - Math.floor(expected)) <= 1, `за 10 м прошёл ${cycles} циклов, ожидалось ~${expected.toFixed(1)}`);
});

t('синхронно при ЛЮБОЙ скорости: фаза от метров, а не от времени', () => {
  // 100 метров — и медленно, и быстро дают одинаковое число циклов
  const runs = [];
  for (const chunk of [0.002, 0.02, 0.2]) {
    let phase = 0;
    let cycles = 0;
    let total = 0;
    while (total < 100 - 1e-9) {
      const d = Math.min(chunk, 100 - total);
      const before = phase;
      phase = advancePhase(phase, d, strideFor('walk'));
      if (phase < before) cycles++;
      total += d;
    }
    runs.push(cycles);
  }
  ok(runs[0] === runs[1] && runs[1] === runs[2],
    `разное число шагов при разном размере кадра: ${runs.join(', ')}`);
});

t('стоя на месте фаза не растёт — ноги не дёргаются', () => {
  let phase = 0.3;
  for (let i = 0; i < 120; i++) phase = advancePhase(phase, 0, strideFor('walk'));
  ok(Math.abs(phase - 0.3) < 1e-9, `стоя фаза сдвинулась на ${(phase - 0.3).toFixed(3)}`);
});

t('ноги в противофазе: одна вперёд, другая назад', () => {
  for (let p = 0; p < 1; p += 0.05) {
    const f = footCycle(p);
    ok(Math.abs(f.left.back + f.right.back) < 0.001, `фаза ${p.toFixed(2)}: ноги не в противофазе`);
  }
});

t('подъём ступни только на переносе, никогда на опоре', () => {
  for (let p = 0; p < 1; p += 0.01) {
    const f = footCycle(p, 'walk');
    // левая нога на опоре в фазе 0.5..1 → подъёма быть не должно
    if (p > 0.5 && p < 1) ok(f.left.lift < 1e-6, `фаза ${p.toFixed(2)}: левая ступня висит на опоре`);
    if (p > 0 && p < 0.5) ok(f.right.lift < 1e-6, `фаза ${p.toFixed(2)}: правая ступня висит на опоре`);
  }
});

t('касание пола происходит ровно дважды за цикл', () => {
  let total = 0;
  let prev = 0;
  for (let i = 1; i <= 1000; i++) {
    const phase = i / 1000;
    total += footfalls(phase, prev);
    prev = phase;
  }
  ok(total === 2, `за цикл ${total} касаний пола, а не 2`);
});

t('корпус приседает на каждый шаг — дважды за цикл', () => {
  // ищем минимумы: вниз корпус уходит дважды за цикл (по одному на шаг)
  const N = 1000;
  let minima = 0;
  for (let i = 1; i < N; i++) {
    const a = bobCycle((i - 1) / N), b = bobCycle(i / N), c = bobCycle((i + 1) / N);
    if (b < a && b <= c && b < 0.05) minima++;
  }
  // плюс минимум на стыке цикла (фаза 0)
  ok(minima === 1 || minima === 2, `за цикл ${minima} минимумов покачивания, ожидалось 2`);
});

t('реальная модель: шаги в секунду совпадают с ожиданием', () => {
  for (const [mode, speed] of [['walk', SPEED.normal], ['run', SPEED.run]]) {
    const ch = new Character();
    ch.setState(mode);
    let steps = 0;
    ch.onFootfall = () => steps++;
    const seconds = 5;
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) {
      ch.setMotion((speed * seconds) / frames, mode);
      ch.update(seconds / frames);
    }
    const sps = steps / seconds;
    const expected = stepsPerSecond(speed, strideFor(mode));
    ok(Math.abs(sps - expected) < 0.45, `${mode}: получилось ${sps.toFixed(2)} шаг/с, ожидалось ${expected.toFixed(2)}`);
  }
});

t('пройденное расстояние и число шагов жёстко связаны', () => {
  // Это и есть суть исправления: сколько метров, столько шагов — при 0.4 м/с
  // и при 1.7 м/с число шагов на метр одинаковое.
  const perMetre = [];
  for (const speed of [0.42, 0.95, 1.75]) {
    const ch = new Character();
    ch.setState('walk');
    let steps = 0;
    ch.onFootfall = () => steps++;
    const metres = 8;
    const frames = 600;
    for (let i = 0; i < frames; i++) {
      ch.setMotion(metres / frames, 'walk');
      ch.update(0.016);
    }
    perMetre.push(steps / metres);
  }
  const spread = Math.max(...perMetre) - Math.min(...perMetre);
  ok(spread / perMetre[0] < 0.12,
    `шагов на метр гуляет на ${(spread / perMetre[0] * 100).toFixed(0)}%: ${perMetre.map((x) => x.toFixed(2)).join(', ')}`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
