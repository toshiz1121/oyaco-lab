/**
 * 会話ログ記録カスタムフック
 * 
 * Reactコンポーネントから会話ログ機能を使用するためのフック
 */

import { useState } from 'react';
import { logConversation, estimateCuriosityType } from '@/lib/conversation-logger';
import { AgentResponse, AgentRole } from '@/lib/agents/types';

/**
 * 会話ログ記録フック
 * 
 * @param childId - 子供のID
 * @returns ログ記録関数と状態
 */
export function useConversationLogger(childId: string) {
  const [isLogging, setIsLogging] = useState(false);
  const [lastLoggedId, setLastLoggedId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 現在の会話をFirestoreに記録
   * 
   * @param question - 子供の質問
   * @param selectedExpert - 選ばれた博士
   * @param selectionReason - 選定理由
   * @param response - AIの回答データ
   */
  const logCurrentConversation = async (
    question: string,
    selectedExpert: AgentRole,
    selectionReason: string | undefined,
    response: AgentResponse
  ): Promise<string | null> => {
    setIsLogging(true);
    setError(null);

    try {
      // 好奇心のタイプを推定
      const curiosityType = estimateCuriosityType(question);
      
      console.log(`[useConversationLogger] Logging conversation...`);
      console.log(`  - Question: ${question.substring(0, 50)}...`);
      console.log(`  - Expert: ${selectedExpert}`);
      console.log(`  - Curiosity Type: ${curiosityType}`);
      
      // Firestoreに保存
      const conversationId = await logConversation({
        childId,
        question,
        curiosityType,
        selectedExpert,
        selectionReason,
        response,
      });

      setLastLoggedId(conversationId);
      console.log(`[useConversationLogger] Successfully logged: ${conversationId}`);
      
      return conversationId;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('[useConversationLogger] Failed to log:', error);
      return null;

    } finally {
      setIsLogging(false);
    }
  };

  /**
   * エラーをクリア
   */
  const clearError = () => {
    setError(null);
  };

  return {
    logCurrentConversation,  // ログ記録関数
    isLogging,               // ログ記録中フラグ
    lastLoggedId,            // 最後に記録した会話ID
    error,                   // エラー情報
    clearError,              // エラークリア関数
  };
}
