// src/app/api/admin/analytics/dau/summary/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/domains/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/domains/core/analytics/services/server/utils/userFilter";
import { getDauSummary } from "@/domains/core/analytics/services/server/dauAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/dau/summary",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    return getDauSummary({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      userId: searchParams.get("userId") ?? undefined,
    });
  },
);
