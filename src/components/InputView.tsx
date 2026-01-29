import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MicButton } from "./MicButton";
import { motion } from "framer-motion";
import { useMemo } from "react";

interface InputViewProps {
  onStartListening: () => void;
  isListening: boolean;
  agentName: string;
  agentAvatar: string;
}

export function InputView({ onStartListening, isListening, agentName, agentAvatar }: InputViewProps) {
  // 控えめな装飾（5個に削減）
  const sparkles = useMemo(() => 
    [...Array(5)].map((_, i) => ({
      id: i,
      left: 15 + i * 17.5,
      top: 10 + (i % 2) * 15,
      duration: 4 + i * 0.5,
      delay: i * 0.8,
      icon: '✨'
    })), []
  );

  return (
    <div className="flex flex-col h-full items-center relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50/30">
      {/* 控えめな背景装飾 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        {sparkles.map((sparkle) => (
          <motion.div
            key={sparkle.id}
            className="absolute text-xl md:text-2xl"
            style={{
              left: `${sparkle.left}%`,
              top: `${sparkle.top}%`,
            }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [0.8, 1, 0.8],
            }}
            transition={{
              duration: sparkle.duration,
              repeat: Infinity,
              delay: sparkle.delay,
              ease: "easeInOut",
            }}
          >
            {sparkle.icon}
          </motion.div>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="relative z-10 flex flex-col h-full w-full items-center">
        {/* Top Mode Toggles */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex gap-3 md:gap-4 mt-4 md:mt-8"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold px-5 md:px-7 py-2 md:py-2.5 text-sm md:text-base rounded-full shadow-md cursor-default border-2 border-blue-400"
          >
            🎤 おはなしモード
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gray-200/70 text-gray-500 font-bold px-5 md:px-7 py-2 md:py-2.5 text-sm md:text-base rounded-full cursor-not-allowed border-2 border-gray-300"
          >
            📚 コンテンツ
          </motion.div>
        </motion.div>

        {/* Center Character */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              delay: 0.2,
            }}
            className="relative"
          >
            {/* 優しい光の輪 */}
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-200/30 blur-2xl"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            
            {/* キャラクター */}
            <motion.div
              animate={{
                y: [0, -10, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-48 h-48 md:w-80 md:h-80 relative"
            >
              <img
                src={agentAvatar}
                alt={agentName}
                className="w-full h-full object-contain drop-shadow-xl"
              />
            </motion.div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl md:text-3xl font-bold text-blue-700"
          >
            {agentName}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-base md:text-lg text-gray-700 font-medium text-center px-4"
          >
            なんでも きいてね！
          </motion.p>
        </div>

        {/* Bottom Area */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="w-full max-w-3xl mx-auto h-32 md:h-40 flex flex-col items-center justify-center relative mb-4 md:mb-8"
        >
          <div className="flex flex-col items-center gap-3 md:gap-4">
            <motion.div
              animate={{
                scale: isListening ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 0.8,
                repeat: isListening ? Infinity : 0,
              }}
            >
              <MicButton
                isListening={isListening}
                onClick={onStartListening}
                size="lg"
              />
            </motion.div>
            
            <motion.span
              className="text-xl md:text-2xl font-bold text-blue-700"
            >
              {isListening ? "🎤 はなしてね！" : "👆 しつもんする！"}
            </motion.span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
