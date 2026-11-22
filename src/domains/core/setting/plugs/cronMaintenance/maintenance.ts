// src/domains/core/setting/plugs/cronMaintenance/maintenance.ts
//
// 点 cronMaintenance(cron のメンテナンスの判定、0〜1 個、宣言 src/lib/cron/extensionPoints.ts)の上流の項目。
// 期間中は task.ts で maintenance: "pass" を宣言したタスクだけ走る(判定は API・画面と同じ isMaintenanceActive)。
// 結ぶのは src/wiring/cronRoute.ts(生成された一覧 src/wiring/cron.ts ごし)


import { settingService } from "@/domains/core/setting/services/server/settingService";
import type { CronMaintenancePlug } from "@/lib/cron/points";

export const plug: CronMaintenancePlug = {
  deps: {
    isActive: () => settingService.isMaintenanceActive(),
  },
};
