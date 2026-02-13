# Kids Science Lab (キッズ・サイエンス・ラボ)

子供たちの「なぜ？」「どうして？」という素朴な疑問に対し、個性豊かな7人のAI博士が対話形式で答え、画像や音声を交えてわかりやすく解説する科学教育Webアプリケーションです。

## 📖 プロジェクト概要

忙しい共働き夫婦と、好奇心旺盛な子供たちのコミュニケーションを支援することを目的としています。
Orchestrator-Workers パターンを採用したAIエージェント群が、子供の質問内容に応じて最適な専門家を選定し、年齢や好みに合わせたスタイルで回答します。

### コア機能

- **🤖 7人の個性的な専門家エージェント**: 質問内容に合わせて、最適な「博士」が自動選定されます。
  - 🔬 ニュートン博士（科学・物理・化学）
  - 🌿 もりの隊長ハヤテ（動物・植物・自然）
  - 🌙 ほしぞら先生ルナ（宇宙・天文）
  - 📜 ものしり爺さんゲン（歴史・文化・社会）
  - 🎨 いろどり先生パレット（芸術・感情・表現）
  - 🤖 テックン博士（IT・テクノロジー・ロボット）
  - 😊 スマイル先生（からだ・健康・生活 + 他の博士の回答レビュー）
- **🎨 マルチメディア解説**: AI生成されたイラストや図解で視覚的に説明します。文章と画像をペアで並列生成し、ステップごとに表示します。
- **🗣️ 音声対話**: Vertex AI TTS による読み上げ（Web Speech API フォールバック付き）で、文字が読めない小さなお子様でも楽しめます。音声入力にも対応しています。
- **✅ Educator レビュー**: スマイル先生が他の博士の回答を「子供にとって分かりやすいか」自動チェックし、必要に応じて修正します。
- **❓ 深掘り質問**: 回答内容から「もっと知りたい！」と思える次の質問候補を自動生成します。他の博士の専門領域にまたがる質問も提案されます。
- **👨‍👩‍👧 保護者ダッシュボード**: 子供の会話履歴、興味の統計、AI による会話提案を確認できます。PC では2カラムレイアウト、スマホではFABボタンから子育てアドバイザーにアクセスできるレスポンシブ対応です。
- **🧠 子育てアドバイザーエージェント**: ReAct パターン（Reasoning + Acting）で Gemini の Function Calling を活用し、会話履歴分析・学習進捗分析・知識ギャップ分析を自律的に実行して、保護者に具体的なアドバイスを提供します。
- **🔐 認証・マルチ子供管理**: Googleログインによる保護者認証と、複数の子供プロフィールの切り替えに対応しています。

## 🛠️ 技術スタック

