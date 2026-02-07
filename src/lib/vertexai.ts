/**
 * Vertex AI統合モジュール
 * 
 * 実装背景:
 * - Google Cloud Vertex AIを使用してGeminiモデルにアクセス
 * - テキスト生成、画像生成、音声合成（TTS）機能を提供
 * - エラーハンドリング、リトライロジック、ログ機能を統合
 * 
 * アーキテクチャ:
 * - 設定の一元管理により、モデルやリージョンの変更が容易
 * - カスタムエラー型により、エラーの種類に応じた適切な処理が可能
 * - リトライロジックにより、一時的なネットワークエラーに対する耐性を向上
 */

import { VertexAI } from '@google-cloud/vertexai';

/**
 * Vertex AI設定
 * 
 * 実装背景:
 * - 環境変数から設定を読み込み、デフォルト値を提供
 * - 設定を一箇所に集約することで、保守性と拡張性を向上
 * - as constにより、型安全性を確保
 */
export const VERTEX_AI_CONFIG = {
    project: process.env.VERTEX_AI_PROJECT || 'bright-arc-485311-v1',
    location: process.env.VERTEX_AI_LOCATION || 'asia-northeast1', // 東京リージョン
    models: {
        text: 'gemini-2.5-flash',           // テキスト生成・オーケストレーション用
        image: 'gemini-2.5-flash-image',    // 画像生成用
        tts: 'gemini-2.5-flash-tts'         // 音声合成用
    },
    retry: {
        maxAttempts: 3,      // 最大リトライ回数
        initialDelay: 1000,  // 初回リトライまでの待機時間（ミリ秒）
        maxDelay: 10000      // 最大待機時間（ミリ秒）
    }
} as const;

/**
 * Vertex AIクライアントインスタンス
 * 
 * 実装背景:
 * - シングルトンパターンでクライアントを管理
 * - 認証はGOOGLE_APPLICATION_CREDENTIALS環境変数またはデフォルト認証を使用
 */
const vertexAI = new VertexAI({
    project: VERTEX_AI_CONFIG.project,
    location: VERTEX_AI_CONFIG.location
});

/**
 * Vertex AIエラークラス
 * 
 * 実装背景:
 * - エラーの種類を明確にし、適切なエラーハンドリングを可能にする
 * - エラーコード、ステータス、詳細情報を保持
 * - 上位レイヤーでのエラー処理を容易にする
 */
export class VertexAIError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly status?: number,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'VertexAIError';
        // スタックトレースを正しく設定
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, VertexAIError);
        }
    }
}

/**
 * レガシー互換性のためのエラーインターフェース
 * 
 * 実装背景:
 * - 既存のコードとの互換性を維持
 * - 段階的な移行を可能にする
 * 
 * @deprecated VertexAIErrorを使用してください
 */
export interface GeminiError extends Error {
    status?: number;
    statusText?: string;
}

/**
 * リトライ設定インターフェース
 */
interface RetryConfig {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
}

/**
 * 指数バックオフを使用したリトライロジック
 * 
 * 実装背景:
 * - 一時的なネットワークエラーやレート制限に対する耐性を向上
 * - 指数バックオフにより、サーバーへの負荷を軽減
 * - ジッター（ランダムな遅延）を追加して、リトライの衝突を回避
 * 
 * @param fn 実行する非同期関数
 * @param config リトライ設定
 * @returns 関数の実行結果
 * @throws 最大リトライ回数を超えた場合、最後のエラーをスロー
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig = {}
): Promise<T> {
    const maxAttempts = config.maxAttempts || VERTEX_AI_CONFIG.retry.maxAttempts;
    const initialDelay = config.initialDelay || VERTEX_AI_CONFIG.retry.initialDelay;
    const maxDelay = config.maxDelay || VERTEX_AI_CONFIG.retry.maxDelay;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // 最後の試行の場合はリトライしない
            if (attempt === maxAttempts) {
                break;
            }

            // 指数バックオフ + ジッター
            const exponentialDelay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
            const jitter = Math.random() * 0.3 * exponentialDelay; // 最大30%のジッター
            const delay = exponentialDelay + jitter;

            console.warn(
                `[Vertex AI] Retry attempt ${attempt}/${maxAttempts} after ${Math.round(delay)}ms`,
                { error: lastError.message }
            );

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * ログ出力用にデータをサニタイズする
 * 
 * 実装背景:
 * - 長い文字列（Base64画像データなど）を省略してログサイズを削減
 * - デバッグ時に重要な情報は保持しつつ、可読性を向上
 * - 再帰的に処理することで、ネストされたオブジェクトにも対応
 * 
 * @param data サニタイズするデータ
 * @param maxLength 文字列の最大長（デフォルト: 500）
 * @returns サニタイズされたデータ
 */
