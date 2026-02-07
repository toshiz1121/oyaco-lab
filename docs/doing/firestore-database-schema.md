# Firestore データベーススキーマ定義

## 📋 概要

キッズサイエンスラボの完全なFirestoreデータベース構造定義です。
認証設計を踏まえた親子アカウント管理システムに対応しています。

---

## 🗂️ コレクション構造

```
firestore/
├── users/                              # 親アカウント（Googleログイン）
│   └── {parentUserId}/                 # ドキュメントID = Google UID
│       ├── (profile fields)            # プロフィール情報
│       └── settings/                   # サブコレクション: 設定
│           └── preferences             # 詳細設定
│
├── children/                           # 子供プロフィール
│   └── {childId}/                      # ドキュメントID = 自動生成ID
│       ├── (profile fields)            # プロフィール情報
│       └── conversations/              # サブコレクション: 会話履歴
│           └── {conversationId}/       # ドキュメントID = 自動生成ID
│               ├── (metadata fields)   # 会話メタデータ
│               └── scenes/             # サブコレクション: シーン
│                   └── {sceneId}       # ドキュメントID = scene_1, scene_2...
│
└── analytics/                          # 分析データ（オプション）
    └── {childId}/
        ├── weekly_summary              # 週次サマリー
        └── monthly_summary             # 月次サマリー
```

---

## 📊 詳細スキーマ定義

### 1. users コレクション

**パス**: `users/{parentUserId}`

**説明**: 親アカウント（Googleログインユーザー）の情報

#### ドキュメント構造

```typescript
{
  // 基本情報
  userId: string;              // Google UID（ドキュメントIDと同じ）
  email: string;               // Googleメールアドレス
  displayName: string;         // 表示名
  photoURL?: string;           // プロフィール画像URL
  
  // 子供管理
  children: string[];          // 子供IDの配列 ["child_123", "child_456"]
  activeChildId?: string;      // 現在選択中の子供ID
  
  // タイムスタンプ
  createdAt: Timestamp;        // アカウント作成日時
  lastLoginAt: Timestamp;      // 最終ログイン日時
  updatedAt: Timestamp;        // 最終更新日時
  
  // 設定
  settings: {
    language: string;          // 'ja' | 'en'
    notifications: boolean;    // 通知の有効/無効
    theme?: string;            // 'light' | 'dark'
  };
  
  // 統計（キャッシュ）
  stats?: {
    totalChildren: number;     // 登録子供数
    totalQuestions: number;    // 全子供の総質問数
  };
}
```

#### インデックス

```
- email (ASC)
- createdAt (DESC)
- lastLoginAt (DESC)
```

#### 例

```json
{
  "userId": "google_uid_abc123",
  "email": "parent@example.com",
  "displayName": "山田太郎",
  "photoURL": "https://lh3.googleusercontent.com/...",
  "children": ["child_1234567890_abc", "child_1234567891_def"],
  "activeChildId": "child_1234567890_abc",
  "createdAt": "2024-02-06T10:00:00Z",
  "lastLoginAt": "2024-02-06T15:30:00Z",
  "updatedAt": "2024-02-06T15:30:00Z",
  "settings": {
    "language": "ja",
    "notifications": true,
    "theme": "light"
  },
  "stats": {
    "totalChildren": 2,
    "totalQuestions": 45
  }
}
```

---

### 2. children コレクション

**パス**: `children/{childId}`

**説明**: 子供のプロフィール情報

#### ドキュメント構造

