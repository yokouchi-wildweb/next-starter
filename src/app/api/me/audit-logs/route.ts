// src/app/api/me/audit-logs/route.ts
//
// 認証ユーザー本人に紐づく監査ログを取得する。
// "自分が target として記録された" ログ + "自分が actor として実行した" ログを
// OR で結合してタイムライン順に返す。

import { NextResponse } from "next/server";

import { createMeRoute } from "@/lib/routeFactory";
import { auditLogBase } from "@/features/core/auditLog/services/server";
import type { SearchParams, WhereExpr } from "@/lib/crud";

import {
  BadRequestError,
  parsePositiveInteger,
} from "@/app/api/[domain]/search/utils";

// GET /api/me/audit-logs?page=1&limit=20
export const GET = createMeRoute(
  {
    operation: "GET /api/me/audit-logs",
    operationType: "read",
  },
  async (req, { user }) => {
    try {
      const query = req.nextUrl.searchParams;

      const page = parsePositiveInteger(query.get("page"), "page");
      const limit = parsePositiveInteger(query.get("limit"), "limit");

      // 自分が target になっているもの (targetType=user, targetId=自分のID)
      // または actor になっているもの (actorId=自分のID)
      const where: WhereExpr = {
        or: [
          {
            and: [
              { field: "targetType", op: "eq", value: "user" },
              { field: "targetId", op: "eq", value: user.userId },
            ],
          },
          { field: "actorId", op: "eq", value: user.userId },
        ],
      };

      const searchParams: SearchParams = { where };
      if (typeof page === "number") searchParams.page = page;
      if (typeof limit === "number") searchParams.limit = limit;

      return auditLogBase.search(searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
