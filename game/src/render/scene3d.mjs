// 3D-комната: одна комната за раз, камера как в старых хоррорах.
//
// Приёмы под телефон:
//   * рендер в разрешении 0.75× и апскейл средствами CSS — вдвое меньше работы GPU
//   * вся статика комнаты слита по материалам (21 draw call вместо ~150)
//   * только один динамический источник света (фонарь) + амбиент; остальное «запечено» в цвет
//   * камера фиксирована по высоте, поворот — это поворот комнаты, а не свободный обзор
//
// Переключение комнат: старая сцена уничтожается целиком (dispose), новая строится.
// Так память не растёт: за ночь можно пройти 14 комнат туда-обратно.

import * as THREE from '../../vendor/three/three.min.js';
import { roomById, floors } from '../sim/graph.mjs';
import { LAYOUT } from '../data/layout.mjs';
import { PROPS } from '../world/props.mjs';
import { LIGHTS, WINDOWS, HEIGHTS, DOORS } from '../data/house.mjs';
import { ROOM_LOOK } from '../data/rooms.mjs';
import { PARTS, BODY, pose } from '../world/character.mjs';
import { roomShellParts, atticRoofParts } from './builders.mjs';
import { buildGroup, buildProp, materialFor, disposeGroup } from './mesher.mjs';
import { partsOf } from '../world/builder.mjs';
import { Character } from './character.mjs';
import { ViewModel, FP } from './viewmodel.mjs';
import { bobCycle, strideFor } from '../world/gait.mjs';

// На сколько поворачивается створка на петле. 1.42 рад ≈ 81°: дверь почти
// прижата к стене и не мешает пройти, но всё ещё «дверь».
const DOOR_OPEN_ANGLE = 1.42;
import { leafTransform, leafAngle, swingSign } from '../sim/doors.mjs';

const RENDER_SCALE = 0.75;

export class Scene3D {
  constructor(canvas, { onTap } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setClearColor(0x05070a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.03, 40);
    this.onTap = onTap;

    this.roomId = null;
    this.roomGroup = null;
    this.lights = [];
    this.character = new Character();
    this.scene.add(this.character.root);

    // Свет. Раньше было почти чёрным: 0.53 на коричневых обоях.
    // Теперь ночь = «сумеречно, но видно», а фонарь и ночник решают остальное.
    this.ambient = new THREE.AmbientLight(0x7a869c, 1.5);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x8fa4c4, 0x2a2018, 1.35);
    this.scene.add(this.hemi);

    // фонарь в руке: точечный свет + конус
    this.torch = new THREE.SpotLight(0xffe6bd, 0, 9, Math.PI / 7, 0.45, 1.2);
    this.torch.position.set(0, 0.9, 0.1);
    this.scene.add(this.torch);
    this.torchTarget = new THREE.Object3D();
    this.scene.add(this.torchTarget);
    this.torch.target = this.torchTarget;

    // свет ночника и ламп комнаты
    this.roomLights = [];

