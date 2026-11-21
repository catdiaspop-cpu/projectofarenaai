// Двери: настоящие створки, петли и порог.
//
// Раньше переход был телепортацией: позиция переставлялась, 3D-сцена
// подгружалась асинхронно, и один-два кадра мальчик рисовался в старой комнате
// с координатами новой — отсюда «застрял в стене».
//
// Теперь так:
//   1. мальчик подходит к двери и нажимает «действие»;
//   2. створка открывается за 0.55 с (видно, как она поворачивается на петле);
//   3. мальчик сам проходит в проём (movement.mjs пускает в порог);
//   4. когда он пересёк порог — комната меняется, а он появляется у ТОЙ ЖЕ
//      двери с другой стороны, на том же расстоянии от косяка.
//
// Файл чистый: ни three.js, ни DOM. Проверяется в node.

import { DOORS, HEIGHTS } from '../data/house.mjs';

const WALL_T = HEIGHTS.wallThickness;
export const DOOR = {
  openSeconds: 0.55,
  closeSeconds: 0.7,
  travel: 0.55,      // сколько метров проходит мальчик, чтобы пересечь порог
};

/**
 * С какой стороны стены дверь и в какую сторону смотрит створка.
 * Возвращает { side: 'n'|'s'|'w'|'e', hinge: 'left'|'right' } либо null
 * для люков в полу и потолке (у них нет створки).
 */
export function doorSide(door, room) {
  if (!door || !room) return null;
  // Лестницы и люки СТВОРКИ не имеют, но проём у них есть: раньше здесь
  // возвращался null ДО поиска стороны, и проём не находился вообще — переход
  // по такой двери вырождался в «вернулся туда же». Теперь сторона считается
  // для всех дверей, а круглая створка просто не рисуется.
  if (door.stairs) return null;   // см. doorOpening: у хода между этажами проём любой
  const lx = door.at.x - room.rect.x;
  const lz = door.at.z - room.rect.z;
  const near = (a, b, tol = 0.2) => Math.abs(a - b) < tol;
  if (near(lz, 0)) return { side: 'n', line: 0, at: lx };
  if (near(lz, room.rect.d)) return { side: 's', line: room.rect.d, at: lx };
  if (near(lx, 0)) return { side: 'w', line: 0, at: lz };
  if (near(lx, room.rect.w)) return { side: 'e', line: room.rect.w, at: lz };
  return null;
}

/** Проём для movement.mjs: где в комнате можно пройти сквозь стену. */
export function doorOpening(door, room) {
  // Ход между этажами (лестница, люк): створки нет, но пройти можно по всей
  // ширине комнаты — это не дверь в стене, а вертикальный переход.
  if (door?.stairs) {
    // at — точка хода в локальных координатах ТЕКУЩЕЙ комнаты
    return {
      side: 'any', from: 0, to: Math.max(room.rect.w, room.rect.d),
      at: { x: door.at.x - room.rect.x, z: door.at.z - room.rect.z },
      door: door.id, stairs: true,
    };
  }
  const d = doorSide(door, room);
  if (!d) return null;
  const w = HEIGHTS.door.w;
  return { side: d.side, from: d.at - w / 2, to: d.at + w / 2, door: door.id };
}

/** Все проёмы комнаты — для шага и для отрисовки. */
export function openingsOf(roomId, doors = DOORS) {
  return doors
    .filter((d) => d.a === roomId || d.b === roomId)
    .map((d) => {
      // комната нужна для локальных координат
      return d;
    });
}

/**
 * Куда поставить мальчика в новой комнате, когда он перешёл порог.
 * Он появляется у той же двери, но с другой стороны, и отступает внутрь
 * на столько, сколько успел пройти за порог.
 *
 * @param {object} door — дверь из house.mjs
 * @param {object} room — НОВАЯ комната
 * @param {number} offset — насколько уже прошёл за порог (0.28..0.55)
 */
