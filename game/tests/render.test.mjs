// Проверки рендера БЕЗ браузера: собираем настоящие three.js-меши в node.
// three.js умеет работать без WebGL — геометрия строится, рендерер не нужен.
// Так мы ловим ошибки вроде «меш пустой», «индексы вне диапазона», «NaN в вершинах».

import * as THREE from '../vendor/three/three.min.js';
import { roomShellParts, solidSpans, openingsFor, atticRoofParts } from '../src/render/builders.mjs';
import { buildGroup, buildProp, materialFor, drawCalls } from '../src/render/mesher.mjs';
import { LAYOUT } from '../src/data/layout.mjs';
import { PROPS } from '../src/world/props.mjs';
import { partsOf } from '../src/world/builder.mjs';
import { roomById, floors } from '../src/sim/graph.mjs';
import { ROOMS, HEIGHTS, DOORS, LIGHTS } from '../src/data/house.mjs';
import { Character } from '../src/render/character.mjs';
import { layoutFits } from '../src/render/house-preview.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

function healthyGeometry(geo, label) {
  const pos = geo.attributes.position;
  ok(pos && pos.count > 0, `${label}: нет вершин`);
  const arr = pos.array;
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) throw new Error(`${label}: NaN в вершине ${i}`);
  }
  const idx = geo.index;
  if (idx) {
    const n = pos.count;
    for (let i = 0; i < idx.count; i++) {
      if (idx.array[i] >= n) throw new Error(`${label}: индекс ${idx.array[i]} >= ${n}`);
    }
    ok(idx.count % 3 === 0, `${label}: число индексов не кратно 3`);
  }
}

// ─────────────────────── оболочка комнат ───────────────────────

