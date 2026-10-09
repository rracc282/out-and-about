/* Out & About service worker: offline copy of the app + push notifications */
const CACHE = "oa-v43";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
/* network first, so the weekly refreshes show up straight away; cached copy when offline */
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
});
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: "Out & About", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Out & About", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag, data: { url: d.url || "./", rate: d.rate }, actions: d.rate ? [{ action: "up", title: "👍 Liked it" }, { action: "down", title: "👎 Not for me" }] : []
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const dd = e.notification.data || {};
  const target = dd.rate && e.action ? "./#rate=" + encodeURIComponent(dd.rate) + ":" + e.action : (dd.url || "./");
  const url = new URL(target, self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if (c.url.startsWith(self.registration.scope)) { c.navigate(url); return c.focus(); }
    return clients.openWindow(url);
  }));
});
