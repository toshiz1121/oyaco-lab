import { useState, useEffect, useRef } from 'react';

interface StreamingTextProps {
  text: string;
  speed?: number; // ms per char
}

export function StreamingText({ text, speed = 50 }: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const indexRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText("");
    indexRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);

    if (!text) return;

    timerRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText((prev) => prev + text.charAt(indexRef.current));
        indexRef.current++;
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed]);

  return (
    <div className="font-medium text-lg md:text-xl text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
      {displayedText}
      <span className="animate-pulse inline-block w-2 h-5 bg-sky-500 ml-1 align-middle" />
    </div>
  );
}
