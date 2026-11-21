// Точка входа.
//
// Порядок запуска выбран так, чтобы на слабом телефоне игрок увидел картинку
// раньше, чем загрузится 3D: сначала разрез дома (2D, 2 мс), потом 3D.

import { World, PHASE } from './core/app.mjs';
import { GestureParser, GESTURE } from './core/input.mjs';
import { Hud } from './ui/hud.mjs';
import { HousePreview } from './render/house-preview.mjs';
import { roomById } from './sim/graph.mjs';
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
let mode = 'map';
let running = false;
let lastT = 0;
let lookTarget = 0;
let torchOn = false;
let crouch = false;
let paused = false;

// ─────────────────────────── карта (2D) ───────────────────────────

preview = new HousePreview(mapCanvas);
preview.currentRoom = world.room;

function showMap() {
  mode = 'map';
  app.dataset.mode = 'map';
  preview.resize();
}

function show3d() {
  if (!scene3d) {
    // ленивая загрузка three.js: до первого показа 3D код не тратится
    import('./render/scene3d.mjs').then(({ Scene3D }) => {
      scene3d = new Scene3D(sceneCanvas);
      scene3d.resize(window.innerWidth, window.innerHeight);
      scene3d.load(world.room);
      scene3d.lightState = world.lightOn;
      scene3d.setLightState(world.lightOn);
      mode = '3d';
      app.dataset.mode = '3d';
    }).catch((err) => {
      console.error('3D не запустилось, остаёмся на карте', err);
      mode = 'map';
      app.dataset.mode = 'map';
      hud?.toast('тут телефон не тянет 3D. играем сверху.');
    });
    return;
  }
  mode = '3d';
  app.dataset.mode = '3d';
}

// ─────────────────────────── HUD ───────────────────────────

hud = new Hud(hudRoot, {
  onAction: (act, arg) => {
    switch (act) {
      case 'torch':
        torchOn = arg;
        scene3d?.setTorch(torchOn);
        hud.toast(torchOn ? 'фонарь включён. тебя видно.' : 'фонарь выключен. теперь темно.');
        break;
      case 'go':
        // главная кнопка: к двери, если близко, иначе в центр комнаты
        world.walkTo(world.roomData.rect.w / 2, world.roomData.rect.d / 2, 'sneak');
        break;
      case 'look':
        lookTarget = (lookTarget + 0.8) % (Math.PI * 1.1) - Math.PI * 0.55;
        break;
      case 'hide':
        crouch = !crouch;
        break;
      case 'listenStart':
        world.listening = true;
        hud.setHint('слушаешь…');
        break;
      case 'listenEnd':
        world.listening = false;
        break;
      case 'item':
        handleItem(arg);
        break;
      case 'menu':
        paused = !paused;
        world.paused = paused;
        hud.toast(paused ? 'пауза' : 'идём дальше');
        break;
      default:
        break;
    }
  },
});

async function handleItem(id) {
  const it = [...world.lay.items, ...world.lay.clutter].find((x) => x.id === id);
  if (!it) return;
  const prop = PROPS[it.prop];
  // первый шаг — подойти к предмету
  const path = world.walkTo(it.x, Math.min(it.z + 0.55, world.roomData.rect.d - 0.3), 'sneak');
  if (!path) {
    hud.toast('не пройти: мебель.');
    return;
  }
  hud.toast(`${prop.name}. подходишь.`);
}

// ─────────────────────────── жесты по сцене ───────────────────────────

const parser = new GestureParser({
  on: (e) => {
    if (!running) return;
    if (mode === 'map') {
      if (e.type === GESTURE.TAP) {
        const room = preview.hitTest(e.x, e.y);
        if (room) {
          if (room === world.room) { show3d(); return; }
          if (world.goToRoom(room)) {
            preview.currentRoom = room;
            hud.toast(`${roomById(room).name}.`);
            show3d();
          } else {
            hud.toast('туда не пройти: закрыто.');
          }
        }
      }
      return;
    }

    // 3D-режим
    switch (e.type) {
      case GESTURE.SWIPE:
        scene3d?.rotate(e.dir * -0.42);
        break;
      case GESTURE.TAP:
        tapScene(e);
        break;
      case GESTURE.DOUBLE:
        crouch = !crouch;
        break;
      default:
        break;
    }
  },
});

