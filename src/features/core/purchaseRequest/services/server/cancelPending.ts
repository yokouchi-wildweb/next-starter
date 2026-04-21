// src/features/core/purchaseRequest/services/server/cancelPending.ts

import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { getPurchaseCompletionStrategy, getRegisteredPurchaseTypes } from "./completion";

/**
 * ユーザーの未処理の購入リクエストをキャンセル（expired）に変更する
 * - pending / processing ステータスのリクエストを expired に変更
 * ソフトデリート時のクリーンナップ処理として使用
 *
 * onExpire を定義した purchase_type については per-row でフックを呼び出し、
 * 副次テーブルの atomic クリーンアップを行う（未定義の type は従来通り bulk UPDATE）。
 */
export async function cancelPending(userId: string, tx: DbTransaction): Promise<void> {
  const typesWithOnExpire = getRegisteredPurchaseTypes().filter(
    (type) => getPurchaseCompletionStrategy(type)?.onExpire != null,
  );

  const now = new Date();
  const errorMessage = "ユーザーアカウント削除によるキャンセル";

  // 1. onExpire を持たない type は bulk UPDATE（高速パス）
  const bulkCondition = typesWithOnExpire.length > 0
    ? and(
        eq(PurchaseRequestTable.user_id, userId),
        inArray(PurchaseRequestTable.status, ["pending", "processing"]),
        notInArray(PurchaseRequestTable.purchase_type, typesWithOnExpire),
      )
    : and(
        eq(PurchaseRequestTable.user_id, userId),
        inArray(PurchaseRequestTable.status, ["pending", "processing"]),
      );

  await tx
    .update(PurchaseRequestTable)
    .set({
      status: "expired",
      error_message: errorMessage,
      updatedAt: now,
    })
    .where(bulkCondition);

  // 2. onExpire を持つ type は per-row で expire + フック呼び出し（同一 tx 内）
  if (typesWithOnExpire.length > 0) {
    const targetRows = await tx
      .select()
      .from(PurchaseRequestTable)
      .where(
        and(
          eq(PurchaseRequestTable.user_id, userId),
          inArray(PurchaseRequestTable.status, ["pending", "processing"]),
          inArray(PurchaseRequestTable.purchase_type, typesWithOnExpire),
        ),
      );

    for (const row of targetRows) {
      const strategy = getPurchaseCompletionStrategy(row.purchase_type);
      if (!strategy?.onExpire) continue;

      const [updated] = await tx
        .update(PurchaseRequestTable)
        .set({
          status: "expired",
          error_message: errorMessage,
          updatedAt: now,
        })
        .where(
          and(
            eq(PurchaseRequestTable.id, row.id),
            inArray(PurchaseRequestTable.status, ["pending", "processing"]),
          ),
        )
        .returning();

      if (!updated) continue;

      await strategy.onExpire({
        purchaseRequest: updated as PurchaseRequest,
        tx,
      });
    }
  }
}
