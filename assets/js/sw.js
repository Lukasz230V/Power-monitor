const CACHE_NAME = 'power-monitor-v1';
const urlsToCache = [
  '/Power-monitor/',
  '/Power-monitor/index.html',
  '/Power-monitor/manifest.json',
  '/Power-monitor/assets/css/styles.css',
  '/Power-monitor/assets/js/ble-connection.js',
  '/Power-monitor/assets/img/pmonitor.png',
  '/Power-monitor/assets/img/icon-192.png',
  '/Power-monitor/assets/img/icon-512.png'
];

// Instalacja Service Workera
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: instalacja...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ Cache otwarty');
      // Cachuj tylko lokalne pliki, ignoruj CDN
      return Promise.all(
        urlsToCache.map(url => 
          fetch(url)
            .then(response => {
              if (response.ok) {
                cache.put(url, response);
                console.log('✅ Cached:', url);
              }
            })
            .catch(err => {
              console.warn('⚠️ Nie mogę cachować:', url, err);
            })
        )
      );
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
  // Ignoruj requesty POST i inne metody
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Jeśli znaleziono w cache, zwróć z cache
      if (response) {
        console.log('📦 Z cache:', event.request.url);
        return response;
      }

      // W przeciwnym razie spróbuj z sieci
      return fetch(event.request).then(response => {
        // Sprawdzenie czy response jest poprawny
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Sklonuj response
        const responseToCache = response.clone();

        // Dodaj do cache dla przyszłych requestów (tylko lokalne zasoby)
        if (!event.request.url.includes('cdn') && !event.request.url.includes('http')) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
            console.log('✅ Dodano do cache:', event.request.url);
          });
        }

        return response;
      }).catch(err => {
        console.log('❌ Offline - brak zasobu w cache:', event.request.url);
        // Jeśli sieć niedostępna, zwróć offline page
        return caches.match('/Power-monitor/index.html');
      });
    })
  );
});

// Obsługa komunikacji z aplikacją
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
