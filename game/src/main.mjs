// Точка входа.
//
// Управление: два стика и кнопки. Никаких «тап по полу» — на телефоне это
// не работает, палец закрывает экран и попасть в точку нельзя.
//
// Левая половина экрана — идти, правая — смотреть. Кнопки справа сверху.

import { World, PHASE } from './core/app.mjs';
import { Hud } from './ui/hud.mjs';
import { Sticks } from './ui/sticks.mjs';
import { HousePreview } from './render/house-preview.mjs';
import { roomById, SPEED } from './sim/graph.mjs';
import { DOORS } from './data/house.mjs';
import { canOpen, doorsOf, otherSide } from './sim/locks.mjs';
import { moveMode } from './core/joystick.mjs';
import { dirFromStick, step, crossedThreshold } from './core/movement.mjs';
import { doorOpening, entryPoint } from './sim/doors.mjs';
import { PROPS } from './world/props.mjs';

const app = document.getElementById('app');
const sceneCanvas = document.getElementById('scene');
const mapCanvas = document.getElementById('map');
const hudRoot = document.getElementById('hud');
const boot = document.getElementById('boot');
const startBtn = document.getElementById('start');

const world = new World();
let scene3d = null;
let preview = null;
let hud = null;
let sticks = null;
let mode = 'map';
let running = false;
let lastT = 0;
let torchOn = false;
let crouch = false;
let paused = false;
let sceneLoading = false;
let sceneLost = false;       // WebGL-контекст отобран телефоном
let pendingDoor = null;      // { door, target, opening, opened } — дверь открыта, ждём шага

// ─────────────────────────── сцены ───────────────────────────

preview = new HousePreview(mapCanvas);
preview.currentRoom = world.room;

function showMap() {
  mode = 'map';
  app.dataset.mode = 'map';
  preview.resize();
  sticks?.reset();
}

function show3d() {
  if (scene3d) {
    mode = '3d';
    app.dataset.mode = '3d';
    return;
  }
  if (sceneLoading) return;
  sceneLoading = true;
  hud?.toast('дом просыпается…');
  // ленивая загрузка three.js
  import('./render/scene3d.mjs').then(({ Scene3D }) => {
    scene3d = new Scene3D(sceneCanvas, {
      // телефон отобрал WebGL (переключились в другое приложение) — картинки
      // больше не будет, но управление и мир остаются. Скажем об этом прямо,
      // вместо чёрного экрана, на котором «ничего не двигается».
      onContextLost: () => {
        sceneLost = true;
        hud?.toast('телефон отобрал 3D. сверни и вернись — заработает.', 5000);
      },
    });
    scene3d.resize(window.innerWidth, window.innerHeight);
    scene3d.load(world.room);
    scene3d.lightState = world.lightOn;
    scene3d.setLightState(world.lightOn);
    scene3d.setTorch(true);          // фонарь сразу включён: иначе не видно
    torchOn = true;
    scene3d.setCharacter(world.pos.x, world.pos.z, world.facing, 'idle', 'flashlight');
    scene3d.faceIntoRoom();
    mode = '3d';
    currentOpenings();      // одиночные двери открыты сразу
    app.dataset.mode = '3d';
    sticks?.setTorch(true);
    hud?.toast('фонарь в руке. иди.', 2600);
  }).catch((err) => {
    console.error('3D не запустилось', err);
    mode = 'map';
    app.dataset.mode = 'map';
    hud?.toast('тут телефон не тянет 3D. играем на карте.');
  }).finally(() => { sceneLoading = false; });
}

// ─────────────────────────── HUD ───────────────────────────

hud = new Hud(hudRoot, {
  onAction: (act, arg) => {
    if (act === 'menu') {
      paused = !paused;
      world.paused = paused;
      hud.toast(paused ? 'пауза' : 'идём дальше');
    }
  },
});

// ─────────────────────────── стики ───────────────────────────

