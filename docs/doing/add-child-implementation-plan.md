# 子供追加機能 実装計画

## 📋 概要

親が新しい子供のプロフィールを作成する機能を実装します。
既存の `/select-child` ページから「子供を追加」ボタンで遷移し、
新しい子供の情報を入力して登録できるようにします。

---

## 🎯 実装目標

### 必須機能
- ✅ 子供の名前入力（必須）
- ✅ 年齢選択（3-12歳、必須）
- ✅ Firestoreへの保存
- ✅ 親アカウントの `children` 配列への追加
- ✅ 登録後、子供選択画面に戻る

### オプション機能（後回し可）
- 学年選択
- アバター選択
- 生まれ年入力

---

## 📁 ファイル構成

### 新規作成
```
src/app/add-child/
  └── page.tsx          # 子供追加画面
```

### 修正
```
src/lib/firebase/firestore.ts    # createChildProfile関数は既存
src/lib/firebase/auth.ts          # addChildToParent関数を追加
src/contexts/AuthContext.tsx      # addChild関数を追加
```

---

## 🎨 UI設計

### 画面レイアウト

```
┌─────────────────────────────────────┐
│  ← 戻る                             │
├─────────────────────────────────────┤
│                                     │
│     👶 新しいお子さんを追加         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ お名前（ニックネーム）      │   │
│  │ ┌─────────────────────────┐ │   │
│  │ │ たろう                  │ │   │
│  │ └─────────────────────────┘ │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 年齢                        │   │
│  │ ┌───┬───┬───┬───┬───┐     │   │
│  │ │ 3 │ 4 │ 5 │ 6 │ 7 │ ... │   │
│  │ └───┴───┴───┴───┴───┘     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      追加する               │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### デザイン方針
- シンプルで分かりやすい
- 大きなボタンとフォーム
- 明るく親しみやすい色使い
- モバイル・タブレット対応

---

## 💻 実装詳細

### 1. `/add-child/page.tsx` の作成

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AddChildPage() {
  const { addChild, loading } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 年齢の選択肢（3-12歳）
  const ages = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!name.trim()) {
      setError('お名前を入力してください');
      return;
    }

    if (!age) {
      setError('年齢を選択してください');
      return;
    }

    try {
      setSubmitting(true);
      
      // 子供を追加
      const childId = await addChild(name.trim(), age);
      
      // 成功判定: childIdが返ってきたら成功
      if (childId) {
        console.log(`[AddChild] 子供の追加に成功: ${childId}`);
        // 成功したら子供選択画面に戻る
        router.push('/select-child');
      } else {
        throw new Error('子供IDが取得できませんでした');
      }
      
    } catch (err) {
      console.error('[AddChild] 子供の追加に失敗:', err);
      setError('子供の追加に失敗しました。もう一度お試しください。');
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* 戻るボタン */}
        <button
          onClick={handleBack}
          className="mb-6 text-blue-600 hover:text-blue-700 flex items-center gap-2"
        >
          <span>←</span>
          <span>戻る</span>
        </button>

        {/* タイトル */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">👶</div>
          <h1 className="text-3xl font-bold mb-2">
            新しいお子さんを追加
          </h1>
          <p className="text-gray-600">
            お子さんの情報を入力してください
          </p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          {/* エラーメッセージ */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {/* 名前入力 */}
          <div className="mb-6">
            <Label htmlFor="name" className="text-lg font-semibold mb-2 block">
              お名前（ニックネーム）
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="たろう"
              className="text-lg p-6"
              maxLength={20}
              disabled={submitting}
            />
            <p className="text-sm text-gray-500 mt-2">
              ひらがな、カタカナ、漢字で入力できます（最大20文字）
            </p>
          </div>

          {/* 年齢選択 */}
          <div className="mb-8">
            <Label className="text-lg font-semibold mb-3 block">
              年齢
            </Label>
            <div className="grid grid-cols-5 gap-3">
              {ages.map((ageOption) => (
                <button
                  key={ageOption}
                  type="button"
                  onClick={() => setAge(ageOption)}
                  disabled={submitting}
                  className={`
                    p-4 rounded-lg border-2 font-bold text-lg
                    transition-all hover:scale-105
                    ${age === ageOption
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                    }
                    ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {ageOption}歳
                </button>
              ))}
            </div>
          </div>

          {/* 送信ボタン */}
          <Button
            type="submit"
            disabled={submitting || !name.trim() || !age}
            className="w-full py-6 text-lg font-bold"
          >
            {submitting ? '追加中...' : '追加する'}
          </Button>
        </form>

        {/* 注意事項 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>※ 後から名前や年齢を変更することもできます</p>
        </div>
      </div>
    </div>
  );
}
```

---

### 2. `AuthContext.tsx` に `addChild` 関数を追加

```typescript
// src/contexts/AuthContext.tsx

// 既存のインターフェースに追加
interface AuthContextType {
  // ... 既存のプロパティ
  addChild: (name: string, age: number) => Promise<string>; // 追加
}

// AuthProviderコンポーネント内に追加
const addChild = async (name: string, age: number): Promise<string> => {
  if (!parentUserId) {
    throw new Error('親ユーザーがログインしていません');
  }

  try {
    // 1. 子供IDを生成（タイムスタンプ + ランダム文字列）
    const childId = `child_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 2. Firestoreに子供プロフィールを作成
    await createChildProfile(childId, name, age, parentUserId);

    // 3. 親アカウントのchildren配列に追加
    await addChildToParent(parentUserId, childId);

    // 4. ローカル状態を更新
    setChildrenIds((prev) => [...prev, childId]);

    console.log(`[AuthContext] 子供を追加しました: ${childId}`);
    return childId;

  } catch (error) {
    console.error('[AuthContext] 子供の追加に失敗:', error);
    throw error;
  }
};

// Providerのvalueに追加
return (
  <AuthContext.Provider
    value={{
      // ... 既存のプロパティ
      addChild, // 追加
    }}
  >
    {children}
  </AuthContext.Provider>
);
```

---

### 3. `firestore.ts` に `addChildToParent` 関数を追加

```typescript
// src/lib/firebase/firestore.ts

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
    console.warn(`[Firestore] 子供ID ${childId} は既に登録されています`);
    return;
  }

  // children配列に追加
  await updateDoc(userRef, {
    children: [...currentChildren, childId],
    'stats.totalChildren': currentChildren.length + 1,
    updatedAt: Timestamp.now(),
  });

  console.log(`[Firestore] 親 ${parentUserId} に子供 ${childId} を追加しました`);
}
```

---

## 🔄 処理フロー

### 子供追加の流れ

```
1. ユーザーが /add-child にアクセス
   ↓
2. 名前と年齢を入力
   ↓
3. 「追加する」ボタンをクリック
   ↓
4. バリデーション
   ├─ NG → エラーメッセージ表示
   └─ OK → 次へ
   ↓
5. AuthContext.addChild() を呼び出し
   ↓
6. 子供IDを生成（例: child_1707123456789_abc123）
   ↓
7. Firestoreに子供プロフィールを作成
   - Collection: children/{childId}
   - 初期統計情報も設定
   ↓
8. 親アカウントのchildren配列に追加
   - Collection: users/{parentUserId}
   - children: [..., childId]
   ↓
9. ローカル状態を更新
   - childrenIds に追加
   ↓
10. 成功判定
   - childIdが返ってきたか確認
   ├─ 成功 → /select-child にリダイレクト
   └─ 失敗 → エラーメッセージ表示、画面遷移しない
   ↓
11. 新しい子供が選択肢に表示される
```

---

## 🧪 テストシナリオ

### 正常系

1. **基本的な追加**
   - 名前: "たろう"
   - 年齢: 5歳
   - 結果: 正常に追加され、選択画面に表示される

2. **複数の子供を追加**
   - 1人目: "たろう", 5歳
   - 2人目: "はなこ", 7歳
   - 結果: 両方とも選択画面に表示される

3. **特殊文字を含む名前**
   - 名前: "太郎くん"
   - 年齢: 6歳
   - 結果: 正常に保存される

### 異常系

1. **名前が空**
   - 名前: ""
   - 結果: エラーメッセージ「お名前を入力してください」

2. **年齢未選択**
   - 名前: "たろう"
   - 年齢: 未選択
   - 結果: エラーメッセージ「年齢を選択してください」

3. **ネットワークエラー**
   - オフライン状態で追加
   - 結果: エラーメッセージ「子供の追加に失敗しました」

4. **親ユーザー未ログイン**
   - ログアウト状態でアクセス
   - 結果: ログイン画面にリダイレクト

---

## 🔒 セキュリティ考慮事項

### Firestoreセキュリティルール

```javascript
// 子供プロフィールの作成
match /children/{childId} {
  // 認証済みユーザーのみ作成可能
  allow create: if isAuthenticated() && 
    request.resource.data.parentUserId == request.auth.uid;
}

// 親アカウントの更新
match /users/{userId} {
  // 自分のアカウントのみ更新可能
  allow update: if isOwner(userId);
}
```

### バリデーション

- **クライアント側**
  - 名前: 1-20文字
  - 年齢: 3-12歳の範囲
  - 空白のみの名前は不可

- **サーバー側（Firestore Rules）**
  - parentUserIdが認証ユーザーと一致
  - 必須フィールドの存在確認

---

## 📊 データ構造

### 作成される子供プロフィール

```typescript
{
  childId: "child_1707123456789_abc123",
  parentUserId: "google_uid_abc123",
  name: "たろう",
  age: 5,
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
    averageScenesPerConversation: 0
  }
}
```

### 更新される親アカウント

```typescript
{
  userId: "google_uid_abc123",
  // ...
  children: [
    "child_1707123456789_abc123",  // 新しく追加
    // 既存の子供ID...
  ],
  stats: {
    totalChildren: 1,  // インクリメント
    // ...
  },
  updatedAt: Timestamp.now()
}
```

---

## 🎯 実装順序

### Phase 1: 基本機能（最優先）
1. ✅ `/add-child/page.tsx` の作成
2. ✅ `AuthContext.addChild()` の実装
3. ✅ `firestore.addChildToParent()` の実装
4. ✅ 基本的なバリデーション
5. ✅ エラーハンドリング

### Phase 2: UI改善（次）
1. ローディング状態の表示
2. 成功時のトースト通知
3. アニメーション追加
4. レスポンシブ対応の確認

### Phase 3: 拡張機能（後回し可）
1. 学年選択の追加
2. アバター選択機能
3. プレビュー機能
4. 編集機能（別画面）

---

## 🚀 デプロイ前チェックリスト

- [ ] 名前と年齢の入力が正常に動作
- [ ] Firestoreに正しくデータが保存される
- [ ] 親アカウントのchildren配列が更新される
- [ ] 追加後、選択画面に新しい子供が表示される
- [ ] エラーハンドリングが適切に動作
- [ ] モバイル・タブレットで表示確認
- [ ] Firestoreセキュリティルールの確認
- [ ] コンソールエラーがないことを確認

---

## 📝 今後の拡張案

### 短期
- 子供プロフィールの編集機能
- 子供の削除（論理削除）機能
- アバター画像の選択

### 中期
- 学年の自動計算（生まれ年から）
- 複数の子供を一括追加
- プロフィール写真のアップロード

### 長期
- 子供の興味・関心の設定
- 学習レベルのカスタマイズ
- 兄弟姉妹の関連付け

---

## まとめ

この実装計画に従って、シンプルで使いやすい子供追加機能を実装します。

**重要ポイント**:
1. 名前と年齢のみのシンプルな入力
2. Firestoreへの確実な保存
3. 親アカウントとの正しい関連付け
4. 分かりやすいエラーメッセージ
5. スムーズなUX

実装を開始しますか？
