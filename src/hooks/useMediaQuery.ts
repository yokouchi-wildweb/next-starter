// src/hooks/useMediaQuery.ts

"use client";

import { useCallback, useSyncExternalStore } from "react";

const getServerSnapshot = () => false;

/**
 * CSS メディアクエリの一致状態を購読する汎用フック。
 *
 * - `useSyncExternalStore` ベースで SSR / hydration 中は常に false を返し、
 *   クライアント側で実値に追従する (hydration 不一致を起こさない)
 * - 判定はレイアウトビューポート基準 (CSS の `@media` と完全に同じ結果になる)
 *
 * ```tsx
 * const isShort = useMediaQuery("(max-height: 500px)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
