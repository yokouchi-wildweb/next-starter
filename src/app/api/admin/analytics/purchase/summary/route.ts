// src/app/api/admin/analytics/purchase/summary/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { getPurchaseSummary } from "@/features/core/analytics/services/server/purchaseAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/purchase/summary",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    return getPurchaseSummary({
      ...parseDateRangeParams(searchParams),
      walletType: searchParams.get("walletType") ?? undefined,
    });
  },
);
