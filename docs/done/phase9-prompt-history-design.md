# Phase 9: プロンプト履歴確認機能 実装計画書

**作成日**: 2026-01-06
**更新日**: 2026-01-06 23:16 JST
**ステータス**: 実装準備完了 ✅

## 1. 概要

### 目的
生成された画像に対して、どのようなプロンプトが使用されたのかを確認できる機能を実装する。これにより、ユーザーは：
- 生成結果とプロンプトの関係を理解できる
- 効果的なプロンプトの書き方を学習できる
- 修正指示の参考にできる
- デバッグや品質改善に活用できる

### 現状分析（2026-01-06更新）

**✅ 既に実装されている機能**:

1. **画像生成機能** ([`actions.ts`](../src/app/actions.ts:1))
   - `generateArtworkAction`: テーマから画像生成
   - `uploadAndTransformAction`: アップロード画像の変換
   - `remixArtworkAction`: 既存作品のリミックス
   - プロンプトはコンソールログに出力されているが、返却されていない

2. **履歴管理** ([`GeneratorCanvas.tsx`](../src/components/GeneratorCanvas.tsx:1))
   - 画像URLの履歴管理（`history` state）
   - 前/次ボタンでの履歴ナビゲーション（20-79行目）
   - 比較モード実装済み（修正前/後の比較、108-135行目）

3. **作品メタデータ** ([`page.tsx`](../src/app/page.tsx:1))
   - `Artwork` インターフェース（ID、画像URL、巨匠ID、テーマ、指示、作成日時、ソース）
   - `currentArtwork` stateで現在の作品を管理（36行目）

4. **プロンプト生成ロジック**
   - [`prompt.ts`](../src/lib/prompt.ts:1): `generatePrompt()`で構造化プロンプトを生成
   - [`theme-interpreter.ts`](../src/lib/theme-interpreter.ts:1): テーマ解釈レイヤーでLLMによる意味解釈

**❌ 未実装の機能**:

1. **プロンプト情報の保存と返却**
   - テーマ解釈結果（LLMによる意味解釈）が返却されていない
   - 最終的な構造化プロンプトが返却されていない
   - ネガティブプロンプトが返却されていない
   - これらの情報が画像と紐付いていない

2. **プロンプト表示UI**
   - プロンプト詳細ダイアログが存在しない
   - プロンプトのコピー機能がない
   - セクション別の整理表示がない

3. **LocalStorage統合**
   - 履歴の永続化がない
   - 最大50件の管理機能がない

**問題点**:
- プロンプト情報が画像と紐付いていない
- ユーザーがプロンプトを確認する手段がない
- 修正履歴とプロンプトの対応関係が不明
- 既存の履歴機能（`GeneratorCanvas`）とメタデータ履歴の統合が必要

## 2. 要件定義

### 機能要件

#### FR-1: プロンプト情報の保存
- 画像生成時に使用したプロンプト情報を保存
- 以下の情報を含む：
  - 元のテーマ（ユーザー入力）
  - テーマ解釈結果（LLMによる意味解釈）
  - 最終的な構造化プロンプト
  - ネガティブプロンプト
  - 生成日時
  - アーティスト情報

#### FR-2: プロンプト履歴の表示
- 生成された画像に対応するプロンプトを表示
- 履歴を遡ってプロンプトを確認可能
- 見やすいフォーマットで表示

#### FR-3: プロンプト詳細の表示
- 折りたたみ可能な詳細ビュー
- セクション別に整理された表示：
  - ユーザー入力
  - テーマ解釈
  - 構造化プロンプト
  - ネガティブプロンプト

#### FR-4: プロンプトのコピー機能
- ワンクリックでプロンプトをコピー
- 再利用や外部ツールでの検証に活用

### 非機能要件

#### NFR-1: パフォーマンス
- プロンプト情報の保存は画像生成のパフォーマンスに影響しない
- ブラウザのローカルストレージを活用（サーバー負荷なし）

#### NFR-2: ユーザビリティ
- 直感的なUI（アイコンやツールチップで説明）
- モバイルでも使いやすい表示

#### NFR-3: 拡張性
- 将来的な機能追加に対応できる設計
  - プロンプトの編集・再生成
  - プロンプトのエクスポート
  - プロンプトの共有

## 3. データ構造設計

### GenerationMetadata型

```typescript
interface GenerationMetadata {
  // 識別情報
  id: string;                    // ユニークID（UUID）
  timestamp: number;             // 生成日時（Unix timestamp）
  
  // 画像情報
  imageUrl: string;              // 生成された画像のURL
  
  // アーティスト情報
  artistId: string;              // アーティストID
  artistName: string;            // アーティスト名（表示用）
  
  // プロンプト情報
  userTheme: string;             // ユーザーが入力したテーマ
  interpretation: ThemeInterpretation; // テーマ解釈結果
  structuredPrompt: string;      // 最終的な構造化プロンプト
  negativePrompt: string;        // ネガティブプロンプト
  
  // 修正情報（オプション）
  isModification?: boolean;      // 修正かどうか
  modificationInstruction?: string; // 修正指示
  parentId?: string;             // 元の画像のID
}

interface ThemeInterpretation {
  elements: string;              // 要素の解釈
  mood: string;                  // ムードの解釈
  rawResponse?: string;          // LLMの生の応答（デバッグ用）
}
```

