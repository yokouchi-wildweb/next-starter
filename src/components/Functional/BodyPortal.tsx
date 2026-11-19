"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useIsClient } from "@/lib/isClient";

/**
 * 任意のコンポーネントやフックから `<body>` 要素へ要素を差し込むためのポータル。
 *
 * @example
 * // 例: body 直下にオーバーレイを追加する
 * export function FullScreenOverlay() {
 *   return (
 *     <BodyPortal>
 *       <div className={`fixed inset-0 bg-overlay/50 ${zLayerClass("floating")}`} />  // 層は zLayer の名(@/lib/zLayer)
 *     </BodyPortal>
 *   );
 * }
 */

export function BodyPortal({ children }: { children: ReactNode }) {
  const mounted = useIsClient();

  if (!mounted) return null;

  return createPortal(children, document.body);
}
