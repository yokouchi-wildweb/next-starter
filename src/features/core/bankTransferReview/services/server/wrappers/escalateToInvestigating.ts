// src/features/core/bankTransferReview/services/server/wrappers/escalateToInvestigating.ts
//
// pending_review または needs_check のレビューを「検証中」(investigating) に遷移させるサービス。
//
// 想定呼び出し元:
// - 管理画面の詳細モーダル「検証中に移行」アクション
// - 将来追加される自動検知ロジック（重複振込疑い・本人確認不一致など）
//
// 設計:
// - reason / context は構造化保存しない（needs_check で使う列とは別運用）。
//   投稿時の任意メモは admin_memo 側に書き残す運用とし、こちらは status 遷移のみ責務にする。
// - investigating 自体は最終判定ではないため reviewed_by 列はまだ書かない
//   （confirmed / rejected 時に上書きする想定）。
// - 通貨操作は一切行わない（mode に関わらず通貨は触らない。最終判断は人間が行う）。
// - confirm/reject と同様に監査ログを同一トランザクションで atomic に。

import { DomainError } from "@/lib/errors/domainError";
import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";

import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";

import { base } from "../drizzleBase";
import { lockReviewStatus } from "./lockReviewStatus";

export type EscalateToInvestigatingParams = {
  reviewId: string;
  /**
   * エスカレーション操作を実行した管理者の user_id。
   * 監査ログの actor は ALS から自動注入される。
   */
  triggeredBy: string;
  /**
   * 検証中に移行する理由（任意、500 文字以内）。
   * 監査ログの metadata.note に記録する。null/空文字なら記録しない。
   */
  note?: string | null;
};

export type EscalateToInvestigatingResult = {
  review: BankTransferReview;
};

export async function escalateToInvestigating(
  params: EscalateToInvestigatingParams,
): Promise<EscalateToInvestigatingResult> {
  const { reviewId, triggeredBy } = params;
  const note = (params.note ?? "").trim() || null;

  const review = (await base.get(reviewId)) as BankTransferReview | null;
  if (!review) {
    throw new DomainError("レビューが見つかりません。", { status: 404 });
  }

  // pending_review / needs_check のみ遷移可能。
  // investigating からの再投入は不要（既にこの状態なので冪等性は 400 で表現）。
  // confirmed / rejected は最終状態なので不可。
  if (review.status !== "pending_review" && review.status !== "needs_check") {
    throw new DomainError(
      `このレビューは既に ${review.status} 状態のため検証中に遷移できません。`,
      { status: 400 },
    );
  }

  const updated = await db.transaction(async (tx) => {
    // 事前チェック後〜ここまでの間に別リクエストが status を変えた場合（TOCTOU）に
    // 古い判断で上書きしないよう、行ロックの上で遷移可否を再検証する。
    const currentStatus = await lockReviewStatus(tx, review.id);
    if (currentStatus === null) {
      throw new DomainError("レビューが見つかりません。", { status: 404 });
    }
    if (currentStatus !== "pending_review" && currentStatus !== "needs_check") {
      throw new DomainError(
        `このレビューは既に ${currentStatus} 状態のため検証中に遷移できません。`,
        { status: 400 },
      );
    }

    const next = (await base.update(
      review.id,
      {
        status: "investigating" as const,
        // base.update の引数型は drizzle DefaultInsert ベースで enum 列等を絞り込めないため
        // 同ドメインの他 wrapper と同様に any キャストで通す。
      } as unknown as Parameters<typeof base.update>[1],
      tx,
    )) as BankTransferReview;

    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      subjectUserId: review.user_id,
      action: "bank_transfer_review.review.flagged_investigating",
      before: { status: currentStatus },
      after: { status: next.status },
      metadata: {
        purchaseRequestId: review.purchase_request_id,
        mode: review.mode,
        fromStatus: currentStatus,
        triggeredBy,
        note,
      },
      tx,
    });

    return next;
  });

  return { review: updated };
}
