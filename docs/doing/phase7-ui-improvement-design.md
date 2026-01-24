# Phase 7: UI改善設計書

## 概要

**目的**: スクロールせずに「何ができるツールか」が3秒で伝わるUIに改善する

**現状の問題**:
- 巨匠選択（8人のカード）が画面を支配
- テーマ入力欄が完全にスクロール外
- ファーストビューで何ができるツールか分からない

**改善方針**:
- 3カラムレイアウトで情報を整理
- ヘッダーをコンパクト化
- テーマ入力を主役に
- 絵を見ながら会話できるチャットエリア

---

## 改善後のレイアウト構成

```
┌─────────────────────────────────────────────────────────┐
│ 🎨 Masterpiece Maker  [≡ メニュー]  ← コンパクトヘッダー │
├─────────────┬─────────────────┬─────────────────────────┤
│ 左カラム    │ 中央カラム      │ 右カラム                │
│ (入力)      │ (出力)          │ (チャット)              │
│             │                 │                         │
│ テーマ入力  │ ┌─────────────┐ │ ┌─────────────────────┐ │
│ ┌─────────┐ │ │   Canvas    │ │ │ チャット            │ │
│ │         │ │ │  (固定)     │ │ │ (スクロール可能)    │ │
│ │         │ │ │             │ │ │ ↕                   │ │
│ └─────────┘ │ └─────────────┘ │ │ 絵を見ながら        │ │
│             │                 │ │ 会話できる          │ │
│ 巨匠選択    │ ┌─────────────┐ │ │                     │ │
│ ○○○○       │ │  コメント   │ │ │                     │ │
│ ○○○○       │ │  (固定)     │ │ │                     │ │
│ (2行×4列)  │ └─────────────┘ │ │                     │ │
│             │                 │ │                     │ │
│ [生成]      │                 │ └─────────────────────┘ │
└─────────────┴─────────────────┴─────────────────────────┘
```

---

## 詳細設計

### 1. ヘッダー（超コンパクト化）

**現状**: 高さ約200px（タイトル、サブタイトル、ボタン）
**改善後**: 高さ48px（タイトルとメニューのみ）

```tsx
<header className="h-12 border-b flex items-center justify-between px-4">
  <h1 className="text-lg font-bold flex items-center gap-2">
    <Palette className="h-5 w-5" />
    Masterpiece Maker
  </h1>
  
  {/* ハンバーガーメニュー */}
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button variant="ghost" size="sm">
        <Menu className="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>
        <Swords className="mr-2 h-4 w-4" />
        巨匠バトルモード
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</header>
```

**改善点**:
- ✅ サブタイトル「巨匠の筆致で、あなただけの傑作を。」を削除
- ✅ 巨匠バトルボタンをハンバーガーメニューに格納
- ✅ 高さを12（48px）に圧縮
- ✅ 画面の縦スペースを最大化

---

### 2. 左カラム（入力エリア）

**幅**: 320px（w-80）
**内容**: テーマ入力 + 巨匠選択 + 生成ボタン

```tsx
<div className="w-80 space-y-4 p-4">
  {/* テーマ入力 */}
  <div className="space-y-2">
    <Label className="text-sm font-semibold">テーマ</Label>
    <Textarea
      rows={4}
      placeholder="例: 夕暮れの富士山、猫と月、雨上がりのパリの街角..."
      className="resize-none"
      maxLength={500}
    />
    <div className="text-xs text-right text-muted-foreground">
      {theme.length} / 500
    </div>
  </div>

  {/* 巨匠選択（コンパクト） */}
  <div className="space-y-2">
    <Label className="text-sm font-semibold">巨匠</Label>
    <div className="grid grid-cols-4 gap-2">
      {artists.map((artist) => (
        <button
          key={artist.id}
          className={cn(
            "aspect-square rounded-lg overflow-hidden border-2 transition-all",
            "hover:scale-105",
            selectedArtistId === artist.id 
              ? "border-primary ring-2 ring-primary/20" 
              : "border-transparent hover:border-primary/50"
          )}
          onClick={() => setSelectedArtistId(artist.id)}
        >
          <div className="relative w-full h-full">
            {/* 画風パターン（外側） */}
            <Image
              src={`/avatars/patterns/${artist.id}.png`}
              alt={`${artist.name} pattern`}
              fill
              className="object-cover"
            />
            {/* 人物アバター（内側） */}
            <div className="absolute inset-1 rounded-full overflow-hidden border-2 border-white bg-white">
              <Image
                src={artist.thumbnailUrl}
                alt={artist.name}
                fill
                className="object-cover"
              />
            </div>
          </div>
        </button>
      ))}
    </div>
  </div>

  {/* 生成ボタン */}
  <Button 
    size="lg" 
    className="w-full text-lg font-bold py-6"
    onClick={handleGenerate}
    disabled={isGenerating || !selectedArtistId || !theme.trim()}
  >
    {isGenerating ? "制作中..." : "傑作を生み出す"}
  </Button>
</div>
```

