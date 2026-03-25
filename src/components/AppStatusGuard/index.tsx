// src/components/AppStatusGuard/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useAppStatus } from "@/hooks/useAppStatus";

type AppStatusGuardProps = {
  /** ポーリング間隔（ミリ秒） デフォルト: 30000 */
  intervalMs?: number;
  /** 有効フラグ デフォルト: true */
  enabled?: boolean;
};

/**
 * メンテナンス・デプロイを検知してリダイレクト/リロードするガードコンポーネント
 * クライアントサイドで長時間滞在する画面に配置する
 */
export function AppStatusGuard({
  intervalMs,
  enabled = true,
}: AppStatusGuardProps) {
  const router = useRouter();

  const handleMaintenance = useCallback(() => {
    router.push("/maintenance");
  }, [router]);

  const handleNewDeploy = useCallback(() => {
    window.location.reload();
  }, []);

  useAppStatus({
    intervalMs,
    onMaintenance: handleMaintenance,
    onNewDeploy: handleNewDeploy,
    enabled,
  });

  return null;
}
