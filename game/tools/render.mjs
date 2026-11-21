// Программный рендер кадра в PNG — без WebGL и без браузера.
//
// Зачем. Все тесты до сих пор проверяли геометрию, свет и позы числами:
// «треугольников столько, лампы там». Это ловит поломки, но не отвечает на
// вопрос «а как это выглядит». Playwright в песочнице нет, поэтому кадр
// рисуется здесь же, в node: те же данные (оболочка комнаты, мебель, свет,
// камера), растеризация своя — z-буфер и ламберт по нормалям.
//
// Это не three.js и не претендует на совпадение пиксель-в-пиксель: тонмаппинг,
// туман и тени упрощены. Но состав кадра — что видно, где, какого размера и
// какого цвета — тот же, и именно это надо было увидеть.
//
// Запуск:
//   node tools/render.mjs                 — все контрольные кадры в shots/
//   node tools/render.mjs childroom 0.0   — одна комната, поворот камеры

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { roomById } from '../src/sim/graph.mjs';
import { LAYOUT } from '../src/data/layout.mjs';
import { PROPS } from '../src/world/props.mjs';
import { buildParts, PRIMITIVES } from '../src/world/builder.mjs';
import { roomShellParts } from '../src/render/builders.mjs';
import { sharedWallBoxes } from '../src/render/scene3d.mjs';
import { colorOf } from '../src/data/palette.mjs';
import { World } from '../src/core/app.mjs';
import { WINDOWS, LIGHTS, HEIGHTS, DOORS } from '../src/data/house.mjs';
import { leafTransform } from '../src/sim/doors.mjs';
import { ROOM_LOOK } from '../src/data/rooms.mjs';

// ─────────────────────────── растеризация ───────────────────────────

const W = 360;
const H = 640;

/** Линейный цвет из sRGB-числа 0xRRGGBB (как это делает three при SRGBColorSpace). */
function lin(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [f(r), f(g), f(b)];
}

const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** Матрица вида и проекция: камера по yaw/pitch в точке eye. */
function cameraMatrix(eye, yaw, pitch, fovDeg, aspect) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // forward = (−sin yaw · cos pitch, sin pitch, −cos yaw · cos pitch)
  const fx = -sy * cp, fy = sp, fz = -cy * cp;
  // right = (cos yaw, 0, −sin yaw)
  const rx = cy, ry = 0, rz = -sy;
  // up = right × forward
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  const t = Math.tan((fovDeg * Math.PI) / 360);
  return { eye, f: [fx, fy, fz], r: [rx, ry, rz], u: [ux, uy, uz], t, aspect };
}

/** Точка мира → координаты камеры (x вправо, y вверх, z вперёд). */
function toCam(cam, p) {
  const dx = p[0] - cam.eye[0], dy = p[1] - cam.eye[1], dz = p[2] - cam.eye[2];
  return [
    dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2],
    dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2],
    dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2],
  ];
}

/** Точка в координатах камеры → экран. */
function toScreen(cam, c) {
  const z = c[2];
  return [
    (c[0] / (z * cam.t * cam.aspect) * 0.5 + 0.5) * W,
    (0.5 - (c[1] / (z * cam.t)) * 0.5) * H,
    z,
  ];
}

/**
 * Отсечение полигона по ближней плоскости z > NEAR.
 * Без него большой треугольник пола с вершинами за спиной отбрасывался
 * целиком, и пол в кадре оставался чёрным — это была ошибка рендера, а не игры.
 */
const NEAR = 0.03;
function clipNear(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ain = a[2] >= NEAR;
    const bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        NEAR + 1e-4,
      ]);
    }
  }
  return out;
}

class Frame {
  constructor() {
    this.color = new Float32Array(W * H * 3);
    this.depth = new Float32Array(W * H).fill(Infinity);
    // фон: ночное небо, как scene.background
    const bg = lin(0x05070a);
    for (let i = 0; i < W * H; i++) {
      this.color[i * 3] = bg[0];
      this.color[i * 3 + 1] = bg[1];
      this.color[i * 3 + 2] = bg[2];
    }
  }

  /** Треугольник с плоской нормалью и цветом. */
  tri(a, b, c, color, normal, light, alpha = 1) {
    const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const poly = clipNear([toCam(this.cam, a), toCam(this.cam, b), toCam(this.cam, c)]);
    if (poly.length < 3) return;
    const pts = poly.map((p) => toScreen(this.cam, p));
    for (let i = 1; i < pts.length - 1; i++) this.flatTri(pts[0], pts[i], pts[i + 1], color, normal, light, alpha, mid);
  }

