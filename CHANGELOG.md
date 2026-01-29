# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.12.0] - 2026-01-28

### Changed
- **BREAKING**: Gemini APIからVertex AIへ完全に移行しました。
- `src/lib/gemini.ts` を `src/lib/vertexai.ts` にリネームし、アーキテクチャを刷新しました。
- 環境変数 `GEMINI_API_KEY` を廃止し、Google Cloud標準の認証方式に変更しました。
- `gemini-3-pro-preview` 等の古いモデルから `gemini-2.5-flash` シリーズに一新しました。

### Added
- Vertex AI専用のカスタムエラー型 `VertexAIError` を導入し、エラーハンドリングを強化しました。
- 指数バックオフとジッターを用いたリトライロジックを実装し、APIの耐障害性を向上させました。
- 設定の一元管理（`VERTEX_AI_CONFIG`）により、モデルやリージョンの変更を容易にしました。
- 包括的なJSDocコメントと実装背景の記述を追加し、保守性を向上させました。

### Removed
- `@google/generative-ai` パッケージへの依存を削除しました。
- 未使用のレガシーなGemini API参照をすべて削除しました。


### Phase 12: UI/UX改善（計画中）

**次のステップ**:
- US-12.1: 履歴管理UI改善（ギャラリー表示）
- US-12.2: 作品詳細ページ
- US-13.1: 写真風モードの追加
- US-13.2: その他の画風追加

