// Направление движения обязано совпадать с тем, куда смотрит камера.
// Оси берём из настоящей матрицы three.js, а не «на глаз».

import * as THREE from '../vendor/three/three.min.js';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

/** Те же формулы, что в scene3d + main.mjs. */
function basis(yaw) {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 50);
  const focus = new THREE.Vector3(0, 1.12, 0);
  cam.position.set(Math.sin(yaw) * 1.9, 1.58, Math.cos(yaw) * 1.9);
  cam.lookAt(focus);
  cam.updateMatrixWorld(true);
  const e = cam.matrixWorld.elements;
  return {
    forward: new THREE.Vector3(-e[8], 0, -e[10]).normalize(),
    right: new THREE.Vector3(e[0], 0, e[2]).normalize(),
  };
}

/** Как в main.mjs: стик (-1..1) → мировое направление. */
function stickToWorld(ix, iy, yaw) {
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  let dx = fwdX * -iy + rightX * ix;
  let dz = fwdZ * -iy + rightZ * ix;
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

t('стик вверх идёт туда, куда смотрит камера', () => {
  for (let deg = 0; deg < 360; deg += 15) {
    const yaw = (deg * Math.PI) / 180;
    const b = basis(yaw);
    const w = stickToWorld(0, -1, yaw);   // стик вверх = -1 по Y
    const dot = w.x * b.forward.x + w.z * b.forward.z;
    ok(dot > 0.98, `yaw=${deg}°: стик вверх не совпал с направлением камеры (dot=${dot.toFixed(2)})`);
  }
});

t('стик вниз идёт назад (к камере)', () => {
  for (let deg = 0; deg < 360; deg += 30) {
    const yaw = (deg * Math.PI) / 180;
    const b = basis(yaw);
    const w = stickToWorld(0, 1, yaw);
    const dot = w.x * b.forward.x + w.z * b.forward.z;
    ok(dot < -0.98, `yaw=${deg}°: стик вниз не назад (dot=${dot.toFixed(2)})`);
  }
});

t('стик вправо идёт вправо по экрану', () => {
  for (let deg = 0; deg < 360; deg += 15) {
    const yaw = (deg * Math.PI) / 180;
    const b = basis(yaw);
    const w = stickToWorld(1, 0, yaw);
    const dot = w.x * b.right.x + w.z * b.right.z;
    ok(dot > 0.98, `yaw=${deg}°: стик вправо не вправо (dot=${dot.toFixed(2)})`);
  }
});

t('диагональ не растягивает скорость', () => {
  const a = stickToWorld(1, 0, 0.7);
  const b = stickToWorld(1, -1, 0.7);
  const la = Math.hypot(a.x, a.z);
  const lb = Math.hypot(b.x, b.z);
  ok(Math.abs(la - 1) < 1e-6 && Math.abs(lb - 1) < 1e-6, `длина не нормализована: ${la}, ${lb}`);
});

t('поворот камеры не ломает направление стика', () => {
  // при yaw = 90° «вперёд» должно быть -X в мировых координатах
  const w = stickToWorld(0, -1, Math.PI / 2);
  ok(Math.abs(w.x + 1) < 0.02, `вперёд при yaw=90 должен быть -X, вышло ${w.x.toFixed(2)}`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
