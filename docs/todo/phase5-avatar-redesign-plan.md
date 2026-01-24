# Phase 5: アバター画像統一化プラン

**日付**: 2026-01-06  
**ステータス**: 📋 計画中

## 概要

藤子・F・不二雄と鳥山明を追加した際にアバター画像の統一性が課題となったため、全8人のアバター画像を統一的なコンセプトで再生成します。

## 採用方式：「画風の象徴的モチーフ」アプローチ

**コンセプト**: 各アーティストの画風を象徴する特徴的なモチーフやパターンをアイコン的に表現

**メリット**:
- ✅ 実在人物の顔を避けられる（著作権・肖像権の問題回避）
- ✅ 各画風の特徴が直感的に理解できる
- ✅ アイコンとして認識しやすい
- ✅ 統一感と個性のバランスが良い

**統一要素**:
- アスペクト比: 1:1（正方形）
- サイズ: 512x512px
- 構図: 中央配置、シンボリックな表現
- UIで円形マスクを適用

## 各アーティストのアバタープロンプト

### 1. ピカソ (Picasso)

**モチーフ**: 幾何学的に分解された抽象的な顔

```
An iconic representation of Pablo Picasso's cubism style, geometric abstract face 
with multiple viewpoints simultaneously, fragmented angular forms, bold primary 
colors (blue, yellow, red, black), overlapping planes, modernist composition, 
no realistic human features, symbolic and abstract, oil painting texture, 
centered composition, 1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, detailed features
```

---

### 2. 岡本太郎 (Okamoto)

**モチーフ**: 原始的な目のモチーフと爆発的なエネルギー

```
An iconic representation of Taro Okamoto's explosive avant-garde style, 
primitive eye motifs, intense RED and yellow and black colors, powerful thick 
brushstrokes, raw emotional energy, abstract expressionism, dynamic radiating 
composition, symbolic eyes and organic forms, no realistic human features, 
centered composition, 1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, delicate, pastel
```

---

### 3. ゴッホ (Van Gogh)

**モチーフ**: うねる筆致と星空のパターン

```
An iconic representation of Vincent van Gogh's post-impressionist style, 
swirling brushstrokes pattern, vibrant blues and yellows, starry night motifs, 
thick impasto texture, emotional intensity, expressive movement, no realistic 
human features, abstract swirling composition, oil painting, centered composition, 
1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, flat, smooth
```

---

### 4. モネ (Monet)

**モチーフ**: 睡蓮と水面の反射

```
An iconic representation of Claude Monet's impressionist style, water lily 
and pond motifs, soft brushstrokes, dappled light effects, pastel colors 
(pink, blue, green), atmospheric reflections, gentle and serene mood, 
no realistic human features, abstract natural forms, oil painting, 
centered composition, 1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, sharp, detailed
```

---

### 5. ダリ (Dalí)

**モチーフ**: 溶ける時計と超現実的なシンボル

```
An iconic representation of Salvador Dalí's surrealist style, melting clock 
motifs, dreamlike symbolic elements, hyperrealistic details in impossible 
scenarios, bizarre juxtapositions, precise rendering, surreal atmosphere, 
no realistic human features, symbolic composition, oil painting, 
centered composition, 1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, ordinary, logical
```

---

### 6. 北斎 (Hokusai)

**モチーフ**: 大波と富士山

```
An iconic representation of Katsushika Hokusai's ukiyo-e style, great wave 
motif with Mount Fuji, bold black outlines, flat color areas, intense prussian 
blue, traditional Japanese aesthetic, woodblock print style, detailed line work, 
no realistic human features, dynamic wave composition, centered composition, 
1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, 3D, western style
```

---

### 7. 藤子不二雄 (Fujiko)

**モチーフ**: 四次元ポケットと未来道具のシルエット

```
An iconic representation of Fujiko F. Fujio's manga illustration style, 
four-dimensional pocket motif with futuristic gadget silhouettes, clean line art, 
rounded soft forms, simple friendly shapes, bright warm colors, gentle atmosphere, 
slightly fantastical elements, manga style with clear outlines, flat color areas, 
heartwarming and nostalgic mood, no realistic human features, no specific characters, 
centered composition, 1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, Doraemon character, 
specific copyrighted characters, dark, gritty
```

---

### 8. 鳥山明 (Toriyama)

**モチーフ**: メカニックデザインと躍動感のあるエネルギー波

```
An iconic representation of Akira Toriyama's manga illustration style, 
mechanical design elements with energy wave motifs, clean bold lines, 
dynamic action composition, vibrant colors, strong contrast, energetic atmosphere, 
manga style with strong sense of depth and movement, no realistic human features, 
no specific characters, adventurous and playful mood, centered composition, 
1:1 square format, masterpiece
```

**ネガティブ**:
```
realistic face, photographic, actual person, portrait, Dragon Ball characters, 
specific copyrighted characters, static, dull colors
```

---

## 生成手順

### Step 1: プロンプトの最終確認

各プロンプトを確認し、必要に応じて微調整。

### Step 2: Image MCPで一括生成

```bash
# 各アーティストのアバターを順次生成
# output_path: tools/master-piece/public/avatars/{artist-id}.png
```

生成順序:
1. picasso.png
2. okamoto.png
3. van-gogh.png
4. monet.png
5. dali.png
6. hokusai.png
7. fujiko.png
8. toriyama.png

### Step 3: 品質確認

- 全体的な統一感をチェック
- 各画風の特徴が適切に表現されているか
- 円形マスクでの見え方を確認

### Step 4: 必要に応じて再生成

統一感が不足している場合や、特定のアバターが期待と異なる場合は、プロンプトを調整して再生成。

### Step 5: UIでの動作確認

- 開発サーバーで表示確認
- レスポンシブデザインでの見え方
- 8人全員が適切に表示されるか

---

## 技術的考慮事項

### 著作権対応

- ✅ 実在人物の顔を避ける
- ✅ 特定キャラクター（ドラえもん、悟空など）を描かない
- ✅ 画風の「象徴的モチーフ」に焦点
- ✅ 一般的な視覚的特徴のみ使用

### プロンプト設計のポイント

1. **"no realistic human features"**: 実在人物を避ける
2. **"no specific characters"**: 特定キャラクターを避ける（漫画家）
3. **モチーフの明確化**: 各画風を象徴する要素を具体的に指定
4. **統一要素**: "centered composition, 1:1 square format, masterpiece"

### Gemini 3.0 Pro Imageの特性

- 絵画スタイルが得意
- 漫画スタイルには「manga illustration style」の明示が重要
- ネガティブプロンプトで不要な要素を除外

---

## 期待される成果

### ビジュアル的統一感

- 全アバターが1:1正方形
- 円形マスクで統一されたUI
- 各画風の特徴が明確

### ユーザー体験の向上

- 各アーティストの画風が一目で分かる
- アイコンとして認識しやすい
- プロフェッショナルな印象

### 拡張性

- 今後アーティストを追加する際も同じルールで対応可能
- プロンプトパターンが確立

---

## 次のステップ

1. ✅ プラン策定完了
2. ⏳ ユーザー承認待ち
3. 🔜 Image MCPで生成実行
4. 🔜 品質確認と調整
5. 🔜 完了報告作成

---

## 参考

- 元の実装: [`tools/master-piece/src/lib/artists.ts`](../src/lib/artists.ts)
- Phase 4完了報告: [`tools/master-piece/docs/done/phase4-manga-masters-completion.md`](../done/phase4-manga-masters-completion.md)
