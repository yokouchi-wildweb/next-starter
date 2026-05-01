// src/features/core/bankTransferReview/services/server/wrappers/findHelpers.ts
//
// 共通検索ヘルパー。ユーザー側 / 管理者側の双方から利用される。

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";

/**
 * purchase_request_id でレビューを取得する。
 * 1 purchase_request : 1 review の UNIQUE 関係なので最大 1 件。
 */
export async function findByPurchaseRequest(
  purchaseRequestId: string,
): Promise<BankTransferReview | null> {
  const rows = await db
    .select()
    .from(BankTransferReviewTable)
    .where(eq(BankTransferReviewTable.purchase_request_id, purchaseRequestId))
    .limit(1);
  return (rows[0] as BankTransferReview | undefined) ?? null;
}

/**
 * ユーザー側のバナー表示用に「ユーザーがまだアクション必要なレビュー」を 1 件取得する。
 *
 * 「進行中」の定義 (ユーザー視点):
 *   - mode=approval_required + status=pending_review: 申告済みだが通貨未付与、
 *     管理者の承認を待つ状態 → ユーザーから見れば「処理中」なのでバナー表示対象
 *   - mode=immediate + status=pending_review: 申告済みで通貨は既に付与済み。
 *     レビュー自体は管理者の事後の振込確認待ちだが、ユーザー側は何もすることがない
 *     ので **バナー表示対象外**（ここを含めると申告完了後もバナーが残るバグになる）
 *   - confirmed / rejected: ユーザー視点では完了 / 失敗のいずれかで終了状態
 *
 * 管理者側の一覧検索は別関数（admin route で直接 db クエリ）を使うため、
 * このヘルパーはユーザー視点専用。inhouseProvider.validateInitiation の並行ブロックで
 * 同一ユーザーの未完了振込は最大 1 件に制限されているが、安全側に desc(submitted_at)
 * で最新の 1 件を取る。
 */
export async function findActiveByUser(
  userId: string,
): Promise<BankTransferReview | null> {
  const rows = await db
    .select()
    .from(BankTransferReviewTable)
    .where(
      and(
        eq(BankTransferReviewTable.user_id, userId),
        eq(BankTransferReviewTable.status, "pending_review"),
        eq(BankTransferReviewTable.mode, "approval_required"),
      ),
    )
    .orderBy(desc(BankTransferReviewTable.submitted_at))
    .limit(1);
  return (rows[0] as BankTransferReview | undefined) ?? null;
}
