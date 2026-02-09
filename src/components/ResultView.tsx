import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExplanationGrid } from './ExplanationGrid';
import { StreamingText } from './StreamingText';
import { AgentResponse, ExplanationStep, SentenceImagePair } from '@/lib/agents/types';
import { Agent } from '@/lib/agents/types';
import { useTextToSpeech, LoadedAudio } from '@/hooks/useTextToSpeech';
import { useBackgroundImageGenerator } from '@/hooks/useBackgroundImageGenerator';
import { useBackgroundAudioGenerator } from '@/hooks/useBackgroundAudioGenerator';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ResultViewProps {
  response: AgentResponse;
  agent: Agent;
  onStartListening: () => void;
  isListening: boolean;
  question?: string;
  onFollowUpQuestion?: (question: string) => void;
}

export function ResultView({ response, agent, onStartListening, isListening, question, onFollowUpQuestion }: ResultViewProps) {
  // 機能フラグによる分岐
  const useParallelGeneration = response.useParallelGeneration || false;

  if (useParallelGeneration && response.pairs) {
    return (
      <ParallelResultView
        response={response}
        agent={agent}
        onStartListening={onStartListening}
        isListening={isListening}
        question={question}
        onFollowUpQuestion={onFollowUpQuestion}
      />
    );
  }

  // 旧フロー（既存の実装）
  return (
    <LegacyResultView
      response={response}
      agent={agent}
      onStartListening={onStartListening}
      isListening={isListening}
      question={question}
      onFollowUpQuestion={onFollowUpQuestion}
    />
  );
}

/**
 * 新しい並列生成フロー用のResultView
 * 
 * Progressive Loading UXを実現:
 * - 最初のペアの画像と音声はサーバー側で生成済み
 * - 残りのペアはバックグラウンドで順次生成
 * - 音声キャッシュにより即座に再生可能
 */
