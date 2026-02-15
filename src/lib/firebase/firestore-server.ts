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
import { getCuriosityTypeById } from '../curiosity-types';

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
  
  return conversations;
}

/**
 * 新しい会話を作成（サーバーサイド版）
 */
export async function createConversationServer(
  childId: string,
  conversationId: string,
  question: string,
  curiosityType: string,
  selectedExpert: string,
  selectionReason?: string
): Promise<void> {
  const db = getAdminDb();
  const metadata = {
    conversationId,
    childId,
    question,
    questionTimestamp: new Date(),
    curiosityType,
    selectedExpert,
    selectionReason,
    status: 'in_progress',
    totalScenes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db
    .collection('children')
    .doc(childId)
    .collection('conversations')
    .doc(conversationId)
    .set(metadata);
}

/**
 * シーンを一括保存(サーバーサイド版)
 */
export async function addScenesBatchServer(
  childId: string,
  conversationId: string,
  scenes: Array<Omit<import('./types').ConversationScene, 'createdAt' | 'imageGeneratedAt'> & { imageGeneratedAt?: Date }>
): Promise<void> {
  const db = getAdminDb();
  const batch = db.batch();

  scenes.forEach((scene) => {
    const sceneRef = db
      .collection('children')
      .doc(childId)
      .collection('conversations')
      .doc(conversationId)
      .collection('scenes')
      .doc(scene.sceneId);

    batch.set(sceneRef, {
      ...scene,
      createdAt: new Date(),
    });
  });

  await batch.commit();
}

/**
 * 会話を完了状態に更新（サーバーサイド版）
 * 
 * 会話ステータスの更新に加え、子供プロフィールの統計情報も更新する:
 * - stats: totalConversations, totalQuestions, totalScenes, favoriteTopics, favoriteExperts, lastActivityAt, averageScenesPerConversation
 * - learningProfile: 会話が5回以上になったら自動計算
 */
export async function completeConversationServer(
  childId: string,
  conversationId: string,
  totalScenes: number,
  durationSeconds: number,
  agentPipeline?: unknown,
  curiosityType?: string,
  selectedExpert?: string
): Promise<void> {
  const db = getAdminDb();

  // 会話を完了状態に更新
  const updates: Record<string, unknown> = {
    status: 'completed',
    totalScenes,
    durationSeconds,
    completedAt: new Date(),
    updatedAt: new Date(),
  };

  if (agentPipeline) {
    updates.agentPipeline = agentPipeline;
  }

  await db
    .collection('children')
    .doc(childId)
    .collection('conversations')
    .doc(conversationId)
    .update(updates);

  // ── 子供プロフィールの統計情報を更新 ──
  try {
    const childRef = db.collection('children').doc(childId);
    const childSnap = await childRef.get();

    if (!childSnap.exists) {
      console.warn('[Firestore Server] 子供プロフィールが見つかりません。統計更新をスキップします');
      return;
    }

    const childData = childSnap.data() as ChildProfile;
    const currentStats = childData.stats || {
      totalConversations: 0,
      totalQuestions: 0,
      totalScenes: 0,
      favoriteTopics: [],
      favoriteExperts: [],
      lastActivityAt: new Date(),
      averageScenesPerConversation: 0,
    };

    const newTotalConversations = (currentStats.totalConversations || 0) + 1;
    const newTotalScenes = (currentStats.totalScenes || 0) + totalScenes;

    // favoriteTopics の更新: curiosityType名を追加して頻度順に上位5件
    const updatedTopics = updateRankedList(
      currentStats.favoriteTopics || [],
      curiosityType ? (getCuriosityTypeById(curiosityType)?.name || undefined) : undefined,
      5
    );

    // favoriteExperts の更新: selectedExpert を追加して頻度順に上位3件
    const updatedExperts = updateRankedList(
      currentStats.favoriteExperts || [],
      selectedExpert,
      3
    );

    const statsUpdate: Record<string, unknown> = {
      'stats.totalConversations': newTotalConversations,
      'stats.totalQuestions': (currentStats.totalQuestions || 0) + 1,
      'stats.totalScenes': newTotalScenes,
      'stats.lastActivityAt': new Date(),
      'stats.averageScenesPerConversation': Math.round(newTotalScenes / newTotalConversations),
      'stats.favoriteTopics': updatedTopics,
      'stats.favoriteExperts': updatedExperts,
      updatedAt: new Date(),
    };

    // learningProfile の自動計算（会話が5回以上の場合）
    if (newTotalConversations >= 5) {
      const learningProfile = await calculateLearningProfile(childId, newTotalConversations, durationSeconds, childData);
      if (learningProfile) {
        statsUpdate.learningProfile = learningProfile;
      }
    }

    await childRef.update(statsUpdate);

  } catch (statsError) {
    // stats更新の失敗は会話完了自体をブロックしない
    console.error('[Firestore Server] 子供の統計情報の更新に失敗:', statsError);
  }
}

/**
 * ランキングリストを更新する
 * 
 * 既存のリストに新しいアイテムを追加し、頻度順に上位N件を返す。
 * リストは「出現回数が多い順」で管理される。
 * 内部的にはアイテムを末尾に追加し、全体の頻度を再集計する。
 */
function updateRankedList(
  currentList: string[],
  newItem: string | undefined,
  maxItems: number
): string[] {
  // 作業用配列: 既存リスト + 新アイテム
  const all = [...currentList];
  if (newItem) {
    all.push(newItem);
  }

  // 頻度を集計
  const freq = new Map<string, number>();
  for (const item of all) {
    freq.set(item, (freq.get(item) || 0) + 1);
  }

  // 頻度順にソートして上位N件を返す
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([name]) => name);
}