sticks = new Sticks(document.getElementById('controls'), {
  // короткое касание справа без сдвига — «слушать»: второе действие под палец
  onTap: () => {
    world.listening = !world.listening;
    sticks.toggleClass('listen', 'on');
    hud.toast(world.listening ? 'слушаешь…' : 'перестал слушать', 1500);
  },
  onButton: (act) => {
    switch (act) {
      case 'torch':
        torchOn = !torchOn;
        scene3d?.setTorch(torchOn);
        sticks.setTorch(torchOn);
        sticks.setAction(null);
        hud.toast(torchOn ? 'фонарь. тебя видно.' : 'темно. зато не видно.', 1800);
        break;
      case 'crouch':
        crouch = !crouch;
        sticks.setCrouch(crouch);
        hud.toast(crouch ? 'присел. тише.' : 'встал.', 1400);
        break;
      case 'listen':
        world.listening = !world.listening;
        sticks.toggleClass('listen', 'on');
        hud.toast(world.listening ? 'слушаешь…' : 'перестал слушать', 1500);
        break;
      case 'use':
        useNearby();
        break;
      case 'map':
        mode === 'map' ? show3d() : showMap();
        break;
      default:
        break;
    }
  },
});

// ─────────────────────────── действие ───────────────────────────

/** Ближайшая дверь этой комнаты в пределах reach. */
function nearDoor(reach = 0.95) {
  const room = world.roomData;
  let best = null;
  for (const d of doorsOf(world.room)) {
    const lx = d.at.x - room.rect.x;
    const lz = d.at.z - room.rect.z;
    const dist = Math.hypot(world.pos.x - lx, world.pos.z - lz);
    if (dist < reach && (!best || dist < best.dist)) {
      best = { door: d, dist, target: otherSide(d, world.room) };
    }
  }
  return best;
}

/**
 * Проёмы текущей комнаты: в них можно войти и сквозь них пройти.
 *
 * Здесь же решается, какие створки открыты. Правило простое: дверь открыта,
 * если игрок сам её открыл или если она единственная в комнате (иначе в
 * коридоре шириной 1.5 м упираешься в стену и «действие» — единственный
 * способ выйти — теряется под пальцем).
 */
function currentOpenings() {
  const room = world.roomData;
  const mine = DOORS.filter((d) => d.a === world.room || d.b === world.room);
  const out = [];
  for (const d of mine) {
    const op = doorOpening(d, room);
    if (!op) continue;
    // одна дверь в комнате — держим открытой
    if (mine.length === 1 && !d.stairs) scene3d?.openDoor(d.id);
    out.push(op);
  }
  return out;
}

/** Контекст для замков: что у мальчика есть прямо сейчас. */
function lockCtx() {
  return {
    torch: torchOn,
    lightOn: world.lightOn,
    visited: world.entered,
    crouch,
  };
}

