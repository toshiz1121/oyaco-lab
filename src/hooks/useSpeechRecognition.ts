/**
 * useSpeechRecognition — ブラウザの音声認識（Web Speech API）を扱うフック
 *
 * 【役割】
 *  - マイクボタン押下 → 音声認識開始 → テキスト化 → 自動送信
 *  - Web Speech API 非対応ブラウザでは isSupported = false
 *
 * 【使い方】
 *  const { transcript, isListening, startListening, stopListening } = useSpeechRecognition();
 *  - startListening() でマイクON
 *  - stopListening() でマイクOFF
 *  - transcript に認識結果が入る（確定テキスト + 途中テキスト）
 */

import { useState, useEffect, useCallback } from 'react';

interface SpeechRecognitionHook {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------
  // マウント時に SpeechRecognition インスタンスを初期化
  // --------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setIsSupported(true);

    const instance = new SpeechRecognition();
    instance.continuous = false;       // 1回の発話で自動停止
    instance.interimResults = true;    // 途中結果も取得
    instance.lang = 'ja-JP';          // 日本語

    // --- イベントハンドラー ---
    instance.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    instance.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      // 確定テキスト + 途中テキストで上書き（追記ではなく置換）
      if (final || interim) {
        setTranscript(final + interim);
      }
    };

    instance.onerror = (event: any) => {
      setError(event.error);
      setIsListening(false);
    };

    instance.onend = () => {
      setIsListening(false);
    };

    setRecognition(instance);
  }, []);

  /** 音声認識を開始（transcript をリセットしてからスタート） */
  const startListening = useCallback(() => {
    if (!recognition) return;
    setTranscript('');
    setError(null);
    try {
      recognition.start();
    } catch {
      // 既に開始済みの場合など — 無視して問題ない
    }
  }, [recognition]);

  /** 音声認識を停止 */
  const stopListening = useCallback(() => {
    if (recognition) recognition.stop();
  }, [recognition]);

  /** transcript を手動クリア */
  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  };
}
