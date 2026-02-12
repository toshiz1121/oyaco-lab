import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AgentResponse, SentenceImagePair } from '@/lib/agents/types';
import { Agent } from '@/lib/agents/types';
import { useBackgroundPairGenerator } from '@/hooks/useBackgroundPairGenerator';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ResultViewProps {
  response: AgentResponse;
  agent: Agent;
  question?: string;
  onFollowUpQuestion?: (question: string) => void;
}

export function ResultView({ response, agent, question, onFollowUpQuestion }: ResultViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pairs, setPairs] = useState<SentenceImagePair[]>(response.pairs || []);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWaitingForAudio, setIsWaitingForAudio] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const currentPair = pairs[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === pairs.length - 1;
  const followUpQuestions = response.followUpQuestions || [];

  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 初期化: 最初のペアの音声をキャッシュ
  useEffect(() => {
    const firstPair = pairs[0];
    if (firstPair?.audioData && !audioCache.current.has(firstPair.id)) {
      const audioUrl = `data:audio/wav;base64,${firstPair.audioData}`;
      const audio = new Audio(audioUrl);
      audioCache.current.set(firstPair.id, audio);
    }
  }, []);

  // バックグラウンドで次のステップの音声を先読み生成
  useBackgroundPairGenerator(pairs, currentIndex, response.agentId, (pairId, updates) => {
    setPairs(prev => prev.map(p => {
      if (p.id !== pairId) return p;
      return {
        ...p,
        ...(updates.audioData !== undefined ? { audioData: updates.audioData } : {}),
        ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.status === 'ready' ? { generatedAt: new Date().toISOString() } : {}),
      };
    }));

    if (updates.audioData) {
      const audioUrl = `data:audio/wav;base64,${updates.audioData}`;
      const audio = new Audio(audioUrl);
      audioCache.current.set(pairId, audio);
    }
  });

  /**
   * TTS音声を再生する
   * キャッシュがあれば即再生、なければ生成完了まで待機
   */
  const playAudio = useCallback(async (pair: SentenceImagePair) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }

    let cachedAudio = audioCache.current.get(pair.id);

    if (!cachedAudio && pair.audioData) {
      const audioUrl = `data:audio/wav;base64,${pair.audioData}`;
      cachedAudio = new Audio(audioUrl);
      audioCache.current.set(pair.id, cachedAudio);
    }

    // 音声がまだない場合は待機（最大30秒）
    if (!cachedAudio) {
      setIsWaitingForAudio(true);
      const maxWait = 30000;
      const interval = 500;
      let waited = 0;

      while (waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, interval));
        waited += interval;
        cachedAudio = audioCache.current.get(pair.id);
        if (cachedAudio) break;
      }

      setIsWaitingForAudio(false);

      if (!cachedAudio) {
        console.warn(`[WARN] TTS timeout for ${pair.id}`);
        return;
      }
    }

    cachedAudio.currentTime = 0;
    currentAudioRef.current = cachedAudio;
    setIsSpeaking(true);

    cachedAudio.onended = () => {
      setIsSpeaking(false);
      currentAudioRef.current = null;
      if (currentIndex < pairs.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setShowFollowUp(true);
      }
    };

    cachedAudio.onerror = () => {
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

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // ペア変更時に自動再生
  useEffect(() => {
    stopAudio();
    const timer = setTimeout(() => {
      if (currentPair) playAudio(currentPair);
    }, 50);
    return () => { clearTimeout(timer); stopAudio(); };
  }, [currentIndex]);

  const handleNext = () => { if (!isLast) { stopAudio(); setCurrentIndex(prev => prev + 1); } };
  const handlePrevious = () => { if (!isFirst) { stopAudio(); setCurrentIndex(prev => prev - 1); } };
  const handleReplay = () => { stopAudio(); setCurrentIndex(0); };
  const handleNewQuestion = () => { window.location.reload(); };

  const decorations = useMemo(() =>
    [...Array(3)].map((_, i) => ({
      id: i, left: 20 + i * 30, top: 15 + i * 20,
      duration: 8 + i * 2, delay: i * 3,
      icon: ['✨', '🌟', '💫'][i]
    })), []
  );

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50/20">
      {decorations.map((deco) => (
        <motion.div key={deco.id} className="absolute text-xl md:text-2xl opacity-20 pointer-events-none"
          style={{ left: `${deco.left}%`, top: `${deco.top}%` }}
          animate={{ y: [0, -20, 0], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: deco.duration, repeat: Infinity, delay: deco.delay, ease: "easeInOut" }}
        >{deco.icon}</motion.div>
      ))}

      <div className="relative z-10 flex flex-col h-full">
        {/* 質問表示 */}
        {question && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="px-2 sm:px-3 pt-1.5 sm:pt-2 md:px-4 md:pt-3">
            <div className="max-w-2xl mx-auto bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 border-2 border-blue-300 shadow-md">
              <p className="text-[10px] sm:text-xs text-blue-600 font-bold mb-0.5">きみのしつもん</p>
              <p className="text-xs sm:text-sm md:text-base text-blue-900 font-bold break-words leading-relaxed">{question}</p>
            </div>
          </motion.div>
        )}

        {/* 進捗インジケーター */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2">
          {pairs.map((_, i) => (
            <motion.div key={i}
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
          {/* 4パネル結合画像表示 */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className={`w-full sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px] aspect-square sm:aspect-[4/3] bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 sm:border-3 border-slate-200 p-0.5 sm:p-1 overflow-hidden relative ${
              showFollowUp ? 'max-w-[95%]' : 'max-w-full'
            }`}
          >
            {response.combinedImageUrl ? (
              <>
                <img src={response.combinedImageUrl} alt="4パネル解説イラスト"
                  className="w-full h-full object-contain rounded-xl" />
                {/* 現在のパネルをハイライトするオーバーレイ */}
                <div className="absolute inset-0.5 sm:inset-1 grid grid-cols-2 grid-rows-2 rounded-xl pointer-events-none">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div key={i}
                      className={`border-2 sm:border-3 rounded-sm transition-all duration-300 ${
                        i === currentIndex
                          ? 'border-blue-500 bg-transparent shadow-[inset_0_0_0_2px_rgba(59,130,246,0.3)]'
                          : 'border-transparent bg-black/30'
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : currentPair.status === 'generating' ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-blue-500 mx-auto mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-slate-500">えをかいているよ...</p>
                </div>
              </div>
            ) : currentPair.status === 'error' ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg sm:rounded-xl">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🖼️</div>
                  <p className="text-xs sm:text-sm text-slate-500">画像を読み込めませんでした</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg sm:rounded-xl">
                <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-slate-300" />
              </div>
            )}
          </motion.div>

          {/* 博士アバター + 吹き出し */}
          <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className={`flex items-end gap-2 md:gap-3 w-full sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px] mt-2 sm:mt-3 ${
              showFollowUp ? 'max-w-[95%]' : 'max-w-full'
            }`}>
            <div className="flex flex-col items-center shrink-0">
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <Avatar className="h-15 w-15 sm:h-15 sm:w-15 md:h-20 md:w-20 border-2 border-blue-400 bg-white shadow-md">
                  <AvatarImage src={`/avatars/${response.agentId}.png`} alt={agent.nameJa} />
                  <AvatarFallback>{agent.nameJa[0]}</AvatarFallback>
                </Avatar>
              </motion.div>
              <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-600 mt-0.5">{agent.nameJa}</span>
            </div>

            <div className={`flex-1 bg-white rounded-xl sm:rounded-2xl rounded-bl-none p-2.5 sm:p-3 md:p-4 border-2 border-blue-200 shadow-md relative overflow-y-auto ${
              showFollowUp ? 'min-h-[60px] sm:min-h-[80px] max-h-[120px] sm:max-h-[160px] md:max-h-[200px]' : 'min-h-[80px] sm:min-h-[80px] max-h-[160px] sm:max-h-[160px] md:max-h-[200px]'
            }`}>
              <p className="text-xs sm:text-sm md:text-base leading-relaxed pr-6 sm:pr-7">{currentPair.text}</p>

              {isWaitingForAudio && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 mt-1.5 text-blue-500">
                  <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                  <span className="text-[10px] sm:text-xs font-medium">おんせいをじゅんびちゅう...</span>
                </motion.div>
              )}

              <Button variant="ghost" size="icon"
                className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 text-slate-400 hover:text-blue-500 h-6 w-6 sm:h-7 sm:w-7"
                onClick={() => { stopAudio(); playAudio(currentPair); }}
                disabled={isSpeaking || isWaitingForAudio}>
                <Volume2 className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isSpeaking ? "animate-pulse text-blue-500" : ""}`} />
              </Button>
            </div>
          </motion.div>

          {/* ナビゲーション */}
          <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
            className="flex gap-2 sm:gap-3 mt-6 sm:mt-4">
            {!isFirst && (
              <Button onClick={handlePrevious} variant="outline" size="default"
                className="gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 text-xs sm:text-sm min-h-[40px]">
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> もどる
              </Button>
            )}
            {!isLast && (
              <Button onClick={handleNext} variant="default" size="default"
                className="gap-1 sm:gap-1.5 rounded-full px-4 sm:px-6 bg-blue-500 hover:bg-blue-600 text-xs sm:text-sm min-h-[40px]">
                つぎへ <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            )}
            {isLast && !showFollowUp && (
              <>
                <Button onClick={handleReplay} variant="outline" size="default"
                  className="gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 text-xs sm:text-sm min-h-[40px]">
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> もういちど
                </Button>
                <Button onClick={() => setShowFollowUp(true)} variant="default" size="default"
                  className="rounded-full px-4 sm:px-6 bg-blue-500 hover:bg-blue-600 text-xs sm:text-sm min-h-[40px]">
                  おわり ✨
                </Button>
              </>
            )}
          </motion.div>

          {/* 深掘り質問 */}
          {showFollowUp && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="w-full max-w-[95%] sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px] mt-4 sm:mt-6 mb-4">
              {followUpQuestions.length > 0 && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-yellow-200 shadow-md">
                  <p className="text-xs sm:text-sm font-bold text-orange-700 mb-2 sm:mb-3 flex items-center gap-1.5">
                    💡 もっとしりたい？
                  </p>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    {followUpQuestions.map((fq, i) => (
                      <motion.button key={i}
                        initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 * i }}
                        onClick={() => onFollowUpQuestion?.(fq.question)}
                        className="flex items-center gap-1.5 sm:gap-2 bg-white hover:bg-blue-50 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 border border-slate-200 hover:border-blue-300 transition-all text-left shadow-sm hover:shadow-md active:scale-[0.98]">
                        <span className="text-base sm:text-lg shrink-0">{fq.emoji}</span>
                        <span className="text-xs sm:text-sm md:text-base text-slate-700 leading-snug flex-1">{fq.question}</span>
                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                <Button onClick={handleReplay} variant="outline" size="default"
                  className="gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 text-xs sm:text-sm min-h-[40px]">
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> もういちど
                </Button>
                <Button onClick={handleNewQuestion} variant="default" size="default"
                  className="rounded-full px-4 sm:px-6 bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 border-0 text-xs sm:text-sm min-h-[40px]">
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
