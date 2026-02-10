# AIキッズサイエンスラボ - 詳細アーキテクチャレポート

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

## 2. システムアーキテクチャ詳細

### 2.1 データフローと処理パイプライン
ユーザーからの入力がシステム内でどのように処理され、最終的な出力（テキスト、画像、音声）として返されるか、その詳細なステップは以下の通りです。

1.  **入力フェーズ:**
    - ユーザーはマイクボタン（Web Speech API）またはテキスト入力エリアから質問を送信します。
    - 音声入力の場合、ブラウザ標準の認識機能によりテキストに変換されます。
    - `AgentChatInterface` が状態を管理し、処理を開始します。

2.  **オーケストレーションフェーズ (Agent Selection):**
    - **ファイル:** `src/lib/agents/core.ts` -> `decideAgent`
    - **モデル:** `gemini-2.0-flash` (Temperature: 0.3)
    - **入力:** 現在の質問 + 会話履歴（直近のコンテキスト）
    - **処理:** 
        - 履歴と思考プロセスを含むプロンプトにより、質問を分類。
        - 6人の専門家（Scientist, Biologist, Astronomer, Historian, Artist, Educator）から最適任者を選定。
        - 子供向けの平易な言葉で「選定理由」を生成（例：「うちゅうのことがとくいだから」）。
    - **フォールバック:** JSONパースエラーやAPIエラー時は、デフォルトで `Scientist` が選定されます。

3.  **回答生成フェーズ (Response Generation):**
    - **ファイル:** `src/lib/agents/core.ts` -> `generateExpertResponse`
    - **モデル:** `gemini-2.0-flash` (Temperature: 0.7)
    - **入力:** 選定されたエージェントのペルソナ、質問、履歴、説明スタイル（デフォルト/比喩/簡易/詳細）。
    - **処理:**
        - エージェントの口調（例：博士口調、お姉さん口調）を模倣。
        - 複雑な概念を2〜4つの「ステップ」に分解して説明。
        - 各ステップごとに、説明文 (`text`) と、その内容を表す挿絵プロンプト (`visualDescription`) を生成。
    - **出力形式:** 厳密なJSON構造（`{ text, steps: [{ stepNumber, text, visualDescription }] }`）。

4.  **マルチメディア生成フェーズ:**
    - **画像生成:**
        - **ファイル:** `src/lib/agents/core.ts` -> `generateIllustration`
        - **モデル:** `gemini-3-pro-image-preview`
        - **処理:** 各ステップの `visualDescription` を結合し、パネルレイアウト（単一、2分割、4分割）の画像を生成します。アスペクト比は `4:3`。
    - **音声合成 (TTS):**
        - **ファイル:** `src/lib/gemini.ts` -> `generateSpeech`
        - **モデル:** `gemini-2.5-flash-preview-tts`
        - **処理:** テキストをREST API経由で送信し、Base64エンコードされたWAVデータを受信。ブラウザ上で再生可能な形式にヘッダーを付与して再生します。

## 3. コンポーネント詳細仕様

### 3.1 エージェントシステム (`src/lib/agents/`)

#### 専門家定義
| ID | 名前 (日) | 専門分野 | 特徴 |
| :--- | :--- | :--- | :--- |
| `scientist` | Dr. Quark | 物理・化学 | 論理的だが親しみやすい博士。デフォルトのエージェント。 |
| `biologist` | Ranger Green | 生物・自然 | アウトドア派。生き物の不思議に詳しい。 |
| `astronomer` | Luna Starlight | 宇宙・星 | ロマンチスト。星空や惑星の話が得意。 |
| `historian` | Grandpa Time | 歴史 | 昔話をするような優しいおじいちゃん。恐竜も担当。 |
| `artist` | Palette | 芸術 | 感性豊か。色や感情、創造的な質問に答える。 |
| `educator` | Teacher Smile | 総合 | 優しい先生。勉強の悩みや生活アドバイス。 |

#### プロンプト戦略
- **選定プロンプト:** 会話履歴を含めることで、文脈に沿ったエージェント継続性を確保しています。
- **回答プロンプト:**
    - `steps` 配列による構造化出力を強制し、長文回答を回避。
    - 各ステップの説明文は「独立して理解できる」ように指示（文脈依存の排除）。
    - 視覚的説明 (`visualDescription`) を同時に生成させることで、テキストと画像の整合性を担保。

### 3.2 チャットUI状態管理 (`AgentChatInterface.tsx`)
UIは以下のステートマシンとして動作し、ユーザー体験を制御します。

1.  **`input` (初期状態/待機中):**
    - デフォルトエージェント（または前回の担当）を表示。
    - 音声認識またはテキスト入力待ち。
2.  **`selecting` (選定中):**
    - `ExpertSpotlight` コンポーネントを表示。
    - スポットライトアニメーションにより、バックグラウンドでのAPI遅延（エージェント選定処理）を隠蔽し、期待感を醸成。
