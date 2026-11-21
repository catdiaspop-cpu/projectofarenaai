// Двери: мальчик проходит через дверь, а не телепортируется.
//
// Это была самая злая ошибка: позиция переставлялась мгновенно, а 3D-сцена
// грузилась асинхронно — один-два кадра мальчик рисовался в СТАРОЙ комнате
// с координатами НОВОЙ. Отсюда «застрял в стене».
//
// Здесь проверяется весь путь: проём в стене → шаг сквозь порог → точка
// входа с другой стороны → и то, что сквозь стену рядом с дверью не пройти.

import { fits, step, crossedThreshold, pointInOpening, SILL } from '../src/core/movement.mjs';
import { doorSide, doorOpening, entryPoint, leafTransform, leafAngle, hingePoint, leafFarPoint, swingSign } from '../src/sim/doors.mjs';
import { ROOMS, DOORS, HEIGHTS } from '../src/data/house.mjs';
import { roomById } from '../src/sim/graph.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const room = (id) => ROOMS.find((r) => r.id === id);
const door = (id) => DOORS.find((d) => d.id === id);

t('у каждой настоящей двери есть сторона и проём', () => {
  let count = 0;
  for (const d of DOORS) {
    if (!d.b) continue;
    const isHatch = d.lock === 'люк в потолке' || d.lock === 'люк в полу';
    const side = doorSide(d, room(d.a));
    if (isHatch) {
      ok(side === null, `${d.id}: люк не должен быть створкой`);
      continue;
    }
    // stairs:true — лестница между этажами: проём есть, створки нет
    if (d.stairs) {
      ok(side === null, `${d.id}: у лестницы не должно быть створки в стене`);
      ok(doorOpening(d, room(d.a)), `${d.id}: у лестницы нет прохода`);
      continue;
    }
    ok(side, `${d.id}: не найдена стена, в которой дверь`);
    const op = doorOpening(d, room(d.a));
    ok(op, `${d.id}: нет проёма`);
    ok(op.to > op.from, `${d.id}: проём нулевой ширины`);
    ok(Math.abs((op.to - op.from) - HEIGHTS.door.w) < 1e-6, `${d.id}: проём не равен ширине двери`);
    count++;
  }
  // 7 настоящих створок + 3 люка (подвал, родительская, чердак)
  // + лестница между этажами + входная дверь без второй стороны
  ok(count === 7, `настоящих створок ${count}, ожидалось 7`);
});

t('в проём можно войти, а в стену рядом — нет', () => {
  const r = room('childroom');
  const d = door('cor-child');                 // дверь в южной стене детской
  const op = doorOpening(d, r);
  const mid = (op.from + op.to) / 2;

  const inDoor = { x: mid, z: r.rect.d - 0.1 };
  const inWall = { x: mid + 1.0, z: r.rect.d - 0.1 };

  ok(pointInOpening(inDoor, r.rect, op), 'точка в дверном проёме не считается проёмом');
  ok(!pointInOpening(inWall, r.rect, op), 'точка в стене считается дверью');
  ok(fits(inDoor, r.rect, [], [op]), 'в проём нельзя войти');
});

t('сквозь стену рядом с дверью не пройти — даже вплотную', () => {
  const r = room('childroom').rect;
  const op = doorOpening(door('cor-child'), room('childroom'));
  const mid = (op.from + op.to) / 2;

  // 40 см вбок от двери — это уже стена
  let p = { x: mid + 0.4 + HEIGHTS.door.w / 2 - 0.1, z: r.d - 0.4 };
  for (let i = 0; i < 120; i++) p = step(p, { x: 0, z: 1 }, 0.95, 1 / 30, r, [], [op]).pos;
  ok(p.z <= r.d - 0.2, `прошёл сквозь стену рядом с дверью: z=${p.z.toFixed(2)} при глубине ${r.d}`);
});

t('через дверь мальчик выходит за порог, и только тогда меняется комната', () => {
  const r = room('childroom').rect;
  const op = doorOpening(door('cor-child'), room('childroom'));
  const mid = (op.from + op.to) / 2;

  let p = { x: mid, z: r.d - 0.8 };
  let crossed = null;
  let frames = 0;
  while (!crossed && frames < 300) {
    p = step(p, { x: 0, z: 1 }, 0.95, 1 / 30, r, [], [op]).pos;
    crossed = crossedThreshold(p, r, [op]);
    frames++;
  }
  ok(crossed, 'за 10 секунд не пересёк порог');
  ok(crossed.side === 's', `пересёк не ту стену: ${crossed.side}`);
  ok(frames > 5, `пересёк порог за ${frames} кадров — это телепортация, а не шаг`);
  ok(p.z > r.d, `порог пересёкнут внутри комнаты: z=${p.z.toFixed(2)}`);
});

