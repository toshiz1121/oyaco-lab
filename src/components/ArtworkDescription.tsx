"use client";

import { useEffect, useState, useCallback } from "react";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Volume2, VolumeX } from "lucide-react";

interface ArtworkDescriptionProps {
  comment: string;
  artistName: string;
  isLoading: boolean;
}

export function ArtworkDescription({ comment, artistName, isLoading }: ArtworkDescriptionProps) {
  const { speak, stop, isSpeaking, isSupported } = useTextToSpeech();
  const [displayText, setDisplayText] = useState("");
  
  // タイプライター風のエフェクト
  useEffect(() => {
    if (isLoading || !comment) {
      setDisplayText("");
      return;
    }

    let currentIndex = 0;
    const intervalId = setInterval(() => {
      if (currentIndex <= comment.length) {
        setDisplayText(comment.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, 50); // 50msごとに1文字表示

    return () => clearInterval(intervalId);
  }, [comment, isLoading]);

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      stop();
    } else {
      speak(comment);
    }
  }, [isSpeaking, comment, speak, stop]);

  // コンポーネントがアンマウントされたら読み上げ停止
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  if (isLoading) {
    return (
      <Card className="mt-4 border-2 border-stone-200">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex items-center space-x-2 animate-pulse text-stone-500">
              <span className="text-3xl">🤔</span>
              <p className="font-serif italic text-lg">{artistName}が作品を語ろうとしています...</p>
            </div>
            <div className="flex items-center space-x-4 w-full px-8">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[80%]" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Phase 11.3: コメントがない場合も表示
  if (!comment) {
    return (
      <Card className="mt-4 border-2 border-stone-200 bg-stone-50">
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🗣️</span>
                <h3 className="font-bold text-lg text-stone-800">{artistName}のコメント</h3>
              </div>
            </div>
            <div className="relative">
              <p className="text-stone-500 italic leading-relaxed px-4 min-h-[4rem] text-center">
                コメントなし
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 border-2 border-stone-200 bg-stone-50">
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🗣️</span>
              <h3 className="font-bold text-lg text-stone-800">{artistName}のコメント</h3>
            </div>
            {isSupported && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSpeak}
                className={isSpeaking ? "bg-red-100 text-red-600 hover:bg-red-200" : ""}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="mr-2 h-4 w-4" />
                    停止
                  </>
                ) : (
                  <>
                    <Volume2 className="mr-2 h-4 w-4" />
                    解説を聞く
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="relative">
            <div className="absolute -top-2 -left-2 text-4xl text-stone-300 pointer-events-none">"</div>
            <p className="text-stone-700 italic leading-relaxed px-4 min-h-[4rem]">
              {displayText}
              <span className="animate-pulse">|</span>
            </p>
            <div className="absolute -bottom-4 -right-2 text-4xl text-stone-300 pointer-events-none">"</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
