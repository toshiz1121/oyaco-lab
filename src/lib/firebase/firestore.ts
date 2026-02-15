/**
 * Firestore データ操作関数（クライアントサイド専用）
 * 
 * クライアントSDK（firebase/firestore）を使用。
 * サーバーサイドからは firestore-server.ts を使用すること。
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
  const db = await getFirebaseDb();
  
  // 年齢から生年を計算（現在の年 - 年齢）
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - age;
  
  const profile: ChildProfile = {
    childId,
    name,
    age,
    birthYear, // 生年を追加
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
  return profile;
}

/**
 * 子供のプロフィールを取得
 */
export async function getChildProfile(childId: string): Promise<ChildProfile | null> {
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
  const docRef = doc(db, 'children', childId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

// ========================================
// 会話操作
// ========================================

/**
 * 会話を取得
 */
export async function getConversation(
  childId: string,
  conversationId: string
): Promise<ConversationMetadata | null> {
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
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
}

/**
 * 会話の全シーンを取得
 */
export async function getScenes(
  childId: string,
  conversationId: string
): Promise<ConversationScene[]> {
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
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
  const db = await getFirebaseDb();
  const conversationRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId
  );
  await updateDoc(conversationRef, feedback);
}

