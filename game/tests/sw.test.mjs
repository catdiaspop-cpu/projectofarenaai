// Service worker: главная ловушка — телефон, который после деплоя продолжает
// показывать вчерашнюю версию из кэша. Проверяем именно это.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, '..');
const srcSw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

t('имя кэша содержит версию, а не зашито строкой', () => {
  ok(/const CACHE_VERSION = '/.test(srcSw), 'нет CACHE_VERSION');
  ok(/const CACHE = `nespi-\$\{CACHE_VERSION\}`/.test(srcSw), 'кэш не использует версию');
  ok(!/const CACHE = 'nespi-v1'/.test(srcSw), 'осталось nespi-v1 — телефон не увидит обновление');
});

t('игровой код грузится сначала из сети (иначе правки не видны)', () => {
  ok(/NETWORK_FIRST/.test(srcSw), 'нет network-first для кода');
  ok(/\.\(mjs\|js\|css\|html\|webmanifest\)/.test(srcSw), 'network-first не покрывает .mjs/.css/.html');
  ok(/fetch\(e\.request\)\s*\n?\s*\.then/.test(srcSw), 'нет запроса в сеть в сетевой ветке');
});

t('three.js и иконки берутся из кэша (731 КБ не гоняем зря)', () => {
  ok(/caches\.match\(e\.request\)\.then\(\(hit\) => hit \|\| fetch/.test(srcSw), 'нет cache-first ветки');
  ok(!/NETWORK_FIRST[\s\S]{0,200}min\.js/.test(srcSw), 'three.min.js попал в network-first');
});

t('офлайн всё равно работает: есть запасной index.html', () => {
  const fallbacks = (srcSw.match(/caches\.match\('\.\/index\.html'\)/g) || []).length;
  ok(fallbacks >= 2, 'нет запасного index.html для офлайна в обеих ветках');
});

t('не кэшируются неудачные ответы', () => {
  ok(/res\.ok/g.test(srcSw), 'кэшируется всё подряд, включая 404');
});

t('чужие домены не перехватываются', () => {
  ok(/url\.origin !== self\.location\.origin/.test(srcSw), 'sw перехватывает чужие запросы');
});

t('сборка подставляет настоящий хэш в имя кэша', () => {
  execFileSync('node', ['tools/build.mjs'], { cwd: root, stdio: 'pipe' });
  const distSw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
  const m = distSw.match(/const CACHE_VERSION = '([^']+)'/);
  ok(m, 'в сборке нет версии кэша');
  ok(/^[0-9a-f]{10}$/.test(m[1]), `версия не похожа на хэш: ${m[1]}`);

  // версия обязана зависеть от содержимого: меняем файл — меняется версия
  const files = JSON.parse(distSw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
  const h = crypto.createHash('sha256');
  // sw.js исключён: его версия и есть то, что мы проверяем
  for (const f of [...files].map((x) => x.replace('./', '')).filter((x) => x !== 'sw.js').sort()) {
    h.update(f).update(fs.readFileSync(path.join(root, 'dist', f)));
  }
  ok(h.digest('hex').slice(0, 10) === m[1], 'хэш в sw.js не совпадает с содержимым dist');
});

t('все файлы сборки перечислены в кэше', () => {
  const distSw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
  const files = JSON.parse(distSw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
  for (const need of ['./index.html', './styles.css', './src/main.mjs',
    './src/ui/sticks.mjs', './src/core/joystick.mjs', './src/render/scene3d.mjs']) {
    ok(files.includes(need), `в кэше нет ${need}`);
  }
  // и наоборот: каждый файл из кэша существует в dist
  for (const f of files) {
    const p = path.join(root, 'dist', f.replace('./', ''));
    ok(fs.existsSync(p), `в sw.js указан несуществующий файл: ${f}`);
  }
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