```typescript
{
  // 基本情報
  childId: string;             // 子供の一意識別子（ドキュメントIDと同じ）
  parentUserId: string;        // 親のGoogle UID（外部キー）
  
  // プロフィール
  name: string;                // ニックネーム（例: "たろう"）
  age: number;                 // 年齢（3-12）
  grade?: string;              // 学年（オプション: "年長", "小1"など）
  avatar?: string;             // アバター画像URL
  birthYear?: number;          // 生まれ年（オプション）
  
  // 状態
  isActive: boolean;           // アクティブ状態（削除フラグの代わり）
  
  // タイムスタンプ
  createdAt: Timestamp;        // 作成日時
  updatedAt: Timestamp;        // 最終更新日時
  
  // 統計情報（キャッシュ）
  stats: {
    totalConversations: number;    // 総会話数
    totalQuestions: number;        // 総質問数
    totalScenes: number;           // 総シーン数
    favoriteTopics: string[];      // 頻出トピック（上位5件）
    favoriteExperts: string[];     // よく選ばれる博士（上位3件）
    lastActivityAt: Timestamp;     // 最終活動日時
    averageScenesPerConversation: number;  // 平均シーン数
  };
  
  // 学習傾向（オプション）
  learningProfile?: {
    curiosityLevel: string;    // 'high' | 'medium' | 'low'
    preferredStyle: string;    // 'visual' | 'text' | 'mixed'
    attentionSpan: number;     // 平均会話時間（秒）
  };
}
```

#### インデックス

```
- parentUserId (ASC), createdAt (DESC)
- parentUserId (ASC), isActive (ASC)
- stats.lastActivityAt (DESC)
```

#### 例

```json
{
  "childId": "child_1234567890_abc",
  "parentUserId": "google_uid_abc123",
  "name": "たろう",
  "age": 5,
  "grade": "年長",
  "avatar": "https://storage.googleapis.com/avatars/boy1.png",
  "isActive": true,
  "createdAt": "2024-02-01T10:00:00Z",
  "updatedAt": "2024-02-06T15:30:00Z",
  "stats": {
    "totalConversations": 23,
    "totalQuestions": 23,
    "totalScenes": 115,
    "favoriteTopics": ["科学への好奇心", "自然への好奇心", "世界の仕組みへの好奇心"],
    "favoriteExperts": ["scientist", "biologist", "astronomer"],
    "lastActivityAt": "2024-02-06T15:30:00Z",
    "averageScenesPerConversation": 5
  },
  "learningProfile": {
    "curiosityLevel": "high",
    "preferredStyle": "visual",
    "attentionSpan": 180
  }
}
```

---

### 3. conversations サブコレクション

**パス**: `children/{childId}/conversations/{conversationId}`

**説明**: 子供とAIの会話記録

#### ドキュメント構造

```typescript
{
  // 識別情報
  conversationId: string;      // 会話ID（ドキュメントIDと同じ）
  childId: string;             // 子供ID（親ドキュメント参照）
  
  // 質問情報
  question: string;            // 子供の質問（例: "どうして空は青いの？"）
  questionTimestamp: Timestamp; // 質問日時
  
  // 分類情報
  curiosityType: string;       // 好奇心のタイプ
  selectedExpert: string;      // 選ばれた博士（AgentRole）
  selectionReason?: string;    // 選定理由
  
  // ステータス
  status: string;              // 'in_progress' | 'completed' | 'error'
  
  // メタデータ
  totalScenes: number;         // シーン数
  duration?: number;           // 会話時間（秒）
  
  // タイムスタンプ
  createdAt: Timestamp;        // 作成日時
  completedAt?: Timestamp;     // 完了日時
  
  // 親のフィードバック（オプション）
  parentNotes?: string;        // 親のメモ
  isBookmarked?: boolean;      // ブックマーク
  rating?: number;             // 評価（1-5）
  
  // 技術情報（デバッグ用）
  metadata?: {
    modelVersion?: string;     // 使用したモデルバージョン
    generationTime?: number;   // 生成時間（ミリ秒）
    errorMessage?: string;     // エラーメッセージ
  };
}
```

#### インデックス

```
- childId (ASC), createdAt (DESC)
- childId (ASC), status (ASC), createdAt (DESC)
- childId (ASC), curiosityType (ASC), createdAt (DESC)
- childId (ASC), selectedExpert (ASC), createdAt (DESC)
- childId (ASC), isBookmarked (ASC), createdAt (DESC)
```

#### 例

