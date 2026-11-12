// src/app/api/admin/analytics/messaging/series/route.ts
// 連絡の集計の series(管理者だけ。住所は規則 messagingAnalytics が閉じる)

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import {
  getMessagingSeries,
  parseMessagingFilterParams,
} from "@/features/core/analytics/services/server/messagingAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/messaging/series",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);
    return getMessagingSeries({ ...parseDateRangeParams(searchParams), ...parseMessagingFilterParams(searchParams) });
  },
);
