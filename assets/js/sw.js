const CACHE_NAME = 'power-monitor-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  '/ble-connection.js',
  '/pmonitor.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.8/js/bootstrap.min.js'
];


// Instalacja Service Workera
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: instalacja...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ Cache otwarty');
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('⚠️ Niektóre pliki nie mogły być dodane do cache:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Aktywacja Service Workera
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker: aktywacja...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Stary cache usunięty:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Cache first, fallback to network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
