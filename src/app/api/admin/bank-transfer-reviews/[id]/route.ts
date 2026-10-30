// src/app/api/admin/bank-transfer-reviews/[id]/route.ts
//
// 管理者向け: 自社銀行振込レビュー詳細取得 API。
// 一覧から個別レコードを開いたときの詳細モーダル用に、関連 purchase_request と
// 申告ユーザー、レビュー実施管理者（reviewed_by）の表示用情報を JOIN して返す。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/bank-transfer-reviews/[id]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { message: "レビュー ID が指定されていません。" },
        { status: 400 },
      );
    }

    const row = await bankTransferReviewService.findDetailForAdmin(id);
    if (!row) {
      return NextResponse.json(
        { message: "レビューが見つかりません。" },
        { status: 404 },
      );
    }

    return row;
  },
);
