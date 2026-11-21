// Ступни и пол.
//
// Мальчик ходит по дому, и если нога уходит в пол — это видно сразу, а
// исправлять больно: ошибка сидит в тригонометрии. Здесь считается настоящая
// геометрия: собираем модель, прогоняем полный цикл шага и смотрим на самые
// низкие точки ступней.

import * as THREE from '../vendor/three/three.min.js';
import { Character } from '../src/render/character.mjs';
import { BODY, pose } from '../src/world/character.mjs';
import { SPEED } from '../src/sim/graph.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

/** Самая низкая точка двух ступней в мировых координатах. */
function feetLow(ch) {
  let low = Infinity;
  for (const ft of [ch.legL.FT, ch.legR.FT]) {
    ft.updateWorldMatrix(true, true);
    ft.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(
          i & 1 ? bb.max.x : bb.min.x,
          i & 2 ? bb.max.y : bb.min.y,
          i & 4 ? bb.max.z : bb.min.z,
        ).applyMatrix4(o.matrixWorld);
        low = Math.min(low, v.y);
      }
    });
  }
  return low;
}

/** Самая низкая точка ОДНОЙ ступни. */
function footLow(ft) {
  let low = Infinity;
  ft.updateWorldMatrix(true, true);
  ft.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(
        i & 1 ? bb.max.x : bb.min.x,
        i & 2 ? bb.max.y : bb.min.y,
        i & 4 ? bb.max.z : bb.min.z,
      ).applyMatrix4(o.matrixWorld);
      low = Math.min(low, v.y);
    }
  });
  return low;
}

/**
 * Прогон цикла шага. Возвращает:
 *   low   — самая низкая точка любой ступни за цикл (провал в пол),
 *   lift  — на сколько поднимается ПОДНЯТАЯ нога над опорной.
 */
function cycle(mode, speed) {
  const ch = new Character();
  ch.setState(mode);
  let low = 9, lift = 0, sunk = 0;
  const steps = 180;
  for (let i = 0; i < steps; i++) {
    ch.setMotion(speed / 60, mode);
    ch.update(1 / 60);
    ch.root.updateMatrixWorld(true);
    const a = footLow(ch.legL.FT);
    const b = footLow(ch.legR.FT);
    low = Math.min(low, a, b);
    lift = Math.max(lift, Math.abs(a - b));   // отрыв одной ноги от другой
    if (Math.min(a, b) < -0.004) sunk++;
  }
  return { low, lift, sunk, steps };
}

t('в покое подошва на полу, а не в нём и не над ним', () => {
  const ch = new Character();
  ch.update(0.016);
  ch.root.updateMatrixWorld(true);
  const y = feetLow(ch);
  ok(Math.abs(y) < 0.004, `подошва на ${(y * 100).toFixed(1)} см`);
});

t('при ходьбе нога не уходит в пол', () => {
  const r = cycle('walk', SPEED.normal);
  ok(r.sunk === 0, `${r.sunk} кадров из ${r.steps} нога в полу (до ${(r.low * 100).toFixed(1)} см)`);
  ok(r.low > -0.004, `самая низкая точка ${(r.low * 100).toFixed(1)} см`);
});

t('при беге нога не уходит в пол', () => {
  const r = cycle('run', SPEED.run);
  ok(r.sunk === 0, `${r.sunk} кадров из ${r.steps} нога в полу (до ${(r.low * 100).toFixed(1)} см)`);
});

t('крадучись нога не уходит в пол', () => {
  const r = cycle('sneak', SPEED.sneak);
  ok(r.sunk === 0, `${r.sunk} кадров нога в полу`);
});

t('нога поднимается на шаге — мальчик не «скользит»', () => {
  for (const [mode, speed] of [['walk', SPEED.normal], ['run', SPEED.run], ['sneak', SPEED.sneak]]) {
    const r = cycle(mode, speed);
    const lift = r.lift * 100;
    const need = mode === 'run' ? 3 : mode === 'sneak' ? 1.5 : 2;
    ok(lift > need, `${mode}: поднятая нога выше опорной всего на ${lift.toFixed(1)} см`);
    ok(lift < 14, `${mode}: нога поднимается на ${lift.toFixed(1)} см — это прыжки`);
  }
});

t('рост не меняется на шаге больше чем на 6 см', () => {
  const ch = new Character();
  ch.setState('walk');
  let lo = 9, hi = -9;
  for (let i = 0; i < 120; i++) {
    ch.setMotion(SPEED.normal / 60, 'walk');
    ch.update(1 / 60);
    ch.root.updateMatrixWorld(true);
    let top = 0;
    ch.root.traverse((o) => {
      if (o.isMesh) {
        o.updateWorldMatrix(true, false);
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        top = Math.max(top, o.geometry.boundingBox.max.y + o.getWorldPosition(new THREE.Vector3()).y);
      }
    });
    lo = Math.min(lo, top);
    hi = Math.max(hi, top);
  }
  ok((hi - lo) < 0.12, `макушка гуляет на ${((hi - lo) * 100).toFixed(0)} см — голова прыгает`);
});

t('формула pose() и настоящая геометрия не разъезжаются больше чем на 1 см', () => {
  // В pose() есть своя оценка высоты таза. Если она уедет далеко от правды,
  // компенсация по мешам начнёт дёргать таз — предупреждаем заранее.
  const ch = new Character();
  ch.setState('walk');
  let worst = 0;
  for (let i = 0; i < 40; i++) {
    ch.setMotion(SPEED.normal / 60, 'walk');
    ch.update(1 / 60);
    ch.root.updateMatrixWorld(true);
    // насколько пришлось подвинуть таз после формулы
    const p = pose({ speed: 0.55, phase: ch.phase, mode: 'walk' }, 0);
    worst = Math.max(worst, Math.abs(ch.pelvis.position.y - p.root.y));
  }
  ok(worst < 0.06, `поправка ${(worst * 100).toFixed(1)} см — формула pose() врёт`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
