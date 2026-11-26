// src/domains/core/auth/hooks/useAutoLogout.ts
// 画面を開いたら 1 回だけログアウトする公開 hook(/logout の処理)。useLogout を包み、訪れるたびに 1 回発火する
// (StrictMode の 2 回目の effect は ref で止める)。失敗は error に入り、retry で再実行できる。
// 画面は hook を呼んで状態を描くだけ(契約: src/domains/core/auth/README.md 公開 hook の契約表)

"use client";

import { useCallback, useEffect, useRef } from "react";

import { useLogout } from "@/domains/core/auth/hooks/useLogout";
import { useOnPageLeave } from "@/lib/pageLeave";

export type UseAutoLogoutOptions = {
  /** ログアウト後の遷移先(内部パス。/logout の loader が限定済みの値を渡す) */
  redirectTo: string;
};

export function useAutoLogout({ redirectTo }: UseAutoLogoutOptions) {
  const { logout, isLoading, error } = useLogout({ redirectTo });
  const hasTriggered = useRef(false);

  const retry = useCallback(() => {
    logout().catch(() => {
      // エラーは useLogout の error に入るので、ここでは握り潰す
    });
  }, [logout]);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;
    retry();
  }, [retry]);
  // 訪れるたびにログアウトする: <Activity> に隠された /logout に戻った時も発火し直す(離れた時に ref を戻す)
  useOnPageLeave(() => {
    hasTriggered.current = false;
  });

  return { isLoading, error, retry } as const;
}
