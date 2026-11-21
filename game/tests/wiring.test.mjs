// Связи между модулями.
//
// В браузере ошибка импорта — это не «одна кнопка не работает», а пустой
// экран без единого сообщения: модуль не загрузился, и всё. Поэтому здесь
// проверяется статически, что каждый импорт существует и что каждое имя,
// которое тянут из модуля, этот модуль действительно отдаёт.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const files = walk(join(ROOT, 'src'));

/** Все статические импорты файла: [{ spec, names }] */
function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  const re = /import\s+([^'";]+?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const clause = m[1].trim();
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const named = [];
    const braces = /\{([^}]*)\}/.exec(clause);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const n = part.trim().split(/\s+as\s+/)[0].trim();
        if (n) named.push(n);
      }
    }
    out.push({ spec, named, clause, file });
  }
  return out;
}

/** Что модуль реально экспортирует (по исходнику). */
function exportsOf(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  const re = /export\s+(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  const list = /export\s*\{([^}]*)\}/g;
  while ((m = list.exec(src))) {
    for (const p of m[1].split(',')) {
      const n = p.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  if (/export\s+default/.test(src)) names.add('default');
  return names;
}

const expCache = new Map();
const expo = (f) => {
  if (!expCache.has(f)) expCache.set(f, exportsOf(f));
  return expCache.get(f);
};

t('все относительные импорты указывают на существующие файлы', () => {
  const bad = [];
  for (const f of files) {
    for (const im of importsOf(f)) {
      const target = resolve(dirname(f), im.spec);
      if (!existsSync(target)) bad.push(`${f.replace(ROOT + '/', '')} → ${im.spec}`);
    }
  }
  ok(bad.length === 0, 'нет таких файлов:\n      ' + bad.join('\n      '));
});

t('все импортируемые имена действительно экспортируются', () => {
  const bad = [];
  for (const f of files) {
    for (const im of importsOf(f)) {
      const target = resolve(dirname(f), im.spec);
      if (!existsSync(target)) continue;
      const ex = expo(target);
      for (const n of im.named) {
        if (!ex.has(n)) bad.push(`${f.replace(ROOT + '/', '')}: «${n}» нет в ${im.spec}`);
      }
    }
  }
  ok(bad.length === 0, 'битые импорты:\n      ' + bad.join('\n      '));
});

t('все модули игры входят в сборку', () => {
  const build = readFileSync(join(ROOT, 'tools/build.mjs'), 'utf8');
  const listed = new Set([...build.matchAll(/'((?:src|vendor)\/[^']+\.(?:mjs|js|css|html|json|webmanifest|svg))'/g)].map((m) => m[1]));
  const missing = [];
  for (const f of files) {
    const rel = f.replace(ROOT + '/', '');
    if (!listed.has(rel)) missing.push(rel);
  }
  ok(missing.length === 0, 'не попадут в dist:\n      ' + missing.join('\n      '));
});

t('index.html ссылается на вход, а вход на стили и разметку', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  ok(/src\/main\.mjs/.test(html), 'index.html не грузит src/main.mjs');
  ok(/styles\.css/.test(html), 'index.html не грузит стили');
  // элементы, без которых main.mjs упадёт на первой строке
  for (const id of ['app', 'scene', 'map', 'hud', 'boot', 'controls']) {
    ok(new RegExp(`id=["']${id}["']`).test(html), `в разметке нет #${id}`);
  }
});

t('main.mjs не тянет то, чего нет в модулях управления', () => {
  const src = readFileSync(join(ROOT, 'src/main.mjs'), 'utf8');
  // после переделки управления этих сущностей быть не должно
  for (const gone of ['GestureParser', 'planWalk', 'sticks.sprint', 'sticks.look']) {
    ok(!src.includes(gone), `осталось обращение к ${gone}`);
  }
});

t('нет двух наборов с одинаковыми проверками-пустышками', () => {
  // ловим t('...', () => {}) — пустой тест, который всегда зелёный
  const bad = [];
  for (const f of files.concat(walk(join(ROOT, 'tests')))) {
    const src = readFileSync(f, 'utf8');
    // собираем шаблон по частям, иначе он найдёт сам себя в этом файле
    const re = /^\s*t\(\s*['"][^'"]+['"]\s*,\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)\s*;?\s*$/gm;
    if (re.test(src)) bad.push(f.replace(ROOT + '/', ''));
  }
  ok(bad.length === 0, 'пустые тесты: ' + bad.join(', '));
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
