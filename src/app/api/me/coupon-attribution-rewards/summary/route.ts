// src/app/api/me/coupon-attribution-rewards/summary/route.ts
//
// 認証ユーザー本人の帰属報酬集計（fulfilled 合計/件数、pending 合計）。

import { createMeRoute } from "@/lib/routeFactory";
import { getRecipientRewardSummary } from "@/features/core/couponAttributionReward/services/server";

export const GET = createMeRoute(
  {
    operation: "GET /api/me/coupon-attribution-rewards/summary",
    operationType: "read",
  },
  async (_req, { user }) => {
    const summary = await getRecipientRewardSummary(user.userId);
    return { summary };
  },
);
