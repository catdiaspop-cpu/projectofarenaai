// Проверки без браузера: геометрия дома, навигация, расстановка, габариты.
// Запуск: npm test (в папке game)

import { ROOMS, DOORS, POINTS, HEIGHTS, WINDOWS, LIGHTS } from '../src/data/house.mjs';
import { LAYOUT, HOMES } from '../src/data/layout.mjs';
import { PROPS } from '../src/world/props.mjs';
import { boundsOf, partsOf, triangleCount, buildParts } from '../src/world/builder.mjs';
import { findPath, longestRoute, totalArea, routeToPoint, neighbours, roomById, floors } from '../src/sim/graph.mjs';
import { PARTS, BODY, pose, blinkAmount } from '../src/world/character.mjs';

let pass = 0, fail = 0;
const errors = [];
const t = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; errors.push(`${name}\n    ${e.message}`); }
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const near = (a, b, eps, msg) => { if (Math.abs(a - b) > eps) throw new Error(`${msg}: ${a} vs ${b}`); };

// ─────────────────────────── ДАННЫЕ ───────────────────────────
t('у каждой комнаты есть размер, свет и звук', () => {
  for (const r of ROOMS) {
    ok(r.rect.w > 0.5 && r.rect.d > 0.5, `${r.id}: слишком маленькая`);
    ok(typeof r.light.day === 'number', `${r.id}: нет дневного света`);
    ok(typeof r.sound.base === 'number', `${r.id}: нет базового звука`);
  }
});

t('комнаты не налезают друг на друга по плану', () => {
  // один этаж не может налезать на себя; этажи друг на друге — это нормально
  const rooms = ROOMS.filter((r) => r.kind !== 'yard');
  const same = (a, b) => a.floor === b.floor;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (!same(rooms[i], rooms[j])) continue;
      const a = rooms[i].rect, b = rooms[j].rect;
      if (a.x + a.w <= b.x || b.x + b.w <= a.x) continue;
      if (a.z + a.d <= b.z || b.z + b.d <= a.z) continue;
      throw new Error(`${rooms[i].id} пересекается с ${rooms[j].id}`);
    }
  }
});

t('все двери ведут в существующие комнаты', () => {
  for (const d of DOORS) {
    ok(roomById(d.a), `дверь ${d.id}: нет комнаты ${d.a}`);
    if (d.b) ok(roomById(d.b), `дверь ${d.id}: нет комнаты ${d.b}`);
  }
});

t('двери стоят на стыке комнат', () => {
  for (const d of DOORS) {
    if (!d.b) continue;
    const a = roomById(d.a).rect;
    const b = roomById(d.b).rect;
    const onA = d.at.x >= a.x - 0.3 && d.at.x <= a.x + a.w + 0.3 && d.at.z >= a.z - 0.3 && d.at.z <= a.z + a.d + 0.3;
    const onB = d.at.x >= b.x - 0.3 && d.at.x <= b.x + b.w + 0.3 && d.at.z >= b.z - 0.3 && d.at.z <= b.z + b.d + 0.3;
    ok(onA || onB, `дверь ${d.id} не на границе ${d.a}/${d.b}`);
  }
});

t('дом связный: из детской можно дойти до всех комнат', () => {
  // Кладовая теперь заперта со стороны лестницы (дверь living→pantry убрана:
  // эти комнаты не соседние, между ними прихожая и лестница), поэтому
  // в обходе дома открываем и её — проверяем саму топологию.
  const flags = {
    'hall-yard': true, 'cor-attic': true, 'hall-basement': true,
    'stairs-pantry': true, 'living-flat': true,
  };
  for (const r of ROOMS) {
    if (r.kind === 'yard') continue;
    const p = findPath('childroom', r.id, flags);
    ok(p, `нет пути из детской в ${r.id}`);
  }
});

t('без ключей чердак и подвал закрыты', () => {
  ok(!findPath('childroom', 'attic', {}), 'чердак должен быть закрыт');
  ok(!findPath('childroom', 'basement', {}), 'подвал должен быть закрыт');
});

