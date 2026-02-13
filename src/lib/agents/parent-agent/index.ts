/**
 * 親エージェント（子育てアドバイザー）のエントリーポイント
 */

// サーバーサイド専用の実装（クライアントでインポートしない）
export { runParentAgent } from './core';

// 型定義のみエクスポート（クライアントで安全にインポート可能）
export type {
  ParentAgentRequest,
  ParentAgentResult,
  ParentToolName,
  AgentStep,
  WeeklyReport,
  ConversationAnalysis,
  LearningProgressAnalysis,
  KnowledgeGapAnalysis,
  TopicCount,
  ExpertCount,
  UnexploredArea,
} from './types';
