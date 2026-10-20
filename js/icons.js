// 線画アイコン（24×24、線の色は currentColor）。分野ごとのアイコンと画面の部品用
const P = {
  // 非言語
  wariai: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  soneki: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  waribiki: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  sokudo: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
  shigoto: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
  bunkatsu: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  seisan: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 14h2M3 10h18"/>',
  kakuritsu: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  baai: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v10M11 7l-5 10M13 7l5 10"/>',
  shugo: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  jun: '<path d="M3 20v-6h6v6M9 20V8h6v12M15 20v-9h6v9"/>',
  uchiwake: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l7 5"/>',
  shouhai: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  heikin: '<path d="M5 20v-8M10 20V8M15 20v-6M20 20V5"/><path d="M3 12h18" stroke-dasharray="2 2"/>',
  hyo: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  nagare: '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 11l10-4M7 13l10 4"/>',
  noudo: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>',
  nenrei: '<path d="M4 21h16v-8H4z"/><path d="M4 17c2 1 4 1 4 0s2-1 4 0 4 1 4 0 2-1 4 0"/><path d="M12 13V9M12 6c-1-1 0-3 0-3s1 2 0 3"/>',
  ryoiki: '<path d="M4 4v16h16"/><path d="M4 17L19 6"/><path d="M9 17l5-4v4z"/>',
  // 言語
  nigo: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  imi: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
  jukugo: '<rect x="3" y="7" width="8" height="10" rx="1.5"/><rect x="13" y="7" width="8" height="10" rx="1.5"/>',
  yoho: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  narabe: '<path d="M4 6h10M4 12h7M4 18h13"/><path d="M19 4v8M17 10l2 2 2-2"/>',
  kuuran: '<path d="M3 12h4M17 12h4"/><rect x="8" y="8" width="8" height="8" rx="1.5" stroke-dasharray="2 2"/>',
  choubun: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 19h4"/>',
  eigo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  kouzou: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  // 画面の部品
  flame: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 21l5-3 5 3-1.5-7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  book: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  retry: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  exam: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M8 10h8M8 14h8M8 18h5"/>',
  share: '<path d="M12 4v11M7 9l5-5 5 5M5 14v6h14v-6"/>',
};

export const icon = (name, cls = "") =>
  `<svg class="ico${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ""}</svg>`;

// HTML に書いた data-icon="名前" の要素の先頭にアイコンを入れる
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((e) => {
    if (!e.querySelector(":scope > svg.ico")) e.insertAdjacentHTML("afterbegin", icon(e.dataset.icon));
  });
}
