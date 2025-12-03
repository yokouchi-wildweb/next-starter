import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { walletHistoryService } from "@/features/core/walletHistory/services/server/walletHistoryService";

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ message: "認証情報が無効です。" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const paramUserId = searchParams.get("userId");
  const limit = Number(searchParams.get("limit") ?? "20");
  const page = Number(searchParams.get("page") ?? "1");

  const targetUserId = paramUserId ?? sessionUser.userId;
  if (paramUserId && paramUserId !== sessionUser.userId && sessionUser.role !== "admin") {
    return NextResponse.json({ message: "この履歴を参照する権限がありません。" }, { status: 403 });
  }

  try {
    const result = await walletHistoryService.listBatchSummaries({
      userId: targetUserId,
      limit,
      page,
    });
    return NextResponse.json({
      results: result.items,
      total: result.total,
    });
  } catch (error) {
    console.error("GET /api/wallet/history/batches failed", error);
    return NextResponse.json({ message: "履歴の取得に失敗しました。" }, { status: 500 });
  }
}
