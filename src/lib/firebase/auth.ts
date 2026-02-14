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
        console.log('[Auth] Fetching parent user:', userId);
        const db = await getFirebaseDb();
        console.log('[Auth] Firestore instance obtained');
        
        const docRef = doc(db, 'parents', userId);
        console.log('[Auth] Document reference created');
        
        // オフラインエラーを回避するため、タイムアウトとリトライを実装
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Auth] Attempt ${attempt}/${maxRetries} to fetch document`);
                const docSnap = await getDoc(docRef);
                console.log('[Auth] Document fetch complete, exists:', docSnap.exists());

                if(docSnap.exists()) {
                    const data = docSnap.data() as ParentUser;
                    console.log('[Auth] Parent user data:', { userId: data.userId, children: data.children });
                    return data;
                }

                console.log('[Auth] Parent user not found');
                return null;
            } catch (fetchError: unknown) {
                lastError = fetchError as Error;
                const errorMessage = lastError?.message || String(fetchError);
                console.warn(`[Auth] Attempt ${attempt} failed:`, errorMessage);
                
                // オフラインエラーの場合は短い待機後にリトライ
                if (errorMessage.includes('offline') && attempt < maxRetries) {
                    console.log(`[Auth] Retrying in ${attempt * 500}ms...`);
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
        console.error('[Auth] All retry attempts failed');
        throw lastError || new Error('Failed to fetch parent user after retries');
    } catch (error) {
        console.error('[Auth] Error fetching parent user:', error);
        throw error;
    }
}

// 親ユーザーを作成
export async function createParentUser(data: {userId: string; email: string; displayName: string; photoURL?: string;}): Promise<ParentUser> {
    try {
        console.log('[Auth] Creating parent user:', data.userId);
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
        console.log('[Auth] 親ユーザーの作成成功');
        
        return parentUser;
    } catch (error) {
        console.error('[Auth] Error creating parent user:', error);
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
    
    console.log('[Auth]アクティブな子供の更新の成功');
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

  console.log(`[Auth] 親 ${parentUserId} に子供 ${childId} を追加しました`);
}