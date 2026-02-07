# 会話ログFirebase実装計画書

## 📋 実装概要

子供とAIの会話をFirebase Firestoreに保存し、親が閲覧できる機能を実装します。

---

## 🎯 実装スコープ

### Phase 1: Firebase基盤構築（優先度: 高）
1. Firebaseプロジェクト設定
2. Firestore初期化
3. 基本的なデータ操作関数
4. セキュリティルール

### Phase 2: 会話ログ保存機能（優先度: 高）
1. 会話開始時の記録
2. シーンごとの保存
3. 会話完了時の更新
4. エラーハンドリング

### Phase 3: 親向けダッシュボード（優先度: 中）
1. 会話履歴一覧
2. 会話詳細表示
3. 統計情報表示

---

## 📁 ファイル構成

```
src/
├── lib/
│   ├── firebase/
│   │   ├── config.ts              # Firebase初期化
│   │   ├── firestore.ts           # Firestore操作
│   │   ├── storage.ts             # Cloud Storage操作
│   │   └── types.ts               # 型定義
│   └── conversation-logger.ts     # 会話ログ管理
│
├── hooks/
│   └── useConversationLogger.ts   # ログ記録フック
│
├── app/
│   └── parent-dashboard/
│       ├── page.tsx               # ダッシュボードメイン
│       ├── [conversationId]/
│       │   └── page.tsx           # 会話詳細
│       └── components/
│           ├── ConversationList.tsx
│           ├── ConversationDetail.tsx
│           └── StatsCard.tsx
│
└── components/
    └── ConversationLogger.tsx     # ログ記録コンポーネント
```

---

## 🔧 実装詳細

### 1. Firebase設定ファイル

#### `src/lib/firebase/config.ts`
```typescript
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  app = getApps()[0];
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, db, storage };
```

#### `src/lib/firebase/types.ts`
```typescript
import { Timestamp } from 'firebase/firestore';

export interface ChildProfile {
  childId: string;
  name: string;
  age: number;
  parentUserId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  stats: {
    totalConversations: number;
    totalQuestions: number;
    favoriteTopics: string[];
    lastActivityAt: Timestamp;
  };
}

export interface ConversationMetadata {
  conversationId: string;
  childId: string;
  question: string;
  questionTimestamp: Timestamp;
  curiosityType: string;
  selectedExpert: string;
  selectionReason?: string;
  status: 'in_progress' | 'completed' | 'error';
  totalScenes: number;
  duration?: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  parentNotes?: string;
  isBookmarked?: boolean;
}

export interface ConversationScene {
  sceneId: string;
  order: number;
  script: string;
  imagePromptUsed: string;
  imageUrl: string;
  imageHint: string;
  imageGeneratedAt?: Timestamp;
  audioUrl?: string;
  audioGeneratedAt?: Timestamp;
  audioDuration?: number;
  createdAt: Timestamp;
}
```

