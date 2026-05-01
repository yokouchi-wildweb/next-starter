// src/features/core/bankTransferReview/services/server/wrappers/confirmReview.ts
//
// 管理者が「振込を確認した」と承認するときに呼ばれるサービス。
//
// 動作:
// - status=pending_review 以外は 400（再承認禁止）
// - mode=immediate: 通貨は申告時点で付与済み。レビュー status を confirmed に更新するだけ
// - mode=approval_required: completePurchase を実行して通貨付与 + レビュー status を confirmed
//
// 順序の方針:
// approval_required モードでは「completePurchase 実行 → レビュー更新」の順で行う。
// レビュー更新が失敗したケースでも purchase は completed になっており、
// 管理者が再度 confirm を押せば completePurchase は冪等（completed なら早期リターン）で
// 動き、レビュー更新だけ走る。これでリトライによる回復が保証される。

import { DomainError } from "@/lib/errors/domainError";
import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { base as purchaseRequestBase } from "@/features/purchaseRequest/services/server/drizzleBase";
import type { PurchaseRequest } from "@/features/purchaseRequest/entities/model";
import { INHOUSE_PROVIDER_NAME } from "@/features/purchaseRequest/services/server/payment/inhouse";
import { completePurchase } from "@/features/purchaseRequest/services/server/wrappers/completePurchase";

import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";

import { base } from "../drizzleBase";

export type ConfirmReviewParams = {
  reviewId: string;
  /** 承認操作を実行した管理者の user_id（reviewed_by に記録） */
  reviewedBy: string;
};

export type ConfirmReviewResult = {
  review: BankTransferReview;
  /** approval_required モードで新たに付与された wallet_history.id（immediate モードでは null） */
  walletHistoryId: string | null;
};

export async function confirmReview(
  params: ConfirmReviewParams,
): Promise<ConfirmReviewResult> {
  const { reviewId, reviewedBy } = params;

  const review = (await base.get(reviewId)) as BankTransferReview | null;
  if (!review) {
    throw new DomainError("レビューが見つかりません。", { status: 404 });
  }

  if (review.status !== "pending_review") {
    throw new DomainError(
      `このレビューは既に ${review.status} 状態です。`,
      { status: 400 },
    );
  }

  // approval_required モードのみ通貨付与処理を走らせる
  let walletHistoryId: string | null = null;
  if (review.mode === "approval_required") {
    const purchaseRequest = (await purchaseRequestBase.get(
      review.purchase_request_id,
    )) as PurchaseRequest | null;
    if (!purchaseRequest) {
      throw new DomainError(
        "関連する購入リクエストが見つかりません。",
        { status: 404 },
      );
    }
    const completion = await completePurchase({
      sessionId:
        purchaseRequest.payment_session_id ?? purchaseRequest.id,
      paidAt: new Date(),
      providerName: INHOUSE_PROVIDER_NAME,
    });
    walletHistoryId = completion.walletHistoryId;
  }

  // レビュー status 更新 + 監査ログを同一トランザクションで atomic に。
  // completePurchase は内部で別 tx を開くためここでは含めない（既に外側で実行済み）。
  const updated = await db.transaction(async (tx) => {
    const next = (await base.update(
      review.id,
      {
        status: "confirmed" as const,
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      tx,
    )) as BankTransferReview;

    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      action: "bank_transfer_review.review.confirmed",
      before: { status: review.status, reviewed_by: review.reviewed_by },
      after: { status: next.status, reviewed_by: next.reviewed_by },
      metadata: {
        purchaseRequestId: review.purchase_request_id,
        mode: review.mode,
        walletHistoryId,
      },
      tx,
    });

    return next;
  });

  return { review: updated, walletHistoryId };
}
