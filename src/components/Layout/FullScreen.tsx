// src/components/Layout/FullScreen.tsx

"use client";

import { useEffect, useState } from "react";
import { useDisableScroll } from "@/hooks/useDisableScroll";
import { useViewportSize } from "@/stores/useViewportSize";
import { cn } from "@/lib/cn";

const LAYER_CLASS_MAP = {
  background: "z-[var(--z-layer-background)]",
  base: "z-[var(--z-layer-base)]",
  content: "z-[var(--z-layer-content)]",
  belowHeader: "z-[var(--z-layer-below-header)]",
  header: "z-[var(--z-layer-header)]",
  aboveHeader: "z-[var(--z-layer-above-header)]",
  modal: "z-[var(--z-layer-modal)]",
  overlay: "z-[var(--z-layer-overlay)]",
  alert: "z-[var(--z-layer-alert)]",
  super: "z-[var(--z-layer-super)]",
  ultimate: "z-[var(--z-layer-ultimate)]",
  apex: "z-[var(--z-layer-apex)]",
} as const;

export type FullScreenLayer = keyof typeof LAYER_CLASS_MAP;

type Props = {
  className?: string;
  children: React.ReactNode;
  layer?: FullScreenLayer;
};

/**
 * FullScreen は、モバイルブラウザでのアドレスバーの影響を回避しつつ
 * 画面の幅・高さいっぱいに要素を表示するためのコンポーネント
 * - `height`: 初期は CSS の `100dvh` を使用し、`visualViewport.height` もしくは
 *   `window.innerHeight` が取得でき次第それに置き換え
 *   → これにより、各種モバイルブラウザでのアドレスバーによる高さのズレを防ぐ
 * - `width`: 常に `100vw` を指定。幅についてはアドレスバーの影響を受けにくいため
 * - `disableScroll()`: フルスクリーン表示中にスクロールを無効化
 */
export default function FullScreen({ className, children, layer = "modal" }: Props) {
  const { disableScroll } = useDisableScroll(true);
  const { setSize: setViewportSize } = useViewportSize();

  // スクロールロックはマウント後に実行
  useEffect(() => {
    disableScroll();
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;
    setViewportSize(width, height);
  }, [disableScroll, setViewportSize]);

  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const updateHeight = () => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(height);
      setViewportSize(width, height);
      document.documentElement.style.setProperty("--viewport-height", `${height}px`);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, [setViewportSize]);

  return (
    <div
      className={cn(
        "fixed inset-0",
        LAYER_CLASS_MAP[layer],
        className,
      )}
      style={{
        height: viewportHeight ? `${viewportHeight}px` : "var(--viewport-height, 100dvh)",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
