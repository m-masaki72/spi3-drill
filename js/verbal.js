// 言語の問題。語や文章はすべてこのアプリ用に書いたもの
import { KANA, comboChoices, textChoices, kanaList } from "./util.js";

const pairText = ([a, b]) => `${a}：${b}`;

// ---- 二語の関係 ----
const RELS = {
  包含: { desc: "左は右の一種", dir: true, pairs: [["犬", "動物"], ["杉", "樹木"], ["ピアノ", "楽器"], ["鉄", "金属"], ["俳句", "詩"], ["地震", "災害"], ["野球", "球技"], ["鯛", "魚"], ["水星", "惑星"], ["菊", "花"], ["胡椒", "香辛料"]] },
  原料: { desc: "左は右からつくられる", dir: true, pairs: [["豆腐", "大豆"], ["紙", "パルプ"], ["ワイン", "ぶどう"], ["バター", "牛乳"], ["鰹節", "かつお"], ["毛糸", "羊毛"], ["パン", "小麦"], ["餅", "もち米"], ["ガラス", "珪砂"]] },
  用途: { desc: "左は右をするために使う", dir: true, pairs: [["はさみ", "切る"], ["ほうき", "掃く"], ["鍋", "煮る"], ["金づち", "打つ"], ["ペン", "書く"], ["消しゴム", "消す"], ["洗濯機", "洗う"], ["冷蔵庫", "冷やす"]] },
  仕事: { desc: "左の人は右を仕事とする", dir: true, pairs: [["医師", "診察"], ["教師", "教育"], ["記者", "取材"], ["消防士", "消火"], ["作家", "執筆"], ["調理師", "調理"], ["弁護士", "弁護"], ["裁判官", "裁判"]] },
  一組: { desc: "二つでひと組として使う", dir: false, pairs: [["針", "糸"], ["弓", "矢"], ["碁盤", "碁石"], ["ボルト", "ナット"], ["机", "椅子"], ["急須", "湯のみ"]] },
  対義: { desc: "意味が反対", dir: false, pairs: [["上昇", "下降"], ["拡大", "縮小"], ["増加", "減少"], ["楽観", "悲観"], ["需要", "供給"], ["具体", "抽象"], ["生産", "消費"], ["権利", "義務"], ["理想", "現実"]] },
  同義: { desc: "意味がほぼ同じ", dir: false, pairs: [["永遠", "永久"], ["方法", "手段"], ["欠点", "短所"], ["用意", "準備"], ["案外", "意外"], ["基礎", "土台"], ["不安", "心配"], ["進歩", "向上"]] },
  部分: { desc: "左は右の一部分", dir: true, pairs: [["指", "手"], ["枝", "木"], ["花びら", "花"], ["ページ", "本"], ["車輪", "自転車"], ["秒針", "時計"], ["屋根", "家"], ["鍵盤", "オルガン"]] },
};

// 同じ関係ではない組（別の関係の組と、向きのある関係を逆にした組）
function otherPairs(rel, used) {
  const out = [];
  for (const [name, R] of Object.entries(RELS)) {
    for (const p of R.pairs) {
      if (used.has(p[0]) || used.has(p[1])) continue;
      if (name !== rel) out.push({ p, why: `${R.desc}（${name}）` });
      else if (R.dir) out.push({ p: [p[1], p[0]], why: `向きが逆（右は左の${name === "包含" ? "一種" : name === "部分" ? "一部分" : name === "原料" ? "原料" : name === "用途" ? "道具" : "仕事をする人"}）` });
    }
  }
  return out;
}

// ---- 語句の意味 ----
// lv 1 はお手軽、2 は本番で出す。grp が同じ語は似た意味なので、同じ問題の選択肢に並べない
const WORDS = [
  { w: "吟味", m: "内容や品質をよく調べて確かめること", lv: 1, grp: "調べる" },
  { w: "精査", m: "細かいところまで詳しく調べること", lv: 1, grp: "調べる" },
  { w: "懸念", m: "気にかかって不安に思うこと", lv: 1, grp: "不安" },
  { w: "杞憂", m: "心配する必要のないことをあれこれ心配すること", lv: 1, grp: "不安" },
  { w: "寛容", m: "心が広く、人の過ちなどを厳しくとがめないこと", lv: 1, grp: "寛" },
  { w: "謙虚", m: "控えめで、素直に人から学ぼうとするさま", lv: 1 },
  { w: "迅速", m: "物事の進み方や行動が非常に速いこと", lv: 1 },
  { w: "妥協", m: "対立する者どうしが譲り合って、折り合いをつけること", lv: 1 },
  { w: "把握", m: "物事の内容や状況をしっかり理解すること", lv: 1 },
  { w: "貢献", m: "ある物事のために力を尽くし、役に立つこと", lv: 1 },
  { w: "模索", m: "手がかりのない中で、方法などをあれこれ探し求めること", lv: 1 },
  { w: "顕著", m: "きわだって目立つさま", lv: 1 },
  { w: "委託", m: "仕事などを他の人や機関に頼んで任せること", lv: 1 },
  { w: "斡旋", m: "間に入って、双方がうまくいくように取りはからうこと", lv: 1 },
  { w: "逸材", m: "人並みはずれて優れた才能をもつ人", lv: 1 },
  { w: "是正", m: "悪い点や誤りを正しく直すこと", lv: 1 },
  { w: "着手", m: "仕事などに取りかかること", lv: 1 },
  { w: "推敲", m: "文章を何度も練り直すこと", lv: 1 },
  { w: "漠然", m: "ぼんやりとして、はっきりしないさま", lv: 1 },
  { w: "安直", m: "手軽で、深く考えていないさま", lv: 1 },
  { w: "頑固", m: "自分の考えをかたくなに変えないさま", lv: 1 },
  { w: "嚆矢", m: "物事の始まり", lv: 2, grp: "始まり" },
  { w: "端緒", m: "物事の糸口・手がかり", lv: 2, grp: "始まり" },
  { w: "白眉", m: "多くの中で最も優れているもの", lv: 2, grp: "優れる" },
  { w: "圧巻", m: "全体の中で最も優れた部分", lv: 2, grp: "優れる" },
  { w: "鷹揚", m: "小さなことにこだわらず、ゆったりしているさま", lv: 2, grp: "寛" },
  { w: "逡巡", m: "決断できずに、ためらうこと", lv: 2, grp: "ためらう" },
  { w: "二の足を踏む", m: "思い切れずに、ためらう", lv: 2, grp: "ためらう" },
  { w: "忌憚のない", m: "遠慮のない", lv: 2, grp: "遠慮" },
  { w: "歯に衣着せぬ", m: "思ったことを率直に言う", lv: 2, grp: "遠慮" },
  { w: "憂慮", m: "先行きを心配して、思いわずらうこと", lv: 2, grp: "不安" },
  { w: "杜撰", m: "物事のやり方がいい加減で、誤りが多いこと", lv: 2 },
  { w: "敷衍", m: "意味をおし広げて、わかりやすく説明すること", lv: 2 },
  { w: "踏襲", m: "前の人のやり方をそのまま受け継ぐこと", lv: 2 },
  { w: "齟齬", m: "物事がくい違って、うまくかみ合わないこと", lv: 2 },
  { w: "恣意的", m: "自分の思うままにふるまうさま", lv: 2 },
  { w: "矜持", m: "自分の能力を信じていだく誇り", lv: 2 },
  { w: "示唆", m: "それとなく教えること", lv: 2 },
  { w: "慧眼", m: "物事の本質を鋭く見抜く力", lv: 2 },
  { w: "拘泥", m: "必要以上にこだわること", lv: 2 },
  { w: "枚挙にいとまがない", m: "数えきれないほど多い", lv: 2 },
  { w: "襟を正す", m: "気持ちを引き締め、態度を改める", lv: 2 },
  { w: "舌を巻く", m: "非常に感心する", lv: 2 },
  { w: "腑に落ちない", m: "納得がいかない", lv: 2 },
  { w: "一目置く", m: "相手が自分より優れていると認め、敬意を払う", lv: 2 },
  { w: "青天の霹靂", m: "思いがけない突然の出来事", lv: 2 },
  { w: "気が置けない", m: "遠慮しなくてよい、打ち解けた", lv: 2 },
  { w: "役不足", m: "能力に比べて、与えられた役目が軽すぎること", lv: 2 },
];

