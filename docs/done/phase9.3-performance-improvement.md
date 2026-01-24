# Phase 9.3: パフォーマンス改善 - 設計書

**作成日**: 2026-01-07  
**ステータス**: 設計完了  
**見積もり**: 4-5時間  
**優先度**: 高（ユーザー体験の改善）

## 1. 問題の概要

### 現状の問題

**処理時間**: 画像生成に約35秒かかる
**原因**: すべての処理がシーケンシャル（直列）実行されている

### 現在の処理フロー

```
ユーザーが「変換」ボタンをクリック
  ↓
1. テーマ解釈（interpretTheme）         ← 約2秒（Gemini API呼び出し）
  ↓
2. プロンプト生成（generatePrompt）     ← 約0.1秒（同期処理）
  ↓
3. 画像生成（callGeminiApi）            ← 約30秒（Gemini API呼び出し）
  ↓
4. 解説生成（generateArtistComment）    ← 約3秒（Gemini API呼び出し）
  ↓
完了（合計: 約35秒）
```

### ボトルネック

1. **解説生成の待機**: [`page.tsx:117-130`](../../src/app/page.tsx:117-130)
   - 画像生成完了後に解説生成を開始
   - 3秒のムダな待機時間

2. **テーマ解釈の待機**: [`actions.ts:57`](../../src/app/actions.ts:57)
   - テーマ解釈完了を待ってから画像生成
   - 2秒のムダな待機時間

3. **プログレス表示の欠如**
   - 35秒間ローディング画面のみ
   - ユーザーは進捗が分からない

## 2. 改善案

### 改善案1: 解説生成の並列化（即効性: 高）

**現在**: 画像生成 → 解説生成（直列）  
**改善後**: 画像生成 || 解説生成（並列）

```typescript
// page.tsx の handleTransform を修正
const [imageResult, commentResult] = await Promise.allSettled([
  // 画像生成
  uploadedImage 
    ? uploadAndTransformAction(uploadedImage, selectedArtistId, theme.trim() || undefined)
    : generateArtworkAction(selectedArtistId, theme),
  
  // 解説生成（並列実行）
  generateArtistCommentAction(selectedArtistId, theme || "この作品")
]);
```

**効果**: 約3秒短縮（35秒 → 32秒）

---

### 改善案2: テーマ解釈の非同期化（即効性: 中）

**現在**: テーマ解釈 → プロンプト生成 → 画像生成（直列）  
**改善後**: テーマ解釈を画像生成と並列化

**問題**: テーマ解釈の結果がプロンプト生成に必要  
**解決策**: テーマ解釈をオプショナルにし、失敗時はフォールバック

```typescript
// actions.ts の generateArtworkAction を修正
export async function generateArtworkAction(
  artistId: string,
  theme: string
): Promise<GenerateResult> {
  const artist = artists.find((a) => a.id === artistId);
  if (!artist) throw new Error("Artist not found");

  // テーマ解釈と画像生成を並列化
  const [interpretationResult, imageResult] = await Promise.allSettled([
    interpretTheme(theme, artist),
    (async () => {
      // 簡易プロンプトで先行生成
      const quickPrompt = await generatePrompt(artistId, theme);
      const negativePrompt = getNegativePrompt(artistId);
      return callGeminiApi(MODEL_NAME_IMAGE, {
        contents: [{ role: "user", parts: [{ text: quickPrompt + (negativePrompt ? `\n\nAvoid: ${negativePrompt}` : "") }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
          candidateCount: 1
        }
      });
    })()
  ]);

  // 解釈結果を取得（失敗時はフォールバック）
  const interpretation = interpretationResult.status === 'fulfilled' 
    ? interpretationResult.value 
    : { elements: theme, mood: "artistic expression" };

  // 画像結果を処理
  if (imageResult.status === 'rejected') {
    throw imageResult.reason;
  }
  
  // ... 残りの処理
}
```

