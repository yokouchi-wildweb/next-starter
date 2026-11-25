"use client";

// src/components/Overlays/Loading/FullscreenLayer.tsx
//
// ScreenLoader の fullscreen の外側(D106・D107): 最初の描画(SSR・ハイドレーション)はその場に流れの中で画面の高さに出し、
// mount の後に <body> 直下へ移して画面を覆う(fixed + cover の層)。SSR の最初の HTML から見える。
// サーバーが出した Suspense の fallback は中身が届くまでハイドレーションされない(mount しない)ので、直の読み込みの待ちの間は
// その場の形のまま: その場で fixed にすると親の箱(PageTransition の contain: layout paint)に切られて高さ 0 になるため、流れの中に置く。
// BodyPortal(../BodyPortal.tsx)は mount の前は何も出さないので、最初の描画から出す全画面の待ちはこちら
import { type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { useIsClient } from "@/lib/isClient";
import { zLayerClass } from "@/lib/zLayer";

/** 移した後: 何よりも上の cover。pointer-events-auto = モーダルが開いている間 Radix が body に付ける pointer-events: none を継がず、下の物(モーダルのボタン等)への押しを受け止める(注文 16) */
const PORTALED = `fixed inset-0 pointer-events-auto ${zLayerClass("cover")}`;
/** その場: 流れの中で画面の高さ(覆わない。親の箱に切られない) */
const IN_PLACE = "relative w-full min-h-[var(--viewport-height,100dvh)]";

export function FullscreenLayer({
  baseClassName,
  className,
  style,
  children,
}: {
  /** 見た目の土台(ScreenLoader の共通のクラス) */
  readonly baseClassName: string;
  /** 呼び手のクラス(層のクラスより後 = 上書きできる、今までの ScreenLoader と同じ並び) */
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}) {
  const mounted = useIsClient();
  const layer = (
    <div
      className={cn(baseClassName, mounted ? PORTALED : IN_PLACE, className)}
      style={style}
      role="status"
      aria-live="polite"
      aria-busy
    >
      {children}
    </div>
  );
  return mounted ? createPortal(layer, document.body) : layer;
}