function sanitizeForLog(data: any, maxLength = 500): any {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
        if (data.length > maxLength) {
            return `${data.slice(0, 100)}...[Truncated, total length: ${data.length}]...${data.slice(-20)}`;
        }
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitizeForLog(item, maxLength));
    }

    if (typeof data === 'object') {
        const result: any = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                result[key] = sanitizeForLog(data[key], maxLength);
            }
        }
        return result;
    }

    return data;
}

/**
 * Vertex AI経由でGeminiモデルを呼び出す共通関数
 * 
 * 実装背景:
 * - すべてのVertex AI呼び出しを一元化
 * - エラーハンドリング、ログ、リトライロジックを統合
 * - レスポンスの構造を標準化
 * 
 * @param modelName 使用するモデル名（例: 'gemini-2.5-flash'）
 * @param requestBody APIに送信するリクエストボディ
 * @param retryConfig リトライ設定（オプション）
 * @returns APIレスポンスのJSONデータ
 * @throws VertexAIError API呼び出しが失敗した場合
 */
export async function callVertexAI(
    modelName: string,
    requestBody: any,
    retryConfig?: RetryConfig
): Promise<any> {
    return withRetry(async () => {
        try {
            console.log(`[Vertex AI] Calling model: ${modelName}`);

            const model = vertexAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(requestBody);
            const response = result.response;

            // レスポンスデータの構造化
            const data = {
                candidates: response.candidates,
                promptFeedback: response.promptFeedback,
                usageMetadata: response.usageMetadata
            };

            console.log(
                `[Vertex AI] Response from ${modelName}:`,
                JSON.stringify(sanitizeForLog(data), null, 2)
            );

            return data;
        } catch (error: any) {
            console.error(`[Vertex AI] Error calling ${modelName}:`, error);

            // エラーを構造化してスロー
            throw new VertexAIError(
                `Vertex AI API call failed: ${error.message}`,
                error.code,
                error.status,
                error
            );
        }
    }, retryConfig);
}

/**
 * レガシー互換性のための関数
 * 
 * 実装背景:
 * - 既存のコードとの互換性を維持
 * - 段階的な移行を可能にする
 * 
 * @deprecated callVertexAIを使用してください
 */
export const callGeminiApi = callVertexAI;

/**
 * テキストを音声に変換する（TTS: Text-to-Speech）
 * 
 * 実装背景:
 * - Vertex AI TTS APIを使用して高品質な音声を生成
 * - REST APIを直接呼び出すことで、より細かい制御が可能
 * - PCMデータをWAV形式に変換してブラウザで再生可能にする
 * 
 * アーキテクチャ:
 * 1. Google Cloud認証トークンを取得
 * 2. Vertex AI TTS APIにリクエストを送信
 * 3. Base64エンコードされたPCMデータを受信
 * 4. WAVヘッダーを付与してブラウザ再生可能な形式に変換
 * 5. Base64エンコードされたWAVデータを返す
 * 
 * @param text 読み上げるテキスト
 * @param voiceName 使用する音声名（デフォルト: 'charon' - 落ち着いた男性の声）
 * @returns Base64エンコードされたWAV音声データ
 * @throws VertexAIError 音声生成が失敗した場合
 */
