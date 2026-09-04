// src/app/api/me/coupon-issuer/coupons/route.ts
//
// 本人が発行したアフィリエイトクーポンの一覧（過去周期を含む、inactive 含む）。
// 周期ポリシーにより 1 周期 1 枚なので件数は小さいが、limit（既定 24 / 上限 100）で抑える。

import { NextResponse } from "next/server";

import { createMeRoute } from "@/lib/routeFactory";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import { BadRequestError, parsePositiveInteger } from "@/app/api/[domain]/search/utils";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export const GET = createMeRoute(
  {
    operation: "GET /api/me/coupon-issuer/coupons",
    operationType: "read",
  },
  async (req, { user }) => {
    try {
      const limit = Math.min(
        parsePositiveInteger(req.nextUrl.searchParams.get("limit"), "limit") ?? DEFAULT_LIMIT,
        MAX_LIMIT,
      );
      const coupons = await couponService.getCodesByOwner({
        attributionUserId: user.userId,
        type: "affiliate",
        includeInactive: true,
        limit,
        order: "desc",
      });
      return { coupons };
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
