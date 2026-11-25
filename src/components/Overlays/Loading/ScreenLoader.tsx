// src/components/Feedback/ScreenLoader.tsx
import { type ReactNode } from "react";

import { FullscreenLayer } from "./FullscreenLayer";
import { Spinner, type SpinnerVariant } from "./Spinner";
import { cn } from "@/lib/cn";
import { zLayerClass } from "@/lib/zLayer";

type LoadingOverlayMode = "local" | "fullscreen";

type LoadingOverlayProps = {
  /**
   * オーバーレイを表示するモードを指定します。
   * - `local`: 親要素の領域いっぱいに表示します。親要素は relative である必要があります。
   * - `fullscreen`: 画面全体を覆います。最初の描画はその場に流れの中で画面の高さに出し、mount の後に <body> 直下へ移して覆います
   *   (SSR の最初の HTML から見え、親の箱 = PageTransition の contain 等に切られない。D106・D107、./FullscreenLayer.tsx)。
   */
  mode?: LoadingOverlayMode;
  /**
   * オーバーレイ全体に追加するクラス名。
   */
  className?: string;
  /**
   * オーバーレイ全体に追加するインラインスタイル。
   */
  style?: React.CSSProperties;
  /**
   * スピナーに追加するクラス名。
   */
  spinnerClassName?: string;
  /**
   * 表示するスピナーのバリエーション。
   */
  spinnerVariant?: SpinnerVariant;
  /**
   * スピナーの下に表示するメッセージ。
   */
  message?: ReactNode;
  /**
   * メッセージに追加するクラス名。
   */
  messageClassName?: string;
};

// local はページ内容（content-layer: 100）より上、ヘッダ（header: 360）より下の
// backside-ui-top（290）。生の z-40 だと content-layer の要素に覆われ、隠したい内容が
// 見えたまま操作できてしまう。fullscreen の層と押しの受け止めは ./FullscreenLayer.tsx
const LOCAL_CLASS = `absolute inset-0 ${zLayerClass("backside-ui")}`;
const BASE_CLASS = "flex items-center justify-center bg-background/80 backdrop-blur-sm";

export function ScreenLoader({
  mode = "fullscreen",
  className,
  style,
  spinnerClassName,
  spinnerVariant,
  message,
  messageClassName,
}: LoadingOverlayProps) {
  const content = (
    <div className="flex flex-col items-center gap-3 text-primary">
      <Spinner
        className={cn("h-10 w-10 text-current", spinnerClassName)}
        variant={spinnerVariant}
      />
      {message ? <p className={cn("text-sm font-medium", messageClassName)}>{message}</p> : null}
    </div>
  );
  if (mode === "fullscreen") {
    return (
      <FullscreenLayer baseClassName={BASE_CLASS} className={className} style={style}>
        {content}
      </FullscreenLayer>
    );
  }
  return (
    <div className={cn(BASE_CLASS, LOCAL_CLASS, className)} style={style} role="status" aria-live="polite" aria-busy>
      {content}
    </div>
  );
}
