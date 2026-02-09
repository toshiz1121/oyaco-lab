'use client';

import type { ChildProfile, ConversationMetadata } from '@/lib/firebase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, CalendarDays, Star } from 'lucide-react';
import { agents } from '@/lib/agents/definitions';
import type { AgentRole } from '@/lib/agents/types';

interface StatsCardsProps {
  child: ChildProfile;
  conversations: ConversationMetadata[];
}

export function StatsCards({ child, conversations }: StatsCardsProps) {
  // 今週の質問数を計算
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekCount = conversations.filter((c) => {
    const date = c.createdAt?.toDate?.();
    return date && date >= weekAgo;
  }).length;

  // お気に入り博士
  const topExpert = child.stats.favoriteExperts?.[0];
  const topExpertName = topExpert
    ? agents[topExpert as AgentRole]?.nameJa ?? topExpert
    : 'まだなし';

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="py-4">
        <CardContent className="px-4 flex flex-col items-center text-center gap-1">
          <MessageSquare className="h-5 w-5 text-sky-500" />
          <span className="text-2xl font-bold">{child.stats.totalQuestions}</span>
          <span className="text-xs text-muted-foreground">総質問数</span>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardContent className="px-4 flex flex-col items-center text-center gap-1">
          <CalendarDays className="h-5 w-5 text-emerald-500" />
          <span className="text-2xl font-bold">{thisWeekCount}</span>
          <span className="text-xs text-muted-foreground">今週</span>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardContent className="px-4 flex flex-col items-center text-center gap-1">
          <Star className="h-5 w-5 text-amber-500" />
          <span className="text-lg font-bold leading-tight">{topExpertName}</span>
          <span className="text-xs text-muted-foreground">お気に入り</span>
        </CardContent>
      </Card>
    </div>
  );
}
