/**
 * サーバーサイド用 Firestore データ取得関数
 *
 * firebase-admin を使用し、Server Action 内から Firestore にアクセスする。
 * クライアント用の firestore.ts と同じデータ構造を返すが、
 * Admin SDK 経由でアクセスするため Node.js 上で動作する。
 *
 * 親エージェントの tools.ts から呼ばれる関数のみ定義。
 * 必要に応じて追加する。
 */

import { getAdminDb } from './admin';
import type { ChildProfile, ConversationMetadata } from './types';

/**
 * 子供のプロフィールを取得
 */
export async function getChildProfileServer(
  childId: string
): Promise<ChildProfile | null> {
  const db = getAdminDb();
  const doc = await db.collection('children').doc(childId).get();

  if (!doc.exists) return null;
  return doc.data() as ChildProfile;
}

/**
 * 最近の会話を取得（新しい順）
 */
export async function getRecentConversationsServer(
  childId: string,
  limitCount: number = 10
): Promise<ConversationMetadata[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection('children')
    .doc(childId)
    .collection('conversations')
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();

  return snapshot.docs.map(doc => doc.data() as ConversationMetadata);
}

/**
 * 日付範囲で会話を取得
 */
export async function getConversationsByDateRangeServer(
  childId: string,
  startDate: Date,
  endDate: Date
): Promise<ConversationMetadata[]> {
  const db = getAdminDb();
  
  console.log(`[Firestore Server] Querying conversations for childId: ${childId}`);
  console.log(`[Firestore Server] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const snapshot = await db
    .collection('children')
    .doc(childId)
    .collection('conversations')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .get();

  const conversations = snapshot.docs.map(doc => doc.data() as ConversationMetadata);
  
  // メモリ上でソート（orderByを削除してインデックス不要に）
  conversations.sort((a, b) => {
    const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
    return bTime - aTime; // 降順
  });
  
  console.log(`[Firestore Server] Found ${conversations.length} conversations`);
  
  return conversations;
}
