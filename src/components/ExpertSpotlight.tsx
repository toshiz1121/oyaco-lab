"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { agents } from "@/lib/agents/definitions";
import { AgentRole } from "@/lib/agents/types";

interface ExpertSpotlightProps {
  selectedExpert?: AgentRole;
  selectionReason?: string;
  question?: string;
  onAnimationComplete?: () => void;
}

const displayableExperts: AgentRole[] = [
  'scientist',
  'biologist',
  'astronomer',
  'historian',
  'artist',
  'engineer',
  'educator'
];

export function ExpertSpotlight({ selectedExpert, selectionReason, question, onAnimationComplete }: ExpertSpotlightProps) {
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showReason, setShowReason] = useState(false);

  // 大量のキラキラエフェクト用
  const sparkles = useMemo(() => 
    [...Array(20)].map((_, i) => ({
      id: i,
      x: Math.cos((i / 20) * Math.PI * 2) * (100 + Math.random() * 50),
      y: Math.sin((i / 20) * Math.PI * 2) * (100 + Math.random() * 50),
      delay: i * 0.03,
      scale: 0.6 + Math.random() * 0.6,
      duration: 1 + Math.random() * 0.5,
    })), []
  );

  // 紙吹雪エフェクト
  const confetti = useMemo(() => 
    [...Array(30)].map((_, i) => ({
      id: i,
      x: -50 + Math.random() * 100,
      rotation: Math.random() * 360,
      color: ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 1,
    })), []
  );

  useEffect(() => {
    if (!selectedExpert && !isFinalized) {
      const interval = setInterval(() => {
        setSpotlightIndex((prev) => (prev + 1) % displayableExperts.length);
      }, 120); // さらに高速化

      return () => clearInterval(interval);
    }

    if (selectedExpert && !isFinalized) {
      const selectedIndex = displayableExperts.indexOf(selectedExpert);
      if (selectedIndex !== -1) {
        setSpotlightIndex(selectedIndex);
        setIsFinalized(true);
        
        // フェーズ2: スポットライト演出開始（即座に）
        setTimeout(() => {
          setShowSpotlight(true);
        }, 50);

        // フェーズ3: メッセージ表示
        setTimeout(() => {
          setShowMessage(true);
        }, 500);

        // フェーズ4: 選定理由表示
        setTimeout(() => {
          setShowReason(true);
        }, 1000);

        // 演出完了
        setTimeout(() => {
          onAnimationComplete?.();
        }, 3500);
      }
    }
  }, [selectedExpert, isFinalized, onAnimationComplete]);

  const selectedAgent = agents[displayableExperts[spotlightIndex]];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[600px] md:min-h-[700px] w-full rounded-2xl sm:rounded-3xl shadow-xl border-2 sm:border-4 border-blue-100 p-3 sm:p-4 md:p-8 relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50/30">
      
      {/* 暗転オーバーレイ（スポットライト演出時） - 非常に軽く */}
      <AnimatePresence>
        {showSpotlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-gradient-to-b from-slate-900/15 via-slate-800/10 to-slate-900/15 z-20"
          />
        )}
      </AnimatePresence>

      {/* 紙吹雪 */}
      <AnimatePresence>
        {showSpotlight && confetti.map((conf) => (
          <motion.div
            key={`confetti-${conf.id}`}
            className="absolute w-1.5 h-2 sm:w-2 sm:h-3 md:w-3 md:h-4 z-35"
            style={{
              backgroundColor: conf.color,
              left: `${50 + conf.x}%`,
              top: -20,
            }}
            initial={{ opacity: 0, y: -20, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: 1000,
              rotate: conf.rotation + 720,
              x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
            }}
            transition={{
              duration: conf.duration,
              delay: conf.delay,
              ease: "easeIn",
            }}
          />
        ))}
      </AnimatePresence>

      {/* 優しいスポットライト効果（選択中） */}
      {!showSpotlight && (
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              "radial-gradient(circle at 50% 50%, rgba(98, 153, 241, 0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
        {/* 質問内容 */}
        {question && !showSpotlight && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mb-4 sm:mb-6 md:mb-8 text-center w-full px-3 sm:px-4"
          >
            <p className="text-[10px] sm:text-xs md:text-sm text-blue-600 font-bold mb-1 sm:mb-2">
              きみのしつもん
            </p>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl md:rounded-3xl px-3 sm:px-4 md:px-8 py-2 sm:py-3 md:py-4 border-2 sm:border-3 border-blue-200 shadow-lg">
              <p className="text-sm sm:text-base md:text-xl text-blue-900 font-bold break-words">
                {question}
              </p>
            </div>
          </motion.div>
        )}

        {/* タイトル */}
        {!showSpotlight && (
          <motion.h2
            animate={{
              opacity: [0.9, 1, 0.9],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
            className="text-lg sm:text-2xl md:text-4xl font-bold text-blue-700 mb-4 sm:mb-6 md:mb-10"
          >
            {isFinalized ? "✨ はかせが決まったよ！" : "🔍 だれにきくか かんがえているよ..."}
          </motion.h2>
        )}

        {/* 専門家一覧（スポットライト前） */}
        {!showSpotlight && (
          <div className="flex gap-2 sm:gap-4 md:gap-8 mb-4 sm:mb-8 md:mb-12 flex-wrap justify-center max-w-4xl px-2 sm:px-4">
            {displayableExperts.map((expertId, index) => {
              const expert = agents[expertId];
              const isSpotlit = index === spotlightIndex;
              const isFinal = isFinalized && index === spotlightIndex;

              return (
                <motion.div
                  key={expertId}
                  className="relative flex flex-col items-center"
                  animate={{
                    scale: isFinal ? 1.2 : isSpotlit ? 1.1 : 0.85,
                    opacity: isFinal ? 1 : isSpotlit ? 1 : 0.4,
                    y: isFinal ? -15 : 0,
                  }}
                  transition={{
                    duration: 0.2,
                    type: "spring",
                    stiffness: 300,
                  }}
                >
                  {/* 光の輪（選択中） */}
                  {isSpotlit && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{
                        boxShadow: [
                          "0 0 0px rgba(250, 204, 21, 0)",
                          "0 0 40px rgba(250, 204, 21, 0.8)",
                          "0 0 0px rgba(250, 204, 21, 0)",
                        ],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                      }}
                    />
                  )}

                  <div className={`relative w-14 h-14 sm:w-20 sm:h-20 md:w-32 md:h-32 rounded-full overflow-hidden border-2 sm:border-4 ${
                    isFinal 
                      ? "border-yellow-400 shadow-2xl" 
                      : isSpotlit 
                        ? "border-yellow-300 shadow-xl" 
                        : "border-gray-300"
                  } bg-white transition-all duration-200`}>
                    <Image
                      src={expert.avatar}
                      alt={expert.nameJa}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* 確定時のエフェクト */}
                  {isFinal && (
                    <>
                      <motion.div
                        className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 text-2xl sm:text-4xl md:text-5xl"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                      >
                        ⭐
                      </motion.div>
                      <motion.div
                        className="absolute -top-1 -left-1 sm:-top-2 sm:-left-2 text-2xl sm:text-4xl md:text-5xl"
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.15 }}
                      >
                        ✨
                      </motion.div>
                    </>
                  )}

                  {/* 名前ラベル */}
                  <motion.div
                    animate={{
                      opacity: isSpotlit ? 1 : 0.6,
                    }}
                    className="mt-1 sm:mt-2 text-center"
                  >
                    <span className={`text-[10px] sm:text-sm md:text-base font-bold ${
                      isFinal ? "text-yellow-600" : "text-blue-700"
                    }`}>
                      {expert.nameJa}
                    </span>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* スポットライト演出：選ばれた博士の大きな表示 */}
        <AnimatePresence>
          {showSpotlight && selectedAgent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.3, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 200, 
                damping: 15,
                duration: 0.6,
              }}
              className="relative z-40 flex flex-col items-center gap-6 md:gap-8"
            >
              {/* 大量のキラキラエフェクト - 控えめに */}
              {sparkles.slice(0, 12).map((sparkle) => (
                <motion.div
                  key={sparkle.id}
                  className="absolute text-xl sm:text-2xl md:text-3xl pointer-events-none"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 0.8, 0.8, 0],
                    scale: [0, sparkle.scale, sparkle.scale * 1.1, 0],
                    x: sparkle.x,
                    y: sparkle.y,
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: sparkle.duration,
                    delay: sparkle.delay + 0.2,
                    repeat: Infinity,
                    repeatDelay: 0.8,
                  }}
                >
                  ✨
                </motion.div>
              ))}

              {/* 博士アバターセクション */}
              <div className="relative">
                {/* 超明るい白い背景円（博士を際立たせる） */}
                <motion.div
                  className="absolute w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full z-[-1] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ 
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{
                    duration: 0.4,
                  }}
                  style={{
                    background: "radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 70%, rgba(255, 255, 255, 0.95) 85%, rgba(255, 255, 255, 0.8) 100%)",
                    boxShadow: "0 0 80px 40px rgba(255, 255, 255, 1), 0 0 120px 60px rgba(255, 255, 255, 0.8)",
                  }}
                />

                {/* 光の輪（黄色のアクセント） */}
                <motion.div
                  className="absolute w-56 h-56 sm:w-72 sm:h-72 md:w-88 md:h-88 rounded-full z-[-2] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ 
                    opacity: [0.7, 1, 0.7],
                    scale: [0.95, 1.1, 0.95],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                  style={{
                    background: "radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.9) 40%, rgba(250, 204, 21, 0.5) 60%, rgba(250, 204, 21, 0.2) 80%, transparent 100%)",
                    filter: "blur(8px)",
                  }}
                />

                {/* 博士アバター */}
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative"
                >
                  {/* 外側の光るリング - より明るく */}
                  <motion.div
                    className="absolute -inset-4 rounded-full"
                    animate={{
                      boxShadow: [
                        "0 0 30px 12px rgba(250, 204, 21, 0.9), 0 0 60px 25px rgba(255, 255, 255, 0.8)",
                        "0 0 50px 20px rgba(250, 204, 21, 1), 0 0 80px 35px rgba(255, 255, 255, 1)",
                        "0 0 30px 12px rgba(250, 204, 21, 0.9), 0 0 60px 25px rgba(255, 255, 255, 0.8)",
                      ],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                  />

                  {/* アバター本体 - より大きく、明るく */}
                  <div className="relative w-28 h-28 sm:w-40 sm:h-40 md:w-56 md:h-56 rounded-full overflow-hidden border-4 sm:border-6 md:border-8 border-yellow-400 shadow-2xl bg-white ring-4 sm:ring-8 ring-white">
                    <Image
                      src={selectedAgent.avatar}
                      alt={selectedAgent.nameJa}
                      fill
                      className="object-cover brightness-110"
                      priority
                    />
                  </div>
                  
                  {/* 王冠エフェクト */}
                  <motion.div
                    className="absolute -top-8 sm:-top-12 md:-top-14 left-1/2 -translate-x-1/2 text-3xl sm:text-5xl md:text-7xl drop-shadow-2xl"
                    initial={{ opacity: 0, y: 30, scale: 0, rotate: -45 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0, 
                      scale: 1, 
                      rotate: 0,
                    }}
                    transition={{ 
                      delay: 0.3, 
                      type: "spring",
                      stiffness: 200,
                    }}
                  >
                    👑
                  </motion.div>

                  {/* 周囲の星 */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={`star-${i}`}
                      className="absolute text-xl sm:text-3xl md:text-4xl drop-shadow-lg"
                      style={{
                        left: `${50 + Math.cos((i / 4) * Math.PI * 2) * 120}%`,
                        top: `${50 + Math.sin((i / 4) * Math.PI * 2) * 120}%`,
                      }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        scale: [0, 1.2, 1, 0],
                        rotate: [0, 180, 360],
                      }}
                      transition={{
                        duration: 2,
                        delay: 0.4 + i * 0.1,
                        repeat: Infinity,
                        repeatDelay: 0.8,
                      }}
                    >
                      ⭐
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* 決定メッセージ */}
              <AnimatePresence>
                {showMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                      }}
                      className="bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-300 rounded-2xl sm:rounded-3xl px-4 sm:px-6 md:px-10 py-3 sm:py-4 md:py-5 shadow-2xl border-2 sm:border-4 border-yellow-500"
                    >
                      <motion.p
                        className="text-lg sm:text-2xl md:text-4xl font-bold text-slate-900 drop-shadow-sm mb-1"
                      >
                        🎉 {selectedAgent.nameJa} 🎉
                      </motion.p>
                      <p className="text-sm sm:text-lg md:text-xl text-slate-800 font-bold">
                        に決定！
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 選定理由 */}
              <AnimatePresence>
                {showReason && selectionReason && (
                  <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 150, damping: 15 }}
                    className="bg-white/98 backdrop-blur-sm rounded-xl sm:rounded-2xl md:rounded-3xl px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 max-w-xl mx-3 sm:mx-4 shadow-2xl border-2 sm:border-4 border-yellow-400"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3">
                      <span className="text-xl sm:text-2xl md:text-3xl">💡</span>
                      <p className="text-sm sm:text-base md:text-lg text-yellow-600 font-bold">
                        えらばれたりゆう
                      </p>
                    </div>
                    <p className="text-sm sm:text-base md:text-xl text-slate-900 font-bold break-words text-center leading-relaxed">
                      {selectionReason}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


