"use client";

import { useEffect, useState } from "react";
import { Artist } from "@/lib/artists";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  artist: Artist;
  isVisible: boolean;
  progress?: {
    imageGeneration: boolean;
    comment: boolean;
  };
}

export function LoadingOverlay({ artist, isVisible, progress: taskProgress }: LoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setMessageIndex(0);
      return;
    }

    // Progress bar animation (0-90% in about 10 seconds)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        // Random increment for realistic feel
        return prev + Math.random() * 5;
      });
    }, 500);

    // Message rotation (every 3 seconds)
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % artist.loadingMessages.length);
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [isVisible, artist.loadingMessages.length]);

  // タスク進捗に基づいたプログレス計算
  const calculateTaskProgress = () => {
    if (!taskProgress) return progress;
    const completed = [taskProgress.imageGeneration, taskProgress.comment].filter(Boolean).length;
    return (completed / 2) * 100;
  };

  const displayProgress = taskProgress ? calculateTaskProgress() : progress;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm p-6"
        >
          <div className="relative w-32 h-32 mb-8">
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, 2, -2, 0]
              }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="relative w-full h-full rounded-full overflow-hidden border-4 border-primary shadow-xl"
            >
              <Image
                src={`/avatars/${artist.id}.png`}
                alt={artist.name}
                fill
                className="object-cover"
              />
            </motion.div>
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full shadow">
              {taskProgress && taskProgress.imageGeneration && taskProgress.comment ? "Complete!" : "Generating..."}
            </div>
          </div>

          <div className="w-full max-w-md space-y-6 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={messageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-16 flex items-center justify-center"
              >
                <p className="text-lg font-medium text-foreground italic">
                  &ldquo;{artist.loadingMessages[messageIndex]}&rdquo;
                </p>
              </motion.div>
            </AnimatePresence>

            {/* タスク進捗表示 */}
            {taskProgress && (
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {taskProgress.imageGeneration ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  <span className={taskProgress.imageGeneration ? "text-green-500" : ""}>
                    {taskProgress.imageGeneration ? "画像を生成完了" : "画像を生成中..."}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  {taskProgress.comment ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  <span className={taskProgress.comment ? "text-green-500" : ""}>
                    {taskProgress.comment ? "解説を生成完了" : "解説を生成中..."}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Progress value={displayProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{Math.round(displayProgress)}%</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
