# Phase 3: コミュニティ機能 & 永続化 実装計画

## 概要
Phase 3では、アプリケーションに「永続性」と「ソーシャル機能」を導入します。
これまでオンメモリ/ステートレスで動作していたアプリケーションに対し、データベースと認証システムを導入し、作品の保存、公開、共有、そしてユーザー間の交流を可能にします。

## 実装機能

### 1. 認証システム (Authentication)
ユーザー登録・ログイン機能を実装し、ユーザーごとのデータを管理します。

- **技術スタック**: NextAuth.js (Auth.js v5)
- **プロバイダー**: Google (初期), GitHub, Email (Magic Link)
- **機能**:
  - サインイン/サインアウト
  - セッション管理
  - 保護されたルートの制御

### 2. データ永続化 (Persistence)
生成された作品データと画像を永続的に保存します。

- **技術スタック**:
  - **DB**: Vercel Postgres (PostgreSQL)
  - **ORM**: Prisma
  - **Storage**: Vercel Blob (画像ファイル保存)
- **データモデル**:
  - `User`: ユーザー情報
  - `Artwork`: 作品メタデータ (タイトル, プロンプト, 画像URL, 公開設定)
  - `Artist`: 巨匠データ (マスタデータ/コード定義とDBの紐付け)

### 3. パブリックギャラリー (Public Gallery) [US-3.1]
全ユーザーが公開した作品を閲覧できるギャラリーページ。

- **機能**:
  - 作品一覧表示 (グリッドレイアウト)
  - フィルタリング (画風別)
  - ソート (新着順)
  - 無限スクロール

### 4. ソーシャル機能 (Social Interactions) [US-3.1, 3.2, 3.3]
ユーザー間のインタラクション機能。

- **Like (いいね/お気に入り)**:
  - 作品への「いいね」
  - 「いいね」した作品の一覧表示 (コレクション機能)
- **Comments (コメント)**:
  - 作品へのコメント投稿・表示

## 実装ステップ

### Step 1: インフラストラクチャ整備 (DB & Auth)
1. **Prismaセットアップ**:
   - `schema.prisma` の定義 (User, Account, Session, Artwork, Like, Comment)
   - マイグレーション実行
2. **NextAuth.js導入**:
   - Google Providerの設定
   - PrismaAdapterの設定
   - ログイン/ログアウトUIの実装

### Step 2: 作品保存フローの構築 (Persistence)
1. **Vercel Blob設定**: 画像アップロード処理の実装
2. **生成フローの修正**:
   - 画像生成 (Image MCP)
   - Blobへアップロード
   - DBへArtworkレコード作成 (User紐付け)
3. **マイページ実装**: 自分の作品一覧を表示

### Step 3: ギャラリー & ソーシャル機能 (Community)
1. **ギャラリーページ (`/gallery`)**: 公開作品の全件取得と表示
2. **詳細ページ (`/gallery/[id]`)**: 作品詳細表示
3. **いいね機能**:
   - `Like` アクションの実装 (Server Action)
   - UIへの反映 (Optimistic UI)
4. **コメント機能**:
   - `Comment` アクションの実装
   - コメントリスト表示

## データベーススキーマ設計 (Draft)

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  artworks      Artwork[]
  likes         Like[]
  comments      Comment[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Artwork {
  id          String   @id @default(cuid())
  title       String?
  prompt      String   @db.Text
  imageUrl    String
  artistId    String   // "picasso", "gogh" etc.
  isPublic    Boolean  @default(true)
  
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  likes       Like[]
  comments    Comment[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([artistId])
}

model Like {
  id        String   @id @default(cuid())
  userId    String
  artworkId String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  artwork   Artwork  @relation(fields: [artworkId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, artworkId]) // 1ユーザー1いいね
}

model Comment {
  id        String   @id @default(cuid())
  content   String   @db.Text
  userId    String
  artworkId String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  artwork   Artwork  @relation(fields: [artworkId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// NextAuth default models (Account, Session, VerificationToken) ...
```

## タイムライン
- **Week 1**: Step 1 (DB & Auth) & Step 2 (Persistence)
- **Week 2**: Step 3 (Gallery & Social)
