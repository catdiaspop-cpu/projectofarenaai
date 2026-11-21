// Планировка дома: точные размеры в метрах.
//
// Всё в игре «взрослое», а мальчик маленький. Поэтому числа здесь важны:
// выключатель 1.15 м, глазок 1.45 м, верхняя полка 1.68 м, рост мальчика 1.22 м.
// Из этих чисел вытекает механика «достать = поставить мебель».
//
// План — честная сетка: комнаты одного этажа не пересекаются, двери стоят
// на общих стенах, из детской есть путь в любую комнату.

import { ROOM_KIND } from './rooms.mjs';

/** Высоты (м). */
export const HEIGHTS = {
  child: 1.22,
  reach: 0.35,        // докуда достаёт рукой, стоя на полу
  reachOnStool: 0.62, // с табуретки
  eye: 1.28,
  switch: 1.15,
  peephole: 1.45,
  handle: 0.95,
  counter: 0.92,
  tableTop: 0.76,
  upperShelf: 1.68,
  wardrobeHandle: 1.9,
  stairRise: 0.18,
  stepRun: 0.29,
  floorHeight: 3.1,
  wallThickness: 0.22,
  door: { w: 0.85, h: 2.05 },
  windowSill: 0.94,
};

/**
 * Комнаты. rect — в метрах, от левого верхнего угла плана.
 * Для каждого этажа комнаты не пересекаются.
 */
export const ROOMS = [
  // ─────────── ПОДВАЛ (уровень −1) ───────────
  {
    id: 'basement',
    name: 'Подвал',
    kind: ROOM_KIND.BASEMENT,
    floor: -1,
    rect: { x: 2.0, z: 6.0, w: 5.4, d: 5.6 },
    light: { day: 0.08, dusk: 0.06, night: 0.02 },
    sound: { base: 6 },
    detail: 'стиральная машина, котёл, полки с банками, старый матрас, лужа у слива',
  },

  // ─────────── ПЕРВЫЙ ЭТАЖ (уровень 0) ───────────
  {
    id: 'living',
    name: 'Гостиная',
    kind: ROOM_KIND.LIVING,
    floor: 0,
    rect: { x: 0.0, z: 0.0, w: 4.6, d: 5.0 },
    light: { day: 0.8, dusk: 0.28, night: 0.05 },
    sound: { base: 2 },     // часы
    detail: 'диван, телевизор, журнальный столик, книжный шкаф, часы, ковёр',
  },
  {
    id: 'hall',
    name: 'Прихожая',
    kind: ROOM_KIND.HALL,
    floor: 0,
    rect: { x: 4.6, z: 0.0, w: 2.0, d: 4.0 },
    light: { day: 0.85, dusk: 0.3, night: 0.05 },
    sound: { base: 4 },
    detail: 'дверь на улицу, коврик, зеркало, обувь, вешалка, ключница',
  },
  {
    id: 'kitchen',
    name: 'Кухня',
    kind: ROOM_KIND.KITCHEN,
    floor: 0,
    rect: { x: 6.6, z: 0.0, w: 3.4, d: 4.4 },
    light: { day: 0.9, dusk: 0.35, night: 0.06 },
    sound: { base: 5 },     // холодильник
    detail: 'холодильник, стол, четыре стула, плита, раковина, верхние шкафы',
  },
  {
    id: 'stairs',
    name: 'Лестница',
    kind: ROOM_KIND.STAIRS,
    floor: 0,
    rect: { x: 4.6, z: 4.0, w: 2.0, d: 4.0 },
    light: { day: 0.5, dusk: 0.2, night: 0.03 },
    sound: { base: 1 },
    detail: '13 ступеней, перила, вторая половица снизу скрипит',
  },
  {
    id: 'pantry',
    name: 'Кладовая',
    kind: ROOM_KIND.STORAGE,
    floor: 0,
    rect: { x: 6.6, z: 4.4, w: 3.4, d: 3.6 },
    light: { day: 0.15, dusk: 0.05, night: 0.01 },
    sound: { base: 0 },
    detail: 'коробки, лыжи, банки, старый торшер, пыль',
  },

  // ─────────── ВТОРОЙ ЭТАЖ (уровень 1) ───────────
  {
    id: 'childroom',
    name: 'Детская',
    kind: ROOM_KIND.CHILD,
    floor: 1,
    rect: { x: 0.0, z: 0.0, w: 3.6, d: 3.4 },
    light: { day: 0.75, dusk: 0.25, night: 0.08 }, // ночник
    sound: { base: 0 },
    detail: 'кровать, ночник-ёжик, шкаф, письменный стол, полка с игрушками, окно во двор',
  },
  {
    id: 'parents',
    name: 'Спальня родителей',
    kind: ROOM_KIND.PARENTS,
    floor: 1,
    rect: { x: 3.6, z: 0.0, w: 3.4, d: 3.4 },
    light: { day: 0.6, dusk: 0.2, night: 0.04 },
    sound: { base: 0 },
    detail: 'двуспальная кровать, трюмо с зеркалом, шкаф, тумбы, шторы',
  },
  {
    id: 'bath',
    name: 'Ванная',
    kind: ROOM_KIND.BATH,
    floor: 1,
    rect: { x: 7.0, z: 0.0, w: 3.0, d: 3.4 },
    light: { day: 0.55, dusk: 0.2, night: 0.03 },
    sound: { base: 3 },     // капает вода
    detail: 'ванна, раковина, зеркало, шкафчик, полотенца, корзина для белья',
  },
  {
    id: 'corridor',
    name: 'Коридор',
    kind: ROOM_KIND.CORRIDOR,
    floor: 1,
    rect: { x: 0.0, z: 3.4, w: 8.0, d: 1.5 },
    light: { day: 0.45, dusk: 0.18, night: 0.03 },
    sound: { base: 1 },
    detail: 'четыре двери, выключатель на 1.15 м, дорожка, лампочка без плафона',
  },

  // ─────────── ЧЕРДАК (уровень 2) ───────────
  {
    id: 'attic',
    name: 'Чердак',
    kind: ROOM_KIND.ATTIC,
    floor: 2,
    rect: { x: 3.6, z: 3.4, w: 3.4, d: 3.4 },
    light: { day: 0.2, dusk: 0.08, night: 0.02 },
    sound: { base: 0 },
    detail: 'скаты крыши, дневник в коробке, старые вещи, форточка, паутина',
  },

  // ─────────── ДВОР (только для вида из окон) ───────────
  {
    id: 'yard',
    name: 'Двор',
    kind: ROOM_KIND.YARD,
    floor: 0,
    rect: { x: 0.0, z: -7.0, w: 10.0, d: 6.5 },
    light: { day: 1.0, dusk: 0.4, night: 0.06 },
    sound: { base: 2 },
    detail: 'фонарь у подъезда, качели, фургон курьера, куст сирени',
  },
];

