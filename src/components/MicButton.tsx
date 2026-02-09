import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { motion } from "framer-motion";

interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  className?: string;
  size?: "default" | "lg";
}

export function MicButton({ isListening, onClick, className = "", size = "lg" }: MicButtonProps) {
  const isLarge = size === "lg";
  
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <Button
        size="lg"
        className={`rounded-full shadow-2xl border-3 sm:border-4 transition-all duration-300 relative overflow-hidden ${
          isLarge ? "h-16 w-16 sm:h-20 sm:w-20 md:h-28 md:w-28" : "h-12 w-12 sm:h-14 sm:w-14 md:h-20 md:w-20"
        } ${
          isListening 
            ? "bg-gradient-to-br from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 border-red-300 animate-pulse" 
            : "bg-gradient-to-br from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 border-yellow-300"
        } ${className}`}
        onClick={onClick}
      >
        {/* 背景のキラキラ */}
        {!isListening && (
          <motion.div
            className="absolute inset-0"
            animate={{
              background: [
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)",
                "radial-gradient(circle at 70% 70%, rgba(255,255,255,0.3) 0%, transparent 50%)",
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
        )}
        
        {/* マイクアイコン */}
        <motion.div
          animate={isListening ? {
            scale: [1, 1.2, 1],
          } : {}}
          transition={{
            duration: 0.5,
            repeat: isListening ? Infinity : 0,
          }}
        >
          <Mic className={`${isLarge ? "h-7 w-7 sm:h-8 sm:w-8 md:h-12 md:w-12" : "h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8"} text-white drop-shadow-lg relative z-10`} />
        </motion.div>

        {/* リスニング時の波紋エフェクト */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 sm:border-4 border-white"
              animate={{
                scale: [1, 1.5],
                opacity: [0.8, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 sm:border-4 border-white"
              animate={{
                scale: [1, 1.5],
                opacity: [0.8, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: 0.5,
              }}
            />
          </>
        )}
      </Button>
    </motion.div>
  );
}