// ---- 熟語の成り立ち ----
const JUKUGO = [
  { t: "似た意味の漢字を重ねたもの", ws: ["岩石", "豊富", "温暖", "恐怖", "身体", "道路", "絵画", "減少", "永久", "救助", "森林", "選択", "思考"] },
  { t: "反対の意味の漢字を重ねたもの", ws: ["強弱", "売買", "増減", "貸借", "師弟", "往復", "明暗", "損益", "開閉", "善悪", "授受", "勝敗"] },
  { t: "前の漢字が後の漢字を修飾するもの", ws: ["急増", "深海", "激動", "美談", "晴天", "再会", "最大", "新年", "熱湯", "洋画", "厳禁"] },
  { t: "動詞の後に目的語が来るもの", ws: ["登山", "読書", "消火", "着席", "帰国", "開会", "握手", "就職", "乗車", "作文", "防犯"] },
  { t: "主語と述語の関係にあるもの", ws: ["地震", "日没", "国立", "雷鳴", "人造", "頭痛", "日照", "年長", "市営"] },
];

// ---- 語句の用法（下線部と同じ意味・用法のもの） ----
const YOHO = [
  { name: "「の」（主語を示す）", target: "私<u>の</u>書いた手紙", same: ["母<u>の</u>作る料理はおいしい", "雨<u>の</u>降る日は家にいる"], diff: ["これは兄<u>の</u>本だ", "走る<u>の</u>が好きだ", "どこへ行く<u>の</u>", "医師<u>の</u>田中さんに会う"], note: "「が」に置き換えられる（私が書いた）。所有・名詞化・疑問・同格とは別" },
  { name: "「で」（手段）", target: "鉛筆<u>で</u>書く", same: ["電車<u>で</u>通う", "はさみ<u>で</u>切る"], diff: ["公園<u>で</u>遊ぶ", "風邪<u>で</u>休む", "彼は学生<u>で</u>、妹は会社員だ", "静か<u>で</u>美しい町"], note: "「を使って」に置き換えられる。場所・原因・断定・形容動詞の一部とは別" },
  { name: "「ない」（打消の助動詞）", target: "雨が降ら<u>ない</u>", same: ["彼はまだ来<u>ない</u>", "朝から何も食べ<u>ない</u>"], diff: ["財布にお金が<u>ない</u>", "今日はあまり寒く<u>ない</u>", "参加者が少<u>ない</u>", "別れはせつ<u>ない</u>"], note: "「ぬ」に置き換えられる（降らぬ）。形容詞・補助形容詞・形容詞の一部とは別" },
  { name: "「れる・られる」（尊敬）", target: "先生が新聞を読ま<u>れる</u>", same: ["お客様が帰ら<u>れる</u>", "校長先生が話さ<u>れる</u>"], diff: ["弟に菓子を食べ<u>られる</u>", "故郷のことが思い出さ<u>れる</u>", "この魚は生で食べ<u>られる</u>", "犬にほえ<u>られる</u>"], note: "目上の人の動作を高めている。受身・自発・可能とは別" },
  { name: "「れる・られる」（自発）", target: "昔のことがしのば<u>れる</u>", same: ["将来が案じ<u>られる</u>", "秋の気配が感じ<u>られる</u>"], diff: ["先生が来<u>られる</u>", "先生にほめ<u>られる</u>", "一人で起き<u>られる</u>", "雨に降ら<u>れる</u>"], note: "「自然に〜される」の意味。心の動きを表す動詞につくことが多い" },
  { name: "「ようだ」（推定）", target: "どうやら雨が降った<u>ようだ</u>", same: ["誰か来た<u>ようだ</u>", "彼は疲れている<u>ようだ</u>"], diff: ["まるで夢の<u>ようだ</u>", "彼の<u>ような</u>人になりたい", "間に合う<u>ように</u>走る", "氷の<u>ように</u>冷たい手"], note: "根拠をもとに推し量っている。たとえ（比喩）・例示・目的とは別" },
  { name: "「から」（原因・理由）", target: "寒い<u>から</u>窓を閉める", same: ["疲れた<u>から</u>早く寝る", "危ない<u>から</u>近寄るな"], diff: ["駅<u>から</u>歩く", "米<u>から</u>酒を造る", "九時<u>から</u>始まる", "その話は彼<u>から</u>聞いた"], note: "文と文をつなぎ、理由を表す。起点・原料・出どころとは別" },
  { name: "「ばかり」（直後）", target: "今帰ってきた<u>ばかり</u>だ", same: ["買った<u>ばかり</u>の靴", "起きた<u>ばかり</u>で眠い"], diff: ["遊んで<u>ばかり</u>いる", "一時間<u>ばかり</u>待った", "肉<u>ばかり</u>食べる", "泣き出さん<u>ばかり</u>の顔"], note: "動作が終わってすぐの意味。限定・程度・今にも〜しそうとは別" },
  { name: "「らしい」（推定の助動詞）", target: "明日は雨<u>らしい</u>", same: ["彼は来ない<u>らしい</u>", "どうやら試合は中止<u>らしい</u>"], diff: ["春<u>らしい</u>陽気だ", "男<u>らしい</u>態度", "子ども<u>らしい</u>発想", "すば<u>らしい</u>景色"], note: "「どうやら」を補える。「〜にふさわしい」の接尾語や形容詞の一部とは別" },
  { name: "「に」（目的）", target: "図書館へ本を借り<u>に</u>行く", same: ["海へ泳ぎ<u>に</u>行く", "駅まで友人を迎え<u>に</u>出る"], diff: ["部屋<u>に</u>いる", "七時<u>に</u>起きる", "将来は医師<u>に</u>なる", "友人<u>に</u>会う"], note: "「〜するために」の意味。場所・時・結果・相手とは別" },
  { name: "「ながら」（逆接）", target: "知ってい<u>ながら</u>黙っていた", same: ["狭い<u>ながら</u>も快適な部屋", "悪いと思い<u>ながら</u>嘘をついた"], diff: ["歌い<u>ながら</u>歩く", "音楽を聴き<u>ながら</u>勉強する", "テレビを見<u>ながら</u>食べる", "昔<u>ながら</u>の町並み"], note: "「〜にもかかわらず」の意味。同時進行・「そのまま」とは別" },
  { name: "「そうだ」（伝聞）", target: "明日は晴れる<u>そうだ</u>", same: ["彼は試験に合格した<u>そうだ</u>", "あの店は来月閉店する<u>そうだ</u>"], diff: ["今にも雨が降り<u>そうだ</u>", "このケーキはおいし<u>そうだ</u>", "棚が倒れ<u>そうだ</u>", "祖父は元気<u>そうだ</u>"], note: "人から聞いた話。終止形につく。様子（様態）を表す「そうだ」とは別" },
  { name: "「かける」（つるす）", target: "壁に絵を<u>かける</u>", same: ["コートをハンガーに<u>かける</u>", "軒先に風鈴を<u>かける</u>"], diff: ["友人に電話を<u>かける</u>", "時間を<u>かける</u>", "迷惑を<u>かける</u>", "椅子に腰を<u>かける</u>"], note: "物を高いところにつり下げる意味" },
  { name: "「とる」（得る）", target: "資格を<u>とる</u>", same: ["運転免許を<u>とる</u>", "テストで満点を<u>とる</u>"], diff: ["会議のメモを<u>とる</u>", "棚の本を<u>とる</u>", "失敗の責任を<u>とる</u>", "年を<u>とる</u>"], note: "努力して自分のものにする意味" },
  { name: "「あまい」（味）", target: "この桃は<u>あまい</u>", same: ["熟した柿は<u>あまい</u>", "このジュースは<u>あまい</u>"], diff: ["祖母は孫に<u>あまい</u>", "見通しが<u>あまい</u>", "ねじの締め方が<u>あまい</u>", "<u>あまい</u>言葉にだまされる"], note: "砂糖のような味がする意味" },
];

