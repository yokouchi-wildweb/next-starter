// src/app/api/admin/analytics/wallet/state/ranking/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import {
  getWalletStateRanking,
  parseWalletStateRankingSortBy,
} from "@/features/core/analytics/services/server/walletStateAnalytics";
import { isWalletType } from "@/features/core/wallet/utils/currency";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/wallet/state/ranking",
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
    const walletType = searchParams.get("walletType");
    if (!isWalletType(walletType)) {
      return NextResponse.json(
        { message: "walletType パラメータは必須です。" },
        { status: 400 },
      );
    }

    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    return getWalletStateRanking({
      walletType,
      ...parseUserFilterParams(searchParams),
      sortBy: parseWalletStateRankingSortBy(searchParams.get("sortBy")),
      limit: limitParam ? Number(limitParam) : undefined,
      page: pageParam ? Number(pageParam) : undefined,
    });
  },
);
