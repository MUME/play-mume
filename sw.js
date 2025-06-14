const CACHE_NAME = 'play-mume-cache-v1';
// List of URLs to cache. These should match the paths of the files in the 'dist' directory.
const urlsToCache = [
  '/',
  'index.html',
  'map.html',
  'main.bundle.js',
  'map.bundle.js',
  'play.css',
  'manifest.webmanifest',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  // Include other static assets copied by CopyWebpackPlugin if needed
  // For now, focusing on core files and explicitly copied assets.
  // mapdata/ and resources/ directories are copied, but listing every file
  // might be excessive. We can add specific critical assets if needed.
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
