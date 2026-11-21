// Сборка мальчика: части тела → иерархия THREE.Group с СУСТАВАМИ.
//
// Иерархия:
//   root → pelvis → torso → [head, armUL → armFL → hand, plush]
//                          legUL → legFL → foot
//
// Суставы важны не для красоты: без колена и локтя походка выглядит как
// машущие палки — именно на это и была жалоба «ноги двигаются капец быстро».
//
// Всё статичное внутри части сливается по материалу: у мальчика ~14 draw call,
// но каждый сустав — отдельная группа трансформации, так что анимация живая.

import * as THREE from '../../vendor/three/three.min.js';
import { PARTS, BODY, SKIN, pose, blinkAmount, stateToPose } from '../world/character.mjs';
import { advancePhase, strideFor, footfalls } from '../world/gait.mjs';

function boxesMesh(boxes) {
  const byMat = new Map();
  for (const b of boxes) {
    if (!(b.w > 0 && b.h > 0 && b.d > 0)) continue;
    if (!byMat.has(b.mat)) byMat.set(b.mat, []);
    byMat.get(b.mat).push(b);
  }
  const group = new THREE.Group();
  for (const [mat, list] of byMat) {
    const pos = [], nrm = [], idx = [];
    for (const b of list) addBox(pos, nrm, idx, b.w, b.h, b.d, b.x, b.y, b.z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    group.add(new THREE.Mesh(geo, matFor(mat)));
  }
  return group;
}

/** Самая низкая точка ступни в мировых координатах (по восьми углам мешей). */
const _v = new THREE.Vector3();
function footLowestY(group) {
  let low = Infinity;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;
    // 8 углов коробки — этого достаточно, ступня это коробки
    for (let i = 0; i < 8; i++) {
      _v.set(
        i & 1 ? bb.max.x : bb.min.x,
        i & 2 ? bb.max.y : bb.min.y,
        i & 4 ? bb.max.z : bb.min.z,
      ).applyMatrix4(o.matrixWorld);
      if (_v.y < low) low = _v.y;
    }
  });
  return low;
}

