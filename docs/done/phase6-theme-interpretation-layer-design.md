# Phase 6: 意味解釈層（Theme Interpretation Layer）実装設計書

**日付**: 2026-01-06  
**ステータス**: 📋 設計中  
**目標バージョン**: 0.6.0

## 1. 概要

### 1.1 目的

現在のプロンプト生成は単純な文字列置換であり、画家のスタイル記述が強力すぎてユーザーのお題が反映されにくい問題があります。意味解釈層を導入することで、「タッチは画家特有、モチーフはユーザー提供のお題に寄せる」というバランスを実現します。

### 1.2 現状の問題

**現在のプロンプト生成**:
```typescript
// src/lib/prompt.ts
return artist.promptTemplate.replace("{theme}", theme);
```

**問題点**:
- ユーザー入力「ディズニーランドに行きたい」
- 北斎のテンプレート: `A {theme} in the style of Hokusai, ukiyo-e, prussian blue, Mt. Fuji, great wave...`
- 結果: 「富士山と大波」が強すぎて、ディズニーランドが描かれない

### 1.3 解決アプローチ

**2段階のプロンプト生成**:
1. **意味解釈**: LLMでユーザー入力から「描画要素」と「ムード」を抽出
2. **構造化合成**: 画家のスタイル定義と解釈結果を組み合わせて構造化プロンプトを生成

## 2. アーキテクチャ設計

### 2.1 データフロー

```
[ユーザー入力]
    ↓
[意味解釈 (LLM)]
    ↓
[解釈結果: {elements, mood}]
    ↓
[構造化プロンプト生成]
    ↓
[画像生成 (Gemini 3.0 Pro Image)]
    ↓
[生成画像]
```

### 2.2 コンポーネント構成

```
src/lib/
├── theme-interpreter.ts  (新規) - 意味解釈ロジック
├── prompt.ts             (改修) - プロンプト生成を非同期化
├── artists.ts            (既存) - styleCore等のフィールドを活用
└── gemini.ts             (既存) - API呼び出し

src/app/
└── actions.ts            (改修) - generateArtworkActionを非同期対応
```

## 3. 詳細設計

### 3.1 意味解釈モジュール（新規作成）

**ファイル**: `src/lib/theme-interpreter.ts`

```typescript
import { callGeminiApi } from "./gemini";
import { Artist } from "./artists";

const MODEL_NAME_TEXT = "gemini-3-pro-preview";

/**
 * ユーザー入力から描画要素とムードを抽出
 */
export interface ThemeInterpretation {
  elements: string;  // 描画すべき具体的な要素
  mood: string;      // 雰囲気・感情
}

/**
 * お題を解釈して構造化データを返す
 */
export async function interpretTheme(
  theme: string,
  artist: Artist
): Promise<ThemeInterpretation> {
  try {
    const prompt = `
You are an art director helping to create a painting.

User's theme: "${theme}"
Artist style: ${artist.style} (${artist.nameEn})

Task:
1. Extract the main visual elements that should be depicted in the painting
2. Identify the mood/emotion/atmosphere of the scene

Important:
- Focus on WHAT should be depicted (objects, scenes, actions)
- Describe the emotional atmosphere
- Be specific and concrete
- Use English for better image generation quality

Output format (JSON):
{
  "elements": "specific visual elements to depict",
  "mood": "emotional atmosphere and feeling"
}

Example:
Input: "ディズニーランドに行きたい"
Output: {
  "elements": "Disney castle with spires, fireworks bursting in night sky, crowds of people enjoying attractions, magical atmosphere",
  "mood": "joy, wonder, excitement, magical fantasy"
}
`.trim();

    const requestBody = {
      contents: [{ 
        role: "user", 
        parts: [{ text: prompt }] 
      }],
      generationConfig: {
        temperature: 0.3,  // 安定した解釈のため低めに設定
        maxOutputTokens: 512,
        responseModalities: ["TEXT"]
      }
    };

    const data = await callGeminiApi(MODEL_NAME_TEXT, requestBody);
    
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;
    
    if (!textPart) {
      throw new Error("No interpretation result from LLM");
    }

    // JSONを抽出（マークダウンコードブロックを除去）
    const jsonMatch = textPart.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON format in interpretation result");
    }

    const interpretation: ThemeInterpretation = JSON.parse(jsonMatch[0]);
    
    // バリデーション
    if (!interpretation.elements || !interpretation.mood) {
      throw new Error("Incomplete interpretation result");
    }

    console.log("Theme interpretation:", interpretation);
    return interpretation;

  } catch (error) {
    console.error("Failed to interpret theme:", error);
    
    // フォールバック: お題をそのまま使用
    return {
      elements: theme,
      mood: "artistic expression"
    };
  }
}
```

### 3.2 プロンプト生成モジュール（改修）

**ファイル**: `src/lib/prompt.ts`

