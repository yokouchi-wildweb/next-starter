// src/app/api/admin/bank-transfer-reviews/route.ts
//
// 管理者向け: 自社銀行振込レビュー一覧取得 API。
//
// クエリ:
//   - status:  pending_review | confirmed | rejected
//   - mode:    immediate | approval_required
//   - userId:  特定ユーザーで絞り込み
//   - dateFrom / dateTo: submitted_at の範囲（ISO 文字列）
//   - page (1-based), limit (default 20, max 100)
//
// レスポンス: 一覧 + 関連 purchase_request + 申告ユーザー（表示用フィールド）+ 件数。
// 取得は bankTransferReviewService.searchForAdmin(この route はクエリの検証だけ)。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";
import {
  BANK_TRANSFER_REVIEW_MODES,
  BANK_TRANSFER_REVIEW_STATUSES,
} from "@/features/bankTransferReview/entities/schema";

const QuerySchema = z.object({
  status: z.enum(BANK_TRANSFER_REVIEW_STATUSES).optional(),
  mode: z.enum(BANK_TRANSFER_REVIEW_MODES).optional(),
  userId: z.string().uuid().optional(),
  /**
   * 承認番号 (provider_order_id) / ユーザー名 / メール / 電話番号 を横断 ILIKE 検索。
   * 空文字は未指定扱い。
   */
  searchQuery: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/bank-transfer-reviews",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "クエリが不正です。";
      return NextResponse.json({ message }, { status: 400 });
    }
    return bankTransferReviewService.searchForAdmin(parsed.data);
  },
);
