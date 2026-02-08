#!/bin/bash

# Cloud Run デプロイスクリプト
# 使い方: ./deploy.sh

set -e

# 色付きログ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Cloud Run デプロイスクリプト ===${NC}"

# 環境変数の確認
if [ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ]; then
  echo -e "${RED}エラー: NEXT_PUBLIC_FIREBASE_API_KEY が設定されていません${NC}"
  echo "以下のコマンドで環境変数を設定してください:"
  echo "export NEXT_PUBLIC_FIREBASE_API_KEY='your-api-key'"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_FIREBASE_PROJECT_ID" ]; then
  echo -e "${RED}エラー: NEXT_PUBLIC_FIREBASE_PROJECT_ID が設定されていません${NC}"
  exit 1
fi

# プロジェクト設定
PROJECT_ID=$(gcloud config get-value project)
REGION="asia-northeast1"
SERVICE_NAME="kids-science-lab"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}"

echo -e "${YELLOW}プロジェクト: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}リージョン: ${REGION}${NC}"
echo -e "${YELLOW}サービス名: ${SERVICE_NAME}${NC}"

# ビルド
echo -e "${GREEN}=== Dockerイメージをビルド ===${NC}"
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  -t "${IMAGE_NAME}:latest" \
  .

# プッシュ
echo -e "${GREEN}=== イメージをプッシュ ===${NC}"
docker push "${IMAGE_NAME}:latest"

# デプロイ
echo -e "${GREEN}=== Cloud Runにデプロイ ===${NC}"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --set-env-vars="VERTEX_AI_PROJECT=${PROJECT_ID}" \
  --set-env-vars="VERTEX_AI_LOCATION=${REGION}"

echo -e "${GREEN}=== デプロイ完了 ===${NC}"

# サービスURLを表示
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format="value(status.url)")
echo -e "${GREEN}サービスURL: ${SERVICE_URL}${NC}"

# ログを確認
echo -e "${YELLOW}ログを確認するには:${NC}"
echo "gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --limit=50"