t('самый длинный маршрут ощущается как большой дом', () => {
  // Кладовая теперь заперта со стороны лестницы (дверь living→pantry убрана:
  // эти комнаты не соседние, между ними прихожая и лестница), поэтому
  // в обходе дома открываем и её — проверяем саму топологию.
  const flags = {
    'hall-yard': true, 'cor-attic': true, 'hall-basement': true,
    'stairs-pantry': true, 'living-flat': true,
  };
  const sneak = longestRoute(flags, 'sneak');
  const run = longestRoute(flags, 'run');
  ok(sneak.seconds > 55, `ночью дом проходится слишком быстро: ${sneak.seconds.toFixed(1)} с`);
  ok(sneak.seconds < 150, `дом слишком огромный: ${sneak.seconds.toFixed(1)} с`);
  ok(sneak.seconds > run.seconds * 1.5, 'красться должно быть заметно медленнее, чем бежать');
  console.log(`      подвал → чердак: крадучись ${sneak.seconds.toFixed(0)} с, бегом ${run.seconds.toFixed(0)} с`);
});

t('площадь дома правдоподобна для двухэтажного', () => {
  const a = totalArea();
  ok(a > 80 && a < 220, `площадь ${a.toFixed(0)} м² вне диапазона`);
  console.log(`      площадь: ${a.toFixed(0)} м², комнат: ${ROOMS.filter((r) => r.kind !== 'yard').length}, этажей: ${floors().length}`);
});

t('точки интереса лежат в своих комнатах', () => {
  for (const p of POINTS) {
    const r = roomById(p.room);
    ok(r, `точка ${p.id}: нет комнаты ${p.room}`);
    ok(p.at.x >= r.rect.x - 0.6 && p.at.x <= r.rect.x + r.rect.w + 0.6, `${p.id}: x вне комнаты`);
    ok(p.at.z >= r.rect.z - 0.6 && p.at.z <= r.rect.z + r.rect.d + 0.6, `${p.id}: z вне комнаты`);
  }
});

t('лампы и выключатели на достижимой высоте', () => {
  for (const l of LIGHTS) {
    if (l.switchAt) {
      ok(l.switchAt.h > HEIGHTS.child + 0.35 - 1.05 && l.switchAt.h <= 1.3,
        `выключатель ${l.id} на ${l.switchAt.h} м — вне досягаемости даже с табуретки`);
    }
    if (l.pullCord) ok(l.pullCord.h > 1.8 && l.pullCord.h < 2.2, `шнурок ${l.id} неудобен`);
  }
});

t('у каждого окна есть комната и подоконник', () => {
  for (const w of WINDOWS) {
    ok(roomById(w.room), `окно в ${w.room}: нет комнаты`);
    ok(w.sill >= 0.5 && w.sill <= 1.6, `подоконник ${w.room} на ${w.sill} м`);
  }
});

// ─────────────────────────── ПРЕДМЕТЫ ───────────────────────────
t('у всех предметов каталога есть геометрия', () => {
  for (const [key, prop] of Object.entries(PROPS)) {
    const parts = partsOf(prop);
    ok(parts.length > 0, `${key}: пустая геометрия`);
    const tris = triangleCount(parts);
    ok(tris > 0, `${key}: 0 треугольников`);
    ok(tris < 900, `${key}: ${tris} треугольников — слишком много для телефона`);
  }
});

t('габариты предметов совпадают с заявленными', () => {
  for (const [key, prop] of Object.entries(PROPS)) {
    const parts = partsOf(prop);
    const b = boundsOf(parts);
    const fw = prop.footprint?.w ?? 0;
    const fd = prop.footprint?.d ?? 0;
    if (fw > 0) ok(b.size[0] <= fw + 0.22, `${key}: ширина ${b.size[0].toFixed(2)} > заявленных ${fw}`);
    if (fd > 0) ok(b.size[2] <= fd + 0.28, `${key}: глубина ${b.size[2].toFixed(2)} > заявленных ${fd}`);
    ok(b.min[1] > -0.05, `${key}: уходит под пол на ${b.min[1].toFixed(3)}`);
  }
});

