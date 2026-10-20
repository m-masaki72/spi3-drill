// 画面の切り替え・出題・採点・記録
import { makeRng } from "./util.js";
import { NONVERBAL } from "./nonverbal.js";
import { VERBAL } from "./verbal.js";
import { POINTS } from "./points.js";
import { icon, hydrateIcons } from "./icons.js";

const CATS = [...NONVERBAL.map((c) => ({ ...c, group: "非言語" })), ...VERBAL.map((c) => ({ ...c, group: "言語" }))];
const byId = Object.fromEntries(CATS.map((c) => [c.id, c]));
const LETTERS = "ABCDEFGH";
const MODES = {
  easy: { name: "お手軽", desc: "小さな数で解き方の要点だけ。答えるとすぐに正誤と解説が出ます。時間制限はありません。" },
  exam: { name: "本番", desc: "本番に近い数と形式で、1問ごとに制限時間があります。メモと電卓が使えます。解説は最後にまとめて出ます。" },
};
const TYPE_RATE = 0.35; // 本番で数値を直接入力させる割合
const MOCK_N = 15; // 模試の1セクションの問題数（言語・非言語それぞれ）
const GOALS = [5, 10, 20, 30];
const BADGES = [
  { id: "first", name: "はじめの1セット", icon: "play" },
  { id: "perfect", name: "全問正解", icon: "star" },
  { id: "goal", name: "1日の目標を達成", icon: "target" },
  { id: "streak3", name: "3日連続", icon: "flame" },
  { id: "streak7", name: "7日連続", icon: "flame" },
  { id: "q100", name: "累計100問", icon: "check" },
  { id: "q500", name: "累計500問", icon: "award" },
  { id: "mock", name: "模試に挑戦", icon: "exam" },
  { id: "allcats", name: "全分野に挑戦", icon: "book" },
];
const OK_MSG = ["正解！", "お見事！", "その調子！", "バッチリです！"];
const NG_MSG = ["惜しい！", "ここで覚えましょう", "次は取れます"];
const CHEER = {
  s: ["素晴らしい出来です！", "本番もこの調子でいけます！"],
  a: ["よくできました！", "あと一歩で満点圏です！"],
  b: ["半分以上正解、いい感じです", "解説を読んで、もう1セットいきましょう"],
  c: ["ここからが伸びどころです", "間違えた分野を見直してみましょう"],
};
const WEEK = "日月火水木金土";

const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const gk = (c) => (c.group === "言語" ? "v" : "nv");

// ---- 保存（使えない環境でも動くようにすべて try/catch） ----
const store = {
  get(k, def) {
    try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても続ける */ }
  },
};
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

let mode = store.get("spi3Mode", "easy");
if (!MODES[mode]) mode = "easy";
let count = store.get("spi3Count", 10);
if (![5, 10, 20].includes(count)) count = 10;
let goal = store.get("spi3Goal", 10);
if (!GOALS.includes(goal)) goal = 10;
let group = store.get("spi3Group", "nv") === "v" ? "v" : "nv";
let stats = obj(store.get("spi3Stats", {}));
let mocks = store.get("spi3Mock", []);
if (!Array.isArray(mocks)) mocks = [];
let days = obj(store.get("spi3Days", {})); // { "YYYY-MM-DD": その日に解いた問題数 }（直近60日）
let best = obj(store.get("spi3Best", {})); // 条件ごとの最高正答率
let streakBest = store.get("spi3StreakBest", 0);
let badges = store.get("spi3Badges", []);
if (!Array.isArray(badges)) badges = [];

const dayKey = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
function streak() {
  const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1); // 今日まだ解いていなくても、昨日までの連続は切らない
  let n = 0;
  while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const statOf = (m, id) => stats[m]?.[id] ?? { n: 0, ok: 0, sec: 0 };
function record(id, ok, sec, m) {
  stats[m] ??= {};
  const s = statOf(m, id);
  stats[m][id] = { n: s.n + 1, ok: s.ok + (ok ? 1 : 0), sec: s.sec + sec };
  store.set("spi3Stats", stats);
  const k = dayKey();
  days[k] = (days[k] ?? 0) + 1;
  for (const old of Object.keys(days).sort().slice(0, -60)) delete days[old];
  store.set("spi3Days", days);
  const st = streak();
  if (st > streakBest) { streakBest = st; store.set("spi3StreakBest", st); }
}
const pct = (ok, n) => Math.round((ok / n) * 100);
const mmss = (sec) => `${Math.floor(sec / 60)}分${String(Math.floor(sec % 60)).padStart(2, "0")}秒`;
const avgTime = (ids, m) => ids.reduce((a, id) => a + byId[id].time[m === "exam" ? 1 : 0], 0) / ids.length;
const groupIds = (g) => CATS.filter((c) => c.group === g).map((c) => c.id);

