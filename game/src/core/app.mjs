// Приложение: состояние мира, игровой цикл, переключение сцен.
//
// Разделение простое и намеренное:
//   world  — данные и правила (часы, шкалы, флаги дверей, порядок комнат)
//   scenes — как это видно (3D-комната или разрез дома)
//   hud    — что нажимает палец (шкалы, кнопки, подсказки)
//
// Никакой физики: мальчик ходит по точкам, дом — граф. Это то, что позволяет
// игре работать на телефоне и не застревать в геометрии.

import { ROOMS, DOORS, POINTS, SPAWN, HEIGHTS, LIGHTS } from '../data/house.mjs';
import { LAYOUT } from '../data/layout.mjs';
import { PROPS } from '../world/props.mjs';
import { findPath, roomById, routeToPoint, SPEED } from '../sim/graph.mjs';
import { stepAlong } from './input.mjs';

/** Фазы суток. Утро, вечер и ночь — по гейм-дизайну. */
export const PHASE = {
  DAY: 'day',
  DUSK: 'dusk',
  NIGHT: 'night',
  MORNING: 'morning',
};

export const GAME_MINUTES_PER_REAL_SECOND = {
  [PHASE.DAY]: 7.5,
  [PHASE.DUSK]: 3,
  [PHASE.NIGHT]: 0.9,   // 9 часов ночи = 10 минут реального времени
  [PHASE.MORNING]: 10,
};

export class World {
  constructor() {
    this.phase = PHASE.NIGHT;
    this.minutes = 21 * 60;      // 21:00
    this.room = SPAWN.child.room;
    this.pos = { ...SPAWN.child.at };
    this.facing = SPAWN.child.facing;
    this.entered = new Set(['childroom']);
    this.doorFlags = {};          // открытые люки и прочее
    this.pendingDoor = null;      // { doorId, target } — дверь открывается, ждём прохода
    this.travelling = false;      // мальчик идёт сквозь порог
    this.scales = { fear: 12, sleep: 20, hunger: 55, bladder: 30 };
    this.lightOn = { 'child-nightlight': true };
    this.path = null;
    this.walkProgress = null;
    this.mode = 'idle';
    this.listening = false;
    this.holdingBreath = false;
    this.paused = false;
    this.events = [];
    this.speedMultiplier = 1;
  }

  get roomData() {
    return roomById(this.room);
  }

  get lay() {
    return LAYOUT[this.room];
  }