function ParallelResultView({ response, agent, onStartListening, isListening, question, onFollowUpQuestion }: ResultViewProps) {
  // 状態管理
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pairs, setPairs] = useState<SentenceImagePair[]>(response.pairs || []);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const currentPair = pairs[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === pairs.length - 1;
  const followUpQuestions = response.followUpQuestions || [];

  // 音声キャッシュ（HTMLAudioElementを保持）
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 初期化: 最初のペアの音声をキャッシュ
  useEffect(() => {
    const firstPair = pairs[0];
    if (firstPair?.audioData && !audioCache.current.has(firstPair.id)) {
      const audioUrl = `data:audio/wav;base64,${firstPair.audioData}`;
      const audio = new Audio(audioUrl);
      audioCache.current.set(firstPair.id, audio);
      console.log(`[DEBUG] First pair audio cached from server`);
    }
  }, []);

  // バックグラウンド画像生成
  useBackgroundImageGenerator(pairs, (pairId, imageUrl, status) => {
    setPairs(prev => prev.map(p =>
      p.id === pairId
        ? { ...p, imageUrl, status, generatedAt: new Date() }
        : p
    ));
  });

  // バックグラウンド音声生成
  useBackgroundAudioGenerator(pairs, (pairId, audioData) => {
    // ペアの音声データを更新
    setPairs(prev => prev.map(p =>
      p.id === pairId ? { ...p, audioData } : p
    ));
    
    // 音声データをキャッシュ
    if (audioData) {
      const audioUrl = `data:audio/wav;base64,${audioData}`;
      const audio = new Audio(audioUrl);
      audioCache.current.set(pairId, audio);
      console.log(`[DEBUG] Audio cached for ${pairId}`);
    }
  });

  /**
   * 音声を再生する
   * キャッシュがあれば即座に再生、なければ音声生成を待機
   * 音声生成に失敗した場合のみWeb Speech APIでフォールバック
   */
  const playAudio = useCallback(async (pair: SentenceImagePair) => {
    // 現在再生中の音声を停止
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    // キャッシュから音声を取得
    let cachedAudio = audioCache.current.get(pair.id);
    
    // キャッシュにないが音声データがある場合は作成
    if (!cachedAudio && pair.audioData) {
      const audioUrl = `data:audio/wav;base64,${pair.audioData}`;
      cachedAudio = new Audio(audioUrl);
      audioCache.current.set(pair.id, cachedAudio);
      console.log(`[DEBUG] Created audio from pair.audioData for ${pair.id}`);
    }

    // 音声データがまだない場合は待機（最大30秒）
    if (!cachedAudio) {
      console.log(`[DEBUG] Audio not ready for ${pair.id}, waiting for generation...`);
      setIsSpeaking(true); // ローディング状態を表示
      
      const maxWaitTime = 30000; // 最大30秒待機（レート制限を考慮）
      const checkInterval = 500; // 500msごとにチェック
      let waited = 0;
      
      while (waited < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
        
        // キャッシュを再チェック
        cachedAudio = audioCache.current.get(pair.id);
        if (cachedAudio) {
          console.log(`[DEBUG] Audio ready for ${pair.id} after ${waited}ms`);
          break;
        }
        
        // 進捗をログ出力（5秒ごと）
        if (waited % 5000 === 0) {
          console.log(`[DEBUG] Still waiting for audio ${pair.id}... (${waited / 1000}s)`);
        }
      }
      
      // 待機後もまだない場合はフォールバック
      if (!cachedAudio) {
        console.warn(`[WARN] Audio generation timeout for ${pair.id} after ${maxWaitTime / 1000}s, using Web Speech API fallback`);
        fallbackToWebSpeech(pair.text);
        return;
      }
    }

    // キャッシュから再生
    cachedAudio.currentTime = 0;
    currentAudioRef.current = cachedAudio;
    setIsSpeaking(true);
    
    cachedAudio.onended = () => {
      setIsSpeaking(false);
      currentAudioRef.current = null;
      // 音声終了時の自動進行
      if (currentIndex < pairs.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // 最後のステップ → 深掘り質問を表示
        setShowFollowUp(true);
      }
    };
    
    cachedAudio.onerror = (e) => {
      console.error('Audio playback error:', e);
      setIsSpeaking(false);
      currentAudioRef.current = null;
    };
    
    try {
      await cachedAudio.play();
    } catch (err) {
      console.error('Audio play failed:', err);
      setIsSpeaking(false);
      currentAudioRef.current = null;
    }
  }, [currentIndex, pairs.length]);

  /**
   * Web Speech APIでフォールバック再生
   */
  const fallbackToWebSpeech = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9;
      setIsSpeaking(true);
      
      utterance.onend = () => {
        setIsSpeaking(false);
        if (currentIndex < pairs.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      };
      
      utterance.onerror = () => {
        setIsSpeaking(false);
      };
      
      window.speechSynthesis.speak(utterance);
    }
  }, [currentIndex, pairs.length]);

  /**
   * 音声を停止する
   */
  const stopAudio = useCallback(() => {
    // HTMLAudioElementを停止
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    // Web Speech APIを停止
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ペア変更時に自動的に音声再生
  useEffect(() => {
    // まず停止してから再生
    stopAudio();
    
    // 少し遅延を入れて確実に停止してから再生
    const timer = setTimeout(() => {
      if (currentPair) {
        playAudio(currentPair);
      }
    }, 50);
    
    return () => {
      clearTimeout(timer);
      stopAudio();
    };
  }, [currentIndex]); // currentIndexのみに依存

  // ナビゲーション
  const handleNext = () => {
    if (!isLast) {
      stopAudio();
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirst) {
      stopAudio();
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleReplay = () => {
    stopAudio();
    setCurrentIndex(0);
  };

  const handleNewQuestion = () => {
    window.location.reload();
  };

  // 最後のステップの音声が終わったら深掘り質問を表示
  const handleLastStepEnd = useCallback(() => {
    if (isLast) {
      setShowFollowUp(true);
    }
  }, [isLast]);

  // 控えめな装飾
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

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50/20">

      {/* 控えめな浮遊装飾 */}
      {decorations.map((deco) => (
        <motion.div
          key={deco.id}
          className="absolute text-xl md:text-2xl opacity-20 pointer-events-none"
          style={{ left: `${deco.left}%`, top: `${deco.top}%` }}
          animate={{ y: [0, -20, 0], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: deco.duration, repeat: Infinity, delay: deco.delay, ease: "easeInOut" }}
        >
          {deco.icon}
        </motion.div>
      ))}

      <div className="relative z-10 flex flex-col h-full">
        {/* 質問表示 */}
        {question && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="px-2 sm:px-3 pt-1.5 sm:pt-2 md:px-4 md:pt-3"
          >
            <div className="max-w-2xl mx-auto bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 border-2 border-blue-300 shadow-md">
              <p className="text-[10px] sm:text-xs text-blue-600 font-bold mb-0.5">きみのしつもん</p>
              <p className="text-xs sm:text-sm md:text-base text-blue-900 font-bold break-words leading-relaxed">{question}</p>
            </div>
          </motion.div>
        )}

        {/* 進捗インジケーター */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2">
          {pairs.map((_, i) => (
            <motion.div
              key={i}
              className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'w-5 sm:w-6 bg-blue-500' : i < currentIndex ? 'w-1.5 sm:w-2 bg-blue-300' : 'w-1.5 sm:w-2 bg-slate-200'
              }`}
              animate={i === currentIndex ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          ))}
          <span className="text-[10px] sm:text-xs text-slate-500 ml-1.5 sm:ml-2">{currentIndex + 1}/{pairs.length}</span>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 px-2 sm:px-3 md:px-4 flex flex-col items-center overflow-y-auto pb-4">
          {/* 画像表示 */}
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-[95%] sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px] aspect-square sm:aspect-[4/3] bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 sm:border-3 border-slate-200 p-0.5 sm:p-1 overflow-hidden"
          >
            {currentPair.status === 'ready' && currentPair.imageUrl && (
              <img
                src={currentPair.imageUrl}
                alt={`ステップ ${currentPair.stepNumber}`}
                className="w-full h-full object-contain rounded-xl"
              />
            )}
            {currentPair.status === 'generating' && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-blue-500 mx-auto mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-slate-500">えをかいているよ...</p>
                </div>
              </div>
            )}
            {currentPair.status === 'error' && (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg sm:rounded-xl">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🖼️</div>
                  <p className="text-xs sm:text-sm text-slate-500">画像を読み込めませんでした</p>
                </div>
              </div>
            )}
            {currentPair.status === 'pending' && (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg sm:rounded-xl">
                <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-slate-300" />
              </div>
            )}
          </motion.div>

          {/* 博士アバター + 吹き出し */}
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-end gap-2 md:gap-3 w-full max-w-[95%] sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px] mt-2 sm:mt-3"
          >
            <div className="flex flex-col items-center shrink-0">
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 md:h-14 md:w-14 border-2 border-blue-400 bg-white shadow-md">
                  <AvatarImage src={`/avatars/${response.agentId}.png`} alt={agent.nameJa} />
                  <AvatarFallback>{agent.nameJa[0]}</AvatarFallback>
                </Avatar>
              </motion.div>
              <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-600 mt-0.5">{agent.nameJa}</span>
            </div>

            <div className="flex-1 bg-white rounded-xl sm:rounded-2xl rounded-bl-none p-2.5 sm:p-3 md:p-4 border-2 border-blue-200 shadow-md relative min-h-[60px] sm:min-h-[80px] max-h-[120px] sm:max-h-[160px] md:max-h-[200px] overflow-y-auto">
              <p className="text-xs sm:text-sm md:text-base leading-relaxed pr-6 sm:pr-7">{currentPair.text}</p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 text-slate-400 hover:text-blue-500 h-6 w-6 sm:h-7 sm:w-7"
                onClick={() => { stopAudio(); playAudio(currentPair); }}
                disabled={isSpeaking}
              >
                <Volume2 className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isSpeaking ? "animate-pulse text-blue-500" : ""}`} />
              </Button>
            </div>
          </motion.div>

          {/* ナビゲーションボタン */}
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex gap-2 sm:gap-3 mt-3 sm:mt-4"
          >
            {!isFirst && (
              <Button onClick={handlePrevious} variant="outline" size="default" className="gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 text-xs sm:text-sm min-h-[40px]">
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                もどる
              </Button>
            )}
            {!isLast && (
              <Button onClick={handleNext} variant="default" size="default" className="gap-1 sm:gap-1.5 rounded-full px-4 sm:px-6 bg-blue-500 hover:bg-blue-600 text-xs sm:text-sm min-h-[40px]">
                つぎへ
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            )}
            {isLast && !showFollowUp && (
              <>
                <Button onClick={handleReplay} variant="outline" size="default" className="gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 text-xs sm:text-sm min-h-[40px]">
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  もういちど
                </Button>
                <Button onClick={() => setShowFollowUp(true)} variant="default" size="default" className="rounded-full px-4 sm:px-6 bg-blue-500 hover:bg-blue-600 text-xs sm:text-sm min-h-[40px]">
                  おわり ✨
                </Button>
              </>
            )}
          </motion.div>

          {/* 深掘り質問セクション */}
          {showFollowUp && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="w-full max-w-[95%] sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px] mt-4 sm:mt-6 mb-4"
            >
              {followUpQuestions.length > 0 && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-yellow-200 shadow-md">
                  <p className="text-xs sm:text-sm font-bold text-orange-700 mb-2 sm:mb-3 flex items-center gap-1.5">
                    💡 もっとしりたい？
                  </p>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    {followUpQuestions.map((fq, i) => (
                      <motion.button
                        key={i}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 * i }}
                        onClick={() => onFollowUpQuestion?.(fq.question)}
                        className="flex items-center gap-1.5 sm:gap-2 bg-white hover:bg-blue-50 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 border border-slate-200 hover:border-blue-300 transition-all text-left shadow-sm hover:shadow-md active:scale-[0.98]"
                      >
                        <span className="text-base sm:text-lg shrink-0">{fq.emoji}</span>
                        <span className="text-xs sm:text-sm md:text-base text-slate-700 leading-snug flex-1">{fq.question}</span>
                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* 新しい質問ボタン */}
              <div className="flex justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                <Button onClick={handleReplay} variant="outline" size="default" className="gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 text-xs sm:text-sm min-h-[40px]">
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  もういちど
                </Button>
                <Button onClick={handleNewQuestion} variant="default" size="default" className="rounded-full px-4 sm:px-6 bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 border-0 text-xs sm:text-sm min-h-[40px]">
                  🎤 あたらしいしつもん
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 既存の逐次生成フロー用のResultView（後方互換性）
 */
function LegacyResultView({ response, agent, onStartListening, isListening, question, onFollowUpQuestion }: ResultViewProps) {
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
            className="p-1.5 sm:p-2 md:p-3 pb-0"
          >
            <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl md:rounded-3xl px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 border-2 md:border-3 border-blue-300 shadow-md">
              <p className="text-[10px] sm:text-xs md:text-sm text-blue-600 font-bold mb-0.5">きみのしつもん</p>
              <p className="text-xs sm:text-sm md:text-lg text-blue-900 font-bold break-words">{question}</p>
            </div>
          </motion.div>
        )}

        {/* Main Content - Scrollable */}
        <div className="flex-1 p-1.5 sm:p-2 md:p-4 flex flex-col items-center overflow-y-auto pb-20 sm:pb-24 md:pb-28">
          {/* Grid */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-full max-w-[98%] sm:max-w-[95%] md:max-w-[1000px] aspect-[3/4] md:aspect-[4/3] bg-white rounded-xl sm:rounded-2xl md:rounded-3xl shadow-xl border-2 sm:border-4 md:border-6 border-slate-800 p-0.5 sm:p-1 md:p-2 mt-1 sm:mt-2 md:mt-4"
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
            className="flex items-end gap-2 md:gap-4 max-w-[98%] sm:max-w-[95%] md:max-w-[1000px] w-full mt-3 sm:mt-4 md:mt-6 mb-4"
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
                <Avatar className={`h-10 w-10 sm:h-12 sm:w-12 md:h-20 md:w-20 border-2 sm:border-3 md:border-4 border-${agent.color || 'blue'}-500 bg-white shadow-lg`}>
                  <AvatarImage src={`/avatars/${response.agentId}.png`} alt={agent.nameJa} />
                  <AvatarFallback>{agent.nameJa[0]}</AvatarFallback>
                </Avatar>
              </motion.div>
              <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-700 mt-0.5 sm:mt-1">{agent.nameJa}</span>
            </div>

            {/* Bubble */}
            <motion.div
              className="flex-1 bg-white rounded-xl sm:rounded-2xl md:rounded-3xl rounded-bl-none p-2.5 sm:p-3 md:p-6 border-2 md:border-3 border-blue-200 shadow-lg relative min-h-24 sm:min-h-32 md:min-h-48 max-h-36 sm:max-h-48 md:max-h-64 overflow-y-auto"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-spin" />
                  <span className="text-[10px] sm:text-xs md:text-sm">音声を準備しています...</span>
                </div>
              ) : (
                <div className="text-xs sm:text-sm md:text-base">
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
                className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 md:top-2 md:right-2 text-slate-400 hover:text-blue-500 h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8"
                onClick={handleReplay}
                disabled={isSpeaking || isLoading}
              >
                <Volume2 className={`h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 ${isSpeaking ? "animate-pulse text-blue-500" : ""}`} />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
