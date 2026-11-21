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
  basement: { floor: 'floorWood', wall: 'wainscot', ceiling: 'ceiling', trim: 'metalDark' },
  hall:     { floor: 'floorWood2', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut' },
  living:   { floor: 'floorWood', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut' },
  kitchen:  { floor: 'lino', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'oak' },
  stairs:   { floor: 'floorWood', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'walnut' },
  corridor: { floor: 'floorWood2', wall: 'wallpaper', ceiling: 'ceiling', trim: 'walnut' },
  child:    { floor: 'floorWood', wall: 'wallpaper', ceiling: 'ceiling', trim: 'pine' },
  parents:  { floor: 'floorWood', wall: 'wallpaper2', ceiling: 'ceiling', trim: 'walnut' },
  bath:     { floor: 'lino', wall: 'tulle', ceiling: 'ceiling', trim: 'metal' },
  storage:  { floor: 'floorWood', wall: 'wainscot', ceiling: 'ceiling', trim: 'pine' },
  attic:    { floor: 'plywood', wall: 'plywood', ceiling: 'walnut', trim: 'walnut' },
  yard:     { floor: 'asphalt', wall: 'foliage', ceiling: 'nightSky', trim: 'metal' },
};
