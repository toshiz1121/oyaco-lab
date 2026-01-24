# Phase 5.1: アバター画像統一化 v2 - 人物版

**日付**: 2026-01-06  
**ステータス**: 📋 計画中

## フィードバックと方針転換

### ユーザーフィードバック
- ❌ モチーフだけでは「誰か」が分かりにくい
- ✅ 生成した画風パターンは良い（背景として活用可能）
- ✅ 人物のアバターが必要

### 新しい方針

**2層構造アプローチ**:
1. **前景**: 人物のアバター（統一的なイラストスタイル）
2. **背景**: 各画風を表すパターン（透明度50%、既に生成済み）

## 採用方式：「統一イラスト + 画風背景」

### コンセプト

**人物アバター**:
- 統一されたイラストスタイル（シンプル、親しみやすい）
- 各アーティストの特徴的な外見を表現
- 実在人物の写真ではなく、イラスト化された表現

**背景**:
- Phase 5で生成した画風パターンを活用
- 透明度50%で背後に配置
- 各アーティストの画風を視覚的に補強

### メリット

- ✅ 人物として認識しやすい
- ✅ 各アーティストの個性が明確
- ✅ 既存の画風パターンを無駄にしない
- ✅ 統一感のあるデザイン

## 人物アバターのデザイン方針

### 統一要素

1. **イラストスタイル**: シンプルで親しみやすい線画
2. **構図**: バストアップ、正面または斜め向き
3. **色彩**: 柔らかく温かみのある色調
4. **サイズ**: 512x512px、1:1正方形
5. **背景**: 透明（PNG）

### 各アーティストの特徴的要素

#### 1. ピカソ (Picasso)
- **外見**: ボーダーシャツ、短髪、鋭い目
- **雰囲気**: 知的で自信に満ちた表情

#### 2. 岡本太郎 (Okamoto)
- **外見**: 特徴的な髪型、力強い眉
- **雰囲気**: エネルギッシュで情熱的な表情

#### 3. ゴッホ (Van Gogh)
- **外見**: 赤髭、麦わら帽子
- **雰囲気**: 繊細で内省的な表情

#### 4. モネ (Monet)
- **外見**: 長い白髭、優しい目
- **雰囲気**: 穏やかで観察眼のある表情

#### 5. ダリ (Dalí)
- **外見**: 特徴的な上向きの口髭
- **雰囲気**: 奇抜で知的な表情

#### 6. 北斎 (Hokusai)
- **外見**: 和装、鉢巻き、職人風
- **雰囲気**: 頑固で職人気質な表情

#### 7. 藤子不二雄 (Fujiko)
- **外見**: 丸眼鏡、優しい笑顔
- **雰囲気**: 温厚で親しみやすい表情

#### 8. 鳥山明 (Toriyama)
- **外見**: サングラス、カジュアルな服装
- **雰囲気**: 謙虚で控えめな表情

## プロンプト戦略

### 基本テンプレート

```
A friendly illustrated avatar portrait of [artist description],
simple clean line art style, warm and approachable illustration,
bust shot, [specific features], soft colors, gentle expression,
professional but friendly, transparent background, PNG format,
centered composition, 1:1 square format, high quality illustration
```

### ネガティブプロンプト（共通）

```
photographic, realistic photo, 3D render, complex details, 
dark atmosphere, aggressive expression, low quality
```

## 各アーティストのプロンプト

### 1. ピカソ (Picasso)

```
A friendly illustrated avatar portrait of Pablo Picasso,
simple clean line art style, wearing iconic striped shirt,
short dark hair, intelligent sharp eyes, confident expression,
warm and approachable illustration, bust shot, soft colors,
professional but friendly, transparent background, PNG format,
centered composition, 1:1 square format, high quality illustration
```

### 2. 岡本太郎 (Okamoto)

```
A friendly illustrated avatar portrait of Taro Okamoto,
simple clean line art style, distinctive hairstyle, strong eyebrows,
energetic and passionate expression, warm and approachable illustration,
bust shot, soft colors, professional but friendly, transparent background,
PNG format, centered composition, 1:1 square format, high quality illustration
```

### 3. ゴッホ (Van Gogh)

```
A friendly illustrated avatar portrait of Vincent van Gogh,
simple clean line art style, red beard, straw hat, gentle eyes,
sensitive and introspective expression, warm and approachable illustration,
bust shot, soft colors, professional but friendly, transparent background,
PNG format, centered composition, 1:1 square format, high quality illustration
```

### 4. モネ (Monet)

```
A friendly illustrated avatar portrait of Claude Monet,
simple clean line art style, long white beard, kind eyes,
calm and observant expression, warm and approachable illustration,
bust shot, soft colors, professional but friendly, transparent background,
PNG format, centered composition, 1:1 square format, high quality illustration
```

