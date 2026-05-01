// src/features/core/bankTransferReview/services/server/wrappers/findHelpers.ts
//
// 共通検索ヘルパー。ユーザー側 / 管理者側の双方から利用される。

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";

/**
 * purchase_request_id でレビューを取得する。
 * 1 purchase_request : 1 review の UNIQUE 関係なので最大 1 件。
 */
export async function findByPurchaseRequest(
  purchaseRequestId: string,
): Promise<BankTransferReview | null> {
  const rows = await db
    .select()
    .from(BankTransferReviewTable)
    .where(eq(BankTransferReviewTable.purchase_request_id, purchaseRequestId))
    .limit(1);
  return (rows[0] as BankTransferReview | undefined) ?? null;
}

/**
 * 指定ユーザーの現在進行中（pending_review）のレビューを 1 件取得する。
 * ユーザー側の「進行中振込バナー」用。inhouseProvider.validateInitiation で
 * 同一ユーザーの pending/processing 振込は 1 件に制限しているため、結果は最大 1 件。
 *
 * 安全側に倒して desc(submitted_at) で最新を 1 件取る。
 */
export async function findActiveByUser(
  userId: string,
): Promise<BankTransferReview | null> {
  const rows = await db
    .select()
    .from(BankTransferReviewTable)
    .where(
      and(
        eq(BankTransferReviewTable.user_id, userId),
        eq(BankTransferReviewTable.status, "pending_review"),
      ),
    )
    .orderBy(desc(BankTransferReviewTable.submitted_at))
    .limit(1);
  return (rows[0] as BankTransferReview | undefined) ?? null;
}
