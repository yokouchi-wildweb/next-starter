// src/lib/viewport/useViewportSize.ts

"use client";

import { useViewportSizeStore } from "./stores";

export type ViewportSize = {
  /** 実寸の幅 (visualViewport 由来。計測前・SSR は 0) */
  width: number;
  /** 実寸の高さ (visualViewport 由来。計測前・SSR は 0)。`--viewport-height` と同じ値 */
  height: number;
};

/**
 * ビューポートの実寸を読むフック(読むだけ)。
 * 値を書くのは root layout の ViewportHeightWatcher だけ。
 */
export function useViewportSize(): ViewportSize {
  const { width, height } = useViewportSizeStore();
  return { width, height };
}
