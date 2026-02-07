"use server";

import { decideAgent, generateExpertResponse, generateIllustrationPrompt, generateIllustration, generateCombinedImagePrompt, createSentenceImagePairs, ExplanationStyle } from "@/lib/agents/core";
import { AgentResponse, AgentRole } from "@/lib/agents/types";
import { generateSpeech } from "@/lib/vertexai";

// 相談結果の型定義
export interface ConsultationResult {
  success: boolean;
  data?: AgentResponse;
  error?: string;
}

// エージェント決定結果の型定義
export interface AgentDecisionResult {
  success: boolean;
  agentId?: AgentRole;
  selectionReason?: string;
  error?: string;
}

/**
 * 質問に対して最適な専門家を決定するアクション（高速）
 * 
 * この関数は博士の選定のみを行い、すぐに結果を返します。
 * UIはこの結果を受け取った瞬間にスポットライト演出を開始できます。
 * 
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @returns 選ばれた博士のIDと選定理由
 */
export async function decideAgentAction(
  question: string,
  history: { role: string, content: string }[] = []
): Promise<AgentDecisionResult> {
  try {
    console.log(`[decideAgentAction] Deciding agent for: "${question}"`);
    
    const { agentId, reason: selectionReason } = await decideAgent(question, history);
    
    console.log(`[decideAgentAction] Selected: ${agentId}, Reason: ${selectionReason}`);
    
    return {
      success: true,
      agentId,
      selectionReason
    };
  } catch (error) {
    console.error("[decideAgentAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Agent decision failed"
    };
  }
}

/**
 * 選ばれた専門家が回答を生成するアクション
 * 
 * decideAgentActionで選ばれた博士が、実際に回答と画像を生成します。
 * この処理は時間がかかるため、UIは画像生成中の画面を表示します。
 * 
 * @param agentId 選ばれた博士のID
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @param style 説明スタイル
 * @returns エージェントの回答データ
 */
export async function generateResponseAction(
  agentId: AgentRole,
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[generateResponseAction] Generating response for ${agentId}`);

    // 環境変数から並列生成機能の有効/無効を判定
    const useParallelGeneration = process.env.USE_PARALLEL_GENERATION === 'true';
    console.log(`[DEBUG] USE_PARALLEL_GENERATION: ${useParallelGeneration}`);

    if (!useParallelGeneration) {
      // 並列生成が無効の場合は従来の逐次処理フローを使用
      return await legacyGenerateResponse(agentId, question, history, style);
    }

    // 並列生成フロー
    console.log(`[DEBUG] Using parallel generation flow`);

    // ステップ1: 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] Step 1: Generating expert response for ${agentId}...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] Generated text: ${responseData.text.slice(0, 50)}...`);

    // ステップ2: 説明文を文章-画像ペアの配列に変換
    const pairs = createSentenceImagePairs(responseData.steps || []);
    console.log(`[DEBUG] Created ${pairs.length} sentence-image pairs`);

    // ステップ3: 最初のペアの画像と音声を並列生成
    if (pairs.length > 0) {
      pairs[0].status = 'generating';
      console.log(`[DEBUG] Step 2: Generating first pair image and audio in parallel...`);
      
      try {
        const [imageUrl, audioData] = await Promise.all([
          generateIllustration(pairs[0].visualDescription),
          generateSpeech(pairs[0].text)
        ]);
        
        if (imageUrl) {
          pairs[0].imageUrl = imageUrl;
          pairs[0].status = 'ready';
          pairs[0].generatedAt = new Date();
          console.log(`[DEBUG] First pair image generated successfully`);
        } else {
          pairs[0].status = 'error';
          console.error(`[ERROR] First pair image generation returned null`);
        }
        
        pairs[0].audioData = audioData;
        console.log(`[DEBUG] First pair audio: ${audioData ? 'generated' : 'failed (will use fallback)'}`);
        
      } catch (error) {
        console.error('[ERROR] First pair generation failed:', error);
        pairs[0].status = 'error';
      }
    }

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      pairs,
      audioUrl: undefined,
      isThinking: false,
      useParallelGeneration: true
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("[generateResponseAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Response generation failed"
    };
  }
}

/**
 * 従来の逐次生成フロー（generateResponseAction用）
 */
