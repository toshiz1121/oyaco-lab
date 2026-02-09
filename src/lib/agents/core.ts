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
import { AgentRole, ExplanationStep, SentenceImagePair, PairStatus, EducatorReview, FollowUpQuestion } from './types';
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

  // definitions.ts の expertise / cannotHandle から動的にエキスパートリストを構築
  const expertList = Object.values(agents)
    .filter(a => a.id !== 'orchestrator') // オーケストレーター自身は除外
    .map(a => {
      const expertiseStr = a.expertise.join('、');
      const cannotStr = a.cannotHandle.length > 0
        ? `（苦手: ${a.cannotHandle.join('、')}）`
        : '';
      return `- ${a.id}（${a.nameJa}）: 得意 → ${expertiseStr} ${cannotStr}`;
    })
    .join('\n    ');

  const prompt = `
    You are an orchestrator for a Kids Science Lab.
    Your task is to classify the user's question and select the best expert to answer it, considering the conversation history.
    
    Available Experts:
    ${expertList}
    
    Selection Rules:
    1. Match the question's topic to each expert's 得意 (expertise) keywords.
    2. Avoid assigning a question to an expert whose 苦手 (cannotHandle) list includes the topic.
    3. If the question is about the human body, health, food, sleep, or general life advice, choose 'educator'.
    4. If the question doesn't clearly fit any specific expert, choose 'scientist' as a default.
    5. Consider the conversation history — if the child is continuing a topic, prefer the same expert for continuity.
    
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
    console.warn(`オーケストレーターが不明なロールを返しました: ${agentId}。scientistにフォールバックします。`);
    return { agentId: 'scientist', reason: "かがくのことがとくいだから" };

  } catch (error) {
    console.error("エージェント選択に失敗しました:", error);
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

  // スタイル別の追加指示（default はなし — agent.persona がそのまま使われる）
  let styleInstruction = '';
  if (style === 'metaphor') {
    styleInstruction = '特に「例え話」を重視して説明してください。子供が想像しやすい身近なものに例えてください。';
  } else if (style === 'simple') {
    styleInstruction = '幼稚園児でもわかるくらい、とことん簡単な言葉で短く説明してください。';
  } else if (style === 'detail') {
    styleInstruction = '少し詳しく、小学校高学年向けに科学的な仕組みも踏まえて説明してください。';
  }

  const historyText = history.length > 0
    ? `これまでの会話:\n${history.map(m => `${m.role === 'user' ? '子供' : agent.nameJa}: ${m.content}`).join('\n')}\n`
    : '';

  const prompt = `
# あなたの設定
${agent.persona}

# 共通ルール
1. 専門用語は一切使わず、小学校低学年が理解できる言葉のみで構成すること。
2. 比喩の精度を最優先する。内容の本質と、例え（公園、お菓子、遊び等）が論理的に一致していること。
3. 構成：質問を褒める ＞ 生活に密着した比喩で解説 ＞ 子供の好奇心を応援して締める。
4. 読み聞かせのような、目線を感じさせる優しいトーンを維持すること。
5. 必ず上記「あなたの設定」に書かれた口調で話すこと。他の博士の口調を使わないこと。
${styleInstruction ? `6. ${styleInstruction}` : ''}

### 解説の指針（起承転結）
解説は以下の「起・承・転・結」の流れを意識し、2〜4ステップに集約してください。
1.【起】質問を褒め、身近なものに例えて全体像を伝える（導入）
2.【承】その例えを使って、仕組みや理由を具体的に広げる（展開）
3.【転】「もし〜がなかったら？」や「実はこうなんだよ」という驚きや視点の変化を与える（深掘り）
4.【結】まとめと、子供の未来や好奇心につながる励まし（結論）

