// Замки: почему дверь закрыта и что нужно, чтобы открыть.
//
// Чистая функция без DOM и без three.js — проверяется в node.
// Правило простое и всегда объяснимое игроку: замок открывается тем, что
// у мальчика уже есть (фонарь, свет в комнате) или тем, что он уже видел.
//
// Важно: без этого модуля четыре двери из четырнадцати были заперты навсегда —
// в игре был бы тупик, а не загадка.

import { DOORS } from '../data/house.mjs';

/** Что нужно для каждой запертой двери. Ключ — id двери. */
export const LOCKS = {
  'hall-basement': {
    need: 'light',
    hint: 'люк в полу. темно, ручку не нащупать',
    open: 'люк в полу. нашёл ручку',
  },
  'living-pantry': {
    need: 'kitchen',
    hint: 'заперто. ключ где-то на кухне',
    open: 'заперто. ключ с кухни подошёл',
  },
  'living-flat': {
    need: 'torch',
    hint: 'люк в потолке. без фонаря не видно, за что тянуть',
    open: 'люк в потолке. потянул за кольцо',
  },
  'cor-attic': {
    need: 'torch',
    hint: 'люк на чердак. в темноте не найти',
    open: 'люк на чердак. полез',
  },
  'hall-yard': {
    need: 'never',
    hint: 'замок. мама сказала не выходить',
    open: 'нельзя. и не надо',
  },
};

/**
 * Можно ли пройти в дверь.
 * ctx = { torch, lightOn: {id: bool}, visited: Set|string[], crouch }
 * → { open, reason }
 */
export function canOpen(door, ctx = {}) {
  const rule = LOCKS[door.id];
  if (!rule) return { open: true, reason: '' };
  if (rule.need === 'never') return { open: false, reason: rule.hint };
  if (rule.need === 'torch') {
    return ctx.torch ? { open: true, reason: rule.open } : { open: false, reason: rule.hint };
  }
  if (rule.need === 'light') {
    const anyLight = Object.values(ctx.lightOn ?? {}).some(Boolean);
    return anyLight ? { open: true, reason: rule.open } : { open: false, reason: rule.hint };
  }
  if (rule.need === 'kitchen') {
    const visited = ctx.visited instanceof Set ? ctx.visited : new Set(ctx.visited ?? []);
    return visited.has('kitchen') ? { open: true, reason: rule.open } : { open: false, reason: rule.hint };
  }
  return { open: false, reason: rule.hint };
}

/** Двери, ведущие из комнаты (только с обеими сторонами). */
export function doorsOf(roomId) {
  return DOORS.filter((d) => d.b && (d.a === roomId || d.b === roomId));
}

/** Соседняя комната по двери. */
export function otherSide(door, roomId) {
  return door.a === roomId ? door.b : door.a;
}

/** Сколько дверей в игре заперто и сколько открывается — для тестов и отладки. */
export function lockReport(ctx = {}) {
  const all = DOORS.filter((d) => d.b);
  return all.map((d) => ({ id: d.id, ...canOpen(d, ctx) }));
}
