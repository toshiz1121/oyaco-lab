"use client";

import { useEffect } from "react";
import { ChatSession } from "@/lib/chat-history";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAgentChat } from "@/hooks/useAgentChat";
import { ViewRenderer } from "./ViewRenderer";

interface AgentChatInterfaceProps {
  initialQuestion?: string;
  onNewSession?: (session: ChatSession) => void;
}

export function AgentChatInterface({ 
  initialQuestion, 
  onNewSession 
}: AgentChatInterfaceProps) {
  
  // 音声認識
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // チャットロジック
  const {
    viewMode,
    currentQuestion,
    selectedExpert,
    selectionReason,
    latestResponse,
    generationProgress,
    isAudioGenerating,
    audioProgress,
    handleQuestion,
    handleSpotlightComplete,
  } = useAgentChat({ initialQuestion, onNewSession });

  // マイクボタン制御
  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  // 音声認識完了時に自動送信
  useEffect(() => {
    const canSubmit = !isListening && 
                      transcript.trim().length > 0 && 
                      (viewMode === 'input' || viewMode === 'result');
    
    if (canSubmit) {
      handleQuestion(transcript);
      resetTranscript();  // 送信後にtranscriptをリセット
    }
    // viewModeは依存配列に含めない（画面遷移で再実行されるのを防ぐ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, transcript]);

  return (
    <ViewRenderer
      viewMode={viewMode}
      selectedExpert={selectedExpert}
      selectionReason={selectionReason}
      currentQuestion={currentQuestion}
      generationProgress={generationProgress}
      isAudioGenerating={isAudioGenerating}
      audioProgress={audioProgress}
      latestResponse={latestResponse}
      isListening={isListening}
      onSpotlightComplete={handleSpotlightComplete}
      onMicToggle={handleMicToggle}
      onFollowUpQuestion={handleQuestion}
    />
  );
}
