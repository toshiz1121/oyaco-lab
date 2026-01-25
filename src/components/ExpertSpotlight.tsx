"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { agents } from "@/lib/agents/definitions";
import { AgentRole } from "@/lib/agents/types";

interface ExpertSpotlightProps {
  selectedExpert?: AgentRole; // API結果が返ってきたらセット
  onAnimationComplete?: () => void; // 演出完了時のコールバック
}

// オーケストレーター以外の専門家を表示
const displayableExperts: AgentRole[] = [
  'scientist',
  'biologist',
  'astronomer',
  'historian',
  'artist',
  'educator'
];

export function ExpertSpotlight({ selectedExpert, onAnimationComplete }: ExpertSpotlightProps) {
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    // スポットライトが順番に当たるアニメーション
    if (!selectedExpert && !isFinalized) {
      const interval = setInterval(() => {
        setSpotlightIndex((prev) => (prev + 1) % displayableExperts.length);
      }, 400); // 0.4秒ごとに次の専門家へ

      return () => clearInterval(interval);
    }

    // 選ばれた専門家が決まったら、そこで停止
    if (selectedExpert && !isFinalized) {
      const selectedIndex = displayableExperts.indexOf(selectedExpert);
      if (selectedIndex !== -1) {
        setSpotlightIndex(selectedIndex);
        setIsFinalized(true);
        
        // 強調演出を見せるため、1秒待ってからメッセージ表示
        setTimeout(() => {
          setShowMessage(true);
        }, 800);

        // さらに1.5秒後に次の画面へ遷移
        setTimeout(() => {
          onAnimationComplete?.();
        }, 2300);
      }
    }
  }, [selectedExpert, isFinalized, onAnimationComplete]);

  const selectedAgent = agents[displayableExperts[spotlightIndex]];

  return (
    <div className="flex flex-col items-center justify-center h-[600px] w-full bg-gradient-to-b from-sky-50 to-white rounded-3xl shadow-lg border-4 border-sky-100 p-8">
      {/* タイトル */}
      <h2 className="text-2xl font-bold text-sky-700 mb-8">
        {isFinalized ? "はかせが決まったよ！" : "はかせをよんでいるよ..."}
      </h2>

      {/* 専門家一覧 */}
      <div className="flex gap-4 mb-8 flex-wrap justify-center max-w-3xl">
        {displayableExperts.map((expertId, index) => {
          const expert = agents[expertId];
          const isSpotlit = index === spotlightIndex;
          const isFinal = isFinalized && index === spotlightIndex;

          return (
            <motion.div
              key={expertId}
              className="relative"
              animate={{
                scale: isFinal ? [1, 1.2, 1.1] : isSpotlit ? 1.05 : 0.85,
                opacity: isFinal ? 1 : isSpotlit ? 1 : 0.3,
              }}
              transition={{
                duration: 0.3,
                scale: isFinal ? { duration: 0.6, times: [0, 0.5, 1] } : { duration: 0.3 }
              }}
            >
              <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 ${
                isFinal 
                  ? "border-yellow-400 shadow-2xl shadow-yellow-300" 
                  : isSpotlit 
                    ? "border-sky-400 shadow-lg shadow-sky-200" 
                    : "border-gray-200"
              }`}>
                <Image
                  src={expert.avatar}
                  alt={expert.nameJa}
                  fill
                  className="object-cover"
                />
              </div>

              {/* スポットライトエフェクト */}
              {isSpotlit && !isFinalized && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{
                    boxShadow: [
                      "0 0 0px rgba(56, 189, 248, 0)",
                      "0 0 30px rgba(56, 189, 248, 0.6)",
                      "0 0 0px rgba(56, 189, 248, 0)",
                    ],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                  }}
                />
              )}

              {/* 確定時のキラキラエフェクト */}
              {isFinal && (
                <motion.div
                  className="absolute -top-2 -right-2 text-4xl"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, type: "spring" }}
                >
                  ✨
                </motion.div>
              )}
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
            className="text-center space-y-2"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-3 border-sky-400">
                <Image
                  src={selectedAgent.avatar}
                  alt={selectedAgent.nameJa}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-left">
                <p className="text-sm text-sky-600 font-medium">回答してくれるのは...</p>
                <p className="text-2xl font-bold text-sky-800">{selectedAgent.nameJa}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
