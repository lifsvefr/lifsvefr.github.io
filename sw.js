/* Lífsvefr service worker — only looks after the hub's own front page and pictures.
   Lífsteinn and Söguþræðir have their own service workers for their folders, so this one
   leaves everything else alone, and only ever tidies up its own old caches. */
const CACHE = 'lifsvefr-hub-v1';
const OWN = /^\/(index\.html|manifest\.webmanifest|sw\.js|favicon\.png|apple-touch-icon\.png|icon-[\w-]+\.png)?$/;
const APP_ICON = /^\/(lifestone|scriptorium|namelist)\/icon-192\.png$/;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(['./', './manifest.webmanifest', './icon-192.png', './favicon.png'].map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('lifsvefr-hub-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3500))]);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const m = await c.match(req) || (req.mode === 'navigate' ? await c.match('./') : null);
    if (m) return m;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin && (OWN.test(url.pathname) || APP_ICON.test(url.pathname));
  const fonts = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com');
  /* this worker only ever sees requests from pages it looks after (the hub itself), so fonts can be kept too */
  if (mine || fonts) {
    e.respondWith(networkFirst(e.request));
  }
});
