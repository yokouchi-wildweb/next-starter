// src/features/core/purchaseRequest/services/server/wrappers/cancelPurchase.ts
//
// ユーザー自身が購入リクエストをキャンセルする処理。
// 主な用途: 自社銀行振込の振込案内画面から「キャンセル」ボタンで購入をやり直す。
//
// 処理:
// 1. 認可 + status 検証 (pending / processing のみ受付)
// 2. purchase_request.status を expired に遷移 (楽観ロック付き)
// 3. 関連 bank_transfer_review が pending_review なら status='rejected' に遷移
//    (システム理由として reject_reason に「ユーザー操作によるキャンセル」を記録)
// 4. 監査ログを記録 (purchase_request.status.cancelled +
//    必要に応じて bank_transfer_review.review.cancelled)
//
// 設計上の注意:
// - bank_transfer_review への直接 SQL 更新は責務分離の観点で薄い violation だが、
//   トランザクション境界を一致させて atomic 化するための妥協。
//   bankTransferReview ドメインから purchaseRequest を呼ぶ循環依存を避けるため、
//   ここでは entities/drizzle (テーブル定義のみ) を import する形に留める。
// - 既存の expired 状態 (バッチによる自動 expire) と区別したい場合は audit metadata の
//   cancelReason='user_cancelled' で識別する。

import { and, eq, or } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { DomainError } from "@/lib/errors/domainError";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";

export type CancelPurchaseParams = {
  purchaseRequestId: string;
  /** 操作主体のユーザー ID (認可と audit actor の両方で使用) */
  userId: string;
};

export type CancelPurchaseResult = {
  purchaseRequest: PurchaseRequest;
};

/**
 * ユーザーキャンセル時に bank_transfer_review.reject_reason に記録する固定文言。
 * 管理画面表示と監査追跡を兼ねる。
 */
const USER_CANCEL_REJECT_REASON = "ユーザー操作によるキャンセル";

export async function cancelPurchase(
  params: CancelPurchaseParams,
): Promise<CancelPurchaseResult> {
  const { purchaseRequestId, userId } = params;

  // 1. 購入リクエスト取得 + 認可
  //    認可失敗と不在は同一視して 404 (存在隠蔽)
  const [current] = await db
    .select()
    .from(PurchaseRequestTable)
    .where(eq(PurchaseRequestTable.id, purchaseRequestId))
    .limit(1);

  if (!current || current.user_id !== userId) {
    throw new DomainError("購入リクエストが見つかりません。", { status: 404 });
  }

  // 2. status 検証
  //    pending / processing のみキャンセル可能。
  //    completed / failed / expired は既に終了状態なので 400。
  if (current.status !== "pending" && current.status !== "processing") {
    throw new DomainError(
      `このリクエストは現在 ${current.status} 状態のためキャンセルできません。`,
      { status: 400 },
    );
  }

  // 3. トランザクション内で atomic にキャンセル処理
  return await db.transaction(async (tx) => {
    // 3a. purchase_request を expired に更新 (楽観ロック付き)
    //     並行操作 (バッチによる自動 expire 等) で既に遷移済みなら 409 を返す
    const [updated] = await tx
      .update(PurchaseRequestTable)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(PurchaseRequestTable.id, current.id),
          or(
            eq(PurchaseRequestTable.status, "pending"),
            eq(PurchaseRequestTable.status, "processing"),
          ),
        ),
      )
      .returning();

    if (!updated) {
      throw new DomainError(
        "リクエストの更新に失敗しました。既に処理済みの可能性があります。",
        { status: 409 },
      );
    }

    // 3b. 関連 bank_transfer_review が pending_review なら rejected に遷移
    //     (申告前 = レビュー無し、確認モード申告後 = pending_review 等のケースに対応)
    const [reviewBefore] = await tx
      .select()
      .from(BankTransferReviewTable)
      .where(eq(BankTransferReviewTable.purchase_request_id, current.id))
      .limit(1);

    let updatedReviewId: string | null = null;
    let updatedReviewMode: string | null = null;

    if (reviewBefore && reviewBefore.status === "pending_review") {
      const [reviewUpdated] = await tx
        .update(BankTransferReviewTable)
        .set({
          status: "rejected",
          reject_reason: USER_CANCEL_REJECT_REASON,
          reviewed_at: new Date(),
          // reviewed_by はシステム自動なので null のまま (管理者の判定ではない)
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(BankTransferReviewTable.id, reviewBefore.id),
            eq(BankTransferReviewTable.status, "pending_review"),
          ),
        )
        .returning();
      if (reviewUpdated) {
        updatedReviewId = reviewUpdated.id;
        updatedReviewMode = reviewUpdated.mode;
      }
    }

    // 3c. 監査ログ記録 (purchase_request)
    //     metadata.cancelReason='user_cancelled' で「バッチによる自動 expire」と区別する
    await auditLogger.record({
      targetType: "purchase_request",
      targetId: current.id,
      action: "purchase_request.status.cancelled",
      before: { status: current.status },
      after: { status: "expired" },
      metadata: {
        cancelReason: "user_cancelled",
        paymentMethod: current.payment_method,
        paymentProvider: current.payment_provider,
      },
      tx,
    });

    // 3d. 監査ログ記録 (bank_transfer_review、更新があった場合のみ)
    if (updatedReviewId) {
      await auditLogger.record({
        targetType: "bank_transfer_review",
        targetId: updatedReviewId,
        action: "bank_transfer_review.review.cancelled",
        before: { status: "pending_review" },
        after: { status: "rejected", reject_reason: USER_CANCEL_REJECT_REASON },
        metadata: {
          purchaseRequestId: current.id,
          mode: updatedReviewMode,
          cancelledByUser: true,
        },
        reason: USER_CANCEL_REJECT_REASON,
        tx,
      });
    }

    return { purchaseRequest: updated as PurchaseRequest };
  });
}
