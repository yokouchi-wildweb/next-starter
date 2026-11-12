// src/app/api/admin/analytics/messaging/dispatches/route.ts
// 連絡の集計の回ごと(?cursor&limit 1-100 既定 20。回の管理 messagingDispatches が閉なら空。管理者だけ)

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import {
  getMessagingDispatches,
  parseMessagingFilterParams,
} from "@/features/core/analytics/services/server/messagingAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/messaging/dispatches",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = searchParams.get("limit");
    return getMessagingDispatches({
      ...parseDateRangeParams(searchParams),
      ...parseMessagingFilterParams(searchParams),
      ...(cursor && { cursor }),
      ...(limit && Number.isFinite(Number(limit)) && { limit: Number(limit) }),
    });
  },
);