  flatTri(pa, pb, pc, color, normal, light, alpha = 1, world = null) {

    const minX = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(pa[0], pb[0], pc[0])));
    const minY = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(pa[1], pb[1], pc[1])));
    if (minX > maxX || minY > maxY) return;

    const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);
    if (Math.abs(area) < 1e-9) return;
    const inv = 1 / area;

    // освещение: по нормали и по точке на поверхности (фонарь — конус)
    const shade = light(normal, world);
    const cr = color[0] * shade[0];
    const cg = color[1] * shade[1];
    const cb = color[2] * shade[2];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((pb[0] - px) * (pc[1] - py) - (pc[0] - px) * (pb[1] - py)) * inv;
        const w1 = ((pc[0] - px) * (pa[1] - py) - (pa[0] - px) * (pc[1] - py)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * pa[2] + w1 * pb[2] + w2 * pc[2];
        const i = y * W + x;
        if (z >= this.depth[i]) continue;
        // стекло не пишет глубину и смешивается с тем, что уже нарисовано
        if (alpha >= 0.999) this.depth[i] = z;
        const k = alpha;
        const base = i * 3;
        this.color[base] = this.color[base] * (1 - k) + cr * k;
        this.color[base + 1] = this.color[base + 1] * (1 - k) + cg * k;
        this.color[base + 2] = this.color[base + 2] * (1 - k) + cb * k;
      }
    }
  }

  png() {
    // тонмаппинг и обратно в sRGB, плюс туман по глубине
    const rgb = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      const z = this.depth[i];
      const fogK = Number.isFinite(z) ? Math.min(1, Math.max(0, (z - 4) / 10)) : 0;
      for (let k = 0; k < 3; k++) {
        let v = this.color[i * 3 + k];
        v = v / (1 + v);                        // ACES-подобное сжатие
        v = v * (1 - fogK * 0.55);
        rgb[i * 3 + k] = Math.round(255 * Math.min(1, Math.max(0, srgb(v))));
      }
    }
    return encodePng(rgb, W, H);
  }
}

