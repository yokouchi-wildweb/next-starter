// src/components/Layout/FullScreen.tsx

"use client";

import { useEffect } from "react";
import { useDisableScroll } from "@/hooks/useDisableScroll";
import { cn } from "@/lib/cn";
import { zLayerClass, type ZLayerName } from "@/lib/zLayer";

// 受ける名は camelCase のまま(公開の props)。層の名(@/lib/zLayer)へ写して class を引く
const LAYER_NAME_MAP = {
  background: "background",
  base: "base",
  content: "content",
  belowHeader: "below-header",
  header: "header",
  aboveHeader: "above-header",
  forefrontLow: "forefront-low",
  forefront: "forefront",
  forefrontTop: "forefront-top",
  backdrop: "backdrop",
  modal: "modal",
  overlay: "overlay",
  alert: "alert",
  super: "super",
  ultimate: "ultimate",
  apex: "apex",
} as const satisfies Record<string, ZLayerName>;

export type FullScreenLayer = keyof typeof LAYER_NAME_MAP;

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
        zLayerClass(LAYER_NAME_MAP[layer]),
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
