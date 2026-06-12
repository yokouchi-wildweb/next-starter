// src/features/core/bankTransferReview/services/server/wrappers/findHelpers.ts
//
// 共通検索ヘルパー。ユーザー側 / 管理者側の双方から利用される。

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";

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
 * 検出条件: review.status が pending_review / needs_check **かつ**
 * purchase_request.status=processing
 *
 * 「purchase_request.status=processing」を判定軸に置くことで、各モードを mode で
 * 分岐せずに「ユーザー対応が必要な状態」を一括検出できる:
 *
 *   - mode=approval_required + processing (通貨未付与で承認待ち) → 検出
 *   - mode=approval_required + completed (確認後に通貨付与済み、稀に review 更新失敗で
 *     pending_review が残るケース) → 検出しない（通貨は既に付与済み）
 *   - mode=immediate + completed (正常完了) → 検出しない
 *   - mode=immediate + processing (異常: 申告は受け付けたが completePurchase が失敗して
 *     通貨未付与のまま停止している状態) → 検出する。バナー → 振込案内ページへの誘導で
 *     ユーザーが再申告 (画像差し替え) すると completePurchase が再試行されて回復可能
 *   - needs_check + processing (AI 判定不合格のまま申告し、管理者の確認待ち) → 検出。
 *     ユーザーは確認待ち画面への誘導を受けつつ、振込案内ページから正しい画像で
 *     再申告して pending_review に戻すこともできる
 *   - investigating: 管理者の検証中。ユーザーに促すアクションが無いため検出しない
 *   - confirmed / rejected: ユーザー視点で終了状態 → 検出しない
 *
 * 管理者側の一覧検索は別関数（admin route で直接 db クエリ）を使うため、このヘルパーは
 * ユーザー視点専用。inhouseProvider.validateInitiation の並行ブロックで同一ユーザーの
 * 未完了振込は最大 1 件に制限されているが、安全側に desc(submitted_at) で最新の 1 件を取る。
 */
export async function findActiveByUser(
  userId: string,
): Promise<BankTransferReview | null> {
  const rows = await db
    .select({
      review: BankTransferReviewTable,
    })
    .from(BankTransferReviewTable)
    .innerJoin(
      PurchaseRequestTable,
      eq(BankTransferReviewTable.purchase_request_id, PurchaseRequestTable.id),
    )
    .where(
      and(
        eq(BankTransferReviewTable.user_id, userId),
        inArray(BankTransferReviewTable.status, [
          "pending_review",
          "needs_check",
        ]),
        eq(PurchaseRequestTable.status, "processing"),
      ),
    )
    .orderBy(desc(BankTransferReviewTable.submitted_at))
    .limit(1);
  return (rows[0]?.review as BankTransferReview | undefined) ?? null;
}
