// Дом должен быть проходим. Это проверяется графом, а не глазами.
//
// Уже поймано: четыре двери были заперты проверкой, которую нечем пройти —
// бот застревал в коридоре, а игрок не понимал, что делать.

import { canOpen, doorsOf, otherSide, LOCKS } from '../src/sim/locks.mjs';
import { DOORS, ROOMS } from '../src/data/house.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

/** Обход дома от детской при заданном контексте. */
function reachable(ctx, from = 'childroom') {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const r = q.shift();
    for (const d of doorsOf(r)) {
      if (!canOpen(d, ctx).open) continue;
      const n = otherSide(d, r);
      if (n && !seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return seen;
}

const ALL = ROOMS.filter((r) => r.kind !== 'yard').map((r) => r.id);

t('все запертые двери имеют правило', () => {
  for (const d of DOORS) {
    if (!d.lock) continue;
    ok(LOCKS[d.id], `дверь ${d.id} заперта, но правила для неё нет — тупик`);
  }
});

t('у каждой запертой двери есть внятная причина', () => {
  for (const [id, rule] of Object.entries(LOCKS)) {
    ok(rule.hint && rule.hint.length > 5, `${id}: нет объяснения, почему закрыто`);
    ok(rule.open && rule.open.length > 3, `${id}: нет текста, когда открылось`);
  }
});

t('в начале игры можно попасть в 9 комнат из 11', () => {
  const r = reachable({ torch: false, lightOn: { 'child-nightlight': true }, visited: new Set(['childroom']) });
  ok(r.size >= 9, `доступно ${r.size} комнат: ${[...r].join(', ')}`);
  ok(r.has('kitchen') && r.has('bath') && r.has('parents') && r.has('hall'),
    'не дойти до кухни/ванной/родительской/прихожей');
});

t('с фонарём и кухней открывается ВЕСЬ дом', () => {
  const r = reachable({
    torch: true,
    lightOn: { 'child-nightlight': true },
    visited: new Set(['childroom', 'kitchen']),
  });
  const missing = ALL.filter((x) => !r.has(x));
  ok(missing.length === 0, `недостижимо: ${missing.join(', ')}`);
});

t('выход на улицу закрыт навсегда — и это объяснено', () => {
  const door = DOORS.find((d) => d.id === 'hall-yard');
  ok(door, 'нет входной двери');
  const r = canOpen(door, { torch: true, lightOn: { a: true }, visited: new Set(['kitchen']) });
  ok(!r.open, 'можно выйти на улицу');
  ok(/мама/i.test(r.reason), 'нет объяснения про маму');
});

t('фонарь действительно нужен: без него чердак закрыт', () => {
  const attic = DOORS.find((d) => d.a === 'corridor' && d.b === 'attic');
  ok(attic, 'нет двери на чердак');
  ok(!canOpen(attic, { torch: false }).open, 'чердак открыт без фонаря');
  ok(canOpen(attic, { torch: true }).open, 'чердак не открывается даже с фонарём');
});

t('свет в комнате открывает подвал (не только фонарь)', () => {
  const b = DOORS.find((d) => d.id === 'hall-basement');
  ok(!canOpen(b, { lightOn: {} }).open, 'подвал открыт в темноте');
  ok(canOpen(b, { lightOn: { 'hall-lamp': true } }).open, 'подвал не открывается со светом');
});

t('каждая комната достижима хоть чем-то', () => {
  const r = reachable({ torch: true, lightOn: { x: true }, visited: new Set(['kitchen']) });
  for (const id of ALL) ok(r.has(id), `${id} недостижима ни при каких условиях`);
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
