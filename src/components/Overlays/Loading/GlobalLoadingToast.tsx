// src/components/Overlays/Loading/GlobalLoadingToast.tsx

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Spinner } from "@/components/Overlays/Loading/Spinner";
import {
  useLoadingToastStore,
  type LoadingToastPosition,
  type LoadingToastSize,
} from "@/stores/useLoadingToastStore";
import { cn } from "@/lib/cn";

const POSITION_CLASSES: Record<LoadingToastPosition, string> = {
  "top-left": "top-4 left-4 animate-in slide-in-from-left fade-in",
  "top-center": "top-4 left-1/2 -translate-x-1/2 animate-in slide-in-from-top fade-in",
  "top-right": "top-4 right-4 animate-in slide-in-from-right fade-in",
  "bottom-left": "bottom-4 left-4 animate-in slide-in-from-left fade-in",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 animate-in slide-in-from-bottom fade-in",
  "bottom-right": "bottom-4 right-4 animate-in slide-in-from-right fade-in",
};

const SIZE_CLASSES: Record<LoadingToastSize, { container: string; spinner: string; text: string }> = {
  sm: { container: "gap-2 px-3 py-2", spinner: "h-4 w-4", text: "text-xs" },
  md: { container: "gap-3 px-4 py-3", spinner: "h-5 w-5", text: "text-sm" },
  lg: { container: "gap-5 px-6 py-5", spinner: "h-8 w-8", text: "text-lg" },
};

/**
 * グローバルローディングトーストをPortalでbody直下に描画するコンポーネント。
 * 画面右下に小さなローディング通知を表示する。
 * ルートレイアウトに1つだけ配置して使用する。
 *
 * @example
 * // layout.tsx
 * <GlobalLoadingToast />
 *
 * // 使う側
 * const { showLoadingToast, hideLoadingToast } = useLoadingToast();
 * showLoadingToast("処理中...");
 * await process();
 * hideLoadingToast();
 */
export function GlobalLoadingToast() {
  const { isVisible, options } = useLoadingToastStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isVisible) {
    return null;
  }

  const { message, spinnerVariant, position = "bottom-center", size = "md" } = options;
  const sizeClasses = SIZE_CLASSES[size];

  const content = (
    <div
      className={cn(
        "fixed alert-layer",
        "flex items-center",
        "bg-background border border-border rounded-lg shadow-lg",
        "duration-300",
        sizeClasses.container,
        POSITION_CLASSES[position],
      )}
      role="status"
      aria-live="polite"
      aria-busy
    >
      <Spinner className={cn("text-primary", sizeClasses.spinner)} variant={spinnerVariant} />
      <span className={cn("font-medium", sizeClasses.text)}>{message}</span>
    </div>
  );

  return createPortal(content, document.body);
}
