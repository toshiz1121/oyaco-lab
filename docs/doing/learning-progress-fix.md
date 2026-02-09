# 学習進捗分析の修正

## 🔍 問題

`analyzeLearningProgress` 関数で学習データが取得できず、「記録が見当たりません」と表示される。

## 原因

### 1. Firestoreクエリの問題

**ファイル**: `src/lib/firebase/firestore-server.ts`

```typescript
// 問題のあるコード
const snapshot = await db
  .collection('children')
  .doc(childId)
  .collection('conversations')
  .where('createdAt', '>=', startDate)
  .where('createdAt', '<=', endDate)
  .orderBy('createdAt', 'desc')  // ← orderByが複合インデックスを要求
  .get();
```

**問題点**:
- 複数の範囲フィルタ（`>=`, `<=`）と `orderBy` を組み合わせると、Firestoreの複合インデックスが必要
- インデックスが作成されていないため、クエリが失敗していた可能性

### 2. プロジェクトIDの不一致

**ファイル**: `src/lib/firebase/admin.ts`

```typescript
// ハードコードされたプロジェクトID
_adminApp = initializeApp({
  projectId: 'kids-kikkake-lab',  // ← 環境変数と異なる可能性
});
```

**問題点**:
- 環境変数 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` と異なるプロジェクトIDを使用
- Cloud Runでは環境変数で設定したプロジェクトと異なるプロジェクトにアクセスしていた

### 3. ログ出力の問題

**ファイル**: `src/lib/agents/parent-agent/tools.ts`

```typescript
console.log(`今週の会話${thisWeekConvs}`);  // ← [object Object] と表示される
```

## 🔧 修正内容

### 1. orderByを削除してメモリ上でソート

```typescript
export async function getConversationsByDateRangeServer(
  childId: string,
  startDate: Date,
  endDate: Date
): Promise<ConversationMetadata[]> {
  const db = getAdminDb();
  
  console.log(`[Firestore Server] Querying conversations for childId: ${childId}`);
  console.log(`[Firestore Server] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  // orderByを削除（インデックス不要に）
  const snapshot = await db
    .collection('children')
    .doc(childId)
    .collection('conversations')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .get();

  const conversations = snapshot.docs.map(doc => doc.data() as ConversationMetadata);
  
  // メモリ上でソート
  conversations.sort((a, b) => {
    const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
    return bTime - aTime; // 降順
  });
  
  console.log(`[Firestore Server] Found ${conversations.length} conversations`);
  
  return conversations;
}
```

**メリット**:
- 複合インデックスが不要
- シンプルなクエリで確実に動作
- 少量のデータならメモリソートで十分高速

### 2. プロジェクトIDを環境変数から取得

```typescript
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                  process.env.FIREBASE_PROJECT_ID || 
                  'kids-kikkake-lab';

_adminApp = initializeApp({
  projectId,
});

console.log(`[Firebase Admin] Initialized with projectId: ${projectId}`);
```

### 3. ログ出力を改善

```typescript
console.log(`[analyzeLearningProgress] 今週の会話数: ${thisWeekConvs.length}`);
console.log(`[analyzeLearningProgress] 今週の会話:`, JSON.stringify(thisWeekConvs.map(c => ({
  id: c.conversationId,
  question: c.question.substring(0, 30),
  status: c.status,
  createdAt: c.createdAt?.toDate?.()?.toISOString()
})), null, 2));
```

### 4. Firestoreインデックスファイルを作成

**ファイル**: `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

## 📋 デプロイ手順

### 1. Cloud Runの環境変数を確認

```bash
# 現在の環境変数を確認
gcloud run services describe kids-science-lab \
  --region=asia-northeast1 \
  --format="yaml(spec.template.spec.containers[0].env)"

# NEXT_PUBLIC_FIREBASE_PROJECT_ID が正しく設定されているか確認
```

### 2. Firestoreインデックスをデプロイ

```bash
# Firebase CLIでインデックスをデプロイ
firebase deploy --only firestore:indexes

# または、Firebase Consoleから手動で作成
# https://console.firebase.google.com/project/YOUR_PROJECT/firestore/indexes
```

### 3. アプリケーションを再デプロイ

```bash
# コードの変更をデプロイ
gcloud run deploy kids-science-lab \
  --source . \
  --region=asia-northeast1
```

### 4. ログで動作確認

```bash
# リアルタイムでログを監視
gcloud run services logs tail kids-science-lab --region=asia-northeast1

# 以下のログが表示されることを確認:
# [Firebase Admin] Initialized with projectId: YOUR_PROJECT_ID
# [Firestore Server] Querying conversations for childId: ...
# [Firestore Server] Found X conversations
# [analyzeLearningProgress] 今週の会話数: X
```

## ✅ 確認項目

- [ ] `firestore.indexes.json` が作成されている
- [ ] Cloud Runの環境変数 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` が正しい
- [ ] Firebase Admin SDKが正しいプロジェクトIDで初期化されている
- [ ] `getConversationsByDateRangeServer` が会話データを取得できている
- [ ] 親エージェントが学習進捗を正しく分析できている

## 🧪 テスト方法

### ローカルでテスト

```bash
# 環境変数を設定
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# 開発サーバーを起動
npm run dev

# 親ダッシュボードで学習進捗を確認
```

### Cloud Runでテスト

1. 親ダッシュボードにアクセス
2. 子供を選択
3. 「最近の学習状況について教えて」と質問
4. ログで以下を確認:
   - Firestoreクエリが実行されている
   - 会話データが取得されている
   - 学習進捗が正しく分析されている

## 📚 参考

- [Firestore Queries](https://firebase.google.com/docs/firestore/query-data/queries)
- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
