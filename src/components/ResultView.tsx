import { useState, useEffect, useRef } from 'react';
import { ExplanationGrid } from './ExplanationGrid';
import { StreamingText } from './StreamingText';
import { AgentResponse, ExplanationStep } from '@/lib/agents/types';
import { Agent } from '@/lib/agents/types';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { Button } from '@/components/ui/button';
import { Mic, Volume2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ResultViewProps {
  response: AgentResponse;
  agent: Agent;
  onStartListening: () => void;
  isListening: boolean;
}

export function ResultView({ response, agent, onStartListening, isListening }: ResultViewProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { speak, stop, isSpeaking } = useTextToSpeech();
  const hasStartedRef = useRef(false);

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
    return () => stop();
  }, []);

  const playStep = (index: number) => {
    if (index >= steps.length) return;
    
    setCurrentStepIndex(index);
    const textToSpeak = steps[index].text;
    
    speak(textToSpeak, () => {
       // On End, move to next step if available
       if (index < steps.length - 1) {
         // Add a small pause?
         setTimeout(() => {
             playStep(index + 1);
         }, 800);
       }
    });
  };

  const handleReplay = () => {
    stop();
    playStep(currentStepIndex);
  };

  return (
    <div className="flex flex-col h-full bg-sky-50 relative overflow-hidden">
      
      {/* Main Content - Grid */}
      <div className="flex-1 p-4 pb-48 flex items-center justify-center">
        <div className="w-full max-w-2xl aspect-[3/4] md:aspect-[4/3] bg-white rounded-3xl shadow-sm border-4 border-slate-800 p-2">
            <ExplanationGrid 
                imageUrl={response.imageUrl} 
                totalSteps={steps.length} 
                currentStepIndex={currentStepIndex} 
            />
        </div>
      </div>

      {/* Bottom Area (Fixed) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-4 bg-gradient-to-t from-sky-100 via-sky-50 to-transparent">
        
        {/* Agent & Text Bubble */}
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
            {/* Agent Avatar */}
            <div className="flex flex-col items-center shrink-0 mb-2">
                <Avatar className={`h-16 w-16 md:h-20 md:w-20 border-4 border-${agent.color || 'blue'}-500 bg-white`}>
                    <AvatarImage src={`/avatars/${response.agentId}.png`} alt={agent.nameJa} />
                    <AvatarFallback>{agent.nameJa[0]}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-bold text-slate-600 mt-1">{agent.nameJa}</span>
            </div>

            {/* Bubble */}
            <div className="flex-1 bg-white rounded-3xl rounded-bl-none p-6 shadow-md border border-slate-200 relative">
                <StreamingText text={currentStep?.text || ""} />
                
                {/* Replay Button */}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 text-slate-400 hover:text-sky-500"
                    onClick={handleReplay}
                    disabled={isSpeaking}
                >
                    <Volume2 className={`h-5 w-5 ${isSpeaking ? "animate-pulse text-sky-500" : ""}`} />
                </Button>
            </div>
        </div>

        {/* Input Bar */}
        <div className="max-w-3xl mx-auto bg-white/80 backdrop-blur-md rounded-full p-2 shadow-lg border border-white flex items-center gap-4">
             <Button
                size="lg"
                className={`h-14 w-14 rounded-full shadow-md transition-all ${
                    isListening 
                    ? "bg-red-500 hover:bg-red-600 animate-pulse" 
                    : "bg-indigo-500 hover:bg-indigo-600"
                }`}
                onClick={onStartListening}
            >
                <Mic className="h-6 w-6 text-white" />
            </Button>
            
            <div className="flex-1 px-4">
                {isListening ? (
                    <div className="flex items-center gap-1 h-8">
                        <span className="text-sky-600 font-bold animate-pulse">きいています...</span>
                        {/* Fake Waveform */}
                        {[...Array(5)].map((_, i) => (
                             <div key={i} className="w-1 bg-sky-400 rounded-full animate-bounce" style={{ height: Math.random() * 20 + 10 + 'px', animationDelay: i * 0.1 + 's' }} />
                        ))}
                    </div>
                ) : (
                    <span className="text-slate-400 text-sm font-medium">もっとしつもんする？ボタンをおしてね</span>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