/**
 * learningProfile を直近の会話データから計算する
 */
async function calculateLearningProfile(
  childId: string,
  totalConversations: number,
  latestDuration: number,
  childData: ChildProfile
): Promise<{ curiosityLevel: 'high' | 'medium' | 'low'; preferredStyle: 'visual' | 'text' | 'mixed'; attentionSpan: number } | null> {
  try {
    const db = getAdminDb();

    // 直近20件の会話を取得
    const snapshot = await db
      .collection('children')
      .doc(childId)
      .collection('conversations')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const conversations = snapshot.docs.map(d => d.data() as ConversationMetadata);
    const completed = conversations.filter(c => c.status === 'completed');

    if (completed.length < 3) return null;

    // curiosityLevel: 直近7日間の会話頻度で判定
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = completed.filter(c => {
      const createdAt = c.createdAt?.toDate?.() || (c.createdAt as unknown as Date);
      return createdAt >= sevenDaysAgo;
    }).length;

    let curiosityLevel: 'high' | 'medium' | 'low';
    if (recentCount >= 5) {
      curiosityLevel = 'high';
    } else if (recentCount >= 2) {
      curiosityLevel = 'medium';
    } else {
      curiosityLevel = 'low';
    }

    // preferredStyle: 平均シーン数で推定
    const avgScenes = completed.reduce((sum, c) => sum + (c.totalScenes || 0), 0) / completed.length;
    let preferredStyle: 'visual' | 'text' | 'mixed';
    if (avgScenes >= 4) {
      preferredStyle = 'visual';
    } else if (avgScenes <= 2) {
      preferredStyle = 'text';
    } else {
      preferredStyle = 'mixed';
    }

    // attentionSpan: 直近の会話の duration 平均（秒）
    const durations = completed
      .map(c => c.duration || (c as any).durationSeconds || 0)
      .filter(d => d > 0);
    // 最新の duration も含める
    if (latestDuration > 0) {
      durations.unshift(latestDuration);
    }
    const attentionSpan = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 120; // デフォルト2分

    return { curiosityLevel, preferredStyle, attentionSpan };

  } catch (error) {
    console.error('[Firestore Server] learningProfileの計算に失敗:', error);
    return null;
  }
}
