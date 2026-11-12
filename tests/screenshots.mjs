import { JSDOM } from 'jsdom';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const dom = new JSDOM(`<!DOCTYPE html><div id="app"></div>`, { url: 'http://localhost/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
// открываем все комнаты для скриншотов
dom.window.localStorage.setItem('metabolism.progress', JSON.stringify({ solved: [1,2,3,4,5,6,7], moves: {} }));

await import('../src/ui.js');
fs.mkdirSync('preview', { recursive: true });

for (let i = 0; i < 8; i += 1) {
  document.querySelectorAll('.roomdot')[i].click();
  const svg = document.querySelector('svg.stage');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const png = new Resvg(svg.outerHTML, { fitTo: { mode: 'width', value: 1100 }, background: '#14100e' }).render().asPng();
  fs.writeFileSync(`preview/room-${i + 1}.png`, png);
  const status = [...document.querySelectorAll('#statusList li')]
    .map(li => (li.classList.contains('ok') ? '✓' : '·') + li.textContent.trim()).join('  ');
  console.log(`room ${i + 1}: ${status}`);
}
