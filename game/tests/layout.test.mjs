// Вёрстка стиков и HUD без браузера: разбираем HTML и CSS текстом.
//
// Зачем: в песочнице нет ни Playwright, ни Chromium, а ошибки вёрстки —
// самые дорогие. Уже поймано два: кружок стика внутри зоны (координаты
// считались от половины экрана) и .controls, перекрывавший HUD.

import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
process.chdir(path.join(here, '..'));

const sticks = fs.readFileSync('src/ui/sticks.mjs', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  ✗ ' + m); } else pass++; };

// 1. визуальный стик НЕ внутри зоны захвата
ok(!/stick-zone-left" data-zone="move">\s*<div class="stick"/.test(sticks),
  'кружок всё ещё внутри зоны — координаты будут считаться от половины экрана');
ok(/class="stick stick-move"/.test(sticks), 'нет класса stick-move');
// правого стика больше нет: камера — свайпом
ok(!/stick-look/.test(sticks), 'правый стик остался, хотя камера теперь свайпом');
ok(/data-zone="look"/.test(sticks), 'нет зоны свайпа для камеры');
ok(/look-zone/.test(css), 'нет стиля зоны свайпа');

// 2. слой управления не перехватывает весь экран
ok(/\.controls \{[^}]*pointer-events: none/.test(css), '.controls перехватывает касания');
ok(!/\.controls\.ready \{[^}]*pointer-events: auto/.test(css), '.ready снова включает перехват всего экрана');
ok(/\.stick-zone,\s*\n?\.look-zone \{[^}]*pointer-events: auto/.test(css) || /\.stick-zone \{[^}]*pointer-events: auto/.test(css),
  'зоны стиков не ловят касания');

// 3. есть стили для всех элементов, которые создаёт код
const needed = ['.stick-zone', '.look-zone', '.stick', '.stick-base', '.stick-knob',
  '.action-buttons', '.action-buttons.visible', '.act', '.act.on', '.act-main',
  '.act-main.near-door', '.act-main.ready', '.stick-move'];
for (const sel of needed) {
  ok(css.includes(sel), `нет стиля для ${sel}`);
}

// 4. кнопки создаются ровно те, которые ждёт main.mjs.
// «бежать» убрана: бег — это полный наклон стика, отдельная кнопка только
// путала. «слушать» осталось в списке как кнопка и как тап по правой стороне.
// список кнопок задан массивом BUTTONS, а data-act подставляется шаблоном —
// поэтому проверяем массив, а не строку в разметке
const buttonList = sticks.match(/const BUTTONS = \[([\s\S]*?)\];/);
ok(buttonList, 'нет списка кнопок BUTTONS');
for (const act of ['torch', 'crouch', 'listen', 'use', 'map']) {
  ok(buttonList[1].includes(`act: '${act}'`), `нет кнопки ${act}`);
}
ok(!/act: 'sprint'/.test(sticks), 'кнопка «бежать» осталась, хотя бег теперь по наклону стика');

// 4b. кнопки появляются по касанию и уходят сами
ok(/\.action-buttons \{[^}]*opacity: 0/.test(css), 'кнопки видны всегда, а должны появляться');
ok(/\.action-buttons\.visible/.test(css), 'нет состояния «кнопки показаны»');
ok(/idleTimer|wake\(\)/.test(sticks), 'нет таймера, который прячет кнопки');
ok(/\.action-buttons:not\(\.visible\) \{ pointer-events: none/.test(css),
  'скрытые кнопки всё ещё ловят касания и мешают свайпу');

// 5. касания: pointerdown на зоне, не на весь документ
ok(/zone\.addEventListener\('pointerdown'/.test(sticks), 'стик не слушает pointerdown на зоне');
ok(/pointercapture|setPointerCapture/.test(sticks), 'нет захвата указателя — стик потеряется');
ok(/touch-action: none/.test(css), 'нет touch-action: none — браузер будет скроллить');

// 6. в разметке есть оба canvas и точка входа
ok(html.includes('id="scene"') && html.includes('id="map"'), 'нет canvas сцены или карты');
ok(html.includes('id="hud"'), 'нет HUD');
ok(html.includes('id="boot"'), 'нет заставки');

// 8. заставка не висит поверх игры после старта
ok(/\.boot\.hidden/.test(css), 'заставка не скрывается классом hidden');

console.log(fail ? `\n✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}` : `\n✓ все проверки пройдены: ${pass}`);
process.exit(fail ? 1 : 0);
