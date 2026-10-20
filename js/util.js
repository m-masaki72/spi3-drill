// 問題づくりの共通処理（乱数・数の表記・分数・選択肢）

export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.step = (lo, hi, st) => lo + st * r.int(0, Math.floor((hi - lo) / st));
  r.pick = (a) => a[Math.floor(r() * a.length)];
  r.shuffle = (a) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  r.sample = (a, n) => r.shuffle(a).slice(0, n);
  r.chance = (p) => r() < p;
  return r;
}

// 条件を満たす値が出るまで作り直す（fn が null を返したらやり直し）
export function retry(fn, limit = 5000) {
  for (let i = 0; i < limit; i++) {
    const v = fn();
    if (v != null) return v;
  }
  throw new Error("問題を作れませんでした");
}

export const near = (a, b) => Math.abs(a - b) < 1e-9;
export const isInt = (v) => near(v, Math.round(v));
export const gcd = (a, b) => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const lcm = (a, b) => (a / gcd(a, b)) * b;
export const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
export const P = (n, k) => (k === 0 ? 1 : n * P(n - 1, k - 1));
export const C = (n, k) => (k < 0 || k > n ? 0 : P(n, k) / fact(k));

export function permutations(a) {
  if (a.length <= 1) return [a.slice()];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

// 小数点以下 dp 桁（なければ整数）までの値を、3桁区切りで表記する
export function decimals(v) {
  for (let d = 0; d < 4; d++) if (isInt(v * 10 ** d)) return d;
  return 3;
}
export const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
export const fmt = (v) => round(v, 3).toLocaleString("ja-JP", { maximumFractionDigits: 3 });

export class Frac {
  constructor(n, d = 1) {
    if (d === 0) throw new Error("分母が0");
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    this.n = n / g;
    this.d = d / g;
  }
  static of(x) { return x instanceof Frac ? x : new Frac(x); }
  add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { o = Frac.of(o); return new Frac(this.n * o.d, this.d * o.n); }
  get v() { return this.n / this.d; }
  get key() { return `${this.n}/${this.d}`; }
  html() {
    if (this.d === 1) return String(this.n);
    const sign = this.n < 0 ? "−" : "";
    return `${sign}<span class="fr"><span>${Math.abs(this.n)}</span><span>${this.d}</span></span>`;
  }
}
export const F = (n, d = 1) => new Frac(n, d);

function niceStep(ans, dp) {
  const raw = Math.max(Math.abs(ans) * 0.08, 10 ** -dp);
  const e = 10 ** Math.floor(Math.log10(raw));
  const m = raw / e;
  return Math.max((m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e, 10 ** -dp);
}

// 数値の選択肢。ありがちな誤答を優先して入れ、足りない分は正解の前後の値で埋める。小さい順に並べる
export function numChoices(r, ans, wrongs = [], { n = 5, unit = "", dp, step } = {}) {
  dp ??= decimals(ans);
  ans = round(ans, dp);
  const vals = [ans];
  const add = (v) => {
    v = round(v, dp);
    if (vals.length < n && Number.isFinite(v) && v > 0 && !vals.some((x) => near(x, v))) vals.push(v);
  };
  r.shuffle(wrongs).forEach(add);
  step ??= niceStep(ans, dp);
  r.shuffle([1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5, -6]).forEach((k) => add(ans + k * step));
  for (let k = 7; vals.length < n; k++) add(ans + k * step);
  vals.sort((a, b) => a - b);
  return { choices: vals.map((v) => fmt(v) + unit), answer: vals.findIndex((v) => near(v, ans)), num: ans, unit };
}

// 分数の選択肢（値の小さい順）。max を超える値や 0 以下は入れない
export function fracChoices(r, ans, wrongs = [], { n = 5, max = Infinity } = {}) {
  const vals = [ans];
  const add = (f) => {
    if (vals.length < n && f.v > 0 && f.v <= max && !vals.some((x) => x.key === f.key)) vals.push(f);
  };
  r.shuffle(wrongs).forEach(add);
  const { n: a, d: b } = ans;
  r.shuffle([F(a + 1, b), F(Math.max(a - 1, 1), b), F(a, b + 1), F(a, Math.max(b - 1, 1)), F(b - a, b), F(a * 2 + 1, b * 2), F(a * 2 - 1, b * 2)]).forEach(add);
  for (let k = 2; vals.length < n; k++) add(F(a + k, b + k));
  vals.sort((x, y) => x.v - y.v);
  return { choices: vals.map((f) => f.html()), answer: vals.findIndex((f) => f.key === ans.key) };
}

// 文字の選択肢（正解1つ＋誤答から n-1 個、順番はシャッフル）
export function textChoices(r, correct, wrongs, n = 5) {
  const list = r.shuffle([correct, ...r.sample(wrongs.filter((w) => w !== correct), n - 1)]);
  return { choices: list, answer: list.indexOf(correct) };
}

export const KANA = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク"];
const COMBOS = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
const comboText = (c) => (c.length === 3 ? "アとイとウ" : c.length === 2 ? `${KANA[c[0]]}と${KANA[c[1]]}` : `${KANA[c[0]]}だけ`);

// 「ア・イ・ウのうち正しいものはどれか」の選択肢。none を付けると「どれも正しくない」も選べる
export function comboChoices(truth, none = "") {
  const choices = COMBOS.map(comboText);
  if (none) choices.push(none);
  const key = truth.map((t, i) => (t ? i : -1)).filter((i) => i >= 0).join();
  const answer = key === "" ? choices.length - 1 : COMBOS.findIndex((c) => c.join() === key);
  if (answer < 0 || (key === "" && !none)) throw new Error("正解がない組み合わせ");
  return { choices, answer };
}

export const ul = (items) => `<ul class="clues">${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;
export const kanaList = (items) => `<ul class="kana">${items.map((t, i) => `<li><b>${KANA[i]}</b>${t}</li>`).join("")}</ul>`;
export const table = (head, rows, cap = "") =>
  `<div class="tbl"><table>${cap ? `<caption>${cap}</caption>` : ""}<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((c, i) => (i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
