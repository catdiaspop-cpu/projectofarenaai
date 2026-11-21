// Типы комнат. Отдельный файл, чтобы house.mjs и props не тянули друг друга по кругу.

export const ROOM_KIND = {
  BASEMENT: 'basement',
  HALL: 'hall',
  LIVING: 'living',
  KITCHEN: 'kitchen',
  STAIRS: 'stairs',
  CORRIDOR: 'corridor',
  CHILD: 'child',
  PARENTS: 'parents',
  BATH: 'bath',
  STORAGE: 'storage',
  ATTIC: 'attic',
  YARD: 'yard',
};

/** Как комната выглядит: пол, стены, потолок. Используется сборщиком сцены. */
export const ROOM_LOOK = {
  // floor/wall/ceiling/trim — как было; wainscot и stripe — новая отделка стен.
  // Раньше стена была одной плоской коробкой, и все комнаты выглядели
  // одинаково коричневыми. Теперь у каждой свой низ и свои полосы.
  // fillet — цвет выступающего поля филёнки. Светлее панели: в ночной комнате
  // филёнка того же тона не видна вообще, и стена остаётся плоской.
  basement: { floor: 'floorWood', wall: 'wainscot', ceiling: 'ceiling', trim: 'metalDark', wainscot: 'wainscotStone', stripe: 'stripeCool', fillet: 'filletStone' },
  hall:     { floor: 'floorWood2', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotCream', stripe: 'stripeWarm', fillet: 'filletCream' },
  living:   { floor: 'floorWood', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotRed', stripe: 'stripeRose', fillet: 'filletRed' },
  kitchen:  { floor: 'lino', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'oak', wainscot: 'wainscotCream', stripe: 'stripeWarm', fillet: 'filletCream' },
  stairs:   { floor: 'floorWood', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotCream', stripe: 'stripeWarm', fillet: 'filletCream' },
  corridor: { floor: 'floorWood2', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotCream', stripe: 'stripeWarm', fillet: 'filletCream' },
  child:    { floor: 'floorWood', wall: 'wallpaper', ceiling: 'ceiling', trim: 'pine', wainscot: 'wainscotGreen', stripe: 'stripeRose', fillet: 'filletGreen' },
  parents:  { floor: 'floorWood', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotBlue', stripe: 'stripeCool', fillet: 'filletBlue' },
  bath:     { floor: 'lino', wall: 'bathWall', ceiling: 'ceiling', trim: 'metal', wainscot: 'wainscotStone', stripe: 'stripeCool', fillet: 'filletStone' },
  storage:  { floor: 'floorWood', wall: 'wainscot', ceiling: 'ceiling', trim: 'pine', wainscot: 'wainscotGreen', stripe: 'stripeWarm', fillet: 'filletGreen' },
  // на чердаке панели нет: там фанера от пола до скатов
  attic:    { floor: 'plywood', wall: 'plywood', ceiling: 'walnut', trim: 'walnut', wainscot: 'plywood', stripe: 'chipboard', flatWalls: true },
  yard:     { floor: 'asphalt', wall: 'foliage', ceiling: 'nightSky', trim: 'metal' },
};
