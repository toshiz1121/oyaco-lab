# Phase 1: MVP 実装計画

**目標**: 巨匠の画風を選択し、テーマを入力して絵画を生成・表示する基本機能を実装する。

## 実装ステップ

### Step 1: プロジェクトセットアップ
- [ ] Next.js プロジェクトの初期化 (`create-next-app`)
- [ ] Tailwind CSS + shadcn/ui の導入
- [ ] ディレクトリ構造の整理 (`src/app`, `src/components`, `src/lib`, `src/types`)
- [ ] ESLint / Prettier の設定

### Step 2: データ定義とコアロジック
- [ ] 画風データ (`artists.json`) の定義 (ID, 名前, 説明, テンプレート)
- [ ] 型定義 (`Artist`, `Artwork`) の作成
- [ ] プロンプト生成ロジックの実装 (テンプレート置換)

### Step 3: UIコンポーネント実装 (モックアップ)
- [ ] `ArtistSelector`: 画風選択カードリスト
- [ ] `ThemeInput`: テーマ入力フォーム
- [ ] `GeneratorCanvas`: 生成結果表示エリア (プレースホルダー)
- [ ] メインページ (`page.tsx`) への統合

### Step 4: AI生成機能の統合 (Server Actions)
- [ ] Server Action `generateArtwork` の作成
- [ ] Image MCP (`create_image`) との接続
- [ ] 生成ステータスの管理ロジック
- [ ] エラーハンドリング

### Step 5: 生成プロセス演出の実装
- [ ] ローディングアニメーション ("巨匠が描いています...")
- [ ] 進捗表示 (簡易的なタイマーベース)

### Step 6: 結果表示とダウンロード
- [ ] 生成画像の表示コンポーネント
- [ ] ダウンロード機能の実装
- [ ] "再生成" ボタンの実装

### Step 7: 最終確認とクリーンアップ
- [ ] 動作テスト (正常系・異常系)
- [ ] コードのクリーンアップ
- [ ] READMEの更新 (実行方法)

## 技術的制約・前提
- 認証機能はMVPではスキップ (全ユーザーが利用可能)
- データベースは使用せず、生成結果は一時的な表示のみ (またはLocalStorage保存)
- 画像はImage MCPが返すパス/URLを直接使用
