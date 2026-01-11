// src/features/core/purchaseRequest/services/server/cancelPending.ts

import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { and, eq, inArray } from "drizzle-orm";

/**
 * ユーザーの未処理の購入リクエストをキャンセル（expired）に変更する
 * - pending / processing ステータスのリクエストを expired に変更
 * ソフトデリート時のクリーンナップ処理として使用
 */
export async function cancelPending(userId: string, tx: DbTransaction): Promise<void> {
  await tx
    .update(PurchaseRequestTable)
    .set({
      status: "expired",
      error_message: "ユーザーアカウント削除によるキャンセル",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(PurchaseRequestTable.user_id, userId),
        inArray(PurchaseRequestTable.status, ["pending", "processing"]),
      ),
    );
}
