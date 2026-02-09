/**
 * 親エージェント（子育てアドバイザー）のコアロジック
 *
 * ReAct パターン（Reasoning + Acting）を採用:
 *   思考 → ツール選択・実行 → 観察 → 再思考 → ... → 最終回答
 *
 * Gemini の Function Calling を使い、エージェントが自律的に
 * どのツールを呼ぶかを判断する。人間がフローを固定するのではなく、
 * LLM が質問に応じて分析計画を立てる。
 */

import { callVertexAI, VERTEX_AI_CONFIG } from '@/lib/vertexai';
import {
  analyzeConversationHistory,
  analyzeLearningProgress,
  identifyKnowledgeGaps,
} from './tools';
import type {
  ParentAgentRequest,
  ParentAgentResult,
  AgentStep,
  ParentToolName,
} from './types';

// ========================================
// 定数
// ========================================

/** エージェントループの最大ステップ数（暴走防止） */
const MAX_STEPS = 5;

/** 使用するモデル */
const AGENT_MODEL = VERTEX_AI_CONFIG.models.text;

// ========================================
// Function Calling 用のツール定義
// ========================================

/**
 * Gemini に渡すツール定義（Function Declarations）
 * エージェントはこの中から必要なツールを自分で選ぶ
 */
const TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'analyzeConversationHistory',
      description: '指定期間の会話履歴を分析し、トピック分布・博士分布・質問頻度を返す',
      parameters: {
        type: 'object' as const,
        properties: {
          childId: { type: 'string' as const, description: '子供のID' },
          periodDays: { type: 'number' as const, description: '分析対象の日数（例: 7, 14, 30）' },
        },
        required: ['childId', 'periodDays'],
      },
    },
    {
      name: 'analyzeLearningProgress',
      description: '今週と先週を比較し、学習の傾向・継続性・新しい分野への挑戦を分析する',
      parameters: {
        type: 'object' as const,
        properties: {
          childId: { type: 'string' as const, description: '子供のID' },
        },
        required: ['childId'],
      },
    },
    {
      name: 'identifyKnowledgeGaps',
      description: '子供がまだ触れていない分野を特定し、新しい探索を提案する',
      parameters: {
        type: 'object' as const,
        properties: {
          childId: { type: 'string' as const, description: '子供のID' },
        },
        required: ['childId'],
      },
    },
  ],
};

// ========================================
// システムプロンプト
// ========================================

function buildSystemPrompt(request: ParentAgentRequest): string {
  return `あなたは「子育てアドバイザー」AIエージェントです。

# 役割
親御さんが子供の学習状況を理解し、日常の会話に活かせるよう支援します。

# 子供の情報
- 名前: ${request.childName}
- 年齢: ${request.childAge}歳

# 行動ルール
1. 親の質問に答えるために、まず必要なデータをツールで収集してください
2. 1つのツールの結果だけで判断せず、複数の観点から分析してください
3. 分析結果を踏まえて、具体的で実践的なアドバイスを提供してください
4. 温かみのある口調で、親を励ますように話してください
5. 子供の名前を使って、パーソナライズされた回答をしてください

# 回答の形式
- 簡潔に（200〜400文字程度）
- 具体的なシチュエーション付きのアドバイスを含める
- 数値データがあれば自然に織り込む
- 最後に前向きな一言を添える`;
}

// ========================================
// エージェントループ
// ========================================

/**
 * 親エージェントを実行する
 *
 * ReAct ループ:
 * 1. LLM にユーザーの質問とツール定義を渡す
 * 2. LLM がツール呼び出しを返したら、実行して結果を渡す
 * 3. LLM がテキスト回答を返したら、それが最終回答
 * 4. 最大 MAX_STEPS 回まで繰り返す
 */