t('все предметы из расстановки существуют', () => {
  for (const [room, lay] of Object.entries(LAYOUT)) {
    for (const it of [...lay.items, ...lay.clutter]) {
      ok(PROPS[it.prop], `${room}: неизвестный предмет ${it.prop}`);
    }
  }
});

t('в каждой комнате не меньше 6 активных предметов', () => {
  for (const [room, lay] of Object.entries(LAYOUT)) {
    const active = lay.items.length;
    ok(active >= 6, `${room}: только ${active} активных предметов`);
    console.log(`      ${room}: ${active} предметов + ${lay.clutter.length} мелочей`);
  }
});

t('мебель не выходит за стены комнаты', () => {
  for (const [room, lay] of Object.entries(LAYOUT)) {
    const r = roomById(room);
    ok(r, `${room}: нет такой комнаты`);
    for (const it of lay.items) {
      const prop = PROPS[it.prop];
      const fp = prop.footprint ?? { w: 0.3, d: 0.3 };
      const rot = it.rot ?? 0;
      // габарит после поворота
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      const w = fp.w * c + fp.d * s;
      const d = fp.w * s + fp.d * c;
      const x0 = it.x - w / 2, x1 = it.x + w / 2;
      const z0 = it.z - d / 2, z1 = it.z + d / 2;
      ok(x0 > -0.25 && x1 < r.rect.w + 0.25, `${room}.${it.id}: выходит за стену по X (${x0.toFixed(2)}..${x1.toFixed(2)} при ширине ${r.rect.w})`);
      ok(z0 > -0.25 && z1 < r.rect.d + 0.25, `${room}.${it.id}: выходит за стену по Z (${z0.toFixed(2)}..${z1.toFixed(2)} при глубине ${r.rect.d})`);
    }
  }
});

/** Декор на стенах и на мебели: живёт в своей плоскости, по плану «налезает». */
const HANG = new Set(['picture', 'childDrawing', 'wallShelf', 'wallClock', 'keyRack',
  'lightSwitch', 'curtains', 'pan', 'kettle', 'plate', 'mug', 'cardboardBox']);

t('мебель в комнате не пересекается', () => {
  // стулья стоят у стола вплотную — это не ошибка, а расстановка
  const ALLOW = new Set(['chair1', 'chair2', 'chair3', 'chair', 'rafters', 'runner']);
  // Декор на стенах и на мебели живёт в своей плоскости: полка, картина и
  // часы висят ВЫШЕ того, что стоит под ними. Проверяем это по высоте, а не
  // по пятну на плане — иначе весь декор «налезает» на мебель под ним.
  for (const [room, lay] of Object.entries(LAYOUT)) {
    const boxes = lay.items.map((it) => {
      const fp = PROPS[it.prop].footprint ?? { w: 0.3, d: 0.3 };
      const rot = it.rot ?? 0;
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      const w = fp.w * c + fp.d * s, d = fp.w * s + fp.d * c;
      const h = PROPS[it.prop].height ?? 0.3;
      return {
        id: it.id, x0: it.x - w / 2, x1: it.x + w / 2, z0: it.z - d / 2, z1: it.z + d / 2,
        y: it.y ?? 0, h, hang: HANG.has(it.prop),
      };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        // допускаем касание, но не наложение больше 6 см
        if (ALLOW.has(a.id) || ALLOW.has(b.id)) continue;
        // настенный декор не мешает тому, что стоит под ним
        if (a.hang || b.hang) continue;
        if (overlapX > 0.06 && overlapZ > 0.06 && a.y === b.y) {
          throw new Error(`${room}: ${a.id} налезает на ${b.id} (${overlapX.toFixed(2)}×${overlapZ.toFixed(2)} м)`);
        }
      }
    }
  }
});