async function legacyGenerateResponse(
  agentId: AgentRole,
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[DEBUG] Using legacy sequential flow for response generation`);

    // ステップ1: 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] Step 1: Generating expert response for ${agentId}...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] Generated text: ${responseData.text.slice(0, 50)}...`);

    // ステップ2: 画像生成用のプロンプトを作成
    let imagePrompt: string;
    if (responseData.steps && responseData.steps.length > 0) {
      imagePrompt = generateCombinedImagePrompt(responseData.steps);
    } else {
      imagePrompt = await generateIllustrationPrompt(agentId, question, responseData.text);
    }
    console.log(`Image prompt: ${imagePrompt}`);

    // ステップ3: 画像を生成
    console.log(`[DEBUG] Step 2: Generating illustration...`);
    const imageUrl = await generateIllustration(imagePrompt);
    console.log(`[DEBUG] Illustration generated: ${imageUrl ? 'Success' : 'Failed'}`);

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      steps: responseData.steps,
      imageUrl,
      audioUrl: undefined,
      isThinking: false,
      useParallelGeneration: false
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("Legacy response generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Response generation failed"
    };
  }
}

/**
 * 子供の質問に対してAIエージェントが回答を生成するメインアクション（レガシー版）
 * 
 * 後方互換性のために残していますが、新しいコードでは
 * decideAgentAction + generateResponseAction の2段階呼び出しを推奨します。
 * 
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @param style 説明スタイル（デフォルト、詳細など）
 * @returns 成功/失敗とエージェントの回答データ
 * @deprecated 代わりに decideAgentAction と generateResponseAction を使用してください
 */
export async function consultAction(
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[consultAction] DEPRECATED: Use decideAgentAction + generateResponseAction instead`);
    console.log(`Consultation started for: "${question}" (Style: ${style})`);

    // 環境変数から並列生成機能の有効/無効を判定
    const useParallelGeneration = process.env.USE_PARALLEL_GENERATION === 'true';
    console.log(`[DEBUG] USE_PARALLEL_GENERATION: ${useParallelGeneration}`);

    if (!useParallelGeneration) {
      // 並列生成が無効の場合は従来の逐次処理フローを使用
      return await legacyConsultFlow(question, history, style);
    }

    // 並列生成フロー: 文章と画像を段階的に生成
    console.log(`[DEBUG] Using new parallel generation flow`);

    // ステップ1: 質問内容に最適な専門家エージェントを選択
    console.log(`[DEBUG] Step 1: Deciding agent...`);
    const { agentId, reason: selectionReason } = await decideAgent(question, history);
    console.log(`[DEBUG] Selected agent: ${agentId}, Reason: ${selectionReason}`);

    // ステップ2: 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] Step 2: Generating expert response for ${agentId}...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] Generated text: ${responseData.text.slice(0, 50)}...`);

    // ステップ3: 説明文を文章-画像ペアの配列に変換
    const pairs = createSentenceImagePairs(responseData.steps || []);
    console.log(`[DEBUG] Created ${pairs.length} sentence-image pairs`);

    // ステップ4: 最初のペアの画像と音声を並列生成（残りは後でクライアント側から要求）
    if (pairs.length > 0) {
      pairs[0].status = 'generating';
      console.log(`[DEBUG] Step 4: Generating first pair image and audio in parallel...`);
      
      try {
        // 画像と音声を並列生成してレスポンス時間を短縮
        const [imageUrl, audioData] = await Promise.all([
          generateIllustration(pairs[0].visualDescription),
          generateSpeech(pairs[0].text)
        ]);
        
        if (imageUrl) {
          pairs[0].imageUrl = imageUrl;
          pairs[0].status = 'ready';
          pairs[0].generatedAt = new Date();
          console.log(`[DEBUG] First pair image generated successfully`);
        } else {
          pairs[0].status = 'error';
          console.error(`[ERROR] First pair image generation returned null`);
        }
        
        // 音声データを設定（nullでも許容、クライアント側でフォールバック）
        pairs[0].audioData = audioData;
        console.log(`[DEBUG] First pair audio: ${audioData ? 'generated' : 'failed (will use fallback)'}`);
        
      } catch (error) {
        console.error('[ERROR] First pair generation failed:', error);
        pairs[0].status = 'error';
      }
    }

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      pairs,
      audioUrl: undefined,
      isThinking: false,
      selectionReason,
      useParallelGeneration: true
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("Consultation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Consultation failed"
    };
  }
}

/**
 * 従来の逐次生成フロー（後方互換性のため保持）
 * 
 * 処理の流れ:
 * 1. エージェント選択
 * 2. 説明文生成
 * 3. 画像プロンプト生成
 * 4. 画像生成（1枚のみ）
 * 
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @param style 説明スタイル
 * @returns 成功/失敗とエージェントの回答データ
 */
