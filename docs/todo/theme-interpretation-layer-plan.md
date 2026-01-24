# Masterpiece Maker - 意味解釈層（Theme Interpretation Layer）設計書

**ステータス**: 計画中
**最終更新**: 2025-12-26

## 1. 現状の問題点

現在のプロンプト生成ロジックでは、ユーザーのお題（Theme）を画家の固定プロンプトテンプレートに単純に挿入しているだけである。

```typescript
// 現在の実装
return artist.promptTemplate.replace("{theme}", theme);
```

**問題**:
- 画家のスタイル記述（例: 北斎の「ukiyo-e, prussian blue, Mt. Fuji」など）が非常に強力であるため、お題（例: 「ディズニーランド」）がスタイル記述に負けてしまい、**画家の代表作（富士山と大波など）に似た画像ばかり生成される**。
- お題が単語として埋め込まれるだけで、**画家の世界観でどう解釈すべきかの指示がない**。

## 2. 解決方針

**「タッチは画家特有、モチーフはユーザー提供のお題に寄せる」** というバランスを実現する。

そのために、**意味解釈層（Theme Interpretation Layer）** を導入し、以下のプロセスでプロンプトを生成する。

1. **お題の意味抽出**: ユーザー入力から「描画要素」と「ムード」を抽出する。
2. **構造化プロンプト**: 画家の「タッチ定義」と「モチーフ指示」を分離し、LLMが解釈した要素と組み合わせる。

## 3. アプローチ2の詳細設計

### ステップ1: お題の意味抽出 (LLM活用)

ユーザー入力「ディズニーランドに行きたい」から、以下の情報を抽出・解釈する。

- **具体的手順**: LLM (Gemini) に以下のプロンプトを投げる
  ```text
  User wants: "ディズニーランドに行きたい"
  
  Extract:
  1. Main visual elements (what should be depicted)
  2. Mood/emotion (atmosphere of the scene)
  
  Output JSON: { "elements": "...", "mood": "..." }
  ```

- **期待される出力**:
  ```json
  {
    "elements": "Disney castle, fireworks in night sky, crowds enjoying attractions",
    "mood": "joy, wonder, magical fantasy"
  }
  ```

### ステップ2: 画家データの構造化

`Artist` インターフェースを拡張し、スタイルと解釈ガイドを分離する。

```typescript
interface Artist {
  // ... 既存フィールド
  
  // 新しいフィールド
  styleCore: string;        // 画家のタッチ（技法・質感・必須スタイル）
  styleMood: string;        // 画家の雰囲気（色調・感情・特徴的要素）
  interpretationGuide: string; // お題の解釈ガイド（AIへの指示）
}
```

**例: 葛飾北斎**
- `styleCore`: "ukiyo-e woodblock print style, bold black outlines, flat color areas, detailed line work"
- `styleMood`: "intense prussian blue dominant, vibrant colors, dynamic composition, Japanese aesthetic"
- `interpretationGuide`: "Interpret the theme with traditional Japanese perspective and composition, but depict modern subjects naturally. Maintain the essence of the theme while applying ukiyo-e visual language."

### ステップ3: プロンプト合成ロジック

新しいプロンプト生成関数 `generatePrompt` のロジック：

```typescript
// 最終的なプロンプト構造
`
Subject: ${interpreted.elements} (${interpreted.mood})

Style: ${artist.styleCore}
Atmosphere: ${artist.styleMood}

Guidance: ${artist.interpretationGuide}
`
```

**合成後のプロンプト例（北斎 × ディズニー）**:
```text
Subject: Disney castle, fireworks in night sky, crowds enjoying attractions (joy, wonder, magical fantasy)

Style: ukiyo-e woodblock print style, bold black outlines, flat color areas, detailed line work

Atmosphere: intense prussian blue dominant, vibrant colors, dynamic composition, Japanese aesthetic

Guidance: Interpret the theme with traditional Japanese perspective and composition, but depict modern subjects naturally. Maintain the essence of the theme while applying ukiyo-e visual language.
```

## 4. 実装ロードマップ

### Phase 1: データ構造の変更と手動検証 (即効性重視)
1. `src/lib/artists.ts` に `styleCore`, `styleMood`, `interpretationGuide` を追加し、既存のテンプレートを分解して移植する。
2. `src/lib/prompt.ts` の `generatePrompt` を変更し、LLMを使わずに**お題をSubjectの先頭に配置**する新しいフォーマットを適用する。
   - 暫定フォーマット:
     ```text
     Subject: {theme}
     Style: {artist.styleCore}
     Atmosphere: {artist.styleMood}
     Guidance: {artist.interpretationGuide}
     ```
3. これだけでも「お題」の優先度が高まり、改善が見込める。

### Phase 2: LLM意味解釈の実装 (本質的解決)
1. `src/lib/gemini.ts` (または新規ファイル) に `interpretTheme(theme, artist)` 関数を実装する。
2. `generatePrompt` を非同期関数化し、`interpretTheme` の結果を使ってプロンプトを構築するように変更する。

### Phase 3: UI/UXの調整
1. プロンプト生成中のローディング表示を「北斎が思案中...」のように演出する。
2. 生成された解釈（要素とムード）をユーザーに表示する（デバッグまたはエンタメとして）。

## 5. 画家ごとの設定案（ドラフト）

| 画家 | styleCore (タッチ) | styleMood (雰囲気) | interpretationGuide (解釈方針) |
|---|---|---|---|
| **葛飾北斎** | 浮世絵、木版画、太い輪郭線、フラットな塗り | ベロ藍（プルシアンブルー）、和の美学、ダイナミックな構図 | 現代的な被写体であっても、浮世絵の技法と構図で表現せよ。日本的な遠近法を用いよ。 |
| **ピカソ** | キュビズム、幾何学的形態、多視点、断片化 | 大胆な色使い、抽象的表現、油彩の質感 | 対象を幾何学的に分解・再構築せよ。一つの視点にとらわれず、多角的な視点を一枚の絵に収めよ。 |
| **岡本太郎** | アブストラクト、力強い筆致、原始的なモチーフ | 原色（赤・黄・黒）、爆発的エネルギー、シュール | 生命力とエネルギーを強調せよ。常識的な形態を無視し、魂の叫びを形にせよ。 |
| **モネ** | 印象派、柔らかい筆致、光の表現 | パステルカラー、穏やかな空気感、水面の反射 | 形態よりも「光」と「色」の変化を描け。輪郭線をあいまいにし、空気感を表現せよ。 |
| **ダリ** | シュルレアリスム、超写実的な細部、溶ける物体 | 夢幻的、不条理な組み合わせ、深い影 | 夢の中の光景のように、現実にはありえない組み合わせや変形（溶ける時計など）を取り入れよ。 |
| **ゴッホ** | 後期印象派、厚塗り（インパスト）、うねる筆致 | 鮮烈な色彩（黄色と青）、感情的な激しさ | 対象そのものではなく、対象から感じる「感情」を描け。夜空や風景に生命のうねりを与えよ。 |
