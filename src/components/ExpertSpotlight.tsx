"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { agents } from "@/lib/agents/definitions";
import { AgentRole } from "@/lib/agents/types";

interface ExpertSpotlightProps {
  selectedExpert?: AgentRole; // API結果が返ってきたらセット
  selectionReason?: string; // 専門家が選ばれた理由（子供向け）
  question?: string; // ユーザーの質問内容
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

export function ExpertSpotlight({ selectedExpert, selectionReason, question, onAnimationComplete }: ExpertSpotlightProps) {
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    // スポットライトアニメーション
    if (!selectedExpert && !isFinalized) {
      const interval = setInterval(() => {
        setSpotlightIndex((prev) => (prev + 1) % displayableExperts.length);
      }, 250); // 0.25秒ごとに次の専門家へ

      return () => clearInterval(interval);
    }

    // 専門家が決まったら停止
    if (selectedExpert && !isFinalized) {
      const selectedIndex = displayableExperts.indexOf(selectedExpert);
      if (selectedIndex !== -1) {
        setSpotlightIndex(selectedIndex);
        setIsFinalized(true);
        
        // 0.3秒後にメッセージ表示
        setTimeout(() => {
          setShowMessage(true);
        }, 300);

        // 1.5秒後に次の画面へ遷移
        setTimeout(() => {
          onAnimationComplete?.();
        }, 1500);
      }
    }
  }, [selectedExpert, isFinalized, onAnimationComplete]);

  const selectedAgent = agents[displayableExperts[spotlightIndex]];

  return (
    <div className="flex flex-col items-center justify-center h-[800px] md:h-[1000px] w-full bg-gradient-to-b from-sky-50 to-white rounded-3xl shadow-lg border-4 border-sky-100 p-8">
      {/* 質問内容 */}
      {question && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center max-w-2xl"
        >
          <p className="text-sm text-sky-600 font-medium mb-1">きみのしつもん</p>
          <p className="text-lg text-sky-900 font-bold bg-white/60 rounded-2xl px-6 py-3 border-2 border-sky-200">
            {question}
          </p>
        </motion.div>
      )}

      {/* タイトル */}
      <h2 className="text-2xl font-bold text-sky-700 mb-8">
        {isFinalized ? "はかせが決まったよ！" : "だれにきくか かんがえているよ..."}
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
            className="text-center space-y-3"
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
                <p className="text-sm text-sky-600 font-medium">こたえてくれるのは...</p>
                <p className="text-2xl font-bold text-sky-800">{selectedAgent.nameJa}</p>
              </div>
            </div>
            
            {/* 選定理由 */}
            {selectionReason && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl px-6 py-3 max-w-md mx-auto"
              >
                <p className="text-xs text-yellow-700 font-medium mb-1">えらばれたりゆう</p>
                <p className="text-base text-yellow-900 font-bold">{selectionReason}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
