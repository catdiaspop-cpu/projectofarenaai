// Вещи в стенах и друг в друге.
//
// Игрок видит это как «диван наполовину в стене», «стул внутри стола»,
// «коробка в кровати». Причина всегда одна: у предмета заявлен footprint
// (сколько места ему нужно), а меши могут быть шире, глубже и повёрнуты
// иначе. Поэтому проверяем не footprint, а то, что действительно рисуется:
// габариты по вершинам всех частей, с поворотом и смещением каждой детали.

import { LAYOUT } from '../src/data/layout.mjs';
import { PROPS } from '../src/world/props.mjs';
import { partsOf, PRIMITIVES } from '../src/world/builder.mjs';
import { roomById } from '../src/sim/graph.mjs';
import { DOORS } from '../src/data/house.mjs';
import { entryPoint } from '../src/sim/doors.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

/** AABB одной части в её собственных координатах. */
function partBox(p) {
  const gen = PRIMITIVES[p.t];
  if (!gen) return null;
  const { pos } = gen(p);
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (let i = 0; i < pos.length; i += 3) {
    b.x0 = Math.min(b.x0, pos[i]); b.x1 = Math.max(b.x1, pos[i]);
    b.y0 = Math.min(b.y0, pos[i + 1]); b.y1 = Math.max(b.y1, pos[i + 1]);
    b.z0 = Math.min(b.z0, pos[i + 2]); b.z1 = Math.max(b.z1, pos[i + 2]);
  }
  return b;
}

/** Габарит предмета в координатах комнаты: поворот вокруг Y, плюс смещения. */
export function propBox(prop, anchor) {
  const rot = anchor.rot ?? 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  let b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of partsOf(prop)) {
    const pb = partBox(p);
    if (!pb) continue;
    const px = p.p?.[0] ?? 0, py = p.p?.[1] ?? 0, pz = p.p?.[2] ?? 0;
    // углы повёрнутой коробки
    const xs = [], zs = [];
    for (const [x, z] of [[pb.x0, pb.z0], [pb.x1, pb.z0], [pb.x1, pb.z1], [pb.x0, pb.z1]]) {
      xs.push((x + px) * c + (z + pz) * s);
      zs.push(-(x + px) * s + (z + pz) * c);
    }
    b.x0 = Math.min(b.x0, Math.min(...xs)); b.x1 = Math.max(b.x1, Math.max(...xs));
    b.z0 = Math.min(b.z0, Math.min(...zs)); b.z1 = Math.max(b.z1, Math.max(...zs));
    b.y0 = Math.min(b.y0, pb.y0 + py); b.y1 = Math.max(b.y1, pb.y1 + py);
  }
  const baseY = anchor.y ?? 0;
  return {
    x0: anchor.x + b.x0, x1: anchor.x + b.x1,
    z0: anchor.z + b.z0, z1: anchor.z + b.z1,
    y0: b.y0 + baseY, y1: b.y1 + baseY,
  };
}

/** Отдельные детали предмета в координатах комнаты — для поиска полки-опоры. */
export function propParts(prop, anchor) {
  const rot = anchor.rot ?? 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  const out = [];
  for (const p of partsOf(prop)) {
    const pb = partBox(p);
    if (!pb) continue;
    const px = p.p?.[0] ?? 0, py = p.p?.[1] ?? 0, pz = p.p?.[2] ?? 0;
    const xs = [], zs = [];
    for (const [x, z] of [[pb.x0, pb.z0], [pb.x1, pb.z0], [pb.x1, pb.z1], [pb.x0, pb.z1]]) {
      xs.push((x + px) * c + (z + pz) * s);
      zs.push(-(x + px) * s + (z + pz) * c);
    }
    out.push({
      x0: anchor.x + Math.min(...xs), x1: anchor.x + Math.max(...xs),
      z0: anchor.z + Math.min(...zs), z1: anchor.z + Math.max(...zs),
      y0: pb.y0 + py + (anchor.y ?? 0), y1: pb.y1 + py + (anchor.y ?? 0),
    });
  }
  return out;
}

/** Всё, что лежит на полу: только это и может «стоять в стене». */
function floorBoxes(roomId) {
  const lay = LAYOUT[roomId];
  const out = [];
  for (const it of [...lay.items, ...lay.clutter]) {
    const prop = PROPS[it.prop];
    if (!prop) continue;
    out.push({ it, box: propBox(prop, it), onFloor: (it.y ?? 0) <= 0.02 });
  }
  return out;
}

// Стул, задвинутый под стол, — это расстановка, а не ошибка. А вот боковина
// стола внутри стула — ошибка, и она была: стулья стояли со смещением 1.06
// при полуширине стола 0.65.
const ALLOW = new Set(['chair', 'chair1', 'chair2', 'chair3']);
const isChairish = (id) => ALLOW.has(id);

t('мебель не выходит за стены комнаты', () => {
  const bad = [];
  for (const roomId of Object.keys(LAYOUT)) {
    const room = roomById(roomId);
    const { w, d } = room.rect;
    for (const { it, box } of floorBoxes(roomId)) {
      const out = [];
      if (box.x0 < -0.03) out.push(`запад ${box.x0.toFixed(2)}`);
      if (box.z0 < -0.03) out.push(`север ${box.z0.toFixed(2)}`);
      if (box.x1 > w + 0.03) out.push(`восток +${(box.x1 - w).toFixed(2)}`);
      if (box.z1 > d + 0.03) out.push(`юг +${(box.z1 - d).toFixed(2)}`);
      if (out.length) bad.push(`${roomId}/${it.id}: ${out.join(', ')}`);
    }
  }
  ok(bad.length === 0, bad.join('\n    '));
});

