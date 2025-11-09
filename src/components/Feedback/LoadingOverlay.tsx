// src/components/Feedback/LoadingOverlay.tsx
import { type ReactNode } from "react";

import { Spinner, type SpinnerVariant } from "@/components/Feedback/Spinner";
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
  local: "absolute inset-0 z-40",
  fullscreen: "fixed inset-0 z-50",
};

export function LoadingOverlay({
  mode = "fullscreen",
  className,
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
