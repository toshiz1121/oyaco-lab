"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Agent } from "@/lib/agents/types";

interface ThinkingViewProps {
  agent: Agent;
  question: string;
}

export function ThinkingView({ agent, question }: ThinkingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[600px] w-full bg-gradient-to-b from-sky-50 to-white rounded-3xl shadow-lg border-4 border-sky-100 p-8">
      {/* 質問内容 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center max-w-2xl"
      >
        <p className="text-sm text-sky-600 font-medium mb-1">きみのしつもん</p>
        <p className="text-lg text-sky-900 font-bold bg-white/60 rounded-2xl px-6 py-3 border-2 border-sky-200">
          {question}
        </p>
      </motion.div>

      {/* 専門家アバター */}
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, -2, 2, -2, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative mb-6"
      >
        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-yellow-400 shadow-2xl shadow-yellow-300">
          <Image
            src={agent.avatar}
            alt={agent.nameJa}
            fill
            className="object-cover"
          />
        </div>
        
        {/* 思考エフェクト */}
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <span className="text-4xl">💭</span>
        </motion.div>
      </motion.div>

      {/* 専門家名 */}
      <h2 className="text-2xl font-bold text-sky-800 mb-4">{agent.nameJa}</h2>

      {/* メッセージ */}
      <motion.div
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="text-center"
      >
        <p className="text-xl font-bold text-sky-700">かんがえているよ...</p>
        
        {/* ドットアニメーション */}
        <div className="flex justify-center gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-sky-400 rounded-full"
              animate={{
                y: [0, -10, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* サブメッセージ */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-sky-600 mt-6 text-center max-w-md"
      >
        {agent.nameJa}が、わかりやすいこたえをかんがえています
      </motion.p>
    </div>
  );
}
