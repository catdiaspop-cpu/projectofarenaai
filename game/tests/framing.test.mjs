// Кадр: сколько места мальчик занимает на экране.
//
// Это самая субъективная вещь в игре и самая частая причина «ничего не видно».
// Считаем настоящей проекцией three.js: вершина головы и ступни → NDC.
// Проверено на числах, а не на глаз: было 84% высоты экрана (один затылок),
// стало 45% при старте и не больше 55% при полном наклоне вниз.

import * as THREE from '../vendor/three/three.min.js';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const CAM = { dist: 1.35, height: 2.0, shoulder: 0.34, fov: 62, aspect: 9 / 16 };
const HEAD_Y = 1.15, FEET_Y = 0.05;

/** Камера и экранные координаты мальчика в локальных метрах комнаты. */
function frame({ yaw = Math.PI, pitch = -0.3, ch = { x: 0, z: -0.17 }, dist = CAM.dist, height = CAM.height } = {}) {
  const back = new THREE.Vector3(Math.sin(yaw) * dist, 0, Math.cos(yaw) * dist);
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const cam = new THREE.PerspectiveCamera(CAM.fov, CAM.aspect, 0.05, 40);
  cam.position.set(
    ch.x + back.x + right.x * CAM.shoulder,
    Math.max(0.4, height + Math.sin(pitch) * 1.1),
    ch.z + back.z + right.z * CAM.shoulder,
  );
  cam.lookAt(new THREE.Vector3(ch.x, 1.10, ch.z));
  cam.updateMatrixWorld(true);
  const head = new THREE.Vector3(ch.x, HEAD_Y, ch.z).project(cam);
  const feet = new THREE.Vector3(ch.x, FEET_Y, ch.z).project(cam);
  return { head, feet, cam: cam.position, camera: cam, heightPct: Math.abs(head.y - feet.y) * 50 };
}

const inFrame = (v) => Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z <= 1 && v.z >= -1;

t('на старте мальчик целиком в кадре', () => {
  const f = frame();
  ok(inFrame(f.head), `голова за кадром: y=${f.head.y.toFixed(2)}`);
  ok(inFrame(f.feet), `ноги за кадром: y=${f.feet.y.toFixed(2)}`);
});

t('мальчик не занимает весь экран (было 84% — видно только затылок)', () => {
  const f = frame();
  ok(f.heightPct < 55, `мальчик занимает ${f.heightPct.toFixed(0)}% высоты экрана`);
  ok(f.heightPct > 30, `мальчик занимает ${f.heightPct.toFixed(0)}% — слишком мелкий, не разглядеть`);
});

t('даже при полном наклоне вниз мальчик не заслоняет всё', () => {
  for (const pitch of [-0.5, -0.3, 0, 0.42]) {
    const f = frame({ pitch });
    ok(f.heightPct < 60, `наклон ${pitch}: мальчик ${f.heightPct.toFixed(0)}% экрана`);
    ok(inFrame(f.head) && inFrame(f.feet), `наклон ${pitch}: мальчик вылез из кадра`);
  }
});

t('вперёд виден пол — иначе непонятно, куда идти', () => {
  const f = frame();
  // Внимание: при yaw = π камера стоит на z = −1.52 и смотрит в +z,
  // поэтому «впереди» — это плюс, а не минус. Точка пола в 1.55 м от мальчика.
  const ahead = new THREE.Vector3(0, 0.02, -0.17 + 1.55).project(f.camera);
  ok(Math.abs(ahead.y) <= 1, `пол впереди не в кадре (y=${ahead.y.toFixed(2)})`);
  ok(ahead.z < 1, 'точка пола за дальней плоскостью');
});

t('камера влезает в самую маленькую жилую комнату', () => {
  // детская 3.6×3.4 — самая тесная после коридора, где включается вид сверху
  const roomD = 3.4;
  const chZ = -0.17;
  // 0.18 м — тот же запас, что и в scene3d (margin = min(0.3, узкая сторона × 0.18))
  const available = roomD / 2 - Math.abs(chZ) - 0.18;
  ok(CAM.dist <= available, `нужно ${CAM.dist} м позади, а есть ${available.toFixed(2)} м`);
});

t('при повороте на 360° мальчик не уходит из кадра', () => {
  for (let deg = 0; deg < 360; deg += 15) {
    const f = frame({ yaw: (deg * Math.PI) / 180 });
    ok(inFrame(f.head) || inFrame(f.feet), `yaw=${deg}°: мальчик пропал из кадра`);
  }
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
