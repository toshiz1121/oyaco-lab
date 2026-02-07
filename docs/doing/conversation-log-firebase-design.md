# AIと子供の会話ログ - Firebase設計仕様書

## 📋 概要

子供とAIエージェントの会話データをFirebase Firestoreに保存し、親が閲覧・分析できるシステムの設計仕様書です。

## 🎯 要件

### 機能要件
1. **会話ログの保存**: 子供の質問、AIの回答、画像、音声データを記録
2. **親向けダッシュボード**: 子供の学習履歴を閲覧・分析
3. **二次利用**: データ分析、レポート生成、学習傾向の把握
4. **プライバシー保護**: 子供のデータを安全に管理

### 非機能要件
- リアルタイム性: 会話終了後すぐに保存
- スケーラビリティ: 複数の子供、大量の会話に対応
- コスト効率: Firestoreの読み書き回数を最適化
- データ整合性: トランザクション保証

---

## 🗂️ データベース設計

### 推奨構造: Firestoreコレクション設計

```
firestore/
├── children/                          # 子供のプロフィール
│   └── {childId}/
│       ├── profile (document)
│       └── conversations/             # サブコレクション
│           └── {conversationId}/
│               ├── metadata (document)
│               └── scenes/            # サブコレクション
│                   └── {sceneId} (document)
│
├── users/                             # 親アカウント
│   └── {userId}/
│       └── children (array of childIds)
│
└── analytics/                         # 集計データ（オプション）
    └── {childId}/
        └── weekly_summary (document)
```

---

## 📊 データモデル詳細

### 1. Children Collection (`children/{childId}`)

#### Profile Document
```typescript
interface ChildProfile {
  childId: string;              // 一意識別子
  name: string;                 // 子供の名前（ニックネーム可）
  age: number;                  // 年齢
  parentUserId: string;         // 親のユーザーID
  createdAt: Timestamp;         // 作成日時
  updatedAt: Timestamp;         // 更新日時
  
  // 統計情報（キャッシュ）
  stats: {
    totalConversations: number;
    totalQuestions: number;
    favoriteTopics: string[];   // 頻出トピック
    lastActivityAt: Timestamp;
  };
}
```

### 2. Conversations Subcollection (`children/{childId}/conversations/{conversationId}`)

#### Metadata Document
```typescript
interface ConversationMetadata {
  conversationId: string;       // 会話ID
  childId: string;              // 子供ID
  
  // 質問情報
  question: string;             // 子供の質問
  questionTimestamp: Timestamp; // 質問日時
  
  // 分類情報
  curiosityType: string;        // 好奇心のタイプ（例: "世界の仕組みへの好奇心"）
  selectedExpert: string;       // 選ばれた博士（AgentRole）
  selectionReason?: string;     // 選定理由
  
  // ステータス
  status: 'in_progress' | 'completed' | 'error';
  
  // メタデータ
  totalScenes: number;          // シーン数
  duration?: number;            // 会話時間（秒）
  
  // タイムスタンプ
  createdAt: Timestamp;
  completedAt?: Timestamp;
  
  // 親のフィードバック（オプション）
  parentNotes?: string;
  isBookmarked?: boolean;
}
```

### 3. Scenes Subcollection (`children/{childId}/conversations/{conversationId}/scenes/{sceneId}`)

#### Scene Document
```typescript
interface ConversationScene {
  sceneId: string;              // シーンID（例: "scene_1"）
  order: number;                // 表示順序
  
  // テキストコンテンツ
  script: string;               // 博士のセリフ
  
  // 画像情報
  imagePromptUsed: string;      // 使用した画像プロンプト
  imageUrl: string;             // 生成された画像のURL
  imageHint: string;            // 画像のヒント
  imageGeneratedAt?: Timestamp; // 画像生成日時
  
  // 音声情報
  audioUrl?: string;            // 音声ファイルのURL（Cloud Storage）
  audioGeneratedAt?: Timestamp; // 音声生成日時
  audioDuration?: number;       // 音声の長さ（秒）
  
  // メタデータ
  createdAt: Timestamp;
}
```

---

## 🔄 提案する改善点

### 現在のデータ構造との比較

**現在の構造（フラット）:**
```json
{
  "logs": [{
    "child_id": "child1",
    "question": "...",
    "scenes": [...]
  }]
}
```

**問題点:**
1. ❌ 1つのドキュメントに全データを格納 → サイズ制限（1MB）に到達しやすい
2. ❌ 配列内の特定シーンを更新しにくい
3. ❌ クエリ効率が悪い（全データを読み込む必要がある）
4. ❌ 親が複数の子供を管理しにくい

**推奨構造（階層型）:**
```
children/{childId}/conversations/{conversationId}/scenes/{sceneId}
```

**メリット:**
1. ✅ ドキュメントサイズ制限を回避
2. ✅ 個別シーンの更新が容易
3. ✅ 効率的なクエリ（日付範囲、トピック別など）
4. ✅ 親子関係の管理が明確
5. ✅ リアルタイムリスナーの設定が柔軟

---

