// Оболочка комнаты: пол, потолок, стены с проёмами, плинтусы, наличники.
//
// Возвращает те же примитивы, что и мебель, поэтому сцена собирается одним
// путём и всё это можно посчитать в тестах без браузера.
//
// Важная деталь масштаба: плинтус 10 см, дверь 2.05 м, потолок 3.1 м.
// Мальчик 1.22 м — дверь для него вдвое выше роста. Это и есть «я маленький».

import { ROOM_LOOK } from '../data/rooms.mjs';
import { HEIGHTS, DOORS, WINDOWS } from '../data/house.mjs';
import { B, BX, C, P } from '../world/props.mjs';

const WALL_T = HEIGHTS.wallThickness;
const WALL_H = HEIGHTS.floorHeight;
const BASE_H = 0.1;

/**
 * Режет отрезок [0, len] проёмами [{ from, to }] на сплошные куски.
 * Возвращает [{ from, to }] в тех же координатах.
 */
export function solidSpans(len, openings) {
  const cuts = openings
    .map((o) => ({ from: Math.max(0, o.from), to: Math.min(len, o.to) }))
    .filter((o) => o.to > o.from)
    .sort((a, b) => a.from - b.from);
  const out = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.from > cursor) out.push({ from: cursor, to: c.from });
    cursor = Math.max(cursor, c.to);
  }
  if (cursor < len) out.push({ from: cursor, to: len });
  return out;
}

/** Проёмы этой комнаты на каждой из четырёх стен. */
export function openingsFor(room) {
  const { rect } = room;
  const near = (a, b) => Math.abs(a - b) < 0.15;
  const sides = { n: [], s: [], w: [], e: [] };
  const dw = HEIGHTS.door.w;
  const dh = HEIGHTS.door.h;

  for (const d of DOORS) {
    if (d.a !== room.id && d.b !== room.id) continue;
    const lx = d.at.x - rect.x;
    const lz = d.at.z - rect.z;
    const isHatch = d.lock === 'люк в потолке' || d.lock === 'люк в полу';
    if (isHatch) continue;
    if (near(lz, 0)) sides.n.push({ from: lx - dw / 2, to: lx + dw / 2, h: dh, kind: 'door', door: d.id });
    else if (near(lz, rect.d)) sides.s.push({ from: lx - dw / 2, to: lx + dw / 2, h: dh, kind: 'door', door: d.id });
    else if (near(lx, 0)) sides.w.push({ from: lz - dw / 2, to: lz + dw / 2, h: dh, kind: 'door', door: d.id });
    else if (near(lx, rect.w)) sides.e.push({ from: lz - dw / 2, to: lz + dw / 2, h: dh, kind: 'door', door: d.id });
  }

  for (const w of WINDOWS) {
    if (w.room !== room.id) continue;
    const lx = w.at.x - rect.x;
    const lz = w.at.z - rect.z;
    const open = { from: 0, to: 0, h: w.size.h, sill: w.sill, kind: 'window', w };
    if (near(lz, 0)) sides.n.push({ ...open, from: lx - w.size.w / 2, to: lx + w.size.w / 2 });
    else if (near(lz, rect.d)) sides.s.push({ ...open, from: lx - w.size.w / 2, to: lx + w.size.w / 2 });
    else if (near(lx, 0)) sides.w.push({ ...open, from: lz - w.size.w / 2, to: lz + w.size.w / 2 });
    else if (near(lx, rect.w)) sides.e.push({ ...open, from: lz - w.size.w / 2, to: lz + w.size.w / 2 });
  }
  return sides;
}

/**
 * Все примитивы оболочки комнаты, в локальных координатах комнаты.
 * @param {object} room — комната из house.mjs
 * @returns {{parts: Array, openings: object, glass: Array}}
 */
