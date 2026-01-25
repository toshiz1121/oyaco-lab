"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { consultAction } from "@/app/actions";
import { createSession, addMessageToSession, ChatSession, ChatMessage } from "@/lib/chat-history";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { agents } from "@/lib/agents/definitions";
import { AgentResponse, AgentRole } from "@/lib/agents/types";

// Views
import { InputView } from "./InputView";
import { ResultView } from "./ResultView";
import { ExpertSpotlight } from "./ExpertSpotlight";
import { ThinkingView } from "./ThinkingView";

interface AgentChatInterfaceProps {
  initialQuestion?: string;
  onNewSession?: (session: ChatSession) => void;
}

type ViewMode = 'input' | 'selecting' | 'thinking' | 'result';

export function AgentChatInterface({ initialQuestion, onNewSession }: AgentChatInterfaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('input');
  const [latestResponse, setLatestResponse] = useState<AgentResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedExpert, setSelectedExpert] = useState<AgentRole | undefined>(undefined);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [isApiComplete, setIsApiComplete] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  // Speech Recognition
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError
  } = useSpeechRecognition();

  // Initialization
  useEffect(() => {
    if (!sessionId) {
      const session = createSession(initialQuestion || "新しい対話");
      setSessionId(session.id);
      if (onNewSession) onNewSession(session);
    }
  }, [initialQuestion, sessionId, onNewSession]);

  // Handle Speech End -> Submit
  // We need to detect when listening STOPS, and if we have a transcript, submit it.
  useEffect(() => {
    // If we were listening, and now we are not, and we have text...
    // Note: This logic depends on how useSpeechRecognition behaves.
    // Ideally we want to trigger this explicitly from the UI button handler if manual stop,
    // but if it stops automatically, we need to catch it.
    // For now, let's rely on the user manually stopping or the silence timeout.
    // But handling 'auto submit' is tricky if the user just paused.
    // Let's make the 'Mic Button' toggle listening.
    // And when 'stopListening' happens, we assume the user is done?
    // Let's add a debouncer or check logic? 
    // Simplified: When listening stops, if transcript is not empty, submit.
  }, [isListening, transcript]);
  
  // Custom Handler for "Stop & Submit"
  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
      // The transcript might not be final immediately? 
      // Usually transcript updates in real-time.
      // We'll submit the current transcript in a small timeout to ensure finality?
      // Actually, let's submit in the next render cycle or using a dedicated effect.
    } else {
      resetTranscript();
      startListening();
    }
  };

  // Watch for completion of listening to trigger submit
  useEffect(() => {
    if (!isListening && transcript.trim().length > 0) {
        // Listening stopped and we have text. Submit!
        // But only if we are in a state that expects input (input or result for follow-up)
        if (viewMode === 'input' || viewMode === 'result') {
            handleQuestion(transcript);
        }
    }
  }, [isListening, transcript, viewMode]);


  const handleQuestion = async (question: string) => {
    if (!sessionId) return;
    
    // Clear transcript to prevent re-submission loop if error occurs and we return to input
    resetTranscript();

    // 質問内容を保存
    setCurrentQuestion(question);
    
    // 前回の専門家を保持
    const prevExpert = selectedExpert;
    
    // いったん「選択中」にする（ただし演出は判定後にスキップする可能性あり）
    setViewMode('selecting');
    setSelectedExpert(undefined);
    setIsApiComplete(false);
    setIsContinuing(false);

    try {
        // 1. Save User Message
        addMessageToSession(sessionId, {
            role: 'user',
            content: question
        });

        // 2. Call API (非同期で実行し、完了を待つ)
        const history = latestResponse ? [
            { role: 'assistant', content: latestResponse.text }
        ] : [];

        const result = await consultAction(question, history, 'default');

        if (result.success && result.data) {
            // 3. Save Assistant Message
            addMessageToSession(sessionId, {
                role: 'assistant',
                content: result.data.text,
                agentId: result.data.agentId,
                steps: result.data.steps,
                imageUrl: result.data.imageUrl
            });

            setLatestResponse(result.data);
            const newExpert = result.data.agentId;
            setSelectedExpert(newExpert);
            setIsApiComplete(true);
            
            // 同じ専門家の場合は演出をスキップして直接 thinking へ
            if (newExpert === prevExpert) {
                setIsContinuing(true);
                setViewMode('thinking');
            }
            
            // もしすでにthinking画面にいるなら（通常遷移後）、result画面に遷移
            if (viewMode === 'thinking') {
                setViewMode('result');
            }
        } else {
            toast.error("エラーが発生しました");
            setViewMode('input');
        }

    } catch (e) {
        console.error(e);
        toast.error("通信エラー");
        setViewMode('input');
    }
  };

  const handleSpotlightComplete = () => {
    // 専門家選定演出が完了したら、thinking画面に遷移
    setViewMode('thinking');
  };

  // API完了を監視して、thinking画面からresult画面に遷移
  useEffect(() => {
    if (viewMode === 'thinking' && isApiComplete && latestResponse) {
      setViewMode('result');
    }
  }, [viewMode, isApiComplete, latestResponse]);

  // Renders
  if (viewMode === 'selecting') {
    return (
        <ExpertSpotlight
          selectedExpert={selectedExpert}
          selectionReason={latestResponse?.selectionReason}
          question={currentQuestion}
          onAnimationComplete={handleSpotlightComplete}
        />
    );
  }

  if (viewMode === 'thinking') {
    // APIが完了してselectedExpertがセットされるまでは、デフォルトのscientistを表示
    const agent = selectedExpert ? agents[selectedExpert] : agents.scientist;
    return (
        <ThinkingView
          agent={agent}
          question={currentQuestion}
          isContinuing={isContinuing}
        />
    );
  }

  if (viewMode === 'result' && latestResponse) {
    const agent = agents[latestResponse.agentId] || agents.scientist;
    return (
        <div className="h-[1000px] w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-slate-900/5" >
             <ResultView
                response={latestResponse}
                agent={agent}
                onStartListening={handleMicToggle}
                isListening={isListening}
                question={currentQuestion}
             />
        </div>
    );
  }

  // Default: Input View
  // We'll show the Scientist (Dr. Quark) as the default face
  const defaultAgent = agents.scientist;

  return (
    <div className="h-[600px] md:h-[1000px] w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-slate-900/5">
      <InputView
         onStartListening={handleMicToggle}
         isListening={isListening}
         agentName="〇〇はかせ" // As per screenshot text
         agentAvatar={defaultAgent.avatar}
      />
    </div>
  );
}
