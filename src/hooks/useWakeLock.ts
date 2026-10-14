// src/hooks/useWakeLock.ts

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};
const getSupported = () =>
  typeof navigator !== "undefined" && "wakeLock" in navigator && Boolean(navigator.wakeLock);
const getServerSupported = () => false;

export type WakeLockState = {
  /** 現在スリープ抑止が効いているか */
  active: boolean;
  /** Screen Wake Lock API が利用可能か (SSR / 非対応ブラウザは false) */
  supported: boolean;
  /** 直近の取得失敗理由 (低電力モード・権限拒否等)。成功で null に戻る */
  error: string | null;
};

/**
 * Screen Wake Lock API で画面のスリープ / 暗転を抑止するフック。
 * 時間制のトレーニング・動画/音声プレイヤー・プレゼン等、操作が途切れても
 * 画面を点けたままにしたい没入ページ向け。
 *
 * - `enabled=true` の間だけ取得し、false / unmount で解放
 * - タブが非表示になるとブラウザが自動解放する → visible 復帰時に再取得
 * - 非対応環境 (iOS Safari 16.4 未満など) は throw せず supported=false の no-op
 * - 取得失敗 (低電力モード等) は error に格納、throw しない
 *
 * ```tsx
 * const { active, supported } = useWakeLock(isSessionRunning);
 * ```
 */
export function useWakeLock(enabled: boolean): WakeLockState {
  const supported = useSyncExternalStore(subscribeNoop, getSupported, getServerSupported);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;

    let cancelled = false;
    let requesting = false;

    const request = async () => {
      if (requesting) return;
      if (document.visibilityState !== "visible") return;
      if (sentinelRef.current && !sentinelRef.current.released) return;

      requesting = true;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener(
          "release",
          () => {
            if (sentinelRef.current === sentinel) {
              sentinelRef.current = null;
            }
            // 別インスタンスへ切り替わっていなければ非アクティブ化
            setActive(sentinelRef.current !== null && !sentinelRef.current.released);
          },
          { once: true },
        );
        setActive(true);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setActive(false);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        requesting = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // 先に ref を外してから解放する: release イベント側で「次の sentinel が
      // 無ければ active=false」に落ち、enabled の高速トグルでも新規取得を阻害しない
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [enabled, supported]);

  return { active, supported, error };
}