/** Двери. at — точка в мировых координатах плана. */
export const DOORS = [
  // первый этаж
  { id: 'hall-yard',    a: 'hall',    b: null,     at: { x: 5.6, z: 0.0 },  dir: 'n', lock: 'замок', note: 'входная' },
  { id: 'hall-living',  a: 'hall',    b: 'living', at: { x: 4.6, z: 1.6 },  dir: 'x' },
  { id: 'hall-kitchen', a: 'hall',    b: 'kitchen',at: { x: 6.6, z: 0.9 },  dir: 'x' },
  { id: 'hall-stairs',  a: 'hall',    b: 'stairs', at: { x: 5.6, z: 4.0 },  dir: 'n' },
  { id: 'stairs-pantry',a: 'stairs',  b: 'pantry', at: { x: 6.6, z: 6.4 },  dir: 'x' },
  { id: 'hall-basement',a: 'hall',    b: 'basement',at:{ x: 5.6, z: 4.0 },  dir: 'n', lock: 'люк в полу' },
  { id: 'living-pantry',a: 'living',  b: 'pantry',  at: { x: 4.6, z: 4.4 },  dir: 'x', lock: 'заперто' },
  { id: 'living-flat',  a: 'living',  b: 'parents', at: { x: 3.4, z: 0.0 },  dir: 'n', lock: 'люк в потолке' },
  // второй этаж
  { id: 'stairs-up',    a: 'stairs',  b: 'corridor', at: { x: 5.6, z: 3.35 }, dir: 'n' },
  { id: 'cor-child',    a: 'corridor',b: 'childroom',at: { x: 2.0, z: 3.4 }, dir: 'n' },
  { id: 'cor-parents',  a: 'corridor',b: 'parents',  at: { x: 6.2, z: 3.4 }, dir: 'n' },
  { id: 'cor-bath',     a: 'corridor',b: 'bath',     at: { x: 7.5, z: 3.4 }, dir: 'n' },
  { id: 'cor-attic',    a: 'corridor',b: 'attic',    at: { x: 4.2, z: 3.4 }, dir: 'n', lock: 'люк в потолке' },
];

/** Окна: свет, вид наружу и место, куда нельзя смотреть. */
export const WINDOWS = [
  { room: 'childroom', at: { x: 1.6, z: 0.0 },  dir: 'n', sill: 0.94, size: { w: 1.1, h: 1.3 }, curtains: 'шторы' },
  { room: 'parents',   at: { x: 5.2, z: 0.0 },  dir: 'n', sill: 0.94, size: { w: 1.2, h: 1.4 }, curtains: 'плотные' },
  { room: 'bath',      at: { x: 8.5, z: 0.0 },  dir: 'n', sill: 1.4,  size: { w: 0.7, h: 0.7 }, curtains: null },
  { room: 'living',    at: { x: 1.6, z: 0.0 },  dir: 'n', sill: 0.6,  size: { w: 1.8, h: 1.6 }, curtains: 'тюль' },
  { room: 'kitchen',   at: { x: 8.3, z: 0.0 },  dir: 'n', sill: 1.0,  size: { w: 1.2, h: 1.2 }, curtains: null },
  { room: 'attic',     at: { x: 5.3, z: 3.4 },  dir: 'n', sill: 1.3,  size: { w: 0.8, h: 0.8 }, curtains: null },
];

