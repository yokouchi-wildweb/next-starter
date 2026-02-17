// src/app/api/wallet/history/batches/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { walletHistoryService } from "@/features/core/walletHistory/services/server/walletHistoryService";

export const GET = createApiRoute(
  {
    operation: "GET /api/wallet/history/batches",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "認証情報が無効です。" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paramUserId = searchParams.get("userId");
    const limit = Number(searchParams.get("limit") ?? "20");
    const page = Number(searchParams.get("page") ?? "1");

    const targetUserId = paramUserId ?? session.userId;
    if (paramUserId && paramUserId !== session.userId && getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この履歴を参照する権限がありません。" }, { status: 403 });
    }

    const result = await walletHistoryService.listBatchSummaries({
      userId: targetUserId,
      limit,
      page,
    });

    return {
      results: result.items,
      total: result.total,
    };
  },
);
