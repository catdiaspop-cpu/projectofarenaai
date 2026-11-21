// Вспомогательное: движение по заранее проложенному пути.
//
// Больше НЕ является управлением. Раньше здесь жил GestureParser с тапом по
// полу — этот способ отвергнут: на телефоне палец закрывает экран, попасть
// в точку нельзя, и телепортация вместо шага. Управление теперь в ui/sticks.mjs
// (левый стик + свайп), а физика шага — в core/movement.mjs.
//
// Остался только stepAlong: он нужен сюжетным сценам, где мальчик идёт сам.

export function stepAlong(path, progress, speed, dt) {
  // путь может быть массивом точек или объектом { points }
  const pts = Array.isArray(path) ? path : path?.points;
  if (!pts || pts.length < 2) return { x: pts?.[0]?.x ?? 0, z: pts?.[0]?.z ?? 0, done: true, dir: 0 };
  const path_ = pts;
  let left = speed * dt;
  let i = progress.i ?? 0;
  let x = progress.x ?? path_[0].x;
  let z = progress.z ?? path_[0].z;
  while (left > 0 && i < path_.length - 1) {
    const target = path_[i + 1];
    const d = Math.hypot(target.x - x, target.z - z);
    if (d <= left) {
      x = target.x; z = target.z; left -= d; i++;
    } else {
      x += ((target.x - x) / d) * left;
      z += ((target.z - z) / d) * left;
      left = 0;
    }
  }
  const done = i >= path_.length - 1;
  const next = path_[Math.min(i + 1, path_.length - 1)];
  const prev = path_[Math.max(0, i)];
  const dir = Math.atan2(next.x - prev.x, next.z - prev.z);
  return { x, z, done, dir, i };
}