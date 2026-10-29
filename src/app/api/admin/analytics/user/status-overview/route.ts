// src/app/api/admin/analytics/user/status-overview/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { getUserStatusOverview } from "@/features/core/analytics/services/server/userAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/user/status-overview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req) => {
    return getUserStatusOverview();
  },
);
