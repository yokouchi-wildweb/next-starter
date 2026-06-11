// src/features/core/bankTransferReview/services/server/wrappers/countByStatus.ts
//
// 銀行振込レビューの status 別件数を集計するサービス。
// 管理画面のタブ件数表示に使う。検索キーワード指定時は一覧 API と同じ
// ILIKE 横断検索（承認番号 / ユーザー名 / メール / 電話番号）を適用するため、
// PurchaseRequest / User を JOIN してから集計する。

import { and, count, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import { BANK_TRANSFER_REVIEW_STATUSES } from "@/features/bankTransferReview/entities/schema";
import type { BankTransferReviewStatus } from "@/features/bankTransferReview/entities/model";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";

export type CountByStatusParams = {
  /** 一覧 API と同じ ILIKE 横断検索を適用するキーワード（任意） */
  searchQuery?: string | null;
};

export type CountByStatusResult = {
  counts: Record<BankTransferReviewStatus, number>;
};

export async function countByStatus(
  params: CountByStatusParams = {},
): Promise<CountByStatusResult> {
  const conditions: SQL[] = [];
  const trimmedQuery = params.searchQuery?.trim();
  if (trimmedQuery) {
    // ILIKE のワイルドカード（% _）はバックスラッシュでエスケープしてユーザー入力を
    // パターンとして悪用されないようにする（一覧 API と同一ロジック）。
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

  // status 別の件数を 1 クエリで取得。
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
  ) as Record<BankTransferReviewStatus, number>;
  for (const row of rows) {
    counts[row.status as BankTransferReviewStatus] = row.total;
  }

  return { counts };
}
