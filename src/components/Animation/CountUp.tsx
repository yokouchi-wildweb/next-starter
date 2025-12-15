// src/components/Animation/CountUp.tsx
"use client";

import { useState, useEffect, useRef } from "react";

type CountUpProps = {
  /** 終了値 */
  end: number;
  /** アニメーション時間（秒） */
  duration?: number;
  /** 値変更時に前の値から開始するか */
  preserveValue?: boolean;
  /** 3桁区切り文字 */
  separator?: string;
  /** 小数点以下の桁数 */
  decimals?: number;
};

/** ease-out関数 */
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * 数値カウントアップアニメーションコンポーネント
 */
export function CountUp({
  end,
  duration = 2,
  preserveValue = true,
  separator = ",",
  decimals = 0,
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(end);
  const previousEndRef = useRef(end);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = preserveValue ? previousEndRef.current : 0;
    const startTime = performance.now();
    const durationMs = duration * 1000;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = easeOut(progress);

      const currentValue = startValue + (end - startValue) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousEndRef.current = end;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [end, duration, preserveValue]);

  const formatValue = (value: number): string => {
    const fixed = value.toFixed(decimals);
    if (!separator) return fixed;

    const [intPart, decPart] = fixed.split(".");
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return decPart ? `${formatted}.${decPart}` : formatted;
  };

  return <>{formatValue(displayValue)}</>;
}
