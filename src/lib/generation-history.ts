/**
 * Generation History Management
 *
 * 画像生成履歴とプロンプトメタデータの管理
 * LocalStorageを使用した永続化
 *
 * Phase 10: IndexedDB統合
 * - imageIdフィールド追加（IndexedDB参照用）
 * - 非同期保存処理対応
 */

import { saveImage } from './image-storage';

export interface ThemeInterpretation {
  elements: string;
  mood: string;
  rawResponse?: string;
}

export interface GenerationMetadata {
  // 識別情報
  id: string;
  timestamp: number;
  
  // 画像情報
  imageId: string;  // IndexedDB参照用（Phase 10で追加）
  imageUrl?: string; // 後方互換性のため残す（Phase 9.5以前のデータ用）
  
  // アーティスト情報
  artistId: string;
  artistName: string;
  
  // プロンプト情報
  userTheme: string;
  interpretation: ThemeInterpretation;
  structuredPrompt: string;
  negativePrompt: string;
  
  // 巨匠コメント（Phase 11.3で追加）
  artistComment?: string;
  
  // 修正情報（オプション）
  isModification?: boolean;
  modificationInstruction?: string;
  parentId?: string;
}

const STORAGE_KEY = 'masterpiece_history';
const MAX_HISTORY_SIZE = 50;

/**
 * LocalStorageが利用可能かチェック
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 履歴をLocalStorageから読み込み
 */
function loadHistory(): GenerationMetadata[] {
  if (!isLocalStorageAvailable()) {
    console.warn('LocalStorage is not available');
    return [];
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const history = JSON.parse(data) as GenerationMetadata[];
    
    // バリデーション: 必須フィールドの確認
    // Phase 10: imageIdフィールドを追加（後方互換性のためオプション）
    return history.filter(item =>
      item.id &&
      item.timestamp &&
      item.artistId &&
      item.userTheme &&
      item.structuredPrompt
      // imageIdは後方互換性のためバリデーションから除外
    );
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

/**
 * 履歴をLocalStorageに保存
 */
function saveHistory(history: GenerationMetadata[]): void {
  if (!isLocalStorageAvailable()) {
    console.warn('LocalStorage is not available');
    return;
  }

  try {
    // 最大件数を超えた場合、古いものから削除
    const trimmedHistory = history.slice(-MAX_HISTORY_SIZE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Failed to save history:', error);
    
    // ストレージ容量エラーの場合、古いデータを削除して再試行
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      try {
        const reducedHistory = history.slice(-Math.floor(MAX_HISTORY_SIZE / 2));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedHistory));
        console.warn('History reduced due to storage quota');
      } catch (retryError) {
        console.error('Failed to save even after reducing history:', retryError);
      }
    }
  }
}

/**
 * 生成メタデータを保存（Phase 10: 非同期化）
 *
 * @param metadata メタデータ（imageIdを含む）
 * @param imageDataUrl 画像のDataURL（IndexedDBに保存）
 */
export async function saveGenerationMetadata(
  metadata: GenerationMetadata,
  imageDataUrl: string
): Promise<void> {
  // 画像をIndexedDBに保存
  await saveImage(metadata.imageId, imageDataUrl);
  
  const history = loadHistory();
  
  // メタデータのみLocalStorageに保存（imageUrlは除外）
  const metadataToSave: GenerationMetadata = {
    ...metadata,
    imageUrl: undefined, // Base64データは保存しない
  };
  
  // 同じIDが既に存在する場合は更新、なければ追加
  const existingIndex = history.findIndex(item => item.id === metadata.id);
  if (existingIndex >= 0) {
    history[existingIndex] = metadataToSave;
  } else {
    history.push(metadataToSave);
  }
  
  saveHistory(history);
}

/**
 * IDで特定のメタデータを取得
 */
export function getGenerationMetadata(id: string): GenerationMetadata | null {
  const history = loadHistory();
  return history.find(item => item.id === id) || null;
}

/**
 * 全履歴を取得（新しい順）
 */
export function getGenerationHistory(): GenerationMetadata[] {
  const history = loadHistory();
  return history.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 画像URLで検索
 */
export function findMetadataByImageUrl(imageUrl: string): GenerationMetadata | null {
  const history = loadHistory();
  return history.find(item => item.imageUrl === imageUrl) || null;
}

/**
 * アーティストIDで絞り込み
 */
export function getHistoryByArtist(artistId: string): GenerationMetadata[] {
  const history = loadHistory();
  return history
    .filter(item => item.artistId === artistId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 修正履歴を取得（親IDで検索）
 */
export function getModificationHistory(parentId: string): GenerationMetadata[] {
  const history = loadHistory();
  return history
    .filter(item => item.parentId === parentId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * 履歴をクリア
 */
export function clearHistory(): void {
  if (!isLocalStorageAvailable()) {
    console.warn('LocalStorage is not available');
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

/**
 * 履歴の統計情報を取得
 */
export function getHistoryStats(): {
  totalCount: number;
  artistCounts: Record<string, number>;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
} {
  const history = loadHistory();
  
  const artistCounts: Record<string, number> = {};
  let oldestTimestamp: number | null = null;
  let newestTimestamp: number | null = null;
  
  history.forEach(item => {
    // アーティスト別カウント
    artistCounts[item.artistId] = (artistCounts[item.artistId] || 0) + 1;
    
    // タイムスタンプの範囲
    if (oldestTimestamp === null || item.timestamp < oldestTimestamp) {
      oldestTimestamp = item.timestamp;
    }
    if (newestTimestamp === null || item.timestamp > newestTimestamp) {
      newestTimestamp = item.timestamp;
    }
  });
  
  return {
    totalCount: history.length,
    artistCounts,
    oldestTimestamp,
    newestTimestamp,
  };
}

/**
 * 古い履歴を削除（指定日数より前）
 */
export function pruneOldHistory(daysToKeep: number): number {
  const history = loadHistory();
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  
  const filteredHistory = history.filter(item => item.timestamp >= cutoffTime);
  const removedCount = history.length - filteredHistory.length;
  
  if (removedCount > 0) {
    saveHistory(filteredHistory);
  }
  
  return removedCount;
}

/**
 * 履歴をエクスポート（JSON形式）
 */
export function exportHistory(): string {
  const history = getGenerationHistory();
  return JSON.stringify(history, null, 2);
}

/**
 * 履歴をインポート（JSON形式）
 */
export function importHistory(jsonData: string): { success: boolean; count: number; error?: string } {
  try {
    const importedHistory = JSON.parse(jsonData) as GenerationMetadata[];
    
    // バリデーション
    if (!Array.isArray(importedHistory)) {
      return { success: false, count: 0, error: 'Invalid data format' };
    }
    
    // Phase 10: imageIdは後方互換性のためバリデーションから除外
    const validHistory = importedHistory.filter(item =>
      item.id &&
      item.timestamp &&
      item.artistId &&
      item.userTheme &&
      item.structuredPrompt
    );
    
    if (validHistory.length === 0) {
      return { success: false, count: 0, error: 'No valid items found' };
    }
    
    // 既存の履歴とマージ（IDの重複を避ける）
    const existingHistory = loadHistory();
    const existingIds = new Set(existingHistory.map(item => item.id));
    
    const newItems = validHistory.filter(item => !existingIds.has(item.id));
    const mergedHistory = [...existingHistory, ...newItems];
    
    saveHistory(mergedHistory);
    
    return { success: true, count: newItems.length };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
