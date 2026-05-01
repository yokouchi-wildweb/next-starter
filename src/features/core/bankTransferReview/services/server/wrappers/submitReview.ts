// src/features/core/bankTransferReview/services/server/wrappers/submitReview.ts
//
// ユーザーが「振込完了しました」と申告したときに呼ばれるサービス。
//
// 動作:
// - 既存レビューが無ければ pending_review で新規作成
// - 既存レビューが pending_review なら画像 URL を差し替えて再申告として扱う
// - 既存レビューが confirmed / rejected なら 400 (既に判定済み)
// - mode は paymentConfig.bankTransfer.autoComplete から決定し、
//   レコード作成時に固定する（後で設定が変わっても既存レビューの semantics は不変）
// - mode=immediate ならその場で completePurchase を呼んで通貨を即時付与する
// - mode=approval_required は通貨付与を保留（管理者の confirmReview を待つ）

import { paymentConfig } from "@/config/app/payment.config";
import { DomainError } from "@/lib/errors/domainError";
import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { base as purchaseRequestBase } from "@/features/purchaseRequest/services/server/drizzleBase";
import type { PurchaseRequest } from "@/features/purchaseRequest/entities/model";
import {
  INHOUSE_BANK_TRANSFER_METHOD_ID,
  INHOUSE_PROVIDER_NAME,
} from "@/features/purchaseRequest/services/server/payment/inhouse";
import { completePurchase } from "@/features/purchaseRequest/services/server/wrappers/completePurchase";

import type {
  BankTransferReview,
  BankTransferReviewMode,
} from "@/features/bankTransferReview/entities/model";
import { validateProofImageUrl } from "@/features/bankTransferReview/utils/validateProofImageUrl";

import { base } from "../drizzleBase";
import { findByPurchaseRequest } from "./findHelpers";

export type SubmitReviewParams = {
  purchaseRequestId: string;
  userId: string;
  proofImageUrl: string;
};

export type SubmitReviewResult = {
  review: BankTransferReview;
  mode: BankTransferReviewMode;
  /** mode=immediate で completePurchase を実行した場合の wallet_history.id */
  walletHistoryId: string | null;
  /** 申告時に既に purchase_request が completed だった場合 (即時モードの再申告ケース) */
  alreadyCompleted: boolean;
};

export async function submitReview(
  params: SubmitReviewParams,
): Promise<SubmitReviewResult> {
  const { purchaseRequestId, userId, proofImageUrl } = params;

  // 1. 関連 purchase_request の取得 + 認可
  //    認可失敗と不在は同一視して 404（存在隠蔽）。
  const purchaseRequest = (await purchaseRequestBase.get(
    purchaseRequestId,
  )) as PurchaseRequest | null;
  if (!purchaseRequest || purchaseRequest.user_id !== userId) {
    throw new DomainError("購入リクエストが見つかりません。", { status: 404 });
  }

  // 2. 自社銀行振込専用なのでメソッド / プロバイダの整合チェック
  if (
    purchaseRequest.payment_provider !== INHOUSE_PROVIDER_NAME ||
    purchaseRequest.payment_method !== INHOUSE_BANK_TRANSFER_METHOD_ID
  ) {
    throw new DomainError(
      "このリクエストは自社銀行振込ではありません。",
      { status: 400 },
    );
  }

  // 2.5. 振込明細画像 URL の検証
  //      Firebase Storage の正規 URL かつパスが本リクエスト専用の固定パスと完全一致するか
  //      確認する。任意の外部 URL の保存と他ユーザー画像の URL 流用を同時に防ぐ。
  //      認可・メソッド整合チェック後に実施することで、URL 検証による情報漏洩を回避。
  validateProofImageUrl(proofImageUrl, purchaseRequestId);

  // 3. status 検証
  //    - processing: 通常の申告対象（immediate / approval_required どちらも）
  //    - completed: 即時モードで通貨付与済み。レビューが pending_review で残っているなら
  //      再申告で画像差し替えを許可する（誤った画像を上げてしまったケースの救済）
  //    それ以外（pending / failed / expired）は 400。
  if (
    purchaseRequest.status !== "processing" &&
    purchaseRequest.status !== "completed"
  ) {
    throw new DomainError(
      `このリクエストは現在 ${purchaseRequest.status} 状態のため申告できません。`,
      { status: 400 },
    );
  }

  // 4. 既存レビューの確認
  const existing = await findByPurchaseRequest(purchaseRequestId);
  if (
    existing &&
    (existing.status === "confirmed" || existing.status === "rejected")
  ) {
    throw new DomainError(
      "このリクエストは既に判定済みです。",
      { status: 400 },
    );
  }

  // 5. mode 決定
  //    既存レビューがあればその mode を維持（途中で変更しない）。
  //    新規作成時は paymentConfig.bankTransfer.autoComplete から決定し、以後不変。
  const mode: BankTransferReviewMode =
    existing?.mode ??
    (paymentConfig.bankTransfer.autoComplete
      ? "immediate"
      : "approval_required");

  // 6. レビューを作成または更新 + 監査ログ記録（同一トランザクションで atomic）
  //    再申告時は画像 URL を差し替えて submitted_at を更新する。
  //    base.update / base.create の型は drizzle DefaultInsert ベースで enum 列等を絞り込めない
  //    ため、purchaseRequest 側と同じく any キャストで通す。
  const review = await db.transaction(async (tx) => {
    let next: BankTransferReview;
    if (existing) {
      next = (await base.update(
        existing.id,
        {
          proof_image_url: proofImageUrl,
          submitted_at: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        tx,
      )) as BankTransferReview;
    } else {
      next = (await base.create(
        {
          purchase_request_id: purchaseRequestId,
          user_id: userId,
          status: "pending_review" as const,
          mode,
          proof_image_url: proofImageUrl,
          submitted_at: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        tx,
      )) as BankTransferReview;
    }

    // ユーザー申告アクションを監査ログに記録。
    // actor は createApiRoute 経由の AsyncLocalStorage から自動注入される。
    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      action: "bank_transfer_review.review.submitted",
      before: existing
        ? {
            status: existing.status,
            proof_image_url: existing.proof_image_url,
          }
        : null,
      after: {
        status: next.status,
        mode: next.mode,
        proof_image_url: next.proof_image_url,
      },
      metadata: {
        purchaseRequestId,
        isResubmission: Boolean(existing),
      },
      tx,
    });

    return next;
  });

  // 7. mode=immediate ならその場で completePurchase
  //    purchase_request が既に completed の場合（再申告）は completePurchase 側の
  //    冪等性で早期リターンするため呼んでも安全だが、無駄なので skip する。
  let walletHistoryId: string | null = null;
  const alreadyCompleted = purchaseRequest.status === "completed";

  if (mode === "immediate" && !alreadyCompleted) {
    const completion = await completePurchase({
      sessionId:
        purchaseRequest.payment_session_id ?? purchaseRequest.id,
      paidAt: new Date(),
      providerName: INHOUSE_PROVIDER_NAME,
    });
    walletHistoryId = completion.walletHistoryId;
  }

  return { review, mode, walletHistoryId, alreadyCompleted };
}