### ストレージ設計

**LocalStorage使用**:
- キー: `masterpiece_history`
- 値: `GenerationMetadata[]`（JSON配列）
- 最大保存件数: 50件（古いものから削除）

**メリット**:
- サーバー不要（完全クライアントサイド）
- 高速なアクセス
- 実装がシンプル

**デメリット**:
- ブラウザ間で共有できない
- ストレージ容量制限（5-10MB）
- Base64画像URLは保存しない（参照のみ）

## 4. UI/UX設計

### 4.1 プロンプト表示ボタン

**配置**: [`GeneratorCanvas.tsx`](../src/components/GeneratorCanvas.tsx:1)のダウンロードボタンの隣

```
[比較] [プロンプト詳細] [ダウンロード]
```

**アイコン**: `FileText`または`Info`（lucide-react）

### 4.2 プロンプト詳細ダイアログ

**shadcn/ui Dialog使用**:

```
┌─────────────────────────────────────────┐
│ プロンプト詳細                    [×]   │
├─────────────────────────────────────────┤
│                                         │
│ 📝 ユーザー入力                         │
│ ┌─────────────────────────────────────┐ │
│ │ 夕暮れの海辺                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 🎨 アーティスト                         │
│ ┌─────────────────────────────────────┐ │
│ │ Claude Monet (印象派)               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 🔍 テーマ解釈                           │
│ ┌─────────────────────────────────────┐ │
│ │ Elements: Sunset, ocean, beach...   │ │
│ │ Mood: Peaceful, nostalgic...        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⚙️ 構造化プロンプト                     │
│ ┌─────────────────────────────────────┐ │
│ │ Subject: Sunset over the ocean...   │ │
│ │ Mood: Peaceful and nostalgic...     │ │
│ │ Style: Impressionist painting...    │ │
│ │ [コピー]                            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 🚫 ネガティブプロンプト                 │
│ ┌─────────────────────────────────────┐ │
│ │ photorealistic, 3D render...        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📅 生成日時: 2026-01-06 13:30:45       │
│                                         │
└─────────────────────────────────────────┘
```

**特徴**:
- セクションごとに折りたたみ可能（Accordion使用）
- コピーボタンで各セクションをコピー
- モバイル対応（スクロール可能）

### 4.3 履歴ナビゲーションとの統合

現在の履歴ナビゲーション（前/次ボタン）と連動：
- 履歴を切り替えると、対応するプロンプトも切り替わる
- 修正の場合は「修正指示」も表示

## 5. 実装計画

### Phase 9.1: データ構造とストレージ（基盤）

**新規ファイル**:
- `src/lib/generation-history.ts`: 履歴管理ロジック

**実装内容**:
```typescript
// src/lib/generation-history.ts

export interface GenerationMetadata {
  id: string;
  timestamp: number;
  imageUrl: string;
  artistId: string;
  artistName: string;
  userTheme: string;
  interpretation: {
    elements: string;
    mood: string;
    rawResponse?: string;
  };
  structuredPrompt: string;
  negativePrompt: string;
  isModification?: boolean;
  modificationInstruction?: string;
  parentId?: string;
}

const STORAGE_KEY = 'masterpiece_history';
const MAX_HISTORY_SIZE = 50;

export function saveGenerationMetadata(metadata: GenerationMetadata): void {
  // LocalStorageに保存
}

export function getGenerationMetadata(id: string): GenerationMetadata | null {
  // IDで検索
}

export function getGenerationHistory(): GenerationMetadata[] {
  // 全履歴を取得（新しい順）
}

export function clearHistory(): void {
  // 履歴をクリア
}
```

### Phase 9.2: Server Actions統合

**変更ファイル**:
- `src/app/actions.ts`: メタデータを返すように変更

**変更内容**:
```typescript
export interface GenerateResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  metadata?: {  // 追加
    id: string;
    structuredPrompt: string;
    interpretation: ThemeInterpretation;
    negativePrompt: string;
  };
}

export async function generateArtworkAction(
  artistId: string,
  theme: string
): Promise<GenerateResult> {
  // ... 既存のコード ...
  
  const interpretation = await interpretTheme(theme, artist);
  const prompt = buildStructuredPrompt(artist, interpretation);
  
  // ... 画像生成 ...
  
  return {
    success: true,
    imageUrl: imageUrl,
    metadata: {  // 追加
      id: crypto.randomUUID(),
      structuredPrompt: prompt,
      interpretation: interpretation,
      negativePrompt: getNegativePrompt(artistId),
    },
  };
}
```

### Phase 9.3: UI実装

**変更ファイル**:
- `src/components/GeneratorCanvas.tsx`: プロンプト詳細ボタン追加
- `src/components/PromptDetailsDialog.tsx`: 新規作成

