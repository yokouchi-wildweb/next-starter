// lib/toast/useToast.ts

"use client";

import { useCallback } from "react";
import { useToastStore } from "./stores";
import type { ToastOptions, ToastVariant, ToastPosition } from "./types";

/**
 * トーストを制御するフック。
 * 画面中央または指定位置にリッチな通知を表示する。
 *
 * @example
 * const { showToast, hideToast } = useToast();
 *
 * // ショートハンド（message, variant, position?）
 * showToast("保存しました", "success");
 * showToast("エラーが発生しました", "error", "top-center");
 *
 * // オブジェクト形式（詳細オプション）
 * showToast({
 *   message: "処理中...",
 *   variant: "loading",
 *   mode: "persistent",
 * });
 *
 * // サイズ指定
 * showToast({
 *   message: "大きな通知",
 *   variant: "info",
 *   size: "lg",
 * });
 *
 * // アイコン回転（loading以外でも）
 * showToast({
 *   message: "同期中...",
 *   variant: "info",
 *   spinning: true,
 * });
 *
 * // 永続表示（手動消去）
 * showToast({
 *   message: "アップロード中...",
 *   variant: "loading",
 *   mode: "persistent",
 * });
 * await upload();
 * hideToast();
 */
export function useToast() {
  const { show, hide } = useToastStore();

  const showToast = useCallback(
    (
      messageOrOptions: string | ToastOptions,
      variant?: ToastVariant,
      position?: ToastPosition,
    ) => {
      if (typeof messageOrOptions === "string") {
        show({
          message: messageOrOptions,
          variant: variant ?? "info",
          position,
        });
      } else {
        show(messageOrOptions);
      }
    },
    [show],
  );

  const hideToast = useCallback(() => {
    hide();
  }, [hide]);

  return { showToast, hideToast };
}
