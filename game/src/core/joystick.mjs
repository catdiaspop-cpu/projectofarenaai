// Виртуальный джойстик: аналоговый, для большого пальца.
//
// Логика отдельно от DOM — чтобы её можно было проверить в node:
// мёртвая зона, ограничение радиуса, плавный разгон, «выбежал за базу — стик
// уехал за пальцем» (как в мобильных играх, палец не теряет стик).
//
// Два режима скорости:
//   ходьба  — по умолчанию, тихая
//   бег     — если нажать кнопку бега или сильно наклонить стик

export const STICK = {
  deadZone: 0.14,      // доля радиуса, ниже которой стик молчит
  maxRadius: 64,       // px
  followRadius: 88,    // если палец ушёл дальше — база едет за ним
  sprintAt: 0.88,      // доля радиуса, где начинается бег
  smoothing: 14,       // как быстро значение догоняет палец (в секунду)
};

/**
 * Состояние одного стика.
 * center — точка появления (там, где коснулись), в CSS-пикселях.
 */
export class Stick {
  constructor(opts = {}) {
    this.cfg = { ...STICK, ...opts };
    this.active = false;
    this.id = null;
    this.base = { x: 0, y: 0 };   // центр базы
    this.knob = { x: 0, y: 0 };   // положение ручки относительно базы
    this.raw = { x: 0, y: 0 };    // нормализованный вектор -1..1
    this.value = { x: 0, y: 0 };  // сглаженный вектор
    this.magnitude = 0;
    this.sprinting = false;
  }

  down(id, x, y) {
    this.active = true;
    this.id = id;
    this.base = { x, y };
    this.knob = { x: 0, y: 0 };
    this.raw = { x: 0, y: 0 };
    this.setValue({ x: 0, y: 0 });
    this.magnitude = 0;
    this.sprinting = false;
  }

  move(id, x, y) {
    if (!this.active || id !== this.id) return false;
    let dx = x - this.base.x;
    let dy = y - this.base.y;
    const dist = Math.hypot(dx, dy);

    // база едет за пальцем, если он ушёл слишком далеко
    if (dist > this.cfg.followRadius) {
      const pull = dist - this.cfg.followRadius;
      this.base.x += (dx / dist) * pull;
      this.base.y += (dy / dist) * pull;
      dx = x - this.base.x;
      dy = y - this.base.y;
    }

    // ограничение ручки радиусом
    const d2 = Math.hypot(dx, dy);
    const max = this.cfg.maxRadius;
    if (d2 > max) {
      dx = (dx / d2) * max;
      dy = (dy / d2) * max;
    }
    this.knob = { x: dx, y: dy };

    // нормализация
    let nx = dx / max;
    let ny = dy / max;
    const mag = Math.min(1, Math.hypot(nx, ny));
    if (mag < this.cfg.deadZone) {
      // внутри мёртвой зоны — плавно гасим, а не рубим
      const k = mag / this.cfg.deadZone;
      this.raw = { x: 0, y: 0 };
      this.magnitude = 0;
      this.sprinting = false;
      this.deadZoneK = k;
    } else {
      // перенормировка: от мёртвой зоны до 1
      const scaled = (mag - this.cfg.deadZone) / (1 - this.cfg.deadZone);
      const inv = 1 / (Math.hypot(nx, ny) || 1);
      this.raw = { x: nx * inv * scaled, y: ny * inv * scaled };
      this.magnitude = scaled;
      this.sprinting = scaled >= this.cfg.sprintAt;
      this.deadZoneK = 1;
    }
    return true;
  }

  up(id) {
    if (id !== undefined && id !== this.id) return false;
    this.active = false;
    this.id = null;
    this.raw = { x: 0, y: 0 };
    this.magnitude = 0;
    this.sprinting = false;
    return true;
  }

  /** Сглаживание: вызывать каждый кадр. */
  update(dt) {
    const target = this.active ? this.raw : { x: 0, y: 0 };
    const t = Math.min(1, dt * this.cfg.smoothing);
    this.value.x += (target.x - this.value.x) * t;
    this.value.y += (target.y - this.value.y) * t;
    if (!this.active) {
      this.knob = { x: this.value.x * this.cfg.maxRadius, y: this.value.y * this.cfg.maxRadius };
    }
  }

  setValue(v) {
    this.value = { x: v.x, y: v.y };
  }

  /** Текущая скорость в м/с: чем сильнее наклон, тем быстрее. */
  speedFor(walkSpeed = 0.95, runSpeed = 1.75, allowSprint = true) {
    const v = Math.min(1, Math.hypot(this.value.x, this.value.y));
    if (v < 0.02) return 0;
    const t = v;
    const sprint = allowSprint && (this.sprinting || v > 0.92);
    return sprint ? runSpeed : walkSpeed * (0.35 + t * 0.65);
  }
}

/**
 * Выбор режима движения по стику и кнопкам.
 * Возвращает { state, speedKey } для анимации и для шума.
 */
export function moveMode(moveStick, { forceSprint = false, crouching = false } = {}) {
  if (crouching) return { state: 'sneak', speedKey: 'sneak' };
  const mag = Math.hypot(moveStick.value.x, moveStick.value.y);
  if (mag < 0.05) return { state: 'idle', speedKey: 'idle' };
  if (forceSprint || moveStick.sprinting) return { state: 'run', speedKey: 'run' };
  if (mag < 0.5) return { state: 'sneak', speedKey: 'sneak' };
  return { state: 'walk', speedKey: 'walk' };
}

/** Ограничение поворота камеры по вертикали — чтобы не смотреть в потолок/пол. */
export function clampPitch(pitch, min = -0.55, max = 0.45) {
  return Math.max(min, Math.min(max, pitch));
}

/**
 * Дельта поворота камеры за кадр.
 * Скорость ограничена, чтобы на 30 fps камера не прыгала в пол-оборота:
 * максимум ~2.2 рад/с по горизонтали и ~1.2 рад/с по вертикали.
 */
export function cameraDelta(stick, dt, opts = {}) {
  const maxYaw = opts.maxYawSpeed ?? 2.2;    // рад/с
  const maxPitch = opts.maxPitchSpeed ?? 1.2; // рад/с
  const step = Math.min(dt, 0.1);
  return {
    yaw: -stick.value.x * maxYaw * step,
    pitch: -stick.value.y * maxPitch * step,
  };
}
