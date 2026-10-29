// src/app/api/admin/analytics/user/registration/daily/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getUserRegistrationDaily } from "@/features/core/analytics/services/server/userAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/user/registration/daily",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    return getUserRegistrationDaily({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
    });
  },
);
