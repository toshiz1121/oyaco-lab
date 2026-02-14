/**
 * useParentDashboard — 保護者ダッシュボードのデータ取得・操作を管理するフック
 *
 * 【役割】
 *  - ログイン中の保護者に紐づく子供一覧を取得
 *  - 選択中の子供の最近の会話履歴を取得
 *  - 会話詳細の取得やフィードバック保存も提供
 *
 * 【データフロー】
 *  AuthContext(parentUserId, childrenIds)
 *    → Firestore から子供プロフィール一覧を取得
 *    → 最初の子供を自動選択
 *    → 選択中の子供の会話履歴を取得
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getChildProfile,
  getRecentConversations,
  getConversationWithScenes,
  updateConversationFeedback,
} from '@/lib/firebase/firestore';
import type { ChildProfile, ConversationMetadata } from '@/lib/firebase/types';

interface DashboardState {
  children: ChildProfile[];
  selectedChildId: string | null;
  conversations: ConversationMetadata[];
  loading: boolean;
  error: string | null;
}

export function useParentDashboard() {
  const { parentUserId, childrenIds } = useAuth();
  const [state, setState] = useState<DashboardState>({
    children: [],
    selectedChildId: null,
    conversations: [],
    loading: true,
    error: null,
  });

  // --------------------------------------------------
  // 子供一覧を取得（childrenIds から個別に取得）
  // --------------------------------------------------
  useEffect(() => {
    if (!parentUserId || childrenIds.length === 0) return;

    const load = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        // 各 childId のプロフィールを並列取得
        const profiles = await Promise.all(
          childrenIds.map((id) => getChildProfile(id))
        );
        const children = profiles.filter((p): p is ChildProfile => p !== null);
        const firstChildId = children.length > 0 ? children[0].childId : null;

        setState((prev) => ({
          ...prev,
          children,
          selectedChildId: firstChildId,
          loading: false,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: '子供の情報を読み込めませんでした',
        }));
      }
    };

    load();
  }, [parentUserId, childrenIds]);

  // --------------------------------------------------
  // 選択中の子供の会話履歴を取得（子供切り替え時にも再実行）
  // --------------------------------------------------
  useEffect(() => {
    if (!state.selectedChildId) return;

    const load = async () => {
      try {
        const conversations = await getRecentConversations(state.selectedChildId!, 20);
        setState((prev) => ({ ...prev, conversations }));
      } catch {
        // 会話取得失敗は致命的ではないので握りつぶす
      }
    };

    load();
  }, [state.selectedChildId]);

  /** 子供を切り替える（会話一覧もリセット） */
  const selectChild = useCallback((childId: string) => {
    setState((prev) => ({ ...prev, selectedChildId: childId, conversations: [] }));
  }, []);

  /** 現在選択中の子供プロフィール */
  const selectedChild = state.children.find(
    (c) => c.childId === state.selectedChildId
  ) ?? null;

  /** 会話詳細（シーン付き）を取得 */
  const loadConversationDetail = useCallback(
    async (conversationId: string) => {
      if (!state.selectedChildId) return null;
      return getConversationWithScenes(state.selectedChildId, conversationId);
    },
    [state.selectedChildId]
  );

  /** 会話にフィードバック（ブックマーク・評価・メモ）を保存 */
  const saveFeedback = useCallback(
    async (
      conversationId: string,
      feedback: { isBookmarked?: boolean; rating?: number; parentNotes?: string }
    ) => {
      if (!state.selectedChildId) return;
      await updateConversationFeedback(state.selectedChildId, conversationId, feedback);

      // ローカル状態にも即時反映
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.conversationId === conversationId ? { ...c, ...feedback } : c
        ),
      }));
    },
    [state.selectedChildId]
  );

  return {
    ...state,
    selectedChild,
    selectChild,
    loadConversationDetail,
    saveFeedback,
  };
}
