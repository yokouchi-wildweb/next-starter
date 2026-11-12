// src/app/api/admin/analytics/messaging/breakdown/route.ts
// 連絡の集計の軸ごとの内訳(?axis=channel|message|category|template|tag、他は 400。管理者だけ)

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import {
  getMessagingBreakdown,
  parseMessagingFilterParams,
} from "@/features/core/analytics/services/server/messagingAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/messaging/breakdown",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);
    return getMessagingBreakdown({
      ...parseDateRangeParams(searchParams),
      ...parseMessagingFilterParams(searchParams),
      axis: searchParams.get("axis") ?? "",
    });
  },
);
