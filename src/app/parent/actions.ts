'use server';

import { callVertexAI, VERTEX_AI_CONFIG } from '@/lib/vertexai';
import {
  getChildProfileServer as getChildProfile,
  getRecentConversationsServer as getRecentConversations,
} from '@/lib/firebase/firestore-server';
import { runParentAgent } from '@/lib/agents/parent-agent';
import type { ParentAgentResult } from '@/lib/agents/parent-agent/types';
import { getCuriosityTypeById } from '@/lib/curiosity-types';
import type { ConversationMetadata } from '@/lib/firebase/types';

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
    const conversations = await getRecentConversations(childId, 20);

    if (!profile) {
      return { suggestions: [], cached: false, error: '子供のプロフィールが見つかりません' };
    }

    // ── 会話データからリッチなコンテキストを構築 ──
    const completedConversations = conversations.filter(
      (c: ConversationMetadata) => c.status === 'completed'
    );

    // 好奇心タイプの分布を集計
    const curiosityDistribution = new Map<string, number>();
    for (const c of completedConversations) {
      if (c.curiosityType) {
        const typeName = getCuriosityTypeById(c.curiosityType)?.name || c.curiosityType;
        curiosityDistribution.set(typeName, (curiosityDistribution.get(typeName) || 0) + 1);
      }
    }
    const topCuriosityTypes = [...curiosityDistribution.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name}(${count}回)`)
      .join('、');

    // よく選ばれる博士
    const expertDistribution = new Map<string, number>();
    for (const c of completedConversations) {
      if (c.selectedExpert) {
        expertDistribution.set(c.selectedExpert, (expertDistribution.get(c.selectedExpert) || 0) + 1);
      }
    }
    const topExperts = [...expertDistribution.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name)
      .join('、');

    // 直近の質問（重複回避用）
    const recentQuestions = completedConversations
      .slice(0, 8)
      .map((c: ConversationMetadata) => {
        const typeName = c.curiosityType ? getCuriosityTypeById(c.curiosityType)?.name : '';
        return `- 「${c.question}」（${typeName || '不明'}）`;
      })
      .join('\n');

    // 学習プロフィール情報
    const lp = profile.learningProfile;
    const learningContext = lp
      ? `好奇心レベル: ${lp.curiosityLevel === 'high' ? '高い' : lp.curiosityLevel === 'medium' ? '普通' : '控えめ'}、好みのスタイル: ${lp.preferredStyle === 'visual' ? '視覚的' : lp.preferredStyle === 'text' ? 'テキスト' : 'ミックス'}、平均集中時間: 約${Math.round(lp.attentionSpan / 60)}分`
      : '';

    // 年齢に応じたガイドライン
    const age = profile.age || 6;
    let ageGuideline: string;
    if (age <= 4) {
      ageGuideline = '3〜4歳: 五感を使った体験ベースの質問。「見て」「触って」「聞いて」など感覚に訴える。短く具体的に。抽象的な概念は避ける。';
    } else if (age <= 6) {
      ageGuideline = '5〜6歳: 「なぜ？」「どうして？」の因果関係に興味が出る時期。身近な不思議を一緒に考える質問。簡単な比較や分類も可能。';
    } else if (age <= 8) {
      ageGuideline = '7〜8歳: 論理的思考が芽生える時期。仮説を立てて考える質問が有効。「もし〜だったら？」「〜と〜の違いは？」など。';
    } else if (age <= 10) {
      ageGuideline = '9〜10歳: 社会や世界への関心が広がる時期。ニュースや社会の仕組みに関連づけた質問。自分の意見を求める問いかけも有効。';
    } else {
      ageGuideline = '11〜12歳: 抽象的・哲学的な思考が可能。多角的な視点を促す質問。「賛成？反対？その理由は？」など議論を促す問いかけ。';
    }

    // ── システムプロンプト ──
    const systemInstruction = `あなたは幼児教育と親子コミュニケーションの専門家です。
子供の好奇心データを分析し、親が日常の中で自然に使える「会話のきっかけ」を提案します。

## あなたの専門性
- 子供の発達段階に応じた適切な問いかけの設計
- 好奇心タイプ（探求・論理、感性・創造、社会・情緒）に基づく話題選び
- 親が無理なく実践できる、具体的で自然な会話フレーズの作成

## 出力品質基準
1. questionは「親が実際に声に出して子供に言うセリフ」として自然であること。教科書的・説教的にならない
2. situationは具体的な日常シーン（「夕食時に」ではなく「カレーを食べながら」のように具体的に）
3. topicは子供のデータに基づいた根拠のある話題であること
4. 3つの提案はそれぞれ異なるシチュエーション・異なる好奇心の方向性をカバーすること
5. 最近の質問と内容が被らないこと`;

    // ── ユーザープロンプト ──
    const userPrompt = `以下の子供のデータを分析し、親への会話きっかけを3つ提案してください。