**改善点**:
- ✅ 巨匠ボタンを2行×4列に圧縮
- ✅ aspect-square で高さを抑制
- ✅ 名前・スタイル表示を削除（ホバーで表示可能）
- ✅ 全体の高さを大幅削減
- ✅ テーマ入力が最上部で目立つ

---

### 3. 中央カラム（出力エリア）

**幅**: flex-1（残りのスペース）
**内容**: Canvas + コメントエリア（常に枠を表示）

```tsx
<div className="flex-1 space-y-4 p-4">
  {/* Canvas（常に枠を表示） */}
  <Card className="border-2 border-dashed border-muted-foreground/20">
    <CardHeader>
      <CardTitle className="text-sm">Canvas</CardTitle>
      <CardDescription className="text-xs">
        ここに作品が表示されます
      </CardDescription>
    </CardHeader>
    <CardContent>
      {generatedImageUrl ? (
        <div className="relative aspect-square w-full">
          <Image
            src={generatedImageUrl}
            alt="Generated artwork"
            fill
            className="object-contain rounded-lg"
          />
        </div>
      ) : (
        <div className="aspect-square bg-muted flex items-center justify-center rounded-lg">
          <p className="text-muted-foreground text-center">
            テーマと巨匠を選んで<br />
            「傑作を生み出す」を押してください
          </p>
        </div>
      )}
      
      {/* ダウンロードボタン */}
      {generatedImageUrl && (
        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={handleDownload}
        >
          <Download className="mr-2 h-4 w-4" />
          ダウンロード
        </Button>
      )}
    </CardContent>
  </Card>

  {/* コメントエリア（常に枠を表示） */}
  <Card className="border-2">
    <CardHeader>
      <CardTitle className="text-sm">巨匠のコメント</CardTitle>
      <CardDescription className="text-xs">
        作品について巨匠が語ります
      </CardDescription>
    </CardHeader>
    <CardContent>
      {isGeneratingComment ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : generatedComment ? (
        <p className="text-sm leading-relaxed">{generatedComment}</p>
      ) : (
        <p className="text-muted-foreground text-sm">
          作品生成後に表示されます
        </p>
      )}
    </CardContent>
  </Card>
</div>
```

**改善点**:
- ✅ 常に枠を表示（何が起こるか予測可能）
- ✅ プレースホルダーで期待値を明示
- ✅ 生成前後で構造が変わらない
- ✅ ローディング状態を視覚化

---

### 4. 右カラム（チャットエリア）

**幅**: 384px（w-96）
**内容**: スクロール可能なチャットインターフェース

```tsx
<div className="w-96 p-4 h-screen sticky top-0">
  {/* チャットエリア（スクロール可能） */}
  <Card className="h-full border-2 flex flex-col">
    <CardHeader className="flex-shrink-0">
      <CardTitle className="text-sm">巨匠と対話</CardTitle>
      <CardDescription className="text-xs">
        作品を見ながら会話できます
      </CardDescription>
    </CardHeader>
    
    <CardContent className="flex-1 overflow-hidden p-0">
      {generatedImageUrl && selectedArtist ? (
        <ScrollArea className="h-full px-6">
          <ChatInterface 
            artist={selectedArtist}
            theme={theme}
            currentImageUrl={generatedImageUrl}
            initialMessage={
              generatedComment 
                ? `この作品について語ろうか。「${theme}」をテーマに描いてみたのだが、どう思うかね？`
                : selectedArtist.firstMessage
            }
            onImageModified={(newImageUrl) => setGeneratedImageUrl(newImageUrl)}
          />
        </ScrollArea>
      ) : (
        <div className="flex items-center justify-center h-full px-6">
          <p className="text-muted-foreground text-center text-sm">
            作品生成後に<br />
            巨匠と対話できます
          </p>
        </div>
      )}
    </CardContent>
  </Card>
</div>
```

