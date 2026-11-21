// Сборщик геометрии: описания предметов → буферы.
//
// Работает БЕЗ three.js: выдаёт плоские массивы вершин/индексов и группы по
// материалам. Это позволяет:
//   * считать габариты и точки контакта в тестах (node, без браузера);
//   * объединять всю статику комнаты в несколько мешей — по одному на материал.
//     Именно это даёт 60 FPS на телефоне: 1 draw call на материал вместо 300.

// ───────────────────────────────────────────────────────────────────────────
// Примитивы: возвращают { pos: Float32Array, nrm: Float32Array, idx: Uint16Array }
// ───────────────────────────────────────────────────────────────────────────

function quadsToMesh(verts, faces) {
  // verts: [[x,y,z], ...]; faces: [[a,b,c,d], ...] — по часовой изнутри
  const pos = [];
  const nrm = [];
  const idx = [];
  for (const f of faces) {
    const [a, b, c, d] = f.map((i) => verts[i]);
    // нормаль по первым трём точкам
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    const nn = [n[0] / len, n[1] / len, n[2] / len];
    const base = pos.length / 3;
    for (const p of [a, b, c, d]) {
      pos.push(p[0], p[1], p[2]);
      nrm.push(nn[0], nn[1], nn[2]);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, nrm, idx };
}

/** Коробка с центром в (0,0,0). UV по граням — для текстурирования. */
export function boxGeometry(w, h, d) {
  w = Math.max(1e-4, w); h = Math.max(1e-4, h); d = Math.max(1e-4, d);
  const x = w / 2, y = h / 2, z = d / 2;
  const verts = [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],   // 0..3 задняя
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],       // 4..7 передняя
  ];
  const faces = [
    [4, 5, 6, 7], // +Z
    [1, 0, 3, 2], // -Z
    [5, 1, 2, 6], // +X
    [0, 4, 7, 3], // -X
    [7, 6, 2, 3], // +Y
    [0, 1, 5, 4], // -Y
  ];
  return quadsToMesh(verts, faces);
}

/**
 * Коробка с фаской по всем рёбрам — «мягкий» куб.
 *
 * Зачем: мебель из чистых параллелепипедов читается как макет из картона.
 * Фаска 6–10 мм ловит свет на ребре, и появляется ощущение толщины и
 * материала — ровно то, чего не хватает.
 *
 * Устройство: каждая грань сжата на `c` со всех сторон, между гранями
 * вставлены 12 полос (рёбра) и 8 треугольников (углы). Нормали считаются
 * аналитически, а обход вершин проверяется по ним: если треугольник смотрит
 * внутрь, он разворачивается. Поэтому геометрия не может «вывернуться».
 */
export function bevelBoxGeometry(w, h, d, c = 0.008) {
  w = Math.max(1e-4, w); h = Math.max(1e-4, h); d = Math.max(1e-4, d);
  const m = Math.min(w, h, d) * 0.45;
  c = Math.max(0, Math.min(c, m));
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const ix = hw - c, iy = hh - c, iz = hd - c;

  const polys = [];   // { v: [[x,y,z], ...], n: [x,y,z] }

  // ── 6 граней
  for (const sx of [-1, 1]) {
    polys.push({
      n: [sx, 0, 0],
      v: [[sx * hw, -iy, -iz], [sx * hw, iy, -iz], [sx * hw, iy, iz], [sx * hw, -iy, iz]],
    });
  }
  for (const sy of [-1, 1]) {
    polys.push({
      n: [0, sy, 0],
      v: [[-ix, sy * hh, -iz], [ix, sy * hh, -iz], [ix, sy * hh, iz], [-ix, sy * hh, iz]],
    });
  }
  for (const sz of [-1, 1]) {
    polys.push({
      n: [0, 0, sz],
      v: [[-ix, -iy, sz * hd], [ix, -iy, sz * hd], [ix, iy, sz * hd], [-ix, iy, sz * hd]],
    });
  }

  // ── 12 рёбер: полоса между двумя гранями
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const n = [sx * Math.SQRT1_2, sy * Math.SQRT1_2, 0];
      polys.push({
        n,
        v: [[sx * hw, sy * iy, -iz], [sx * hw, sy * iy, iz], [sx * ix, sy * hh, iz], [sx * ix, sy * hh, -iz]],
      });
    }
    for (const sz of [-1, 1]) {
      const n = [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2];
      polys.push({
        n,
        v: [[sx * hw, -iy, sz * hd], [sx * hw, iy, sz * hd], [sx * ix, iy, sz * iz], [sx * ix, -iy, sz * iz]],
      });
    }
  }
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const n = [0, sy * Math.SQRT1_2, sz * Math.SQRT1_2];
      polys.push({
        n,
        v: [[-ix, sy * hh, sz * hd], [ix, sy * hh, sz * hd], [ix, sy * iy, sz * iz], [-ix, sy * iy, sz * iz]],
      });
    }
  }

  // ── 8 углов: треугольник, срезающий угол
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const k = 1 / Math.sqrt(3);
        polys.push({
          n: [sx * k, sy * k, sz * k],
          v: [
            [sx * hw, sy * iy, sz * iz],
            [sx * ix, sy * hh, sz * iz],
            [sx * ix, sy * iy, sz * hd],
          ],
        });
      }
    }
  }

  return polysToMesh(polys);
}

