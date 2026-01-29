import { useState, useCallback, useEffect, useRef } from 'react';
import { generateSpeechAction } from '@/app/actions';

export interface LoadedAudio {
  audio: HTMLAudioElement;
  duration: number;
  play: () => Promise<void>;
}

interface TextToSpeechHook {
  speak: (text: string, onEnd?: () => void) => void;
  stop: () => void;
  loadAudio: (text: string) => Promise<LoadedAudio>;
  isSpeaking: boolean;
  isPreparing: boolean;
  isSupported: boolean;
}

export function useTextToSpeech(): TextToSpeechHook {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSupported, setIsSupported] = useState(true); // Vertex AI TTS is handled server-side, so assume supported
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const loadAudio = useCallback(async (text: string): Promise<LoadedAudio> => {
    setIsPreparing(true);

    try {
      console.log("Loading audio for text:", text.slice(0, 50) + "...");
      const base64Audio = await generateSpeechAction(text);

      if (!base64Audio) {
        // Fallback to Web Speech API if Vertex AI TTS is unavailable
        console.warn("Vertex AI TTS returned null in loadAudio, using Web Speech API fallback");
        setIsPreparing(false);

        // For Web Speech API, we create a mock audio object that implements
        // the necessary event handlers to maintain compatibility
        const mockAudio = {
          onended: null as ((this: HTMLAudioElement, ev: Event) => any) | null,
          onerror: null as ((this: HTMLAudioElement, ev: Event) => any) | null,
        } as HTMLAudioElement;

        // For Web Speech API, we can't preload, so we return a mock LoadedAudio
        // that will use speechSynthesis when play() is called
        return {
          audio: mockAudio,
          duration: 0, // Unknown duration for Web Speech API
          play: async () => {
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.lang = 'ja-JP';
              utterance.rate = 0.9;
              utterance.pitch = 1.0;

              setIsSpeaking(true);

              utterance.onend = () => {
                setIsSpeaking(false);
                // Call the mock audio's onended handler if set
                if (mockAudio.onended) {
                  mockAudio.onended.call(mockAudio, new Event('ended'));
                }
              };

              utterance.onerror = (e) => {
                console.error("Web Speech API error:", e);
                setIsSpeaking(false);
                // Call the mock audio's onerror handler if set
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

      // Vertex AI TTS returns WAV data.
      // We create a data URI to play it.
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);

      // Wait for metadata to load to get duration
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error("Failed to load audio metadata"));
      });

      const duration = audio.duration * 1000; // Convert to milliseconds
      console.log(`Audio loaded: duration = ${duration}ms`);

      setIsPreparing(false);

      return {
        audio,
        duration,
        play: async () => {
          // Stop existing audio if any
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

  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    // Stop existing audio if any
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSpeaking(true);

    try {
      console.log("Calling Vertex AI TTS for text:", text.slice(0, 50) + "...");
      const base64Audio = await generateSpeechAction(text);

      if (!base64Audio) {
        // Fallback to Web Speech API if Vertex AI TTS is unavailable
        console.warn("Vertex AI TTS returned null, falling back to Web Speech API");

        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'ja-JP'; // Japanese
          utterance.rate = 0.9;
          utterance.pitch = 1.0;

          utterance.onend = () => {
            setIsSpeaking(false);
            if (onEnd) onEnd();
          };

          utterance.onerror = (e) => {
            console.error("Web Speech API error:", e);
            setIsSpeaking(false);
            if (onEnd) onEnd();
          };

          window.speechSynthesis.speak(utterance);
          return;
        } else {
          throw new Error("Neither Vertex AI TTS nor Web Speech API is available");
        }
      }

      // Vertex AI TTS returns WAV data.
      // We create a data URI to play it.
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        if (onEnd) onEnd();
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        audioRef.current = null;
        if (onEnd) onEnd();
      };

      await audio.play();
    } catch (err) {
      console.error("TTS Error:", err);
      setIsSpeaking(false);
      if (onEnd) onEnd();
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, loadAudio, isSpeaking, isPreparing, isSupported };
}
