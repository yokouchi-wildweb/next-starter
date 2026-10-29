// src/app/api/admin/analytics/dau/daily/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getDauDaily } from "@/features/core/analytics/services/server/dauAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/dau/daily",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    return getDauDaily({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      userId: searchParams.get("userId") ?? undefined,
    });
  },
);
