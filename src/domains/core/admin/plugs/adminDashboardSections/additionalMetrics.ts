// src/domains/core/admin/dashboard/sections/additionalMetrics.ts
// 追加の指標(テンプレート用のサンプルチャート)。取得なし(設定 showAdditionalMetrics が false なら何も描かない)

import { AdditionalMetricsSection } from "@/domains/core/admin/dashboard/components/sections/AdditionalMetricsSection";
import { defineDashboardSection } from "@/domains/core/admin/dashboard/buildAdminDashboard";

export const section = defineDashboardSection({
  key: "additionalMetrics",
  order: 200,
  Section: AdditionalMetricsSection,
});
