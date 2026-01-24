# Kids Science Lab (キッズ・サイエンス・ラボ)

子供たちの「なぜ？」「どうして？」という素朴な疑問に対し、個性豊かなAIエージェント（博士や専門家）が対話形式で答え、画像や音声を交えてわかりやすく解説する科学教育Webアプリケーションです。

## 📖 プロジェクト概要

忙しい共働き夫婦と、好奇心旺盛な子供たちのコミュニケーションを支援することを目的としています。
Orchestrator-Workers パターンを採用したAIエージェント群が、子供の質問内容に応じて最適な専門家（Scientist, Biologist, Astronomerなど）を選定し、年齢や好みに合わせたスタイルで回答します。

### コア機能

- **🤖 個性的な専門家エージェント**: 質問内容に合わせて、最適な「専門家」が回答します。
- **🎨 マルチメディア解説**: テキストだけでなく、AI生成されたイラストや図解で視覚的に説明します。
- **🗣️ 音声対話**: 解説文の読み上げにより、文字が読めない小さなお子様でも楽しめます。
- **📊 保護者向けレポート**: 子供がどんなことに興味を持っているか、何を学んだかを親が確認できるレポート機能を提供します。

## 🛠️ 技術スタック

### Frontend
- **Framework**: [Next.js 16.1](https://nextjs.org/) (App Router)
- **Library**: [React 19.2](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4.x](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)

### AI / Backend Services
- **Orchestration & Text Gen**: Google Gemini Pro (`gemini-3-pro-preview`)
- **Image Generation**: Google Gemini Pro Vision / Imagen (`gemini-3-pro-image-preview`)
- **Speech Synthesis**: Web Speech API / External TTS API (OpenAI compatible)

## 🚀 セットアップ

### 前提条件

- Node.js 18.x 以上 (推奨: 20.x LTS)
- Gemini API Key

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
   `.env.example` をコピーして `.env.local` を作成し、APIキーを設定してください。
   ```bash
   cp .env.example .env.local
   ```

   **`.env.local` の設定例:**
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   # TTSなどでOpenAI互換APIを使用する場合
   # OPENAI_API_BASE_URL=https://api.openai.com/v1
   ```

### 開発サーバーの起動

```bash
npm run dev
```
ブラウザで `http://localhost:3000` にアクセスしてください。

## 📂 プロジェクト構造

```text
src/
├── app/                  # Next.js App Router Pages
│   ├── page.tsx          # Chat Interface (Main)
│   ├── report/           # Parent Report Page
│   └── actions.ts        # Server Actions (AI Logic)
├── components/           # UI Components
│   ├── AgentChatInterface.tsx  # Main Chat UI
│   ├── ParentReport.tsx        # Report UI
│   └── ui/                     # shadcn/ui components
├── lib/                  # Business Logic & Utilities
│   ├── agents/           # Agent Definitions & Core Logic
│   │   ├── core.ts       # Orchestrator & Response Generation
│   │   ├── definitions.ts # Agent Personas
│   │   └── types.ts      # Type Definitions
│   ├── chat-history.ts   # History Management (LocalStorage)
│   └── gemini.ts         # Gemini API Client
├── hooks/                # Custom React Hooks
└── docs/                 # Documentation
    ├── architecture.md   # Architecture Design
    └── user-stories.md   # User Stories
```

## 🏗️ アーキテクチャ

本システムは **Orchestrator-Workers Pattern** を採用しています。

1. **Orchestrator Agent**: ユーザーの入力を解析し、適切な専門家エージェントに振り分けます。
2. **Expert Agents**: 科学者、生物学者、天文学者などの専門家が、それぞれのペルソナに基づいて回答を生成します。
3. **Multimedia Generation**: 回答内容に基づいて、子供向けのイラストを生成し、音声を合成します。

詳細なアーキテクチャについては [docs/architecture.md](docs/architecture.md) を参照してください。
