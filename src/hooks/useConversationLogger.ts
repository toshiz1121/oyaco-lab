/**
 * useConversationLogger — 会話ログを Firestore に保存するフック
 *
 * 【役割】
 *  - 子供の質問 → 博士の回答を1セットとして Firestore に記録
 *  - 結合画像を Firebase Storage にアップロードし、URL を差し替え
 *  - 好奇心タイプ（科学・自然・宇宙 etc.）をバックグラウンドで推定
 *
 * 【使い方】
 *  1. startCuriosityTypeEstimation(question) で推定を先行開始
 *  2. 回答生成完了後に logCurrentConversation(...) で保存
 */

import { useState, useRef } from 'react';
import { logConversationAction, estimateCuriosityTypeAction } from '@/app/actions/conversation-logger';
import { AgentResponse, AgentRole } from '@/lib/agents/types';
import { uploadConversationImage } from '@/lib/firebase/storage';

export function useConversationLogger(childId: string) {
  const [isLogging, setIsLogging] = useState(false);
  const [lastLoggedId, setLastLoggedId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // 好奇心タイプ推定の Promise を保持（解説生成と並行実行するため）
  const curiosityTypePromiseRef = useRef<Promise<string> | null>(null);

  /**
   * 好奇心タイプ推定をバックグラウンドで開始する
   * 質問が確定した時点で呼び出すと、回答生成と並行して推定が走る
   */
  const startCuriosityTypeEstimation = (question: string) => {
    curiosityTypePromiseRef.current = estimateCuriosityTypeAction(question);
  };

  /**
   * 会話ログを Firestore に保存する
   *
   * 内部処理:
   *  1. 好奇心タイプを取得（先行開始済みなら await、未開始なら即時実行）
   *  2. 結合画像を Firebase Storage にアップロード
   *  3. Firestore に会話ドキュメントを作成
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
      // 好奇心タイプを取得
      let curiosityType: string;
      if (curiosityTypePromiseRef.current) {
        curiosityType = await curiosityTypePromiseRef.current;
        curiosityTypePromiseRef.current = null;
      } else {
        curiosityType = await estimateCuriosityTypeAction(question);
      }

      // 会話IDを事前生成（Storage パスにも使用）
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // 結合画像を Firebase Storage にアップロード
      let uploadedResponse = response;
      if (response.combinedImageUrl && response.combinedImageUrl.startsWith('data:image/')) {
        try {
          const storageUrl = await uploadConversationImage(childId, conversationId, response.combinedImageUrl);

          // 各 pair の imageUrl も Storage URL に差し替え
          const updatedPairs = response.pairs?.map(pair => ({
            ...pair,
            imageUrl: storageUrl,
          }));

          uploadedResponse = {
            ...response,
            pairs: updatedPairs,
            combinedImageUrl: storageUrl,
          };
        } catch (uploadError) {
          console.error('[useConversationLogger] 画像アップロード失敗（画像なしで保存を続行）:', uploadError);
        }
      }

      // Firestore に保存
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
      return conversationId;

    } catch (err) {
      const e = err instanceof Error ? err : new Error('不明なエラー');
      setError(e);
      console.error('[useConversationLogger] ログ保存失敗:', e);
      return null;

    } finally {
      setIsLogging(false);
    }
  };

  /** エラー状態をクリア */
  const clearError = () => setError(null);

  return {
    startCuriosityTypeEstimation,
    logCurrentConversation,
    isLogging,
    lastLoggedId,
    error,
    clearError,
  };
}