// ---- 文の並べ替え（正しい順に並べてある） ----
const NARABE = [
  ["近年、多くの企業が在宅勤務を取り入れている。", "通勤の負担がなくなり、時間を有効に使えるからだ。", "一方で、同僚と顔を合わせる機会は減った。", "そのため、ちょっとした相談がしにくくなったという声もある。", "そこで、週に一度は出社日を設ける企業が増えている。"],
  ["植物は光を使って養分をつくる。", "この働きを光合成という。", "光合成には、光のほかに水と二酸化炭素が必要だ。", "水は根から、二酸化炭素は葉の気孔から取り入れられる。", "こうしてつくられた養分は、植物の成長に使われる。"],
  ["図書館で本を探すとき、まず検索端末を使う人が多い。", "書名や著者名を入力すると、本の置き場所がわかるからだ。", "しかし、目的の本の隣に並ぶ本を眺めるのも意外と役に立つ。", "同じ分類の本がまとめて置かれているためである。", "思いがけない一冊に出会えるのは、こうした棚ならではの楽しみだ。"],
  ["カレーを作るときは、まず玉ねぎを薄切りにする。", "次に、それを鍋で茶色くなるまで炒める。", "甘みとコクが出たら、肉と残りの野菜を加える。", "全体に油が回ったところで水を入れ、具が柔らかくなるまで煮込む。", "最後にルウを溶かし入れれば完成だ。"],
  ["睡眠不足が続くと、集中力が落ちることが知られている。", "それだけでなく、食欲を調整するホルモンの働きも乱れる。", "その結果、つい食べ過ぎてしまうこともある。", "つまり、睡眠は体重の管理にも関わっているのだ。", "健康のためには、食事や運動と同じように睡眠にも気を配りたい。"],
  ["昔の旅人は、紙の地図と方位磁針を頼りに道を探した。", "やがて、カーナビやスマートフォンが普及した。", "これらは現在地を自動で示してくれる。", "おかげで、初めての土地でも迷うことは少なくなった。", "ただし、画面ばかり見ていると周りの景色を覚えにくいという指摘もある。"],
  ["言葉の意味は時代とともに変わることがある。", "たとえば「やばい」は、もともと危険な状況を表す言葉だった。", "ところが最近では、「すばらしい」という意味でも使われる。", "このような変化を誤用だと嫌う人もいる。", "しかし、言葉が生きている証拠だと考えることもできる。"],
  ["ペットボトルは回収されたあと、工場へ運ばれる。", "そこで、ラベルやキャップが取り除かれる。", "残った本体は細かく砕かれ、洗浄される。", "こうしてできた小片は、再び繊維や容器の原料になる。", "分別に協力することが、資源の有効活用につながるのだ。"],
  ["会議を短くするには、事前の準備が欠かせない。", "まず、話し合う議題をあらかじめ参加者に伝えておく。", "そうすれば、各自が意見をまとめてから参加できる。", "また、会議の終わりの時刻を最初に決めておくことも大切だ。", "時間に区切りがあると、議論が脱線しにくくなるからである。"],
  ["ミツバチは、花の場所を仲間に伝えることができる。", "その手段は、巣の中で行う「ダンス」である。", "ダンスの向きは、太陽に対する花の方角を表している。", "また、体を振る時間の長さは、花までの距離を示す。", "仲間はこれを読み取り、迷わず花へ飛んでいく。"],
];

