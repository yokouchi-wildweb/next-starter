// src/features/card/components/common/DecoratedCard.tsx

import React, { useMemo, useRef } from "react";
import BaseCard, { type BaseCardProps } from "./BaseCard";
import { cn } from "@/lib/cn";
import { getDeterministicRandomInRange, getSwingValue } from "@/utils/math";

export type DecoratedCardProps = BaseCardProps & {

  // 表面の光沢演出
  isGlossy?: boolean;
  // ハロー効果のような光を付与
  hasAura?: boolean;
  // 登場アニメーションに関する設定
  enableIntroAnimation?: boolean;
  animeStarted?: boolean;
  animeDuration?: number; // ms
  animeFillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  animeInterval?: number;
  onAppeared?: () => void;
  // 束にしたときの自然な重なり設定
  randomRange?: [number, number];
  swingRange?: [number, number, number];
};

export default function DecoratedCard({
  className, // 下位にリレーせず自身に適用
  style, // 下位にリレーせず自身に適用
  index,
  isGlossy = false,
  hasAura = false,
  enableIntroAnimation = false,
  animeStarted = false,
  animeDuration = 500,
  animeFillMode = 'none',
  animeInterval = 240,
  onAppeared,
  randomRange = [0.6, 1.2],
  swingRange = [-2, 2, 1],
  ...rest
}: DecoratedCardProps) {


  // 動きを際自然に見せるためのランダム係数
  const randomRef = useRef<number | null>(null);
  if (randomRef.current === null) {
    randomRef.current = getDeterministicRandomInRange(
      index ?? 0,
      ...randomRange,
    );
  }
  const r = randomRef.current;
  // カードが重なるときの自然なズレ幅を表す変数
  const swing = useMemo(
    () => getSwingValue(index ?? 0, ...swingRange),
    [index, swingRange],
  );
  // アニメの開始ディレイ
  const delay = (index ?? 0) * animeInterval * r

  return (
    <div // 登場アニメーションを制御するレイヤー
      className={cn(
        `relative w-full z-10`,
        // アニメーション開始フラグが立ってから開始
        enableIntroAnimation && `animate-card-appears`,
        className
      )}
      style={{
        ...style,
        zIndex: typeof index === "number" ? index : "auto",
        // 登場アニメーションが有効だった場合
        ...(enableIntroAnimation && {
          animationDuration: `${animeDuration}ms`,
          animationDelay: `${delay}ms`,
          animationFillMode: animeFillMode,
        }),
        // アニメの開始タイミングを制御
        animationPlayState: animeStarted ? "running" : "paused",
      }}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return; // 子要素からのイベントは無視
        if ( enableIntroAnimation ) {
          onAppeared?.();
        }
      }}
    >
      {/* デッキ上での自然な重なりを表現するレイヤー */}
      <div style={{
          transform: `translate(${swing * r}px, ${swing * -r}px) rotate(${swing * r}deg)`,
      }}>

        <BaseCard index={index} {...rest} />

        {/* 周囲に光を発しているように見せるレイヤー */}
        {hasAura && (
          <div
            className={`
            absolute
            inset-0
            rounded-2xl
            animate-radiant-aura
            
            before:content-['']
            before:absolute
            before:inset-0
            before:w-full 
            before:h-full
            before:dropshadow-[0 12px 60px 2px rgba(255, 200, 180, 1)]
            `}
          ></div>
        )}

        {/* 表面の光沢を表現するレイヤー */}
        {isGlossy && (
          <div className="
              absolute
              inset-0
              [transform-style:preserve-3d]
              pointer-events-none
              overflow-hidden
              rounded-2xl
              z-20">
            <div className={`
              absolute
              top-[-50%]
              w-[50%]
              h-[150%]
              rotate-39
              
              before:content-['']
              before:absolute
              before:inset-0
              before:w-full 
              before:h-full
              before:bg-[url('/imgs/bgs/patterns/linear-gradient-white.png')]
              before:bg-contain
              before:animate-card-shine
            `}>

            </div>
          </div>
        )}
      </div>

    </div>
  );
}
