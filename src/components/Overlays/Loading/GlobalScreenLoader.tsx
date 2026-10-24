// src/components/Overlays/Loading/GlobalScreenLoader.tsx

"use client";

import { createPortal } from "react-dom";

import { useIsClient } from "@/hooks/useIsClient";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { useGlobalLoaderStore } from "@/stores/globalLoader";

/**
 * グローバルローダーをPortalでbody直下に描画するコンポーネント。
 * ルートレイアウトに1つだけ配置して使用する。
 *
 * @example
 * // layout.tsx
 * <GlobalScreenLoader />
 *
 * // 使う側
 * const { showLoader, hideLoader } = useGlobalLoaderStore();
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

  const { zIndex, className, ...screenLoaderProps } = options;

  const content = (
    <ScreenLoader
      mode="fullscreen"
      className={className}
      style={zIndex ? { zIndex } : undefined}
      {...screenLoaderProps}
    />
  );

  return createPortal(content, document.body);
}
