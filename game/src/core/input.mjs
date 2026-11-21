// Ввод для телефона: одна рука, большой палец, без джойстика.
//
// Чистая логика: получает события указателя, отдаёт намерения.
// Никакого DOM внутри — поэтому проверяется в node с фейковыми событиями.
//
// Жесты:
//   тап по комнате на разрезе  → перейти туда
//   тап по точке в комнате     → подойти/взаимодействовать
//   удержание в комнате        → слушать (и «задержать дыхание» при монстре)
//   свайп влево/вправо         → повернуться (осмотреться)
//   двойной тап                → присесть/встать
//   тап по прибору снизу       → фонарь / рюкзак / меню

export const GESTURE = {
  TAP: 'tap',
  HOLD: 'hold',
  SWIPE: 'swipe',
  DOUBLE: 'double',
  CANCEL: 'cancel',
};

export const HOLD_MS = 340;         // сколько держать, чтобы это считалось удержанием
export const HOLD_REPEAT_MS = 250;  // повтор «слушать», пока держишь
export const SWIPE_MIN = 28;        // px, чтобы считаться свайпом
export const DOUBLE_MS = 260;       // окно двойного тапа
export const MOVE_TOLERANCE = 12;   // px, дальше — уже не тап

/**
 * Разборщик жестов. Один палец, но допускаем второй (второй палец = отмена).
 */
export class GestureParser {
  constructor(opts = {}) {
    this.reset();
    this.holdMs = opts.holdMs ?? HOLD_MS;
    this.swipeMin = opts.swipeMin ?? SWIPE_MIN;
    this.on = opts.on ?? (() => {});
    this.lastTapAt = -Infinity;
    this.lastTapPos = null;
    this.holdFired = false;
    this.repeatAt = 0;
  }

  reset() {
    this.active = null;
    this.holdFired = false;
  }

  /** pointerdown: {x, y, id, t, target} */
  down(e) {
    if (this.active && e.id !== this.active.id) {
      // второй палец — отменяем всё, это защита от случайных нажатий
      this.cancel();
      return;
    }
    this.active = { id: e.id, x0: e.x, y0: e.y, x: e.x, y: e.y, t0: e.t, target: e.target, moved: false };
    this.holdFired = false;
    this.repeatAt = e.t + this.holdMs;
  }

  /** pointermove */
  move(e) {
    if (!this.active || e.id !== this.active.id) return;
    this.active.x = e.x;
    this.active.y = e.y;
    if (Math.hypot(e.x - this.active.x0, e.y - this.active.y0) > MOVE_TOLERANCE) this.active.moved = true;
    // свайп срабатывает сразу, не дожидаясь отпускания
    if (this.active.moved && !this.holdFired) {
      const dx = e.x - this.active.x0;
      if (Math.abs(dx) >= this.swipeMin) {
        this.on({ type: GESTURE.SWIPE, dir: dx > 0 ? 1 : -1, target: this.active.target, x: e.x, y: e.y, t: e.t });
        this.swipeConsumed = true;
        this.holdFired = true; // блокируем и удержание, и тап
      }
    }
  }

  /** pointerup */
  up(e) {
    if (!this.active || e.id !== this.active.id) return;
    const a = this.active;
    const dt = e.t - a.t0;
    const dist = Math.hypot(e.x - a.x0, e.y - a.y0);

    if (!this.holdFired && dist <= MOVE_TOLERANCE) {
      // двойной тап?
      const isDouble =
        this.lastTapPos &&
        e.t - this.lastTapAt < DOUBLE_MS &&
        Math.hypot(e.x - this.lastTapPos.x, e.y - this.lastTapPos.y) < 40;
      if (isDouble) {
        this.lastTapAt = -Infinity;
        this.lastTapPos = null;
        this.on({ type: GESTURE.DOUBLE, target: a.target, x: e.x, y: e.y, t: e.t });
      } else {
        this.lastTapAt = e.t;
        this.lastTapPos = { x: e.x, y: e.y };
        this.on({ type: GESTURE.TAP, target: a.target, x: e.x, y: e.y, t: e.t, duration: dt });
      }
    } else if (this.holdFired && !a.moved) {
      this.on({ type: GESTURE.HOLD_END, target: a.target, t: e.t });
    }
    this.active = null;
    this.swipeConsumed = false;
  }

  cancel() {
    if (this.active) this.on({ type: GESTURE.CANCEL, target: this.active.target });
    this.active = null;
  }

