'use client';

export const dynamic = 'force-dynamic';

import { useParentDashboard } from '@/hooks/useParentDashboard';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { StatsCards } from '@/components/parent/StatsCards';
import { AISuggestionCard } from '@/components/parent/AISuggestionCard';
import { ParentAgentChat } from '@/components/parent/ParentAgentChat';
import { RecentConversations } from '@/components/parent/RecentConversations';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function ParentDashboardPage() {
  const { user, signOut } = useAuth();
  const {
    children,
    selectedChildId,
    selectedChild,
    conversations,
    loading,
    error,
    selectChild,
  } = useParentDashboard();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-lg mx-auto space-y-4 pt-8">
          <div className="h-8 bg-slate-200 rounded animate-pulse w-48" />
          <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          </div>
          <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/">
            <Button variant="outline">ホームに戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-bold text-slate-900">保護者ダッシュボード</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-slate-500 gap-1.5 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            ログアウト
          </Button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-5">
        {/* 子供切り替え */}
        <ChildSelector
          children={children}
          selectedChildId={selectedChildId}
          onSelect={selectChild}
        />

        {selectedChild && selectedChildId && (
          <>
            {/* 統計カード */}
            <StatsCards child={selectedChild} conversations={conversations} />

            {/* AI提案（従来の単発提案） */}
            <AISuggestionCard childId={selectedChildId} />

            {/* 子育てアドバイザーエージェント（ReAct ループ） */}
            <ParentAgentChat
              childId={selectedChildId}
              childName={selectedChild.name}
            />

            {/* 最近の会話 */}
            <RecentConversations
              conversations={conversations}
              childId={selectedChildId}
            />
          </>
        )}

        {!selectedChild && children.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg mb-2">お子さんがまだ登録されていません</p>
            <Link href="/add-child">
              <Button>お子さんを追加する</Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
