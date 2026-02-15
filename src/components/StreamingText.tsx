import { useState, useEffect, useRef } from 'react';

interface StreamingTextProps {
  text: string;
  speed?: number; // ms per char (使用されるのは totalDuration が未指定の場合のみ)
  totalDuration?: number; // 全体の表示時間（ミリ秒）
  isActive?: boolean; // true になったタイミングでアニメーション開始
}

export function StreamingText({ text, speed = 50, totalDuration, isActive = true }: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const indexRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText("");
    indexRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);

    if (!text) return;

    // isActive が false の場合は待機
    if (!isActive) return;

    // 実際の速度を計算
    // totalDuration が指定されている場合はそれに基づいて速度を計算
    // 最小速度は 20ms/char、最大速度は 200ms/char に制限
    let actualSpeed = speed;
    if (totalDuration && text.length > 0) {
      const calculatedSpeed = totalDuration / text.length;
      actualSpeed = Math.max(20, Math.min(200, calculatedSpeed));
    }

    timerRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText((prev) => prev + text.charAt(indexRef.current));
        indexRef.current++;
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, actualSpeed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed, totalDuration, isActive]);

  return (
    <div className="font-medium text-lg md:text-xl text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
      {displayedText}
      <span className="animate-pulse inline-block w-2 h-5 bg-sky-500 ml-1 align-middle" />
    </div>
  );
}
