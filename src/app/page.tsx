"use client";

import { AgentChatInterface } from "@/components/AgentChatInterface";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LineChart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {

  const { user, activeChildId, loading } = useAuth();
  const router = useRouter();

  // 認証チェック
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!activeChildId) {
        router.push('/select-child');
      }
    }
  }, [user, activeChildId, loading, router]);

  if (loading || !user || !activeChildId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-sky-50 flex flex-col font-sans">
      {/* ヘッダー（固定・コンパクト） */}
      <header className="shrink-0 bg-white/95 backdrop-blur-sm shadow-sm border-b border-sky-200 px-3 sm:px-4 py-2 sm:py-3 z-10 safe-area-top">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-sky-600 flex items-center gap-1 truncate">
              🧪 キッズサイエンスラボ 🔭
            </h1>
            <p className="text-[10px] sm:text-xs text-sky-700 truncate">なんで？をはかせにきいてみよう！</p>
          </div>
          <Link href="/parent">
            <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0 ml-2 min-h-[36px] min-w-[36px]">
              <LineChart className="h-3 w-3" />
              <span className="hidden sm:inline">保護者</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="w-full max-w-6xl mx-auto h-full flex items-center justify-center">
          <AgentChatInterface />
        </div>
      </main>

      {/* フッター（固定・最小限） */}
      <footer className="shrink-0 bg-white/90 border-t border-sky-200 px-3 py-1.5 sm:py-2 z-10 safe-area-bottom">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-[10px] sm:text-xs text-sky-600">© 2024 AIキッズサイエンスラボ</p>
        </div>
      </footer>
    </div>
  );
}