  /** Вызывать каждый кадр: превращает долгое удержание в событие. */
  tick(t) {
    if (!this.active || this.active.moved) return;
    if (!this.holdFired && t >= this.repeatAt) {
      this.holdFired = true;
      this.on({ type: GESTURE.HOLD, target: this.active.target, t });
      this.repeatAt = t + HOLD_REPEAT_MS;
    } else if (this.holdFired && t >= this.repeatAt) {
      this.on({ type: GESTURE.HOLD, target: this.active.target, t, repeat: true });
      this.repeatAt = t + HOLD_REPEAT_MS;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Прогулка внутри комнаты: тап по полу = идти туда. Примитивная, но честная
// навигация: мальчик идёт по прямой, обходит мебель по кратчайшему обходу.
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {{x,z}} from
 * @param {{x,z}} to
 * @param {Array} obstacles — прямоугольники [{x0,x1,z0,z1}] в координатах комнаты
 * @returns {Array<{x,z}>} точки пути
 */
export function planWalk(from, to, obstacles = []) {
  const r = 0.16; // радиус мальчика
  // если прямая свободна — идём прямо
  if (!segmentHits(from, to, obstacles, r)) return [from, to];

  // иначе: обход по углам всех препятствий. Углы берём с запасом,
  // и проверяем всю цепочку, а не только первый сегмент
  const pad = r + 0.16;
  const candidates = [];
  for (const o of obstacles) {
    if (o.noGo) continue;
    candidates.push(
      { x: o.x0 - pad, z: o.z0 - pad }, { x: o.x1 + pad, z: o.z0 - pad },
      { x: o.x0 - pad, z: o.z1 + pad }, { x: o.x1 + pad, z: o.z1 + pad },
    );
  }
  let best = null;
  let bestLen = Infinity;
  for (const c of candidates) {
    if (insideAny(c, obstacles, r * 0.9)) continue;
    if (segmentHits(from, c, obstacles, r * 0.8)) continue;
    const len = dist(from, c) + dist(c, to);
    if (len >= bestLen) continue;
    if (segmentHits(c, to, obstacles, r * 0.8)) continue;
    bestLen = len;
    best = c;
  }
  if (best) return [from, best, to];

  // два угла: через промежуточную точку
  let bestTwo = null;
  let bestTwoLen = Infinity;
  for (const a of candidates) {
    if (insideAny(a, obstacles, r * 0.9) || segmentHits(from, a, obstacles, r * 0.8)) continue;
    for (const b of candidates) {
      if (a === b || insideAny(b, obstacles, r * 0.9)) continue;
      if (segmentHits(a, b, obstacles, r * 0.8) || segmentHits(b, to, obstacles, r * 0.8)) continue;
      const len = dist(from, a) + dist(a, b) + dist(b, to);
      if (len < bestTwoLen) { bestTwoLen = len; bestTwo = [a, b]; }
    }
  }
  if (bestTwo) return [from, ...bestTwo, to];

  // совсем зажаты: идём напрямую — игра посчитает это «спотыканием»
  return [from, to];
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function insideAny(p, obstacles, r) {
  for (const o of obstacles) {
    if (p.x > o.x0 - r && p.x < o.x1 + r && p.z > o.z0 - r && p.z < o.z1 + r) return true;
  }
  return false;
}

/** Пересекает ли отрезок прямоугольники (с учётом радиуса). */
export function segmentHits(a, b, obstacles, r = 0) {
  for (const o of obstacles) {
    if (segmentRect(a, b, o.x0 - r, o.z0 - r, o.x1 + r, o.z1 + r)) return true;
  }
  return false;
}

function segmentRect(a, b, x0, z0, x1, z1) {
  // быстрое отсечение по габаритам
  if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1) return false;
  if (Math.max(a.z, b.z) < z0 || Math.min(a.z, b.z) > z1) return false;
  // если конец внутри
  if (a.x > x0 && a.x < x1 && a.z > z0 && a.z < z1) return true;
  if (b.x > x0 && b.x < x1 && b.z > z0 && b.z < z1) return true;
  // пересечение с четырьмя сторонами
  return (
    segSeg(a, b, { x: x0, z: z0 }, { x: x1, z: z0 }) ||
    segSeg(a, b, { x: x1, z: z0 }, { x: x1, z: z1 }) ||
    segSeg(a, b, { x: x1, z: z1 }, { x: x0, z: z1 }) ||
    segSeg(a, b, { x: x0, z: z1 }, { x: x0, z: z0 })
  );
}

function segSeg(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.z - p3.z) - (p2.z - p1.z) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.z - p3.z) - (p3.z - p1.z) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.z - p1.z) - (p3.z - p1.z) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Движение по пути. Возвращает { x, z, done, dir }.
 * Скорость в м/с, шаг dt в секундах.
 */
export function stepAlong(path, progress, speed, dt) {
  if (!path || path.length < 2) return { x: path?.[0]?.x ?? 0, z: path?.[0]?.z ?? 0, done: true, dir: 0 };
  let left = speed * dt;
  let i = progress.i ?? 0;
  let x = progress.x ?? path[0].x;
  let z = progress.z ?? path[0].z;
  while (left > 0 && i < path.length - 1) {
    const target = path[i + 1];
    const d = Math.hypot(target.x - x, target.z - z);
    if (d <= left) {
      x = target.x; z = target.z; left -= d; i++;
    } else {
      x += ((target.x - x) / d) * left;
      z += ((target.z - z) / d) * left;
      left = 0;
    }
  }
  const done = i >= path.length - 1;
  const dir = Math.atan2(
    (path[Math.min(i + 1, path.length - 1)].x - x),
    (path[Math.min(i + 1, path.length - 1)].z - z),
  );
  return { x, z, done, dir, i };
}
