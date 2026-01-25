"use server";

import { decideAgent, generateExpertResponse, generateIllustrationPrompt, generateIllustration, generateCombinedImagePrompt, ExplanationStyle } from "@/lib/agents/core";
import { AgentResponse, AgentRole } from "@/lib/agents/types";

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
    const agentId = await decideAgent(question, history);
    console.log(`Selected agent: ${agentId}`);

    // 2. Generate Response
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`Generated text: ${responseData.text.slice(0, 50)}...`);

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
    const imageUrl = await generateIllustration(imagePrompt);
    
    // 4. Generate Speech (Deprecated: Using Web Speech API on client side)
    // const audioUrl = await generateSpeechAction(text);

    const response: AgentResponse = {
        agentId,
        text: responseData.text,
        steps: responseData.steps,
        imageUrl,
        audioUrl: undefined,
        isThinking: false
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

export async function generateSpeechAction(text: string): Promise<string | null> {
    // Deprecated: Using Web Speech API on client side to avoid OpenAI dependency
    // and because Gemini API currently doesn't support TTS directly.
    return null;
}
