// Сборка мешей: примитивы → BufferGeometry, с группировкой по материалу.
//
// Главная оптимизация под телефон: вся статика комнаты (стены, пол, мебель)
// сливается в ОДИН меш на материал. В детской 8 предметов и 21 материал →
// это 21 draw call вместо ~150. При 60 FPS разница между «летает» и «греется».

import * as THREE from '../../vendor/three/three.min.js';
import { buildParts } from '../world/builder.mjs';
import { colorOf, materialOf } from '../data/palette.mjs';

const materialCache = new Map();

/** Материал three.js по ключу палитры. Кэшируется: один материал — один draw call. */
export function materialFor(key, opts = {}) {
  const cacheKey = `${key}|${opts.lights ? 1 : 0}|${opts.flat ? 1 : 0}`;
  if (materialCache.has(cacheKey)) return materialCache.get(cacheKey);
  const desc = materialOf(key);
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(colorOf(key)),
    transparent: desc.transparent !== undefined,
    opacity: desc.transparent ?? 1,
    flatShading: opts.flat ?? false,
  });
  // Lambert дешевле Standard на телефоне примерно вдвое и для низкополигонального
  // «детсадовского» стиля выглядит правильнее: нет бликов на пластике.
  if (desc.emissive) {
    mat.emissive = new THREE.Color(colorOf(key));
    mat.emissiveIntensity = desc.emissive * 0.9;
  }
  materialCache.set(cacheKey, mat);
  return mat;
}

/** Примитивы (в мировых координатах) → один THREE.Group по материалам. */
export function buildGroup(parts, { name = 'group', shadows = false } = {}) {
  const groups = buildPartsParts(parts);
  const root = new THREE.Group();
  root.name = name;
  for (const [matKey, data] of groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.nrm, 3));
    geo.setIndex(data.idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, materialFor(matKey));
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
  }
  return root;
}

// Примитивы уже в мировых координатах комнаты — трансформация не нужна.
function buildPartsParts(parts) {
  const out = new Map();
  const merged = buildParts(parts, {});
  for (const [mat, data] of merged) {
    const pos = Float32Array.from(data.pos);
    const nrm = Float32Array.from(data.nrm);
    out.set(mat, { pos, nrm, idx: data.idx, count: data.idx.length });
  }
  return out;
}

/** Собрать один предмет по описанию из props, с трансформацией. */
export function buildProp(parts, xf) {
  const merged = buildParts(parts, xf);
  const root = new THREE.Group();
  for (const [matKey, data] of merged) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.nrm, 3));
    geo.setIndex(data.idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, materialFor(matKey));
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
  }
  return root;
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

/** Сколько draw call даст группа (для бюджетов). */
export function drawCalls(group) {
  let n = 0;
  group.traverse((o) => { if (o.isMesh) n++; });
  return n;
}
