// src/hooks/useRouteChangeEffect.ts

"use client";

import { useEffect, useRef } from "react";
import Router from "next/router";

// ブラウザ上の現在のパス（クエリ・ハッシュ含む）を取得するユーティリティ
function getCurrentPath() {
  if (typeof window === "undefined") {
    return "";
  }

  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

/**
 * ルート遷移の開始前にハンドラーを実行するためのカスタムフック。
 *
 * - `handler` には「遷移前のパス」と「遷移先のパス」が渡されます。
 * - `enabled` を `false` にするとリスナー登録を抑止できます。
 *
 * 例:
 * ```ts
 * useRouteChangeEffect((from, to) => {
 *   console.log(`${from} -> ${to}`);
 * });
 * ```
 */
export function useRouteChangeEffect(
  handler: (from: string, to: string) => void,
  enabled = true,
) {
  // 直近のパスを保持し、イベントコールバックから参照できるようにする
  const fromRef = useRef<string>(getCurrentPath());

  useEffect(() => {
    // フックが無効化されている場合は何もせず終了する
    if (!enabled) return;

    // 初回登録時点のパスを記録しておく
    fromRef.current = getCurrentPath();

    // ルート遷移が開始されたタイミングで呼び出される
    const handleStart = (url: string) => {
      handler(fromRef.current, url);
    };

    // 遷移が完了したら現在のパスを更新して次回に備える
    const handleComplete = (url: string) => {
      fromRef.current = url;
    };

    // Next.js Router のイベントにリスナーを登録する
    Router.events.on("routeChangeStart", handleStart);
    Router.events.on("routeChangeComplete", handleComplete);

    return () => {
      // コンポーネントのアンマウント時にリスナーを解除してリークを防ぐ
      Router.events.off("routeChangeStart", handleStart);
      Router.events.off("routeChangeComplete", handleComplete);
    };
  }, [handler, enabled]);
}
