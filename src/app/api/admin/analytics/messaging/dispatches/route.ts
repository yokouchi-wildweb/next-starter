// src/app/api/admin/analytics/messaging/dispatches/route.ts
// 連絡の集計の送信ごと(?cursor&limit 1-100 既定 20。送信の管理 messagingDispatches が閉なら空。管理者だけ)
// ?dispatchIds=<id,…>(1〜100): その送信だけ(期間で絞らない。期間の値は読まない・cursor と一緒は 400・nextCursor null。
// 予約・取り消し・テストの送信は入らない)。送信の一覧の既読数の列が使う

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/domains/core/analytics/services/server/utils/dateRange";
import {
  getMessagingDispatches,
  parseDispatchIdsParam,
  parseMessagingFilterParams,
} from "@/domains/core/analytics/services/server/messagingAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/messaging/dispatches",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = searchParams.get("limit");
    const dispatchIds = parseDispatchIdsParam(searchParams);
    return getMessagingDispatches({
      ...parseDateRangeParams(searchParams),
      ...parseMessagingFilterParams(searchParams),
      ...(cursor && { cursor }),
      ...(limit && Number.isFinite(Number(limit)) && { limit: Number(limit) }),
      ...(dispatchIds && { dispatchIds }),
    });
  },
);
