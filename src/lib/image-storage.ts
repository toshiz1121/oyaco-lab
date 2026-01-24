/**
 * IndexedDB Image Storage
 * 
 * 画像をIndexedDBに保存・取得するためのユーティリティ
 * LocalStorageの容量制限を回避し、大量の画像履歴を保存可能にする
 * 
 * Phase 10.0: 基本実装
 * Phase 10.1: P0対策（フォールバック、クォータ管理）
 */

import { openDB, DBSchema, IDBPDatabase, deleteDB } from 'idb';

// ================================================================================
// Types & Interfaces
// ================================================================================

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

// ================================================================================
// Constants
// ================================================================================

const DB_NAME = 'masterpiece_images';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const FALLBACK_KEY = 'masterpiece_images_fallback';
const MAX_IMAGES = 100; // 最大保存数
const MAX_FALLBACK_IMAGES = 5; // LocalStorageフォールバック時の最大保存数

// ================================================================================
// Global State
// ================================================================================

let dbPromise: Promise<IDBPDatabase<ImageDB>> | null = null;
let useIndexedDB = true;
let indexedDBCheckCompleted = false;

// ================================================================================
// Database Connection
// ================================================================================

/**
 * IndexedDBデータベースを取得
 */
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

// ================================================================================
// IndexedDB Availability Check (Phase 10.1)
// ================================================================================

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

// ================================================================================
// Utility Functions
// ================================================================================

/**
 * DataURL → Blob変換
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Blob → DataURL変換
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ================================================================================
// LocalStorage Fallback (Phase 10.1)
// ================================================================================

/**
 * LocalStorageフォールバック（最新5件のみ保持）
 */
function saveImageToLocalStorage(imageId: string, dataUrl: string): void {
  try {
    const stored = localStorage.getItem(FALLBACK_KEY);
    const images: Record<string, { dataUrl: string; timestamp: number }> = stored ? JSON.parse(stored) : {};
    
    // 新しい画像を追加
    images[imageId] = { dataUrl, timestamp: Date.now() };
    
    // 古い画像を削除（最新5件のみ保持）
    const sortedEntries = Object.entries(images).sort((a, b) => b[1].timestamp - a[1].timestamp);
    const limitedImages = Object.fromEntries(sortedEntries.slice(0, MAX_FALLBACK_IMAGES));
    
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(limitedImages));
  } catch (error) {
    console.error('Failed to save to LocalStorage fallback:', error);
    // QuotaExceededErrorの場合、最も古い画像を削除して再試行
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      pruneLocalStorageFallback();
      // 再試行（再帰呼び出しは1回のみ）
      try {
        const stored = localStorage.getItem(FALLBACK_KEY);
        const images: Record<string, { dataUrl: string; timestamp: number }> = stored ? JSON.parse(stored) : {};
        images[imageId] = { dataUrl, timestamp: Date.now() };
        const sortedEntries = Object.entries(images).sort((a, b) => b[1].timestamp - a[1].timestamp);
        const limitedImages = Object.fromEntries(sortedEntries.slice(0, MAX_FALLBACK_IMAGES));
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(limitedImages));
      } catch (retryError) {
        console.error('Failed to save to LocalStorage fallback after retry:', retryError);
      }
    }
  }
}

/**
 * LocalStorageから画像を取得
 */
function getImageFromLocalStorage(imageId: string): string | null {
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

/**
 * LocalStorageフォールバックの古い画像を削除
 */
function pruneLocalStorageFallback(): void {
  try {
    const stored = localStorage.getItem(FALLBACK_KEY);
    if (!stored) return;
    
    const images = JSON.parse(stored);
    const sortedEntries = Object.entries(images).sort((a: any, b: any) => b[1].timestamp - a[1].timestamp);
    const limitedImages = Object.fromEntries(sortedEntries.slice(0, MAX_FALLBACK_IMAGES - 1));
    
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(limitedImages));
  } catch (error) {
    console.error('Failed to prune LocalStorage fallback:', error);
  }
}

// ================================================================================
// Quota Management (Phase 10.1)
// ================================================================================

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

/**
 * 最大保存数を超えた場合、最も古い画像を削除（LRU戦略）
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

/**
 * 古い画像の一括削除
 */
export async function pruneOldImages(daysToKeep: number): Promise<number> {
  if (!useIndexedDB) {
    return 0;
  }
  
  try {
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
  } catch (error) {
    console.error('Failed to prune old images:', error);
    return 0;
  }
}

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

// ================================================================================
// CRUD Operations
// ================================================================================

/**
 * 画像を保存
 */
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

/**
 * 画像を取得
 */
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

/**
 * 画像を削除
 */
export async function deleteImage(imageId: string): Promise<void> {
  if (!useIndexedDB) {
    // LocalStorageフォールバックから削除
    try {
      const stored = localStorage.getItem(FALLBACK_KEY);
      if (stored) {
        const images = JSON.parse(stored);
        delete images[imageId];
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(images));
      }
    } catch (error) {
      console.error('Failed to delete from LocalStorage fallback:', error);
    }
    return;
  }
  
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, imageId);
  } catch (error) {
    console.error('Failed to delete from IndexedDB:', error);
  }
}

/**
 * 使用量統計を取得
 */
export async function getStorageUsage(): Promise<{
  count: number;
  totalSize: number;
}> {
  if (!useIndexedDB) {
    try {
      const stored = localStorage.getItem(FALLBACK_KEY);
      if (!stored) return { count: 0, totalSize: 0 };
      
      const images = JSON.parse(stored);
      const count = Object.keys(images).length;
      const totalSize = JSON.stringify(images).length;
      
      return { count, totalSize };
    } catch (error) {
      console.error('Failed to get LocalStorage usage:', error);
      return { count: 0, totalSize: 0 };
    }
  }
  
  try {
    const db = await getDB();
    const allRecords = await db.getAll(STORE_NAME);
    
    return {
      count: allRecords.length,
      totalSize: allRecords.reduce((sum, record) => sum + record.size, 0),
    };
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    return { count: 0, totalSize: 0 };
  }
}
