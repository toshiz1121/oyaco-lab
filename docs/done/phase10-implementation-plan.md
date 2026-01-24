# Phase 10: ストレージ改善 - 実装計画書（改訂版）

**作成日**: 2026-01-08  
**改訂日**: 2026-01-08  
**ステータス**: 実装準備完了  
**見積もり**: 4-6時間（P0対策含む）  
**優先度**: 高（スケーラビリティの改善）  
**前提**: Phase 9、Phase 9.5完了

## 📋 実装概要

### 目的

LocalStorageの容量制限（5-10MB）を解決し、IndexedDBへ移行することで、大量の画像履歴を安定して保存できるようにします。

### 現状の問題

**Phase 9.5での応急処置**:
- Base64画像データをLocalStorageに保存しない
- プロンプトメタデータのみ保存（容量: 50-100KB）
- 画像履歴の表示はHTMLに埋め込まれたBase64を使用

**残る課題**:
- ページリロード後に画像履歴が消える
- 長期的な履歴管理ができない
- 20枚以上の画像を保存できない

### 解決策: IndexedDB統合

**アーキテクチャ**:
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
│ - prompts        │  │ - size           │
│ - imageId (参照) │  │                  │
└──────────────────┘  └──────────────────┘
```

**利点**:
- ✅ 容量: 50MB以上（LocalStorageの5-10倍以上）
- ✅ Blobの直接保存（Base64エンコード不要）
- ✅ 非同期API（UIブロックなし）
- ✅ トランザクション対応
- ✅ インデックスによる高速検索
- ✅ 追加コストなし

## 🎯 実装ステップ（全9ステップ）

### Phase 10.0: 基本実装（3-4時間）

#### Step 1: 依存関係のインストール（5分）

```bash
cd tools/master-piece
npm install idb
```

**確認事項**:
- `package.json`に`idb`が追加されること
- 現在のバージョン: v0.10.0 → v0.11.0へ

**ライブラリ選定理由**:
- `idb`: Jake Archibald作、IndexedDBのPromiseラッパー
- TypeScript完全対応
- 軽量（5KB gzipped）
- 広く使用されている（npm週間DL: 100万+）

#### Step 2: image-storage.ts実装（1時間）

**新規ファイル**: `src/lib/image-storage.ts`

##### 2.1 データベーススキーマ定義

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ImageDB extends DBSchema {
  images: {
    key: string;
    value: ImageRecord;
    indexes: { 'by-timestamp': number };
  };
}

interface ImageRecord {
  imageId: string;        // Primary Key
  blob: Blob;             // 画像データ
  timestamp: number;      // 作成日時
  mimeType: string;       // 'image/png' | 'image/jpeg'
  size: number;           // バイト数
}

const DB_NAME = 'masterpiece_images';
const DB_VERSION = 1;
const STORE_NAME = 'images';
```

##### 2.2 データベース接続

```typescript
let dbPromise: Promise<IDBPDatabase<ImageDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ImageDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ImageDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // オブジェクトストア作成
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'imageId',
        });
        
        // インデックス作成（日付範囲検索用）
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}
```

##### 2.3 CRUD操作

**保存**:
```typescript
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
```

**取得**:
```typescript
export async function getImage(imageId: string): Promise<string | null> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, imageId);
  
  if (!record) return null;
  
  // BlobをDataURLに変換
  return blobToDataUrl(record.blob);
}
```

**削除**:
```typescript
export async function deleteImage(imageId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, imageId);
}
```

**古い画像の一括削除**:
```typescript
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
```

**使用量統計**:
```typescript
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
```

##### 2.4 ユーティリティ関数

**DataURL → Blob変換**:
```typescript
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
```

**Blob → DataURL変換**:
```typescript
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

#### Step 3: generation-history.ts修正（30分）

**修正ファイル**: `src/lib/generation-history.ts`

##### 3.1 インターフェース更新

```typescript
export interface GenerationMetadata {
  // 識別情報
  id: string;
  timestamp: number;
  
