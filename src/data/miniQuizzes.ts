/**
 * 子供向けミニクイズデータ
 * ImageGeneratingViewの待機画面で表示される
 */

export interface MiniQuiz {
  question: string;
  choices: [string, string];
  answer: 0 | 1;
  emoji: string;
}

export const miniQuizzes: MiniQuiz[] = [
  { question: "パンダのしっぽは何色？", choices: ["くろ", "しろ"], answer: 1, emoji: "🐼" },
  { question: "いちばん大きいどうぶつは？", choices: ["ゾウ", "シロナガスクジラ"], answer: 1, emoji: "🐋" },
  { question: "にじは何色ある？", choices: ["5色", "7色"], answer: 1, emoji: "🌈" },
  { question: "タコのあしは何本？", choices: ["6本", "8本"], answer: 1, emoji: "🐙" },
  { question: "太陽はどっち？", choices: ["ほし", "わくせい"], answer: 0, emoji: "☀️" },
  { question: "ペンギンはどこにすんでいる？", choices: ["きたきょく", "なんきょく"], answer: 1, emoji: "🐧" },
  { question: "キリンのしたは何センチ？", choices: ["20センチ", "50センチ"], answer: 1, emoji: "🦒" },
  { question: "イルカはなにのなかま？", choices: ["さかな", "ほにゅうるい"], answer: 1, emoji: "🐬" },
  { question: "水がこおるのは何度？", choices: ["0度", "10度"], answer: 0, emoji: "❄️" },
  { question: "地球は何でできている？", choices: ["まる", "しかく"], answer: 0, emoji: "🌍" },
  { question: "チョウチョは何からうまれる？", choices: ["たまご", "はな"], answer: 0, emoji: "🦋" },
  { question: "月は何でひかっている？", choices: ["じぶんで", "太陽の光"], answer: 1, emoji: "🌙" },
  { question: "カエルのあかちゃんは？", choices: ["おたまじゃくし", "こガエル"], answer: 0, emoji: "🐸" },
  { question: "ミツバチがつくるのは？", choices: ["はちみつ", "さとう"], answer: 0, emoji: "🐝" },
  { question: "サボテンはどこにはえる？", choices: ["さばく", "もり"], answer: 0, emoji: "🌵" },
  { question: "ゾウのはなは何とよばれる？", choices: ["しっぽ", "はな"], answer: 1, emoji: "🐘" },
  { question: "ながれ星は何？", choices: ["ほし", "うちゅうのちり"], answer: 1, emoji: "🌠" },
  { question: "クマは冬に何をする？", choices: ["ねむる", "あそぶ"], answer: 0, emoji: "🐻" },
  { question: "かみなりは何？", choices: ["でんき", "かぜ"], answer: 0, emoji: "⚡" },
  { question: "ひまわりはどっちをむく？", choices: ["太陽", "月"], answer: 0, emoji: "🌻" },
  { question: "さかなはどこでいきをする？", choices: ["えら", "はな"], answer: 0, emoji: "🐠" },
  { question: "トカゲは何を切れる？", choices: ["しっぽ", "あし"], answer: 0, emoji: "🦎" },
  { question: "フクロウはいつかつどうする？", choices: ["よる", "ひる"], answer: 0, emoji: "🦉" },
  { question: "アリはどのくらいはこべる？", choices: ["体の10倍", "体の50倍"], answer: 1, emoji: "🐜" },
  { question: "サメのはは何回はえる？", choices: ["1回", "なん回も"], answer: 1, emoji: "🦈" },
  { question: "コウモリはどうやって見る？", choices: ["目", "音"], answer: 1, emoji: "🦇" },
  { question: "くもは何でできている？", choices: ["水のつぶ", "けむり"], answer: 0, emoji: "☁️" },
  { question: "かざんから出るのは？", choices: ["マグマ", "水"], answer: 0, emoji: "🌋" },
  { question: "はっぱが赤くなるのは？", choices: ["あき", "なつ"], answer: 0, emoji: "🍂" },
  { question: "しょくぶつは何をだす？", choices: ["酸素", "二酸化炭素"], answer: 0, emoji: "🌿" },
  { question: "ワシはどのくらい見える？", choices: ["100メートル", "2キロ"], answer: 1, emoji: "🦅" },
  { question: "タコの心ぞうは何こ？", choices: ["1こ", "3こ"], answer: 1, emoji: "🐙" },
  { question: "地球は何回まわる？", choices: ["1日1回", "1日2回"], answer: 0, emoji: "🌏" },
  { question: "水がゆげになるのは？", choices: ["100度", "50度"], answer: 0, emoji: "💧" },
  { question: "きょうりゅうはいつまでいた？", choices: ["100万年前", "6600万年前"], answer: 1, emoji: "🦖" },
  { question: "海の水はなぜしょっぱい？", choices: ["しお", "さとう"], answer: 0, emoji: "🌊" },
  { question: "星の光は何年前？", choices: ["きのう", "何百年前"], answer: 1, emoji: "⭐" },
  { question: "花のにおいは何のため？", choices: ["虫をよぶ", "きれいにする"], answer: 0, emoji: "🌸" },
  { question: "雪のけっしょうは？", choices: ["おなじ", "ぜんぶちがう"], answer: 1, emoji: "❄️" },
  { question: "太陽の温度は？", choices: ["100度", "6000度"], answer: 1, emoji: "🔥" },
];
