// src/hooks/useLoadingToast.ts

"use client";

import { useCallback } from "react";
import { useLoadingToastStore, type LoadingToastOptions } from "@/stores/useLoadingToastStore";

const DEFAULT_MESSAGE = "変更を処理中です…";

/**
 * ローディングトーストを制御するフック。
 * 画面の四隅に小さなローディング通知を表示する。
 *
 * @example
 * const { showLoadingToast, hideLoadingToast } = useLoadingToast();
 *
 * showLoadingToast();                    // デフォルトメッセージ（下中央）
 * showLoadingToast("アップロード中...");  // カスタムメッセージ
 * await upload();
 * hideLoadingToast();
 *
 * // オプション指定
 * showLoadingToast({
 *   message: "同期中...",
 *   spinnerVariant: "ring",
 *   position: "top-center",  // "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
 *   size: "lg",              // "sm" | "md" | "lg"
 * });
 */
export function useLoadingToast() {
  const setVisible = useLoadingToastStore((s) => s.setVisible);
  const setOptions = useLoadingToastStore((s) => s.setOptions);

  const showLoadingToast = useCallback(
    (options?: string | LoadingToastOptions) => {
      const resolved: LoadingToastOptions =
        typeof options === "string"
          ? { message: options }
          : options ?? {};

      // デフォルトメッセージを設定
      if (!resolved.message) {
        resolved.message = DEFAULT_MESSAGE;
      }

      setOptions(resolved);
      setVisible(true);
    },
    [setVisible, setOptions],
  );

  const hideLoadingToast = useCallback(() => {
    setVisible(false);
    setOptions({});
  }, [setVisible, setOptions]);

  return { showLoadingToast, hideLoadingToast };
}