```typescript
import { artists, Artist } from "./artists";
import { interpretTheme, ThemeInterpretation } from "./theme-interpreter";

/**
 * 構造化プロンプトを生成（非同期版）
 */
export async function generatePrompt(
  artistId: string, 
  theme: string
): Promise<string> {
  const artist = artists.find((a) => a.id === artistId);
  if (!artist) {
    throw new Error(`Artist with id ${artistId} not found`);
  }

  // LLMで意味解釈
  const interpretation = await interpretTheme(theme, artist);

  // 構造化プロンプトを生成
  return buildStructuredPrompt(artist, interpretation);
}

/**
 * 構造化プロンプトを構築
 */
function buildStructuredPrompt(
  artist: Artist,
  interpretation: ThemeInterpretation
): string {
  // styleCore, styleMood, interpretationGuide を活用
  const prompt = `
Subject: ${interpretation.elements}
Mood: ${interpretation.mood}

Style: ${artist.styleCore || artist.style}
Atmosphere: ${artist.styleMood || ""}

Artistic Direction: ${artist.interpretationGuide || `Create in the style of ${artist.nameEn}`}

Create a masterpiece that captures the subject with the specified artistic style.
  `.trim();

  return prompt;
}

/**
 * ネガティブプロンプト取得（既存のまま）
 */
export function getNegativePrompt(artistId: string): string {
  const artist = artists.find((a) => a.id === artistId);
  return artist?.negativePrompt || "";
}

/**
 * 同期版プロンプト生成（後方互換性のため残す）
 * @deprecated Use generatePrompt (async version) instead
 */
export function generatePromptSync(artistId: string, theme: string): string {
  const artist = artists.find((a) => a.id === artistId);
  if (!artist) {
    throw new Error(`Artist with id ${artistId} not found`);
  }
  
  // フォールバック: 従来の方式
  return artist.promptTemplate.replace("{theme}", theme);
}
```

### 3.3 Server Actions（改修）

**ファイル**: `src/app/actions.ts`

```typescript
// 既存のインポートに追加
import { generatePrompt, getNegativePrompt } from "@/lib/prompt";

export async function generateArtworkAction(
  artistId: string,
  theme: string
): Promise<GenerateResult> {
  try {
    // プロンプト生成が非同期に変更
    const prompt = await generatePrompt(artistId, theme);
    const negativePrompt = getNegativePrompt(artistId);

    console.log(`Generating artwork for artist: ${artistId}, theme: ${theme}`);
    console.log(`Structured Prompt:\n${prompt}`);

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not set. Falling back to mock generation.");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const randomId = Math.floor(Math.random() * 1000);
      return {
        success: true,
        imageUrl: `https://picsum.photos/seed/${randomId}/1024/1024`,
      };
    }

    const requestBody = {
      contents: [{ 
        role: "user", 
        parts: [{ 
          text: prompt + (negativePrompt ? `\n\nAvoid: ${negativePrompt}` : "") 
        }] 
      }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1"
        },
        candidateCount: 1
      }
    };

    const data = await callGeminiApi(MODEL_NAME_IMAGE, requestBody);
    
    const candidate = data.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
    
    if (!imagePart) {
      throw new Error("No image data found in response");
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const base64Data = imagePart.inlineData.data;
    const imageUrl = `data:${mimeType};base64,${base64Data}`;

    return {
      success: true,
      imageUrl: imageUrl,
    };

  } catch (error) {
    console.error("Failed to generate artwork:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "画像の生成に失敗しました。もう一度お試しください。",
    };
  }
}

// 他のアクションは変更なし
```

## 4. エラーハンドリング戦略

### 4.1 意味解釈の失敗

```typescript
// theme-interpreter.ts のフォールバック
catch (error) {
  console.error("Failed to interpret theme:", error);
  
  // フォールバック: お題をそのまま使用
  return {
    elements: theme,
    mood: "artistic expression"
  };
}
```

**戦略**: 意味解釈に失敗しても、従来の方式（お題をそのまま使用）にフォールバックすることで、機能が完全に停止することを防ぐ。

### 4.2 JSON解析の失敗

```typescript
// JSONを抽出（マークダウンコードブロックを除去）
const jsonMatch = textPart.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error("Invalid JSON format in interpretation result");
}
```

**戦略**: LLMが余計なテキストを含めて返す場合に備え、正規表現でJSON部分のみを抽出。

### 4.3 バリデーション

```typescript
// バリデーション
if (!interpretation.elements || !interpretation.mood) {
  throw new Error("Incomplete interpretation result");
}
```

**戦略**: 必須フィールドが欠けている場合はエラーとし、フォールバックに移行。

## 5. パフォーマンス最適化

### 5.1 処理時間の見積もり

```
従来: 画像生成のみ（約30秒）
新方式: 意味解釈（約2秒） + 画像生成（約30秒） = 約32秒
```

**影響**: 約2秒の追加待機時間（許容範囲内）

### 5.2 キャッシング戦略（将来の拡張）

```typescript
// 将来的な実装案
const interpretationCache = new Map<string, ThemeInterpretation>();

