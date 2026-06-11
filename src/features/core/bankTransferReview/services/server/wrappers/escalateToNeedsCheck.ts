// src/features/core/bankTransferReview/services/server/wrappers/escalateToNeedsCheck.ts
//
// pending_review のレビューを「要確認」(needs_check) に遷移させるサービス。
//
// 想定呼び出し元:
// - CSV 一括取込で「マッチはしたが金額不一致など追加判断が必要」と判定された行
// - 将来追加される他の自動判定ロジック（重複振込疑い等）
//
// 設計:
// - reason / context は構造化保存。UI のバッジ・補足表示に使う
// - admin_memo への自動追記はしない（admin_memo は手書きメモ専用）
// - confirm/reject と同様に監査ログを同一トランザクションで atomic に
// - 通貨操作は一切行わない（mode に関わらず通貨は触らない。最終判断は人間が行う）

import { DomainError } from "@/lib/errors/domainError";
import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";

import type {
  BankTransferReview,
  BankTransferReviewNeedsCheckContext,
  BankTransferReviewNeedsCheckReason,
} from "@/features/bankTransferReview/entities/model";

import { base } from "../drizzleBase";
import { lockReviewStatus } from "./lockReviewStatus";

export type EscalateToNeedsCheckParams = {
  reviewId: string;
  /**
   * 遷移理由のコード。schema.ts の `BANK_TRANSFER_REVIEW_NEEDS_CHECK_REASONS` に列挙。
   */
  reason: BankTransferReviewNeedsCheckReason;
  /**
   * 理由ごとの詳細（金額不一致なら CSV 値と期待値、等）。
   * UI の補足表示と監査履歴に使う。
   */
  context: BankTransferReviewNeedsCheckContext;
  /**
   * エスカレーション操作を実行した管理者の user_id（automated 取込でも操作者を残すため必須）。
   * needs_check 自体は最終判定ではないので reviewed_by 列はまだ書かない（confirmed/rejected
   * 時に上書きする想定）。監査ログの actor が誰かは ALS から自動注入される。
   */
  triggeredBy: string;
};

export type EscalateToNeedsCheckResult = {
  review: BankTransferReview;
};

export async function escalateToNeedsCheck(
  params: EscalateToNeedsCheckParams,
): Promise<EscalateToNeedsCheckResult> {
  const { reviewId, reason, context, triggeredBy } = params;

  const review = (await base.get(reviewId)) as BankTransferReview | null;
  if (!review) {
    throw new DomainError("レビューが見つかりません。", { status: 404 });
  }

  // pending_review のみエスカレーション可能。
  // 既に needs_check のものは reason/context 書き換えで「再判定」を表現する選択肢もあるが、
  // 一旦は冪等性重視で現状維持（404 ではなく 400 で「既に要確認です」と返す）。
  // confirmed / rejected は最終状態なので不可。
  if (review.status !== "pending_review") {
    throw new DomainError(
      `このレビューは既に ${review.status} 状態のため要確認に遷移できません。`,
      { status: 400 },
    );
  }

  const updated = await db.transaction(async (tx) => {
    // 事前チェック後〜ここまでの間に別リクエストが status を変えた場合（TOCTOU）に
    // 古い判断で上書きしないよう、行ロックの上で遷移可否を再検証する。
    // 特に CSV 一括取込と手動承認の並走で、confirmed を needs_check に
    // 巻き戻してしまう事故をここで防ぐ。
    const currentStatus = await lockReviewStatus(tx, review.id);
    if (currentStatus === null) {
      throw new DomainError("レビューが見つかりません。", { status: 404 });
    }
    if (currentStatus !== "pending_review") {
      throw new DomainError(
        `このレビューは既に ${currentStatus} 状態のため要確認に遷移できません。`,
        { status: 400 },
      );
    }

    const next = (await base.update(
      review.id,
      {
        status: "needs_check" as const,
        needs_check_reason: reason,
        needs_check_context: context,
        // base.update の引数型は drizzle DefaultInsert ベースで enum 列等を絞り込めないため
        // 同ドメインの他 wrapper と同様に any キャストで通す。
      } as unknown as Parameters<typeof base.update>[1],
      tx,
    )) as BankTransferReview;

    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      subjectUserId: review.user_id,
      action: "bank_transfer_review.review.flagged_needs_check",
      before: { status: currentStatus },
      after: {
        status: next.status,
        needs_check_reason: next.needs_check_reason,
      },
      metadata: {
        purchaseRequestId: review.purchase_request_id,
        mode: review.mode,
        reason,
        context,
        triggeredBy,
      },
      tx,
    });

    return next;
  });

  return { review: updated };
}
