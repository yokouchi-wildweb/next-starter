// src/features/core/admin/dashboard/sections/mainMetrics.ts
// サービスの稼働状況(ユーザー登録総数・本日の登録数)。取得は services/server/mainMetrics.ts(設定 showMainMetrics が false なら null で何も描かない)

import { MainMetricsSection } from "../components/sections/MainMetricsSection";
import { defineDashboardSection } from "../buildAdminDashboard";
import { loadMainMetrics } from "../services/server/mainMetrics";

export const section = defineDashboardSection({
  key: "mainMetrics",
  order: 100,
  Section: MainMetricsSection,
  load: loadMainMetrics,
});