## 🔐 セキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 子供プロフィール
    match /children/{childId} {
      // 親のみ読み書き可能
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.parentUserId;
      
      // 会話ログ
      match /conversations/{conversationId} {
        allow read: if request.auth != null 
          && request.auth.uid == get(/databases/$(database)/documents/children/$(childId)).data.parentUserId;
        allow create: if request.auth != null;
        allow update: if request.auth != null;
        
        // シーン
        match /scenes/{sceneId} {
          allow read, write: if request.auth != null;
        }
      }
    }
    
    // ユーザー（親）
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 💾 Cloud Storage設計（画像・音声）

### ストレージ構造
```
gs://your-bucket/
├── children/
│   └── {childId}/
│       └── conversations/
│           └── {conversationId}/
│               ├── images/
│               │   ├── scene_1.jpg
│               │   ├── scene_2.jpg
│               │   └── ...
│               └── audio/
│                   ├── scene_1.mp3
│                   ├── scene_2.mp3
│                   └── ...
```

### ファイル命名規則
- 画像: `{conversationId}/images/scene_{order}.jpg`
- 音声: `{conversationId}/audio/scene_{order}.mp3`

### メリット
- Firestoreのドキュメントサイズを削減
- CDN経由で高速配信
- 自動的なサムネイル生成（Cloud Functions）
- コスト効率的（ストレージは安価）

---

## 📈 クエリ例

### 1. 子供の最新10件の会話を取得
```typescript
const conversations = await db
  .collection('children')
  .doc(childId)
  .collection('conversations')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();
```

### 2. 特定期間の会話を取得
```typescript
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);

const recentConversations = await db
  .collection('children')
  .doc(childId)
  .collection('conversations')
  .where('createdAt', '>=', weekAgo)
  .orderBy('createdAt', 'desc')
  .get();
```

### 3. トピック別の会話を取得
```typescript
const scienceQuestions = await db
  .collection('children')
  .doc(childId)
  .collection('conversations')
  .where('curiosityType', '==', '科学への好奇心')
  .get();
```

### 4. 会話の全シーンを取得
```typescript
const scenes = await db
  .collection('children')
  .doc(childId)
  .collection('conversations')
  .doc(conversationId)
  .collection('scenes')
  .orderBy('order', 'asc')
  .get();
```

---

## 💰 コスト最適化

### 1. 読み取り回数の削減
- **キャッシュ戦略**: 統計情報を`ChildProfile`にキャッシュ
- **ページネーション**: 一度に取得する件数を制限
- **リアルタイムリスナー**: 必要な場合のみ使用

### 2. 書き込み回数の削減
- **バッチ処理**: 複数のシーンを一度に書き込み
- **トランザクション**: 必要な場合のみ使用

### 3. ストレージコスト
- **画像圧縮**: WebP形式で保存（70-80%削減）
- **音声圧縮**: MP3 64kbps（十分な音質）
- **ライフサイクル管理**: 古いデータをColdlineに移動

### 推定コスト（月間100会話、子供1人の場合）
- Firestore読み取り: 約1,000回 → $0.036
- Firestore書き込み: 約500回 → $0.18
- Storage: 約500MB → $0.01
- **合計: 約$0.23/月**

---

## 🚀 実装フェーズ

### Phase 1: 基本実装（1-2日）
- [ ] Firebase プロジェクト作成
- [ ] Firestore データベース初期化
- [ ] 基本的なCRUD関数実装
- [ ] セキュリティルール設定

### Phase 2: 統合（2-3日）
- [ ] 既存の`useAgentChat`フックと統合
- [ ] 会話終了時の自動保存
- [ ] Cloud Storage連携（画像・音声）

### Phase 3: 親向けダッシュボード（3-5日）
- [ ] 会話履歴一覧画面
- [ ] 会話詳細画面
- [ ] 統計・レポート画面
- [ ] フィルター・検索機能

### Phase 4: 高度な機能（オプション）
- [ ] リアルタイム同期
- [ ] オフライン対応
- [ ] データエクスポート
- [ ] AI分析レポート

---

## 🔧 技術スタック

### 必要なパッケージ
```json
{
  "dependencies": {
    "firebase": "^11.1.0",
    "firebase-admin": "^13.0.0"
  }
}
```

### 環境変数
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# サーバーサイド用
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

---

## 📝 次のステップ

1. **この設計をレビュー**: 要件に合っているか確認
2. **Firebase プロジェクト作成**: GCPコンソールで設定
3. **実装開始**: Phase 1から順次実装

---

## 🤔 代替案との比較

### 案1: フラット構造（現在の提案）
- ❌ スケーラビリティに問題
- ❌ クエリ効率が悪い

### 案2: 階層構造（推奨）
- ✅ スケーラブル
- ✅ 効率的なクエリ
- ✅ 柔軟な権限管理

### 案3: Realtime Database
- ❌ クエリ機能が限定的
- ❌ オフライン対応が弱い
- ⚠️ 新規プロジェクトには非推奨

### 案4: Cloud SQL（PostgreSQL）
- ✅ 複雑なクエリに対応
- ❌ コストが高い
- ❌ リアルタイム機能が弱い
- ⚠️ 小規模プロジェクトには過剰

---

## 結論

**推奨: Firestore階層構造 + Cloud Storage**

理由:
1. スケーラビリティと柔軟性のバランスが最適
2. コスト効率が良い
3. Next.jsとの統合が容易
4. リアルタイム機能が標準搭載
5. 将来的な拡張が容易

この設計で実装を進めることをお勧めします。
