const CACHE_NAME = 'daiichi-travel-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for API/Firebase requests
  const url = new URL(event.request.url);
  const hostname = url.hostname;
  if (
    hostname === 'firebaseio.com' || hostname.endsWith('.firebaseio.com') ||
    hostname === 'googleapis.com' || hostname.endsWith('.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) =>
            cached ||
            new Response('Ứng dụng đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
        )
      )
  );
});
