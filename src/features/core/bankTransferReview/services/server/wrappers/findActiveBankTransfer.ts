// src/features/core/bankTransferReview/services/server/wrappers/findActiveBankTransfer.ts
//
// 利用者の「現在進行中の自社銀行振込」を 1 件探す(GET /api/wallet/purchase/bank-transfer/active の取得部分)。
// 検出順序:
// 1. pending_review / needs_check のレビュー(申告済みで管理者待ち、または再申告可能な状態。findActiveByUser)
// 2. それが無ければ、申告前の processing 中 purchase_request(振込前で案内ページへ戻したいケース)
// inhouseProvider.validateInitiation で同一利用者の未完了銀行振込は 1 件に制限しているため、結果は最大 1 件。

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import {
  INHOUSE_BANK_TRANSFER_METHOD_ID,
  INHOUSE_PROVIDER_NAME,
} from "@/features/core/purchaseRequest/services/server/payment/inhouse";

import { findActiveByUser } from "./findHelpers";

export type ActiveBankTransfer =
  | {
      kind: "review";
      /** pending_review / needs_check のレビュー */
      review: BankTransferReview;
      /** 関連 purchase_request の wallet_type(無ければ null) */
      walletType: string | null;
    }
  | {
      kind: "pre_submit";
      purchaseRequestId: string;
      walletType: string | null;
    };

export async function findActiveBankTransfer(userId: string): Promise<ActiveBankTransfer | null> {
  const review = await findActiveByUser(userId);
  if (review) {
    const purchaseRequest = await db
      .select({ wallet_type: PurchaseRequestTable.wallet_type })
      .from(PurchaseRequestTable)
      .where(eq(PurchaseRequestTable.id, review.purchase_request_id))
      .limit(1);
    return { kind: "review", review, walletType: purchaseRequest[0]?.wallet_type ?? null };
  }

  const rows = await db
    .select({ id: PurchaseRequestTable.id, wallet_type: PurchaseRequestTable.wallet_type })
    .from(PurchaseRequestTable)
    .where(
      and(
        eq(PurchaseRequestTable.user_id, userId),
        eq(PurchaseRequestTable.payment_provider, INHOUSE_PROVIDER_NAME),
        eq(PurchaseRequestTable.payment_method, INHOUSE_BANK_TRANSFER_METHOD_ID),
        eq(PurchaseRequestTable.status, "processing"),
      ),
    )
    .orderBy(desc(PurchaseRequestTable.createdAt))
    .limit(1);

  const pr = rows[0];
  if (!pr) return null;
  return { kind: "pre_submit", purchaseRequestId: pr.id, walletType: pr.wallet_type ?? null };
}
