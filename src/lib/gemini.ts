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

  console.log(`[DEBUG] Calling Gemini API: Model=${modelName}`);

  try {
    // requestBody が { contents: [...], generationConfig: {...} } の形をしていると仮定
    const result = await model.generateContent(requestBody);
    console.log(`[DEBUG] Gemini result received for ${modelName}`);
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
     console.error(`[ERROR] Gemini API Error (${modelName}):`, error);
     const geminiError = new Error(`Gemini API Error: ${error.message}`) as GeminiError;
     // SDKのエラーオブジェクトがstatusを持っているか不明だが、あればセット
     if (error.status) {
         geminiError.status = error.status;
     }
     throw geminiError;
  }
}

/**
 * Gemini APIを使用してテキストを音声に変換する
 * @param text 読み上げるテキスト
 * @param voiceName 使用するボイス名 (default: 'charon' - Elderly male persona)
 * @returns Base64エンコードされた音声データ
 */
export async function generateSpeech(text: string, voiceName: string = 'charon'): Promise<string> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  // SDK経由ではなく、直接REST APIを叩く（プレビュー機能の確実な動作のため）
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`;
  
  // 注意: gemini-2.5-flash-preview-tts は現在 systemInstruction をサポートしていないため削除
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text }]
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName
          }
        }
      }
    }
  };

  console.log(`[DEBUG] Generating speech with Gemini (REST): Model=gemini-2.5-flash-preview-tts, Voice=${voiceName}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[ERROR] Gemini REST API Error Response:", JSON.stringify(errorData, null, 2));
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // レスポンス構造から音声データを抽出
    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    if (!part || !part.inlineData || !part.inlineData.data) {
        console.error("Unexpected TTS response structure (REST):", JSON.stringify(sanitizeForLog(data), null, 2));
        throw new Error("No audio data returned from Gemini API");
    }

    // Geminiは raw PCM (24kHz, 16bit, mono) を返すため、WAVヘッダーを付与してブラウザで再生可能にする
    // Node.jsのBufferを使用して効率的に変換
    const pcmData = new Uint8Array(Buffer.from(part.inlineData.data, 'base64'));
    const wavData = addWavHeader(pcmData, 24000);
    
    return Buffer.from(wavData).toString('base64');

  } catch (error: any) {
    console.error("Gemini TTS Error (REST):", error);
    throw error;
  }
}

/**
 * PCMデータにWAVヘッダーを付与する (24kHz, 16-bit, Mono)
 * ブラウザ/サーバー両対応のため Buffer を使わずに Uint8Array で実装
 */
function addWavHeader(pcmData: Uint8Array, sampleRate: number): Uint8Array {
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);
    const dataLength = pcmData.length;
    
    // RIFF identifier "RIFF"
    header[0] = 82; header[1] = 73; header[2] = 70; header[3] = 70;
    // RIFF chunk length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type "WAVE"
    header[8] = 87; header[9] = 65; header[10] = 86; header[11] = 69;
    // format chunk identifier "fmt "
    header[12] = 102; header[13] = 109; header[14] = 116; header[15] = 32;
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 is PCM)
    view.setUint16(20, 1, true);
    // channel count (1 is mono)
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sampleRate * channels * bitsPerSample / 8)
    view.setUint32(28, sampleRate * 1 * 16 / 8, true);
    // block align (channels * bitsPerSample / 8)
    view.setUint16(32, 1 * 16 / 8, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier "data"
    header[36] = 100; header[37] = 97; header[38] = 116; header[39] = 97;
    // data chunk length
    view.setUint32(40, dataLength, true);
    
    const result = new Uint8Array(header.length + pcmData.length);
    result.set(header, 0);
    result.set(pcmData, header.length);
    return result;
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