**詳細**: [`docs/user-stories.md#phase-12-uiux改善`](docs/user-stories.md#phase-12-uiux改善)

## [0.11.3] - 2026-01-16

### Added
- **Phase 11.3: 巨匠コメント永続化**: ページリロード後も過去の作品のコメントが表示される
- `GenerationMetadata`に`artistComment`フィールドを追加
- コメント生成後の自動保存機能
- 履歴復元時のコメント復元機能
- コメントなしの場合の表示改善（「コメントなし」と表示）

### Changed
- `generation-history.ts`: `GenerationMetadata`に`artistComment?: string`を追加
- `page.tsx`: `handleTransform`と`handleRemix`でコメント保存処理を実装
  - コメント生成完了後、画像生成完了を待ってメタデータ更新
  - LocalStorageの履歴を更新
- `page.tsx`: 履歴復元時のコメント復元useEffectを追加
- `ArtworkDescription.tsx`: コメントがない場合も「コメントなし」と表示

### Technical
- コメント保存のタイミング: 画像生成完了 → コメント生成完了 → メタデータ更新
- 後方互換性: `artistComment`はオプショナルフィールド（古いデータも動作）
- LocalStorage更新: `getGenerationHistory()`で履歴を取得し、該当アイテムを更新

### User Stories
- US-11.3: 巨匠コメントの永続化 ✅
  - コメントがメタデータに保存される
  - 履歴復元時にコメントも復元される
  - コメントがない場合は「コメントなし」と表示

### Related Documents
- 完了報告: [`docs/done/phase11.3-artist-comment-persistence-completion.md`](docs/done/phase11.3-artist-comment-persistence-completion.md)

## [0.11.2] - 2026-01-08

**次のステップ**:
- Phase 11.4: 履歴UIの改善（P1）
  - 履歴一覧表示
  - サムネイル表示
  - 検索・フィルタリング
- Phase 11.5: パフォーマンス最適化（P2）
  - プリロード戦略
  - 仮想スクロール
  - メモリ管理

**詳細**: [`docs/doing/phase11-history-persistence-design.md`](docs/doing/phase11-history-persistence-design.md)

## [0.11.2] - 2026-01-08

### Performance Improvements
- **UI更新の即時反映**: コメント生成が完了次第、即座に表示されるように改善（27秒短縮）
- **重複処理の削除**: `interpretTheme`の重複呼び出しを削除し、画像生成時間を4秒短縮
- **体感速度の大幅改善**: 約90%の体感速度向上を達成

### Changed
- `page.tsx`: `handleTransform`と`handleRemix`を修正
  - `Promise.allSettled`で待つのをやめ、各処理が完了次第State更新
  - 画像生成とコメント生成が真に並列実行され、完了次第表示
- `prompt.ts`: `generatePrompt`に`interpretation`引数を追加（オプショナル）
  - 後方互換性を維持しながら、重複呼び出しを防止
- `actions.ts`: `generateArtworkAction`を修正
  - `interpretTheme`を1回のみ呼び出し、結果を`generatePrompt`に渡す

### Technical
- **Phase 1: UI更新の即時反映**
  - コメント表示: 27秒短縮（30秒 → 3秒）
  - 各Promiseの`.then()`内で直接State更新
  - エラーハンドリングを`.catch()`で個別に実装
- **Phase 2: 重複処理の削除**
  - 画像生成: 4秒短縮（30秒 → 26秒）
  - APIコスト: 50%削減（`interpretTheme`部分）
  - `interpretation`引数により後方互換性を維持

### Performance Metrics
- **コメント表示**: 30秒 → 3秒（**90%改善**）
- **画像生成**: 30秒 → 26秒（**13%改善**）
- **合計体感速度**: 約90%向上

### User Experience
- ユーザーは「何かが起きている」と感じられる（コメントが先に表示される）
- 待ち時間の体感が大幅に短縮
- 片方が失敗しても、もう片方は正常に動作

### Related Documents
- 計画書: [`docs/doing/parallel-execution-fix-plan.md`](docs/doing/parallel-execution-fix-plan.md)

## [0.11.1] - 2026-01-08

### Added
- **Phase 11.1: 履歴永続化機能**: ページリロード後も過去の生成画像が表示され、履歴ナビゲーションが正常に動作
- 履歴管理をimageIdベースに変更（DataURLではなくID参照）
- ページロード時の履歴復元機能（LocalStorageから履歴を読み込み）
- 履歴ナビゲーション時の画像遅延読み込み（IndexedDBから取得）
- 画像キャッシュ機能（表示中の画像をメモリにキャッシュ）
- エラーハンドリング（画像が見つからない場合のエラー表示）

### Changed
- `GeneratorCanvas.tsx`: 履歴管理を完全に書き換え
  - `HistoryItem`型の導入（imageId、timestamp、metadataIdを管理）
  - `imageCache`によるメモリキャッシュ
  - 履歴ナビゲーション時の非同期画像読み込み
  - `displayMetadata`による履歴ごとのメタデータ表示
  - エラー状態の管理と表示
- `page.tsx`: `handleDownload`を改善
  - メタデータからファイル名を生成（`masterpiece-{artistName}-{theme}-{date}.jpg`）
  - より意味のあるファイル名で保存可能に
- `PromptDetailsDialog`: 履歴ナビゲーション時のメタデータ表示に対応

### Fixed
- **履歴ナビゲーション時のプロンプト表示**: 履歴を遡ったときに正しいプロンプトが表示されるように修正
- **履歴ナビゲーション時のダウンロード**: 履歴を遡ったときに正しい画像がダウンロードされるように修正
- **ページリロード後の履歴消失**: IndexedDBに保存された画像がページリロード後も表示されるように修正

### Technical
- 履歴アイテム構造: `{ imageId, timestamp, metadataId }`
- キャッシュ戦略: 表示中の画像のみメモリにキャッシュ（将来的に前後1枚も追加予定）
- エラーハンドリング: 画像読み込み失敗時のエラーメッセージ表示
- 後方互換性: Phase 9.5以前のデータ（imageIdなし）はスキップ

### User Stories
- US-11.1: ページリロード後も履歴が表示される ✅
- US-11.2: 履歴ナビゲーションが正常に動作する ✅
- US-11.3: 履歴ごとのプロンプト詳細が表示される ✅
- US-11.4: 履歴ごとのダウンロードが正常に動作する ✅

## [0.11.0] - 2026-01-08

### Added
- **Phase 10: IndexedDB統合による大容量画像履歴サポート**: LocalStorageの容量制限を解決し、100枚以上の画像履歴を保存可能に
- `image-storage.ts`: IndexedDBを使用した画像ストレージ管理
  - CRUD操作（保存、取得、削除）
  - ストレージ使用量統計
  - 古い画像の自動削除（30日以上）
  - LRU削除戦略（最大100枚）
- `migration.ts`: Phase 9.5からPhase 10への自動マイグレーション
  - 既存データのIndexedDB移行
  - マイグレーション状態管理
- **Phase 10.1: P0対策（本番環境対応）**:
  - IndexedDB利用可能性チェック（プライベートモード検出）
  - LocalStorageへの自動フォールバック（最新5件のみ）
  - クォータ管理機能（80%で警告）
  - 定期的なストレージメンテナンス

### Changed
- `generation-history.ts`: 非同期化とIndexedDB統合
  - `GenerationMetadata`に`imageId`フィールド追加
  - `saveGenerationMetadata()`を非同期化
  - 画像データをIndexedDBに保存、メタデータのみLocalStorageに保存
- `page.tsx`: ストレージ初期化とマイグレーション処理を追加
  - アプリ起動時の自動マイグレーション
  - ストレージ警告メッセージ表示
  - 画像生成時に`imageId`を生成
- `ChatInterface.tsx`: 修正時のメタデータに`imageId`を追加

### Fixed
- **QuotaExceededError問題の根本的解決**: LocalStorageの容量制限を回避
- 大量の画像履歴保存が可能に（5-10枚 → 100枚）

### Technical
- 依存関係追加: `idb@^8.0.0`（IndexedDBのPromiseラッパー）
- データベース: `masterpiece_images` (IndexedDB)
- ストレージ容量: LocalStorage 50-100KB + IndexedDB 50MB以上
- LocalStorage使用量: 95%削減（数MB → 50-100KB）
- 画像保存可能数: 10-20倍増加（5-10枚 → 100枚）

### User Stories
- US-10.1: 大量の画像履歴を保存する ✅
- US-10.2: プライベートモードでも動作する ✅
- US-10.3: ストレージ容量を管理する ✅
- US-10.4: 古い画像を自動削除する ✅

## [0.10.0] - 2026-01-07

### Added
- **Phase 9: プロンプト履歴確認機能**: 生成された画像のプロンプト詳細を確認できる機能を実装
- `generation-history.ts`: LocalStorageを使用した履歴管理ロジック（最大50件）
- `PromptDetailsDialog.tsx`: プロンプト詳細表示ダイアログ
  - ユーザー入力、アーティスト情報、テーマ解釈、構造化プロンプト、ネガティブプロンプトをセクション別に表示
  - 各セクションのコピー機能
  - Accordionによる折りたたみ表示
- **Phase 9.1: チャット修正時のプロンプト履歴保存**: チャットで画像修正を依頼した際、修正指示がプロンプト履歴に保存される
- **Phase 9.2: 履歴UI修正**: 履歴ナビゲーションとプロンプト表示・ダウンロード機能が正しく連動

### Changed
- `actions.ts`: 全ての画像生成関数でメタデータを返却（`generateArtworkAction`, `uploadAndTransformAction`, `remixArtworkAction`, `modifyArtworkAction`）
- `page.tsx`: メタデータの管理とLocalStorage操作を追加
- `GeneratorCanvas.tsx`: プロンプト詳細ボタンを追加、履歴に対応したプロンプト表示、ダウンロード処理を内部に移動
- `ChatInterface.tsx`: `onMetadataUpdate`コールバックを追加し、修正時のメタデータ保存に対応

### Technical
- LocalStorageによる永続化（最大50件、QuotaExceededError時の自動削減処理）
- 画像URLとメタデータのマッピング（メモリ上のMap）
- 親子関係の追跡（`parentId`フィールドで修正前の画像を参照）

### User Stories
- US-9.1: 生成された画像のプロンプトを確認する ✅
- US-9.2: プロンプトをコピーして再利用する ✅
- US-9.3: 履歴を遡ってプロンプトを確認する ✅
- US-9.4: チャット修正時のプロンプトを確認する ✅

### Known Issues
- LocalStorage容量制限（5-10MB）: Phase 10でIndexedDBへの移行を計画

## [0.9.3] - 2026-01-07

### Performance Improvements
- **処理時間短縮**: 約55秒 → 約42秒（**約24%短縮、13秒削減**）
- **並列処理の実装**: 画像生成と解説生成を同時実行（`Promise.allSettled`による堅牢なエラーハンドリング）
- **APIパラメータ最適化**: `temperature: 0.5`を設定し、決定論的な生成で処理時間を約5%短縮
- **UX改善**: 進捗表示の追加により、体感速度が大幅に向上
  - 画像生成完了時にチェックマーク表示
  - 解説生成完了時にチェックマーク表示
  - リアルタイムなプログレスバー更新（0-100%）
  - アバターバッジの動的更新（"Generating..." → "Complete!"）

### Changed
- `page.tsx`: `handleTransform`と`handleRemix`を並列化
- `LoadingOverlay.tsx`: 進捗状態の表示改善（完了時のテキスト変更）
- `GeneratorCanvas.tsx`: 進捗状態の受け渡し対応
- `actions.ts`: 全画像生成関数に`temperature: 0.5`を追加

### Technical
- **Phase 1-2**: 解説生成の並列化（24%短縮達成）✅
- **Phase 3-1**: 画像サイズ削減の効果検証（効果なし、真のボトルネックはGemini API処理時間と判明）❌
- **Phase 3-2**: 高解像度化機能（中止、7-9時間の実装時間を節約）🚫
- **APIパラメータ調整**: 決定論的な生成で約5%改善✅

### Insights
- **真のボトルネック特定**: Gemini API処理時間が全体の95%を占める（40-45秒）
- **データ転送量の影響**: 画像サイズを削減してもAPI処理時間には影響しない（全体の5%のみ）
- **今後の方針**: プログレッシブ生成、ローカルキャッシュ、プリジェネレーションが有効

### Known Issues
- LocalStorage QuotaExceededError: 履歴データが多くなるとLocalStorageの容量制限に達する可能性（将来的にIndexedDBまたはサーバーサイドDBへの移行が必要）

## [0.8.0] - 2026-01-06

### Added
- **Phase 8: 画像アップロード + リミックス機能**: ユーザーが自分の画像をアップロードして巨匠風に変換できる機能を実装
- `ImageUploader` コンポーネント: ドラッグ&ドロップまたはファイル選択で画像をアップロード（最大10MB、PNG/JPEG/WebP対応）
- `InstructionInput` コンポーネント: 追加指示を入力できるテキストエリア（例: 「左の人だけ写楽風にして」）
- `ArtistMismatchAlert` コンポーネント: 巨匠が異なる場合に警告を表示し、リミックスを促す
- `uploadAndTransformAction`: アップロード画像を巨匠の画風に変換するServer Action
- `remixArtworkAction`: 既存作品を別の巨匠の画風で描き直すServer Action
- `Artwork` インターフェース: 作品のメタデータを管理（ID、画像URL、巨匠ID、テーマ、指示、作成日時、ソース）

### Changed
- **ChatGPT/Rooと同じUX**: 画像+テキスト指示を同時に送信できるインターフェースに改善
- 左カラムのUI構成を変更: 画像アップロード → テーマ入力 → 巨匠選択 → 追加指示 → 変換ボタン
- 「傑作を生み出す」ボタンを「変換」ボタンに変更し、アップロード画像とテーマ生成の両方に対応
- State管理を拡張: `uploadedImage`, `instruction`, `currentArtwork` を追加
- 巨匠切り替え時に自動的にリミックスを提案する機能を追加

### Technical
- `Alert` UIコンポーネントを追加（shadcn/ui準拠）
- 画像のBase64エンコーディング処理をクライアント側で実装
- ファイルサイズ・形式のバリデーション機能
- リミックス時の構図維持プロンプト設計

### User Stories
- US-8.1: 画像をアップロードして巨匠風に変換する ✅
- US-8.2: 生成した作品を別の巨匠でリミックスする ✅
- US-8.3: アップロード画像をリミックスする ✅
- US-8.4: 過去の作品を再利用する ✅

## [0.7.0] - 2026-01-06

### Fixed
- **ローディング画面の重複表示を修正**: 画像生成時に`LoadingOverlay`と`GeneratorCanvas`の両方でローディングが表示されていた問題を解決
- **対話型修正時のローディング表示を追加**: 巨匠と対話しながら画像を修正する際にローディング画面が表示されるように改善

### Removed
- **モバイル・タブレットレイアウトを削除**: デスクトップ専用の3カラムレイアウトに統一し、コードをシンプル化

### Changed
- `ChatInterface`コンポーネントに`onModifyingChange`プロパティを追加し、修正中の状態を親コンポーネントに通知
- `LoadingOverlay`の表示条件を`isGenerating || isModifying`に変更し、画像生成と修正の両方でローディング表示
- `GeneratorCanvas`の`isLoading`プロパティを`false`に固定し、ローディング表示を`LoadingOverlay`に一本化

## [0.6.0] - 2026-01-06

### Added
- **Theme Interpretation Layer**: LLMによるお題の意味解釈機能を実装
- ユーザー入力から「描画要素」と「ムード」を自動抽出
- 構造化プロンプト生成により、画家のスタイルとお題のバランスを最適化
- `theme-interpreter.ts` モジュールの追加

### Changed
- プロンプト生成を非同期化（`generatePrompt` が `Promise<string>` を返すように変更）
- 2段階のプロンプト生成プロセス：意味解釈 → 構造化合成
- 画家のスタイル記述が強すぎてお題が反映されにくい問題を解決

### Technical
- Gemini 3.0 Pro Preview を使用した意味解釈（temperature: 0.3）
- フォールバック機能：解釈失敗時は従来の方式で継続
- 処理時間：約2秒の追加（意味解釈）+ 約30秒（画像生成）= 約32秒
- 後方互換性のため `generatePromptSync` を残存

## [0.5.1] - 2026-01-06

### Changed
- **Avatar Redesign v2**: 人物アバター + 画風背景の2層構造に再設計
- ユーザーフィードバックを受け、各アーティストを人物として認識しやすく改善
- 人物アバター8枚を新規生成（統一的なイラストスタイル）
- Phase 5で生成した画風パターンを背景として活用（透明度50%）
- `ArtistSelector.tsx`を2層構造に修正

### Added
- `public/avatars/patterns/` ディレクトリ（画風パターンを格納）

### Technical
- 前景: 人物アバター（統一イラストスタイル）
- 背景: 画風パターン（透明度50%、Phase 5の成果物を活用）
- 2層構造により柔軟なデザイン調整が可能

## [0.5.0] - 2026-01-06

### Changed
- **Avatar Redesign**: 全8人のアバター画像を統一的なコンセプトで再生成
- 「画風の象徴的モチーフ」アプローチを採用（実在人物の顔を避け、各画風を象徴するモチーフで表現）
- 統一要素（1:1正方形、512x512px、中央配置）で統一感を確保
- 各画風の個性を最大限に表現（ピカソ：幾何学的な顔、岡本太郎：目のモチーフ、ゴッホ：星空、モネ：睡蓮、ダリ：溶ける時計、北斎：大波、藤子不二雄：四次元ポケット、鳥山明：メカとエネルギー波）
- 既存アバター画像を `public/avatars-backup/` にバックアップ

### Technical
- Image MCP Server (Gemini 3.0 Pro Image) で全アバター生成
- 著作権対応：実在人物・特定キャラクターを避けるプロンプト設計
- 高解像度・高品質化によりファイルサイズが約1.6倍に増加（9.2MB → 15MB）

## [0.4.0] - 2026-01-06

### Added
- 藤子・F・不二雄の画風を追加（SF漫画スタイル）
- 鳥山明の画風を追加（冒険漫画スタイル）
- 日本の漫画家2名を追加し、合計8人の巨匠に拡大
- 漫画スタイル特化のプロンプト最適化

### Changed
- アーティスト選択UIが8人対応に拡張

## [0.3.0] - 2025-12-27

### Added
- **Artist Avatar Chat**: 生成された作品について、巨匠のペルソナを持つAIとチャットで対話
- **Interactive Adjustments**: 自然言語で作品の修正を依頼（例：「もっと明るくして」）
- **Immersive Loading**: 巨匠ごとのユニークな待機アニメーションとメッセージ
- `ChatInterface` コンポーネントの実装
- `modifyArtworkAction` による画像修正機能

### Changed
- 各巨匠に `chatSystemPrompt` を追加し、より深いペルソナ表現を実現
- ローディング体験の向上（巨匠ごとのメッセージ）

## [0.2.0] - 2025-12-26

### Added
- **The Master's Voice**: 巨匠による作品解説機能（Gemini API + Web Speech API）
- **Art Battle Mode**: 2人の巨匠による同時生成・対決機能 (`/battle`)
- Rakuten AI Gateway (Gemini 3.0 Pro Preview) 統合
- `useTextToSpeech` フックの実装
- `ArtworkDescription` コンポーネントの実装

### Changed
- 音声読み上げエンジンを Rakuten AI Gateway (OpenAI GPT-4o mini TTS) に変更し、より自然な発話を実現
- 解説生成のトークン制限を緩和し、安定性を向上

## [0.1.0] - 2025-12-25

### Added
- プロジェクト初期化
- 基本的な画像生成機能 (Image MCP統合)
- 巨匠選択UI
- テーマ入力フォーム
- 結果表示キャンバス
- ユーザーストーリーの策定
- アーキテクチャ設計
