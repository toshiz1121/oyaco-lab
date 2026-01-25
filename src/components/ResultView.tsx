import { useState, useEffect, useRef } from 'react';
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

  // Normalize steps. If no steps but text exists, treat as 1 step.
  const steps: ExplanationStep[] = response.steps && response.steps.length > 0
    ? response.steps
    : [{ stepNumber: 1, text: response.text, visualDescription: '' }];

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    // Start the sequence
    if (!hasStartedRef.current && currentStep) {
        hasStartedRef.current = true;
        playStep(0);
    }
    
    // Cleanup on unmount
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
      // キャッシュから取得、なければロード
      let loadedAudio = audioCache.current.get(index);
      
      if (!loadedAudio) {
        console.log(`Loading audio for step ${index}...`);
        loadedAudio = await loadAudio(textToSpeak);
        audioCache.current.set(index, loadedAudio);
      } else {
        console.log(`Using cached audio for step ${index}`);
      }

      // 次のステップの音声を事前にロード（バックグラウンド）
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
      
      // 音声再生とテキスト表示を同時に開始
      setIsTextActive(true);
      
      // イベントリスナーを設定
      loadedAudio.audio.onended = () => {
        // 次のステップへ
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
      setIsTextActive(true); // エラー時もテキストは表示する
    }
  };

  const handleReplay = async () => {
    stop();
    setIsTextActive(false);
    // 少し待ってから再開（UIの更新を確実にするため）
    setTimeout(() => {
      playStep(currentStepIndex);
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-sky-50 relative overflow-hidden">
      
      {/* Question Display (Top) */}
      {question && (
        <div className="p-2 pb-0">
          <div className="max-w-2xl mx-auto bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-1.5 border-2 border-sky-200 shadow-sm">
            <p className="text-xs text-sky-600 font-medium mb-0.5">きみのしつもん</p>
            <p className="text-sm md:text-base text-sky-900 font-bold">{question}</p>
          </div>
        </div>
      )}
      
      {/* Main Content - Scrollable */}
      <div className="flex-1 p-4 flex flex-col items-center overflow-y-auto pb-24">
        {/* Grid */}
        <div className="w-full max-w-[1000px] aspect-[3/4] md:aspect-[4/3] bg-white rounded-3xl shadow-sm border-4 border-slate-800 p-2 mt-4">
            <ExplanationGrid
                imageUrl={response.imageUrl}
                totalSteps={steps.length}
                currentStepIndex={currentStepIndex}
            />
        </div>

        {/* Agent & Text Bubble - Below Grid */}
        <div className="flex items-end gap-3 max-w-[1000px] w-full mt-6 mb-4">
            {/* Agent Avatar */}
            <div className="flex flex-col items-center shrink-0 mb-1">
                <Avatar className={`h-12 w-12 md:h-16 md:w-16 border-3 border-${agent.color || 'blue'}-500 bg-white`}>
                    <AvatarImage src={`/avatars/${response.agentId}.png`} alt={agent.nameJa} />
                    <AvatarFallback>{agent.nameJa[0]}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-bold text-slate-600 mt-0.5">{agent.nameJa}</span>
            </div>

            {/* Bubble */}
            <div className="flex-1 bg-white rounded-3xl rounded-bl-none p-4 md:p-5 shadow-md border border-slate-200 relative min-h-48 max-h-64 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs md:text-sm">音声を準備しています...</span>
                    </div>
                ) : (
                    <StreamingText
                        text={currentStep?.text || ""}
                        isActive={isTextActive}
                        totalDuration={audioDuration}
                    />
                )}
                
                {/* Replay Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 text-slate-400 hover:text-sky-500 h-6 w-6"
                    onClick={handleReplay}
                    disabled={isSpeaking || isLoading}
                >
                    <Volume2 className={`h-4 w-4 ${isSpeaking ? "animate-pulse text-sky-500" : ""}`} />
                </Button>
            </div>
        </div>
      </div>

      {/* Bottom MicButton (Fixed) */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <MicButton
          isListening={isListening}
          onClick={onStartListening}
          size="lg"
        />
      </div>
    </div>
  );
}