/** Ближайший предмет в комнате: до 1.2 м. */
function nearestItem() {
  const lay = world.lay;
  let best = null;
  let bestD = 1.3;
  for (const it of [...lay.items, ...lay.clutter]) {
    const d = Math.hypot(it.x - world.pos.x, it.z - world.pos.z);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}

function useNearby() {
  // сначала дверь: если стоим у двери, «действие» = открыть и войти
  if (nearDoor(1.25)) { tryDoor(); return; }

  const it = nearestItem();
  if (!it) {
    hud.toast('рядом ничего. подойди ближе.', 1600);
    return;
  }
  const prop = PROPS[it.prop];
  hud.toast(`${prop.name ?? it.prop}.`, 1800);
  world.emit('use', { item: it.id, prop: it.prop });
}

// ─────────────────────────── движение ───────────────────────────

/**
 * Двигает мальчика по стику. Камера — свайпом, поэтому здесь только шаг.
 * Возвращает пройденное расстояние: по нему считается фаза походки,
 * и ноги не могут разойтись с движением.
 */
function applyMovement(dt) {
  if (!sticks) return 0;

  // ── камера: свайп, накопленный за кадр
  const look = sticks.takeLook();
  if (look.yaw || look.pitch) scene3d?.rotate(look.yaw, look.pitch);

  // бег — полный наклон стика (кнопки «бежать» больше нет: она путала)
  const sprinting = sticks.move.sprinting;
  const st = moveMode(sticks.move, { forceSprint: sprinting, crouching: crouch });
  if (st.state === 'idle') {
    world.mode = 'idle';
    world.moving = false;
    return 0;
  }

  const mag = Math.min(1, Math.hypot(sticks.move.value.x, sticks.move.value.y));
  const speed = crouch
    ? SPEED.sneak
    : sprinting
      ? SPEED.run
      : SPEED.sneak + (SPEED.normal - SPEED.sneak) * Math.min(1, mag * 1.35);

  const dir = dirFromStick(sticks.move.value.x, sticks.move.value.y, scene3d?.yaw ?? 0);
  if (!dir.x && !dir.z) return 0;

  const room = world.roomData;
  // Проёмы дверей — не стены: в них можно войти и сквозь них выйти.
  const openings = currentOpenings();
  const res = step(world.pos, dir, speed, dt, room.rect, world.obstacles(), openings);
  // Считаем сдвиг ДО того, как перезапишем позицию: иначе «куда он сдвинулся»
  // всегда ноль, и мальчик не поворачивается при ходьбе вообще.
  const dx = res.pos.x - world.pos.x;
  const dz = res.pos.z - world.pos.z;
  const travelled = Math.hypot(dx, dz);
  world.pos = res.pos;
  world.bumped = res.blocked;

  // Мальчик смотрит туда, куда реально сдвинулся: если упёрлись в стену и
  // скользим вдоль неё — он смотрит вдоль стены, а не в стену.
  if (travelled > 1e-5) world.facing = Math.atan2(dx, dz);
  world.mode = crouch ? 'sneak' : sprinting ? 'run' : 'walk';
  world.moving = travelled > 0.0001;

  // ── пересёк порог? тогда и только тогда меняем комнату ──
  // Работает и для двери, открытой кнопкой, и для комнаты с единственной
  // дверью (там створка открыта всегда): новый этаж не появляется, пока
  // мальчик физически не вышел за линию стены.
  if (pendingDoor) {
    if (crossedThreshold(world.pos, room.rect, [pendingDoor.opening])) finishDoor();
  } else {
    const crossed = crossingDoor(world.pos, room);
    if (crossed) {
      pendingDoor = crossed;
      finishDoor();
    }
  }
  return travelled;
}

/**
 * Какую дверь мальчик пересёк, не открывая её кнопкой.
 *
 * Нужно для комнат с одной дверью: там створка открыта всегда (иначе в
 * коридоре 1.5 м шириной некуда деть «действие»). Считаем по настоящей
 * полосе порога из movement.mjs — той же, что и столкновения, а не по
 * второй, «похожей» формуле: две похожие формулы и есть источник ошибок.
 */
function crossingDoor(pos, room) {
  for (const d of doorsOf(world.room)) {
    const op = doorOpening(d, room);
    if (!op || op.stairs) continue;
    if (!crossedThreshold(pos, room.rect, [op])) continue;
    const target = otherSide(d, room);
    if (!target) continue;
    return { door: d, target, opening: op, openedAt: 0 };
  }
  return null;
}

// ─────────────────────────── дверь ───────────────────────────

/**
 * Дверь открывается, а не телепортирует.
 *
 * Порядок: нажали «действие» у двери → створка поворачивается на петле за
 * 0.55 с → мальчик сам проходит в проём → когда он пересёк порог, комната
 * меняется, и он появляется у ТОЙ ЖЕ двери с другой стороны.
 *
 * Раньше позиция переставлялась мгновенно, а 3D грузилось асинхронно:
 * один-два кадра мальчик рисовался в старой комнате с координатами новой —
 * отсюда «застрял в стене».
 */
function tryDoor(reach = 1.25) {
  if (pendingDoor) return;
  const near = nearDoor(reach);
  if (!near) {
    hud.toast('надо подойти к двери.', 1600);
    return;
  }
  const { door, target } = near;
  const lock = canOpen(door, lockCtx());
  if (!lock.open) {
    hud.toast(lock.reason + '.', 2400);
    return;
  }
  const opening = doorOpening(door, world.roomData);
  if (!opening) {
    // люк в полу или потолке: там створки нет, но и телепорта быть не должно
    hud.toast('тут люк. пока не открывается.', 2000);
    return;
  }
  pendingDoor = { door, target, opening, openedAt: 0 };
  scene3d?.openDoor(door.id, world.roomData);
  hud.toast(lock.reason || 'дверь открыта. иди.', 1800);
  // разворачиваем камеру на дверь — иначе игрок не поймёт, куда идти
  faceDoor(opening);
}

/** Поставить камеру лицом к проёму. */
function faceDoor(opening) {
  if (!scene3d) return;
  const room = world.roomData;
  const mid = (opening.from + opening.to) / 2;
  const target = {
    n: { x: mid, z: -1 },
    s: { x: mid, z: room.rect.d + 1 },
    w: { x: -1, z: mid },
    e: { x: room.rect.w + 1, z: mid },
  }[opening.side];
  if (!target) return;
  // forward камеры = (-sin yaw, -cos yaw) → yaw из вектора на дверь
  const dx = target.x - world.pos.x;
  const dz = target.z - world.pos.z;
  scene3d.yaw = Math.atan2(-dx, -dz);
}

/** Проход завершён: меняем комнату только когда мальчик реально за порогом. */
function finishDoor() {
  const { door, target, opening } = pendingDoor;
  pendingDoor = null;
  scene3d?.closeDoor(door.id);

  // точка входа в новой комнате — у ТОЙ ЖЕ двери, с другой стороны,
  // на 36 см внутрь (столько же, сколько он успел пройти за порог)
  const room = roomById(target);
  const entry = entryPoint(door, room, 0.36);

  if (!world.goToRoomDirect(target, entry)) {
    // если что-то пошло не так — остаёмся на месте, но не в стене
    world.pos = entry;
    hud.toast('дверь не поддалась.', 1600);
    return;
  }
  preview.currentRoom = target;
  reload3d();
  hud.toast(room.name + '.', 2000);
  sticks.reset();
}

function reload3d() {
  if (!scene3d) return;
  scene3d.load(world.room);
  scene3d.setLightState(world.lightOn);
  scene3d.setTorch(torchOn);
  // камера разворачивается внутрь комнаты, а не в стену за спиной
  scene3d.setCharacter(world.pos.x, world.pos.z, world.facing, 'idle', torchOn ? 'flashlight' : null);
  scene3d.faceIntoRoom();
  // дверь, через которую только что вошли, остаётся открытой, пока стоим рядом
  currentOpenings();
}

// ─────────────────────────── цикл ───────────────────────────

function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;

  // ── кадр не должен умирать от одного исключения ──
  // Раньше любая ошибка внутри кадра (WebGL, HUD, дверь) выбрасывала нас из
  // requestAnimationFrame НАВСЕГДА: картинка застывала, и никакой ввод уже не
  // помогал — «камера не двигается и человек не идёт». Теперь ошибка
  // показывает себя в подсказке, а цикл продолжается. Игрок всегда может
  // управлять, даже если что-то в сцене сломалось.
  try {
    sticks.update(dt);

    let travelled = 0;

    if (!paused) {
      world.update(dt);
      if (mode === '3d') {
        travelled = applyMovement(dt);
        updateUseHint();
      }
    }

    if (mode === '3d' && scene3d && !sceneLost) {
      const stateNow = crouch ? 'sneak' : charState();
      // Пройденные метры — единственный источник фазы походки: ноги физически
      // не могут двигаться быстрее или медленнее самого движения.
      scene3d.setCharacter(world.pos.x, world.pos.z, world.facing, stateNow, torchOn ? 'flashlight' : null, {
        distance: travelled,
        mode: stateNow === 'run' ? 'run' : stateNow === 'sneak' ? 'sneak' : 'walk',
        speed: travelled > 0 ? travelled / Math.max(dt, 1e-3) : 0,
      });
      scene3d.scared = Math.min(1, world.scales.fear / 100);
      scene3d.render(dt);
    } else {
      // карта: и когда мы в режиме карты, и когда 3D недоступно (нет WebGL
      // или телефон отобрал контекст). Раньше во втором случае оставался
      // застывший чёрный кадр, на котором «ничего не происходит».
      if (sceneLost && app.dataset.mode !== 'map') {
        app.dataset.mode = 'map';
        preview.resize();
      }
      preview.currentRoom = world.room;
      preview.draw(dt);
    }

    hud.update(world);
    world.drainEvents();
  } catch (err) {
    reportCrash(err);
  }

  requestAnimationFrame(frame);
}

