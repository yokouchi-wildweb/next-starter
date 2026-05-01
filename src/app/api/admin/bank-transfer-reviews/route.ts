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

import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { db } from "@/lib/drizzle";
import { getRoleCategory } from "@/features/core/user/constants";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import {
  BANK_TRANSFER_REVIEW_MODES,
  BANK_TRANSFER_REVIEW_STATUSES,
} from "@/features/bankTransferReview/entities/schema";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";

const QuerySchema = z.object({
  status: z.enum(BANK_TRANSFER_REVIEW_STATUSES).optional(),
  mode: z.enum(BANK_TRANSFER_REVIEW_MODES).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/bank-transfer-reviews",
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
      const message = parsed.error.errors[0]?.message ?? "クエリが不正です。";
      return NextResponse.json({ message }, { status: 400 });
    }
    const { status, mode, userId, dateFrom, dateTo, page, limit } = parsed.data;

    const conditions: SQL[] = [];
    if (status) conditions.push(eq(BankTransferReviewTable.status, status));
    if (mode) conditions.push(eq(BankTransferReviewTable.mode, mode));
    if (userId) conditions.push(eq(BankTransferReviewTable.user_id, userId));
    if (dateFrom) {
      conditions.push(gte(BankTransferReviewTable.submitted_at, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(BankTransferReviewTable.submitted_at, new Date(dateTo)));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // 一覧取得 + 関連 purchase_request + 申告ユーザー（表示用フィールド）を JOIN
    // 同一トランザクションでなくてよいため count は別クエリ。
    const items = await db
      .select({
        review: BankTransferReviewTable,
        purchaseRequest: {
          id: PurchaseRequestTable.id,
          payment_amount: PurchaseRequestTable.payment_amount,
          amount: PurchaseRequestTable.amount,
          wallet_type: PurchaseRequestTable.wallet_type,
          status: PurchaseRequestTable.status,
          provider_order_id: PurchaseRequestTable.provider_order_id,
          completed_at: PurchaseRequestTable.completed_at,
        },
        user: {
          id: UserTable.id,
          name: UserTable.name,
          email: UserTable.email,
        },
      })
      .from(BankTransferReviewTable)
      .leftJoin(
        PurchaseRequestTable,
        eq(BankTransferReviewTable.purchase_request_id, PurchaseRequestTable.id),
      )
      .leftJoin(
        UserTable,
        eq(BankTransferReviewTable.user_id, UserTable.id),
      )
      .where(where)
      .orderBy(desc(BankTransferReviewTable.submitted_at))
      .limit(limit)
      .offset((page - 1) * limit);

    const totalRows = await db
      .select({ total: count() })
      .from(BankTransferReviewTable)
      .where(where);
    const total = totalRows[0]?.total ?? 0;

    return {
      items,
      total,
      page,
      limit,
    };
  },
);
