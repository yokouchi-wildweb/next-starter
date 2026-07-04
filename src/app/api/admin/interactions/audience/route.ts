// src/app/api/admin/interactions/audience/route.ts
// 「target X を誰がクリックしたか」のオーディエンス一覧（admin 専用）
//
// ユーザー PII（名前・メール）を含むため admin 限定。
// データ源はイベント明細（保持期限内のみ）。匿名イベントは一覧に含まれない。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import {
  getAudience,
  AUDIENCE_ORDER_BY,
  type AudienceOrderBy,
} from "@/features/core/interactionTracking/services/server";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/interactions/audience",
    operationType: "read",
    access: "custom",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");
    const action = searchParams.get("action");
    if (!targetType || !targetId || !action) {
      return NextResponse.json(
        { message: "targetType / targetId / action パラメータは必須です。" },
        { status: 400 },
      );
    }

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const orderByParam = searchParams.get("orderBy");
    const orderBy =
      orderByParam && (AUDIENCE_ORDER_BY as readonly string[]).includes(orderByParam)
        ? (orderByParam as AudienceOrderBy)
        : undefined;

    return getAudience(targetType, targetId, {
      action,
      page: pageParam ? Number(pageParam) : undefined,
      limit: limitParam ? Number(limitParam) : undefined,
      orderBy,
    });
  },
);
