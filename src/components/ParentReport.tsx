"use client";

import { useEffect, useState } from "react";
import { getAllSessions, getChatStats, ChatSession } from "@/lib/chat-history";
import { agents } from "@/lib/agents/definitions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, MessageSquare, Lightbulb } from "lucide-react";
import { AgentRole } from "@/lib/agents/types";

export function ParentReport() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // クライアントサイドでのみ実行
    setSessions(getAllSessions());
    setStats(getChatStats());
  }, []);

  if (!stats) return <div className="p-4 text-center">レポートを読み込み中...</div>;

  // 最も多かったエージェントIDを取得
  const topAgentEntry = Object.entries(stats.agentCounts as Record<string, number>)
    .sort(([,a], [,b]) => b - a)[0];
  
  const topAgentName = topAgentEntry 
    ? agents[topAgentEntry[0] as AgentRole]?.nameJa 
    : "まだデータがありません";

  return (
    <div className="space-y-6">
       {/* Stats Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {/* Total Questions */}
         <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">総質問数</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    {stats.totalQuestions}
                </div>
            </CardContent>
         </Card>
         
         {/* Top Interest (Agent with most counts) */}
         <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">興味のある分野</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    {topAgentName}
                </div>
            </CardContent>
         </Card>

         {/* Conversation Starter */}
         <Card className="bg-amber-50 border-amber-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800">会話のヒント</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-sm text-amber-900 flex items-start gap-2">
                    <Lightbulb className="h-5 w-5 shrink-0 mt-0.5" />
                    {sessions.length > 0 
                        ? `「${sessions[0].title}」について、もっと詳しく聞いてみませんか？` 
                        : "まずは「好きな動物」について聞いてみましょう！"}
                </div>
            </CardContent>
         </Card>
       </div>

       {/* Recent Sessions */}
       <Card>
        <CardHeader>
            <CardTitle>学習履歴</CardTitle>
            <CardDescription>最近の対話ログを確認できます</CardDescription>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                    {sessions.map(session => (
                        <div key={session.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-lg">{session.title}</h4>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(session.lastUpdated).toLocaleString('ja-JP')}
                                </span>
                            </div>
                            <div className="space-y-2 pl-4 border-l-2 border-gray-100">
                                {session.messages.map(msg => (
                                    <div key={msg.id} className="text-sm">
                                        <span className={`font-bold ${msg.role === 'user' ? 'text-blue-600' : 'text-green-600'}`}>
                                            {msg.role === 'user' ? '子供' : msg.agentName}:
                                        </span>
                                        <span className="ml-2 text-gray-700">{msg.content.substring(0, 100)}{msg.content.length > 100 ? '...' : ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                            まだ履歴がありません。
                        </div>
                    )}
                </div>
            </ScrollArea>
        </CardContent>
       </Card>
    </div>
  );
}
