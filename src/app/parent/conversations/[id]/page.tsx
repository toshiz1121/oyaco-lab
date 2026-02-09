'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getConversationWithScenes, updateConversationFeedback } from '@/lib/firebase/firestore';
import type { ConversationMetadata, ConversationScene } from '@/lib/firebase/types';
import { agents } from '@/lib/agents/definitions';
import type { AgentRole } from '@/lib/agents/types';
import { SceneViewer } from '@/components/parent/SceneViewer';
import { FeedbackControls } from '@/components/parent/FeedbackControls';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Layers } from 'lucide-react';
import Link from 'next/link';

export default function ConversationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.id as string;
  const childId = searchParams.get('childId') ?? '';

  const [conversation, setConversation] = useState<ConversationMetadata | null>(null);
  const [scenes, setScenes] = useState<ConversationScene[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId || !conversationId) return;

    const load = async () => {
      try {
        const result = await getConversationWithScenes(childId, conversationId);
        if (result) {
          setConversation(result.conversation);
          setScenes(result.scenes);
        }
      } catch (err) {
        console.error('[ConversationDetail] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [childId, conversationId]);

  const handleSaveFeedback = async (feedback: {
    isBookmarked?: boolean;
    rating?: number;
    parentNotes?: string;
  }) => {
    if (!childId || !conversationId) return;
    await updateConversationFeedback(childId, conversationId, feedback);
    setConversation((prev) => (prev ? { ...prev, ...feedback } : prev));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-lg mx-auto space-y-4 pt-16">
          <div className="h-8 bg-slate-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2" />
          <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-500 mb-4">会話が見つかりませんでした</p>
          <Link href="/parent">
            <Button variant="outline">ダッシュボードに戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  const expert = agents[conversation.selectedExpert as AgentRole];
  const date = conversation.createdAt?.toDate?.();
  const dateStr = date
    ? date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href={`/parent/conversations?childId=${childId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-slate-900 truncate text-sm">会話詳細</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-5">
        {/* 質問ヘッダー */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-snug">
            {conversation.question}
          </h2>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 flex-wrap">
            {expert && (
              <span className="font-medium text-slate-700">{expert.nameJa}</span>
            )}
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Layers className="h-3 w-3" />
              {conversation.totalScenes}シーン
            </span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {dateStr}
            </span>
          </div>
          {conversation.curiosityType && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-sky-50 text-sky-700 text-xs rounded-full">
              {conversation.curiosityType}
            </span>
          )}
        </div>

        {/* フィードバック */}
        <FeedbackControls
          isBookmarked={conversation.isBookmarked ?? false}
          rating={conversation.rating ?? 0}
          parentNotes={conversation.parentNotes ?? ''}
          onSave={handleSaveFeedback}
        />

        {/* シーン一覧 */}
        <SceneViewer scenes={scenes} />
      </div>
    </main>
  );
}
