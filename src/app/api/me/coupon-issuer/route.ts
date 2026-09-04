// src/app/api/me/coupon-issuer/route.ts
//
// 本人の発行権と当期クーポンの状態をまとめて返す（マイページの初期表示用）。
// programEnabled=false の環境でも grant（申請状況）は返す。

import { createMeRoute } from "@/lib/routeFactory";
import {
  getCurrentPeriodCoupon,
  getGrantByUser,
  isCouponIssuerProgramEnabled,
} from "@/features/core/couponIssuerGrant/services/server";
import { toCouponIssuerGrantForUser } from "@/features/core/couponIssuerGrant/entities/model";

export const GET = createMeRoute(
  {
    operation: "GET /api/me/coupon-issuer",
    operationType: "read",
  },
  async (_req, { user }) => {
    const grant = await getGrantByUser(user.userId);
    const { coupon, period } =
      grant?.status === "approved"
        ? await getCurrentPeriodCoupon(user.userId)
        : { coupon: null, period: null };

    return {
      programEnabled: isCouponIssuerProgramEnabled(),
      grant: grant ? toCouponIssuerGrantForUser(grant) : null,
      currentCoupon: coupon,
      period,
    };
  },
);
