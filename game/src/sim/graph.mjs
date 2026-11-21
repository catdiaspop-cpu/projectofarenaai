// Навигация по дому: комнаты, проёмы, маршруты и их цена.
//
// Ключевая идея: дом — это граф, а не 3D-поле. Мальчик не «ходит свободно
// по мешам», он переходит из комнаты в комнату через дверь, а внутри комнаты
// у него есть точки интереса. Это даёт три вещи:
//   * он никогда не застревает в геометрии;
//   * время похода считается детерминированно и его можно балансировать;
//   * на телефоне достаточно тапа по комнате, никакого джойстика.

import { ROOMS, DOORS, POINTS, HEIGHTS } from '../data/house.mjs';

const byId = new Map(ROOMS.map((r) => [r.id, r]));
export const roomById = (id) => byId.get(id);

/** Скорости в м/с. Страх и режим влияют на скорость. */
export const SPEED = {
  normal: 0.95,     // ребёнок идёт спокойно
  sneak: 0.42,      // крадётся
  run: 1.75,        // бежит (громко)
  scared: 1.25,     // паника: быстрее, но шумнее
  stairUp: 0.55,    // по лестнице
  stairDown: 0.7,
  // «на ощупь» ночью: без фонаря идёшь медленнее, но тише
  blind: 0.3,
};

/**
 * Стоимость прохода через комнату: диагональ прямоугольника / скорость,
 * плюс надбавка за «узкие места». Так переход через гостиную дороже, чем через кладовку.
 */
export function roomCrossingSeconds(room, mode = 'normal', opts = {}) {
  const diag = Math.hypot(room.rect.w, room.rect.d);
  const speed = SPEED[mode] ?? SPEED.normal;
  let s = diag / speed;
  if (room.kind === 'stairs') s *= 1.9;
  if (room.kind === 'attic') s *= 1.2;
  // захламлённость замедляет
  const clutter = opts.clutter ?? 0;
  s *= 1 + clutter * 1.5;
  // бесшумный маршрут по памяти — быстрее, потому что не ощупь
  if (opts.byMemory) s *= 0.55;
  return s;
}

/** Шум за проход: зависит от пола, обуви и режима. */
export function crossingNoise(room, mode = 'normal', opts = {}) {
  const base = mode === 'run' ? 3.2 : mode === 'sneak' ? 0.15 : 1.0;
  const floor = opts.carpet ? 0.35 : 1.0;
  const socks = opts.socks ? 0.75 : 1.0;
  const clutter = 1 + (opts.clutter ?? 0) * 2.2; // разбросанные вещи = задеваешь
  return base * floor * socks * clutter;
}

/** Соседние комнаты по дверям (без проверки замков — это отдельно). */
export function neighbours(roomId) {
  const out = [];
  for (const d of DOORS) {
    if (d.a === roomId && d.b) out.push({ to: d.b, door: d });
    else if (d.b === roomId) out.push({ to: d.a, door: d });
  }
  return out;
}

/** Проходима ли дверь при текущих условиях. */
export function doorOpen(door, flags = {}) {
  if (!door) return false;
  if (door.lock) return Boolean(flags[door.id]);
  return true;
}

/** Кратчайший путь между комнатами: BFS по дверям, с учётом запертых. */
export function findPath(from, to, flags = {}, mode = 'normal', opts = {}) {
  if (from === to) return { rooms: [from], doors: [], seconds: 0 };
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const { to: nxt, door } of neighbours(cur)) {
      if (prev.has(nxt)) continue;
      if (door.lock && !flags[door.id]) continue;
      prev.set(nxt, { cur, door });
      if (nxt === to) {
        // восстановить путь
        const rooms = [to];
        const doors = [];
        let node = to;
        while (prev.get(node)) {
          const p = prev.get(node);
          doors.unshift(p.door);
          rooms.unshift(p.cur);
          node = p.cur;
        }
        return { rooms, doors, seconds: routeSeconds(rooms, doors, mode, opts) };
      }
      queue.push(nxt);
    }
  }
  return null; // недостижимо
}

/** Время маршрута: сумма переходов по комнатам + цена дверей. */
export function routeSeconds(rooms, doors, mode = 'normal', opts = {}) {
  let s = 0;
  for (let i = 0; i < rooms.length; i++) {
    const r = roomById(rooms[i]);
    if (!r) continue;
    s += roomCrossingSeconds(r, mode, opts);
  }
  s += doors.length * (opts.doorSeconds ?? 2.2);
  return s;
}

/** Маршрут до точки интереса: до комнаты, потом внутри до точки. */
export function routeToPoint(fromRoom, pointId, flags = {}, mode = 'normal', opts = {}) {
  const pt = POINTS.find((p) => p.id === pointId);
  if (!pt) return null;
  const path = findPath(fromRoom, pt.room, flags, mode, opts);
  if (!path) return null;
  const room = roomById(pt.room);
  const inside = Math.hypot(room.rect.w / 2, room.rect.d / 2) * 0.6 / (SPEED[mode] ?? SPEED.normal);
  return { ...path, point: pt, seconds: path.seconds + inside };
}

/** Полный список комнат по этажам — для разреза-карты. */
export function floors() {
  const map = new Map();
  for (const r of ROOMS) {
    if (r.kind === 'yard') continue;
    if (!map.has(r.floor)) map.set(r.floor, []);
    map.get(r.floor).push(r);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

/** Площадь дома — для «ощущения масштаба» и для метрик. */
export function totalArea() {
  return ROOMS.filter((r) => r.kind !== 'yard').reduce((s, r) => s + r.rect.w * r.rect.d, 0);
}

/** Сколько секунд пересечь весь дом (самый длинный маршрут). */
export function longestRoute(flags = {}, mode = 'sneak') {
  let best = { seconds: 0, from: null, to: null };
  const ids = ROOMS.filter((r) => r.kind !== 'yard').map((r) => r.id);
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      const p = findPath(a, b, flags, mode);
      if (p && p.seconds > best.seconds) best = { seconds: p.seconds, from: a, to: b };
    }
  }
  return best;
}
