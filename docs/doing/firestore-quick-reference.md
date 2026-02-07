# Firestore クイックリファレンス

開発中に素早く参照できるFirestoreスキーマのチートシート

---

## 📁 コレクション構造（簡易版）

```
users/{parentUserId}
  └─ children: string[]
  └─ activeChildId: string

children/{childId}
  └─ parentUserId: string
  └─ name: string
  └─ age: number
  └─ conversations/{conversationId}
      └─ question: string
      └─ curiosityType: string
      └─ selectedExpert: string
      └─ scenes/{sceneId}
          └─ order: number
          └─ script: string
          └─ imageUrl: string
```

---

## 🔑 主要フィールド

### users (親)
```typescript
{
  userId: string;           // Google UID
  email: string;
  displayName: string;
  children: string[];       // ["child_123", "child_456"]
  activeChildId: string;    // "child_123"
}
```

### children (子供)
```typescript
{
  childId: string;
  parentUserId: string;     // 外部キー
  name: string;             // "たろう"
  age: number;              // 5
  isActive: boolean;        // true
  stats: {
    totalConversations: number;
    totalQuestions: number;
    lastActivityAt: Timestamp;
  }
}
```

### conversations (会話)
```typescript
{
  conversationId: string;
  childId: string;
  question: string;         // "どうして空は青いの？"
  curiosityType: string;    // "科学への好奇心"
  selectedExpert: string;   // "scientist"
  status: string;           // "completed"
  totalScenes: number;      // 5
}
```

### scenes (シーン)
```typescript
{
  sceneId: string;          // "scene_1"
  order: number;            // 1
  script: string;           // "ほほう、いい質問じゃな！"
  imageUrl: string;
  imagePromptUsed: string;
}
```

---

## 🔍 よく使うクエリ

### 親の子供一覧
```typescript
const q = query(
  collection(db, 'children'),
  where('parentUserId', '==', parentUserId),
  where('isActive', '==', true)
);
```

### 子供の最新会話
```typescript
const q = query(
  collection(db, 'children', childId, 'conversations'),
  orderBy('createdAt', 'desc'),
  limit(10)
);
```

### 会話のシーン
```typescript
const q = query(
  collection(db, 'children', childId, 'conversations', conversationId, 'scenes'),
  orderBy('order', 'asc')
);
```

### トピック別会話
```typescript
const q = query(
  collection(db, 'children', childId, 'conversations'),
  where('curiosityType', '==', '科学への好奇心'),
  orderBy('createdAt', 'desc')
);
```

---

## 🔒 セキュリティルール（簡易版）

```javascript
// 親は自分のデータのみ
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}

// 子供は親のみアクセス可能
match /children/{childId} {
  allow read, write: if request.auth.uid == resource.data.parentUserId;
  
  // 会話とシーンも同様
  match /conversations/{conversationId} {
    allow read, write: if request.auth.uid == 
      get(/databases/$(database)/documents/children/$(childId)).data.parentUserId;
    
    match /scenes/{sceneId} {
      allow read, write: if request.auth.uid == 
        get(/databases/$(database)/documents/children/$(childId)).data.parentUserId;
    }
  }
}
```

---

## 📊 データサイズ目安

| データ | サイズ |
|--------|--------|
| users | 1-5KB |
| children | 2-10KB |
| conversations | 1-5KB |
| scenes | 500B-2KB |

---

## 🚀 CRUD操作

### 作成
```typescript
// 親ユーザー
await createParentUser({ userId, email, displayName });

// 子供
await createChildProfile(childId, name, age, parentUserId);

// 会話
await createConversation(childId, conversationId, question, ...);

// シーン
await addScenesBatch(childId, conversationId, scenes);
```

### 読み取り
```typescript
// 親ユーザー
const parent = await getParentUser(userId);

// 子供
const child = await getChildProfile(childId);

// 会話
const conv = await getConversation(childId, conversationId);

// シーン
const scenes = await getScenes(childId, conversationId);
```

### 更新
```typescript
// 親の最終ログイン
await updateLastLogin(userId);

// アクティブな子供
await updateActiveChild(userId, childId);

// 会話完了
await completeConversation(childId, conversationId, totalScenes);
```

---

## 🎯 好奇心のタイプ

- `科学への好奇心`
- `世界の仕組みへの好奇心`
- `自然への好奇心`
- `人間への好奇心`
- `技術への好奇心`
- `芸術への好奇心`
- `その他の好奇心`

---

## 👨‍🔬 博士（AgentRole）

- `scientist` - 科学者
- `biologist` - 生物学者
- `astronomer` - 天文学者
- `historian` - 歴史学者
- `educator` - 教育者
- `artist` - 芸術家

---

## 📝 ステータス

### 会話ステータス
- `in_progress` - 進行中
- `completed` - 完了
- `error` - エラー

---

## 🔗 リレーション

```
users.userId (PK)
  ↓
children.parentUserId (FK)
  ↓
conversations.childId (FK)
  ↓
scenes (親: conversations)
```

---

## 💡 ベストプラクティス

### DO ✅
- 統計情報はキャッシュする
- バッチ処理で複数ドキュメントを一度に書き込む
- インデックスを適切に設定
- セキュリティルールを厳格に

### DON'T ❌
- 1MBを超えるドキュメントを作成しない
- 配列に1000個以上の要素を入れない
- 深いネストを避ける（最大100レベル）
- 頻繁な更新でホットスポットを作らない

---

## 🐛 デバッグ

### Firebase Console
```
https://console.firebase.google.com/
→ プロジェクト選択
→ Firestore Database
→ データタブ
```

### ローカルエミュレータ
```bash
firebase emulators:start
```

### ログ確認
```typescript
console.log('[Firestore] Created:', docId);
console.error('[Firestore] Error:', error);
```

---

詳細は `firestore-database-schema.md` を参照してください。