  // 画像情報
  imageId: string;  // 追加（IndexedDB参照）
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

##### 3.2 保存処理の非同期化

**変更前**:
```typescript
export function saveGenerationMetadata(metadata: GenerationMetadata): void {
  // 同期処理
}
```

**変更後**:
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

##### 3.3 バリデーション更新

**変更箇所**: `loadHistory()`と`importHistory()`

```typescript
// imageUrlのバリデーションを削除
return history.filter(item =>
  item.id &&
  item.timestamp &&
  item.imageId &&  // 追加
  item.artistId &&
  item.userTheme &&
  item.structuredPrompt
);
```

#### Step 4: コンポーネント修正（1時間）

##### 4.1 page.tsx修正

**修正箇所**: 画像生成成功時の処理

**変更前**:
```typescript
if (result.success && result.imageUrl && result.metadata) {
  // ...
  saveGenerationMetadata(fullMetadata);
}
```

**変更後**:
```typescript
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

  // imageIdを生成
  const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // メタデータに追加
  const fullMetadata: GenerationMetadata = {
    ...result.metadata,
    timestamp: Date.now(),
    imageId,  // 追加
    // imageUrl を削除
    artistId: selectedArtistId,
    artistName: selectedArtist?.name || "Unknown",
    userTheme: theme || (uploadedImage ? "Uploaded image transformation" : ""),
  };
  
  // 非同期保存
  await saveGenerationMetadata(fullMetadata, result.imageUrl);
  setCurrentMetadata(fullMetadata);
}
```

##### 4.2 GeneratorCanvas.tsx修正

**修正箇所**: 履歴画像の読み込み

**変更前**:
```typescript
// 同期的に画像URLを取得
const imageUrl = metadata?.imageUrl;
```

**変更後**:
```typescript
import { getImage } from '@/lib/image-storage';

// 画像読み込みを非同期化
const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);

useEffect(() => {
  const loadImage = async () => {
    const currentDisplayImage = history[currentHistoryIndex];
    if (currentDisplayImage) {
      // imageIdから画像を取得
      const metadata = imageMetadataMap.get(currentDisplayImage);
      if (metadata?.imageId) {
        const imageUrl = await getImage(metadata.imageId);
        if (imageUrl) {
          setDisplayImageUrl(imageUrl);
        }
      }
    }
  };
  
  loadImage();
}, [currentHistoryIndex, history, imageMetadataMap]);
```

**パフォーマンス最適化**: 画像キャッシング

```typescript
const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());

const loadImageIfNeeded = async (imageId: string) => {
  // キャッシュチェック
  if (imageCache.has(imageId)) {
    return imageCache.get(imageId)!;
  }
  
  // IndexedDBから読み込み
  const imageUrl = await getImage(imageId);
  if (imageUrl) {
    setImageCache(prev => new Map(prev).set(imageId, imageUrl));
  }
  return imageUrl;
};
```

#### Step 5: マイグレーション処理（30分）

**新規ファイル**: `src/lib/migration.ts`

##### 5.1 マイグレーション関数

```typescript
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

##### 5.2 マイグレーション状態管理

```typescript
const MIGRATION_KEY = 'masterpiece_migration_status';

export function isMigrationCompleted(): boolean {
  try {
    const status = localStorage.getItem(MIGRATION_KEY);
    return status === 'completed';
  } catch {
    return false;
  }
}

export function markMigrationCompleted(): void {
  try {
    localStorage.setItem(MIGRATION_KEY, 'completed');
  } catch (error) {
    console.error('Failed to mark migration as completed:', error);
  }
}
```

##### 5.3 アプリ起動時の処理

**page.tsx**:
```typescript
import { migrateToIndexedDB, isMigrationCompleted, markMigrationCompleted } from '@/lib/migration';

useEffect(() => {
  const runMigration = async () => {
    if (!isMigrationCompleted()) {
      console.log('Starting migration to IndexedDB...');
      const result = await migrateToIndexedDB();
      
      if (result.success) {
        console.log(`Migration completed: ${result.migratedCount} images migrated`);
        markMigrationCompleted();
      } else {
        console.error('Migration failed:', result.errors);
      }
    }
  };
  
  runMigration();
}, []);
```

#### Step 6: テスト実行（1時間）

##### テスト1: 新規画像の保存

**手順**:
1. アプリを起動
2. アーティストを選択
3. テーマを入力して画像生成
4. DevToolsで確認:
   - Application → IndexedDB → `masterpiece_images` → `images`
   - 画像Blobが保存されていることを確認
5. Application → Local Storage
   - メタデータのみ保存されていることを確認
   - `imageId`フィールドが存在することを確認

**期待結果**:
- ✅ IndexedDBに画像が保存される
- ✅ LocalStorageにメタデータのみ保存される
- ✅ `imageUrl`フィールドが存在しない

##### テスト2: 画像の読み込み

**手順**:
1. 保存した画像を表示
2. ページをリロード
3. 画像が正しく表示されることを確認

**期待結果**:
- ✅ IndexedDBから画像が読み込まれる
- ✅ 画像が正しく表示される
- ✅ ローディング中の表示が適切

##### テスト3: 履歴機能

**手順**:
1. 複数の画像を生成（5枚以上）
2. 履歴ボタン（◀ ▶）で切り替え
3. 各画像が正しく表示されることを確認
4. プロンプト詳細が正しく表示されることを確認

**期待結果**:
- ✅ 履歴ナビゲーションが正常動作
- ✅ 各画像が正しく表示される
- ✅ プロンプト詳細が正しく表示される

##### テスト4: マイグレーション

**手順**:
1. Phase 9.5の状態（LocalStorageにメタデータのみ）を用意
2. アプリを起動
3. コンソールでマイグレーションログを確認
4. IndexedDBにデータが移行されることを確認
5. 既存の機能が正常に動作することを確認

**期待結果**:
- ✅ マイグレーションが自動実行される
- ✅ エラーなく完了する
- ✅ 既存機能が正常動作

##### テスト5: 容量テスト

**手順**:
1. 20枚以上の画像を生成
2. QuotaExceededErrorが発生しないことを確認
3. DevToolsでストレージ使用量を確認:
   - Application → Storage → Usage

**期待結果**:
- ✅ QuotaExceededErrorが発生しない
- ✅ 20枚以上の画像を保存できる
- ✅ ストレージ使用量が適切（約20-40MB）

##### テスト6: エラーハンドリング

**手順**:
1. IndexedDBが利用できない環境をシミュレート
2. エラーメッセージが適切に表示されることを確認
3. アプリがクラッシュしないことを確認

**期待結果**:
- ✅ エラーメッセージが表示される
- ✅ アプリが継続動作する
- ✅ LocalStorageにフォールバック

#### Step 7: ドキュメント更新（30分）

##### 7.1 完了報告書作成

**ファイル**: `docs/done/phase10-storage-improvement-completion.md`

**内容**:
```markdown
# Phase 10: ストレージ改善 - 完了報告

## 実装内容

### 1. IndexedDB統合
- image-storage.ts実装
- CRUD操作の実装
- ストレージ管理機能

### 2. 既存コード修正
- generation-history.ts非同期化
- page.tsx修正
- GeneratorCanvas.tsx修正

### 3. マイグレーション
- 自動マイグレーション機能
- 状態管理

## テスト結果

- ✅ 新規画像の保存
- ✅ 画像の読み込み
- ✅ 履歴機能
- ✅ マイグレーション
- ✅ 容量テスト（20枚以上）

## パフォーマンス改善

- LocalStorage容量: 数MB → 50-100KB（95%削減）
- IndexedDB容量: 50MB以上
- 画像保存可能数: 5-10枚 → 50枚以上

## 既知の制限事項

- IndexedDB非対応ブラウザではLocalStorageにフォールバック
- 画像読み込みは非同期（若干の遅延）
```

##### 7.2 CHANGELOG.md更新

```markdown
## [0.11.0] - 2026-01-08

### Added
- IndexedDB統合による大容量画像履歴サポート
- 画像ストレージ管理機能（image-storage.ts）
- 自動マイグレーション機能
- ストレージ使用量統計機能
- 古い画像の自動削除機能

### Changed
- LocalStorageからIndexedDBへの移行
- 非同期画像読み込み
- generation-history.tsの非同期化

### Fixed
- QuotaExceededError問題の根本的解決
- 大量の画像履歴保存が可能に（50枚以上）

### Technical
- 依存関係追加: idb@^8.0.0
- データベース: masterpiece_images (IndexedDB)
- ストレージ容量: 50MB以上
```

##### 7.3 README.md更新

**追加セクション**:
```markdown
## ストレージ

### 技術スタック
- **LocalStorage**: メタデータ（50-100KB）
- **IndexedDB**: 画像Blob（50MB以上）

### 容量制限
- 画像保存可能数: 50枚以上
- 自動クリーンアップ: 30日以上古い画像を削除

### データ管理
- 画像はIndexedDBに保存
- メタデータはLocalStorageに保存
- 自動マイグレーション対応
```

##### 7.4 package.json更新

```json
{
  "version": "0.11.0",
  "dependencies": {
    "idb": "^8.0.0",
    // ... 他の依存関係
  }
}
```

---

### Phase 10.1: P0対策（必須追加 - 1-2時間）

#### Step 8: IndexedDB利用可能性チェックとフォールバック（1時間）

**修正ファイル**: `src/lib/image-storage.ts`

##### 8.1 利用可能性チェック

```typescript
/**
 * IndexedDBが利用可能かチェック
 * プライベートモードやストレージ無効化環境で false を返す
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
  try {
    // IndexedDB APIの存在確認
    if (!('indexedDB' in window)) {
      return false;
    }
    
    // 実際に開けるかテスト
    const testDB = await openDB('__test__', 1);
    await testDB.close();
    
    // テストDBを削除
    await deleteDB('__test__');
    
    return true;
  } catch (error) {
    console.warn('IndexedDB is not available:', error);
    return false;
  }
}
```

##### 8.2 フォールバック戦略

```typescript
// グローバル状態
let useIndexedDB = true;
let indexedDBCheckCompleted = false;

/**
 * ストレージモードを初期化
 * アプリ起動時に一度だけ実行
 */
export async function initializeStorage(): Promise<{
  mode: 'indexeddb' | 'localstorage';
  message: string;
}> {
  if (indexedDBCheckCompleted) {
    return {
      mode: useIndexedDB ? 'indexeddb' : 'localstorage',
      message: useIndexedDB ? 'IndexedDB available' : 'Using LocalStorage fallback',
    };
  }
  
  useIndexedDB = await isIndexedDBAvailable();
  indexedDBCheckCompleted = true;
  
  if (!useIndexedDB) {
    return {
      mode: 'localstorage',
      message: 'IndexedDB not available. Using LocalStorage (limited to 5 images).',
    };
  }
  
  return {
    mode: 'indexeddb',
    message: 'IndexedDB initialized successfully.',
  };
}
```

##### 8.3 保存処理の修正（フォールバック対応）

```typescript
export async function saveImage(imageId: string, dataUrl: string): Promise<void> {
  if (!useIndexedDB) {
    // LocalStorageフォールバック（最新5件のみ）
    saveImageToLocalStorage(imageId, dataUrl);
    return;
  }
  
  try {
    const db = await getDB();
    const blob = await dataUrlToBlob(dataUrl);
    
    const record: ImageRecord = {
      imageId,
      blob,
      timestamp: Date.now(),
      mimeType: blob.type,
      size: blob.size,
    };
    
    await db.put(STORE_NAME, record);
  } catch (error) {
    console.error('Failed to save to IndexedDB, falling back to LocalStorage:', error);
    useIndexedDB = false;
    saveImageToLocalStorage(imageId, dataUrl);
  }
}

/**
 * LocalStorageフォールバック（最新5件のみ保持）
 */
function saveImageToLocalStorage(imageId: string, dataUrl: string): void {
  const FALLBACK_KEY = 'masterpiece_images_fallback';
  const MAX_IMAGES = 5;
  
  try {
    const stored = localStorage.getItem(FALLBACK_KEY);
    const images: Record<string, { dataUrl: string; timestamp: number }> = stored ? JSON.parse(stored) : {};
    
    // 新しい画像を追加
    images[imageId] = { dataUrl, timestamp: Date.now() };
    
    // 古い画像を削除（最新5件のみ保持）
    const sortedEntries = Object.entries(images).sort((a, b) => b[1].timestamp - a[1].timestamp);
    const limitedImages = Object.fromEntries(sortedEntries.slice(0, MAX_IMAGES));
    
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(limitedImages));
  } catch (error) {
    console.error('Failed to save to LocalStorage fallback:', error);
    // QuotaExceededErrorの場合、最も古い画像を削除して再試行
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      pruneLocalStorageFallback();
      saveImageToLocalStorage(imageId, dataUrl); // 再試行
    }
  }
}
```

##### 8.4 取得処理の修正（フォールバック対応）

```typescript
export async function getImage(imageId: string): Promise<string | null> {
  if (!useIndexedDB) {
    return getImageFromLocalStorage(imageId);
  }
  
  try {
    const db = await getDB();
    const record = await db.get(STORE_NAME, imageId);
    
    if (!record) {
      // IndexedDBになければLocalStorageを確認
      return getImageFromLocalStorage(imageId);
    }
    
    return blobToDataUrl(record.blob);
  } catch (error) {
    console.error('Failed to get from IndexedDB, trying LocalStorage:', error);
    return getImageFromLocalStorage(imageId);
  }
}

