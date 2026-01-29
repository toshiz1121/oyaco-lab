import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ExplanationGrid } from './ExplanationGrid';
import { StreamingText } from './StreamingText';
import { AgentResponse, ExplanationStep } from '@/lib/agents/types';
import { Agent } from '@/lib/agents/types';
import { useTextToSpeech, LoadedAudio } from '@/hooks/useTextToSpeech';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MicButton } from './MicButton';

interface ResultViewProps {
  response: AgentResponse;
  agent: Agent;
  onStartListening: () => void;
  isListening: boolean;
  question?: string;
}

export function ResultView({ response, agent, onStartListening, isListening, question }: ResultViewProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTextActive, setIsTextActive] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const { loadAudio, stop, isSpeaking, isPreparing } = useTextToSpeech();
  const hasStartedRef = useRef(false);
  const audioCache = useRef<Map<number, LoadedAudio>>(new Map());

  // 控えめな装飾（3個に削減）
  const decorations = useMemo(() => 
    [...Array(3)].map((_, i) => ({
      id: i,
      left: 20 + i * 30,
      top: 15 + i * 20,
      duration: 8 + i * 2,
      delay: i * 3,
      icon: ['✨', '🌟', '💫'][i]
    })), []
  );

  const steps: ExplanationStep[] = response.steps && response.steps.length > 0
    ? response.steps
    : [{ stepNumber: 1, text: response.text, visualDescription: '' }];

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!hasStartedRef.current && currentStep) {
      hasStartedRef.current = true;
      playStep(0);
    }

    return () => {
      stop();
      audioCache.current.clear();
    };
  }, []);

  const playStep = async (index: number) => {
    if (index >= steps.length) return;

    setCurrentStepIndex(index);
    setIsTextActive(false);
    setIsLoading(true);

    const textToSpeak = steps[index].text;

    try {
      let loadedAudio = audioCache.current.get(index);

      if (!loadedAudio) {
        console.log(`Loading audio for step ${index}...`);
        loadedAudio = await loadAudio(textToSpeak);
        audioCache.current.set(index, loadedAudio);
      } else {
        console.log(`Using cached audio for step ${index}`);
      }

      if (index < steps.length - 1 && !audioCache.current.has(index + 1)) {
        const nextText = steps[index + 1].text;
        console.log(`Prefetching audio for step ${index + 1}...`);
        loadAudio(nextText).then(nextAudio => {
          audioCache.current.set(index + 1, nextAudio);
          console.log(`Prefetch complete for step ${index + 1}`);
        }).catch(err => {
          console.error(`Prefetch failed for step ${index + 1}:`, err);
        });
      }

      setIsLoading(false);
      setAudioDuration(loadedAudio.duration);
      setIsTextActive(true);

      loadedAudio.audio.onended = () => {
        if (index < steps.length - 1) {
          setTimeout(() => {
            playStep(index + 1);
          }, 800);
        }
      };

      loadedAudio.audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsLoading(false);
      };

      await loadedAudio.play();

    } catch (err) {
      console.error("Failed to play step:", err);
      setIsLoading(false);
      setIsTextActive(true);
    }
  };

  const handleReplay = async () => {
    stop();
    setIsTextActive(false);
    setTimeout(() => {
      playStep(currentStepIndex);
    }, 100);
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50/20">
      
      {/* 控えめな浮遊装飾 */}
      {decorations.map((deco) => (
        <motion.div
          key={deco.id}
          className="absolute text-xl md:text-2xl opacity-20"
          style={{
            left: `${deco.left}%`,
            top: `${deco.top}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.1, 0.25, 0.1],
          }}
          transition={{
            duration: deco.duration,
            repeat: Infinity,
            delay: deco.delay,
            ease: "easeInOut",
          }}
        >
          {deco.icon}
        </motion.div>
      ))}

      <div className="relative z-10 flex flex-col h-full">
        {/* Question Display (Top) */}
        {question && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-2 md:p-3 pb-0"
          >
            <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl px-4 md:px-6 py-2 md:py-3 border-2 md:border-3 border-blue-300 shadow-md">
              <p className="text-xs md:text-sm text-blue-600 font-bold mb-0.5">きみのしつもん</p>
              <p className="text-sm md:text-lg text-blue-900 font-bold break-words">{question}</p>
            </div>
          </motion.div>
        )}

        {/* Main Content - Scrollable */}
        <div className="flex-1 p-2 md:p-4 flex flex-col items-center overflow-y-auto pb-24 md:pb-28">
          {/* Grid */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-full max-w-[95%] md:max-w-[1000px] aspect-[3/4] md:aspect-[4/3] bg-white rounded-2xl md:rounded-3xl shadow-xl border-4 md:border-6 border-slate-800 p-1 md:p-2 mt-2 md:mt-4"
          >
            <ExplanationGrid
              imageUrl={response.imageUrl}
              totalSteps={steps.length}
              currentStepIndex={currentStepIndex}
            />
          </motion.div>

          {/* Agent & Text Bubble - Below Grid */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-end gap-2 md:gap-4 max-w-[95%] md:max-w-[1000px] w-full mt-4 md:mt-6 mb-4"
          >
            {/* Agent Avatar */}
            <div className="flex flex-col items-center shrink-0 mb-1">
              <motion.div
                animate={{
                  y: [0, -5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Avatar className={`h-12 w-12 md:h-20 md:w-20 border-3 md:border-4 border-${agent.color || 'blue'}-500 bg-white shadow-lg`}>
                  <AvatarImage src={`/avatars/${response.agentId}.png`} alt={agent.nameJa} />
                  <AvatarFallback>{agent.nameJa[0]}</AvatarFallback>
                </Avatar>
              </motion.div>
              <span className="text-xs md:text-sm font-bold text-slate-700 mt-1">{agent.nameJa}</span>
            </div>

            {/* Bubble */}
            <motion.div
              className="flex-1 bg-white rounded-2xl md:rounded-3xl rounded-bl-none p-3 md:p-6 border-2 md:border-3 border-blue-200 shadow-lg relative min-h-32 md:min-h-48 max-h-48 md:max-h-64 overflow-y-auto"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                  <span className="text-xs md:text-sm">音声を準備しています...</span>
                </div>
              ) : (
                <div className="text-sm md:text-base">
                  <StreamingText
                    text={currentStep?.text || ""}
                    isActive={isTextActive}
                    totalDuration={audioDuration}
                  />
                </div>
              )}

              {/* Replay Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 md:top-2 md:right-2 text-slate-400 hover:text-blue-500 h-7 w-7 md:h-8 md:w-8"
                onClick={handleReplay}
                disabled={isSpeaking || isLoading}
              >
                <Volume2 className={`h-4 w-4 md:h-5 md:w-5 ${isSpeaking ? "animate-pulse text-blue-500" : ""}`} />
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom MicButton (Fixed) */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{
              scale: isListening ? [1, 1.1, 1] : 1,
              boxShadow: isListening 
                ? [
                    "0 0 0 0 rgba(59, 130, 246, 0.7)",
                    "0 0 0 20px rgba(59, 130, 246, 0)",
                  ]
                : "0 0 0 0 rgba(59, 130, 246, 0)",
            }}
            transition={{
              duration: 1,
              repeat: isListening ? Infinity : 0,
            }}
            className="rounded-full"
          >
            <MicButton
              isListening={isListening}
              onClick={onStartListening}
              size="lg"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
