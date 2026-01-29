"use server";

import { decideAgent, generateExpertResponse, generateIllustrationPrompt, generateIllustration, generateCombinedImagePrompt, ExplanationStyle } from "@/lib/agents/core";
import { AgentResponse, AgentRole } from "@/lib/agents/types";
import { generateSpeech } from "@/lib/vertexai";

export interface ConsultationResult {
  success: boolean;
  data?: AgentResponse;
  error?: string;
}

export async function consultAction(
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`Consultation started for: "${question}" (Style: ${style})`);

    // 1. Decide Agent
    console.log(`[DEBUG] Step 1: Deciding agent...`);
    const { agentId, reason: selectionReason } = await decideAgent(question, history);
    console.log(`[DEBUG] Selected agent: ${agentId}, Reason: ${selectionReason}`);

    // 2. Generate Response
    console.log(`[DEBUG] Step 2: Generating expert response for ${agentId}...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] Generated text: ${responseData.text.slice(0, 50)}...`);

    // 3. Generate Illustration (Parallel with Speech if needed, but here sequential for simplicity first)
    // First, generate prompt
    let imagePrompt: string;
    if (responseData.steps && responseData.steps.length > 0) {
      imagePrompt = generateCombinedImagePrompt(responseData.steps);
    } else {
      // Fallback
      imagePrompt = await generateIllustrationPrompt(agentId, question, responseData.text);
    }
    console.log(`Image prompt: ${imagePrompt}`);

    // Then generate image
    console.log(`[DEBUG] Step 3: Generating illustration...`);
    const imageUrl = await generateIllustration(imagePrompt);
    console.log(`[DEBUG] Illustration generated: ${imageUrl ? 'Success' : 'Failed'}`);

    // 4. Generate Speech (Deprecated: Using Web Speech API on client side)
    // const audioUrl = await generateSpeechAction(text);

    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      steps: responseData.steps,
      imageUrl,
      audioUrl: undefined,
      isThinking: false,
      selectionReason
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
 * テキストを音声に変換するサーバーアクション
 * @param text 読み上げるテキスト
 * @returns Base64エンコードされた音声データ
 */
export async function generateSpeechAction(text: string): Promise<string | null> {
  try {
    console.log(`generateSpeechAction called for text length: ${text.length}`);
    // デフォルトのボイス（charon - おっさん風）を使用
    const base64Audio = await generateSpeech(text);
    return base64Audio;
  } catch (error: any) {
    console.error("Failed to generate speech in Server Action:", error);
    // Vertex AI TTS が利用できない場合は null を返す
    // クライアント側で Web Speech API にフォールバックする
    console.warn("Vertex AI TTS unavailable. Client will use Web Speech API fallback.");
    return null;
  }
}
