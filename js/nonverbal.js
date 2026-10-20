// 非言語の問題。数値はすべてテンプレートから作り、答えはコードで計算する
// gen(r, hard) は { q, choices, answer, explain, num?, unit? } を返す（hard = 本番モード）
import {
  retry, near, isInt, gcd, lcm, fact, P, C, permutations, round, fmt, F, Frac,
  numChoices, fracChoices, textChoices, comboChoices, ul, kanaList, table, KANA,
} from "./util.js";

const yen = (v) => `${fmt(v)}円`;
const ranks = (n) => [...Array(n)].map((_, i) => i + 1);

// ---- 推論の共通処理 ----

// 正しい手がかりを1つずつ足して候補を絞る。お手軽は1通りに決まるまで、本番は2〜4通り残したところで止める
function narrow(r, cands, makeClue, hard, minClues = 2) {
  return retry(() => {
    let rest = cands;
    const clues = [];
    for (let i = 0; i < 300 && clues.length < 5; i++) {
      const c = makeClue();
      if (!c || clues.some((x) => x.key === c.key)) continue;
      const next = rest.filter(c.test);
      if (next.length === rest.length || (hard && next.length < 2)) continue;
      rest = next;
      clues.push(c);
      if (clues.length >= minClues && (hard ? rest.length <= 4 : rest.length === 1)) return { clues, rest };
    }
    return null;
  }, 300);
}

// 「必ず正しいといえるもの」の文を3つ選ぶ。候補すべてで成り立つ文が正解
function pickStatements(r, rest, pool, clues) {
  const used = new Set(clues.map((c) => c.key));
  const cls = pool.filter((s) => !used.has(s.key)).map((s) => {
    const k = rest.filter(s.test).length;
    return { ...s, all: k === rest.length, some: k > 0 && k < rest.length };
  });
  const alls = cls.filter((s) => s.all);
  const somes = cls.filter((s) => s.some);
  const nones = cls.filter((s) => !s.all && !s.some);
  const t = r.pick([0, 1, 1, 1, 2, 2, 3]);
  if (alls.length < t) return null;
  const wrong = r.sample(somes, Math.min(somes.length, 3 - t));
  wrong.push(...r.sample(nones, 3 - t - wrong.length));
  if (wrong.length !== 3 - t) return null;
  return r.shuffle([...r.sample(alls, t), ...wrong]);
}

function mustQuestion(intro, clues, st, rest, showSol) {
  const { choices, answer } = comboChoices(st.map((s) => s.all), "いずれも必ず正しいとはいえない");
  return {
    q: `${intro}${ul(clues.map((c) => c.text))}<p>次の推論ア、イ、ウのうち、必ず正しいといえるものはどれか。</p>${kanaList(st.map((s) => s.text))}`,
    choices, answer,
    explain: `<p>条件を満たすのは次の${rest.length}通り。</p>${ul(rest.map(showSol))}<p>${st
      .map((s, i) => `${KANA[i]}：${s.all ? "すべてで成り立つ → 必ず正しい" : s.some ? "成り立たない場合がある" : "どの場合も成り立たない"}`)
      .join("<br>")}</p>`,
  };
}

// ---- 図（物の流れ・領域） ----

function flowSvg(nodes, edges) {
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const lines = edges.map(({ from, to, label }) => {
    const a = pos[from], b = pos[to];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const x1 = a.x + ux * 19, y1 = a.y + uy * 19, x2 = b.x - ux * 22, y2 = b.y - uy * 22;
    const mx = (a.x + b.x) / 2 - uy * 14, my = (a.y + b.y) / 2 + ux * 14 + 5;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ar)"/><text x="${mx}" y="${my}" class="lb">${label}</text>`;
  });
  const circles = nodes.map((n) => `<circle cx="${n.x}" cy="${n.y}" r="18"/><text x="${n.x}" y="${n.y + 6}" class="nd">${n.id}</text>`);
  return `<svg class="fig flow" viewBox="0 0 320 150" role="img" aria-label="物の流れの図"><defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>${lines.join("")}${circles.join("")}</svg>`;
}

const slopeText = (m) => ({ 1: "x", "-1": "−x", 2: "2x", "-2": "−2x", 0.5: "½x", "-0.5": "−½x" })[m];
const lineExpr = ({ m, b }) => `${slopeText(m)}${b > 0 ? ` ＋ ${b}` : b < 0 ? ` − ${-b}` : ""}`;
const ineq = (l, sign) => `y ${sign === "+" ? "＞" : "＜"} ${lineExpr(l)}`;

function regionsOf(lines) {
  const groups = new Map();
  for (let x = -4.9; x < 5; x += 0.2) {
    for (let y = -4.9; y < 5; y += 0.2) {
      const key = lines.map((l) => (y > l.m * x + l.b ? "+" : "-")).join("");
      const g = groups.get(key) ?? { key, n: 0, sx: 0, sy: 0 };
      g.n++; g.sx += x; g.sy += y;
      groups.set(key, g);
    }
  }
  return [...groups.values()]
    .filter((g) => g.n >= 14)
    .map((g) => ({ key: g.key, cx: g.sx / g.n, cy: g.sy / g.n }))
    .sort((a, b) => Math.atan2(b.cy, b.cx) - Math.atan2(a.cy, a.cx))
    .map((g, i) => ({ ...g, label: KANA[i] }));
}

function ryoikiSvg(lines, regions) {
  const S = 26, W = S * 10;
  const X = (x) => +((x + 5) * S).toFixed(1), Y = (y) => +((5 - y) * S).toFixed(1);
  const parts = [
    `<line class="ax" x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}"/><line class="ax" x1="${X(0)}" y1="${W}" x2="${X(0)}" y2="0"/>`,
    `<text class="axl" x="${W - 10}" y="${Y(0) + 16}">x</text><text class="axl" x="${X(0) + 8}" y="14">y</text><text class="axl" x="${X(0) - 14}" y="${Y(0) + 16}">O</text>`,
  ];
  lines.forEach((l, i) => {
    parts.push(`<line class="ln" x1="${X(-5)}" y1="${Y(-5 * l.m + l.b)}" x2="${X(5)}" y2="${Y(5 * l.m + l.b)}"/>`);
    const side = i % 2 ? -1 : 1;
    let x = 3.6 * side, y = l.m * x + l.b;
    if (Math.abs(y) > 4.2) { y = Math.sign(y) * 4.2; x = (y - l.b) / l.m; }
    parts.push(`<text class="eq" x="${X(x)}" y="${Y(y) - 8}" text-anchor="${x > 0 ? "end" : "start"}">y=${lineExpr(l).replace(/ /g, "")}</text>`);
  });
  regions.forEach((g) => parts.push(`<circle class="rg" cx="${X(g.cx)}" cy="${Y(g.cy)}" r="11"/><text class="rgl" x="${X(g.cx)}" y="${Y(g.cy) + 5}">${g.label}</text>`));
  return `<svg class="fig ryoiki" viewBox="0 0 ${W} ${W}" role="img" aria-label="直線で区切られた領域の図">${parts.join("")}</svg>`;
}

// ---- 分野 ----

