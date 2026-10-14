const CACHE_NAME = 'meu-bolso-public-__VERSION__';
const ASSETS = __ASSETS__;
const PUBLIC_PATHS = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('meu-bolso-public-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.status < 500) return response;
      } catch { /* The offline page does not contain financial or session data. */ }
      const cache = await caches.open(CACHE_NAME);
      return await cache.match('/offline.html') || new Response('Sem conexão com o servidor.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
  } else if (PUBLIC_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      try { const response = await fetch(request); if (response.status < 500) return response; } catch { /* Use only the public fallback assets. */ }
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(url.pathname) || Response.error();
    })());
  }
});
