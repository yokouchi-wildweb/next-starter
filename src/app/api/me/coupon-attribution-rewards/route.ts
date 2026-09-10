// src/app/api/me/coupon-attribution-rewards/route.ts
//
// 認証ユーザー本人が受取人の帰属報酬一覧（ページング必須）。
// recipient_user_id はサーバー側でセッションから固定し、クライアント指定は受け付けない。
// 台帳行は受取人向け DTO（toCouponAttributionRewardForRecipient）に写像して返す:
// 消込者に辿れる ID・運用者向け failure_reason は落とし、metadata は許可リストのキーのみ。

import { NextResponse } from "next/server";

import { createMeRoute, ownerWhere } from "@/lib/routeFactory";
import { couponAttributionRewardBase } from "@/features/core/couponAttributionReward/services/server";
import {
  toCouponAttributionRewardForRecipient,
  type CouponAttributionRewardForRecipient,
} from "@/features/core/couponAttributionReward/entities/model";
import { RECIPIENT_VISIBLE_ATTRIBUTION_REWARD_METADATA_KEYS } from "@/registry/couponAttributionRewardRecipientMetadataRegistry";
import type { PaginatedResult, SearchParams } from "@/lib/crud";
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
      const result = await couponAttributionRewardBase.search(searchParams);
      const response: PaginatedResult<CouponAttributionRewardForRecipient> = {
        results: result.results.map((row) =>
          toCouponAttributionRewardForRecipient(row, {
            metadataKeys: RECIPIENT_VISIBLE_ATTRIBUTION_REWARD_METADATA_KEYS,
          }),
        ),
        total: result.total,
      };
      return response;
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
