const CACHE_NAME = 'power-monitor-v1';
const urlsToCache = [
  '/Power-monitor/',
  '/Power-monitor/index.html',
  '/Power-monitor/manifest.json',
  '/Power-monitor/assets/css/styles.css',
  '/Power-monitor/assets/js/ble-connection.js',
  '/Power-monitor/assets/img/pmonitor.png',
  '/Power-monitor/assets/img/icon-192.png',
  '/Power-monitor/assets/img/icon-512.png',
  '/Power-monitor/assets/bootstrap/css/bootstrap.min.css',
  '/Power-monitor/assets/bootstrap/js/bootstrap.min.js'
];

// Instalacja Service Workera
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: instalacja...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ Cache otwarty');
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('⚠️ Niektóre pliki nie mogły być dodane do cache:', err);
        // Próbujemy cachować tylko lokalne pliki, ignorując CDN
        return cache.addAll(urlsToCache.filter(url => !url.includes('http')));
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
        // Gdy brak internetu, zwróć cache'owaną stronę
        return caches.match('/Power-monitor/index.html');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