// ---- 空欄補充 ----
const KUURAN = [
  { s: "雨が強く降ってきた。（　）、試合は予定どおり行われた。", a: "しかし", w: ["だから", "つまり", "たとえば", "さらに"] },
  { s: "この店の料理は安い。（　）、量も多い。", a: "しかも", w: ["しかし", "つまり", "なぜなら", "ところで"] },
  { s: "電車が遅れた。（　）、会議に間に合わなかった。", a: "そのため", w: ["ところが", "あるいは", "たとえば", "ただし"] },
  { s: "お茶にしますか。（　）、コーヒーにしますか。", a: "それとも", w: ["だから", "しかも", "つまり", "すると"] },
  { s: "参加費は無料だ。（　）、事前の申し込みが必要である。", a: "ただし", w: ["だから", "つまり", "たとえば", "それとも"] },
  { s: "彼は三か国語を話せる。（　）、英語・中国語・スペイン語だ。", a: "具体的には", w: ["その結果", "ところが", "それとも", "ただし"] },
  { s: "長年の研究が、ようやく（　）を結んだ。", a: "実", w: ["花", "糸", "手", "縁"] },
  { s: "この証拠がある以上、彼の主張には（　）の余地がない。", a: "疑い", w: ["自信", "満足", "期待", "興味"] },
  { s: "新しい計画は、予算の都合で（　）に乗り上げた。", a: "暗礁", w: ["岩場", "浅瀬", "障害", "難関"] },
  { s: "彼女の説明は（　）を得ていて、とてもわかりやすい。", a: "要領", w: ["手段", "理解", "機会", "信頼"] },
  { s: "彼は上司の前では（　）をかぶっている。", a: "猫", w: ["犬", "牛", "熊", "鳥"] },
  { s: "二人の実力は（　）で、どちらが勝つかわからない。", a: "互角", w: ["一律", "均一", "平行", "同様"] },
  { s: "突然の質問に、彼は（　）を濁した。", a: "言葉", w: ["意見", "声", "顔", "態度"] },
  { s: "彼の発言が、停滞していた議論に（　）を投じた。", a: "一石", w: ["一矢", "一線", "一手", "一灯"] },
  { s: "工期の遅れを（　）ため、作業員を増やした。", a: "取り戻す", w: ["取り消す", "取り上げる", "取り込む", "取り締まる"] },
  { s: "新製品の評判は上々で、注文が（　）に入っている。", a: "ひっきりなし", w: ["おおざっぱ", "なおざり", "ありきたり", "うわのそら"] },
  { s: "彼は細かい点まで（　）に調べる性格だ。", a: "念入り", w: ["大まか", "手軽", "安易", "気軽"] },
  { s: "彼女の演奏は聴衆を（　）した。", a: "魅了", w: ["魅力", "感動", "感心", "共感"] },
  { s: "準備不足が（　）して、試合に負けた。", a: "災い", w: ["幸い", "結果", "理由", "不運"] },
  { s: "今年の売上は、前年を大きく（　）。", a: "上回った", w: ["上向いた", "上昇した", "増えた", "高まった"] },
];

// ---- 長文読解 ----
const CHOUBUN = [
  {
    text: "人は一度に複数の作業をこなしているつもりでも、実際には注意を素早く切り替えているにすぎない。切り替えのたびに、前の作業の内容を思い出す時間が生じる。一つひとつはわずかでも、積み重なれば無視できない量になる。メールの通知が来るたびに作業を中断していると、本来の作業に戻るまでにかなりの時間がかかるという調査もある。そのため、通知を切って一つの作業に集中する時間帯を決めることが、結果として仕事を早く終わらせる近道になる。もっとも、すべての連絡を後回しにすればよいわけではない。急ぎの連絡を受け取る手段だけは残しておくなど、仕事の性質に合わせた工夫が求められる。",
    t: ["作業を切り替えるたびに、前の作業を思い出す時間がかかる", "集中する時間帯を決めることは、仕事を早く終わらせることにつながる", "急ぎの連絡を受け取る手段は残しておくのがよい"],
    f: ["人は複数の作業を同時に処理することに優れている", "通知はすべて切り、連絡は一日の終わりにまとめて確認すべきだ", "切り替えにかかる時間はわずかなので、気にしなくてよい", "メールの通知は作業の効率に影響しない"],
  },
  {
    text: "外来種とは、人の活動によって本来の生息地の外へ持ち込まれた生物のことである。持ち込まれた生物の多くは新しい環境になじめずに消えていくが、一部は天敵のいない環境で急速に数を増やす。そうした種は、在来の生物の食べ物や住みかを奪い、地域の生態系を大きく変えてしまうことがある。いったん定着した外来種を取り除くには、多くの費用と年月がかかる。そのため、最も効果的な対策は、そもそも持ち込まないことだとされている。飼っている生き物を野外に放さないといった一人ひとりの行動も、その対策の一つである。",
    t: ["持ち込まれた外来種の多くは、定着せずに消えていく", "外来種の対策では、持ち込まないことが最も効果的だとされる", "飼っている生き物を野外に放さないことも、外来種の対策になる"],
    f: ["外来種はすべて在来の生物に害を与える", "定着した外来種は、短い期間で安く取り除ける", "外来種は天敵が多い環境ほど増えやすい", "外来種とは、自然に分布を広げた生物のことである"],
  },
  {
    text: "新しく覚えたことは、時間とともに急速に忘れられていく。ただし、忘れかけたころに思い出す作業をすると、記憶は以前より長く保たれるようになる。これを利用したのが、間隔をあけて繰り返す学習法である。一度に長時間かけて覚えるよりも、短い時間で何度かに分けて復習したほうが、同じ合計時間でも定着しやすいことがわかっている。また、ただ読み返すよりも、問題を解くなどして自分で思い出そうとするほうが効果は高い。思い出すのに苦労すること自体が、記憶を強める働きをするからだ。",
    t: ["間隔をあけて復習すると、記憶が長く保たれやすい", "読み返すより、自分で思い出そうとするほうが記憶に効果的だ", "思い出すのに苦労することには、記憶を強める働きがある"],
    f: ["一度に長時間かけて覚えるのが最も効率がよい", "覚えたことは、時間がたってもほとんど忘れない", "思い出すのに苦労する内容は、覚える必要がない", "復習は合計時間が長いほど、必ず効果が上がる"],
  },
  {
    text: "地図アプリの普及で、知らない土地でも目的地に迷わずたどり着けるようになった。一方で、案内に従って歩くだけでは、道順や周りの様子が記憶に残りにくいという研究もある。自分で地図を読み、方角や目印を確かめながら歩く場合に比べて、頭の中に地図を描く機会が減るためだと考えられている。とはいえ、アプリを使うこと自体が悪いわけではない。出発前に全体の経路を眺めておく、ときどき画面から目を離して目印を確かめるといった使い方をすれば、便利さを保ちながら土地勘を養うこともできる。",
    t: ["案内に従って歩くだけでは、道順が記憶に残りにくい", "使い方を工夫すれば、アプリを使いながら土地勘を養える", "出発前に経路の全体を見ておくのは、有効な使い方の一つだ"],
    f: ["地図アプリは使わないほうがよい", "地図アプリを使うと、目的地に着くまでの時間が長くなる", "自分で地図を読んでも、頭の中に地図は描かれない", "土地勘を養うには、アプリの画面を見続けるのがよい"],
  },
];