async function legacyConsultFlow(
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[DEBUG] Using legacy sequential flow`);

    // ステップ1: 質問内容に最適な専門家エージェントを選択
    console.log(`[DEBUG] Step 1: Deciding agent...`);
    const { agentId, reason: selectionReason } = await decideAgent(question, history);
    console.log(`[DEBUG] Selected agent: ${agentId}, Reason: ${selectionReason}`);

    // ステップ2: 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] Step 2: Generating expert response for ${agentId}...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] Generated text: ${responseData.text.slice(0, 50)}...`);

    // ステップ3: 画像生成用のプロンプトを作成
    let imagePrompt: string;
    if (responseData.steps && responseData.steps.length > 0) {
      // 複数ステップがある場合は統合プロンプトを生成
      imagePrompt = generateCombinedImagePrompt(responseData.steps);
    } else {
      // ステップがない場合は従来の方法でプロンプト生成（非推奨）
      imagePrompt = await generateIllustrationPrompt(agentId, question, responseData.text);
    }
    console.log(`Image prompt: ${imagePrompt}`);

    // ステップ4: 画像を生成
    console.log(`[DEBUG] Step 3: Generating illustration...`);
    const imageUrl = await generateIllustration(imagePrompt);
    console.log(`[DEBUG] Illustration generated: ${imageUrl ? 'Success' : 'Failed'}`);

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      steps: responseData.steps,
      imageUrl,
      audioUrl: undefined,
      isThinking: false,
      selectionReason,
      useParallelGeneration: false
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("Legacy consultation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Consultation failed"
    };
  }
}

/**
 * テキストを音声に変換するサーバーアクション
 * 
 * Vertex AI TTSを使用して音声を生成します。
 * 失敗した場合はnullを返し、クライアント側でWeb Speech APIにフォールバックします。
 * 
 * @param text 読み上げるテキスト
 * @returns Base64エンコードされた音声データ、または失敗時はnull
 */
export async function generateSpeechAction(text: string): Promise<string | null> {
  try {
    console.log(`generateSpeechAction called for text length: ${text.length}`);
    // Vertex AI TTSで音声を生成（デフォルトボイス: charon）
    const base64Audio = await generateSpeech(text);
    return base64Audio;
  } catch (error: any) {
    console.error("Failed to generate speech in Server Action:", error);
    // Vertex AI TTSが利用できない場合はnullを返す
    // クライアント側でWeb Speech APIにフォールバックする
    console.warn("Vertex AI TTS unavailable. Client will use Web Speech API fallback.");
    return null;
  }
}

/**
 * 個別の画像を生成するサーバーアクション
 * 
 * 並列文章-画像生成フローで使用されます。
 * フロントエンドが必要に応じて特定のペアの画像をリクエストします。
 * 失敗時は自動的にリトライを行います（最大3回試行）。
 * 
 * @param pairId ペアの一意識別子（ログ用）
 * @param visualDescription 画像生成用の英語プロンプト
 * @returns 画像URLとステータス（ready または error）
 */
export async function generateNextImageAction(
  pairId: string,
  visualDescription: string
): Promise<{ imageUrl: string | null; status: 'ready' | 'error' }> {
  const maxRetries = 2; // 最大2回リトライ（合計3回試行）
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DEBUG] Generating image for ${pairId}, attempt ${attempt + 1}/${maxRetries + 1}`);
      
      const imageUrl = await generateIllustration(visualDescription);
      
      if (imageUrl) {
        console.log(`[DEBUG] Image generated successfully for ${pairId}`);
        return {
          imageUrl,
          status: 'ready'
        };
      }
      
      // imageUrlがnullの場合もリトライ対象
      console.warn(`[WARN] Image generation returned null for ${pairId}, attempt ${attempt + 1}`);
      
      if (attempt < maxRetries) {
        // 指数バックオフで待機時間を増やす（4秒、8秒）
        const delay = Math.pow(2, attempt + 2) * 1000;
        console.log(`[DEBUG] Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      console.error(`[ERROR] Image generation failed for ${pairId}, attempt ${attempt + 1}:`, error);
      
      if (attempt < maxRetries) {
        // 指数バックオフで待機時間を増やす（4秒、8秒）
        const delay = Math.pow(2, attempt + 2) * 1000;
        console.log(`[DEBUG] Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // すべてのリトライが失敗した場合
  console.error(`[ERROR] All retry attempts failed for ${pairId}`);
  return {
    imageUrl: null,
    status: 'error'
  };
}
