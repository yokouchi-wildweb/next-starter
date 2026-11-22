// 生成物・編集不可: pnpm generate extensions が src/domains/core/admin/extensionPoints.ts から生成する
// dashboardSections: src/domains/core/admin/dashboard/sections/<名前>.ts(x) か <名前>/index.ts(x) の export const section(並びはファイル名の順)

import type { AdminDashboardSectionDefinition } from "@/domains/core/admin/dashboard/types";

import { section as dashboardSections_additionalMetrics } from "@/domains/core/admin/dashboard/sections/additionalMetrics";
import { section as dashboardSections_mainMetrics } from "@/domains/core/admin/dashboard/sections/mainMetrics";

const dashboardSectionsList: AdminDashboardSectionDefinition[] = [
  dashboardSections_additionalMetrics,
  dashboardSections_mainMetrics,
];
export const dashboardSections: Readonly<Record<string, AdminDashboardSectionDefinition>> = Object.assign(Object.create(null), Object.fromEntries(dashboardSectionsList.map((item) => [String(item.key), item])));
if (Object.keys(dashboardSections).length !== dashboardSectionsList.length) throw new Error("dashboardSections: key が重複している項目がある");
