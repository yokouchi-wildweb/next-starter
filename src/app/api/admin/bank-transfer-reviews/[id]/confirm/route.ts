// src/app/api/admin/bank-transfer-reviews/[id]/confirm/route.ts
//
// 管理者向け: 自社銀行振込レビュー承認 API。
// confirmReview に委譲し、mode に応じて completePurchase の呼び出しを内部で分岐する。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/bank-transfer-reviews/[id]/confirm",
    operationType: "write",
    skipForDemo: false,
  },
  async (_req, { params, session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { message: "レビュー ID が指定されていません。" },
        { status: 400 },
      );
    }

    const result = await bankTransferReviewService.confirmReview({
      reviewId: id,
      reviewedBy: session.userId,
    });

    return {
      success: true,
      review: result.review,
      walletHistoryId: result.walletHistoryId,
    };
  },
);