const matCache = new Map();
function matFor(key) {
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

/** Создать группу-сустав по описанию части. */
function joint(name) {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'child';

    this.pelvis = joint('pelvis');
    this.root.add(this.pelvis);

    // ── туловище
    const tp = PARTS.torso.pivot;
    this.torso = joint('torso');
    this.torso.position.set(tp[0], tp[1], tp[2]);
    this.pelvis.add(this.torso);
    this.torso.add(boxesMesh(PARTS.torso.boxes));

    // ── голова
    const hp = PARTS.head.pivot;
    this.head = joint('head');
    this.head.position.set(hp[0], hp[1] - tp[1], hp[2]);
    this.torso.add(this.head);
    this.head.add(boxesMesh(PARTS.head.boxes));

    // ── руки: плечо → локоть → кисть
    const arm = (side) => {
      const U = joint(`armUL${side}`);
      const up = PARTS[`armUL${side}`];
      U.position.set(up.pivot[0], up.pivot[1] - tp[1], up.pivot[2]);
      U.add(boxesMesh(up.boxes));
      this.torso.add(U);

      const F = joint(`armFL${side}`);
      F.position.set(0, PARTS[`armFL${side}`].pivot[1], 0);
      F.add(boxesMesh(PARTS[`armFL${side}`].boxes));
      U.add(F);

      const H = joint(`hand${side}`);
      H.position.set(0, PARTS[`hand${side}`].pivot[1], 0);
      H.add(boxesMesh(PARTS[`hand${side}`].boxes));
      F.add(H);

      return { U, F, H };
    };
    this.armL = arm('L');
    this.armR = arm('R');

    // ── ноги: бедро → колено → ступня
    const leg = (side) => {
      const U = joint(`legUL${side}`);
      const up = PARTS[`legUL${side}`];
      U.position.set(up.pivot[0], up.pivot[1], up.pivot[2]);
      U.add(boxesMesh(up.boxes));
      this.pelvis.add(U);

      const F = joint(`legFL${side}`);
      F.position.set(0, PARTS[`legFL${side}`].pivot[1], 0);
      F.add(boxesMesh(PARTS[`legFL${side}`].boxes));
      U.add(F);

      const FT = joint(`foot${side}`);
      FT.position.set(0, PARTS[`foot${side}`].pivot[1], 0);
      FT.add(boxesMesh(PARTS[`foot${side}`].boxes));
      F.add(FT);

      return { U, F, FT };
    };
    this.legL = leg('L');
    this.legR = leg('R');

    // ── лис в левой руке
    this.plush = joint('plush');
    this.plush.position.set(0, -0.06, 0.045);
    this.plush.add(boxesMesh(PARTS.plush.boxes));
    this.armL.H.add(this.plush);
    this.plush.visible = false;

    // ── фонарь в правой руке
    this.flashlight = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.025, 0.16, 10),
      new THREE.MeshLambertMaterial({ color: 0x2f3236, emissive: 0x111111 }),
    );
    body.position.y = -0.05;
    body.rotation.x = Math.PI / 2;
    this.flashlight.add(body);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.012, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe9c0 }),
    );
    lens.position.set(0, -0.05, 0.082);
    lens.rotation.x = Math.PI / 2;
    this.flashlight.add(lens);
    this.flashlight.position.set(0, -0.02, 0.03);
    this.flashlight.visible = false;
    this.armR.H.add(this.flashlight);

    // ── состояние анимации
    this.state = 'idle';
    this.t = 0;
    this.speed = 0;
    this.facing = 0;
    this.phase = 0;          // фаза шага 0..1, от пройденных метров
    this.extra = {};
    this.prevPhase = 0;
    this.onFootfall = null;
    this._target = null;
  }

  setState(name, extra = {}) {
    if (this.state !== name) this.state = name;
    this.extra = extra;
  }

  /** Куда мальчик реально движется — для синхронизации походки с шагом. */
  setMotion(distanceThisFrame, mode = 'walk') {
    const stride = strideFor(mode);
    const prev = this.phase;
    this.phase = advancePhase(this.phase, distanceThisFrame, stride);
    this.extra = { ...this.extra, mode, phase: this.phase };
    if (this.onFootfall && distanceThisFrame > 0) {
      const hits = footfalls(this.phase, prev);
      for (let i = 0; i < hits; i++) this.onFootfall(mode);
    }
  }

  /** @param {number} dt секунды */
  update(dt) {
    this.t += dt;
    const p = stateToPose(this.state, this.t, { facing: this.facing, ...(this.extra ?? {}) });

    // корень и таз
    this.pelvis.position.set(p.root.x, p.root.y, p.root.z);
    this.pelvis.rotation.z = p.root.roll ?? 0;
    this.root.rotation.y = this.facing;

    // корпус и голова
    this.torso.rotation.x = p.torso.x;
    this.torso.rotation.z = p.torso.roll ?? 0;
    this.head.rotation.set(p.head.x, p.head.y, p.head.z);

    // руки
    this.armL.U.rotation.x = p.armL.x;
    this.armL.U.rotation.z = p.armL.z;
    this.armR.U.rotation.x = p.armR.x;
    this.armR.U.rotation.z = p.armR.z;
    this.armL.F.rotation.x = p.elbowL.x;
    this.armR.F.rotation.x = p.elbowR.x;
    this.armL.H.rotation.x = p.handL.x;
    this.armR.H.rotation.x = p.handR.x;

    // ноги
    this.legL.U.rotation.x = p.legL.x;
    this.legR.U.rotation.x = p.legR.x;
    this.legL.U.rotation.z = p.legL.z ?? 0;
    this.legR.U.rotation.z = p.legR.z ?? 0;
    this.legL.F.rotation.x = p.kneeL.x;
    this.legR.F.rotation.x = p.kneeR.x;
    this.legL.FT.rotation.x = p.footL.x;
    this.legR.FT.rotation.x = p.footR.x;

    // лис
    this.plush.rotation.set(p.plush.x, 0, p.plush.z);

    // ── подошва ровно на полу ──
    // Формула в pose() считает длину ноги по углам бедра и колена, но не
    // учитывает поворот ступни: при шаге носок задирается, пятка уходит вниз,
    // и мальчик проваливается в пол на 2 см (бегом — на 4). Поэтому финальную
    // посадку делаем по настоящим мешам ступней: опускаем/поднимаем таз так,
    // чтобы самая низкая точка подошвы касалась пола.
    this.groundFeet();
  }

  /** Поставить самую низкую точку ступней на уровень пола (y = 0). */
  groundFeet() {
    let low = Infinity;
    for (const ft of [this.legL.FT, this.legR.FT]) {
      ft.updateWorldMatrix(true, true);
      low = Math.min(low, footLowestY(ft));
    }
    if (!Number.isFinite(low)) return;
    // было бы «почти ноль» — не дёргаем, чтобы не было дрожания
    if (Math.abs(low) > 0.0015) this.pelvis.position.y -= low;
    else this.pelvis.position.y -= low;
  }

  /**
   * Вид от первого лица.
   *
   * Мальчик — это камера, поэтому голову и руки показывать нельзя: они были
   * бы внутри глаз. Но и прятать всё тело неправильно — тогда, посмотрев вниз,
   * видишь пустой пол, будто у тебя нет ни тела, ни ног. Поэтому корпус,
   * ноги и ступни остаются: вниз смотришь и видишь свои коленки и носки.
   */
  setFirstPerson(on = true) {
    this.firstPerson = on;
    this.head.visible = !on;
    // голову прячем, шея остаётся — она ниже глаз и не мешает
    this.armL.U.visible = on ? false : true;
    this.armR.U.visible = on ? false : true;
    // корпус, таз и ноги видимы всегда
    this.torso.visible = true;
    this.pelvis.visible = true;
  }

  hold(item) {
    this.plush.visible = item === 'plush';
    this.flashlight.visible = item === 'flashlight';
  }

  /** Мировые габариты для коллизий. */
  get collider() {
    const crouch = this.state === 'hide' || this.state === 'peek' ? 0.62 : 1;
    return { radius: 0.16, height: BODY.height * crouch };
  }
}

export { pose, blinkAmount };
