# 認証設計 - 親子アカウント管理システム

## 🎯 要件整理

### 基本要件
1. **親**: Googleアカウントでログイン
2. **子供**: パスワード不要、親が管理
3. **紐付け**: 1人の親が複数の子供を管理
4. **判別**: ログイン後、どの子供として使用しているか識別

### ユースケース
- 親がログインして子供プロフィールを作成
- 子供が使用する際は、親のログイン状態で子供を選択
- 親は別画面で全ての子供の履歴を閲覧
- 将来的に複数デバイス対応

---

## 🏗️ 推奨設計: 親アカウント + 子供プロフィール方式

### アーキテクチャ概要

```
親（Googleアカウント）
  ├─ 子供1（プロフィール）
  ├─ 子供2（プロフィール）
  └─ 子供3（プロフィール）
```

### データ構造

```
firestore/
├── users/                          # 親アカウント
│   └── {parentUserId}/             # Google UID
│       ├── profile (document)
│       └── children (array)        # 子供IDのリスト
│
└── children/                       # 子供プロフィール
    └── {childId}/
        ├── profile (document)
        └── conversations/
            └── ...
```

---

## 📊 詳細データモデル

### 1. 親アカウント (`users/{parentUserId}`)

```typescript
interface ParentUser {
  userId: string;              // Google UID
  email: string;               // Googleメールアドレス
  displayName: string;         // 表示名
  photoURL?: string;           // プロフィール画像
  
  // 子供管理
  children: string[];          // 子供IDの配列
  activeChildId?: string;      // 現在選択中の子供ID
  
  // メタデータ
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  
  // 設定
  settings: {
    language: 'ja' | 'en';
    notifications: boolean;
  };
}
```

### 2. 子供プロフィール (`children/{childId}`)

```typescript
interface ChildProfile {
  childId: string;             // 一意識別子
  parentUserId: string;        // 親のGoogle UID
  
  // プロフィール
  name: string;                // ニックネーム
  age: number;                 // 年齢
  avatar?: string;             // アバター画像URL
  grade?: string;              // 学年（オプション）
  
  // 統計
  stats: {
    totalConversations: number;
    totalQuestions: number;
    favoriteTopics: string[];
    lastActivityAt: Timestamp;
  };
  
  // メタデータ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;           // アクティブ状態
}
```

### 3. セッション管理（LocalStorage）

```typescript
interface SessionState {
  parentUserId: string;        // 親のGoogle UID
  activeChildId: string;       // 現在使用中の子供ID
  childName: string;           // 子供の名前（表示用）
  lastUpdated: number;         // 最終更新時刻
}
```

---

## 🔐 認証フロー

### フロー1: 初回ログイン

```
1. 親がGoogleログインボタンをクリック
   ↓
2. Firebase Authentication でGoogle認証
   ↓
3. 親のユーザー情報を取得（Google UID, email, name）
   ↓
4. Firestore の users/{parentUserId} を確認
   ↓
5a. 存在しない → 新規ユーザー作成
5b. 存在する → ユーザー情報を読み込み
   ↓
6. 子供プロフィールが0件 → 子供作成画面へ
7. 子供プロフィールが1件以上 → 子供選択画面へ
```

### フロー2: 子供プロフィール作成

```
1. 親が「子供を追加」ボタンをクリック
   ↓
2. 子供情報入力フォーム表示
   - 名前（必須）
   - 年齢（必須）
   - アバター（オプション）
   ↓
3. 子供プロフィールを Firestore に保存
   - children/{childId} に作成
   - users/{parentUserId}.children に追加
   ↓
4. その子供を activeChildId に設定
   ↓
5. メイン画面へ遷移
```

### フロー3: 子供切り替え

```
1. 親が画面右上の子供アイコンをクリック
   ↓
2. 子供選択ドロップダウン表示
   ↓
3. 別の子供を選択
   ↓
4. activeChildId を更新
   - Firestore: users/{parentUserId}.activeChildId
   - LocalStorage: sessionState.activeChildId
   ↓
5. 画面をリロード（新しい子供の履歴を表示）
```

### フロー4: 再訪問時

```
1. ページ読み込み
   ↓
2. Firebase Authentication の状態を確認
   ↓
3a. ログイン済み → LocalStorage から activeChildId を取得
3b. 未ログイン → ログイン画面へ
   ↓
4. activeChildId が有効か確認
   ↓
5a. 有効 → メイン画面表示
5b. 無効 → 子供選択画面へ
```

