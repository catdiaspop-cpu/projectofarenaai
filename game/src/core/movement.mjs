// Шаг мальчика по комнате: обход мебели и стен.
//
// Вынесено из main.mjs, чтобы это можно было прогнать в node на сотнях кадров.
// Без этого «джойстик работает» — это утверждение, а не проверка.
//
// Правило скольжения: если полный шаг упирается в препятствие, пробуем
// отдельно по осям. Так персонаж не залипает на углу стола, а съезжает вдоль.

export const BODY_RADIUS = 0.22;   // полутолщина мальчика
export const PAD = 0.15;           // запас при обходе мебели
export const SILL = 0.28;          // ширина порога у двери: в него можно войти

/**
 * Влезает ли точка в комнату и не в мебель.
 * @param {Array} openings — проёмы (двери): [{ side:'n'|'s'|'w'|'e', from, to }]
 *        Проём — это не стена: в него можно войти, и выйти за край комнаты
 *        можно ровно через него. Так двери становятся настоящими, а не
 *        телепортацией.
 */
export function fits(pos, room, obstacles = [], openings = []) {
  const inOpening = openings.find((o) => pointInOpening(pos, room, o));
  if (inOpening) {
    // внутри порога мебель не мешает, но и в стену не проваливаемся
    return true;
  }
  if (pos.x < BODY_RADIUS || pos.z < BODY_RADIUS) return false;
  if (pos.x > room.w - BODY_RADIUS || pos.z > room.d - BODY_RADIUS) return false;
  for (const o of obstacles) {
    if (
      pos.x > o.x0 - PAD && pos.x < o.x1 + PAD &&
      pos.z > o.z0 - PAD && pos.z < o.z1 + PAD
    ) return false;
  }
  return true;
}

/** Точка в полосе порога (в пределах SILL от стены). */
export function pointInOpening(pos, room, o) {
  const half = (o.to - o.from) / 2;
  const mid = o.from + half;
  if (o.side === 'n') return Math.abs(pos.z) <= SILL && Math.abs(pos.x - mid) <= half;
  if (o.side === 's') return Math.abs(pos.z - room.d) <= SILL && Math.abs(pos.x - mid) <= half;
  if (o.side === 'w') return Math.abs(pos.x) <= SILL && Math.abs(pos.z - mid) <= half;
  if (o.side === 'e') return Math.abs(pos.x - room.w) <= SILL && Math.abs(pos.z - mid) <= half;
  return false;
}

/**
 * Где мальчик оказался после шага в дверь: за порогом.
 * → { side, room: 'new'|'same', step } — если side не null, пора менять комнату.
 */
export function crossedThreshold(pos, room, openings = []) {
  for (const o of openings) {
    const half = (o.to - o.from) / 2;
    const mid = o.from + half;
    // Порог = линия стены. Раньше условие требовало зайти почти на самый
    // край разрешённой полосы (SILL минус 2 см), и при неудачном шаге мальчик
    // застревал в проёме навсегда: до порога не дотянуться, а дальше не
    // пускает проверка «не в стене». Теперь достаточно пересечь стену.
    if (o.side === 'n' && pos.z < -0.02 && Math.abs(pos.x - mid) <= half) {
      return { side: 'n', out: { x: pos.x, z: 0 } };
    }
    if (o.side === 's' && pos.z > room.d + 0.02 && Math.abs(pos.x - mid) <= half) {
      return { side: 's', out: { x: pos.x, z: room.d } };
    }
    if (o.side === 'w' && pos.x < -0.02 && Math.abs(pos.z - mid) <= half) {
      return { side: 'w', out: { x: 0, z: pos.z } };
    }
    if (o.side === 'e' && pos.x > room.w + 0.02 && Math.abs(pos.z - mid) <= half) {
      return { side: 'e', out: { x: room.w, z: pos.z } };
    }
  }
  return null;
}

/**
 * Подвинуть позицию на delta с учётом препятствий.
 * → { pos, moved, blocked }
 */
export function slide(pos, delta, room, obstacles = [], openings = []) {
  const next = { x: pos.x + delta.x, z: pos.z + delta.z };

  if (fits(next, room, obstacles, openings)) {
    return { pos: next, moved: Math.hypot(delta.x, delta.z), blocked: false };
  }

  // скольжение по осям: отдельно X, отдельно Z
  const tryX = { x: next.x, z: pos.z };
  const tryZ = { x: pos.x, z: next.z };

  if (fits(tryX, room, obstacles, openings) && Math.abs(delta.x) > 1e-6) {
    return { pos: tryX, moved: Math.abs(delta.x), blocked: true };
  }
  if (fits(tryZ, room, obstacles, openings) && Math.abs(delta.z) > 1e-6) {
    return { pos: tryZ, moved: Math.abs(delta.z), blocked: true };
  }

  // упёрлись в угол: не двигаемся, но и не «проскакиваем» сквозь
  return { pos: { ...pos }, moved: 0, blocked: true };
}

/**
 * Шаг по стику: направление в мире × скорость × dt.
 * dir — единичный вектор, speed — м/с, dt — секунды.
 */
export function step(pos, dir, speed, dt, room, obstacles = [], openings = []) {
  if (!speed || !dt || !dir) return { pos: { ...pos }, moved: 0, blocked: false };
  const len = Math.hypot(dir.x, dir.z);
  if (len < 1e-6) return { pos: { ...pos }, moved: 0, blocked: false };
  const delta = { x: (dir.x / len) * speed * dt, z: (dir.z / len) * speed * dt };
  return slide(pos, delta, room, obstacles, openings);
}

/** Стик (−1…1, экранные оси) → единичный вектор в мире по матрице камеры. */
export function dirFromStick(ix, iy, yaw) {
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  let dx = fwdX * -iy + rightX * ix;
  let dz = fwdZ * -iy + rightZ * ix;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}
