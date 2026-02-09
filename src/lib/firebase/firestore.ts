/**
 * Firestore データ操作関数
 * 
 * 子供プロフィール、会話、シーンのCRUD操作を提供
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import type { ChildProfile, ConversationMetadata, ConversationScene } from './types';

// ========================================
// 子供プロフィール操作
// ========================================

/**
 * 子供のプロフィールを作成
 */
export async function createChildProfile(
  childId: string,
  name: string,
  age: number,
  parentUserId: string
): Promise<ChildProfile> {
  const db = getFirebaseDb();
  const profile: ChildProfile = {
    childId,
    name,
    age,
    parentUserId,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    stats: {
      totalConversations: 0,
      totalQuestions: 0,
      totalScenes: 0,
      favoriteTopics: [],
      favoriteExperts: [],
      lastActivityAt: Timestamp.now(),
      averageScenesPerConversation: 0,
    },
  };

  await setDoc(doc(db, 'children', childId), profile);
  console.log(`[Firestore] Created child profile: ${childId}`);
  return profile;
}

/**
 * 子供のプロフィールを取得
 */
export async function getChildProfile(childId: string): Promise<ChildProfile | null> {
  const db = getFirebaseDb();
  const docRef = doc(db, 'children', childId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as ChildProfile;
  }
  
  return null;
}

/**
 * 子供のプロフィールを更新
 */
export async function updateChildProfile(
  childId: string,
  updates: Partial<ChildProfile>
): Promise<void> {
  const db = getFirebaseDb();
  const docRef = doc(db, 'children', childId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
  console.log(`[Firestore] Updated child profile: ${childId}`);
}

// ========================================
// 会話操作
// ========================================

/**
 * 新しい会話を作成
 */
export async function createConversation(
  childId: string,
  conversationId: string,
  question: string,
  curiosityType: string,
  selectedExpert: string,
  selectionReason?: string
): Promise<ConversationMetadata> {
  console.log('[Firestore] createConversation called', { childId, conversationId });
  
  const db = getFirebaseDb();
  const metadata: ConversationMetadata = {
    conversationId,
    childId,
    question,
    questionTimestamp: Timestamp.now(),
    curiosityType,
    selectedExpert,
    selectionReason,
    status: 'in_progress',
    totalScenes: 0,
    createdAt: Timestamp.now(),
  };

  const conversationRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId
  );
  
  console.log('[Firestore] Writing to path:', conversationRef.path);
  
  try {
    await setDoc(conversationRef, metadata);
    console.log(`[Firestore] ✅ Created conversation: ${conversationId}`);
    return metadata;
  } catch (error) {
    console.error('[Firestore] ❌ Failed to create conversation:', error);
    throw error;
  }
}

/**
 * 会話を完了状態に更新
 */
export async function completeConversation(
  childId: string,
  conversationId: string,
  totalScenes: number,
  duration?: number,
  agentPipeline?: { selectedAgent: string; selectionReason: string; educatorReview?: { approved: boolean; feedback: string }; processingTimeMs: number }
): Promise<void> {
  console.log('[Firestore] completeConversation called', { childId, conversationId, totalScenes });
  
  const db = getFirebaseDb();
  const conversationRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId
  );

  try {
    const updateData: Record<string, unknown> = {
      status: 'completed',
      completedAt: Timestamp.now(),
      totalScenes,
      duration,
    };

    if (agentPipeline) {
      updateData.agentPipeline = agentPipeline;
    }

    await updateDoc(conversationRef, updateData);
    console.log('[Firestore] ✅ Conversation marked as completed');

    // 子供の統計情報を更新
    const childRef = doc(db, 'children', childId);
    const childSnap = await getDoc(childRef);
    
    if (childSnap.exists()) {
      const currentStats = childSnap.data().stats;
      const newTotalConversations = currentStats.totalConversations + 1;
      const newTotalScenes = currentStats.totalScenes + totalScenes;
      
      await updateDoc(childRef, {
        'stats.totalConversations': newTotalConversations,
        'stats.totalQuestions': currentStats.totalQuestions + 1,
        'stats.totalScenes': newTotalScenes,
        'stats.lastActivityAt': Timestamp.now(),
        'stats.averageScenesPerConversation': Math.round(newTotalScenes / newTotalConversations),
        updatedAt: Timestamp.now(),
      });
      console.log('[Firestore] ✅ Child stats updated');
    } else {
      console.warn('[Firestore] ⚠️ Child profile not found, skipping stats update');
    }

    console.log(`[Firestore] ✅ Completed conversation: ${conversationId}`);
  } catch (error) {
    console.error('[Firestore] ❌ Failed to complete conversation:', error);
    throw error;
  }
}

