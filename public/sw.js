// Semantic Authoring — service worker
//
// Deliberately conservative. The scholar's workspace is private and often
// unsaved, so this never caches authenticated HTML: a stale page showing
// yesterday's draft would be worse than an honest offline notice.
//
//   static assets  → cache first
//   navigations    → network first, offline page as fallback
//   captures       → queued in IndexedDB when offline, replayed on reconnect

const VERSION = "sa-v2";
const SHELL = `${VERSION}-shell`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, "/icon.svg"]))
      .then(() => self.skipWaiting()).catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never serve a cached version of the private workspace.
  const isAppHtml = request.mode === "navigate" && url.pathname.startsWith("/app");

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error())),
    );
    return;
  }

  if (isAppHtml) return;

  // Static build output is content-hashed, so cache-first is safe.
  if (url.pathname.startsWith("/_next/static") || url.pathname === "/icon.svg" ||
      url.pathname === "/hero-poster.jpg") {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ?? fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })),
    );
  }
});

// Replay queued captures when the browser regains connectivity.
self.addEventListener("sync", (event) => {
  if (event.tag === "sa-capture-sync") event.waitUntil(flushQueue());
});

async function flushQueue() {
  const db = await openDb();
  const items = await allItems(db);
  for (const item of items) {
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) await deleteItem(db, item.id);
    } catch { break; }   // still offline; keep the rest queued
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sa-offline", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("captures", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function allItems(db) {
  return new Promise((resolve) => {
    const tx = db.transaction("captures", "readonly");
    const req = tx.objectStore("captures").getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => resolve([]);
  });
}
function deleteItem(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction("captures", "readwrite");
    tx.objectStore("captures").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
