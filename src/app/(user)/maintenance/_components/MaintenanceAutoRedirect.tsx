"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** メンテナンス終了時刻（ISO8601形式） */
  endTime: string | null;
  /** リダイレクト先パス */
  redirectTo: string;
};

/**
 * メンテナンス終了時に自動的にリダイレクトするコンポーネント
 * endTime が設定されている場合、終了時刻にリダイレクトを発火する
 */
export function MaintenanceAutoRedirect({ endTime, redirectTo }: Props) {
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

  return null;
}
