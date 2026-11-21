// Сквозной прогон переходов.
//
// Дверь — самое хрупкое место в игре: тут встречаются геометрия комнаты,
// полоса проёма, столкновения и точка входа в следующей комнате. Ошибка
// стоит дорого: игрок застревает в стене и не может выйти вообще.
//
// Здесь заново проигрывается настоящий цикл main.mjs — шаг по стику,
// проверка порога, вход в новую комнату — для КАЖДОЙ двери в доме и в обе
// стороны. Без DOM и без WebGL: только та математика, что двигает мальчика.

import { step, crossedThreshold, fits } from '../src/core/movement.mjs';
import { doorOpening, entryPoint } from '../src/sim/doors.mjs';
import { roomById } from '../src/sim/graph.mjs';
import { DOORS } from '../src/data/house.mjs';
import { SPEED } from '../src/sim/graph.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

/** Направление к середине проёма из точки внутри комнаты. */
function headingTo(op, room, from) {
  const mid = (op.from + op.to) / 2;
  const target = {
    n: { x: mid, z: -1 },
    s: { x: mid, z: room.d + 1 },
    w: { x: -1, z: mid },
    e: { x: room.w + 1, z: mid },
  }[op.side];
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

/** Стартовая точка внутри комнаты, метрах в полутора от двери. */
function startPoint(op, room) {
  const mid = (op.from + op.to) / 2;
  // отступ не больше трети комнаты: коридор всего 1.5 м шириной, и «1.4 м
  // от двери» — это уже за противоположной стеной
  const back = Math.min(1.4, Math.min(room.w, room.d) * 0.35);
  if (op.side === 'n') return { x: mid, z: back };
  if (op.side === 's') return { x: mid, z: room.d - back };
  if (op.side === 'w') return { x: back, z: mid };
  return { x: room.w - back, z: mid };
}

/** Пройти в дверь. → { crossed, at, frames } */
function walkThrough(door, roomId, offset = 0.36) {
  const room = roomById(roomId);
  if (!room) return { skipped: true };
  const op = doorOpening(door, room);
  // люки в полу и потолке: створки нет, сквозь них не ходят шагом
  if (!op || op.stairs) return { skipped: true };
  const r = room.rect;
  let pos = startPoint(op, r);
  // столкновения без мебели: проверяем геометрию двери, а не расстановку
  for (let i = 0; i < 240; i++) {
    const dir = headingTo(op, r, pos);
    pos = step(pos, dir, SPEED.normal, 1 / 60, r, [], [op]).pos;
    if (crossedThreshold(pos, r, [op])) {
      const to = roomById(otherRoom(door, roomId));
      if (!to) return { crossed: true, frames: i, at: pos, to: null };
      const entry = entryPoint(door, to, offset);
      return { crossed: true, frames: i, at: pos, entry, to };
    }
  }
  return { crossed: false, frames: 240, at: pos };
}

function otherRoom(door, id) {
  return door.a === id ? door.b : door.a;
}

t('через каждую дверь в доме можно пройти', () => {
  const bad = [];
  for (const door of DOORS) {
    if (door.stairs) continue;
    for (const id of [door.a, door.b]) {
      if (!id) continue;
      const res = walkThrough(door, id);
      if (res.skipped) continue;
      if (!res.crossed) bad.push(`${door.id} из ${id}: застрял на (${res.at.x.toFixed(2)}, ${res.at.z.toFixed(2)})`);
    }
  }
  ok(bad.length === 0, 'не проходится:\n      ' + bad.join('\n      '));
});

t('переход занимает разумное время, а не минуту', () => {
  for (const door of DOORS) {
    if (door.stairs) continue;
    for (const id of [door.a, door.b]) {
      if (!id) continue;
      const res = walkThrough(door, id);
      if (res.skipped) continue;
      ok(res.frames < 120, `${door.id} из ${id}: прошёл только за ${(res.frames / 60).toFixed(1)} с`);
    }
  }
});

t('после перехода стоим не в стене и не в косяке', () => {
  for (const door of DOORS) {
    if (door.stairs) continue;
    for (const id of [door.a, door.b]) {
      if (!id) continue;
      const res = walkThrough(door, id);
      if (res.skipped || !res.to) continue;
      const e = res.entry;
      const r = res.to.rect;
      // отступ от стены больше радиуса тела
      const margin = Math.min(e.x, r.w - e.x, e.z, r.d - e.z);
      ok(margin > 0.25, `${door.id} → ${res.to.id}: отступ от стены ${margin.toFixed(2)} м`);
      ok(fits(e, r, [], []), `${door.id} → ${res.to.id}: точка входа непроходима`);
    }
  }
});

t('из точки входа можно сделать хотя бы шаг в любую сторону', () => {
  const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  for (const door of DOORS) {
    if (door.stairs) continue;
    for (const id of [door.a, door.b]) {
      if (!id) continue;
      const res = walkThrough(door, id);
      if (res.skipped || !res.to) continue;
      const moved = dirs.some((d) =>
        Math.hypot(
          step(res.entry, d, SPEED.normal, 0.2, res.to.rect, [], []).pos.x - res.entry.x,
          step(res.entry, d, SPEED.normal, 0.2, res.to.rect, [], []).pos.z - res.entry.z,
        ) > 0.05);
      ok(moved, `${door.id} → ${res.to.id}: заперт в точке входа, никуда не деться`);
    }
  }
});

t('порог не срабатывает снаружи проёма', () => {
  // Рядом с дверью стена: пройти сквозь неё нельзя, порога там нет.
  for (const door of DOORS) {
    if (door.stairs) continue;
    const room = roomById(door.a);
    const op = doorOpening(door, room);
    if (!op) continue;
    const r = room.rect;
    const mid = (op.from + op.to) / 2;
    // точка на стене в метре от проёма
    const side = { n: { x: mid + 1.2, z: 0 }, s: { x: mid + 1.2, z: r.d }, w: { x: 0, z: mid + 1.2 }, e: { x: r.w, z: mid + 1.2 } }[op.side];
    if (side.x < 0 || side.x > r.w || side.z < 0 || side.z > r.d) continue;
    const out = { x: side.x, z: side.z };
    if (op.side === 'n') out.z = -0.1;
    if (op.side === 's') out.z = r.d + 0.1;
    if (op.side === 'w') out.x = -0.1;
    if (op.side === 'e') out.x = r.w + 0.1;
    ok(!crossedThreshold(out, r, [op]), `${door.id}: порог сработал в стороне от проёма`);
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
