// src/app/api/admin/analytics/wallet/ranking/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getWalletRanking, type WalletRankingSortBy } from "@/features/core/analytics/services/server/walletRankingAnalytics";

const VALID_SORT_BY: WalletRankingSortBy[] = [
  "totalPurchase",
  "totalConsumption",
  "purchaseCount",
  "netChange",
];

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/wallet/ranking",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const sortByParam = searchParams.get("sortBy");
    const sortBy =
      sortByParam &&
      VALID_SORT_BY.includes(sortByParam as WalletRankingSortBy)
        ? (sortByParam as WalletRankingSortBy)
        : undefined;

    return getWalletRanking({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      walletType: searchParams.get("walletType") ?? undefined,
      sortBy,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      page: searchParams.get("page")
        ? Number(searchParams.get("page"))
        : undefined,
    });
  },
);
