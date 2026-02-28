// lib/toast/useLoadingToast.ts

"use client";

import { useEffect, useRef } from "react";
import { useToastStore } from "./stores";
import type { ToastOptions } from "./types";

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
  messageOrOptions: string | Omit<ToastOptions, "mode">,
) {
  const { show, hideById } = useToastStore();
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (flag) {
      const options: ToastOptions =
        typeof messageOrOptions === "string"
          ? { message: messageOrOptions, mode: "persistent" }
          : { ...messageOrOptions, mode: "persistent" };
      toastIdRef.current = show(options);
    } else if (toastIdRef.current) {
      hideById(toastIdRef.current);
      toastIdRef.current = null;
    }

    // アンマウント時にトーストを消す
    return () => {
      if (toastIdRef.current) {
        hideById(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [flag, show, hideById]);
}
