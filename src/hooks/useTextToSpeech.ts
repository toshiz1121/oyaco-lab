import { useState, useCallback, useEffect } from 'react';

interface TextToSpeechHook {
  speak: (text: string, onEnd?: () => void) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useTextToSpeech(): TextToSpeechHook {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
      };

      loadVoices();
      
      // Voices might load asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
        if (onEnd) onEnd();
        return;
    }

    // Cancel existing
    window.speechSynthesis.cancel();

    // Small timeout to ensure cancel is processed before speaking again?
    // Some browsers have issues with immediate speak after cancel.
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find Japanese voice if available
        const jaVoice = voices.find(v => v.lang.includes('ja') || v.lang.includes('JP'));
        if (jaVoice) {
            utterance.voice = jaVoice;
            utterance.lang = jaVoice.lang;
        } else {
            utterance.lang = 'ja-JP'; // Fallback
        }
        
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            if (onEnd) onEnd();
        };
        utterance.onerror = (e) => {
            console.error("TTS Error Event:", e);
            // Log specific error code if available
            // @ts-ignore
            if (e.error) console.error("TTS Error Code:", e.error);
            
            setIsSpeaking(false);
            if (onEnd) onEnd();
        };

        try {
            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.error("speechSynthesis.speak threw error:", err);
            setIsSpeaking(false);
            if (onEnd) onEnd();
        }
    }, 10);

  }, [voices]);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { speak, stop, isSpeaking, isSupported };
}
