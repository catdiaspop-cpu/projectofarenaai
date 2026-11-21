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

    // Камера от третьего лица, через плечо.
    // Камера больше НЕ стоит внутри мальчика: игрок должен его видеть.
    this.yaw = 0;
    this.pitch = -0.3;
    // Подобрано проекцией, а не на глаз: при 1.35 м и высоте 2.0 м мальчик
    // занимает ~45% высоты экрана (было 84% — видно только затылок) и в кадре
    // виден пол на 2.5 м вперёд. Камера при этом влезает даже в детскую 3.4 м.
    this.camDist = 1.35;         // метров позади
    this.camHeight = 2.0;        // выше головы мальчика (1.22 м), взгляд вниз
    this.camShoulder = 0.34;     // сдвиг вправо, «через плечо»
    this.camLerp = 0;            // сглаженная позиция
    this.camPos = new THREE.Vector3(0, 1.5, 3);
    this.camLook = new THREE.Vector3(0, 1.1, 0);
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

    // поставить мальчика в центр комнаты (позицию задаёт World)
    this.character.root.position.set(0, 0, 0);
    this.applyEnvironment(room);

    // камера сразу на своё место, иначе первый кадр — из стены
    this.camPos.set(
      Math.sin(this.yaw) * this.camDist + this.camShoulder,
      this.camHeight,
      Math.cos(this.yaw) * this.camDist,
    );
    this.camLook.set(0, 1.1, 0);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
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

  /** Поставить камеру так, чтобы она смотрела в комнату (после входа в дверь). */
  faceIntoRoom() {
    const room = roomById(this.roomId);
    if (!room) return;
    const ch = this.character.root.position;
    // вектор от мальчика к центру комнаты
    const dx = -ch.x, dz = -ch.z;
    // forward камеры = (-sin yaw, -cos yaw); хотим, чтобы он смотрел на центр
    this.yaw = Math.atan2(-dx, -dz);
    this.camPos.set(ch.x + Math.sin(this.yaw) * this.camDist, this.camHeight, ch.z + Math.cos(this.yaw) * this.camDist);
    this.camLook.set(ch.x, 1.12, ch.z);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Поворот камеры (стик справа или свайп). Yaw — свободный, pitch ограничен. */
  rotate(deltaYaw, deltaPitch = 0) {
    this.yaw += deltaYaw;
    // Нижняя граница — из расчёта кадра: при 1.35 м и высоте 2.0 м наклон
    // −0.62 даёт мальчика на 70% экрана. Ограничиваем −0.5 — максимум 57%.
    this.pitch = Math.max(-0.5, Math.min(0.42, this.pitch + deltaPitch));
  }

  render(dt) {
    this.t += dt;
    this.flicker = Math.sin(this.t * 17.3) * 0.03 + Math.sin(this.t * 6.1) * 0.02;

    const ch = this.character;
    ch.update(dt);

    // ── камера от третьего лица, через плечо ──
    const speedFactor = ch.state === 'walk' ? 1 : ch.state === 'run' ? 1.6 : ch.state === 'sneak' ? 0.5 : 0;
    this.walkBob += dt * (6 + speedFactor * 4) * (speedFactor > 0 ? 1 : 0);
    const bob = Math.sin(this.walkBob) * 0.01 * speedFactor;

    const head = ch.root.position;
    const focus = new THREE.Vector3(head.x, 1.02 + bob * 0.5, head.z);

    // точка, куда сдвигается камера: назад по yaw и вправо через плечо
    const back = new THREE.Vector3(
      Math.sin(this.yaw) * this.camDist,
      0,
      Math.cos(this.yaw) * this.camDist,
    );
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = new THREE.Vector3(
      focus.x + back.x + right.x * this.camShoulder,
      this.camHeight + bob + Math.sin(this.pitch) * 1.1,
      focus.z + back.z + right.z * this.camShoulder,
    );

    // ── камера не проходит сквозь стены ──
    // Если сзади стена, камера не влезает — поднимаемся выше и смотрим вниз,
    // как в мобильных ужастиках. Это всегда работает и ничего не ломает.
    const room = roomById(this.roomId);
    if (room) {
      // в тесной комнате (коридор 8×1.5) запас 0.3 м не оставляет места —
      // считаем от узкой стороны, но стенку не пробиваем
      const margin = Math.min(0.3, Math.min(room.rect.w, room.rect.d) * 0.18);
      const hw = room.rect.w / 2 - margin;
      const hd = room.rect.d / 2 - margin;
      const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));
      const fits = (v) => Math.abs(v.x) < hw && Math.abs(v.z) < hd;
      if (!fits(desired)) {
        // 1) поджимаем дистанцию, но не ближе ~0.85 м:
        //    вплотную к затылку мальчик занимает весь экран, это не обзор
        let k = 0.95;
        for (; k >= 0.45; k -= 0.1) {
          desired.set(
            focus.x + back.x * k + right.x * this.camShoulder * k,
            this.camHeight + bob + Math.sin(this.pitch) * 1.1,
            focus.z + back.z * k + right.z * this.camShoulder * k,
          );
          if (fits(desired)) break;
        }
        // 2) если всё равно не влезли — поднимаемся над мальчиком и смотрим вниз
        if (!fits(desired)) {
          // совсем узкая комната (коридор 8×1.5, кладовка): сзади физически
          // нет места, поэтому смотрим сверху. Отступ берём максимально
          // возможный — сколько есть до стены, а не фиксированный.
          const room2 = Math.max(0.05, Math.min(hd - Math.abs(focus.z), hd) * 0.92);
          const along = back.z !== 0 ? back.z / Math.abs(back.z) : 0;
          const side = back.x !== 0 ? back.x / Math.abs(back.x) : 0;
          desired.set(
            focus.x + side * room2 * 0.5 + right.x * 0.16,
            this.camHeight + 0.58 + bob,
            focus.z + along * room2 + right.z * 0.16,
          );
        }
        desired.x = clamp(desired.x, hw);
        desired.z = clamp(desired.z, hd);
      }
    }

    // сглаживание: камера не телепортируется
    const smooth = Math.min(1, dt * 9);
    this.camPos.lerp(desired, smooth);
    this.camLook.lerp(new THREE.Vector3(focus.x, focus.y + 0.08, focus.z), Math.min(1, dt * 12));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // фонарь светит из рук мальчика вперёд, куда смотрит камера
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, Math.PI + this.yaw, 0, 'YXZ'));
    this.torch.position.set(head.x + right.x * 0.2, 0.95, head.z + right.z * 0.2);
    this.torchTarget.position.copy(this.torch.position.clone().add(dir.multiplyScalar(3.2)));
    this.torch.target.position.y -= 0.35;

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