function getImageFromLocalStorage(imageId: string): string | null {
  const FALLBACK_KEY = 'masterpiece_images_fallback';
  
  try {
    const stored = localStorage.getItem(FALLBACK_KEY);
    if (!stored) return null;
    
    const images = JSON.parse(stored);
    return images[imageId]?.dataUrl || null;
  } catch (error) {
    console.error('Failed to get from LocalStorage fallback:', error);
    return null;
  }
}
```

##### 8.5 UI警告メッセージ

**page.tsx**:
```typescript
import { initializeStorage } from '@/lib/image-storage';

useEffect(() => {
  const checkStorage = async () => {
    const result = await initializeStorage();
    
    if (result.mode === 'localstorage') {
      // 警告メッセージを表示
      setStorageWarning('⚠️ IndexedDB利用不可。履歴保存は最新5件までに制限されます。');
    }
  };
  
  checkStorage();
}, []);
```

#### Step 9: クォータ管理とLRU削除（1時間）

**修正ファイル**: `src/lib/image-storage.ts`

##### 9.1 クォータチェック

```typescript
/**
 * ストレージクォータをチェック
 * 80%以上使用している場合は警告
 */
export async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
  warning: boolean;
}> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return {
      usage: 0,
      quota: 0,
      percentUsed: 0,
      warning: false,
    };
  }
  
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
  
  return {
    usage,
    quota,
    percentUsed,
    warning: percentUsed > 80,
  };
}
```

##### 9.2 LRU削除戦略

```typescript
const MAX_IMAGES = 100; // 最大保存数

