// src/app/api/me/coupon-issuer/apply/route.ts
//
// 発行権の申請（本人）。pending なら冪等、rejected なら再申請、approved/suspended は 409。

import { createMeRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors/domainError";
import { applyGrant } from "@/features/core/couponIssuerGrant/services/server";
import { ApplyCouponIssuerGrantSchema } from "@/features/core/couponIssuerGrant/entities/schema";
import { toCouponIssuerGrantForUser } from "@/features/core/couponIssuerGrant/entities/model";

export const POST = createMeRoute(
  {
    operation: "POST /api/me/coupon-issuer/apply",
    operationType: "write",
  },
  async (req, { user }) => {
    const parsed = ApplyCouponIssuerGrantSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new DomainError("リクエストの形式が不正です", { status: 400 });
    }
    const grant = await applyGrant({ userId: user.userId, application: parsed.data.application });
    return { grant: toCouponIssuerGrantForUser(grant) };
  },
);
