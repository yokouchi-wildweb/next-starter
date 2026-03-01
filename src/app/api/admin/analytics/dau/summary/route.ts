// src/app/api/admin/analytics/dau/summary/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getDauSummary } from "@/features/core/analytics/services/server/dauAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/dau/summary",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    return getDauSummary({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
    });
  },
);
