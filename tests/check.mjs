// すべての分野の問題を両方の難易度で大量に作り、形式の崩れがないかを確かめる
import { makeRng } from "../js/util.js";
import { NONVERBAL } from "../js/nonverbal.js";
import { VERBAL } from "../js/verbal.js";

const N = Number(process.argv[2] ?? 2000);
const strip = (h) => h.replace(/<[^>]+>/g, "");
let bad = 0;

for (const cat of [...NONVERBAL, ...VERBAL]) {
  for (const hard of [false, true]) {
    const t0 = performance.now();
    for (let seed = 1; seed <= N; seed++) {
      const r = makeRng(seed * 7919 + (hard ? 1 : 0));
      let q;
      try {
        q = cat.gen(r, hard);
      } catch (e) {
        console.log(`[${cat.id}/${hard ? "本番" : "お手軽"}] seed ${seed}: ${e.message}`);
        bad++;
        continue;
      }
      const errs = [];
      const all = [q.q, q.explain, ...(q.choices ?? [])].join("\n");
      if (!Array.isArray(q.choices) || q.choices.length < 2) errs.push("選択肢がない");
      else if (q.choices.length > 8) errs.push(`選択肢が多すぎる（A〜Hまで）: ${q.choices.length}`);
      else {
        if (new Set(q.choices.map(strip)).size !== q.choices.length) errs.push(`選択肢が重複: ${q.choices.map(strip).join(" / ")}`);
        if (!(q.answer >= 0 && q.answer < q.choices.length)) errs.push(`正解の番号が不正: ${q.answer}`);
      }
      if (/NaN|undefined|Infinity|\[object|null/.test(all)) errs.push("NaN などが混じっている");
      if (q.num != null && !Number.isFinite(q.num)) errs.push("num が数値でない");
      if (q.num != null && q.choices && strip(q.choices[q.answer]).replace(/,/g, "") !== `${q.num}`.replace(/,/g, "") + (q.unit ?? "") && !strip(q.choices[q.answer]).startsWith(q.num.toLocaleString("ja-JP", { maximumFractionDigits: 3 })))
        errs.push(`num と正解の選択肢が違う: ${q.num} / ${strip(q.choices[q.answer])}`);
      if (errs.length) {
        bad++;
        if (bad < 40) console.log(`[${cat.id}/${hard ? "本番" : "お手軽"}] seed ${seed}: ${errs.join("; ")}\n  ${strip(q.q).slice(0, 120)}`);
      }
    }
    const ms = (performance.now() - t0) / N;
    if (ms > 20) console.log(`[${cat.id}/${hard ? "本番" : "お手軽"}] 1問 ${ms.toFixed(1)}ms（遅い）`);
  }
}

console.log(bad ? `NG: ${bad}件` : `OK: ${NONVERBAL.length + VERBAL.length}分野 × 2難易度 × ${N}問`);
process.exit(bad ? 1 : 0);
