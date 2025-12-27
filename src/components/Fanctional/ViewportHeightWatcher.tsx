// src/components/Layout/ViewportHeightWatcher.tsx

"use client";

import { useEffect } from "react";

import { useViewportSizeStore } from "@/stores/viewportSize";

/**
 * ビューポートの幅・高さを監視して CSS 変数 `--viewport-height` に反映する
 * コンポーネント。モバイルブラウザのアドレスバーを考慮した実寸値を
 * 各レイアウトで利用できるようにする。
 */
export function ViewportHeightWatcher() {
  const { setSize } = useViewportSizeStore();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewportMetrics = () => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;

      setSize(width, height);
      document.documentElement.style.setProperty("--viewport-height", `${height}px`);
    };

    updateViewportMetrics();

    window.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("scroll", updateViewportMetrics);
    };
  }, [setSize]);

  return null;
}