export async function runParentAgent(
  request: ParentAgentRequest
): Promise<ParentAgentResult> {
  const startTime = Date.now();
  const steps: AgentStep[] = [];
  const toolsUsed: ParentToolName[] = [];

  // 会話履歴（LLM とのマルチターン）
  const messages: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    {
      role: 'user',
      parts: [{ text: request.query }],
    },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    console.log(`[ParentAgent] Step ${step + 1}/${MAX_STEPS}`);

    // LLM を呼び出す
    const response = await callVertexAI(AGENT_MODEL, {
      contents: messages,
      tools: [TOOL_DECLARATIONS],
      systemInstruction: { parts: [{ text: buildSystemPrompt(request) }] },
      generationConfig: { temperature: 0.7 },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.warn('[ParentAgent] Empty response from LLM');
      break;
    }

    const parts = candidate.content.parts;

    // Function Call が含まれているか確認
    const functionCall = parts.find((p: Record<string, unknown>) => p.functionCall);

    if (functionCall?.functionCall) {
      // ツール呼び出しを実行
      const { name, args } = functionCall.functionCall as {
        name: string;
        args: Record<string, unknown>;
      };

      console.log(`[ParentAgent] Tool call: ${name}`, args);
      steps.push({ type: 'thinking', content: `ツール「${name}」を呼び出します` });

      const toolResult = await executeToolCall(name, args, request.childId);
      toolsUsed.push(name as ParentToolName);

      steps.push({
        type: 'tool_call',
        toolName: name as ParentToolName,
        args,
        result: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
      });

      // ツール結果を会話履歴に追加（LLM に観察させる）
      messages.push({
        role: 'model',
        parts: [{ functionCall: { name, args } }],
      });
      messages.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: { result: toolResult },
          },
        }],
      });
    } else {
      // テキスト回答 → 最終回答
      const textPart = parts.find((p: Record<string, unknown>) => p.text);
      const answer = (textPart?.text as string) || '分析結果をまとめられませんでした。';

      steps.push({ type: 'final_answer', content: answer });

      return {
        answer,
        steps,
        toolsUsed,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  // MAX_STEPS に達した場合、最後にテキスト回答を強制取得
  const finalAnswer = await generateFinalAnswer(messages, request);
  steps.push({ type: 'final_answer', content: finalAnswer });

  return {
    answer: finalAnswer,
    steps,
    toolsUsed,
    processingTimeMs: Date.now() - startTime,
  };
}

// ========================================
// ツール実行ディスパッチャー
// ========================================

/**
 * ツール名に応じて適切な関数を呼び出す
 * 新しいツールを追加する場合はここに case を追加する
 */
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  fallbackChildId: string
): Promise<unknown> {
  const childId = (args.childId as string) || fallbackChildId;

  switch (toolName) {
    case 'analyzeConversationHistory': {
      const periodDays = (args.periodDays as number) || 30;
      return analyzeConversationHistory(childId, periodDays);
    }
    case 'analyzeLearningProgress': {
      return analyzeLearningProgress(childId);
    }
    case 'identifyKnowledgeGaps': {
      return identifyKnowledgeGaps(childId);
    }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ========================================
// フォールバック: 最終回答の強制生成
// ========================================

/**
 * ループ上限に達した場合、これまでの情報をもとに回答を生成する
 */
async function generateFinalAnswer(
  messages: Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  request: ParentAgentRequest
): Promise<string> {
  try {
    const response = await callVertexAI(AGENT_MODEL, {
      contents: [
        ...messages,
        {
          role: 'user',
          parts: [{ text: 'これまでの分析結果をもとに、最終的な回答をまとめてください。ツールは使わず、テキストで回答してください。' }],
        },
      ],
      systemInstruction: { parts: [{ text: buildSystemPrompt(request) }] },
      generationConfig: { temperature: 0.7 },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || `${request.childName}さんの学習状況を分析しました。詳しくはもう一度お尋ねください。`;
  } catch (error) {
    console.error('[ParentAgent] Failed to generate final answer:', error);
    return '申し訳ありません。分析中にエラーが発生しました。もう一度お試しください。';
  }
}
