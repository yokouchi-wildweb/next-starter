"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useIsClient } from "@/hooks/useIsClient";

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
  const mounted = useIsClient();

  if (!mounted) return null;

  return createPortal(children, document.head);
}