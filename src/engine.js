// Ядро «Обмена веществ».
// Чистая логика без DOM: состояния, обмены, оценка правил комнаты.
// Работает и в браузере, и в Node (для автотестов проходимости).

export const CHANNELS = ['mass', 'heat', 'moisture', 'give'];

export const CHANNEL = {
  mass: {
    key: 'mass',
    label: 'вес',
    gen: 'веса',
    color: '#9a8cf0',
    hint: 'Тяжёлое тонет и давит. Лёгкое держится на воде и на воздухе.',
  },
  heat: {
    key: 'heat',
    label: 'тепло',
    gen: 'тепла',
    color: '#e0793c',
    hint: 'Горячее плавит, зажигает и греет. Холодное трескается и не слушается.',
  },
  moisture: {
    key: 'moisture',
    label: 'влага',
    gen: 'влаги',
    color: '#3f95c9',
    hint: 'Мокрое не горит и не держит. Сухое вспыхивает и хрупнет.',
  },
  give: {
    key: 'give',
    label: 'упругость',
    gen: 'упругости',
    color: '#8fa855',
    hint: 'Податливое провисает и гнётся. Жёсткое держит форму и вес.',
  },
};

export const OBJECT_ALIASES = {
  // слова, которыми игрок называет предметы в подсказках
};

/** Глубокий клон состояния: история отмены работает на снимках. */
export function clone(state) {
  return structuredClone(state);
}

/** Собирает стартовое состояние комнаты из её описания. */
export function createState(room) {
  const objects = room.objects.map((o) => ({
    ...o,
    stats: { ...o.stats },
  }));

  objects.push({
    id: 'self',
    name: 'ты',
    art: 'self',
    tags: ['self'],
    isSelf: true,
    pos: room.playerAt || { x: 120, y: 300, w: 120, h: 300 },
    stats: { ...room.player.stats },
  });

  const state = {
    roomId: room.id,
    objects,
    moves: 0,
  };

  for (const o of objects) {
    if (o.destroyed) o.destroyed = true;
  }
  return state;
}

/** Насколько предмет сидит в воде: 0 — целиком над водой, 1 — целиком под водой. */
export function submerge(obj, room) {
  const w = room.water;
  if (!w) return 0;
  // «плавучесть»: чем легче вещь, тем выше она держится. Плотные вещи ложатся на дно.
  const depthBand = w.y2 - w.y1;
  const floatY = w.y1 + depthBand * (obj.stats.mass / 130);
  const baseY = obj.pos.y + obj.pos.h;          // низ предмета
  return Math.max(0, Math.min(1, (baseY - (floatY - 10)) / Math.max(60, obj.pos.h)));
}

export function getObj(state, id) {
  return state.objects.find((o) => o.id === id);
}

export function selfOf(state) {
  return getObj(state, 'self');
}

/** Можно ли вообще менять между этими двумя предметами. */
export function canSwap(state, aId, bId) {
  if (aId === bId) return { ok: false, reason: 'Это один и тот же предмет.' };
  const a = getObj(state, aId);
  const b = getObj(state, bId);
  if (!a || !b) return { ok: false, reason: 'Предмет не найден.' };
  if (a.fixed) return { ok: false, reason: `${a.name} — часть комнаты, с ним не обменяться.` };
  if (b.fixed) return { ok: false, reason: `${b.name} — часть комнаты, с ним не обменяться.` };
  if (a.destroyed) return { ok: false, reason: `${a.name} больше нет.` };
  if (b.destroyed) return { ok: false, reason: `${b.name} больше нет.` };
  return { ok: true };
}

/** Обмен одного канала между двумя предметами. Возвращает новое состояние. */
export function swapStats(state, aId, bId, channel) {
  if (!CHANNELS.includes(channel)) throw new Error(`Неизвестный канал: ${channel}`);
  const check = canSwap(state, aId, bId);
  if (!check.ok) throw new Error(check.reason);

  const next = clone(state);
  const a = getObj(next, aId);
  const b = getObj(next, bId);
  const av = a.stats[channel];
  const bv = b.stats[channel];
  a.stats[channel] = bv;
  b.stats[channel] = av;
  next.moves += 1;
  next.last = { a: aId, b: bId, channel };
  return next;
}

/** Прилагательные для описания вещи — их видно в инспекторе. */
export function describe(obj) {
  const s = obj.stats;
  const words = [];
  if (s.heat >= 80) words.push('раскалённый');
  else if (s.heat >= 50) words.push('горячий');
  else if (s.heat <= 15) words.push('ледяной');
  else if (s.heat <= 30) words.push('остывший');

  if (s.moisture >= 85) words.push('насквозь мокрый');
  else if (s.moisture >= 55) words.push('мокрый');
  else if (s.moisture <= 15) words.push('сухой');

  if (s.give >= 65) words.push('податливый');
  else if (s.give <= 22) words.push('жёсткий');

  if (s.mass >= 60) words.push('тяжёлый');
  else if (s.mass <= 18) words.push('лёгкий');

  return words;
}

export function evaluate(state, room, opts = {}) {
  const result = room.evaluate(state, opts) || {};
  return {
    solved: Boolean(result.solved),
    failed: Boolean(result.failed),
    failure: result.failure || '',
    status: result.status || [],
    solvedText: result.solvedText || room.solvedText || 'Готово.',
  };
}

/** Канонический ключ состояния — для поиска решений в тестах. */
export function stateKey(state) {
  return state.objects
    .map((o) => `${o.id}:${CHANNELS.map((c) => o.stats[c]).join(',')}`)
    .join('|');
}

/** Список всех возможных ходов. */
export function allMoves(state) {
  const swappable = state.objects.filter((o) => !o.fixed && !o.destroyed);
  const moves = [];
  for (const a of swappable) {
    for (const b of swappable) {
      if (a.id === b.id) continue;
      for (const ch of CHANNELS) {
        moves.push({ a: a.id, b: b.id, channel: ch });
      }
    }
  }
  return moves;
}

/** Поиск в ширину: существует ли решение и за сколько ходов минимум. */
export function solveBfs(room, maxDepth = 8) {
  const start = createState(room);
  const seen = new Set([stateKey(start)]);
  let frontier = [{ state: start, path: [] }];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const next = [];
    for (const node of frontier) {
      for (const mv of allMoves(node.state)) {
        let candidate;
        try {
          candidate = swapStats(node.state, mv.a, mv.b, mv.channel);
        } catch {
          continue;
        }
        const ev = evaluate(candidate, room);
        const path = [...node.path, mv];

        if (ev.solved || evaluate(candidate, room, { committed: true }).solved) {
          return { solvable: true, depth, path };
        }
        if (ev.failed) continue;

        const key = stateKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state: candidate, path });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return { solvable: false, depth: Infinity, path: [] };
}
