const CACHE_NAME = 'pe-survival-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // 古いキャッシュをすべて削除
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // APIリクエスト（/api/）およびGET以外の通信はService Workerを通さず直接ネットワークへ送る
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Network-First 戦略: 常に最新のHTML/アセットをサーバーから取得し、オフライン時のみキャッシュを使用
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // ネットワークがオフラインの場合のみキャッシュを返す
        return caches.match(event.request);
      })
  );
});

