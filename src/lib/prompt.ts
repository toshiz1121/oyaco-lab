import { artists, Artist } from "./artists";
import { interpretTheme, ThemeInterpretation } from "./theme-interpreter";

/**
 * 構造化プロンプトを生成（非同期版）
 */
export async function generatePrompt(
  artistId: string,
  theme: string,
  interpretation?: ThemeInterpretation  // ★オプショナル引数を追加
): Promise<string> {
  const artist = artists.find((a) => a.id === artistId);
  if (!artist) {
    throw new Error(`Artist with id ${artistId} not found`);
  }

  // interpretationが渡されていない場合のみ実行（後方互換性）
  const finalInterpretation = interpretation || await interpretTheme(theme, artist);

  // 構造化プロンプトを生成
  return buildStructuredPrompt(artist, finalInterpretation);
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