/**
 * 最大保存数を超えた場合、最も古い画像を削除
 */
export async function enforceLRULimit(): Promise<number> {
  if (!useIndexedDB) {
    return 0; // LocalStorageフォールバックは自動制限
  }
  
  try {
    const db = await getDB();
    const allRecords = await db.getAll(STORE_NAME);
    
    if (allRecords.length <= MAX_IMAGES) {
      return 0;
    }
    
    // タイムスタンプでソート（古い順）
    const sortedRecords = allRecords.sort((a, b) => a.timestamp - b.timestamp);
    
    // 削除する画像数
    const deleteCount = allRecords.length - MAX_IMAGES;
    
    // 古い画像を削除
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (let i = 0; i < deleteCount; i++) {
      await tx.store.delete(sortedRecords[i].imageId);
    }
    await tx.done;
    
    return deleteCount;
  } catch (error) {
    console.error('Failed to enforce LRU limit:', error);
    return 0;
  }
}
```

##### 9.3 保存時の自動クリーンアップ

```typescript
export async function saveImage(imageId: string, dataUrl: string): Promise<void> {
  if (!useIndexedDB) {
    saveImageToLocalStorage(imageId, dataUrl);
    return;
  }
  
  try {
    // クォータチェック
    const quota = await checkStorageQuota();
    if (quota.warning) {
      console.warn(`Storage usage: ${quota.percentUsed.toFixed(1)}%`);
      // 古い画像を削除
      const deleted = await enforceLRULimit();
      if (deleted > 0) {
        console.log(`Deleted ${deleted} old images to free up space`);
      }
    }
    
    const db = await getDB();
    const blob = await dataUrlToBlob(dataUrl);
    
    const record: ImageRecord = {
      imageId,
      blob,
      timestamp: Date.now(),
      mimeType: blob.type,
      size: blob.size,
    };
    
    await db.put(STORE_NAME, record);
    
    // LRU制限を適用
    await enforceLRULimit();
    
  } catch (error) {
    console.error('Failed to save to IndexedDB, falling back to LocalStorage:', error);
    useIndexedDB = false;
    saveImageToLocalStorage(imageId, dataUrl);
  }
}
```

##### 9.4 定期的なクリーンアップ

```typescript
/**
 * 定期的なストレージクリーンアップ
 * アプリ起動時に実行
 */