---

## 💻 実装例

### 1. 認証コンテキスト

```typescript
// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { getParentUser, createParentUser, updateActiveChild } from '@/lib/firebase/auth';

interface AuthContextType {
  user: User | null;                    // Firebase User
  parentUserId: string | null;          // 親のUID
  activeChildId: string | null;         // 選択中の子供ID
  childrenIds: string[];                // 子供IDリスト
  loading: boolean;
  
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  selectChild: (childId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [parentUserId, setParentUserId] = useState<string | null>(null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [childrenIds, setChildrenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        setParentUserId(firebaseUser.uid);
        
        // 親のユーザー情報を取得
        const parentUser = await getParentUser(firebaseUser.uid);
        
        if (parentUser) {
          setChildrenIds(parentUser.children);
          setActiveChildId(parentUser.activeChildId || null);
        }
      } else {
        setParentUserId(null);
        setActiveChildId(null);
        setChildrenIds([]);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Googleログイン
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // 親のユーザー情報を取得または作成
      let parentUser = await getParentUser(firebaseUser.uid);
      
      if (!parentUser) {
        parentUser = await createParentUser({
          userId: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName || 'ユーザー',
          photoURL: firebaseUser.photoURL || undefined,
        });
      }
      
      setChildrenIds(parentUser.children);
      setActiveChildId(parentUser.activeChildId || null);
      
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    }
  };

  // ログアウト
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setParentUserId(null);
      setActiveChildId(null);
      setChildrenIds([]);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  // 子供を選択
  const selectChild = async (childId: string) => {
    if (!parentUserId) return;
    
    try {
      await updateActiveChild(parentUserId, childId);
      setActiveChildId(childId);
    } catch (error) {
      console.error('Failed to select child:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        parentUserId,
        activeChildId,
        childrenIds,
        loading,
        signInWithGoogle,
        signOut,
        selectChild,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### 2. 認証関連の操作関数

```typescript
// src/lib/firebase/auth.ts
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
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
  settings: {
    language: 'ja' | 'en';
    notifications: boolean;
  };
}

// 親ユーザーを取得
export async function getParentUser(userId: string): Promise<ParentUser | null> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as ParentUser;
  }
  
  return null;
}

// 親ユーザーを作成
export async function createParentUser(data: {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
}): Promise<ParentUser> {
  const parentUser: ParentUser = {
    ...data,
    children: [],
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    settings: {
      language: 'ja',
      notifications: true,
    },
  };

  await setDoc(doc(db, 'users', data.userId), parentUser);
  console.log(`[Auth] Created parent user: ${data.userId}`);
  
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
export async function updateActiveChild(
  userId: string,
  childId: string
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    activeChildId: childId,
  });
  console.log(`[Auth] Updated active child: ${childId}`);
}

// 子供を追加
export async function addChildToParent(
  userId: string,
  childId: string
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const currentChildren = docSnap.data().children || [];
    await updateDoc(docRef, {
      children: [...currentChildren, childId],
      activeChildId: childId, // 新しい子供を自動選択
    });
  }
}
```

### 3. ログイン画面

```typescript
// src/app/login/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/select-child');
    }
  }, [user, router]);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6">
          🔬 キッズサイエンスラボ
        </h1>
        <p className="text-gray-600 text-center mb-8">
          保護者の方はGoogleアカウントでログインしてください
        </p>
        
        <button
          onClick={signInWithGoogle}
          className="w-full bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            {/* Google Icon SVG */}
          </svg>
          Googleでログイン
        </button>
      </div>
    </div>
  );
}
```

### 4. 子供選択画面

```typescript
// src/app/select-child/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getChildProfile } from '@/lib/firebase/firestore';
import type { ChildProfile } from '@/lib/firebase/types';

