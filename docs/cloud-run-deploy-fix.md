# Cloud Run デプロイ時の Firebase 認証エラー修正ガイド

## 問題

Cloud Runにデプロイすると`Firebase: Error (auth/invalid-api-key)`エラーが発生する。

## 根本原因

Next.jsの`NEXT_PUBLIC_*`環境変数は**2箇所**で必要：

1. **ビルド時** - クライアントサイドのJavaScriptバンドルに埋め込まれる
2. **ランタイム（SSR時）** - サーバーサイドレンダリング時に`FirebaseConfigScript`が環境変数を読み取る

Cloud Runでは、ビルド時の環境変数とランタイムの環境変数を**両方**設定する必要があります。

## 解決策

### 推奨: デプロイスクリプトを使用

1. **環境変数ファイルを作成**

```bash
cp .env.deploy.example .env.deploy
# .env.deploy を編集して実際の値を設定
```

2. **環境変数を読み込んでデプロイ**

```bash
source .env.deploy
./deploy.sh
```

このスクリプトは以下を自動で行います：
- ビルド時に`--build-arg`で環境変数を渡す
- デプロイ時に`--set-env-vars`でランタイム環境変数を設定

### 手動デプロイの場合

#### ステップ1: ビルド時に環境変数を渡す

```bash
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_PROJECT.firebaseapp.com" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_PROJECT.appspot.com" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID" \
  -t asia-northeast1-docker.pkg.dev/YOUR_PROJECT/cloud-run-source-deploy/kids-science-lab:latest \
  .
```

#### ステップ2: ランタイム環境変数も設定してデプロイ

```bash
gcloud run deploy kids-science-lab \
  --image asia-northeast1-docker.pkg.dev/YOUR_PROJECT/cloud-run-source-deploy/kids-science-lab:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.appspot.com" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID" \
  --set-env-vars="GEMINI_API_KEY=YOUR_GEMINI_KEY" \
  --set-env-vars="VERTEX_AI_PROJECT=YOUR_PROJECT_ID" \
  --set-env-vars="VERTEX_AI_LOCATION=asia-northeast1"
```

**重要**: `--set-env-vars`でランタイム環境変数を設定しないと、SSR時に`FirebaseConfigScript`が環境変数を読み取れません。

### 確認方法

#### 1. ビルドログを確認

```bash
# Cloud Buildのログを確認
gcloud builds list --limit=1
gcloud builds log BUILD_ID
```

ビルドログに以下が表示されることを確認：
```
Building with Firebase config:
API_KEY: AIzaSyBxxx...
PROJECT_ID: your-project-id
```

#### 2. デプロイ後の環境変数を確認

```bash
# Cloud Runの環境変数を確認
gcloud run services describe kids-science-lab \
  --region asia-northeast1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

#### 3. ブラウザのコンソールを確認

デプロイ後、ブラウザの開発者ツールのコンソールで以下を確認：

```javascript
// コンソールに表示されるログ
[Firebase] Initializing with config: {
  apiKey: "AIzaSyBxxx...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id"
}
[Firebase] Initialized successfully
```

もし`undefined`が表示される場合は、環境変数が正しく渡されていません。

### トラブルシューティング

#### エラー: "Missing Firebase configuration"

**原因**: ビルド時に環境変数が渡されていない

**解決策**:
1. `docker build`コマンドに`--build-arg`が含まれているか確認
2. `cloudbuild.yaml`の`substitutions`が正しく設定されているか確認

#### エラー: "apiKey: undefined"

**原因**: ランタイムで環境変数が読み取れていない

**解決策**:
1. Cloud Runの環境変数設定を確認
2. `gcloud run services update`で環境変数を再設定

```bash
gcloud run services update kids-science-lab \
  --region asia-northeast1 \
  --update-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY"
```

#### 既存のデプロイを修正する場合

既にデプロイ済みのサービスを修正する場合：

```bash
# 1. 最新のコードで再ビルド（環境変数を含む）
gcloud builds submit --config cloudbuild.yaml --substitutions=...

# 2. 環境変数も念のため再設定
gcloud run services update kids-science-lab \
  --region asia-northeast1 \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY,..."
```

### 注意事項

1. **セキュリティ**: `NEXT_PUBLIC_*`環境変数はクライアントサイドに公開されます
   - Firebase API Keyは公開されても問題ありませんが、Firebase Security Rulesを適切に設定してください

2. **ビルドキャッシュ**: 環境変数を変更した場合は、必ず再ビルドが必要です
   - `--no-cache`オプションを使用してキャッシュをクリア

3. **デバッグログ**: 本番環境では`firebase-config-script.tsx`のconsole.errorを削除することを推奨

## 参考

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Docker Build Arguments](https://docs.docker.com/engine/reference/commandline/build/#build-arg)
