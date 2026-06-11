// src/features/core/bankTransferReview/services/server/wrappers/confirmReview.ts
//
// 管理者が「振込を確認した」と承認するときに呼ばれるサービス。
//
// 動作:
// - status=pending_review / needs_check / investigating 以外は 400（再承認禁止）
//   needs_check (要確認) は CSV 取込で自動承認を保留したケース。pending_review と同じく
//   ここから confirmed へ遷移可能（→ pending_review に戻す経路は設けない）。
//   investigating (検証中) は追加検証中のケース。ここから confirmed へ遷移可能。
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

import type {
  BankTransferReview,
  BankTransferReviewApprovalSource,
} from "@/features/bankTransferReview/entities/model";

import { base } from "../drizzleBase";

export type ConfirmReviewParams = {
  reviewId: string;
  /** 承認操作を実行した管理者の user_id（reviewed_by に記録） */
  reviewedBy: string;
  /**
   * 承認の入力経路。レコードの approval_source に記録され、以後の判別に使う。
   * - "manual": 管理者が画面で承認ボタンを押した
   * - "csv_auto": CSV 一括取込で金額一致と判定され自動承認された
   *
   * 呼び出し側で必ず明示する（既定値を持たせると判別が崩れるため必須）。
   * needs_check 経由で最終的に手動承認された場合も "manual"（押した瞬間の主体で判定）。
   */
  source: BankTransferReviewApprovalSource;
};

export type ConfirmReviewResult = {
  review: BankTransferReview;
  /** approval_required モードで新たに付与された wallet_history.id（immediate モードでは null） */
  walletHistoryId: string | null;
};

export async function confirmReview(
  params: ConfirmReviewParams,
): Promise<ConfirmReviewResult> {
  const { reviewId, reviewedBy, source } = params;

  const review = (await base.get(reviewId)) as BankTransferReview | null;
  if (!review) {
    throw new DomainError("レビューが見つかりません。", { status: 404 });
  }

  if (
    review.status !== "pending_review" &&
    review.status !== "needs_check" &&
    review.status !== "investigating"
  ) {
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
        // 承認の入力経路を確定記録。以後 UI/監査でこの 1 列だけで判別できる。
        approval_source: source,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      tx,
    )) as BankTransferReview;

    // needs_check から承認したケースを後追いできるよう、metadata に元 status と
    // needs_check_reason / context を残す（needs_check 列自体はクリアしない方針なので
    // DB 上にも残るが、監査タイムラインで一発で見えるように冗長記録）。
    // approval_source も冗長記録（レコード本体の値と同じだが、監査タイムラインの
    // 単一行で「自動か手動か」を判別できるようにするため）。
    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      subjectUserId: review.user_id,
      action: "bank_transfer_review.review.confirmed",
      before: { status: review.status, reviewed_by: review.reviewed_by },
      after: { status: next.status, reviewed_by: next.reviewed_by },
      metadata: {
        purchaseRequestId: review.purchase_request_id,
        mode: review.mode,
        walletHistoryId,
        fromStatus: review.status,
        needsCheckReason: review.needs_check_reason,
        needsCheckContext: review.needs_check_context,
        source,
      },
      tx,
    });

    return next;
  });

  return { review: updated, walletHistoryId };
}
