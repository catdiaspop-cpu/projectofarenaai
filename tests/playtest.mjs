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
console.log('  текст:', document.querySelector('.solvedtext')?.textContent);
console.log('  условия:', [...document.querySelectorAll('.pips i')].map(i => i.classList.contains('on') ? '✓' : '·').join(''));
console.log('  прогресс в localStorage:', localStorage.getItem('metabolism.progress'));

// «Дальше»
click('#nextBtn');
console.log('\nперешли на комнату:', document.querySelector('.goal-law').textContent);

// КОМНАТА 2: вес пробки -> ключу, вес пера -> поплавку
click('.chan[data-channel="mass"]');
click('.obj[data-id="cork"]');
click('.obj[data-id="key"]');
console.log('после первого обмена, условия:', [...document.querySelectorAll('.pips i')].map(i => i.classList.contains('on') ? '✓' : '·').join(''));
click('.obj[data-id="feather"]');
click('.obj[data-id="float"]');
console.log('решена:', !!document.querySelector('.solvedcard'));

// отмена хода
click('#undoBtn');
console.log('после отмены решена:', !!document.querySelector('.solvedcard'), '| условия:', [...document.querySelectorAll('.pips i')].map(i => i.classList.contains('on') ? '✓' : '·').join(''));

// ошибка: обменять одно и то же свойство
click('.chan[data-channel="mass"]');
click('.obj[data-id="anchor"]');
click('.obj[data-id="feather"]');
console.log('обмен с якорем прошёл, всплывающая строка:', document.querySelector('#toast')?.textContent || '(нет)');

// лист комнаты и подсказка
click('#infoBtn');
console.log('лист комнаты открыт:', !!document.querySelector('.sheet'));
click('#hintBtn');
console.log('подсказка открыта:', !!document.querySelector('.hinttext'));

// помощь
click('#helpBtn');
console.log('модалка помощи:', !!document.querySelector('.modal'));

// ── сценарий «только каналы и полоса предметов» (как на телефоне) ──
document.querySelectorAll('.roomdot')[0].click();
click('.chan[data-channel="heat"]');
console.log('\n[полоса] канал включён:', document.querySelector('.chan[data-channel="heat"]').classList.contains('is-on'));
console.log('[полоса] предметов:', document.querySelectorAll('.chip').length);
click('.chip[data-id="candle"]');
console.log('[полоса] выбран предмет:', document.querySelector('.chip.is-selected')?.textContent.trim());
click('.chip[data-id="rope"]');
console.log('[полоса] решено тапами:', !!document.querySelector('.solvedcard'));