### Frontend
- **Framework**: [Next.js 16.1](https://nextjs.org/) (App Router)
- **Library**: [React 19.2](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4.x](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)

### AI / Backend Services
- **Orchestration & Text Gen**: Google Cloud Vertex AI (`gemini-2.5-flash`)
- **Image Generation**: Google Cloud Vertex AI (`gemini-2.5-flash-image`)
- **Speech Synthesis**: Google Cloud Vertex AI TTS (`gemini-2.5-flash-tts`) / Web Speech API Fallback
- **Parent Agent**: Gemini Function Calling（ReAct パターンによる自律的ツール実行）

### Authentication & Database
- **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth)（Google ログイン）
- **Database**: [Cloud Firestore](https://firebase.google.com/docs/firestore)（会話ログ・ユーザー管理）
- **Storage**: [Firebase Storage](https://firebase.google.com/docs/storage)（会話画像の永続化）
- **Server-side Access**: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)（Server Actions からの Firestore アクセス）

## 🚀 セットアップ

### 前提条件

- Node.js 18.x 以上 (推奨: 20.x LTS)
- Google Cloud Project with Vertex AI enabled
- Google Cloud Authentication (Service Account Key or Application Default Credentials)
- Firebase プロジェクト（Authentication + Firestore + Storage を有効化）

### インストール手順

1. リポジトリをクローンします。
   ```bash
   git clone <repository-url>
   cd kids-science-lab
   ```

2. 依存パッケージをインストールします。
   ```bash
   npm install
   ```

3. 環境変数を設定します。
   `.env.example` をコピーして `.env.local` を作成し、各種設定を行ってください。
   ```bash
   cp .env.example .env.local
   ```

   **`.env.local` の設定例:**
   ```env
   # Gemini API Key
   GEMINI_API_KEY=your_api_key_here

   # Vertex AI Project & Location（任意）
   VERTEX_AI_PROJECT=your-project-id
   VERTEX_AI_LOCATION=asia-northeast1

   # Google Cloud Authentication
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json

   # Firebase（クライアント側）
   NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

   # Feature Flags（任意）
   USE_PARALLEL_GENERATION=true
   ```

### 開発サーバーの起動

```bash
npm run dev
```
ブラウザで `http://localhost:3000` にアクセスしてください。

## 📂 プロジェクト構造

```text
src/
├── app/                        # Next.js App Router Pages
│   ├── page.tsx                # チャット画面（メイン）
│   ├── actions.ts              # Server Actions（AI ロジック）
│   ├── layout.tsx              # ルートレイアウト
│   ├── globals.css             # グローバルスタイル
│   ├── firebase-config-script.tsx # Firebase 設定スクリプト
│   ├── actions/                # 追加 Server Actions
│   │   └── conversation-logger.ts # 会話ログ Server Action
│   ├── login/                  # ログインページ
│   ├── select-child/           # 子供選択ページ
│   ├── add-child/              # 子供追加ページ
│   ├── report/                 # レポートページ（レガシー）
│   └── parent/                 # 保護者ダッシュボード
│       ├── page.tsx            # ダッシュボードトップ（PC: 2カラム / スマホ: FAB付き）
│       ├── layout.tsx          # 保護者レイアウト（認証ガード）
│       ├── actions.ts          # 保護者向け Server Actions（会話提案・親エージェント）
│       └── conversations/      # 会話履歴一覧・詳細
├── components/                 # UI Components
│   ├── AgentChatInterface/     # メインチャット UI
│   │   ├── index.tsx           # エントリーポイント
│   │   └── ViewRenderer.tsx    # ビュー切り替えレンダラー
│   ├── InputView.tsx           # 質問入力画面
│   ├── ExpertSpotlight.tsx     # 博士選定演出
│   ├── ImageGeneratingView.tsx # 画像生成中画面
│   ├── ResultView.tsx          # 回答表示画面
│   ├── MicButton.tsx           # 音声入力ボタン
│   ├── ExplanationGrid.tsx     # 解説グリッド表示
│   ├── StreamingText.tsx       # ストリーミングテキスト表示
│   ├── ParentReport.tsx        # レポート UI（レガシー）
│   ├── parent/                 # 保護者ダッシュボード用コンポーネント
│   │   ├── ParentAgentChat.tsx # 子育てアドバイザーチャット UI
│   │   ├── AISuggestionCard.tsx# AI 会話きっかけ提案
│   │   ├── StatsCards.tsx      # 統計カード
│   │   ├── ChildSelector.tsx   # 子供切り替え
│   │   ├── RecentConversations.tsx # 最近の会話一覧
│   │   ├── ConversationCard.tsx    # 会話カード
│   │   ├── SceneViewer.tsx     # シーン表示
│   │   └── FeedbackControls.tsx# フィードバック操作
│   └── ui/                     # shadcn/ui コンポーネント
├── contexts/                   # React Context
│   └── AuthContext.tsx         # 認証・子供管理コンテキスト
├── data/                       # 静的データ
│   ├── funFacts.ts             # 豆知識データ
│   └── miniQuizzes.ts          # ミニクイズデータ
├── hooks/                      # Custom React Hooks
│   ├── useAgentChat.ts         # チャットフロー管理
│   ├── useTextToSpeech.ts      # 音声合成（TTS）
│   ├── useSpeechRecognition.ts # 音声入力
│   ├── useBackgroundImageGenerator.ts  # バックグラウンド画像生成
│   ├── useBackgroundAudioGenerator.ts  # バックグラウンド音声生成
│   ├── useBackgroundPairGenerator.ts   # バックグラウンドペア生成
│   ├── useConversationLogger.ts        # 会話ログ記録
│   └── useParentDashboard.ts           # 保護者ダッシュボード
└── lib/                        # Business Logic & Utilities
    ├── agents/                 # エージェントシステム
    │   ├── core.ts             # オーケストレーター・回答生成・Educatorレビュー・深掘り質問
    │   ├── definitions.ts      # 7人のエージェント定義（ペルソナ・専門分野）
    │   ├── types.ts            # 型定義
    │   └── parent-agent/       # 親エージェント（子育てアドバイザー）
    │       ├── core.ts         # ReAct ループ（Gemini Function Calling）
    │       ├── tools.ts        # 分析ツール群（会話履歴・学習進捗・知識ギャップ）
    │       ├── types.ts        # 型定義
    │       └── index.ts        # エントリーポイント
    ├── firebase/               # Firebase 統合
    │   ├── config.ts           # Firebase 初期化（クライアント）
    │   ├── admin.ts            # Firebase Admin SDK 初期化（サーバー）
    │   ├── auth.ts             # 認証ヘルパー
    │   ├── firestore.ts        # Firestore CRUD（クライアント）
    │   ├── firestore-server.ts # Firestore データ取得（サーバー / Admin SDK）
    │   ├── storage.ts          # Firebase Storage（画像アップロード）
    │   ├── types.ts            # Firestore データ型
    │   └── runtime-config.ts   # ランタイム設定
    ├── artists.ts              # アーティスト定義（レガシー）
    ├── chat-history.ts         # チャット履歴管理（LocalStorage）
    ├── conversation-logger.ts  # 会話ログ（Firestore 連携・クライアント）
    ├── conversation-logger-server.ts # 会話ログ（サーバーサイド）
    ├── curiosity-types.ts      # 好奇心タイプ分類
    ├── utils.ts                # ユーティリティ関数
    └── vertexai.ts             # Vertex AI API クライアント

docs/                           # ドキュメント（プロジェクトルート）
├── architecture.md             # アーキテクチャ設計
├── architecture-diagram.md     # アーキテクチャ図
├── sequence-diagrams.md        # シーケンス図
├── user-stories.md             # ユーザーストーリー
├── spec.md                     # 仕様書
├── assets/                     # スクリーンショット・画像
├── doing/                      # 進行中の設計ドキュメント
├── done/                       # 完了した設計ドキュメント
├── todo/                       # 未着手の計画
└── tips/                       # トラブルシューティング・Tips
```

## 🏗️ アーキテクチャ

### 子供向けチャット（Orchestrator-Workers パターン）

子供の質問に対して、以下のパイプラインで処理を行います。

```
質問入力 → Orchestrator(エージェント選定) → スポットライト演出
                                                    ↓
                                          Expert Agent(回答生成)
                                                    ↓
                                    ┌───────────────┼───────────────┐
                                    ↓               ↓               ↓
                             Educator Review   Follow-Up生成   画像+音声生成
                                    ↓               ↓               ↓
                                    └───────────────┼───────────────┘
                                                    ↓
                                          結果表示(ResultView)
                                                    ↓
                                        バックグラウンド生成(残りペア)
```

1. **Orchestrator**: ユーザーの質問を解析し、7人の専門家から最適なエージェントを選定します。
2. **Expert Agent**: 選定された博士が、自身のペルソナと口調で回答を起承転結の4ステップで生成します。
3. **Educator Review**: スマイル先生が回答を「子供にとって分かりやすいか」チェックし、必要に応じて修正します（回答した博士が educator 自身の場合はスキップ）。
4. **Follow-Up Generation**: 回答内容から深掘り質問候補を自動生成します（ステップ 3 と並列実行）。
5. **Multimedia Generation**: 4パネル結合画像と最初のステップの音声を並列生成します。残りのステップの画像・音声はバックグラウンドで逐次生成されます。

### 保護者向けエージェント（ReAct パターン）

保護者ダッシュボードでは、子育てアドバイザーエージェントが自律的に動作します。

1. **親からの質問受付**: 自由入力またはプリセット質問（「学習の様子」「新しい興味」「会話のヒント」等）
2. **ReAct ループ**: Gemini の Function Calling により、エージェントが必要なツールを自分で選択・実行します。
   - `analyzeConversationHistory` — 会話履歴のトピック・博士分布を分析
   - `analyzeLearningProgress` — 今週と先週の学習傾向を比較
   - `identifyKnowledgeGaps` — 未探索の分野を特定し探索を提案
3. **最終回答生成**: 複数ツールの分析結果を統合し、具体的で実践的なアドバイスを生成します。

### 認証フロー

1. `/login` — Google アカウントでログイン
2. `/select-child` — 子供プロフィールを選択（または `/add-child` で新規作成）
3. `/` — チャット画面（メイン）

詳細なアーキテクチャについては [docs/architecture.md](docs/architecture.md) を参照してください。
シーケンス図は [docs/sequence-diagrams.md](docs/sequence-diagrams.md) を参照してください。
