// src/domains/core/setting/utils/maintenanceWindow.ts
// メンテナンスの期間の判定(純関数。読み先が DB でもコードでも同じ判定)。読み手は settingService.isMaintenanceActive

import type { SettingValues } from "../entities/model";

export type MaintenanceValue = SettingValues["maintenance"];

/** その時刻にメンテナンス中か(有効で、開始の後・終了の前。開始・終了の null は端なし) */
export function isMaintenanceWindowActive(value: MaintenanceValue, nowMs: number): boolean {
  if (!value.enabled) return false;
  const start = value.startAt ? new Date(value.startAt).getTime() : null;
  const end = value.endAt ? new Date(value.endAt).getTime() : null;
  if (start !== null && nowMs < start) return false;
  if (end !== null && nowMs >= end) return false;
  return true;
}
