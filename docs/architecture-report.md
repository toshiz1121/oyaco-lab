# AIキッズサイエンスラボ - ソースコード調査レポート

## 1. プロジェクト概要
Next.js (App Router) を使用した、子供向けの科学教育チャットボットアプリケーションです。GoogleのGemini APIを活用し、子供の質問に対して適切な「専門家（エージェント）」を選定し、子供向けの分かりやすい言葉と画像で回答を提供します。

### 技術スタック
- **Framework:** Next.js 16.1.1 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Animation:** Framer Motion
- **AI Model:** 
  - Text: `gemini-2.0-flash` (高速応答、JSON出力)
  - Image: `gemini-3-pro-image-preview` (画像生成)
  - TTS: `gemini-2.5-flash-preview-tts` (音声合成 - REST API経由)
- **Storage:** 
  - Chat History: LocalStorage
  - Images: IndexedDB (via `idb`) + LocalStorage Fallback

## 2. アプリケーションアーキテクチャ

### 2.1 ディレクトリ構造
- `src/app/`: ページルーティング (メイン画面、レポート画面)、Server Actions
- `src/components/`: UIコンポーネント (Chat Interface, Expert Spotlight, Result Viewなど)
- `src/lib/`: ユーティリティ、APIクライアント、データストアロジック
- `src/lib/agents/`: エージェント定義、専門家選定ロジック
- `src/hooks/`: カスタムフック (音声認識、音声合成)

### 2.2 データフロー
1.  **ユーザー入力:** 音声 (Web Speech API) またはテキスト入力。
2.  **オーケストレーター (Agent Selection):**
    - `src/lib/agents/core.ts` の `decideAgent` 関数がGemini APIを呼び出し、質問内容に基づいて最適な「専門家」を選定します。
    - 履歴 (`history`) も考慮し、文脈に沿った選定を行います。
3.  **専門家演出 (Expert Spotlight):**
    - `src/components/ExpertSpotlight.tsx` で、選ばれた専門家にスポットライトが当たるアニメーションを表示。
    - 子供の興味を惹きつけ、待ち時間をエンターテインメント化しています。
4.  **回答生成 (Expert Response):**
    - `generateExpertResponse` 関数が、選定された専門家のペルソナ（口調、性格）に基づいて回答を生成します。
    - 回答は「ステップバイステップ」形式のJSONで出力され、各ステップに説明文と挿絵プロンプトが含まれます。
5.  **画像生成 (Illustration):**
    - 回答に含まれる挿絵プロンプトを結合し、Gemini Image Generation Modelで画像を生成します。
    - 複数ステップの場合は、コマ割り（2分割、4分割）の画像プロンプトを作成します。
6.  **結果表示 (Result View):**
    - テキスト、画像、音声読み上げを組み合わせて回答を提示します。

### 2.3 エージェントシステム (`src/lib/agents/`)
以下の専門家が定義されています (`definitions.ts`)：
- **Scientist (Dr. Quark):** 物理・化学（デフォルト）
- **Biologist (Ranger Green):** 生物・自然
- **Astronomer (Luna Starlight):** 宇宙・星
- **Historian (Grandpa Time):** 歴史
- **Artist (Palette):** 芸術・感性
- **Educator (Teacher Smile):** 総合・サポート

## 3. 主要機能詳細

### 3.1 チャットインターフェース (`AgentChatInterface.tsx`)
- ステートマシンとして動作し、以下のViewModeを遷移します：
  - `input`: 質問入力待ち（デフォルトはScientistが表示）
  - `selecting`: オーケストレーターによる専門家選定中（スポットライト演出）
  - `thinking`: 回答生成中
  - `result`: 結果表示
- 音声認識 (`useSpeechRecognition`) と連携し、ハンズフリーでの操作をサポート。

### 3.2 データ永続化
- **Chat History (`src/lib/chat-history.ts`):**
  - セッション単位で会話履歴をLocalStorageに保存。
  - 親向けレポート機能で使用されます。
- **Image Storage (`src/lib/image-storage.ts`):**
  - 生成された画像（Base64）は容量が大きいため、IndexedDBに保存します。
  - IndexedDBが使えない環境（Private Browsingなど）のために、LocalStorageへのFallback機能（最新5件のみ）とLRUキャッシュ（自動削除）機能を実装しています。

### 3.3 保護者向けレポート (`src/app/report/`)
- 子供の利用状況（総質問数、興味のある分野/エージェント）を可視化。
- 会話履歴を確認し、親子での会話のきっかけ（ヒント）を提供します。

## 4. 改善・検討ポイント（ソースコードに基づく）
- **音声合成:** 現在 `src/lib/gemini.ts` でREST APIを直接叩いていますが、SDKのサポート状況に合わせて更新が必要かもしれません。
- **エラーハンドリング:** 画像生成やAPI呼び出し失敗時のUX（リトライや代替表示）は実装されていますが、ネットワーク不安定時の挙動などは実機確認が推奨されます。
- **パフォーマンス:** 画像データがIndexedDBに溜まるため、`performStorageMaintenance` による定期的なクリーンアップが重要です。

## 5. 結論
非常にモダンなスタックで構築されており、子供向けのUI/UX（ひらがな、アニメーション、音声）に配慮された設計となっています。特にエージェント切り替えシステムと画像生成の連携は、このアプリのコアバリューとなる部分です。
