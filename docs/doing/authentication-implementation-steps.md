# 認証機能実装 - Step by Step

## 📋 実装の流れ

```
Step 1: Firebase Authentication 有効化
  ↓
Step 2: 認証関連ファイル作成
  ↓
Step 3: AuthContext 実装
  ↓
Step 4: ログイン画面作成
  ↓
Step 5: 子供選択・追加画面
  ↓
Step 6: 既存コードへの統合
  ↓
Step 7: セキュリティルール更新
```

---

## Step 1: Firebase Authentication 有効化

### 1-1. Firebase Console で設定

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. プロジェクトを選択
3. 左メニューから「Authentication」を選択
4. 「始める」をクリック
5. 「Sign-in method」タブを選択
6. 「Google」を選択
7. 「有効にする」をオンに
8. プロジェクトのサポートメール（自分のGmail）を選択
9. 「保存」をクリック

### 1-2. 承認済みドメインの確認

1. 「Settings」タブを選択
2. 「承認済みドメイン」セクションを確認
3. `localhost` が含まれていることを確認
4. 本番ドメインを追加（デプロイ時）

---

## Step 2: Firebase設定ファイル更新

### 2-1. config.ts に Authentication 追加

```typescript
// src/lib/firebase/config.ts に追加
import { getAuth, Auth } from 'firebase/auth';

// 既存のコードの後に追加
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);  // 追加
  console.log('[Firebase] Initialized successfully');
} else {
  app = getApps()[0];
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);  // 追加
  console.log('[Firebase] Using existing instance');
}

// エクスポートに auth を追加
export { app, db, storage, auth };
```

---

## Step 3: 認証関連ファイル作成

### 3-1. 親ユーザー型定義追加

```bash
# src/lib/firebase/types.ts に追加
```

```typescript
// src/lib/firebase/types.ts の最後に追加

/**
 * 親ユーザー（Googleアカウント）
 * Collection: users/{parentUserId}
 */
export interface ParentUser {
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

### 3-2. 認証操作関数作成

新しいファイルを作成:

```bash
touch src/lib/firebase/auth.ts
```

内容は前述の `auth.ts` を参照

### 3-3. AuthContext 作成

```bash
mkdir -p src/contexts
touch src/contexts/AuthContext.tsx
```

内容は前述の `AuthContext.tsx` を参照

---

## Step 4: Layout に AuthProvider を追加

### 4-1. src/app/layout.tsx を更新

```typescript
// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## Step 5: ログイン画面作成

### 5-1. ログインページ作成

```bash
mkdir -p src/app/login
touch src/app/login/page.tsx
```

```typescript
// src/app/login/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/select-child');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
      alert('ログインに失敗しました');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔬</div>
          <h1 className="text-3xl font-bold mb-2">
            キッズサイエンスラボ
          </h1>
          <p className="text-gray-600">
            保護者の方はGoogleアカウントでログインしてください
          </p>
        </div>
        
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoggingIn ? 'ログイン中...' : 'Googleでログイン'}
        </button>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます</p>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 6: 子供選択画面作成

### 6-1. 子供選択ページ

```bash
mkdir -p src/app/select-child
touch src/app/select-child/page.tsx
```

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
  const [loadingChildren, setLoadingChildren] = useState(true);

  useEffect(() => {
    if (!loading && !parentUserId) {
      router.push('/login');
    }
  }, [parentUserId, loading, router]);

  useEffect(() => {
    if (childrenIds.length > 0) {
      loadChildren();
    } else {
      setLoadingChildren(false);
    }
  }, [childrenIds]);

  const loadChildren = async () => {
    try {
      const profiles = await Promise.all(
        childrenIds.map(id => getChildProfile(id))
      );
      setChildren(profiles.filter(p => p !== null) as ChildProfile[]);
    } catch (error) {
      console.error('Failed to load children:', error);
    } finally {
      setLoadingChildren(false);
    }
  };

  const handleSelectChild = async (childId: string) => {
    try {
      await selectChild(childId);
      router.push('/');
    } catch (error) {
      console.error('Failed to select child:', error);
      alert('子供の選択に失敗しました');
    }
  };

  const handleAddChild = () => {
    router.push('/add-child');
  };

  if (loading || loadingChildren) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">
          どのお子さんが使いますか？
        </h1>
        <p className="text-gray-600 text-center mb-8">
          お子さんを選択してください
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {children.map((child) => (
            <button
              key={child.childId}
              onClick={() => handleSelectChild(child.childId)}
              className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <div className="text-6xl mb-4">👦</div>
              <h2 className="text-xl font-bold mb-2">{child.name}</h2>
              <p className="text-gray-600 mb-2">{child.age}歳</p>
              <div className="text-sm text-gray-500">
                <p>{child.stats.totalQuestions}個の質問</p>
                <p>{child.stats.totalConversations}回の会話</p>
              </div>
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
            <p className="text-sm text-gray-600 mt-2">
              新しいお子さんのプロフィールを作成
            </p>
          </button>
        </div>

        {children.length === 0 && (
          <div className="text-center mt-8 text-gray-600">
            <p>まだお子さんが登録されていません</p>
            <p className="text-sm mt-2">「子供を追加」ボタンから登録してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Step 7: 子供追加画面作成

### 7-1. 子供追加ページ

```bash
mkdir -p src/app/add-child
touch src/app/add-child/page.tsx
```

```typescript
// src/app/add-child/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createChildProfile } from '@/lib/firebase/firestore';
import { addChildToParent } from '@/lib/firebase/auth';

