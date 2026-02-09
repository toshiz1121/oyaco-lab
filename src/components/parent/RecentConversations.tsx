'use client';

import type { ConversationMetadata } from '@/lib/firebase/types';
import { ConversationCard } from './ConversationCard';
import Link from 'next/link';
import { ChevronRight, MessageCircle } from 'lucide-react';

interface RecentConversationsProps {
  conversations: ConversationMetadata[];
  childId: string;
}

export function RecentConversations({ conversations, childId }: RecentConversationsProps) {
  const recent = conversations.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-900">最近の会話</h2>
        {conversations.length > 5 && (
          <Link
            href={`/parent/conversations?childId=${childId}`}
            className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-0.5"
          >
            すべて見る
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">まだ会話がありません</p>
          <p className="text-xs mt-1">お子さんが質問すると、ここに表示されます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((conv) => (
            <ConversationCard
              key={conv.conversationId}
              conversation={conv}
              childId={childId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
