/* BANTAY-TB service worker.
 *
 * Keeps the app's own files on the device so a second visit opens at once,
 * even on a weak connection. What it stores, and how:
 *
 *   /assets/*          Cache first. Vite puts a content hash in every name, so
 *                      a cached copy can never be out of date. Keeping old
 *                      chunks around also means a tab opened before a deploy
 *                      can still load the pages it asks for.
 *   /images/*, /data/* Stale-while-revalidate: show the stored copy, refresh
 *   and map tiles      it in the background.
 *   Page loads         Network first, so an online user always gets the newest
 *                      index.html. Falls back to the stored one when the
 *                      network is down or slower than NAV_TIMEOUT_MS.
 *
 * What it never touches: Supabase (all patient and case data, auth, RPCs,
 * Edge Functions) and any other request that is not a plain GET. Health data
 * stays in memory, scoped by RLS, exactly as before.
 *
 * To retire this worker, replace this file with one that calls
 * self.registration.unregister() and deploy it.
 */

const VERSION = "v1";
const SHELL = `bantay-shell-${VERSION}`;
const ASSETS = `bantay-assets-${VERSION}`;
const MEDIA = `bantay-media-${VERSION}`;
const TILES = `bantay-tiles-${VERSION}`;
const KEEP = [SHELL, ASSETS, MEDIA, TILES];

const NAV_TIMEOUT_MS = 3500;
const LIMITS = { [ASSETS]: 250, [MEDIA]: 120, [TILES]: 400 };

const TILE_HOSTS = ["tiles.openfreemap.org"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add(new Request("/index.html", { cache: "reload" })))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("bantay-") && !KEEP.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {
      event.respondWith(networkFirstPage(req));
      return;
    }
    if (url.pathname === "/sw.js") return;
    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(cacheFirst(req, ASSETS));
      return;
    }
    if (url.pathname.startsWith("/images/") || url.pathname.startsWith("/data/")) {
      event.respondWith(staleWhileRevalidate(event, req, MEDIA));
      return;
    }
    return;
  }

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req, TILES));
  }
  // Everything else — Supabase above all — goes straight to the network.
});

/** Only keep real, complete, readable responses. Opaque ones can't be
 *  checked and cost several MB of quota each. */
function storable(res) {
  return res && res.ok && res.status === 200 && (res.type === "basic" || res.type === "cors");
}

async function put(cacheName, req, res) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(req, res);
    const limit = LIMITS[cacheName];
    if (limit) {
      const keys = await cache.keys();
      // keys() comes back oldest first; drop from the front.
      for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
    }
  } catch {
    // Quota exceeded or storage unavailable — serving still works without it.
  }
}

async function networkFirstPage(req) {
  const cache = await caches.open(SHELL);
  const network = fetch(req).then((res) => {
    if (storable(res)) void put(SHELL, "/index.html", res.clone());
    return res;
  });
  // If the timeout wins and the network later fails, don't leave that
  // rejection unhandled.
  network.catch(() => undefined);

  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve(null), NAV_TIMEOUT_MS)
  );

  try {
    const winner = await Promise.race([network, timeout]);
    if (winner) return winner;
  } catch {
    // Offline — fall through to the stored shell.
  }

  const cached = await cache.match("/index.html");
  if (cached) return cached;
  // Nothing stored yet (first visit on a slow line): wait for the network.
  return network;
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (storable(res)) void put(cacheName, req, res.clone());
  return res;
}

async function staleWhileRevalidate(event, req, cacheName) {
  const cached = await caches.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (storable(res)) void put(cacheName, req, res.clone());
      return res;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const res = await refresh;
  return res || Response.error();
}
