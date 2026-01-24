# Phase 11: 履歴永続化とナビゲーション改善

## 📋 問題の分析

### 問題1: 履歴をたどったとき画像ダウンロードやプロンプトが適切にたどれない

**根本原因**:
- [`GeneratorCanvas.tsx`](../src/components/GeneratorCanvas.tsx:27-28) で `imageMetadataMap` がメモリ上のMapとして定義されている
- ページリロード時にこのMapが消失する
- 履歴ナビゲーション時に、画像URLからメタデータを取得できない

**現在の実装**:
```typescript
// 画像URLとメタデータのマッピングを管理（メモリ上）
const imageMetadataMap = new Map<string, GenerationMetadata>();
```

**問題の詳細**:
1. 履歴ボタン（前/次）で画像を切り替えても、メタデータが取得できない
2. プロンプト詳細ボタンが機能しない（メタデータがnull）
3. ダウンロード時のファイル名が正しく生成されない

### 問題2: ページロード時に過去の履歴が消える（IndexedDBのメリットが活かせない）

**根本原因**:
- [`GeneratorCanvas.tsx`](../src/components/GeneratorCanvas.tsx:32) の `history` ステートがメモリ上のみ
- ページリロード時に履歴が消失する
- IndexedDBに画像は保存されているが、UIから参照する手段がない

**現在の実装**:
```typescript
const [history, setHistory] = useState<string[]>([]);
```

**問題の詳細**:
1. ページリロード後、過去の生成画像が表示されない
2. IndexedDBに100枚以上保存できるメリットが活かせない
3. ユーザーは過去の作品を見返せない

## 🎯 解決策の設計

### アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                        Page Component                        │
│  - 現在の作品のみ管理（currentArtwork, currentMetadata）      │
│  - 履歴管理はGeneratorCanvasに委譲                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    GeneratorCanvas Component                 │
│  - 履歴の読み込み・表示・ナビゲーション                        │
│  - IndexedDB + LocalStorageから履歴を復元                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer (既存)                       │
│  - IndexedDB: 画像データ（imageId → Blob）                   │
│  - LocalStorage: メタデータ（id → GenerationMetadata）       │
└─────────────────────────────────────────────────────────────┘
```

### 解決策1: メタデータの永続化と取得

**変更点**:
1. `imageMetadataMap` をメモリMapから永続化ストレージに変更
2. 画像URL（DataURL）の代わりに `imageId` をキーとして使用
3. LocalStorageから `getGenerationMetadata(id)` でメタデータを取得

**実装方針**:
```typescript
// Before: メモリ上のMap
const imageMetadataMap = new Map<string, GenerationMetadata>();

// After: LocalStorageから取得
function getMetadataByImageId(imageId: string): GenerationMetadata | null {
  return getGenerationMetadata(imageId);
}
```

### 解決策2: 履歴の永続化と復元

**変更点**:
1. `history` ステートを `imageId[]` に変更（DataURLではなくID）
2. ページロード時にLocalStorageから履歴を読み込み
3. 履歴表示時にIndexedDBから画像を取得

**実装方針**:
```typescript
// 履歴アイテムの型定義
interface HistoryItem {
  imageId: string;
  timestamp: number;
  artistId: string;
}

// ページロード時に履歴を復元
useEffect(() => {
  const loadHistory = async () => {
    const allMetadata = getGenerationHistory(); // LocalStorageから取得
    const historyItems = allMetadata.map(m => ({
      imageId: m.imageId,
      timestamp: m.timestamp,
      artistId: m.artistId,
    }));
    setHistory(historyItems);
  };
  loadHistory();
}, []);

// 画像表示時にIndexedDBから取得
const currentImageUrl = await getImage(history[currentHistoryIndex].imageId);
```

### 解決策3: 履歴UIの改善

**新機能**:
1. **履歴パネル**: 過去の生成画像をサムネイル表示
2. **フィルタリング**: アーティスト別、日付別で絞り込み
3. **検索**: テーマやプロンプトで検索

**UI設計**:
```
┌─────────────────────────────────────────────────────────────┐
│  Canvas                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │              現在の画像                                 │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [履歴を表示] ボタン                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ クリック
┌─────────────────────────────────────────────────────────────┐
│  履歴パネル（ダイアログ）                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ フィルタ: [全て▼] [日付▼] [検索: ___________]         │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │ │
│  │ │ 画像1│ │ 画像2│ │ 画像3│ │ 画像4│                 │ │
│  │ │ ゴッホ│ │ピカソ│ │モネ  │ │ダリ  │                 │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘                 │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │ │
│  │ │ 画像5│ │ 画像6│ │ 画像7│ │ 画像8│                 │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📝 実装計画