export function entryPoint(door, room, offset = 0.35) {
  const att = { x: door.at.x - room.rect.x, z: door.at.z - room.rect.z };
  // лестница: встаём в центре лестничной клетки
  if (door.stairs) {
    return { x: Math.min(room.rect.w - 0.6, Math.max(0.6, att.x)), z: Math.min(room.rect.d - 0.6, Math.max(0.6, att.z)), side: null };
  }
  const d = doorSide(door, room);
  const push = Math.max(0.3, Math.min(0.6, offset));
  if (!d) {
    // Дверь не на стене этой комнаты — например, люк в ПОЛУ: он лежит в
    // плоскости комнаты, а не в стене. Ищем ближайшую стену и встаём от неё
    // внутрь, иначе точка входа оказывается за пределами комнаты.
    return clampIntoRoom(room, att, push);
  }
  switch (d.side) {
    case 'n': return { x: att.x, z: push, side: 'n' };
    case 's': return { x: att.x, z: room.rect.d - push, side: 's' };
    case 'w': return { x: push, z: att.z, side: 'w' };
    case 'e': return { x: room.rect.w - push, z: att.z, side: 'e' };
    default: return { x: att.x, z: att.z, side: null };
  }
}

/**
 * Задвинуть точку внутрь комнаты, если она оказалась за стеной.
 *
 * Нужно для люков в полу и потолке: у них нет стороны света, а центр может
 * лежать на краю комнаты.
 */
function clampIntoRoom(room, p, push = 0.35) {
  const hw = room.rect.w;
  const hd = room.rect.d;
  const distTo = {
    n: p.z,
    s: hd - p.z,
    w: p.x,
    e: hw - p.x,
  };
  const x = Math.min(hw - push, Math.max(push, p.x));
  const z = Math.min(hd - push, Math.max(push, p.z));
  // если и так внутри с запасом — оставляем как есть
  if (p.x > push && p.x < hw - push && p.z > push && p.z < hd - push) {
    return { x: p.x, z: p.z, side: null };
  }
  return { x, z, side: null };
}

/** Угол створки: 0 закрыто, ~1.4 рад (80°) открыто. */
export function leafAngle(t, open, cfg = DOOR) {
  const p = open ? Math.min(1, t / cfg.openSeconds) : Math.max(0, 1 - t / cfg.closeSeconds);
  const e = p * p * (3 - 2 * p);            // плавно, без рывка
  return e * 1.42;
}

/** Ось петли в локальных координатах комнаты: у какого косяка. */
export function hingePoint(door, room) {
  const d = doorSide(door, room);
  if (!d) return null;
  const w = HEIGHTS.door.w;
  const left = d.at - w / 2;
  if (d.side === 'n') return { x: left, z: 0, axis: 'y', rot: 0 };
  if (d.side === 's') return { x: left, z: room.rect.d, axis: 'y', rot: Math.PI };
  if (d.side === 'w') return { x: 0, z: left, axis: 'y', rot: -Math.PI / 2 };
  return { x: room.rect.w, z: left, axis: 'y', rot: Math.PI / 2 };
}

/**
 * Ось створки для отрисовки, уже в координатах сцены (центр комнаты = 0).
 * Нужна scene3d: створка висит на петле и поворачивается вокруг Y.
 */
