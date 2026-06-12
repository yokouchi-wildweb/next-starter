// src/app/api/admin/analytics/coin-issuance/summary/route.ts
// 統合コイン創出サマリー API。
//
// 管理画面ダッシュボード向けに、期間内のコイン収支を 1 リクエストで返す。
// 個別ソースの集計ロジックは src/registry/coinIssuanceRegistry.ts に登録された
// CoinIssuanceSource に委譲する。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getCoinIssuanceSummary } from "@/features/core/analytics/services/server/coinIssuance";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/coin-issuance/summary",
    operationType: "read",
    access: "custom",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);

    return getCoinIssuanceSummary({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
    });
  },
);
