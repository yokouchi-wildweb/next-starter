// src/app/api/admin/analytics/purchase/status-overview/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { getPurchaseStatusOverview } from "@/features/core/analytics/services/server/purchaseAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/purchase/status-overview",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    return getPurchaseStatusOverview();
  },
);