**効果**: 約2秒短縮（32秒 → 30秒）

---

### 改善案3: プログレッシブレンダリング（UX改善）

**現在**: 35秒間ローディング画面のみ  
**改善後**: 段階的に情報を表示

```typescript
// page.tsx に進捗状態を追加
const [progress, setProgress] = useState({
  interpretation: false,
  imageGeneration: false,
  comment: false
});

// 各処理完了時に更新
interpretTheme(...).then(() => setProgress(p => ({ ...p, interpretation: true })));
generateImage(...).then(() => setProgress(p => ({ ...p, imageGeneration: true })));
generateComment(...).then(() => setProgress(p => ({ ...p, comment: true })));
```

**UI表示**:
```
✓ テーマを解釈中... (2秒)
✓ 画像を生成中... (30秒) ← 現在ここ
⏳ 解説を生成中... (3秒)
```

**効果**: 体感速度の向上（実時間は変わらないが、ユーザーは進捗を確認できる）

---

### 改善案4: キャッシング（長期的改善）

**対象**: 
- テーマ解釈結果（同じテーマは再利用）
- 巨匠の解説テンプレート

```typescript
// lib/cache.ts（新規）
const interpretationCache = new Map<string, ThemeInterpretation>();

export async function interpretThemeWithCache(
  theme: string,
  artist: Artist
): Promise<ThemeInterpretation> {
  const cacheKey = `${theme}_${artist.id}`;
  
  if (interpretationCache.has(cacheKey)) {
    return interpretationCache.get(cacheKey)!;
  }
  
  const result = await interpretTheme(theme, artist);
  interpretationCache.set(cacheKey, result);
  return result;
}
```

**効果**: 2回目以降のテーマ解釈が即座に完了（2秒 → 0秒）

## 3. 改善効果まとめ

| 改善案 | 実装難易度 | 効果 | 短縮時間 |
|--------|-----------|------|---------|
| 1. 解説生成の並列化 | 低 | 高 | -3秒 |
| 2. テーマ解釈の非同期化 | 中 | 中 | -2秒 |
| 3. プログレッシブレンダリング | 低 | UX改善 | 体感速度向上 |
| 4. キャッシング | 中 | 長期的 | -2秒（2回目以降） |

**合計効果**: 35秒 → 30秒（約14%短縮）

## 4. 実装計画

### Phase 1: クイックウィン（1時間）

**目標**: 即座に3秒短縮

#### Step 1.1: page.tsx の handleTransform を修正（30分）

**修正ファイル**: [`src/app/page.tsx:62-140`](../../src/app/page.tsx:62-140)

**変更内容**:

