const CACHE_NAME = 'play-mume-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  'play.css',
  'DecafMUD/src/css/main.css',
  'DecafMUD/src/css/mud-colors.css',
  'DecafMUD/src/css/decafmud.css',
  'DecafMUD/src/css/decafmud-dark.css',
  'node_modules/jquery/dist/jquery.min.js',
  'node_modules/jquery-throttle-debounce/jquery.ba-throttle-debounce.min.js',
  'node_modules/split.js/dist/split.min.js',
  'node_modules/pixi.js/dist/pixi.min.js',
  'node_modules/spark-md5/spark-md5.min.js',
  'DecafMUD/src/js/decafmud.js',
  'DecafMUD/src/js/decafmud.display.standard.js',
  'DecafMUD/src/js/decafmud.encoding.iso885915.js',
  'DecafMUD/src/js/decafmud.socket.websocket.js',
  'DecafMUD/src/js/decafmud.storage.standard.js',
  'DecafMUD/src/js/decafmud.interface.panels.js',
  'DecafMUD/src/js/decafmud.interface.panels.menu.js',
  'DecafMUD/src/js/decafmud.interface.panels.settings.js',
  'DecafMUD/src/js/dragelement.js',
  'built/errorhandler.js',
  'built/mume.macros.js',
  'built/mume.menu.js',
  'built/mume.mapper.js',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
  // Ensure all previously listed paths are here, but made relative.
  // The original list had '/' and '/index.html'. Consolidating to 'index.html' is fine.
  // Other paths just need the leading '/' removed.
];

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
