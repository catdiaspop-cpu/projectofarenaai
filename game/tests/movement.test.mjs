// Мальчик обязан РЕАЛЬНО идти. Это проверяется прогоном, а не формулой.
//
// Симулируем 600 кадров по 1/30 с с настоящими препятствиями из LAYOUT
// и смотрим: сдвинулся ли он на ожидаемое расстояние, не прошёл ли сквозь
// стол и не застрял ли намертво.

import { fits, slide, step, dirFromStick } from '../src/core/movement.mjs';
import { World } from '../src/core/app.mjs';
import { SPEED } from '../src/sim/graph.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const DT = 1 / 30;
const w = new World();
const room = w.roomData.rect;
const obs = w.obstacles();

/** Прогон: стик (ix, iy) N кадров, yaw камеры. */
function run(pos, ix, iy, frames, yaw = 0, speed = SPEED.normal) {
  let p = { ...pos };
  let blockedFrames = 0;
  for (let i = 0; i < frames; i++) {
    const dir = dirFromStick(ix, iy, yaw);
    const r = step(p, dir, speed, DT, room, obs);
    if (r.blocked) blockedFrames++;
    p = r.pos;
  }
  return { pos: p, blockedFrames };
}

const start = { x: room.w / 2, z: room.d / 2 };

t('за 1 секунду мальчик проходит примерно свою скорость', () => {
  // детская 3.6×3.4: центр → идём вбок, места хватает на 0.9 м
  const r = run(start, 1, 0, 30, 0, SPEED.normal);
  const dist = Math.hypot(r.pos.x - start.x, r.pos.z - start.z);
  ok(dist > 0.55, `за 1 с прошёл ${dist.toFixed(2)} м при скорости ${SPEED.normal} — стоит на месте`);
  ok(dist <= SPEED.normal * 1.01, `прошёл ${dist.toFixed(2)} м — быстрее своей скорости`);
});

t('упирается в препятствие и стоит, а не проходит сквозь', () => {
  // Вправо от центра детской стоит шкаф (x 2.92..3.52), а не голая стена.
  const first = run(start, 1, 0, 90).pos;
  const later = run(first, 1, 0, 60).pos;
  ok(first.x <= room.w - 0.2, `прошёл сквозь стену: x=${first.x.toFixed(2)} при ширине ${room.w}`);
  ok(first.x > start.x + 0.5, `не сдвинулся вправо: ${first.x.toFixed(2)}`);
  ok(Math.abs(later.x - first.x) < 0.01, `продолжает ехать сквозь шкаф: ${first.x.toFixed(2)} → ${later.x.toFixed(2)}`);
  ok(fits(later, room, obs), 'стоит внутри мебели');
});

t('идёт до самого конца коридора, где путь свободен', () => {
  const ww = new World();
  ww.room = 'corridor';
  const r = ww.roomData.rect;
  const o = ww.obstacles();
  // в коридоре люк на чердак (x 3.85..4.55) лежит прямо по центру,
  // поэтому идём по свободной полосе у дальней стены
  let p = { x: 4.2, z: 1.25 };
  ok(fits(p, r, o), 'стартовая точка сама в мебели');
  for (let i = 0; i < 160; i++) p = step(p, { x: 1, z: 0 }, SPEED.normal, DT, r, o).pos;
  // у правой стены стоят ящик и тумбочка — вплотную к бетону не подойти,
  // и это правильно: мальчик не проходит сквозь мебель
  ok(p.x > 6.9, `не дошёл даже до мебели у стены: ${p.x.toFixed(2)} из ${r.w}`);
  ok(p.x <= r.w - 0.2, `прошёл сквозь стену: ${p.x.toFixed(2)}`);
  ok(fits(p, r, o), 'стоит внутри мебели');
});

