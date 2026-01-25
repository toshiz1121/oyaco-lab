import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MicButton } from "./MicButton";

interface InputViewProps {
  onStartListening: () => void;
  isListening: boolean;
  agentName: string;
  agentAvatar: string;
}

export function InputView({ onStartListening, isListening, agentName, agentAvatar }: InputViewProps) {
  return (
    <div className="flex flex-col h-full items-center relative p-6 bg-gradient-to-b from-sky-50 to-white/50">
      {/* Top Mode Toggles */}
      <div className="flex gap-4 mt-8">
        <div className="bg-amber-200 text-amber-900 font-bold px-4 py-1.5 text-sm rounded-full shadow-sm cursor-default">
          おはなし
        </div>
        <div className="bg-sky-200/50 text-sky-700/50 font-bold px-4 py-1.5 text-sm rounded-full cursor-not-allowed">
          こんてんつ
        </div>
      </div>

      {/* Center Character */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 -mt-10">
        <div className="relative">
          {/* Breathing animation or aura could go here */}
          <div className="w-64 h-64 md:w-80 md:h-80 relative">
             <img
               src={agentAvatar}
               alt={agentName}
               className="w-full h-full object-contain drop-shadow-xl transition-transform duration-700 hover:scale-105"
             />
          </div>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-700">{agentName}</h2>
      </div>

      {/* Bottom Area (Fixed Height to match ResultView) */}
      <div className="w-full max-w-3xl mx-auto h-40 flex flex-col items-center justify-center relative mb-4">
        <div className="absolute top-0 flex flex-col items-center gap-4">
          <MicButton
            isListening={isListening}
            onClick={onStartListening}
            size="lg"
          />
          <span className="text-2xl font-bold text-slate-700">しつもんする！</span>
        </div>
      </div>
    </div>
  );
}
