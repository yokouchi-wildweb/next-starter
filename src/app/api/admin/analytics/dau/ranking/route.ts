// src/app/api/admin/analytics/dau/ranking/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getDauRanking } from "@/features/core/analytics/services/server/dauAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/dau/ranking",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    return getDauRanking({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      page: searchParams.get("page")
        ? Number(searchParams.get("page"))
        : undefined,
      lastActiveDateFrom: searchParams.get("lastActiveDateFrom") ?? undefined,
      lastActiveDateTo: searchParams.get("lastActiveDateTo") ?? undefined,
    });
  },
);