```json
{
  "conversationId": "conv_1234567890_xyz",
  "childId": "child_1234567890_abc",
  "question": "どうして空は青いの？",
  "questionTimestamp": "2024-02-06T15:30:00Z",
  "curiosityType": "科学への好奇心",
  "selectedExpert": "scientist",
  "selectionReason": "光の性質について説明できる科学者が最適です",
  "status": "completed",
  "totalScenes": 5,
  "duration": 180,
  "createdAt": "2024-02-06T15:30:00Z",
  "completedAt": "2024-02-06T15:33:00Z",
  "parentNotes": "とても興味を持って聞いていました",
  "isBookmarked": true,
  "rating": 5,
  "metadata": {
    "modelVersion": "gemini-1.5-pro",
    "generationTime": 3500
  }
}
```

---

### 4. scenes サブコレクション

**パス**: `children/{childId}/conversations/{conversationId}/scenes/{sceneId}`

**説明**: 会話の各シーン（説明セグメント）

#### ドキュメント構造

```typescript
{
  // 識別情報
  sceneId: string;             // シーンID（例: "scene_1"）
  order: number;               // 表示順序（1, 2, 3...）
  
  // テキストコンテンツ
  script: string;              // 博士のセリフ（日本語）
  
  // 画像情報
  imagePromptUsed: string;     // 使用した画像プロンプト（英語）
  imageUrl: string;            // 生成された画像のURL
  imageHint: string;           // 画像のヒント（短い説明）
  imageGeneratedAt?: Timestamp; // 画像生成日時
  imageProvider?: string;      // 画像生成サービス（'unsplash' | 'vertex-ai'）
  
  // 音声情報
  audioUrl?: string;           // 音声ファイルのURL（Cloud Storage）
  audioGeneratedAt?: Timestamp; // 音声生成日時
  audioDuration?: number;      // 音声の長さ（秒）
  audioProvider?: string;      // 音声生成サービス（'vertex-ai' | 'web-speech'）
  
  // メタデータ
  createdAt: Timestamp;        // 作成日時
  
  // 技術情報（オプション）
  metadata?: {
    imageGenerationTime?: number;  // 画像生成時間（ミリ秒）
    audioGenerationTime?: number;  // 音声生成時間（ミリ秒）
    retryCount?: number;           // リトライ回数
  };
}
```

#### インデックス

```
- order (ASC)
```

#### 例

```json
{
  "sceneId": "scene_1",
  "order": 1,
  "script": "ほほう、いい質問じゃな！空が青く見えるのは、太陽の光と空気の関係があるんじゃよ。",
  "imagePromptUsed": "Japanese educational manga style. A friendly scientist in a white coat explaining to a 5-year-old child about the blue sky...",
  "imageUrl": "https://images.unsplash.com/photo-123456789",
  "imageHint": "科学者が子供に空の色について説明している",
  "imageGeneratedAt": "2024-02-06T15:30:15Z",
  "imageProvider": "unsplash",
  "audioUrl": "https://storage.googleapis.com/audio/scene_1.mp3",
  "audioGeneratedAt": "2024-02-06T15:30:20Z",
  "audioDuration": 8.5,
  "audioProvider": "vertex-ai",
  "createdAt": "2024-02-06T15:30:10Z",
  "metadata": {
    "imageGenerationTime": 2500,
    "audioGenerationTime": 1800,
    "retryCount": 0
  }
}
```

---

### 5. analytics コレクション（オプション）

**パス**: `analytics/{childId}`

**説明**: 子供の学習分析データ

#### weekly_summary ドキュメント

