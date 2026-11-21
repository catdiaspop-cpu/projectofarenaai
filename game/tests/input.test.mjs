// Проверки ввода и навигации внутри комнаты — без браузера.

import { GestureParser, GESTURE, planWalk, stepAlong, segmentHits, HOLD_MS } from '../src/core/input.mjs';
import { LAYOUT } from '../src/data/layout.mjs';
import { PROPS } from '../src/world/props.mjs';
import { roomById } from '../src/sim/graph.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

/** Собирает события парсера в список. */
function collect() {
  const events = [];
  const p = new GestureParser({ on: (e) => events.push(e) });
  return { p, events };
}

t('тап распознаётся', () => {
  const { p, events } = collect();
  p.down({ id: 1, x: 100, y: 100, t: 0, target: 'room' });
  p.up({ id: 1, x: 102, y: 101, t: 90 });
  ok(events.length === 1 && events[0].type === GESTURE.TAP, 'нет тапа');
  ok(events[0].target === 'room', 'тап потерял цель');
});

t('удержание срабатывает через 340 мс и повторяется', () => {
  const { p, events } = collect();
  p.down({ id: 1, x: 50, y: 50, t: 0, target: 'listen' });
  p.tick(200);
  ok(events.length === 0, 'сработало слишком рано');
  p.tick(HOLD_MS);
  ok(events.length === 1 && events[0].type === GESTURE.HOLD, 'нет удержания');
  p.tick(HOLD_MS + 260);
  ok(events.length === 2 && events[1].repeat, 'нет повтора удержания');
  p.up({ id: 1, x: 50, y: 50, t: 900 });
  ok(events.some((e) => e.type === GESTURE.HOLD_END), 'нет окончания удержания');
  ok(!events.some((e) => e.type === GESTURE.TAP), 'удержание не должно давать тап');
});

t('свайп вправо и влево дают направление', () => {
  for (const [dx, dir] of [[60, 1], [-60, -1]]) {
    const { p, events } = collect();
    p.down({ id: 1, x: 200, y: 300, t: 0, target: 'look' });
    p.move({ id: 1, x: 200 + dx, y: 302, t: 60 });
    p.up({ id: 1, x: 200 + dx, y: 302, t: 80 });
    const sw = events.find((e) => e.type === GESTURE.SWIPE);
    ok(sw, `нет свайпа при dx=${dx}`);
    ok(sw.dir === dir, `неверное направление: ${sw.dir}`);
    ok(!events.some((e) => e.type === GESTURE.TAP), 'свайп не должен давать тап');
  }
});

t('дрожание пальца не превращается в свайп', () => {
  const { p, events } = collect();
  p.down({ id: 1, x: 200, y: 300, t: 0, target: 'x' });
  p.move({ id: 1, x: 206, y: 304, t: 40 });
  p.up({ id: 1, x: 207, y: 305, t: 90 });
  ok(events.some((e) => e.type === GESTURE.TAP), 'дрожание должно быть тапом');
  ok(!events.some((e) => e.type === GESTURE.SWIPE), 'дрожание не свайп');
});

t('двойной тап распознаётся и не считается двумя переходами', () => {
  const { p, events } = collect();
  p.down({ id: 1, x: 100, y: 100, t: 0, target: 'floor' });
  p.up({ id: 1, x: 100, y: 100, t: 55 });
  p.down({ id: 1, x: 102, y: 102, t: 180, target: 'floor' });
  p.up({ id: 1, x: 102, y: 102, t: 210 });
  const taps = events.filter((e) => e.type === GESTURE.TAP).length;
  const dbl = events.filter((e) => e.type === GESTURE.DOUBLE).length;
  ok(dbl === 1, 'нет двойного тапа');
  ok(taps === 1, `лишние тапы: ${taps}`);
});

t('второй палец отменяет текущий жест', () => {
  const { p, events } = collect();
  p.down({ id: 1, x: 100, y: 100, t: 0, target: 'a' });
  p.down({ id: 2, x: 300, y: 300, t: 20, target: 'b' });
  ok(events.some((e) => e.type === GESTURE.CANCEL), 'нет отмены');
  p.up({ id: 1, x: 100, y: 100, t: 60 });
  ok(!events.some((e) => e.type === GESTURE.TAP), 'после отмены не должно быть тапа');
});

// ─────────────────────────── ХОДЬБА ───────────────────────────

function obstaclesOf(roomId) {
  const room = roomById(roomId);
  const lay = LAYOUT[roomId];
  const obs = [];
  for (const it of lay.items) {
    const fp = PROPS[it.prop].footprint ?? { w: 0.3, d: 0.3 };
    // ковры и дорожки не мешают
    if (it.id === 'rug' || it.id === 'runner' || it.id === 'mat') continue;
    const rot = it.rot ?? 0;
    const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
    const w = fp.w * c + fp.d * s, d = fp.w * s + fp.d * c;
    obs.push({ id: it.id, x0: it.x - w / 2, x1: it.x + w / 2, z0: it.z - d / 2, z1: it.z + d / 2 });
  }
  return { obs, room };
}

t('в детской можно дойти до всех ключевых точек, обходя мебель', () => {
  const { obs } = obstaclesOf('childroom');
  const targets = [
    { name: 'дверь', x: 2.0, z: 3.2 },
    { name: 'кровать', x: 1.28, z: 2.45 },
    { name: 'стол', x: 1.75, z: 1.0 },
    { name: 'шкаф', x: 2.75, z: 1.7 },
    { name: 'полка', x: 2.6, z: 0.8 },
  ];
  const start = { x: 1.7, z: 2.7 };
  for (const tg of targets) {
    const path = planWalk(start, tg, obs);
    ok(path.length >= 2, `${tg.name}: нет пути`);
    // ни один сегмент не должен проходить сквозь мебель (кроме старта/финиша вплотную)
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      ok(!segmentHits(a, b, obs, 0.1), `${tg.name}: путь проходит сквозь мебель на сегменте ${i}`);
    }
  }
});

t('путь к двери из центра комнаты — прямая', () => {
  const { obs } = obstaclesOf('childroom');
  const path = planWalk({ x: 2.0, z: 2.6 }, { x: 2.0, z: 3.25 }, obs);
  ok(path.length === 2, `должна быть прямая, а вышло ${path.length} точки`);
});

t('мальчик доходит до цели за ожидаемое время', () => {
  const { obs } = obstaclesOf('childroom');
  const path = planWalk({ x: 1.7, z: 2.7 }, { x: 1.28, z: 2.45 }, obs);
  let prog = { i: 0, x: path[0].x, z: path[0].z };
  let steps = 0;
  while (steps++ < 2000) {
    const s = stepAlong(path, prog, 0.42, 1 / 60);
    prog = { i: s.i, x: s.x, z: s.z };
    if (s.done) break;
  }
  const seconds = steps / 60;
  ok(seconds > 0.5 && seconds < 8, `до кровати ${seconds.toFixed(1)} с — нереалистично`);
  console.log(`      до кровати крадучись: ${seconds.toFixed(1)} с`);
});

t('мебель не перекрывает дверные проёмы в детской', () => {
  const { obs } = obstaclesOf('childroom');
  // проём двери в детскую локально x=2.0, z=3.4
  for (const o of obs) {
    const blocks = o.x0 < 2.45 && o.x1 > 1.55 && o.z0 < 3.4 && o.z1 > 2.95;
    ok(!blocks, `${o.id} стоит в проёме`);
  }
});

// ─────────────────────────── ИТОГ ───────────────────────────
console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
