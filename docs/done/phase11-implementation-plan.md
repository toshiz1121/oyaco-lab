# Phase 11.1: 履歴永続化の実装計画

## 📋 概要

Phase 10で実装したIndexedDBストレージを活用し、ページリロード後も履歴が残るようにする。

**目標**: ページリロード後も過去の生成画像が表示され、履歴ナビゲーションが正常に動作する。

## 🎯 実装タスク

### タスク1: GeneratorCanvasの履歴管理をimageIdベースに変更

**ファイル**: `src/components/GeneratorCanvas.tsx`

**変更内容**:

1. **型定義の追加**:
```typescript
interface HistoryItem {
  imageId: string;
  timestamp: number;
  metadataId: string; // GenerationMetadata.id
}
```

2. **ステートの変更**:
```typescript
// Before
const [history, setHistory] = useState<string[]>([]); // DataURL

// After
const [history, setHistory] = useState<HistoryItem[]>([]);
const [imageCache, setImageCache] = useState<Map<string, string>>(new Map()); // imageId → DataURL
```

3. **imageMetadataMapの削除**:
```typescript
// Before
const imageMetadataMap = new Map<string, GenerationMetadata>();

// After
// LocalStorageから直接取得するため不要
```

4. **ページロード時の履歴復元**:
```typescript
useEffect(() => {
  const loadHistory = async () => {
    const allMetadata = getGenerationHistory(); // 新しい順
    const historyItems: HistoryItem[] = allMetadata
      .filter(m => m.imageId) // imageIdがあるもののみ
      .map(m => ({
        imageId: m.imageId,
        timestamp: m.timestamp,
        metadataId: m.id,
      }));
    
    setHistory(historyItems);
    
    // 最新の画像をキャッシュに読み込み
    if (historyItems.length > 0) {
      const latestImageUrl = await getImage(historyItems[0].imageId);
      if (latestImageUrl) {
        setImageCache(new Map([[historyItems[0].imageId, latestImageUrl]]));
        setCurrentHistoryIndex(0);
      }
    }
  };
  
  loadHistory();
}, []); // 初回のみ実行
```

5. **新しい画像が生成されたときの履歴追加**:
```typescript
useEffect(() => {
  if (imageUrl && currentMetadata && !isLoading) {
    const newItem: HistoryItem = {
      imageId: currentMetadata.imageId,
      timestamp: currentMetadata.timestamp,
      metadataId: currentMetadata.id,
    };
    
    setHistory(prev => {
      // 重複チェック
      if (prev.length > 0 && prev[0].imageId === newItem.imageId) {
        return prev;
      }
      // 新しい画像を先頭に追加
      return [newItem, ...prev];
    });
    
    // キャッシュに追加
    setImageCache(prev => new Map(prev).set(currentMetadata.imageId, imageUrl));
    setCurrentHistoryIndex(0);
  }
}, [imageUrl, currentMetadata, isLoading]);
```

6. **履歴ナビゲーション時の画像読み込み**:
```typescript
useEffect(() => {
  const loadImageForCurrentIndex = async () => {
    if (history.length === 0 || currentHistoryIndex < 0) return;
    
    const currentItem = history[currentHistoryIndex];
    if (!currentItem) return;
    
    // キャッシュにあればそれを使用
    if (imageCache.has(currentItem.imageId)) {
      return;
    }
    
    // IndexedDBから読み込み
    const imageUrl = await getImage(currentItem.imageId);
    if (imageUrl) {
      setImageCache(prev => new Map(prev).set(currentItem.imageId, imageUrl));
    }
  };
  
  loadImageForCurrentIndex();
}, [currentHistoryIndex, history]);
```

7. **メタデータの取得**:
```typescript
useEffect(() => {
  const loadMetadataForCurrentIndex = () => {
    if (history.length === 0 || currentHistoryIndex < 0) return;
    
    const currentItem = history[currentHistoryIndex];
    if (!currentItem) return;
    
    // LocalStorageから取得
    const metadata = getGenerationMetadata(currentItem.metadataId);
    setDisplayMetadata(metadata);
    
    if (onMetadataChange) {
      onMetadataChange(metadata);
    }
  };
  
  loadMetadataForCurrentIndex();
}, [currentHistoryIndex, history, onMetadataChange]);
```

8. **表示用の画像URL取得**:
```typescript
const currentDisplayImage = history.length > 0 && currentHistoryIndex >= 0
  ? imageCache.get(history[currentHistoryIndex].imageId) || null
  : null;

const previousImage = currentHistoryIndex > 0
  ? imageCache.get(history[currentHistoryIndex - 1].imageId) || null
  : null;
```

### タスク2: page.tsxのhandleDownload修正

**ファイル**: `src/app/page.tsx`

**変更内容**:

