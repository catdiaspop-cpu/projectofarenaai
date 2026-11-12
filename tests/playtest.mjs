import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><div id="app"></div>`, { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

await import('../src/ui.js');

const click = (sel) => { const el = document.querySelector(sel); if (!el) throw new Error('нет элемента ' + sel); el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); };

// КОМНАТА 1: тепло со свечи на верёвку
click('.chan[data-channel="heat"]');
click('.obj[data-id="candle"]');
click('.obj[data-id="rope"]');
console.log('после решения комнаты 1:');
console.log('  решено:', !!document.querySelector('.solvedcard'));
console.log('  текст:', document.querySelector('.solvedcard h3')?.textContent);
console.log('  условия:', [...document.querySelectorAll('#statusList li')].map(li => (li.classList.contains('ok') ? '✓' : '·') + li.textContent.trim()).join(' '));
console.log('  прогресс в localStorage:', localStorage.getItem('metabolism.progress'));

// «Дальше»
click('#nextBtn');
console.log('\nперешли на комнату:', document.querySelector('.brief h2').textContent);

// КОМНАТА 2: вес пробки -> ключу, вес пера -> поплавку
click('.chan[data-channel="mass"]');
click('.obj[data-id="cork"]');
click('.obj[data-id="key"]');
console.log('после первого обмена, условия:', [...document.querySelectorAll('#statusList li')].map(li => (li.classList.contains('ok') ? '✓' : '·') + li.textContent.trim()).join(' '));
click('.obj[data-id="feather"]');
click('.obj[data-id="float"]');
console.log('решена:', !!document.querySelector('.solvedcard'));

// отмена хода
click('#undoBtn');
console.log('после отмены решена:', !!document.querySelector('.solvedcard'), '| ходов в истории осталось:', document.querySelectorAll('#statusList li').length && 'ок');

// ошибка: обменять одно и то же свойство
click('.chan[data-channel="mass"]');
click('.obj[data-id="anchor"]');
click('.obj[data-id="feather"]');
console.log('обмен с якорем прошёл, подсказка:', document.querySelector('#exchange')?.textContent || '(нет)');

// подсказка
click('#hintBtn');
console.log('подсказка открыта:', !!document.querySelector('.hintbox'));

// помощь
click('#helpBtn');
console.log('модалка помощи:', !!document.querySelector('.modal'));

// ── мобильный сценарий: только док каналов и полоса предметов ──
document.querySelectorAll('.roomdot')[0].click();
click('.dockchan[data-channel="heat"]');
console.log('\n[мобильный] канал включён:', document.querySelector('.dockchan[data-channel="heat"]').classList.contains('is-on'));
console.log('[мобильный] подсказка:', document.querySelector('.striphead').textContent);
click('.chip[data-id="candle"]');
console.log('[мобильный] после выбора:', document.querySelector('.striphead').textContent);
click('.chip[data-id="rope"]');
console.log('[мобильный] решено тапами:', !!document.querySelector('.solvedcard'));
