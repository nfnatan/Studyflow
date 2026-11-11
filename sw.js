/* Service worker: abre o app offline, exibe notificações e abre o app ao tocar nelas. */
const C = 'studyflow-v4', ARQ = ['./', 'index.html', 'css/style.css', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', (ev) => { self.skipWaiting(); ev.waitUntil(caches.open(C).then((c) => c.addAll(ARQ))); });
self.addEventListener('activate', (ev) => ev.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== C).map((n) => caches.delete(n)))).then(() => clients.claim())));
self.addEventListener('fetch', (ev) => {
  if (ev.request.url.includes('api.github.com')) return;                // dados sempre vêm da rede
  ev.respondWith(fetch(ev.request).catch(() => caches.match(ev.request))); // rede primeiro, cache se offline
});
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  ev.waitUntil(clients.matchAll({ type: 'window' }).then((l) => (l[0] ? l[0].focus() : clients.openWindow('./'))));
});
