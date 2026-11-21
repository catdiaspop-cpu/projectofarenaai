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
  basement: { floor: 'floorWood', wall: 'wainscot', ceiling: 'ceiling', trim: 'metalDark', wainscot: 'wainscotStone', stripe: 'stripeCool' },
  hall:     { floor: 'floorWood2', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotCream', stripe: 'stripeWarm' },
  living:   { floor: 'floorWood', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotRed', stripe: 'stripeRose' },
  kitchen:  { floor: 'lino', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'oak', wainscot: 'wainscotCream', stripe: 'stripeWarm' },
  stairs:   { floor: 'floorWood', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotCream', stripe: 'stripeWarm' },
  corridor: { floor: 'floorWood2', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotCream', stripe: 'stripeWarm' },
  child:    { floor: 'floorWood', wall: 'wallpaper', ceiling: 'ceiling', trim: 'pine', wainscot: 'wainscotGreen', stripe: 'stripeRose' },
  parents:  { floor: 'floorWood', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'walnut', wainscot: 'wainscotBlue', stripe: 'stripeCool' },
  bath:     { floor: 'lino', wall: 'bathWall', ceiling: 'ceiling', trim: 'metal', wainscot: 'wainscotStone', stripe: 'stripeCool' },
  storage:  { floor: 'floorWood', wall: 'wainscot', ceiling: 'ceiling', trim: 'pine', wainscot: 'wainscotGreen', stripe: 'stripeWarm' },
  // на чердаке панели нет: там фанера от пола до скатов
  attic:    { floor: 'plywood', wall: 'plywood', ceiling: 'walnut', trim: 'walnut', wainscot: 'plywood', stripe: 'chipboard', flatWalls: true },
  yard:     { floor: 'asphalt', wall: 'foliage', ceiling: 'nightSky', trim: 'metal' },
};
