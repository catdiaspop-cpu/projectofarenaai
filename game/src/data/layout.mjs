// Расстановка мебели и мелочей по комнатам.
//
// Координаты — локальные для комнаты: (0,0) — левый верхний угол плана,
// x вправо, z вниз, единица — метр.
//
// В каждой комнате 6–10 активных предметов (мебель с точками взаимодействия)
// и 2–5 мелочей (то, что раскидывается и убирается).

export const LAYOUT = {
  // ══════════════════════ ДЕТСКАЯ (3.6 × 3.4) ══════════════════════
  childroom: {
    items: [
      { prop: 'childBed',     id: 'bed',        x: 0.49, z: 2.32, rot: 0 },
      { prop: 'nightstand',   id: 'nightstand', x: 1.42, z: 1.62 },
      { prop: 'hedgehogLamp', id: 'nightlight', x: 1.42, z: 1.62, y: 0.55, on: 'nightstand' },
      { prop: 'wardrobe',     id: 'wardrobe',   x: 3.22, z: 1.72, rot: -Math.PI / 2 },
      { prop: 'desk',         id: 'desk',       x: 1.16, z: 0.35 },
      { prop: 'chair',        id: 'chair',      x: 1.16, z: 0.92, rot: Math.PI },
      { prop: 'toyShelf',     id: 'toys',       x: 2.68, z: 0.28 },
      { prop: 'rug',          id: 'rug',        x: 2.1, z: 2.42 },
      // детали: без них комната — мебель в пустой коробке
      { prop: 'curtains',     id: 'curtains',  x: 1.6,  z: 0.12, y: 1.02 },
      { prop: 'childDrawing', id: 'drawing',   x: 2.55, z: 0.06, y: 1.28 },
      { prop: 'wallShelf',    id: 'shelf',     x: 1.16, z: 0.12, y: 1.22 },
      { prop: 'picture',      id: 'picture',   x: 2.95, z: 0.06, y: 1.35 },
      { prop: 'lightSwitch',  id: 'switch',    x: 2.5,  z: 3.28, y: 1.15 },
      { prop: 'laundryBasket',id: 'laundry',   x: 3.2,  z: 2.9 },
    ],
    clutter: [
      { prop: 'blocks', id: 'blocks', x: 2.55, z: 2.5, y: 0.02, home: 'childroom.toys', homeLabel: 'на полку' },
      { prop: 'ball',   id: 'ball',   x: 2.85, z: 2.2, y: 0.02, home: 'childroom.toys', homeLabel: 'на полку' },
      { prop: 'mug',    id: 'mug',    x: 1.2, z: 0.3,  y: 0.76, home: 'kitchen.counter', homeLabel: 'на кухню' },
      { prop: 'scatteredClothes', id: 'clothes', x: 2.3, z: 2.85, y: 0.02, home: 'childroom.wardrobe', homeLabel: 'в шкаф' },
    ],
  },

  // ══════════════════════ СПАЛЬНЯ РОДИТЕЛЕЙ (3.4 × 3.4) ══════════════════════
  parents: {
    items: [
      { prop: 'doubleBed',  id: 'bed',      x: 1.35, z: 1.55 },
      { prop: 'nightstand', id: 'stand-l',  x: 0.35, z: 1.1 },
      { prop: 'nightstand', id: 'stand-r',  x: 2.42, z: 1.62 },
      { prop: 'dresser',    id: 'dresser',  x: 1.35, z: 3.0, rot: Math.PI },
      { prop: 'wardrobe',   id: 'wardrobe', x: 2.9, z: 0.95, rot: Math.PI },
      { prop: 'chair',      id: 'chair',    x: 2.75, z: 2.4, rot: -0.5 },
      { prop: 'curtains',   id: 'curtains', x: 1.6,  z: 0.12, y: 1.02 },
      { prop: 'picture',    id: 'picture',  x: 3.25, z: 0.06, y: 1.42 },
      { prop: 'wallClock',  id: 'clock',    x: 0.3,  z: 0.08 },
      { prop: 'lightSwitch',id: 'switch',   x: 3.3,  z: 3.28, y: 1.15 },
      { prop: 'cardboardBox', id: 'box',    x: 0.6,  z: 2.9 },
    ],
    clutter: [
      { prop: 'plate', id: 'plate', x: 0.4,  z: 1.1, y: 0.55, home: 'kitchen.counter', homeLabel: 'на кухню' },
      { prop: 'mug',   id: 'mug',   x: 2.35, z: 1.1, y: 0.55, home: 'kitchen.counter', homeLabel: 'на кухню' },
      { prop: 'scatteredClothes', id: 'clothes', x: 2.15, z: 2.05, y: 0.02, home: 'parents.wardrobe', homeLabel: 'в шкаф' },
    ],
  },

  // ══════════════════════ ВАННАЯ (3.0 × 3.4) ══════════════════════
  bath: {
    items: [
      { prop: 'bathtub',   id: 'tub',     x: 1.5,  z: 0.42 },
      { prop: 'sinkMirror',id: 'sink',    x: 0.4,  z: 2.1, rot: Math.PI },
      { prop: 'toilet',    id: 'toilet',  x: 1.55, z: 3.0, rot: Math.PI },
      { prop: 'towelRail', id: 'towels',  x: 2.1,  z: 1.5, rot: Math.PI },
      { prop: 'nightstand',id: 'cabinet', x: 0.4,  z: 0.6 },
      { prop: 'laundryBasket', id: 'basket', x: 2.55, z: 2.2 },
      { prop: 'picture',   id: 'picture', x: 1.0,  z: 0.06, y: 1.5 },
      { prop: 'lightSwitch',id: 'switch', x: 2.85, z: 3.28, y: 1.15 },
    ],
    clutter: [
      { prop: 'scatteredClothes', id: 'clothes', x: 1.2, z: 1.7, y: 0.02, home: 'childroom.wardrobe', homeLabel: 'в детскую' },
      { prop: 'mug', id: 'mug', x: 0.42, z: 2.02, y: 0.86, home: 'kitchen.counter', homeLabel: 'на кухню' },
    ],
  },

  // ══════════════════════ КОРИДОР (8.0 × 1.5) ══════════════════════
  corridor: {
    items: [
      { prop: 'runner',      id: 'runner',   x: 2.75, z: 0.85 },
      { prop: 'hallMirror',  id: 'mirror',   x: 2.6, z: 0.14 },
      { prop: 'bookshelf',   id: 'shelf',    x: 0.55, z: 0.22 },
      { prop: 'atticLadder', id: 'trapdoor', x: 4.2, z: 0.55 },
      { prop: 'box',         id: 'box',      x: 7.6, z: 0.3 },
      { prop: 'nightstand',  id: 'stand',    x: 7.5, z: 1.1 },
      { prop: 'wallClock',   id: 'clock',    x: 1.1, z: 0.08 },
      { prop: 'picture',     id: 'picture',  x: 5.6, z: 0.08, y: 1.4 },
      { prop: 'keyRack',     id: 'keys',     x: 3.3, z: 1.42, y: 1.35 },
    ],
    clutter: [
      { prop: 'blocks', id: 'blocks', x: 2.5, z: 0.55, y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
      { prop: 'ball',   id: 'ball',   x: 6.3, z: 0.9,  y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
      { prop: 'mug',    id: 'mug',    x: 4.6, z: 0.45, y: 0.02, home: 'kitchen.counter', homeLabel: 'на кухню' },
    ],
  },

  // ══════════════════════ ЛЕСТНИЦА (2.0 × 4.8) ══════════════════════
  stairs: {
    items: [
      { prop: 'staircase', id: 'steps', x: 0.7,  z: 2.2 },
      { prop: 'floorLamp', id: 'lamp',  x: 1.72, z: 0.45 },
      { prop: 'box',       id: 'box',   x: 1.72, z: 3.55 },
      { prop: 'towelRail', id: 'rail',  x: 1.82, z: 2.6, rot: -Math.PI / 2 },
      { prop: 'wallClock', id: 'clock', x: 1.9,  z: 2.9, y: 0 },
      { prop: 'mug', id: 'mug2', x: 1.72, z: 0.45, y: 1.6, home: 'kitchen.counter', homeLabel: 'на кухню' },
      { prop: 'picture', id: 'picture', x: 0.2, z: 1.4, y: 1.45, rot: Math.PI / 2 },
      { prop: 'cardboardBox', id: 'boxup', x: 1.45, z: 3.55, y: 0.36 },
    ],
    clutter: [
      { prop: 'ball', id: 'ball', x: 0.6, z: 3.9, y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
    ],
  },

  // ══════════════════════ ПРИХОЖАЯ (2.0 × 3.2) ══════════════════════
  hall: {
    items: [
      { prop: 'frontDoor',     id: 'door',  x: 1.0,  z: 0.14 },
      { prop: 'doormat',       id: 'mat',   x: 1.0,  z: 0.65 },
      { prop: 'coatRack',      id: 'rack',  x: 0.22, z: 2.55, rot: Math.PI / 2 },
      { prop: 'shoeRack',      id: 'shoes', x: 1.78, z: 1.85, rot: -Math.PI / 2 },
      { prop: 'hallMirror',    id: 'mirror',x: 1.78, z: 3.2,  rot: -Math.PI / 2 },
      { prop: 'basementHatch', id: 'hatch', x: 0.42, z: 3.5 },
      { prop: 'box',           id: 'box',   x: 1.65, z: 3.65 },
      { prop: 'keyRack',       id: 'keys',  x: 1.7,  z: 0.06, y: 1.4 },
      { prop: 'lightSwitch',    id: 'switch',x: 0.1,  z: 1.6, y: 1.15 },
      { prop: 'grandfatherClock', id: 'clock', x: 0.35, z: 1.5 },
    ],
    clutter: [
      { prop: 'mug',   id: 'mug',   x: 0.35, z: 2.4, y: 0.02, home: 'kitchen.counter', homeLabel: 'на кухню' },
      { prop: 'ball',  id: 'ball',  x: 0.55, z: 0.75, y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
      { prop: 'scatteredClothes', id: 'clothes', x: 1.3, z: 1.5, y: 0.02, home: 'hall.rack', homeLabel: 'на вешалку' },
    ],
  },

  // ══════════════════════ ГОСТИНАЯ (4.6 × 5.0) ══════════════════════
  living: {
    items: [
      { prop: 'sofa',        id: 'sofa',  x: 2.0,  z: 1.15 },
      { prop: 'tv',          id: 'tv',    x: 2.0,  z: 0.3 },
      { prop: 'coffeeTable', id: 'table', x: 2.0,  z: 2.25 },
      { prop: 'bookshelf',   id: 'shelf', x: 0.5,  z: 3.2, rot: Math.PI / 2 },
      { prop: 'wallClock',   id: 'clock', x: 3.7,  z: 0.2 },
      { prop: 'rug',         id: 'rug',   x: 2.0,  z: 3.1 },
      { prop: 'chair',       id: 'chair', x: 3.8,  z: 2.3, rot: 1.1 },
      { prop: 'floorLamp',   id: 'lamp',  x: 4.25, z: 0.5 },
      { prop: 'table',       id: 'dining',x: 2.9,  z: 4.3 },
      { prop: 'curtains',    id: 'curtains', x: 1.6, z: 0.12, y: 0.66 },
      { prop: 'picture',     id: 'picture', x: 3.9,  z: 0.06, y: 1.5 },
      { prop: 'picture',     id: 'picture2',x: 0.06, z: 2.2, y: 1.35, rot: Math.PI / 2 },
      { prop: 'wallShelf',   id: 'shelf2',  x: 3.2,  z: 0.08, y: 1.42 },
      { prop: 'lightSwitch', id: 'switch',  x: 0.12, z: 4.0, y: 1.15 },
    ],
    clutter: [
      { prop: 'plate', id: 'plate', x: 2.0,  z: 2.25, y: 0.44, home: 'kitchen.counter', homeLabel: 'на кухню' },
      { prop: 'mug',   id: 'mug',   x: 2.2,  z: 2.25, y: 0.44, home: 'kitchen.counter', homeLabel: 'на кухню' },
      { prop: 'blocks',id: 'blocks',x: 1.2,  z: 4.2,  y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
      { prop: 'scatteredClothes', id: 'clothes', x: 3.5, z: 1.5, y: 0.02, home: 'childroom.wardrobe', homeLabel: 'в шкаф' },
    ],
  },

  // ══════════════════════ КУХНЯ (3.4 × 4.4) ══════════════════════
  kitchen: {
    items: [
      { prop: 'fridge',      id: 'fridge', x: 0.36, z: 0.5 },
      { prop: 'counter',     id: 'counter',x: 1.62, z: 0.32 },
      { prop: 'kitchenSink', id: 'sink',   x: 1.15, z: 0.4, y: 0.92 },
      { prop: 'stove',       id: 'stove',  x: 2.95, z: 0.35 },
      { prop: 'table',       id: 'table',  x: 1.8,  z: 2.52 },
      { prop: 'chair',       id: 'chair1', x: 1.06, z: 2.5, rot: Math.PI / 2 },
      { prop: 'chair',       id: 'chair2', x: 2.54, z: 2.5, rot: -Math.PI / 2 },
      { prop: 'chair',       id: 'chair3', x: 1.8,  z: 3.1, rot: Math.PI },
      { prop: 'bookshelf',   id: 'pantry', x: 3.2,  z: 3.8, rot: -Math.PI / 2 },
      { prop: 'curtains',    id: 'curtains',x: 1.7,  z: 0.12, y: 1.06 },
      { prop: 'pan',         id: 'pan',     x: 2.95, z: 0.3,  y: 0.92 },
      { prop: 'kettle',      id: 'kettle',  x: 2.45, z: 0.35, y: 0.92 },
      { prop: 'wallClock',   id: 'clock',   x: 3.3,  z: 0.08 },
      { prop: 'lightSwitch', id: 'switch',  x: 3.28, z: 3.5,  y: 1.15 },
    ],
    clutter: [
      { prop: 'plate', id: 'plate',  x: 1.8,  z: 2.5, y: 0.76, home: 'kitchen.counter' },
      { prop: 'plate', id: 'plate2', x: 3.05, z: 0.35, y: 0.91, home: 'kitchen.counter' },
      { prop: 'mug',   id: 'mug',    x: 1.05, z: 2.5, y: 0.45, home: 'kitchen.counter' },
      { prop: 'whisk', id: 'whisk',  x: 1.1,  z: 3.5, y: 0.02, home: 'kitchen.drawer', homeLabel: 'в ящик' },
    ],
  },

  // ══════════════════════ КЛАДОВАЯ (3.4 × 3.6) ══════════════════════
  pantry: {
    items: [
      { prop: 'box',        id: 'box1', x: 0.45, z: 0.45 },
      { prop: 'box',        id: 'box2', x: 0.45, z: 0.95 },
      { prop: 'box',        id: 'box3', x: 0.45, z: 0.45, y: 0.4 },
      { prop: 'skis',       id: 'skis', x: 1.6,  z: 0.3 },
      { prop: 'floorLamp',  id: 'lamp', x: 2.9,  z: 0.5 },
      { prop: 'shelfJars',  id: 'jars', x: 1.7,  z: 3.15, rot: Math.PI },
      { prop: 'oldMattress',id: 'mattress', x: 2.45, z: 2.0, rot: Math.PI / 2 },
      { prop: 'cardboardBox', id: 'box4', x: 1.0, z: 3.1 },
      { prop: 'cardboardBox', id: 'box5', x: 1.0, z: 3.1, y: 0.38 },
      { prop: 'keyRack',     id: 'keys',  x: 0.1,  z: 2.0, y: 1.4, rot: Math.PI / 2 },
    ],
    clutter: [
      { prop: 'flashlight', id: 'flashlight', x: 0.45, z: 0.95, y: 0.42, home: 'childroom.desk', homeLabel: 'в детскую' },
      { prop: 'ball', id: 'ball', x: 1.9, z: 1.2, y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
    ],
  },

  // ══════════════════════ ЧЕРДАК (3.4 × 3.4) ══════════════════════
  attic: {
    items: [
      { prop: 'rafters',     id: 'rafters',  x: 1.7, z: 1.7 },
      { prop: 'diaryBox',    id: 'diary',    x: 2.45, z: 2.95 },
      { prop: 'box',         id: 'box1',     x: 0.45, z: 0.6 },
      { prop: 'box',         id: 'box2',     x: 0.95, z: 0.6 },
      { prop: 'shelfJars',   id: 'jars',     x: 2.9,  z: 2.6, rot: Math.PI / 2 },
      { prop: 'oldMattress', id: 'mattress', x: 2.4, z: 1.15, rot: Math.PI / 2 },
      { prop: 'cardboardBox', id: 'box3', x: 1.6, z: 3.0 },
      { prop: 'cardboardBox', id: 'box4', x: 1.6, z: 3.0, y: 0.38 },
      { prop: 'picture',     id: 'picture', x: 0.06, z: 1.7, y: 1.3, rot: Math.PI / 2 },
    ],
    clutter: [
      { prop: 'blocks', id: 'blocks', x: 1.0, z: 1.1, y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
    ],
  },

  // ══════════════════════ ПОДВАЛ (5.4 × 4.2) ══════════════════════
  basement: {
    items: [
      { prop: 'washer',      id: 'washer',   x: 0.45, z: 0.5 },
      { prop: 'boiler',      id: 'boiler',   x: 5.0,  z: 0.55 },
      { prop: 'shelfJars',   id: 'jars',     x: 2.7,  z: 0.32 },
      { prop: 'oldMattress', id: 'mattress', x: 1.25, z: 3.4 },
      { prop: 'box',         id: 'box1',     x: 4.9,  z: 3.6 },
      { prop: 'box',         id: 'box2',     x: 4.9,  z: 3.1 },
      { prop: 'floorLamp',   id: 'lamp',     x: 0.55, z: 3.7 },
      { prop: 'table',       id: 'bench',    x: 2.8,  z: 3.0 },
      { prop: 'laundryBasket', id: 'basket', x: 1.1,  z: 1.0 },
      { prop: 'cardboardBox', id: 'box3',   x: 2.2,  z: 5.0 },
      { prop: 'cardboardBox', id: 'box4',   x: 2.9,  z: 5.1 },
      { prop: 'kettle',      id: 'kettle',  x: 2.9,  z: 3.0, y: 0.72 },
    ],
    clutter: [
      { prop: 'scatteredClothes', id: 'clothes', x: 3.4, z: 2.4, y: 0.02, home: 'childroom.wardrobe', homeLabel: 'в детскую' },
      { prop: 'flashlight', id: 'flashlight', x: 0.45, z: 0.5, y: 0.85, home: 'childroom.desk', homeLabel: 'в детскую' },
      { prop: 'ball', id: 'ball', x: 2.1, z: 1.4, y: 0.02, home: 'childroom.toys', homeLabel: 'в детскую' },
      { prop: 'mug',  id: 'mug',  x: 2.8, z: 3.0,  y: 0.76, home: 'kitchen.counter', homeLabel: 'на кухню' },
    ],
  },
};

/** Куда вещи должны возвращаться. room: null — «в любой шкаф». */
export const HOMES = {
  'childroom.toys':     { room: 'childroom', label: 'полка с игрушками' },
  'childroom.desk':     { room: 'childroom', label: 'стол' },
  'childroom.wardrobe': { room: 'childroom', label: 'шкаф' },
  'parents.wardrobe':   { room: 'parents',   label: 'шкаф родителей' },
  'kitchen.counter':    { room: 'kitchen',   label: 'столешница' },
  'kitchen.fridge':     { room: 'kitchen',   label: 'холодильник' },
  'kitchen.drawer':     { room: 'kitchen',   label: 'ящик у плиты' },
  'bath.towels':        { room: 'bath',      label: 'полотенца' },
  'hall.shoes':         { room: 'hall',      label: 'обувница' },
  'hall.rack':          { room: 'hall',      label: 'вешалка' },
};
