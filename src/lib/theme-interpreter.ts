import { callGeminiApi } from "./gemini";
import { Artist } from "./artists";

const MODEL_NAME_TEXT = "gemini-2.5-flash";

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
        maxOutputTokens: 2000,  // 思考トークンを考慮して増やす
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