3.  **`thinking` (生成中):**
    - `ThinkingView` コンポーネントを表示。
    - 選定されたエージェントが「考え中」のアニメーションを表示。回答生成と画像生成の完了を待機。
4.  **`result` (結果表示):**
    - `ResultView` コンポーネントを表示。
    - 生成された画像、テキスト、音声を提示。
    - 会話履歴に保存し、次の入力を待機（`input` への復帰または継続的な会話）。

### 3.3 データ永続化レイヤー

#### 画像ストレージ (`src/lib/image-storage.ts`)
Base64エンコードされた画像データは大容量となるため、Web標準のストレージ制限を回避する多層構造を採用しています。

- **プライマリストレージ: IndexedDB**
    - ライブラリ: `idb`
    - ストア名: `images`
    - キー: `imageId` (UUID)
    - 保存データ: `Blob` (画像バイナリ), `timestamp`, `mimeType`, `size`
    - **クォータ管理:**
        - ストレージ使用率が80%を超えた場合、LRU (Least Recently Used) アルゴリズムに基づき、最も古い画像から自動削除。
        - 起動時に30日以上経過した画像を自動クリーンアップ (`performStorageMaintenance`)。

- **フォールバックストレージ: LocalStorage**
    - 使用条件: Private BrowsingモードなどでIndexedDBが利用できない場合。
    - 制限: 容量制限（約5MB）のため、**最新5件**のみを保持。
    - 実装: `QuotaExceededError` を捕捉し、古いデータを削除して再試行する堅牢なエラーハンドリング。

#### チャット履歴 (`src/lib/chat-history.ts`)
- **ストレージ:** LocalStorage (`kids_science_chat_history`)
- **構造:** `ChatSession` 配列（最大20セッション）
    - 各セッションは `ChatMessage` のリストを持つ。
    - `ChatMessage` には `role`, `content`, `agentId`, `steps` (回答データ), `imageUrl` (参照) が含まれる。
- **データ保全:**
    - 容量オーバー時は、まずセッション数を削減（20 -> 5）。
    - それでも保存できない場合は、画像参照を削除してテキストのみを保存する「Degraded Mode」へ移行。

### 3.4 外部API連携仕様 (`src/lib/gemini.ts`)

#### API呼び出し共通基盤
- `GoogleGenerativeAI` SDKをラップし、エラーハンドリングとログ出力を統一。
- 開発環境でのデバッグ用に、リクエスト/レスポンスの詳細ログ（長いデータはtruncate）を出力。

#### 音声合成 (TTS) 詳細
- 現在のSDKがTTSを完全サポートしていない（またはプレビュー機能のため不安定な）ため、**REST APIを直接コール**する実装を採用。
- **エンドポイント:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`
- **音声仕様:**
    - Format: Linear PCM (24kHz, 16-bit, Mono)
    - Container: Base64 encoded in JSON response
- **クライアント処理:**
    - 受信したPCMデータに、ブラウザ再生用の **WAVヘッダー** を動的に付与（`addWavHeader` 関数）。
    - `Uint8Array` 操作によりバイナリ処理を行い、`Audio` オブジェクトとして再生。

### 3.5 レポート機能集計ロジック (`src/components/ParentReport.tsx`)
保護者が子供の興味関心を把握するための統計データは、クライアントサイドで `localStorage` から計算されます。

1.  **総質問数:** 全セッションの `user` ロールのメッセージ数を合算。
2.  **興味のある分野:**
    - `assistant` ロールのメッセージに含まれる `agentId` を集計。
    - 最も出現頻度の高いエージェント（専門家）を特定。
3.  **会話のヒント:**
    - 直近のセッションタイトル（最初の質問内容）を取得し、「『〜』についてもっと聞いてみませんか？」と提案。
    - 履歴がない場合はデフォルトのプロンプトを表示。

## 4. セキュリティとパフォーマンスに関する考慮事項

### セキュリティ
- **APIキー管理:** 環境変数 (`GEMINI_API_KEY`) で管理し、Server Actions (`src/app/actions.ts`) 経由でのみアクセス。クライアントサイドには露出させない。
- **コンテンツ安全性:** Gemini APIのセーフティ設定（デフォルト）に加え、システムプロンプトで「子供向け」であることを明示し、不適切な回答を抑制。

### パフォーマンス
- **画像最適化:**
    - 生成された画像は即座にIndexedDBへオフロードし、Reactの状態（メモリ）にはData URLのみを保持。
    - `next/image` ではなく、動的生成コンテンツのため通常の `<img>` タグを使用（Base64表示）。
- **非同期処理:**
    - エージェント選定と回答生成の待機時間を「演出」で埋めることで、体感待ち時間を短縮。
    - 音声データは再生が必要になるまでデコード遅延（`useTextToSpeech` フック）。
