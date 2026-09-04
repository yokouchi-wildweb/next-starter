// src/app/api/admin/coupon-issuer-grants/[id]/usage-history/route.ts
//
// 管理者向け: 発行者のクーポン利用履歴（全クーポン横断、新しい順、ページング必須）。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors/domainError";
import {
  couponIssuerGrantBase,
  getIssuerUsageHistory,
} from "@/features/core/couponIssuerGrant/services/server";
import { BadRequestError, parsePositiveInteger } from "@/app/api/[domain]/search/utils";

type Params = { id: string };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/coupon-issuer-grants/[id]/usage-history",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    try {
      const grant = await couponIssuerGrantBase.get(params.id);
      if (!grant) {
        throw new DomainError("発行権が見つかりません", { status: 404 });
      }
      const q = req.nextUrl.searchParams;
      const page = parsePositiveInteger(q.get("page"), "page") ?? 1;
      const limit = Math.min(parsePositiveInteger(q.get("limit"), "limit") ?? DEFAULT_LIMIT, MAX_LIMIT);
      return getIssuerUsageHistory({ userId: grant.user_id, page, limit });
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