### 5. ダリ (Dalí)

```
A friendly illustrated avatar portrait of Salvador Dalí,
simple clean line art style, iconic upturned mustache,
eccentric and intellectual expression, warm and approachable illustration,
bust shot, soft colors, professional but friendly, transparent background,
PNG format, centered composition, 1:1 square format, high quality illustration
```

### 6. 北斎 (Hokusai)

```
A friendly illustrated avatar portrait of Katsushika Hokusai,
simple clean line art style, traditional Japanese clothing, headband,
craftsman-like appearance, stubborn but dedicated expression,
warm and approachable illustration, bust shot, soft colors,
professional but friendly, transparent background, PNG format,
centered composition, 1:1 square format, high quality illustration
```

### 7. 藤子不二雄 (Fujiko)

```
A friendly illustrated avatar portrait of Fujiko F. Fujio,
simple clean line art style, round glasses, gentle smile,
warm and kind expression, approachable illustration, bust shot,
soft colors, professional but friendly, transparent background,
PNG format, centered composition, 1:1 square format, high quality illustration
```

### 8. 鳥山明 (Toriyama)

```
A friendly illustrated avatar portrait of Akira Toriyama,
simple clean line art style, sunglasses, casual clothing,
humble and modest expression, warm and approachable illustration,
bust shot, soft colors, professional but friendly, transparent background,
PNG format, centered composition, 1:1 square format, high quality illustration
```

## UI実装方針

### 2層構造の実装

```tsx
// ArtistSelector.tsx の修正案
<div className="relative">
  {/* 背景: 画風パターン（透明度50%） */}
  <div 
    className="absolute inset-0 opacity-50 rounded-full"
    style={{
      backgroundImage: `url(/avatars/patterns/${artist.id}.png)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}
  />
  
  {/* 前景: 人物アバター */}
  <Avatar className="relative z-10">
    <AvatarImage src={`/avatars/${artist.id}.png`} />
    <AvatarFallback>{artist.nameEn[0]}</AvatarFallback>
  </Avatar>
</div>
```

### ディレクトリ構造

```
public/avatars/
├── picasso.png          # 人物アバター（新規生成）
├── okamoto.png
├── van-gogh.png
├── monet.png
├── dali.png
├── hokusai.png
├── fujiko.png
├── toriyama.png
└── patterns/            # 画風パターン（Phase 5で生成済み）
    ├── picasso.png      # 既存のモチーフ画像を移動
    ├── okamoto.png
    ├── van-gogh.png
    ├── monet.png
    ├── dali.png
    ├── hokusai.png
    ├── fujiko.png
    └── toriyama.png
```

## 実装手順

### Step 1: 既存の画風パターンを移動

```bash
cd tools/master-piece/public/avatars
mkdir patterns
cp *.png patterns/
# 人物アバター生成後、元のファイルを上書き
```

### Step 2: 人物アバターを生成

Image MCPで8枚の人物アバターを順次生成。

### Step 3: UI実装

`ArtistSelector.tsx`を修正し、2層構造を実装。

### Step 4: 動作確認

- 人物アバターが明確に表示されるか
- 背景の画風パターンが適切に表示されるか（透明度50%）
- 円形マスクが適切に適用されるか

## 期待される効果

### ユーザー体験

- ✅ 各アーティストが人物として認識しやすい
- ✅ 画風の特徴も視覚的に理解できる（背景パターン）
- ✅ 統一感のあるデザイン
- ✅ プロフェッショナルな印象

### 技術的メリット

- ✅ Phase 5の成果物を無駄にしない
- ✅ 2層構造で柔軟なデザイン調整が可能
- ✅ 背景パターンの透明度を調整可能

## 著作権対応

### 人物イラストの注意点

- ✅ 実在人物の写真ではなく、イラスト化された表現
- ✅ 特徴的な外見要素のみを表現（髭、眼鏡、服装など）
- ✅ 「friendly illustrated avatar」で親しみやすいスタイル
- ✅ 肖像権の問題を回避

## 次のステップ

1. ✅ Phase 5.1プラン策定完了
2. ⏳ ユーザー承認待ち
3. 🔜 既存画風パターンを`patterns/`に移動
4. 🔜 Image MCPで人物アバター生成（8枚）
5. 🔜 UI実装（2層構造）
6. 🔜 動作確認
7. 🔜 完了報告作成

## 参考

- Phase 5完了報告: [`tools/master-piece/docs/done/phase5-avatar-redesign-completion.md`](../done/phase5-avatar-redesign-completion.md)
- 既存の画風パターン: `tools/master-piece/public/avatars/*.png`
