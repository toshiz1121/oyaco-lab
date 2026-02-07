# 会話ログ保存の問題調査

## 問題の概要
Firebaseに会話ログが保存されていない問題を調査中。

## 実装状況の確認

### 1. 会話ログ保存の実装
- ✅ `src/lib/conversation-logger.ts` - 会話ログ保存のロジック実装済み
- ✅ `src/hooks/useConversationLogger.ts` - React フック実装済み
- ✅ `src/hooks/useAgentChat.ts` - フック呼び出し実装済み

### 2. 保存フロー
```typescript
handleQuestion() 
  → logCurrentConversation() 
    → logConversation()
      → createConversation()      // 会話メタデータ作成
      → addScenesBatch()          // シーン一括保存
      → completeConversation()    // 会話完了・統計更新
```

### 3. 潜在的な問題点

#### 問題1: `activeChildId`が`null`の可能性
**場所**: `src/hooks/useAgentChat.ts:277-283`

```typescript
if(activeChildId) {
  logCurrentConversation(question, newExpert, newSelectionReason, responseData);
} else {
  // activeChildIdがnullの場合、ログが保存されない
}
```

**原因**:
- ユーザーがログインしていない
- 子供プロフィールが選択されていない
- AuthContextの初期化が完了していない

#### 問題2: エラーハンドリングの不足
**修正前**: `await`なしで呼び出し → エラーが握りつぶされる
```typescript
// 修正前
logCurrentConversation(question, newExpert, newSelectionReason, responseData);
```

**修正後**: `await`とtry-catchを追加
```typescript
// 修正後
try {
  await logCurrentConversation(question, newExpert, newSelectionReason, responseData);
  console.log('[useAgentChat] 会話ログの保存に成功しました');
} catch (error) {
  console.error('[useAgentChat] 会話ログの保存に失敗しました:', error);
}
```

#### 問題3: Firestoreセキュリティルール
Firestoreのセキュリティルールが書き込みを拒否している可能性。

**確認方法**:
1. Firebaseコンソールにアクセス
2. Firestore Database → ルール を確認
3. 以下のような設定が必要:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 子供プロフィール
    match /children/{childId} {
      allow read, write: if request.auth != null;
      
      // 会話ログ
      match /conversations/{conversationId} {
        allow read, write: if request.auth != null;
        
        // シーン
        match /scenes/{sceneId} {
          allow read, write: if request.auth != null;
        }
      }
    }
    
    // 親ユーザー
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 実施した修正

### 1. 詳細ログの追加
以下のファイルに詳細なログを追加:
- ✅ `src/hooks/useAgentChat.ts` - 保存開始・成功・失敗のログ
- ✅ `src/lib/conversation-logger.ts` - 各ステップの詳細ログ
- ✅ `src/lib/firebase/firestore.ts` - Firestore操作のログ
- ✅ `src/contexts/AuthContext.tsx` - 認証状態とactiveChildIdのログ

### 2. エラーハンドリングの改善
- `await`を追加してエラーを適切にキャッチ
- `activeChildId`が`null`の場合の警告ログ追加

## 次のステップ

### 1. ブラウザコンソールでログを確認
アプリを実行して、以下のログを確認:

```
[AuthContext] Auth state changed: User: xxx
[AuthContext] Parent user loaded: { userId: xxx, children: [...], activeChildId: xxx }
[useAgentChat] 会話ログを保存中...
[ConversationLogger] Starting to log conversation: conv_xxx
[Firestore] createConversation called
[Firestore] ✅ Created conversation: conv_xxx
[Firestore] addScenesBatch called
[Firestore] ✅ Added X scenes in batch
[Firestore] completeConversation called
[Firestore] ✅ Completed conversation: conv_xxx
[useAgentChat] 会話ログの保存に成功しました
```

### 2. エラーが出た場合の対処

#### エラー: "Missing or insufficient permissions"
→ Firestoreセキュリティルールを確認・修正

#### エラー: "activeChildIdが設定されていない"
→ 子供プロフィールを作成・選択

#### エラー: "Firebase can only be used on the client side"
→ サーバーサイドで呼び出されている可能性（Next.jsのSSR問題）

### 3. Firebaseコンソールで確認
1. https://console.firebase.google.com/ にアクセス
2. プロジェクト `kids-kikkake-lab` を選択
3. Firestore Database を開く
4. `children/{childId}/conversations` コレクションを確認

## テスト手順

1. アプリを起動
2. ログイン
3. 子供プロフィールを選択（または作成）
4. 質問を入力して会話を開始
5. ブラウザのコンソール（F12）でログを確認
6. Firebaseコンソールでデータが保存されているか確認

## 関連ファイル
- `src/hooks/useAgentChat.ts` - 会話ログ保存の呼び出し
- `src/hooks/useConversationLogger.ts` - 会話ログフック
- `src/lib/conversation-logger.ts` - 会話ログ保存ロジック
- `src/lib/firebase/firestore.ts` - Firestore操作
- `src/contexts/AuthContext.tsx` - 認証とactiveChildId管理
- `src/lib/firebase/config.ts` - Firebase初期化
