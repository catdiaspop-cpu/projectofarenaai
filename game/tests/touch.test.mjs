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
const sticks = readFileSync(new URL('../src/ui/sticks.mjs', import.meta.url), 'utf8');

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
  // ширина столбика живёт в переменной --act-w (медиа-запросы меняют только
  // её, а не весь блок), поэтому смотрим и на width, и на переменную
  const widthOf = (text) => {
    const direct = /width:\s*(\d+)px/.exec(text);
    if (direct) return Number(direct[1]);
    const vari = /--act-w:\s*(\d+)px/.exec(text);
    return vari ? Number(vari[1]) : null;
  };
  // последнее правило .controls — из медиа-запроса и несёт только отступы,
  // поэтому если в блоке нет ширины, ищем переменную по всему файлу
  const fromVar = /--act-w:\s*(\d+)px/.exec(css);
  const colW = widthOf(rule('.action-buttons'))
    ?? widthOf(rule('.controls'))
    ?? (fromVar ? Number(fromVar[1]) : null);
  ok(colW !== null && colW <= 80, `столбик шириной ${colW ?? 'неизвестной'} px — слишком широкий`);
  const h = /min-height:\s*(\d+)px/.exec(r);
  ok(h && Number(h[1]) <= 48, `кнопка высотой ${h?.[1]} px — крупнее пальца не нужно`);
  // всего пять кнопок и один «главный» — как задумано
  ok(BUTTONS.length === 5, `кнопок ${BUTTONS.length}, а договаривались о 5`);
  ok(BUTTONS.filter((b) => b.main).length === 1, 'главная кнопка не одна');
});

t('зона стика лежит ПОВЕРХ зоны свайпа', () => {
  // Настоящая причина «джойстик не работает»: .look-zone объявлена шириной
  // 100% и без z-index, а .stick-zone — после неё. Равный z-index → побеждает
  // тот, кто позже в разметке, и зона свайпа съедала все касания в левом низу.
  const look = rule('.look-zone');
  const stick = rule('.stick-zone');
  const zOf = (t) => { const m = /z-index:\s*(\d+)/.exec(t); return m ? Number(m[1]) : 0; };
  ok(zOf(stick) > zOf(look), `стик z=${zOf(stick)}, свайп z=${zOf(look)} — касания уйдут в камеру`);
  // и в разметке зона стика идёт после зоны свайпа
  const src = sticks;
  ok(src.indexOf('data-zone="look"') < src.indexOf('data-zone="move"'),
    'зона стика в разметке раньше зоны свайпа');
});

