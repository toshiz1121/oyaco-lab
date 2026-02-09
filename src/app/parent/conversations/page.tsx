'use client';

export const dynamic = 'force-dynamic';

import { useParentDashboard } from '@/hooks/useParentDashboard';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { ConversationCard } from '@/components/parent/ConversationCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ConversationsPage() {
  const {
    children,
    selectedChildId,
    conversations,
    loading,
    selectChild,
  } = useParentDashboard();

  const [filter, setFilter] = useState<'all' | 'bookmarked'>('all');

  const filtered =
    filter === 'bookmarked'
      ? conversations.filter((c) => c.isBookmarked)
      : conversations;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-lg mx-auto space-y-3 pt-16">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/parent">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-slate-900">会話履歴</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* 子供切り替え */}
        <ChildSelector
          children={children}
          selectedChildId={selectedChildId}
          onSelect={selectChild}
        />

        {/* フィルター */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            すべて（{conversations.length}）
          </button>
          <button
            onClick={() => setFilter('bookmarked')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'bookmarked'
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            ⭐ ブックマーク
          </button>
        </div>

        {/* 会話リスト */}
        {selectedChildId && filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((conv) => (
              <ConversationCard
                key={conv.conversationId}
                conversation={conv}
                childId={selectedChildId}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {filter === 'bookmarked'
                ? 'ブックマークした会話はまだありません'
                : '会話履歴がありません'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
