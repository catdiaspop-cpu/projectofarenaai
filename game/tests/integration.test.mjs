// Сквозная проверка: собранная сцена действительно содержит всё нужное.
// Это ловит класс ошибок «код есть, но не подключён» — именно так вышло с фонарём.

import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(root, '..', f), 'utf8');

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

t('index.html подключает контейнер стиков', () => {
  const html = read('index.html');
  ok(html.includes('id="controls"'), 'нет контейнера #controls');
  ok(html.includes('src/main.mjs'), 'нет точки входа');
  ok(html.includes('styles.css'), 'нет стилей');
});

t('main.mjs создаёт стики и подключает их к движению', () => {
  const m = read('src/main.mjs');
  ok(m.includes('new Sticks('), 'стики не создаются');
  ok(m.includes('applyMovement'), 'движение не подключено');
  ok(m.includes('sticks.update'), 'стики не обновляются в кадре');
  ok(m.includes('moveMode('), 'режим движения не вычисляется');
});

t('фонарь включается сам при старте 3D (та самая ошибка)', () => {
  const m = read('src/main.mjs');
  ok(/scene3d\.setTorch\(true\)/.test(m), 'фонарь не включается автоматически при загрузке 3D');
  const s = read('src/render/scene3d.mjs');
  ok(/setTorch\(on, power = 1\)/.test(s), 'метода setTorch нет');
});

t('камера в голове мальчика и едет вместе с ним', () => {
  const s = read('src/render/scene3d.mjs');
  // Вид только от первого лица — третье лицо отвергнуто.
  ok(!s.includes('camDist'), 'вернулась камера за спиной (camDist)');
  ok(!s.includes('camera.lookAt('), 'камера смотрит на мальчика со стороны');
  // Глаза обязаны следовать за телом: иначе первый кадр из одной точки,
  // а тело уходит — это и есть телепортация.
  const sc = s.slice(s.indexOf('setCharacter('), s.indexOf('setCharacter(') + 900);
  ok(/this\.eye\.set\(lx, this\.eyeBase, lz\)/.test(sc), 'глаза не ставятся по позиции мальчика');
  const rd = s.slice(s.indexOf('render(dt)'));
  ok(/this\.camera\.position\.set\(\s*this\.eye\.x/.test(rd), 'камера не берёт позицию глаз');
});

t('покачивание камеры привязано к пройденным метрам, а не ко времени', () => {
  const s = read('src/render/scene3d.mjs');
  ok(/this\.phase \+= d \//.test(s), 'фаза камеры не идёт по метрам');
  ok(s.includes('bobCycle(this.phase)'), 'покачивание не из походки');
  ok(!/this\.t \* [0-9.]+ \* FP\.bobAmp/.test(s), 'покачивание осталось по времени');
});

t('ночной свет не чёрный', () => {
  const s = read('src/render/scene3d.mjs');
  const m = s.match(/this\.ambient\.intensity = ([\d.]+) \+ t \* ([\d.]+)/);
  ok(m, 'не найдена формула общего света');
  const base = Number(m[1]);
  ok(base >= 1.0, `базовый свет ${base} — снова будет чёрный экран`);
});

t('HUD больше не дублирует кнопки стиков', () => {
  const h = read('src/ui/hud.mjs');
  ok(!h.includes('hud-buttons'), 'в HUD остались старые кнопки');
  ok(!h.includes('data-act="go"'), 'осталась кнопка «идти»');
  ok(h.includes('data-act="menu"'), 'пропало меню');
});

t('все модули, на которые ссылается код, существуют', () => {
  const files = ['src/main.mjs'];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/from\s+'(\.\.?\/[^']+)'/g)) {
      const target = path.join(root, '..', path.dirname(f), m[1]);
      const ok1 = fs.existsSync(target) || fs.existsSync(target + '.mjs');
      ok(ok1, `${f}: не найден модуль ${m[1]}`);
    }
  }
});

t('сборка знает про стики и тесты камеры', () => {
  const b = read('tools/build.mjs');
  ok(b.includes('src/ui/sticks.mjs'), 'стики не попадут в сборку');
  ok(b.includes('src/core/joystick.mjs'), 'логика стика не попадёт в сборку');
});

t('service worker кэширует стики', () => {
  const sw = read('sw.js');
  ok(sw.includes('sticks'), 'sw.js не кэширует стики');
  ok(sw.includes('joystick'), 'sw.js не кэширует джойстик');
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
