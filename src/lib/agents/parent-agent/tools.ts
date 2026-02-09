/**
 * 親エージェントのツール群
 *
 * エージェントが自律的に呼び出す分析ツールを定義する。
 * 各ツールは単一責任で、Firestoreからデータを取得し、分析結果を返す。
 */

import {
  getRecentConversationsServer as getRecentConversations,
  getConversationsByDateRangeServer as getConversationsByDateRange,
} from '@/lib/firebase/firestore-server';
import { agents } from '@/lib/agents/definitions';
import type { AgentRole } from '@/lib/agents/types';
import type {
  ConversationAnalysis,
  LearningProgressAnalysis,
  KnowledgeGapAnalysis,
  TopicCount,
  ExpertCount,
  UnexploredArea,
} from './types';
import type { ConversationMetadata } from '@/lib/firebase/types';

// ========================================
// 全分野の定義（知識ギャップ分析用）
// ========================================

/** 子供が探索可能な全分野 */
const ALL_TOPIC_AREAS = [
  { area: '科学・しくみ', expert: 'scientist' as AgentRole, sampleQuestion: '虹はどうしてできるの？' },
  { area: '生き物・自然', expert: 'biologist' as AgentRole, sampleQuestion: 'どうして鳥は空を飛べるの？' },
  { area: '宇宙・地球', expert: 'astronomer' as AgentRole, sampleQuestion: '星はなぜ夜しか見えないの？' },
  { area: '歴史・文化', expert: 'historian' as AgentRole, sampleQuestion: '昔の人はどうやってご飯を作ってたの？' },
  { area: '芸術・気持ち', expert: 'artist' as AgentRole, sampleQuestion: 'どうして絵を描くと楽しいの？' },
  { area: 'テクノロジー', expert: 'engineer' as AgentRole, sampleQuestion: 'ゲームはどうやって動いているの？' },
  { area: 'からだ・健康', expert: 'educator' as AgentRole, sampleQuestion: 'どうしてお腹がすくの？' },
];

// ========================================
// ツール1: 会話履歴分析
// ========================================

/**
 * 指定期間の会話履歴を分析し、トピック・博士の分布を返す
 */
export async function analyzeConversationHistory(
  childId: string,
  periodDays: number
): Promise<ConversationAnalysis> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const conversations = await getConversationsByDateRange(childId, startDate, endDate);
  const completed = conversations.filter(c => c.status === 'completed');

  const topicDistribution = buildTopicDistribution(completed);
  const expertDistribution = buildExpertDistribution(completed);
  const recentQuestions = completed.slice(0, 10).map(c => c.question);

  return {
    totalConversations: completed.length,
    periodDays,
    topicDistribution,
    expertDistribution,
    averageQuestionsPerDay: periodDays > 0
      ? Math.round((completed.length / periodDays) * 10) / 10
      : 0,
    recentQuestions,
  };
}

// ========================================
// ツール2: 学習進捗分析
// ========================================

/**
 * 今週と先週を比較し、学習の傾向・継続性を分析する
 */
export async function analyzeLearningProgress(
  childId: string
): Promise<LearningProgressAnalysis> {
  const now = new Date();

  // 今週（直近7日）
  const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekConvs = await getConversationsByDateRange(childId, thisWeekStart, now);
  console.log(`[analyzeLearningProgress] 今週の会話数: ${thisWeekConvs.length}`);
  console.log(`[analyzeLearningProgress] 今週の会話:`, JSON.stringify(thisWeekConvs.map(c => ({
    id: c.conversationId,
    question: c.question.substring(0, 30),
    status: c.status,
    createdAt: c.createdAt?.toDate?.()?.toISOString()
  })), null, 2));
  const thisWeekCompleted = thisWeekConvs.filter(c => c.status === 'completed');

  // 先週（8〜14日前）
  const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekConvs = await getConversationsByDateRange(childId, lastWeekStart, lastWeekEnd);
  console.log(`[analyzeLearningProgress] 先週の会話数: ${lastWeekConvs.length}`);
  const lastWeekCompleted = lastWeekConvs.filter(c => c.status === 'completed');

  // トレンド判定
  const trend = determineTrend(thisWeekCompleted.length, lastWeekCompleted.length);

  // 先週にはなかった新しいトピック
  const lastWeekTopics = new Set(lastWeekCompleted.map(c => c.curiosityType));
  const newTopicsExplored = thisWeekCompleted
    .map(c => c.curiosityType)
    .filter(t => !lastWeekTopics.has(t))
    .filter((t, i, arr) => arr.indexOf(t) === i); // 重複除去

  // 継続性スコア: 直近7日のうち何日使ったか
  const activeDays = countActiveDays(thisWeekCompleted);
  const consistencyScore = Math.round((activeDays / 7) * 100);

  // 連続利用日数（直近14日から計算）
  const allRecent = [...thisWeekCompleted, ...lastWeekCompleted];
  const longestStreak = calculateLongestStreak(allRecent);

  return {
    thisWeekCount: thisWeekCompleted.length,
    lastWeekCount: lastWeekCompleted.length,
    trend,
    newTopicsExplored,
    consistencyScore,
    longestStreak,
  };
}

