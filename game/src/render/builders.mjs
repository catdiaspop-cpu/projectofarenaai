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

/** К какой стене ближе точка — когда у окна не указана сторона. */
function sideOfPoint(at, rect) {
  const d = [
    { side: 'n', v: Math.abs(at.z - rect.z) },
    { side: 's', v: Math.abs(at.z - (rect.z + rect.d)) },
    { side: 'w', v: Math.abs(at.x - rect.x) },
    { side: 'e', v: Math.abs(at.x - (rect.x + rect.w)) },
  ].sort((a, b) => a.v - b.v);
  return d[0].side;
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
    // окно может быть на стене, параллельной ДРУГОЙ оси: в спальне родителей
    // оно на северной стене, но z у него не 0, а координата вдоль стены.
    // Раньше окно молча не ставилось, и комната оставалась без окон вообще.
    const edge = w.dir ?? sideOfPoint(w.at, rect);
    const lx = edge === 'n' || edge === 's' ? w.at.x - rect.x : (edge === 'w' ? 0 : rect.w);
    const lz = edge === 'w' || edge === 'e' ? w.at.z - rect.z : (edge === 'n' ? 0 : rect.d);
    const open = { from: 0, to: 0, h: w.size.h, sill: w.sill, kind: 'window', w };
    if (edge === 'n' || edge === 's') {
      const span = { ...open, from: lx - w.size.w / 2, to: lx + w.size.w / 2 };
      (edge === 'n' ? sides.n : sides.s).push(span);
    } else {
      const span = { ...open, from: lz - w.size.w / 2, to: lz + w.size.w / 2 };
      (edge === 'w' ? sides.w : sides.e).push(span);
    }
  }
  return sides;
}

/**
 * Что видно за стеклом: ночное небо, луна и звёзды.
 *
 * Раньше за окном была одна полупрозрачная плоскость цвета glassDark — на
 * экране это читалось как синяя заливка или чёрная дыра. Ночь за окном —
 * это единственный «улица» в комнате и половина настроения, поэтому за
 * проём ставится тёмная плоскость неба, на ней светлый диск луны и звёзды.
 *
 * Всё это лежит СНАРУЖИ стены (за её внешней плоскостью), поэтому в комнате
 * ничего не перекрывает.
 */
function nightBehind(glass, wall, cx, w, bottom, h) {
  const T = WALL_T;
  const out = wall.at + (wall.side === 'n' || wall.side === 'w' ? -1 : 1) * (T / 2 + 0.06);
  const W = Math.max(w * 2.4, 2.6);
  const H2 = Math.max(h * 2.4, 2.6);
  const cy = bottom + h / 2;
  if (wall.axis === 'x') {
    glass.push(BX(W, H2, 0.02, cx, cy - H2 / 2, out, 'nightSky'));
    // луна: видна из окна, чуть выше середины
    glass.push({ t: 'sph', r: 0.13, p: [cx + w * 0.22, cy + h * 0.22, out + (out < wall.at ? 0.03 : -0.03)], mat: 'moon' });
    // звёзды: мелкие точки, 8 штук, детерминированно по номеру окна
    for (let i = 0; i < 8; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const sx = cx + Math.cos(a) * w * 0.48;
      const sy = cy + Math.sin(a) * h * 0.42;
      glass.push(BX(0.022, 0.022, 0.01, sx, sy, out + (out < wall.at ? 0.03 : -0.03), 'star'));
    }
  } else {
    glass.push(BX(0.02, H2, W, out, cy - H2 / 2, cx, 'nightSky'));
    glass.push({ t: 'sph', r: 0.13, p: [out + (out < wall.at ? 0.03 : -0.03), cy + h * 0.22, cx + w * 0.22], mat: 'moon' });
    for (let i = 0; i < 8; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const sz = cx + Math.cos(a) * w * 0.48;
      const sy = cy + Math.sin(a) * h * 0.42;
      glass.push(BX(0.01, 0.022, 0.022, out + (out < wall.at ? 0.03 : -0.03), sy, sz, 'star'));
    }
  }
}

/**
 * Отделка стены: панель снизу, полоса обоев, карниз сверху.
 *
 * Зачем. Раньше стена была ОДНОЙ плоской коробкой цвета wallpaper — на
 * телефоне она читалась как коричневое пятно, и комната выглядела пустой
 * даже с мебелью. Три горизонтальные полосы разной высоты дают стене
 * масштаб: по ним видно, что мальчик маленький, а стена высокая.
 *
 * @param {object} wall — { side, len, axis, at } из основного цикла
 * @param {Array} spans — сплошные куски стены [{from,to}] без проёмов
 * @param {object} look — цвета отделки комнаты
 */