/** Полигоны (3–4 вершины) с заданной нормалью → меш, с проверкой обхода. */
export function polysToMesh(polys) {
  const pos = [], nrm = [], idx = [];
  for (const p of polys) {
    const v = p.v;
    // нормаль из первых трёх вершин; если смотрит против ожидаемой — разворачиваем
    const u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
    const w2 = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    const cr = [
      u[1] * w2[2] - u[2] * w2[1],
      u[2] * w2[0] - u[0] * w2[2],
      u[0] * w2[1] - u[1] * w2[0],
    ];
    const dot = cr[0] * p.n[0] + cr[1] * p.n[1] + cr[2] * p.n[2];
    const verts = dot < 0 ? [...v].reverse() : v;
    const base = pos.length / 3;
    for (const q of verts) {
      pos.push(q[0], q[1], q[2]);
      nrm.push(p.n[0], p.n[1], p.n[2]);
    }
    if (verts.length === 3) idx.push(base, base + 1, base + 2);
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, nrm, idx };
}

/** Цилиндр по Y, центр в (0,0,0). */
export function cylinderGeometry(rTop, rBottom, h, seg = 10) {
  const pos = [], nrm = [], idx = [];
  const hy = h / 2;
  // боковая поверхность
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const cx = Math.cos(a), cz = Math.sin(a);
    pos.push(cx * rTop, hy, cz * rTop);   nrm.push(cx, 0, cz);
    pos.push(cx * rBottom, -hy, cz * rBottom); nrm.push(cx, 0, cz);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  // крышки
  const capTop = pos.length / 3;
  pos.push(0, hy, 0); nrm.push(0, 1, 0);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pos.push(Math.cos(a) * rTop, hy, Math.sin(a) * rTop); nrm.push(0, 1, 0);
  }
  for (let i = 0; i < seg; i++) idx.push(capTop, capTop + 1 + i, capTop + 2 + i);
  const capBot = pos.length / 3;
  pos.push(0, -hy, 0); nrm.push(0, -1, 0);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pos.push(Math.cos(a) * rBottom, -hy, Math.sin(a) * rBottom); nrm.push(0, -1, 0);
  }
  for (let i = 0; i < seg; i++) idx.push(capBot, capBot + 2 + i, capBot + 1 + i);
  return { pos, nrm, idx };
}

/** Сфера низкой детализации (для шипов, шаров, шишек). */
export function sphereGeometry(r, seg = 8, rings = 6) {
  const pos = [], nrm = [], idx = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= seg; x++) {
      const u = x / seg;
      const theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      pos.push(nx * r, ny * r, nz * r);
      nrm.push(nx, ny, nz);
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < seg; x++) {
      const a = y * (seg + 1) + x;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { pos, nrm, idx };
}

/** Конус по Y, центр в (0,0,0). */
export function coneGeometry(r, h, seg = 8) {
  const pos = [], nrm = [], idx = [];
  const hy = h / 2;
  const apex = pos.length / 3;
  pos.push(0, hy, 0); nrm.push(0, 1, 0);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const cx = Math.cos(a), cz = Math.sin(a);
    const sl = Math.hypot(h, r);
    pos.push(cx * r, -hy, cz * r);
    nrm.push(cx * (h / sl), r / sl, cz * (h / sl));
  }
  for (let i = 0; i < seg; i++) idx.push(apex, apex + 1 + i, apex + 2 + i);
  const cap = pos.length / 3;
  pos.push(0, -hy, 0); nrm.push(0, -1, 0);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pos.push(Math.cos(a) * r, -hy, Math.sin(a) * r); nrm.push(0, -1, 0);
  }
  for (let i = 0; i < seg; i++) idx.push(cap, cap + 2 + i, cap + 1 + i);
  return { pos, nrm, idx };
}

// Фабрики примитивов: описание из props (s — размеры) → геометрия.
const primBox = (p) => boxGeometry(p.s[0], p.s[1], p.s[2]);
// Фаска: по умолчанию 8 мм, но у тонких плоских деталей её нужно погасить,
// иначе доска толщиной 12 мм превратится в лепёшку.
const primBev = (p) => {
  const c = p.bv ?? Math.min(p.s[0], p.s[1], p.s[2]) * 0.22;
  return bevelBoxGeometry(p.s[0], p.s[1], p.s[2], Math.min(c, 0.02));
};
const primCyl = (p) => cylinderGeometry(p.r2 ?? p.r, p.r, p.h, p.seg ?? (p.r < 0.05 ? 6 : 10));
const primSph = (p) => sphereGeometry(p.r, p.r < 0.05 ? 6 : 10, p.r < 0.05 ? 4 : 7);
const primCone = (p) => coneGeometry(p.r, p.h, p.seg ?? 8);

