// src/features/core/bankTransferReview/services/server/wrappers/updateAdminMemo.ts
//
// 管理者が手書きで残す admin_memo を更新するサービス。
//
// 設計:
// - status は問わない（pending / needs_check / confirmed / rejected いずれでもメモ可能）
// - 空文字 / 空白のみは null として保存（カラムは nullable）
// - 監査ログに変更前後を記録（運用追跡用）
// - 発送リクエストの admin_memo と同等の運用方針

import { DomainError } from "@/lib/errors/domainError";
import { db } from "@/lib/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";

import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";

import { base } from "../drizzleBase";

export type UpdateAdminMemoParams = {
  reviewId: string;
  /** 新しいメモ。空文字/空白のみは null として保存される */
  adminMemo: string | null;
  /** 操作した管理者 user_id（監査メタデータに記録） */
  updatedBy: string;
};

export type UpdateAdminMemoResult = {
  review: BankTransferReview;
};

const ADMIN_MEMO_MAX_LENGTH = 2000;

function normalizeMemo(input: string | null): string | null {
  if (input === null) return null;
  const trimmed = input.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updateAdminMemo(
  params: UpdateAdminMemoParams,
): Promise<UpdateAdminMemoResult> {
  const { reviewId, updatedBy } = params;
  const nextMemo = normalizeMemo(params.adminMemo);

  if (nextMemo !== null && nextMemo.length > ADMIN_MEMO_MAX_LENGTH) {
    throw new DomainError(
      `管理者メモは ${ADMIN_MEMO_MAX_LENGTH} 文字以内で入力してください。`,
      { status: 400 },
    );
  }

  const review = (await base.get(reviewId)) as BankTransferReview | null;
  if (!review) {
    throw new DomainError("レビューが見つかりません。", { status: 404 });
  }

  // 変更が無ければ DB / 監査ログを動かさず早期リターン（冪等）。
  if ((review.admin_memo ?? null) === nextMemo) {
    return { review };
  }

  const updated = await db.transaction(async (tx) => {
    const next = (await base.update(
      review.id,
      // base.update の引数型は drizzle DefaultInsert ベースで追加列を絞り込めないため、
      // 同ドメインの他 wrapper と同様にキャストで通す。
      { admin_memo: nextMemo } as unknown as Parameters<typeof base.update>[1],
      tx,
    )) as BankTransferReview;

    await auditLogger.record({
      targetType: "bank_transfer_review",
      targetId: next.id,
      action: "bank_transfer_review.admin_memo.changed",
      before: { admin_memo: review.admin_memo },
      after: { admin_memo: next.admin_memo },
      metadata: {
        purchaseRequestId: review.purchase_request_id,
        updatedBy,
      },
      tx,
    });

    return next;
  });

  return { review: updated };
}