t('ни разу не оказывается внутри мебели', () => {
  // 20 направлений × 60 кадров, старт из центра
  for (let a = 0; a < 20; a++) {
    const ang = (a / 20) * Math.PI * 2;
    const dir = { x: Math.cos(ang), z: Math.sin(ang) };
    let p = { ...start };
    for (let i = 0; i < 60; i++) {
      const r = step(p, dir, SPEED.normal, DT, room, obs);
      p = r.pos;
      ok(fits(p, room, obs), `направление ${a}: оказался в мебели (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
    }
  }
});

t('не залипает намертво: из любого места хоть куда-то да идёт', () => {
  // старт у каждой стены комнаты, по 4 направления
  // углы и центры стен — те, что реально свободны: в детской угол занят столом
  const spots = [
    { x: 0.5, z: 0.5 }, { x: room.w - 0.5, z: 0.5 },
    { x: 0.5, z: room.d - 0.5 }, { x: room.w - 0.5, z: room.d - 0.5 },
    { x: room.w / 2, z: room.d / 2 },
  ].filter((p) => fits(p, room, obs));
  for (const s of spots) {
    let movedAny = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const r = run(s, Math.cos(ang), Math.sin(ang), 15);
      movedAny += Math.hypot(r.pos.x - s.x, r.pos.z - s.z);
    }
    ok(movedAny > 0.3, `из точки (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) не сдвинулся ни в одну сторону`);
  }
});

t('скольжение вдоль стола работает: не упирается и не проходит сквозь', () => {
  // идём по диагонали; если упираемся — должны съехать по одной оси
  const r = run(start, 0.7, -0.7, 120);
  const dist = Math.hypot(r.pos.x - start.x, r.pos.z - start.z);
  ok(dist > 1.0, `по диагонали прошёл всего ${dist.toFixed(2)} м — залип`);
  ok(fits(r.pos, room, obs), 'после диагонали оказался в мебели');
});

t('диагональ не быстрее прямой (нормализация)', () => {
  const straight = run(start, 0, -1, 20);
  const diag = run(start, 0.707, -0.707, 20);
  const ds = Math.hypot(straight.pos.x - start.x, straight.pos.z - start.z);
  const dd = Math.hypot(diag.pos.x - start.x, diag.pos.z - start.z);
  ok(dd <= ds + 0.06, `по диагонали ${dd.toFixed(2)} м, прямо ${ds.toFixed(2)} м — диагональ быстрее`);
});

t('скорость по кнопке бега действительно выше', () => {
  const walk = run(start, 0, -1, 12, 0, SPEED.normal);
  const fast = run(start, 0, -1, 12, 0, SPEED.run);
  const dw = Math.hypot(walk.pos.x - start.x, walk.pos.z - start.z);
  const df = Math.hypot(fast.pos.x - start.x, fast.pos.z - start.z);
  ok(df > dw * 1.5, `бег ${df.toFixed(2)} м против шага ${dw.toFixed(2)} м — разницы почти нет`);
});

t('поворот камеры меняет направление шага', () => {
  const a = run(start, 0, -1, 10, 0);
  const b = run(start, 0, -1, 10, Math.PI / 2);
  const da = Math.hypot(a.pos.x - start.x, a.pos.z - start.z);
  const db = Math.hypot(b.pos.x - start.x, b.pos.z - start.z);
  ok(Math.abs(a.pos.x - b.pos.x) > 0.1 || Math.abs(a.pos.z - b.pos.z) > 0.1,
    `направление не изменилось: ${da.toFixed(2)} / ${db.toFixed(2)}`);
});

t('каждая комната проходима: из центра можно дойти до края', () => {
  for (const id of ['childroom', 'kitchen', 'living', 'hall', 'corridor', 'bath', 'pantry']) {
    const ww = new World();
    ww.room = id;
    const r = ww.roomData.rect;
    const o = ww.obstacles();
    const c = { x: r.w / 2, z: r.d / 2 };
    // коридор 8×1.5: в центре поперёк некуда идти, проверяем вдоль
    const corridor = r.w > r.d * 3;
    // 8 направлений по 45 кадров
    let best = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      let p = { ...c };
      if (!fits(p, r, o)) p = { x: r.w / 2, z: Math.min(r.d - 0.4, r.d * 0.75) };
      for (let i = 0; i < 45; i++) p = step(p, { x: Math.cos(ang), z: Math.sin(ang) }, SPEED.normal, DT, r, o).pos;
      best = Math.max(best, Math.hypot(p.x - c.x, p.z - c.z));
    }
    // в узком коридоре предел — поперёк: 1.5 м ширины минус тело
    const limit = corridor ? 0.3 : 0.8;
    ok(best > limit, `${id}: из центра не пройти дальше ${best.toFixed(2)} м (нужно > ${limit})`);
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
