'use client';

import type { ConversationMetadata } from '@/lib/firebase/types';
import { agents } from '@/lib/agents/definitions';
import type { AgentRole } from '@/lib/agents/types';
import { getCuriosityTypeName } from '@/lib/curiosity-types';
import { Bookmark, Clock, Layers } from 'lucide-react';
import Link from 'next/link';

interface ConversationCardProps {
  conversation: ConversationMetadata;
  childId: string;
}

export function ConversationCard({ conversation, childId }: ConversationCardProps) {
  const expert = agents[conversation.selectedExpert as AgentRole];
  const date = conversation.createdAt?.toDate?.();
  const dateStr = date
    ? date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Link
      href={`/parent/conversations/${conversation.conversationId}?childId=${childId}`}
      className="block"
    >
      <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow active:scale-[0.98]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 truncate text-sm">
              {conversation.question}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              {expert && (
                <span className="text-slate-700 font-medium">{expert.nameJa}</span>
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
          </div>
          {conversation.isBookmarked && (
            <Bookmark className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
          )}
        </div>
        {conversation.curiosityType && (
          <span className="inline-block mt-2 px-2 py-0.5 bg-sky-50 text-sky-700 text-xs rounded-full">
            {getCuriosityTypeName(conversation.curiosityType)}
          </span>
        )}
      </div>
    </Link>
  );
}
