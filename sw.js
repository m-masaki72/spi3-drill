// オフライン対応用 Service Worker
// アプリ本体を更新したら CACHE のバージョンを上げる
const CACHE = "spi3-drill-v5";
const ASSETS = [
  "./",
  "index.html",
  "css/app.css",
  "js/app.js",
  "js/icons.js",
  "js/util.js",
  "js/nonverbal.js",
  "js/verbal.js",
  "js/points.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  // HTTP キャッシュ（GitHub Pages は max-age=600）の古いファイルを掴まないよう、ネットワークから取り直す
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // ページ本体：ネットワーク優先（最新版を取りに行き、オフライン時はキャッシュ）
  // 保存するのはアプリ本体（/ と /index.html）だけ。sitemap.xml などを開いたときに上書きしない
  if (req.mode === "navigate") {
    const isApp = /^\/(index\.html)?$/.test(new URL(req.url).pathname);
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && isApp) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // その他（CSS・JS・アイコン）：キャッシュ優先
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
    )
  );
});
