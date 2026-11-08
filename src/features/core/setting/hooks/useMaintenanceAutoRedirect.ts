// src/features/core/setting/hooks/useMaintenanceAutoRedirect.ts
// メンテナンス画面(/maintenance)の自動遷移の公開 hook。終了時刻(設定 maintenanceEndAt を loader が渡す)が来たら
// redirectTo へ router.replace する。過ぎていれば即時、null なら何もしない。unmount で timer を解く。
// 画面は hook を呼ぶだけで、見た目は自由(契約: src/features/core/setting/README.md)

"use client";

import { useEffect } from "react";

import { useRouter } from "@/lib/unsavedGuard";

export type UseMaintenanceAutoRedirectOptions = {
  /** メンテナンス終了時刻(ISO8601)。null = 自動遷移しない */
  endTime: string | null;
  /** 終了時の遷移先パス */
  redirectTo: string;
};

export function useMaintenanceAutoRedirect({ endTime, redirectTo }: UseMaintenanceAutoRedirectOptions): void {
  const router = useRouter();

  useEffect(() => {
    if (!endTime) return;

    const remaining = new Date(endTime).getTime() - Date.now();

    if (remaining <= 0) {
      router.replace(redirectTo);
      return;
    }

    const timer = setTimeout(() => {
      router.replace(redirectTo);
    }, remaining);

    return () => clearTimeout(timer);
  }, [endTime, redirectTo, router]);
}
