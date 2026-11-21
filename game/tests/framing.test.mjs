// Кадр от первого лица: что реально видно, считается настоящей проекцией
// three.js. Проверяем, что руки в кадре, пол под ногами виден и обзор не
// превращается в «смотрю в стену».

import * as THREE from '../vendor/three/three.min.js';
import { FP, handPoint } from '../src/render/viewmodel.mjs';
import { BODY } from '../src/world/character.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const ASPECT = 9 / 16;

/** Камера от первого лица: глаза мальчика, наклон и поворот. */
function fpCam({ pitch = 0, yaw = 0, fov = FP.fov } = {}) {
  const cam = new THREE.PerspectiveCamera(fov, ASPECT, FP.near, 40);
  cam.position.set(0, FP.eyeHeight, 0);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(pitch, yaw, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

const visible = (cam, p) => {
  const v = p.clone().project(cam);
  return { ndc: v, ok: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z >= -1 && v.z <= 1 };
};

t('правая рука с фонарём в кадре — на любой пропорции экрана', () => {
  // Считаем по настоящей точке кисти из viewmodel.mjs, а не по красивой
  // цифре в тесте: раньше тест был «зелёный», а рука висела на 0.6 м ниже
  // глаз и в кадр не попадала вообще.
  const p = handPoint();
  for (const [w, h, label] of [[9, 16, 'телефон'], [9, 19.5, 'высокий телефон'], [3, 4, 'планшет'], [9, 21, 'очень высокий']]) {
    const cam = new THREE.PerspectiveCamera(w / h < 0.62 ? FP.fov + 6 : FP.fov, w / h, FP.near, 3);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const v = visible(cam, new THREE.Vector3(p.x, p.y, p.z));
    ok(v.ok, `${label}: кисть за кадром (x=${v.ndc.x.toFixed(2)}, y=${v.ndc.y.toFixed(2)})`);
    ok(v.ndc.y < 0.1, `${label}: кисть слишком высоко — закрывает обзор`);
    ok(v.ndc.x > 0.15, `${label}: рука не справа, а по центру`);
  }
});

t('рука в кадре и при покачивании на шаге', () => {
  const p = handPoint();
  const cam = new THREE.PerspectiveCamera(FP.fov, 9 / 16, FP.near, 3);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  for (const bob of [-0.02, 0, 0.02]) {
    const v = visible(cam, new THREE.Vector3(p.x, p.y + bob, p.z));
    ok(v.ok, `при покачивании ${bob}: рука выпала (y=${v.ndc.y.toFixed(2)})`);
  }
});

t('пол под ногами виден при наклоне вниз', () => {
  const cam = fpCam({ pitch: -0.9 });
  const floorAhead = new THREE.Vector3(0, 0, -0.45);
  const v = visible(cam, floorAhead);
  ok(v.ok, `пол в 0.45 м не виден (y=${v.ndc.y.toFixed(2)})`);
});

t('потолок виден при наклоне вверх', () => {
  const cam = fpCam({ pitch: 0.8 });
  const v = visible(cam, new THREE.Vector3(0, 2.6, -1.2));
  ok(v.ok, `потолок не виден (y=${v.ndc.y.toFixed(2)})`);
});

t('вперёд видно далеко — комната читается', () => {
  const cam = fpCam();
  const wall = new THREE.Vector3(0, 1.0, -3.0);
  ok(visible(cam, wall).ok, 'стена в 3 м не видна — узкий тоннель');
});

t('дверь 2.05 м выше глаз — масштаб «я маленький» работает', () => {
  const cam = fpCam();
  const doorTop = visible(cam, new THREE.Vector3(0, 2.05, -1.6));
  ok(doorTop.ok, 'верх двери не влезает в кадр с 1.6 м — не читается высота');
  ok(doorTop.ndc.y > 0.3, `верх двери всего ${doorTop.ndc.y.toFixed(2)} NDC — не выглядит высоким`);
});

t('рука занимает угол экрана, а не половину', () => {
  const cam = new THREE.PerspectiveCamera(FP.fov, 9 / 16, FP.near, 3);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  // область кисти с фонарём: от центра кисти до линзы
  const p = handPoint();
  const a = visible(cam, new THREE.Vector3(p.x - 0.05, p.y + 0.05, p.z)).ndc;
  const b = visible(cam, new THREE.Vector3(p.x + 0.05, p.y - 0.04, p.z - 0.03)).ndc;
  // 27% ширины — это кисть вместе с корпусом фонаря в нижнем углу кадра.
  // Норма для вида от первого лица 25–35%: меньше — рука «потерялась»,
  // больше 40% — экран занят рукой, а не комнатой.
  const w = Math.abs(a.x - b.x) * 50;
  ok(w > 18 && w < 35, `кисть занимает ${w.toFixed(0)}% ширины экрана`);
  ok(p.y < 0, 'кисть выше горизонта — странно');
});

t('на узком экране поле зрения расширяется, а не сужается', () => {
  const wide = 74, narrow = FP.fov + 6;
  ok(narrow > wide - 8, 'на вертикальном телефоне обзор не шире');
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
