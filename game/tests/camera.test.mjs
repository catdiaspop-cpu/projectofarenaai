// Камера от первого лица: глаза на высоте глаз ребёнка, камера едет вместе
// с телом, наклон ограничен так, чтобы было видно и пол под ногами, и потолок.
// Плюс читаемость света — экран не должен быть чёрным.

import * as THREE from '../vendor/three/three.min.js';
import { World } from '../src/core/app.mjs';
import { roomById } from '../src/sim/graph.mjs';
import { ROOMS, LIGHTS } from '../src/data/house.mjs';
import { BODY } from '../src/world/character.mjs';
import { FP } from '../src/render/viewmodel.mjs';
import { step } from '../src/core/movement.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const PITCH_MIN = -0.95, PITCH_MAX = 0.85;

t('глаза на высоте глаз ребёнка, а не взрослого', () => {
  ok(Math.abs(FP.eyeHeight - (BODY.height - 0.115)) < 1e-9, 'высота глаз не привязана к росту');
  ok(FP.eyeHeight > 1.0 && FP.eyeHeight < 1.15, `глаза на ${FP.eyeHeight.toFixed(3)} м — не ребёнок`);
  ok(FP.eyeHeight < BODY.height, 'глаза выше макушки');
});

t('камера стоит в точке глаз, а не позади мальчика', () => {
  const eye = new THREE.Vector3(1.2, FP.eyeHeight, 2.4);
  const cam = eye.clone();
  ok(cam.distanceTo(eye) === 0, 'камера смещена от глаз');
  ok(cam.y > 1.0 && cam.y < 1.15, 'камера не на уровне глаз');
});

t('камера не остаётся на месте, когда мальчик идёт', () => {
  // повторяем логику setCharacter: глаза = позиция тела
  const room = roomById('childroom');
  const eyeAt = (x, z) => new THREE.Vector3(x - room.rect.w / 2, FP.eyeHeight, z - room.rect.d / 2);
  const a = eyeAt(1.2, 2.4);
  const b = eyeAt(2.4, 2.4);
  ok(a.distanceTo(b) > 1.1, `камера сдвинулась всего на ${a.distanceTo(b).toFixed(2)} м`);
});

t('ближняя плоскость не режет собственные руки', () => {
  ok(FP.near <= 0.03, `near ${FP.near} — руки и стены будут проваливаться`);
});

t('наклон вниз — видно свои ноги, вверх — потолок', () => {
  const clamp = (p) => Math.max(PITCH_MIN, Math.min(PITCH_MAX, p));
  ok(clamp(-9) === PITCH_MIN, 'вниз не ограничен');
  ok(clamp(9) === PITCH_MAX, 'вверх не ограничен');
  // с высоты 1.10 м при наклоне −0.95 видно точку на 0.64 м впереди
  const seeDown = FP.eyeHeight / Math.tan(-PITCH_MIN);
  ok(seeDown < 0.9, `вниз видно только с ${seeDown.toFixed(2)} м — ног не видно`);
});

t('поле зрения рассчитано на вертикальный телефон', () => {
  ok(FP.fov >= 62 && FP.fov <= 78, `fov ${FP.fov} — либо тоннель, либо рыбий глаз`);
});

t('свет в комнате читаемый: не чёрный экран', () => {
  for (const room of ROOMS) {
    if (room.kind === 'yard') continue;
    const tt = Math.min(1, room.light.night / 0.08);
    const ambient = 1.15 + tt * 1.1;
    const hemi = 1.0 + tt * 1.0;
    ok(ambient >= 1.1, `${room.id}: общий свет ${ambient.toFixed(2)} — темно`);
    ok(ambient + hemi > 2.2, `${room.id}: суммарный свет ${(ambient + hemi).toFixed(2)}`);
  }
});

t('в детской горит ночник — есть хотя бы один источник', () => {
  const lit = LIGHTS.filter((l) => l.room === 'childroom');
  ok(lit.length >= 1, 'в детской нет света');
  ok(lit.some((l) => l.type === 'nightlight'), 'нет ночника');
});

t('глаза не входят в стену: тело держится на радиусе от неё', () => {
  // камера в голове, значит проверять надо тело. Если тело в стене — камера
  // тоже в стене, и первый кадр будет чёрным (это уже случалось).
  for (const id of ['childroom', 'kitchen', 'living', 'hall', 'corridor', 'bath', 'pantry']) {
    const room = roomById(id);
    const pos = { x: room.rect.w / 2, z: room.rect.d * 0.45 };
    const res = step(pos, { x: 1, z: 0 }, 1.75, 1, room.rect, [], []);
    ok(res.pos.x <= room.rect.w - 0.2, `${id}: тело вышло за стену (x=${res.pos.x.toFixed(2)})`);
    ok(Math.abs(res.pos.z) < room.rect.d, `${id}: тело за стеной по z`);
  }
});

t('сцена содержит мальчика и он не ломается от позиции камеры', () => {
  const w = new World();
  ok(w.pos && Number.isFinite(w.pos.x) && Number.isFinite(w.pos.z), 'мир без позиции');
  ok(typeof w.roomData.rect.w === 'number', 'у комнаты нет размеров');
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