/**
 * Ошибка в кадре: показать один раз и продолжать.
 *
 * Повторять тост каждый кадр нельзя — он превратится в мигание. Показываем
 * первую ошибку и первую ошибку ПОСЛЕ последней удачной минуты, чтобы не
 * потерять новую поломку, но и не залить экран текстом.
 */
let crashShown = 0;
let crashCount = 0;
function reportCrash(err) {
  crashCount++;
  const now = performance.now();
  if (crashCount === 1 || now - crashShown > 60000) {
    crashShown = now;
    console.error('кадр упал', err);
    hud?.toast('что-то сломалось, но игра идёт. ' + (err?.message ?? ''), 4000);
  }
}

/**
 * Подсветка кнопки «действие»: горит, когда рядом дверь или предмет.
 * Раньше проверялась только дальняя стена по z — в комнатах с дверью сбоку
 * (коридор, ванная, кухня) подсказка не загоралась никогда.
 */
let hintState = null;
function updateUseHint() {
  const canDoor = Boolean(nearDoor(1.25));
  const canItem = Boolean(nearestItem());
  const next = canDoor ? 'door' : canItem ? 'item' : null;
  sticks?.setAction(next);
  if (next === hintState) return;   // не трогаем DOM каждый кадр
  hintState = next;
}