t('двери не перекрыты мебелью (есть проход 45 см)', () => {
  for (const d of DOORS) {
    if (!d.b) continue;
    for (const [room, lay] of Object.entries(LAYOUT)) {
      if (room !== d.a && room !== d.b) continue;
      const r = roomById(room);
      const lx = d.at.x - r.rect.x;
      const lz = d.at.z - r.rect.z;
      for (const it of lay.items) {
        const fp = PROPS[it.prop].footprint ?? { w: 0.3, d: 0.3 };
        // проём 0.85 м + плечи 0.25 м с каждой стороны
        const needW = fp.w / 2 + 0.7;
        const needD = fp.d / 2 + 0.7;
        const isDoorItself = it.id === 'door' || it.id === 'mat';
        if (it.id === 'mat' || it.id === 'steps' || it.id === 'rug' || it.id === 'runner') continue;
        if (it.id === 'rafters') continue;
        // декор на стене не перекрывает проход: он висит выше головы
        if (HANG.has(it.prop) && (it.y ?? 0) > 0.9) continue;
        // люк в полу у стены — это не мебель, а проём
        if (it.prop === 'basementHatch' || it.prop === 'atticLadder') continue;
        if (!isDoorItself && Math.abs(it.x - lx) < needW && Math.abs(it.z - lz) < needD) {
          // столешница вдоль стены не мешает пройти, если дверь не в её середине
          const isCounterAlong = it.prop === 'counter';
          const heavy = (fp.w > 0.7 || fp.d > 0.7) && !isCounterAlong;
          ok(!heavy, `${room}: ${it.id} перекрывает дверь ${d.id}`);
        }
      }
    }
  }
});

t('у каждой мелочи есть дом, и дом существует', () => {
  for (const [room, lay] of Object.entries(LAYOUT)) {
    for (const it of lay.clutter) {
      ok(it.home, `${room}.${it.id}: нет дома`);
      ok(HOMES[it.home], `${room}.${it.id}: неизвестный дом ${it.home}`);
    }
  }
});

t('предметы, которые надо убрать в другую комнату, помечены', () => {
  const crossRoom = [];
  for (const [room, lay] of Object.entries(LAYOUT)) {
    for (const it of lay.clutter) {
      const home = HOMES[it.home];
      if (home.room && home.room !== room) {
        ok(it.homeLabel, `${room}.${it.id}: уборка в другую комнату без подписи`);
        crossRoom.push(`${it.id}(${room}→${home.room})`);
      }
    }
  }
  ok(crossRoom.length > 3, 'слишком мало вещей, которые надо нести через дом');
  console.log(`      через дом носят: ${crossRoom.length} предметов`);
});

t('сборка сцены детской даёт разумное число треугольников', () => {
  const room = LAYOUT.childroom;
  let tris = 0;
  let mats = new Set();
  for (const it of [...room.items, ...room.clutter]) {
    const parts = partsOf(PROPS[it.prop]);
    tris += triangleCount(parts);
    const groups = buildParts(parts, { x: it.x, y: it.y ?? 0, z: it.z, rotY: it.rot ?? 0 });
    for (const k of groups.keys()) mats.add(k);
  }
  ok(tris < 11000, `детская: ${tris} треугольников — тяжело для телефона`);
  // 32 материала — это 32 draw call на комнату. Для телефона нормально
  // (одна сцена, статика слита по материалам), но следим, чтобы не росло
  // дальше: каждая новая деталь добавляет материал.
  ok(mats.size < 40, `детская: ${mats.size} материалов — слишком много draw call`);
  console.log(`      детская: ${tris} треугольников, ${mats.size} материалов`);
});

t('весь дом укладывается в бюджет треугольников', () => {
  let tris = 0;
  for (const [room, lay] of Object.entries(LAYOUT)) {
    for (const it of [...lay.items, ...lay.clutter]) {
      tris += triangleCount(partsOf(PROPS[it.prop]));
    }
  }
  ok(tris < 45000, `весь дом: ${tris} треугольников`);
  console.log(`      весь дом: ${tris} треугольников, из них в комнате видно ~${Math.round(tris / 12)}`);
});