#### `src/lib/firebase/firestore.ts`
```typescript
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { ChildProfile, ConversationMetadata, ConversationScene } from './types';

// ========================================
// 子供プロフィール操作
// ========================================

export async function createChildProfile(
  childId: string,
  name: string,
  age: number,
  parentUserId: string
): Promise<ChildProfile> {
  const profile: ChildProfile = {
    childId,
    name,
    age,
    parentUserId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    stats: {
      totalConversations: 0,
      totalQuestions: 0,
      favoriteTopics: [],
      lastActivityAt: Timestamp.now(),
    },
  };

  await setDoc(doc(db, 'children', childId), profile);
  return profile;
}

export async function getChildProfile(childId: string): Promise<ChildProfile | null> {
  const docRef = doc(db, 'children', childId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as ChildProfile) : null;
}

// ========================================
// 会話操作
// ========================================

export async function createConversation(
  childId: string,
  conversationId: string,
  question: string,
  curiosityType: string,
  selectedExpert: string,
  selectionReason?: string
): Promise<ConversationMetadata> {
  const metadata: ConversationMetadata = {
    conversationId,
    childId,
    question,
    questionTimestamp: Timestamp.now(),
    curiosityType,
    selectedExpert,
    selectionReason,
    status: 'in_progress',
    totalScenes: 0,
    createdAt: Timestamp.now(),
  };

  const conversationRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId
  );
  await setDoc(conversationRef, metadata);

  return metadata;
}

export async function completeConversation(
  childId: string,
  conversationId: string,
  totalScenes: number,
  duration?: number
): Promise<void> {
  const conversationRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId
  );

  await updateDoc(conversationRef, {
    status: 'completed',
    completedAt: Timestamp.now(),
    totalScenes,
    duration,
  });

  // 子供の統計情報を更新
  const childRef = doc(db, 'children', childId);
  const childSnap = await getDoc(childRef);
  if (childSnap.exists()) {
    const currentStats = childSnap.data().stats;
    await updateDoc(childRef, {
      'stats.totalConversations': currentStats.totalConversations + 1,
      'stats.totalQuestions': currentStats.totalQuestions + 1,
      'stats.lastActivityAt': Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
}

export async function getConversation(
  childId: string,
  conversationId: string
): Promise<ConversationMetadata | null> {
  const docRef = doc(db, 'children', childId, 'conversations', conversationId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as ConversationMetadata) : null;
}

export async function getRecentConversations(
  childId: string,
  limitCount: number = 10
): Promise<ConversationMetadata[]> {
  const q = query(
    collection(db, 'children', childId, 'conversations'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationMetadata);
}

// ========================================
// シーン操作
// ========================================

export async function addScene(
  childId: string,
  conversationId: string,
  scene: Omit<ConversationScene, 'createdAt'>
): Promise<void> {
  const sceneRef = doc(
    db,
    'children',
    childId,
    'conversations',
    conversationId,
    'scenes',
    scene.sceneId
  );

  const sceneData: ConversationScene = {
    ...scene,
    createdAt: Timestamp.now(),
  };

  await setDoc(sceneRef, sceneData);
}

export async function addScenesBatch(
  childId: string,
  conversationId: string,
  scenes: Omit<ConversationScene, 'createdAt'>[]
): Promise<void> {
  const batch = writeBatch(db);

  scenes.forEach((scene) => {
    const sceneRef = doc(
      db,
      'children',
      childId,
      'conversations',
      conversationId,
      'scenes',
      scene.sceneId
    );

    const sceneData: ConversationScene = {
      ...scene,
      createdAt: Timestamp.now(),
    };

    batch.set(sceneRef, sceneData);
  });

  await batch.commit();
}

export async function getScenes(
  childId: string,
  conversationId: string
): Promise<ConversationScene[]> {
  const q = query(
    collection(db, 'children', childId, 'conversations', conversationId, 'scenes'),
    orderBy('order', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationScene);
}

// ========================================
// クエリ
// ========================================

export async function getConversationsByDateRange(
  childId: string,
  startDate: Date,
  endDate: Date
): Promise<ConversationMetadata[]> {
  const q = query(
    collection(db, 'children', childId, 'conversations'),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationMetadata);
}

export async function getConversationsByTopic(
  childId: string,
  curiosityType: string
): Promise<ConversationMetadata[]> {
  const q = query(
    collection(db, 'children', childId, 'conversations'),
    where('curiosityType', '==', curiosityType),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ConversationMetadata);
}
```

---

### 2. 会話ログ管理

#### `src/lib/conversation-logger.ts`
```typescript
import { AgentResponse, AgentRole } from './agents/types';
import {
  createConversation,
  completeConversation,
  addScenesBatch,
} from './firebase/firestore';
import type { ConversationScene } from './firebase/types';

export interface LogConversationParams {
  childId: string;
  question: string;
  curiosityType: string;
  selectedExpert: AgentRole;
  selectionReason?: string;
  response: AgentResponse;
}

/**
 * 会話全体をFirestoreに記録
 */
export async function logConversation(params: LogConversationParams): Promise<string> {
  const {
    childId,
    question,
    curiosityType,
    selectedExpert,
    selectionReason,
    response,
  } = params;

  // 会話IDを生成
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // 1. 会話メタデータを作成
    await createConversation(
      childId,
      conversationId,
      question,
      curiosityType,
      selectedExpert,
      selectionReason
    );

    // 2. シーンを一括保存
    if (response.pairs && response.pairs.length > 0) {
      const scenes: Omit<ConversationScene, 'createdAt'>[] = response.pairs.map(
        (pair, index) => ({
          sceneId: `scene_${index + 1}`,
          order: index + 1,
          script: pair.text,
          imagePromptUsed: pair.visualDescription,
          imageUrl: pair.imageUrl || '',
          imageHint: pair.visualDescription.split('.')[0], // 簡易的なヒント
          imageGeneratedAt: pair.generatedAt
            ? Timestamp.fromDate(pair.generatedAt)
            : undefined,
          audioUrl: pair.audioData ? 'embedded' : undefined, // 実際はCloud Storageに保存
        })
      );

      await addScenesBatch(childId, conversationId, scenes);
    }

    // 3. 会話を完了状態に更新
    await completeConversation(
      childId,
      conversationId,
      response.pairs?.length || 0
    );

    console.log(`[ConversationLogger] Logged conversation: ${conversationId}`);
    return conversationId;
  } catch (error) {
    console.error('[ConversationLogger] Failed to log conversation:', error);
    throw error;
  }
}

/**
 * 好奇心のタイプを推定（簡易版）
 */
export function estimateCuriosityType(question: string): string {
  const keywords = {
    '科学への好奇心': ['なぜ', 'どうして', '仕組み', '原理'],
    '世界の仕組みへの好奇心': ['国', '社会', '政治', '経済', '文化'],
    '自然への好奇心': ['動物', '植物', '天気', '宇宙', '地球'],
    '人間への好奇心': ['人', '体', '心', '感情', '歴史'],
  };

  for (const [type, words] of Object.entries(keywords)) {
    if (words.some((word) => question.includes(word))) {
      return type;
    }
  }

  return 'その他の好奇心';
}
```

