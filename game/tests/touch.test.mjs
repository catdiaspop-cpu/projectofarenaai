// Касания: что нажимается, а что нет.
//
// Отдельный набор, потому что «не могу управлять» — самая дорогая ошибка.
// Здесь проверяется, что слои не перекрывают друг друга: свайп камеры не
// съедает кнопки, HUD не съедает свайп, стик не съедает свайп целиком.

import { readFileSync } from 'node:fs';
import { BUTTONS, SWIPE } from '../src/ui/sticks.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/** Правило CSS по селектору (последнее вхождение в файле). */
function rule(sel) {
  // правила в файле могут занимать несколько строк: сначала склеиваем
  // пробелы, потом ищем по нормализованному тексту
  const flat = css.replace(/\s+/g, ' ');
  const key = sel.replace(/\s+/g, ' ');
  const re = new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'g');
  let m, last = null;
  while ((m = re.exec(flat))) last = m[1];
  return last ?? '';
}

t('столбик кнопок не перекрыт зоной свайпа', () => {
  // зона свайпа и стик живут в одном правиле — у обоих должен быть autopointer
  const zone = rule('.stick-zone, .look-zone') || rule('.look-zone');
  ok(zone.includes('pointer-events: auto'), 'зона свайпа не ловит касания');
  ok(/z-index:\s*4/.test(css), 'у кнопок нет z-index выше зоны свайпа');
});

t('кнопки не занимают пол-экрана', () => {
  const r = rule('.act');
  const w = /width:\s*(\d+)px/.exec(rule('.action-buttons'));
  ok(w && Number(w[1]) <= 80, `столбик шириной ${w?.[1]} px — слишком широкий`);
  const h = /min-height:\s*(\d+)px/.exec(r);
  ok(h && Number(h[1]) <= 48, `кнопка высотой ${h?.[1]} px — крупнее пальца не нужно`);
  // всего пять кнопок и один «главный» — как задумано
  ok(BUTTONS.length === 5, `кнопок ${BUTTONS.length}, а договаривались о 5`);
  ok(BUTTONS.filter((b) => b.main).length === 1, 'главная кнопка не одна');
});

t('кнопки появляются на касании и уходят сами', () => {
  ok(/\.action-buttons\s*\{[^}]*opacity:\s*0/s.test(css), 'кнопки видны всё время');
  ok(css.includes('.action-buttons.visible'), 'нет состояния «показаны»');
  ok(css.includes('.action-buttons:not(.visible) { pointer-events: none; }'),
    'скрытые кнопки продолжают ловить касания');
});

t('стик занимает меньше половины ширины экрана', () => {
  const r = rule('.stick-zone');
  const w = /width:\s*(\d+)%/.exec(r);
  ok(w && Number(w[1]) <= 50, `зона стика ${w?.[1]}% ширины — свайп некуда положить`);
  ok(rule('.look-zone').includes('width: 100%'), 'свайп не по всему экрану');
  // стик выше свайпа по слоям, иначе кружок не поймать
  ok(/\.stick\s*\{\s*z-index:\s*5/.test(css), 'стик не выше зоны свайпа');
});

t('HUD не закрывает экран от свайпа', () => {
  ok(/\.hud-top, \.hud-room, \.hud-bottom, \.hud-toast \{ pointer-events: none; \}/.test(css),
    'пустой HUD ловит касания — половина экрана мёртвая');
  ok(!/\.hud > \* \{ pointer-events: auto; \}/.test(css), 'вернулось «весь HUD ловит касания»');
});

t('тап = «слушать», свайп = камера, и они не путаются', () => {
  ok(SWIPE.tapMaxDist <= 12, `тап засчитывается после ${SWIPE.tapMaxDist} px сдвига`);
  ok(SWIPE.tapMaxMs <= 260, `тап засчитывается за ${SWIPE.tapMaxMs} мс`);
  ok(SWIPE.maxPerMove <= 0.3, 'резкий рывок повернёт камеру на пол-оборота');
  ok(SWIPE.sensitivity > 0.002 && SWIPE.sensitivity < 0.008,
    `чувствительность ${SWIPE.sensitivity} — либо не повернуть, либо не удержать`);
});

t('кнопка «действие» подсвечивается только когда рядом что-то есть', () => {
  ok(css.includes('.act-main.near-door'), 'нет подсветки у двери');
  ok(css.includes('.act-main.ready'), 'нет подсветки у предмета');
  ok(css.includes('@keyframes hint-breathe'), 'подсказка не дышит — её не замечают');
});

t('свайп камеры не ограничен узкой полосой', () => {
  const r = rule('.look-zone');
  const h = /height:\s*(\d+)%/.exec(r) ?? /height:\s*(\d+)%/.exec(rule('.stick-zone,\n.look-zone'));
  ok(h && Number(h[1]) >= 50, `зона свайпа высотой ${h?.[1]}% — палец не достанет`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
