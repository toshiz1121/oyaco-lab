import { callGeminiApi } from '../gemini';
import { AgentRole } from './types';
import { agents } from './definitions';

const MODEL_NAME_TEXT = "gemini-3-pro-preview";
const MODEL_NAME_IMAGE = "gemini-3-pro-image-preview";

export async function decideAgent(question: string): Promise<AgentRole> {
  const prompt = `
    You are an orchestrator for a Kids Science Lab.
    Your task is to classify the user's question and select the best expert to answer it.
    
    Available Experts:
    - scientist: Physics, chemistry, general science, technology.
    - biologist: Animals, plants, bugs, biology.
    - astronomer: Space, stars, planets, universe.
    - historian: History, past events, old customs, dinosaurs (often overlaps with paleontologist but historian can handle storytelling).
    - artist: Art, colors, feelings, beauty, creative questions.
    
    If the question doesn't fit any specific expert, choose 'scientist' as a default or 'educator' if it's about general guidance or life advice.
    
    User Question: "${question}"
    
    Respond with ONLY the AgentRole string (e.g., "scientist").
  `;

  try {
    const data = await callGeminiApi(MODEL_NAME_TEXT, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });
    
    // クリーニング: 余計な空白や改行、マークダウンの記号を削除
    let role = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    role = role?.replace(/```/g, '').replace(/\n/g, '').trim();
    
    if (role && Object.keys(agents).includes(role)) {
        return role as AgentRole;
    }
    console.warn(`Orchestrator returned unknown role: ${role}. Fallback to scientist.`);
    return 'scientist'; // Default fallback

  } catch (error) {
    console.error("Agent decision failed:", error);
    return 'scientist';
  }
}

export async function generateExpertResponse(agentId: AgentRole, question: string): Promise<string> {
  const agent = agents[agentId];
  
  const prompt = `
    ${agent.persona}
    
    以下の質問に、あなたのペルソナ（口調・性格）で答えてください。
    対象は小学生（低学年～中学年）です。
    難しすぎる言葉は使わず、比喩や具体例を使って分かりやすく説明してください。
    150文字〜200文字程度で、子どもが飽きない長さにまとめてください。
    
    質問: "${question}"
  `;

  try {
    const data = await callGeminiApi(MODEL_NAME_TEXT, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      });
      
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "ごめんね、ちょっとよくわからなかったよ。";
  } catch (error) {
    console.error("Expert response failed:", error);
    return "申し訳ありません、通信のエラーで答えられませんでした。";
  }
}

export async function generateIllustrationPrompt(agentId: AgentRole, question: string, answer: string): Promise<string> {
    const prompt = `
      Create a prompt for an image generation AI to illustrate the following answer for a child.
      The style should be "children's book illustration, colorful, warm, simple, clean lines".
      The image should visually explain the answer.
      
      Question: ${question}
      Answer Summary: ${answer.slice(0, 100)}...
      
      Output ONLY the English prompt for image generation.
    `;

    try {
        const data = await callGeminiApi(MODEL_NAME_TEXT, {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5 }
        });
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `Illustration for ${question}, children's book style`;
    } catch (error) {
        return `Illustration for ${question}, children's book style`;
    }
}

export async function generateIllustration(prompt: string): Promise<string | undefined> {
    try {
        const data = await callGeminiApi(MODEL_NAME_IMAGE, {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ["IMAGE"],
                imageConfig: { aspectRatio: "4:3" }
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
