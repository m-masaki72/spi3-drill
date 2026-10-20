# CLAUDE.md

SPI3 の練習問題を自動生成して解く Web アプリ（PWA）。ビルド工程なしの静的サイト（ES Modules）で、GitHub Pages（`main` 直下）にそのまま公開している。

- 公開URL: https://spi3.morilab-garage.com/
- リポジトリ: https://github.com/m-masaki72/spi3-drill

## 構成

- `index.html` — 画面一式（ホーム `#home`／出題 `#quiz`／結果 `#result`）と、使い方・よくある質問・注意書き
- `js/nonverbal.js`（`NONVERBAL`）・`js/verbal.js`（`VERBAL`）— 分野ごとのジェネレーター
  - 形：`{ id, name, tip, time: [お手軽の目安秒, 本番の制限秒], gen(r, hard) }`
  - `gen` は `{ q, choices, answer, explain, num?, unit? }` を返す。`hard` が本番モード
  - `num` がある問題は、本番で約35%（`TYPE_RATE`）を数値の直接入力にする
  - 選択肢は A〜H の8個まで
- `js/points.js` — 分野 id ごとの公式・ポイント。お手軽の解説・結果の見直し・ホームの一覧に出す
- `js/app.js` — 画面遷移・出題・採点・メモ（canvas）・電卓・記録
  - 記録は localStorage（`spi3Mode` / `spi3Count` / `spi3Stats`）
  - 「やめる」「記録を消す」は `confirmTwice()` で2回押し確認
- `js/util.js` — シード付き乱数 `makeRng`、分数表示など
- `sw.js` — Service Worker。**アセットを変えたら `CACHE` のバージョンを上げる**。ファイルを足したら `ASSETS` にも追加
- `tests/check.mjs` — 全分野 × 2難易度で大量生成し、選択肢の重複・正解番号・NaN・`num` と正解の不一致・選択肢数を検査（`npm test`）
- `tests/sample.mjs` — 分野を指定して問題をテキストで表示（目視確認用）

## ルール

- 問題はすべてオリジナル（自動生成）。実際の試験問題や市販の問題集の問題を写さない
- 名称には「（非公式）」を付け、SPI がリクルートの登録商標である旨の注意書きを残す
- 作者表記は「Mori Lab」（個人名を出さない）
- JSON-LD の FAQPage の内容は、ページ内「よくある質問」の文言と一致させる（片方だけ変えない）
- ジェネレーターを変えたら `npm test` と `node tests/sample.mjs <id>` で確認する
- 主な対象はスマホ縦画面（幅 360〜430px）。変更後はスマホ幅で横スクロールが出ないことを確認する。本番モードは幅 960px 以上で2カラム（右にメモ・電卓）
- 大きく内容を変えたら `sitemap.xml` の `lastmod` も更新
