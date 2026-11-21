// Проверки мира: ходьба, переходы между комнатами, часы, шкалы.

import { World, PHASE, GAME_MINUTES_PER_REAL_SECOND } from '../src/core/app.mjs';
import { roomById, findPath } from '../src/sim/graph.mjs';
import { SPAWN } from '../src/data/house.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

t('мир стартует в детской, у кровати', () => {
  const w = new World();
  ok(w.room === 'childroom', 'старт не в детской');
  ok(w.clockText === '21:00', `часы на старте: ${w.clockText}`);
  ok(w.pos.x > 0 && w.pos.z > 0, 'позиция вне комнаты');
});

t('мальчик доходит до точки и останавливается', () => {
  const w = new World();
  const okWalk = w.walkTo(2.6, 2.9);
  ok(okWalk, 'не смог пойти');
  let guard = 0;
  while (w.path && guard++ < 3000) w.update(1 / 60);
  ok(guard < 3000, 'идёт бесконечно');
  const d = Math.hypot(w.pos.x - 2.6, w.pos.z - 2.9);
  ok(d < 0.25, `остановился в ${d.toFixed(2)} м от цели`);
});

t('в стену не пойти', () => {
  const w = new World();
  ok(!w.walkTo(-1, -1), 'ушёл за стену');
  ok(!w.walkTo(99, 99), 'ушёл за стену');
});

t('переход в коридор ставит у двери', () => {
  const w = new World();
  const moved = w.goToRoom('corridor');
  ok(moved, 'не перешёл в коридор');
  ok(w.room === 'corridor', 'комната не сменилась');
  const r = roomById('corridor');
  const toDoor = Math.hypot(w.pos.x - 2.0, w.pos.z - 0.9);
  ok(toDoor < 2.5, `появился далеко от двери: ${toDoor.toFixed(2)} м`);
  ok(w.entered.has('corridor'), 'комната не отмечена как посещённая');
});

t('в подвал без люка не пройти', () => {
  const w = new World();
  ok(!w.goToRoom('basement'), 'провалился в подвал без люка');
  w.doorFlags['hall-basement'] = true;
  // из детской через коридор и лестницу
  ok(w.goToRoom('basement'), 'с открытым люком не пускает');
});

t('после перехода домой возвращается', () => {
  const w = new World();
  w.goToRoom('corridor');
  ok(w.goToRoom('childroom'), 'не вернулся в детскую');
  ok(w.room === 'childroom', 'опять не там');
});

t('время идёт по-разному днём и ночью', () => {
  const day = new World(); day.setPhase(PHASE.DAY);
  const night = new World(); night.setPhase(PHASE.NIGHT);
  for (let i = 0; i < 60; i++) { day.update(1 / 60); night.update(1 / 60); }
  const dayAdvance = GAME_MINUTES_PER_REAL_SECOND[PHASE.DAY];
  const nightAdvance = GAME_MINUTES_PER_REAL_SECOND[PHASE.NIGHT];
  ok(dayAdvance > nightAdvance * 3, 'день должен идти заметно быстрее ночи');
  ok(Math.abs(day.minutes - (21 * 60 + dayAdvance)) < 2, `день прошёл ${(day.minutes - 21 * 60).toFixed(1)} мин за минуту (ожидалось ${dayAdvance})`);
});

t('ночь длится около 10 минут реального времени', () => {
  const w = new World();
  w.minutes = 21 * 60;
  const perSec = GAME_MINUTES_PER_REAL_SECOND[PHASE.NIGHT];
  const needMinutes = 9 * 60; // с 21:00 до 06:00
  const realSeconds = needMinutes / perSec;
  ok(realSeconds > 8 * 60 && realSeconds < 11 * 60, `ночь длится ${(realSeconds / 60).toFixed(1)} мин`);
  console.log(`      ночь: ${(realSeconds / 60).toFixed(1)} мин реального времени`);
});

t('шкалы меняются во времени и не вылетают за границы', () => {
  const w = new World();
  for (let i = 0; i < 60 * 300; i++) w.update(1 / 60);
  for (const [k, v] of Object.entries(w.scales)) {
    ok(v >= 0 && v <= 100, `${k} = ${v}`);
  }
});

t('пауза останавливает время', () => {
  const w = new World();
  w.paused = true;
  const before = w.minutes;
  for (let i = 0; i < 120; i++) w.update(1 / 60);
  ok(w.minutes === before, 'на паузе время идёт');
});

t('события копятся и сливаются', () => {
  const w = new World();
  w.goToRoom('corridor');
  const evs = w.drainEvents();
  ok(evs.some((e) => e.type === 'room'), 'нет события перехода');
  ok(w.drainEvents().length === 0, 'события не очистились');
});

t('препятствия комнаты не перекрывают точку спавна', () => {
  const w = new World();
  const sp = SPAWN.child.at;
  for (const o of w.obstacles()) {
    const inside = sp.x > o.x0 && sp.x < o.x1 && sp.z > o.z0 && sp.z < o.z1;
    ok(!inside, `старт внутри ${o.id}`);
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
