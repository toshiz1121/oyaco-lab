# Phase 10: ストレージ改善 - 設計書

**作成日**: 2026-01-07  
**ステータス**: 設計中  
**見積もり**: 3-4時間  
**優先度**: 高（スケーラビリティの改善）

## 1. 問題の概要

### 現状の問題

**LocalStorageの容量制限**:
- 容量: 5-10MB（ブラウザによる）
- 現在の実装: Base64エンコードされた画像データをLocalStorageに保存
- 画像サイズ: 約1-2MB/枚（Base64エンコード後）
- **結果**: 5-10枚の画像で容量オーバー

**実際の動作**:
```typescript
// generation-history.ts:97
localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
// ❌ QuotaExceededError が発生
```

**エラーハンドリング**:
- [`generation-history.ts:102-111`](../../src/lib/generation-history.ts:102-111): QuotaExceededError時に履歴を半分に削減
- **問題**: ユーザーの履歴が突然消える

## 2. 解決策の比較

### オプションA: IndexedDB（推奨）

**メリット**:
- ✅ 容量: 50MB以上（ブラウザによっては無制限）
- ✅ Blobの直接保存（Base64エンコード不要）
- ✅ 非同期API（UIブロックなし）
- ✅ トランザクション対応
- ✅ インデックスによる高速検索
- ✅ 追加コストなし

**デメリット**:
- ⚠️ APIが複雑（ラッパーライブラリで解決）
- ⚠️ 非同期処理の考慮が必要

**推奨ライブラリ**: `idb`（Jake Archibald作）
```bash
npm install idb
```

### オプションB: 外部ストレージ（クラウド）

**メリット**:
- ✅ 無制限の容量
- ✅ デバイス間での同期
- ✅ バックアップ

**デメリット**:
- ❌ コスト発生
- ❌ 認証・セキュリティの実装が必要
- ❌ ネットワーク依存
- ❌ プライバシーの懸念

**候補サービス**:
- AWS S3
- Cloudflare R2
- Supabase Storage

### オプションC: メタデータのみ保存（画像は再生成）

**メリット**:
- ✅ LocalStorageで十分
- ✅ 実装が簡単

**デメリット**:
- ❌ 画像の再生成コスト
- ❌ 完全な再現性なし（AIの非決定性）
- ❌ ユーザー体験の低下

## 3. 推奨アーキテクチャ: IndexedDB + LocalStorage

### 3.1 データ分離戦略

```
┌─────────────────────────────────────────┐
│           アプリケーション              │
└─────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│  LocalStorage    │  │   IndexedDB      │
│  (メタデータ)    │  │   (画像Blob)     │
├──────────────────┤  ├──────────────────┤
│ - id             │  │ - imageId        │
│ - timestamp      │  │ - blob           │
│ - artistId       │  │ - timestamp      │
│ - userTheme      │  │ - mimeType       │
│ - prompts        │  │                  │
│ - imageId (参照) │  │                  │
└──────────────────┘  └──────────────────┘
```

**利点**:
- メタデータの高速検索（LocalStorage）
- 大容量画像の効率的保存（IndexedDB）
- 既存のメタデータ管理ロジックを活用

### 3.2 データベーススキーマ

**IndexedDB**:
```typescript
interface ImageRecord {
  imageId: string;        // Primary Key
  blob: Blob;             // 画像データ
  timestamp: number;      // 作成日時
  mimeType: string;       // 'image/png' | 'image/jpeg'
  size: number;           // バイト数
}

// インデックス
// - timestamp (範囲検索用)
```

**LocalStorage**:
```typescript
interface GenerationMetadata {
  id: string;
  timestamp: number;
  imageId: string;        // IndexedDBへの参照（追加）
  // imageUrl を削除
  artistId: string;
  artistName: string;
  userTheme: string;
  interpretation: ThemeInterpretation;
  structuredPrompt: string;
  negativePrompt: string;
  isModification?: boolean;
  modificationInstruction?: string;
  parentId?: string;
}
```

## 4. 実装計画

### 4.1 新規ファイル: `lib/image-storage.ts`

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// データベーススキーマ定義
interface ImageDB extends DBSchema {
  images: {
    key: string;
    value: ImageRecord;
    indexes: { 'by-timestamp': number };
  };
}

interface ImageRecord {
  imageId: string;
  blob: Blob;
  timestamp: number;
  mimeType: string;
  size: number;
}

const DB_NAME = 'masterpiece_images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

// データベース接続
let dbPromise: Promise<IDBPDatabase<ImageDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ImageDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ImageDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // オブジェクトストア作成
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'imageId',
        });
        
        // インデックス作成
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

