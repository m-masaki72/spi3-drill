// 各分野の問題を数問ずつテキストで表示する（目で確かめる用）。引数で分野 id を絞り込める
import { makeRng } from "../js/util.js";
import { NONVERBAL } from "../js/nonverbal.js";
import { VERBAL } from "../js/verbal.js";

const only = process.argv[2];
const per = Number(process.argv[3] ?? 2);
const text = (h) => h.replace(/<span class="fr"><span>(\d+)<\/span><span>(\d+)<\/span><\/span>/g, "$1/$2").replace(/<br>|<\/p>|<\/li>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n+/g, "\n").trim();

for (const cat of [...NONVERBAL, ...VERBAL]) {
  if (only && cat.id !== only) continue;
  for (const hard of [false, true]) {
    for (let i = 0; i < per; i++) {
      const q = cat.gen(makeRng(Date.now() + i * 101 + (hard ? 7 : 0)), hard);
      console.log(`=== ${cat.name}（${hard ? "本番" : "お手軽"}）`);
      console.log(text(q.q));
      console.log(q.choices.map((c, k) => `${k === q.answer ? "◎" : "・"}${text(c)}`).join("  "));
      console.log("解説: " + text(q.explain));
      console.log();
    }
  }
}