```typescript
const handleTransform = async () => {
  if (!selectedArtistId) {
    toast.error("巨匠を選択してください");
    return;
  }

  setIsGenerating(true);
  setIsGeneratingComment(true); // 解説生成も開始
  setGeneratedComment(null);

  try {
    // 画像生成と解説生成を並列実行
    const [imageResult, commentResult] = await Promise.allSettled([
      // 画像生成
      uploadedImage 
        ? uploadAndTransformAction(
            uploadedImage,
            selectedArtistId,
            theme.trim() || undefined
          )
        : generateArtworkAction(selectedArtistId, theme),
      
      // 解説生成（並列実行）
      generateArtistCommentAction(
        selectedArtistId,
        theme || "この作品"
      )
    ]);
    
    // 画像生成結果の処理
    if (imageResult.status === 'fulfilled' && imageResult.value.success) {
      const result = imageResult.value;
      
      if (result.imageUrl && result.metadata) {
        const newArtwork: Artwork = {
          id: Date.now().toString(),
          imageUrl: result.imageUrl,
          artistId: selectedArtistId,
          theme: theme || undefined,
          instruction: uploadedImage && theme ? theme : undefined,
          createdAt: Date.now(),
          source: uploadedImage ? "uploaded" : "generated",
        };
        setCurrentArtwork(newArtwork);

        // メタデータを保存
        const fullMetadata: GenerationMetadata = {
          ...result.metadata,
          timestamp: Date.now(),
          imageUrl: result.imageUrl,
          artistId: selectedArtistId,
          artistName: selectedArtist?.name || "Unknown",
          userTheme: theme || (uploadedImage ? "Uploaded image transformation" : ""),
        };
        saveGenerationMetadata(fullMetadata);
        setCurrentMetadata(fullMetadata);

        toast.success("作品が完成しました！");
      }
    } else {
      const error = imageResult.status === 'rejected' 
        ? imageResult.reason 
        : imageResult.value.error;
      toast.error(error || "生成に失敗しました");
    }
    
    // 解説生成結果の処理
    if (commentResult.status === 'fulfilled' && commentResult.value.success) {
      setGeneratedComment(commentResult.value.comment || "");
    } else {
      console.error("Failed to generate comment:", 
        commentResult.status === 'rejected' 
          ? commentResult.reason 
          : commentResult.value.error
      );
    }
    
  } catch (error) {
    console.error(error);
    toast.error("予期せぬエラーが発生しました");
  } finally {
    setIsGenerating(false);
    setIsGeneratingComment(false);
  }
};
```

#### Step 1.2: handleRemix を修正（30分）

**修正ファイル**: [`src/app/page.tsx:143-210`](../../src/app/page.tsx:143-210)

**変更内容**: handleTransform と同様の並列化を適用

```typescript
const handleRemix = async () => {
  if (!currentArtwork || !selectedArtistId) return;

  setIsGenerating(true);
  setIsGeneratingComment(true); // 解説生成も開始
  setGeneratedComment(null);

  try {
    // リミックスと解説生成を並列実行
    const [remixResult, commentResult] = await Promise.allSettled([
      // リミックス
      remixArtworkAction(
        currentArtwork.artistId,
        selectedArtistId,
        currentArtwork.imageUrl,
        theme.trim() || undefined
      ),
      
      // 解説生成（並列実行）
      generateArtistCommentAction(
        selectedArtistId,
        currentArtwork.theme || "この作品"
      )
    ]);

    // リミックス結果の処理
    if (remixResult.status === 'fulfilled' && remixResult.value.success) {
      const result = remixResult.value;
      
      if (result.imageUrl && result.metadata) {
        const newArtwork: Artwork = {
          id: Date.now().toString(),
          imageUrl: result.imageUrl,
          artistId: selectedArtistId,
          theme: currentArtwork.theme,
          instruction: theme.trim() || undefined,
          createdAt: Date.now(),
          source: "remixed",
        };
        setCurrentArtwork(newArtwork);

        // メタデータを保存
        const fullMetadata: GenerationMetadata = {
          ...result.metadata,
          timestamp: Date.now(),
          imageUrl: result.imageUrl,
          artistId: selectedArtistId,
          artistName: selectedArtist?.name || "Unknown",
          userTheme: currentArtwork.theme || "Remix",
          isModification: true,
          modificationInstruction: theme.trim() || undefined,
          parentId: currentMetadata?.id,
        };
        saveGenerationMetadata(fullMetadata);
        setCurrentMetadata(fullMetadata);

        toast.success("リミックスが完成しました！");
      }
    } else {
      const error = remixResult.status === 'rejected' 
        ? remixResult.reason 
        : remixResult.value.error;
      toast.error(error || "リミックスに失敗しました");
    }
    
    // 解説生成結果の処理
    if (commentResult.status === 'fulfilled' && commentResult.value.success) {
      setGeneratedComment(commentResult.value.comment || "");
    } else {
      console.error("Failed to generate comment:", 
        commentResult.status === 'rejected' 
          ? commentResult.reason 
          : commentResult.value.error
      );
    }
    
  } catch (error) {
    console.error(error);
    toast.error("予期せぬエラーが発生しました");
  } finally {
    setIsGenerating(false);
    setIsGeneratingComment(false);
  }
};
```

