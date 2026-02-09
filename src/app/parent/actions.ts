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
 * フォールバック提案を生成（AI生成が失敗した場合）
 */
function getFallbackSuggestions(profile: any): ConversationSuggestion[] {
  return [
    {
      emoji: '🍽️',
      situation: '夕食時に',
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
        console.log(`[generateConversationSuggestion] ${childId}のキャッシュされた提案を使用します`);
        return { suggestions: cached.suggestions, cached: true };
      }
    }

    // プロフィールを取得
    const profile = await getChildProfile(childId);
    if (!profile) {
      return { suggestions: [], cached: false, error: '子供のプロフィールが見つかりません' };
    }

    // リトライロジック付きで提案を生成
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[generateConversationSuggestion] リトライ試行 ${attempt}/${MAX_RETRIES}`);
          // リトライ前に待機（指数バックオフ）
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const result = await generateSuggestionInternal(childId, profile);
        
        // キャッシュが一定貯まった場合は削除
        if(suggestionCache.size > 50) {
          const keysToDelete = suggestionCache.keys();
          for(let i = 0; i < 10; i++) {
            const {value, done} = keysToDelete.next();
            if(done) break;  
            suggestionCache.delete(value);
          }
        }

        if (result.suggestions.length > 0) {
          // 成功: キャッシュに保存して返す
          suggestionCache.set(childId, { 
            suggestions: result.suggestions, 
            timestamp: Date.now() 
          });
          console.log(`[generateConversationSuggestion] ${result.suggestions.length}個の提案を生成しました`);
          return { suggestions: result.suggestions, cached: false };
        }
        
        // 提案が0件の場合
        console.warn(`[generateConversationSuggestion] 提案が0件でした（試行 ${attempt + 1}）`);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[generateConversationSuggestion] 試行 ${attempt + 1} が失敗:`, lastError.message);
      }
    }
    
    // すべてのリトライが失敗した場合、フォールバック提案を返す
    console.warn('[generateConversationSuggestion] すべてのリトライが失敗、フォールバック提案を使用');
    const fallbackSuggestions = getFallbackSuggestions(profile);
    return { suggestions: fallbackSuggestions, cached: false };
    
  } catch (error) {
    console.error('[generateConversationSuggestion] 予期しないエラー:', error);
    return {
      suggestions: [],
      cached: false,
      error: '提案の生成中にエラーが発生しました',
    };
  }
}

/**
 * 提案生成の内部実装（リトライロジックから分離）
 */
async function generateSuggestionInternal(
  childId: string,
  profileOverride?: any
): Promise<SuggestionResult> {
  try {

    // 子供のプロフィールと最近の会話を取得
    const profile = profileOverride || await getChildProfile(childId);
    const conversations = await getRecentConversations(childId, 10);

    if (!profile) {
      return { suggestions: [], cached: false, error: '子供のプロフィールが見つかりません' };
    }

    const recentQuestions = conversations
      .filter((c) => c.status === 'completed')
      .slice(0, 5)  // 最新5件に制限
      .map((c) => `- ${c.question}`)
      .join('\n');

    const prompt = `子供との会話きっかけを3つ提案してください。

【子供】
名前: ${profile.name}（${profile.age}歳）
興味: ${profile.stats.favoriteTopics.slice(0, 3).join('、') || '不明'}

【最近の質問】
${recentQuestions || 'なし'}

【指示】
以下のJSON配列形式で出力してください。他のテキストは含めないでください。

[
  {"emoji":"🍽️","situation":"夕食時に","topic":"食べ物","question":"今日のご飯で一番おいしかったのは？"},
  {"emoji":"🛁","situation":"お風呂で","topic":"水","question":"お風呂のお湯はどこから来るの？"},
  {"emoji":"🌙","situation":"寝る前に","topic":"今日","question":"今日一番楽しかったことは？"}
]`;

    console.log('[generateConversationSuggestion] Vertex AIを呼び出し中...');
    
    const response = await callVertexAI(VERTEX_AI_CONFIG.models.text, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,  // 1024 → 2048に増加
        topP: 0.95,
        topK: 40,
      },
    });

    // レスポンス全体をログ出力（デバッグ用）
    console.log('[generateConversationSuggestion] 完全なレスポンス:', JSON.stringify({
      candidates: response?.candidates?.length,
      promptFeedback: response?.promptFeedback,
      usageMetadata: response?.usageMetadata,
    }, null, 2));

    // 安全フィルターやブロックをチェック
    if (response?.promptFeedback?.blockReason) {
      console.error('[generateConversationSuggestion] プロンプトがブロックされました:', response.promptFeedback.blockReason);
      return { suggestions: [], cached: false, error: 'プロンプトがブロックされました' };
    }

    const candidate = response?.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('[generateConversationSuggestion] 異常な終了理由:', candidate.finishReason);
    }

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    console.log('[generateConversationSuggestion] レスポンスを受信しました。長さ:', text.length);
    console.log('[generateConversationSuggestion] 最初の200文字:', text.substring(0, 200));

    if (!text) {
      console.error('[generateConversationSuggestion] AIからの空のレスポンス');
      return { suggestions: [], cached: false, error: '提案の生成に失敗しました' };
    }

    // JSON パース（エラーハンドリング強化）
    let suggestions: ConversationSuggestion[] = [];
    try {
      // マークダウンのコードブロックを削除
      let jsonString = text.trim();
      
      // ```json ... ``` または ``` ... ``` を削除
      jsonString = jsonString.replace(/^```json\s*\n?/i, '').replace(/^```\s*\n?/, '');
      jsonString = jsonString.replace(/\n?```\s*$/, '');
      jsonString = jsonString.trim();
      
      console.log('[generateConversationSuggestion] クリーンアップされたJSON文字列:', jsonString.substring(0, 200));
      
      const parsed = JSON.parse(jsonString);
      suggestions = Array.isArray(parsed) ? parsed : [];
      
      console.log('[generateConversationSuggestion] 正常にパースされました。', suggestions.length, '個の提案');
    } catch (parseError) {
      console.error('[generateConversationSuggestion] JSONパースに失敗しました:', parseError);
      console.error('[generateConversationSuggestion] 生のテキスト:', text);
      console.error('[generateConversationSuggestion] テキスト長:', text.length);
      
      // 応答が途中で切れている可能性をチェック
      if (text.length < 50 || !text.includes('}')) {
        console.error('[generateConversationSuggestion] レスポンスが途中で切れているようです');
      }
      
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
    console.log(`[generateConversationSuggestion] ${childId}に対して${suggestions.length}個の提案を生成しました`);

    return { suggestions, cached: false };
  } catch (error) {
    console.error('[generateSuggestionInternal] 失敗しました:', error);
    throw error; // リトライロジックに任せる
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

    console.log(`[askParentAgent] 子供のエージェントを実行中: ${profile.name}, 質問: "${query}"`);

    const result = await runParentAgent({
      childId,
      query,
      childName: profile.name,
      childAge: profile.age,
    });

    console.log(
      `[askParentAgent] ${result.processingTimeMs}msで完了しました。使用したツール: ${result.toolsUsed.join(', ')}`
    );

    return { success: true, data: result };
  } catch (error) {
    console.error('[askParentAgent] 失敗しました:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'エージェントの実行に失敗しました',
    };
  }
}