```typescript
{
  childId: string;
  weekStart: Timestamp;        // 週の開始日
  weekEnd: Timestamp;          // 週の終了日
  
  // 統計
  totalQuestions: number;      // 週の質問数
  totalConversations: number;  // 週の会話数
  totalScenes: number;         // 週のシーン数
  totalDuration: number;       // 週の総会話時間（秒）
  
  // トピック分析
  topTopics: Array<{
    topic: string;             // トピック名
    count: number;             // 出現回数
    percentage: number;        // 割合（%）
  }>;
  
  // 博士分析
  topExperts: Array<{
    expertId: string;          // 博士ID
    count: number;             // 選ばれた回数
    percentage: number;        // 割合（%）
  }>;
  
  // 活動パターン
  activityByDay: Array<{
    day: string;               // 曜日（'Monday', 'Tuesday'...）
    count: number;             // 質問数
  }>;
  
  activityByHour: Array<{
    hour: number;              // 時間帯（0-23）
    count: number;             // 質問数
  }>;
  
  // メタデータ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 例

```json
{
  "childId": "child_1234567890_abc",
  "weekStart": "2024-02-05T00:00:00Z",
  "weekEnd": "2024-02-11T23:59:59Z",
  "totalQuestions": 12,
  "totalConversations": 12,
  "totalScenes": 60,
  "totalDuration": 2160,
  "topTopics": [
    { "topic": "科学への好奇心", "count": 5, "percentage": 41.7 },
    { "topic": "自然への好奇心", "count": 4, "percentage": 33.3 },
    { "topic": "世界の仕組みへの好奇心", "count": 3, "percentage": 25.0 }
  ],
  "topExperts": [
    { "expertId": "scientist", "count": 5, "percentage": 41.7 },
    { "expertId": "biologist", "count": 4, "percentage": 33.3 },
    { "expertId": "astronomer", "count": 3, "percentage": 25.0 }
  ],
  "activityByDay": [
    { "day": "Monday", "count": 2 },
    { "day": "Tuesday", "count": 3 },
    { "day": "Wednesday", "count": 1 }
  ],
  "activityByHour": [
    { "hour": 15, "count": 4 },
    { "hour": 16, "count": 3 },
    { "hour": 19, "count": 5 }
  ],
  "createdAt": "2024-02-12T00:00:00Z",
  "updatedAt": "2024-02-12T00:00:00Z"
}
```

---

## 🔗 リレーションシップ

### データの関連性

```
users (親)
  ↓ 1:N
children (子供)
  ↓ 1:N
conversations (会話)
  ↓ 1:N
