const CACHE='patrimoine-simulator-v174-mobile-ui';
const ASSETS=[
  './',
  './index.html',
  './mobile.css',
  './mobile-v2.css',
  './mobile-v21.css',
  './mobile-nav-v21.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

const MOBILE_STYLE = [
  '<link rel="stylesheet" href="./mobile.css?v=174" media="(max-width: 720px)">',
  '<link rel="stylesheet" href="./mobile-v2.css?v=174" media="(max-width: 720px)">',
  '<link rel="stylesheet" href="./mobile-v21.css?v=174" media="(max-width: 720px)">',
  '<meta name="theme-color" media="(max-width: 720px)" content="#070b14">',
  '<script defer src="./mobile-nav-v21.js?v=174"></script>'
].join('');

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(client => client.navigate(client.url).catch(() => null)));
  })());
});

async function injectMobileLayer(response) {
  if (!response || !response.ok) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes('mobile-nav-v21.js?v=174')) {
    return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  const patched = html.replace('</head>', `${MOBILE_STYLE}</head>`);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(patched, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate' ||
    (url.origin === self.location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')));

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const network = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put('./index.html', network.clone()).catch(() => {});
        return injectMobileLayer(network);
      } catch {
        const cached = await caches.match('./index.html');
        return injectMobileLayer(cached);
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const network = await fetch(event.request);
      const cache = await caches.open(CACHE);
      cache.put(event.request, network.clone()).catch(() => {});
      return network;
    } catch {
      return (await caches.match(event.request)) || Response.error();
    }
  })());
});
