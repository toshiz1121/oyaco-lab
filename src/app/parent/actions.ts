'use server';

import { callVertexAI, VERTEX_AI_CONFIG } from '@/lib/vertexai';
import {
  getChildProfileServer as getChildProfile,
  getRecentConversationsServer as getRecentConversations,
} from '@/lib/firebase/firestore-server';
import { runParentAgent } from '@/lib/agents/parent-agent';
import type { ParentAgentResult } from '@/lib/agents/parent-agent';

// ========================================
// 会話きっかけ提案
// ========================================

/** 会話きっかけ提案の1つ */
export interface ConversationSuggestion {
  emoji: string;
  situation: string;  // シチュエーション（例: 「夕食の時に」）
  topic: string;      // 話題（例: 「宇宙の話」）
  question: string;   // 具体的な質問例
}

/** 提案結果（3つの提案 + キャッシュ情報） */
export interface SuggestionResult {
  suggestions: ConversationSuggestion[];
  cached: boolean;  // キャッシュから取得したか
  error?: string;
}

// キャッシュ（メモリ内、サーバー再起動でクリア）
const suggestionCache = new Map<string, { suggestions: ConversationSuggestion[]; timestamp: number }>();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10分

/**
 * AIが子供の会話ログを分析し、親への会話きっかけを3つ提案する
 * 
 * @param childId 子供のID
 * @param forceRefresh キャッシュを無視して再生成するか
 */
export async function generateConversationSuggestion(
  childId: string,
  forceRefresh: boolean = false
): Promise<SuggestionResult> {
  try {
    // キャッシュチェック（forceRefresh が false の場合のみ）
    if (!forceRefresh) {
      const cached = suggestionCache.get(childId);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        console.log(`[generateConversationSuggestion] Using cached suggestions for ${childId}`);
        return { suggestions: cached.suggestions, cached: true };
      }
    }

    // 子供のプロフィールと最近の会話を取得
    const [profile, conversations] = await Promise.all([
      getChildProfile(childId),
      getRecentConversations(childId, 10),
    ]);

    if (!profile) {
      return { suggestions: [], cached: false, error: '子供のプロフィールが見つかりません' };
    }

    const recentQuestions = conversations
      .filter((c) => c.status === 'completed')
      .map((c) => `- 「${c.question}」（${c.selectedExpert}）`)
      .join('\n');

    const prompt = `子供との会話きっかけを3つ提案してください。

子供: ${profile.name}（${profile.age}歳）
興味: ${profile.stats.favoriteTopics.slice(0, 3).join('、') || '不明'}

最近の質問:
${recentQuestions || 'なし'}

JSON形式で回答（例を参考に）:
[
  {"emoji":"🍽️","situation":"夕食時","topic":"月の話","question":"今日月見た？"},
  {"emoji":"🛁","situation":"お風呂","topic":"水","question":"お湯はなぜ温かい？"},
  {"emoji":"🌙","situation":"寝る前","topic":"夢","question":"どんな夢見た？"}
]`;

    const response = await callVertexAI(VERTEX_AI_CONFIG.models.text, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!text) {
      return { suggestions: [], cached: false, error: '提案の生成に失敗しました' };
    }

    // JSON パース（エラーハンドリング強化）
    let suggestions: ConversationSuggestion[] = [];
    try {
      const jsonString = text.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '');
      const parsed = JSON.parse(jsonString);
      suggestions = Array.isArray(parsed) ? parsed : [];
    } catch (parseError) {
      console.error('[generateConversationSuggestion] JSON parse failed:', parseError);
      console.error('[generateConversationSuggestion] Raw text:', text);
      
      // フォールバック: デフォルトの提案を返す
      suggestions = [
        {
          emoji: '🍽️',
          situation: '夕食時',
          topic: `${profile.name}さんの興味`,
          question: `「今日は何が楽しかった？」と聞いてみましょう`,
        },
        {
          emoji: '🛁',
          situation: 'お風呂で',
          topic: '今日の出来事',
          question: `「お風呂で一番好きなことは何？」`,
        },
        {
          emoji: '🌙',
          situation: '寝る前に',
          topic: '明日の楽しみ',
          question: `「明日は何をしたい？」`,
        },
      ];
    }

    if (suggestions.length === 0) {
      return { suggestions: [], cached: false, error: '提案の生成に失敗しました' };
    }

    // キャッシュに保存
    suggestionCache.set(childId, { suggestions, timestamp: Date.now() });
    console.log(`[generateConversationSuggestion] Generated ${suggestions.length} suggestions for ${childId}`);

    return { suggestions, cached: false };
  } catch (error) {
    console.error('[generateConversationSuggestion] Failed:', error);
    return {
      suggestions: [],
      cached: false,
      error: '提案の生成中にエラーが発生しました',
    };
  }
}


// ========================================
// 親エージェント（子育てアドバイザー）
// ========================================

/** エージェント実行結果の Server Action 用ラッパー */
export interface AgentActionResult {
  success: boolean;
  data?: ParentAgentResult;
  error?: string;
}

/**
 * 親エージェントを実行する Server Action
 *
 * 親からの自由な質問を受け取り、エージェントが自律的に
 * ツールを選択・実行して分析結果を返す。
 *
 * @param childId 対象の子供ID
 * @param query 親からの質問（例: 「最近うちの子はどんなことに興味がある？」）
 */
export async function askParentAgent(
  childId: string,
  query: string
): Promise<AgentActionResult> {
  try {
    // 子供のプロフィールを取得（エージェントのコンテキストに必要）
    const profile = await getChildProfile(childId);
    if (!profile) {
      return { success: false, error: '子供のプロフィールが見つかりません' };
    }

    console.log(`[askParentAgent] Running agent for child: ${profile.name}, query: "${query}"`);

    const result = await runParentAgent({
      childId,
      query,
      childName: profile.name,
      childAge: profile.age,
    });

    console.log(
      `[askParentAgent] Completed in ${result.processingTimeMs}ms, tools used: ${result.toolsUsed.join(', ')}`
    );

    return { success: true, data: result };
  } catch (error) {
    console.error('[askParentAgent] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'エージェントの実行に失敗しました',
    };
  }
}
