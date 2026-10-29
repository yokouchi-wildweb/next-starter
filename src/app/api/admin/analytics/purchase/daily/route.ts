// src/app/api/admin/analytics/purchase/daily/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getPurchaseDaily } from "@/features/core/analytics/services/server/purchaseAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/purchase/daily",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    return getPurchaseDaily({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      userId: searchParams.get("userId") ?? undefined,
      walletType: searchParams.get("walletType") ?? undefined,
      paymentProvider: searchParams.get("paymentProvider") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
  },
);
