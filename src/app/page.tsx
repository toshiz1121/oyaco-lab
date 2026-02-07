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
    <div className="h-screen bg-sky-50 flex flex-col font-sans">
      {/* ヘッダー（固定） */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-sky-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-sky-600 flex items-center gap-1">
              🧪 キッズサイエンスラボ 🔭
            </h1>
            <p className="text-xs text-sky-700">なんで？をはかせにきいてみよう！</p>
          </div>
          <Link href="/report">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <LineChart className="h-3 w-3" />
              保護者
            </Button>
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto px-4 py-4 mt-[72px] mb-[48px]">
        <div className="w-full max-w-6xl mx-auto h-full flex items-center justify-center">
          <AgentChatInterface />
        </div>
      </main>

      {/* フッター（固定） */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-sky-200 px-4 py-3 z-10">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-sky-600">© 2024 AIキッズサイエンスラボ</p>
        </div>
      </footer>
    </div>
  );
}
