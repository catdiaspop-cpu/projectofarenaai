// Вид от первого лица: руки, фонарь и покачивание на шаге.
//
// Почему так. Игра про маленького мальчика в большом доме: масштаб читается
// только из его глаз. Дверь 2.05 м против роста 1.22 м — это и есть «я маленький».
//
// Что видно в кадре:
//   * правая рука с фонарём — основной источник света и главный «якорь»
//     обзора, поэтому она в кадре всегда;
//   * левая рука с лисом Плюшем — только когда он взят;
//   * покачивание и крен на шаге привязаны к фазе походки (по пройденным
//     метрам), поэтому картинка и шаги синхронны физически;
//   * дыхание и испуг добавляют микро-движение, чтобы кадр не был мёртвым.
//
// Всё в отдельной сцене (scene.fp), которая рендерится после мира с
// очисткой глубины: руки не проваливаются в стены и не режутся мебелью.

import * as THREE from '../../vendor/three/three.min.js';
import { BODY, SKIN } from '../world/character.mjs';

const FP = {
  eyeHeight: BODY.height - 0.115,   // глаза ребёнка ~1.105 м от пола
  fov: 68,                          // чуть шире обычного: телефон и «маленький»
  near: 0.02,
  // Рука не должна висеть за нижним краем кадра: при fov 68 и высоте глаз
  // вертикальная половина кадра на 0.34 м впереди — это ±0.23 м. Значит
  // кисть на −0.24 при z −0.34 уже у самого низа, а на −0.30 её не видно
  // вообще (это и было: «руки в кадре», но в кадре пусто).
  rightArmDrop: -0.042,
  armForward: -0.30,
  swayAmp: 0.010,
  bobAmp: 0.014,
};

/** Кусок руки: несколько блоков, слитых в один меш по материалу. */
function limb(parts, mat) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(SKIN[mat] ?? 0xffffff) });
  for (const b of parts) {
    const m = new THREE.Mesh(geo, material);
    m.scale.set(b.w, b.h, b.d);
    m.position.set(b.x, b.y, b.z);
    group.add(m);
  }
  return group;
}

/**
 * Правая рука с фонарём.
 *
 * Важно про плечо: в кадре должно быть только предплечье и кисть. Плечо в
 * поле зрения не попадает никогда — рука входит в кадр снизу-справа, из-за
 * нижнего края. Если рисовать плечо, оно превращается в огромный рукав на
 * пол-экрана: на телефоне камера стоит в 30 см от руки, и перспектива
 * раздувает всё, что ближе.
 *
 * Поэтому рукав короткий, наклонён внутрь и обрезан краем кадра, а не
 * начинается от плеча.
 */
function buildRightArm() {
  const g = new THREE.Group();

  // предплечье: входит из-за нижнего края, наклонено к центру
  const sleeve = limb([
    { w: 0.074, h: 0.15, d: 0.08, x: 0.0, y: -0.055, z: 0.01 },
  ], 'hoodie');
  sleeve.rotation.z = 0.13;
  g.add(sleeve);

  const cuff = limb([{ w: 0.078, h: 0.026, d: 0.084, x: -0.004, y: -0.132, z: 0.005 }], 'hoodieDark');
  cuff.rotation.z = 0.13;
  g.add(cuff);

  // кисть
  const hand = limb([
    { w: 0.066, h: 0.078, d: 0.055, x: 0.012, y: -0.205, z: -0.03 },
    { w: 0.028, h: 0.046, d: 0.026, x: -0.024, y: -0.215, z: -0.022 },  // большой палец
  ], 'hand');
  g.add(hand);

  // фонарь: корпус, голова с линзой, кнопка
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.024, 0.15, 12),
    new THREE.MeshLambertMaterial({ color: 0x35393e }),
  );
  body.rotation.x = Math.PI / 2;
  body.position.set(0.012, -0.215, -0.10);
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.023, 0.035, 12),
    new THREE.MeshLambertMaterial({ color: 0x282c30 }),
  );
  head.rotation.x = Math.PI / 2;
  head.position.set(0.012, -0.215, -0.185);
  g.add(head);

  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.024, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff2d4 }),
  );
  lens.position.set(0.012, -0.215, -0.203);
  lens.rotation.y = Math.PI;
  g.add(lens);

  g.userData.lens = lens;
  return g;
}

/** Левая рука с лисом — видна только когда лис взят. */
function buildLeftArm() {
  const g = new THREE.Group();
  g.add(limb([{ w: 0.082, h: 0.17, d: 0.088, x: -0.015, y: -0.08, z: -0.01 }], 'hoodie'));
  g.add(limb([{ w: 0.088, h: 0.028, d: 0.094, x: -0.015, y: -0.168, z: -0.01 }], 'hoodieDark'));
  g.add(limb([{ w: 0.064, h: 0.076, d: 0.054, x: -0.015, y: -0.212, z: -0.025 }], 'hand'));

  // лис: тело, голова, уши, хвост
  const plush = new THREE.Group();
  plush.add(limb([{ w: 0.095, h: 0.095, d: 0.12, x: 0, y: 0, z: 0 }], 'plush'));
  plush.add(limb([{ w: 0.07, h: 0.07, d: 0.07, x: 0, y: 0.045, z: 0.06 }], 'plushLight'));
  plush.add(limb([{ w: 0.024, h: 0.038, d: 0.024, x: -0.027, y: 0.1, z: 0.05 }], 'plush'));
  plush.add(limb([{ w: 0.024, h: 0.038, d: 0.024, x: 0.027, y: 0.1, z: 0.05 }], 'plush'));
  plush.add(limb([{ w: 0.05, h: 0.085, d: 0.05, x: 0, y: 0.02, z: -0.085 }], 'plush'));
  plush.position.set(-0.02, -0.235, -0.075);
  plush.rotation.x = 0.35;
  g.add(plush);
  g.userData.plush = plush;
  return g;
}

