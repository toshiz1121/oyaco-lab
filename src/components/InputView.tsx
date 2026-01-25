import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mic } from "lucide-react";

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
        <div className="bg-amber-200 text-amber-900 font-bold px-6 py-2 rounded-full shadow-sm cursor-default">
          おはなし
        </div>
        <div className="bg-sky-200/50 text-sky-700/50 font-bold px-6 py-2 rounded-full cursor-not-allowed">
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

      {/* Bottom Action */}
      <div className="mb-12 flex flex-col items-center gap-4">
        <Button
          size="lg"
          className={`h-24 w-24 rounded-full shadow-lg border-4 transition-all duration-300 ${
            isListening 
              ? "bg-red-500 hover:bg-red-600 border-red-200 animate-pulse scale-110" 
              : "bg-orange-400 hover:bg-orange-500 border-orange-200 hover:scale-105"
          }`}
          onClick={onStartListening}
        >
          <Mic className="h-10 w-10 text-white" />
        </Button>
        <span className="text-2xl font-bold text-slate-700">しつもんする！</span>
      </div>
    </div>
  );
}
