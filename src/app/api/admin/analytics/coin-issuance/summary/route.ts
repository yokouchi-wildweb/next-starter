// src/app/api/admin/analytics/coin-issuance/summary/route.ts
// 統合コイン創出サマリー API。
//
// 管理画面ダッシュボード向けに、期間内のコイン収支を 1 リクエストで返す。
// 個別ソースの集計ロジックは src/features/core/analytics/extensions/coinIssuanceSources.ts に並ぶ
// CoinIssuanceSource に委譲する。

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getCoinIssuanceSummary } from "@/features/core/analytics/services/server/coinIssuance";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/coin-issuance/summary",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    return getCoinIssuanceSummary({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
    });
  },
);