export const NONVERBAL = [
  {
    id: "wariai", name: "割合", time: [40, 60],
    tip: "部分 ＝ 全体 × 割合。「AのうちのB%」が重なるときは、割合どうしを掛け算でつなぐ。",
    gen(r, hard) {
      if (!hard) {
        const [whole, short, part, u] = r.pick([
          ["ある高校の生徒", "生徒", "自転車で通学している", "人"],
          ["ある町の世帯", "世帯", "犬を飼っている", "世帯"],
          ["ある店の今日の来店客", "来店客", "ポイントカードを使った", "人"],
          ["ある会社の社員", "社員", "電車で通勤している", "人"],
        ]);
        const N = r.step(200, 1200, 20), p = r.step(5, 75, 5), x = (N * p) / 100;
        if (r.chance(0.5)) {
          return {
            q: `${whole}は${fmt(N)}${u}で、そのうち${p}%が${part}。${part}のは何${u}か。`,
            ...numChoices(r, x, [(N * p) / 10, N - x, x + p], { unit: u }),
            explain: `部分 ＝ 全体 × 割合 なので、${fmt(N)} × ${p / 100} ＝ <b>${fmt(x)}${u}</b>`,
          };
        }
        return {
          q: `${whole}のうち、${part}のは${fmt(x)}${u}で、これは全体の${p}%にあたる。${short}は全部で何${u}か。`,
          ...numChoices(r, N, [(x * p) / 100, x * (100 - p) / 100 + x, x + x * p / 100], { unit: u }),
          explain: `全体 ＝ 部分 ÷ 割合 なので、${fmt(x)} ÷ ${p / 100} ＝ <b>${fmt(N)}${u}</b>`,
        };
      }
      const kind = r.int(0, 2);
      if (kind === 0) {
        const [a, b] = retry(() => {
          const a = r.step(20, 80, 5), b = r.step(10, 60, 5);
          return (a * b) % 10 === 0 ? [a, b] : null;
        });
        const ans = (a * b) / 100;
        return {
          q: `あるサークルの会員のうち${a}%が社会人で、社会人のうち${b}%が20代である。20代の社会人は、会員全体の何%か。`,
          ...numChoices(r, ans, [(a + b) / 2, Math.abs(a - b), ((100 - a) * b) / 100, b], { unit: "%" }),
          explain: `全体の${a}%のうちの${b}%なので、${a / 100} × ${b / 100} ＝ ${ans / 100} → <b>${fmt(ans)}%</b>`,
        };
      }
      if (kind === 1) {
        const [p, q] = retry(() => {
          const p = r.step(5, 40, 5), q = r.step(5, 40, 5);
          return ((100 + p) * (100 - q)) % 10 === 0 ? [p, q] : null;
        });
        const ans = ((100 + p) * (100 - q)) / 100;
        return {
          q: `ある店の売上は、昨年は一昨年より${p}%増え、今年は昨年より${q}%減った。今年の売上は、一昨年の売上の何%か。`,
          ...numChoices(r, ans, [100 + p - q, 100 - p + q, ((100 - p) * (100 + q)) / 100], { unit: "%" }),
          explain: `一昨年を100とすると、昨年は${100 + p}、今年は ${100 + p} × ${(100 - q) / 100} ＝ <b>${fmt(ans)}%</b>（足し引きの ${100 + p - q}% にはならない）`,
        };
      }
      const [x, y] = retry(() => {
        const x = r.step(10, 70, 5), y = r.step(10, 80, 5);
        return ((100 - x) * y) % 10 === 0 ? [x, y] : null;
      });
      const ans = ((100 - x) * y) / 100;
      return {
        q: `ある町の住民のうち${x}%が町外へ通勤している。町外へ通勤していない住民のうち${y}%が町内で働いている。町内で働いている住民は、住民全体の何%か。`,
        ...numChoices(r, ans, [(x * y) / 100, y - x, y, 100 - x - y], { unit: "%" }),
        explain: `町外へ通勤していないのは全体の${100 - x}%。その${y}%なので、${(100 - x) / 100} × ${y / 100} ＝ <b>${fmt(ans)}%</b>`,
      };
    },
  },

  {
    id: "soneki", name: "損益算", time: [45, 75],
    tip: "定価 ＝ 原価 ×（1＋利益率）、売値 ＝ 定価 ×（1−割引率）、利益 ＝ 売値 − 原価。原価を100と置くと楽。",
    gen(r, hard) {
      if (!hard) {
        if (r.chance(0.5)) {
          const Cst = r.step(400, 3000, 100), p = r.int(1, 5), T = (Cst * (10 + p)) / 10;
          return {
            q: `原価${yen(Cst)}の品物に、原価の${p}割の利益を見込んで定価をつけた。定価は何円か。`,
            ...numChoices(r, T, [(Cst * p) / 10, (Cst * (10 - p)) / 10, Cst + p * 100], { unit: "円" }),
            explain: `${p}割の利益を見込む → 原価の (1＋${p / 10}) 倍。${fmt(Cst)} × ${(10 + p) / 10} ＝ <b>${yen(T)}</b>`,
          };
        }
        const T = r.step(500, 5000, 100), q = r.step(10, 40, 5), S = (T * (100 - q)) / 100;
        return {
          q: `定価${yen(T)}の品物を、定価の${q}%引きで売った。売値は何円か。`,
          ...numChoices(r, S, [(T * q) / 100, T - q * 10, (T * (100 + q)) / 100], { unit: "円" }),
          explain: `${q}%引き → 定価の (1−${q / 100}) 倍。${fmt(T)} × ${(100 - q) / 100} ＝ <b>${yen(S)}</b>`,
        };
      }
      if (r.chance(0.55)) {
        const [Cst, p, q, T, S] = retry(() => {
          const Cst = r.step(500, 5000, 100), p = r.int(1, 5), q = r.step(5, 30, 5);
          const T = (Cst * (10 + p)) / 10, S = (T * (100 - q)) / 100;
          return isInt(S) && S > Cst ? [Cst, p, q, T, S] : null;
        });
        const ans = S - Cst;
        return {
          q: `原価${yen(Cst)}の品物に、原価の${p}割の利益を見込んで定価をつけた。しかし売れなかったため、定価の${q}%引きで売った。このときの利益は何円か。`,
          ...numChoices(r, ans, [(Cst * p) / 10 - (Cst * q) / 100, (T * q) / 100, (Cst * p) / 10, ans + (Cst * q) / 100], { unit: "円" }),
          explain: `定価 ＝ ${fmt(Cst)} × ${(10 + p) / 10} ＝ ${yen(T)}<br>売値 ＝ ${fmt(T)} × ${(100 - q) / 100} ＝ ${yen(S)}<br>利益 ＝ ${fmt(S)} − ${fmt(Cst)} ＝ <b>${yen(ans)}</b>`,
          num: ans, unit: "円",
        };
      }
      const [R, q, p] = retry(() => {
        const R = r.step(110, 175, 5), q = r.step(10, 40, 5);
        const p = (R * (100 - q)) / 100 - 100;
        return isInt(p) && p > 0 ? [R, q, p] : null;
      });
      return {
        q: `ある品物を定価の${q}%引きで売ると、原価の${p}%の利益が出る。定価は原価の何%か。`,
        ...numChoices(r, R, [100 + p + q, ((100 + p) * (100 + q)) / 100, 100 + p], { unit: "%" }),
        explain: `原価を100とすると売値は${100 + p}。売値 ＝ 定価 × ${(100 - q) / 100} なので、定価 ＝ ${100 + p} ÷ ${(100 - q) / 100} ＝ <b>${R}%</b>`,
      };
    },
  },

  {
    id: "waribiki", name: "料金の割引", time: [45, 75],
    tip: "「○人を超えた分」は○＋1人目から割引。割引になる人数と、ならない人数に分けて計算する。",
    gen(r, hard) {
      const P = r.step(500, 2000, 100);
      if (!hard) {
        const K = r.int(10, 20), N = K + r.int(3, 15), rr = r.int(1, 3);
        const ans = P * K + ((N - K) * P * (10 - rr)) / 10;
        return {
          q: `ある美術館の入館料は1人${yen(P)}だが、団体の場合は${K}人を超えた分について1人あたり${rr}割引きになる。${N}人の団体で入館したときの入館料の合計は何円か。`,
          ...numChoices(r, ans, [(N * P * (10 - rr)) / 10, P * (K - 1) + ((N - K + 1) * P * (10 - rr)) / 10, N * P], { unit: "円" }),
          explain: `定価で払うのは${K}人、割引は${N - K}人。<br>${fmt(P)} × ${K} ＋ ${fmt(P)} × ${(10 - rr) / 10} × ${N - K} ＝ <b>${yen(ans)}</b>`,
          num: ans, unit: "円",
        };
      }
      if (r.chance(0.5)) {
        const K1 = r.step(10, 20, 5), K2 = K1 + r.step(10, 20, 5), N = K2 + r.int(2, 15);
        const r1 = r.int(1, 2), r2 = r1 + r.int(1, 2);
        const ans = P * K1 + ((K2 - K1) * P * (10 - r1)) / 10 + ((N - K2) * P * (10 - r2)) / 10;
        return {
          q: `ある遊覧船の乗船料は1人${yen(P)}である。団体の場合、${K1}人を超え${K2}人までの分は1人あたり${r1}割引き、${K2}人を超えた分は1人あたり${r2}割引きになる。${N}人の団体の乗船料の合計は何円か。`,
          ...numChoices(r, ans, [
            P * K1 + ((N - K1) * P * (10 - r1)) / 10,
            (N * P * (10 - r2)) / 10,
            P * K1 + ((K2 - K1) * P * (10 - r1)) / 10 + ((N - K2) * P * (10 - r1 - r2)) / 10,
          ], { unit: "円" }),
          explain: `定価${K1}人：${fmt(P * K1)}円<br>${r1}割引き${K2 - K1}人：${fmt(P)} × ${(10 - r1) / 10} × ${K2 - K1} ＝ ${fmt(((K2 - K1) * P * (10 - r1)) / 10)}円<br>${r2}割引き${N - K2}人：${fmt(P)} × ${(10 - r2) / 10} × ${N - K2} ＝ ${fmt(((N - K2) * P * (10 - r2)) / 10)}円<br>合計 <b>${yen(ans)}</b>`,
          num: ans, unit: "円",
        };
      }
      const K = r.int(10, 20), N = K + r.int(3, 20), rr = r.int(1, 3);
      const T = P * K + ((N - K) * P * (10 - rr)) / 10;
      return {
        q: `ある施設の入場料は1人${yen(P)}で、団体の場合は${K}人を超えた分について1人あたり${rr}割引きになる。ある団体の入場料の合計は${yen(T)}だった。この団体は何人か。`,
        ...numChoices(r, N, [N - 1, N + 1, Math.round(T / P), N + 2], { unit: "人", step: 1 }),
        explain: `${K}人分は定価で ${fmt(P * K)}円。残り ${fmt(T - P * K)}円 は1人 ${fmt((P * (10 - rr)) / 10)}円 なので ${N - K}人。合計 ${K} ＋ ${N - K} ＝ <b>${N}人</b>`,
        num: N, unit: "人",
      };
    },
  },

  {
    id: "sokudo", name: "速さ", time: [45, 90],
    tip: "道のり ＝ 速さ × 時間。分⇔時間の換算に注意（20分 ＝ 1/3時間）。出会い算は速さの和、追いかけ算は速さの差。",
    gen(r, hard) {
      if (!hard) {
        const [v, t, d] = retry(() => {
          const v = r.pick([3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 48, 60]);
          const t = r.pick([10, 15, 20, 30, 40, 45, 50, 90]);
          const d = (v * t) / 60;
          return isInt(d * 10) && d >= 1 ? [v, t, d] : null;
        });
        if (r.chance(0.5)) {
          return {
            q: `${fmt(d)}kmの道のりを${t}分で進んだ。このときの速さは時速何kmか。`,
            ...numChoices(r, v, [(d / t) * 100, d * t / 10, v / 2], { unit: "km" }),
            explain: `${t}分 ＝ ${fmt(t / 60)}時間。速さ ＝ 道のり ÷ 時間 ＝ ${fmt(d)} ÷ ${fmt(t / 60)} ＝ 時速<b>${fmt(v)}km</b>`,
          };
        }
        return {
          q: `時速${v}kmで${t}分進むと、何km進むか。`,
          ...numChoices(r, d, [(v * t) / 100, v * t / 10, v / t], { unit: "km" }),
          explain: `${t}分 ＝ ${fmt(t / 60)}時間。道のり ＝ ${v} × ${fmt(t / 60)} ＝ <b>${fmt(d)}km</b>`,
        };
      }
      const kind = r.int(0, 2);
      if (kind === 0) {
        const a = r.step(50, 120, 10), b = r.step(50, 120, 10), t = r.int(5, 20);
        const same = a !== b && r.chance(0.4);
        const [hi, lo] = a > b ? [a, b] : [b, a];
        const L = (same ? hi - lo : a + b) * t;
        return same
          ? {
            q: `1周${fmt(L)}mの池の周りを、AとBが同じ地点から同時に同じ方向へ歩き出した。Aは分速${hi}m、Bは分速${lo}mで歩くとき、AがBに初めて追いつくのは出発の何分後か。`,
            ...numChoices(r, t, [L / (hi + lo), L / hi, Math.round(L / lo)], { unit: "分後", step: 1 }),
            explain: `同じ方向なので、AはBとの差を1分に ${hi} − ${lo} ＝ ${hi - lo}m ずつ縮める。1周分（${fmt(L)}m）縮めるのは ${fmt(L)} ÷ ${hi - lo} ＝ <b>${t}分後</b>`,
            num: t, unit: "分後",
          }
          : {
            q: `1周${fmt(L)}mの池の周りを、AとBが同じ地点から同時に反対方向へ歩き出した。Aは分速${a}m、Bは分速${b}mで歩くとき、2人が初めて出会うのは出発の何分後か。`,
            ...numChoices(r, t, [Math.round(L / Math.max(a, b)), t * 2, Math.round(L / Math.max(Math.abs(a - b), 10))], { unit: "分後", step: 1 }),
            explain: `反対方向なので、2人の距離は1分に ${a} ＋ ${b} ＝ ${a + b}m ずつ縮まる。${fmt(L)} ÷ ${a + b} ＝ <b>${t}分後</b>`,
            num: t, unit: "分後",
          };
      }
      if (kind === 1) {
        const [a, b, m, t] = retry(() => {
          const d = r.step(10, 60, 10), t = r.int(4, 20), m = r.int(3, 15);
          const a = (d * t) / m;
          return isInt(a) && a % 5 === 0 && a >= 50 && a <= 100 ? [a, a + d, m, t] : null;
        });
        return {
          q: `Aが分速${a}mで家を出発した。その${m}分後に、Bが同じ道を分速${b}mで追いかけた。BがAに追いつくのは、Bが出発してから何分後か。`,
          ...numChoices(r, t, [t + m, Math.round((a * m) / b), Math.max(t - m, 1)], { unit: "分後", step: 1 }),
          explain: `Bが出発した時点でAは ${a} × ${m} ＝ ${a * m}m 先にいる。差は1分に ${b} − ${a} ＝ ${b - a}m 縮まるので、${a * m} ÷ ${b - a} ＝ <b>${t}分後</b>`,
          num: t, unit: "分後",
        };
      }
      const [a, b, ans] = retry(() => {
        const a = r.int(2, 60), b = r.int(a + 1, 80), ans = (2 * a * b) / (a + b);
        return isInt(ans * 10) && (a + b) % 2 === 0 ? [a, b, ans] : null;
      });
      return {
        q: `ある道のりを、行きは時速${a}km、帰りは時速${b}kmで往復した。往復の平均の速さは時速何kmか。`,
        ...numChoices(r, ans, [(a + b) / 2, (a * b) / (a + b), b - a], { unit: "km" }),
        explain: `道のりを${lcm(a, b)}kmとすると、行き${lcm(a, b) / a}時間・帰り${lcm(a, b) / b}時間。往復${lcm(a, b) * 2}km ÷ ${lcm(a, b) / a + lcm(a, b) / b}時間 ＝ 時速<b>${fmt(ans)}km</b>（速さの平均 ${fmt((a + b) / 2)} ではない）`,
      };
    },
  },

  {
    id: "shigoto", name: "仕事算", time: [45, 90],
    tip: "仕事全体を日数の最小公倍数などで置き、1日あたりの仕事量を足し合わせる。",
    gen(r, hard) {
      const pair = () => retry(() => {
        const x = r.int(2, 30), y = r.int(x + 1, 60), t = (x * y) / (x + y);
        return isInt(t) ? [x, y, t] : null;
      });
      if (!hard) {
        const [x, y, t] = pair(), L = lcm(x, y);
        return {
          q: `ある仕事を仕上げるのに、Aだけでは${x}日、Bだけでは${y}日かかる。この仕事をAとBの2人で行うと、何日で仕上がるか。`,
          ...numChoices(r, t, [(x + y) / 2, y - x, Math.round(x / 2)], { unit: "日", step: 1 }),
          explain: `仕事全体を${L}とすると、1日にAは${L / x}、Bは${L / y}。2人で1日${L / x + L / y}なので ${L} ÷ ${L / x + L / y} ＝ <b>${t}日</b>`,
          num: t, unit: "日",
        };
      }
      const kind = r.int(0, 2);
      if (kind === 0) {
        const [x, y, k, ans] = retry(() => {
          const x = r.int(4, 30), y = r.int(4, 40), k = r.int(1, x - 1), ans = (y * (x - k)) / x;
          return isInt(ans) && x !== y ? [x, y, k, ans] : null;
        });
        const L = lcm(x, y);
        return {
          q: `ある仕事を仕上げるのに、Aだけでは${x}日、Bだけでは${y}日かかる。Aが${k}日働いたあと、残りをBが1人で仕上げた。Bは何日働いたか。`,
          ...numChoices(r, ans, [y - k, Math.round((y * k) / x), x - k], { unit: "日", step: 1 }),
          explain: `全体を${L}とすると、Aは1日${L / x}、Bは1日${L / y}。Aが${k}日で${(L / x) * k}進め、残り${L - (L / x) * k}をBが ${L - (L / x) * k} ÷ ${L / y} ＝ <b>${ans}日</b>`,
          num: ans, unit: "日",
        };
      }
      if (kind === 1) {
        const [x, y, z, t] = retry(() => {
          const [x, y, z] = [r.int(2, 30), r.int(2, 40), r.int(2, 60)].sort((a, b) => a - b);
          const t = 1 / (1 / x + 1 / y + 1 / z);
          return x < y && y < z && near(t, Math.round(t)) ? [x, y, z, Math.round(t)] : null;
        });
        const L = lcm(lcm(x, y), z);
        return {
          q: `ある仕事を仕上げるのに、Aだけでは${x}日、Bだけでは${y}日、Cだけでは${z}日かかる。この仕事を3人で行うと、何日で仕上がるか。`,
          ...numChoices(r, t, [Math.round((x + y + z) / 3), Math.round(x / 3), Math.round(x / 2)], { unit: "日", step: 1 }),
          explain: `全体を${L}とすると、1日にAは${L / x}、Bは${L / y}、Cは${L / z}。3人で1日${L / x + L / y + L / z}なので ${L} ÷ ${L / x + L / y + L / z} ＝ <b>${t}日</b>`,
          num: t, unit: "日",
        };
      }
      const [x, y, ans] = retry(() => {
        const x = r.int(5, 40), y = r.int(x + 1, 90), ans = (x * y) / (y - x);
        return isInt(ans) && ans <= 240 ? [x, y, ans] : null;
      });
      const L = lcm(x, y);
      return {
        q: `空の水槽を満水にするのに、給水管Aだけでは${x}分かかる。満水の水槽を排水管Bだけで空にするには${y}分かかる。空の水槽でAとBを同時に開くと、満水になるまで何分かかるか。`,
        ...numChoices(r, ans, [Math.round((x * y) / (x + y)), y - x, x + y], { unit: "分", step: 1 }),
        explain: `水槽を${L}とすると、1分にAは${L / x}入れ、Bは${L / y}出す。差し引き1分${L / x - L / y}たまるので ${L} ÷ ${L / x - L / y} ＝ <b>${ans}分</b>`,
        num: ans, unit: "分",
      };
    },
  },

  {
    id: "bunkatsu", name: "分割払い", time: [45, 90],
    tip: "総額を1として、支払った分を引いていく。「残額の○分の1」は残額に掛ける。",
    gen(r, hard) {
      const frac = (lo, hi) => { const d = r.int(lo, hi); return F(r.int(1, Math.max(1, Math.floor(d / 3))), d); };
      if (!hard) {
        const a = frac(3, 8), n = r.int(2, 6), ans = F(1).sub(a).div(n);
        return {
          q: `ある品物を買い、購入時に総額の${a.html()}を頭金として支払った。残額を${n}回の均等払いにするとき、1回の支払額は総額のどれだけか。`,
          ...fracChoices(r, ans, [a.div(n), F(1, n), F(1).sub(a).div(n + 1), F(1, n + 1)], { max: 1 }),
          explain: `残額は 1 − ${a.html()} ＝ ${F(1).sub(a).html()}。これを${n}回に分けて ${F(1).sub(a).html()} ÷ ${n} ＝ <b>${ans.html()}</b>`,
        };
      }
      if (r.chance(0.5)) {
        const [a, b, m, n, rest, ans] = retry(() => {
          const a = F(1, r.int(3, 8)), b = F(1, r.int(3, 10)), m = F(1, r.pick([5, 10, 20])), n = r.int(2, 6);
          const rest = F(1).sub(a).sub(b), ans = rest.mul(F(1).add(m)).div(n);
          return rest.v > 0 && ans.d <= 300 ? [a, b, m, n, rest, ans] : null;
        });
        return {
          q: `ある品物を買い、購入時に総額の${a.html()}、翌月に総額の${b.html()}を支払った。残額は、残額の${m.html()}にあたる手数料を加えたうえで${n}回の均等払いにする。1回の支払額は総額のどれだけか。`,
          ...fracChoices(r, ans, [rest.div(n), rest.add(m).div(n), rest.mul(m).div(n), rest.mul(F(1).add(m)).div(n + 1)], { max: 1 }),
          explain: `残額 ＝ 1 − ${a.html()} − ${b.html()} ＝ ${rest.html()}<br>手数料込み ＝ ${rest.html()} × (1 ＋ ${m.html()}) ＝ ${rest.mul(F(1).add(m)).html()}<br>1回分 ＝ ${rest.mul(F(1).add(m)).html()} ÷ ${n} ＝ <b>${ans.html()}</b>`,
        };
      }
      const [a, c, n, ans] = retry(() => {
        const a = frac(3, 8), c = F(1, r.int(2, 6)), n = r.int(2, 5);
        const ans = F(1).sub(a).mul(F(1).sub(c)).div(n);
        return ans.d <= 300 ? [a, c, n, ans] : null;
      });
      const rest1 = F(1).sub(a);
      return {
        q: `ある品物を買い、購入時に総額の${a.html()}を支払い、品物の受け取り時に残額の${c.html()}を支払った。さらにその残りを${n}回の均等払いにする。1回の支払額は総額のどれだけか。`,
        ...fracChoices(r, ans, [F(1).sub(a).sub(c).div(n), rest1.mul(c).div(n), rest1.div(n)], { max: 1 }),
        explain: `頭金の後の残額 ${rest1.html()}。受け取り時にその${c.html()}を払うので残りは ${rest1.html()} × (1 − ${c.html()}) ＝ ${rest1.mul(F(1).sub(c)).html()}<br>1回分 ＝ ${rest1.mul(F(1).sub(c)).html()} ÷ ${n} ＝ <b>${ans.html()}</b>`,
      };
    },
  },

  {
    id: "seisan", name: "代金の精算", time: [45, 75],
    tip: "まず1人あたりの負担額を出し、各人の「払いすぎ・払い足りない」を比べる。",
    gen(r, hard) {
      if (!hard) {
        const [X, Y] = retry(() => {
          const X = r.step(4000, 30000, 200), Y = r.step(1000, 20000, 200);
          return X > Y ? [X, Y] : null;
        });
        const ans = (X - Y) / 2;
        return {
          q: `AとBの2人で旅行に行き、交通費${yen(X)}はAが、宿泊費${yen(Y)}はBが払った。費用を2人で均等に負担するには、BがAにいくら払えばよいか。`,
          ...numChoices(r, ans, [X - Y, X / 2, (X + Y) / 2], { unit: "円" }),
          explain: `1人あたり (${fmt(X)} ＋ ${fmt(Y)}) ÷ 2 ＝ ${yen((X + Y) / 2)}。Aは${yen(X - (X + Y) / 2)}払いすぎなので、BがAに<b>${yen(ans)}</b>払う`,
          num: ans, unit: "円",
        };
      }
      const [X, Y, Z, S] = retry(() => {
        const X = r.step(6000, 30000, 300), Y = r.step(3000, 20000, 300), Z = r.step(500, 5000, 500), S = (X + Y) / 3;
        return isInt(S) && S % 100 === 0 && X > S && Y >= S ? [X, Y, Z, S] : null;
      });
      const toQ = Y - S, ans = X - S + Z;
      return {
        q: `P、Q、Rの3人で食事会の費用を均等に負担することにした。会場代${yen(X)}はPが、料理代${yen(Y)}はQが払い、Rは何も払っていない。また、RはPから以前${yen(Z)}借りていたので、それもあわせて精算する。RはPにいくら払えばよいか。`,
        ...numChoices(r, ans, [X - S, X - S - Z, S + Z, S], { unit: "円" }),
        explain: `1人あたり (${fmt(X)} ＋ ${fmt(Y)}) ÷ 3 ＝ ${yen(S)}。Pは${yen(X - S)}払いすぎ${toQ ? `、Qは${yen(toQ)}払いすぎ` : ""}。RはPに${yen(X - S)}${toQ ? `、Qに${yen(toQ)}` : ""}払う。借金${yen(Z)}も返すので、Pへは<b>${yen(ans)}</b>`,
        num: ans, unit: "円",
      };
    },
  },

  {
    id: "kakuritsu", name: "確率", time: [45, 90],
    tip: "確率 ＝ 当てはまる場合の数 ÷ 全体の場合の数。「少なくとも」は 1 −（1つもない確率）。",
    gen(r, hard) {
      if (!hard) {
        if (r.chance(0.5)) {
          const s = r.int(3, 11), cnt = 6 - Math.abs(s - 7), ans = F(cnt, 36);
          return {
            q: `大小2個のサイコロを同時に投げるとき、出た目の和が${s}になる確率はいくらか。`,
            ...fracChoices(r, ans, [F(cnt, 6), F(cnt + 1, 36), F(1, s), F(cnt, 21)], { max: 1 }),
            explain: `目の出方は全部で 6 × 6 ＝ 36通り。和が${s}になるのは${cnt}通りなので <b>${ans.html()}</b>`,
          };
        }
        const n = r.pick([3, 4]), k = r.int(1, n - 1), ans = F(C(n, k), 2 ** n);
        return {
          q: `${n}枚の硬貨を同時に投げるとき、ちょうど${k}枚が表になる確率はいくらか。`,
          ...fracChoices(r, ans, [F(1, 2 ** n), F(k, n), F(1, n + 1), F(C(n, k), 2 ** n + 2)], { max: 1 }),
          explain: `表裏の出方は 2<sup>${n}</sup> ＝ ${2 ** n}通り。${k}枚が表になる組み合わせは ${n}C${k} ＝ ${C(n, k)}通りなので <b>${ans.html()}</b>`,
        };
      }
      const kind = r.int(0, 3);
      if (kind <= 1) {
        const a = r.int(2, 6), b = r.int(2, 6), all = C(a + b, 2);
        if (kind === 0) {
          const ans = F(C(a, 2) + C(b, 2), all);
          return {
            q: `袋の中に赤玉が${a}個、白玉が${b}個入っている。ここから同時に2個取り出すとき、2個が同じ色である確率はいくらか。`,
            ...fracChoices(r, ans, [F(a * a + b * b, (a + b) ** 2), F(C(a, 2), all), F(1, 2), F(a * b, all)], { max: 1 }),
            explain: `取り出し方は全部で ${a + b}C2 ＝ ${all}通り。赤2個 ${a}C2 ＝ ${C(a, 2)}通り、白2個 ${b}C2 ＝ ${C(b, 2)}通り。(${C(a, 2)} ＋ ${C(b, 2)}) ÷ ${all} ＝ <b>${ans.html()}</b>`,
          };
        }
        const ans = F(1).sub(F(C(b, 2), all));
        return {
          q: `袋の中に赤玉が${a}個、白玉が${b}個入っている。ここから同時に2個取り出すとき、少なくとも1個が赤玉である確率はいくらか。`,
          ...fracChoices(r, ans, [F(C(a, 2), all), F(a * b, all), F(1).sub(F(b * b, (a + b) ** 2)), F(a, a + b)], { max: 1 }),
          explain: `「少なくとも1個は赤」＝ 1 −「2個とも白」。2個とも白は ${b}C2 ÷ ${a + b}C2 ＝ ${F(C(b, 2), all).html()}。1 − ${F(C(b, 2), all).html()} ＝ <b>${ans.html()}</b>`,
        };
      }
      if (kind === 2) {
        const p = r.pick([F(1, 2), F(1, 3), F(2, 3), F(1, 4), F(3, 4), F(2, 5), F(3, 5)]), q = F(1).sub(p);
        const two = p.mul(p).mul(q).mul(3), three = p.mul(p).mul(p), ans = two.add(three);
        return {
          q: `AとBが試合をすると、Aが勝つ確率は${p.html()}で、引き分けはない。3試合行うとき、Aが2勝以上する確率はいくらか。`,
          ...fracChoices(r, ans, [two, p.mul(p), p.mul(p).mul(q).add(three), F(2, 3)], { max: 1 }),
          explain: `2勝1敗は負ける試合の選び方が3通りで 3 × (${p.html()})² × ${q.html()} ＝ ${two.html()}。3勝は (${p.html()})³ ＝ ${three.html()}。合わせて <b>${ans.html()}</b>`,
        };
      }
      const n = r.int(5, 12), k = r.int(1, Math.min(4, n - 2)), ans = F(n - k, n).mul(F(k, n - 1));
      return {
        q: `${n}本のくじの中に当たりが${k}本ある。AとBがこの順に1本ずつ引く（引いたくじは戻さない）。Aがはずれ、Bが当たる確率はいくらか。`,
        ...fracChoices(r, ans, [F(k, n), F(n - k, n).mul(F(k, n)), F(k, n - 1), F(n - k, n)], { max: 1 }),
        explain: `Aがはずれる確率 ${F(n - k, n).html()}。残り${n - 1}本に当たり${k}本なので、Bが当たる確率 ${F(k, n - 1).html()}。掛けて <b>${ans.html()}</b>`,
      };
    },
  },

  {
    id: "baai", name: "場合の数", time: [45, 75],
    tip: "順番を区別するなら順列 nPr、区別しないなら組合せ nCr。「隣り合う」はひとまとめにして数える。",
    gen(r, hard) {
      if (!hard) {
        const kind = r.int(0, 2);
        if (kind === 0) {
          const n = r.int(5, 10), ans = P(n, 2);
          return {
            q: `${n}人の中から、委員長と副委員長を1人ずつ選ぶ。選び方は何通りあるか。`,
            ...numChoices(r, ans, [C(n, 2), n * n, 2 * n], { unit: "通り" }),
            explain: `役職が違うので順番を区別する（順列）。${n}P2 ＝ ${n} × ${n - 1} ＝ <b>${ans}通り</b>`,
            num: ans, unit: "通り",
          };
        }
        if (kind === 1) {
          const n = r.int(5, 9), k = r.int(2, 3), ans = C(n, k);
          return {
            q: `${n}人の中から、${k}人の代表を選ぶ。選び方は何通りあるか。`,
            ...numChoices(r, ans, [P(n, k), n * k, C(n, k - 1)], { unit: "通り" }),
            explain: `代表どうしに区別はないので組合せ。${n}C${k} ＝ ${P(n, k)} ÷ ${fact(k)} ＝ <b>${ans}通り</b>`,
            num: ans, unit: "通り",
          };
        }
        const n = r.int(4, 6), ans = fact(n);
        return {
          q: `${n}人が横1列に並ぶ。並び方は何通りあるか。`,
          ...numChoices(r, ans, [n * n, fact(n - 1), n ** (n - 1)], { unit: "通り" }),
          explain: `${[...Array(n)].map((_, i) => n - i).join(" × ")} ＝ <b>${ans}通り</b>`,
          num: ans, unit: "通り",
        };
      }
      const kind = r.int(0, 3);
      if (kind === 0) {
        const m = r.int(3, 6), f = r.int(2, 5), k = 3, ans = C(m + f, k) - C(m, k);
        return {
          q: `男子${m}人、女子${f}人の中から3人を選ぶ。女子が少なくとも1人含まれる選び方は何通りあるか。`,
          ...numChoices(r, ans, [C(m + f, k), f * C(m + f - 1, k - 1), C(f, 1) * C(m, 2)], { unit: "通り" }),
          explain: `全体 ${m + f}C3 ＝ ${C(m + f, 3)}通りから、男子だけ ${m}C3 ＝ ${C(m, 3)}通りを引いて <b>${ans}通り</b>`,
          num: ans, unit: "通り",
        };
      }
      if (kind === 1) {
        const n = r.int(4, 7), ans = 2 * fact(n - 1);
        return {
          q: `A、Bを含む${n}人が横1列に並ぶ。AとBが隣り合う並び方は何通りあるか。`,
          ...numChoices(r, ans, [fact(n - 1), fact(n) - ans, fact(n) / 2], { unit: "通り" }),
          explain: `AとBをひとまとめにすると${n - 1}人分の並び方で ${n - 1}! ＝ ${fact(n - 1)}通り。AとBの入れ替え2通りを掛けて <b>${ans}通り</b>`,
          num: ans, unit: "通り",
        };
      }
      if (kind === 2) {
        const n = r.int(4, 8), ans = fact(n - 1);
        return {
          q: `${n}人が円形のテーブルに座る。回転して同じになる座り方は同じとみなすとき、座り方は何通りあるか。`,
          ...numChoices(r, ans, [fact(n), fact(n - 1) / 2, fact(n - 2)], { unit: "通り" }),
          explain: `1人の席を固定して残り${n - 1}人を並べる。(${n} − 1)! ＝ <b>${ans}通り</b>`,
          num: ans, unit: "通り",
        };
      }
      const digits = ranks(r.int(4, 6)).map((d) => d - 1);
      const cond = r.pick([["偶数", (v) => v % 2 === 0], ["5の倍数", (v) => v % 5 === 0], ["300以上", (v) => v >= 300]]);
      const nums = permutations(digits).map((p) => p.slice(0, 3)).filter((p) => p[0] !== 0).map((p) => p[0] * 100 + p[1] * 10 + p[2]);
      const ans = new Set(nums.filter(cond[1])).size;
      const total = new Set(nums).size;
      return {
        q: `${digits.join("、")}の${digits.length}個の数字から異なる3個を選んで並べ、3けたの整数をつくる。${cond[0]}は何個できるか。`,
        ...numChoices(r, ans, [Math.round(total / 2), P(digits.length, 3), total - ans], { unit: "個" }),
        explain: `百の位に0は使えない点に注意して、${cond[0] === "偶数" ? "一の位が0の場合と、0以外の偶数の場合に分けて" : cond[0] === "5の倍数" ? "一の位が0の場合と5の場合に分けて" : "百の位が3以上の場合を"}数える。3けたの整数は全部で${total}個、そのうち${cond[0]}は<b>${ans}個</b>`,
        num: ans, unit: "個",
      };
    },
  },

  {
    id: "shugo", name: "集合", time: [45, 75],
    tip: "両方 ＝ A ＋ B −（全体 − どちらでもない）。ベン図に数を書き込むと迷わない。",
    gen(r, hard) {
      const [A, B, verb, neg] = r.pick([
        ["犬", "猫", "飼っている", "飼っていない"],
        ["新聞", "雑誌", "定期購読している", "定期購読していない"],
        ["英検", "簿記検定", "受けたことがある", "受けたことがない"],
        ["電車", "バス", "通勤に使っている", "通勤に使っていない"],
      ]);
      if (hard && r.chance(0.35)) {
        const [N, p, q, s, ans] = retry(() => {
          const N = r.step(200, 1000, 20), p = r.step(20, 80, 5), q = r.step(20, 80, 5), s = r.step(5, 40, 5);
          const both = p + q + s - 100;
          return both > 0 && both < Math.min(p, q) ? [N, p, q, s, (N * both) / 100] : null;
        });
        return {
          q: `${fmt(N)}人に、${A}と${B}をそれぞれ${verb}かどうかを尋ねた。${A}を${verb}人は${p}%、${B}を${verb}人は${q}%、どちらも${neg}人は${s}%だった。${A}と${B}の両方を${verb}人は何人か。`,
          ...numChoices(r, ans, [(N * (p + q - 100)) / 100, (N * s) / 100, (N * (100 - s)) / 100], { unit: "人" }),
          explain: `少なくとも一方を${verb}のは ${100 - s}%。両方 ＝ ${p} ＋ ${q} − ${100 - s} ＝ ${p + q + s - 100}%。${fmt(N)} × ${(p + q + s - 100) / 100} ＝ <b>${fmt(ans)}人</b>`,
          num: ans, unit: "人",
        };
      }
      const [N, a, b, c, x] = retry(() => {
        const x = r.int(3, 40), a = x + r.int(5, 80), b = x + r.int(5, 80), c = r.int(3, 50);
        return [a + b - x + c, a, b, c, x];
      });
      const head = `${N}人に、${A}と${B}をそれぞれ${verb}かどうかを尋ねた。${A}を${verb}人は${a}人、${B}を${verb}人は${b}人、どちらも${neg}人は${c}人だった。`;
      const base = `少なくとも一方を${verb}のは ${N} − ${c} ＝ ${N - c}人。両方 ＝ ${a} ＋ ${b} − ${N - c} ＝ ${x}人`;
      if (!hard) {
        return {
          q: `${head}${A}と${B}の両方を${verb}人は何人か。`,
          ...numChoices(r, x, [a + b - N, N - c - a, Math.abs(a - b)], { unit: "人", step: 1 }),
          explain: `${base.replace(`${x}人`, `<b>${x}人</b>`)}`,
          num: x, unit: "人",
        };
      }
      if (r.chance(0.5)) {
        return {
          q: `${head}${A}だけを${verb}人は何人か。`,
          ...numChoices(r, a - x, [a, N - c - b + x, a - c], { unit: "人", step: 1 }),
          explain: `${base}。${A}だけ ＝ ${a} − ${x} ＝ <b>${a - x}人</b>`,
          num: a - x, unit: "人",
        };
      }
      return {
        q: `${head}${A}と${B}のどちらか一方だけを${verb}人は何人か。`,
        ...numChoices(r, a + b - 2 * x, [N - c, a + b - x, N - x], { unit: "人", step: 1 }),
        explain: `${base}。一方だけ ＝ ${N - c} − ${x} ＝ <b>${a + b - 2 * x}人</b>`,
        num: a + b - 2 * x, unit: "人",
      };
    },
  },

  {
    id: "jun", name: "推論（順位）", time: [60, 120],
    tip: "確定しやすい条件（○位、すぐ下）から順に表へ書き込み、残る並びをすべて書き出す。",
    gen(r, hard) {
      const n = hard ? 5 : 4;
      const names = ["P", "Q", "R", "S", "T"].slice(0, n);
      const cands = permutations(ranks(n)).map((p) => Object.fromEntries(names.map((x, i) => [x, p[i]])));
      const pos = r.pick(cands);
      const ask = r.int(1, n);
      const who = names.find((x) => pos[x] === ask);
      const rankText = (k) => (k === n ? "最下位" : `${k}位`);
      const makeClue = () => {
        const [x, y] = r.sample(names, 2);
        switch (r.pick(["above", "above", "gap", "gap", "next", "not", "not", "exact"])) {
          case "above": {
            const [a, b] = pos[x] < pos[y] ? [x, y] : [y, x];
            return { key: `a${a}${b}`, text: `${a}は${b}より順位が上だった`, test: (p) => p[a] < p[b] };
          }
          case "gap": {
            const d = Math.abs(pos[x] - pos[y]), k = `g${[x, y].sort().join("")}`;
            return d === 1
              ? { key: k, text: `${x}と${y}の順位は連続していた`, test: (p) => Math.abs(p[x] - p[y]) === 1 }
              : { key: k, text: `${x}と${y}の間には${d - 1}人いた`, test: (p) => Math.abs(p[x] - p[y]) === d };
          }
          case "next": {
            const b = names.find((z) => pos[z] === pos[x] + 1);
            return b && { key: `n${x}${b}`, text: `${x}のすぐ下の順位は${b}だった`, test: (p) => p[b] === p[x] + 1 };
          }
          case "not": {
            const k = r.pick(ranks(n).filter((k) => k !== pos[x]));
            return { key: `x${x}${k}`, text: `${x}は${rankText(k)}ではなかった`, test: (p) => p[x] !== k };
          }
          default:
            if (!hard && pos[x] === ask) return null;
            return { key: `e${x}${pos[x]}`, text: `${x}は${rankText(pos[x])}だった`, test: (p) => p[x] === pos[x] };
        }
      };
      const intro = `<p>${names.join("、")}の${n}人が徒競走をした。同着はなく、次のことがわかっている。</p>`;
      const order = (p) => names.slice().sort((a, b) => p[a] - p[b]).join(" → ");
      if (!hard) {
        const { clues } = narrow(r, cands, makeClue, false);
        return {
          q: `${intro}${ul(clues.map((c) => c.text))}<p>${rankText(ask)}は誰か。</p>`,
          choices: names, answer: names.indexOf(who),
          explain: `条件をすべて満たす並びは「${order(pos)}」（左が1位）の1通り。${rankText(ask)}は<b>${who}</b>`,
        };
      }
      return retry(() => {
        const { clues, rest } = narrow(r, cands, makeClue, true, 3);
        const pool = [
          ...names.flatMap((x) => ranks(n).map((k) => ({ key: `e${x}${k}`, text: `${x}は${rankText(k)}である`, test: (p) => p[x] === k }))),
          ...names.flatMap((x) => names.filter((y) => y !== x).map((y) => ({ key: `a${x}${y}`, text: `${x}は${y}より順位が上である`, test: (p) => p[x] < p[y] }))),
        ];
        const st = pickStatements(r, rest, pool, clues);
        return st && mustQuestion(intro, clues, st, rest, (p) => `${order(p)}（左が1位）`);
      }, 50);
    },
  },

  {
    id: "uchiwake", name: "推論（内訳）", time: [60, 120],
    tip: "数の組み合わせを表に書き出し、条件に合わないものを消していく。偶数・奇数や「最も多い」も強い手がかり。",
    gen(r, hard) {
      const cols = hard ? ["赤", "青", "白", "黄"] : ["赤", "青", "白"];
      const k = cols.length;
      const N = hard ? r.int(10, 14) : r.int(7, 12);
      const comps = (left, parts) => parts === 1 ? [[left]] : ranks(left - parts + 1).flatMap((x) => comps(left - x, parts - 1).map((c) => [x, ...c]));
      const cands = comps(N, k);
      const t = r.pick(cands);
      const makeClue = () => {
        let [i, j] = r.sample(ranks(k).map((x) => x - 1), 2);
        if (t[i] < t[j]) [i, j] = [j, i];
        const A = cols[i], B = cols[j];
        switch (r.pick(["more", "more", "diff", "times", "parity", "max", "min", "sum", "atleast"])) {
          case "more":
            return t[i] === t[j]
              ? { key: `q${i}${j}`, text: `${A}と${B}は同じ個数だった`, test: (p) => p[i] === p[j] }
              : { key: `m${i}${j}`, text: `${A}は${B}より多かった`, test: (p) => p[i] > p[j] };
          case "diff":
            return t[i] > t[j] && { key: `d${i}${j}`, text: `${A}は${B}より${t[i] - t[j]}個多かった`, test: (p) => p[i] - p[j] === t[i] - t[j] };
          case "times":
            return t[i] % t[j] === 0 && t[i] / t[j] >= 2 && { key: `t${i}${j}`, text: `${A}は${B}の${t[i] / t[j]}倍だった`, test: (p) => p[i] === p[j] * (t[i] / t[j]) };
          case "parity":
            return { key: `p${i}`, text: `${A}は${t[i] % 2 ? "奇数" : "偶数"}個だった`, test: (p) => p[i] % 2 === t[i] % 2 };
          case "max": {
            const m = t.indexOf(Math.max(...t));
            return t.filter((v) => v === t[m]).length === 1 && { key: `M${m}`, text: `${cols[m]}が最も多かった`, test: (p) => p.every((v, z) => z === m || v < p[m]) };
          }
          case "min": {
            const m = t.indexOf(Math.min(...t));
            return t.filter((v) => v === t[m]).length === 1 && { key: `L${m}`, text: `${cols[m]}が最も少なかった`, test: (p) => p.every((v, z) => z === m || v > p[m]) };
          }
          case "sum":
            return { key: `s${[i, j].sort()}`, text: `${A}と${B}は合わせて${t[i] + t[j]}個だった`, test: (p) => p[i] + p[j] === t[i] + t[j] };
          default: {
            if (t[i] < 2) return null;
            const lo = r.int(2, t[i]);
            return { key: `l${i}${lo}`, text: `${A}は${lo}個以上だった`, test: (p) => p[i] >= lo };
          }
        }
      };
      const intro = `<p>${cols.join("・")}の${k}色の玉が、合わせて${N}個ある。どの色の玉も1個以上あり、次のことがわかっている。</p>`;
      const show = (p) => p.map((v, z) => `${cols[z]}${v}`).join("・");
      if (!hard) {
        const { clues } = narrow(r, cands, makeClue, false);
        const z = r.int(0, k - 1);
        return {
          q: `${intro}${ul(clues.map((c) => c.text))}<p>${cols[z]}の玉は何個か。</p>`,
          ...numChoices(r, t[z], [], { unit: "個", step: 1 }),
          explain: `条件をすべて満たす組み合わせは「${show(t)}」の1通り。${cols[z]}は<b>${t[z]}個</b>`,
        };
      }
      return retry(() => {
        const { clues, rest } = narrow(r, cands, makeClue, true, 3);
        const pool = [
          ...cols.flatMap((A, i) => ranks(N - k + 1).map((v) => ({ key: `e${i}${v}`, text: `${A}は${v}個である`, test: (p) => p[i] === v }))),
          ...cols.flatMap((A, i) => cols.map((B, j) => i !== j && { key: `m${i}${j}`, text: `${A}は${B}より多い`, test: (p) => p[i] > p[j] }).filter(Boolean)),
          ...cols.map((A, i) => ({ key: `M${i}`, text: `${A}が最も多い`, test: (p) => p.every((v, z) => z === i || v < p[i]) })),
        ];
        const st = pickStatements(r, rest, pool, clues);
        return st && mustQuestion(intro, clues, st, rest, show);
      }, 50);
    },
  },

  {
    id: "hyo", name: "表の読み取り", time: [50, 90],
    tip: "構成比の表は「総数 × 構成比」で実数に直してから比べる。割合どうしを直接比べない。",
    gen(r, hard) {
      if (!hard) {
        const prods = ["商品A", "商品B", "商品C"];
        const rows = prods.map(() => {
          const a = r.step(100, 600, 20), g = r.step(-20, 40, 5) || 10;
          return [a, (a * (100 + g)) / 100, g];
        });
        const z = r.int(0, 2);
        const tbl = table(["", "昨年（万円）", "今年（万円）"], prods.map((p, i) => [p, fmt(rows[i][0]), fmt(rows[i][1])]), "商品別の売上");
        const [a, b, g] = rows[z];
        if (g > 0 && r.chance(0.6)) {
          return {
            q: `${tbl}<p>${prods[z]}の今年の売上は、昨年より何%増えたか。</p>`,
            ...numChoices(r, g, [((b - a) / b) * 100, (b / a) * 10, g + 5], { unit: "%", dp: 0 }),
            explain: `(${fmt(b)} − ${fmt(a)}) ÷ ${fmt(a)} × 100 ＝ <b>${g}%</b>（増えた分を昨年の値で割る）`,
            num: g, unit: "%",
          };
        }
        const y = (z + r.int(1, 2)) % 3, ans = round(rows[z][1] / rows[y][1], 1);
        return {
          q: `${tbl}<p>今年の${prods[z]}の売上は、今年の${prods[y]}の売上の約何倍か（小数点以下第2位を四捨五入）。</p>`,
          ...numChoices(r, ans, [rows[y][1] / rows[z][1], rows[z][0] / rows[y][0], ans + 0.3], { unit: "倍", dp: 1, step: 0.2 }),
          explain: `${fmt(rows[z][1])} ÷ ${fmt(rows[y][1])} ＝ ${fmt(rows[z][1] / rows[y][1])}… → 約<b>${ans}倍</b>`,
        };
      }
      const shops = ["P支店", "Q支店", "R支店"], items = ["製品X", "製品Y", "製品Z"];
      const T = shops.map(() => r.step(200, 800, 20));
      const pct = shops.map(() => retry(() => {
        const x = r.step(20, 60, 5), y = r.step(15, 50, 5), z = 100 - x - y;
        return z >= 10 ? [x, y, z] : null;
      }));
      const tbl = table(["", "販売台数（総数）", ...items.map((x) => `${x}（%）`)], shops.map((s, i) => [s, fmt(T[i]), ...pct[i]]), "支店別の販売台数と製品の構成比");
      const real = (s, it) => (T[s] * pct[s][it]) / 100;
      const kind = r.int(0, 2);
      if (kind === 0) {
        const [s1, s2] = r.sample([0, 1, 2], 2), it = r.int(0, 2), ans = round(real(s2, it) / real(s1, it), 1);
        return {
          q: `${tbl}<p>${shops[s2]}の${items[it]}の販売台数は、${shops[s1]}の${items[it]}の販売台数の約何倍か（小数点以下第2位を四捨五入）。</p>`,
          ...numChoices(r, ans, [pct[s2][it] / pct[s1][it], T[s2] / T[s1], real(s1, it) / real(s2, it)], { unit: "倍", dp: 1, step: 0.2 }),
          explain: `${shops[s2]}：${fmt(T[s2])} × ${pct[s2][it] / 100} ＝ ${fmt(real(s2, it))}台<br>${shops[s1]}：${fmt(T[s1])} × ${pct[s1][it] / 100} ＝ ${fmt(real(s1, it))}台<br>${fmt(real(s2, it))} ÷ ${fmt(real(s1, it))} ≒ <b>${ans}倍</b>（構成比だけ・総数だけで比べない）`,
        };
      }
      if (kind === 1) {
        const it = r.int(0, 2), ans = [0, 1, 2].reduce((s, i) => s + real(i, it), 0);
        const avg = (pct[0][it] + pct[1][it] + pct[2][it]) / 3;
        return {
          q: `${tbl}<p>3支店を合わせた${items[it]}の販売台数は何台か。</p>`,
          ...numChoices(r, ans, [((T[0] + T[1] + T[2]) * avg) / 100, ans + 20, ans - 30], { unit: "台" }),
          explain: `${[0, 1, 2].map((i) => `${fmt(T[i])} × ${pct[i][it] / 100} ＝ ${fmt(real(i, it))}`).join("<br>")}<br>合計 <b>${fmt(ans)}台</b>`,
          num: ans, unit: "台",
        };
      }
      const s = r.int(0, 2), [i1, i2] = r.sample([0, 1, 2], 2), ans = Math.abs(real(s, i1) - real(s, i2));
      return ans > 0 ? {
        q: `${tbl}<p>${shops[s]}の${items[i1]}と${items[i2]}の販売台数の差は何台か。</p>`,
        ...numChoices(r, ans, [Math.abs(pct[s][i1] - pct[s][i2]), ans * 2, ans + 10], { unit: "台" }),
        explain: `${fmt(T[s])} × (${pct[s][i1]} − ${pct[s][i2]}の差 ${Math.abs(pct[s][i1] - pct[s][i2])}%) ＝ <b>${fmt(ans)}台</b>`,
        num: ans, unit: "台",
      } : this.gen(r, hard);
    },
  },

  {
    id: "nagare", name: "物の流れ", time: [50, 90],
    tip: "X→Y の割合が a なら Y ＝ aX。合流は足し算、経由は掛け算。式は後ろから順に代入する。",
    gen(r, hard) {
      const d1 = () => r.int(1, 9) / 10;
      const note = `<p class="sub">矢印は物の流れを、矢印の横の文字（数）はその割合を表す。たとえば X から Y への割合が a のとき、Y ＝ aX となる。</p>`;
      if (!hard) {
        const X = r.step(100, 2000, 100), a = d1(), b = d1(), ans = round(X * a * b, 3);
        const fig = flowSvg([{ id: "X", x: 40, y: 75 }, { id: "Y", x: 160, y: 75 }, { id: "Z", x: 280, y: 75 }], [{ from: "X", to: "Y", label: a }, { from: "Y", to: "Z", label: b }]);
        return {
          q: `${fig}${note}<p>Xから${fmt(X)}個が送り出されたとき、Zに届くのは何個か。</p>`,
          ...numChoices(r, ans, [X * a, X * (a + b), X * b], { unit: "個" }),
          explain: `Y ＝ ${a} × ${fmt(X)} ＝ ${fmt(X * a)}、Z ＝ ${b} × Y ＝ <b>${fmt(ans)}個</b>（経由するときは割合を掛ける）`,
          num: ans, unit: "個",
        };
      }
      const shape = r.int(0, 2);
      if (shape === 0) {
        const fig = flowSvg([{ id: "X", x: 40, y: 35 }, { id: "Y", x: 40, y: 120 }, { id: "Z", x: 160, y: 75 }, { id: "W", x: 280, y: 75 }],
          [{ from: "X", to: "Z", label: "a" }, { from: "Y", to: "Z", label: "b" }, { from: "Z", to: "W", label: "c" }]);
        if (r.chance(0.5)) {
          return {
            q: `${fig}${note}<p>W を X、Y を使って表した式として正しいものはどれか。</p>`,
            ...textChoices(r, "W ＝ acX ＋ bcY", ["W ＝ aX ＋ bcY", "W ＝ acX ＋ bY", "W ＝ c(X ＋ Y)", "W ＝ abcX ＋ abcY", "W ＝ (a ＋ b)cXY"], 5),
            explain: `Z ＝ aX ＋ bY（合流は足し算）。W ＝ cZ ＝ c(aX ＋ bY) ＝ <b>acX ＋ bcY</b>`,
          };
        }
        const X = r.step(100, 1000, 100), Y = r.step(100, 1000, 100), a = d1(), b = d1(), c = d1();
        const ans = round(c * (a * X + b * Y), 3);
        return {
          q: `${fig}${note}<p>a ＝ ${a}、b ＝ ${b}、c ＝ ${c} とする。Xから${fmt(X)}個、Yから${fmt(Y)}個が送り出されたとき、Wに届くのは何個か。</p>`,
          ...numChoices(r, ans, [a * X + b * Y, c * (X + Y), a * b * c * (X + Y)], { unit: "個" }),
          explain: `Z ＝ ${a} × ${fmt(X)} ＋ ${b} × ${fmt(Y)} ＝ ${fmt(a * X + b * Y)}、W ＝ ${c} × Z ＝ <b>${fmt(ans)}個</b>`,
          num: ans, unit: "個",
        };
      }
      if (shape === 1) {
        const fig = flowSvg([{ id: "X", x: 40, y: 110 }, { id: "Y", x: 160, y: 35 }, { id: "Z", x: 280, y: 110 }],
          [{ from: "X", to: "Y", label: "a" }, { from: "Y", to: "Z", label: "b" }, { from: "X", to: "Z", label: "c" }]);
        return {
          q: `${fig}${note}<p>Z を X を使って表した式として正しいものはどれか。</p>`,
          ...textChoices(r, "Z ＝ (ab ＋ c)X", ["Z ＝ abcX", "Z ＝ (a ＋ b ＋ c)X", "Z ＝ abX", "Z ＝ (a ＋ c)bX", "Z ＝ (a ＋ bc)X"], 5),
          explain: `Y経由の分は abX、直接の分は cX。合流するので Z ＝ abX ＋ cX ＝ <b>(ab ＋ c)X</b>`,
        };
      }
      const fig = flowSvg([{ id: "X", x: 40, y: 75 }, { id: "Y", x: 160, y: 75 }, { id: "Z", x: 280, y: 35 }, { id: "W", x: 280, y: 120 }],
        [{ from: "X", to: "Y", label: "a" }, { from: "Y", to: "Z", label: "b" }, { from: "Y", to: "W", label: "c" }]);
      return {
        q: `${fig}${note}<p>W を X を使って表した式として正しいものはどれか。</p>`,
        ...textChoices(r, "W ＝ acX", ["W ＝ cX", "W ＝ abcX", "W ＝ (a ＋ c)X", "W ＝ bcX", "W ＝ (b ＋ c)aX"], 5),
        explain: `Y ＝ aX、W ＝ cY ＝ <b>acX</b>（Zへの分岐 b は W に関係しない）`,
      };
    },
  },

  {
    id: "noudo", name: "濃度", time: [45, 75],
    tip: "食塩の量 ＝ 食塩水 × 濃度。水を足す・蒸発させても食塩の量は変わらない。",
    gen(r, hard) {
      if (!hard) {
        if (r.chance(0.5)) {
          const w = r.step(100, 800, 100), p = r.int(2, 20), ans = (w * p) / 100;
          return {
            q: `${p}%の食塩水${w}gに含まれる食塩は何gか。`,
            ...numChoices(r, ans, [w / p, (w * p) / 10, w - ans], { unit: "g" }),
            explain: `${w} × ${p / 100} ＝ <b>${fmt(ans)}g</b>`,
            num: ans, unit: "g",
          };
        }
        const T = r.pick([100, 200, 250, 400, 500]), p = r.int(2, 20), y = (T * p) / 100;
        if (!isInt(y)) return this.gen(r, hard);
        return {
          q: `水${T - y}gに食塩${y}gを溶かした。できた食塩水の濃度は何%か。`,
          ...numChoices(r, p, [round((y / (T - y)) * 100, 1), (y / T) * 10, p + 2], { unit: "%" }),
          explain: `食塩水は ${T - y} ＋ ${y} ＝ ${T}g。${y} ÷ ${T} × 100 ＝ <b>${p}%</b>（水の量で割らない）`,
          num: p, unit: "%",
        };
      }
      const kind = r.int(0, 2);
      if (kind === 0) {
        const [p, a, q, b, ans] = retry(() => {
          const p = r.int(2, 20), q = r.int(2, 20), a = r.step(100, 500, 50), b = r.step(100, 500, 50), ans = (p * a + q * b) / (a + b);
          return p !== q && isInt(ans * 10) ? [p, a, q, b, ans] : null;
        });
        return {
          q: `${p}%の食塩水${a}gと${q}%の食塩水${b}gを混ぜた。できた食塩水の濃度は何%か。`,
          ...numChoices(r, ans, [(p + q) / 2, ((p * a + q * b) / (a + b)) * 1.1, (p * b + q * a) / (a + b)], { unit: "%" }),
          explain: `食塩は ${fmt((a * p) / 100)} ＋ ${fmt((b * q) / 100)} ＝ ${fmt((a * p + b * q) / 100)}g、食塩水は${a + b}g。${fmt((a * p + b * q) / 100)} ÷ ${a + b} × 100 ＝ <b>${fmt(ans)}%</b>`,
          num: ans, unit: "%",
        };
      }
      const [a, p, q, s, total] = retry(() => {
        const a = r.step(100, 600, 100), p = r.int(4, 20), q = kind === 1 ? r.int(2, p - 1) : r.int(p + 1, 30);
        const s = (a * p) / 100, total = (s * 100) / q;
        return isInt(s) && isInt(total) ? [a, p, q, s, total] : null;
      });
      const ans = Math.abs(total - a);
      return {
        q: kind === 1
          ? `${p}%の食塩水${a}gに水を加えて、${q}%の食塩水にしたい。水を何g加えればよいか。`
          : `${p}%の食塩水${a}gから水を蒸発させて、${q}%の食塩水にしたい。水を何g蒸発させればよいか。`,
        ...numChoices(r, ans, [total, (a * Math.abs(p - q)) / 100, (a * Math.abs(p - q)) / q], { unit: "g" }),
        explain: `食塩は ${a} × ${p / 100} ＝ ${fmt(s)}gで変わらない。${q}%にするには食塩水が ${fmt(s)} ÷ ${q / 100} ＝ ${fmt(total)}g 必要。${fmt(total)} と ${a} の差で <b>${fmt(ans)}g</b>`,
        num: ans, unit: "g",
      };
    },
  },

  {
    id: "nenrei", name: "年齢算", time: [40, 75],
    tip: "何年たっても2人の年齢の差は変わらない。□年後と置いて式を立てる。",
    gen(r, hard) {
      if (!hard) {
        const [f, c, k, t] = retry(() => {
          const c = r.int(2, 15), t = r.int(1, 15), k = r.int(2, 4), f = k * (c + t) - t;
          return f >= 26 && f <= 60 ? [f, c, k, t] : null;
        });
        return {
          q: `現在、父は${f}歳、子は${c}歳である。父の年齢が子の年齢のちょうど${k}倍になるのは何年後か。`,
          ...numChoices(r, t, [Math.abs(f - k * c), Math.round((f - c) / k), t + k], { unit: "年後", step: 1 }),
          explain: `□年後に ${f} ＋ □ ＝ ${k} × (${c} ＋ □)。□ ＝ (${f} − ${k * c}) ÷ ${k - 1} ＝ <b>${t}年後</b>`,
          num: t, unit: "年後",
        };
      }
      const [m, c, k, t] = retry(() => {
        const t = r.int(2, 10), c = t + r.int(1, 15), k = r.int(2, 6), m = k * (c - t) + t;
        return m >= 25 && m <= 60 ? [m, c, k, t] : null;
      });
      return {
        q: `現在、母と子の年齢の和は${m + c}歳である。${t}年前、母の年齢は子の年齢のちょうど${k}倍だった。現在の子の年齢は何歳か。`,
        ...numChoices(r, c, [c - t, Math.round((m + c) / (k + 1)), c + t], { unit: "歳", step: 1 }),
        explain: `${t}年前の2人の和は ${m + c} − ${t * 2} ＝ ${m + c - 2 * t}歳。これが子の${k + 1}倍なので、当時の子は ${m + c - 2 * t} ÷ ${k + 1} ＝ ${c - t}歳。現在は <b>${c}歳</b>`,
        num: c, unit: "歳",
      };
    },
  },

  {
    id: "ryoiki", name: "領域", time: [45, 90],
    tip: "y ＞（式）は直線の上側、y ＜（式）は下側。不等式を1本ずつ図に当てはめて重なりを探す。",
    gen(r, hard) {
      const SL = [-2, -1, -0.5, 0.5, 1, 2];
      const k = hard ? 3 : 2;
      const lines = retry(() => {
        const ls = r.sample(SL, k).map((m) => ({ m, b: r.int(-2, 2) }));
        for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
          const x = (ls[j].b - ls[i].b) / (ls[i].m - ls[j].m), y = ls[i].m * x + ls[i].b;
          if (Math.abs(x) > 3 || Math.abs(y) > 3) return null;
        }
        const regs = regionsOf(ls);
        return regs.length >= (hard ? 6 : 4) ? ls : null;
      });
      const regs = regionsOf(lines);
      const target = r.pick(regs);
      const fig = ryoikiSvg(lines, regs);
      const sys = (key) => [...key].map((s, i) => ineq(lines[i], s)).join("　かつ　");
      const why = `${[...target.key].map((s, i) => `${ineq(lines[i], s)} は y＝${lineExpr(lines[i]).replace(/ /g, "")} の${s === "+" ? "上" : "下"}側`).join("、")}。すべてを満たすのは<b>${target.label}</b>`;
      if (hard && r.chance(0.45)) {
        const keys = [...Array(8)].map((_, i) => [...Array(3)].map((__, j) => ((i >> j) & 1 ? "+" : "-")).join(""));
        const { choices, answer } = textChoices(r, sys(target.key), keys.filter((x) => x !== target.key).map(sys), 5);
        return {
          q: `${fig}<p>図の領域${target.label}を表す連立不等式はどれか（境界線上の点は考えない）。</p>`,
          choices, answer,
          explain: `領域${target.label}は ${[...target.key].map((s, i) => `y＝${lineExpr(lines[i]).replace(/ /g, "")} の${s === "+" ? "上" : "下"}側`).join("、")} にある。よって <b>${sys(target.key)}</b>`,
        };
      }
      return {
        q: `${fig}<p>次の不等式をすべて満たす領域はどれか（境界線上の点は考えない）。</p>${ul([...target.key].map((s, i) => ineq(lines[i], s)))}`,
        choices: regs.map((g) => g.label), answer: regs.indexOf(target),
        explain: why,
      };
    },
  },
];