/** Свет: лампы, ночники, выключатели. Высоты — часть механики. */
export const LIGHTS = [
  { id: 'child-nightlight', room: 'childroom', type: 'nightlight', at: { x: 1.42, z: 1.85 }, h: 0.55, power: 0.35, color: 0xffb45e, radius: 3.2, flicker: 0.06 },
  { id: 'child-ceiling',    room: 'childroom', type: 'ceiling',    at: { x: 1.8, z: 1.6 },  h: 2.75, power: 0.9,  color: 0xffd9a0, radius: 6, switchAt: { x: 2.5, z: 3.25, h: 1.15 } },
  { id: 'corridor-bulb',    room: 'corridor',  type: 'bulb',       at: { x: 4.0, z: 0.75 }, h: 2.7,  power: 0.7,  color: 0xffc37a, radius: 5, switchAt: { x: 1.5, z: 4.55, h: 1.15 } },
  { id: 'kitchen-ceiling',  room: 'kitchen',   type: 'ceiling',    at: { x: 8.3, z: 2.2 },  h: 2.75, power: 1.0,  color: 0xffe2b8, radius: 7, switchAt: { x: 6.75, z: 2.2, h: 1.15 } },
  { id: 'living-lamp',      room: 'living',    type: 'lamp',       at: { x: 4.0, z: 4.4 },  h: 1.6,  power: 0.6,  color: 0xffcb8a, radius: 5 },
  { id: 'hall-ceiling',     room: 'hall',      type: 'ceiling',    at: { x: 5.6, z: 1.6 },  h: 2.75, power: 0.5,  color: 0xffd9a0, radius: 4, switchAt: { x: 4.75, z: 1.6, h: 1.15 } },
  { id: 'bath-ceiling',     room: 'bath',      type: 'ceiling',    at: { x: 8.5, z: 1.7 },  h: 2.75, power: 0.8,  color: 0xe8f2ff, radius: 5, pullCord: { x: 8.0, z: 1.4, h: 2.0 } },
  { id: 'stairs-bulb',      room: 'stairs',    type: 'bulb',       at: { x: 5.3, z: 4.4 },  h: 2.6,  power: 0.4,  color: 0xffc37a, radius: 3 },
  { id: 'basement-bulb',    room: 'basement',  type: 'bulb',       at: { x: 4.7, z: 8.4 },  h: 2.2,  power: 0.35, color: 0xffb066, radius: 4, pullCord: { x: 3.2, z: 9.9, h: 2.0 } },
  { id: 'attic-window',     room: 'attic',     type: 'window',     at: { x: 5.3, z: 3.5 },  h: 1.6,  power: 0.25, color: 0x9dbcff, radius: 3 },
  { id: 'parents-moon',     room: 'parents',   type: 'window',     at: { x: 5.2, z: 0.2 },  h: 1.5,  power: 0.2,  color: 0x9dbcff, radius: 3 },
];

/** Кто где стартует. */
export const SPAWN = {
  child: { room: 'childroom', at: { x: 1.7, z: 2.7 }, facing: 0 },
  phone: { room: 'childroom', at: { x: 1.15, z: 1.45 } },
};

/** Ключевые точки для навигации и карты. */
export const POINTS = [
  { id: 'bed',            room: 'childroom', at: { x: 1.3, z: 2.45 }, kind: 'sleep',  name: 'кровать' },
  { id: 'nightlight',     room: 'childroom', at: { x: 1.42, z: 1.85 },kind: 'light',  name: 'ночник' },
  { id: 'child-window',   room: 'childroom', at: { x: 1.6, z: 0.35 }, kind: 'window', name: 'окно' },
  { id: 'wardrobe',       room: 'childroom', at: { x: 3.2, z: 1.8 },  kind: 'hide',   name: 'шкаф' },
  { id: 'desk',           room: 'childroom', at: { x: 1.15, z: 1.45 },kind: 'phone',  name: 'стол' },
  { id: 'switch-corridor',room: 'corridor',  at: { x: 1.5, z: 4.55 }, kind: 'switch', name: 'выключатель' },
  { id: 'trapdoor',       room: 'corridor',  at: { x: 4.2, z: 3.7 },  kind: 'attic',  name: 'люк на чердак' },
  { id: 'stair-creak',    room: 'stairs',    at: { x: 5.4, z: 6.4 },  kind: 'trap',   name: 'скрипучая ступень' },
  { id: 'fridge',         room: 'kitchen',   at: { x: 7.0, z: 0.7 },  kind: 'food',   name: 'холодильник' },
  { id: 'front-door',     room: 'hall',      at: { x: 5.6, z: 0.35 }, kind: 'door',   name: 'входная дверь' },
  { id: 'mirror',         room: 'bath',      at: { x: 7.4, z: 0.6 },  kind: 'mirror', name: 'зеркало' },
  { id: 'hall-hatch',     room: 'hall',      at: { x: 5.6, z: 3.75 }, kind: 'basement', name: 'люк в подвал' },
];
