// 生成物・編集不可: pnpm generate extensions が src/domains/core/admin/extensionPoints.ts から生成する
// adminDashboardSections: 差す側の <ドメイン>/plugs/adminDashboardSections/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const section(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の hidden・allowRoles・order を重ねる)

import type { AdminDashboardSectionDefinition } from "@/domains/core/admin/dashboard/types";

import { section as adminDashboardSections_admin_additionalMetrics } from "@/domains/core/admin/plugs/adminDashboardSections/additionalMetrics";
import { section as adminDashboardSections_admin_mainMetrics } from "@/domains/core/admin/plugs/adminDashboardSections/mainMetrics";

export const adminDashboardSections: { domain: string | null; name: string; requires: readonly string[]; plug: AdminDashboardSectionDefinition }[] = [
  { domain: "admin", name: "additionalMetrics", requires: [], plug: adminDashboardSections_admin_additionalMetrics },
  { domain: "admin", name: "mainMetrics", requires: [], plug: adminDashboardSections_admin_mainMetrics },
];
