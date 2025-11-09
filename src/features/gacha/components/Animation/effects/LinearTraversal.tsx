// src/features/gacha/components/Animation/effects/LinearTraversal.tsx

"use client"


import { useEffect, useLayoutEffect, useState } from "react";

type Props = {
  move: boolean;
  start: string; // transform value string
  end: string;
  duration: number; // ms
  delay?: number; // ms
  easing?: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  children?: React.ReactNode;
  className?: string;
};

export default function LinearTraversal ({
  move = false,
  start,
  end,
  duration,
  delay,
  easing = 'linear',
  children,
  className
  }: Props ) {




  const [transform, setTransform] = useState("");

  useEffect(() => {
    const initial = move ? end : start;
    setTransform(initial);
  }, []); // 初期設定

  useEffect(() => {
    const next = move ? end : start;
    requestAnimationFrame(() => setTransform(next));


  }, [move, start, end]);




  return (
    <div
      className={className}
      style={{
        transform: transform,
        transition: `transform ${duration}ms ${easing} ${delay}ms`
      }}
    >
      {children}
    </div>
  )
};
