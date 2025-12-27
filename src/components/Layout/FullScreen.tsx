// src/components/Layout/FullScreen.tsx

"use client";

import { useEffect, useState } from "react";
import { useDisableScroll } from "@/hooks/useDisableScroll";
import { useViewportSizeStore } from "@/stores/viewportSize";
import { cn } from "@/lib/cn";

const LAYER_CLASS_MAP = {
  background: "background-layer",
  base: "base-layer",
  content: "content-layer",
  belowHeader: "below-header-layer",
  header: "header-layer",
  aboveHeader: "above-header-layer",
  forefrontLow: "forefront-low-layer",
  forefront: "forefront-layer",
  forefrontTop: "forefront-top-layer",
  backdrop: "backdrop-layer",
  modal: "modal-layer",
  overlay: "overlay-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
} as const;

export type FullScreenLayer = keyof typeof LAYER_CLASS_MAP;

type Props = {
  className?: string;
  children: React.ReactNode;
  layer?: FullScreenLayer;
  /**
   * true の場合は Body のスクロールを抑止します。
   * 背景演出などで FullScreen を使うケースでは false を指定して
   * ページ全体のスクロールを維持できます。
   */
  disableScroll?: boolean;
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
export default function FullScreen({
  className,
  children,
  layer = "aboveHeader",
  disableScroll: shouldDisableScroll = true,
}: Props) {
  const { disableScroll, enableScroll } = useDisableScroll(true);
  const { setSize: setViewportSize } = useViewportSizeStore();

  // スクロールロックはマウント後に実行
  useEffect(() => {
    if (!shouldDisableScroll) {
      return;
    }

    disableScroll();
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;
    setViewportSize(width, height);

    return () => {
      enableScroll();
    };
  }, [disableScroll, enableScroll, setViewportSize, shouldDisableScroll]);

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