function show(id) {
  for (const s of ["home", "quiz", "result"]) $(`#${s}`).hidden = s !== id;
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

// 分野の公式・ポイント（折りたたみ）
const pointsList = (id) => `<ul>${(POINTS[id] ?? []).map((p) => `<li>${p}</li>`).join("")}</ul>`;
const pointsHtml = (id) => (POINTS[id] ? `<details class="pts"><summary>公式・ポイント</summary>${pointsList(id)}</details>` : "");

// ---- ホーム ----
function renderHero() {
  const today = days[dayKey()] ?? 0, st = streak();
  $("#h-streak").textContent = st;
  $("#h-streak").closest(".hs").classList.toggle("streak-on", st > 0);
  $("#h-today").textContent = today;
  $("#h-goal").textContent = `${Math.min(today, goal)}/${goal}`;
  $("#h-goal").closest(".hs").classList.toggle("done", today >= goal);
  $("#h-ring").setAttribute("stroke-dashoffset", 100 - Math.min(100, (today / goal) * 100));
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const cells = [];
  for (let k = 0; k < 7; k++) {
    const on = !!days[dayKey(d)];
    cells.push(el("span", `${on ? "on" : ""}${k === 6 ? " today" : ""}`, `<i>${on ? icon("check") : ""}</i>${k === 6 ? "今日" : WEEK[d.getDay()]}`));
    d.setDate(d.getDate() + 1);
  }
  $("#h-week").replaceChildren(...cells);
  document.querySelectorAll("#goal-seg [data-goal]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.goal === goal));
}

function renderHome() {
  document.body.dataset.mode = mode;
  document.querySelectorAll("#modesw [data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode));
  $("#modesw").dataset.active = mode;
  document.querySelectorAll("[data-count]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.count === count));
  $("#mode-desc").textContent = MODES[mode].desc;
  $("#mix-eta").textContent = `${count}問・目安${Math.max(1, Math.round((avgTime(CATS.map((c) => c.id), mode) * count) / 60))}分`;
  $("#mock-time").textContent = `約${Math.round((avgTime(groupIds("言語"), "exam") * MOCK_N + avgTime(groupIds("非言語"), "exam") * MOCK_N) / 60)}分`;
  for (const g of ["非言語", "言語"]) {
    const box = $(g === "言語" ? "#cats-verbal" : "#cats-nonverbal");
    box.replaceChildren(...CATS.filter((c) => c.group === g).map((c) => {
      const s = statOf(mode, c.id), p = s.n ? pct(s.ok, s.n) : 0;
      const [lc, lt] = !s.n ? ["", "未挑戦"] : s.n < 5 ? ["", "練習中"] : p >= 80 ? ["good", "得意"] : p >= 50 ? ["mid", "あと少し"] : ["low", "要復習"];
      const b = el("button", "cat", `<span class="cat-ico">${icon(c.id)}</span><span class="cat-name">${c.name}</span><span class="cat-stat"><span class="lv ${lc}">${lt}</span>${s.n ? `${s.n}問` : ""}</span><span class="cat-ring"><span>${s.n ? `${p}%` : "—"}</span></span><span class="cat-tip">${c.tip}</span>`);
      b.type = "button";
      b.dataset.group = gk(c);
      b.style.setProperty("--p", p); // CSP で style 属性は使えないので JS で入れる
      b.addEventListener("click", () => start({ ids: [c.id], label: c.name }));
      return b;
    }));
  }
  renderTabs();
  const total = Object.values(stats[mode] ?? {}).reduce((a, s) => ({ n: a.n + s.n, ok: a.ok + s.ok }), { n: 0, ok: 0 });
  $("#home-total").textContent = total.n ? `${MODES[mode].name}モードの記録：${total.n}問・正答率${pct(total.ok, total.n)}%` : "";
  renderHero();
  renderWeak();
  renderMockLast();
  renderBadges();
}

function renderTabs() {
  document.querySelectorAll("[data-gtab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.gtab === group));
  $("#cats-nonverbal").hidden = group !== "nv";
  $("#cats-verbal").hidden = group !== "v";
}

function renderPoints() {
  $("#points-all").innerHTML = ["非言語", "言語"].map((g) => `<div data-group="${gk({ group: g })}"><h3>${icon(g === "言語" ? "text" : "calc")}${g}</h3>${CATS.filter((c) => c.group === g)
    .map((c) => `<details class="pts"><summary>${icon(c.id)}${c.name}</summary>${pointsList(c.id)}</details>`).join("")}</div>`).join("");
}

// 苦手分析：挑戦した分野を正答率の低い順（または目安時間に対して遅い順）に並べる
let weakSort = "acc";
function renderWeak() {
  const exam = mode === "exam", ti = exam ? 1 : 0;
  const tried = CATS.map((c) => ({ c, s: statOf(mode, c.id) })).filter((x) => x.s.n > 0);
  $("#weak-card").hidden = tried.length === 0;
  if (!tried.length) return;
  const tot = tried.reduce((a, { s }) => ({ n: a.n + s.n, ok: a.ok + s.ok }), { n: 0, ok: 0 });
  $("#weak-kpis").innerHTML = `<div><b>${tot.n}</b><span>解いた問題</span></div><div><b>${pct(tot.ok, tot.n)}%</b><span>正答率</span></div><div><b>${tried.length}/${CATS.length}</b><span>挑戦した分野</span></div>`;
  document.querySelectorAll("#weak-sort [data-sort]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.sort === weakSort));
  const slow = (x) => x.s.sec / x.s.n / x.c.time[ti];
  const rows = [...tried].sort(weakSort === "acc"
    ? (a, b) => a.s.ok / a.s.n - b.s.ok / b.s.n || b.s.n - a.s.n
    : (a, b) => slow(b) - slow(a)).slice(0, 6);
  $("#weak-desc").textContent = `${MODES[mode].name}モードの記録から${weakSort === "acc" ? "正答率の低い" : `${exam ? "制限" : "目安"}時間に対して時間のかかっている`}分野を表示しています。押すとその分野を練習できます。`;
  $("#weak-list").replaceChildren(...rows.map((x) => {
    const { c, s } = x;
    const p = pct(s.ok, s.n), avg = Math.round(s.sec / s.n), target = c.time[ti], r = slow(x);
    const b = el("button", "weak-row", `${icon(c.id)}<span class="name">${c.group}・${c.name}</span><span class="pct">${weakSort === "acc" ? `${p}%` : `${avg}秒`}</span><span class="meter"><div></div></span><span class="info">${s.n}問・正答率${p}%・平均${avg}秒（${exam ? "制限" : "目安"}${target}秒）${avg > target ? '<span class="slow">・時間オーバー気味</span>' : ""}</span>`);
    b.type = "button";
    b.dataset.group = gk(c);
    const bar = b.querySelector(".meter > div");
    if (weakSort === "acc") {
      bar.style.setProperty("--p", Math.max(p, 2));
      if (p < 50) bar.classList.add("low"); else if (p < 75) bar.classList.add("mid");
    } else {
      bar.style.setProperty("--p", Math.min(100, Math.max(2, r * 100)));
      if (r > 1) bar.classList.add("low"); else if (r > 0.8) bar.classList.add("mid");
    }
    b.addEventListener("click", () => start({ ids: [c.id], label: c.name }));
    return b;
  }));
  $("#weak-all").innerHTML = `<table><thead><tr><th>分野</th><th>問題数</th><th>正答率</th><th>平均</th></tr></thead><tbody>${CATS.map((c) => {
    const s = statOf(mode, c.id);
    return `<tr><td>${c.group}・${c.name}</td><td>${s.n || "—"}</td><td>${s.n ? `${pct(s.ok, s.n)}%` : "—"}</td><td>${s.n ? `${Math.round(s.sec / s.n)}秒` : "—"}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function renderMockLast() {
  const last = mocks.at(-1);
  if (!last) { $("#mock-last").textContent = ""; return; }
  const sum = (m) => m.s.reduce((a, [ok]) => a + ok, 0);
  const n = last.s.reduce((a, [, k]) => a + k, 0);
  const top = Math.max(...mocks.map(sum));
  const d = new Date(last.d);
  $("#mock-last").textContent = `前回（${d.getMonth() + 1}/${d.getDate()}）：${sum(last)} / ${n}問（言語${last.s[0][0]}・非言語${last.s[1][0]}）　最高：${top}問`;
}

const badgeHtml = (b, got) => `<span class="bdg${got ? " got" : ""}">${icon(b.icon)}${b.name}</span>`;
function renderBadges() {
  $("#badge-card").hidden = badges.length === 0;
  $("#badge-count").textContent = `${badges.length} / ${BADGES.length}`;
  $("#badge-list").innerHTML = BADGES.map((b) => badgeHtml(b, badges.includes(b.id))).join("");
}

// 結果のたびに条件を満たしたバッジを足し、新しく取れたものを返す
function checkBadges(ok, n, mock) {
  const got = new Set(badges), add = [];
  const give = (id, cond) => { if (cond && !got.has(id)) { got.add(id); add.push(id); } };
  const all = Object.values(stats).flatMap((m) => Object.values(m));
  const totalN = all.reduce((a, s) => a + s.n, 0);
  give("first", true);
  give("perfect", n >= 5 && ok === n);
  give("goal", (days[dayKey()] ?? 0) >= goal);
  give("streak3", streak() >= 3);
  give("streak7", streak() >= 7);
  give("q100", totalN >= 100);
  give("q500", totalN >= 500);
  give("mock", mock);
  give("allcats", CATS.every((c) => statOf("easy", c.id).n + statOf("exam", c.id).n > 0));
  if (add.length) { badges = BADGES.map((b) => b.id).filter((id) => got.has(id)); store.set("spi3Badges", badges); }
  return add;
}

document.querySelectorAll("#modesw [data-mode]").forEach((b) => b.addEventListener("click", () => {
  mode = b.dataset.mode;
  store.set("spi3Mode", mode);
  renderHome();
}));
document.querySelectorAll("[data-count]").forEach((b) => b.addEventListener("click", () => {
  count = +b.dataset.count;
  store.set("spi3Count", count);
  renderHome();
}));
document.querySelectorAll("#goal-seg [data-goal]").forEach((b) => b.addEventListener("click", () => {
  goal = +b.dataset.goal;
  store.set("spi3Goal", goal);
  renderHero();
}));
document.querySelectorAll("[data-gtab]").forEach((b) => b.addEventListener("click", () => {
  group = b.dataset.gtab;
  store.set("spi3Group", group);
  renderTabs();
}));
document.querySelectorAll("#weak-sort [data-sort]").forEach((b) => b.addEventListener("click", () => {
  weakSort = b.dataset.sort;
  renderWeak();
}));
document.querySelectorAll("[data-mix]").forEach((b) => b.addEventListener("click", () => {
  const mix = b.dataset.mix;
  if (mix === "weak") return start({ ids: CATS.map((c) => c.id), weak: true, label: "苦手な分野から" });
  const ids = CATS.filter((c) => mix === "all" || c.group === mix).map((c) => c.id);
  start({ ids, label: mix === "all" ? "全分野ミックス" : `${mix}ミックス` });
}));
$("#mock-start").addEventListener("click", () => start({ mock: true, label: "模試" }));
// 2回押しで確定するボタン。1回目は文言を変えて待ち、時間が過ぎたら元に戻す（アイコンを残すため文言は .lbl に入れる）
function confirmTwice(b, ask, idle, ms) {
  const t = b.querySelector(".lbl") ?? b;
  clearTimeout(b._t);
  if (b.dataset.armed !== "1") {
    b.dataset.armed = "1";
    t.textContent = ask;
    b._t = setTimeout(() => { b.dataset.armed = ""; t.textContent = idle; }, ms);
    return false;
  }
  b.dataset.armed = "";
  t.textContent = idle;
  return true;
}

// 記録（正答率・模試・練習した日・最高記録・バッジ）を消す。モードや目標などの設定は残す
$("#reset-stats").addEventListener("click", () => {
  const b = $("#reset-stats");
  if (!confirmTwice(b, "もう一度押すと記録を消します", "記録を消す", 4000)) return;
  stats = {}; mocks = []; days = {}; best = {}; streakBest = 0; badges = [];
  for (const [k, v] of [["spi3Stats", stats], ["spi3Mock", mocks], ["spi3Days", days], ["spi3Best", best], ["spi3StreakBest", 0], ["spi3Badges", badges]]) store.set(k, v);
  b.querySelector(".lbl").textContent = "記録を消しました";
  renderHome();
});

// ---- 出題 ----
let quiz = null;

function pickIds(ids, weak, n) {
  if (weak) {
    const w = ids.map((id) => { const s = statOf(mode, id); return (s.n - s.ok + 1) / (s.n + 2); });
    const out = [];
    for (let i = 0; i < n; i++) {
      let x = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
      while ((x -= w[k]) > 0 && k < ids.length - 1) k++;
      out.push(ids[k]);
    }
    return out;
  }
  // 偏りが出ないよう、全分野を一巡してから次の巡に入る
  const out = [];
  while (out.length < n) out.push(...ids.slice().sort(() => Math.random() - 0.5));
  return out.slice(0, n);
}

function start(opts) {
  // 模試はいつも本番の難易度で、記録も本番モードに入れる
  const m = opts.mock ? "exam" : mode;
  const hard = m === "exam";
  const seen = new Set();
  const ids = opts.mock
    ? [...pickIds(groupIds("言語"), false, MOCK_N), ...pickIds(groupIds("非言語"), false, MOCK_N)]
    : pickIds(opts.ids, opts.weak, count);
  const qs = ids.map((id) => {
    const cat = byId[id];
    let q;
    for (let t = 0; t < 8; t++) {
      q = cat.gen(makeRng(), hard);
      if (!seen.has(q.q)) break;
    }
    seen.add(q.q);
    const typed = hard && q.num != null && Math.random() < TYPE_RATE;
    return { ...q, cat, typed, pick: null, input: "", ok: false, sec: 0 };
  });
  quiz = { opts, mode: m, hard, qs, i: 0, quit: false, combo: 0 };
  // 模試の時間はセクション（言語・非言語）ごと。各問の制限時間の合計を持ち時間にする
  if (opts.mock) {
    quiz.sections = ["言語", "非言語"].map((g) => {
      const from = qs.findIndex((q) => q.cat.group === g), to = qs.findLastIndex((q) => q.cat.group === g);
      return { name: g, from, to, limit: qs.slice(from, to + 1).reduce((a, q) => a + q.cat.time[1], 0), end: 0 };
    });
  }
  document.body.classList.toggle("exam", hard);
  $("#q-combo").hidden = true;
  show("quiz");
  renderQuestion();
}

const parseNum = (s) => {
  const t = s.replace(/[０-９．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，\s円人個日分歳台%％年後通りkmg倍]/g, "");
  return t === "" ? NaN : Number(t);
};

let timer = 0, t0 = 0;

const sectionOf = (i) => quiz.sections?.find((s) => i >= s.from && i <= s.to);

// 模試のセクションの時間切れ：今の問題を締め、残りは未着手のまま次のセクション（または結果）へ
function timeUp(part) {
  finishQ(quiz.qs[quiz.i], true);
  for (const q of quiz.qs.slice(quiz.i + 1, part.to + 1)) Object.assign(q, { done: true, timeout: true, skipped: true, ok: false, sec: 0 });
  quiz.i = part.to;
  advance(true);
}

// 進み具合の点（模試は今のセクションの分だけ）。お手軽は正誤の色、本番は答えたかどうかだけ
function renderDots() {
  const { qs, i, hard } = quiz;
  const part = sectionOf(i);
  const [from, to] = part ? [part.from, part.to] : [0, qs.length - 1];
  $("#q-dots").replaceChildren(...qs.slice(from, to + 1).map((q, k) => {
    const j = from + k;
    return el("i", j === i ? "cur" : !q.done ? "" : hard ? "done" : q.ok ? "ok" : "ng");
  }));
}

function renderQuestion() {
  const { qs, i, hard } = quiz;
  const q = qs[i];
  const part = sectionOf(i);
  const limit = part ? part.limit : q.cat.time[1];
  if (part && !part.end) part.end = performance.now() + part.limit * 1000;
  $("#q-progress").textContent = part ? `${part.name} ${i - part.from + 1} / ${part.to - part.from + 1}` : `${i + 1} / ${qs.length}`;
  const chip = $("#q-cat");
  chip.dataset.group = gk(q.cat);
  chip.innerHTML = `${icon(q.cat.id)}${q.cat.group}・${q.cat.name}`;
  $("#q-body").innerHTML = q.q;
  $("#q-explain").hidden = true;
  $("#q-explain").innerHTML = "";
  renderDots();
  const next = $("#q-next");
  next.textContent = i === qs.length - 1 ? "結果を見る" : "次へ";
  next.disabled = hard;
  next.hidden = !hard;

  const box = $("#q-choices");
  box.replaceChildren();
  if (q.typed) {
    const f = el("form", "typed");
    f.innerHTML = `<label><span>答えを入力</span><input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"></label><span class="unit">${q.unit ?? ""}</span>`;
    const input = f.querySelector("input");
    input.addEventListener("input", () => { q.input = input.value; next.disabled = input.value.trim() === ""; });
    f.addEventListener("submit", (e) => { e.preventDefault(); if (!next.disabled) advance(); });
    box.append(f);
  } else {
    q.choices.forEach((c, k) => {
      const b = el("button", "choice", `<span class="key">${LETTERS[k]}</span><span class="txt">${c}</span>`);
      b.type = "button";
      b.addEventListener("click", () => choose(k));
      box.append(b);
    });
  }

  clearMemo();
  t0 = performance.now();
  clearInterval(timer);
  const bar = $("#q-bar"), tm = $("#q-time");
  tm.innerHTML = `${icon("clock")}<span></span>`;
  const out = tm.lastElementChild;
  const state = (warn, hot) => { tm.classList.toggle("warn", warn && !hot); tm.classList.toggle("hot", hot); bar.classList.toggle("warn", warn || hot); };
  const tick = () => {
    if (part) {
      const left = Math.max(0, (part.end - performance.now()) / 1000);
      out.textContent = `残り${mmss(Math.ceil(left))}`;
      bar.style.width = `${(left / limit) * 100}%`;
      state(left < 180, left < 60);
      if (left <= 0) timeUp(part);
      return;
    }
    const sec = (performance.now() - t0) / 1000;
    if (hard) {
      const left = Math.max(0, limit - sec);
      out.textContent = `残り${Math.ceil(left)}秒`;
      bar.style.width = `${(left / limit) * 100}%`;
      state(left < limit * 0.3, left < 10);
      if (left <= 0) advance(true);
    } else {
      out.textContent = `${Math.floor(sec)}秒（目安${q.cat.time[0]}秒）`;
      bar.style.width = `${Math.min(100, (sec / q.cat.time[0]) * 100)}%`;
      state(sec > q.cat.time[0], false);
    }
  };
  tick();
  timer = setInterval(tick, 250);
  $("#q-body").focus({ preventScroll: true });
}

function choose(k) {
  const q = quiz.qs[quiz.i];
  if (q.done) return;
  q.pick = k;
  const btns = [...document.querySelectorAll("#q-choices .choice")];
  if (quiz.hard) {
    btns.forEach((b, j) => b.setAttribute("aria-pressed", j === k));
    $("#q-next").disabled = false;
    return;
  }
  // お手軽はその場で採点して解説を出す
  finishQ(q);
  btns.forEach((b, j) => {
    b.disabled = true;
    if (j === q.answer) b.classList.add("right");
    else if (j === k) b.classList.add("wrong");
  });
  quiz.combo = q.ok ? quiz.combo + 1 : 0;
  const combo = $("#q-combo");
  combo.hidden = quiz.combo < 2;
  if (quiz.combo >= 2) combo.innerHTML = `${icon("flame")}${quiz.combo}連続正解`;
  renderDots();
  const ex = $("#q-explain");
  ex.className = q.ok ? "ok" : "ng";
  const verdict = q.ok
    ? `<p class="verdict ok">${icon("check")}${quiz.combo >= 3 ? `${quiz.combo}問連続で正解！` : pick(OK_MSG)}</p>`
    : `<p class="verdict ng">${icon("x")}${pick(NG_MSG)}<small>正解は ${LETTERS[q.answer]}</small></p>`;
  ex.innerHTML = `${verdict}<div>${q.explain}</div><p class="tip"><b>コツ</b>${q.cat.tip}</p>${pointsHtml(q.cat.id)}`;
  ex.hidden = false;
  const next = $("#q-next");
  next.hidden = false;
  next.disabled = false;
  next.focus({ preventScroll: true });
  ex.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function finishQ(q, timeout = false) {
  if (q.done) return;
  q.done = true;
  clearInterval(timer);
  const spent = Math.round((performance.now() - t0) / 1000);
  // 模試は1問の上限がない代わりに、セクションの残り時間を超えないようにする
  const part = sectionOf(quiz.i);
  q.sec = Math.min(part ? Math.round((part.end - t0) / 1000) : q.cat.time[1], spent);
  if (q.typed) {
    const v = parseNum(q.input);
    q.ok = Number.isFinite(v) && Math.abs(v - q.num) < 1e-6;
  } else {
    q.ok = q.pick === q.answer;
  }
  q.timeout = timeout && (q.typed ? q.input.trim() === "" : q.pick == null);
  record(q.cat.id, q.ok, q.sec, quiz.mode);
}

function advance(timeout = false) {
  const q = quiz.qs[quiz.i];
  finishQ(q, timeout);
  if (quiz.i < quiz.qs.length - 1) {
    quiz.i++;
    renderQuestion();
  } else {
    renderResult();
  }
}

$("#q-next").addEventListener("click", () => advance());
$("#q-quit").addEventListener("click", () => {
  if (!confirmTwice($("#q-quit"), "もう一度押すと終了", "やめる", 3000)) return;
  clearInterval(timer);
  quiz.quit = true;
  quiz.qs = quiz.qs.filter((q) => q.done && !q.skipped);
  if (quiz.sections) quiz.sections = null; // 途中でやめた模試は通常の結果として見せ、履歴にも残さない
  if (quiz.qs.length) renderResult();
  else { show("home"); renderHome(); }
});

// ---- 結果 ----
function renderResult() {
  clearInterval(timer);
  const { qs, opts, sections } = quiz;
  const ok = qs.filter((q) => q.ok).length;
  const rate = pct(ok, qs.length);
  const avg = Math.round(qs.reduce((a, q) => a + q.sec, 0) / qs.length);
  const tier = rate >= 90 ? "s" : rate >= 70 ? "a" : rate >= 50 ? "b" : "c";
  $("#r-top").dataset.tier = tier;
  $("#r-pct").textContent = `${rate}%`;
  $("#r-score").textContent = `${ok} / ${qs.length}問 正解`;
  const ring = $("#r-ring");
  ring.setAttribute("stroke-dashoffset", 100);
  requestAnimationFrame(() => requestAnimationFrame(() => ring.setAttribute("stroke-dashoffset", 100 - rate)));
  $("#r-cheer").textContent = ok === qs.length && qs.length >= 5 ? "全問正解！ お見事です" : pick(CHEER[tier]);
  $("#r-meta").textContent = opts.mock ? `模試（本番形式）・1問あたり平均${avg}秒` : `${MODES[quiz.mode].name}モード・${opts.label}・1問あたり平均${avg}秒`;

  // 模試はセクションごとの成績を出して履歴に残す
  const parts = sections?.map((s) => {
    const list = qs.slice(s.from, s.to + 1);
    return { name: s.name, ok: list.filter((q) => q.ok).length, n: list.length, sec: list.reduce((a, q) => a + q.sec, 0), limit: s.limit, left: list.filter((q) => q.skipped).length };
  });
  $("#r-sections").hidden = !parts;
  if (parts) $("#r-sections").innerHTML = parts.map((p) => `<div><span>${p.name}</span><b>${p.ok} / ${p.n}</b><span>${pct(p.ok, p.n)}%・${mmss(p.sec)} / ${mmss(p.limit)}${p.left ? `・未着手${p.left}問` : ""}</span></div>`).join("");

  // 履歴・最高記録・バッジは1回の結果につき1度だけ更新する
  const bestBox = $("#r-best");
  if (!quiz.saved) {
    quiz.saved = true;
    if (parts) {
      mocks = [...mocks, { d: Date.now(), s: parts.map((p) => [p.ok, p.n, p.sec]) }].slice(-20);
      store.set("spi3Mock", mocks);
    }
    bestBox.hidden = true;
    if (!opts.mock && !quiz.quit && qs.length >= 5) {
      const key = `${quiz.mode}|${opts.label}|${qs.length}`, prev = best[key];
      if (prev == null || rate > prev) { best[key] = rate; store.set("spi3Best", best); }
      if (prev != null) {
        bestBox.textContent = rate > prev ? `自己ベスト更新！（これまでの最高 ${prev}%）` : `この条件での最高 ${prev}%`;
        bestBox.hidden = false;
      }
    }
    const add = checkBadges(ok, qs.length, !!parts);
    $("#r-badges").hidden = add.length === 0;
    $("#r-badges").innerHTML = add.length ? `${BADGES.filter((b) => add.includes(b.id)).map((b) => badgeHtml(b, true)).join("")}` : "";
  }

  const per = {};
  for (const q of qs) {
    const p = (per[q.cat.id] ??= { cat: q.cat, n: 0, ok: 0 });
    p.n++; if (q.ok) p.ok++;
  }
  $("#r-cats").innerHTML = `<table><thead><tr><th>分野</th><th>正解</th></tr></thead><tbody>${Object.values(per)
    .map((p) => `<tr class="${p.ok === p.n ? "" : "miss"}"><th>${p.cat.name}</th><td>${p.ok} / ${p.n}</td></tr>`).join("")}</tbody></table>`;

  $("#r-review").replaceChildren(...qs.map((q, i) => {
    const d = el("details", `rev ${q.ok ? "ok" : "ng"}`);
    const yours = q.typed
      ? (q.input.trim() ? `${esc(q.input)}${q.unit ?? ""}` : "無回答")
      : q.pick == null ? "無回答" : `${LETTERS[q.pick]}. ${q.choices[q.pick]}`;
    const right = q.typed ? `${q.choices[q.answer]}` : `${LETTERS[q.answer]}. ${q.choices[q.answer]}`;
    d.innerHTML = `<summary><span class="mark">${q.ok ? "○" : "×"}</span>Q${i + 1} ${q.cat.name}<span class="sec">${q.timeout ? "時間切れ" : `${q.sec}秒`}</span></summary>
      <div class="rev-body"><div class="rev-q">${q.q}</div>
      ${q.typed ? "" : `<ol class="rev-choices">${q.choices.map((c, k) => `<li class="${k === q.answer ? "right" : k === q.pick ? "wrong" : ""}"><span class="key">${LETTERS[k]}</span>${c}</li>`).join("")}</ol>`}
      <p class="rev-ans">あなたの答え：${yours}<br>正解：<b>${right}</b></p><div class="rev-ex">${q.explain}</div><p class="tip"><b>コツ</b>${q.cat.tip}</p>${pointsHtml(q.cat.id)}</div>`;
    return d;
  }), el("p", "rev-empty", "間違えた問題はありません。"));
  revFilter("all");

  const missIds = Object.values(per).filter((p) => p.ok < p.n).map((p) => p.cat.id);
  const retryMiss = $("#r-miss");
  retryMiss.hidden = missIds.length === 0;
  retryMiss.onclick = () => start({ ids: missIds, label: "間違えた分野" });
  $("#r-again").onclick = () => start(opts);

  const text = parts
    ? `SPI3ドリル（非公式）の模試で${parts.map((p) => `${p.name}${p.ok}/${p.n}`).join("・")}でした`
    : `SPI3ドリル（非公式）の${MODES[quiz.mode].name}モードで${qs.length}問中${ok}問正解しました`;
  $("#r-share").href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + location.pathname)}`;
  show("result");
}

// 見直しの絞り込み（すべて／間違えた問題だけ）
function revFilter(f) {
  document.querySelectorAll("#rev-filter [data-f]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === f));
  const list = [...document.querySelectorAll("#r-review .rev")];
  list.forEach((d) => { d.hidden = f === "ng" && d.classList.contains("ok"); });
  $("#r-review .rev-empty").hidden = !(f === "ng" && list.every((d) => d.hidden));
}
document.querySelectorAll("#rev-filter [data-f]").forEach((b) => b.addEventListener("click", () => revFilter(b.dataset.f)));

$("#r-home").addEventListener("click", () => { show("home"); renderHome(); });

// ---- メモ（手書き） ----
const memo = $("#memo");
const mctx = memo.getContext("2d");
let drawing = null;

function sizeMemo() {
  const r = memo.getBoundingClientRect();
  if (!r.width) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (memo.width === w && memo.height === h) return;
  const keep = memo.width ? mctx.getImageData(0, 0, memo.width, memo.height) : null;
  memo.width = w; memo.height = h;
  if (keep) mctx.putImageData(keep, 0, 0);
}
function clearMemo() {
  sizeMemo();
  mctx.clearRect(0, 0, memo.width, memo.height);
}
const pt = (e) => {
  const r = memo.getBoundingClientRect(), dpr = memo.width / r.width;
  return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr];
};
memo.addEventListener("pointerdown", (e) => {
  sizeMemo();
  memo.setPointerCapture(e.pointerId);
  drawing = { id: e.pointerId, p: pt(e) };
  e.preventDefault();
});
memo.addEventListener("pointermove", (e) => {
  if (!drawing || drawing.id !== e.pointerId) return;
  const p = pt(e), dpr = window.devicePixelRatio || 1;
  mctx.strokeStyle = getComputedStyle(memo).color;
  mctx.lineWidth = 2.2 * dpr;
  mctx.lineCap = mctx.lineJoin = "round";
  mctx.beginPath();
  mctx.moveTo(...drawing.p);
  mctx.lineTo(...p);
  mctx.stroke();
  drawing.p = p;
});
for (const ev of ["pointerup", "pointercancel"]) memo.addEventListener(ev, () => { drawing = null; });
$("#memo-clear").addEventListener("click", clearMemo);
window.addEventListener("resize", sizeMemo);

// ---- 電卓 ----
const calc = { cur: "0", acc: null, op: null, fresh: true };
const OPS = { "+": (a, b) => a + b, "−": (a, b) => a - b, "×": (a, b) => a * b, "÷": (a, b) => a / b };
const calcShow = (v) => {
  if (typeof v === "number") v = Number.isFinite(v) ? String(+v.toPrecision(12)) : "エラー";
  $("#calc-out").textContent = v;
};
function calcKey(k) {
  if (/^[0-9]$/.test(k)) {
    calc.cur = calc.fresh || calc.cur === "0" ? k : calc.cur + k;
    calc.fresh = false;
  } else if (k === ".") {
    if (calc.fresh) { calc.cur = "0."; calc.fresh = false; } else if (!calc.cur.includes(".")) calc.cur += ".";
  } else if (k === "C") {
    Object.assign(calc, { cur: "0", acc: null, op: null, fresh: true });
  } else if (k === "⌫") {
    calc.cur = calc.fresh || calc.cur.length <= 1 ? "0" : calc.cur.slice(0, -1);
  } else if (k in OPS || k === "=") {
    const v = Number(calc.cur);
    if (calc.op && !calc.fresh) calc.acc = OPS[calc.op](calc.acc, v);
    else if (calc.acc == null || !calc.op) calc.acc = v;
    calc.op = k === "=" ? null : k;
    calc.fresh = true;
    calc.cur = String(Number.isFinite(calc.acc) ? +calc.acc.toPrecision(12) : NaN);
    calcShow(calc.acc);
    $("#calc-op").textContent = calc.op ?? "";
    return;
  }
  calcShow(calc.cur);
}
document.querySelectorAll("#calc [data-k]").forEach((b) => b.addEventListener("click", () => calcKey(b.dataset.k)));

const toolOpen = (name) => !$(`#${name}`).closest(".tool").hidden;
document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => {
  const t = $(`#tool-${b.dataset.tool}`);
  t.hidden = !t.hidden;
  b.setAttribute("aria-pressed", !t.hidden);
  if (!t.hidden) sizeMemo();
}));

// ---- キーボード ----
document.addEventListener("keydown", (e) => {
  if (document.body.dataset.screen !== "quiz" || e.ctrlKey || e.metaKey || e.altKey) return;
  const typing = e.target instanceof HTMLInputElement;
  const k = e.key;
  if (!typing && quiz.hard && toolOpen("calc")) {
    const map = { "*": "×", "/": "÷", "-": "−", "+": "+", Enter: "=", "=": "=", Backspace: "⌫", Escape: "C", ".": "." };
    if (/^[0-9]$/.test(k) || map[k]) {
      calcKey(map[k] ?? k);
      e.preventDefault();
      return;
    }
  }
  if (typing) return;
  const idx = LETTERS.toLowerCase().indexOf(k.toLowerCase());
  const n = /^[1-8]$/.test(k) ? +k - 1 : -1;
  const q = quiz.qs[quiz.i];
  if (!q.typed && (idx >= 0 || n >= 0)) {
    const j = idx >= 0 ? idx : n;
    if (j < q.choices.length) { choose(j); e.preventDefault(); }
  } else if (k === "Enter" && !$("#q-next").hidden && !$("#q-next").disabled && document.activeElement !== $("#q-next")) {
    advance();
    e.preventDefault();
  }
});

// ---- ホーム画面に追加 ----
// Chrome・Edge は beforeinstallprompt でボタンから追加できる。iPhone の Safari にはこの仕組みがないので手順を出す
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installEvt = null;
const showInstall = () => { if (!standalone && !store.get("spi3InstallClosed", false)) $("#install").hidden = false; };
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvt = e;
  $("#install-btn").hidden = false;
  showInstall();
});
if (isIOS) {
  $("#install-desc").textContent = "Safari の共有ボタン（□に↑）から「ホーム画面に追加」を選ぶと、アプリのように開けて、電波のない場所でも練習できます。";
  $("#install-btn").hidden = true;
  showInstall();
}
$("#install-btn").addEventListener("click", async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => {});
  installEvt = null;
  $("#install").hidden = true;
});
$("#install-close").addEventListener("click", () => {
  store.set("spi3InstallClosed", true);
  $("#install").hidden = true;
});
window.addEventListener("appinstalled", () => { $("#install").hidden = true; });

// ---- 起動 ----
document.querySelector("#year").textContent = new Date().getFullYear();
hydrateIcons();
renderPoints();
renderHome();
show("home");
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
