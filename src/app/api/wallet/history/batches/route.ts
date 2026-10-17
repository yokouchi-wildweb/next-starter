// src/app/api/wallet/history/batches/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { isWalletType } from "@/features/core/wallet/utils/currency";
import { walletHistoryService } from "@/features/core/walletHistory/services/server/walletHistoryService";

export const GET = createApiRoute(
  {
    operation: "GET /api/wallet/history/batches",
    operationType: "read",
    access: "custom",
  },
  async (req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "認証情報が無効です。" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paramUserId = searchParams.get("userId");
    const limit = Number(searchParams.get("limit") ?? "20");
    const page = Number(searchParams.get("page") ?? "1");
    const paramType = searchParams.get("type");

    const targetUserId = paramUserId ?? session.userId;
    if (paramUserId && paramUserId !== session.userId && getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この履歴を参照する権限がありません。" }, { status: 403 });
    }

    // type は省略可。指定時は有効な walletType のみ受け付ける(不正値は 400)
    if (paramType !== null && !isWalletType(paramType)) {
      return NextResponse.json({ message: "通貨種別が無効です。" }, { status: 400 });
    }

    const result = await walletHistoryService.listBatchSummaries({
      userId: targetUserId,
      walletType: paramType ?? undefined,
      limit,
      page,
    });

    return {
      results: result.items,
      total: result.total,
    };
  },
);
