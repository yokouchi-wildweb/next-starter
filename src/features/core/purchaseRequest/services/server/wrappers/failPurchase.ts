// src/features/core/purchaseRequest/services/server/wrappers/failPurchase.ts
// 購入失敗処理

import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { DomainError } from "@/lib/errors/domainError";
import { getPurchaseCompletionStrategy } from "../completion";
import { findByWebhookIdentifier } from "./purchaseHelpers";
import type { FailPurchaseParams } from "./purchaseService";

// ============================================================================
// 購入失敗
// ============================================================================

/**
 * 購入を失敗としてマーク
 * 楽観的ロック: processing または pending の場合のみ更新（completed は上書きしない）
 *
 * 戦略に onFail が定義されていれば、UPDATE と同一 tx 内で呼び出し、
 * 副次テーブルのクリーンアップを atomic に行う（未定義の場合は従来通り単一UPDATE）。
 */
export async function failPurchase(params: FailPurchaseParams): Promise<PurchaseRequest> {
  const { sessionId, errorCode, errorMessage, providerName } = params;

  const purchaseRequest = await findByWebhookIdentifier(sessionId, providerName);
  if (!purchaseRequest) {
    throw new DomainError("購入リクエストが見つかりません", { status: 404 });
  }

  // 既に完了済みまたは失敗済みなら変更しない（冪等性）
  if (purchaseRequest.status === "completed" || purchaseRequest.status === "failed") {
    return purchaseRequest;
  }

  const resolvedErrorCode = errorCode ?? "PAYMENT_FAILED";
  const resolvedErrorMessage = errorMessage ?? "決済に失敗しました";
  const strategy = getPurchaseCompletionStrategy(purchaseRequest.purchase_type);

  // onFail フックが定義されていれば tx 内で実行（atomic cleanup）。
  // 未定義なら従来通り単一 UPDATE で済ませる（性能・挙動の完全互換）。
  if (strategy?.onFail) {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(PurchaseRequestTable)
        .set({
          status: "failed",
          error_code: resolvedErrorCode,
          error_message: resolvedErrorMessage,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(PurchaseRequestTable.id, purchaseRequest.id),
            or(
              eq(PurchaseRequestTable.status, "processing"),
              eq(PurchaseRequestTable.status, "pending"),
            ),
          ),
        )
        .returning();

      if (!updated) {
        // 並行処理で既に completed or failed に遷移済み → 冪等に返す
        return purchaseRequest;
      }

      const updatedRecord = updated as PurchaseRequest;
      await strategy.onFail!({
        purchaseRequest: updatedRecord,
        errorCode: resolvedErrorCode,
        errorMessage: resolvedErrorMessage,
        tx,
      });
      return updatedRecord;
    });
  }

  // onFail 未定義の従来パス（単一 UPDATE・tx 無し）
  const [updated] = await db
    .update(PurchaseRequestTable)
    .set({
      status: "failed",
      error_code: resolvedErrorCode,
      error_message: resolvedErrorMessage,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(PurchaseRequestTable.id, purchaseRequest.id),
        or(
          eq(PurchaseRequestTable.status, "processing"),
          eq(PurchaseRequestTable.status, "pending")
        )
      )
    )
    .returning();

  if (!updated) {
    // 並行処理で既に completed or failed に遷移済み → 冪等に返す
    return purchaseRequest;
  }

  return updated as PurchaseRequest;
}
