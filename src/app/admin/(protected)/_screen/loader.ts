// src/app/admin/(protected)/_screen/loader.ts
// /admin(管理ダッシュボード)の loader。範囲 admin/(protected) の createLoader で、ダッシュボードのセクションの取得
// (features/core/admin/dashboard の services/server/sectionLoads.ts。見る人のロールと門番の規則で絞る)を
// 範囲の守りを通った後に実行し、描くセクションの key → 結果を返す。
// 上流所有。差し替えは同じルートの _components/ で(src/lib/screens/README.md)

import "server-only";

import { loadAdminDashboardData } from "@/features/core/admin/dashboard/services/server/sectionLoads";
import type { AdminDashboardData } from "@/features/core/admin/dashboard/types";
import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminHomeScreenData = { sections: AdminDashboardData };

export const loadAdminHomeScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async ({ user }): Promise<AdminHomeScreenData> => ({ sections: await loadAdminDashboardData({ role: user?.role }) }),
});
