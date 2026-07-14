// src/app/api/me/audit-logs/route.ts
//
// 認証ユーザー本人に紐づく監査ログを取得する。
// "自分が target として記録された" ログ + "自分が actor として実行した" ログを
// OR で結合してタイムライン順に返す。
//
// fail-closed: USER_VISIBLE_AUDIT_ACTIONS（src/registry/userVisibleAuditActionsRegistry.ts）
// に登録された action のみ返す。監査ログには本人に開示してはならない covert な
// 管理操作が記録され得るため、未登録 action は本人が target / actor でも返さない。
// レジストリが空（上流既定）の場合は DB を照会せず常に空結果。

import { NextResponse } from "next/server";

import { createMeRoute } from "@/lib/routeFactory";
import {
  auditLogBase,
  buildUserVisibleActionsWhere,
} from "@/features/core/auditLog/services/server";
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

      // 開示許可 action が 1 件もなければ空結果（fail-closed）
      const visibleActionsWhere = buildUserVisibleActionsWhere();
      if (!visibleActionsWhere) {
        return { results: [], total: 0 };
      }

      // 自分が target になっているもの (targetType=user, targetId=自分のID)
      // または actor になっているもの (actorId=自分のID)
      // かつ、本人開示が許可された action のみ
      const where: WhereExpr = {
        and: [
          {
            or: [
              {
                and: [
                  { field: "targetType", op: "eq", value: "user" },
                  { field: "targetId", op: "eq", value: user.userId },
                ],
              },
              { field: "actorId", op: "eq", value: user.userId },
            ],
          },
          visibleActionsWhere,
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