export const PRIMITIVES = {
  box: primBox,
  bev: primBev,
  cyl: primCyl,
  sph: primSph,
  cone: primCone,
};

// ───────────────────────────────────────────────────────────────────────────
// Сборка: из описания предмета — геометрия, разложенная по материалам
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {Array} parts — массив примитивов (см. props.mjs)
 * @param {object} xf — трансформация предмета: {x,y,z,rotY,scale}
 * @returns {Map<string, {pos:number[], nrm:number[], idx:number[], tris:number}>}
 */
export function buildParts(parts, xf = {}) {
  const groups = new Map();
  const cos = Math.cos(xf.rotY ?? 0);
  const sin = Math.sin(xf.rotY ?? 0);
  const sx = xf.scale?.[0] ?? 1, sy = xf.scale?.[1] ?? 1, sz = xf.scale?.[2] ?? 1;

  for (const part of parts) {
    const gen = PRIMITIVES[part.t];
    if (!gen) continue;
    const geo = gen(part);
    const key = part.mat;
    if (!groups.has(key)) groups.set(key, { pos: [], nrm: [], idx: [], tris: 0 });
    const grp = groups.get(key);
    const base = grp.pos.length / 3;

    const px = part.p[0] * sx, py = part.p[1] * sy, pz = part.p[2] * sz;
    // 'rot' может прийти как [0,0,0] из фабрик — нормализуем, чтобы не ловить NaN
    const rot = part.rot && (part.rot[0] || part.rot[1] || part.rot[2]) ? part.rot : null;
    const scl = part.scale && (part.scale[0] !== 1 || part.scale[1] !== 1 || part.scale[2] !== 1) ? part.scale : null;

    for (let i = 0; i < geo.pos.length; i += 3) {
      let vx = geo.pos[i], vy = geo.pos[i + 1], vz = geo.pos[i + 2];
      if (scl) { vx *= scl[0]; vy *= scl[1]; vz *= scl[2]; }
      if (rot) {
        // X поворот
        const c = Math.cos(rot[0]), s = Math.sin(rot[0]);
        const y1 = vy * c - vz * s;
        const z1 = vy * s + vz * c;
        vy = y1; vz = z1;
        const c2 = Math.cos(rot[1] ?? 0), s2 = Math.sin(rot[1] ?? 0);
        const x2 = vx * c2 + vz * s2;
        const z2 = -vx * s2 + vz * c2;
        vx = x2; vz = z2;
        const c3 = Math.cos(rot[2] ?? 0), s3 = Math.sin(rot[2] ?? 0);
        const x3 = vx * c3 - vy * s3;
        const y3 = vx * s3 + vy * c3;
        vx = x3; vy = y3;
      }
      vx += px; vy += py; vz += pz;
      // поворот предмета
      const wx = vx * cos + vz * sin;
      const wz = -vx * sin + vz * cos;
      grp.pos.push(wx + (xf.x ?? 0), vy + (xf.y ?? 0), wz + (xf.z ?? 0));

      let nx = geo.nrm[i], ny = geo.nrm[i + 1], nz = geo.nrm[i + 2];
      if (rot) {
        const c = Math.cos(rot[0]), s = Math.sin(rot[0]);
        const y1 = ny * c - nz * s; const z1 = ny * s + nz * c; ny = y1; nz = z1;
      }
      const nwx = nx * cos + nz * sin;
      const nwz = -nx * sin + nz * cos;
      grp.nrm.push(nwx, ny, nwz);
    }
    for (const id of geo.idx) grp.idx.push(base + id);
    grp.tris += geo.idx.length / 3;
  }
  return groups;
}

/** Габариты по описанию частей — для тестов и для расстановки. */
export function boundsOf(parts) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    const gen = PRIMITIVES[part.t];
    if (!gen) continue;
    const geo = gen(part);
    for (let i = 0; i < geo.pos.length; i += 3) {
      const x = geo.pos[i] + part.p[0];
      const y = geo.pos[i + 1] + part.p[1];
      const z = geo.pos[i + 2] + part.p[2];
      if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
      if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
      if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
    }
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** Материалы части предмета (для сборки меша по материал-группам). */
export function partsOf(prop) {
  if (prop.parts) return prop.parts();
  return prop.base ?? [];
}

export function triangleCount(parts) {
  let n = 0;
  for (const part of parts) {
    const gen = PRIMITIVES[part.t];
    if (!gen) continue;
    n += gen(part).idx.length / 3;
  }
  return n;
}