/** Минимальный PNG (RGB, без интерлейса). */
function encodePng(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // бит на канал
  ihdr[9] = 2;   // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─────────────────────────── данные → треугольники ───────────────────────────

/** Примитив → список треугольников (позиции) для растеризации. */
function primitiveTris(part, xf) {
  const gen = PRIMITIVES[part.t];
  if (!gen) return [];
  const geo = gen(part);
  const cos = Math.cos(xf.rotY ?? 0);
  const sin = Math.sin(xf.rotY ?? 0);
  const out = [];
  const pos = [];
  const rot = part.rot && (part.rot[0] || part.rot[1] || part.rot[2]) ? part.rot : null;
  for (let i = 0; i < geo.pos.length; i += 3) {
    let vx = geo.pos[i], vy = geo.pos[i + 1], vz = geo.pos[i + 2];
    if (rot) {
      const c = Math.cos(rot[0]), s = Math.sin(rot[0]);
      const y1 = vy * c - vz * s; const z1 = vy * s + vz * c; vy = y1; vz = z1;
      const c2 = Math.cos(rot[1] ?? 0), s2 = Math.sin(rot[1] ?? 0);
      const x2 = vx * c2 + vz * s2; const z2 = -vx * s2 + vz * c2; vx = x2; vz = z2;
      const c3 = Math.cos(rot[2] ?? 0), s3 = Math.sin(rot[2] ?? 0);
      const x3 = vx * c3 - vy * s3; const y3 = vx * s3 + vy * c3; vx = x3; vy = y3;
    }
    vx += part.p[0]; vy += part.p[1]; vz += part.p[2];
    const wx = vx * cos + vz * sin;
    const wz = -vx * sin + vz * cos;
    const px = wx + (xf.x ?? 0), py = vy + (xf.y ?? 0), pz = wz + (xf.z ?? 0);
    pos.push([px, py, pz]);
    // нормаль: берём из геометрии, поворачиваем так же
    let nx = geo.nrm[i], ny = geo.nrm[i + 1], nz = geo.nrm[i + 2];
    if (rot) {
      const c = Math.cos(rot[0]), s = Math.sin(rot[0]);
      const y1 = ny * c - nz * s; const z1 = ny * s + nz * c; ny = y1; nz = z1;
    }
    const nwx = nx * cos + nz * sin;
    const nwz = -nx * sin + nz * cos;
    out.push([nwx, ny, nwz]);
  }
  const tris = [];
  for (let i = 0; i < geo.idx.length; i += 3) {
    const a = geo.idx[i], b = geo.idx[i + 1], c = geo.idx[i + 2];
    tris.push({
      v: [pos[a], pos[b], pos[c]],
      n: [
        (out[a][0] + out[b][0] + out[c][0]) / 3,
        (out[a][1] + out[b][1] + out[c][1]) / 3,
        (out[a][2] + out[b][2] + out[c][2]) / 3,
      ],
      mat: part.mat,
    });
  }
  return tris;
}

// ─────────────────────────── сборка сцены ───────────────────────────

function d_rect(room) { return room.rect; }

function sceneTris(roomId, opts = {}) {
  const { sightlines = true } = opts;
  const room = roomById(roomId);
  const { w, d } = room.rect;
  const toLocal = (x, y, z) => [x - w / 2, y, z - d / 2];
  const tris = [];

  const shell = roomShellParts(room);
  for (const p of shell.parts) {
    for (const t of primitiveTris(p, { x: -w / 2, z: -d / 2 })) {
      t.xray = t.mat === 'glass' || t.mat === 'glassDark' || t.mat === 'tulle';
      tris.push(t);
    }
  }
  for (const g of shell.glass) {
    for (const t of primitiveTris({ ...g }, { x: -w / 2, z: -d / 2 })) {
      t.xray = true;
      tris.push(t);
    }
  }

  const lay = LAYOUT[roomId] ?? { items: [], clutter: [] };
  for (const it of [...lay.items, ...lay.clutter]) {
    const prop = PROPS[it.prop];
    if (!prop) continue;
    const parts = typeof prop.base === 'function' ? prop.base() : [...(prop.base ?? []), ...(it.extra ?? [])];
    const xf = { x: it.x - w / 2, y: it.y ?? 0, z: it.z - d / 2, rotY: it.rot ?? 0 };
    for (const p of parts) for (const t of primitiveTris(p, xf)) tris.push(t);
  }

  // ── створки дверей: закрытая или приоткрытая
  const doors = [];
  for (const d of DOORS) {
    if (d.a !== roomId && d.b !== roomId) continue;
    if (d.stairs) continue;
    if (d.lock === 'люк в полу' || d.lock === 'люк в потолке') continue;
    const tr = leafTransform(d, room, 0);
    if (!tr) continue;
    const open = opts.openDoors === 'all' || opts.openDoors?.includes?.(d.id);
    // створка на петле, повёрнутая как в игре (угол открытия ~100°)
    const angle = open ? (tr.side === 'n' || tr.side === 'w' ? -1 : 1) * 1.75 : 0;
    const base = tr.baseRot + angle;
    const cx = tr.hinge.x - w / 2, cz = tr.hinge.z - d_rect(room).d / 2;
    const panel = [
      { t: 'bev', s: [tr.panel.w, tr.panel.h, tr.panel.t], p: [tr.panel.w / 2, tr.panel.h / 2, 0], mat: 'door' },
      { t: 'bev', s: [tr.panel.w - 0.18, tr.panel.h - 0.34, 0.008], p: [tr.panel.w / 2, tr.panel.h / 2 + 0.03, tr.panel.t / 2 + 0.004], mat: 'doorPanel' },
    ];
    for (const p2 of panel) {
      for (const t of primitiveTris(p2, { x: cx, y: 0, z: cz, rotY: base })) tris.push(t);
    }
    // ручка
    for (const t of primitiveTris({ t: 'sph', r: 0.028, p: [tr.panel.w - 0.09, 1.02, 0], mat: 'doorHandle' },
      { x: cx, y: 0, z: cz, rotY: base })) tris.push(t);
    doors.push({ id: d.id, other: d.a === roomId ? d.b : d.a, open });
  }

  // ── просвет: оболочки соседних комнат в общих координатах дома
  if (sightlines) {
    for (const d of DOORS) {
      if (d.a !== roomId && d.b !== roomId) continue;
      if (d.stairs) continue;
      if (d.lock === 'люк в полу' || d.lock === 'люк в потолке') continue;
      const otherId = d.a === roomId ? d.b : d.a;
      const other = roomById(otherId);
      if (!other) continue;
      // ту же логику, что и в сцене: общую стену рисует только своя комната,
      // иначе в предпросмотре видно двойную стену и «дыру» в проём
      const shellB = roomShellParts(other, { bare: true });
      const shared = sharedWallBoxes(room.rect, shellB.parts, {
        dx: other.rect.x - room.rect.x, dz: other.rect.z - room.rect.z,
      });
      shellB.parts = shellB.parts.filter((_, i) => !shared.has(i));
      const ox = other.rect.x - room.rect.x - w / 2;
      const oz = other.rect.z - room.rect.z - d_rect(room).d / 2;
      for (const p2 of shellB.parts) {
        for (const t of primitiveTris(p2, { x: ox, z: oz })) tris.push(t);
      }
    }
  }

  void toLocal;
  return { tris, room, doors };
}

// ─────────────────────────── свет ───────────────────────────

function makeLights(room, eye, extra) {
  const lamps = [];
  // лампы комнаты: только включённые в этой комнате
  for (const l of LIGHTS) {
    if (l.room !== room.id) continue;
    const on = (extra?.lights?.[l.id] ?? l.type === 'nightlight');
    if (!on) continue;
    lamps.push({
      p: [l.at.x - room.rect.w / 2, l.h, l.at.z - room.rect.d / 2],
      color: lin(l.color),
      // сила подобрана так, чтобы соответствовать трём источникам сцены
      power: 2.2 * (l.power ?? 0.6),
      radius: l.radius ?? 4,
    });
  }
  // фонарь в руке: настоящий конус из точки глаз вдоль взгляда.
  // Раньше здесь была просто прибавка яркости по нормали — по ней нельзя было
  // проверить, куда светит луч и какого он размера.
  const torch = extra?.torch ?? true;
  const spot = eye ? {
    p: [eye[0], eye[1] - 0.16, eye[2]],
    d: [-Math.sin(extra.yaw ?? 0) * Math.cos(extra.pitch ?? 0),
      Math.sin(extra.pitch ?? 0),
      -Math.cos(extra.yaw ?? 0) * Math.cos(extra.pitch ?? 0)],
    angle: Math.PI / 5.2,          // как в игре: полуугол 34°
    cos: Math.cos(Math.PI / 5.2),
  } : null;

  /** Яркость конуса в точке поверхности с нормалью n. */
  function spotAt(p, n) {
    if (!torch || !spot) return [0, 0, 0];
    const vx = p[0] - spot.p[0], vy = p[1] - spot.p[1], vz = p[2] - spot.p[2];
    const dist = Math.hypot(vx, vy, vz) || 1e-3;
    const cosA = (vx * spot.d[0] + vy * spot.d[1] + vz * spot.d[2]) / dist;
    if (cosA < spot.cos * 0.75) return [0, 0, 0];
    // мягкий край
    const edge = Math.min(1, Math.max(0, (cosA - spot.cos * 0.75) / (spot.cos * 0.25)));
    const fall = Math.max(0, 1 - dist / 12) ** 1.4;
    const lam = Math.max(0, (vx * n[0] + vy * n[1] + vz * n[2]) / dist) * -1;
    const k = 1.55 * edge * fall * Math.max(0.05, Math.abs(lam) ** 1.6);
    return [k * 1.0, k * 0.9, k * 0.74];
  }

  return function light(n, p) {
    // ambient + hemi (в сцене это 1.15–2.25 и 1.0–2.0)
    const amb = 0.19;
    const hemi = 0.17 * (0.6 + n[1] * 0.4);
    let r = amb * 0.95 + hemi * 0.85;
    let g = amb * 0.98 + hemi * 0.92;
    let b = amb * 1.08 + hemi * 1.12;

    for (const l of lamps) {
      // расстояние от поверхности до лампы, а не от начала координат
      const dx = (p ? p[0] : 0) - l.p[0];
      const dy = (p ? p[1] : 1) - l.p[1];
      const dz = (p ? p[2] : 0) - l.p[2];
      const dist = Math.hypot(dx, dy, dz);
      const fall = Math.max(0, 1 - dist / l.radius) ** 1.3;
      const k = l.power * fall * Math.max(0.2, n[1] * 0.7 + 0.3);
      r += l.color[0] * k; g += l.color[1] * k; b += l.color[2] * k;
    }

    if (p) {
      const s2 = spotAt(p, n);
      r += s2[0]; g += s2[1]; b += s2[2];
    }

    // окна: холодный свет с северной стены
    if (n[2] > 0.3) { r += 0.02; g += 0.04; b += 0.08; }
    return [r, g, b];
  };
}

// ─────────────────────────── кадр ───────────────────────────

export function renderShot({ room = 'childroom', yaw = null, pitch = -0.15, torch = true, lights = {}, file, openDoors = [], lookAt = null, at = null }) {
  const world = new World();
  world.room = room;
  const r = world.roomData.rect;
  const spot = at ?? world.safeSpot(world.pos.x, world.pos.z);
  const eye = [spot.x - r.w / 2, 1.105, spot.z - r.d / 2];
  // по умолчанию — в центр комнаты, как faceIntoRoom.
  // если задана цель (caда) — смотрим на неё: так проверяется вид в дверь
  let targetYaw = Math.atan2(eye[0] - 0, eye[2] - 0);
  if (lookAt) {
    const tx = lookAt.x - r.w / 2, tz = lookAt.z - r.d / 2;
    // forward = (−sin yaw, −cos yaw)
    targetYaw = Math.atan2(-(tx - eye[0]), -(tz - eye[2]));
  }
  const useYaw = yaw ?? targetYaw;

  const { tris, doors } = sceneTris(room, { openDoors });
  const frame = new Frame();
  // fov как в игре: на узком экране viewmodel расширяет поле зрения до 74
  const fov = W / H < 0.62 ? 74 : 68;
  frame.cam = cameraMatrix(eye, useYaw, pitch, fov, W / H);
  const light = makeLights(roomById(room), eye, { torch, lights, yaw: useYaw, pitch });

  // Обычный z-буфер. Отдельно — то, что светится само (ночь, луна, звёзды),
  // и отдельно — стекло: оно полупрозрачное и смешивается с тем, что под ним.
  const SELF_LIT = new Set(['nightSky', 'moon', 'star']);
  const solid = tris.filter((t) => !t.xray);
  const selfLit = tris.filter((t) => t.xray && SELF_LIT.has(t.mat));
  const glassy = tris.filter((t) => t.xray && !SELF_LIT.has(t.mat));

  for (const t of solid) frame.tri(t.v[0], t.v[1], t.v[2], lin(colorOf(t.mat)), t.n, light);
  for (const t of selfLit) frame.tri(t.v[0], t.v[1], t.v[2], lin(colorOf(t.mat)), t.n, () => [1, 1, 1]);
  for (const t of glassy) frame.tri(t.v[0], t.v[1], t.v[2], lin(colorOf(t.mat)), t.n, () => [0.35, 0.4, 0.45], 0.35);

  const png = frame.png();
  const out = file ?? `shots/${room}.png`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png);
  return { file: out, bytes: png.length, eye, yaw: useYaw, tris: tris.length, doors };
}

