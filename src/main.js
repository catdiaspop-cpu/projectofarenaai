// Точка входа: подключаем интерфейс и включаем офлайн-режим.

import './ui.js';

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // офлайн нужен только на опубликованном сайте; локальная разработка — без кэша
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* офлайн необязателен: игра работает и без него */
    });
  });
}