export async function performStorageMaintenance(): Promise<{
  deletedOldImages: number;
  deletedLRU: number;
  currentUsage: number;
}> {
  // 30日以上古い画像を削除
  const deletedOldImages = await pruneOldImages(30);
  
  // LRU制限を適用
  const deletedLRU = await enforceLRULimit();
  
  // 現在の使用量を取得
  const usage = await getStorageUsage();
  
  return {
    deletedOldImages,
    deletedLRU,
    currentUsage: usage.totalSize,
  };
}
```

##### 9.5 UI統合（ストレージ状態表示）

**page.tsx**:
```typescript
import { checkStorageQuota, performStorageMaintenance } from '@/lib/image-storage';

const [storageInfo, setStorageInfo] = useState<{
  percentUsed: number;
  warning: boolean;
} | null>(null);

useEffect(() => {
  const initStorage = async () => {
    // ストレージメンテナンス
    const maintenance = await performStorageMaintenance();
    console.log('Storage maintenance:', maintenance);
    
    // クォータチェック
    const quota = await checkStorageQuota();
    setStorageInfo({
      percentUsed: quota.percentUsed,
      warning: quota.warning,
    });
  };
  
  initStorage();
}, []);

// UI表示
{storageInfo?.warning && (
  <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
    ⚠️ ストレージ使用量: {storageInfo.percentUsed.toFixed(1)}%
    <br />
    古い画像は自動的に削除されます。
  </div>
)}
```

---

## 📊 成功基準（更新版）

### Phase 10.0: 基本実装

- [x] 設計書完成
- [ ] 依存関係インストール完了
- [ ] image-storage.ts実装完了
- [ ] generation-history.ts修正完了
- [ ] コンポーネント修正完了
- [ ] マイグレーション実装完了
- [ ] 全テスト合格
- [ ] ドキュメント更新完了

### Phase 10.1: P0対策（必須）

- [ ] IndexedDB利用可能性チェック実装
- [ ] LocalStorageフォールバック実装
- [ ] クォータ管理機能実装
- [ ] LRU削除戦略実装
- [ ] UI警告メッセージ実装
- [ ] ストレージメンテナンス実装

### 品質基準

- [ ] IndexedDBに画像が保存される
- [ ] LocalStorageにメタデータのみ保存
- [ ] 既存機能が正常動作
- [ ] 20枚以上の画像を保存可能
- [ ] マイグレーション成功
- [ ] QuotaExceededError未発生
- [ ] エラーハンドリング適切
- [ ] **プライベートモードで動作（制限付き）**
- [ ] **クォータ超過時に自動削除**
- [ ] **ストレージ警告表示**

### パフォーマンス基準

- [ ] 画像読み込み時間: < 500ms
- [ ] LocalStorage容量: < 100KB
- [ ] IndexedDB容量: 効率的に使用
- [ ] **最大保存数: 100枚**
- [ ] **自動クリーンアップ: 30日以上古い画像**

## ⚠️ リスクと対策（更新版）

### リスク1: 非同期処理の複雑化

**影響**: コードの可読性低下、バグの増加

**対策**:
- 段階的実装とテスト
- エラーハンドリングの徹底
- TypeScriptの型安全性を活用

### リスク2: マイグレーション失敗

**影響**: ユーザーデータの損失

**対策**:
- マイグレーション前のバックアップ
- エラー時のロールバック
- 詳細なエラーログ

### リスク3: パフォーマンス低下

**影響**: ユーザー体験の低下

**対策**:
- 画像の遅延読み込み
- キャッシング戦略
- プログレッシブローディング

### リスク4: ブラウザ互換性（P0対策済み）

**影響**: 一部ブラウザで動作しない

**対策**:
- ✅ IndexedDB対応チェック実装
- ✅ LocalStorageへのフォールバック実装
- ✅ 適切なエラーメッセージ表示

### リスク5: ストレージフル（P0対策済み）

**影響**: 新しい画像を保存できない

**対策**:
- ✅ クォータチェック実装
- ✅ LRU削除戦略実装
- ✅ 自動クリーンアップ実装
- ✅ ユーザーへの警告表示

## 🎯 実装優先度マトリクス

| Phase | 優先度 | 見積もり | 説明 |
|-------|--------|---------|------|
| **Phase 10.0** | **P0** | 3-4時間 | 基本的なIndexedDB統合 |
| **Phase 10.1 (Step 8)** | **P0** | 1時間 | IndexedDB利用不可時のフォールバック |
| **Phase 10.1 (Step 9)** | **P0** | 1時間 | クォータ管理とLRU削除 |
| Phase 10.2 | P1 | 1-2時間 | データ整合性保証（将来） |
| Phase 10.5 | P3 | 2-3時間 | サムネイル生成（将来） |

**合計見積もり**: 5-6時間（P0のみ）

## 🚀 次のステップ

### 実装準備完了

実装計画が完成しました（P0対策含む）。**Codeモード**に切り替えて実装を開始できます。

### 推奨ワークフロー

#### フェーズ1: 基本実装（3-4時間）

1. **Step 1-2**: image-storage.ts実装
   - 依存関係インストール
   - IndexedDB CRUD操作実装
   - 単体テスト

2. **Step 3-4**: 既存コード修正
   - generation-history.ts非同期化
   - コンポーネント修正
   - 統合テスト

3. **Step 5**: マイグレーション実装
   - 自動マイグレーション
   - 状態管理
   - マイグレーションテスト

4. **Step 6**: 基本テスト
   - 全機能テスト
   - 容量テスト

#### フェーズ2: P0対策（1-2時間）

5. **Step 8**: フォールバック実装
   - IndexedDB利用可能性チェック
   - LocalStorageフォールバック
   - UI警告メッセージ
   - テスト（プライベートモード）

6. **Step 9**: クォータ管理実装
   - クォータチェック
   - LRU削除戦略
   - 自動クリーンアップ
   - テスト（ストレージフル）

#### フェーズ3: 完了（30分）

7. **Step 7**: ドキュメント更新
   - 完了報告書
   - CHANGELOG
   - README

### 見積もり時間（更新版）

- **Phase 10.0（基本実装）**: 3-4時間
- **Phase 10.1（P0対策）**: 1-2時間
- **ドキュメント更新**: 30分
- **合計**: **4.5-6.5時間**

## 📚 参考資料

### IndexedDB

- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [idb Library](https://github.com/jakearchibald/idb)
- [Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API)

### 設計書

- [Phase 10設計書](./phase10-storage-improvement.md)
- [Phase 9完了報告](../done/phase9-prompt-history-completion.md)
- [Phase 9.5完了報告](../done/phase9.5-quota-exceeded-fix.md)

### 関連ファイル

- [`src/lib/generation-history.ts`](../../src/lib/generation-history.ts)
- [`src/app/page.tsx`](../../src/app/page.tsx)
- [`src/components/GeneratorCanvas.tsx`](../../src/components/GeneratorCanvas.tsx)

---

## 📝 改訂履歴

### 2026-01-08 (改訂版)

**追加内容**:
- Phase 10.1: P0対策（必須追加）
  - Step 8: IndexedDB利用可能性チェックとフォールバック
  - Step 9: クォータ管理とLRU削除
- 実装優先度マトリクス
- 見積もり時間の更新（4.5-6.5時間）

**改善点**:
- プライベートモードでの動作保証
- ストレージフル時の自動削除
- ユーザーへの適切な警告表示
- 本番環境での安定性向上

---

**実装担当**: Code モード
**レビュー担当**: Architect モード
**承認**: Toshio Ueda