/** Тап по сцене — идти в ту точку пола. */
function tapScene(e) {
  const w = window.innerWidth, h = window.innerHeight;
  const nx = (e.x / w) * 2 - 1;
  const ny = (e.y / h) * 2 - 1;
  if (ny < -0.4) return; // верх экрана — не ходьба
  // проекция: тап дальше по экрану = дальше от камеры
  const room = world.roomData;
  const depth = Math.max(0.9, Math.min(room.rect.d - 0.4, 1.4 + (ny + 0.2) * 4.2));
  const lateral = nx * Math.min(1.5, room.rect.w / 3);
  const x = Math.max(0.3, Math.min(room.rect.w - 0.3, room.rect.w / 2 + lateral));
  const z = Math.max(0.3, Math.min(room.rect.d - 0.3, depth));
  world.walkTo(x, z, crouch ? 'sneak' : 'walk');
}

const target = sceneCanvas;
target.addEventListener('pointerdown', (e) => parser.down({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, target: 'scene' }));
target.addEventListener('pointermove', (e) => parser.move({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }));
target.addEventListener('pointerup', (e) => parser.up({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }));
target.addEventListener('pointercancel', (e) => parser.cancel());

mapCanvas.addEventListener('pointerdown', (e) => parser.down({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, target: 'map' }));
mapCanvas.addEventListener('pointerup', (e) => parser.up({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }));
mapCanvas.addEventListener('pointercancel', (e) => parser.cancel());

// ─────────────────────────── цикл ───────────────────────────

function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;

  parser.tick(now);
  world.update(dt);

  if (mode === '3d' && scene3d) {
    if (lookTarget !== 0) {
      const step = Math.sign(lookTarget) * Math.min(Math.abs(lookTarget), dt * 2.2);
      scene3d.rotate(step);
      lookTarget -= step;
    }
    scene3d.setCharacter(world.pos.x, world.pos.z, world.facing, crouch ? 'sneak' : charState(), torchOn ? 'flashlight' : null);
    scene3d.render(dt);
  } else {
    preview.currentRoom = world.room;
    preview.draw(dt);
  }

  hud.update(world);

  for (const ev of world.drainEvents()) {
    if (ev.type === 'phase') hud.toast({ day: 'утро. светло.', dusk: 'вечереет.', night: 'ночь.', morning: 'рассвет.' }[ev.phase]);
    if (ev.type === 'room') hud.toast(roomById(ev.room).name + '.');
  }

  requestAnimationFrame(frame);
}

function charState() {
  if (world.path) return world.mode;
  if (world.listening) return 'listen';
  return 'idle';
}

// ─────────────────────────── запуск ───────────────────────────

// ─────────────────────────── офлайн ───────────────────────────
// Регистрируем только на опубликованном сайте: при локальной разработке
// кэш service worker'а мешает видеть правки.
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.match(/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {
      /* офлайн необязателен */
    });
  });
}

startBtn.addEventListener('click', () => {
  boot.classList.add('hidden');
  running = true;
  lastT = performance.now();
  // первый заход — сразу комната, а не карта: игрок должен увидеть детскую
  show3d();
  // и через секунду подсказка, что карта есть
  setTimeout(() => hud.toast('тап — идти. свайп — осмотреться. держи «слушать».', 5200), 1400);
  requestAnimationFrame(frame);
});

window.addEventListener('resize', () => {
  preview.resize();
  scene3d?.resize(window.innerWidth, window.innerHeight);
});

// Меню на клавиатуре — для отладки на компьютере
window.addEventListener('keydown', (e) => {
  if (e.key === 'm') { mode === 'map' ? show3d() : showMap(); }
  if (e.key === 'f') { torchOn = !torchOn; scene3d?.setTorch(torchOn); }
  if (e.key === 'Escape') { showMap(); }
});

// пауза, когда вкладка не видна: не жжём батарею
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { paused = true; lastT = performance.now(); }
  else { paused = false; lastT = performance.now(); }
});

// стартовый кадр карты, пока идёт заставка
preview.resize();
preview.draw(0);
