// Feuerwehr Görtschach – Service Worker v12
// Cache-Invalidierung: leaflet Illegal constructor fix

const SHELL_CACHE   = 'ff-shell-v12';
const EINSATZ_CACHE = 'einsatzplaene-v2';

// ── Install: sofort übernehmen + index.html cachen ───────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async cache => {
      // index.html und manifest cachen für Offline-Fallback
      await Promise.allSettled([
        fetch('/', { cache: 'no-store' }).then(r => { if (r.ok) cache.put('/', r.clone()); cache.put('/index.html', r); }).catch(() => {}),
        fetch('/manifest.json').then(r => { if (r.ok) cache.put('/manifest.json', r); }).catch(() => {}),
      ]);
    })
  );
});

// ── Activate: alte Caches löschen ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const KEEP = [SHELL_CACHE, EINSATZ_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))))
    // KEIN clients.claim() → verhindert Reload-Loop in PWA
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1) Einsatzplan-Dateien: Cache-First
  if (url.pathname.startsWith('/uploads/einsatzplaene/')) {
    event.respondWith(
      caches.open(EINSATZ_CACHE).then(cache =>
        cache.match(event.request.url).then(cached => {
          if (cached) return cached;
          return fetch(event.request.url).then(response => {
            if (response.ok) cache.put(event.request.url, response.clone());
            return response;
          }).catch(() => new Response('Offline nicht verfügbar', { status: 503 }));
        })
      )
    );
    return;
  }

  // 2) API: immer Netz
  if (url.pathname.startsWith('/api/')) return;

  // 3) Navigation: Network-First, gecachte index.html als Offline-Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            // Frische index.html im Cache speichern
            caches.open(SHELL_CACHE).then(c => {
              c.put('/', response.clone());
              c.put('/index.html', response.clone());
            });
          }
          return response;
        })
        .catch(() =>
          // Offline: gecachte index.html
          caches.open(SHELL_CACHE).then(c =>
            c.match('/index.html').then(r => r || c.match('/'))
          )
        )
    );
    return;
  }

  // 4) Assets (/assets/): Cache-First
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(SHELL_CACHE).then(c => c.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Feuerwehr', body: event.data.text() }; }
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-72.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'feuerwehr-push',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Feuerwehr', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Messages ──────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_EINSATZPLAENE') {
    event.waitUntil(cacheEinsatzplaene(event.data.files, event.source));
  }
  if (event.data?.type === 'CLEAR_EINSATZPLAENE_CACHE') {
    event.waitUntil(caches.delete(EINSATZ_CACHE));
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Einsatzpläne cachen ───────────────────────────────────────────────────────
async function cacheEinsatzplaene(files, client) {
  const cache = await caches.open(EINSATZ_CACHE);
  const MAX_BYTES = 80 * 1024 * 1024;
  let totalSize = 0, cached = 0, skipped = 0, errors = 0;

  for (const file of files) {
    try {
      const absoluteUrl = file.url.startsWith('http') ? file.url : self.location.origin + file.url;
      const existing = await cache.match(absoluteUrl);
      if (existing) { cached++; continue; }

      const response = await fetch(absoluteUrl, { credentials: 'omit' });
      if (!response.ok) { errors++; continue; }

      const blob = await response.clone().blob();
      totalSize += blob.size;
      if (totalSize > MAX_BYTES) { skipped++; continue; }

      await cache.put(absoluteUrl, response);
      cached++;
      if (client) client.postMessage({ type: 'CACHE_PROGRESS', cached, total: files.length });
    } catch { errors++; }
  }

  if (client) client.postMessage({
    type: 'CACHE_COMPLETE', cached, skipped, errors,
    totalMB: (totalSize / 1024 / 1024).toFixed(1),
  });
}


