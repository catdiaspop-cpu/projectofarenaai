// Сборка: копируем в dist/ только то, что нужно браузеру, и считаем бюджеты.
// Без бандлера: ES-модули браузер тянет сам, three.js уже минифицирован.
//
// Заодно кладём старую игру в dist/old/ — она остаётся доступной,
// но главной страницей становится «НЕ СПИ».

import fs from 'node:fs';
import crypto from 'node:crypto';
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
  'src/core/app.mjs', 'src/core/input.mjs', 'src/core/joystick.mjs', 'src/core/movement.mjs',
  'src/data/house.mjs', 'src/data/layout.mjs', 'src/data/palette.mjs', 'src/data/rooms.mjs',
  'src/world/props.mjs', 'src/world/character.mjs', 'src/world/builder.mjs', 'src/world/gait.mjs',
  'src/sim/graph.mjs', 'src/sim/locks.mjs', 'src/sim/doors.mjs',
  'src/render/mesher.mjs', 'src/render/character.mjs', 'src/render/builders.mjs',
  'src/render/scene3d.mjs', 'src/render/house-preview.mjs', 'src/render/viewmodel.mjs',
  'src/ui/hud.mjs', 'src/ui/sticks.mjs',
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

// Имя кэша = хэш содержимого. Иначе телефон с cache-first отдаёт старую
// версию после каждого деплоя, и правки «не доезжают».
// sw.js из хэша исключён: мы его же и правим, иначе хэш никогда не сойдётся.
const hash = crypto.createHash('sha256');
for (const f of FILES.filter((x) => x !== 'sw.js').sort()) {
  hash.update(f).update(fs.readFileSync(path.join(dist, f)));
}
const version = hash.digest('hex').slice(0, 10);
sw = sw.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = '${version}';`);
fs.writeFileSync(swPath, sw);
console.log(`  версия кэша: ${version}`);

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
// Бюджеты.
// Своё подняли со 90 до 105 КБ: добавились двери со створками, вид от первого
// лица, походка по метрам, модель мальчика с суставами и защита кадра от
// падений (не потерять управление дороже, чем 3 КБ кода). Это осознанный
// рост, а не расползание: three.js один занимает 187 КБ и не растёт.
// Общий подняли с 260 до 300 КБ по той же причине — до потолка ещё есть
// запас, и следующий шаг (второй свет на комнату) в него влезает.
// Отделка стен (филёнки, поясок, карниз, бордюр) — это ещё ~3 КБ, поэтому
// свой код 112 КБ. Переход без телепорта (сцена в мировых координатах,
// точка входа = точка шага) — ещё ~3 КБ, итого 115.
// Игра по-прежнему стартует офлайн с одного запроса.
// Бюджет первоначальной загрузки. 304 KB — 300 плюс 4 на мебель в «просвете»
// (настоящая комната за открытой дверью вместо пустой коробки).
// 118 KB своего кода — 115 плюс 3 на честную диагностику WebGL: раньше
// «телефон не тянет 3D» была одна фраза на два разных случая, и по ней
// нельзя было понять, виноват телефон или наш код.
const LIMIT_TOTAL = 304 * 1024;
const LIMIT_OWN = 118 * 1024;
let bad = false;
if (gz > LIMIT_TOTAL) { console.error(`✗ превышен бюджет: ${(gz / 1024).toFixed(0)} KB > ${LIMIT_TOTAL / 1024} KB`); bad = true; }
if (noThree > LIMIT_OWN) { console.error(`✗ свой код толстый: ${(noThree / 1024).toFixed(1)} KB > ${LIMIT_OWN / 1024} KB`); bad = true; }
if (bad) process.exit(1);
console.log('✓ бюджеты в норме');
