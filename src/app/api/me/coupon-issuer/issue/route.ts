// src/app/api/me/coupon-issuer/issue/route.ts
//
// 承認済み発行権に基づくクーポン発行（本人）。当期に発行済みならそれを返す（冪等）。
// program 未設定の環境では 503（fail-closed）。

import { createMeRoute } from "@/lib/routeFactory";
import { issueForGrant } from "@/features/core/couponIssuerGrant/services/server";

export const POST = createMeRoute(
  {
    operation: "POST /api/me/coupon-issuer/issue",
    operationType: "write",
  },
  async (_req, { user }) => {
    const result = await issueForGrant({ userId: user.userId });
    return result;
  },
);
