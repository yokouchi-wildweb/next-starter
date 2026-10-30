// src/features/core/bankTransferReview/services/server/wrappers/findDetailForAdmin.ts
//
// 管理者向けのレビュー詳細(GET /api/admin/bank-transfer-reviews/[id] の取得部分)。
// 関連 purchase_request と申告ユーザー、レビュー実施管理者(reviewed_by)の表示用情報を JOIN して返す。無ければ null。

import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/drizzle";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";

export async function findDetailForAdmin(id: string) {
  // reviewed_by 用の UserTable は申告ユーザー (user_id) と区別するためエイリアスで JOIN
  const reviewerTable = alias(UserTable, "reviewer");

  const rows = await db
    .select({
      review: BankTransferReviewTable,
      purchaseRequest: PurchaseRequestTable,
      user: {
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
      },
      reviewer: {
        id: reviewerTable.id,
        name: reviewerTable.name,
        email: reviewerTable.email,
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
    .leftJoin(
      reviewerTable,
      eq(BankTransferReviewTable.reviewed_by, reviewerTable.id),
    )
    .where(eq(BankTransferReviewTable.id, id))
    .limit(1);

  return rows[0] ?? null;
}
