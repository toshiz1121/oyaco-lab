# 会話ログFirebase実装 - チェックリスト

このチェックリストを使って、実装の進捗を管理してください。

---

## 📋 Phase 1: Firebase環境構築

### Step 1: Firebaseプロジェクト作成
- [ ] Firebase Console にアクセス
- [ ] 新しいプロジェクトを作成
- [ ] プロジェクト名を設定
- [ ] Google Analytics 設定（任意）

### Step 2: Firestore 有効化
- [ ] Firestore Database を作成
- [ ] 本番環境モードを選択
- [ ] ロケーション選択（asia-northeast1推奨）
- [ ] データベース作成完了

### Step 3: Cloud Storage 有効化
- [ ] Storage を有効化
- [ ] セキュリティルール設定
- [ ] ロケーション確認

### Step 4: Web アプリ登録
- [ ] Webアプリを追加
- [ ] アプリのニックネーム設定
- [ ] Firebase設定情報をコピー

### Step 5: セキュリティルール設定
- [ ] Firestore ルールを設定（開発用）
- [ ] Storage ルールを設定（開発用）
- [ ] ルールを公開

---

## 📦 Phase 2: パッケージとファイル作成

### Step 6: パッケージインストール
- [ ] `npm install firebase` 実行
- [ ] インストール確認

### Step 7: 環境変数設定
- [ ] `.env.local` ファイル作成
- [ ] Firebase設定情報を貼り付け
- [ ] `.env.example` に追記
- [ ] `.gitignore` 確認

### Step 8: 基盤ファイル作成
- [ ] `src/lib/firebase/types.ts` 作成
- [ ] `src/lib/firebase/config.ts` 作成
- [ ] `src/lib/firebase/firestore.ts` 作成
- [ ] `src/lib/conversation-logger.ts` 作成
- [ ] `src/hooks/useConversationLogger.ts` 作成

### Step 9: テストページ作成
- [ ] `src/app/test-firebase/page.tsx` 作成

---

## 🧪 Phase 3: 接続テストと動作確認

### Step 10: 接続テスト
- [ ] 開発サーバー起動 (`npm run dev`)
- [ ] `/test-firebase` にアクセス
- [ ] 「接続テスト」ボタンをクリック
- [ ] ✅ 接続成功メッセージを確認
- [ ] Firebase Console で `test` コレクション確認

### Step 11: プロフィール作成テスト
- [ ] 「子供プロフィール作成」ボタンをクリック
- [ ] ✅ 作成成功メッセージを確認
- [ ] Firebase Console で `children/child1` 確認
- [ ] プロフィールデータの内容を確認

### Step 12: プロフィール取得テスト
- [ ] 「プロフィール取得」ボタンをクリック
- [ ] ✅ 取得成功メッセージを確認
- [ ] 画面にプロフィール情報が表示されることを確認

---

## 🔗 Phase 4: 既存コードへの統合

### Step 13: useAgentChat 修正
- [ ] `src/hooks/useAgentChat.ts` を開く
- [ ] `useConversationLogger` をインポート
- [ ] `estimateCuriosityType` をインポート
- [ ] フック内で `useConversationLogger` を呼び出し
- [ ] `handleQuestion` 内にログ記録処理を追加
- [ ] 戻り値に `isLogging` を追加

### Step 14: 型エラー確認
- [ ] TypeScriptエラーがないことを確認
- [ ] `npm run build` でビルドテスト
- [ ] エラーがあれば修正

---

## ✅ Phase 5: 統合テスト

### Step 15: 実際の会話でテスト
- [ ] メインページ (`/`) にアクセス
- [ ] 質問を入力（例: "どうして空は青いの？"）
- [ ] 回答が表示されるまで待つ
- [ ] ブラウザコンソールでログを確認
  - `[ConversationLogger] Logged conversation: conv_...`

### Step 16: Firebase Console で確認
- [ ] `children/child1/conversations` に新しいドキュメント
- [ ] 会話メタデータの内容を確認
  - question
  - curiosityType
  - selectedExpert
  - status: 'completed'
- [ ] `conversations/{conversationId}/scenes` にシーンが保存
- [ ] 各シーンの内容を確認
  - script
  - imageUrl
  - imagePromptUsed

### Step 17: 複数回テスト
- [ ] 別の質問を投げる（例: "なぜ雨が降るの？"）
- [ ] 会話が追加されることを確認
- [ ] `children/child1` の stats が更新されることを確認
  - totalConversations が増加
  - totalQuestions が増加

---

## 🎨 Phase 6: 親向けダッシュボード（オプション）

### Step 18: ダッシュボードページ作成
- [ ] `src/app/parent-dashboard/page.tsx` 作成
- [ ] 会話一覧を表示
- [ ] 日付でソート

### Step 19: 会話詳細ページ作成
- [ ] `src/app/parent-dashboard/[conversationId]/page.tsx` 作成
- [ ] シーン一覧を表示
- [ ] 画像とテキストを表示

### Step 20: 統計情報表示
- [ ] 総会話数
- [ ] 総質問数
- [ ] トピック別集計
- [ ] 博士別集計

---

## 🚀 Phase 7: 本番環境準備

### Step 21: セキュリティルール厳格化
- [ ] Firestore ルールを本番用に変更
- [ ] Storage ルールを本番用に変更
- [ ] 認証ベースのルールに更新（将来）

### Step 22: 環境変数確認
- [ ] 本番環境の環境変数を設定
- [ ] APIキーの制限を設定（Firebase Console）

### Step 23: ビルドとデプロイ
- [ ] `npm run build` 成功
- [ ] デプロイ実行
- [ ] 本番環境で動作確認

---

## 📊 進捗状況

**現在の進捗**: 0 / 23 ステップ完了

### Phase別進捗
- Phase 1 (Firebase環境構築): 0 / 5
- Phase 2 (パッケージとファイル): 0 / 4
- Phase 3 (接続テスト): 0 / 3
- Phase 4 (既存コード統合): 0 / 2
- Phase 5 (統合テスト): 0 / 3
- Phase 6 (ダッシュボード): 0 / 3 (オプション)
- Phase 7 (本番環境準備): 0 / 3

---

## 🎯 次のアクション

1. **Phase 1から開始**: Firebase Console でプロジェクトを作成
2. **順番に進める**: 各ステップを確実に完了させる
3. **動作確認**: 各Phaseの終わりにテストを実行
4. **問題があれば**: トラブルシューティングを参照

---

## 📝 メモ欄

実装中に気づいたことや問題点をメモしてください：

```
- 
- 
- 
```

---

## ✨ 完了後の確認事項

全てのチェックが完了したら、以下を確認：

- [ ] 質問を投げると自動的にFirestoreに保存される
- [ ] Firebase Console でデータが確認できる
- [ ] エラーが発生していない
- [ ] LocalStorageとFirestoreの両方に保存されている
- [ ] パフォーマンスに問題がない

---

**実装を開始する準備ができましたか？**

「Phase 1を開始します」と言ってください！