export function leafTransform(door, room, angle) {
  if (door?.stairs) return null;
  const d = doorSide(door, room);
  if (!d) return null;
  const w = HEIGHTS.door.w;
  const h = HEIGHTS.door.h;
  const cx = room.rect.w / 2;
  const cz = room.rect.d / 2;
  const atX = door.at.x - room.rect.x - cx;
  const atZ = door.at.z - room.rect.z - cz;

  // ── одна система координат ──
  // Раньше направление створки считалось отдельной формулой, и на двух стенах
  // из четырёх оно получалось НЕ в проём: створка размером 0.85 м уезжала
  // на 2 м вбок, в соседнюю комнату. Теперь всё считается в «осях двери»:
  // u — вдоль стены, n — внутрь комнаты. Дверь всегда лежит вдоль u.
  const axes = {
    n: { ux: 1, uz: 0, nx: 0, nz: 1 },
    s: { ux: -1, uz: 0, nx: 0, nz: -1 },
    w: { ux: 0, uz: 1, nx: 1, nz: 0 },
    e: { ux: 0, uz: -1, nx: -1, nz: 0 },
  }[d.side];

  // Петля — на одном краю проёма. На северной и западной стенах это край
  // «раньше» по оси u, на южной и восточной — «позже» (иначе ручка окажется
  // в косяке).
  const sign = (d.side === 'n' || d.side === 'w') ? -1 : 1;
  const hinge = { x: atX + axes.ux * sign * w / 2, z: atZ + axes.uz * sign * w / 2 };

  // Створка идёт от петли в противоположную сторону — перекрывает проём.
  const dir = { x: -axes.ux * sign, z: -axes.uz * sign };

  // Поворот петли: локальная +X должна смотреть вдоль dir.
  // (x,z) → (x·cos a + z·sin a, −x·sin a + z·cos a)
  const baseRot = Math.atan2(-dir.z, dir.x);

  return {
    hinge,
    baseRot,
    // створка: панель шириной w, толщиной 4 см, высотой h
    panel: { w, h, t: 0.042 },
    dir,
    normal: { x: axes.nx, z: axes.nz },   // внутрь комнаты
    angle,
    // косяки
    jambs: [
      { x: atX - axes.ux * (w / 2 + 0.045), z: atZ - axes.uz * (w / 2 + 0.045), w: 0.09, h, t: WALL_T + 0.06 },
      { x: atX + axes.ux * (w / 2 + 0.045), z: atZ + axes.uz * (w / 2 + 0.045), w: 0.09, h, t: WALL_T + 0.06 },
    ],
    lintel: { x: atX, z: atZ, y: h + 0.045, w: w + 0.18, h: 0.09, t: WALL_T + 0.06 },
    handle: { x: hinge.x + dir.x * (w - 0.09), z: hinge.z + dir.z * (w - 0.09), y: 1.02 },
    side: d.side,
  };
}

/**
 * Дальняя от петли точка створки в координатах комнаты.
 *
 * Створка висит на петле и лежит вдоль локальной оси; при повороте на угол
 * `angle` (вокруг Y) её дальний край уезжает. Считаем той же матрицей, что
 * three.js: (x,z) → (x·cos + z·sin, −x·sin + z·cos).
 */
export function leafFarPoint(tr, angle) {
  // Вектор «петля → дальний край» в закрытом положении — это dir на ширину.
  // Открытие — поворот этого вектора вокруг петли на angle.
  const vx = tr.dir.x * tr.panel.w;
  const vz = tr.dir.z * tr.panel.w;
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  return {
    x: tr.hinge.x + vx * c + vz * sn,
    z: tr.hinge.z - vx * sn + vz * c,
  };
}

/**
 * В какую сторону поворачивается створка: +1 или −1.
 *
 * Зачем: половина дверей по нечётной геометрии уезжала НАРУЖУ — сквозь стену,
 * в невидимую пустоту. Дверь, открывающаяся в стену, читается как поломка.
 * Здесь оба варианта считаются, и выбирается тот, у которого дальний край
 * глубже внутри комнаты.
 */
export function swingSign(tr, room, angle = 1.42) {
  const hw = room.rect.w / 2;
  const hd = room.rect.d / 2;
  const margin = (p) => Math.min(hw - Math.abs(p.x), hd - Math.abs(p.z));
  const plus = margin(leafFarPoint(tr, angle));
  const minus = margin(leafFarPoint(tr, -angle));
  // оба за стеной — это ошибка данных; оставляем «внутрь» по знаку, всё равно
  // лучше, чем створка в пустоте
  return minus >= plus ? -1 : 1;
}

/** Сколько пройти до порога — для анимации подхода. */
export function distanceToDoor(pos, door, room) {
  const att = { x: door.at.x - room.rect.x, z: door.at.z - room.rect.z };
  return Math.hypot(pos.x - att.x, pos.z - att.z);
}