scenes (シーン)
```

### 外部キー

- `children.parentUserId` → `users.userId`
- `conversations.childId` → `children.childId`
- `analytics.childId` → `children.childId`

---

## 📏 データサイズ制限

### Firestore の制限

- **ドキュメントサイズ**: 最大 1MB
- **コレクション深度**: 最大 100レベル
- **配列要素数**: 推奨 1,000個以下
- **フィールド名**: 最大 1,500バイト

### 本アプリの想定サイズ

| データ | 平均サイズ | 最大サイズ |
|--------|-----------|-----------|
| users ドキュメント | 1KB | 5KB |
| children ドキュメント | 2KB | 10KB |
| conversations ドキュメント | 1KB | 5KB |
| scenes ドキュメント | 500B | 2KB |

### スケーラビリティ

- **1人の親**: 最大10人の子供を想定
- **1人の子供**: 年間1,000会話を想定
- **1会話**: 平均5シーン

**計算例**:
- 1人の親 × 3人の子供 × 年間300会話 × 5シーン = 4,500ドキュメント/年
- ストレージ: 約 2.25MB/年（テキストのみ）

---

## 🔍 クエリパターン

### よく使うクエリ

#### 1. 親の全ての子供を取得
```typescript
const children = await getDocs(
  query(
    collection(db, 'children'),
    where('parentUserId', '==', parentUserId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  )
);
```

#### 2. 子供の最新10件の会話を取得
```typescript
const conversations = await getDocs(
  query(
    collection(db, 'children', childId, 'conversations'),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc'),
    limit(10)
  )
);
```

#### 3. 特定期間の会話を取得
```typescript
const conversations = await getDocs(
  query(
    collection(db, 'children', childId, 'conversations'),
    where('createdAt', '>=', startDate),
    where('createdAt', '<=', endDate),
    orderBy('createdAt', 'desc')
  )
);
```

#### 4. トピック別の会話を取得
```typescript
const conversations = await getDocs(
  query(
    collection(db, 'children', childId, 'conversations'),
    where('curiosityType', '==', '科学への好奇心'),
    orderBy('createdAt', 'desc')
  )
);
```

#### 5. ブックマークした会話を取得
```typescript
const bookmarked = await getDocs(
  query(
    collection(db, 'children', childId, 'conversations'),
    where('isBookmarked', '==', true),
    orderBy('createdAt', 'desc')
  )
);
```

#### 6. 会話の全シーンを取得
```typescript
const scenes = await getDocs(
  query(
    collection(db, 'children', childId, 'conversations', conversationId, 'scenes'),
    orderBy('order', 'asc')
  )
);
```

---

## 🔒 セキュリティルール

### 完全版ルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ヘルパー関数
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isParentOfChild(childId) {
      return isAuthenticated() && 
        request.auth.uid == get(/databases/$(database)/documents/children/$(childId)).data.parentUserId;
    }
    
    // 親ユーザー
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false; // 削除は管理者のみ
      
      // 設定サブコレクション
      match /settings/{document=**} {
        allow read, write: if isOwner(userId);
      }
    }
    
    // 子供プロフィール
    match /children/{childId} {
      allow read: if isParentOfChild(childId);
      allow create: if isAuthenticated() && 
        request.resource.data.parentUserId == request.auth.uid;
      allow update: if isParentOfChild(childId);
      allow delete: if false; // 論理削除のみ（isActive = false）
      
      // 会話ログ
      match /conversations/{conversationId} {
        allow read: if isParentOfChild(childId);
        allow create: if isParentOfChild(childId);
        allow update: if isParentOfChild(childId);
        allow delete: if false;
        
        // シーン
        match /scenes/{sceneId} {
          allow read: if isParentOfChild(childId);
          allow create: if isParentOfChild(childId);
          allow update: if isParentOfChild(childId);
          allow delete: if false;
        }
      }
    }
    
    // 分析データ
    match /analytics/{childId} {
      allow read: if isParentOfChild(childId);
      allow write: if false; // Cloud Functionsのみ書き込み可能
    }
  }
}
```

---

## 📊 インデックス設定

### Firebase Console で設定が必要なインデックス

#### children コレクション
```
Collection: children
Fields:
  - parentUserId (Ascending)
  - isActive (Ascending)
  - createdAt (Descending)
```

```
Collection: children
Fields:
  - parentUserId (Ascending)
  - stats.lastActivityAt (Descending)
```

#### conversations サブコレクション
```
Collection: children/{childId}/conversations
Fields:
  - status (Ascending)
  - createdAt (Descending)
```

```
Collection: children/{childId}/conversations
Fields:
  - curiosityType (Ascending)
  - createdAt (Descending)
```

```
Collection: children/{childId}/conversations
Fields:
  - selectedExpert (Ascending)
  - createdAt (Descending)
```

```
Collection: children/{childId}/conversations
Fields:
  - isBookmarked (Ascending)
  - createdAt (Descending)
```

---

## 🚀 マイグレーション戦略

### 既存データからの移行

既にLocalStorageでデータを保存している場合:

```typescript
// マイグレーションスクリプト例
async function migrateLocalStorageToFirestore(parentUserId: string, childId: string) {
  const sessions = getAllSessions(); // LocalStorageから取得
  
  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === 'assistant' && message.pairs) {
        // Firestoreに保存
        await logConversation({
          childId,
          question: session.title,
          curiosityType: estimateCuriosityType(session.title),
          selectedExpert: message.agentId || 'scientist',
          selectionReason: undefined,
          response: {
            agentId: message.agentId || 'scientist',
            text: message.content,
            pairs: message.pairs,
            // ...
          }
        });
      }
    }
  }
}
```

---

## 📝 まとめ

### コレクション一覧

| コレクション | 用途 | 親 | 推定ドキュメント数 |
|-------------|------|----|--------------------|
| users | 親アカウント | - | ユーザー数 |
| children | 子供プロフィール | users | ユーザー数 × 3 |
| conversations | 会話履歴 | children | 子供数 × 300/年 |
| scenes | シーン | conversations | 会話数 × 5 |
| analytics | 分析データ | - | 子供数 × 52/年 |

### データフロー

```
1. 親がログイン → users ドキュメント作成/更新
2. 子供を追加 → children ドキュメント作成
3. 質問を投げる → conversations ドキュメント作成
4. 回答生成 → scenes サブコレクション作成
5. 週次集計 → analytics ドキュメント作成（Cloud Functions）
```

このスキーマ定義に従って実装すれば、スケーラブルで保守性の高いシステムが構築できます！
