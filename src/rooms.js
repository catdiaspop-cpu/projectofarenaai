// Восемь комнат «Обмена веществ».
//
// Устройство комнаты:
//   - предметы со четырьмя шкалами (0..100) и позицией на сцене 1000×620;
//   - evaluate(state) — ЧИСТАЯ функция: только читает значения и говорит,
//     выполнены ли условия. Никаких скрытых изменений состояния.
//
// Почему чистая: обмен — это перестановка значений. Если правила ничего
// не «портят», из любого состояния можно вернуться назад, и тупиков не бывает.
// Игрок может экспериментировать без страха.

const S = (o, ch) => o.stats[ch];

const find = (state, id) => state.objects.find((o) => o.id === id);

const ok = (cond, text) => ({ ok: Boolean(cond), text });

/** Собирает условия в общий ответ. */
function verdict(conditions, solvedText, extra = {}) {
  return {
    solved: conditions.every((c) => c.ok),
    status: conditions.map(({ ok: good, text }) => ({ ok: good, text })),
    solvedText,
    ...extra,
  };
}

export const ROOMS = [
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: 'Свеча',
    law: 'Верёвка держит дверь. Огонь её отпустит.',
    intro:
      'Здесь всё просто. Возьми у свечи её тепло и отдай верёвке. ' +
      'Только смотри, чтобы верёвка была сухой: мокрая не займётся.',
    hint:
      'Выбери канал «тепло», щёлкни свечу, потом верёвку. ' +
      'Кувшин в этой комнате — ловушка: его влага делает верёвку несгораемой.',
    solvedText: 'Верёвка тлеет и рвётся. Дверь поддаётся.',
    water: null,
    scenery: [
      { art: 'table', pos: { x: 250, y: 470, w: 420, h: 150 } },
      { art: 'peg', pos: { x: 730, y: 132, w: 84, h: 84 } },
    ],
    player: { stats: { mass: 55, heat: 62, moisture: 45, give: 55 } },
    playerAt: { x: 88, y: 330, w: 140, h: 290 },
    objects: [
      {
        id: 'rope',
        name: 'верёвка',
        art: 'rope',
        pos: { x: 730, y: 168, w: 84, h: 296 },
        stats: { mass: 25, heat: 20, moisture: 30, give: 62 },
      },
      {
        id: 'candle',
        name: 'свеча',
        art: 'candle',
        pos: { x: 336, y: 320, w: 96, h: 150 },
        stats: { mass: 35, heat: 92, moisture: 6, give: 70 },
        onTable: true,
      },
      {
        id: 'jug',
        name: 'кувшин',
        art: 'jug',
        pos: { x: 540, y: 350, w: 110, h: 120 },
        stats: { mass: 58, heat: 18, moisture: 95, give: 40 },
        onTable: true,
      },
    ],
    evaluate(state) {
      const rope = find(state, 'rope');
      const conditions = [
        ok(S(rope, 'heat') >= 70, 'верёвка раскалена'),
        ok(S(rope, 'moisture') <= 32, 'верёвка сухая'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    name: 'Утопленник',
    law: 'Лёгкое всплывает. Тяжёлое лежит на дне.',
    intro:
      'Ключ и поплавок лежат на дне. Ключ нужен наверху, а поплавок ' +
      'держит решётку: пока он на дне, решётка заперта. ' +
      'Тебе нужны два лёгких предмета — и оба у тебя под рукой.',
    hint: 'Пробка и перо — самые лёгкие вещи в комнате. Отдай их вес ключу и поплавку.',
    solvedText: 'Ключ всплывает, поплавок поднимает решётку. Ход свободен.',
    water: { y1: 210, y2: 560 },
    scenery: [
      { art: 'shelf', pos: { x: 690, y: 116, w: 230, h: 78 } },
    ],
    player: { stats: { mass: 55, heat: 40, moisture: 70, give: 55 } },
    playerAt: { x: 80, y: 320, w: 140, h: 300 },
    objects: [
      {
        id: 'key',
        name: 'ключ',
        art: 'key',
        pos: { x: 290, y: 470, w: 140, h: 66 },
        stats: { mass: 82, heat: 14, moisture: 100, give: 15 },
      },
      {
        id: 'float',
        name: 'поплавок',
        art: 'float',
        pos: { x: 552, y: 396, w: 100, h: 100 },
        stats: { mass: 70, heat: 30, moisture: 100, give: 45 },
      },
      {
        id: 'cork',
        name: 'пробка',
        art: 'cork',
        pos: { x: 700, y: 344, w: 86, h: 86 },
        stats: { mass: 9, heat: 40, moisture: 20, give: 85 },
      },
      {
        id: 'feather',
        name: 'перо',
        art: 'feather',
        pos: { x: 812, y: 372, w: 120, h: 78 },
        stats: { mass: 3, heat: 45, moisture: 10, give: 90 },
      },
      {
        id: 'anchor',
        name: 'якорь',
        art: 'anchor',
        pos: { x: 425, y: 418, w: 128, h: 138 },
        stats: { mass: 96, heat: 20, moisture: 100, give: 10 },
      },
    ],
    evaluate(state) {
      const key = find(state, 'key');
      const float = find(state, 'float');
      const conditions = [
        ok(S(key, 'mass') <= 24, 'ключ лёгкий — всплывёт'),
        ok(S(float, 'mass') <= 30, 'поплавок лёгкий — поднимет решётку'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    name: 'Ледник',
    law: 'Лёд тает от тепла. Тепло берётся только у чего-то живого.',
    intro:
      'Дверь схвачена двумя ледяными засовами. Каждому нужно много тепла — ' +
      'больше, чем есть у тебя и у свечи вместе. Но в углу стоит котёл с кипятком.',
    hint: 'Котёл отдаст своё тепло один раз. Второй засов придётся отогревать собой — и идти дальше замёрзшим.',
    solvedText: 'Оба засова тают. Дверь открыта, но пальцы не слушаются.',
    water: { y1: 506, y2: 566 },
    scenery: [
      { art: 'pedestal', pos: { x: 596, y: 470, w: 152, h: 150 } },
    ],
    player: { stats: { mass: 55, heat: 70, moisture: 45, give: 55 } },
    playerAt: { x: 84, y: 326, w: 140, h: 294 },
    objects: [
      {
        id: 'ice1',
        name: 'верхний засов',
        art: 'ice',
        wall: true,
        pos: { x: 898, y: 186, w: 84, h: 84 },
        stats: { mass: 60, heat: 8, moisture: 100, give: 20 },
      },
      {
        id: 'ice2',
        name: 'нижний засов',
        art: 'ice',
        wall: true,
        pos: { x: 898, y: 350, w: 84, h: 84 },
        stats: { mass: 60, heat: 12, moisture: 100, give: 20 },
      },
      {
        id: 'boiler',
        name: 'котёл',
        art: 'boiler',
        pos: { x: 420, y: 356, w: 156, h: 170 },
        stats: { mass: 70, heat: 96, moisture: 90, give: 35 },
      },
      {
        id: 'candle',
        name: 'свеча',
        art: 'candle',
        pos: { x: 632, y: 362, w: 92, h: 108 },
        stats: { mass: 35, heat: 35, moisture: 6, give: 70 },
        onTable: true,
      },
    ],
    evaluate(state) {
      const a = find(state, 'ice1');
      const b = find(state, 'ice2');
      const conditions = [
        ok(S(a, 'heat') >= 55, 'верхний засов подтаял'),
        ok(S(b, 'heat') >= 55, 'нижний засов подтаял'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    name: 'Смола',
    law: 'Мокрая смола липнет. Сухая крошится.',
    intro:
      'Рычаг намертво утоплен в смоле. Сама смола тоже не поможет: ' +
      'рычаг провернётся, только если ему будет чем надавить — то есть весом.',
    hint: 'Смолу надо высушить (песок), а рычагу — добавить веса (наковальня).',
    solvedText: 'Смола треснула, тяжёлый рычаг падает и открывает дверь.',
    water: null,
    scenery: [
      { art: 'table', pos: { x: 300, y: 470, w: 300, h: 150 } },
      { art: 'crate', pos: { x: 14, y: 512, w: 96, h: 106 } },
    ],
    player: { stats: { mass: 55, heat: 50, moisture: 30, give: 55 } },
    playerAt: { x: 84, y: 326, w: 140, h: 294 },
    objects: [
      {
        id: 'lever',
        name: 'рычаг',
        art: 'lever',
        pos: { x: 660, y: 400, w: 210, h: 46 },
        stats: { mass: 38, heat: 40, moisture: 20, give: 30 },
      },
      {
        id: 'resin',
        name: 'смола',
        art: 'resin',
        pos: { x: 632, y: 360, w: 150, h: 110 },
        stats: { mass: 40, heat: 35, moisture: 92, give: 75 },
      },
      {
        id: 'sand',
        name: 'песок',
        art: 'sand',
        pos: { x: 336, y: 378, w: 176, h: 92 },
        stats: { mass: 65, heat: 45, moisture: 6, give: 20 },
      },
      {
        id: 'anvil',
        name: 'наковальня',
        art: 'anvil',
        pos: { x: 206, y: 404, w: 152, h: 128 },
        stats: { mass: 92, heat: 25, moisture: 15, give: 8 },
      },
      {
        id: 'jug',
        name: 'кувшин',
        art: 'jug',
        pos: { x: 556, y: 354, w: 98, h: 116 },
        stats: { mass: 50, heat: 20, moisture: 95, give: 40 },
      },
    ],
    evaluate(state) {
      const resin = find(state, 'resin');
      const lever = find(state, 'lever');
      const conditions = [
        ok(S(resin, 'moisture') <= 12, 'смола высохла и раскрошилась'),
        ok(S(lever, 'mass') >= 60, 'рычаг достаточно тяжёл, чтобы провернуться'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    name: 'Порох',
    law: 'Мокрое не горит — сколько его ни грей.',
    intro:
      'Запал есть, порох есть, а выстрела нет: порох отсырел. ' +
      'Рядом лежит губка, которая впитала воду из воздуха, и раскалённые угли.',
    hint: 'Губка сухая — обменяйся с ней влагой. Только потом гревай: пока порох мокрый, тепло бесполезно.',
    solvedText: 'Вспышка. Стена разлетается, и в проёме видно небо.',
    water: null,
    scenery: [
      { art: 'table', pos: { x: 250, y: 470, w: 420, h: 150 } },
      { art: 'crate', pos: { x: 14, y: 512, w: 96, h: 106 } },
    ],
    player: { stats: { mass: 55, heat: 55, moisture: 40, give: 55 } },
    playerAt: { x: 84, y: 326, w: 140, h: 294 },
    objects: [
      {
        id: 'powder',
        name: 'порох',
        art: 'powder',
        pos: { x: 456, y: 362, w: 158, h: 108 },
        stats: { mass: 45, heat: 20, moisture: 86, give: 90 },
      },
      {
        id: 'sponge',
        name: 'губка',
        art: 'sponge',
        pos: { x: 642, y: 374, w: 122, h: 96 },
        stats: { mass: 12, heat: 30, moisture: 8, give: 95 },
      },
      {
        id: 'coal',
        name: 'угли',
        art: 'coal',
        pos: { x: 278, y: 374, w: 146, h: 96 },
        stats: { mass: 40, heat: 96, moisture: 5, give: 25 },
      },
    ],
    evaluate(state) {
      const p = find(state, 'powder');
      const conditions = [
        ok(S(p, 'moisture') <= 25, 'порох сухой'),
        ok(S(p, 'heat') >= 75, 'порох раскалён'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    name: 'Мост',
    law: 'Мокрая верёвка скользит. Податливая — провисает.',
    intro:
      'Через пропасть перекинуты две толстые верёвки. Ты пойдёшь только по той, ' +
      'что станет жёсткой, как балка, — и при этом останется лёгкой и сухой.',
    hint: 'Камень отдаст жёсткость. Сухость придётся взять у песка: камень сам влажноват.',
    solvedText: 'Верёвка натянулась в струну. Первый шаг — и ты на другой стороне.',
    water: { y1: 560, y2: 620 },
    scenery: [
      { art: 'peg', pos: { x: 180, y: 288, w: 80, h: 80 } },
      { art: 'peg', pos: { x: 664, y: 288, w: 80, h: 80 } },
    ],
    player: { stats: { mass: 55, heat: 45, moisture: 55, give: 55 } },
    playerAt: { x: 56, y: 316, w: 140, h: 304 },
    objects: [
      {
        id: 'rope',
        name: 'верёвка',
        art: 'bridge',
        pos: { x: 180, y: 310, w: 560, h: 150 },
        stats: { mass: 25, heat: 30, moisture: 78, give: 12 },
      },
      {
        id: 'stone',
        name: 'камень',
        art: 'stone',
        pos: { x: 600, y: 418, w: 156, h: 120 },
        stats: { mass: 88, heat: 20, moisture: 48, give: 95 },
      },
      {
        id: 'sand',
        name: 'песок',
        art: 'sand',
        pos: { x: 800, y: 470, w: 150, h: 82 },
        stats: { mass: 62, heat: 40, moisture: 5, give: 20 },
      },
      {
        id: 'anvil',
        name: 'наковальня',
        art: 'anvil',
        pos: { x: 292, y: 452, w: 148, h: 120 },
        stats: { mass: 94, heat: 30, moisture: 20, give: 6 },
      },
    ],
    evaluate(state) {
      const rope = find(state, 'rope');
      const conditions = [
        ok(S(rope, 'give') >= 70, 'верёвка стала жёсткой'),
        ok(S(rope, 'moisture') <= 30, 'верёвка сухая'),
        ok(S(rope, 'mass') <= 40, 'верёвка осталась лёгкой'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 7,
    name: 'Метаморфоза',
    law: 'Из глины выйдет кирпич, если её высушить, обжечь и уплотнить.',
    intro:
      'Перед тобой ком глины и дверь, которую открывает только кирпич. ' +
      'Три свойства — и все три надо забрать у разных вещей. Порядок не важен, важен выбор.',
    hint: 'Сухость — у песка, жар — у углей, жёсткость — у камня. Все три обмена на глину.',
    solvedText: 'Кирпич ложится в паз. Дверь открывается с сухим стуком.',
    water: null,
    scenery: [
      { art: 'table', pos: { x: 250, y: 470, w: 440, h: 150 } },
    ],
    player: { stats: { mass: 55, heat: 60, moisture: 25, give: 55 } },
    playerAt: { x: 74, y: 326, w: 140, h: 294 },
    objects: [
      {
        id: 'clay',
        name: 'глина',
        art: 'clay',
        pos: { x: 620, y: 346, w: 172, h: 124 },
        stats: { mass: 75, heat: 22, moisture: 88, give: 88 },
      },
      {
        id: 'coal',
        name: 'угли',
        art: 'coal',
        pos: { x: 452, y: 374, w: 144, h: 96 },
        stats: { mass: 40, heat: 96, moisture: 45, give: 58 },
      },
      {
        id: 'sand',
        name: 'песок',
        art: 'sand',
        pos: { x: 268, y: 376, w: 164, h: 94 },
        stats: { mass: 64, heat: 45, moisture: 4, give: 18 },
      },
      {
        id: 'stone',
        name: 'камень',
        art: 'stone',
        pos: { x: 796, y: 414, w: 156, h: 120 },
        stats: { mass: 90, heat: 25, moisture: 22, give: 10 },
      },
    ],
    evaluate(state) {
      const c = find(state, 'clay');
      const conditions = [
        ok(S(c, 'moisture') <= 20, 'глина высохла'),
        ok(S(c, 'heat') >= 80, 'глина обожжена'),
        ok(S(c, 'give') <= 35, 'глина уплотнилась'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 8,
    name: 'Кузница',
    law: 'Последняя дверь открывается ключом, у которого всё — чужое.',
    intro:
      'Замок принимает только один предмет: тот, что будет горяч, сух, тяжёл ' +
      'и жёстк одновременно. Всё это можно собрать по кусочкам. Или отдать своё — ' +
      'и остаться ни с чем.',
    hint:
      'Четыре обмена: жар — от углей, сухость — от песка, вес — от якоря, ' +
      'жёсткость — от камня. Своё отдавать не обязательно.',
    solvedText: 'Замок срабатывает. Осталось только выйти — и решить, кем ты стал.',
    water: null,
    scenery: [
      { art: 'crate', pos: { x: 60, y: 490, w: 116, h: 128 } },
      { art: 'shelf', pos: { x: 120, y: 296, w: 240, h: 84 } },
      { art: 'table', pos: { x: 470, y: 470, w: 280, h: 150 } },
    ],
    player: { stats: { mass: 60, heat: 60, moisture: 60, give: 60 } },
    playerAt: { x: 74, y: 326, w: 140, h: 294 },
    objects: [
      {
        id: 'blank',
        name: 'заготовка',
        art: 'blank',
        pos: { x: 522, y: 300, w: 176, h: 176 },
        stats: { mass: 20, heat: 10, moisture: 90, give: 95 },
      },
      {
        id: 'coal',
        name: 'угли',
        art: 'coal',
        pos: { x: 640, y: 468, w: 128, h: 90 },
        stats: { mass: 40, heat: 96, moisture: 6, give: 25 },
      },
      {
        id: 'sand',
        name: 'песок',
        art: 'sand',
        pos: { x: 232, y: 470, w: 156, h: 92 },
        stats: { mass: 64, heat: 45, moisture: 4, give: 18 },
      },
      {
        id: 'anchor',
        name: 'якорь',
        art: 'anchor',
        pos: { x: 812, y: 392, w: 144, h: 156 },
        stats: { mass: 97, heat: 20, moisture: 30, give: 12 },
      },
      {
        id: 'stone',
        name: 'камень',
        art: 'stone',
        pos: { x: 148, y: 414, w: 156, h: 120 },
        stats: { mass: 90, heat: 25, moisture: 22, give: 8 },
      },
      {
        id: 'jug',
        name: 'кувшин',
        art: 'jug',
        pos: { x: 330, y: 354, w: 98, h: 116 },
        stats: { mass: 52, heat: 18, moisture: 95, give: 40 },
      },
    ],
    evaluate(state) {
      const b = find(state, 'blank');
      const conditions = [
        ok(S(b, 'heat') >= 85, 'ключ раскалён'),
        ok(S(b, 'moisture') <= 10, 'ключ сухой'),
        ok(S(b, 'mass') >= 85, 'ключ тяжёл'),
        ok(S(b, 'give') <= 20, 'ключ жёсток'),
      ];
      return verdict(conditions, this.solvedText);
    },
  },
];

export const ROOM_COUNT = ROOMS.length;

export function roomById(id) {
  return ROOMS.find((r) => r.id === Number(id));
}