    // ── Камера ОТ ПЕРВОГО ЛИЦА ──
    // Глаза ребёнка на высоте 1.10 м: дверь 2.05 м нависает вдвое выше роста,
    // и это самый честный способ показать, что мальчик маленький.
    // Первый раз экран был чёрным не из-за вида, а из-за камеры в стене,
    // света 0.53 и выключенного фонаря — это всё исправлено выше.
    this.fp = true;
    this.yaw = 0;
    this.pitch = 0;              // 0 = горизонт, вниз отрицательно
    this.pitchMin = -0.95;
    this.pitchMax = 0.85;
    // глаза двигаются вместе с мальчиком; bob и sway — от фазы шага
    this.eye = new THREE.Vector3(0, FP.eyeHeight, 0);
    this.eyeBase = FP.eyeHeight;
    this.bobY = 0;
    this.bobX = 0;
    this.shake = 0;              // испуг: дрожь кадра
    this.t = 0;
    this.flicker = 0;
    this.phase = 0;              // фаза шага, приходит из пройденных метров
    this.speed = 0;
    this.state = 'idle';
    this.scared = 0;
    this.holding = 'flashlight';
  }

  resize(w, h) {
    this.cssW = w;
    this.cssH = h;
    const pr = Math.min(2, window.devicePixelRatio || 1) * RENDER_SCALE;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // на узком экране телефона поле зрения шире, иначе в кадр влезает «щель»
    this.camera.fov = w / h < 0.62 ? 74 : 68;
    this.camera.updateProjectionMatrix();
    this.fpScene?.resize(w, h);
  }

  /** Загрузить комнату. */
  load(roomId, { instant = false } = {}) {
    if (this.roomId === roomId) return;
    this.disposeRoom();
    this.roomId = roomId;
    const room = roomById(roomId);
    const lay = LAYOUT[roomId];
    const group = new THREE.Group();
    group.name = `room:${roomId}`;

    // ── оболочка
    const shell = roomShellParts(room);
    const shellGroup = buildGroup(shell.parts, { name: 'shell' });
    shellGroup.position.set(-room.rect.w / 2, 0, -room.rect.d / 2);
    group.add(shellGroup);
    if (room.kind === 'attic') {
      const roof = buildGroup(atticRoofParts(room), { name: 'roof' });
      roof.position.set(-room.rect.w / 2, 0, -room.rect.d / 2);
      group.add(roof);
    }

    // ── мебель
    this.propMeshes = new Map();
    for (const it of [...lay.items, ...lay.clutter]) {
      const prop = PROPS[it.prop];
      if (!prop) continue;
      const parts = partsOf(prop);
      const mesh = buildProp(parts, {
        x: it.x - room.rect.w / 2,
        y: it.y ?? 0,
        z: it.z - room.rect.d / 2,
        rotY: it.rot ?? 0,
      });
      mesh.name = `prop:${it.id}`;
      mesh.userData = { id: it.id, prop: it.prop, clutter: Boolean(it.clutter || lay.clutter.includes(it)) };
      group.add(mesh);
      this.propMeshes.set(it.id, mesh);
    }

    // ── свет комнаты
    this.roomLights = [];
    for (const l of LIGHTS) {
      if (l.room !== roomId) continue;
      const fallback = l.type === 'nightlight' || l.type === 'window';
      const on = this.lightState?.[l.id] ?? fallback;
      const intensity = on ? l.power * (this.phaseDarkness ?? 1) : 0;
      const boost = l.type === 'nightlight' ? 6.5 : 4.0;
      const light = new THREE.PointLight(l.color, intensity * boost, l.radius * 1.6, 1.4);
      light.position.set(l.at.x - room.rect.w / 2, l.h, l.at.z - room.rect.d / 2);
      group.add(light);
      // видимая колба
      const bulb = buildProp([{ t: 'sph', r: 0.035, p: [0, 0, 0], mat: 'bulb' }], {
        x: l.at.x - room.rect.w / 2, y: l.h, z: l.at.z - room.rect.d / 2,
      });
      group.add(bulb);
      this.roomLights.push({ def: l, light, bulb, on });
    }

    this.roomGroup = group;
    this.scene.add(group);
    this.buildDoors(room);

    // поставить мальчика в центр комнаты (позицию задаёт World)
    this.character.root.position.set(0, 0, 0);
    this.applyEnvironment(room);

    // Глаза ставятся там, где стоит мальчик. Первый кадр был чёрным, когда
    // камера оставалась в стене, — теперь позиция глаз всегда под телом.
    this.eye.set(this.character.root.position.x, this.eyeBase, this.character.root.position.z);
    this.camera.position.copy(this.eye);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  applyEnvironment(room) {
    // Ночь темнее дня, но не в ноль: игрок должен читать комнату.
    // Комната со светом (кухня, прихожая) — светлее, кладовка и подвал — темнее.
    const night = room.light.night;           // 0.01..0.08
    const t = Math.min(1, night / 0.08);      // 0 — совсем темно, 1 — светло для ночи
    this.ambient.intensity = 1.15 + t * 1.1;
    this.hemi.intensity = 1.0 + t * 1.0;
    this.hemi.color.setHex(0x9db2d2);
    this.hemi.groundColor.setHex(0x2a2118);
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(0x0a0f16, 7, 19);
    else this.scene.fog.color.setHex(0x0a0f16);
  }

  disposeRoom() {
    if (!this.roomGroup) return;
    this.roomGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.scene.remove(this.roomGroup);
    this.roomGroup = null;
    this.propMeshes = new Map();
    this.roomLights = [];
  }

  setTorch(on, power = 1) {
    this.torch.intensity = on ? 5.5 * power : 0;
  }

  /**
   * Построить створки всех дверей комнаты: панель на петле, косяки, наличник,
   * ручка. Створка поворачивается вокруг петли — это видно и читается как дверь.
   */
  buildDoors(room) {
    this.doors = new Map();
    const opener = DOORS.filter((d) => d.a === room.id || d.b === room.id);
    for (const d of opener) {
      const tr = leafTransform(d, room, 0);
      if (!tr) continue;   // люк в полу/потолке — не створка

      // Петля на краю проёма. Створка висит на ней и поворачивается вокруг
      // ОСИ Y: стоя на месте, она закрывает проём, открывшись — уходит
      // в комнату. Раньше здесь был перепутан порядок (baseRot сбрасывался
      // в 0, угол писался не туда), и вместо открывания створка ехала вбок.
      const leaf = new THREE.Group();
      leaf.position.set(tr.hinge.x, 0, tr.hinge.z);
      leaf.rotation.y = tr.baseRot;

      // панель — от петли в сторону проёма, на всю ширину
      const panel = buildProp([
        { t: 'box', w: tr.panel.w, h: tr.panel.h, d: tr.panel.t, p: [0, 0, 0], mat: 'door' },
        { t: 'box', w: tr.panel.w - 0.18, h: tr.panel.h - 0.34, d: 0.008, p: [0, 0.03, tr.panel.t / 2 + 0.004], mat: 'doorPanel' },
        { t: 'box', w: tr.panel.w - 0.18, h: tr.panel.h - 0.34, d: 0.008, p: [0, 0.03, -tr.panel.t / 2 - 0.004], mat: 'doorPanel' },
      ], { x: tr.dir.x * tr.panel.w / 2, y: tr.panel.h / 2, z: tr.dir.z * tr.panel.w / 2 });
      leaf.add(panel);

      // ручка с обеих сторон — на своей высоте, где рука ребёнка
      const handleMat = 'doorHandle';
      for (const side of [-1, 1]) {
        const h = buildProp([{ t: 'sph', r: 0.028, p: [0, 0, 0], mat: handleMat }], {
          x: tr.handle.x - tr.hinge.x,
          y: tr.handle.y,
          z: tr.handle.z - tr.hinge.z + side * (tr.panel.t / 2 + 0.02),
        });
        leaf.add(h);
      }

      this.roomGroup.add(leaf);

      // косяки и наличник — из отделки этой комнаты
      const trimMat = (ROOM_LOOK[room.kind] ?? ROOM_LOOK.hall).trim;
      for (const j of tr.jambs) {
        this.roomGroup.add(buildProp([{ t: 'box', w: j.w, h: j.h, d: j.t, p: [0, 0, 0], mat: trimMat }],
          { x: j.x, y: j.h / 2, z: j.z }));
      }
      const li = tr.lintel;
      this.roomGroup.add(buildProp([{ t: 'box', w: li.w, h: li.h, d: li.t, p: [0, 0, 0], mat: trimMat }],
        { x: li.x, y: li.y, z: li.z }));

      // в какую сторону открывается: внутрь комнаты, а не сквозь стену
      this.doors.set(d.id, {
        group: leaf, baseRot: tr.baseRot, dir: tr.dir,
        swing: swingSign(tr, room), open: false, angle: 0,
      });
    }
  }

  /** Открыть дверь: створка поворачивается на петле. */
  openDoor(id) {
    const d = this.doors?.get(id);
    if (!d) return;
    d.open = true;
  }

  closeDoor(id) {
    const d = this.doors?.get(id);
    if (!d) return;
    d.open = false;
  }

  /** Плавно довести все створки до нужного угла. */
  animateDoors(dt) {
    if (!this.doors) return;
    for (const d of this.doors.values()) {
      const target = d.open ? DOOR_OPEN_ANGLE * (d.swing ?? 1) : 0;
      const k = Math.min(1, dt * (d.open ? 6.5 : 4.5));
      d.angle += (target - d.angle) * k;
      if (Math.abs(d.group.rotation.y - (d.baseRot + d.angle)) < 1e-4) continue;
      // угол открытия — ДОБАВКА к базовому повороту петли, а не вместо него
      d.group.rotation.y = d.baseRot + d.angle;
    }
  }

  setLightState(state) {
    this.lightState = state;
    for (const rl of this.roomLights) {
      const on = state?.[rl.def.id] ?? rl.on;
      rl.on = on;
      rl.light.intensity = on ? rl.def.power * 3.2 : 0;
    }
  }

  /** Позиция мальчика внутри комнаты (локальные метры). */
  setCharacter(localX, localZ, facing, state, hold, motion = {}) {
    const room = roomById(this.roomId);
    const lx = localX - room.rect.w / 2;
    const lz = localZ - room.rect.d / 2;
    this.character.root.position.set(lx, 0, lz);
    this.character.facing = facing;
    this.character.setState(state);
    this.character.hold(hold);

    // ── глаза = голова тела ──
    // Камера не «висит в комнате»: она стоит там, где у мальчика глаза, и
    // едет вместе с ним. Иначе первый кадр смотрит из одной точки, а тело
    // уходит — та самая «телепортация», которую мы убирали.
    this.eye.set(lx, this.eyeBase, lz);

    // покачивание считается по пройденным метрам (мотion.distance), а не по
    // времени — поэтому не может разойтись с шагами
    const d = motion.distance ?? 0;
    if (d > 0) this.phase += d / (motion.stride ?? strideFor(motion.mode ?? 'walk'));
    this.speed = motion.speed ?? 0;
    this.state = state;
    this.bobY = bobCycle(this.phase) * FP.bobAmp * (0.6 + this.speed);
    this.bobX = Math.sin(this.phase * Math.PI) * FP.swayAmp * this.speed;
    this.shake = Math.min(0.012, this.scared * 0.012);
  }

  /**
   * Развернуть взгляд в комнату после входа в дверь.
   * Только поворот головы — позицию глаз задаёт setCharacter.
   */
  faceIntoRoom(toward = null) {
    const room = roomById(this.roomId);
    if (!room) return;
    const ch = this.character.root.position;
    // куда смотреть: в переданную точку или в центр комнаты
    const tx = toward ? toward.x - room.rect.w / 2 : 0;
    const tz = toward ? toward.z - room.rect.d / 2 : 0;
    const dx = tx - ch.x;
    const dz = tz - ch.z;
    if (Math.hypot(dx, dz) < 0.05) return;   // стоим в центре — некуда смотреть
    // forward камеры = (-sin yaw, -cos yaw)
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.12;                       // чуть под ноги, как при входе
  }

  /** Поворот камеры (стик справа или свайп). Yaw — свободный, pitch ограничен. */
  rotate(deltaYaw, deltaPitch = 0) {
    this.yaw += deltaYaw;
    // От первого лица вниз можно смотреть почти в пол — видно свои ноги,
    // вверх — до потолка. Раньше здесь стояло −0.5/0.42 от камеры-за-спиной.
    this.pitch = Math.max(this.pitchMin, Math.min(this.pitchMax, this.pitch + deltaPitch));
  }

  render(dt) {
    this.t += dt;
    this.flicker = Math.sin(this.t * 17.3) * 0.03 + Math.sin(this.t * 6.1) * 0.02;

    const ch = this.character;
    ch.update(dt);

    // ── камера: глаза мальчика, без всякой «третьей стороны» ──
    // bob по вертикали и sway вбок/вкренг привязаны к фазе шага
    const shakeX = this.shake ? Math.sin(this.t * 41.3) * this.shake : 0;
    const shakeY = this.shake ? Math.sin(this.t * 33.7) * this.shake * 0.7 : 0;
    this.camera.position.set(
      this.eye.x + this.bobX + shakeX,
      this.eye.y + this.bobY + shakeY,
      this.eye.z,
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(
      this.pitch + (this.shake ? Math.sin(this.t * 27.1) * this.shake * 0.8 : 0),
      this.yaw,
      this.bobX * 1.6,      // крен в такт шагу
    );

    // мальчик целиком уходит из кадра (он и есть камера), но модель жива:
    // тень, отражения и будущие катсцены
    this.character.root.visible = false;

    // ── фонарь: светит из правой руки туда, куда смотрим ──
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.torch.position.set(
      this.eye.x + right.x * 0.2 - fwd.x * 0.15,
      this.eye.y - 0.12,
      this.eye.z + right.z * 0.2 - fwd.z * 0.15,
    );
    this.torchTarget.position.copy(this.torch.position).addScaledVector(fwd, 3.5);
    this.torchTarget.position.y -= 0.25 + Math.tan(this.pitch) * 1.2;

    // ── руки от первого лица ──
    if (!this.fpScene) {
      this.fpScene = new ViewModel(this.renderer, this.scene);
      this.fpScene.resize(this.cssW ?? 800, this.cssH ?? 600);
    }
    this.fpScene.update(dt, {
      // ровно та же поза, что у мира: иначе руки «плывут» относительно комнаты
      eye: this.camera.position,
      yaw: this.yaw,
      pitch: this.pitch,
      roll: this.camera.rotation.z,
      phase: this.phase,
      speed: this.speed,
      state: this.state,
      scared: this.scared,
      torchOn: this.torch.intensity > 0.01,
      holding: this.holding,
    });

    this.animateDoors(dt);

    // мерцание ламп
    for (const rl of this.roomLights) {
      if (!rl.on) continue;
      const fl = rl.def.flicker ?? 0.02;
      rl.light.intensity = rl.def.power * 3.2 * (1 + this.flicker * (fl / 0.02));
    }

    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    // руки поверх мира: не режутся стенами и мебелью
    this.fpScene.render();
  }

  /** Сколько треугольников в сцене — для замера. */
  stats() {
    let tris = 0, meshes = 0;
    this.scene.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        const idx = o.geometry?.index;
        tris += idx ? idx.count / 3 : (o.geometry?.attributes?.position?.count ?? 0) / 3;
      }
    });
    return { tris, meshes, calls: this.renderer.info.render.calls };
  }
}
