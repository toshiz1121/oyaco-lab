# Cloud Run デプロイ手順書

このドキュメントでは、`kids-science-lab` を Google Cloud Platform (GCP) の Cloud Run にデプロイする手順を説明します。

## 1. 事前準備

1.  **Google Cloud プロジェクトの作成**: [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成してください。
2.  **gcloud CLI のインストール**: [公式ガイド](https://cloud.google.com/sdk/docs/install)に従ってインストールし、初期設定を完了させてください。
    ```bash
    gcloud auth login
    gcloud config set project [PROJECT_ID]
    ```
3.  **API の有効化**:
    ```bash
    gcloud services enable \
        run.googleapis.com \
        artifactregistry.googleapis.com \
        secretmanager.googleapis.com \
        cloudbuild.googleapis.com
    ```

## 2. シークレットの登録 (Secret Manager)

Gemini API キーを安全に管理するために Secret Manager を使用します。

```bash
# シークレットの作成
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Cloud Run の実行用サービスアカウントに参照権限を付与
# (デフォルトの計算サービスアカウントを使用する場合)
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## 3. コンテナレポジトリの作成 (Artifact Registry)

```bash
gcloud artifacts repositories create container-repo \
    --repository-format=docker \
    --location=asia-northeast1 \
    --description="Docker repository for kids-science-lab"
```

## 4. イメージのビルドとプッシュ

Cloud Build を使ってクラウド上でビルドするのが最も簡単です。

```bash
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/$(gcloud config get-value project)/container-repo/app:latest .
```

## 5. Cloud Run へのデプロイ

```bash
gcloud run deploy kids-science-lab \
    --image asia-northeast1-docker.pkg.dev/$(gcloud config get-value project)/container-repo/app:latest \
    --region asia-northeast1 \
    --allow-unauthenticated \
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
    --memory 512Mi \
    --cpu 1
```

*注: `--set-secrets` を使用することで、環境変数 `GEMINI_API_KEY` としてシークレットの値が注入されます。*

## 6. デプロイ後の確認

1.  デプロイ完了後に表示される **Service URL** にアクセスしてください。
2.  ブラウザの開発者ツールで、API リクエストが正常に動作しているか確認してください。

## 7. (オプション) 自動デプロイの設定

GitHub と連携して、ブランチへのプッシュ時に自動デプロイするには、Cloud Console の **Cloud Build > トリガー** から設定を行ってください。

*   **イベント**: ブランチへのプッシュ
*   **構成**: Cloud Build 構成ファイル (cloudbuild.yaml) を作成するか、インラインで手順を指定します。

## 8. コスト削減のヒント

*   **古いイメージの削除**: Artifact Registry に古いイメージが溜まると課金が発生します。最新の数件以外を削除するライフサイクル設定を検討してください。
*   **スケール 0**: Cloud Run はデフォルトでリクエストがない時に 0 インスタンスまでスケールダウンするため、基本的には設定不要です。

---

### トラブルシューティング
- **403 Forbidden**: Secret Manager の権限設定が不足している可能性があります。
- **CrashLoopBackOff**: 環境変数が足りないか、Next.js のビルドに失敗している可能性があります。`gcloud run services logs read` でログを確認してください。
