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

# 注意: Firebase クライアント設定はビルド時に埋め込まず、
# ランタイムで FirebaseConfigScript が環境変数から読み取ってクライアントに注入する。
# Cloud Run デプロイ時に FIREBASE_CLIENT_* 環境変数を設定すること。

# Next.js スタンドアロンビルド
RUN npm run build

# 本番環境イメージ
FROM base AS runner
WORKDIR /app

# 本番環境設定
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Cloud Run デプロイ時に以下の環境変数を設定すること:
# - FIREBASE_CLIENT_API_KEY
# - FIREBASE_CLIENT_AUTH_DOMAIN
# - FIREBASE_CLIENT_STORAGE_BUCKET
# - FIREBASE_CLIENT_MESSAGING_SENDER_ID
# - FIREBASE_CLIENT_APP_ID
# - FIREBASE_PROJECT_ID
# - FIRESTORE_DB_NAME

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
