// src/app/api/admin/analytics/user/status-overview/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { getUserStatusOverview } from "@/features/core/analytics/services/server/userAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/user/status-overview",
    operationType: "read",
  },
  async (_req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    return getUserStatusOverview();
  },
);
