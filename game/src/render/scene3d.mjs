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
import { PARTS, BODY, pose } from '../world/character.mjs';
import { roomShellParts, atticRoofParts } from './builders.mjs';
import { buildGroup, buildProp, materialFor, disposeGroup } from './mesher.mjs';
import { partsOf } from '../world/builder.mjs';
import { Character } from './character.mjs';

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

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 40);
    this.onTap = onTap;

    this.roomId = null;
    this.roomGroup = null;
    this.lights = [];
    this.character = new Character();
    this.scene.add(this.character.root);

    this.ambient = new THREE.AmbientLight(0x2a3040, 0.9);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x3a4658, 0x120f0c, 0.85);
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

    this.yaw = 0;
    this.pitch = -0.06;
    this.camHeight = 1.32;       // чуть выше глаз мальчика — читается как «его взгляд»
    this.walkBob = 0;
    this.t = 0;
    this.flicker = 0;
  }

  resize(w, h) {
    this.cssW = w;
    this.cssH = h;
    const pr = Math.min(2, window.devicePixelRatio || 1) * RENDER_SCALE;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
      const light = new THREE.PointLight(l.color, intensity * 3.2, l.radius, 1.6);
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

    // поставить мальчика в центр комнаты (позицию задаёт World)
    this.character.root.position.set(0, 0, 0);
    this.applyEnvironment(room);
  }

  applyEnvironment(room) {
    const night = room.light.night;
    this.ambient.intensity = 0.35 + night * 2.2;
    this.hemi.intensity = 0.5 + night * 2.0;
    this.hemi.color.setHex(0x33405a);
    this.hemi.groundColor.setHex(0x0d0a08);
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

  setLightState(state) {
    this.lightState = state;
    for (const rl of this.roomLights) {
      const on = state?.[rl.def.id] ?? rl.on;
      rl.on = on;
      rl.light.intensity = on ? rl.def.power * 3.2 : 0;
    }
  }

  /** Позиция мальчика внутри комнаты (локальные метры). */
  setCharacter(localX, localZ, facing, state, hold) {
    const room = roomById(this.roomId);
    this.character.root.position.set(localX - room.rect.w / 2, 0, localZ - room.rect.d / 2);
    this.character.facing = facing;
    this.character.setState(state);
    this.character.hold(hold);
  }

  /** Поворот камеры: свайп по экрану. */
  rotate(deltaYaw) {
    this.yaw += deltaYaw;
    // ограничиваем, чтобы не смотреть в стену за спиной слишком далеко
    this.yaw = Math.max(-Math.PI * 0.55, Math.min(Math.PI * 0.55, this.yaw));
  }

  render(dt) {
    this.t += dt;
    this.flicker = Math.sin(this.t * 17.3) * 0.03 + Math.sin(this.t * 6.1) * 0.02;

    const ch = this.character;
    ch.update(dt);

    // камера: от первого лица с лёгким покачиванием при ходьбе
    const speedFactor = ch.state === 'walk' ? 1 : ch.state === 'run' ? 1.5 : ch.state === 'sneak' ? 0.5 : 0;
    this.walkBob += dt * (6 + speedFactor * 4) * (speedFactor > 0 ? 1 : 0);
    const bob = Math.sin(this.walkBob) * 0.012 * speedFactor;

    // камера стоит в глазах мальчика — так работает «от первого лица»
    // но мальчика тоже видно в отражениях и когда поворачивается
    const camPos = new THREE.Vector3(
      ch.root.position.x + Math.sin(this.yaw) * -0.02,
      this.camHeight + bob,
      ch.root.position.z + Math.cos(this.yaw) * 0.02,
    );
    this.camera.position.copy(camPos);
    this.camera.rotation.set(this.pitch, Math.PI + this.yaw, 0, 'YXZ');

    // фонарь светит из глаз вперёд
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, Math.PI + this.yaw, 0, 'YXZ'));
    this.torch.position.copy(camPos);
    this.torchTarget.position.copy(camPos.clone().add(dir.multiplyScalar(3)));

    // мерцание ламп
    for (const rl of this.roomLights) {
      if (!rl.on) continue;
      const fl = rl.def.flicker ?? 0.02;
      rl.light.intensity = rl.def.power * 3.2 * (1 + this.flicker * (fl / 0.02));
    }

    this.renderer.render(this.scene, this.camera);
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
