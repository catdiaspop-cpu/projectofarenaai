// Сборка: копируем в dist/ только то, что нужно браузеру, и считаем бюджеты.
// Без бандлера: ES-модули браузер тянет сам, three.js уже минифицирован.
//
// Заодно кладём старую игру в dist/old/ — она остаётся доступной,
// но главной страницей становится «НЕ СПИ».

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.dirname(new URL(import.meta.url).pathname);
const src = path.join(root, '..');        // game/
const repo = path.join(src, '..');        // корень репозитория
const dist = path.join(src, 'dist');

// ── файлы новой игры
const FILES = [
  'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'sw.js',
  'vendor/three/three.min.js',
  'src/main.mjs',
  'src/core/app.mjs', 'src/core/input.mjs',
  'src/data/house.mjs', 'src/data/layout.mjs', 'src/data/palette.mjs', 'src/data/rooms.mjs',
  'src/world/props.mjs', 'src/world/character.mjs', 'src/world/builder.mjs',
  'src/sim/graph.mjs',
  'src/render/mesher.mjs', 'src/render/character.mjs', 'src/render/builders.mjs',
  'src/render/scene3d.mjs', 'src/render/house-preview.mjs',
  'src/ui/hud.mjs',
];

// ── старая игра: складываем как есть в /old/, не трогая исходники
const OLD_FILES = [
  'index.html', 'styles.css', 'favicon.svg', 'site.webmanifest', 'sw.js',
  'src/engine.js', 'src/rooms.js', 'src/art.js', 'src/ui.js', 'src/main.js',
];

fs.rmSync(dist, { recursive: true, force: true });

const missing = FILES.filter((f) => !fs.existsSync(path.join(src, f)));
if (missing.length) {
  console.error('нет файлов новой игры:', missing.join(', '));
  process.exit(1);
}

let raw = 0, gz = 0;
const big = [];
for (const f of FILES) {
  const from = path.join(src, f);
  const to = path.join(dist, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  const size = fs.statSync(to).size;
  const g = zlib.gzipSync(fs.readFileSync(to), { level: 9 }).length;
  raw += size;
  gz += g;
  big.push({ f, size, g });
}

// ── старая игра в /old/
let oldRaw = 0;
const oldMissing = OLD_FILES.filter((f) => !fs.existsSync(path.join(repo, f)));
if (!oldMissing.length) {
  for (const f of OLD_FILES) {
    const to = path.join(dist, 'old', f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(repo, f), to);
    oldRaw += fs.statSync(to).size;
  }
  // пути внутри старой игры относительные — она работает в подпапке без правок
} else {
  console.warn('старую игру не нашли, пропускаем:', oldMissing.join(', '));
}

// ── service worker должен знать точный список файлов новой игры
const swPath = path.join(dist, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = ${JSON.stringify(FILES.map((f) => './' + f), null, 2)};`);
fs.writeFileSync(swPath, sw);

// ── .nojekyll: иначе Pages может проигнорировать часть путей
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

big.sort((a, b) => b.g - a.g);
console.log('  gzip   файл');
for (const b of big) {
  console.log(`${(b.g / 1024).toFixed(1).padStart(6)}KB  ${b.f}`);
}
const noThree = big.filter((b) => !b.f.includes('vendor')).reduce((s, b) => s + b.g, 0);

console.log('');
console.log(`НЕ СПИ: ${(raw / 1024).toFixed(0)} KB raw, ${(gz / 1024).toFixed(0)} KB gzip`);
console.log(`  свой код + разметка: ${(noThree / 1024).toFixed(1)} KB gzip`);
console.log(`  three.js: ${((gz - noThree) / 1024).toFixed(0)} KB gzip`);
console.log(`старая игра в /old/: ${(oldRaw / 1024).toFixed(0)} KB raw`);

// Бюджеты — как в дизайн-документе. Сборка падает, если вышли.
const LIMIT_TOTAL = 260 * 1024;
const LIMIT_OWN = 90 * 1024;
let bad = false;
if (gz > LIMIT_TOTAL) { console.error(`✗ превышен бюджет: ${(gz / 1024).toFixed(0)} KB > ${LIMIT_TOTAL / 1024} KB`); bad = true; }
if (noThree > LIMIT_OWN) { console.error(`✗ свой код толстый: ${(noThree / 1024).toFixed(1)} KB > ${LIMIT_OWN / 1024} KB`); bad = true; }
if (bad) process.exit(1);
console.log('✓ бюджеты в норме');