---

### Phase 2: UX改善（1時間）

**目標**: 体感速度の向上

#### Step 2.1: 進捗状態の追加（30分）

**修正ファイル**: [`src/app/page.tsx`](../../src/app/page.tsx)

```typescript
// 進捗状態を追加
const [progress, setProgress] = useState({
  interpretation: false,
  imageGeneration: false,
  comment: false
});

// handleTransform 内で進捗を更新
const handleTransform = async () => {
  // ... 既存のコード
  
  setProgress({ interpretation: false, imageGeneration: false, comment: false });
  
  try {
    // テーマ解釈完了時
    setProgress(p => ({ ...p, interpretation: true }));
    
    // 画像生成と解説生成を並列実行
    const [imageResult, commentResult] = await Promise.allSettled([
      generateArtworkAction(selectedArtistId, theme).then(result => {
        setProgress(p => ({ ...p, imageGeneration: true }));
        return result;
      }),
      generateArtistCommentAction(selectedArtistId, theme).then(result => {
        setProgress(p => ({ ...p, comment: true }));
        return result;
      })
    ]);
    
    // ... 残りのコード
  }
};
```

#### Step 2.2: LoadingOverlay の改善（30分）

**修正ファイル**: [`src/components/LoadingOverlay.tsx`](../../src/components/LoadingOverlay.tsx)

```typescript
interface LoadingOverlayProps {
  isLoading: boolean;
  artist: Artist | null;
  progress?: {
    interpretation: boolean;
    imageGeneration: boolean;
    comment: boolean;
  };
}

export function LoadingOverlay({ isLoading, artist, progress }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-96">
        <CardContent className="pt-6">
          {/* アーティストアバター */}
          {artist && (
            <div className="flex flex-col items-center gap-4 mb-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={artist.avatar} alt={artist.name} />
                <AvatarFallback>{artist.name[0]}</AvatarFallback>
              </Avatar>
              <p className="text-lg font-semibold">{artist.name}</p>
            </div>
          )}

          {/* 進捗表示 */}
          {progress && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                {progress.interpretation ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span className="text-sm">テーマを解釈中...</span>
              </div>
              
              <div className="flex items-center gap-2">
                {progress.imageGeneration ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span className="text-sm">画像を生成中...</span>
              </div>
              
              <div className="flex items-center gap-2">
                {progress.comment ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span className="text-sm">解説を生成中...</span>
              </div>
            </div>
          )}

          {/* プログレスバー */}
          <Progress value={calculateProgress(progress)} className="w-full" />
          
          {/* 待機メッセージ */}
          <p className="text-center text-sm text-muted-foreground mt-4">
            {artist?.loadingMessage || "制作中..."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function calculateProgress(progress?: { interpretation: boolean; imageGeneration: boolean; comment: boolean }): number {
  if (!progress) return 0;
  const completed = [progress.interpretation, progress.imageGeneration, progress.comment].filter(Boolean).length;
  return (completed / 3) * 100;
}
```

---

### Phase 3: 構造改善（2-3時間）

**目標**: さらに2秒短縮 + 長期的な改善

#### Step 3.1: テーマ解釈の非同期化（1.5時間）

**修正ファイル**: [`src/app/actions.ts:46-127`](../../src/app/actions.ts:46-127)

**変更内容**: 改善案2の実装

#### Step 3.2: キャッシング機能の実装（1.5時間）

**新規ファイル**: [`src/lib/cache.ts`](../../src/lib/cache.ts)

