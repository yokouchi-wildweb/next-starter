// src/lib/globalLoader/useGlobalLoader.ts

"use client";

import { useCallback } from "react";
import { useGlobalLoaderStore, type LoaderOptions } from "./stores";

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
  const { setVisible, setOptions } = useGlobalLoaderStore();

  const showLoader = useCallback(
    (options?: string | LoaderOptions) => {
      const resolved: LoaderOptions =
        typeof options === "string" ? { message: options } : options ?? {};
      setOptions(resolved);
      setVisible(true);
    },
    [setVisible, setOptions],
  );

  const hideLoader = useCallback(() => {
    setVisible(false);
    setOptions({});
  }, [setVisible, setOptions]);

  return { showLoader, hideLoader };
}
