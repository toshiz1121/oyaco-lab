"use server";

import { decideAgent, generateExpertResponse, generateIllustrationPrompt, generateIllustration, ExplanationStyle } from "@/lib/agents/core";
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
    const text = await generateExpertResponse(agentId, question, history, style);
    console.log(`Generated text: ${text.slice(0, 50)}...`);

    // 3. Generate Illustration (Parallel with Speech if needed, but here sequential for simplicity first)
    // First, generate prompt
    const imagePrompt = await generateIllustrationPrompt(agentId, question, text);
    console.log(`Image prompt: ${imagePrompt}`);

    // Then generate image
    const imageUrl = await generateIllustration(imagePrompt);
    
    // 4. Generate Speech (Parallel)
    const audioUrl = await generateSpeechAction(text);

    const response: AgentResponse = {
        agentId,
        text,
        imageUrl,
        audioUrl: audioUrl || undefined,
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
  const apiKey = process.env.GEMINI_API_KEY; // Using as OpenAI compatible key
  const baseUrl = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1"; // Default to OpenAI if not set
  
  if (!apiKey) {
    console.warn("API Key is not set. Speech generation skipped.");
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts", // Or tts-1 depending on provider
        input: text,
        voice: "onyx",
      }),
    });

    if (!response.ok) {
        // Fallback to tts-1 if gpt-4o-mini-tts fails (common issue with different providers)
        if (response.status === 400 || response.status === 404) {
             console.log("Retrying with tts-1...");
             const retryResponse = await fetch(`${baseUrl}/audio/speech`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "tts-1",
                    input: text,
                    voice: "onyx",
                }),
            });
            if (retryResponse.ok) {
                const arrayBuffer = await retryResponse.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                return `data:audio/mp3;base64,${base64}`;
            }
        }
        
      const errorText = await response.text();
      console.error("TTS API Error:", response.status, response.statusText, errorText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:audio/mp3;base64,${base64}`;
  } catch (error) {
    console.error("Failed to generate speech:", error);
    return null;
  }
}
