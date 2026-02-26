// src/app/api/admin/analytics/purchase/daily/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getPurchaseDaily } from "@/features/core/analytics/services/server/purchaseAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/purchase/daily",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    return getPurchaseDaily({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      userId: searchParams.get("userId") ?? undefined,
      walletType: searchParams.get("walletType") ?? undefined,
      paymentProvider: searchParams.get("paymentProvider") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
  },
);
