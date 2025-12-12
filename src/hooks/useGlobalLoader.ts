// src/hooks/useGlobalLoader.ts

"use client";

import { useGlobalLoaderStore } from "@/stores/useGlobalLoaderStore";

/**
 * グローバルローダーを制御するフック。
 *
 * @example
 * const { showLoader, hideLoader } = useGlobalLoader();
 *
 * showLoader("ガチャ準備中…");
 * await draw();
 * hideLoader();
 *
 * // オプション指定
 * showLoader({
 *   message: "データ処理中…",
 *   spinnerVariant: "ring",
 *   zIndex: 100,
 * });
 */
export function useGlobalLoader() {
  const showLoader = useGlobalLoaderStore((s) => s.showLoader);
  const hideLoader = useGlobalLoaderStore((s) => s.hideLoader);
  return { showLoader, hideLoader };
}
