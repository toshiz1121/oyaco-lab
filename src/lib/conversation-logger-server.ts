/**
 * 会話ログ管理（サーバーサイド版）
 * 
 * AIと子供の会話をFirestoreに記録する機能を提供
 * firebase-adminを使用してサーバーサイドで実行
 */

import { AgentResponse, AgentRole } from './agents/types';
import {
  createConversationServer,
  completeConversationServer,
  addScenesBatchServer,
} from './firebase/firestore-server';
import type { ConversationScene } from './firebase/types';
import { callVertexAI, VERTEX_AI_CONFIG } from './vertexai';
import { allCuriosityTypes } from './curiosity-types';

/**
 * 会話ログ記録のパラメータ
 */
export interface LogConversationParams {
  childId: string;
  question: string;
  curiosityType: string;
  selectedExpert: AgentRole;
  selectionReason?: string;
  response: AgentResponse;
  conversationId?: string;
}

/**
 * 会話全体をFirestoreに記録（サーバーサイド版）
 */
export async function logConversationServer(params: LogConversationParams): Promise<string> {
  const {
    childId,
    question,
    curiosityType,
    selectedExpert,
    selectionReason,
    response,
  } = params;

  const conversationId = params.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const startTime = Date.now();

  try {
    console.log(`[ConversationLoggerServer] Starting to log conversation: ${conversationId}`);

    // 1. 会話メタデータを作成
    await createConversationServer(
      childId,
      conversationId,
      question,
      curiosityType,
      selectedExpert,
      selectionReason
    );
    console.log('[ConversationLoggerServer] Conversation metadata created');

    // 2. シーンを一括保存
    if (response.pairs && response.pairs.length > 0) {
      const scenes: Array<Omit<ConversationScene, 'createdAt' | 'imageGeneratedAt'> & { imageGeneratedAt?: Date }> = response.pairs.map(
        (pair, index) => {
          const imageHint = pair.visualDescription.length > 50
            ? pair.visualDescription.substring(0, 50) + '...'
            : pair.visualDescription;

          let imageUrl = pair.imageUrl || '';
          if (imageUrl.startsWith('data:image/')) {
            console.error(`[ConversationLoggerServer] Scene ${index + 1}: Base64データが渡されました`);
            imageUrl = '';
          }

          const scene: Omit<ConversationScene, 'createdAt' | 'imageGeneratedAt'> & { imageGeneratedAt?: Date } = {
            sceneId: `scene_${index + 1}`,
            order: index + 1,
            script: pair.text,
            imagePromptUsed: pair.visualDescription,
            imageUrl,
            imageHint,
          };

          if (pair.generatedAt) {
            scene.imageGeneratedAt = new Date(pair.generatedAt);
          }

          if (pair.audioData) {
            scene.audioUrl = 'embedded';
          }

          return scene;
        }
      );

      await addScenesBatchServer(childId, conversationId, scenes);
      console.log(`[ConversationLoggerServer] Saved ${scenes.length} scenes`);
    }

    // 3. 会話を完了状態に更新
    const duration = Math.floor((Date.now() - startTime) / 1000);
    await completeConversationServer(
      childId,
      conversationId,
      response.pairs?.length || 0,
      duration,
      response.agentPipeline,
      curiosityType,
      selectedExpert
    );
    console.log('[ConversationLoggerServer] Conversation completed');

    return conversationId;

  } catch (error) {
    console.error('[ConversationLoggerServer] Failed to log conversation:', error);
    throw error;
  }
}

/**
 * 質問から好奇心タイプIDを推定（サーバーサイド版）
 */
export async function estimateCuriosityTypeServer(question: string): Promise<string> {
  const typeDescriptions = allCuriosityTypes.map(t => {
    return `ID: ${t.id}
名前: ${t.name}
概念: ${t.concept}
判定ルール: ${t.judgmentRule}
キーワード: ${t.keywords.join('、')}`;
  }).join('\n\n');

  const prompt = `あなたは子供の好奇心を分析する専門家です。
子供の質問を分析し、その背後にある好奇心のタイプを10種類から1つ選んでください。

【好奇心タイプ一覧】
${typeDescriptions}

【分析ルール】
1. 質問の内容、使われている言葉、質問の意図を総合的に判断する
2. 複数のタイプに当てはまる場合は、最も強く表れているタイプを選ぶ
3. キーワードだけでなく、質問の文脈や背後にある動機を考慮する
4. 判断が難しい場合は「01」（博士タイプ）を選ぶ

【子供の質問】
"${question}"

【回答形式】
以下のJSON形式で回答してください：
{
  "curiosityTypeId": "01",
  "reasoning": "この質問は〜という理由で〜タイプと判断しました"
}`;

  try {
    console.log('[estimateCuriosityTypeServer] Analyzing curiosity type...');
    
    const data = await callVertexAI(VERTEX_AI_CONFIG.models.text, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      console.warn('[estimateCuriosityTypeServer] No response from AI');
      return '01';
    }

    const jsonString = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
    const parsed = JSON.parse(jsonString);

    const typeId = parsed.curiosityTypeId;
    const reasoning = parsed.reasoning || '分析完了';

    if (typeId && allCuriosityTypes.some(t => t.id === typeId)) {
      console.log(`[estimateCuriosityTypeServer] Result: ${typeId} (${reasoning})`);
      return typeId;
    }

    console.warn(`[estimateCuriosityTypeServer] Unknown type ID: ${typeId}`);
    return '01';

  } catch (error) {
    console.error('[estimateCuriosityTypeServer] AI analysis failed:', error);
    return estimateCuriosityTypeByKeywords(question);
  }
}

/**
 * キーワードマッチングによる好奇心タイプ推定（フォールバック用）
 */
function estimateCuriosityTypeByKeywords(question: string): string {
  const scores: Record<string, number> = {};

  for (const type of allCuriosityTypes) {
    scores[type.id] = type.keywords.filter(w => question.includes(w)).length;
  }

  const maxScore = Math.max(...Object.values(scores));

  if (maxScore > 0) {
    const best = Object.entries(scores).find(([, s]) => s === maxScore);
    if (best) return best[0];
  }

  return '01';
}
