'use client';

/**
 * 親エージェントとの対話UI
 *
 * 親が自由に質問でき、エージェントがツールを使って
 * 分析結果を返すチャットインターフェース。
 * プリセット質問で手軽に使い始められる。
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bot,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wrench,
} from 'lucide-react';
import { askParentAgent } from '@/app/parent/actions';
import type { ParentAgentResult, AgentStep } from '@/lib/agents/parent-agent/types';

interface ParentAgentChatProps {
  childId: string;
  childName: string;
}

/** プリセット質問（親がワンタップで聞ける） */
const PRESET_QUESTIONS = [
  { emoji: '📊', label: '学習の様子', query: '最近の学習状況を教えてください' },
  { emoji: '🌱', label: '新しい興味', query: 'うちの子が最近興味を持っていることは何ですか？' },
  { emoji: '💡', label: '会話のヒント', query: '今日子供と話すのにおすすめの話題はありますか？' },
  { emoji: '🗺️', label: '未探索の分野', query: 'まだ触れていない分野はありますか？' },
];

/** チャットメッセージ */
interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  agentResult?: ParentAgentResult;
  timestamp: Date;
}

export function ParentAgentChat({ childId, childName }: ParentAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await askParentAgent(childId, query);

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: result.success && result.data
          ? result.data.answer
          : result.error || 'エラーが発生しました',
        agentResult: result.data,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'agent',
          content: '通信エラーが発生しました。もう一度お試しください。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Card className="border-sky-200 bg-sky-50/30">
      <CardContent className="px-4 py-4">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-5 w-5 text-sky-600" />
          <span className="font-semibold text-sky-900 text-sm">
            子育てアドバイザー
          </span>
          <span className="text-xs text-sky-600">
            — {childName}さんについて何でも聞いてください
          </span>
        </div>

        {/* プリセット質問（会話がまだない場合に表示） */}
        {messages.length === 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {PRESET_QUESTIONS.map((q) => (
              <button
                key={q.label}
                onClick={() => sendMessage(q.query)}
                disabled={loading}
                className="text-left px-3 py-2 rounded-lg bg-white border border-sky-200 
                           hover:bg-sky-50 hover:border-sky-300 transition-colors text-xs
                           disabled:opacity-50"
              >
                <span className="mr-1">{q.emoji}</span>
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages.length > 0 && (
          <div className="space-y-3 mb-3 max-h-96 overflow-y-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {loading && <ThinkingIndicator />}
            <div ref={scrollRef} />
          </div>
        )}

        {/* 入力フォーム */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="質問を入力..."
            disabled={loading}
            className="flex-1 rounded-lg border border-sky-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300
                       disabled:opacity-50 bg-white"
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            className="bg-sky-500 hover:bg-sky-600 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ========================================
// サブコンポーネント
// ========================================

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-sky-500 text-white'
            : 'bg-white border border-slate-200 text-slate-800'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* エージェントの思考過程（展開可能） */}
        {message.agentResult && message.agentResult.toolsUsed.length > 0 && (
          <AgentStepsAccordion result={message.agentResult} />
        )}
      </div>
    </div>
  );
}

function AgentStepsAccordion({ result }: { result: ParentAgentResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        <Wrench className="h-3 w-3" />
        {result.toolsUsed.length}個のツールを使用
        （{Math.round(result.processingTimeMs / 1000)}秒）
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-1.5 space-y-1">
          {result.steps
            .filter((s): s is Extract<AgentStep, { type: 'tool_call' }> => s.type === 'tool_call')
            .map((step, i) => (
              <div key={i} className="text-xs text-slate-400 pl-2 border-l-2 border-slate-200">
                🔧 {step.toolName}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>分析中...</span>
        </div>
      </div>
    </div>
  );
}
