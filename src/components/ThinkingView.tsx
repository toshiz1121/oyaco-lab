"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Agent } from "@/lib/agents/types";
import { useMemo } from "react";

interface ThinkingViewProps {
  agent: Agent;
  question: string;
  isContinuing?: boolean;
}

export function ThinkingView({ agent, question, isContinuing }: ThinkingViewProps) {
  // 控えめな泡（5個に削減）
  const bubbles = useMemo(() => 
    [...Array(5)].map((_, i) => ({
      id: i,
      width: 40 + i * 10,
      height: 40 + i * 10,
      left: 20 + i * 15,
      xOffset: (i - 2) * 30,
      duration: 8 + i,
      delay: i * 1.5,
    })), []
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] md:h-[1000px] w-full rounded-3xl shadow-xl border-4 border-blue-100 p-4 md:p-8 relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50/30">
      
      {/* 控えめな泡 */}
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full bg-blue-200/20"
          style={{
            width: bubble.width,
            height: bubble.height,
            left: `${bubble.left}%`,
            bottom: -50,
          }}
          animate={{
            y: [-50, -1000],
            x: [0, bubble.xOffset],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: bubble.duration,
            repeat: Infinity,
            delay: bubble.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
        {/* 質問内容 */}
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

        {/* 専門家アバター */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="relative mb-6 md:mb-8"
        >
          {/* 優しい光の輪 */}
          <motion.div
            className="absolute inset-0 rounded-full bg-blue-300/30 blur-xl"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            animate={{
              y: [0, -12, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-6 border-white shadow-xl bg-white">
              <Image
                src={agent.avatar}
                alt={agent.nameJa}
                fill
                className="object-cover"
              />
            </div>
            
            {/* 思考エフェクト */}
            <motion.div
              className="absolute -top-4 -right-4 md:-top-6 md:-right-6"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="text-4xl md:text-5xl drop-shadow-lg">💭</span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* 専門家名 */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-2xl md:text-3xl font-bold text-blue-700 mb-4 md:mb-6"
        >
          {agent.nameJa}
        </motion.h2>

        {/* メッセージ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <motion.p
            animate={{
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-xl md:text-2xl font-bold text-blue-600 mb-4 md:mb-6"
          >
            {isContinuing ? "ひきつづき かんがえているよ..." : "かんがえているよ..."}
          </motion.p>
          
          {/* ドットアニメーション */}
          <div className="flex justify-center gap-2 md:gap-3 mb-4 md:mb-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-500"
                animate={{
                  y: [0, -12, 0],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* サブメッセージ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl px-4 md:px-8 py-3 md:py-4 border-2 border-blue-200 shadow-md max-w-md mx-4"
        >
          <p className="text-sm md:text-base text-blue-800 text-center font-medium">
            {agent.nameJa}が、わかりやすい<br className="md:hidden" />こたえをかんがえています
          </p>
        </motion.div>
      </div>
    </div>
  );
}