/**
 * 会話を取得
 */
export async function getConversation(
  childId: string,
  conversationId: string
): Promise<ConversationMetadata | null> {
  const db = getFirebaseDb();
  const docRef = doc(db, 'children', childId, 'conversations', conversationId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as ConversationMetadata;
  }
  
  return null;
}

/**
 * 最近の会話を取得
 */
export async function getRecentConversations(
  childId: string,
  limitCount: number = 10
): Promise<ConversationMetadata[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'children', childId, 'conversations'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationMetadata);
}

// ========================================
// シーン操作
// ========================================

/**
 * シーンを追加
 */
export async function addScene(
  childId: string,
  conversationId: string,
  scene: Omit<ConversationScene, 'createdAt'>
): Promise<void> {
  const db = getFirebaseDb();
  const sceneRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId,
    'scenes',
    scene.sceneId
  );

  const sceneData: ConversationScene = {
    ...scene,
    createdAt: Timestamp.now(),
  };

  await setDoc(sceneRef, sceneData);
  console.log(`[Firestore] Added scene: ${scene.sceneId}`);
}

/**
 * 複数のシーンを一括追加（バッチ処理）
 */
export async function addScenesBatch(
  childId: string,
  conversationId: string,
  scenes: Omit<ConversationScene, 'createdAt'>[]
): Promise<void> {
  console.log('[Firestore] addScenesBatch called', { childId, conversationId, sceneCount: scenes.length });
  
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  scenes.forEach((scene) => {
    const sceneRef = doc(
      db,
      'children',
      childId,
      'conversations',
      conversationId,
      'scenes',
      scene.sceneId
    );

    const sceneData: ConversationScene = {
      ...scene,
      createdAt: Timestamp.now(),
    };

    batch.set(sceneRef, sceneData);
  });

  try {
    await batch.commit();
    console.log(`[Firestore] ✅ Added ${scenes.length} scenes in batch`);
  } catch (error) {
    console.error('[Firestore] ❌ Failed to add scenes batch:', error);
    throw error;
  }
}

/**
 * 会話の全シーンを取得
 */
export async function getScenes(
  childId: string,
  conversationId: string
): Promise<ConversationScene[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'children', childId, 'conversations', conversationId, 'scenes'),
    orderBy('order', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationScene);
}

// ========================================
// クエリ
// ========================================

/**
 * 日付範囲で会話を取得
 */
export async function getConversationsByDateRange(
  childId: string,
  startDate: Date,
  endDate: Date
): Promise<ConversationMetadata[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'children', childId, 'conversations'),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationMetadata);
}

/**
 * トピック別に会話を取得
 */
export async function getConversationsByTopic(
  childId: string,
  curiosityType: string
): Promise<ConversationMetadata[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'children', childId, 'conversations'),
    where('curiosityType', '==', curiosityType),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationMetadata);
}

/**
 * 完了した会話のみを取得
 */
export async function getCompletedConversations(
  childId: string,
  limitCount: number = 20
): Promise<ConversationMetadata[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'children', childId, 'conversations'),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationMetadata);
}

// ========================================
// 親ダッシュボード用クエリ
// ========================================

/**
 * 親の全子供プロフィールを取得
 */
export async function getChildrenByParent(
  parentUserId: string
): Promise<ChildProfile[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'children'),
    where('parentUserId', '==', parentUserId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ChildProfile);
}

/**
 * 会話とシーンを一括取得
 */
export async function getConversationWithScenes(
  childId: string,
  conversationId: string
): Promise<{ conversation: ConversationMetadata; scenes: ConversationScene[] } | null> {
  const conversation = await getConversation(childId, conversationId);
  if (!conversation) return null;

  const scenes = await getScenes(childId, conversationId);
  return { conversation, scenes };
}

/**
 * 会話のフィードバック（ブックマーク・評価・メモ）を更新
 */
export async function updateConversationFeedback(
  childId: string,
  conversationId: string,
  feedback: {
    isBookmarked?: boolean;
    rating?: number;
    parentNotes?: string;
  }
): Promise<void> {
  const db = getFirebaseDb();
  const conversationRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId
  );
  await updateDoc(conversationRef, feedback);
  console.log(`[Firestore] Updated feedback for conversation: ${conversationId}`);
}

