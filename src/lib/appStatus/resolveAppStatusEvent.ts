// src/lib/appStatus/resolveAppStatusEvent.ts — 1 回の応答から何が起きたかを決める(純粋な関数。useAppStatus が使う)

import type { AppStatusEvent, AppStatusResponse } from "./types";

/**
 * メンテナンス = viewer が実際に止められる時だけ(active かつ bypass できない。判定は /api/health 側で proxy と同じ)。
 * 新しいデプロイ = 最初に読んだ buildId と違う時。最初の 1 回(initialBuildId が null)は基準にするだけ
 */
export function resolveAppStatusEvent(data: AppStatusResponse, initialBuildId: string | null): AppStatusEvent {
  if (data.maintenance.active && !data.maintenance.bypassed) return "maintenance";
  if (initialBuildId !== null && data.buildId !== initialBuildId) return "newDeploy";
  return "none";
}
