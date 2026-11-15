// src/features/core/admin/dashboard/index.ts
//
// 管理ダッシュボードドメインの公開エントリーポイント。
//
// page.tsx 等の利用側からは本バレル経由で import する:
//   import { AdminDashboard } from "@/features/admin/dashboard";
// セクションの定義(sections/<key>.ts(x))は defineDashboardSection で書く。

export { AdminDashboard } from "./components/AdminDashboard";
export { buildAdminDashboard, defineDashboardSection } from "./buildAdminDashboard";
export type {
  AdminDashboardData,
  AdminDashboardHiddenEntry,
  AdminDashboardHiddenReason,
  AdminDashboardSectionComponent,
  AdminDashboardSectionDefinition,
  AdminDashboardSectionLoad,
  AdminDashboardSectionOverride,
  AdminDashboardSectionProps,
  BuildAdminDashboardInput,
  BuiltAdminDashboard,
} from "./types";