// ---- 英語 ----
const SYN = [["big", "large"], ["begin", "start"], ["quick", "fast"], ["buy", "purchase"], ["end", "finish"], ["help", "assist"], ["choose", "select"], ["enough", "sufficient"], ["often", "frequently"], ["answer", "reply"], ["hard", "difficult"], ["try", "attempt"], ["need", "require"], ["get", "obtain"], ["maybe", "perhaps"]];
const ANT = [["increase", "decrease"], ["accept", "reject"], ["ancient", "modern"], ["success", "failure"], ["include", "exclude"], ["expensive", "cheap"], ["import", "export"], ["wide", "narrow"], ["arrive", "depart"], ["maximum", "minimum"], ["public", "private"], ["temporary", "permanent"], ["strong", "weak"]];
// 本番用のやや難しい語（意味つき）
const SYN2 = [["reluctant", "unwilling", "気が進まない"], ["abundant", "plentiful", "豊富な"], ["diminish", "decrease", "減少する"], ["ambiguous", "unclear", "あいまいな"], ["obsolete", "outdated", "時代遅れの"], ["mandatory", "compulsory", "義務的な"], ["vital", "essential", "不可欠な"], ["trivial", "insignificant", "取るに足りない"], ["conceal", "hide", "隠す"], ["accurate", "precise", "正確な"], ["tedious", "boring", "退屈な"]];
const ANT2 = [["voluntary", "compulsory", "自発的な ⇔ 強制の"], ["generous", "stingy", "気前のよい ⇔ けちな"], ["optimistic", "pessimistic", "楽観的な ⇔ 悲観的な"], ["ascend", "descend", "登る ⇔ 下る"], ["victory", "defeat", "勝利 ⇔ 敗北"], ["scarce", "abundant", "乏しい ⇔ 豊富な"], ["permanent", "temporary", "永続的な ⇔ 一時的な"], ["expand", "contract", "広げる ⇔ 縮める"], ["guilty", "innocent", "有罪の ⇔ 無罪の"]];
// 空欄補充：[文, 正解, 誤答, 解説]
const EFILL = [
  ["The meeting was ( ) until next week because of the typhoon.", "postponed", ["promoted", "produced", "predicted", "preserved"], "postpone＝延期する"],
  ["Please ( ) your seatbelt before the car starts moving.", "fasten", ["flatten", "frighten", "freshen", "fatten"], "fasten a seatbelt＝シートベルトを締める"],
  ["The company plans to ( ) a new branch in Osaka next year.", "establish", ["estimate", "exchange", "examine", "expose"], "establish＝設立する"],
  ["You must ( ) the report to the manager by Friday.", "submit", ["submerge", "subtract", "subscribe", "substitute"], "submit＝提出する"],
  ["He was ( ) of stealing the money, but he was actually innocent.", "accused", ["excused", "refused", "abused", "amused"], "be accused of ～＝～の疑いをかけられる"],
  ["I am afraid I cannot ( ) to buy such an expensive car.", "afford", ["offer", "effort", "offend", "affect"], "can afford to ～＝～する余裕がある"],
  ["The lecture was so ( ) that many students fell asleep.", "boring", ["bored", "bore", "boredom", "bores"], "「人を退屈させる」性質なので boring"],
  ["She has lived in Kyoto ( ) 2015.", "since", ["for", "during", "from", "while"], "現在完了で起点（2015年）を表すので since"],
  ["The man ( ) I met at the party yesterday is a famous actor.", "whom", ["whose", "which", "what", "where"], "先行詞が人で、met の目的語になるので whom"],
  ["The result was ( ) to what we had expected.", "contrary", ["contract", "contrast", "convert", "concern"], "contrary to ～＝～に反して"],
  ["Heavy rain ( ) the train services in the area.", "disrupted", ["disputed", "discovered", "disappeared", "discussed"], "disrupt＝混乱させる・中断させる"],
];
// 英文読解：本文・合う選択肢・合わない選択肢・根拠
const EREAD = [
  {
    p: "Remote work has become common in many companies. Employees can save time because they do not have to commute, and many say they can concentrate better at home. However, some workers feel lonely and find it hard to communicate with their colleagues. As a result, a number of companies now ask employees to come to the office two or three days a week.",
    ok: "Some employees feel lonely when they work at home.",
    ng: ["Most companies have stopped remote work completely.", "Commuting takes more time under remote work.", "Employees cannot concentrate at home.", "Companies want employees to work at the office every day."],
    e: "3文目 some workers feel lonely（在宅だと孤独を感じる人がいる）が根拠。",
  },
  {
    p: "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that were still safe to eat after thousands of years. Honey is very sweet and contains little water, so bacteria cannot easily grow in it.",
    ok: "Bacteria have difficulty growing in honey because it has little water.",
    ng: ["Honey found in the tombs was too dangerous to eat.", "Honey usually spoils within a few years.", "Ancient Egyptians stopped using honey because it spoiled.", "Honey contains a large amount of water."],
    e: "最後の文 contains little water, so bacteria cannot easily grow（水分が少ないので細菌が育ちにくい）が根拠。",
  },
  {
    p: "A new bakery opened near the station last month. It sells bread made only from local wheat, and the owner bakes everything by hand each morning. Because the number of loaves is limited, the shop often sells out before noon. Customers who want to buy bread are advised to visit early.",
    ok: "The bakery often runs out of bread before noon.",
    ng: ["The bakery uses imported wheat.", "The bakery opened a year ago.", "Machines make all the bread.", "Customers should visit in the afternoon."],
    e: "3文目 the shop often sells out before noon（昼前に売り切れることが多い）が根拠。",
  },
];

