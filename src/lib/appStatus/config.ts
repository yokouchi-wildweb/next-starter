// src/lib/appStatus/config.ts — appStatus の設定(既定 + src/config/lib/appStatus.config.ts の上書き)。説明: README.md

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/appStatus";

export type AppStatusConfig = {
  /** 状態を読む道(src/app/api/health の応答 = AppStatusResponse) */
  healthPath: string;
  /** メンテナンスで止められた時に移る道(onMaintenance を渡さない時) */
  maintenancePath: string;
  /** 確かめる間隔(ミリ秒)の既定 */
  intervalMs: number;
};

const defaults: AppStatusConfig = {
  healthPath: "/api/health",
  maintenancePath: "/maintenance",
  intervalMs: 30_000,
};

export const appStatusConfigDef = defineConfig(defaults, { label: "appStatus" });

/** 上書きのファイル(src/config/lib/appStatus.config.ts)の型 */
export type AppStatusOverride<E extends object = {}> = OverrideOf<typeof appStatusConfigDef, E>;

export const appStatusConfig: AppStatusConfig = appStatusConfigDef.compose(override);
