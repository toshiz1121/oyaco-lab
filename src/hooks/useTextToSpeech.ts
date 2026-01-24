import { useState, useCallback, useEffect, useRef } from 'react';
import { generateSpeechAction } from '@/app/actions';
import { toast } from 'sonner';

interface TextToSpeechHook {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  isLoading: boolean;
}

export function useTextToSpeech(): TextToSpeechHook {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true); // Server Actionを使うので常にtrue
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // クリーンアップ
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      // 既存の再生を停止
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setIsLoading(true);
      setIsSpeaking(true); // ロード中もスピーキング状態として扱う

      // Server Actionを呼び出して音声データを取得
      const audioDataUrl = await generateSpeechAction(text);

      if (!audioDataUrl) {
        throw new Error("音声データの生成に失敗しました");
      }

      const audio = new Audio(audioDataUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setIsLoading(false);
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        setIsLoading(false);
        toast.error("音声の再生に失敗しました");
      };

      // 再生開始（ユーザーインタラクション内であれば自動再生可能）
      await audio.play();
      setIsLoading(false); // 再生開始したらロード終了

    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
      setIsLoading(false);
      toast.error("読み上げの準備に失敗しました");
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // 先頭に戻す
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  return { speak, stop, isSpeaking, isSupported, isLoading };
}