// ---- 構造的把握 ----
const KOUZOU = [
  { t: "全体と割合から部分を求める（全体 × 割合）", ps: ["ある学校の生徒480人のうち、35%が運動部に入っている。運動部員は何人か。", "3000円の買い物をすると、代金の5%がポイントとして戻る。戻るポイントはいくらか。", "容量500mLのボトルの6割まで水が入っている。水は何mLか。", "全長12kmのコースのうち、4分の1が上り坂である。上り坂は何kmか。"] },
  { t: "部分と割合から全体を求める（部分 ÷ 割合）", ps: ["あるクラスで眼鏡をかけている生徒は12人で、クラス全体の3割にあたる。クラスは何人か。", "貯金の4分の1にあたる5000円を使った。貯金はいくらあったか。", "本を120ページ読んだところ、全体の40%だった。本は全部で何ページか。", "タンクに30Lの水を入れたら、容量の6割になった。タンクの容量は何Lか。"] },
  { t: "2つの量の和と差から、それぞれを求める（和差算）", ps: ["兄と弟の所持金は合わせて5000円で、兄は弟より1200円多い。弟の所持金はいくらか。", "長さ90cmのひもを、一方が他方より14cm長くなるように2本に切る。短いほうは何cmか。", "AとBの2つの箱に合わせて70個のりんごがあり、Aのほうが16個多い。Bには何個あるか。", "ある試験の国語と数学の合計は152点で、数学は国語より12点高い。国語は何点か。"] },
  { t: "配り方の違いによる過不足から人数などを求める（過不足算）", ps: ["子どもにあめを配る。1人5個ずつだと8個余り、7個ずつだと4個足りない。子どもは何人か。", "生徒に画用紙を配る。1人3枚ずつだと10枚余り、4枚ずつだと5枚足りない。生徒は何人か。", "封筒に切手をはる。1通に2枚ずつだと12枚余り、3枚ずつだと4枚足りない。封筒は何通か。", "花束を作る。1束に6本ずつだと5本余り、8本ずつだと9本足りない。花束はいくつか。"] },
];
// 会話の分類：Xの発言に対するYの応じ方で2種類に分ける。t は [Xの発言, a型の応じ方, b型の応じ方]
const KAIWA = [
  {
    a: "賛成し、理由を添えている", b: "反対し、別の案を出している",
    t: [["今度の旅行は温泉にしない？", "いいね。ゆっくり疲れが取れそうだし", "温泉より、山登りのほうがいいと思う"],
      ["今日の夕食はカレーがいいな", "賛成。昨日から食べたいと思っていたんだ", "カレーは昨日食べたから、パスタにしようよ"],
      ["週末は家で映画を観よう", "いいね、最近は外が暑いし", "家にいるのはもったいないよ。公園に行こう"],
      ["新しい企画は価格を下げて勝負すべきだ", "賛成です。競合より安ければ注目されるはずです", "価格より品質で差をつけるほうが良いと思います"],
      ["会議は朝一番にやろう", "そうしよう。みんなの頭が冴えているしね", "朝は忙しいから、午後にしたほうがいいよ"],
      ["通勤は電車より自転車にしようかな", "いいと思う。健康にもなるしね", "雨の日が困るから、電車のままがいいよ"]],
  },
  {
    a: "質問に直接答えている", b: "質問に質問で返している",
    t: [["昼ごはんは何にする？", "ラーメンにするよ", "何か食べたいものある？"],
      ["明日の会議は何時から？", "10時からだよ", "何時なら都合がいい？"],
      ["この資料、誰が作ったの？", "田中さんが作ったよ", "どうして気になるの？"],
      ["次の休みはどこか行く？", "京都に行く予定だよ", "そっちはどこか行くの？"],
      ["このレポート、いつまでに出せばいい？", "金曜日の夕方までです", "いつまでなら出せそうですか？"],
      ["駅まで歩くとどのくらいかかる？", "15分くらいかな", "急いでいるの？"]],
  },
  {
    a: "頼みを引き受けている", b: "頼みを断り、理由を述べている",
    t: [["この荷物を運ぶのを手伝って", "いいよ、一緒に運ぼう", "ごめん、腰が痛くて無理なんだ"],
      ["今度の飲み会の幹事をお願いできる？", "わかった、引き受けるよ", "その日は出張で行けないんだ"],
      ["資料のチェックを頼めるかな", "もちろん、今日中に見ておくよ", "今週は締め切りが重なっていて難しい"],
      ["来週の引っ越しを手伝ってほしい", "いいよ、空けておくね", "その日は先約があって行けないんだ"],
      ["ちょっと相談に乗ってくれない？", "いいよ、何でも話して", "今は余裕がないから、あとにしてくれる？"],
      ["このイベントの受付を担当してくれる？", "任せて、やっておくよ", "人前に出るのが苦手なので遠慮したい"]],
  },
];
const talk = (x, y) => `X「${x}」<br>Y「${y}」`;

// 5つから2つを選ぶ組み合わせの選択肢（正解＋誤り5つの6択）
function pairChoices(r, ok) {
  const pairs = [];
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) pairs.push([i, j]);
  const key = (p) => p.join();
  const wrong = r.sample(pairs.filter((p) => key(p) !== key(ok)), 5);
  const list = [ok, ...wrong].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { choices: list.map(([i, j]) => `${KANA[i]}と${KANA[j]}`), answer: list.findIndex((p) => key(p) === key(ok)) };
}

const box = (t) => `<div class="passage">${t}</div>`;