---

### 3. React統合

#### `src/hooks/useConversationLogger.ts`
```typescript
import { useState } from 'react';
import { logConversation, estimateCuriosityType } from '@/lib/conversation-logger';
import { AgentResponse, AgentRole } from '@/lib/agents/types';

export function useConversationLogger(childId: string) {
  const [isLogging, setIsLogging] = useState(false);
  const [lastLoggedId, setLastLoggedId] = useState<string | null>(null);

  const logCurrentConversation = async (
    question: string,
    selectedExpert: AgentRole,
    selectionReason: string | undefined,
    response: AgentResponse
  ) => {
    setIsLogging(true);
    try {
      const curiosityType = estimateCuriosityType(question);
      
      const conversationId = await logConversation({
        childId,
        question,
        curiosityType,
        selectedExpert,
        selectionReason,
        response,
      });

      setLastLoggedId(conversationId);
      console.log(`[useConversationLogger] Successfully logged: ${conversationId}`);
    } catch (error) {
      console.error('[useConversationLogger] Failed to log:', error);
    } finally {
      setIsLogging(false);
    }
  };

  return {
    logCurrentConversation,
    isLogging,
    lastLoggedId,
  };
}
```

---

### 4. useAgentChatへの統合

#### `src/hooks/useAgentChat.ts` への追加
```typescript
// 既存のインポートに追加
import { useConversationLogger } from './useConversationLogger';

export function useAgentChat({ initialQuestion, onNewSession }: UseAgentChatProps) {
  // 既存のコード...
  
  // 会話ログ機能を追加
  const childId = 'child1'; // 実際は認証から取得
  const { logCurrentConversation, isLogging } = useConversationLogger(childId);

  const handleQuestion = async (question: string) => {
    // 既存の処理...
    
    // 回答生成完了後にログを記録
    if (responseResult.success && responseResult.data) {
      const responseData = {
        ...responseResult.data,
        selectionReason: newSelectionReason
      };

      // Firestoreに保存（非同期、エラーは無視）
      logCurrentConversation(
        question,
        newExpert,
        newSelectionReason,
        responseData
      ).catch(err => {
        console.warn('Failed to log conversation to Firestore:', err);
      });

      // 既存のLocalStorage保存も継続
      addMessageToSession(sessionId, {
        role: 'assistant',
        content: responseData.text,
        agentId: responseData.agentId,
        // ...
      });
    }
  };

  return {
    // 既存の戻り値...
    isLogging, // ログ記録中かどうか
  };
}
```

---

## 🔐 環境変数設定

### `.env.local`
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# デフォルトの子供ID（開発用）
NEXT_PUBLIC_DEFAULT_CHILD_ID=child1
```

---

## 📦 パッケージインストール

```bash
npm install firebase
```

---

## ✅ 実装チェックリスト

### Phase 1: 基盤構築
- [ ] Firebaseプロジェクト作成
- [ ] `firebase/config.ts` 実装
- [ ] `firebase/types.ts` 実装
- [ ] `firebase/firestore.ts` 実装
- [ ] 環境変数設定
- [ ] 接続テスト

### Phase 2: ログ機能
- [ ] `conversation-logger.ts` 実装
- [ ] `useConversationLogger.ts` 実装
- [ ] `useAgentChat.ts` 統合
- [ ] 動作確認

### Phase 3: ダッシュボード
- [ ] 会話一覧画面
- [ ] 会話詳細画面
- [ ] 統計表示

---

## 🧪 テスト計画

### 1. 単体テスト
```typescript
// 会話作成テスト
test('createConversation should save metadata', async () => {
  const conversationId = await createConversation(
    'test_child',
    'test_conv',
    'テスト質問',
    '科学への好奇心',
    'scientist'
  );
  expect(conversationId).toBeDefined();
});
```

### 2. 統合テスト
- 質問 → 回答 → Firestore保存の一連の流れ
- エラーハンドリング
- リトライ処理

---

## 📊 モニタリング

### Firebase Console
- Firestore使用量
- 読み書き回数
- エラーログ

### アプリケーションログ
```typescript
console.log('[ConversationLogger] Conversation saved:', conversationId);
console.error('[ConversationLogger] Failed to save:', error);
```

---

## 🚀 デプロイ手順

1. Firebase プロジェクト作成
2. Firestore有効化
3. セキュリティルール設定
4. 環境変数設定
5. アプリケーションデプロイ
6. 動作確認

---

## 次のステップ

1. **Firebase プロジェクト作成**: GCPコンソールで設定
2. **Phase 1実装**: 基盤ファイルの作成
3. **動作確認**: テストデータで検証
4. **Phase 2実装**: ログ機能の統合
5. **Phase 3実装**: ダッシュボード開発

実装を開始しますか？
