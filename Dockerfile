# ベースイメージ
FROM node:20-alpine AS base

# 依存関係のインストール
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ビルドステージ
FROM base AS builder
WORKDIR /app

# 依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js テレメトリを無効化
ENV NEXT_TELEMETRY_DISABLED=1

# ビルド時の環境変数（Cloud Buildから渡される）
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIRESTORE_DB_NAME

# 環境変数を設定（ビルド時にコードに埋め込まれる）
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIRESTORE_DB_NAME=$NEXT_PUBLIC_FIRESTORE_DB_NAME

# デバッグ: 環境変数が設定されているか確認
RUN echo "Building with Firebase config:" && \
    echo "API_KEY: ${NEXT_PUBLIC_FIREBASE_API_KEY:0:10}..." && \
    echo "PROJECT_ID: $NEXT_PUBLIC_FIREBASE_PROJECT_ID" && \
    echo "FIRESTORE_DB: $NEXT_PUBLIC_FIRESTORE_DB_NAME"

# Next.js スタンドアロンビルド
RUN npm run build

# 本番環境イメージ
FROM base AS runner
WORKDIR /app

# 本番環境設定
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 注意: NEXT_PUBLIC_* 環境変数はCloud Runのランタイム環境変数から取得されます
# Dockerfileでは設定せず、gcloud run deploy 時に --set-env-vars で設定してください

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 静的ファイルをコピー
COPY --from=builder /app/public ./public

# Next.js の出力をコピー
RUN mkdir .next
RUN chown nextjs:nodejs .next

# スタンドアロンビルドの出力をコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 非rootユーザーに切り替え
USER nextjs

# Cloud Run のポート設定（環境変数 PORT を使用）
EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# アプリケーション起動
CMD ["node", "server.js"]
