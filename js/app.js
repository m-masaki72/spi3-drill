// 画面の切り替え・出題・採点・記録
import { makeRng } from "./util.js";
import { NONVERBAL } from "./nonverbal.js";
import { VERBAL } from "./verbal.js";
import { POINTS } from "./points.js";

const CATS = [...NONVERBAL.map((c) => ({ ...c, group: "非言語" })), ...VERBAL.map((c) => ({ ...c, group: "言語" }))];
const byId = Object.fromEntries(CATS.map((c) => [c.id, c]));
const LETTERS = "ABCDEFGH";
const MODES = {
  easy: { name: "お手軽", desc: "小さな数で解き方の要点だけ。答えるとすぐに正誤と解説が出ます。時間制限はありません。" },
  exam: { name: "本番", desc: "本番に近い数と形式で、1問ごとに制限時間があります。メモと電卓が使えます。解説は最後にまとめて出ます。" },
};
const TYPE_RATE = 0.35; // 本番で数値を直接入力させる割合

const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

// ---- 保存（使えない環境でも動くようにすべて try/catch） ----
const store = {
  get(k, def) {
    try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても続ける */ }
  },
};

let mode = store.get("spi3Mode", "easy");
if (!MODES[mode]) mode = "easy";
let count = store.get("spi3Count", 10);
if (![5, 10, 20].includes(count)) count = 10;
let stats = store.get("spi3Stats", {});

const statOf = (m, id) => stats[m]?.[id] ?? { n: 0, ok: 0, sec: 0 };
function record(id, ok, sec) {
  stats[mode] ??= {};
  const s = statOf(mode, id);
  stats[mode][id] = { n: s.n + 1, ok: s.ok + (ok ? 1 : 0), sec: s.sec + sec };
  store.set("spi3Stats", stats);
}

function show(id) {
  for (const s of ["home", "quiz", "result"]) $(`#${s}`).hidden = s !== id;
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

// 分野の公式・ポイント（折りたたみ）
const pointsList = (id) => `<ul>${(POINTS[id] ?? []).map((p) => `<li>${p}</li>`).join("")}</ul>`;
const pointsHtml = (id) => (POINTS[id] ? `<details class="pts"><summary>公式・ポイント</summary>${pointsList(id)}</details>` : "");

// ---- ホーム ----
function renderHome() {
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode));
  document.querySelectorAll("[data-count]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.count === count));
  $("#mode-desc").textContent = MODES[mode].desc;
  for (const g of ["非言語", "言語"]) {
    const box = $(g === "言語" ? "#cats-verbal" : "#cats-nonverbal");
    box.replaceChildren(...CATS.filter((c) => c.group === g).map((c) => {
      const s = statOf(mode, c.id);
      const b = el("button", "cat");
      b.type = "button";
      b.innerHTML = `<span class="cat-name">${c.name}</span><span class="cat-stat">${s.n ? `${s.n}問・正答率${Math.round((s.ok / s.n) * 100)}%` : "未挑戦"}</span><span class="cat-tip">${c.tip}</span>`;
      b.addEventListener("click", () => start({ ids: [c.id], label: c.name }));
      return b;
    }));
  }
  $("#points-all").innerHTML = CATS.map((c) => `<details class="pts"><summary>${c.group}｜${c.name}</summary>${pointsList(c.id)}</details>`).join("");
  const total = Object.values(stats[mode] ?? {}).reduce((a, s) => ({ n: a.n + s.n, ok: a.ok + s.ok }), { n: 0, ok: 0 });
  $("#home-total").textContent = total.n ? `${MODES[mode].name}モードの記録：${total.n}問・正答率${Math.round((total.ok / total.n) * 100)}%` : "";
}

document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
  mode = b.dataset.mode;
  store.set("spi3Mode", mode);
  renderHome();
}));
document.querySelectorAll("[data-count]").forEach((b) => b.addEventListener("click", () => {
  count = +b.dataset.count;
  store.set("spi3Count", count);
  renderHome();
}));
document.querySelectorAll("[data-mix]").forEach((b) => b.addEventListener("click", () => {
  const mix = b.dataset.mix;
  if (mix === "weak") return start({ ids: CATS.map((c) => c.id), weak: true, label: "苦手な分野から" });
  const ids = CATS.filter((c) => mix === "all" || c.group === mix).map((c) => c.id);
  start({ ids, label: mix === "all" ? "全分野ミックス" : `${mix}ミックス` });
}));
// 2回押しで確定するボタン。1回目は文言を変えて待ち、時間が過ぎたら元に戻す
function confirmTwice(b, ask, idle, ms) {
  clearTimeout(b._t);
  if (b.dataset.armed !== "1") {
    b.dataset.armed = "1";
    b.textContent = ask;
    b._t = setTimeout(() => { b.dataset.armed = ""; b.textContent = idle; }, ms);
    return false;
  }
  b.dataset.armed = "";
  b.textContent = idle;
  return true;
}

