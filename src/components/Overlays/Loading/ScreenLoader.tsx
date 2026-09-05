// src/components/Feedback/ScreenLoader.tsx
import { type ReactNode } from "react";

import { Spinner, type SpinnerVariant } from "@/components/Overlays/Loading/Spinner";
import { cn } from "@/lib/cn";

type LoadingOverlayMode = "local" | "fullscreen";

type LoadingOverlayProps = {
  /**
   * オーバーレイを表示するモードを指定します。
   * - `local`: 親要素の領域いっぱいに表示します。親要素は relative である必要があります。
   * - `fullscreen`: 画面全体を覆います。
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

const MODE_CLASS: Record<LoadingOverlayMode, string> = {
  // local はページ内容（content-layer: 100）より上、ヘッダ（header: 360）より下の
  // backside-ui-top（290）。生の z-40 だと content-layer の要素に覆われ、隠したい内容が
  // 見えたまま操作できてしまう
  local: "absolute inset-0 backside-ui-top-layer",
  fullscreen: "fixed inset-0 overlay-layer",
};

export function ScreenLoader({
  mode = "fullscreen",
  className,
  style,
  spinnerClassName,
  spinnerVariant,
  message,
  messageClassName,
}: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-background/80 backdrop-blur-sm",
        MODE_CLASS[mode],
        className,
      )}
      style={style}
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="flex flex-col items-center gap-3 text-primary">
        <Spinner
          className={cn("h-10 w-10 text-current", spinnerClassName)}
          variant={spinnerVariant}
        />
        {message ? <p className={cn("text-sm font-medium", messageClassName)}>{message}</p> : null}
      </div>
    </div>
  );
}
