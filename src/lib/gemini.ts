import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiError extends Error {
  status?: number;
  statusText?: string;
}

const API_KEY = process.env.GEMINI_API_KEY;

/**
 * Google AI Studio経由でGemini APIを呼び出す共通関数
 * @param modelName 使用するモデル名 (e.g., 'gemini-3-pro-image-preview', 'gemini-1.5-pro')
 * @param requestBody APIに送信するリクエストボディ
 * @returns APIレスポンスのJSONデータ
 */
export async function callGeminiApi(
  modelName: string,
  requestBody: any
): Promise<any> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  // デバッグ用: キーの形式確認（セキュリティのため一部のみ表示）
  console.log(`API Key check: Length=${API_KEY.length}, Prefix=${API_KEY.substring(0, 4)}***`);

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  console.log(`Calling Gemini API (Google AI Studio): Model=${modelName}`);

  try {
    // requestBody が { contents: [...], generationConfig: {...} } の形をしていると仮定
    const result = await model.generateContent(requestBody);
    const response = result.response;
    
    // SDK のレスポンスオブジェクトを、呼び出し元が期待する生のオブジェクト形式に近い形に変換して返す
    const data = {
        candidates: response.candidates,
        promptFeedback: response.promptFeedback,
        usageMetadata: response.usageMetadata
    };

    console.log(`Gemini API Response (${modelName}):`, JSON.stringify(sanitizeForLog(data), null, 2));
    return data;

  } catch (error: any) {
     console.error("Gemini API Error:", error);
     const geminiError = new Error(`Gemini API Error: ${error.message}`) as GeminiError;
     // SDKのエラーオブジェクトがstatusを持っているか不明だが、あればセット
     if (error.status) {
         geminiError.status = error.status;
     }
     throw geminiError;
  }
}

/**
 * ログ出力用にデータをサニタイズする
 * 長い文字列（Base64画像データなど）を省略する
 */
function sanitizeForLog(data: any): any {
  const MAX_LOG_STRING_LENGTH = 500;

  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    if (data.length > MAX_LOG_STRING_LENGTH) {
      return `${data.slice(0, 100)}...[Truncated, total length: ${data.length}]...${data.slice(-20)}`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item));
  }

  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = sanitizeForLog(data[key]);
      }
    }
    return result;
  }

  return data;
}