t('стик встаёт под палец, а не висит в одной точке', () => {
  // «Джойстик не работает» — это ещё и про то, что кружок стоял в фиксированной
  // точке: касание рядом двигало мальчика, а сам кружок не сдвигался.
  ok(/placeStick\s*\(/.test(sticks), 'нет placeStick — стик не встаёт под палец');
  const down = sticks.slice(sticks.indexOf("'pointerdown', (e) => {"));
  ok(down.slice(0, 700).includes('placeStick'), 'на pointerdown стик не переезжает под палец');
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

t('касание сцены ничего не включает само', () => {
  // Было: короткий тап где угодно = «слушать». Игрок промахивался мимо кнопки,
  // касался экрана — и включался режим. Жалоба: «нажимаю куда-то — включается
  // слушать». Никаких скрытых действий от касания сцены быть не должно.
  ok(!/onTap/.test(sticks), 'в Sticks снова есть onTap — касание включает действие');
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

t('стик стоит внизу экрана, а не сверху', () => {
  // Ошибка была такая: у .stick заданы left:0 и top:0, а .stick-move
  // добавляет bottom. В абсолютном позиционировании top сильнее bottom,
  // поэтому стик улетал в ЛЕВЫЙ ВЕРХНИЙ угол — «джойстик сверху».
  const base = rule('.stick');
  ok(/top:\s*0/.test(base), 'у .stick нет top:0 — тогда непонятно, откуда ошибка');
  // правило с bottom может быть в одном блоке, а сброс top — в следующем
  const move = css.split('.stick-move').slice(1).map((x) => x.slice(0, x.indexOf('}'))).join(' ');
  ok(/bottom:\s*\d+%/.test(move), 'стик не прижат к низу');
  ok(/top:\s*auto/.test(move), 'top не сброшен — стик снова уедет наверх');
});

t('весь экран принимает касания: сверху нет мёртвой зоны', () => {
  // Зоны были высотой 62% от низа — верхняя треть экрана не принимала НИЧЕГО.
  // Игрок ведёт пальцем по верхней половине (там, где смотрит), ничего не
  // происходит и он говорит «камера не двигается». Это была не логика, а мёртвая зона.
  const look = rule('.look-zone');
  const h = /height:\s*(\d+)%/.exec(look) ?? /height:\s*(\d+)%/.exec(rule('.stick-zone, .look-zone'));
  ok(h && Number(h[1]) >= 100, `зона свайпа высотой ${h?.[1]}% — верх экрана не работает`);
});

t('стик не отпускается, пока палец прижат', () => {
  // pointerleave обрывал и стик, и свайп: палец уходил за край зоны (а он
  // уходит — ведёшь вверх к центру экрана) и управление пропадало.
  const src = sticks;
  ok(!/addEventListener\('pointerleave',\s*end\)/.test(src),
    'pointerleave снова отпускает управление при живом пальце');
  ok(/window\.addEventListener\('pointerup',\s*end\)/.test(src),
    'отпускание не слушается на уровне окна — палец за краем зоны потеряется');
});

t('кадр не умирает от исключения', () => {
  // Ошибка внутри кадра выбрасывала из requestAnimationFrame навсегда:
  // картинка застывала, и ввод уже ничего не мог. Симптом игрока — ровно
  // «камера не двигается и человек не идёт» одновременно.
  const main = readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8');
  const body = main.slice(main.indexOf('function frame(now)'), main.indexOf('function reportCrash'));
  ok(/try\s*\{/.test(body), 'в кадре нет try — одно исключение убивает цикл');
  ok(/requestAnimationFrame\(frame\)/.test(body), 'кадр не перезапускается');
  ok(/reportCrash/.test(body), 'ошибка не показывается игроку');
});

t('потеря WebGL-контекста не оставляет чёрный экран', () => {
  const scene = readFileSync(new URL('../src/render/scene3d.mjs', import.meta.url), 'utf8');
  ok(scene.includes('webglcontextlost'), 'нет обработки потери контекста');
  ok(/if \(this\.lost\) return/.test(scene), 'потерянный контекст всё равно пытается рисовать');
  const main = readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8');
  ok(main.includes('sceneLost'), 'main не знает о потере контекста — будет чёрный кадр');
});

t('service worker зарегистрирован и знает все модули', () => {
  // sw.js лежал с самого начала, но его никто не регистрировал: офлайна не
  // было вообще, а на телефоне жил вчерашний код.
  const main = readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8');
  ok(/serviceWorker\.register\('\.\/sw\.js'/.test(main), 'service worker не регистрируется');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const mods = [...readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8')
    .matchAll(/from '\.\/([^']+\.mjs)'/g)].map((m) => m[1]);
  const missing = mods.filter((m) => !sw.includes(`'./src/${m}'`));
  ok(missing.length === 0, `в офлайн-кэше нет модулей: ${missing.join(', ')}`);
});

t('свайп вправо уводит взгляд вправо, а не наоборот', () => {
  // Жалоба «двигаю влево — в итоге право». Проверяем не комментарий, а знак:
  // повторяем формулу из Scene3D.rotate и смотрим, куда смотрит камера.
  const scene = readFileSync(new URL('../src/render/scene3d.mjs', import.meta.url), 'utf8');
  const m = /rotate\(deltaYaw[^)]*\)\s*\{([\s\S]*?)\n  \}/.exec(scene);
  ok(m, 'не нашёл rotate() — тест не может проверить знак');
  const body = m[1];
  ok(/this\.yaw\s*=\s*wrapAngle\(this\.yaw\s*-\s*deltaYaw\)/.test(body),
    'yaw прибавляется: свайп вправо уведёт взгляд ВЛЕВО');
  ok(/this\.pitch\s*=\s*clamp\(this\.pitch\s*-\s*deltaPitch/.test(body),
    'наклон инвертирован: палец вниз поднимет взгляд');
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
