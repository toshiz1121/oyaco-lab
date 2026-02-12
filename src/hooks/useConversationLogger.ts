/**
 * 会話ログ記録カスタムフック
 * 
 * Reactコンポーネントから会話ログ機能を使用するためのフック
 * 画像のFirebase Storageアップロードも担当
 */

import { useState, useRef } from 'react';
import { logConversationAction, estimateCuriosityTypeAction } from '@/app/actions/conversation-logger';
import { AgentResponse, AgentRole } from '@/lib/agents/types';
import { uploadConversationImage } from '@/lib/firebase/storage';

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
  
  // 好奇心タイプ判定のPromiseを保持（バックグラウンド実行用）
  const curiosityTypePromiseRef = useRef<Promise<string> | null>(null);

  /**
   * 好奇心タイプ判定を開始（バックグラウンド実行）
   * 
   * 質問が確定した時点で呼び出すことで、解説生成と並行して実行できる
   * 
   * @param question - 子供の質問
   */
  const startCuriosityTypeEstimation = (question: string) => {
    console.log('[useConversationLogger] Starting curiosity type estimation in background...');
    curiosityTypePromiseRef.current = estimateCuriosityTypeAction(question);
  };

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
      // 好奇心のタイプを取得（バックグラウンドで開始済みの場合はその結果を使用）
      let curiosityType: string;
      if (curiosityTypePromiseRef.current) {
        console.log('[useConversationLogger] Waiting for background curiosity type estimation...');
        curiosityType = await curiosityTypePromiseRef.current;
        curiosityTypePromiseRef.current = null; // 使用後はクリア
      } else {
        console.log('[useConversationLogger] Starting curiosity type estimation (not pre-started)...');
        curiosityType = await estimateCuriosityTypeAction(question);
      }
      
      console.log(`[useConversationLogger] Logging conversation...`);
      console.log(`  - Question: ${question.substring(0, 50)}...`);
      console.log(`  - Expert: ${selectedExpert}`);
      console.log(`  - Curiosity Type: ${curiosityType}`);

      // 会話IDを事前生成（Storageパスに使用）
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // 結合画像（1枚）をFirebase Storageにアップロード
      let uploadedResponse = response;
      if (response.combinedImageUrl && response.combinedImageUrl.startsWith('data:image/')) {
        try {
          console.log(`[useConversationLogger] Uploading combined image to Storage...`);
          const storageUrl = await uploadConversationImage(childId, conversationId, response.combinedImageUrl);

          // Storage URLに置き換え（各pairのimageUrlも同じ結合画像を参照）
          const updatedPairs = response.pairs?.map(pair => ({
            ...pair,
            imageUrl: storageUrl,
          }));

          uploadedResponse = {
            ...response,
            pairs: updatedPairs,
            combinedImageUrl: storageUrl,
          };

          console.log(`[useConversationLogger] Combined image uploaded successfully`);
        } catch (uploadError) {
          console.error('[useConversationLogger] Image upload failed, saving without image:', uploadError);
        }
      }

      // Firestoreに保存（事前生成したconversationIdを使用）
      await logConversationAction({
        childId,
        question,
        curiosityType,
        selectedExpert,
        selectionReason,
        response: uploadedResponse,
        conversationId,
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
    startCuriosityTypeEstimation, // 好奇心タイプ判定開始（バックグラウンド）
    logCurrentConversation,       // ログ記録関数
    isLogging,                    // ログ記録中フラグ
    lastLoggedId,                 // 最後に記録した会話ID
    error,                        // エラー情報
    clearError,                   // エラークリア関数
  };
}
