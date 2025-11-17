// src/hooks/useRouteTransitionPending.ts

"use client";

import { useEffect, useState } from "react";
import Router from "next/router";

import { useRouteChangeEffect } from "./useRouteChangeEffect";

/**
 * ルート遷移中かどうかを判定するためのカスタムフック。
 *
 * - `routeChangeStart` を感知したタイミングで `true` に切り替わります。
 * - `routeChangeComplete` もしくは `routeChangeError` が発生すると `false` へ戻ります。
 * - `enabled` を `false` にするとリスナー登録を抑止できます。
 */
export function useRouteTransitionPending(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const [isPending, setIsPending] = useState(false);

  useRouteChangeEffect(
    () => {
      setIsPending(true);
    },
    enabled,
  );

  useEffect(() => {
    if (!enabled) {
      setIsPending(false);
      return;
    }

    const handleComplete = () => {
      setIsPending(false);
    };

    Router.events.on("routeChangeComplete", handleComplete);
    Router.events.on("routeChangeError", handleComplete);

    return () => {
      Router.events.off("routeChangeComplete", handleComplete);
      Router.events.off("routeChangeError", handleComplete);
    };
  }, [enabled]);

  return isPending;
}