### JSON形式
{
  "text": "回答全体の要約。博士が自分の口調で優しく語りかける100文字程度のまとめ。",
  "steps": [
    {
      "stepNumber": 1,
      "text": "ステップ1の説明文（必ず自分の口調で、独立した完結文）",
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

    const jsonString = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
    const parsed = JSON.parse(jsonString);

    return {
      text: parsed.text || "ごめんね、ちょっとよくわからなかったよ。",
      steps: parsed.steps || []
    };

  } catch (error) {
    console.error("エキスパート回答生成に失敗しました:", error);
    return {
      text: "申し訳ありません、通信のエラーで答えられませんでした。",
      steps: []
    };
  }
}

/**
 * educator が他の博士の回答をレビューする（フィードバックループ）
 *
 * 実装背景:
 * - educator は回答テキストを受け取り、自律的に「修正が必要か」を判断する
 * - 修正が必要な場合、具体的な修正版を自分で生成する
 * - エキスパートとは異なる視点（子供の理解度）で評価する
 * - → 単なるプロンプトテンプレートではなく、判断 + 行動のループ
 *
 * @param expertAgentId 回答した博士のID
 * @param question 元の質問
 * @param text 博士の回答要約
 * @param steps 博士の回答ステップ
 * @returns EducatorReview（approved + 修正版 or フィードバック）
 */
export async function educatorReview(
  expertAgentId: AgentRole,
  question: string,
  text: string,
  steps: ExplanationStep[]
): Promise<EducatorReview> {
  const educator = agents['educator'];
  const expert = agents[expertAgentId];

  const stepsText = steps
    .map((s, i) => `ステップ${i + 1}: ${s.text}`)
    .join('\n');

  const prompt = `
# あなたの役割
${educator.persona}

# タスク
${expert.nameJa}が子供の質問に回答しました。
この回答が「小学校低学年の子供にとって分かりやすいか」をチェックしてください。

# チェック基準
1. 難しい言葉や専門用語が使われていないか
2. 文章が長すぎないか（1ステップ100文字以内が理想）
3. 比喩が子供の生活に身近なものか
4. 怖い表現や不安にさせる表現がないか
5. 全体として子供が「わかった！」と思える内容か

# 元の質問
「${question}」

# ${expert.nameJa}の回答
要約: ${text}

${stepsText}

# 判断
- 問題なければ approved: true にして、簡単なコメントを feedback に書いてください
- 修正が必要なら approved: false にして、修正版を revisedSteps に書いてください
  - 修正版は元の博士（${expert.nameJa}）の口調を維持してください
  - visualDescription は変更しないでください

# JSON形式で回答
{
  "approved": true,
  "feedback": "チェック結果のコメント",
  "revisedText": "修正後の要約（修正不要なら省略）",
  "revisedSteps": [
    {
      "stepNumber": 1,
      "text": "修正後のステップ文（修正不要なら省略）",
      "visualDescription": "元のまま変更しない"
    }
  ]
}
`;

  try {
    console.log(`[Educator] ${expert.nameJa}の回答をレビュー中...`);

    const data = await callVertexAI(AGENT_MODELS.expert, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) throw new Error("No content from educator review");

    const jsonString = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
    const parsed = JSON.parse(jsonString);

    const approved = parsed.approved !== false; // デフォルトは approved
    console.log(`[Educator] レビュー結果: approved=${approved}, feedback="${parsed.feedback}"`);

    return {
      approved,
      feedback: parsed.feedback || (approved ? '問題ありません' : '修正が必要です'),
      revisedText: approved ? undefined : parsed.revisedText,
      revisedSteps: approved ? undefined : parsed.revisedSteps,
    };

  } catch (error) {
    console.error("[Educator] レビューに失敗しました:", error);
    // レビュー失敗時は元の回答をそのまま通す（安全側に倒す）
    return {
      approved: true,
      feedback: 'レビュー処理でエラーが発生したため、元の回答をそのまま使用します',
    };
  }
}

/**
 * 回答内容から深掘り質問候補を生成する（ツール使用の実現）
 *
 * 実装背景:
 * - エキスパートが回答内容を分析し、関連する次の質問を自律的に生成
 * - 別の博士の専門領域にまたがる質問も提案（エージェント間連携）
 * - educator レビューと並列実行することでレイテンシを抑える
 *
 * @param agentId 回答した博士のID
 * @param question 元の質問
 * @param answerText 博士の回答要約
 * @param steps 博士の回答ステップ
 * @returns FollowUpQuestion の配列（2〜3個）
 */
export async function generateFollowUpQuestions(
  agentId: AgentRole,
  question: string,
  answerText: string,
  steps: ExplanationStep[]
): Promise<FollowUpQuestion[]> {
  const agent = agents[agentId];

  // 他の博士の情報を動的に構築
  const agentHints = Object.values(agents)
    .filter(a => a.id !== 'orchestrator')
    .map(a => `${a.id}（${a.nameJa}）: ${a.expertise.slice(0, 5).join('、')}`)
    .join('\n');

  const stepsText = steps
    .map((s, i) => `ステップ${i + 1}: ${s.text}`)
    .join('\n');

  const prompt = `
# タスク
${agent.nameJa}が子供の質問に回答しました。
この回答を踏まえて、子供が「もっと知りたい！」と思うような次の質問を2〜3個提案してください。

# ルール
1. 子供（小学校低学年）が自然に興味を持てる、ワクワクする質問にすること
2. 自分の専門分野だけでなく、他の博士の分野にまたがる質問も含めること
3. 元の質問の単純な繰り返しにならないこと
4. 各質問に最適な博士（suggestedAgent）を指定すること
5. 絵文字は質問の内容に合ったものを選ぶこと
6. 端的に、文章が長くならないようにすること(15文字以内)

# 利用可能な博士
${agentHints}

# 元の質問
「${question}」

# ${agent.nameJa}の回答
${answerText}
${stepsText}

# JSON形式で回答
[
  {
    "question": "子供向けの次の質問文",
    "suggestedAgent": "scientist",
    "emoji": "🔬"
  }
]
`;

  try {
    console.log(`[FollowUp] ${agent.nameJa}の回答から深掘り質問を生成中...`);

    const data = await callVertexAI(AGENT_MODELS.expert, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) throw new Error("No content from follow-up generation");

    const jsonString = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
    const parsed = JSON.parse(jsonString);

    const questions: FollowUpQuestion[] = (Array.isArray(parsed) ? parsed : [])
      .slice(0, 3)
      .filter((q: any) => q.question && q.suggestedAgent)
      .map((q: any) => ({
        question: q.question,
        suggestedAgent: Object.keys(agents).includes(q.suggestedAgent) ? q.suggestedAgent : agentId,
        emoji: q.emoji || '❓',
      }));

    console.log(`[FollowUp] ${questions.length}個の深掘り質問を生成しました`);
    return questions;

  } catch (error) {
    console.error("[FollowUp] 深掘り質問の生成に失敗しました:", error);
    return [];
  }
}

/**
 * LLMレスポンスからSentenceImagePair配列を生成する
 * 
 * 実装背景:
 * - 並列文章-画像生成フローのためのヘルパー関数
 * - ExplanationStepからSentenceImagePairへの変換を担当
 * - 一意のID生成とstepNumber割り当てを自動化
 * 
 * @param steps LLMから生成された説明ステップの配列
 * @returns SentenceImagePairの配列（初期状態はすべてpending）
 */
export function createSentenceImagePairs(steps: ExplanationStep[]): SentenceImagePair[] {
  return steps.map((step, index) => ({
    id: `pair-${index + 1}`,
    stepNumber: index + 1,
    text: step.text,
    visualDescription: step.visualDescription,
    imageUrl: null,
    audioData: null,
    status: 'pending' as PairStatus,
  }));
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
    console.error("イラスト生成に失敗しました:", error);
  }
  return undefined;
}
