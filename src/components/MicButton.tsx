import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  className?: string;
  size?: "default" | "lg";
}

export function MicButton({ isListening, onClick, className = "", size = "lg" }: MicButtonProps) {
  // InputViewで使用されていたスタイルをベースにする
  const isLarge = size === "lg";
  
  return (
    <Button
      size="lg"
      className={`rounded-full shadow-lg border-4 transition-all duration-300 ${
        isLarge ? "h-24 w-24" : "h-16 w-16"
      } ${
        isListening 
          ? "bg-red-500 hover:bg-red-600 border-red-200 animate-pulse scale-110" 
          : "bg-orange-400 hover:bg-orange-500 border-orange-200 hover:scale-105"
      } ${className}`}
      onClick={onClick}
    >
      <Mic className={`${isLarge ? "h-10 w-10" : "h-7 w-7"} text-white`} />
    </Button>
  );
}