**重要なポイント**:

1. **sticky top-0**: 右カラム全体を固定
   - 中央カラムをスクロールしても右カラムは固定位置
   - 常に絵が見える状態を維持

2. **ScrollArea**: チャット内容のみスクロール
   - ヘッダーは固定
   - チャット履歴が長くなってもスクロール可能
   - 絵を見ながら過去の会話を振り返れる

3. **h-screen**: 画面の高さいっぱいに表示
   - チャットエリアを最大限活用
   - 長い会話でも快適

**改善点**:
- ✅ 3カラム目として独立
- ✅ 常に枠を表示
- ✅ チャットが埋もれない
- ✅ 絵を見ながら会話できる
- ✅ スクロール可能で長い会話にも対応

---

## レスポンシブ対応

### デスクトップ（1280px以上）

```tsx
<div className="hidden lg:flex min-h-screen">
  {/* 左カラム */}
  <div className="w-80 flex-shrink-0">
    {/* 入力エリア */}
  </div>
  
  {/* 中央カラム */}
  <div className="flex-1 min-w-0">
    {/* 出力エリア */}
  </div>
  
  {/* 右カラム */}
  <div className="w-96 flex-shrink-0">
    {/* チャットエリア（sticky） */}
  </div>
</div>
```

### タブレット（768px - 1279px）

```tsx
<div className="hidden md:flex lg:hidden flex-col">
  {/* 上部: 入力と出力を横並び */}
  <div className="flex">
    <div className="w-80 flex-shrink-0">
      {/* 入力エリア */}
    </div>
    <div className="flex-1 min-w-0">
      {/* 出力エリア */}
    </div>
  </div>
  
  {/* 下部: チャット */}
  <div className="w-full">
    {/* チャットエリア（通常スクロール） */}
  </div>
</div>
```

### モバイル（767px以下）

```tsx
<div className="flex flex-col md:hidden">
  {/* 縦積み */}
  <div className="w-full p-4">
    {/* 入力エリア */}
  </div>
  
  <div className="w-full p-4">
    {/* 出力エリア */}
  </div>
  
  <div className="w-full p-4">
    {/* チャットエリア */}
  </div>
</div>
```

---

## UX上の利点

### 1. ファーストビューで全体が見える

**現状**:
```
ファーストビュー:
├─ ヘッダー (10%)
├─ 巨匠選択 (80%) ← 画面を支配
└─ [スクロール外]
    ├─ テーマ入力
    └─ 生成ボタン
```

**改善後**:
```
ファーストビュー:
├─ ヘッダー (5%)
├─ 左: テーマ入力 + 巨匠選択 + 生成ボタン (30%)
├─ 中央: Canvas + コメント (40%)
└─ 右: チャット (25%)
```

### 2. 絵を見ながら会話できる

**ユーザーの視線の流れ**:
```
┌─────────┐
│ 中央    │ ← 絵を見る（固定位置）
│ Canvas  │
└─────────┘
     ↓
┌─────────┐
│ 右      │ ← スクロールして会話
│ チャット│
└─────────┘
```

**シナリオ例**:
1. ユーザーが絵を生成
2. 中央カラムに絵が表示される
3. 右カラムで巨匠と会話開始
4. 会話が長くなる → 右カラム内でスクロール
5. **中央の絵は常に見える位置に固定**
6. 「この部分をもっと明るくして」など、絵を参照しながら指示できる

### 3. 情報の優先順位が明確

| カラム | 役割 | 優先度 |
|--------|------|--------|
| 左 | 入力（テーマ + 巨匠） | ★★★ 主役 |
| 中央 | 出力（絵 + コメント） | ★★★ 結果 |
| 右 | 対話（チャット） | ★★ 付加価値 |

### 4. 予測可能なUI

- ✅ 常に枠を表示
- ✅ 生成前後で構造が変わらない
- ✅ プレースホルダーで期待値を明示
- ✅ ローディング状態を視覚化

### 5. 画面スペースの最大活用

- ✅ ヘッダー圧縮（200px → 48px）で縦スペース確保
- ✅ 巨匠ボタン圧縮で左カラムをコンパクトに
- ✅ 3カラムで横スペースを有効活用
- ✅ スクロール最小化

