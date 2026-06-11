// src/app/api/admin/bank-transfer-reviews/status-counts/route.ts
//
// 管理者向け: 銀行振込レビューの status 別件数を取得する API。
// 検索クエリを反映した「タブごとの件数」表示に使う（list 本体と独立した SWR キーで
// 取得することで、ページ移動では再取得しないようにする）。

import { and, count, eq, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { db } from "@/lib/drizzle";
import { getRoleCategory } from "@/features/core/user/constants";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import { BANK_TRANSFER_REVIEW_STATUSES } from "@/features/bankTransferReview/entities/schema";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";

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

    const conditions: SQL[] = [];
    const trimmedQuery = searchQuery?.trim();
    if (trimmedQuery) {
      // list API と同じ ILIKE 横断検索ロジック
      const escaped = trimmedQuery.replace(/[\\%_]/g, (c) => `\\${c}`);
      const pattern = `%${escaped}%`;
      conditions.push(
        sql`(
          ${PurchaseRequestTable.provider_order_id} ILIKE ${pattern} OR
          ${UserTable.name} ILIKE ${pattern} OR
          ${UserTable.email} ILIKE ${pattern} OR
          ${UserTable.phoneNumber} ILIKE ${pattern}
        )`,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // status 別の件数を 1 クエリで取得。検索キーワードを使う場合は
    // PurchaseRequest / User を JOIN（list API と同じ条件）。
    const rows = await db
      .select({
        status: BankTransferReviewTable.status,
        total: count(),
      })
      .from(BankTransferReviewTable)
      .leftJoin(
        PurchaseRequestTable,
        eq(BankTransferReviewTable.purchase_request_id, PurchaseRequestTable.id),
      )
      .leftJoin(UserTable, eq(BankTransferReviewTable.user_id, UserTable.id))
      .where(where)
      .groupBy(BankTransferReviewTable.status);

    // 未集計（0件）の status も 0 で埋めて返す
    const counts = Object.fromEntries(
      BANK_TRANSFER_REVIEW_STATUSES.map((s) => [s, 0]),
    ) as Record<(typeof BANK_TRANSFER_REVIEW_STATUSES)[number], number>;
    for (const row of rows) {
      counts[row.status as (typeof BANK_TRANSFER_REVIEW_STATUSES)[number]] = row.total;
    }

    return { counts };
  },
);