export async function generateSpeech(
    text: string,
    voiceName: string = 'charon'
): Promise<string> {
    return withRetry(async () => {
        try {
            console.log(`[Vertex AI TTS] Generating speech with voice: ${voiceName}`);

            // Google Cloud認証トークンを取得
            // 実装背景: REST APIを使用するため、アクセストークンが必要
            const { GoogleAuth } = require('google-auth-library');
            const auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });
            const authClient = await auth.getClient();
            const accessToken = await authClient.getAccessToken();

            if (!accessToken.token) {
                throw new VertexAIError('Failed to obtain access token', 'AUTH_ERROR');
            }

            // Vertex AI TTS APIエンドポイント
            // 実装背景: Gemini 2.5 Flash TTSモデルはasia-northeast1リージョンで利用可能
            const url = `https://${VERTEX_AI_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_CONFIG.project}/locations/${VERTEX_AI_CONFIG.location}/publishers/google/models/${VERTEX_AI_CONFIG.models.tts}:generateContent`;

            // リクエストボディの構築
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

            console.log(`[Vertex AI TTS] Request URL: ${url}`);
            console.log(`[Vertex AI TTS] Request Body:`, JSON.stringify(requestBody, null, 2));

            // API呼び出し
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("[Vertex AI TTS] Error Response:", JSON.stringify(errorData, null, 2));
                console.error(`[Vertex AI TTS] Status: ${response.status} ${response.statusText}`);

                throw new VertexAIError(
                    `TTS API call failed: ${response.statusText}`,
                    'TTS_API_ERROR',
                    response.status,
                    errorData
                );
            }

            // レスポンスの解析
            const data = await response.json();
            const candidate = data.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            if (!part || !part.inlineData || !part.inlineData.data) {
                throw new VertexAIError(
                    'No audio data returned from Vertex AI TTS',
                    'NO_AUDIO_DATA'
                );
            }

            // PCMデータをWAV形式に変換
            // 実装背景: ブラウザで再生可能な形式にするため、WAVヘッダーを付与
            const pcmData = new Uint8Array(Buffer.from(part.inlineData.data, 'base64'));
            const wavData = addWavHeader(pcmData, 24000); // 24kHz サンプリングレート

            console.log(`[Vertex AI TTS] Successfully generated speech: ${wavData.length} bytes`);

            return Buffer.from(wavData).toString('base64');

        } catch (error: any) {
            console.error("[Vertex AI TTS] Error:", error);

            if (error instanceof VertexAIError) {
                throw error;
            }

            throw new VertexAIError(
                `Speech generation failed: ${error.message}`,
                'TTS_ERROR',
                undefined,
                error
            );
        }
    });
}

/**
 * PCMデータにWAVヘッダーを付与する
 * 
 * 実装背景:
 * - Vertex AI TTSはPCMデータを返すが、ブラウザで再生するにはWAVヘッダーが必要
 * - Buffer を使わずに Uint8Array で実装することで、ブラウザ/サーバー両対応
 * - 標準的なWAVフォーマット（RIFF）に準拠
 * 
 * WAVフォーマット仕様:
 * - サンプリングレート: 24kHz（Vertex AI TTSのデフォルト）
 * - ビット深度: 16-bit
 * - チャンネル数: 1（モノラル）
 * 
 * @param pcmData PCMオーディオデータ
 * @param sampleRate サンプリングレート（Hz）
 * @returns WAVヘッダー付きのオーディオデータ
 */
function addWavHeader(pcmData: Uint8Array, sampleRate: number): Uint8Array {
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);
    const dataLength = pcmData.length;

    // RIFF identifier "RIFF"
    header[0] = 82; header[1] = 73; header[2] = 70; header[3] = 70;

    // RIFF chunk length (ファイルサイズ - 8バイト)
    view.setUint32(4, 36 + dataLength, true);

    // RIFF type "WAVE"
    header[8] = 87; header[9] = 65; header[10] = 86; header[11] = 69;

    // format chunk identifier "fmt "
    header[12] = 102; header[13] = 109; header[14] = 116; header[15] = 32;

    // format chunk length (16 for PCM)
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

    // ヘッダーとPCMデータを結合
    const result = new Uint8Array(header.length + pcmData.length);
    result.set(header, 0);
    result.set(pcmData, header.length);

    return result;
}
