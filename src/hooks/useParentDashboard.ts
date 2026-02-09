'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getChildProfile,
  getRecentConversations,
  getConversationWithScenes,
  updateConversationFeedback,
} from '@/lib/firebase/firestore';
import type { ChildProfile, ConversationMetadata, ConversationScene } from '@/lib/firebase/types';

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

  // 子供一覧を取得（childrenIds から個別取得 — composite index 不要）
  useEffect(() => {
    if (!parentUserId || childrenIds.length === 0) return;

    const load = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
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
      } catch (err) {
        console.error('[useParentDashboard] Failed to load children:', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: '子供の情報を読み込めませんでした',
        }));
      }
    };

    load();
  }, [parentUserId, childrenIds]);

  // 選択中の子供の会話を取得
  useEffect(() => {
    if (!state.selectedChildId) return;

    const load = async () => {
      try {
        const conversations = await getRecentConversations(state.selectedChildId!, 20);
        setState((prev) => ({ ...prev, conversations }));
      } catch (err) {
        console.error('[useParentDashboard] Failed to load conversations:', err);
      }
    };

    load();
  }, [state.selectedChildId]);

  const selectChild = useCallback((childId: string) => {
    setState((prev) => ({ ...prev, selectedChildId: childId, conversations: [] }));
  }, []);

  const selectedChild = state.children.find(
    (c) => c.childId === state.selectedChildId
  ) ?? null;

  const loadConversationDetail = useCallback(
    async (conversationId: string) => {
      if (!state.selectedChildId) return null;
      return getConversationWithScenes(state.selectedChildId, conversationId);
    },
    [state.selectedChildId]
  );

  const saveFeedback = useCallback(
    async (
      conversationId: string,
      feedback: { isBookmarked?: boolean; rating?: number; parentNotes?: string }
    ) => {
      if (!state.selectedChildId) return;
      await updateConversationFeedback(state.selectedChildId, conversationId, feedback);
      // ローカル状態も更新
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
