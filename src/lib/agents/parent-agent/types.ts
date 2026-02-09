/**
 * 親エージェント（子育てアドバイザー）の型定義
 *
 * 子供の学習データを自律的に分析し、親に洞察を提供する
 * AIエージェントのためのインターフェース群
 */

import type { AgentRole } from '../types';

// ========================================
// ツール定義
// ========================================

/** エージェントが利用可能なツール名 */
export type ParentToolName =
  | 'analyzeConversationHistory'
  | 'analyzeLearningProgress'
  | 'identifyKnowledgeGaps'
  | 'generateConversationStarter'
  | 'generateWeeklyReport';

/** ツール呼び出しの引数（ツールごとに異なる） */
export interface ToolArguments {
  analyzeConversationHistory: {
    childId: string;
    periodDays: number; // 分析対象の日数
  };
  analyzeLearningProgress: {
    childId: string;
  };
  identifyKnowledgeGaps: {
    childId: string;
  };
  generateConversationStarter: {
    childId: string;
    context: string; // 分析結果を踏まえたコンテキスト
  };
  generateWeeklyReport: {
    childId: string;
  };
}

// ========================================
// ツール実行結果
// ========================================

/** 会話履歴分析の結果 */
export interface ConversationAnalysis {
  totalConversations: number;
  periodDays: number;
  topicDistribution: TopicCount[];
  expertDistribution: ExpertCount[];
  averageQuestionsPerDay: number;
  recentQuestions: string[];
}

export interface TopicCount {
  topic: string;
  count: number;
  percentage: number;
}

export interface ExpertCount {
  expertId: AgentRole;
  expertName: string;
  count: number;
  percentage: number;
}

/** 学習進捗分析の結果 */
export interface LearningProgressAnalysis {
  thisWeekCount: number;
  lastWeekCount: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  newTopicsExplored: string[];
  consistencyScore: number; // 0-100: 毎日コンスタントに使っているか
  longestStreak: number;    // 連続利用日数
}

/** 知識ギャップ分析の結果 */
export interface KnowledgeGapAnalysis {
  exploredTopics: string[];
  unexploredAreas: UnexploredArea[];
  recommendations: string[];
}

export interface UnexploredArea {
  area: string;
  suggestedExpert: AgentRole;
  suggestedQuestion: string;
}

// ========================================
// エージェントループ
// ========================================

/** エージェントの1ステップ（思考 or ツール呼び出し or 最終回答） */
export type AgentStep =
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; toolName: ParentToolName; args: Record<string, unknown>; result: string }
  | { type: 'final_answer'; content: string };

/** エージェント実行の結果 */
export interface ParentAgentResult {
  answer: string;           // 親への最終回答
  steps: AgentStep[];       // 思考過程（デバッグ・透明性のため）
  toolsUsed: ParentToolName[];
  processingTimeMs: number;
}

/** エージェントへのリクエスト */
export interface ParentAgentRequest {
  childId: string;
  query: string;            // 親からの質問 or 自動トリガーの種類
  childName: string;
  childAge: number;
}

// ========================================
// 週次レポート
// ========================================

export interface WeeklyReport {
  childId: string;
  childName: string;
  periodStart: Date;
  periodEnd: Date;
  summary: string;              // エージェントが生成した自然言語サマリー
  highlights: string[];         // 今週のハイライト（3つ程度）
  conversationAnalysis: ConversationAnalysis;
  learningProgress: LearningProgressAnalysis;
  knowledgeGaps: KnowledgeGapAnalysis;
  suggestedConversations: string[]; // 来週のおすすめ話題
  generatedAt: Date;
}