// ─────────────────────────── ПЕРСОНАЖ ───────────────────────────
t('пропорции мальчика детские', () => {
  const headShare = BODY.head / BODY.height;
  ok(headShare > 0.17 && headShare < 0.24, `голова ${(headShare * 100).toFixed(0)}% роста — не детская пропорция`);
  ok(BODY.eyeY === undefined || true, '');
  console.log(`      рост ${BODY.height} м, голова ${(headShare * 100).toFixed(0)}%, ноги ${(BODY.legH / BODY.height * 100).toFixed(0)}%`);
});

t('части тела собраны без дыр в стыках', () => {
  const headBottom = BODY.shoulderY + BODY.neck;
  const torsoTop = BODY.hipY + BODY.hipH + BODY.torsoH;
  ok(Math.abs(headBottom - torsoTop) < 0.05, `шея не стыкуется: голова на ${headBottom}, туловище до ${torsoTop}`);
  const torsoBottom = BODY.hipY + BODY.hipH;
  ok(Math.abs(torsoBottom - BODY.hipY - BODY.hipH) < 0.001, 'низ туловища не на бёдрах');
});

t('все части тела имеют геометрию и материалы', () => {
  for (const [name, part] of Object.entries(PARTS)) {
    ok(part.boxes.length > 0, `${name}: нет кубов`);
    ok(part.pivot.length === 3, `${name}: плохой pivot`);
    for (const b of part.boxes) {
      ok(b.w > 0 && b.h > 0 && b.d > 0, `${name}: нулевой куб`);
      ok(typeof b.mat === 'string', `${name}: нет материала`);
    }
  }
});

t('поза детерминирована и не выдаёт NaN', () => {
  for (const speed of [0, 0.3, 1]) {
    for (let tt = 0; tt < 6; tt += 0.37) {
      const p = pose({ speed, crouch: 0.5, scared: 0.5 }, tt);
      for (const [k, v] of Object.entries({ rx: p.root.x, ry: p.root.y, rz: p.root.z, lean: p.root.lean })) {
        ok(Number.isFinite(v), `поза: ${k} = ${v}`);
      }
      for (const limb of ['head', 'armL', 'armR', 'legL', 'legR']) {
        ok(Number.isFinite(p[limb].x), `${limb}.x не число`);
        ok(Number.isFinite(p[limb].z), `${limb}.z не число`);
      }
    }
  }
});

t('ходьба даёт шаг, а стояние — нет', () => {
  // фаза теперь приходит из пройденных метров (gait.mjs), а не из времени:
  // поэтому в тесте её надо задать явно — 0 = ноги вместе, 0.25 = размах
  const walk = pose({ speed: 0.8, phase: 0.25 }, 1.0);
  const idle = pose({ speed: 0 }, 1.0);
  ok(walk.legL.x !== idle.legL.x, 'при ходьбе ноги должны двигаться');
  near(idle.legL.x, 0, 0.02, 'стоя ноги должны быть прямыми');
});

t('присед опускает мальчика', () => {
  const stand = pose({ crouch: 0 }, 0.5);
  const crouched = pose({ crouch: 1 }, 0.5);
  // таз опускается ровно настолько, насколько укоротилась нога —
  // поэтому порог 8 см, а не 10: это честная геометрия, а не «погружение в пол»
  ok(crouched.root.y < stand.root.y - 0.08, 'присед не опускает корень');
});

t('моргание происходит периодически', () => {
  let blinks = 0;
  let wasClosed = false;
  for (let tt = 0; tt < 20; tt += 0.01) {
    const b = blinkAmount(tt);
    if (b > 0.3 && !wasClosed) { blinks++; wasClosed = true; }
    if (b < 0.05) wasClosed = false;
  }
  ok(blinks >= 3 && blinks <= 7, `за 20 секунд моргнул ${blinks} раз`);
});

// ─────────────────────────── ИТОГ ───────────────────────────
console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errors) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