t('точка входа в новой комнате — у той же двери, а не в центре', () => {
  const d = door('cor-child');
  const child = room('childroom');
  const cor = room('corridor');
  const entry = entryPoint(d, cor, 0.36);

  // дверь в коридоре на той же стороне, что и в детской
  const entrySide = doorSide(d, cor);
  ok(entrySide, 'дверь не найдена в коридоре');

  const att = { x: d.at.x - cor.rect.x, z: d.at.z - cor.rect.z };
  const dist = Math.hypot(entry.x - att.x, entry.z - att.z);
  ok(dist < 0.6, `вошёл в ${dist.toFixed(2)} м от двери — это уже не «у двери»`);

  // и это НЕ центр комнаты
  const centre = { x: cor.rect.w / 2, z: cor.rect.d / 2 };
  const toCentre = Math.hypot(entry.x - centre.x, entry.z - centre.z);
  ok(toCentre > 0.5, 'точка входа совпала с центром комнаты — это старая телепортация');

  // внутри комнаты, а не в стене
  ok(entry.x > 0 && entry.x < cor.rect.w, 'вошёл за пределы комнаты по x');
  ok(entry.z > 0 && entry.z < cor.rect.d, 'вошёл за пределы комнаты по z');
});

t('вход из двери не в стену: в точке входа можно стоять', () => {
  for (const d of DOORS) {
    if (!d.b) continue;
    if (d.lock === 'люк в потолке' || d.lock === 'люк в полу') continue;
    if (d.stairs) continue;
    for (const side of [d.a, d.b]) {
      const target = room(side);
      const entry = entryPoint(d, target, 0.36);
      ok(
        entry.x > 0.15 && entry.x < target.rect.w - 0.15 &&
        entry.z > 0.15 && entry.z < target.rect.d - 0.15,
        `${d.id} → ${side}: точка входа (${entry.x.toFixed(2)}, ${entry.z.toFixed(2)}) вне комнаты`,
      );
    }
  }
});

t('створка поворачивается на петле плавно, а не мгновенно', () => {
  const d = door('cor-child');
  const r = room('childroom');
  const tr = leafTransform(d, r, 0);
  ok(tr, 'нет створки');
  ok(tr.panel.w > 0.8 && tr.panel.w < 0.9, `ширина створки ${tr.panel.w}`);
  ok(tr.panel.h > 2 && tr.panel.h < 2.1, `высота створки ${tr.panel.h}`);
  ok(tr.jambs.length === 2, 'нет двух косяков');
  ok(tr.handle, 'нет ручки');

  // угол растёт монотонно и доходит до ~80°
  let prev = -1;
  for (let ms = 0; ms <= 700; ms += 50) {
    const a = leafAngle(ms / 1000, true);
    ok(a >= prev - 1e-9, 'створка дёргается назад');
    prev = a;
  }
  ok(Math.abs(leafAngle(1.0, true) - 1.42) < 0.02, 'створка не открылась до конца');
  ok(leafAngle(0, true) < 0.05, 'створка не начинает с закрытого положения');
});

t('каждая дверь имеет петлю внутри комнаты', () => {
  for (const d of DOORS) {
    if (!d.b) continue;
    if (d.lock === 'люк в потолке' || d.lock === 'люк в полу') continue;
    if (d.stairs) continue;
    const r = room(d.a);
    const h = hingePoint(d, r);
    ok(h, `${d.id}: нет петли`);
    ok(h.x >= -0.1 && h.x <= r.rect.w + 0.1, `${d.id}: петля за пределами комнаты по x`);
    ok(h.z >= -0.1 && h.z <= r.rect.d + 0.1, `${d.id}: петля за пределами комнаты по z`);
  }
});

t('комната меняется только по пересечении порога, а не по нажатию', () => {
  // симулируем: открыли дверь, но ещё не дошли — комната не должна меняться
  const r = room('childroom').rect;
  const op = doorOpening(door('cor-child'), room('childroom'));
  let p = { x: (op.from + op.to) / 2, z: r.d - 0.9 };
  let crossed = false;
  for (let i = 0; i < 3; i++) {
    p = step(p, { x: 0, z: 1 }, 0.95, 1 / 30, r, [], [op]).pos;
    if (crossedThreshold(p, r, [op])) crossed = true;
  }
  ok(!crossed, 'порог считается пересёкнтым, хотя мальчик ещё в комнате');
});

t('в дверях не застреваешь: из проёма можно выйти обратно', () => {
  const r = room('childroom').rect;
  const op = doorOpening(door('cor-child'), room('childroom'));
  const mid = (op.from + op.to) / 2;
  // стоим в пороге
  let p = { x: mid, z: r.d - 0.05 };
  // идём назад, в комнату
  for (let i = 0; i < 30; i++) p = step(p, { x: 0, z: -1 }, 0.95, 1 / 30, r, [], [op]).pos;
  ok(p.z < r.d - 0.5, `из порога не выйти обратно: z=${p.z.toFixed(2)}`);
});


