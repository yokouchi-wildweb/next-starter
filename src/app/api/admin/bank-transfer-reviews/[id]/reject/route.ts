// src/app/api/admin/bank-transfer-reviews/[id]/reject/route.ts
//
// 管理者向け: 自社銀行振込レビュー拒否 API。
// rejectReview に委譲し、mode=approval_required の場合は failPurchase を内部で呼ぶ。
// immediate モードでは通貨ロールバックは行わない（事業判断: 運用で別途対応）。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

type Params = { id: string };

const RejectBodySchema = z.object({
  rejectReason: z
    .string()
    .trim()
    .min(1, { message: "拒否理由を入力してください。" })
    .max(500, { message: "拒否理由は 500 文字以内で入力してください。" }),
});

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/bank-transfer-reviews/[id]/reject",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { params, session }) => {
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

    let body: z.infer<typeof RejectBodySchema>;
    try {
      const json = await req.json();
      const parsed = RejectBodySchema.safeParse(json);
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message }, { status: 400 });
      }
      body = parsed.data;
    } catch {
      return NextResponse.json(
        { message: "リクエストボディの解析に失敗しました。" },
        { status: 400 },
      );
    }

    const result = await bankTransferReviewService.rejectReview({
      reviewId: id,
      reviewedBy: session.userId,
      rejectReason: body.rejectReason,
    });

    return {
      success: true,
      review: result.review,
    };
  },
);