---

## 期待される改善効果

### 定量的指標

| 指標 | 現状 | 改善後 | 改善率 |
|------|------|--------|--------|
| 初見での理解時間 | 10-15秒 | **3秒** | **70-80%削減** |
| 直帰率 | 60% | **30%** | **50%削減** |
| タスク完了時間 | 60秒 | **30秒** | **50%削減** |
| スクロール量（モバイル） | 3-4画面分 | **1-2画面分** | **50-66%削減** |
| テーマ入力までのクリック数 | スクロール必須 | **0回** | **100%削減** |

### 定性的改善

| 項目 | 現状 | 改善後 |
|------|------|--------|
| 初見での理解 | 「何ができるか分からない」 | **「絵を描くツールだ」と即座に理解** |
| 操作の迷い | 「どこから始めればいいか分からない」 | **「テーマを入力すればいい」と明確** |
| モバイル体験 | 「スクロールが多くて疲れる」 | **「スクロール少なく快適」** |
| チャット体験 | 「絵が見えなくなる」 | **「絵を見ながら会話できる」** |

---

## 実装の優先順位

### Phase 1: レイアウト変更（1時間）

**目標**: スクロールなしで全体が見えるようにする

1. **ヘッダーをコンパクト化**
   - 高さを12（48px）に圧縮
   - サブタイトル削除
   - 巨匠バトルボタンをハンバーガーメニューに格納

2. **3カラムレイアウトに変更**
   - 左カラム（w-80）: 入力エリア
   - 中央カラム（flex-1）: 出力エリア
   - 右カラム（w-96）: チャットエリア

3. **巨匠ボタンを2行×4列に圧縮**
   - grid-cols-4 gap-2
   - aspect-square
   - 名前・スタイル表示を削除

4. **枠を常に表示**
   - Canvas: border-2 border-dashed
   - コメント: border-2
   - チャット: border-2

**成功条件**:
- ✅ スクロールなしで全体が見える
- ✅ テーマ入力が最上部に配置
- ✅ 巨匠選択がコンパクト

---

### Phase 2: スクロール実装（30分）

**目標**: 絵を見ながら会話できるようにする

1. **右カラムに sticky top-0 を適用**
   ```tsx
   <div className="w-96 p-4 h-screen sticky top-0">
   ```

2. **チャット内容に ScrollArea を適用**
   ```tsx
   <ScrollArea className="h-full px-6">
     <ChatInterface />
   </ScrollArea>
   ```

3. **レスポンシブ対応の確認**
   - デスクトップ: 3カラム
   - タブレット: 2カラム + 下部チャット
   - モバイル: 縦積み

**成功条件**:
- ✅ 中央の絵が常に見える
- ✅ チャットがスクロール可能
- ✅ レスポンシブ対応

---

### Phase 3: 細部調整（30分）

**目標**: 細部を磨き込む

1. **ホバー時に巨匠名を表示**
   ```tsx
   <Tooltip>
     <TooltipTrigger>
       <button>{/* 巨匠アバター */}</button>
     </TooltipTrigger>
     <TooltipContent>
       <p>{artist.name}</p>
       <p className="text-xs">{artist.style}</p>
     </TooltipContent>
   </Tooltip>
   ```

2. **プレースホルダーテキストの調整**
   - より具体的な例を追加
   - 文字数制限の明示

3. **スクロールバーのスタイリング**
   - ScrollArea のカスタマイズ
   - スムーズなスクロール

**成功条件**:
- ✅ ホバーで巨匠情報が表示
- ✅ プレースホルダーが分かりやすい
- ✅ スクロールが快適

---

## 技術的な実装詳細

### 必要なコンポーネント

#### 既存コンポーネント（修正）

1. **page.tsx**
   - 3カラムレイアウトに変更
   - ヘッダーをコンパクト化

2. **ArtistSelector.tsx**
   - 2行×4列に変更
   - 名前・スタイル表示を削除
   - ホバー時にTooltip表示

3. **ThemeInput.tsx**
   - ラベルを簡潔に
   - rows を 4 に設定

4. **GeneratorCanvas.tsx**
   - 常に枠を表示
   - プレースホルダーを追加

5. **ArtworkDescription.tsx**
   - 常に枠を表示
   - ローディング状態を追加

6. **ChatInterface.tsx**
   - ScrollArea でラップ
   - 高さを親要素に合わせる

