"use client";

import { useState, useRef, useEffect } from "react";
import { Artist } from "@/lib/artists";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { chatWithArtistAction, generateSpeechAction, modifyArtworkAction } from "@/app/actions";
import { Loader2, Mic, Volume2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { GenerationMetadata } from "@/lib/generation-history";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  artist: Artist;
  initialMessage?: string;
  theme: string;
  currentImageUrl: string | null;
  onImageModified: (newImageUrl: string) => void;
  onModifyingChange: (isModifying: boolean) => void;
  onMetadataUpdate?: (metadata: GenerationMetadata) => void;
  currentMetadata?: GenerationMetadata | null;
}

export function ChatInterface({ artist, initialMessage, theme, currentImageUrl, onImageModified, onModifyingChange, onMetadataUpdate, currentMetadata }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // TTS Hook
  const { isSpeaking, speak, stop } = useTextToSpeech();

  // Initialize with the artist's first message (comment about the artwork)
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      const formattedMessage = initialMessage.replace("{theme}", theme);
      setMessages([
        { role: "assistant", content: formattedMessage }
      ]);
      // 自動再生はブラウザポリシーでブロックされることが多いので、ユーザー操作を待つ
    }
  }, [initialMessage, theme, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Chat history for context (exclude last user message which is passed separately)
      const history = messages.map(m => ({ role: m.role, text: m.content }));
      
      const result = await chatWithArtistAction(artist.id, history, userMessage);

      if (result.success && result.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: result.reply! }]);
        // 自動読み上げ（オプション）
        // handleSpeak(result.reply!);
      } else {
        console.error("Chat API Error:", result.error);
        toast.error(`会話に失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async (text: string) => {
    if (isSpeaking) {
      stop();
      return;
    }
    await speak(text); // hook内部でAPI呼び出しまたはWebSpeech
  };
  
  const handleModifyRequest = async () => {
    if (!input.trim() || !currentImageUrl) return;
    
    const instruction = input;
    setInput("");
    onModifyingChange(true);
    
    // Add user instruction to chat
    setMessages((prev) => [...prev, { role: "user", content: `(修正依頼) ${instruction}` }]);
    
    // Add temporary system message
    setMessages((prev) => [...prev, { role: "assistant", content: "ふむ...修正か。やってみよう。" }]);

    try {
      const result = await modifyArtworkAction(artist.id, currentImageUrl, instruction);
      
      if (result.success && result.imageUrl) {
        // 画像URLを更新
        onImageModified(result.imageUrl);
        
        // Phase 10: メタデータを保存（imageIdを追加）
        if (result.metadata && onMetadataUpdate) {
          const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const fullMetadata: GenerationMetadata = {
            ...result.metadata,
            timestamp: Date.now(),
            imageId,  // Phase 10: 追加
            artistId: artist.id,
            artistName: artist.name,
            userTheme: instruction,
            isModification: true,
            modificationInstruction: instruction,
            parentId: currentMetadata?.id,
          };
          onMetadataUpdate(fullMetadata);
        }
        
        setMessages((prev) => [...prev, { role: "assistant", content: "どうだ？指示通りに筆を入れてみたぞ。" }]);
        toast.success("作品を修正しました");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "すまない、うまくいかなかったようだ..." }]);
        toast.error(result.error || "修正に失敗しました");
      }
    } catch (error) {
      toast.error("エラーが発生しました");
    } finally {
      onModifyingChange(false);
    }
  };

  return (
    <Card className="flex flex-col h-[400px] border-t-0 rounded-t-none shadow-none">
      <div className="p-3 border-b bg-muted/30 flex items-center gap-3">
        <Avatar className="h-10 w-10 border-2 border-primary">
          <AvatarImage src={`/avatars/${artist.id}.png`} alt={artist.name} />
          <AvatarFallback>{artist.name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <h4 className="font-semibold text-sm">{artist.name}</h4>
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{artist.style}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
                }`}
              >
                {msg.content}
                {msg.role === "assistant" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-2 align-middle opacity-50 hover:opacity-100"
                    onClick={() => handleSpeak(msg.content)}
                  >
                    <Volume2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-background">
        <div className="flex gap-2">
          <Input
            placeholder="メッセージを入力..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            title="会話する"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={handleModifyRequest}
            disabled={isLoading || !input.trim() || !currentImageUrl}
            title="修正を依頼する"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
