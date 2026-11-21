// Движение по проложенному пути (для сюжетных сцен) и физика отрезков.
//
// Прежние 10 проверок относились к GestureParser — управлению тапом по полу.
// Этот способ отвергнут: на телефоне палец закрывает экран, попасть в точку
// нельзя, а «идти к точке» превращалось в телепортацию. Управление теперь
// левый стик + свайп (tests/layout.test.mjs, tests/joystick.test.mjs),
// а физика шага — tests/movement.test.mjs.

import { stepAlong } from '../src/core/input.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const path = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }];

t('идёт по пути, а не телепортируется к концу', () => {
  const r = stepAlong(path, { i: 0, x: 0, z: 0 }, 1, 0.5);
  ok(Math.abs(r.x - 0.5) < 1e-6, `за полсекунды прошёл ${r.x.toFixed(2)} м вместо 0.5`);
  ok(!r.done, 'путь закончился на полпути');
});

t('проходит поворот и доходит до конца', () => {
  let p = { i: 0, x: 0, z: 0 };
  let guard = 0;
  while (guard++ < 50) {
    const r = stepAlong(path, p, 1, 0.2);
    p = { i: r.i, x: r.x, z: r.z };
    if (r.done) break;
  }
  ok(Math.abs(p.x - 1) < 1e-6 && Math.abs(p.z - 1) < 1e-6, `финиш в (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
});

t('на повороте направление меняется', () => {
  const before = stepAlong(path, { i: 0, x: 0.2, z: 0 }, 1, 0.1);
  const after = stepAlong(path, { i: 1, x: 1, z: 0.2 }, 1, 0.1);
  ok(Math.abs(before.dir - after.dir) > 0.5, `направление почти не изменилось: ${before.dir.toFixed(2)} → ${after.dir.toFixed(2)}`);
});

t('принимает и массив точек, и объект { points }', () => {
  const a = stepAlong(path, { i: 0, x: 0, z: 0 }, 1, 0.3);
  const b = stepAlong({ points: path }, { i: 0, x: 0, z: 0 }, 1, 0.3);
  ok(Math.abs(a.x - b.x) < 1e-9, 'форма пути меняет результат');
});

t('пустой путь не роняет игру', () => {
  const r = stepAlong([], { i: 0, x: 0, z: 0 }, 1, 0.3);
  ok(r.done === true, 'пустой путь не считается пройденным');
  ok(Number.isFinite(r.x) && Number.isFinite(r.z), 'вернул NaN');
});

t('скорость влияет линейно', () => {
  const slow = stepAlong(path, { i: 0, x: 0, z: 0 }, 0.5, 1);
  const fast = stepAlong(path, { i: 0, x: 0, z: 0 }, 1, 1);
  ok(fast.x > slow.x * 1.9, `скорость не влияет: ${slow.x.toFixed(2)} и ${fast.x.toFixed(2)}`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
