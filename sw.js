/* Service worker: ใช้งานออฟไลน์ได้
   - ไฟล์ของแอป (HTML/JS/CSS): ดึงจากเน็ตก่อน เพื่อให้ได้เวอร์ชันล่าสุดทันที ถ้าออฟไลน์ใช้ของในแคช
   - ไฟล์ภายนอก (ฟอนต์): ใช้แคชก่อน แล้วอัปเดตเบื้องหลัง */
const V = 'laundry-v13';
const F = [
  './', './index.html', './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/store.js', './assets/js/icons.js', './assets/js/ui.js', './assets/js/admin.js', './assets/js/receipt.js', './assets/js/printer.js', './assets/js/sync.js',
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
  const u = new URL(e.request.url);
  // เก็บแคชเฉพาะไฟล์ของแอปและฟอนต์ — ไม่ยุ่งกับข้อมูลซิงค์ / การเชื่อมต่อแบบสด / API อื่น ๆ
  if ((e.request.headers.get('accept') || '').includes('text/event-stream')) return;
  if (u.origin !== location.origin && !/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return;
  const put = r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; };
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(put).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(m => {
    const n = fetch(e.request).then(put).catch(() => m);
    return m || n;
  }));
});
