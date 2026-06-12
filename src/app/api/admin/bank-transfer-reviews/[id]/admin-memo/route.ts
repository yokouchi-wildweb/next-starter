// src/app/api/admin/bank-transfer-reviews/[id]/admin-memo/route.ts
//
// 管理者向け: 自社銀行振込レビューの管理者メモを更新する PATCH API。
// 発送リクエストと同様に手書きメモを残す運用。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

type Params = { id: string };

const BodySchema = z.object({
  adminMemo: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
});

export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/admin/bank-transfer-reviews/[id]/admin-memo",
    operationType: "write",
    access: "custom",
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

    let body: z.infer<typeof BodySchema>;
    try {
      const json = await req.json();
      const parsed = BodySchema.safeParse(json);
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

    const result = await bankTransferReviewService.updateAdminMemo({
      reviewId: id,
      adminMemo: body.adminMemo,
      updatedBy: session.userId,
    });

    return {
      success: true,
      review: result.review,
    };
  },
);
