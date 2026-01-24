# 並列処理改修計画

**作成日**: 2026-01-08  
**対象**: tools/master-piece  
**目的**: 画像生成とコメント生成の真の並列実行を実現し、体感速度を向上させる

---

## 1. 現状の問題点

### 1.1 UI更新のタイミング問題（主要課題）

**現象**: 
- APIリクエストは並列に実行されているが、結果の画面表示が「両方完了後」に一括で行われる
- ユーザーには「シーケンシャル処理」に見える

**原因箇所**: `src/app/page.tsx` の `handleTransform` および `handleRemix`

```typescript
// 現在の実装（問題あり）
const [imageResult, commentResult] = await Promise.allSettled([
  // 画像生成（重い処理：約30秒）
  generateArtworkAction(...),
  // コメント生成（軽い処理：約3秒）
  generateArtistCommentAction(...)
]);

// ★ここで両方の完了を待ってしまう
// コメントが3秒で完了しても、画像の30秒を待たないと表示されない

if (imageResult.status === 'fulfilled') {
  setCurrentArtwork(...);  // 画像を表示
}
if (commentResult.status === 'fulfilled') {
  setGeneratedComment(...);  // コメントを表示
}
```

**影響**:
- コメント生成が3秒で完了しても、画像生成の30秒を待たないと表示されない
- ユーザーは「何も起きていない」と感じる
- 体感速度が大幅に悪化

### 1.2 重複処理によるパフォーマンス劣化（副次的課題）

**現象**:
- `interpretTheme` が2回呼ばれている
- 1回あたり約2-3秒かかるため、合計4-6秒の無駄

**原因箇所**: `src/app/actions.ts` の `generateArtworkAction`

```typescript
// actions.ts の generateArtworkAction 内
const interpretation = await interpretTheme(theme, artist);  // 1回目

const prompt = await generatePrompt(artistId, theme);  // この中で2回目
```

```typescript
// lib/prompt.ts の generatePrompt 内
export async function generatePrompt(artistId: string, theme: string) {
  const interpretation = await interpretTheme(theme, artist);  // 2回目（重複）
  return buildStructuredPrompt(artist, interpretation);
}
```

**影響**:
- 画像生成時間が4-6秒余計にかかる
- APIコストの無駄

---

## 2. 修正方針

### 2.1 UI更新の即時反映（優先度：高）

**目標**: 各処理が完了次第、即座に画面に反映する

**アプローチ**:
1. `Promise.allSettled` で待つのをやめる
2. 各非同期処理の `.then()` 内で直接State更新を行う
3. エラーハンドリングは `.catch()` で個別に処理

**期待効果**:
- コメントが3秒で表示される（現在は30秒待ち）
- 体感速度が**約27秒改善**
- ユーザーは「何かが起きている」と感じられる

### 2.2 重複処理の削除（優先度：中）

**目標**: `interpretTheme` の呼び出しを1回に統一

**アプローチ**:
1. `generatePrompt` の引数に `interpretation` を追加
2. `generateArtworkAction` で1回だけ `interpretTheme` を呼び出し
3. その結果を `generatePrompt` に渡す

**期待効果**:
- 画像生成時間が4-6秒短縮
- APIコストの削減

---

## 3. 具体的な実装計画

### Phase 1: UI更新の即時反映（優先）

#### 3.1 `handleTransform` の修正

**ファイル**: `src/app/page.tsx`

**修正前**:
```typescript
const handleTransform = async () => {
  setIsGenerating(true);
  setIsGeneratingComment(true);
  setGeneratedComment(null);
  setProgress({ imageGeneration: false, comment: false });

  try {
    const [imageResult, commentResult] = await Promise.allSettled([
      // 画像生成
      (uploadedImage ? uploadAndTransformAction(...) : generateArtworkAction(...))
        .then(result => {
          setProgress(p => ({ ...p, imageGeneration: true }));
          return result;
        }),
      // コメント生成
      generateArtistCommentAction(...)
        .then(result => {
          setProgress(p => ({ ...p, comment: true }));
          return result;
        })
    ]);
    
    // 画像結果の処理
    if (imageResult.status === 'fulfilled' && imageResult.value.success) {
      setCurrentArtwork(...);
      await saveGenerationMetadata(...);
    }
    
    // コメント結果の処理
    if (commentResult.status === 'fulfilled' && commentResult.value.success) {
      setGeneratedComment(commentResult.value.comment || "");
    }
  } catch (error) {
    toast.error("予期せぬエラーが発生しました");
  } finally {
    setIsGenerating(false);
    setIsGeneratingComment(false);
  }
};
```

