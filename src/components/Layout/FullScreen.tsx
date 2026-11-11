// src/components/Layout/FullScreen.tsx

"use client";

import { useEffect } from "react";
import { useDisableScroll } from "@/hooks/useDisableScroll";
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
 * - `height`: `var(--viewport-height, 100dvh)` を読むだけ。値を書くのは root layout の
 *   ViewportHeightWatcher(@/lib/viewport)だけで、FullScreen 自身は計測しない
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

  // スクロールロックはマウント後に実行
  useEffect(() => {
    if (!shouldDisableScroll) {
      return;
    }

    disableScroll();

    return () => {
      enableScroll();
    };
  }, [disableScroll, enableScroll, shouldDisableScroll]);

  return (
    <div
      data-component="FullScreen"
      className={cn(
        "fixed inset-0",
        LAYER_CLASS_MAP[layer],
        className,
      )}
      style={{
        height: "var(--viewport-height, 100dvh)",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
