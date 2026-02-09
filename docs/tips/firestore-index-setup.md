# Firestore インデックスの作成方法

## 前提条件

Firebase CLIがインストールされていること：

```bash
# Firebase CLIのインストール
npm install -g firebase-tools

# ログイン
firebase login

# プロジェクトを初期化（初回のみ）
firebase init firestore
```

## 方法1: Firebase Console（GUI）

### 手順

1. **Firebase Consoleにアクセス**
   ```
   https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/indexes
   ```

2. **「複合」タブを選択**

3. **「インデックスを作成」をクリック**

4. **設定を入力**:
   - コレクショングループ: `conversations`
   - フィールド1: `createdAt` (昇順)
   - クエリスコープ: `コレクション`

5. **「作成」をクリック**

6. **数分待つ**（インデックス構築完了まで）

### メリット
- GUIで簡単
- 設定ミスが少ない
- すぐに確認できる

### デメリット
- 手動作業が必要
- 複数環境（dev/prod）で繰り返し作業が必要

## 方法2: Firebase CLI（推奨）

### 手順

#### 1. firestore.indexes.json を確認

プロジェクトルートに `firestore.indexes.json` があることを確認：

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
    },
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

#### 2. Firebase プロジェクトを選択

```bash
# プロジェクト一覧を表示
firebase projects:list

# プロジェクトを選択
firebase use YOUR_PROJECT_ID
```

#### 3. インデックスをデプロイ

```bash
# インデックスのみデプロイ
firebase deploy --only firestore:indexes

# 出力例:
# === Deploying to 'your-project-id'...
# i  firestore: reading indexes from firestore.indexes.json...
# ✔  firestore: deployed indexes in firestore.indexes.json successfully
```

#### 4. 確認

```bash
# Firebase Consoleで確認
# https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/indexes
```

### メリット
- バージョン管理できる（Git）
- 複数環境に簡単にデプロイ
- CI/CDに組み込める
- チームで共有しやすい

### デメリット
- Firebase CLIのセットアップが必要
- コマンドラインの知識が必要

## 方法3: エラーメッセージから自動作成

### 手順

1. **アプリを実行してエラーを発生させる**

   Firestoreクエリを実行すると、必要なインデックスがない場合、エラーメッセージにリンクが表示されます：

   ```
   Error: The query requires an index. You can create it here:
   https://console.firebase.google.com/v1/r/project/YOUR_PROJECT/firestore/indexes?create_composite=...
   ```

2. **リンクをクリック**

   エラーメッセージのリンクをクリックすると、Firebase Consoleが開き、必要なインデックスが自動的に設定されます。

3. **「作成」をクリック**

4. **数分待つ**

### メリット
- 必要なインデックスが自動的に特定される
- 設定ミスがない
- 最も簡単

### デメリット
- エラーが発生するまでわからない
- 本番環境で初めて気づくリスク
- firestore.indexes.json に反映されない

## 今回のプロジェクトでの推奨手順

### ステップ1: 現在の修正では不要

`orderBy` を削除したので、複合インデックスは不要です。単純な範囲クエリは自動インデックスで動作します。

### ステップ2: 将来的に必要になったら

もし将来、以下のようなクエリを使う場合はインデックスが必要です：

```typescript
// 複合インデックスが必要な例
const snapshot = await db
  .collection('children')
  .doc(childId)
  .collection('conversations')
  .where('status', '==', 'completed')
  .where('createdAt', '>=', startDate)
  .orderBy('createdAt', 'desc')
  .get();
```

その場合は、Firebase CLIでデプロイ：

```bash
firebase deploy --only firestore:indexes
```

## トラブルシューティング

### エラー: "Firebase CLI is not installed"

```bash
npm install -g firebase-tools
```

### エラー: "No project active"

```bash
firebase use YOUR_PROJECT_ID
```

### エラー: "Permission denied"

Firebase Consoleでプロジェクトへのアクセス権限を確認してください。

### インデックス構築が遅い

- 大量のデータがある場合、数時間かかることがあります
- Firebase Consoleで進捗を確認できます
- 構築中もアプリは動作しますが、そのクエリは遅くなります

## ベストプラクティス

1. **開発環境で先にテスト**
   ```bash
   firebase use dev-project
   firebase deploy --only firestore:indexes
   ```

2. **firestore.indexes.json をGitで管理**
   ```bash
   git add firestore.indexes.json
   git commit -m "Add Firestore indexes"
   ```

3. **CI/CDに組み込む**
   ```yaml
   # .github/workflows/deploy.yml
   - name: Deploy Firestore indexes
     run: firebase deploy --only firestore:indexes
   ```

4. **定期的に見直す**
   - 使われていないインデックスは削除
   - Firebase Consoleで使用状況を確認

## 参考リンク

- [Firestore Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Index Best Practices](https://firebase.google.com/docs/firestore/query-data/index-overview)
