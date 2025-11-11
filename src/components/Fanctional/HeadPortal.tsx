"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 任意のコンポーネントやフックから `<head>` 要素へ要素を差し込むためのポータル。
 *
 * @example
 * // 例: クライアントコンポーネントからカスタムスクリプトを追加する
 * export function AnalyticsScript() {
 *   return (
 *     <HeadPortal>
 *       <script id="ga" dangerouslySetInnerHTML="xxxxxx" />
 *     </HeadPortal>
 *   );
 * }
 */

export function HeadPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.head);
}