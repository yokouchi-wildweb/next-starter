// src/app/api/admin/analytics/wallet-history/daily/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getWalletHistoryDaily } from "@/features/core/analytics/services/server/walletHistoryAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/wallet-history/daily",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    return getWalletHistoryDaily({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      userId: searchParams.get("userId") ?? undefined,
      walletType: searchParams.get("walletType") ?? undefined,
      groupBy: (searchParams.get("groupBy") as "reasonCategory" | "sourceType" | "changeMethod") ?? undefined,
      reasonCategories: searchParams.get("reasonCategories") ?? undefined,
    });
  },
);