### Phase 11.1: 基本的な履歴永続化（P0）

**目標**: ページリロード後も履歴が残る

**タスク**:
1. ✅ `GeneratorCanvas.tsx` の `history` を `imageId[]` に変更
2. ✅ ページロード時にLocalStorageから履歴を読み込み
3. ✅ 履歴ナビゲーション時にIndexedDBから画像を取得
4. ✅ メタデータの取得を `getGenerationMetadata()` に変更
5. ✅ ダウンロード機能の修正（imageIdベース）

**影響範囲**:
- `src/components/GeneratorCanvas.tsx`
- `src/app/page.tsx` (handleDownload)

**期待される成果**:
- ページリロード後も過去の画像が表示される
- 履歴ナビゲーションが正常に動作する
- プロンプト詳細が正しく表示される

### Phase 11.2: 履歴UIの改善（P1）

**目標**: 過去の作品を見返しやすくする

**タスク**:
1. ⬜ 履歴パネルコンポーネントの作成
2. ⬜ サムネイル表示機能
3. ⬜ フィルタリング機能（アーティスト別、日付別）
4. ⬜ 検索機能（テーマ、プロンプト）
5. ⬜ 履歴からの読み込み機能

**新規ファイル**:
- `src/components/HistoryPanel.tsx`
- `src/components/HistoryThumbnail.tsx`

**期待される成果**:
- 過去の作品を一覧表示できる
- 特定の作品を素早く見つけられる
- 過去の作品を再編集できる

### Phase 11.3: パフォーマンス最適化（P2）

**目標**: 大量の履歴でも快適に動作

**タスク**:
1. ⬜ 仮想スクロール（react-window）の導入
2. ⬜ サムネイルの遅延読み込み
3. ⬜ IndexedDBクエリの最適化
4. ⬜ キャッシュ戦略の実装

**期待される成果**:
- 100枚以上の履歴でもスムーズに表示
- メモリ使用量の削減
- 初期読み込み時間の短縮

## 🔧 技術的な詳細

### データフロー

```
1. 画像生成時:
   page.tsx
     ↓ saveGenerationMetadata(metadata, imageUrl)
   generation-history.ts
     ↓ saveImage(imageId, imageUrl)
   image-storage.ts
     ↓ IndexedDB.put(imageId, blob)

2. ページロード時:
   GeneratorCanvas.tsx
     ↓ getGenerationHistory()
   generation-history.ts
     ↓ LocalStorage.getItem('masterpiece_history')
     ↓ return GenerationMetadata[]

3. 履歴表示時:
   GeneratorCanvas.tsx
     ↓ getImage(imageId)
   image-storage.ts
     ↓ IndexedDB.get(imageId)
     ↓ blobToDataUrl(blob)
     ↓ return dataUrl
```

### 型定義の変更

```typescript
// Before
const [history, setHistory] = useState<string[]>([]); // DataURL

// After
interface HistoryItem {
  imageId: string;
  timestamp: number;
  artistId: string;
  thumbnailUrl?: string; // Phase 11.2で追加
}
const [history, setHistory] = useState<HistoryItem[]>([]);
```

### エラーハンドリング

1. **IndexedDBから画像が取得できない場合**:
   - フォールバック: LocalStorageを確認
   - エラー表示: "画像が見つかりません"
   - 履歴から削除するオプション

2. **メタデータが見つからない場合**:
   - 部分的な情報を表示（imageId, timestamp）
   - "詳細情報なし" と表示

3. **ストレージクォータ超過**:
   - 古い画像を自動削除（LRU）
   - ユーザーに通知

## 📊 成功指標

### Phase 11.1（基本機能）
- ✅ ページリロード後も履歴が表示される
- ✅ 履歴ナビゲーションが正常に動作する
- ✅ プロンプト詳細が正しく表示される
- ✅ ダウンロード機能が正常に動作する

### Phase 11.2（UI改善）
- ⬜ 過去の作品を10秒以内に見つけられる
- ⬜ 100枚の履歴を快適に閲覧できる
- ⬜ フィルタリングが1秒以内に完了する

### Phase 11.3（パフォーマンス）
- ⬜ 初期読み込み時間が3秒以内
- ⬜ メモリ使用量が100MB以内
- ⬜ スクロールが60FPSで動作

## 🚀 次のステップ

1. Phase 11.1の実装計画を詳細化
2. Codeモードで実装開始
3. テストとデバッグ
4. Phase 11.2の設計開始

## 📚 参考資料

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [LocalStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [React useState Hook](https://react.dev/reference/react/useState)
- [React useEffect Hook](https://react.dev/reference/react/useEffect)
