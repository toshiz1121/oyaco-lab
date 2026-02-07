import { agents } from "@/lib/agents/definitions";
import { AgentResponse, AgentRole } from "@/lib/agents/types";
import { ExpertSpotlight } from "../ExpertSpotlight";
import { ImageGeneratingView } from "../ImageGeneratingView";
import { ResultView } from "../ResultView";
import { InputView } from "../InputView";

interface ViewRendererProps {
  viewMode: 'input' | 'selecting' | 'imageGenerating' | 'result';
  selectedExpert?: AgentRole;
  selectionReason?: string;
  currentQuestion: string;
  generationProgress: number;
  isAudioGenerating: boolean;
  audioProgress: number;
  latestResponse: AgentResponse | null;
  isListening: boolean;
  onSpotlightComplete: () => void;
  onMicToggle: () => void;
}

const CONTAINER_CLASSES = "w-full max-w-7xl mx-auto bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border-4 md:border-6 border-slate-900/10 h-full max-h-[calc(100vh-140px)]";

export function ViewRenderer({
  viewMode,
  selectedExpert,
  selectionReason,
  currentQuestion,
  generationProgress,
  isAudioGenerating,
  audioProgress,
  latestResponse,
  isListening,
  onSpotlightComplete,
  onMicToggle,
}: ViewRendererProps) {
  
  // 博士選定中
  if (viewMode === 'selecting') {
    return (
      <ExpertSpotlight
        selectedExpert={selectedExpert}
        selectionReason={selectionReason}
        question={currentQuestion}
        onAnimationComplete={onSpotlightComplete}
      />
    );
  }

  // 画像生成中
  if (viewMode === 'imageGenerating') {
    const agent = selectedExpert ? agents[selectedExpert] : agents.scientist;
    return (
      <div className={CONTAINER_CLASSES}>
        <ImageGeneratingView
          agent={agent}
          question={currentQuestion}
          progress={generationProgress}
          isAudioGenerating={isAudioGenerating}
          audioProgress={audioProgress}
        />
      </div>
    );
  }

  // 結果表示
  if (viewMode === 'result' && latestResponse) {
    const agent = agents[latestResponse.agentId] || agents.scientist;
    return (
      <div className={CONTAINER_CLASSES}>
        <ResultView
          response={latestResponse}
          agent={agent}
          onStartListening={onMicToggle}
          isListening={isListening}
          question={currentQuestion}
        />
      </div>
    );
  }

  // 入力画面
  const defaultAgent = agents.scientist;
  return (
    <div className={CONTAINER_CLASSES}>
      <InputView
        onStartListening={onMicToggle}
        isListening={isListening}
        agentName="ピカリはかせ"
        agentAvatar={defaultAgent.avatar}
      />
    </div>
  );
}
