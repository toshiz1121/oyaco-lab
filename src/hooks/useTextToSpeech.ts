import { useState, useCallback, useEffect, useRef } from 'react';
import { generateSpeechAction } from '@/app/actions';

interface TextToSpeechHook {
  speak: (text: string, onEnd?: () => void) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useTextToSpeech(): TextToSpeechHook {
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  return { speak, stop, isSpeaking, isSupported };
}
