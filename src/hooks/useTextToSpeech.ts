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
  const [isSupported, setIsSupported] = useState(true); // Gemini TTS is handled server-side, so assume supported
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
        throw new Error("Failed to get audio data from Gemini TTS");
      }

      // Gemini typically returns WAV data.
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
        console.log("Calling Gemini TTS for text:", text.slice(0, 50) + "...");
        const base64Audio = await generateSpeechAction(text);
        
        if (!base64Audio) {
            throw new Error("Failed to get audio data from Gemini TTS");
        }

        // Gemini typically returns WAV data.
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
