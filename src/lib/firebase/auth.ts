/**
 * 親ユーザー関連のFirestore操作（クライアントサイド専用）
 * 
 * クライアントSDK（firebase/firestore）を使用。
 * サーバーサイドからは使用しないこと。
 */

import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { getFirebaseDb } from './config';
import type { ParentUser } from './types';

// 親ユーザーを取得する
export async function getParentUser(userId: string): Promise<ParentUser | null> {
    try {
        const db = await getFirebaseDb();
        
        const docRef = doc(db, 'parents', userId);
        
        // オフラインエラーを回避するため、タイムアウトとリトライを実装
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const docSnap = await getDoc(docRef);

                if(docSnap.exists()) {
                    const data = docSnap.data() as ParentUser;
                    return data;
                }

                return null;
            } catch (fetchError: unknown) {
                lastError = fetchError as Error;
                const errorMessage = lastError?.message || String(fetchError);
                console.warn(`[Auth] 試行 ${attempt} 回目失敗:`, errorMessage);
                
                // オフラインエラーの場合は短い待機後にリトライ
                if (errorMessage.includes('offline') && attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 500));
                    continue;
                }
                
                // その他のエラーは即座にスロー
                if (!errorMessage.includes('offline')) {
                    throw fetchError;
                }
            }
        }
        
        // 全てのリトライが失敗した場合
        console.error('[Auth] 全てのリトライが失敗しました');
        throw lastError || new Error('リトライ後も親ユーザーの取得に失敗しました');
    } catch (error) {
        console.error('[Auth] 親ユーザーの取得に失敗:', error);
        throw error;
    }
}

// 親ユーザーを作成
export async function createParentUser(data: {userId: string; email: string; displayName: string; photoURL?: string;}): Promise<ParentUser> {
    try {
        const db = await getFirebaseDb();
        
        // 親ユーザーのデータを整理
        const now = Timestamp.now();
        const parentUser: ParentUser = {
            ...data,
            children: [],
            createdAt: now,
            lastLoginAt: now,
            updatedAt: now,
            settings: {
                language: 'ja',
                notifications: true,
            },
        };

        await setDoc(doc(db, 'parents', data.userId), parentUser);
        
        return parentUser;
    } catch (error) {
        console.error('[Auth] 親ユーザーの作成に失敗:', error);
        throw error;
    }
}

// 最終ログイン時刻を更新
export async function updateLastLogin(userId: string): Promise<void> {
  const db = await getFirebaseDb();
  const docRef = doc(db, 'parents', userId);
  await updateDoc(docRef, {
    lastLoginAt: Timestamp.now(),
  });
}

// アクティブな子供を更新
export async function updateActiveChild(userId: string, childId: string) {
    const db = await getFirebaseDb();
    const docRef = doc(db, 'parents', userId);
    await updateDoc(docRef, {
        activeChildId: childId,
    });
}

/**
 * 親アカウントのchildren配列に子供IDを追加
 */
export async function addChildToParent(
  parentUserId: string,
  childId: string
): Promise<void> {
  const db = await getFirebaseDb();
  const userRef = doc(db, 'parents', parentUserId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('親ユーザーが見つかりません');
  }

  const currentChildren = userSnap.data().children || [];

  // 重複チェック
  if (currentChildren.includes(childId)) {
    console.warn(`[Auth] 子供ID ${childId} は既に登録されています`);
    return;
  }

  // children配列に追加
  await updateDoc(userRef, {
    children: [...currentChildren, childId],
    activeChildId: childId, // 新しい子供を自動選択
    lastLoginAt: Timestamp.now(),
  });
}