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
  'educator'
];

export function ExpertSpotlight({ selectedExpert, selectionReason, question, onAnimationComplete }: ExpertSpotlightProps) {
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!selectedExpert && !isFinalized) {
      const interval = setInterval(() => {
        setSpotlightIndex((prev) => (prev + 1) % displayableExperts.length);
      }, 250);

      return () => clearInterval(interval);
    }

    if (selectedExpert && !isFinalized) {
      const selectedIndex = displayableExperts.indexOf(selectedExpert);
      if (selectedIndex !== -1) {
        setSpotlightIndex(selectedIndex);
        setIsFinalized(true);
        
        setTimeout(() => {
          setShowMessage(true);
        }, 300);

        setTimeout(() => {
          onAnimationComplete?.();
        }, 1500);
      }
    }
  }, [selectedExpert, isFinalized, onAnimationComplete]);

  const selectedAgent = agents[displayableExperts[spotlightIndex]];

  return (
    <div className="flex flex-col items-center justify-center min-h-[800px] md:h-[1000px] w-full rounded-3xl shadow-xl border-4 border-blue-100 p-4 md:p-8 relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50/30">
      
      {/* 優しいスポットライト効果 */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)",
            "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)",
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
        }}
      />

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
        {/* 質問内容 */}
        {question && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mb-6 md:mb-8 text-center w-full px-4"
          >
            <p className="text-xs md:text-sm text-blue-600 font-bold mb-2">
              きみのしつもん
            </p>
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl md:rounded-3xl px-4 md:px-8 py-3 md:py-4 border-3 border-blue-200 shadow-lg">
              <p className="text-base md:text-xl text-blue-900 font-bold break-words">
                {question}
              </p>
            </div>
          </motion.div>
        )}

        {/* タイトル */}
        <motion.h2
          animate={{
            opacity: [0.9, 1, 0.9],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
          className="text-2xl md:text-3xl font-bold text-blue-700 mb-6 md:mb-10"
        >
          {isFinalized ? "✨ はかせが決まったよ！" : "🔍 だれにきくか かんがえているよ..."}
        </motion.h2>

        {/* 専門家一覧 */}
        <div className="flex gap-4 md:gap-8 mb-8 md:mb-12 flex-wrap justify-center max-w-4xl px-4">
          {displayableExperts.map((expertId, index) => {
            const expert = agents[expertId];
            const isSpotlit = index === spotlightIndex;
            const isFinal = isFinalized && index === spotlightIndex;

            return (
              <motion.div
                key={expertId}
                className="relative flex flex-col items-center"
                animate={{
                  scale: isFinal ? 1.15 : isSpotlit ? 1.05 : 0.85,
                  opacity: isFinal ? 1 : isSpotlit ? 1 : 0.5,
                  y: isFinal ? -10 : 0,
                }}
                transition={{
                  duration: 0.3,
                }}
              >
                <div className={`relative w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-4 ${
                  isFinal 
                    ? "border-yellow-400 shadow-xl" 
                    : isSpotlit 
                      ? "border-blue-400 shadow-lg" 
                      : "border-gray-300"
                } bg-white`}>
                  <Image
                    src={expert.avatar}
                    alt={expert.nameJa}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* スポットライトビーム */}
                {isSpotlit && !isFinalized && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      boxShadow: [
                        "0 0 0px rgba(59, 130, 246, 0)",
                        "0 0 30px rgba(59, 130, 246, 0.6)",
                        "0 0 0px rgba(59, 130, 246, 0)",
                      ],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                    }}
                  />
                )}

                {/* 確定時のエフェクト */}
                {isFinal && (
                  <motion.div
                    className="absolute -top-2 -right-2 text-3xl"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    ✨
                  </motion.div>
                )}

                {/* 名前ラベル */}
                <motion.div
                  animate={{
                    opacity: isSpotlit ? 1 : 0.6,
                  }}
                  className="mt-2 text-center"
                >
                  <span className={`text-xs md:text-sm font-bold ${
                    isFinal ? "text-yellow-600" : "text-blue-700"
                  }`}>
                    {expert.nameJa}
                  </span>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* 選ばれた専門家の紹介メッセージ */}
        <AnimatePresence>
          {showMessage && selectedAgent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="text-center space-y-4 md:space-y-6 px-4"
            >
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 bg-white/90 backdrop-blur-sm rounded-2xl md:rounded-3xl px-6 md:px-10 py-4 md:py-6 border-3 border-blue-300 shadow-xl">
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-blue-400 shadow-lg">
                  <Image
                    src={selectedAgent.avatar}
                    alt={selectedAgent.nameJa}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-sm md:text-base text-blue-600 font-bold mb-1">こたえてくれるのは...</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-700">
                    {selectedAgent.nameJa}
                  </p>
                </div>
              </div>
              
              {/* 選定理由 */}
              {selectionReason && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-blue-50 border-3 border-blue-200 rounded-2xl md:rounded-3xl px-6 md:px-10 py-4 md:py-6 max-w-2xl mx-auto shadow-lg"
                >
                  <p className="text-xs md:text-sm text-blue-600 font-bold mb-2">えらばれたりゆう</p>
                  <p className="text-base md:text-lg text-blue-900 font-bold break-words">{selectionReason}</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
