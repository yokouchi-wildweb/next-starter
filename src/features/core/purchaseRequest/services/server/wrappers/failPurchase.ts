// src/features/core/purchaseRequest/services/server/wrappers/failPurchase.ts
// 購入失敗処理

import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { DomainError } from "@/lib/errors/domainError";
import { findByWebhookIdentifier } from "./purchaseHelpers";
import type { FailPurchaseParams } from "./purchaseService";

// ============================================================================
// 購入失敗
// ============================================================================

/**
 * 購入を失敗としてマーク
 * 楽観的ロック: processing または pending の場合のみ更新（completed は上書きしない）
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

  // 楽観的ロック: processing または pending の場合のみ failed に遷移
  const [updated] = await db
    .update(PurchaseRequestTable)
    .set({
      status: "failed",
      error_code: errorCode ?? "PAYMENT_FAILED",
      error_message: errorMessage ?? "決済に失敗しました",
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