```typescript
const handleDownload = () => {
  if (currentArtwork?.imageUrl && currentMetadata) {
    const link = document.createElement("a");
    link.href = currentArtwork.imageUrl;
    
    // メタデータからファイル名を生成
    const artistName = currentMetadata.artistName.replace(/\s+/g, '_');
    const theme = currentMetadata.userTheme.substring(0, 20).replace(/\s+/g, '_');
    const timestamp = new Date(currentMetadata.timestamp).toISOString().split('T')[0];
    
    link.download = `masterpiece-${artistName}-${theme}-${timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
```

### タスク3: PromptDetailsDialogの修正

**ファイル**: `src/components/PromptDetailsDialog.tsx`

**変更内容**:

現在の実装では `metadata` が `currentMetadata` を参照しているが、履歴ナビゲーション時には `displayMetadata` を参照する必要がある。

**GeneratorCanvas.tsx**:
```typescript
<PromptDetailsDialog
  open={showPromptDetails}
  onOpenChange={setShowPromptDetails}
  metadata={displayMetadata || null} // currentMetadata → displayMetadata
/>
```

### タスク4: エラーハンドリングの追加

**ファイル**: `src/components/GeneratorCanvas.tsx`

**変更内容**:

```typescript
const [loadError, setLoadError] = useState<string | null>(null);

// 画像読み込み時のエラーハンドリング
useEffect(() => {
  const loadImageForCurrentIndex = async () => {
    if (history.length === 0 || currentHistoryIndex < 0) return;
    
    const currentItem = history[currentHistoryIndex];
    if (!currentItem) return;
    
    // キャッシュにあればそれを使用
    if (imageCache.has(currentItem.imageId)) {
      setLoadError(null);
      return;
    }
    
    try {
      // IndexedDBから読み込み
      const imageUrl = await getImage(currentItem.imageId);
      if (imageUrl) {
        setImageCache(prev => new Map(prev).set(currentItem.imageId, imageUrl));
        setLoadError(null);
      } else {
        setLoadError("画像が見つかりません");
      }
    } catch (error) {
      console.error("Failed to load image:", error);
      setLoadError("画像の読み込みに失敗しました");
    }
  };
  
  loadImageForCurrentIndex();
}, [currentHistoryIndex, history]);

// エラー表示
{loadError && (
  <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
    <p className="text-destructive text-sm">{loadError}</p>
  </div>
)}
```

## 📝 実装順序

1. ✅ **タスク1**: GeneratorCanvasの履歴管理をimageIdベースに変更
   - 型定義追加
   - ステート変更
   - ページロード時の履歴復元
   - 新しい画像の履歴追加
   - 履歴ナビゲーション時の画像読み込み
   - メタデータの取得
   - 表示用の画像URL取得

2. ✅ **タスク2**: page.tsxのhandleDownload修正

3. ✅ **タスク3**: PromptDetailsDialogの修正

4. ✅ **タスク4**: エラーハンドリングの追加

## 🧪 テストシナリオ

### シナリオ1: 基本的な履歴永続化

1. 画像を3枚生成する
2. ページをリロードする
3. **期待結果**: 最新の画像が表示される
4. 履歴ボタン（前）を2回クリックする
5. **期待結果**: 1枚目の画像が表示される

### シナリオ2: メタデータの取得

1. 画像を生成する
2. ページをリロードする
3. プロンプト詳細ボタンをクリックする
4. **期待結果**: プロンプト詳細が正しく表示される
5. 履歴ボタン（前）をクリックする
6. プロンプト詳細ボタンをクリックする
7. **期待結果**: 前の画像のプロンプト詳細が表示される

### シナリオ3: ダウンロード機能

1. 画像を生成する（テーマ: "夕焼けの海"、アーティスト: ゴッホ）
2. ダウンロードボタンをクリックする
3. **期待結果**: ファイル名が `masterpiece-ゴッホ-夕焼けの海-2026-01-08.jpg` のような形式

### シナリオ4: エラーハンドリング

1. 画像を生成する
2. ブラウザの開発者ツールでIndexedDBを削除する
3. ページをリロードする
4. **期待結果**: "画像が見つかりません" というエラーメッセージが表示される

### シナリオ5: 大量の履歴

1. 画像を10枚生成する
2. ページをリロードする
3. 履歴ボタンで前後に移動する
4. **期待結果**: スムーズに画像が切り替わる（キャッシュが効いている）

## 🚨 注意事項

### パフォーマンス

- **キャッシュサイズ**: 現在表示中の画像と前後1枚ずつをキャッシュ（合計3枚）
- **遅延読み込み**: 履歴ナビゲーション時に必要な画像のみ読み込む
- **メモリ管理**: 不要な画像はキャッシュから削除する（Phase 11.3で実装）

### 後方互換性

- **Phase 9.5以前のデータ**: `imageId` がない場合はスキップ
- **マイグレーション**: Phase 10のマイグレーションで `imageId` を追加済み

### エッジケース

1. **IndexedDBが利用不可**: LocalStorageフォールバックを使用（最新5件のみ）
2. **画像が見つからない**: エラーメッセージを表示
3. **メタデータが見つからない**: 部分的な情報を表示

## 📊 成功指標

- ✅ ページリロード後も履歴が表示される
- ✅ 履歴ナビゲーションが正常に動作する（前/次ボタン）
- ✅ プロンプト詳細が正しく表示される
- ✅ ダウンロード機能が正常に動作する（適切なファイル名）
- ✅ エラーハンドリングが適切に機能する

## 🔄 次のステップ

1. Codeモードに切り替えて実装開始
2. 各タスクを順番に実装
3. テストシナリオを実行
4. バグ修正
5. Phase 11.2（履歴UI改善）の設計開始

## 📚 参考資料

- [Phase 11設計書](./phase11-history-persistence-design.md)
- [Phase 10完了報告](../done/phase10-storage-improvement-completion.md)
- [image-storage.ts](../../src/lib/image-storage.ts)
- [generation-history.ts](../../src/lib/generation-history.ts)