```typescript
import { ThemeInterpretation } from "./theme-interpreter";
import { Artist } from "./artists";

// メモリキャッシュ（セッション内のみ有効）
const interpretationCache = new Map<string, ThemeInterpretation>();

/**
 * キャッシュキーを生成
 */
function getCacheKey(theme: string, artistId: string): string {
  return `${theme.toLowerCase().trim()}_${artistId}`;
}

/**
 * テーマ解釈結果をキャッシュから取得
 */
export function getCachedInterpretation(
  theme: string,
  artistId: string
): ThemeInterpretation | null {
  const key = getCacheKey(theme, artistId);
  return interpretationCache.get(key) || null;
}

/**
 * テーマ解釈結果をキャッシュに保存
 */
export function setCachedInterpretation(
  theme: string,
  artistId: string,
  interpretation: ThemeInterpretation
): void {
  const key = getCacheKey(theme, artistId);
  interpretationCache.set(key, interpretation);
  
  // キャッシュサイズ制限（最大100件）
  if (interpretationCache.size > 100) {
    const firstKey = interpretationCache.keys().next().value;
    interpretationCache.delete(firstKey);
  }
}

/**
 * キャッシュをクリア
 */
export function clearInterpretationCache(): void {
  interpretationCache.clear();
}

/**
 * キャッシュ統計を取得
 */
export function getInterpretationCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: interpretationCache.size,
    keys: Array.from(interpretationCache.keys()),
  };
}
```

**theme-interpreter.ts の修正**:

```typescript
import { getCachedInterpretation, setCachedInterpretation } from "./cache";

export async function interpretTheme(
  theme: string,
  artist: Artist
): Promise<ThemeInterpretation> {
  // キャッシュチェック
  const cached = getCachedInterpretation(theme, artist.id);
  if (cached) {
    console.log("Using cached interpretation:", cached);
    return cached;
  }
  
  try {
    // ... 既存の解釈ロジック
    
    const interpretation: ThemeInterpretation = JSON.parse(jsonMatch[0]);
    
    // キャッシュに保存
    setCachedInterpretation(theme, artist.id, interpretation);
    
    return interpretation;
  } catch (error) {
    // ... エラーハンドリング
  }
}
```

## 5. テスト計画

### Phase 1のテスト（30分）

#### テスト1: 並列実行の確認
1. 画像生成を開始
2. ブラウザの開発者ツールでネットワークタブを確認
3. 画像生成APIと解説生成APIが同時に呼ばれることを確認

#### テスト2: エラーハンドリング
1. 画像生成が失敗した場合
2. 解説生成が失敗した場合
3. 両方が失敗した場合

#### テスト3: 処理時間の測定
1. 改善前の処理時間を測定
2. 改善後の処理時間を測定
3. 約3秒短縮されることを確認

### Phase 2のテスト（30分）

#### テスト4: 進捗表示の確認
1. 各ステップで進捗が更新されることを確認
2. プログレスバーが正しく動作することを確認

### Phase 3のテスト（1時間）

#### テスト5: キャッシュの動作確認
1. 同じテーマで2回生成
2. 2回目がキャッシュから取得されることを確認
3. キャッシュサイズ制限が動作することを確認

## 6. 成功基準

- [ ] 画像生成と解説生成が並列実行される
- [ ] 総処理時間が30秒以下になる（Phase 1完了時）
- [ ] 進捗表示が正しく動作する（Phase 2完了時）
- [ ] キャッシュが正しく動作する（Phase 3完了時）
- [ ] エラーハンドリングが正常に動作する
- [ ] 既存の機能が正常に動作する

## 7. リスク評価

### 中リスク
- Promise.allSettled のエラーハンドリング
- 並列実行時の状態管理

### 対策
- 段階的な実装とテスト
- エラーハンドリングの徹底
- ロールバック計画の準備

## 8. ロールバック計画

各Phaseで問題が発生した場合、以下の手順でロールバック：

1. Gitで前のコミットに戻す
2. 問題を分析
3. 修正後に再実装

---

**実装担当**: Code モード  
**レビュー担当**: Architect モード  
**承認**: Toshio Ueda
