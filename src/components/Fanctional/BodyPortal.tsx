"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 任意のコンポーネントやフックから `<body>` 要素へ要素を差し込むためのポータル。
 *
 * @example
 * // 例: body 直下にオーバーレイを追加する
 * export function FullScreenOverlay() {
 *   return (
 *     <BodyPortal>
 *       <div className="fixed inset-0 z-50 bg-black/50" />
 *     </BodyPortal>
 *   );
 * }
 */

export function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
