// Шаг мальчика по комнате: обход мебели и стен.
//
// Вынесено из main.mjs, чтобы это можно было прогнать в node на сотнях кадров.
// Без этого «джойстик работает» — это утверждение, а не проверка.
//
// Правило скольжения: если полный шаг упирается в препятствие, пробуем
// отдельно по осям. Так персонаж не залипает на углу стола, а съезжает вдоль.

export const BODY_RADIUS = 0.22;   // полутолщина мальчика
export const PAD = 0.15;           // запас при обходе мебели

/** Влезает ли точка в комнату и не в мебель. */
export function fits(pos, room, obstacles = []) {
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

/**
 * Подвинуть позицию на delta с учётом препятствий.
 * → { pos, moved, blocked }
 */
export function slide(pos, delta, room, obstacles = []) {
  const next = { x: pos.x + delta.x, z: pos.z + delta.z };

  if (fits(next, room, obstacles)) {
    return { pos: next, moved: Math.hypot(delta.x, delta.z), blocked: false };
  }

  // скольжение по осям: отдельно X, отдельно Z
  const tryX = { x: next.x, z: pos.z };
  const tryZ = { x: pos.x, z: next.z };

  if (fits(tryX, room, obstacles) && Math.abs(delta.x) > 1e-6) {
    return { pos: tryX, moved: Math.abs(delta.x), blocked: true };
  }
  if (fits(tryZ, room, obstacles) && Math.abs(delta.z) > 1e-6) {
    return { pos: tryZ, moved: Math.abs(delta.z), blocked: true };
  }

  // упёрлись в угол: не двигаемся, но и не «проскакиваем» сквозь
  return { pos: { ...pos }, moved: 0, blocked: true };
}

/**
 * Шаг по стику: направление в мире × скорость × dt.
 * dir — единичный вектор, speed — м/с, dt — секунды.
 */
export function step(pos, dir, speed, dt, room, obstacles = []) {
  if (!speed || !dt || !dir) return { pos: { ...pos }, moved: 0, blocked: false };
  const len = Math.hypot(dir.x, dir.z);
  if (len < 1e-6) return { pos: { ...pos }, moved: 0, blocked: false };
  const delta = { x: (dir.x / len) * speed * dt, z: (dir.z / len) * speed * dt };
  return slide(pos, delta, room, obstacles);
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