**GeneratorCanvas.tsx変更**:
```typescript
interface GeneratorCanvasProps {
  imageUrl: string | null;
  isLoading: boolean;
  onDownload?: () => void;
  selectedArtist: Artist | null;
  currentMetadata?: GenerationMetadata | null;  // 追加
}

// プロンプト詳細ボタンを追加
<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowPromptDetails(true)}
  title="プロンプト詳細"
>
  <FileText className="mr-2 h-4 w-4" />
  プロンプト
</Button>
```

**PromptDetailsDialog.tsx新規作成**:
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: GenerationMetadata | null;
}

export function PromptDetailsDialog({ open, onOpenChange, metadata }: PromptDetailsDialogProps) {
  // コピー機能、表示ロジック
}
```

### Phase 9.4: メインページ統合

**変更ファイル**:
- `src/app/page.tsx`: メタデータの管理と保存

**変更内容**:
```typescript
const [currentMetadata, setCurrentMetadata] = useState<GenerationMetadata | null>(null);

// 画像生成時
const result = await generateArtworkAction(selectedArtist.id, theme);
if (result.success && result.metadata) {
  const fullMetadata: GenerationMetadata = {
    ...result.metadata,
    timestamp: Date.now(),
    imageUrl: result.imageUrl!,
    artistId: selectedArtist.id,
    artistName: selectedArtist.name,
    userTheme: theme,
  };
  
  saveGenerationMetadata(fullMetadata);
  setCurrentMetadata(fullMetadata);
}
```

### Phase 9.5: 履歴統合

**変更内容**:
- 画像履歴とメタデータ履歴を同期
- 履歴ナビゲーション時にメタデータも切り替え

```typescript
// GeneratorCanvas.tsx
const [metadataHistory, setMetadataHistory] = useState<GenerationMetadata[]>([]);

useEffect(() => {
  if (imageUrl && metadata) {
    setMetadataHistory(prev => [...prev, metadata]);
  }
}, [imageUrl, metadata]);

const currentMetadata = metadataHistory[currentHistoryIndex];
```

## 6. 実装順序

1. **Phase 9.1**: データ構造とストレージ（1-2時間）
   - `generation-history.ts`の実装
   - LocalStorage操作のテスト

2. **Phase 9.2**: Server Actions統合（1時間）
   - `actions.ts`の変更
   - メタデータ返却のテスト

3. **Phase 9.3**: UI実装（2-3時間）
   - `PromptDetailsDialog.tsx`の作成
   - `GeneratorCanvas.tsx`の変更
   - スタイリングと調整

4. **Phase 9.4**: メインページ統合（1時間）
   - `page.tsx`の変更
   - メタデータ保存の実装

5. **Phase 9.5**: 履歴統合とテスト（1-2時間）
   - 履歴ナビゲーションとの統合
   - 総合テスト

**合計見積もり**: 6-9時間

## 7. テスト計画

### 単体テスト
- [ ] `saveGenerationMetadata()`が正しく保存できる
- [ ] `getGenerationMetadata()`が正しく取得できる
- [ ] 最大件数を超えた場合、古いものが削除される
- [ ] 無効なデータを処理できる

### 統合テスト
- [ ] 画像生成時にメタデータが保存される
- [ ] プロンプト詳細ダイアログが正しく表示される
- [ ] コピー機能が動作する
- [ ] 履歴ナビゲーションとメタデータが同期する
- [ ] 修正時のメタデータが正しく保存される

### UIテスト
- [ ] モバイルで正しく表示される
- [ ] 長いプロンプトが適切に表示される
- [ ] アコーディオンが正しく動作する
- [ ] ダイアログが正しく開閉する

## 8. 将来の拡張案

### Phase 10候補: プロンプト編集・再生成
- プロンプトを編集して再生成
- プロンプトのバリエーション生成

### Phase 11候補: プロンプトライブラリ
- お気に入りプロンプトの保存
- プロンプトテンプレート
- コミュニティ共有

### Phase 12候補: 分析機能
- 効果的なプロンプトの分析
- アーティスト別のプロンプト傾向
- 統計情報の表示

## 9. 技術的考慮事項

### セキュリティ
- XSS対策: プロンプトテキストのサニタイズ
- LocalStorage容量制限の処理

### パフォーマンス
- 大量の履歴でもスムーズに動作
- 画像URLはBase64を避ける（参照のみ）

### 互換性
- 既存の履歴機能との互換性維持
- 将来的なデータ移行を考慮

## 10. 成功基準

- [ ] ユーザーが生成された画像のプロンプトを確認できる
- [ ] プロンプトをコピーして再利用できる
- [ ] 履歴を遡ってプロンプトを確認できる
- [ ] モバイルでも使いやすい
- [ ] パフォーマンスに影響しない

## 11. 参考資料

- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog)
- [shadcn/ui Accordion](https://ui.shadcn.com/docs/components/accordion)
- [LocalStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [lucide-react Icons](https://lucide.dev/)