// 画像を保存
export async function saveImage(imageId: string, dataUrl: string): Promise<void> {
  const db = await getDB();
  
  // Base64 DataURLをBlobに変換
  const blob = await dataUrlToBlob(dataUrl);
  
  const record: ImageRecord = {
    imageId,
    blob,
    timestamp: Date.now(),
    mimeType: blob.type,
    size: blob.size,
  };
  
  await db.put(STORE_NAME, record);
}

// 画像を取得
export async function getImage(imageId: string): Promise<string | null> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, imageId);
  
  if (!record) return null;
  
  // BlobをDataURLに変換
  return blobToDataUrl(record.blob);
}

// 画像を削除
export async function deleteImage(imageId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, imageId);
}

// 古い画像を削除（日数指定）
export async function pruneOldImages(daysToKeep: number): Promise<number> {
  const db = await getDB();
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const index = tx.store.index('by-timestamp');
  
  let deletedCount = 0;
  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoffTime));
  
  while (cursor) {
    await cursor.delete();
    deletedCount++;
    cursor = await cursor.continue();
  }
  
  await tx.done;
  return deletedCount;
}

// ストレージ使用量を取得
export async function getStorageUsage(): Promise<{
  count: number;
  totalSize: number;
}> {
  const db = await getDB();
  const allRecords = await db.getAll(STORE_NAME);
  
  return {
    count: allRecords.length,
    totalSize: allRecords.reduce((sum, record) => sum + record.size, 0),
  };
}

// ユーティリティ: DataURL → Blob
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

// ユーティリティ: Blob → DataURL
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### 4.2 `lib/generation-history.ts`の修正

**変更1**: インターフェースの更新

```typescript
export interface GenerationMetadata {
  // 識別情報
  id: string;
  timestamp: number;
  
  // 画像情報
  imageId: string;  // IndexedDBへの参照（追加）
  // imageUrl を削除
  
  // アーティスト情報
  artistId: string;
  artistName: string;
  
  // プロンプト情報
  userTheme: string;
  interpretation: ThemeInterpretation;
  structuredPrompt: string;
  negativePrompt: string;
  
  // 修正情報（オプション）
  isModification?: boolean;
  modificationInstruction?: string;
  parentId?: string;
}
```

**変更2**: 保存処理の更新

```typescript
import { saveImage } from './image-storage';

export async function saveGenerationMetadata(
  metadata: GenerationMetadata,
  imageDataUrl: string
): Promise<void> {
  // 画像をIndexedDBに保存
  await saveImage(metadata.imageId, imageDataUrl);
  
  // メタデータをLocalStorageに保存（既存のロジック）
  const history = loadHistory();
  const existingIndex = history.findIndex(item => item.id === metadata.id);
  if (existingIndex >= 0) {
    history[existingIndex] = metadata;
  } else {
    history.push(metadata);
  }
  saveHistory(history);
}
```

### 4.3 コンポーネントの修正

**`page.tsx`の修正**:

```typescript
// 画像生成成功時
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
  setCurrentArtwork(newArtwork);

  // メタデータを保存（画像URLも渡す）
  const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fullMetadata: GenerationMetadata = {
    ...result.metadata,
    timestamp: Date.now(),
    imageId,  // 追加
    // imageUrl を削除
    artistId: selectedArtistId,
    artistName: selectedArtist?.name || "Unknown",
    userTheme: theme || (uploadedImage ? "Uploaded image transformation" : ""),
  };
  
  await saveGenerationMetadata(fullMetadata, result.imageUrl);
  setCurrentMetadata(fullMetadata);
}
```

**`GeneratorCanvas.tsx`の修正**:

```typescript
import { getImage } from '@/lib/image-storage';

// 画像URLの取得を非同期化
useEffect(() => {
  const loadImage = async () => {
    const currentDisplayImage = history[currentHistoryIndex];
    if (currentDisplayImage) {
      // imageIdから画像を取得
      const metadata = imageMetadataMap.get(currentDisplayImage);
      if (metadata?.imageId) {
        const imageUrl = await getImage(metadata.imageId);
        if (imageUrl) {
          // 画像URLを更新
          setDisplayImageUrl(imageUrl);
        }
      }
    }
  };
  
  loadImage();
}, [currentHistoryIndex, history]);
```

### 4.4 マイグレーション処理

既存のLocalStorageデータをIndexedDBに移行：

