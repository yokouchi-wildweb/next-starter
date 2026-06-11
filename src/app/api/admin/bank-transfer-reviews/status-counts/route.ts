// src/app/api/admin/bank-transfer-reviews/status-counts/route.ts
//
// 管理者向け: 銀行振込レビューの status 別件数を取得する API。
// 検索クエリを反映した「タブごとの件数」表示に使う（list 本体と独立した SWR キーで
// 取得することで、ページ移動では再取得しないようにする）。
// 集計ロジックは ServerService（bankTransferReviewService.countByStatus）に委譲する。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

const QuerySchema = z.object({
  /** list 本体と同じ ILIKE 検索を適用するキーワード（任意） */
  searchQuery: z.string().optional(),
});

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/bank-transfer-reviews/status-counts",
    operationType: "read",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ message: "クエリが不正です。" }, { status: 400 });
    }
    const { searchQuery } = parsed.data;

    const { counts } = await bankTransferReviewService.countByStatus({
      searchQuery,
    });

    return { counts };
  },
);