export class ViewModel {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} worldScene — сцена комнаты (чтобы взять свет)
   */
  constructor(renderer, worldScene) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FP.fov, 1, FP.near, 3);

    // свет для рук: тот же амбиент, что в комнате, плюс вспышка фонаря
    this.ambient = new THREE.AmbientLight(0x8a93a6, 1.2);
    this.scene.add(this.ambient);
    this.fill = new THREE.DirectionalLight(0xbfd0e8, 0.35);
    this.fill.position.set(0.3, 0.6, 0.4);
    this.scene.add(this.fill);
    // подсветка от фонаря — руки не должны быть чёрными
    this.torchGlow = new THREE.PointLight(0xffe6bd, 0, 1.2, 2);
    this.torchGlow.position.set(0.06, -0.1, -0.35);
    this.scene.add(this.torchGlow);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.rightArm = buildRightArm();
    this.rightArm.position.set(0.105, FP.rightArmDrop, FP.armForward);
    this.root.add(this.rightArm);

    this.leftArm = buildLeftArm();
    this.leftArm.position.set(-0.145, FP.rightArmDrop + 0.01, FP.armForward + 0.02);
    this.leftArm.visible = false;
    this.root.add(this.leftArm);

    // позиция глаз — её выставляет Scene3D каждый кадр
    this.eye = new THREE.Vector3(0, FP.eyeHeight, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.phase = 0;
    this.speed = 0;
    this.t = 0;
    this.scared = 0;
    this.breathe = 0.3;
    this.torchOn = true;
    this.holding = 'flashlight';
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.62 ? FP.fov + 6 : FP.fov;   // на узком экране шире
    this.camera.updateProjectionMatrix();
  }

  /** Состояние каждый кадр. phase — из пройденных метров (gait.mjs). */
  update(dt, { eye, yaw, pitch, roll = 0, phase = 0, speed = 0, state = 'idle', scared = 0, torchOn = true, holding = 'flashlight' }) {
    this.t += dt;
    this.eye.copy(eye);
    this.yaw = yaw;
    this.pitch = pitch;
    this.phase = phase;
    this.speed = speed;
    this.scared = scared;
    this.torchOn = torchOn;
    this.holding = holding;

    const moving = speed > 0.02;
    const ang = phase * Math.PI * 2;

    // ── покачивание: привязано к фазе шага, то есть к пройденным метрам
    const bobY = moving ? Math.abs(Math.sin(ang)) * FP.bobAmp * (0.6 + speed) : 0;
    const swayX = moving ? Math.sin(ang) * FP.swayAmp * speed : 0;
    const rollZ = moving ? Math.sin(ang) * 0.014 * speed : 0;
    // дыхание и испуг — микро-движение, чтобы кадр не был мёртвым
    const breath = Math.sin(this.t * 1.55) * (0.0015 + this.breathe * 0.002);
    const shake = scared * 0.0022;
    const shakeX = Math.sin(this.t * 21.7) * shake;
    const shakeY = Math.sin(this.t * 18.3 + 1.1) * shake * 0.7;

    // Позу камеры берём у мира (scene.fp получает уже готовые eye/yaw/pitch
    // с покачиванием), иначе руки и комната разъезжаются на шаге.
    this.camera.position.copy(eye);
    this.camera.position.y += breath;
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = yaw;
    this.camera.rotation.x = pitch;
    this.camera.rotation.z = roll + rollZ * 0.35;

    // ── руки: слегка отстают от поворота камеры, как настоящие
    const lag = 0.55;
    this.root.rotation.y = -yaw * (1 - lag) * 0.12;
    this.root.position.y = -bobY * 0.6;

    // правая рука с фонарём покачивается сильнее — она тяжёлая
    this.rightArm.position.y = FP.rightArmDrop - bobY * 1.6;
    this.rightArm.position.x = 0.105 + swayX * 0.6;
    this.rightArm.rotation.z = -0.16 - rollZ * 1.4;
    this.rightArm.rotation.x = -pitch * 0.12;

    // левая рука с лисом — спокойнее
    this.leftArm.visible = holding === 'plush';
    if (this.leftArm.visible) {
      this.leftArm.position.y = FP.rightArmDrop + 0.01 - bobY * 1.2;
      this.leftArm.position.x = -0.145 + swayX * 0.4;
      this.leftArm.rotation.z = -rollZ;
      this.leftArm.rotation.x = -pitch * 0.08;
    }

    // свет в руках
    this.torchOn = torchOn && holding === 'flashlight';
    this.torchGlow.intensity = this.torchOn ? 1.6 : 0.12;
    const lens = this.rightArm.userData.lens;
    if (lens) lens.material.color.setHex(this.torchOn ? 0xfff2d4 : 0x5a5f66);
    this.ambient.intensity = this.torchOn ? 1.05 : 0.5;
  }

  /** Рендер поверх мира: руки всегда в кадре и не режутся стенами. */
  render() {
    const r = this.renderer;
    const prevAuto = r.autoClear;
    r.autoClear = false;
    r.clearDepth();
    r.render(this.scene, this.camera);
    r.autoClear = prevAuto;
  }
}

export { FP };

/** Точка кисти с фонарём в системе камеры — по ней проверяется кадр. */
export function handPoint() {
  return { x: 0.105 - 0.004, y: FP.rightArmDrop - 0.205, z: FP.armForward - 0.10 };
}