function addWallTrim(parts, wall, spans, look) {
  const T = WALL_T;

  // ── фаска ──
  // B добавляет фаску по всем рёбрам (44 треугольника), BX — плоский (12).
  // Плинтус, поясок и карниз — профильные детали, на них фаска и есть форма.
  // Полосы обоев — плоские, фаска им не нужна: на 24 полосах это 800
  // лишних треугольников.
  const along = (ww, hh, yy, mat, depth, chamfer = true) => {
    const f = chamfer ? B : BX;
    if (wall.axis === 'x') parts.push(f(ww, hh, depth ?? T, wall.from + ww / 2, yy, wall.at, mat));
    else parts.push(f(depth ?? T, hh, ww, wall.at, yy, wall.from + ww / 2, mat));
  };

  // на чердаке и в подвале стены «как есть»: одна панель на всех — это и есть
  // «все комнаты одинаковые»
  if (look.flatWalls) {
    for (const sp of spans) {
      const w = sp.to - sp.from;
      if (w < 0.05) continue;
      wall.from = sp.from;
      along(w, 0.07, HEIGHTS.floorHeight - 0.07, look.trim, T + 0.03, false);
    }
    return;
  }

  // Профиль стены снизу вверх:
  //   0 … 0.10  плинтус (глубже всего — он и перекрывает стык пола)
  //   0.10 … 0.98 панель с филёнками
  //   0.98 … 1.03 поясок
  //   1.03 … 2.92 обои с полосами и бордюром
  //   2.92 … 3.10 карниз (два хода)
  const BASE = 0.10, WAIN = 0.98, RAIL = 0.05, CORN = 0.18;
  const WALL_TOP = HEIGHTS.floorHeight;

  for (const sp of spans) {
    const w = sp.to - sp.from;
    if (w < 0.05) continue;
    wall.from = sp.from;

    // ── плинтус: ОДИН ход, но с выносом и фаской по верхнему ребру.
    // Два хода (тело + галтель) стоили ещё один бокс на каждый кусок стены,
    // а на телефоне тень от галтели всё равно не читается: разница видна
    // только в профиль. Фаска B даёт ту же световую полоску дешевле.
    along(w, BASE, 0, look.trim, T + 0.055);

    // ── панель ──
    along(w, WAIN - BASE, BASE, look.wainscot ?? 'wainscot', T + 0.02);

    // ── филёнки ──
    // Филёнка — это ВЫСТУП, а не утопленная рамка. Сначала я сделал рамку
    // внутри панели (глубина панели + 6 мм), но панель — сплошная коробка:
    // рамка оказалась ВНУТРИ неё и не рисовалась вообще. Внешне «редизайн»
    // был неотличим от плоской стены. Теперь поле выступает на 2.5 см за
    // панель: свет ложится на его боковые грани, и появляется тень по краю —
    // то, что читается как филёнка.
    const panelTop = WAIN - 0.15;
    const panelBot = BASE + 0.13;
    const ph = panelTop - panelBot;
    if (ph > 0.12 && w > 0.6) {
      const gap = 0.14;
      const cellW = 1.02;
      const n = Math.max(1, Math.floor((w - gap * 2) / cellW));
      const total = (w - gap * 2) / n;
      for (let i = 0; i < n; i++) {
        const cw = total - 0.16;
        if (cw < 0.16) continue;
        const cx = sp.from + gap + i * total + total / 2;
        const depth = T + 0.055;
        // поле светлее панели: та же краска в один тон темнее не видна в
        // сумерках, а игра ночная. Светлое поле на тёмной панели — это уже
        // рисунок стены, а не «покрашено снизу».
        const mat = look.fillet ?? look.trim;
        if (wall.axis === 'x') parts.push(B(cw, ph, depth, cx, panelBot, wall.at, mat));
        else parts.push(B(depth, ph, cw, wall.at, panelBot, cx, mat));
      }
    }

    // ── поясок: полка с выносом, отделяющая панель от обоев
    along(w, RAIL, WAIN, look.trim, T + 0.055);

    // ── обои: полосы + бордюр под карнизом
    const y0 = WAIN + RAIL + 0.016;
    const yTop = WALL_TOP - CORN;
    const h = yTop - y0;
    if (h > 0.2 && w > 0.32) {
      const stripe = 0.07;
      const step = 0.62;
      for (let x = sp.from + 0.15; x < sp.to - stripe - 0.08; x += step) {
        if (wall.axis === 'x') parts.push(BX(stripe, h, T + 0.008, x, y0, wall.at, look.stripe ?? look.wall));
        else parts.push(BX(T + 0.008, h, stripe, wall.at, y0, x, look.stripe ?? look.wall));
      }
      // бордюр: узкая полоса другого цвета в 12 см под карнизом — верхняя
      // граница обоев, без неё полосы обрываются в воздухе
      along(w, 0.075, yTop - 0.075, look.stripe ?? look.wall, T + 0.014, false);
    }

    // ── карниз: узкий жёлоб + широкий вынос. Карниз на потолке даёт
    // горизонталь, по которой видно, что комната — коробка, а не тоннель.
    along(w, CORN - 0.05, WALL_TOP - CORN, look.trim, T + 0.048);
    along(w, 0.05, WALL_TOP - 0.05, look.trim, T + 0.10, false);
  }
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
        if (wall.axis === 'x') parts.push(BX(w, HEIGHTS.floorHeight, WALL_T, cx, 0, wall.at, look.wall));
        else parts.push(BX(WALL_T, HEIGHTS.floorHeight, w, wall.at, 0, cx, look.wall));
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
    // Плинтус и панель у соседей тоже нужны: без них в проём видно голую
    // коробку, и «настоящая комната» читается как пустой ящик.
    for (const wall of walls) {
      for (const s2 of solidSpans(wall.len, openings[wall.side])) {
        const w2 = s2.to - s2.from;
        if (w2 < 0.05) continue;
        const c2 = s2.from + w2 / 2;
        if (wall.axis === 'x') {
          parts.push(BX(w2, 0.1, WALL_T + 0.02, c2, 0, wall.at, look.trim));
          parts.push(BX(w2, 0.5, WALL_T + 0.012, c2, 0, wall.at, look.wainscot ?? 'wainscot'));
        } else {
          parts.push(BX(WALL_T + 0.02, 0.1, w2, wall.at, 0, c2, look.trim));
          parts.push(BX(WALL_T + 0.012, 0.5, w2, wall.at, 0, c2, look.wainscot ?? 'wainscot'));
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
    // панель, поясок, карниз и полосы обоев — стена перестаёт быть пятном
    addWallTrim(parts, wall, spans, look);
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
          nightBehind(glass, wall, cx, w, bottom, o.h);
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
          nightBehind(glass, wall, cx, w, bottom, o.h);
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
