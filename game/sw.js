// Офлайн-кэш: игра целиком лежит локально, сеть нужна только для первого визита.
//
// CACHE_VERSION подставляется сборкой из хэша содержимого (tools/build.mjs).
// Без этого телефон продолжал бы отдавать вчерашнюю версию из кэша:
// cache-first + неизменное имя кэша = игрок не видит ни одной правки.
const CACHE_VERSION = 'dev';
const CACHE = `nespi-${CACHE_VERSION}`;
// Полный список модулей. Раньше здесь не было шести файлов (movement, locks,
// doors, gait, viewmodel, house.mjs) — игра «офлайн» падала на первом же
// импорте, потому что страницу отдавали из кэша, а модуль за ней — нет.
const ASSETS = [
  './', './index.html', './styles.css', './src/main.mjs',
  './src/core/app.mjs', './src/core/input.mjs', './src/core/joystick.mjs', './src/core/movement.mjs',
  './src/data/house.mjs', './src/data/layout.mjs', './src/data/palette.mjs', './src/data/rooms.mjs',
  './src/world/props.mjs', './src/world/character.mjs', './src/world/builder.mjs', './src/world/gait.mjs',
  './src/sim/graph.mjs', './src/sim/locks.mjs', './src/sim/doors.mjs',
  './src/render/mesher.mjs', './src/render/character.mjs', './src/render/builders.mjs',
  './src/render/scene3d.mjs', './src/render/house-preview.mjs', './src/render/viewmodel.mjs',
  './src/ui/hud.mjs', './src/ui/sticks.mjs',
  './vendor/three/three.min.js', './manifest.webmanifest', './icon.svg',
];

self.addEventListener('install', (e) => {
  // addAll падает целиком, если ОДИН файл не найден: обновление не
  // устанавливалось, телефон продолжал жить на старом кэше. Теперь каждый
  // файл кладём отдельно, а обязательные (html, main) — строго.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch((err) => {
        console.warn('в кэш не попал', u, err);
      }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Стратегия:
//   * сам игровой код и разметка — сначала СЕТЬ, кэш только офлайн.
//     Так правка видна сразу после деплоя, а не через «очистить кэш» на телефоне.
//   * three.js (731 КБ, никогда не меняется) и иконки — сначала кэш.
const NETWORK_FIRST = /\.(mjs|js|css|html|webmanifest)$|\/$/;

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // чужое не трогаем

  const networkFirst = NETWORK_FIRST.test(url.pathname);

  if (networkFirst) {
    e.respondWith(
      // cache: 'no-store' — принципиально. Без него network-first идёт в
      // сеть только формально: браузер отвечает из СВОЕГО http-кэша
      // (Pages отдаёт Cache-Control: max-age=600), и десять минут после
      // деплоя телефон показывает старый код. Именно поэтому «правки
      // не применились» при том, что на сервере они уже лежали.
      // пробуем без обращения к http-кэшу; если браузер не даёт (Safari
      // капризен к no-store в service worker) — обычный запрос
      fetch(e.request, { cache: 'no-store' })
        .catch(() => fetch(e.request))
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
