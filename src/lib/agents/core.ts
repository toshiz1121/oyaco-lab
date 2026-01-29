/**
 * エージェントシステムのコアロジック
 * 
 * 実装背景:
 * - 子供向け科学教育アプリケーションのためのマルチエージェントシステム
 * - 質問内容に応じて最適な専門家エージェントを選択
 * - Vertex AIを使用して高品質な回答と画像を生成
 * 
 * アーキテクチャ:
 * 1. オーケストレーター: 質問を分析し、適切なエージェントを選択
 * 2. エキスパート: 選択されたエージェントが専門知識を活かして回答
 * 3. イラストレーター: 回答に対応する視覚的な説明画像を生成
 */

import { callVertexAI, VERTEX_AI_CONFIG } from '../vertexai';
import { AgentRole, ExplanationStep } from './types';
import { agents } from './definitions';

/**
 * エージェントシステムで使用するモデル設定
 * 
 * 実装背景:
 * - Vertex AI設定から取得することで、一元管理を実現
 * - モデルの切り替えが容易になり、拡張性が向上
 * - as constにより、型安全性を確保
 */
const AGENT_MODELS = {
  orchestrator: VERTEX_AI_CONFIG.models.text,  // オーケストレーション用
  expert: VERTEX_AI_CONFIG.models.text,        // エキスパート回答生成用
  imageGenerator: VERTEX_AI_CONFIG.models.image // 画像生成用
} as const;

export type ExplanationStyle = 'default' | 'metaphor' | 'simple' | 'detail';

/**
 * 質問内容に基づいて最適なエージェントを選択する
 * 
 * 実装背景:
 * - LLMを使用して質問の内容を分析し、最も適切な専門家を選択
 * - 会話履歴を考慮することで、文脈に応じた選択が可能
 * - 子供向けの温かい説明文を生成
 * 
 * @param question ユーザーの質問
 * @param history 会話履歴（オプション）
 * @returns 選択されたエージェントIDと選択理由
 */
export async function decideAgent(
  question: string,
  history: { role: string, content: string }[] = []
): Promise<{ agentId: AgentRole; reason: string }> {
  const historyText = history.length > 0
    ? `Current Conversation Context:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}\n`
    : '';

  const prompt = `
    You are an orchestrator for a Kids Science Lab.
    Your task is to classify the user's question and select the best expert to answer it, considering the conversation history.
    
    Available Experts:
    - scientist: Physics, chemistry, general science, technology.
    - biologist: Animals, plants, bugs, biology.
    - astronomer: Space, stars, planets, universe.
    - historian: History, past events, old customs, dinosaurs (often overlaps with paleontologist but historian can handle storytelling).
    - artist: Art, colors, feelings, beauty, creative questions.
    
    If the question doesn't fit any specific expert, choose 'scientist' as a default or 'educator' if it's about general guidance or life advice.
    
    ${historyText}
    
    User Question: "${question}"
    
    Respond in JSON format with the agent ID and a child-friendly reason (in Japanese) for why this expert was chosen.
    The reason should be simple, warm, and easy for elementary school children to understand (e.g., "うちゅうのことがとくいだから").
    
    JSON format:
    {
      "agentId": "scientist",
      "reason": "かがくのことがとくいだから"
    }
  `;

  try {
    const data = await callVertexAI(AGENT_MODELS.orchestrator, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) throw new Error("No content generated");

    // Clean up potential markdown code blocks
    const jsonString = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
    const parsed = JSON.parse(jsonString);

    const agentId = parsed.agentId?.toLowerCase();
    const reason = parsed.reason || "きみのしつもんにこたえられるから";

    if (agentId && Object.keys(agents).includes(agentId)) {
      return { agentId: agentId as AgentRole, reason };
    }
    console.warn(`Orchestrator returned unknown role: ${agentId}. Fallback to scientist.`);
    return { agentId: 'scientist', reason: "かがくのことがとくいだから" };

  } catch (error) {
    console.error("Agent decision failed:", error);
    return { agentId: 'scientist', reason: "かがくのことがとくいだから" };
  }
}

/**
 * 選択されたエージェントが専門知識を活かして回答を生成する
 * 
 * 実装背景:
 * - エージェントのペルソナに基づいた口調で回答
 * - 説明スタイル（比喩、簡単、詳細）に応じた内容調整
 * - ステップバイステップの説明により、理解を促進
 * - 各ステップに視覚的な説明を含めることで、画像生成に活用
 * 
 * @param agentId エージェントID
 * @param question ユーザーの質問
 * @param history 会話履歴（オプション）
 * @param style 説明スタイル（デフォルト、比喩、簡単、詳細）
 * @returns 回答テキストとステップバイステップの説明
 */