export async function interpretTheme(
  theme: string,
  artist: Artist
): Promise<ThemeInterpretation> {
  const cacheKey = `${artist.id}:${theme}`;
  
  if (interpretationCache.has(cacheKey)) {
    return interpretationCache.get(cacheKey)!;
  }
  
  const result = await interpretThemeImpl(theme, artist);
  interpretationCache.set(cacheKey, result);
  
  return result;
}
```

**Phase 6では実装しない**: まずは基本機能を確立し、パフォーマンス問題が顕在化してから導入。

## 6. UI/UX への影響

### 6.1 ローディング表示の調整

**現在**:
```tsx
<LoadingOverlay 
  artist={artist}
  message={artist.loadingMessages[randomIndex]}
/>
```

**Phase 6後**:
```tsx
<LoadingOverlay 
  artist={artist}
  message="お題を解釈しています..."  // 最初の2秒
/>
// ↓
<LoadingOverlay 
  artist={artist}
  message={artist.loadingMessages[randomIndex]}  // 残りの30秒
/>
```

**実装**: `page.tsx` で生成ステータスを管理し、段階的にメッセージを切り替える。

### 6.2 デバッグ表示（開発者向け）

```tsx
// 開発環境でのみ表示
{process.env.NODE_ENV === 'development' && interpretation && (
  <div className="text-xs text-gray-500 mt-2">
    <p>解釈結果:</p>
    <p>要素: {interpretation.elements}</p>
    <p>ムード: {interpretation.mood}</p>
  </div>
)}
```

## 7. テスト戦略

### 7.1 単体テスト

```typescript
// tests/theme-interpreter.test.ts
describe('interpretTheme', () => {
  it('should extract elements and mood from Japanese input', async () => {
    const result = await interpretTheme('ディズニーランドに行きたい', hokusaiArtist);
    expect(result.elements).toContain('Disney');
    expect(result.mood).toBeTruthy();
  });

  it('should fallback on error', async () => {
    // APIエラーをシミュレート
    const result = await interpretTheme('test', hokusaiArtist);
    expect(result.elements).toBe('test');
    expect(result.mood).toBe('artistic expression');
  });
});
```

### 7.2 統合テスト

```typescript
// tests/integration/artwork-generation.test.ts
describe('Artwork Generation with Theme Interpretation', () => {
  it('should generate artwork with interpreted theme', async () => {
    const result = await generateArtworkAction('hokusai', 'ディズニーランドに行きたい');
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
  });
});
```

### 7.3 手動テスト項目

| テストケース | 入力 | 期待される結果 |
|------------|------|--------------|
| 日本語入力 | 「ディズニーランドに行きたい」 | ディズニー城と花火が描かれる |
| 英語入力 | "I want to go to Disneyland" | 同上 |
| 抽象的な入力 | 「幸せ」 | 幸せを象徴する要素が描かれる |
| 長文入力 | 「夕暮れの海辺で...（200文字）」 | 主要な要素が抽出される |
| エラー時 | APIエラー発生 | フォールバックで生成継続 |

## 8. 実装順序

### Step 1: 新規ファイル作成
1. `src/lib/theme-interpreter.ts` を作成
2. 基本的な意味解釈ロジックを実装

### Step 2: 既存ファイル改修
1. `src/lib/prompt.ts` を非同期化
2. 構造化プロンプト生成ロジックを実装

### Step 3: Server Actions更新
1. `src/app/actions.ts` の `generateArtworkAction` を更新
2. エラーハンドリングを追加

### Step 4: 動作確認
1. 開発サーバーで各画家 × 複数のお題でテスト
2. エラーケースの確認

### Step 5: ドキュメント更新
1. `CHANGELOG.md` に v0.6.0 を追加
2. `README.md` の機能説明を更新
3. 完了報告書を作成

## 9. 成功指標

### 9.1 定量的指標

- **お題の反映率**: 生成画像にお題の要素が含まれる割合 > 80%
- **処理時間**: 従来比 +10%以内（約32秒）
- **エラー率**: < 5%

### 9.2 定性的指標

- ユーザーが「お題が反映されている」と感じる
- 画家のスタイルも維持されている
- 待機時間が許容範囲内

## 10. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| LLM解釈の精度不足 | 高 | プロンプトチューニング、フォールバック |
| 処理時間の増加 | 中 | 将来的にキャッシング導入 |
| APIコスト増加 | 低 | 1リクエストあたり約0.001円の増加 |
| 既存機能の破壊 | 中 | 段階的リリース、フォールバック |

## 11. 将来の拡張

### Phase 6.1: キャッシング
- 同じお題 × 画家の組み合わせをキャッシュ
- Redis等の外部キャッシュ導入

### Phase 6.2: ユーザーフィードバック
- 「お題が反映されていない」ボタン
- フィードバックを元に解釈ロジックを改善

### Phase 6.3: 高度な解釈
- 画家の特徴を考慮した解釈（北斎なら「和風の視点」を強調）
- 複数の解釈候補を生成してユーザーに選択させる

## 12. 参考資料

- 元の計画書: [`docs/todo/theme-interpretation-layer-plan.md`](../todo/theme-interpretation-layer-plan.md)
- 既存のartists定義: [`src/lib/artists.ts`](../../src/lib/artists.ts)
- 既存のプロンプト生成: [`src/lib/prompt.ts`](../../src/lib/prompt.ts)
