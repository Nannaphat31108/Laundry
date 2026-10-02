/* Service worker: ใช้งานออฟไลน์ได้ (cache-first + อัปเดตเบื้องหลัง) */
const V = 'laundry-v7';
const F = [
  './', './index.html', './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/store.js', './assets/js/icons.js', './assets/js/ui.js', './assets/js/admin.js', './assets/js/receipt.js', './assets/js/printer.js',
  './assets/js/views/home.js', './assets/js/views/order.js', './assets/js/views/customers.js',
  './assets/js/views/packages.js', './assets/js/views/receipts.js', './assets/js/views/accounts.js',
  './assets/js/views/settings.js', './assets/js/app.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(F))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x != V).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method != 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(m => {
    const n = fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') caches.open(V).then(c => c.put(e.request, r.clone()));
      return r;
    }).catch(() => m);
    return m || n;
  }));
});