$("#reset-stats").addEventListener("click", () => {
  const b = $("#reset-stats");
  if (!confirmTwice(b, "もう一度押すと記録を消します", "記録を消す", 4000)) return;
  stats = {};
  store.set("spi3Stats", stats);
  b.textContent = "記録を消しました";
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
  const hard = mode === "exam";
  const seen = new Set();
  const qs = pickIds(opts.ids, opts.weak, count).map((id) => {
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
  quiz = { opts, hard, qs, i: 0 };
  document.body.classList.toggle("exam", hard);
  show("quiz");
  renderQuestion();
}

const parseNum = (s) => {
  const t = s.replace(/[０-９．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，\s円人個日分歳台%％年後通りkmg倍]/g, "");
  return t === "" ? NaN : Number(t);
};

let timer = 0, t0 = 0;

function renderQuestion() {
  const { qs, i, hard } = quiz;
  const q = qs[i];
  const limit = q.cat.time[1];
  $("#q-progress").textContent = `${i + 1} / ${qs.length}`;
  $("#q-cat").textContent = `${q.cat.group}・${q.cat.name}`;
  $("#q-body").innerHTML = q.q;
  $("#q-explain").hidden = true;
  $("#q-explain").innerHTML = "";
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
  const tick = () => {
    const sec = (performance.now() - t0) / 1000;
    if (hard) {
      const left = Math.max(0, limit - sec);
      tm.textContent = `残り${Math.ceil(left)}秒`;
      bar.style.width = `${(left / limit) * 100}%`;
      bar.classList.toggle("warn", left < 10);
      if (left <= 0) advance(true);
    } else {
      tm.textContent = `${Math.floor(sec)}秒（目安${q.cat.time[0]}秒）`;
      bar.style.width = `${Math.min(100, (sec / q.cat.time[0]) * 100)}%`;
      bar.classList.toggle("warn", sec > q.cat.time[0]);
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
  const ex = $("#q-explain");
  ex.innerHTML = `<p class="verdict ${q.ok ? "ok" : "ng"}">${q.ok ? "正解！" : `不正解… 正解は ${LETTERS[q.answer]}`}</p><div>${q.explain}</div><p class="tip"><b>コツ</b>${q.cat.tip}</p>${pointsHtml(q.cat.id)}`;
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
  q.sec = Math.min(q.cat.time[1], Math.round((performance.now() - t0) / 1000));
  if (q.typed) {
    const v = parseNum(q.input);
    q.ok = Number.isFinite(v) && Math.abs(v - q.num) < 1e-6;
  } else {
    q.ok = q.pick === q.answer;
  }
  q.timeout = timeout && (q.typed ? q.input.trim() === "" : q.pick == null);
  record(q.cat.id, q.ok, q.sec);
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
  quiz.qs = quiz.qs.filter((q) => q.done);
  if (quiz.qs.length) renderResult();
  else { show("home"); renderHome(); }
});

// ---- 結果 ----
function renderResult() {
  clearInterval(timer);
  const { qs, opts } = quiz;
  const ok = qs.filter((q) => q.ok).length;
  const avg = Math.round(qs.reduce((a, q) => a + q.sec, 0) / qs.length);
  $("#r-score").innerHTML = `<b>${ok}</b> / ${qs.length}問 正解`;
  $("#r-meta").textContent = `${MODES[mode].name}モード・${opts.label}・1問あたり平均${avg}秒`;

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
  }));

  const missIds = Object.values(per).filter((p) => p.ok < p.n).map((p) => p.cat.id);
  const retryMiss = $("#r-miss");
  retryMiss.hidden = missIds.length === 0;
  retryMiss.onclick = () => start({ ids: missIds, label: "間違えた分野" });
  $("#r-again").onclick = () => start(opts);

  const text = `SPI3ドリル（非公式）の${MODES[mode].name}モードで${qs.length}問中${ok}問正解しました`;
  $("#r-share").href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + location.pathname)}`;
  show("result");
}

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

// ---- 起動 ----
document.querySelector("#year").textContent = new Date().getFullYear();
renderHome();
show("home");
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