## 子供のプロフィール
- 名前: ${profile.name}
- 年齢: ${age}歳${profile.grade ? `（${profile.grade}）` : ''}
- 興味のあるトピック: ${profile.stats?.favoriteTopics?.slice(0, 5).join('、') || '未集計'}
- お気に入りの博士: ${profile.stats?.favoriteExperts?.slice(0, 3).join('、') || '未集計'}
- これまでの会話数: ${profile.stats?.totalConversations || 0}回
${learningContext ? `- 学習傾向: ${learningContext}` : ''}

## 好奇心タイプの傾向
${topCuriosityTypes || 'データ不足（まだ会話が少ない）'}
${topExperts ? `よく選ばれる博士: ${topExperts}` : ''}

## 最近の質問履歴（重複を避けてください）
${recentQuestions || 'まだ質問履歴がありません'}

## この年齢の発達ガイドライン
${ageGuideline}

## 出力形式
以下のJSON配列のみを出力してください。説明文やマークダウンは不要です。

[
  {
    "emoji": "（話題に合った絵文字1つ）",
    "situation": "（具体的な日常シーン。例: 『お風呂でシャンプーしながら』『公園の帰り道に』）",
    "topic": "（この子の興味・好奇心タイプに基づいた話題。なぜこの話題かの根拠を意識）",
    "question": "（親が子供に実際に語りかけるセリフ。自然な口語体で、子供の好奇心を刺激する問いかけ）"
  }
]

## 重要な注意
- questionは必ず親目線の語りかけ（「〜って知ってる？」「〜はどう思う？」「〜を一緒に見てみない？」など）
- 子供の好奇心タイプの傾向を活かしつつ、まだ触れていない方向性も1つ混ぜて視野を広げる
- 具体的な固有名詞や身近な例を使って、抽象的にならないようにする`;

    console.log('[generateSuggestionInternal] Vertex AIを呼び出し中...');
    
    const response = await callVertexAI(
      VERTEX_AI_CONFIG.models.text,
      {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topP: 0.9,
          topK: 30,
          responseMimeType: 'application/json',
        },
      },
      undefined,
      { systemInstruction }
    );

    // レスポンス全体をログ出力（デバッグ用）
    console.log('[generateSuggestionInternal] レスポンス:', JSON.stringify({
      candidates: response?.candidates?.length,
      promptFeedback: response?.promptFeedback,
      usageMetadata: response?.usageMetadata,
    }, null, 2));

    // 安全フィルターやブロックをチェック
    if (response?.promptFeedback?.blockReason) {
      console.error('[generateSuggestionInternal] プロンプトがブロックされました:', response.promptFeedback.blockReason);
      return { suggestions: [], cached: false, error: 'プロンプトがブロックされました' };
    }

    const candidate = response?.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('[generateSuggestionInternal] 異常な終了理由:', candidate.finishReason);
    }

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    console.log('[generateSuggestionInternal] レスポンス長:', text.length);

    if (!text) {
      console.error('[generateSuggestionInternal] AIからの空のレスポンス');
      return { suggestions: [], cached: false, error: '提案の生成に失敗しました' };
    }

    // JSON パース
    let suggestions: ConversationSuggestion[] = [];
    try {
      let jsonString = text.trim();
      // マークダウンのコードブロックを念のため削除
      jsonString = jsonString.replace(/^```json\s*\n?/i, '').replace(/^```\s*\n?/, '');
      jsonString = jsonString.replace(/\n?```\s*$/, '');
      jsonString = jsonString.trim();
      
      const parsed = JSON.parse(jsonString);
      suggestions = Array.isArray(parsed) ? parsed : [];
      
      // バリデーション: 必須フィールドの存在チェック
      suggestions = suggestions.filter(
        (s) => s.emoji && s.situation && s.topic && s.question
      );
      
      console.log('[generateSuggestionInternal] パース成功:', suggestions.length, '個の提案');
    } catch (parseError) {
      console.error('[generateSuggestionInternal] JSONパース失敗:', parseError);
      console.error('[generateSuggestionInternal] 生テキスト:', text.substring(0, 300));
      return { suggestions: [], cached: false, error: '提案の解析に失敗しました' };
    }

    if (suggestions.length === 0) {
      return { suggestions: [], cached: false, error: '提案の生成に失敗しました' };
    }

    // キャッシュに保存
    suggestionCache.set(childId, { suggestions, timestamp: Date.now() });
    console.log(`[generateSuggestionInternal] ${childId}に対して${suggestions.length}個の提案を生成`);

    return { suggestions, cached: false };
  } catch (error) {
    console.error('[generateSuggestionInternal] 失敗:', error);
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