export function roomShellParts(room, { bare = false } = {}) {
  const { rect } = room;
  const look = ROOM_LOOK[room.kind] ?? ROOM_LOOK.hall;
  const parts = [];
  const openings = openingsFor(room);
  const glass = [];

  if (bare) {
    // «Просвет» соседней комнаты: только объём — пол, потолок, стены с
    // проёмами. Никакой отделки, плинтусов и наличников: это видно только
    // через дверной проём и стоит дешевле всего.
    parts.push(P(rect.w, rect.d, 0.5 * rect.w, -0.02, 0.5 * rect.d, look.floor, { floorOf: true }));
    parts.push(P(rect.w, rect.d, 0.5 * rect.w, HEIGHTS.floorHeight, 0.5 * rect.d, look.ceiling, { ceilingOf: true }));
    const walls = [
      { side: 'n', len: rect.w, axis: 'x', at: 0 },
      { side: 's', len: rect.w, axis: 'x', at: rect.d },
      { side: 'w', len: rect.d, axis: 'z', at: 0 },
      { side: 'e', len: rect.d, axis: 'z', at: rect.w },
    ];
    for (const wall of walls) {
      const ops = openings[wall.side];
      for (const s of solidSpans(wall.len, ops)) {
        const w = s.to - s.from;
        if (w < 0.01) continue;
        const cx = s.from + w / 2;
        if (wall.axis === 'x') parts.push(B(w, HEIGHTS.floorHeight, WALL_T, cx, 0, wall.at, look.wall));
        else parts.push(B(WALL_T, HEIGHTS.floorHeight, w, wall.at, 0, cx, look.wall));
      }
      for (const o of ops) {
        const w = o.to - o.from;
        if (w < 0.01) continue;
        const cx = o.from + w / 2;
        const top = o.kind === 'door' ? HEIGHTS.door.h : o.sill + o.h;
        const bottom = o.kind === 'door' ? 0 : o.sill;
        const hTop = HEIGHTS.floorHeight - top;
        if (hTop > 0.01) {
          if (wall.axis === 'x') parts.push(B(w, hTop, WALL_T, cx, top, wall.at, look.wall));
          else parts.push(B(WALL_T, hTop, w, wall.at, top, cx, look.wall));
        }
        if (bottom > 0.01) {
          if (wall.axis === 'x') parts.push(B(w, bottom, WALL_T, cx, 0, wall.at, look.wall));
          else parts.push(B(WALL_T, bottom, w, wall.at, 0, cx, look.wall));
        }
      }
    }
    return { parts, openings, glass };
  }

  // ── пол: доски полосами, «ёлочкой» не заморачиваемся, но швы делаем
  parts.push(P(rect.w, rect.d, 0.5 * rect.w, -0.02, 0.5 * rect.d, look.floor, { floorOf: true }));
  const boardW = 0.24;
  const nBoards = Math.ceil(rect.w / boardW);
  for (let i = 0; i < nBoards; i++) {
    const w = Math.min(boardW, rect.w - i * boardW);
    const shade = i % 2 === 0 ? look.floor : (look.floor === 'floorWood' ? 'floorWood2' : look.floor);
    parts.push(P(w - 0.006, rect.d - 0.01, w / 2 + i * boardW, 0.001, rect.d / 2, shade, { flat: true }));
  }

  // ── потолок
  parts.push(P(rect.w, rect.d, 0.5 * rect.w, WALL_H, 0.5 * rect.d, look.ceiling, { ceilingOf: true }));

  // ── стены с проёмами
  const walls = [
    { side: 'n', len: rect.w, axis: 'x', at: 0 },
    { side: 's', len: rect.w, axis: 'x', at: rect.d },
    { side: 'w', len: rect.d, axis: 'z', at: 0 },
    { side: 'e', len: rect.d, axis: 'z', at: rect.w },
  ];

  for (const wall of walls) {
    const ops = openings[wall.side];
    const spans = solidSpans(wall.len, ops);
    // сплошные куски
    for (const s of spans) {
      const w = s.to - s.from;
      if (w < 0.01) continue;
      const cx = s.from + w / 2;
      if (wall.axis === 'x') {
        parts.push(B(w, WALL_H, WALL_T, cx, 0, wall.at, look.wall));
        // плинтус
        parts.push(B(w, BASE_H, WALL_T + 0.02, cx, 0, wall.at, look.trim));
      } else {
        parts.push(B(WALL_T, WALL_H, w, wall.at, 0, cx, look.wall));
        parts.push(B(WALL_T + 0.02, BASE_H, w, wall.at, 0, cx, look.trim));
      }
    }
    // над дверью — перемычка; над/под окном — куски
    for (const o of ops) {
      const w = o.to - o.from;
      if (w < 0.01) continue;
      const cx = o.from + w / 2;
      const top = o.kind === 'door' ? HEIGHTS.door.h : o.sill + o.h;
      const bottom = o.kind === 'door' ? 0 : o.sill;
      const hTop = WALL_H - top;
      if (hTop > 0.01) {
        if (wall.axis === 'x') parts.push(B(w, hTop, WALL_T, cx, top, wall.at, look.wall));
        else parts.push(B(WALL_T, hTop, w, wall.at, top, cx, look.wall));
      }
      if (bottom > 0.01) {
        if (wall.axis === 'x') {
          parts.push(B(w, bottom, WALL_T, cx, 0, wall.at, look.wall));
          parts.push(B(w, BASE_H, WALL_T + 0.02, cx, 0, wall.at, look.trim));
        } else {
          parts.push(B(WALL_T, bottom, w, wall.at, 0, cx, look.wall));
          parts.push(B(WALL_T + 0.02, BASE_H, w, wall.at, 0, cx, look.trim));
        }
      }
      // наличник / рама
      if (o.kind === 'door') {
        const fw = 0.07;
        if (wall.axis === 'x') {
          parts.push(B(fw, top, WALL_T + 0.04, cx - w / 2 - fw / 2, 0, wall.at, look.trim));
          parts.push(B(fw, top, WALL_T + 0.04, cx + w / 2 + fw / 2, 0, wall.at, look.trim));
          parts.push(B(w + fw * 2, fw, WALL_T + 0.04, cx, top, wall.at, look.trim));
        } else {
          parts.push(B(WALL_T + 0.04, top, fw, wall.at, 0, cx - w / 2 - fw / 2, look.trim));
          parts.push(B(WALL_T + 0.04, top, fw, wall.at, 0, cx + w / 2 + fw / 2, look.trim));
          parts.push(B(WALL_T + 0.04, fw, w + fw * 2, wall.at, top, cx, look.trim));
        }
      } else {
        // ── окно: подоконник, рама с перекладиной, стекло ──
        // Окно — единственный источник «улицы» в комнате, и без рамы с
        // перекладиной оно читается как дыра в стене. Добавили наличник
        // вокруг, среднюю перекладину и настоящий подоконник с выступом.
        const sillDepth = 0.26;
        const fr = 0.06;
        const midY = bottom + o.h / 2;
        if (wall.axis === 'x') {
          parts.push(B(w + 0.16, 0.05, WALL_T + sillDepth, cx, bottom - 0.05, wall.at, look.trim));
          parts.push(B(fr, o.h, WALL_T, cx - w / 2, bottom, wall.at, look.trim));
          parts.push(B(fr, o.h, WALL_T, cx + w / 2, bottom, wall.at, look.trim));
          parts.push(B(w, fr, WALL_T, cx, top - fr, wall.at, look.trim));
          parts.push(B(w, 0.035, WALL_T * 0.7, cx, midY, wall.at, look.trim));   // перекладина
          // наличник вокруг окна — по стене, чуть выступает
          parts.push(B(0.04, o.h + 0.14, WALL_T + 0.03, cx - w / 2 - 0.09, bottom - 0.06, wall.at, look.trim));
          parts.push(B(0.04, o.h + 0.14, WALL_T + 0.03, cx + w / 2 + 0.09, bottom - 0.06, wall.at, look.trim));
          parts.push(B(w + 0.22, 0.04, WALL_T + 0.03, cx, top + 0.02, wall.at, look.trim));
          glass.push(BX(w - 0.06, o.h - 0.06, 0.02, cx, bottom, wall.at, 'glassDark'));
        } else {
          parts.push(B(WALL_T + sillDepth, 0.05, w + 0.16, wall.at, bottom - 0.05, cx, look.trim));
          parts.push(B(WALL_T, o.h, fr, wall.at, bottom, cx - w / 2, look.trim));
          parts.push(B(WALL_T, o.h, fr, wall.at, bottom, cx + w / 2, look.trim));
          parts.push(B(WALL_T, fr, w, wall.at, top - fr, cx, look.trim));
          parts.push(B(WALL_T * 0.7, 0.035, w, wall.at, midY, cx, look.trim));
          parts.push(B(WALL_T + 0.03, o.h + 0.14, 0.04, wall.at, bottom - 0.06, cx - w / 2 - 0.09, look.trim));
          parts.push(B(WALL_T + 0.03, o.h + 0.14, 0.04, wall.at, bottom - 0.06, cx + w / 2 + 0.09, look.trim));
          parts.push(B(WALL_T + 0.03, 0.04, w + 0.22, wall.at, top + 0.02, cx, look.trim));
          glass.push(BX(0.02, o.h - 0.06, w - 0.06, wall.at, bottom, cx, 'glassDark'));
        }
      }
    }
  }

  return { parts, openings, glass };
}

/** Потолок с люком (чердак/подвал): проём + крышка, которую можно открыть. */
export function ceilingHatchParts(room, hatch) {
  const parts = [];
  const w = 0.8, d = 0.8;
  parts.push(P(w, d, hatch.x, 0.001, hatch.z, 'black'));
  parts.push(B(w + 0.08, 0.04, d + 0.08, hatch.x, 0.0, hatch.z, 'oak'));
  return parts;
}

/** Наклонные скаты крыши для чердака — чтобы «чердак» читался сразу. */
export function atticRoofParts(room) {
  const { rect } = room;
  const parts = [];
  const slope = Math.atan2(1.1, rect.w / 2);
  const len = Math.hypot(rect.w / 2, 1.1);
  for (const side of [-1, 1]) {
    parts.push({
      t: 'box',
      s: [len, 0.08, rect.d],
      p: [rect.w / 2 + side * (rect.w / 4), 1.95 + 0.55, rect.d / 2],
      mat: 'plywood',
      rot: [0, 0, side * slope],
    });
  }
  return parts;
}
