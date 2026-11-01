// 離線快取：同源檔案與鎖定版本的 CDN 腳本；更新版本時修改 CACHE 名稱
const CACHE = 'hcc-calc-v2.2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  'https://cdn.tailwindcss.com/3.4.16', 'https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 網路優先（拿到最新版），離線時退回快取
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./index.html')))
  );
});