**修正後**:
```typescript
const handleTransform = async () => {
  if (!selectedArtistId) {
    toast.error("巨匠を選択してください");
    return;
  }

  // 初期化
  setIsGenerating(true);
  setIsGeneratingComment(true);
  setGeneratedComment(null);
  setProgress({ imageGeneration: false, comment: false });

  // 画像生成（非同期で開始、完了次第State更新）
  const imagePromise = (uploadedImage
    ? uploadAndTransformAction(uploadedImage, selectedArtistId, theme.trim() || undefined)
    : theme.trim()
    ? generateArtworkAction(selectedArtistId, theme)
    : Promise.reject(new Error("画像をアップロードするか、テーマを入力してください"))
  )
    .then(async (result) => {
      setProgress(p => ({ ...p, imageGeneration: true }));
      
      if (result.success && result.imageUrl && result.metadata) {
        const newArtwork: Artwork = {
          id: Date.now().toString(),
          imageUrl: result.imageUrl,
          artistId: selectedArtistId,
          theme: theme || undefined,
          instruction: uploadedImage && theme ? theme : undefined,
          createdAt: Date.now(),
          source: uploadedImage ? "uploaded" : "generated",
        };
        
        // ★即座に画像を表示
        setCurrentArtwork(newArtwork);

        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullMetadata: GenerationMetadata = {
          ...result.metadata,
          timestamp: Date.now(),
          imageId,
          artistId: selectedArtistId,
          artistName: selectedArtist?.name || "Unknown",
          userTheme: theme || (uploadedImage ? "Uploaded image transformation" : ""),
        };
        
        await saveGenerationMetadata(fullMetadata, result.imageUrl);
        setCurrentMetadata(fullMetadata);
        
        toast.success("作品が完成しました！");
      } else {
        toast.error(result.error || "生成に失敗しました");
      }
    })
    .catch((error) => {
      console.error("Image generation error:", error);
      toast.error(error?.message || "画像生成に失敗しました");
    })
    .finally(() => {
      setIsGenerating(false);
    });

  // コメント生成（非同期で開始、完了次第State更新）
  const commentPromise = generateArtistCommentAction(
    selectedArtistId,
    theme || "この作品"
  )
    .then((result) => {
      setProgress(p => ({ ...p, comment: true }));
      
      if (result.success && result.comment) {
        // ★即座にコメントを表示
        setGeneratedComment(result.comment);
      } else {
        console.error("Failed to generate comment:", result.error);
      }
    })
    .catch((error) => {
      console.error("Comment generation error:", error);
    })
    .finally(() => {
      setIsGeneratingComment(false);
    });

  // エラーハンドリングのために両方の完了を監視（UI更新は待たない）
  Promise.allSettled([imagePromise, commentPromise]).catch((error) => {
    console.error("Unexpected error in parallel execution:", error);
  });
};
```

**変更点**:
1. `await Promise.allSettled` を削除
2. 各Promiseの `.then()` 内で直接State更新
3. `.finally()` でローディング状態を個別に解除
4. エラーハンドリングを `.catch()` で個別に実装

#### 3.2 `handleRemix` の修正

**同様のパターンで修正**:
- `await Promise.allSettled` を削除
- 各処理の完了次第、即座にState更新
- エラーハンドリングを個別化

### Phase 2: 重複処理の削除

#### 3.3 `generatePrompt` の引数変更

**ファイル**: `src/lib/prompt.ts`

**修正前**:
```typescript
export async function generatePrompt(
  artistId: string,
  theme: string
): Promise<string> {
  const artist = artists.find((a) => a.id === artistId);
  if (!artist) {
    throw new Error(`Artist with id ${artistId} not found`);
  }

  // LLMで意味解釈（重複呼び出し）
  const interpretation = await interpretTheme(theme, artist);

  return buildStructuredPrompt(artist, interpretation);
}
```

**修正後**:
```typescript
export async function generatePrompt(
  artistId: string,
  theme: string,
  interpretation?: ThemeInterpretation  // ★オプショナル引数を追加
): Promise<string> {
  const artist = artists.find((a) => a.id === artistId);
  if (!artist) {
    throw new Error(`Artist with id ${artistId} not found`);
  }

  // interpretationが渡されていない場合のみ実行（後方互換性）
  const finalInterpretation = interpretation || await interpretTheme(theme, artist);

  return buildStructuredPrompt(artist, finalInterpretation);
}
```

#### 3.4 `generateArtworkAction` の修正

**ファイル**: `src/app/actions.ts`

**修正前**:
```typescript
export async function generateArtworkAction(
  artistId: string,
  theme: string
): Promise<GenerateResult> {
  try {
    const artist = artists.find((a) => a.id === artistId);
    if (!artist) {
      throw new Error("Artist not found");
    }

    // テーマ解釈を取得（1回目）
    const interpretation = await interpretTheme(theme, artist);
    
    // プロンプト生成（内部で2回目の interpretTheme が実行される）
    const prompt = await generatePrompt(artistId, theme);
    const negativePrompt = getNegativePrompt(artistId);
    
    // ... 以下省略
  }
}
```

