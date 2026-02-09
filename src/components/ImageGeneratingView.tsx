"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Agent } from "@/lib/agents/types";

interface ImageGeneratingViewProps {
  agent: Agent;
  question: string;
  progress?: number;
  isAudioGenerating?: boolean;
  audioProgress?: number;
}

// 豆知識データ
const funFacts = [
  { emoji: "🌈", text: "にじは太陽の光が水のつぶにあたってできるんだよ！" },
  { emoji: "🦋", text: "チョウチョのはねには小さなうろこがたくさんあるよ！" },
  { emoji: "🌙", text: "月は毎年3センチずつ地球からはなれているんだって！" },
  { emoji: "🐘", text: "ゾウは人間の4倍もよく音がきこえるんだよ！" },
  { emoji: "⭐", text: "夜空に見える星は、何百年も前の光なんだよ！" },
  { emoji: "🌊", text: "海の水がしょっぱいのは、岩からとけた塩のせいだよ！" },
  { emoji: "🦖", text: "恐竜は6600万年前まで地球にいたんだよ！" },
  { emoji: "🌸", text: "花のいいにおいは、虫をよぶためなんだって！" },
  { emoji: "❄️", text: "雪の結晶は、ぜんぶちがう形をしているんだよ！" },
  { emoji: "🔥", text: "太陽の温度は、なんと6000度もあるんだよ！" },
];