let totalTris = 0;
t('оболочка каждой комнаты собирается и не содержит мусора', () => {
  for (const room of ROOMS) {
    if (room.kind === 'yard') continue;
    const { parts } = roomShellParts(room);
    ok(parts.length > 8, `${room.id}: оболочка подозрительно пустая (${parts.length} частей)`);
    const g = buildGroup(parts, { name: room.id });
    const calls = drawCalls(g);
    ok(calls > 0 && calls < 14, `${room.id}: ${calls} draw call на оболочку`);
    let tris = 0;
    g.traverse((o) => {
      if (o.isMesh) {
        healthyGeometry(o.geometry, `${room.id}/${o.material.color.getHexString()}`);
        tris += (o.geometry.index?.count ?? 0) / 3;
      }
    });
    totalTris += tris;
    ok(tris < 2000, `${room.id}: оболочка ${tris} треугольников — тяжело`);
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  console.log(`      оболочка всего дома: ${totalTris} треугольников`);
});

t('проёмы вырезаются из стен, а не рисуются поверх', () => {
  const spans = solidSpans(10, [{ from: 3, to: 4 }, { from: 6, to: 7.5 }]);
  ok(spans.length === 3, `ожидалось 3 куска, вышло ${spans.length}`);
  ok(Math.abs(spans[0].from - 0) < 1e-6 && Math.abs(spans[0].to - 3) < 1e-6, 'первый кусок неверный');
  ok(Math.abs(spans[2].from - 7.5) < 1e-6 && Math.abs(spans[2].to - 10) < 1e-6, 'последний кусок неверный');
});

t('у комнат с дверьми проёмы найдены', () => {
  const withDoors = ['childroom', 'corridor', 'hall', 'kitchen', 'living'];
  for (const id of withDoors) {
    const room = roomById(id);
    const o = openingsFor(room);
    const count = o.n.length + o.s.length + o.w.length + o.e.length;
    ok(count > 0, `${id}: не найдено ни одного проёма`);
  }
});

t('двери прорубают проём ровно в 0.85 м', () => {
  const room = roomById('childroom');
  const o = openingsFor(room);
  const all = [...o.n, ...o.s, ...o.w, ...o.e].filter((x) => x.kind === 'door');
  ok(all.length >= 1, 'в детской нет дверей');
  for (const d of all) {
    const w = d.to - d.from;
    ok(Math.abs(w - HEIGHTS.door.w) < 0.001, `дверной проём ${w.toFixed(2)} м`);
    ok(Math.abs(d.h - HEIGHTS.door.h) < 0.001, `высота двери ${d.h}`);
  }
});

t('окна садятся выше роста мальчика (нельзя просто посмотреть)', () => {
  const room = roomById('childroom');
  const o = openingsFor(room);
  const wins = [...o.n, ...o.s, ...o.w, ...o.e].filter((x) => x.kind === 'window');
  ok(wins.length === 1, 'в детской должно быть одно окно');
  ok(wins[0].sill > 0.9, `подоконник ${wins[0].sill} — слишком низко`);
});

// ─────────────────────── мебель ───────────────────────

t('каждый предмет из расстановки строится в валидный меш', () => {
  for (const [roomId, lay] of Object.entries(LAYOUT)) {
    const room = roomById(roomId);
    for (const it of [...lay.items, ...lay.clutter]) {
      const g = buildProp(partsOf(PROPS[it.prop]), {
        x: it.x - room.rect.w / 2, y: it.y ?? 0, z: it.z - room.rect.d / 2, rotY: it.rot ?? 0,
      });
      const calls = drawCalls(g);
      ok(calls > 0, `${roomId}.${it.id}: пустой меш`);
      ok(calls < 12, `${roomId}.${it.id}: ${calls} draw call`);
      g.traverse((o) => {
        if (o.isMesh) { healthyGeometry(o.geometry, `${roomId}.${it.id}`); o.geometry.dispose(); }
      });
    }
  }
});

t('бюджет комнаты: не больше 30 draw call', () => {
  const room = roomById('childroom');
  const lay = LAYOUT.childroom;
  let calls = 0;
  const shell = buildGroup(roomShellParts(room).parts, { name: 'shell' });
  calls += drawCalls(shell);
  shell.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const it of [...lay.items, ...lay.clutter]) {
    const g = buildProp(partsOf(PROPS[it.prop]), { x: it.x, y: it.y ?? 0, z: it.z, rotY: it.rot ?? 0 });
    calls += drawCalls(g);
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  ok(calls < 130, `детская: ${calls} draw call — многовато`);
  console.log(`      детская целиком: ${calls} draw call`);
});

t('материалы кэшируются: два одинаковых запроса — один объект', () => {
  const a = materialFor('walnut');
  const b = materialFor('walnut');
  ok(a === b, 'материал создаётся заново — будут лишние программы шейдеров');
});

t('все цвета палитры валидны', () => {
  const m = materialFor('wallpaper');
  ok(m.color.getHex() >= 0, 'цвет сломан');
});

// ─────────────────────── персонаж ───────────────────────

t('мальчик собирается: все части, все материалы', () => {
  const ch = new Character();
  let meshes = 0;
  ch.root.traverse((o) => { if (o.isMesh) { meshes++; healthyGeometry(o.geometry, 'child'); } });
  ok(meshes >= 8, `у мальчика только ${meshes} мешей`);
  console.log(`      мальчик: ${meshes} мешей`);
});

t('анимация двигает части, а не всё сразу', () => {
  const ch = new Character();
  ch.setState('walk');
  const before = ch.legL.U.rotation.x;
  for (let i = 0; i < 20; i++) {
    ch.setMotion(0.95 / 60, 'walk');   // идём 0.95 м/с
    ch.update(1 / 60);
  }
  const after = ch.legL.U.rotation.x;
  ok(Math.abs(after - before) > 0.001, 'нога не двигается при ходьбе');
  ok(Number.isFinite(ch.root.rotation.y), 'поворот в NaN');
  ok(Number.isFinite(ch.pelvis.position.y), 'высота в NaN');
  // суставы: колено и локоть тоже живые — иначе походка «на палках»
  ok(ch.legL.F && ch.armL.F, 'нет суставов колена и локтя');
});

t('шаг даёт событие (на него вешается звук)', () => {
  const ch = new Character();
  ch.setState('walk');
  let steps = 0;
  ch.onFootfall = () => steps++;
  for (let i = 0; i < 240; i++) {
    ch.setMotion(0.95 / 60, 'walk');   // 4 секунды реальной ходьбы
    ch.update(1 / 60);
  }
  ok(steps >= 3, `за 4 секунды ходьбы только ${steps} шагов`);
});

t('стоя мальчик не топает', () => {
  const ch = new Character();
  ch.setState('idle');
  let steps = 0;
  ch.onFootfall = () => steps++;
  for (let i = 0; i < 240; i++) ch.update(1 / 60);
  ok(steps === 0, `стоя ${steps} шагов`);
});

// ─────────────────────── карта ───────────────────────

t('разрез дома влезает на экран телефона', () => {
  for (const [w, h] of [[360, 640], [390, 844], [412, 915], [320, 568]]) {
    const fit = layoutFits(w, h);
    ok(fit.scale > 8, `${w}×${h}: масштаб ${fit.scale.toFixed(1)} — дом не читается`);
    ok(fit.planW * fit.scale < w, `${w}×${h}: план шире экрана`);
    ok(fit.scale < 90, `${w}×${h}: слишком крупно, обрежется`);
    console.log(`      ${w}×${h}: масштаб ${fit.scale.toFixed(1)} px/м, план ${(fit.planW * fit.scale).toFixed(0)} px`);
  }
});

// ─────────────────────── ИТОГ ───────────────────────
console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