**修正後**:
```typescript
export async function generateArtworkAction(
  artistId: string,
  theme: string
): Promise<GenerateResult> {
  try {
    const artist = artists.find((a) => a.id === artistId);
    if (!artist) {
      throw new Error("Artist not found");
    }

    // テーマ解釈を取得（1回のみ）
    const interpretation = await interpretTheme(theme, artist);
    
    // プロンプト生成（interpretationを渡すことで重複を回避）
    const prompt = await generatePrompt(artistId, theme, interpretation);
    const negativePrompt = getNegativePrompt(artistId);
    
    // ... 以下省略
  }
}
```

#### 3.5 その他のAction関数も同様に修正

以下の関数も同じパターンで修正:
- `uploadAndTransformAction`
- `remixArtworkAction`
- `modifyArtworkAction`

---

## 4. パフォーマンス改善効果

### 4.1 体感速度の改善

**現在の体験**:
```
0秒: ボタンクリック
↓
3秒: コメント生成完了（表示されない）
↓
30秒: 画像生成完了
↓
30秒: 画像とコメントが同時に表示
```

**改善後の体験**:
```
0秒: ボタンクリック
↓
3秒: コメント表示 ★27秒早い
↓
26秒: 画像表示（interpretTheme重複削除により4秒短縮）
```

**改善効果**:
- コメント表示: **27秒短縮**（30秒 → 3秒）
- 画像表示: **4秒短縮**（30秒 → 26秒）
- 合計体感速度: **約90%改善**

### 4.2 APIコストの削減

- `interpretTheme` の呼び出し: 2回 → 1回
- APIコスト: **50%削減**（この処理に関して）

---

## 5. リスク評価と対策

### 5.1 State更新の競合

**リスク**: 
- 画像とコメントが異なるタイミングで更新されるため、State競合の可能性

**対策**:
- React 19の自動バッチング機能により、State更新は安全
- 各Stateは独立しているため、競合リスクは低い

### 5.2 エラーハンドリングの複雑化

**リスク**:
- 個別のエラーハンドリングが必要になり、コードが複雑化

**対策**:
- `.catch()` で個別にエラーをキャッチ
- `toast.error()` でユーザーに通知
- 片方が失敗しても、もう片方は正常に動作

### 5.3 後方互換性

**リスク**:
- `generatePrompt` の引数変更により、既存コードが影響を受ける可能性

**対策**:
- `interpretation` をオプショナル引数にすることで後方互換性を維持
- 渡されない場合は従来通り `interpretTheme` を実行

---

## 6. テスト計画

### 6.1 機能テスト

1. **正常系**:
   - [ ] 画像生成のみ（テーマ入力）
   - [ ] 画像アップロード + 変換
   - [ ] リミックス機能
   - [ ] コメントが画像より先に表示されることを確認

2. **異常系**:
   - [ ] 画像生成失敗時、コメントは正常に表示されるか
   - [ ] コメント生成失敗時、画像は正常に表示されるか
   - [ ] 両方失敗時、適切なエラーメッセージが表示されるか

### 6.2 パフォーマンステスト

1. **体感速度**:
   - [ ] コメント表示までの時間を計測（目標: 3秒以内）
   - [ ] 画像表示までの時間を計測（目標: 26秒以内）

2. **API呼び出し回数**:
   - [ ] `interpretTheme` が1回のみ呼ばれることを確認
   - [ ] ネットワークタブで重複リクエストがないことを確認

---

## 7. 実装スケジュール

### Phase 1: UI更新の即時反映（優先度：高）

- **所要時間**: 2-3時間
- **ファイル**:
  - `src/app/page.tsx` (handleTransform, handleRemix)

### Phase 2: 重複処理の削除（優先度：中）

- **所要時間**: 1-2時間
- **ファイル**:
  - `src/lib/prompt.ts` (generatePrompt)
  - `src/app/actions.ts` (generateArtworkAction, uploadAndTransformAction, remixArtworkAction, modifyArtworkAction)

### Phase 3: テストと検証

- **所要時間**: 1時間
- **内容**: 機能テスト、パフォーマンステスト

**合計所要時間**: 4-6時間

---

## 8. 完了条件

- [ ] コメントが画像生成完了を待たずに表示される
- [ ] `interpretTheme` の重複呼び出しが解消される
- [ ] 全ての機能テストが通過する
- [ ] パフォーマンステストで目標値を達成する
- [ ] エラーハンドリングが適切に動作する
- [ ] ドキュメント（CHANGELOG.md）を更新する

---

## 9. 参考資料

- **関連ドキュメント**:
  - `tools/master-piece/docs/done/phase9.3-performance-improvement-phase1-2-completion.md`
  - `tools/master-piece/docs/architecture.md`

- **関連Issue**:
  - Phase 9.3で並列化を実装したが、UI更新タイミングの問題が残っていた

---

## 10. 備考

この改修により、ユーザー体験が大幅に向上します。特に「コメントが先に表示される」ことで、「何かが起きている」という安心感を与えることができます。

また、`interpretTheme` の重複削除により、APIコストとレスポンス時間の両方が改善されます。

**次のステップ**: この計画をもとに、Codeモードで実装を進めてください。
