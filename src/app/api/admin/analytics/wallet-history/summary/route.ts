// src/app/api/admin/analytics/wallet-history/summary/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getWalletHistorySummary } from "@/features/core/analytics/services/server/walletHistoryAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/wallet-history/summary",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    return getWalletHistorySummary({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      userId: searchParams.get("userId") ?? undefined,
      walletType: searchParams.get("walletType") ?? undefined,
    });
  },
);
