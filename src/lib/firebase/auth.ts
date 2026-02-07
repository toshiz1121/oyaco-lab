import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from './config';

export interface ParentUser {
    userId: string;
    email: string;
    displayName: string;
    photoURL?: string;
    children: string[];
    activeChildId?: string;
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
}

// 親ユーザーを取得する
export async function getParentUser(userId: string): Promise<ParentUser | null> {
    
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);

    if(docSnap.exists()) {
        return docSnap.data() as ParentUser;
    }

    return null;
}

// 親ユーザーを作成
export async function createParentUser(data: {userId: string; email: string; displayName: string; photoURL?: string;}): Promise<ParentUser> {

    // 親ユーザーのデータを整理
    const parentUser: ParentUser = {
        ...data,
        children: [],
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'users', data.userId), parentUser);
    console.log('[Auth] 親ユーザーの作成成功');
    
    return parentUser;
}

// 最終ログイン時刻を更新
export async function updateLastLogin(userId: string): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    lastLoginAt: Timestamp.now(),
  });
}

// アクティブな子供を更新
export async function updateActiveChild(userId: string, childId: string) {

    const docRef = doc(db, 'users', userId);
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
  const userRef = doc(db, 'users', parentUserId);
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