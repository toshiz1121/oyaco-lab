/**
 * Firebase Storage 画像アップロードユーティリティ
 * 
 * 結合画像（4パネル）1枚のみをFirebase Storageに保存する
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from './config';

/**
 * Base64データをBlobに変換
 */
function base64ToBlob(base64Data: string): Blob {
  const parts = base64Data.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

/**
 * 会話の結合画像をFirebase Storageにアップロード
 * 
 * @param childId - 子供のID
 * @param conversationId - 会話ID
 * @param base64Data - Base64エンコードされた画像データ
 * @param maxRetries - 最大リトライ回数
 * @returns ダウンロードURL
 */
export async function uploadConversationImage(
  childId: string,
  conversationId: string,
  base64Data: string,
  maxRetries = 2
): Promise<string> {
  const storage = getFirebaseStorage();
  const path = `conversations/${childId}/${conversationId}/combined_image.png`;
  const storageRef = ref(storage, path);
  const blob = base64ToBlob(base64Data);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await uploadBytes(storageRef, blob, {
        contentType: blob.type,
        customMetadata: { uploadedAt: new Date().toISOString() },
      });
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error(`[Storage] Upload failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
    }
  }

  throw new Error('Upload failed after all retries');
}
