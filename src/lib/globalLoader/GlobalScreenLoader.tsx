// src/lib/globalLoader/GlobalScreenLoader.tsx

"use client";

import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { useIsClient } from "@/lib/isClient";

import { LOADER_SPINNER_ICONS } from "./spinner";
import { useGlobalLoaderStore } from "./stores";

/**
 * グローバルローダーを Portal で body 直下に描画するコンポーネント。
 * ルートレイアウトに 1 つだけ配置して使用する。動かすのは useGlobalLoader の showLoader / hideLoader。
 *
 * 描画は棚の ScreenLoader(mode="fullscreen")+ Spinner と同じ形を自分で持つ(lib は棚を読まない: D103)。
 * 同じ出力になることは src/components/Overlays/Loading/globalLoaderParity.test.tsx が確かめる。
 *
 * @example
 * // layout.tsx
 * <GlobalScreenLoader />
 *
 * // 使う側
 * const { showLoader, hideLoader } = useGlobalLoader();
 * showLoader("ガチャ準備中…");
 * await draw();
 * hideLoader();
 */
export function GlobalScreenLoader() {
  const { isVisible, options } = useGlobalLoaderStore();
  const mounted = useIsClient();

  if (!mounted || !isVisible) {
    return null;
  }

  const { zIndex, className, spinnerClassName, spinnerVariant = "default", message, messageClassName } = options;
  const Icon = LOADER_SPINNER_ICONS[spinnerVariant];

  const content = (
    <div
      className={cn(
        "flex items-center justify-center bg-background/80 backdrop-blur-sm",
        "fixed inset-0 overlay-layer",
        className,
      )}
      style={zIndex ? { zIndex } : undefined}
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="flex flex-col items-center gap-3 text-primary">
        <Icon className={cn("animate-spin", cn("h-10 w-10 text-current", spinnerClassName))} />
        {message ? <p className={cn("text-sm font-medium", messageClassName)}>{message}</p> : null}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
