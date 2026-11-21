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
import { moveMode, cameraDelta } from './core/joystick.mjs';
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
    scene3d = new Scene3D(sceneCanvas);
    scene3d.resize(window.innerWidth, window.innerHeight);
    scene3d.load(world.room);
    scene3d.lightState = world.lightOn;
    scene3d.setLightState(world.lightOn);
    scene3d.setTorch(true);          // фонарь сразу включён: иначе не видно
    torchOn = true;
    scene3d.setCharacter(world.pos.x, world.pos.z, world.facing, 'idle', 'flashlight');
    scene3d.faceIntoRoom();
    mode = '3d';
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
  onButton: (act) => {
    switch (act) {
      case 'torch':
        torchOn = !torchOn;
        scene3d?.setTorch(torchOn);
        sticks.setTorch(torchOn);
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
  for (const d of DOORS) {
    if (!d.b || (d.a !== world.room && d.b !== world.room)) continue;
    const lx = d.at.x - room.rect.x;
    const lz = d.at.z - room.rect.z;
    const dist = Math.hypot(world.pos.x - lx, world.pos.z - lz);
    if (dist < reach && (!best || dist < best.dist)) {
      best = { door: d, dist, target: d.a === world.room ? d.b : d.a };
    }
  }
  return best;
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
  // сначала дверь: если стоим у двери, «действие» = войти
  if (nearDoor(0.95)) { tryDoor(); return; }

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

/** Двигает мальчика по стику внутри комнаты, обходя мебель. */
function applyMovement(dt) {
  if (!sticks) return;
  const st = moveMode(sticks.move, { forceSprint: sticks.sprint, crouching: crouch });

  // камера
  const cd = cameraDelta(sticks.look, dt);
  if (Math.abs(cd.yaw) > 1e-5 || Math.abs(cd.pitch) > 1e-5) {
    scene3d?.rotate(cd.yaw, cd.pitch);
  }

  if (st.state === 'idle') {
    world.mode = 'idle';
    world.moving = false;
    world.path = null;
    return;
  }

  // скорость: крадусь — SPEED.sneak, шаг — SPEED.normal, бег — SPEED.run.
  // Бег только по кнопке: иначе на телефоне мальчик случайно переходит на бег
  // от полного наклона стика и вся задумка «тихо» ломается.
  const mag = Math.min(1, Math.hypot(sticks.move.value.x, sticks.move.value.y));
  const speed = crouch
    ? SPEED.sneak
    : sticks.sprint
      ? SPEED.run
      : SPEED.sneak + (SPEED.normal - SPEED.sneak) * Math.min(1, mag * 1.35);
  // Стик вверх = вперёд ОТНОСИТЕЛЬНО КАМЕРЫ.
  // Оси взяты из реальной матрицы three.js (проверено тестом camera-direction):
  //   forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
  // Раньше forward был перевёрнут, и «вверх» отправлял мальчика назад.
  const yaw = scene3d?.yaw ?? 0;
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  // на экране Y инвертирован: вверх = -1 = вперёд
  const ix = sticks.move.value.x;
  const iy = sticks.move.value.y;

  let dx = fwdX * -iy + rightX * ix;
  let dz = fwdZ * -iy + rightZ * ix;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return;
  dx /= len;
  dz /= len;

  const room = world.roomData;
  const next = {
    x: world.pos.x + dx * speed * dt,
    z: world.pos.z + dz * speed * dt,
  };

  // столкновение с мебелью: пробуем полный шаг, потом по осям
  const obs = world.obstacles();
  const fits = (p) => p.x > 0.22 && p.z > 0.22 &&
    p.x < room.rect.w - 0.22 && p.z < room.rect.d - 0.22 &&
    !obs.some((o) => p.x > o.x0 - 0.15 && p.x < o.x1 + 0.15 && p.z > o.z0 - 0.15 && p.z < o.z1 + 0.15);

  if (fits(next)) {
    world.pos = next;
  } else if (fits({ x: next.x, z: world.pos.z })) {
    world.pos = { x: next.x, z: world.pos.z };
  } else if (fits({ x: world.pos.x, z: next.z })) {
    world.pos = { x: world.pos.x, z: next.z };
  }

  world.facing = Math.atan2(dx, dz);
  world.mode = crouch ? 'sneak' : sticks.sprint ? 'run' : 'walk';
  world.moving = true;
}

// ─────────────────────────── дверь ───────────────────────────

/**
 * Переход в другую комнату: если мальчик стоит у двери — идём в соседнюю.
 * Двери берём из данных дома, а не списком в коде.
 */
function tryDoor(reach = 0.95) {
  const near = nearDoor(reach);
  if (!near) {
    hud.toast('надо подойти к двери.', 1600);
    return;
  }
  const { door, target } = near;
  if (door.lock && !world.doorFlags[door.id]) {
    hud.toast(`${door.lock}: пока закрыто.`, 2000);
    return;
  }
  if (world.goToRoom(target)) {
    preview.currentRoom = target;
    reload3d();
    hud.toast(roomById(target).name + '.', 2200);
    sticks.reset();
  }
}

function reload3d() {
  if (!scene3d) return;
  scene3d.load(world.room);
  scene3d.setLightState(world.lightOn);
  scene3d.setTorch(torchOn);
  // камера разворачивается внутрь комнаты, а не в стену за спиной
  scene3d.setCharacter(world.pos.x, world.pos.z, world.facing, 'idle', torchOn ? 'flashlight' : null);
  scene3d.faceIntoRoom();
}

// ─────────────────────────── цикл ───────────────────────────

function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;

  sticks.update(dt);

  if (!paused) {
    world.update(dt);
    if (mode === '3d') {
      applyMovement(dt);
      updateUseHint();
    }
  }

  if (mode === '3d' && scene3d) {
    scene3d.setCharacter(world.pos.x, world.pos.z, world.facing, crouch ? 'sneak' : charState(), torchOn ? 'flashlight' : null);
    scene3d.render(dt);
  } else {
    preview.currentRoom = world.room;
    preview.draw(dt);
  }

  hud.update(world);
  world.drainEvents();

  requestAnimationFrame(frame);
}

/**
 * Подсветка кнопки «действие»: горит, когда рядом дверь или предмет.
 * Раньше проверялась только дальняя стена по z — в комнатах с дверью сбоку
 * (коридор, ванная, кухня) подсказка не загоралась никогда.
 */
let hintState = null;
function updateUseHint() {
  const canDoor = Boolean(nearDoor(0.95));
  const canItem = Boolean(nearestItem());
  const next = canDoor ? 'door' : canItem ? 'item' : null;
  if (next === hintState) return;   // не трогаем DOM каждый кадр
  hintState = next;
  const btn = document.querySelector('[data-act="use"]');
  if (!btn) return;
  btn.classList.toggle('near-door', next === 'door');
  btn.classList.toggle('ready', next === 'item');
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
  // мальчик в центре комнаты, а не в 70 см от стены
  const r = world.roomData.rect;
  world.pos = { x: r.w / 2, z: r.d * 0.45 };
  document.getElementById('controls').classList.add('ready');
  show3d();
  setTimeout(() => hud.toast('левый стик — идти. правый — смотреть.', 6000), 1500);
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

preview.resize();
preview.draw(0);
