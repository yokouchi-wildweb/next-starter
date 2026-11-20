// src/lib/appStatus/useAppStatus.ts

"use client";

import { useCallback, useEffect, useRef } from "react";

import { appStatusConfig } from "./config";
import { resolveAppStatusEvent } from "./resolveAppStatusEvent";
import type { AppStatusResponse, UseAppStatusOptions } from "./types";

/**
 * アプリの状態を定期的に読み、メンテナンス・新しいデプロイを見つけたら動くフック。長く居る画面の client 部品の先頭で呼ぶ。
 * 既定の動き: メンテナンスで止められたら設定の maintenancePath へ移り(全体の読み込み = proxy のメンテナンスの門を通る)、
 * 新しいデプロイなら読み直す。onMaintenance / onNewDeploy を渡すとその動きに替わる
 *
 * 認証の要らない /api/health を読むので、axios ではなく fetch を直に使う
 */
export function useAppStatus(options: UseAppStatusOptions = {}): void {
  const { intervalMs = appStatusConfig.intervalMs, onMaintenance, onNewDeploy, enabled = true } = options;

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
      const res = await fetch(appStatusConfig.healthPath, { cache: "no-store" });
      if (!res.ok) return;

      const data: AppStatusResponse = await res.json();
      const event = resolveAppStatusEvent(data, initialBuildIdRef.current);

      if (event === "maintenance") {
        if (onMaintenanceRef.current) onMaintenanceRef.current();
        else window.location.assign(appStatusConfig.maintenancePath);
        return;
      }
      if (initialBuildIdRef.current === null) initialBuildIdRef.current = data.buildId;
      if (event === "newDeploy") {
        if (onNewDeployRef.current) onNewDeployRef.current();
        else window.location.reload();
      }
    } catch {
      // ネットワークエラーは無視(オフライン等)
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
