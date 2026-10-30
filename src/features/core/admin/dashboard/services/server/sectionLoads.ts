// src/features/core/admin/dashboard/services/server/sectionLoads.ts
//
// 管理ダッシュボードのセクションのデータ取得の登録表(loader 側)。表示の対応表 registry.ts と同じ id で 1 行。
// UI(セクション)はサーバーのデータを自分で取らず、AdminHome の loader(範囲の守りを通った後)がここを実行し、
// 結果を AdminDashboard の data で各セクションへ渡す。データの要らないセクションは載せない。

import "server-only";

import type { AdminDashboardData, AdminDashboardSectionLoad } from "../../types";

import { loadMainMetrics } from "./mainMetrics";

export const adminDashboardSectionLoads: Record<string, AdminDashboardSectionLoad> = {
  "main-metrics": loadMainMetrics,
};

/** 登録された取得を並列に実行し、セクション id → 結果を返す */
export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  const entries = await Promise.all(
    Object.entries(adminDashboardSectionLoads).map(async ([id, load]) => [id, await load()] as const),
  );
  return Object.fromEntries(entries);
}
