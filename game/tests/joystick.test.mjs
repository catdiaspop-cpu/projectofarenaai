// Проверки стика: мёртвая зона, ограничение радиуса, «база едет за пальцем»,
// режимы движения. Всё без браузера.

import { Stick, STICK, moveMode, clampPitch, cameraDelta } from '../src/core/joystick.mjs';

let pass = 0, fail = 0;
const errs = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; errs.push(`${name}\n    ${e.message}`); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, eps, m) => { if (Math.abs(a - b) > eps) throw new Error(`${m}: ${a} vs ${b}`); };

t('стик в покое даёт ноль', () => {
  const s = new Stick();
  ok(!s.active, 'на старте не должен быть активен');
  ok(s.magnitude === 0, 'магнитуда не ноль');
  s.update(1 / 60);
  ok(Math.hypot(s.value.x, s.value.y) < 0.001, 'значение не ноль');
});

t('мёртвая зона молчит', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius * 0.1, 100);
  ok(s.magnitude === 0, `внутри мёртвой зоны магнитуда ${s.magnitude}`);
  ok(s.raw.x === 0, 'вектор не ноль');
});

t('наклон вправо даёт положительный X', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius, 100);
  near(s.raw.x, 1, 0.001, 'полный наклон вправо');
  near(s.raw.y, 0, 0.001, 'Y должен быть 0');
  ok(s.magnitude > 0.99, 'магнитуда не максимум');
});

t('наклон вверх даёт отрицательный Y (экран)', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100, 100 - STICK.maxRadius);
  near(s.raw.y, -1, 0.001, 'вверх = отрицательный Y');
});

t('ручка не выходит за радиус', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 400, 400); // далеко
  const d = Math.hypot(s.knob.x, s.knob.y);
  ok(d <= STICK.maxRadius + 0.001, `ручка на ${d.toFixed(1)} px при радиусе ${STICK.maxRadius}`);
});

t('база едет за пальцем, стик не теряется', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + 200, 100); // ушёл на 200 px
  ok(s.base.x > 100, 'база не сдвинулась');
  const d = Math.hypot(s.knob.x, s.knob.y);
  ok(d <= STICK.maxRadius + 0.001, 'ручка оторвалась от базы');
  ok(s.raw.x > 0.9, 'стик должен остаться наклонённым вправо');
});

t('сглаживание: значение догоняет палец за ~0.2 с', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius, 100);
  ok(Math.abs(s.value.x) < 0.05, 'значение не должно прыгать мгновенно');
  for (let i = 0; i < 12; i++) s.update(1 / 60);
  ok(s.value.x > 0.9, `через 0.2 с только ${s.value.x.toFixed(2)}`);
});

t('отпускание возвращает стик в ноль', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius, 100);
  for (let i = 0; i < 12; i++) s.update(1 / 60);
  s.up(1);
  for (let i = 0; i < 30; i++) s.update(1 / 60);
  ok(Math.hypot(s.value.x, s.value.y) < 0.02, 'стик не вернулся в ноль');
});

t('сильный наклон включает бег, слабый — нет', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius, 100);
  ok(s.sprinting, 'полный наклон должен давать бег');
  s.move(1, 100 + STICK.maxRadius * 0.6, 100);
  ok(!s.sprinting, 'средний наклон не должен давать бег');
});

t('скорость растёт с наклоном', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius * 0.3, 100);
  for (let i = 0; i < 20; i++) s.update(1 / 60);
  const slow = s.speedFor(0.95, 1.75);
  s.move(1, 100 + STICK.maxRadius * 0.7, 100);
  for (let i = 0; i < 20; i++) s.update(1 / 60);
  const fast = s.speedFor(0.95, 1.75);
  ok(fast > slow, `скорость не растёт: ${slow.toFixed(2)} → ${fast.toFixed(2)}`);
  ok(fast < 1.75, 'без полного наклона не должно быть максимума бега');
});

t('режимы движения: присед важнее наклона', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius, 100);
  for (let i = 0; i < 20; i++) s.update(1 / 60);
  ok(moveMode(s, { crouching: true }).state === 'sneak', 'присед не победил бег');
  ok(moveMode(s, { forceSprint: true }).state === 'run', 'кнопка бега не работает');
  ok(moveMode(s, {}).state === 'run', 'сильный наклон не даёт бег');
});

t('стоя стик даёт idle, а не ходьбу', () => {
  const s = new Stick();
  ok(moveMode(s, {}).state === 'idle', 'в покое не idle');
});

t('наклон камеры ограничен сверху и снизу', () => {
  ok(clampPitch(-10) === -0.55, 'верх не ограничен');
  ok(clampPitch(10) === 0.45, 'низ не ограничен');
  ok(Math.abs(clampPitch(0.1) - 0.1) < 1e-9, 'в середине не трогаем');
});

t('камера не дёргается: дельта пропорциональна времени', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  s.move(1, 100 + STICK.maxRadius, 100);
  for (let i = 0; i < 20; i++) s.update(1 / 60);
  const fast = cameraDelta(s, 1 / 30);
  const slow = cameraDelta(s, 1 / 120);
  ok(Math.abs(fast.yaw) > Math.abs(slow.yaw), 'больший шаг времени должен давать большую дельту');
  ok(Math.abs(fast.yaw) < 0.5, `рывок камеры: ${fast.yaw.toFixed(2)} рад за кадр`);
});

t('два стика не мешают друг другу', () => {
  const move = new Stick();
  const look = new Stick();
  move.down(1, 100, 500);
  look.down(2, 300, 500);
  move.move(1, 100 + STICK.maxRadius, 500);
  look.move(2, 300, 500 - STICK.maxRadius);
  near(move.raw.x, 1, 0.001, 'стик движения');
  near(look.raw.y, -1, 0.001, 'стик камеры');
  // отпустили только один
  look.up(2);
  ok(move.active, 'второй стик не должен отключаться');
  ok(!look.active, 'первый должен отключиться');
});

t('чужой палец не управляет стиком', () => {
  const s = new Stick();
  s.down(1, 100, 100);
  ok(!s.move(2, 200, 200), 'второй палец не должен управлять');
  ok(s.raw.x === 0, 'значение изменилось от чужого пальца');
});

console.log('');
if (fail) {
  console.log(`✗ ПРОВАЛЕНО: ${fail}, пройдено: ${pass}\n`);
  for (const e of errs) console.log('  ✗ ' + e);
  process.exit(1);
} else {
  console.log(`✓ все проверки пройдены: ${pass}`);
}
