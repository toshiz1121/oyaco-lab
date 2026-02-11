import { MicButton } from "./MicButton";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import {
  Telescope,
  Atom,
  Rocket,
  Bug,
  Star,
  Rainbow,
  FlaskConical,
  Magnet,
  Flower2,
  PawPrint,
  Lightbulb,
} from "lucide-react";

interface InputViewProps {
  onStartListening: () => void;
  isListening: boolean;
  agentName: string;
  agentAvatar: string;
}

const TIPS = [
  "「なんで そらは あおいの？」",
  "「おほしさま って なに？」",
  "「きょうりゅう は なぜ いなくなったの？」",
  "「にじ は どうして できるの？」",
  "「おつきさま は なぜ ひかるの？」",
  "「でんき って なに？」",
  "「かみなり は なぜ なるの？」",
];

const LUCIDE_ICONS = [
  { Icon: FlaskConical, color: "text-purple-300" },
  { Icon: Atom, color: "text-sky-300" },
  { Icon: Rocket, color: "text-orange-300" },
  { Icon: Bug, color: "text-green-300" },
  { Icon: Star, color: "text-yellow-300" },
  { Icon: Rainbow, color: "text-pink-300" },
  { Icon: Telescope, color: "text-indigo-300" },
  { Icon: Magnet, color: "text-red-300" },
  { Icon: Flower2, color: "text-rose-300" },
  { Icon: PawPrint, color: "text-amber-300" },
];

export function InputView({ onStartListening, isListening, agentName, agentAvatar }: InputViewProps) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const floatingIcons = useMemo(() =>
    LUCIDE_ICONS.map((item, i) => ({
      id: i,
      ...item,
      left: 3 + (i * 10) % 90,
      top: 5 + ((i * 31) % 75),
      duration: 6 + (i % 4) * 1.5,
      delay: i * 0.5,
    })), []
  );

  return (
    <div className="flex flex-col h-full w-full items-center relative overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-100 via-blue-50 to-indigo-50" />

      {/* 浮遊 Lucide アイコン */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingIcons.map((item) => (
          <motion.div
            key={item.id}
            className={`absolute ${item.color} opacity-30`}
            style={{ left: `${item.left}%`, top: `${item.top}%` }}
            animate={{
              y: [0, -18, 0],
              opacity: [0.15, 0.35, 0.15],
              rotate: [0, 8, -8, 0],
            }}
            transition={{
              duration: item.duration,
              repeat: Infinity,
              delay: item.delay,
              ease: "easeInOut",
            }}
          >
            <item.Icon className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" strokeWidth={1.5} />
          </motion.div>
        ))}
      </div>

      {/* メインコンテンツ - 中央寄せ、コンパクト */}
      <div className="relative z-10 flex flex-col h-full w-full items-center justify-center px-4 gap-0">

        {/* 博士アバター + 吹き出し + ヒント を一塊に */}
        <div className="flex flex-col items-center">

          {/* ヒント吹き出し（上） */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="relative bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 sm:px-5 sm:py-2.5 shadow-sm max-w-[280px] sm:max-w-sm mb-3 sm:mb-4"
          >
            <div className="flex items-center gap-1.5 justify-center mb-0.5">
              <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
              <span className="text-[11px] sm:text-xs text-sky-600 font-medium">こんなこと きいてみよう</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={tipIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-[13px] sm:text-sm text-sky-900 text-center font-bold"
              >
                {TIPS[tipIndex]}
              </motion.p>
            </AnimatePresence>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/80 rotate-45 rounded-[2px]" />
          </motion.div>

          {/* 博士の吹き出し */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.4 }}
            className="relative bg-white rounded-2xl sm:rounded-3xl px-5 py-2.5 sm:px-7 sm:py-3 shadow-lg border-2 border-sky-200/50 max-w-[260px] sm:max-w-xs mb-3 sm:mb-4"
          >
            <motion.p
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="text-[15px] sm:text-lg md:text-xl font-bold text-sky-800 text-center leading-snug"
            >
              {isListening ? "🎤 うんうん、きいてるよ！" : "なんでも きいてね！"}
            </motion.p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r-2 border-b-2 border-sky-200/50 rounded-[2px]" />
          </motion.div>

          {/* 博士アバター */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.15 }}
            className="relative"
          >
            <motion.div
              className="absolute -inset-3 sm:-inset-5 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-60 md:h-60 lg:w-72 lg:h-72 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white ring-4 ring-sky-200/40">
                <img src={agentAvatar} alt={agentName} className="w-full h-full object-cover" />
              </div>
            </motion.div>
          </motion.div>

          {/* 博士の名前 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center gap-1.5 mt-2 sm:mt-3"
          >
            <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
            <span className="text-base sm:text-lg md:text-2xl font-bold text-sky-700">{agentName}</span>
          </motion.div>
        </div>

        {/* マイクボタン */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 20 }}
          className="flex flex-col items-center gap-2 sm:gap-3 mt-5 sm:mt-6 md:mt-8 pb-safe"
        >
          <motion.div
            animate={isListening ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 1, repeat: isListening ? Infinity : 0 }}
          >
            <MicButton
              isListening={isListening}
              onClick={onStartListening}
              size="lg"
            />
          </motion.div>
          <motion.span
            key={isListening ? "listening" : "idle"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm sm:text-base md:text-lg font-bold text-sky-600"
          >
            {isListening ? "🎤 はなしてね！" : "👆 ボタンを おしてね！"}
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}
