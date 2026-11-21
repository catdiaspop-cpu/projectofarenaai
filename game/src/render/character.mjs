// Сборка мальчика: воксельные кубы → иерархия THREE.Group с пивотами.
//
// Воксели выровнены по сетке, чтобы силуэт был ступенчатым и читался в темноте.
// Все кубы частей сливаются по материалу: у персонажа выходит ~4 draw call.

import * as THREE from '../../vendor/three/three.min.js';
import { PARTS, BODY, SKIN, pose, blinkAmount, stateToPose } from '../world/character.mjs';

const VOX = 0.235 / 8;

function voxMesh(boxes) {
  const byMat = new Map();
  const g = VOX;
  for (const b of boxes) {
    const w = Math.round(b.w / g) * g;
    const h = Math.round(b.h / g) * g;
    const d = Math.round(b.d / g) * g;
    if (w <= 0 || h <= 0 || d <= 0) continue;
    if (!byMat.has(b.mat)) byMat.set(b.mat, []);
    byMat.get(b.mat).push({ w, h, d, x: b.x, y: b.y, z: b.z });
  }
  const group = new THREE.Group();
  for (const [mat, list] of byMat) {
    const pos = [], nrm = [], idx = [];
    for (const b of list) {
      addBox(pos, nrm, idx, b.w, b.h, b.d, b.x, b.y, b.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    group.add(new THREE.Mesh(geo, voxMaterial(mat)));
  }
  return group;
}

const matCache = new Map();
function voxMaterial(key) {
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(SKIN[key] ?? 0xff00ff) });
  matCache.set(key, m);
  return m;
}

function addBox(pos, nrm, idx, w, h, d, cx, cy, cz) {
  const x = w / 2, y = h / 2, z = d / 2;
  const quads = [
    { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { n: [0, 0, -1], v: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
    { n: [1, 0, 0], v: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
    { n: [-1, 0, 0], v: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { n: [0, 1, 0], v: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
    { n: [0, -1, 0], v: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
  ];
  for (const q of quads) {
    const base = pos.length / 3;
    for (const [vx, vy, vz] of q.v) {
      pos.push(vx + cx, vy + cy, vz + cz);
      nrm.push(q.n[0], q.n[1], q.n[2]);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/** Иерархия: root → [torso → [head, armL, armR, plush], legL, legR]. */
export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'child';

    // корень на полу; анимация двигает его вверх/вниз
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0;
    this.root.add(this.pelvis);

    this.torso = new THREE.Group();
    const tp = PARTS.torso.pivot;
    this.torso.position.set(tp[0], tp[1], tp[2]);
    this.pelvis.add(this.torso);
    this.torso.add(voxMesh(PARTS.torso.boxes));

    this.head = new THREE.Group();
    const hp = PARTS.head.pivot;
    this.head.position.set(hp[0], hp[1] - tp[1], hp[2]);
    this.torso.add(this.head);
    this.head.add(voxMesh(PARTS.head.boxes));
    this.eyes = [];
    this.head.traverse((o) => { if (o.isMesh) this.eyes.push(o); });

    this.armL = new THREE.Group();
    const ap = PARTS.armL.pivot;
    this.armL.position.set(ap[0], ap[1] - tp[1], ap[2]);
    this.torso.add(this.armL);
    this.armL.add(voxMesh(PARTS.armL.boxes));

    this.armR = new THREE.Group();
    const ar = PARTS.armR.pivot;
    this.armR.position.set(ar[0], ar[1] - tp[1], ar[2]);
    this.torso.add(this.armR);
    this.armR.add(voxMesh(PARTS.armR.boxes));

    this.legL = new THREE.Group();
    const lp = PARTS.legL.pivot;
    this.legL.position.set(lp[0], lp[1], lp[2]);
    this.pelvis.add(this.legL);
    this.legL.add(voxMesh(PARTS.legL.boxes));

    this.legR = new THREE.Group();
    const rp = PARTS.legR.pivot;
    this.legR.position.set(rp[0], rp[1], rp[2]);
    this.pelvis.add(this.legR);
    this.legR.add(voxMesh(PARTS.legR.boxes));

    // лис в левой руке — виден только если взят
    this.plush = new THREE.Group();
    const pp = PARTS.plush.pivot;
    this.plush.position.set(pp[0], pp[1] - tp[1], pp[2]);
    this.torso.add(this.plush);
    this.plush.add(voxMesh(PARTS.plush.boxes));
    this.plush.visible = false;

    // фонарь в правой руке
    this.flashlight = new THREE.Group();
    this.flashlight.position.set(0, -0.3, 0.05);
    const flBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.18, 8),
      new THREE.MeshLambertMaterial({ color: 0x2f3236 })
    );
    flBody.position.y = -0.02;
    this.flashlight.add(flBody);
    this.flashlight.visible = false;
    this.armR.add(this.flashlight);

    this.state = 'idle';
    this.t = 0;
    this.speed = 0;
    this.facing = 0;
    this.lastFootfall = false;
    this.onFootfall = null;
  }

  setState(name, extra = {}) {
    if (this.state !== name) this.state = name;
    this.extra = extra;
  }

  /** @param {number} dt секунды */
  update(dt) {
    this.t += dt;
    const p = stateToPose(this.state, this.t, { facing: this.facing, ...(this.extra ?? {}) });

    // корень
    this.pelvis.position.y = p.root.y;
    this.pelvis.position.x = p.root.x;
    this.pelvis.position.z = p.root.z;
    this.pelvis.rotation.z = p.root.lean * 0.25;
    this.root.rotation.y = this.facing;

    // корпус наклоняется вперёд
    this.torso.rotation.x = p.torso.x;

    // голова
    this.head.rotation.x = p.head.x;
    this.head.rotation.y = p.head.y;
    this.head.rotation.z = p.head.z;

    // конечности
    this.armL.rotation.x = p.armL.x;
    this.armL.rotation.z = p.armL.z;
    this.armR.rotation.x = p.armR.x;
    this.armR.rotation.z = p.armR.z;
    this.legL.rotation.x = p.legL.x;
    this.legR.rotation.x = p.legR.x;

    this.plush.rotation.x = p.plush.x;
    this.plush.rotation.z = p.plush.z;

    // шаг: звук на каждый контакт с полом
    if (p.footfall && !this.lastFootfall && this.onFootfall) this.onFootfall(this.state);
    this.lastFootfall = p.footfall;
  }

  hold(item) {
    this.plush.visible = item === 'plush';
    this.flashlight.visible = item === 'flashlight';
  }

  /** Мировые габариты для коллизий (радиус и высота). */
  get collider() {
    const crouch = this.state === 'hide' || this.state === 'peek' ? 0.62 : 1;
    return { radius: 0.16, height: BODY.height * crouch };
  }
}

export { pose, blinkAmount };