function charState() {
  if (world.moving && world.mode !== 'idle') return world.mode;
  if (world.listening) return 'listen';
  if (crouch) return 'sneak';
  return 'idle';
}

// ─────────────────────────── запуск ───────────────────────────

startBtn.addEventListener('click', () => {
  boot.classList.add('hidden');
  running = true;
  lastT = performance.now();
  // Мальчик в центре комнаты, а не в 70 см от стены — и обязательно в точке,
  // где он помещается. В спальне родителей центр приходился ровно на кровать
  // (13% свободного пола), и первый шаг отменялся: «джойстик не работает».
  const r = world.roomData.rect;
  world.pos = world.safeSpot(r.w / 2, r.d * 0.55);
  document.getElementById('controls').classList.add('ready');
  show3d();
  setTimeout(() => hud.toast('слева стик — идти. по экрану веди пальцем — смотреть.', 6000), 1500);
  requestAnimationFrame(frame);
});

window.addEventListener('resize', () => {
  preview.resize();
  scene3d?.resize(window.innerWidth, window.innerHeight);
});

// клавиатура для проверки на компьютере
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === 'f') { torchOn = !torchOn; scene3d?.setTorch(torchOn); sticks.setTorch(torchOn); }
  if (e.key === 'c') { crouch = !crouch; sticks.setCrouch(crouch); }
  if (e.key === 'm') { mode === 'map' ? show3d() : showMap(); }
  if (e.key === 'e') useNearby();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// WASD-эмуляция стика для отладки на компьютере
setInterval(() => {
  if (!running || mode !== '3d') return;
  const has = (...k) => k.some((x) => keys.has(x));
  if (!has('w', 'a', 's', 'd') && !sticks.move.active) {
    sticks.move.raw = { x: 0, y: 0 };
    sticks.move.magnitude = 0;
  }
  if (has('w', 'a', 's', 'd') && !sticks.move.active) {
    const x = (has('d') ? 1 : 0) - (has('a') ? 1 : 0);
    const y = (has('s') ? 1 : 0) - (has('w') ? 1 : 0);
    const l = Math.hypot(x, y) || 1;
    sticks.move.raw = { x: x / l, y: y / l };
    sticks.move.value = { x: x / l, y: y / l };
    sticks.move.magnitude = 1;
  }
}, 40);

document.addEventListener('visibilitychange', () => {
  lastT = performance.now();
});

// ─────────────────────────── офлайн ───────────────────────────
// Регистрация service worker. Файл sw.js существовал с самого начала, но его
// никто не регистрировал — то есть офлайна не было вообще, а обновления на
// телефоне приходили только «когда-нибудь». network-first в sw.js теперь
// работает: код с сервера важнее кэша, кэш — только когда сети нет.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('офлайн-кэш не включился', err);
    });
  });
}

preview.resize();
preview.draw(0);