// ─────────────────────────── CLI ───────────────────────────

const isMain = process.argv[1] && process.argv[1].endsWith('render.mjs');
if (isMain) {
  // точка «безопасная» для комнаты — через тот же World.safeSpot
  function world_safe(id, p) {
    const w = new World();
    w.room = id;
    return w.safeSpot(p.x, p.z);
  }
  const argRoom = process.argv[2];
  const argYaw = process.argv[3] !== undefined ? Number(process.argv[3]) : null;
  // --doors: кадры «стою в дверях и свечу в проход» — проверка того, что за
  // створкой видно соседнюю комнату, а не чёрную дыру
  const wantDoors = process.argv.includes('--doors');
  const doorAt = (id) => {
    const room = roomById(id);
    const d = DOORS.find((x) => (x.a === id || x.b === id) && !x.stairs);
    return d ? d.at : { x: room.rect.w / 2, z: room.rect.d / 2 };
  };
  const doorShots = ['childroom', 'corridor', 'living', 'hall'].map((id) => {
    const room = roomById(id);
    const at = doorAt(id);
    // стоим в полутора метрах от двери внутри комнаты и смотрим в проём
    const cx = room.rect.w / 2, cz = room.rect.d / 2;
    const dx = at.x - room.rect.x - cx, dz = at.z - room.rect.z - cz;
    const len = Math.hypot(dx, dz) || 1;
    const stand = { x: at.x + (-dx / len) * 1.6, z: at.z + (-dz / len) * 1.6 };
    return {
      room: id, yaw: null, pitch: -0.02, openDoors: 'all',
      lookAt: { x: at.x, z: at.z }, at: world_safe(id, stand),
      file: `shots/${id}-door.png`,
    };
  });
  const shots = wantDoors ? doorShots : argRoom
    ? [{ room: argRoom, yaw: argYaw }]
    : [
      { room: 'childroom', yaw: null },
      { room: 'childroom', yaw: Math.PI },
      { room: 'corridor', yaw: null },
      { room: 'living', yaw: null },
      { room: 'kitchen', yaw: null },
      { room: 'parents', yaw: null },
      { room: 'attic', yaw: null },
      { room: 'basement', yaw: null },
    ];
  for (const s of shots) {
    const info = renderShot({ ...s, file: s.file ?? `shots/${s.room}${s.yaw === null ? '' : '-' + Math.round(s.yaw)}.png` });
    console.log(`${info.file.padEnd(34)} ${String(info.tris).padStart(5)} тр.  ${(info.bytes / 1024).toFixed(0)} KB`);
  }
  void HEIGHTS;
  void ROOM_LOOK;
  void buildParts;
  void WINDOWS;
}
