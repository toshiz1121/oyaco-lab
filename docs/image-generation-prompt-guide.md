# インフォグラフィック画像生成プロンプトガイド

## 📍 プロンプト定義の場所

### メインファイル
**`src/lib/agents/core.ts`**

このファイルに画像生成に関する全てのロジックが含まれています。

## 🎨 画像生成の流れ

```
ユーザーの質問
    ↓
エージェントが回答生成（ステップ分割）
    ↓
generateCombinedImagePrompt() ← ここでプロンプト生成
    ↓
generateIllustration() ← Vertex AIで画像生成
    ↓
Base64画像データを返す
```

## 📝 プロンプト生成関数

### 1. `generateCombinedImagePrompt()` ⭐ メイン関数

**場所**: `src/lib/agents/core.ts` 217行目〜

**役割**: ステップ数に応じて最適なレイアウトのプロンプトを生成

```typescript
export function generateCombinedImagePrompt(steps: ExplanationStep[]): string {
  if (!steps || steps.length === 0) return "Children's book illustration";

  const count = steps.length;
  const baseStyle = 'The style should be "children\'s book illustration, colorful, warm, simple, clean lines". If any text is included in the image, it MUST be in Japanese.';

  if (count === 1) {
    // 1パネル: シンプルな1枚絵
    return `
      Create an illustration for a children's book.
      ${baseStyle}
      Description: ${steps[0].visualDescription}
    `.trim();
  } 
  else if (count === 2) {
    // 2パネル: 左右分割
    return `
      Create a split-screen image divided vertically into 2 equal panels (Left and Right).
      ${baseStyle}
      Panel 1 (Left): ${steps[0].visualDescription}
      Panel 2 (Right): ${steps[1].visualDescription}
    `.trim();
  } 
  else {
    // 4パネル: 2x2グリッド（3ステップ以上）
    return `
      Create a comic strip style image divided into 4 equal panels (2x2 grid).
      ${baseStyle}
      Panel 1 (Top-Left): ${steps[0]?.visualDescription || ''}
      Panel 2 (Top-Right): ${steps[1]?.visualDescription || ''}
      Panel 3 (Bottom-Left): ${steps[2]?.visualDescription || ''}
      Panel 4 (Bottom-Right): ${steps[3]?.visualDescription || ''}
    `.trim();
  }
}
```

### 2. `generateIllustrationPrompt()` 🔄 レガシー関数

**場所**: `src/lib/agents/core.ts` 261行目〜

**役割**: 後方互換性のために保持（非推奨）

```typescript
export async function generateIllustrationPrompt(
  agentId: AgentRole, 
  question: string, 
  answer: string
): Promise<string> {
  // LLMを使ってプロンプトを動的に生成
  // 新しいコードでは使用しないでください
}
```

## 🖼️ 画像生成関数

### `generateIllustration()`

**場所**: `src/lib/agents/core.ts` 295行目〜

**役割**: Vertex AIを使って実際に画像を生成

```typescript
export async function generateIllustration(prompt: string): Promise<string | undefined> {
  try {
    const data = await callVertexAI(AGENT_MODELS.imageGenerator, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:3" }  // 子供向けコンテンツに最適
      }
    });

    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (imagePart) {
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }
  } catch (error) {
    console.error("Illustration generation failed:", error);
  }
  return undefined;
}
```

## 🎯 プロンプトのカスタマイズ方法

### 基本スタイルの変更

**現在の設定**:
```typescript
const baseStyle = 'The style should be "children\'s book illustration, colorful, warm, simple, clean lines". If any text is included in the image, it MUST be in Japanese.';
```

**カスタマイズ例**:
```typescript
// より詳細なスタイル指定
const baseStyle = `
  Style: children's book illustration
  Colors: bright, vibrant, educational
  Art style: flat design, minimalist
  Mood: friendly, encouraging, fun
  Text: All text MUST be in Japanese (日本語)
  Avoid: scary elements, complex details
`;

// インフォグラフィック風
const baseStyle = `
  Style: educational infographic for children
  Layout: clean, organized, easy to understand
  Colors: pastel colors, high contrast for readability
  Icons: simple, recognizable
  Text: Large, clear Japanese text (日本語)
`;

// 漫画風
const baseStyle = `
  Style: Japanese manga for children (kodomo manga)
  Art style: cute, expressive characters
  Colors: bright and cheerful
  Layout: clear panel divisions with borders
  Text: Speech bubbles in Japanese (日本語)
`;
```

### レイアウトの変更

**1パネル（現在）**:
```typescript
if (count === 1) {
  return `
    Create an illustration for a children's book.
    ${baseStyle}
    Description: ${steps[0].visualDescription}
  `.trim();
}
```

**1パネル（カスタマイズ例）**:
```typescript
if (count === 1) {
  return `
    Create a single large educational illustration.
    ${baseStyle}
    Main focus: ${steps[0].visualDescription}
    Include: numbered labels, arrows showing process
    Background: simple, not distracting
  `.trim();
}
```

