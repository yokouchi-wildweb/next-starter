// src/app/api/admin/coupon-issuer-grants/route.ts
//
// 管理者向け: 発行権一覧 + 利用/報酬/割引統計（サーバーページネーション + 集計ソート）。
// GET ?status=pending,approved&searchQuery=&page=1&limit=20&sortField=rewardPaidTotal&sortDirection=desc

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getGrantListWithStats } from "@/features/core/couponIssuerGrant/services/server";
import {
  COUPON_ISSUER_GRANT_STATUSES,
  type CouponIssuerGrantStatus,
} from "@/features/core/couponIssuerGrant/constants";
import { BadRequestError, parsePositiveInteger } from "@/app/api/[domain]/search/utils";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/coupon-issuer-grants",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    try {
      const q = req.nextUrl.searchParams;
      const page = parsePositiveInteger(q.get("page"), "page") ?? 1;
      const limit = Math.min(parsePositiveInteger(q.get("limit"), "limit") ?? DEFAULT_LIMIT, MAX_LIMIT);

      const statusParam = q.get("status");
      const statuses = statusParam
        ? statusParam.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const invalid = statuses.find(
        (s) => !(COUPON_ISSUER_GRANT_STATUSES as readonly string[]).includes(s),
      );
      if (invalid) {
        throw new BadRequestError(`status の値が不正です: ${invalid}`);
      }

      const sortField = q.get("sortField");
      const sortDirection = q.get("sortDirection") === "asc" ? "asc" : "desc";

      return getGrantListWithStats({
        status: statuses.length > 0 ? (statuses as CouponIssuerGrantStatus[]) : undefined,
        searchQuery: q.get("searchQuery") ?? undefined,
        page,
        limit,
        sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
      });
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