// 進捗に応じたメッセージ
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

  // 豆知識を定期的に切り替え
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // 進捗のスムーズなアニメーション
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < progress) {
          return Math.min(prev + 1, progress);
        }
        return prev;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [progress]);

  // 音声進捗のスムーズなアニメーション
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayAudioProgress((prev) => {
        if (prev < audioProgress) {
          return Math.min(prev + 1, audioProgress);
        }
        return prev;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [audioProgress]);

  // 背景の泡
  const bubbles = useMemo(() => 
    [...Array(8)].map((_, i) => ({
      id: i,
      size: 30 + Math.random() * 40,
      left: 10 + (i * 12),
      duration: 6 + Math.random() * 4,
      delay: i * 0.8,
    })), []
  );

  // キラキラ
  const sparkles = useMemo(() => 
    [...Array(6)].map((_, i) => ({
      id: i,
      left: 15 + i * 14,
      top: 20 + (i % 3) * 25,
      duration: 3 + Math.random() * 2,
      delay: i * 0.5,
    })), []
  );

  const currentFact = funFacts[currentFactIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px] md:min-h-[600px] w-full rounded-2xl sm:rounded-3xl shadow-xl border-2 sm:border-4 border-blue-100 p-3 sm:p-4 md:p-8 relative overflow-hidden bg-gradient-to-b from-purple-50 via-blue-50 to-pink-50">
      
      {/* 背景の泡 */}
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full bg-gradient-to-br from-blue-200/30 to-purple-200/30"
          style={{
            width: bubble.size,
            height: bubble.size,
            left: `${bubble.left}%`,
            bottom: -50,
          }}
          animate={{
            y: [-50, -800],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: bubble.duration,
            repeat: Infinity,
            delay: bubble.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* キラキラエフェクト */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute text-lg sm:text-xl md:text-2xl pointer-events-none"
          style={{
            left: `${sparkle.left}%`,
            top: `${sparkle.top}%`,
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [0.8, 1.2, 0.8],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: sparkle.duration,
            repeat: Infinity,
            delay: sparkle.delay,
          }}
        >
          ✨
        </motion.div>
      ))}

      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl">
        {/* 質問内容 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 sm:mb-4 md:mb-6 text-center w-full px-3 sm:px-4"
        >
          <p className="text-[10px] sm:text-xs md:text-sm text-purple-600 font-bold mb-1 sm:mb-2">
            きみのしつもん
          </p>
          <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl px-3 sm:px-4 md:px-6 py-2 md:py-3 border-2 sm:border-3 border-purple-200 shadow-lg">
            <p className="text-xs sm:text-sm md:text-lg text-purple-900 font-bold break-words">
              {question}
            </p>
          </div>
        </motion.div>

        {/* 博士アバター（絵を描いているアニメーション） */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-3 sm:mb-4 md:mb-6"
        >
          {/* 光の輪 */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-300/30 via-purple-300/30 to-blue-300/30 blur-xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          />

          {/* 博士 */}
          <motion.div
            animate={{
              y: [0, -8, 0],
              rotate: [-2, 2, -2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 md:w-40 md:h-40 rounded-full overflow-hidden border-3 sm:border-4 border-white shadow-xl bg-white">
              <Image
                src={agent.avatar}
                alt={agent.nameJa}
                fill
                className="object-cover"
              />
            </div>

            {/* マイクエフェクト（音声生成中） */}
            {isAudioGenerating && (
              <motion.div
                className="absolute -right-1 top-0 sm:-right-2 sm:top-0 md:-right-4 md:top-2 text-lg sm:text-2xl md:text-3xl"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: 1, 
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  scale: {
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                }}
              >
                🎤
              </motion.div>
            )}

            {/* 絵筆エフェクト */}
            <motion.div
              className="absolute -right-2 -bottom-1 sm:-right-4 sm:-bottom-2 md:-right-6 md:-bottom-4 text-2xl sm:text-3xl md:text-4xl"
              animate={{
                rotate: [-15, 15, -15],
                x: [-3, 3, -3],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              🖌️
            </motion.div>

            {/* パレットエフェクト */}
            <motion.div
              className="absolute -left-2 -bottom-1 sm:-left-4 sm:-bottom-2 md:-left-6 md:-bottom-4 text-xl sm:text-2xl md:text-3xl"
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            >
              🎨
            </motion.div>
          </motion.div>
        </motion.div>

        {/* 博士名とメッセージ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-3 sm:mb-4 md:mb-6"
        >
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-purple-700 mb-1 sm:mb-2">
            {agent.nameJa}
          </h2>
          <motion.p
            animate={{
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
            className="text-base sm:text-lg md:text-xl font-bold text-pink-600"
          >
            🎨 {getProgressMessage(displayProgress)}
          </motion.p>
        </motion.div>

        {/* 進捗バー */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-md px-3 sm:px-4 mb-3 sm:mb-4 md:mb-6"
        >
          {/* 画像生成プログレス */}
          <div className="mb-2 sm:mb-3">
            <div className="flex justify-between items-center mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs md:text-sm font-bold text-purple-600 flex items-center gap-1">
                🎨 えをかいているよ
              </span>
              <span className="text-[10px] sm:text-xs md:text-sm font-bold text-purple-700">
                {Math.floor(displayProgress)}%
              </span>
            </div>
            <div className="relative h-4 sm:h-5 md:h-6 bg-white/80 rounded-full overflow-hidden border-2 sm:border-3 border-purple-200 shadow-inner">
              {/* 虹色のプログレスバー */}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: "linear-gradient(90deg, #f472b6, #c084fc, #60a5fa, #34d399, #fbbf24, #f472b6)",
                  backgroundSize: "200% 100%",
                }}
                animate={{
                  width: `${displayProgress}%`,
                  backgroundPosition: ["0% 0%", "100% 0%"],
                }}
                transition={{
                  width: { duration: 0.3 },
                  backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" },
                }}
              />
            </div>
          </div>

          {/* 音声生成プログレス */}
          <AnimatePresence>
            {isAudioGenerating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-between items-center mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs md:text-sm font-bold text-green-600 flex items-center gap-1">
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      🎵
                    </motion.span>
                    こえをつくっているよ
                  </span>
                  <span className="text-[10px] sm:text-xs md:text-sm font-bold text-green-700">
                    {Math.floor(displayAudioProgress)}%
                  </span>
                </div>
                <div className="relative h-4 sm:h-5 md:h-6 bg-white/80 rounded-full overflow-hidden border-2 sm:border-3 border-green-200 shadow-inner">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400"
                    animate={{
                      width: `${displayAudioProgress}%`,
                    }}
                    transition={{
                      width: { duration: 0.3 },
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 豆知識 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFactIndex}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl md:rounded-3xl px-4 sm:px-5 md:px-8 py-3 sm:py-4 md:py-5 border-2 sm:border-3 border-yellow-300 shadow-lg max-w-md mx-3 sm:mx-4 mb-3 sm:mb-4 md:mb-6"
          >
            <p className="text-[10px] sm:text-xs md:text-sm text-yellow-600 font-bold mb-1 sm:mb-2 flex items-center gap-2">
              <span>💡</span> まめちしき
            </p>
            <p className="text-xs sm:text-sm md:text-base text-slate-700 font-medium flex items-start gap-2">
              <span className="text-lg sm:text-xl">{currentFact.emoji}</span>
              <span>{currentFact.text}</span>
            </p>
          </motion.div>
        </AnimatePresence>

        {/* 音声生成中の追加メッセージ */}
        {isAudioGenerating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl sm:rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-2 border-green-200 shadow-md max-w-md mx-3 sm:mx-4 mb-3 sm:mb-4"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  rotate: [0, 360]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="text-2xl"
              >
                🎙️
              </motion.div>
              <p className="text-[10px] sm:text-xs md:text-sm text-green-700 font-bold">
                {agent.nameJa}のこえをつくっているよ！
              </p>
            </div>
          </motion.div>
        )}

        {/* 励ましメッセージ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-3 sm:mt-4 md:mt-6"
        >
          <motion.p
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
            className="text-sm sm:text-base md:text-lg font-bold text-purple-600"
          >
            ✨ たのしみにまっててね！ ✨
          </motion.p>
        </motion.div>

        {/* ドットアニメーション */}
        <div className="flex justify-center gap-2 mt-3 sm:mt-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-400"
              animate={{
                y: [0, -8, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
