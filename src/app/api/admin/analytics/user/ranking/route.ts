// src/app/api/admin/analytics/user/ranking/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getUserRanking, type RankingMetric } from "@/features/core/analytics/services/server/userRankingAnalytics";

const VALID_METRICS: RankingMetric[] = ["totalPurchase", "totalConsumption", "purchaseCount", "netChange"];

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/user/ranking",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const metricParam = searchParams.get("metric");
    const metric = metricParam && VALID_METRICS.includes(metricParam as RankingMetric)
      ? (metricParam as RankingMetric)
      : undefined;

    return getUserRanking({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      walletType: searchParams.get("walletType") ?? undefined,
      metric,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    });
  },
);
