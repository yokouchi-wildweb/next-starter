// src/features/core/bankTransferReview/services/server/wrappers/lockReviewStatus.ts
//
// ステータス遷移系 wrapper（confirm / reject / escalate）共通の行ロックヘルパー。
//
// 遷移可否の事前チェックはトランザクション外の base.get で行われるため、
// チェック後〜UPDATE 前に別リクエスト（CSV 一括取込と手動操作の並走等）が
// status を変えると、古い判断のまま上書きしてしまう（TOCTOU）。
// 各 wrapper はトランザクション内で本ヘルパーにより行をロックし、
// その時点の status で遷移可否を再検証してから UPDATE すること。

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import type { BankTransferReviewStatus } from "@/features/bankTransferReview/entities/model";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * レビュー行を SELECT ... FOR UPDATE でロックし、その時点の status を返す。
 * トランザクション終了までロックは保持され、並走する遷移処理は待たされる。
 * 行が存在しない場合は null。
 */
export async function lockReviewStatus(
  tx: DbTransaction,
  reviewId: string,
): Promise<BankTransferReviewStatus | null> {
  const rows = await tx
    .select({ status: BankTransferReviewTable.status })
    .from(BankTransferReviewTable)
    .where(eq(BankTransferReviewTable.id, reviewId))
    .for("update");
  return rows[0]?.status ?? null;
}
