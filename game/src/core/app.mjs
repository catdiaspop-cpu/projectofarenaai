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

  /** Препятствия комнаты для ходьбы (в локальных координатах). */
  obstacles() {
    const out = [];
    for (const it of this.lay.items) {
      const prop = PROPS[it.prop];
      const fp = prop.footprint ?? { w: 0.3, d: 0.3 };
      if (['rug', 'runner', 'mat', 'doormat'].includes(it.prop)) continue;
      if (prop.tags?.includes('flat')) continue;
      const rot = it.rot ?? 0;
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      const w = fp.w * c + fp.d * s, d = fp.w * s + fp.d * c;
      out.push({
        id: it.id,
        x0: it.x - w / 2, x1: it.x + w / 2,
        z0: it.z - d / 2, z1: it.z + d / 2,
      });
    }
    for (const it of this.lay.clutter) {
      if (it.y > 0.1) continue; // мелочь на мебели не мешает ногам
      const fp = PROPS[it.prop].footprint ?? { w: 0.2, d: 0.2 };
      const rot = it.rot ?? 0;
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      const w = fp.w * c + fp.d * s, d = fp.w * s + fp.d * c;
      out.push({
        id: it.id,
        x0: it.x - w / 2, x1: it.x + w / 2,
        z0: it.z - d / 2, z1: it.z + d / 2,
        clutter: true,
      });
    }
    return out;
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
  goToRoomDirect(roomId, entry) {
    const from = this.room;
    if (!roomId) return false;
    this.room = roomId;
    this.pos = { x: entry.x, z: entry.z };
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
