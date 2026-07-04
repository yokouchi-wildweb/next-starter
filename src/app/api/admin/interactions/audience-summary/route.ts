// src/app/api/admin/interactions/audience-summary/route.ts
// オーディエンスサマリー: action 別の 累計 / ログイン済み / 匿名 件数（admin 専用）
//
// 累計はカウンタ由来（永久）、ログイン済み / 匿名は明細由来（保持期限内のみ）。
// prune 後は累計と内訳合計が乖離するのが正常な状態（UI 側で注記する）。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { getAudienceSummary } from "@/features/core/interactionTracking/services/server";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/interactions/audience-summary",
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
    if (!targetType || !targetId) {
      return NextResponse.json(
        { message: "targetType / targetId パラメータは必須です。" },
        { status: 400 },
      );
    }

    return getAudienceSummary(targetType, targetId);
  },
);
