'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParentDashboard } from '@/hooks/useParentDashboard';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { StatsCards } from '@/components/parent/StatsCards';
import { AISuggestionCard } from '@/components/parent/AISuggestionCard';
import { ParentAgentChat } from '@/components/parent/ParentAgentChat';
import { RecentConversations } from '@/components/parent/RecentConversations';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, X, Bot } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function ParentDashboardPage() {
  const { user, signOut } = useAuth();
  const [showAdvisor, setShowAdvisor] = useState(false);
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
        <div className="max-w-lg lg:max-w-6xl mx-auto space-y-4 pt-8">
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
        <div className="max-w-lg lg:max-w-6xl mx-auto flex items-center justify-between">
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

      <div className="max-w-lg lg:max-w-6xl mx-auto p-4 space-y-5">
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

            {/* PC: 2カラムレイアウト / スマホ: 縦並び */}
            <div className="lg:grid lg:grid-cols-5 lg:gap-6">
              {/* 左カラム: 最近の会話一覧 */}
              <div className="lg:col-span-2">
                <RecentConversations
                  conversations={conversations}
                  childId={selectedChildId}
                />
              </div>

              {/* 右カラム: AI提案 + 子育てアドバイザー */}
              <div className="lg:col-span-3 space-y-5 mt-5 lg:mt-0">
                <AISuggestionCard childId={selectedChildId} />

                {/* PC時のみインライン表示 */}
                <div className="hidden lg:block">
                  <ParentAgentChat
                    childId={selectedChildId}
                    childName={selectedChild.name}
                  />
                </div>
              </div>
            </div>
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

      {/* スマホ用: 子育てアドバイザーFAB + モーダル */}
      {selectedChild && selectedChildId && (
        <>
          {/* FAB */}
          <button
            onClick={() => setShowAdvisor(true)}
            className="lg:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-sky-500 text-white shadow-lg hover:bg-sky-600 active:scale-95 transition-all flex items-center justify-center"
          >
            <Bot className="h-7 w-7" />
          </button>

          {/* モーダル */}
          {showAdvisor && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowAdvisor(false)}
              />
              <div className="relative mt-auto bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-sky-600" />
                    <span className="font-semibold text-sm text-sky-900">子育てアドバイザー</span>
                  </div>
                  <button
                    onClick={() => setShowAdvisor(false)}
                    className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <ParentAgentChat
                    childId={selectedChildId}
                    childName={selectedChild.name}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
