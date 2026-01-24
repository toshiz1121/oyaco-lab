/**
 * Migration Utilities
 * 
 * Phase 9.5からPhase 10への移行処理
 * LocalStorageのメタデータをIndexedDB統合形式に変換
 */

import { getGenerationHistory, saveGenerationMetadata } from './generation-history';
import { saveImage } from './image-storage';

const MIGRATION_KEY = 'masterpiece_migration_status';

/**
 * マイグレーションが完了しているかチェック
 */
export function isMigrationCompleted(): boolean {
  try {
    const status = localStorage.getItem(MIGRATION_KEY);
    return status === 'completed';
  } catch {
    return false;
  }
}

/**
 * マイグレーション完了をマーク
 */
export function markMigrationCompleted(): void {
  try {
    localStorage.setItem(MIGRATION_KEY, 'completed');
  } catch (error) {
    console.error('Failed to mark migration as completed:', error);
  }
}

/**
 * Phase 9.5からPhase 10へのマイグレーション
 * 
 * 処理内容:
 * 1. LocalStorageから既存のメタデータを読み込み
 * 2. imageUrlが存在する場合、IndexedDBに保存
 * 3. imageIdを生成してメタデータを更新
 * 4. 更新されたメタデータをLocalStorageに保存
 * 
 * @returns マイグレーション結果
 */
export async function migrateToIndexedDB(): Promise<{
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}> {
  const history = getGenerationHistory();
  const errors: string[] = [];
  let migratedCount = 0;
  let skippedCount = 0;
  
  console.log(`Starting migration: ${history.length} items found`);
  
  for (const metadata of history) {
    try {
      // imageIdが既に存在する場合はスキップ（Phase 10形式）
      if (metadata.imageId) {
        skippedCount++;
        continue;
      }
      
      // imageUrlが存在しない場合もスキップ（画像データなし）
      if (!metadata.imageUrl) {
        skippedCount++;
        continue;
      }
      
      // imageIdを生成
      const imageId = `img_${metadata.timestamp}_${metadata.id}`;
      
      // 画像をIndexedDBに保存
      await saveImage(imageId, metadata.imageUrl);
      
      // メタデータを更新
      const updatedMetadata = {
        ...metadata,
        imageId,
      };
      
      // LocalStorageに保存（imageUrlは自動的に除外される）
      await saveGenerationMetadata(updatedMetadata, metadata.imageUrl);
      
      migratedCount++;
      
      if (migratedCount % 10 === 0) {
        console.log(`Migration progress: ${migratedCount} items migrated`);
      }
    } catch (error) {
      const errorMessage = `Failed to migrate ${metadata.id}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);
      console.error(errorMessage);
    }
  }
  
  const success = errors.length === 0;
  
  console.log(`Migration completed: ${migratedCount} migrated, ${skippedCount} skipped, ${errors.length} errors`);
  
  return {
    success,
    migratedCount,
    skippedCount,
    errors,
  };
}

/**
 * マイグレーション状態をリセット（デバッグ用）
 */
export function resetMigrationStatus(): void {
  try {
    localStorage.removeItem(MIGRATION_KEY);
    console.log('Migration status reset');
  } catch (error) {
    console.error('Failed to reset migration status:', error);
  }
}