t('мебель не пересекается с мебелью', () => {
  const bad = [];
  for (const roomId of Object.keys(LAYOUT)) {
    const boxes = floorBoxes(roomId).filter((b) => b.onFloor);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j];
        if (isChairish(A.it.id) || isChairish(B.it.id)) continue;
        const ox = Math.min(A.box.x1, B.box.x1) - Math.max(A.box.x0, B.box.x0);
        const oz = Math.min(A.box.z1, B.box.z1) - Math.max(A.box.z0, B.box.z0);
        const oy = Math.min(A.box.y1, B.box.y1) - Math.max(A.box.y0, B.box.y0);
        // 6 см — это касание впритык, оно нормально; глубже — уже наложение
        if (ox > 0.06 && oz > 0.06 && oy > 0.06) {
          bad.push(`${roomId}: ${A.it.id} ∩ ${B.it.id} — ${ox.toFixed(2)}×${oz.toFixed(2)} м`);
        }
      }
    }
  }
  ok(bad.length === 0, bad.join('\n    '));
});

// Настенный декор крепится к стене, а не стоит на мебели, — его не проверяем.
const WALL_MOUNTED = new Set(['picture', 'childDrawing', 'wallShelf', 'wallClock',
  'keyRack', 'lightSwitch', 'curtains', 'hallMirror', 'towelRail', 'pan']);

t('вещи на мебели действительно стоят на ней', () => {
  // Кружка «на столе» висела на 30 см выше столешницы, ночник — на 17 см
  // выше тумбочки, коробка — в воздухе над другой коробкой.
  // Опора ищется по ОТДЕЛЬНЫМ ДЕТАЛЯМ: у шкафа общий габарит уходит на 2.3 м
  // из-за верхних ящиков, и по нему «полка» не находится.
  const bad = [];
  for (const roomId of Object.keys(LAYOUT)) {
    const lay = LAYOUT[roomId];
    const all = [...lay.items, ...lay.clutter]
      .filter((it) => PROPS[it.prop])
      .map((it) => ({ it, box: propBox(PROPS[it.prop], it), parts: propParts(PROPS[it.prop], it) }));
    for (const { it, box } of all) {
      if ((it.y ?? 0) <= 0.02) continue;
      if (WALL_MOUNTED.has(it.prop)) continue;
      const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
      const support = all.some((o) => o.it !== it && o.parts.some((p) =>
        cx >= p.x0 - 0.06 && cx <= p.x1 + 0.06 &&
        cz >= p.z0 - 0.06 && cz <= p.z1 + 0.06 &&
        Math.abs(p.y1 - box.y0) < 0.15));
      if (!support) bad.push(`${roomId}/${it.id}: низ ${box.y0.toFixed(2)} — опоры под ним нет`);
    }
  }
  ok(bad.length === 0, bad.join('\n    '));
});


// ─────────── в каждой комнате есть место, куда встать из двери ───────────

// Через лестничный марш в лестничной клетке и есть ход: он занимает всю
// комнату 2×4, и любая дверь на этом этаже открывается прямо на него.
const PASSABLE = new Set(['stairs/steps']);

t('у каждой двери есть свободное место с обеих сторон', () => {
  // Жалоба «зашёл в комнату и застрял» — это не про стены, а про то, что
  // кто-то поставил холодильник ровно в дверном проёме. Сцена ставит
  // мальчика на 36 см внутрь от двери, и если там стоит мебель, он
  // оказывается внутри неё. Проверяем каждую дверь с каждой стороны.
  const bad = [];
  for (const d of DOORS) {
    if (!d.b) continue;
    for (const roomId of [d.a, d.b]) {
      const room = roomById(roomId);
      const entry = entryPoint(d, room, 0.36);
      // Плоское и низкое — не препятствие: ковёр, провисающая ткань. Через
      // них проходят, и «застрять» в них нельзя. Отдельно — то, что висит
      // НАД головой (балки чердака стоят от 0.7 м и выше, лестничный марш
      // перекрывает пролёт): в них тоже не застрянешь, они над мальчиком.
      // Всё остальное на уровне тела в точке входа — преграда.
      const hit = [...LAYOUT[roomId].items, ...LAYOUT[roomId].clutter].filter((it) => {
        // предмет, ЧЕРЕЗ который и есть проход (лестничный марш), — не преграда
        if (PASSABLE.has(`${roomId}/${it.id}`)) return false;
        const prop = PROPS[it.prop];
        if (!prop) return false;
        const box = propBox(prop, it);
        if (it.y ?? 0) return false;
        if (box.y0 > 0.55) return false;               // висит над головой
        if (box.y1 - box.y0 < 0.12) return false;      // плоское
        return entry.x > box.x0 - 0.06 && entry.x < box.x1 + 0.06
          && entry.z > box.z0 - 0.06 && entry.z < box.z1 + 0.06;
      });
      if (hit.length) bad.push(`${roomId} у двери ${d.id}: занято (${hit.map((h) => h.id).join(', ')})`);
      if (entry.x < 0.3 || entry.z < 0.3 || entry.x > room.rect.w - 0.3 || entry.z > room.rect.d - 0.3) {
        bad.push(`${roomId} у двери ${d.id}: вход в стене (${entry.x.toFixed(2)}, ${entry.z.toFixed(2)})`);
      }
    }
  }
  ok(bad.length === 0, bad.join('; '));
});
console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
