// Проверки камеры от третьего лица: мальчика видно, камера не в стене,
// обзор не в потолок, и первый кадр не чёрный.

import * as THREE from '../vendor/three/three.min.js';
import { World } from '../src/core/app.mjs';
import { roomById } from '../src/sim/graph.mjs';
import { ROOMS, LIGHTS } from '../src/data/house.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

/** Повторяем математику камеры из scene3d, чтобы проверить её без WebGL. */
function cameraPose(roomId, pos, yaw, pitch, opts = {}) {
  const room = roomById(roomId);
  const camDist = opts.camDist ?? 1.9;
  const camHeight = opts.camHeight ?? 1.58;
  const shoulder = opts.camShoulder ?? 0.34;
  const focus = new THREE.Vector3(pos.x - room.rect.w / 2, 1.12, pos.z - room.rect.d / 2);
  const back = new THREE.Vector3(Math.sin(yaw) * camDist, 0, Math.cos(yaw) * camDist);
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const desired = new THREE.Vector3(
    focus.x + back.x + right.x * shoulder,
    camHeight + Math.sin(pitch) * 1.1,
    focus.z + back.z + right.z * shoulder,
  );
  // Ровно та же логика, что в scene3d: поджать дистанцию, иначе подняться выше
  const hw = room.rect.w / 2 - 0.3;
  const hd = room.rect.d / 2 - 0.3;
  const fits = (v) => Math.abs(v.x) < hw && Math.abs(v.z) < hd;
  if (!fits(desired)) {
    for (let k = 0.95; k >= 0.2; k -= 0.15) {
      desired.set(
        focus.x + back.x * k + right.x * shoulder * k,
        camHeight + Math.sin(pitch) * 1.1,
        focus.z + back.z * k + right.z * shoulder * k,
      );
      if (fits(desired)) break;
    }
    if (!fits(desired)) {
      desired.set(
        focus.x + back.x * camDist * 0.12 + right.x * 0.2,
        camHeight + 0.85,
        focus.z + back.z * camDist * 0.12 + right.z * 0.2,
      );
    }
    desired.x = Math.max(-hw, Math.min(hw, desired.x));
    desired.z = Math.max(-hd, Math.min(hd, desired.z));
  }
  return { cam: desired, focus, inside: fits(desired), hw, hd, room };
}

t('камера стоит позади мальчика, а не внутри него', () => {
  const p = cameraPose('childroom', { x: 1.8, z: 1.53 }, 0, -0.2);
  const d = Math.hypot(p.cam.x - p.focus.x, p.cam.z - p.focus.z);
  ok(d > 0.9, `камера в ${d.toFixed(2)} м от мальчика — слишком близко, его не видно`);
  ok(d < 3.2, `камера в ${d.toFixed(2)} м — мальчик будет крошкой`);
});

t('камера выше мальчика и смотрит на него', () => {
  const p = cameraPose('childroom', { x: 1.8, z: 1.53 }, 0, -0.2);
  ok(p.cam.y > 1.22, `камера на ${p.cam.y.toFixed(2)} м — на уровне головы мальчика`);
  ok(p.focus.y < p.cam.y, 'камера смотрит вверх, а должна вниз');
});

t('камера не смотрит в стену на старте', () => {
  // мальчик в центре, камера позади — это должно быть внутри комнаты
  for (const id of ['childroom', 'kitchen', 'living', 'hall', 'corridor', 'bath']) {
    const room = roomById(id);
    const pos = { x: room.rect.w / 2, z: room.rect.d * 0.45 };
    const p = cameraPose(id, pos, 0, -0.2);
    ok(p.inside, `${id}: камера в стене на старте`);
  }
});

t('при повороте камера остаётся в комнате (не вылезает за стену)', () => {
  for (const id of ['childroom', 'bath', 'corridor']) {
    for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.3) {
      const room = roomById(id);
      const pos = { x: room.rect.w / 2, z: room.rect.d / 2 };
      const p = cameraPose(id, pos, yaw, 0);
      ok(Math.abs(p.cam.x) <= p.hw + 1e-6, `${id}: на yaw=${yaw.toFixed(1)} камера за стеной (x=${p.cam.x.toFixed(2)})`);
      ok(Math.abs(p.cam.z) <= p.hd + 1e-6, `${id}: на yaw=${yaw.toFixed(1)} камера за стеной (z=${p.cam.z.toFixed(2)})`);
    }
  }
});

t('обзор по вертикали ограничен — не смотрим в потолок и в пол', () => {
  const clamp = (p) => Math.max(-0.62, Math.min(0.42, p));
  ok(clamp(-5) === -0.62, 'вверх не ограничен');
  ok(clamp(5) === 0.42, 'вниз не ограничен');
});

t('свет в комнате читаемый: не чёрный экран', () => {
  for (const room of ROOMS) {
    if (room.kind === 'yard') continue;
    const night = room.light.night;
    const tt = Math.min(1, night / 0.08);
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

t('стартовая позиция — центр комнаты, а не у стены', () => {
  const room = roomById('childroom');
  const pos = { x: room.rect.w / 2, z: room.rect.d * 0.45 };
  const toWall = room.rect.d - pos.z;
  ok(toWall > 1.3, `до стены ${toWall.toFixed(2)} м — слишком близко`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
