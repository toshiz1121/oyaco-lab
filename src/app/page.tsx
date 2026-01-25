"use client";

import { AgentChatInterface } from "@/components/AgentChatInterface";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LineChart } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-sky-50 flex flex-col items-center justify-start p-4 pt-8 font-sans relative">
      <div className="absolute top-4 right-4">
        <Link href="/report">
            <Button variant="outline" size="sm" className="gap-2 bg-white/50 backdrop-blur-sm border-sky-200 text-sky-700 hover:bg-white hover:text-sky-800">
                <LineChart className="h-4 w-4" />
                保護者の方へ
            </Button>
        </Link>
      </div>

      <h1 className="text-3xl md:text-5xl font-bold text-sky-600 mb-1 flex items-center gap-2 drop-shadow-sm">
        🧪 <span className="hidden md:inline">AI</span>キッズサイエンスラボ 🔭
      </h1>
      <p className="text-sky-800 mb-4 font-medium">なんで？をはかせにきいてみよう！</p>

      <div className="w-full max-w-6xl">
        <AgentChatInterface />
      </div>
    </main>
  );
}
