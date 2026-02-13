'use server';

/**
 * 会話ログ記録 Server Actions
 * 
 * クライアントコンポーネントから呼び出される会話ログ機能
 */

import { logConversationServer, estimateCuriosityTypeServer } from '@/lib/conversation-logger-server';
import type { AgentResponse, AgentRole } from '@/lib/agents/types';

/**
 * 会話をFirestoreに記録（Server Action）
 */
export async function logConversationAction(params: {
  childId: string;
  question: string;
  curiosityType: string;
  selectedExpert: AgentRole;
  selectionReason?: string;
  response: AgentResponse;
  conversationId?: string;
}): Promise<string> {
  return await logConversationServer(params);
}

/**
 * 質問から好奇心タイプを推定（Server Action）
 */
export async function estimateCuriosityTypeAction(question: string): Promise<string> {
  return await estimateCuriosityTypeServer(question);
}