export default function AddChildPage() {
  const { parentUserId } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [age, setAge] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!parentUserId) {
      alert('ログインしてください');
      router.push('/login');
      return;
    }

    if (!name.trim()) {
      alert('名前を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      // 子供IDを生成
      const childId = `child_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 子供プロフィールを作成
      await createChildProfile(childId, name.trim(), age, parentUserId);
      
      // 親のchildrenリストに追加
      await addChildToParent(parentUserId, childId);
      
      // 選択画面に戻る
      router.push('/select-child');
      
    } catch (error) {
      console.error('Failed to create child:', error);
      alert('子供の追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          お子さんを追加
        </h1>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg">
          {/* 名前入力 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              お名前（ニックネーム）<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: たろう"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={20}
              required
            />
          </div>

          {/* 年齢選択 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              年齢<span className="text-red-500">*</span>
            </label>
            <select
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(a => (
                <option key={a} value={a}>{a}歳</option>
              ))}
            </select>
          </div>

          {/* ボタン */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? '追加中...' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Step 8: メインページに認証ガードを追加

### 8-1. src/app/page.tsx を更新

```typescript
// src/app/page.tsx の先頭に追加
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, activeChildId, loading } = useAuth();
  const router = useRouter();

  // 認証チェック
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!activeChildId) {
        router.push('/select-child');
      }
    }
  }, [user, activeChildId, loading, router]);

  if (loading || !user || !activeChildId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  // 既存のコンポーネント
  return (
    // ... 既存のコード
  );
}
```

---

## Step 9: useAgentChat を更新

### 9-1. activeChildId を使用するように修正

```typescript
// src/hooks/useAgentChat.ts
import { useAuth } from '@/contexts/AuthContext';

export function useAgentChat({ initialQuestion, onNewSession }: UseAgentChatProps) {
  const { activeChildId } = useAuth(); // 追加
  
  // 既存のコード...
  
  // childId を activeChildId から取得
  const { logCurrentConversation, isLogging } = useConversationLogger(
    activeChildId || 'child1' // フォールバック
  );
  
  // ... 残りのコード
}
```

---

## Step 10: セキュリティルール更新

### 10-1. Firestore ルール

Firebase Console → Firestore Database → ルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 親ユーザー
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 子供プロフィール
    match /children/{childId} {
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

## ✅ チェックリスト

### Phase 1: 基盤構築
- [ ] Firebase Authentication 有効化
- [ ] Google ログイン設定
- [ ] config.ts に auth 追加
- [ ] types.ts に ParentUser 追加
- [ ] auth.ts 作成
- [ ] AuthContext.tsx 作成

### Phase 2: 画面作成
- [ ] ログイン画面
- [ ] 子供選択画面
- [ ] 子供追加画面

### Phase 3: 統合
- [ ] Layout に AuthProvider 追加
- [ ] メインページに認証ガード
- [ ] useAgentChat 更新

### Phase 4: セキュリティ
- [ ] Firestore ルール更新
- [ ] 動作確認

---

## 🧪 テスト手順

### 1. ログインテスト
1. `/login` にアクセス
2. Googleログインボタンをクリック
3. Googleアカウントを選択
4. `/select-child` にリダイレクトされることを確認

### 2. 子供追加テスト
1. 「子供を追加」ボタンをクリック
2. 名前と年齢を入力
3. 「追加する」をクリック
4. `/select-child` に戻ることを確認
5. Firebase Console で `children/{childId}` が作成されていることを確認

### 3. 子供選択テスト
1. 子供カードをクリック
2. メイン画面に遷移することを確認
3. 質問を投げる
4. Firebase Console で会話が保存されることを確認

---

準備ができたら「認証機能の実装を開始します」と言ってください！
