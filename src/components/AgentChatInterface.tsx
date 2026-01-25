"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { consultAction } from "@/app/actions";
import { Loader2, Mic, Volume2, Image as ImageIcon, Sparkles, BookOpen, Baby, Search, Send, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { createSession, addMessageToSession, ChatSession, ChatMessage } from "@/lib/chat-history";
import { ExplanationStyle } from "@/lib/agents/core";
import { agents } from "@/lib/agents/definitions";
import { AgentRole } from "@/lib/agents/types";

interface AgentChatInterfaceProps {
  initialQuestion?: string;
  onNewSession?: (session: ChatSession) => void;
}

export function AgentChatInterface({ initialQuestion, onNewSession }: AgentChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<ExplanationStyle>('default');
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { isSpeaking, speak, stop } = useTextToSpeech();
  
  // 音声認識フック
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error: speechError
  } = useSpeechRecognition();
  
  // 音声入力開始時の入力を保持するためのstate
  const [previousInput, setPreviousInput] = useState("");

  // 音声認識エラーのハンドリング
  useEffect(() => {
    if (speechError) {
      // ユーザーキャンセルや許可拒否の場合はトーストを出さない、あるいは控えめに
      if (speechError === 'not-allowed') {
         toast.error("マイクの使用が許可されていません。ブラウザの設定を確認してください。");
      } else if (speechError === 'no-speech') {
         // 無言で終了した場合は無視するか、軽い通知
      } else {
         toast.error(`音声認識エラー: ${speechError}`);
      }
    }
  }, [speechError]);

  // 音声認識結果を入力欄に反映
  useEffect(() => {
    if (isListening && transcript) {
      // 既存の入力 + 音声認識結果
      // transcriptは認識セッションごとにリセットされるため、開始時の入力を基準にする
      const separator = previousInput && !previousInput.endsWith(' ') ? ' ' : '';
      setInput(`${previousInput}${separator}${transcript}`);
    }
  }, [transcript, isListening, previousInput]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      setPreviousInput(input);
      startListening();
    }
  };

  // 初期化
  useEffect(() => {
    if (!sessionId) {
      // 新規セッション開始（最初の質問があればそれを使う、なければ空で開始）
      const session = createSession(initialQuestion || "新しい対話");
      setSessionId(session.id);
      if (onNewSession) onNewSession(session);

      // 初期メッセージ（Orchestratorからの挨拶）
      const welcomeMessage: Omit<ChatMessage, 'id' | 'timestamp'> = {
        role: 'assistant',
        content: "こんにちは！きみはなにについてしりたいのかな？なんでもきいてね。",
        agentId: 'orchestrator',
        agentName: '進行役'
      };
      
      const updatedSession = addMessageToSession(session.id, welcomeMessage);
      if (updatedSession) {
        setMessages(updatedSession.messages);
      }
    }
  }, [initialQuestion, sessionId, onNewSession]);

  // 自動スクロール
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessageContent = input;
    setInput("");
    setIsLoading(true);

    // ユーザーメッセージを保存
    const userMsgObj: Omit<ChatMessage, 'id' | 'timestamp'> = {
      role: 'user',
      content: userMessageContent,
      style: currentStyle
    };
    
    // UI更新
    const sessionWithUserMsg = addMessageToSession(sessionId, userMsgObj);
    if (sessionWithUserMsg) setMessages(sessionWithUserMsg.messages);

    try {
      // 履歴コンテキストの作成（直近5件程度）
      const historyContext = messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Server Action呼び出し
      const result = await consultAction(userMessageContent, historyContext, currentStyle);

      if (result.success && result.data) {
        const agent = agents[result.data.agentId];
        
        // アシスタントメッセージを保存
        const assistantMsgObj: Omit<ChatMessage, 'id' | 'timestamp'> = {
          role: 'assistant',
          content: result.data.text,
          agentId: result.data.agentId,
          agentName: agent.nameJa,
          imageUrl: result.data.imageUrl,
          audioUrl: result.data.audioUrl,
          steps: result.data.steps
        };

        const sessionWithAgentMsg = addMessageToSession(sessionId, assistantMsgObj);
        if (sessionWithAgentMsg) {
            setMessages(sessionWithAgentMsg.messages);
            
            // 自動読み上げ
            if (result.data.text) handleSpeak(result.data.text);
        }

      } else {
        toast.error(`エラーが発生しました: ${result.error}`);
        // エラーメッセージを表示
        const errorMsg: Omit<ChatMessage, 'id' | 'timestamp'> = {
            role: 'assistant',
            content: "ごめんね、ちょっとちょうしがわるいみたい。もういちどきいてくれる？",
            agentId: 'orchestrator',
            agentName: '進行役'
        };
        const sessionWithError = addMessageToSession(sessionId, errorMsg);
        if (sessionWithError) setMessages(sessionWithError.messages);
      }

    } catch (error) {
      console.error("Chat error:", error);
      toast.error("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async (text: string) => {
    if (isSpeaking) {
      stop();
      return;
    }
    await speak(text);
  };

  const styles: { id: ExplanationStyle, label: string, icon: any }[] = [
    { id: 'default', label: 'ふつう', icon: Sparkles },
    { id: 'metaphor', label: 'たとえ話', icon: BookOpen },
    { id: 'simple', label: 'かんたん', icon: Baby },
    { id: 'detail', label: 'くわしく', icon: Search },
  ];

  return (
    <Card className="flex flex-col h-[600px] border-none shadow-md bg-white/50 backdrop-blur-sm">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-3`}
            >
              {msg.role === "assistant" && msg.agentId && (
                <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                    <Avatar className={`h-10 w-10 border-2 border-${agents[msg.agentId].color}-500`}>
                    <AvatarImage src={`/avatars/${msg.agentId}.png`} alt={msg.agentName} />
                    <AvatarFallback>{msg.agentName?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground font-bold">{msg.agentName}</span>
                </div>
              )}

              <div className={`flex flex-col max-w-[80%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`relative rounded-2xl px-5 py-3 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
                  }`}
                >
                  {!msg.steps?.length ? (
                    <>
                      {msg.content}
                      {msg.role === "assistant" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-2 -mr-1 align-middle opacity-50 hover:opacity-100"
                          onClick={() => handleSpeak(msg.content)}
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-4 w-full min-w-[300px]">
                      {msg.steps.map((step, idx) => (
                        <div key={idx} className="flex flex-col gap-2">
                           {/* Step Text */}
                           <div className="flex items-start gap-2">
                              <span className="font-bold text-primary shrink-0 mt-0.5">#{step.stepNumber}</span>
                              <span className="text-gray-800">{step.text}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 ml-auto -mr-1 align-middle opacity-30 hover:opacity-100"
                                onClick={() => handleSpeak(step.text)}
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </Button>
                           </div>

                           {/* Image Panel */}
                           {msg.imageUrl && (
                             <div className="relative overflow-hidden rounded-xl border shadow-sm w-full aspect-[4/3] bg-gray-50">
                               <img
                                 src={msg.imageUrl}
                                 alt={`Step ${step.stepNumber} illustration`}
                                 className="absolute max-w-none"
                                 style={getPanelStyle(msg.steps!.length, idx)}
                               />
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fallback Image display (only if no steps but has image) */}
                {msg.imageUrl && (!msg.steps || msg.steps.length === 0) && (
                  <div className="mt-2 rounded-xl overflow-hidden border shadow-sm max-w-[300px]">
                    <img src={msg.imageUrl} alt="Generated illustration" className="w-full h-auto" />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start gap-3">
               <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                    <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
                </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">はかせをよんでいるよ...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white/80 backdrop-blur-md rounded-b-xl">
        
        {/* Style Selector */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {styles.map((style) => (
                <button
                    key={style.id}
                    onClick={() => setCurrentStyle(style.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        currentStyle === style.id 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                >
                    <style.icon className="h-3.5 w-3.5" />
                    {style.label}
                </button>
            ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="ききたいことをかいてね..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
                // IME入力中（変換中）は送信しない
                if (e.nativeEvent.isComposing) return;

                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }}
            disabled={isLoading}
            className="flex-1 rounded-full px-4"
          />
          {isSupported && (
            <Button
                size="icon"
                variant={isListening ? "destructive" : "secondary"}
                onClick={handleMicClick}
                disabled={isLoading}
                className={`rounded-full h-10 w-10 shrink-0 ${isListening ? "animate-pulse" : ""}`}
                title={isListening ? "音声入力を停止" : "音声入力"}
            >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="rounded-full h-10 w-10 shrink-0"
            title="送信"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Helper for image panel slicing
const getPanelStyle = (totalSteps: number, stepIndex: number): React.CSSProperties => {
  if (totalSteps <= 1) return { width: '100%', height: '100%', objectFit: 'cover' };
  
  if (totalSteps === 2) {
    // 2 Panels: Left / Right
    return {
        width: '200%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: stepIndex === 0 ? '0%' : '-100%',
        maxWidth: 'none',
        objectFit: 'cover'
    };
  }

  // 4 Panels (default for 3 or 4)
  // 2x2 Grid
  // Index 0: TL, 1: TR, 2: BL, 3: BR
  const row = Math.floor(stepIndex / 2); // 0 or 1
  const col = stepIndex % 2; // 0 or 1
  
  return {
      width: '200%',
      height: '200%',
      position: 'absolute',
      top: row === 0 ? '0%' : '-100%',
      left: col === 0 ? '0%' : '-100%',
      maxWidth: 'none',
      objectFit: 'cover'
  };
};
