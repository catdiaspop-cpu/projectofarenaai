// Автопроверка комнат: каждая должна решаться, список решений печатается.
// Запуск: npm test

import { ROOMS } from '../src/rooms.js';
import { createState, swapStats, evaluate, allMoves, stateKey } from '../src/engine.js';

function bfs(room, maxDepth) {
  const start = createState(room);
  const seen = new Set([stateKey(start)]);
  let frontier = [{ state: start, path: [] }];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const next = [];
    for (const node of frontier) {
      for (const mv of allMoves(node.state)) {
        const candidate = swapStats(node.state, mv.a, mv.b, mv.channel);
        const ev = evaluate(candidate, room);
        const path = [...node.path, mv];
        if (ev.solved) return { solvable: true, depth, path };
        const key = stateKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state: candidate, path });
      }
    }
    frontier = next;
    if (!frontier.length) return { solvable: false, depth: Infinity, path: [] };
  }
  return { solvable: false, depth: Infinity, path: [] };
}

function fmt(mv) {
  return `${mv.a}↔${mv.b}(${mv.channel})`;
}

let failures = 0;

for (const room of ROOMS) {
  const result = bfs(room, 6);
  if (!result.solvable) {
    console.error(`✗ Комната ${room.id} «${room.name}» НЕ РЕШАЕТСЯ за 6 ходов`);
    failures += 1;
    continue;
  }
  const status = evaluate(createState(room), room).status
    .map((s) => (s.ok ? '✓' : '·'))
    .join('');
  console.log(
    `✓ Комната ${room.id} «${room.name}» — решение за ${result.depth} ход(а): ` +
      result.path.map(fmt).join(', ') +
      `   условия старта: ${status}`,
  );
}

if (failures) {
  console.error(`\nПровалено комнат: ${failures}`);
  process.exit(1);
}
console.log('\nВсе комнаты проходимы.');
