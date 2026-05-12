// src/features/core/admin/dashboard/index.ts
//
// 管理ダッシュボードドメインの公開エントリーポイント。
//
// page.tsx 等の利用側からは本バレル経由で import する:
//   import { AdminDashboard } from "@/features/admin/dashboard";

export { AdminDashboard } from "./components/AdminDashboard";
export { adminDashboardSections } from "./registry";
export type { AdminDashboardSection, AdminDashboardSectionComponent } from "./types";
