"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Agent } from "@/lib/agents/types";
import { funFacts } from "@/data/funFacts";
import { miniQuizzes } from "@/data/miniQuizzes";

interface ImageGeneratingViewProps {
  agent: Agent;
  question: string;
  progress?: number;
  isAudioGenerating?: boolean;
  audioProgress?: number;
}

const getProgressMessage = (progress: number): string => {
  if (progress < 20) return "かんがえているよ...";
  if (progress < 40) return "えをかきはじめたよ！";
  if (progress < 60) return "いろをぬっているよ...";
  if (progress < 80) return "もうすこしだよ！";
  if (progress < 95) return "さいごのしあげ...";
  return "できあがり！";
};

export function ImageGeneratingView({ 
  agent, 
  question, 
  progress = 0,
  isAudioGenerating = false,
  audioProgress = 0
}: ImageGeneratingViewProps) {
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [displayAudioProgress, setDisplayAudioProgress] = useState(0);
  const [quizIndex, setQuizIndex] = useState(() => Math.floor(Math.random() * miniQuizzes.length));
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);

  // 豆知識の表示を管理
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // 画像進捗表示を管理する
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayProgress((prev) => prev < progress ? Math.min(prev + 1, progress) : prev);
    }, 50);
    return () => clearInterval(timer);
  }, [progress]);

  // 音声進捗表示を管理する
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayAudioProgress((prev) => prev < audioProgress ? Math.min(prev + 1, audioProgress) : prev);
    }, 50);
    return () => clearInterval(timer);
  }, [audioProgress]);

  // 背景の泡（数を減らして軽量化）
  const bubbles = useMemo(() => 
    [...Array(5)].map((_, i) => ({
      id: i,
      size: 25 + Math.random() * 30,
      left: 10 + (i * 18),
      duration: 6 + Math.random() * 4,
      delay: i * 1.2,
    })), []
  );

  const currentFact = funFacts[currentFactIndex]; // 前知識
  const quiz = miniQuizzes[quizIndex]; // クイズ

  return (
    <div className="relative w-full h-full min-h-screen bg-gradient-to-b from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
      
      {/* 背景の泡 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {bubbles.map((bubble) => (
          <motion.div key={bubble.id}
            className="absolute rounded-full bg-gradient-to-br from-blue-200/30 to-purple-200/30"
            style={{ width: bubble.size, height: bubble.size, left: `${bubble.left}%`, bottom: -50 }}
            animate={{ y: [-50, -600], opacity: [0, 0.5, 0] }}
            transition={{ duration: bubble.duration, repeat: Infinity, delay: bubble.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* コンテンツ */}
      <div className="relative z-10 w-full h-full flex items-center justify-center px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-10">
        <div className="flex flex-col items-center justify-center w-full max-w-2xl h-full gap-4 sm:gap-5 md:gap-6">

          {/* 質問内容 */}
          <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
            className="w-full">
            <p className="text-xs sm:text-sm text-purple-600 font-bold mb-2 text-center">きみのしつもん</p>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl px-4 sm:px-5 md:px-6 py-3 sm:py-4 border-2 border-purple-200 shadow-md">
              <p className="text-sm sm:text-base md:text-lg text-purple-900 font-bold break-words text-center leading-relaxed">{question}</p>
            </div>
          </motion.div>

          {/* 博士アバター + メッセージ*/}
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-4 sm:gap-5 md:gap-6 w-full">
            
            {/* 博士アバター */}
            <div className="relative shrink-0">
              <motion.div animate={{ y: [0, -5, 0], rotate: [-2, 2, -2] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border-3 border-white shadow-xl bg-white">
                  <Image src={agent.avatar} alt={agent.nameJa} fill className="object-cover" />
                </div>
                <motion.div className="absolute -right-1 -bottom-0.5 text-2xl sm:text-3xl"
                  animate={{ rotate: [-15, 15, -15], x: [-2, 2, -2] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}>
                  🖌️
                </motion.div>
                {isAudioGenerating && (
                  <motion.div className="absolute -left-1 -top-0.5 text-xl sm:text-2xl"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}>
                    🎤
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* 博士名 + 進捗メッセージ */}
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-purple-700 mb-1">{agent.nameJa}</h2>
              <motion.p animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-sm sm:text-base md:text-lg font-bold text-pink-600">
                🎨 {getProgressMessage(displayProgress)}
              </motion.p>
            </div>
          </motion.div>

          {/* 進捗バー */}
          <div className="w-full">
            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs sm:text-sm font-bold text-purple-600">🎨 えをかいているよ</span>
                <span className="text-xs sm:text-sm font-bold text-purple-700">{Math.floor(displayProgress)}%</span>
              </div>
              <div className="relative h-4 sm:h-5 md:h-6 bg-white/80 rounded-full overflow-hidden border-2 border-purple-200 shadow-inner">
                <motion.div className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: "linear-gradient(90deg, #f472b6, #c084fc, #60a5fa, #34d399, #fbbf24, #f472b6)", backgroundSize: "200% 100%" }}
                  animate={{ width: `${displayProgress}%`, backgroundPosition: ["0% 0%", "100% 0%"] }}
                  transition={{ width: { duration: 0.3 }, backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" } }}
                />
              </div>
            </div>

            <AnimatePresence>
              {isAudioGenerating && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs sm:text-sm font-bold text-green-600 flex items-center gap-1">
                      <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1, repeat: Infinity }}>🎵</motion.span>
                      こえをつくっているよ
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-green-700">{Math.floor(displayAudioProgress)}%</span>
                  </div>
                  <div className="relative h-4 sm:h-5 md:h-6 bg-white/80 rounded-full overflow-hidden border-2 border-green-200 shadow-inner">
                    <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400"
                      animate={{ width: `${displayAudioProgress}%` }}
                      transition={{ width: { duration: 0.3 } }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ミニクイズ */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5 border-2 border-blue-300 shadow-lg">
            <p className="text-xs sm:text-sm text-blue-600 font-bold mb-2 flex items-center gap-2">
              <span>🧠</span> まっているあいだにクイズ！
            </p>
            <p className="text-sm sm:text-base md:text-lg text-slate-800 font-bold mb-3 flex items-center gap-2">
              <span className="text-lg sm:text-xl md:text-2xl">{quiz.emoji}</span>
              <span className="leading-relaxed">{quiz.question}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {quiz.choices.map((choice, i) => (
                <motion.button key={i} whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setQuizAnswer(i);
                    setTimeout(() => { setQuizAnswer(null); setQuizIndex(prev => (prev + 1) % miniQuizzes.length); }, 2000);
                  }}
                  disabled={quizAnswer !== null}
                  className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl text-sm sm:text-base font-bold border-2 transition-all ${
                    quizAnswer === null
                      ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 active:scale-95'
                      : i === quiz.answer
                        ? 'bg-green-100 border-green-400 text-green-700'
                        : quizAnswer === i
                          ? 'bg-red-100 border-red-300 text-red-600'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                  {choice}
                  {quizAnswer !== null && i === quiz.answer && ' ⭕'}
                  {quizAnswer === i && i !== quiz.answer && ' ❌'}
                </motion.button>
              ))}
            </div>
            {quizAnswer !== null && (
              <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`text-xs sm:text-sm mt-2.5 font-bold text-center ${
                  quizAnswer === quiz.answer ? 'text-green-600' : 'text-orange-600'
                }`}>
                {quizAnswer === quiz.answer ? '🎉 せいかい！すごいね！' : '😊 おしい！つぎはがんばろう！'}
              </motion.p>
            )}
          </motion.div>

          {/* 豆知識 */}
          <AnimatePresence mode="wait">
            <motion.div key={currentFactIndex}
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4 }}
              className="w-full bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5 border-2 border-yellow-300 shadow-lg">
              <p className="text-xs sm:text-sm text-yellow-600 font-bold mb-2 flex items-center gap-2">
                <span>💡</span> まめちしき
              </p>
              <p className="text-sm sm:text-base md:text-lg text-slate-700 font-medium flex items-start gap-2 leading-relaxed">
                <span className="text-lg sm:text-xl md:text-2xl shrink-0">{currentFact.emoji}</span>
                <span>{currentFact.text}</span>
              </p>
            </motion.div>
          </AnimatePresence>

          {/* 励ましメッセージ + ドット */}
          <div className="text-center">
            <motion.p animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-sm sm:text-base md:text-lg font-bold text-purple-600 mb-3">
              ✨ たのしみにまっててね！ ✨
            </motion.p>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div key={i}
                  className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-400"
                  animate={{ y: [0, -8, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
