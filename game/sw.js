// Офлайн-кэш: игра целиком лежит локально, сеть нужна только для первого визита.
const CACHE = 'nespi-v1';
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
