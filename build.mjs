// Сборка статического сайта: только то, что нужно браузеру.
// Никаких зависимостей и бандлеров — просто копирование.

import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const dist = path.join(root, 'dist');

const files = [
  'index.html',
  'styles.css',
  'favicon.svg',
  'site.webmanifest',
  'sw.js',
  'src/engine.js',
  'src/rooms.js',
  'src/art.js',
  'src/ui.js',
  'src/main.js',
];

fs.rmSync(dist, { recursive: true, force: true });

const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error('Нет файлов для сборки:', missing.join(', '));
  process.exit(1);
}

for (const file of files) {
  const from = path.join(root, file);
  const to = path.join(dist, file);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

// служебный файл, чтобы Pages не пытался обрабатывать каталог через Jekyll
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

const total = files.reduce((sum, f) => sum + fs.statSync(path.join(root, f)).size, 0);
console.log(`dist/ собран: ${files.length} файлов, ${(total / 1024).toFixed(0)} КБ`);
