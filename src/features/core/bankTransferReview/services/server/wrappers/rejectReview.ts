// src/features/core/bankTransferReview/services/server/wrappers/rejectReview.ts
//
// 管理者が「振込を確認できない（拒否）」と判断するときに呼ばれるサービス。
//
// 動作:
// - status=pending_review 以外は 400
// - 拒否理由は必須（運用上ユーザーへの説明や監査追跡のため）
// - mode=immediate: 通貨付与は申告時点で完了済み。**通貨ロールバックは行わない**
//   （事業判断: 拒否は「拒否したという意思表示」の記録に留め、通貨操作・ユーザー連絡は
//   運用で別途対応する方針）。レビュー status を rejected に更新するだけ
// - mode=approval_required: failPurchase を実行して purchase_request を failed に
//   遷移させ、レビュー status を rejected に更新

import { DomainError } from "@/lib/errors/domainError";
import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { base as purchaseRequestBase } from "@/features/purchaseRequest/services/server/drizzleBase";
import type { PurchaseRequest } from "@/features/purchaseRequest/entities/model";
import { INHOUSE_PROVIDER_NAME } from "@/features/purchaseRequest/services/server/payment/inhouse";
import { failPurchase } from "@/features/purchaseRequest/services/server/wrappers/failPurchase";

import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";

import { base } from "../drizzleBase";

export type RejectReviewParams = {
  reviewId: string;
  reviewedBy: string;
  /** 拒否理由（必須）。空白のみは禁止 */
  rejectReason: string;
};

export type RejectReviewResult = {
  review: BankTransferReview;
};

export async function rejectReview(
  params: RejectReviewParams,
): Promise<RejectReviewResult> {
  const { reviewId, reviewedBy } = params;
  const rejectReason = params.rejectReason.trim();

  if (!rejectReason) {
    throw new DomainError("拒否理由を入力してください。", { status: 400 });
  }

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

  // approval_required モードのみ purchase_request の状態を変更する
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
    await failPurchase({
      sessionId:
        purchaseRequest.payment_session_id ?? purchaseRequest.id,
      errorCode: "BANK_TRANSFER_REJECTED",
      errorMessage: rejectReason,
      providerName: INHOUSE_PROVIDER_NAME,
    });
  }

  // レビュー status 更新 + 監査ログを同一トランザクションで atomic に。
  // failPurchase は内部で別 tx を開くためここでは含めない（既に外側で実行済み）。
  const updated = await db.transaction(async (tx) => {
    const next = (await base.update(
      review.id,
      {
        status: "rejected" as const,
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        reject_reason: rejectReason,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      tx,
    )) as BankTransferReview;

    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      action: "bank_transfer_review.review.rejected",
      before: { status: review.status, reviewed_by: review.reviewed_by },
      after: {
        status: next.status,
        reviewed_by: next.reviewed_by,
        reject_reason: next.reject_reason,
      },
      metadata: {
        purchaseRequestId: review.purchase_request_id,
        mode: review.mode,
      },
      reason: rejectReason,
      tx,
    });

    return next;
  });

  return { review: updated };
}
