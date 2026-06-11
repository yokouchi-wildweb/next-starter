// src/app/api/admin/bank-transfer-reviews/[id]/investigate/route.ts
//
// 管理者向け: 自社銀行振込レビューを「検証中」(investigating) に遷移させる API。
// pending_review / needs_check のいずれからも遷移可能。通貨操作は伴わない。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

type Params = { id: string };

const InvestigateBodySchema = z.object({
  /** 検証中に移行する理由メモ（任意、500 文字以内）。 */
  note: z
    .string()
    .trim()
    .max(500, { message: "メモは 500 文字以内で入力してください。" })
    .optional()
    .nullable(),
});

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/bank-transfer-reviews/[id]/investigate",
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

    // ボディは任意（空でも可）
    let note: string | null = null;
    try {
      const raw = await req.text();
      if (raw) {
        const parsed = InvestigateBodySchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          const message = parsed.error.errors[0]?.message ?? "入力値が不正です。";
          return NextResponse.json({ message }, { status: 400 });
        }
        note = parsed.data.note ?? null;
      }
    } catch {
      return NextResponse.json(
        { message: "リクエストボディの解析に失敗しました。" },
        { status: 400 },
      );
    }

    const result = await bankTransferReviewService.escalateToInvestigating({
      reviewId: id,
      triggeredBy: session.userId,
      note,
    });

    return {
      success: true,
      review: result.review,
    };
  },
);