#### 新規コンポーネント（不要）

- 既存コンポーネントの修正のみで実装可能

### 必要なライブラリ

#### 既にインストール済み

- `@radix-ui/react-scroll-area` (shadcn/ui)
- `@radix-ui/react-dropdown-menu` (shadcn/ui)
- `@radix-ui/react-tooltip` (shadcn/ui)
- `lucide-react` (アイコン)

#### 追加インストール不要

- 全て既存のライブラリで実装可能

---

## テスト計画

### ユーザビリティテスト

#### 1. 初見理解テスト（5秒ルール）

**質問**: 「このサイトは何ができるサイトですか？」

**成功条件**:
- 90%以上が「絵を描くテーマを入力するサイト」と答えられる
- 95%以上が「巨匠の画風で絵を生成できる」と理解できる

#### 2. タスク完了テスト

**タスク**: 「夕暮れの富士山」をテーマに絵を生成してください

**成功条件**:
- 平均完了時間: 30秒以内
- エラー率: 5%以下
- スクロール回数: 0回

#### 3. チャット体験テスト

**タスク**: 生成した絵について巨匠と3往復会話してください

**成功条件**:
- 絵が常に見える状態で会話できる
- スクロールがスムーズ
- 会話履歴を振り返りやすい

### 技術テスト

#### 1. レスポンシブテスト

**デバイス**:
- デスクトップ（1920×1080）
- タブレット（768×1024）
- モバイル（375×667）

**成功条件**:
- 全デバイスで適切にレイアウト
- スクロールが自然
- タップ領域が十分

#### 2. パフォーマンステスト

**指標**:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

**成功条件**:
- FCP < 1.8秒
- LCP < 2.5秒
- CLS < 0.1

#### 3. アクセシビリティテスト

**ツール**: Lighthouse, axe DevTools

**成功条件**:
- Lighthouse Accessibility Score > 95
- キーボード操作可能
- スクリーンリーダー対応

---

## リスクと対策

### リスク1: 3カラムが狭く感じる

**対策**:
- 最小幅を設定（min-w-0）
- レスポンシブで2カラムに切り替え
- ユーザーテストで検証

### リスク2: スクロールが複雑になる

**対策**:
- sticky を適切に使用
- ScrollArea で明示的にスクロール領域を定義
- スクロールバーを視覚化

### リスク3: モバイルで縦に長くなる

**対策**:
- タブ切り替えを検討
- アコーディオンで折りたたみ
- 優先度の低い要素を非表示

---

## 将来の拡張性

### 画像書き直し機能（Phase 8）

**実装方法**:
- チャット内で「この部分を変更して」と指示
- 新しい画像を生成
- 中央カラムの Canvas を更新
- チャット履歴に反映

**必要な変更**:
- ChatInterface に画像更新コールバックを追加（既に実装済み）
- 画像生成APIの呼び出し
- ローディング状態の管理

### 複数画像の比較機能（Phase 9）

**実装方法**:
- 中央カラムにタブを追加
- 生成履歴を保存
- タブで切り替え

**必要な変更**:
- 画像履歴の状態管理
- タブUIの追加
- ストレージの実装

### コラボレーション機能（Phase 10）

**実装方法**:
- 右カラムに共有ボタンを追加
- URLで作品を共有
- コメント機能

**必要な変更**:
- バックエンドAPI
- 認証機能
- データベース

---

## まとめ

### 改善のポイント

1. **ヘッダーをコンパクト化**
   - 200px → 48px（75%削減）

2. **3カラムレイアウト**
   - 情報の優先順位が明確
   - スクロール最小化

3. **巨匠ボタンを圧縮**
   - 2行×4列
   - 名前削除

4. **常に枠を表示**
   - 予測可能なUI
   - 期待値の明示

5. **絵を見ながら会話**
   - sticky + ScrollArea
   - 自然な視線の流れ

### 期待される効果

- ✅ 初見での理解時間: 10-15秒 → **3秒**
- ✅ 直帰率: 60% → **30%**
- ✅ タスク完了時間: 60秒 → **30秒**
- ✅ スクロール量: 3-4画面分 → **1-2画面分**

### 次のステップ

1. この設計書をレビュー
2. Codeモードで実装開始
3. Phase 1（1時間）から着手
4. ユーザビリティテストで検証
5.