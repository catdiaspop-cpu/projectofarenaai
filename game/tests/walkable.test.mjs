// Ходьба: важно не «стик опрашивается», а «мальчик действительно проходит».
//
// Это самый дорогой класс ошибок. Джойстик может быть идеально исправен и
// всё равно не работать, если:
//   * точка появления внутри мебели — первый шаг отменяется проверкой;
//   * в комнате нет прохода — мебель перекрывает всё, включая дверь;
//   * зону касания перекрыл другой слой интерфейса.
//
// Поэтому здесь проверяется не код, а пространство: сколько пола реально
// достижимо из стартовой точки, и что каждая комната связна.

import { World } from '../src/core/app.mjs';
import { step } from '../src/core/movement.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const ROOMS = ['childroom', 'parents', 'bath', 'corridor', 'stairs', 'hall',
  'living', 'kitchen', 'pantry', 'attic', 'basement'];

/** Все клетки, куда можно дойти шагами из start (обход в ширину). */
function reachable(room, start) {
  const r = room.roomData.rect;
  const obs = room.obstacles();
  const seen = new Map();
  const key = (p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
  seen.set(key(start), start);
  let frontier = [start];
  for (let i = 0; i < 900 && frontier.length; i++) {
    const next = [];
    for (const p of frontier) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = step(p, { x: dx, z: dz }, 0.6, 0.12, r, obs, []).pos;
        const k = key(q);
        if (seen.has(k)) continue;
        if (Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.z - p.z) < 1e-6) continue;
        seen.set(k, q);
        next.push(q);
      }
    }
    frontier = next;
  }
  return [...seen.values()];
}

t('в каждой комнате из стартовой точки есть куда идти', () => {
  const bad = [];
  for (const id of ROOMS) {
    const w = new World();
    w.room = id;
    const r = w.roomData.rect;
    const start = w.safeSpot(r.w / 2, r.d * 0.55);
    const cells = reachable(w, start);
    // клетка шага 0.6 м/с × 0.12 с = 7 см; площадь одной ~0.05 м²
    const area = cells.length * 0.072 * 0.072;
    const pct = Math.round((100 * area) / (r.w * r.d));
    if (pct < 12) bad.push(`${id}: ${pct}%`);
  }
  ok(bad.length === 0, `не пройти: ${bad.join(', ')}`);
});

t('точка появления никогда не внутри мебели', () => {
  const bad = [];
  for (const id of ROOMS) {
    const w = new World();
    w.room = id;
    const r = w.roomData.rect;
    for (const [fx, fz] of [[0.5, 0.55], [0.5, 0.2], [0.5, 0.8], [0.25, 0.5], [0.75, 0.5]]) {
      const p = w.safeSpot(r.w * fx, r.d * fz);
      const inFurniture = w.obstacles().some((o) => (
        p.x > o.x0 + 0.05 && p.x < o.x1 - 0.05 && p.z > o.z0 + 0.05 && p.z < o.z1 - 0.05
      ));
      if (inFurniture) bad.push(`${id} @${fx},${fz}`);
      if (p.x < 0.2 || p.z < 0.2 || p.x > r.w - 0.2 || p.z > r.d - 0.2) bad.push(`${id} в стене`);
    }
  }
  ok(bad.length === 0, `safeSpot ставит в мебель: ${bad.join(', ')}`);
});

t('настенный декор не мешает ногам', () => {
  // Картина на высоте 1.35 м не может быть препятствием. Раньше её проекция
  // на пол считалась мебелью, и вдоль стен появлялись невидимые бордюры.
  const bad = [];
  for (const id of ROOMS) {
    const w = new World();
    w.room = id;
    const ids = new Set(w.obstacles().map((o) => o.id));
    for (const it of [...w.lay.items, ...w.lay.clutter]) {
      const wall = it.y !== undefined && it.y > 0.4;
      if (wall && ids.has(it.id)) bad.push(`${id}.${it.id}`);
    }
  }
  ok(bad.length === 0, `висят на стене, но считаются мебелью: ${bad.join(', ')}`);
});

t('лестница занимает только свою площадку, а не весь пол', () => {
  // footprint 1.3 × 4.0 — габарит (он же нужен для плана), но ноги
  // останавливает base. Иначе в комнате 2 × 4 остаётся 8% пола.
  const w = new World();
  w.room = 'stairs';
  const steps = w.obstacles().find((o) => o.id === 'steps');
  ok(steps, 'лестница вообще не является препятствием');
  ok(steps.z1 - steps.z0 < 1.0, `под лестницей нет пола: площадка ${(steps.z1 - steps.z0).toFixed(2)} м`);
});

t('препятствия всегда числовые', () => {
  // Ошибка была такая: в obstacles() подставился объект без w/d, и все
  // препятствия комнаты превратились в NaN. Сравнения с NaN дают false,
  // поэтому мальчик проходил СКВОЗЬ стены — молча, без единого исключения.
  for (const id of ROOMS) {
    const w = new World();
    w.room = id;
    for (const o of w.obstacles()) {
      ok(Number.isFinite(o.x0) && Number.isFinite(o.x1) && Number.isFinite(o.z0) && Number.isFinite(o.z1),
        `${id}.${o.id}: габарит не число`);
      ok(o.x1 > o.x0 && o.z1 > o.z0, `${id}.${o.id}: перевёрнутый габарит`);
    }
  }
});

t('вход в новую комнату не оставляет внутри мебели', () => {
  const w = new World();
  for (const id of ROOMS) {
    w.room = id;
    const r = w.roomData.rect;
    // любая точка у стен: дверь может быть где угодно
    for (let x = 0.3; x < r.w; x += 0.4) {
      for (const p of [{ x, z: 0.36 }, { x, z: r.d - 0.36 }]) {
        const safe = w.safeSpot(p.x, p.z);
        const inside = w.obstacles().some((o) => (
          safe.x > o.x0 + 0.05 && safe.x < o.x1 - 0.05 && safe.z > o.z0 + 0.05 && safe.z < o.z1 - 0.05
        ));
        ok(!inside, `${id}: вход у двери (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) внутри мебели`);
      }
    }
  }
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
