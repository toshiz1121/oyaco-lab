# Phase 3: インタラクティブ体験の強化 実装計画 (詳細版)

## 概要
ユーザーフィードバックに基づき、管理機能（保存・共有）よりも**「体験の質」**を優先します。
生成された作品を対話的に修正する機能、待機時間を楽しませる演出、そして巨匠アバターとの対話機能を実装し、エンターテインメント性を極大化します。
**永続化（DB/Auth）は行わず、オンメモリ/クライアントステートで完結させる**ことで、迅速な実装と軽快な動作を実現します。

## 実装機能詳細

### 1. Interactive Adjustments (対話的な作品修正)
生成された作品に対して、チャット形式で追加の指示を出し、修正・調整を行います。

- **ユーザー体験**:
  - チャットで「もう少し明るくして」と指示。
  - 巨匠が反応し、修正版を生成。
  - 修正履歴を保持し、いつでも前のバージョンに戻れる。
- **データ構造 (Client State)**:
  ```typescript
  interface ArtworkVersion {
    id: string;
    imageUrl: string;
    prompt: string;
    createdAt: number;
  }
  // Zustand storeなどで管理
  ```
- **Server Action (`modifyArtworkAction`)**:
  - **Input**: `currentImageUrl`, `instruction`, `artistId`
  - **Process**: 
    1. Image MCP `modify_existing_image` を呼び出し。
    2. 指示（Instruction）はユーザーの入力をそのまま渡す（MCP側で解釈）。
  - **Output**: `newImageUrl`

### 2. Immersive Loading Experience (没入感のある待機演出)
画像生成時間をショータイム化します。

- **Loading States**:
  - `PREPARING`: 「画材を準備している...」
  - `CONCEPTUALIZING`: 「構想を練っている...」
  - `SKETCHING`: 「下書きをしている...」
  - `PAINTING`: 「筆を走らせている...」
  - `FINISHING`: 「仕上げのニスを塗っている...」
- **実装方針**:
  - `src/components/LoadingOverlay.tsx` を作成。
  - `useEffect` でタイマーを回し、数秒ごとにメッセージ（巨匠ごとの定義 `src/lib/artists.ts` に追加）を切り替える。
  - プログレスバーと連動。

### 3. Artist Avatar Chat (巨匠アバターとの対話)
解説機能を進化させたチャットボット。

- **データ構造 (Client State)**:
  ```typescript
  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string; // HTMLタグを含む可能性あり（強調など）
    timestamp: number;
  }
  ```
- **Server Action (`chatWithArtistAction`)**:
  - **Input**: `history: ChatMessage[]`, `userMessage`, `artistId`, `currentArtworkContext`
  - **Process**:
    - Gemini API (Text) を呼び出し。
    - System Prompt: 巨匠のペルソナ、現在の作品の文脈（テーマ、画風）を注入。
  - **Output**: `assistantMessage`

## 実装ステップ（詳細タスクリスト）

### Step 0: データ準備 (Data Prep)
- [ ] **アバター画像の準備**: `public/avatars/{artistId}.png` を用意（Image MCPで生成、またはプレースホルダー）。
- [ ] **アーティストデータの拡張**: `src/lib/artists.ts` に `loadingMessages` (配列) と `firstMessage` (チャット開始時の挨拶) を追加。

### Step 1: ローディング演出の実装 (Loading Experience)
- [ ] **LoadingOverlayコンポーネント作成**:
  - 背景を少し暗くし、中央にアバターと吹き出しを表示。
  - メッセージのローテーションロジック実装。
- [ ] **GeneratorCanvas統合**: 生成中のステート (`isGenerating`) に応じてOverlayを表示。

### Step 2: チャットUIの実装 (Chat UI)
- [ ] **ChatInterfaceコンポーネント作成**:
  - `src/components/ChatInterface.tsx`
  - メッセージリスト（スクロール対応）。
  - 入力エリア（送信ボタン付き）。
  - アバター表示エリア。
- [ ] **作品詳細ページへの統合**:
  - 解説エリアをチャットUIに置き換え。
  - 初回ロード時に解説生成アクション (`generateArtistCommentAction`) の結果を最初のメッセージとして表示。

### Step 3: 対話ロジックの実装 (Chat Logic)
- [ ] **Action拡張**: `src/app/actions.ts` に `chatWithArtistAction` を実装。
- [ ] **コンテキスト維持**: フロントエンドでチャット履歴を保持し、APIリクエストごとに送信。

### Step 4: 画像修正機能の実装 (Interactive Modify)
- [ ] **修正検知ロジック**:
  - ユーザーのメッセージが「修正指示」かどうかを判定（簡易的には常にチャット応答＋修正指示があれば修正アクション実行、またはUI上に「修正モード」トグルを設置）。
  - **今回はシンプルに**: チャット欄とは別に「修正指示」ボタン、またはチャット内で「修正して」と言われたらツール呼び出し...は複雑なので、**「作品を修正する」ボタン**を設置し、専用の入力モードにするのが確実。
- [ ] **Modify Action実装**: `src/app/actions.ts` に `modifyArtworkAction` を追加。
- [ ] **バージョン管理UI**:
  - キャンバス横にサムネイルリストを表示し、過去バージョンに戻れるようにする。

## 技術的制約・注意点
- **ステートレス**: ブラウザをリロードするとチャット履歴や修正履歴は消えます（今回は許容）。
- **コスト**: チャットの往復ごとにGemini APIを消費します。
- **画像一貫性**: `modify_existing_image` は構図を維持しようとしますが、大幅に変わる可能性もあります。巨匠の「気まぐれ」として処理します。