// ── створка на петле: где она стоит закрытой и открытой ──
//
// Это самое важное в «дверь должна открываться, а не телепортировать».
// Считаем точки панели в координатах комнаты и смотрим, куда она уходит.

/** Угол открытия створки — тот же, что в scene3d. */
const OPEN = 1.42;

/** Точка двери в координатах комнаты. */
function doorLocal(door, room) {
  return {
    x: door.at.x - room.rect.x - room.rect.w / 2,
    z: door.at.z - room.rect.z - room.rect.d / 2,
  };
}

/** Расстояние до ближайшей стены (внутрь комнаты): 0 — створка в стене. */
function wallMargin(room, p) {
  return Math.min(room.rect.w / 2 - Math.abs(p.x), room.rect.d / 2 - Math.abs(p.z));
}

const LEAVES = DOORS.filter((d) => !d.stairs);

t('закрытая створка стоит в проёме, а не в стороне', () => {
  for (const door of LEAVES) {
    const room = roomById(door.a);
    const tr = leafTransform(door, room, 0);
    if (!tr) continue;
    const at = doorLocal(door, room);
    // створка висит на петле у края проёма и достаёт до другого края:
    // длина = ширина проёма, оба конца на линии стены
    const len = Math.hypot(tr.hinge.x - leafFarPoint(tr, 0).x, tr.hinge.z - leafFarPoint(tr, 0).z);
    ok(Math.abs(len - tr.panel.w) < 0.02, `${door.id}: створка длиной ${len.toFixed(2)} м вместо ${tr.panel.w}`);
    const hingeToAt = Math.hypot(tr.hinge.x - at.x, tr.hinge.z - at.z);
    ok(Math.abs(hingeToAt - tr.panel.w / 2) < 0.03,
      `${door.id}: петля в ${hingeToAt.toFixed(2)} м от центра проёма, а должна в ${(tr.panel.w / 2).toFixed(2)}`);
    // и петля, и дальний край — на линии стены (по толщине створки)
    ok(wallMargin(room, tr.hinge) < 0.06, `${door.id}: петля не в стене`);
    ok(wallMargin(room, leafFarPoint(tr, 0)) < 0.06, `${door.id}: створка не в стене`);
  }
});

t('дверь открывается внутрь комнаты, а не сквозь стену', () => {
  for (const door of LEAVES) {
    const room = roomById(door.a);
    const tr = leafTransform(door, room, 0);
    if (!tr) continue;
    const swing = swingSign(tr, room);
    const openFar = leafFarPoint(tr, OPEN * swing);
    const closedFar = leafFarPoint(tr, 0);
    const moved = Math.hypot(openFar.x - closedFar.x, openFar.z - closedFar.z);
    ok(moved > 0.5, `${door.id}: створка почти не двинулась (${moved.toFixed(2)} м)`);
    ok(wallMargin(room, openFar) > 0.2,
      `${door.id}: открытая створка в стене или за ней (запас ${wallMargin(room, openFar).toFixed(2)} м)`);
    // и она не должна уезжать вбок вдвое дальше, чем нужно — это была
    // ошибка в направлении створки
    const inward = Math.hypot(openFar.x - closedFar.x, openFar.z - closedFar.z);
    ok(inward < tr.panel.w * 1.6, `${door.id}: створка проехала ${inward.toFixed(2)} м — не может быть`);
  }
});

t('открытая створка не выходит за комнату', () => {
  for (const door of LEAVES) {
    const room = roomById(door.a);
    const tr = leafTransform(door, room, 0);
    if (!tr) continue;
    const far = leafFarPoint(tr, OPEN * swingSign(tr, room));
    const hw = room.rect.w / 2, hd = room.rect.d / 2;
    ok(Math.abs(far.x) <= hw + 0.05, `${door.id}: створка за стеной (x=${far.x.toFixed(2)}, комната ±${hw.toFixed(2)})`);
    ok(Math.abs(far.z) <= hd + 0.05, `${door.id}: створка за стеной (z=${far.z.toFixed(2)}, комната ±${hd.toFixed(2)})`);
  }
});

t('на всех стенах створка направлена в проём', () => {
  // Стороны света проверяются отдельно: раньше на западе и востоке
  // направление створки считалось другой формулой, и она уезжала вбок.
  const sides = new Set();
  for (const door of LEAVES) {
    const room = roomById(door.a);
    const tr = leafTransform(door, room, 0);
    if (!tr) continue;
    sides.add(tr.side);
    const at = doorLocal(door, room);
    const mid = { x: (tr.hinge.x + leafFarPoint(tr, 0).x) / 2, z: (tr.hinge.z + leafFarPoint(tr, 0).z) / 2 };
    const off = Math.hypot(mid.x - at.x, mid.z - at.z);
    ok(off < 0.06, `${door.id} (стена ${tr.side}): середина створки в ${off.toFixed(2)} м от проёма`);
  }
  ok(sides.size >= 3, `в доме всего ${sides.size} стороны с дверями — проверка слабая`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