export const VERBAL = [
  {
    id: "nigo", name: "二語の関係", time: [20, 40],
    tip: "最初の二語の関係を「AはBの一種」のように文にしてから、選択肢に当てはめる。向き（左右）が逆のものに注意。",
    gen(r, hard) {
      const rel = r.pick(Object.keys(RELS));
      const R = RELS[rel];
      const [base, ...sames] = r.sample(R.pairs, 4);
      const used = new Set([...base, ...sames.flat()]);
      const others = r.shuffle(otherPairs(rel, used));
      const head = `<p>はじめに示した二語と同じ関係のものを選びなさい。</p><p class="big">${pairText(base)}</p>`;
      const explainHead = `${pairText(base)} は「${R.desc}」（${rel}）の関係。`;
      if (!hard) {
        const items = r.shuffle([{ p: sames[0], ok: true }, ...others.slice(0, 4)]);
        return {
          q: head,
          choices: items.map((x) => pairText(x.p)),
          answer: items.findIndex((x) => x.ok),
          explain: `${explainHead}<br>${items.map((x) => `${pairText(x.p)}：${x.ok ? `<b>${R.desc}</b>` : x.why}`).join("<br>")}`,
        };
      }
      const truth = [0, 1, 2].map(() => r.chance(0.45));
      if (!truth.some(Boolean)) truth[r.int(0, 2)] = true;
      let si = 0, oi = 0;
      const items = truth.map((t) => (t ? { p: sames[si++], ok: true } : others[oi++]));
      const { choices, answer } = comboChoices(truth);
      return {
        q: `${head}${kanaList(items.map((x) => pairText(x.p)))}`,
        choices, answer,
        explain: `${explainHead}<br>${items.map((x, i) => `${KANA[i]} ${pairText(x.p)}：${x.ok ? `<b>${R.desc}</b>` : x.why}`).join("<br>")}`,
      };
    },
  },

  {
    id: "imi", name: "語句の意味", time: [15, 30],
    tip: "知らない語でも、漢字一字ずつの意味から推測できることが多い。似た意味の選択肢は違いを比べる。",
    gen(r, hard) {
      const pool = WORDS.filter((x) => (hard ? x.lv === 2 : x.lv === 1));
      const ans = r.pick(pool);
      const others = r.sample(WORDS.filter((x) => x !== ans && (!ans.grp || x.grp !== ans.grp) && (hard || x.lv === 1)), 4);
      const items = r.shuffle([ans, ...others]);
      const explain = items.map((x) => `${x === ans ? "<b>" : ""}${x.w}：${x.m}${x === ans ? "</b>" : ""}`).join("<br>");
      if (hard && r.chance(0.5)) {
        return {
          q: `<p>次の語句の意味として最も適切なものを選びなさい。</p><p class="big">${ans.w}</p>`,
          choices: items.map((x) => x.m), answer: items.indexOf(ans), explain,
        };
      }
      return {
        q: `<p>次の意味に最もよく合う語句を選びなさい。</p><p class="big">${ans.m}</p>`,
        choices: items.map((x) => x.w), answer: items.indexOf(ans), explain,
      };
    },
  },

  {
    id: "jukugo", name: "熟語の成り立ち", time: [15, 30],
    tip: "訓読みにして読み下すと見分けやすい（登山 → 山に登る、地震 → 地が震える）。",
    gen(r, hard) {
      const ti = r.int(0, JUKUGO.length - 1);
      if (!hard) {
        const w = r.pick(JUKUGO[ti].ws);
        return {
          q: `<p>次の熟語の成り立ちとして最も適切なものを選びなさい。</p><p class="big">${w}</p>`,
          choices: JUKUGO.map((x) => x.t), answer: ti,
          explain: `${w} は「<b>${JUKUGO[ti].t}</b>」。`,
        };
      }
      const truth = [0, 1, 2].map(() => r.chance(0.45));
      const pickWrong = () => { const j = r.pick(JUKUGO.map((_, i) => i).filter((i) => i !== ti)); return { w: r.pick(JUKUGO[j].ws), j }; };
      const rights = r.sample(JUKUGO[ti].ws, 3);
      const used = new Set();
      const items = truth.map((t, i) => {
        if (t) return { w: rights[i], j: ti };
        let x;
        do x = pickWrong(); while (used.has(x.w));
        used.add(x.w);
        return x;
      });
      const { choices, answer } = comboChoices(truth, "いずれも当てはまらない");
      return {
        q: `<p>「${JUKUGO[ti].t}」に当てはまる熟語はどれか。</p>${kanaList(items.map((x) => x.w))}`,
        choices, answer,
        explain: items.map((x, i) => `${KANA[i]} ${x.w}：${x.j === ti ? `<b>${JUKUGO[x.j].t}</b>` : JUKUGO[x.j].t}`).join("<br>"),
      };
    },
  },

  {
    id: "yoho", name: "語句の用法", time: [20, 40],
    tip: "下線部を別の言葉に言い換えてみる（「の」→「が」、「で」→「を使って」）。言い換えが同じなら同じ用法。",
    gen(r, hard) {
      const S = r.pick(YOHO);
      const head = `<p>下線部の語が、次の文と同じ意味・用法で使われているものを選びなさい。</p><p class="big">${S.target}</p>`;
      if (!hard) {
        const items = r.shuffle([{ s: r.pick(S.same), ok: true }, ...r.sample(S.diff, 4).map((s) => ({ s }))]);
        return {
          q: head, choices: items.map((x) => x.s), answer: items.findIndex((x) => x.ok),
          explain: `${S.name}：${S.note}。<br>同じ用法は「${items.find((x) => x.ok).s}」`,
        };
      }
      const truth = [0, 1, 2].map(() => r.chance(0.4));
      const sames = r.shuffle(S.same), diffs = r.shuffle(S.diff);
      let a = 0, b = 0;
      const items = truth.map((t) => (t && a < sames.length ? { s: sames[a++], ok: true } : { s: diffs[b++], ok: false }));
      const { choices, answer } = comboChoices(items.map((x) => x.ok), "いずれも同じ用法ではない");
      return {
        q: `${head}${kanaList(items.map((x) => x.s))}`,
        choices, answer,
        explain: `${S.name}：${S.note}。<br>${items.map((x, i) => `${KANA[i]}：${x.ok ? "<b>同じ用法</b>" : "別の用法"}`).join("<br>")}`,
      };
    },
  },

  {
    id: "narabe", name: "文の並べ替え", time: [40, 75],
    tip: "最初の文は指示語や接続詞で始まらないものを探す。「その」「そこで」が何を受けているかでつながりを決める。",
    gen(r, hard) {
      const P = r.pick(NARABE);
      const order = r.shuffle([0, 1, 2, 3, 4]);
      const label = (k) => KANA[order.indexOf(k)];
      const k = hard ? r.int(2, 4) : r.int(1, 2);
      return {
        q: `<p>ア〜オの文を意味が通るように並べ替えたとき、${k}番目にくるものはどれか。</p>${kanaList(order.map((i) => P[i]))}`,
        choices: KANA.slice(0, 5), answer: order.indexOf(k - 1),
        explain: `正しい順は ${[0, 1, 2, 3, 4].map(label).join(" → ")}。<br>${P.map((s, i) => `${i + 1}. ${s}`).join("<br>")}`,
      };
    },
  },

  {
    id: "kuuran", name: "空欄補充", time: [15, 30],
    tip: "前後の文の関係（逆接・添加・理由・言い換え）をまず決める。慣用句は決まった組み合わせで覚える。",
    gen(r) {
      const K = r.pick(KUURAN);
      const { choices, answer } = textChoices(r, K.a, K.w, 5);
      return {
        q: `<p>文中の空欄に入る最も適切な語句を選びなさい。</p><p class="big">${K.s}</p>`,
        choices, answer,
        explain: K.s.replace("（　）", `<b>${K.a}</b>`),
      };
    },
  },

  {
    id: "choubun", name: "長文読解", time: [60, 120],
    tip: "選択肢を先に読み、本文で該当箇所を探す。「すべて」「必ず」など言い切る選択肢は本文と食い違いやすい。",
    gen(r, hard) {
      const L = r.pick(CHOUBUN);
      if (!hard) {
        const { choices, answer } = textChoices(r, r.pick(L.t), L.f, 4);
        return {
          q: `${box(L.text)}<p>本文の内容と合致するものはどれか。</p>`,
          choices, answer,
          explain: `本文に書かれているのは「<b>${choices[answer]}</b>」。ほかは本文と食い違うか、本文に書かれていない。`,
        };
      }
      const truth = [0, 1, 2].map(() => r.chance(0.45));
      const ts = r.shuffle(L.t), fs = r.shuffle(L.f);
      let a = 0, b = 0;
      const items = truth.map((t) => (t ? ts[a++] : fs[b++]));
      const { choices, answer } = comboChoices(truth, "いずれも合致しない");
      return {
        q: `${box(L.text)}<p>次のア、イ、ウのうち、本文の内容と合致するものはどれか。</p>${kanaList(items)}`,
        choices, answer,
        explain: items.map((s, i) => `${KANA[i]}：${truth[i] ? "<b>合致する</b>" : "合致しない"}`).join("<br>"),
      };
    },
  },

  {
    id: "eigo", name: "英語", time: [20, 45],
    tip: "同意語・反意語は対で覚える。空欄補充は品詞と文法で先に絞る。読解は選択肢を先に読み、本文に根拠のあるものだけを選ぶ。",
    gen(r, hard) {
      const kind = hard ? r.pick(["word", "word", "fill", "fill", "read"]) : r.pick(["word", "word", "word", "fill"]);
      if (kind === "fill") {
        const [s, a, w, e] = r.pick(EFILL);
        const { choices, answer } = textChoices(r, a, w, 5);
        return {
          q: `<p>空欄に入る最も適切な語を選びなさい。</p><p class="big en">${s.replace("( )", "（　　）")}</p>`,
          choices, answer,
          explain: `${s.replace("( )", `<b>${a}</b>`)}<br>${e}`,
        };
      }
      if (kind === "read") {
        const L = r.pick(EREAD);
        const { choices, answer } = textChoices(r, L.ok, L.ng, 5);
        return {
          q: `<div class="passage en">${L.p}</div><p>本文の内容と合うものを選びなさい。</p>`,
          choices, answer,
          explain: `正解は「<b>${L.ok}</b>」。${L.e}`,
        };
      }
      const ant = hard ? r.chance(0.55) : r.chance(0.3);
      const base = ant ? ANT : SYN;
      const list = hard ? [...base, ...(ant ? ANT2 : SYN2)] : base;
      const [w, a, note] = r.pick(list);
      const all = [...SYN, ...ANT, ...(hard ? [...SYN2, ...ANT2] : [])];
      // 出題語と対になる語（同意・反意のどちらでも）は誤答に入れない
      const linked = new Set(all.filter(([p, q]) => p === w || q === w || p === a || q === a).flatMap(([p, q]) => [p, q]));
      const pool = [...new Set(all.flatMap(([p, q]) => [p, q]))].filter((x) => !linked.has(x));
      const { choices, answer } = textChoices(r, a, r.sample(pool, 4), 5);
      return {
        q: `<p>次の語と${ant ? "反対の意味" : "最も近い意味"}の語を選びなさい。</p><p class="big en">${w}</p>`,
        choices, answer,
        explain: `${w} ${ant ? "⇔" : "≒"} <b>${a}</b>（${ant ? "反意語" : "同意語"}）${note ? `<br>${note}` : ""}`,
      };
    },
  },

  {
    id: "kouzou", name: "構造的把握", time: [40, 75],
    tip: "数値や話題は無視して「何から何を求めるか」「どう応じているか」の型だけを見る。会話は応じ方を一言に要約して比べる。",
    gen(r, hard) {
      if (r.chance(hard ? 0.5 : 0.35)) {
        // 会話の分類
        const G = r.pick(KAIWA);
        if (!hard) {
          const [base, ...rest] = r.sample(G.t, 5);
          const items = r.shuffle([{ t: rest[0], a: true }, ...rest.slice(1).map((t) => ({ t, a: false }))]);
          return {
            q: `<p>次の会話と、Yの応じ方が同じものを選びなさい。</p>${box(talk(base[0], base[1]))}`,
            choices: items.map((x) => talk(x.t[0], x.a ? x.t[1] : x.t[2])),
            answer: items.findIndex((x) => x.a),
            explain: `元の会話のYは「<b>${G.a}</b>」。ほかの選択肢のYは「${G.b}」。`,
          };
        }
        // 5つの会話を P（2つ）と Q（3つ）に分ける
        const minorA = r.chance(0.5);
        const types = r.shuffle([minorA, minorA, !minorA, !minorA, !minorA]);
        const rows = r.sample(G.t, 5).map((t, i) => ({ x: t[0], y: types[i] ? t[1] : t[2], a: types[i] }));
        const ok = rows.map((x, i) => (x.a === minorA ? i : -1)).filter((i) => i >= 0);
        const { choices, answer } = pairChoices(r, ok);
        return {
          q: `<p>次のア〜オは、Xの発言に対するYの応じ方を示したものである。Yの応じ方によって2つのグループ P（2つ）と Q（3つ）に分けるとき、P に入るものの組み合わせを選びなさい。</p>${kanaList(rows.map((x) => talk(x.x, x.y)))}`,
          choices, answer,
          explain: `話題ではなく、Yの応じ方で分ける。P は「<b>${minorA ? G.a : G.b}</b>」、Q は「${minorA ? G.b : G.a}」。<br>${rows.map((x, i) => `${KANA[i]}：${x.a ? G.a : G.b}`).join("<br>")}`,
        };
      }
      if (!hard) {
        const ti = r.int(0, KOUZOU.length - 1);
        const [base, same] = r.sample(KOUZOU[ti].ps, 2);
        const others = KOUZOU.map((T, j) => j !== ti && { p: r.pick(T.ps), j }).filter(Boolean);
        const items = r.shuffle([{ p: same, j: ti }, ...others]);
        return {
          q: `<p>次の問題と同じ考え方で解けるものを選びなさい（解く必要はない）。</p>${box(base)}`,
          choices: items.map((x) => x.p), answer: items.findIndex((x) => x.j === ti),
          explain: `元の問題は「<b>${KOUZOU[ti].t}</b>」。<br>${items.map((x) => `・${KOUZOU[x.j].t}`).join("<br>")}`,
        };
      }
      const ti = r.int(0, KOUZOU.length - 1);
      const items = r.shuffle([...r.sample(KOUZOU[ti].ps, 2).map((p) => ({ p, j: ti })), ...KOUZOU.map((T, j) => j !== ti && { p: r.pick(T.ps), j }).filter(Boolean)]);
      const ok = items.map((x, i) => (x.j === ti ? i : -1)).filter((i) => i >= 0);
      const { choices, answer } = pairChoices(r, ok);
      return {
        q: `<p>次のア〜オのうち、同じ考え方で解ける2つの組み合わせを選びなさい（解く必要はない）。</p>${kanaList(items.map((x) => x.p))}`,
        choices, answer,
        explain: items.map((x, i) => `${KANA[i]}：${x.j === ti ? `<b>${KOUZOU[x.j].t}</b>` : KOUZOU[x.j].t}`).join("<br>"),
      };
    },
  },
];