**4パネル（カスタマイズ例）**:
```typescript
else {
  return `
    Create an educational comic strip with 4 panels in a 2x2 grid.
    ${baseStyle}
    
    Each panel should have:
    - Clear panel borders
    - Panel number in top-left corner (①②③④)
    - Simple background
    
    Panel 1 (Top-Left): ${steps[0]?.visualDescription || ''}
    Panel 2 (Top-Right): ${steps[1]?.visualDescription || ''}
    Panel 3 (Bottom-Left): ${steps[2]?.visualDescription || ''}
    Panel 4 (Bottom-Right): ${steps[3]?.visualDescription || ''}
    
    Overall composition: Tell a clear story from panel 1 to 4
  `.trim();
}
```

## 🔧 実装例：プロンプトの改善

### Before（現在）
```typescript
const baseStyle = 'The style should be "children\'s book illustration, colorful, warm, simple, clean lines".';
```

### After（改善案）
```typescript
const baseStyle = `
  Create an educational infographic for elementary school children.
  
  Visual Style:
  - Illustration style: Flat design, modern, clean
  - Colors: Bright pastels with high contrast
  - Line art: Bold outlines, simple shapes
  - Characters: Cute, friendly, diverse
  
  Layout Requirements:
  - Clear visual hierarchy
  - Easy to follow flow (left to right, top to bottom)
  - Numbered steps or arrows showing sequence
  - Adequate white space between elements
  
  Text Requirements:
  - All text MUST be in Japanese (日本語)
  - Large, readable font
  - Short labels (1-3 words)
  - Use hiragana for young children
  
  Educational Focus:
  - Emphasize key concepts visually
  - Use icons and symbols
  - Show cause and effect clearly
  - Make it engaging and fun
`;
```

## 📊 使用されている場所

### `src/app/actions.ts`

```typescript
export async function consultAction(
  question: string,
  history: { role: string; content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ActionResult<AgentResponse>> {
  // ... エージェント選択と回答生成 ...

  // 画像プロンプト生成
  let imagePrompt: string;
  if (responseData.steps && responseData.steps.length > 0) {
    imagePrompt = generateCombinedImagePrompt(responseData.steps); // ← ここ！
  } else {
    imagePrompt = await generateIllustrationPrompt(agentId, question, responseData.text);
  }

  // 画像生成
  const imageUrl = await generateIllustration(imagePrompt); // ← ここ！

  return {
    success: true,
    data: {
      ...responseData,
      imageUrl
    }
  };
}
```

## 🎨 プロンプトテンプレート集

### テンプレート1: シンプルな説明図
```typescript
`Create a simple educational diagram.
Style: Clean, minimalist, flat design
Colors: Blue (#3B82F6), Purple (#A855F7), Yellow (#FBBF24)
Layout: Central concept with supporting elements around it
Text: Japanese labels in hiragana
Description: ${visualDescription}`
```

### テンプレート2: ステップバイステップ
```typescript
`Create a step-by-step process illustration.
Style: Numbered sequence with arrows
Colors: Gradient from blue to purple
Layout: Horizontal flow, left to right
Icons: Simple, recognizable symbols
Text: Japanese step numbers (①②③④)
Description: ${visualDescription}`
```

### テンプレート3: 比較図
```typescript
`Create a comparison illustration.
Style: Split screen with clear division
Colors: Contrasting colors for each side
Layout: Left vs Right or Before vs After
Labels: Japanese text with clear indicators
Description: ${visualDescription}`
```

## 🚀 改善のヒント

### 1. より具体的な指示
```typescript
// ❌ 曖昧
"Draw a cat"

// ✅ 具体的
"Draw a friendly orange tabby cat sitting, facing forward, with big eyes, simple cartoon style, on white background"
```

### 2. 制約を明確に
```typescript
// ✅ 良い例
"No text in the image" // テキストなし
"Text must be in Japanese only" // 日本語のみ
"Avoid scary or dark elements" // 怖い要素を避ける
"Use only 3-4 main colors" // 3-4色に限定
```

### 3. レイアウトの指定
```typescript
// ✅ 良い例
"Divide the image into 4 equal quadrants"
"Place the main subject in the center"
"Use a circular composition"
"Create a vertical timeline from top to bottom"
```

## 📚 参考リンク

- **Vertex AI Image Generation**: [公式ドキュメント](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
- **プロンプトエンジニアリング**: [ベストプラクティス](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/prompts/prompt-design-strategies)

## 💡 まとめ

**プロンプト定義の場所**:
- 📁 `src/lib/agents/core.ts`
- 📝 関数: `generateCombinedImagePrompt()`
- 🎨 217行目から実装

**カスタマイズのポイント**:
1. `baseStyle`を変更してスタイルを調整
2. レイアウトロジックを変更してパネル構成を調整
3. `visualDescription`の生成方法を改善（エージェント側）

**次のステップ**:
- プロンプトを改善してより良い画像を生成
- 新しいレイアウトパターンを追加
- スタイルのバリエーションを増やす