```typescript
// lib/migration.ts
import { getGenerationHistory, saveGenerationMetadata } from './generation-history';
import { saveImage } from './image-storage';

export async function migrateToIndexedDB(): Promise<{
  success: boolean;
  migratedCount: number;
  errors: string[];
}> {
  const history = getGenerationHistory();
  const errors: string[] = [];
  let migratedCount = 0;
  
  for (const metadata of history) {
    try {
      if (metadata.imageUrl) {
        // imageIdを生成
        const imageId = `img_${metadata.timestamp}_${metadata.id}`;
        
        // 画像をIndexedDBに保存
        await saveImage(imageId, metadata.imageUrl);
        
        // メタデータを更新
        const updatedMetadata = {
          ...metadata,
          imageId,
        };
        delete (updatedMetadata as any).imageUrl;
        
        // LocalStorageに保存
        await saveGenerationMetadata(updatedMetadata, metadata.imageUrl);
        migratedCount++;
      }
    } catch (error) {
      errors.push(`Failed to migrate ${metadata.id}: ${error}`);
    }
  }
  
  return {
    success: errors.length === 0,
    migratedCount,
    errors,
  };
}
```

## 5. 実装手順

### Step 1: 依存関係のインストール（5分）

```bash
cd tools/master-piece
npm install idb
```

### Step 2: image-storage.tsの実装（1時間）

1. `lib/image-storage.ts`を作成
2. IndexedDBのセットアップ
3. CRUD操作の実装
4. ユーティリティ関数の実装

### Step 3: generation-history.tsの修正（30分）

1. インターフェースの更新
2. 保存処理の非同期化
3. 画像URL関連のロジックを削除

### Step 4: コンポーネントの修正（1時間）

1. `page.tsx`の修正
2. `ChatInterface.tsx`の修正
3. `GeneratorCanvas.tsx`の修正

### Step 5: マイグレーション処理（30分）

1. `lib/migration.ts`を作成
2. アプリ起動時にマイグレーションを実行
3. マイグレーション完了後、古いデータを削除

### Step 6: テスト（1時間）

#### テスト1: 新規画像の保存
1. 画像を生成
2. IndexedDBに保存されることを確認
3. LocalStorageにメタデータが保存されることを確認

#### テスト2: 画像の読み込み
1. 保存した画像を表示
2. IndexedDBから正しく読み込まれることを確認

#### テスト3: 履歴機能
1. 複数の画像を生成
2. 履歴ボタンで切り替え
3. 各画像が正しく表示されることを確認

#### テスト4: マイグレーション
1. 既存のLocalStorageデータを用意
2. マイグレーションを実行
3. IndexedDBにデータが移行されることを確認
4. 既存の機能が正常に動作することを確認

#### テスト5: 容量テスト
1. 20枚以上の画像を生成
2. QuotaExceededErrorが発生しないことを確認
3. ストレージ使用量を確認

## 6. 成功基準

- [ ] IndexedDBに画像が保存される
- [ ] LocalStorageにメタデータのみが保存される
- [ ] 既存の機能（生成、修正、履歴、ダウンロード）が正常に動作する
- [ ] 20枚以上の画像を保存できる
- [ ] マイグレーションが正常に完了する
- [ ] QuotaExceededErrorが発生しない

## 7. パフォーマンス最適化

### 7.1 画像の遅延読み込み

```typescript
// 履歴の画像は必要になるまで読み込まない
const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());

const loadImageIfNeeded = async (imageId: string) => {
  if (imageCache.has(imageId)) {
    return imageCache.get(imageId)!;
  }
  
  const imageUrl = await getImage(imageId);
  if (imageUrl) {
    setImageCache(prev => new Map(prev).set(imageId, imageUrl));
  }
  return imageUrl;
};
```

### 7.2 自動クリーンアップ

```typescript
// 30日以上古い画像を自動削除
useEffect(() => {
  const cleanup = async () => {
    const deletedCount = await pruneOldImages(30);
    console.log(`Cleaned up ${deletedCount} old images`);
  };
  
  // アプリ起動時に1回実行
  cleanup();
}, []);
```

## 8. 今後の拡張

### Phase 11: クラウド同期（オプション）

- IndexedDBをプライマリストレージとして維持
- オプションでクラウドにバックアップ
- デバイス間での同期

### Phase 12: 画像圧縮

- WebPフォーマットへの変換
- 品質調整による容量削減
- サムネイル生成

## 9. リスク評価

### 中リスク
- 非同期処理の複雑化
- マイグレーション失敗時のデータ損失

### 対策
- 段階的な実装とテスト
- マイグレーション前のバックアップ
- エラーハンドリングの徹底

---

**実装担当**: Code モード  
**レビュー担当**: Architect モード  
**承認**: Toshio Ueda
