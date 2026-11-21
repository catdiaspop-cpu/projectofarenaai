// Офлайн-кэш: игра целиком лежит локально, сеть нужна только для первого визита.
//
// CACHE_VERSION подставляется сборкой из хэша содержимого (tools/build.mjs).
// Без этого телефон продолжал бы отдавать вчерашнюю версию из кэша:
// cache-first + неизменное имя кэша = игрок не видит ни одной правки.
const CACHE_VERSION = 'dev';
const CACHE = `nespi-${CACHE_VERSION}`;
const ASSETS = [
  './', './index.html', './styles.css', './src/main.mjs',
  './src/core/app.mjs', './src/core/input.mjs', './src/core/joystick.mjs',
  './src/data/house.mjs', './src/data/layout.mjs', './src/data/palette.mjs', './src/data/rooms.mjs',
  './src/world/props.mjs', './src/world/character.mjs', './src/world/builder.mjs',
  './src/sim/graph.mjs', './src/render/mesher.mjs', './src/render/character.mjs',
  './src/render/builders.mjs', './src/render/scene3d.mjs', './src/render/house-preview.mjs',
  './src/ui/hud.mjs', './src/ui/sticks.mjs', './vendor/three/three.min.js', './manifest.webmanifest', './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
      fetch(e.request)
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
