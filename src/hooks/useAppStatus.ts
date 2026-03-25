// src/hooks/useAppStatus.ts

"use client";

import { useCallback, useEffect, useRef } from "react";

type AppStatus = {
  buildId: string;
  maintenance: boolean;
};

type UseAppStatusOptions = {
  /** ポーリング間隔（ミリ秒） デフォルト: 30000 */
  intervalMs?: number;
  /** メンテナンス検知時のコールバック */
  onMaintenance?: () => void;
  /** デプロイ検知時のコールバック */
  onNewDeploy?: () => void;
  /** 有効フラグ デフォルト: true */
  enabled?: boolean;
};

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * アプリステータスを定期ポーリングし、メンテナンス・デプロイを検知するフック
 *
 * 認証不要の /api/health を使用するため、axios ではなく fetch を直接使用
 */
export function useAppStatus(options: UseAppStatusOptions = {}) {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    onMaintenance,
    onNewDeploy,
    enabled = true,
  } = options;

  const initialBuildIdRef = useRef<string | null>(null);
  const onMaintenanceRef = useRef(onMaintenance);
  const onNewDeployRef = useRef(onNewDeploy);

  // コールバックの最新値を保持
  useEffect(() => {
    onMaintenanceRef.current = onMaintenance;
    onNewDeployRef.current = onNewDeploy;
  }, [onMaintenance, onNewDeploy]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) return;

      const data: AppStatus = await res.json();

      // メンテナンス検知
      if (data.maintenance) {
        onMaintenanceRef.current?.();
        return;
      }

      // デプロイ検知（初回取得時のbuildIdを基準にする）
      if (initialBuildIdRef.current === null) {
        initialBuildIdRef.current = data.buildId;
      } else if (data.buildId !== initialBuildIdRef.current) {
        onNewDeployRef.current?.();
      }
    } catch {
      // ネットワークエラーは無視（オフライン等）
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 初回チェック
    checkStatus();

    const timer = setInterval(checkStatus, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, checkStatus]);
}
