// Шаг мальчика по комнате: обход мебели и стен.
//
// Вынесено из main.mjs, чтобы это можно было прогнать в node на сотнях кадров.
// Без этого «джойстик работает» — это утверждение, а не проверка.
//
// Правило скольжения: если полный шаг упирается в препятствие, пробуем
// отдельно по осям. Так персонаж не залипает на углу стола, а съезжает вдоль.

export const BODY_RADIUS = 0.22;   // полутолщина мальчика
export const PAD = 0.15;           // запас при обходе мебели
/**
 * Полоса порога, отсчитанная ОТ ЛИНИИ СТЕНЫ в обе стороны.
 *
 * Почему 0.32. Стена рисуется толщиной 0.22 по центру линии, тело мальчика —
 * 0.22 от границы комнаты. Между «тело уже не влезает» (0.22) и «тело ещё не
 * в пороге» не должно оставаться щели: раньше полоса была 0.28 с центром в
 * стене, и на южной стене накрывала z от d−0.28 до d+0.28, то есть
 * захватывала и за стеной. Из-за этого у двери получалась мёртвая зона ~10 см,
 * в которую невозможно шагнуть, — мальчик застревал в полуметре от двери.
 * 0.32 гарантированно перекрывает границу тела с обеих сторон.
 */
export const SILL = 0.32;

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
  // Ход между этажами (лестница, люк): створки нет, «порог» — вся комната.
  // Мальчик входит в него, просто дойдя до нужного места.
  if (o.side === 'any') return true;
  const half = (o.to - o.from) / 2;
  const mid = o.from + half;
  // Полоса порога считается ОТ ЛИНИИ СТЕНЫ и захватывает только внутреннюю
  // сторону. Раньше она была симметричной (|pos.z − 0| ≤ SILL) и на южной
  // стене накрывала z от d−SILL до d+SILL: за стеной, то есть вне комнаты.
  // Из-за этого в порог нельзя было войти до самой стены — а вход в комнату
  // как раз ставит мальчика в 0.36 от стены, и он оказывался зажат между
  // ошибкой в полосе и проверкой границ. Та же симметрия была на всех стенах.
  // По ширине — полпроёма БЕЗ телесной толщины: иначе мальчик «проходит
  // сквозь косяк», а у проёма 0.85 остаётся реальный проход всего 0.41.
  const inside = half - BODY_RADIUS + 0.04;
  if (o.side === 'n') return pos.z >= -SILL && pos.z <= SILL && Math.abs(pos.x - mid) <= inside;
  if (o.side === 's') return pos.z >= room.d - SILL && pos.z <= room.d + SILL && Math.abs(pos.x - mid) <= inside;
  if (o.side === 'w') return pos.x >= -SILL && pos.x <= SILL && Math.abs(pos.z - mid) <= inside;
  if (o.side === 'e') return pos.x >= room.w - SILL && pos.x <= room.w + SILL && Math.abs(pos.z - mid) <= inside;
  return false;
}

/**
 * Где мальчик оказался после шага в дверь: за порогом.
 * → { side, room: 'new'|'same', step } — если side не null, пора менять комнату.
 */
export function crossedThreshold(pos, room, openings = []) {
  for (const o of openings) {
    if (o.side === 'any') {
      // вертикальный переход (лестница, люк): срабатывает, когда мальчик
      // подошёл к точке хода — створки и стены здесь нет
      if (o.at && Math.hypot(pos.x - o.at.x, pos.z - o.at.z) < 0.55) {
        return { side: 'any', out: { x: o.at.x, z: o.at.z } };
      }
      continue;
    }
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
