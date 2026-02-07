# Cloud Run での Firebase 認証情報設定ガイド

## 概要

このアプリは Firebase Authentication, Firestore, Storage を使用しています。
Cloud Run にデプロイする際は、Firebase の認証情報を環境変数として設定する必要があります。

## 必要な環境変数

### 1. Firebase クライアント設定（必須）

以下の環境変数を Cloud Run に設定してください：

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 2. Vertex AI 設定（必須）

```bash
GEMINI_API_KEY=your-gemini-api-key
VERTEX_AI_PROJECT=your-gcp-project-id
VERTEX_AI_LOCATION=asia-northeast1
```

### 3. Google Cloud 認証（サーバーサイド用）

Cloud Run では、サービスアカウントを使用して認証します。

## 設定方法

### 方法1: Cloud Console から設定（推奨）

1. **Firebase 設定値の取得**
   ```bash
   # Firebase Console から取得
   # https://console.firebase.google.com/
   # プロジェクト設定 > 全般 > マイアプリ
   ```

2. **Cloud Run サービスに環境変数を設定**
   ```bash
   gcloud run services update kids-science-lab \
     --region=asia-northeast1 \
     --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=AIza..." \
     --set-env-vars="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com" \
     --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id" \
     --set-env-vars="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com" \
     --set-env-vars="NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789" \
     --set-env-vars="NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123" \
     --set-env-vars="GEMINI_API_KEY=your-gemini-key" \
     --set-env-vars="VERTEX_AI_PROJECT=your-gcp-project" \
     --set-env-vars="VERTEX_AI_LOCATION=asia-northeast1"
   ```

3. **サービスアカウントの権限設定**
   ```bash
   # Cloud Run のサービスアカウントに必要な権限を付与
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   
   # Firestore の権限（必要に応じて）
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/datastore.user"
   ```

### 方法2: .env ファイルから一括設定

1. **環境変数ファイルを作成**
   ```bash
   # .env.production を作成
   cat > .env.production << 'EOF'
   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
   GEMINI_API_KEY=your-gemini-key
   VERTEX_AI_PROJECT=your-gcp-project
   VERTEX_AI_LOCATION=asia-northeast1
   EOF
   ```

2. **ファイルから環境変数を設定**
   ```bash
   gcloud run services update kids-science-lab \
     --region=asia-northeast1 \
     --env-vars-file=.env.production
   ```

### 方法3: Cloud Build でビルド時に設定

`cloudbuild.yaml` に環境変数を含める：

```yaml
steps:
  # Docker イメージをビルド
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_API_KEY=${_FIREBASE_API_KEY}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${_FIREBASE_AUTH_DOMAIN}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_PROJECT_ID=${_FIREBASE_PROJECT_ID}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${_FIREBASE_STORAGE_BUCKET}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${_FIREBASE_MESSAGING_SENDER_ID}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_APP_ID=${_FIREBASE_APP_ID}'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/kids-science-lab:${SHORT_SHA}'
      - '.'

  # Cloud Run にデプロイ
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'kids-science-lab'
      - '--image'
      - 'gcr.io/${PROJECT_ID}/kids-science-lab:${SHORT_SHA}'
      - '--region'
      - 'asia-northeast1'
      - '--platform'
      - 'managed'
      - '--set-env-vars'
      - 'GEMINI_API_KEY=${_GEMINI_API_KEY},VERTEX_AI_PROJECT=${PROJECT_ID},VERTEX_AI_LOCATION=asia-northeast1'

substitutions:
  _FIREBASE_API_KEY: 'your-api-key'
  _FIREBASE_AUTH_DOMAIN: 'your-project.firebaseapp.com'
  _FIREBASE_PROJECT_ID: 'your-project-id'
  _FIREBASE_STORAGE_BUCKET: 'your-project.appspot.com'
  _FIREBASE_MESSAGING_SENDER_ID: 'your-sender-id'
  _FIREBASE_APP_ID: 'your-app-id'
  _GEMINI_API_KEY: 'your-gemini-key'
```

## セキュリティのベストプラクティス

### 1. Secret Manager を使用（推奨）

機密情報は Secret Manager に保存し、Cloud Run から参照します：

```bash
# Secret を作成
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-

# Cloud Run サービスに Secret をマウント
gcloud run services update kids-science-lab \
  --region=asia-northeast1 \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

### 2. Firebase 設定の公開範囲

- `NEXT_PUBLIC_*` で始まる環境変数はクライアント側に公開されます
- Firebase の API Key は公開されても問題ありません（Firebase Security Rules で保護）
- ただし、Firebase Security Rules を適切に設定することが重要です

### 3. サービスアカウントの最小権限

Cloud Run のサービスアカウントには必要最小限の権限のみを付与：

```bash
# 必要な権限のみ
- roles/aiplatform.user          # Vertex AI 使用
- roles/datastore.user           # Firestore 読み書き
- roles/storage.objectAdmin      # Storage 読み書き（画像保存用）
```

## Firebase Security Rules の設定

Firestore と Storage の Security Rules を適切に設定してください：

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のデータのみアクセス可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // 子供のデータ
      match /children/{childId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        // 会話ログ
        match /conversations/{conversationId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
  }
}
```

### Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // ユーザーは自分のフォルダのみアクセス可能
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## トラブルシューティング

### Firebase 接続エラー

```bash
# ログを確認
gcloud run services logs read kids-science-lab --region=asia-northeast1 --limit=50

# 環境変数を確認
gcloud run services describe kids-science-lab --region=asia-northeast1 --format="value(spec.template.spec.containers[0].env)"
```

### よくあるエラー

1. **"Firebase: Error (auth/invalid-api-key)"**
   - `NEXT_PUBLIC_FIREBASE_API_KEY` が正しく設定されているか確認

2. **"Missing or insufficient permissions"**
   - Firebase Security Rules を確認
   - サービスアカウントの権限を確認

3. **"CORS エラー"**
   - Firebase Console で認証済みドメインに Cloud Run の URL を追加

## 確認コマンド

```bash
# 現在の環境変数を確認
gcloud run services describe kids-science-lab \
  --region=asia-northeast1 \
  --format="yaml(spec.template.spec.containers[0].env)"

# サービスアカウントを確認
gcloud run services describe kids-science-lab \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.serviceAccountName)"

# ログをリアルタイムで監視
gcloud run services logs tail kids-science-lab --region=asia-northeast1
```

## 参考リンク

- [Cloud Run 環境変数の設定](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Secret Manager の使用](https://cloud.google.com/run/docs/configuring/secrets)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Vertex AI 認証](https://cloud.google.com/vertex-ai/docs/authentication)
