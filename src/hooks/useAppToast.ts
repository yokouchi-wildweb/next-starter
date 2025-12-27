// src/hooks/useAppToast.ts

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useAppToastStore,
  type AppToastOptions,
  type AppToastVariant,
  type AppToastPosition,
} from "@/stores/appToast";

/**
 * アプリ用トーストを制御するフック。
 * 画面中央または指定位置にリッチな通知を表示する。
 *
 * @example
 * const { showAppToast, hideAppToast } = useAppToast();
 *
 * // ショートハンド（message, variant, position?）
 * showAppToast("保存しました", "success");
 * showAppToast("エラーが発生しました", "error", "top-center");
 *
 * // オブジェクト形式（詳細オプション）
 * showAppToast({
 *   message: "処理中...",
 *   variant: "loading",
 *   mode: "persistent",
 * });
 *
 * // サイズ指定
 * showAppToast({
 *   message: "大きな通知",
 *   variant: "info",
 *   size: "lg",
 * });
 *
 * // アイコン回転（loading以外でも）
 * showAppToast({
 *   message: "同期中...",
 *   variant: "info",
 *   spinning: true,
 * });
 *
 * // 永続表示（手動消去）
 * showAppToast({
 *   message: "アップロード中...",
 *   variant: "loading",
 *   mode: "persistent",
 * });
 * await upload();
 * hideAppToast();
 */
export function useAppToast() {
  const { show, hide } = useAppToastStore();

  const showAppToast = useCallback(
    (
      messageOrOptions: string | AppToastOptions,
      variant?: AppToastVariant,
      position?: AppToastPosition,
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

  const hideAppToast = useCallback(() => {
    hide();
  }, [hide]);

  return { showAppToast, hideAppToast };
}

/**
 * フラグに連動してローディングトーストを自動表示/非表示するフック。
 * フラグがtrueの間だけトーストを表示し、falseになると自動で非表示にする。
 * 別のトーストで上書きされた場合は、そのトーストを消さない。
 *
 * @example
 * const { isPending } = useMutation(...);
 *
 * // シンプルな使い方
 * useLoadingToast(isPending, "保存中...");
 *
 * // オプション指定
 * useLoadingToast(isPending, {
 *   message: "処理中...",
 *   position: "top-center",
 *   size: "sm",
 * });
 */
export function useLoadingToast(
  flag: boolean,
  messageOrOptions: string | Omit<AppToastOptions, "mode">,
) {
  const { show, hideById } = useAppToastStore();
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (flag) {
      const options: AppToastOptions =
        typeof messageOrOptions === "string"
          ? { message: messageOrOptions, mode: "persistent" }
          : { ...messageOrOptions, mode: "persistent" };
      toastIdRef.current = show(options);
    } else if (toastIdRef.current) {
      hideById(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, [flag, show, hideById]);
}