  get clockText() {
    const m = Math.floor(this.minutes) % (24 * 60);
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(Math.floor(m % 60)).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  /**
   * Препятствия комнаты для ходьбы (в локальных координатах).
   *
   * Что НЕ является препятствием и почему это была ошибка:
   *   * настенный декор (картины, полки, шторы, выключатели, часы) — они
   *     висят на высоте 1.1–1.5 м, но их проекция на пол попадала в список,
   *     и вдоль стен появлялись невидимые бордюры;
   *   * стропила чердака: footprint 3×3 на комнату 3.4×3.4 — накрывали ВЕСЬ
   *     пол, свободного места оставалось 0%, и мальчик не мог шагнуть вообще;
   *   * ковры и половики — по ним и надо ходить;
   *   * мелочь на полу (игрушки, носки) — она не выше щиколотки, об неё не
   *     спотыкаются, а «застрял на кубике» — худшая из возможных поломок.
   *
   * Плюс запас PAD при обходе уже учтён в movement.mjs, здесь чистые габариты.
   */
  obstacles() {
    const out = [];
    const NOT_AN_OBSTACLE = new Set(['flat', 'wall', 'decoration', 'ceiling']);
    const LOW = 0.30;      // всё, что ниже щиколотки, ноги переступают

    const footprintOf = (it, prop) => {
      const fp = prop.footprint ?? { w: 0.3, d: 0.3 };
      const rot = it.rot ?? 0;
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      return {
        w: fp.w * c + fp.d * s,
        d: fp.w * s + fp.d * c,
      };
    };

    for (const it of this.lay.items) {
      const prop = PROPS[it.prop];
      if (!prop) continue;
      if (NOT_AN_OBSTACLE.has(it.prop)) continue;
      if (prop.tags?.some((t) => NOT_AN_OBSTACLE.has(t))) continue;
      if ((it.y ?? 0) > 0.02) continue;            // висит или стоит на мебели
      if (prop.height !== undefined && prop.height < LOW) continue;
      // footprint — габарит целиком (его видно и по нему считается место на
      // плане), а base — то, что реально мешает НОГАМ: площадка под первой
      // ступенью лестницы, ножки кровати. Без этого «под лестницей нет пола».
      const base = prop.base;
      const fp = base && base.w !== undefined ? base : (prop.footprint ?? { w: 0.3, d: 0.3 });
      const { w, d } = footprintOf(it, { footprint: fp });
      out.push({
        id: it.id,
        x0: it.x - w / 2, x1: it.x + w / 2,
        z0: it.z - d / 2, z1: it.z + d / 2,
      });
    }

    for (const it of this.lay.clutter) {
      const prop = PROPS[it.prop];
      if (!prop) continue;
      if ((it.y ?? 0) > 0.1) continue;             // мелочь на мебели не мешает ногам
      if (prop.tags?.some((t) => NOT_AN_OBSTACLE.has(t))) continue;
      if (prop.height !== undefined && prop.height < LOW) continue;
      const { w, d } = footprintOf(it, prop);
      out.push({
        id: it.id,
        x0: it.x - w / 2, x1: it.x + w / 2,
        z0: it.z - d / 2, z1: it.z + d / 2,
        clutter: true,
      });
    }
    return out;
  }

  /**
   * Ближайшая точка, где мальчик помещается. Нужна на входе в комнату и на
   * старте: спавн по умолчанию (1.7, 2.7) в четырёх комнатах из одиннадцати
   * приходился ВНУТРЬ мебели, и первый же шаг отменялся проверкой «не в
   * стене» — джойстик при этом исправно работал, но мальчик стоял.
   */
  safeSpot(x, z) {
    const r = this.roomData.rect;
    const obs = this.obstacles();
    const fits = (px, pz) => {
      if (px < 0.26 || pz < 0.26 || px > r.w - 0.26 || pz > r.d - 0.26) return false;
      for (const o of obs) {
        if (px > o.x0 - 0.2 && px < o.x1 + 0.2 && pz > o.z0 - 0.2 && pz < o.z1 + 0.2) return false;
      }
      return true;
    };
    // запас до ближайшей мебели и стены — чтобы не появляться вплотную к шкафу
    const clearance = (px, pz) => {
      let best = Math.min(px, pz, r.w - px, r.d - pz);
      for (const o of obs) {
        const dx = Math.max(o.x0 - px, 0, px - o.x1);
        const dz = Math.max(o.z0 - pz, 0, pz - o.z1);
        best = Math.min(best, Math.hypot(dx, dz));
      }
      return best;
    };
    // Расходящаяся спираль до 3.5 м — этого хватает на любую комнату дома.
    // Берём САМУЮ свободную точку из всех колец, а не первую попавшуюся:
    // иначе мальчик появлялся вплотную к кровати, и весь экран занимала она.
    let best = null;
    for (let ring = 0.1; ring < 3.5; ring += 0.12) {
      const steps = Math.max(10, Math.round(ring * 16));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * ring;
        const pz = z + Math.sin(a) * ring;
        if (!fits(px, pz)) continue;
        const c = clearance(px, pz);
        if (!best || c > best.c) best = { x: px, z: pz, c };
      }
      if (best && best.c >= 1.1) break;   // есть простор — дальше не ищем
    }
    if (best) return { x: best.x, z: best.z };
    return { x: r.w / 2, z: r.d / 2 };
  }

