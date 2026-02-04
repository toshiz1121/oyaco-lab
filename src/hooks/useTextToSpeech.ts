import { useState, useCallback, useEffect, useRef } from 'react';
import { generateSpeechAction } from '@/app/actions';

/**
 * 事前読み込みされた音声データの型定義
 */
export interface LoadedAudio {
  audio: HTMLAudioElement;
  duration: number; // 音声の長さ（ミリ秒）
  play: () => Promise<void>; // 再生関数
}

/**
 * useTextToSpeechフックのオプション
 */
interface TextToSpeechOptions {
  onEnd?: () => void; // 音声再生終了時のコールバック
}

/**
 * useTextToSpeechフックの戻り値の型定義
 */
interface TextToSpeechHook {
  speak: (text: string) => void; // テキストを即座に読み上げる
  stop: () => void; // 再生を停止する
  loadAudio: (text: string) => Promise<LoadedAudio>; // 音声を事前読み込みする
  isSpeaking: boolean; // 現在再生中かどうか
  isPreparing: boolean; // 音声データを準備中かどうか
  isSupported: boolean; // TTS機能がサポートされているか
}

/**
 * テキスト読み上げ機能を提供するカスタムフック
 * 
 * Vertex AI TTSを優先的に使用し、利用できない場合はWeb Speech APIにフォールバックします。
 * 
 * @param options オプション設定（再生終了時のコールバックなど）
 * @returns 音声再生を制御する関数群と状態
 */
export function useTextToSpeech(options?: TextToSpeechOptions): TextToSpeechHook {
  const [isSpeaking, setIsSpeaking] = useState(false); // 再生中フラグ
  const [isPreparing, setIsPreparing] = useState(false); // 準備中フラグ
  const isSupported = true; // Vertex AI TTSはサーバー側で処理されるため常にサポート扱い
  const audioRef = useRef<HTMLAudioElement | null>(null); // 現在再生中の音声要素
  const onEndCallback = useRef(options?.onEnd); // 再生終了コールバック

  // オプションが変更されたらコールバックを更新
  useEffect(() => {
    onEndCallback.current = options?.onEnd;
  }, [options?.onEnd]);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /**
   * 音声データを事前に読み込む関数
   * 
   * テキストをストリーミング表示する際に、音声を先に準備しておくために使用します。
   * Vertex AI TTSが利用できない場合は、Web Speech APIのモックオブジェクトを返します。
   * 
   * @param text 読み上げるテキスト
   * @returns 読み込まれた音声データと再生関数
   */
  const loadAudio = useCallback(async (text: string): Promise<LoadedAudio> => {
    setIsPreparing(true);

    try {
      console.log("Loading audio for text:", text.slice(0, 50) + "...");
      const base64Audio = await generateSpeechAction(text);

      if (!base64Audio) {
        // Vertex AI TTSが利用できない場合はWeb Speech APIにフォールバック
        console.warn("Vertex AI TTS returned null in loadAudio, using Web Speech API fallback");
        setIsPreparing(false);

        // Web Speech API用のモック音声オブジェクトを作成
        // イベントハンドラの互換性を保つため
        const mockAudio = {
          onended: null as ((this: HTMLAudioElement, ev: Event) => any) | null,
          onerror: null as ((this: HTMLAudioElement, ev: Event) => any) | null,
        } as HTMLAudioElement;

        // Web Speech APIは事前読み込みができないため、
        // play()呼び出し時にspeechSynthesisを使用するモックを返す
        return {
          audio: mockAudio,
          duration: 0, // Web Speech APIでは長さが不明
          play: async () => {
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.lang = 'ja-JP'; // 日本語
              utterance.rate = 0.9; // 読み上げ速度
              utterance.pitch = 1.0; // 音程

              setIsSpeaking(true);

              utterance.onend = () => {
                setIsSpeaking(false);
                // モック音声のonendedハンドラを呼び出す
                if (mockAudio.onended) {
                  mockAudio.onended.call(mockAudio, new Event('ended'));
                }
              };

              utterance.onerror = (e) => {
                console.error("Web Speech API error:", e);
                setIsSpeaking(false);
                // モック音声のonerrorハンドラを呼び出す
                if (mockAudio.onerror) {
                  mockAudio.onerror.call(mockAudio, new Event('error'));
                }
              };

              window.speechSynthesis.speak(utterance);
            } else {
              throw new Error("Neither Vertex AI TTS nor Web Speech API is available");
            }
          }
        };
      }

      // Vertex AI TTSからWAVデータを取得
      // Data URIを作成して再生可能にする
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);

      // メタデータの読み込みを待って音声の長さを取得
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error("Failed to load audio metadata"));
      });

      const duration = audio.duration * 1000; // 秒をミリ秒に変換
      console.log(`Audio loaded: duration = ${duration}ms`);

      setIsPreparing(false);

      return {
        audio,
        duration,
        play: async () => {
          // 既存の音声が再生中なら停止
          if (audioRef.current && audioRef.current !== audio) {
            audioRef.current.pause();
          }
          audioRef.current = audio;
          setIsSpeaking(true);
          await audio.play();
        }
      };
    } catch (err) {
      console.error("TTS Load Error:", err);
      setIsPreparing(false);
      throw err;
    }
  }, []);

  /**
   * テキストを即座に読み上げる関数
   * 
   * Vertex AI TTSを使用して音声を生成し、即座に再生します。
   * 失敗した場合はWeb Speech APIにフォールバックします。
   * 
   * @param text 読み上げるテキスト
   */
  const speak = useCallback(async (text: string) => {
    // 既存の音声が再生中なら停止
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSpeaking(true);

    try {
      console.log("Calling Vertex AI TTS for text:", text.slice(0, 50) + "...");
      const base64Audio = await generateSpeechAction(text);

      if (!base64Audio) {
        // Vertex AI TTSが利用できない場合はWeb Speech APIにフォールバック
        console.warn("Vertex AI TTS returned null, falling back to Web Speech API");

        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'ja-JP'; // 日本語
          utterance.rate = 0.9; // 読み上げ速度
          utterance.pitch = 1.0; // 音程

          utterance.onend = () => {
            setIsSpeaking(false);
            if (onEndCallback.current) onEndCallback.current();
          };

          utterance.onerror = (e) => {
            console.error("Web Speech API error:", e);
            setIsSpeaking(false);
            if (onEndCallback.current) onEndCallback.current();
          };

          window.speechSynthesis.speak(utterance);
          return;
        } else {
          throw new Error("Neither Vertex AI TTS nor Web Speech API is available");
        }
      }

      // Vertex AI TTSからWAVデータを取得
      // Data URIを作成して再生可能にする
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        if (onEndCallback.current) onEndCallback.current();
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        audioRef.current = null;
        if (onEndCallback.current) onEndCallback.current();
      };

      await audio.play();
    } catch (err) {
      console.error("TTS Error:", err);
      setIsSpeaking(false);
      if (onEndCallback.current) onEndCallback.current();
    }
  }, []);

  /**
   * 音声再生を停止する関数
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, loadAudio, isSpeaking, isPreparing, isSupported };
}