// ========================================
// ツール3: 知識ギャップ分析
// ========================================

/**
 * 子供がまだ触れていない分野を特定し、探索を提案する
 */
export async function identifyKnowledgeGaps(
  childId: string
): Promise<KnowledgeGapAnalysis> {
  // 直近30日の会話から探索済み分野を特定
  const conversations = await getRecentConversations(childId, 50);
  const completed = conversations.filter(c => c.status === 'completed');

  const exploredExperts = new Set(completed.map(c => c.selectedExpert));
  const exploredTopics = [...new Set(completed.map(c => c.curiosityType))];

  // 未探索の分野を特定
  const unexploredAreas: UnexploredArea[] = ALL_TOPIC_AREAS
    .filter(area => !exploredExperts.has(area.expert))
    .map(area => ({
      area: area.area,
      suggestedExpert: area.expert,
      suggestedQuestion: area.sampleQuestion,
    }));

  // 推奨メッセージを生成
  const recommendations = unexploredAreas.slice(0, 3).map(area => {
    const expert = agents[area.suggestedExpert];
    return `${expert.nameJa}に「${area.suggestedQuestion}」と聞いてみましょう`;
  });

  return {
    exploredTopics,
    unexploredAreas,
    recommendations,
  };
}

// ========================================
// ヘルパー関数
// ========================================

/** トピック別の分布を集計する */
function buildTopicDistribution(conversations: ConversationMetadata[]): TopicCount[] {
  const counts = new Map<string, number>();
  for (const c of conversations) {
    const topic = c.curiosityType || '不明';
    counts.set(topic, (counts.get(topic) || 0) + 1);
  }

  const total = conversations.length || 1;
  return [...counts.entries()]
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/** 博士別の分布を集計する */
function buildExpertDistribution(conversations: ConversationMetadata[]): ExpertCount[] {
  const counts = new Map<string, number>();
  for (const c of conversations) {
    const expert = c.selectedExpert || 'unknown';
    counts.set(expert, (counts.get(expert) || 0) + 1);
  }

  const total = conversations.length || 1;
  return [...counts.entries()]
    .map(([expertId, count]) => ({
      expertId: expertId as AgentRole,
      expertName: agents[expertId as AgentRole]?.nameJa || expertId,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/** 今週 vs 先週のトレンドを判定する */
function determineTrend(
  thisWeek: number,
  lastWeek: number
): 'increasing' | 'stable' | 'decreasing' {
  if (lastWeek === 0) return thisWeek > 0 ? 'increasing' : 'stable';
  const ratio = thisWeek / lastWeek;
  if (ratio >= 1.2) return 'increasing';
  if (ratio <= 0.8) return 'decreasing';
  return 'stable';
}

/** 直近7日間のうちアクティブだった日数を数える */
function countActiveDays(conversations: ConversationMetadata[]): number {
  const days = new Set<string>();
  for (const c of conversations) {
    const date = c.createdAt?.toDate?.();
    if (date) {
      days.add(date.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
  }
  return days.size;
}

/** 連続利用日数の最長を計算する */
function calculateLongestStreak(conversations: ConversationMetadata[]): number {
  const days = new Set<string>();
  for (const c of conversations) {
    const date = c.createdAt?.toDate?.();
    if (date) {
      days.add(date.toISOString().slice(0, 10));
    }
  }

  if (days.size === 0) return 0;

  // 日付をソートして連続日数を計算
  const sorted = [...days].sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffMs = curr.getTime() - prev.getTime();

    if (diffMs === 24 * 60 * 60 * 1000) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}
