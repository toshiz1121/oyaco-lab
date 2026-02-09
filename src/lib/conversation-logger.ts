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

  // 会話IDを生成
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

    // 2. シーンを一括保存
    if (response.pairs && response.pairs.length > 0) {
      console.log(`[ConversationLogger] Step 2: Saving ${response.pairs.length} scenes...`);
      const scenes: Omit<ConversationScene, 'createdAt'>[] = response.pairs.map(
        (pair, index) => {
          // 画像ヒントを生成（プロンプトの最初の50文字）
          const imageHint = pair.visualDescription.length > 50
            ? pair.visualDescription.substring(0, 50) + '...'
            : pair.visualDescription;

          // imageUrlがBase64データの場合は保存しない（Firestoreの制限を超えるため）
          let imageUrl = pair.imageUrl || '';
          if (imageUrl.startsWith('data:image/')) {
            console.warn(`[ConversationLogger] Scene ${index + 1}: Base64画像データは保存できません。URLのみ保存します。`);
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
            scene.imageGeneratedAt = Timestamp.fromDate(pair.generatedAt);
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

    // 3. 会話を完了状態に更新
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
 * 質問から好奇心のタイプを推定
 * 
 * キーワードマッチングで簡易的に分類
 * 
 * @param question - 子供の質問
 * @returns 好奇心のタイプ
 */
export function estimateCuriosityType(question: string): string {
  const keywords: Record<string, string[]> = {
    '科学への好奇心': [
      'なぜ', 'どうして', '仕組み', '原理', '理由',
      '実験', '化学', '物理', '反応', 'エネルギー'
    ],
    '世界の仕組みへの好奇心': [
      '国', '社会', '政治', '経済', '文化',
      'ルール', '法律', 'お金', '仕事', '歴史'
    ],
    '自然への好奇心': [
      '動物', '植物', '天気', '宇宙', '地球',
      '星', '海', '山', '川', '森', '生き物'
    ],
    '人間への好奇心': [
      '人', '体', '心', '感情', '気持ち',
      '脳', '病気', '健康', '成長', '赤ちゃん'
    ],
    '技術への好奇心': [
      'コンピューター', 'ロボット', '機械', 'AI',
      'インターネット', 'スマホ', '電気', '発明'
    ],
    '芸術への好奇心': [
      '絵', '音楽', 'アート', '色', 'デザイン',
      '美しい', 'きれい', '作品', '表現'
    ],
  };

  // 各カテゴリーのマッチ数をカウント
  const scores: Record<string, number> = {};
  
  for (const [type, words] of Object.entries(keywords)) {
    scores[type] = words.filter(word => question.includes(word)).length;
  }

  // 最もスコアが高いカテゴリーを返す
  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore > 0) {
    const bestMatch = Object.entries(scores).find(([, score]) => score === maxScore);
    if (bestMatch) {
      return bestMatch[0];
    }
  }

  // マッチしない場合はデフォルト
  return 'その他の好奇心';
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