  /**
   * Сдвинуть точку на минимальное расстояние, чтобы она не была в мебели.
   *
   * Это НЕ safeSpot: тот ищет «где просторнее» и может увести на метры.
   * Здесь важно сохранить место входа — сдвигаем на сантиметры, и только
   * если исходная точка реально внутри препятствия.
   */
  nudgeSpot(x, z) {
    const r = this.roomData.rect;
    const obs = this.obstacles();
    const free = (px, pz) => {
      if (px < 0.24 || pz < 0.24 || px > r.w - 0.24 || pz > r.d - 0.24) return false;
      return !obs.some((o) => px > o.x0 - 0.18 && px < o.x1 + 0.18 && pz > o.z0 - 0.18 && pz < o.z1 + 0.18);
    };
    if (free(x, z)) return { x, z };
    // ближайшая свободная точка: кольца по 6 см, не дальше 0.9 м
    for (let ring = 0.06; ring <= 0.9; ring += 0.06) {
      const steps = Math.max(8, Math.round(ring * 22));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * ring;
        const pz = z + Math.sin(a) * ring;
        if (free(px, pz)) return { x: px, z: pz };
      }
    }
    // совсем зажали — уходим в центр, но это уже аварийный случай
    return { x: r.w / 2, z: r.d / 2 };
  }

  /** Идти к точке комнаты (локальные координаты). */
  walkTo(x, z, mode = 'sneak') {
    if (!this.inBounds(x, z)) return false;
    // Прямой отрезок: обход мебели делает movement.mjs на каждом кадре,
    // а заранее проложенный путь больше не нужен.
    this.path = { points: [{ x: this.pos.x, z: this.pos.z }, { x, z }] };
    this.walkProgress = { i: 0, x: this.pos.x, z: this.pos.z };
    this.mode = mode === 'run' ? 'run' : mode === 'normal' ? 'walk' : 'sneak';
    this.speed = SPEED[this.mode] ?? SPEED.normal;
    return true;
  }

  inBounds(x, z) {
    const r = this.roomData.rect;
    const pad = 0.2;
    return x > pad && z > pad && x < r.w - pad && z < r.d - pad;
  }

  /** Перейти в соседнюю комнату через дверь. */
  goToRoom(roomId) {
    const from = this.room;
    const path = findPath(from, roomId, this.doorFlags, this.mode === 'run' ? 'run' : 'sneak');
    if (!path) return false;
    // точка появления: у двери, через которую вошли
    const door = path.doors[0];
    const target = roomById(roomId);
    let spawn = { x: target.rect.w / 2, z: target.rect.d / 2 };
    if (door) {
      spawn = { x: door.at.x - target.rect.x, z: door.at.z - target.rect.z };
      // отойти от двери внутрь
      const cx = target.rect.w / 2, cz = target.rect.d / 2;
      const dx = cx - spawn.x, dz = cz - spawn.z;
      const len = Math.hypot(dx, dz) || 1;
      spawn.x += (dx / len) * 0.55;
      spawn.z += (dz / len) * 0.55;
    }
    this.room = roomId;
    this.pos = spawn;
    this.path = null;
    this.walkProgress = null;
    this.mode = 'idle';
    this.entered.add(roomId);
    this.emit('room', { room: roomId, from, seconds: path.seconds });
    return true;
  }

  /**
   * Прямой вход в комнату с готовой точкой появления.
   * Нужен настоящим дверям: мальчик уже прошёл порог, и переставлять его
   * куда-то в середину комнаты нельзя — он должен оказаться у той же двери.
   */
  goToRoomDirect(roomId, entry, { nudge = true } = {}) {
    const from = this.room;
    if (!roomId) return false;
    this.room = roomId;
    // ── точка входа = ровно та, где он шагнул ──
    // Раньше здесь всегда вызывался safeSpot(), а он выбирает САМУЮ СВОБОДНУЮ
    // точку в радиусе 3.5 м — то есть перебрасывал мальчика через полкомнаты.
    // На экране это чистый телепорт: шагнул в дверь, а кадр оказался у шкафа
    // на другой стороне. Теперь по умолчанию ставим как есть; сдвигаем
    // только если попали ровно в мебель (и сдвигаем по минимуму, а не в
    // самый простор).
    this.pos = nudge ? this.nudgeSpot(entry.x, entry.z) : { x: entry.x, z: entry.z };
    this.path = null;
    this.walkProgress = null;
    this.mode = 'idle';
    this.travelling = false;
    this.entered.add(roomId);
    this.emit('room', { room: roomId, from, seconds: 0 });
    return true;
  }

  setPhase(phase) {
    this.phase = phase;
    this.emit('phase', { phase });
  }

  /** Тик мира. dt — реальные секунды. */
  update(dt) {
    if (this.paused) return;
    const perSec = GAME_MINUTES_PER_REAL_SECOND[this.phase] ?? 1;
    this.minutes += dt * perSec * this.speedMultiplier;

    // ходьба внутри комнаты
    if (this.path && this.walkProgress) {
      const s = stepAlong(this.path, this.walkProgress, this.speed ?? SPEED.sneak, dt);
      this.pos = { x: s.x, z: s.z };
      this.facing = s.dir;
      this.walkProgress = { i: s.i, x: s.x, z: s.z };
      if (s.done) {
        this.path = null;
        this.walkProgress = null;
        this.mode = this.listening ? 'listen' : 'idle';
        this.emit('arrived', { x: s.x, z: s.z });
      }
    }

    // шкалы тел (пока грубо, точные числа — в симуляции)
    this.scales.sleep = Math.min(100, this.scales.sleep + dt * 0.35);
    this.scales.bladder = Math.min(100, this.scales.bladder + dt * 0.2);
    this.scales.hunger = Math.max(0, this.scales.hunger - dt * 0.12);
  }
}

/** Таблица «что где лежит» для превью и карты. */
export function roomSummary(roomId) {
  const lay = LAYOUT[roomId];
  const room = roomById(roomId);
  return {
    id: roomId,
    name: room.name,
    items: lay.items.length,
    clutter: lay.clutter.length,
    points: POINTS.filter((p) => p.room === roomId),
  };
}
