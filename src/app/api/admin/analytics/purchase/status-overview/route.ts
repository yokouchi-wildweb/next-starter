// src/app/api/admin/analytics/purchase/status-overview/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { getPurchaseStatusOverview } from "@/features/core/analytics/services/server/purchaseAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/purchase/status-overview",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    return getPurchaseStatusOverview();
  },
);
