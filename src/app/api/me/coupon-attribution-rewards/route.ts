// src/app/api/me/coupon-attribution-rewards/route.ts
//
// 認証ユーザー本人が受取人の帰属報酬一覧（ページング必須）。
// recipient_user_id はサーバー側でセッションから固定し、クライアント指定は受け付けない。

import { NextResponse } from "next/server";

import { createMeRoute, ownerWhere } from "@/lib/routeFactory";
import { couponAttributionRewardBase } from "@/features/core/couponAttributionReward/services/server";
import type { SearchParams } from "@/lib/crud";
import { BadRequestError, parsePositiveInteger } from "@/app/api/[domain]/search/utils";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /api/me/coupon-attribution-rewards?page=1&limit=20
export const GET = createMeRoute(
  {
    operation: "GET /api/me/coupon-attribution-rewards",
    operationType: "read",
  },
  async (req, { user }) => {
    try {
      const query = req.nextUrl.searchParams;
      const page = parsePositiveInteger(query.get("page"), "page") ?? 1;
      const limit = Math.min(parsePositiveInteger(query.get("limit"), "limit") ?? DEFAULT_LIMIT, MAX_LIMIT);

      const searchParams: SearchParams = {
        where: ownerWhere(user, "recipient_user_id"),
        page,
        limit,
      };
      return couponAttributionRewardBase.search(searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
