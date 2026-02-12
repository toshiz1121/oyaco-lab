/**
 * 会話ログ管理
 * 
 * AIと子供の会話をFirestoreに記録する機能を提供
 */

import { Timestamp } from 'firebase/firestore';
import { AgentResponse, AgentRole } from './agents/types';
import {
  createConversation,
  completeConversation,
  addScenesBatch,
} from './firebase/firestore';
import type { ConversationScene } from './firebase/types';
import { callVertexAI, VERTEX_AI_CONFIG } from './vertexai';
import { curiosityZones, allCuriosityTypes } from './curiosity-types';

/**
 * 会話ログ記録のパラメータ
 */
export interface LogConversationParams {
  childId: string;              // 子供のID
  question: string;             // 子供の質問
  curiosityType: string;        // 好奇心のタイプ
  selectedExpert: AgentRole;    // 選ばれた博士
  selectionReason?: string;     // 選定理由
  response: AgentResponse;      // AIの回答データ
  conversationId?: string;      // 事前生成された会話ID（Storage連携用）
}

/**
 * 会話全体をFirestoreに記録
 * 
 * @param params - 会話ログのパラメータ
 * @returns 作成された会話ID
 */
export async function logConversation(params: LogConversationParams): Promise<string> {
  const {
    childId,
    question,
    curiosityType,
    selectedExpert,
    selectionReason,
    response,
  } = params;

  // 会話IDを使用（事前生成されたものがあればそれを使う）
  const conversationId = params.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log(`[ConversationLogger] Starting to log conversation: ${conversationId}`);
    console.log(`[ConversationLogger] childId: ${childId}`);
    console.log(`[ConversationLogger] question: ${question.substring(0, 50)}...`);
    console.log(`[ConversationLogger] selectedExpert: ${selectedExpert}`);

    // 1. 会話メタデータを作成
    console.log('[ConversationLogger] Step 1: Creating conversation metadata...');
    await createConversation(
      childId,
      conversationId,
      question,
      curiosityType,
      selectedExpert,
      selectionReason
    );
    console.log('[ConversationLogger] Step 1: Conversation metadata created successfully');

    // シーンを一括保存
    if (response.pairs && response.pairs.length > 0) {
      const scenes: Omit<ConversationScene, 'createdAt'>[] = response.pairs.map(
        (pair, index) => {
          // 画像ヒントを生成（プロンプトの最初の50文字）
          const imageHint = pair.visualDescription.length > 50
            ? pair.visualDescription.substring(0, 50) + '...'
            : pair.visualDescription;

          // imageUrlがBase64データの場合は保存しない（Firestoreの制限を超えるため）
          // Storage URLに変換済みであることが期待される
          let imageUrl = pair.imageUrl || '';
          if (imageUrl.startsWith('data:image/')) {
            console.error(`[ConversationLogger] Scene ${index + 1}: Base64データが渡されました。Storage URLが期待されます。`);
            imageUrl = ''; // Base64データは保存しない
          }

          // 基本シーンデータ
          const scene: Omit<ConversationScene, 'createdAt'> = {
            sceneId: `scene_${index + 1}`,
            order: index + 1,
            script: pair.text,
            imagePromptUsed: pair.visualDescription,
            imageUrl,
            imageHint,
          };

          // オプショナルフィールドは値がある場合のみ追加
          if (pair.generatedAt) {
            scene.imageGeneratedAt = Timestamp.fromDate(new Date(pair.generatedAt));
          }

          if (pair.audioData) {
            scene.audioUrl = 'embedded'; // 実際はCloud Storageに保存
          }

          return scene;
        }
      );

      await addScenesBatch(childId, conversationId, scenes);
      console.log(`[ConversationLogger] Step 2: Saved ${scenes.length} scenes successfully`);
    } else {
      console.log('[ConversationLogger] Step 2: No scenes to save');
    }

    // 会話を完了状態に更新
    console.log('[ConversationLogger] Step 3: Completing conversation...');
    const duration = Math.floor((Date.now() - startTime) / 1000); // 秒単位
    await completeConversation(
      childId,
      conversationId,
      response.pairs?.length || 0,
      duration,
      response.agentPipeline // パイプラインメタデータを渡す
    );
    console.log('[ConversationLogger] Step 3: Conversation completed successfully');

    console.log(`[ConversationLogger] ✅ Successfully logged conversation: ${conversationId}`);
    return conversationId;

  } catch (error) {
    console.error('[ConversationLogger] ❌ Failed to log conversation:', error);
    if (error instanceof Error) {
      console.error('[ConversationLogger] Error message:', error.message);
      console.error('[ConversationLogger] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * 質問から好奇心タイプIDを推定（Vertex AI使用）
 *
 * 10タイプの好奇心分類に基づき、AIが質問の背後にある好奇心を分析する。
 * 返り値は curiosity-types.ts で定義された id（"01"〜"10"）。
 *
 * @param question - 子供の質問
 * @returns 好奇心タイプID（例: "01"）
 */
export async function estimateCuriosityType(question: string): Promise<string> {
  // 好奇心タイプの説明をAI用に整形
  const typeDescriptions = allCuriosityTypes.map(t => {
    return `ID: ${t.id}
名前: ${t.name}
概念: ${t.concept}
判定ルール: ${t.judgmentRule}
キーワード例: ${t.keywords.slice(0, 8).join('、')}`;
  }).join('\n\n');

  const prompt = `あなたは子供の好奇心を分析する専門家です。
子供の質問を分析し、その背後にある好奇心のタイプを10種類から1つ選んでください。

【好奇心タイプ一覧】
${typeDescriptions}

【重要な分析方針】
質問の「形式」ではなく、質問の「内容」と「目的」に注目してください。

1. 質問の核心的な目的を見極める
   - 自然科学・技術の知識を得たいのか？（博士）
   - 何かを作りたいのか？（発明家）
   - 効率的な方法を知りたいのか？（策士）
   - 美的表現に興味があるのか？（芸術家）
   - 物語や想像の世界に興味があるのか？（物語作家）
   - 面白さや笑いを求めているのか？（ユーモア作家）
   - 新しい場所や体験を求めているのか？（冒険家）
   - 協力やリーダーシップに興味があるのか？（リーダー）
   - 育てたり守ったりしたいのか？（飼育員）
   - 社会制度や哲学的な概念に興味があるのか？（哲学者）

2. 博士タイプと哲学者タイプの区別に注意
   - 博士タイプ：自然現象、科学、技術、生物、物理的な仕組み
   - 哲学者タイプ：社会制度、ルール、倫理、抽象的な概念、人間関係

3. 各タイプの「判定ルール」に質問内容が当てはまるかを確認する

4. 「なぜ」「どうして」という疑問詞があっても、それだけで博士タイプと判断しない
   例：「携帯ってどうやって作られてるの？」→ 製作過程への興味 → 発明家タイプの可能性
   例：「投票制度ってどうなってるの？」→ 社会の仕組みへの興味 → 哲学者タイプ

5. 質問の文脈から子供の本当の興味を読み取る

【子供の質問】
"${question}"

【回答形式】
以下のJSON形式で回答してください：
{
  "curiosityTypeId": "01",
  "reasoning": "この質問は〜という目的があり、〜という理由で〜タイプと判断しました"
}`;

  try {
    console.log('[estimateCuriosityType] Vertex AIで好奇心タイプを分析中...');
    
    const data = await callVertexAI(VERTEX_AI_CONFIG.models.text, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      console.warn('[estimateCuriosityType] AIからレスポンスなし。デフォルト値を返します。');
      return '01';
    }

    // JSONパース（マークダウンコードブロックを除去）
    const jsonString = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
    const parsed = JSON.parse(jsonString);

    const typeId = parsed.curiosityTypeId;
    const reasoning = parsed.reasoning || '分析完了';

    // IDの妥当性チェック
    if (typeId && allCuriosityTypes.some(t => t.id === typeId)) {
      console.log(`[estimateCuriosityType] 判定結果: ${typeId} (${reasoning})`);
      return typeId;
    }

    console.warn(`[estimateCuriosityType] 不明なタイプID: ${typeId}。デフォルト値を返します。`);
    return '01';

  } catch (error) {
    console.error('[estimateCuriosityType] AI分析に失敗しました:', error);
    console.log('[estimateCuriosityType] フォールバック: キーワードマッチングを使用');
    
    // フォールバック: キーワードマッチング
    return estimateCuriosityTypeByKeywords(question);
  }
}

/**
 * キーワードマッチングによる好奇心タイプ推定（フォールバック用）
 * 
 * @param question - 子供の質問
 * @returns 好奇心タイプID
 */
function estimateCuriosityTypeByKeywords(question: string): string {
  const scores: Record<string, number> = {};

  // 各タイプのキーワードマッチングスコアを計算
  for (const type of allCuriosityTypes) {
    let score = 0;
    for (const keyword of type.keywords) {
      if (question.includes(keyword)) {
        // キーワードの長さに応じて重み付け（長いキーワードほど特異性が高い）
        score += keyword.length;
      }
    }
    scores[type.id] = score;
  }

  const maxScore = Math.max(...Object.values(scores));

  if (maxScore > 0) {
    const best = Object.entries(scores).find(([, s]) => s === maxScore);
    if (best) {
      console.log(`[estimateCuriosityTypeByKeywords] 判定結果: ${best[0]} (スコア: ${maxScore})`);
      return best[0];
    }
  }

  // マッチしない場合は「博士タイプ」をデフォルトとする
  console.log('[estimateCuriosityTypeByKeywords] キーワードマッチなし。デフォルト値を返します。');
  return '01';
}

/**
 * 会話の統計情報を取得（将来の拡張用）
 */
export interface ConversationStats {
  totalConversations: number;
  averageScenes: number;
  topTopics: Array<{ topic: string; count: number }>;
  topExperts: Array<{ expertId: string; count: number }>;
}

/**
 * 会話統計を計算（プレースホルダー）
 */
export async function calculateConversationStats(
  childId: string
): Promise<ConversationStats> {
  // TODO: Firestoreから統計を集計
  return {
    totalConversations: 0,
    averageScenes: 0,
    topTopics: [],
    topExperts: [],
  };
}