export default function SelectChildPage() {
  const { parentUserId, childrenIds, selectChild, loading } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<ChildProfile[]>([]);

  useEffect(() => {
    if (!loading && !parentUserId) {
      router.push('/login');
    }
  }, [parentUserId, loading, router]);

  useEffect(() => {
    if (childrenIds.length > 0) {
      loadChildren();
    }
  }, [childrenIds]);

  const loadChildren = async () => {
    const profiles = await Promise.all(
      childrenIds.map(id => getChildProfile(id))
    );
    setChildren(profiles.filter(p => p !== null) as ChildProfile[]);
  };

  const handleSelectChild = async (childId: string) => {
    await selectChild(childId);
    router.push('/');
  };

  const handleAddChild = () => {
    router.push('/add-child');
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          どのお子さんが使いますか？
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {children.map((child) => (
            <button
              key={child.childId}
              onClick={() => handleSelectChild(child.childId)}
              className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="text-6xl mb-4">👦</div>
              <h2 className="text-xl font-bold mb-2">{child.name}</h2>
              <p className="text-gray-600">{child.age}歳</p>
              <p className="text-sm text-gray-500 mt-2">
                {child.stats.totalQuestions}個の質問
              </p>
            </button>
          ))}

          {/* 子供追加ボタン */}
          <button
            onClick={handleAddChild}
            className="bg-blue-50 border-2 border-dashed border-blue-300 p-6 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <div className="text-6xl mb-4">➕</div>
            <h2 className="text-xl font-bold text-blue-600">
              子供を追加
            </h2>
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔒 セキュリティルール（本番用）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 親ユーザー
    match /users/{userId} {
      // 自分のデータのみ読み書き可能
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 子供プロフィール
    match /children/{childId} {
      // 親のみ読み書き可能
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.parentUserId;
      
      // 会話ログ
      match /conversations/{conversationId} {
        allow read, write: if request.auth != null 
          && request.auth.uid == get(/databases/$(database)/documents/children/$(childId)).data.parentUserId;
        
        // シーン
        match /scenes/{sceneId} {
          allow read, write: if request.auth != null 
            && request.auth.uid == get(/databases/$(database)/documents/children/$(childId)).data.parentUserId;
        }
      }
    }
  }
}
```

---

## 🎨 UI/UX設計

### 画面構成

```
1. ログイン画面 (/login)
   - Googleログインボタン

2. 子供選択画面 (/select-child)
   - 子供カード一覧
   - 子供追加ボタン

3. 子供追加画面 (/add-child)
   - 名前入力
   - 年齢選択
   - アバター選択

4. メイン画面 (/)
   - ヘッダーに子供名表示
   - 子供切り替えドロップダウン
   - 質問入力エリア

5. 親ダッシュボード (/parent-dashboard)
   - 全ての子供の統計
   - 会話履歴一覧
```

### ヘッダーコンポーネント

```typescript
// src/components/Header.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getChildProfile } from '@/lib/firebase/firestore';

export function Header() {
  const { activeChildId, childrenIds, selectChild, signOut } = useAuth();
  const [childName, setChildName] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (activeChildId) {
      loadChildName();
    }
  }, [activeChildId]);

  const loadChildName = async () => {
    if (!activeChildId) return;
    const profile = await getChildProfile(activeChildId);
    if (profile) {
      setChildName(profile.name);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">🔬 キッズサイエンスラボ</h1>
        
        <div className="flex items-center gap-4">
          {/* 子供選択 */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              <span>👦 {childName}</span>
              <span>▼</span>
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-lg p-2 min-w-[200px]">
                {/* 子供リスト */}
                {/* ... */}
              </div>
            )}
          </div>
          
          {/* ログアウト */}
          <button
            onClick={signOut}
            className="text-gray-600 hover:text-gray-800"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
```

---

## 📱 モバイル対応

### PWA化の検討
- オフライン対応
- ホーム画面に追加
- プッシュ通知（親への学習レポート）

---

## 🚀 実装ステップ

### Phase 1: 認証基盤（1-2日）
1. Firebase Authentication 有効化
2. AuthContext 実装
3. ログイン画面作成

### Phase 2: 子供管理（1日）
1. 子供選択画面
2. 子供追加画面
3. プロフィール管理

### Phase 3: 統合（1日）
1. 既存コードへの統合
2. ヘッダーコンポーネント
3. セキュリティルール更新

---

## 💡 将来の拡張

### オプション機能
- 複数デバイス同期
- 家族共有（祖父母も閲覧可能）
- 子供の成長記録
- 学習レポート自動生成
- 先生アカウント（学校利用）

---

## 結論

**推奨アプローチ**: 親のGoogleアカウント + 子供プロフィール方式

**メリット**:
- ✅ シンプルで安全
- ✅ 子供はパスワード不要
- ✅ 親が完全にコントロール
- ✅ 複数の子供を簡単に管理
- ✅ 将来の拡張が容易

この設計で実装を進めることをお勧めします！
