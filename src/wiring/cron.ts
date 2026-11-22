// 生成物・編集不可: pnpm generate extensions が src/lib/cron/extensionPoints.ts から生成する
// cronMaintenance: 差す側の <ドメイン>/plugs/cronMaintenance/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { CronMaintenancePlug } from "@/lib/cron/points";

import { plug as cronMaintenance_setting_maintenance } from "@/domains/core/setting/plugs/cronMaintenance/maintenance";

export const cronMaintenance: { domain: string | null; name: string; requires: readonly string[]; plug: CronMaintenancePlug }[] = [
  { domain: "setting", name: "maintenance", requires: [], plug: cronMaintenance_setting_maintenance },
];