export async function generateExpertResponse(
  agentId: AgentRole,
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<{ text: string, steps: ExplanationStep[] }> {
  const agent = agents[agentId];

  let styleInstruction = `
# Role: 世界一の知識を持ち、子供と遊ぶのが上手な「物知り博士」
# Persona: 威厳があるが温厚。「ほっほっほ」「おや、いい質問だね！」といった親しみやすい老博士の口調。
# Constraints:
1. 専門用語は一切使わず、小学校低学年が理解できる言葉のみで構成すること。
2. 比喩の精度を最優先する。内容の本質と、例え（公園、お菓子、遊び等）が論理的に一致していること。
3. 構成：質問を褒める ＞ 生活に密着した比喩で解説 ＞ 子供の好奇心を応援して締める。
4. 読み聞かせのような、目線を感じさせる優しいトーンを維持すること。
`;


  if (style === 'metaphor') {
    styleInstruction = "特に「例え話」を重視して説明してください。子供が想像しやすい身近なものに例えてください。";
  } else if (style === 'simple') {
    styleInstruction = "幼稚園児でもわかるくらい、とことん簡単な言葉で短く説明してください。";
  } else if (style === 'detail') {
    styleInstruction = "少し詳しく、小学校高学年向けに科学的な仕組みも踏まえて説明してください。";
  }

  const historyText = history.length > 0
    ? `これまでの会話:\n${history.map(m => `${m.role === 'user' ? '子供' : agent.nameJa}: ${m.content}`).join('\n')}\n`
    : '';

  const prompt = `
    ${agent.persona}
    
    以下の質問に対し、設定されたペルソナに基づき、小学生（低学年〜中学年）に向けて解説してください。
    ${styleInstruction}

    ### 解説の指針（起承転結）
    解説は以下の「起・承・転・結」の流れを意識し、2〜4ステップに集約してください。
    1.【起】質問を褒め、身近なものに例えて全体像を伝える（導入）
    2.【承】その例えを使って、仕組みや理由を具体的に広げる（展開）
    3.【転】「もし〜がなかったら？」や「実はこうなんだよ」という驚きや視点の変化を与える（深掘り）
    4.【結】まとめと、子供の未来や好奇心につながる励まし（結論）

    ### JSON形式
    {
      "text": "回答全体の要約。博士が優しく語りかける100文字程度のまとめ。",
      "steps": [
        {
          "stepNumber": 1,
          "text": "ステップ1の説明文（博士の口調、独立した完結文）",
          "visualDescription": "Detailed English prompt for image generation reflecting this step's scene."
        }
      ]
    }
    
    ${historyText}
    
    質問: "${question}"
  `;

  try {
    const data = await callVertexAI(AGENT_MODELS.expert, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) throw new Error("No content generated");

    // Clean up potential markdown code blocks if the model ignores responseMimeType (backup)
    const jsonString = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
    const parsed = JSON.parse(jsonString);

    return {
      text: parsed.text || "ごめんね、ちょっとよくわからなかったよ。",
      steps: parsed.steps || []
    };

  } catch (error) {
    console.error("Expert response failed:", error);
    return {
      text: "申し訳ありません、通信のエラーで答えられませんでした。",
      steps: []
    };
  }
}

/**
 * ステップ説明から1枚の画像（パネルレイアウト）を生成するためのプロンプトを作成する
 * 
 * 実装背景:
 * - 複数のステップを1枚の画像にまとめることで、視覚的な理解を促進
 * - ステップ数に応じて最適なレイアウト（1パネル、2パネル、4パネル）を選択
 * - 子供向け絵本スタイルの温かいイラストを生成
 * 
 * @param steps 説明ステップの配列
 * @returns 画像生成用のプロンプト（英語）
 */
export function generateCombinedImagePrompt(steps: ExplanationStep[]): string {
  if (!steps || steps.length === 0) return "Children's book illustration";

  const count = steps.length;
  const baseStyle = 'The style should be "children\'s book illustration, colorful, warm, simple, clean lines". If any text is included in the image, it MUST be in Japanese.';

  if (count === 1) {
    return `
          Create an illustration for a children's book.
          ${baseStyle}
          Description: ${steps[0].visualDescription}
        `.trim();
  } else if (count === 2) {
    return `
          Create a split-screen image divided vertically into 2 equal panels (Left and Right).
          ${baseStyle}
          Panel 1 (Left): ${steps[0].visualDescription}
          Panel 2 (Right): ${steps[1].visualDescription}
        `.trim();
  } else {
    // Default to 4 panels (2x2 grid) for 3+ steps
    return `
          Create a comic strip style image divided into 4 equal panels (2x2 grid).
          ${baseStyle}
          Panel 1 (Top-Left): ${steps[0]?.visualDescription || ''}
          Panel 2 (Top-Right): ${steps[1]?.visualDescription || ''}
          Panel 3 (Bottom-Left): ${steps[2]?.visualDescription || ''}
          Panel 4 (Bottom-Right): ${steps[3]?.visualDescription || ''}
        `.trim();
  }
}

/**
 * 画像生成プロンプトを生成する（レガシー関数）
 * 
 * 実装背景:
 * - 後方互換性のために保持
 * - 新しいコードではgenerateCombinedImagePromptを使用することを推奨
 * 
 * @deprecated generateCombinedImagePromptを使用してください
 * @param agentId エージェントID
 * @param question ユーザーの質問
 * @param answer 回答テキスト
 * @returns 画像生成用のプロンプト（英語）
 */
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
    const data = await callVertexAI(AGENT_MODELS.expert, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5 }
    });
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `Illustration for ${question}, children's book style`;
  } catch (error) {
    return `Illustration for ${question}, children's book style`;
  }
}

/**
 * プロンプトに基づいて画像を生成する
 * 
 * 実装背景:
 * - Vertex AI画像生成モデルを使用
 * - 子供向け教育コンテンツに適した4:3アスペクト比
 * - Base64エンコードされた画像データを返す
 * 
 * @param prompt 画像生成用のプロンプト（英語）
 * @returns Base64エンコードされた画像データURL、または失敗時はundefined
 */
export async function generateIllustration(prompt: string): Promise<string | undefined> {
  try {
    const data = await callVertexAI(AGENT_MODELS.imageGenerator, {
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
