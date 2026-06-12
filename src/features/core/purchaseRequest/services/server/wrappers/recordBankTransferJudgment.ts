// src/features/core/purchaseRequest/services/server/wrappers/recordBankTransferJudgment.ts
//
// 銀行振込明細画像の AI 判定結果を purchase_requests.metadata に保存するサービス。
// judge-image API から判定実行のたびに呼ばれ、最新の 1 件で上書きする。
//
// 保存した判定レコードは振込完了申告（bankTransferReview/submitReview）がサーバー側の
// 合否検証に使う。クライアントの自己申告に依存しないことで、API 直叩きで判定を
// バイパスして即時付与を受ける攻撃を防ぐ（未判定 = 不合格として扱われる）。
//
// 並行性: metadata は read-modify-write でマージする。同一 purchase_request の判定は
// 本人のみが直列に実行する（レート制限あり）ため、実用上の競合は発生しない。

import { DomainError } from "@/lib/errors/domainError";
import {
  BANK_TRANSFER_JUDGMENT_METADATA_KEY,
  type BankTransferImageJudgmentRecord,
} from "@/features/core/purchaseRequest/constants/bankTransferJudgment";
import type { PurchaseRequest } from "@/features/purchaseRequest/entities/model";

import { base } from "../drizzleBase";

export type RecordBankTransferJudgmentParams = {
  purchaseRequestId: string;
  /** 所有者検証用。purchase_request.user_id と一致しない場合は 404（存在隠蔽） */
  userId: string;
  judgment: BankTransferImageJudgmentRecord;
};

export async function recordBankTransferJudgment(
  params: RecordBankTransferJudgmentParams,
): Promise<void> {
  const { purchaseRequestId, userId, judgment } = params;

  const purchaseRequest = (await base.get(
    purchaseRequestId,
  )) as PurchaseRequest | null;
  if (!purchaseRequest || purchaseRequest.user_id !== userId) {
    throw new DomainError("購入リクエストが見つかりません。", { status: 404 });
  }

  // 既存 metadata に判定レコードをマージ（他のキーは保持）。
  const currentMetadata =
    typeof purchaseRequest.metadata === "object" &&
    purchaseRequest.metadata !== null
      ? (purchaseRequest.metadata as Record<string, unknown>)
      : {};

  await base.update(purchaseRequestId, {
    metadata: {
      ...currentMetadata,
      [BANK_TRANSFER_JUDGMENT_METADATA_KEY]: judgment,
    },
    // base.update の型は drizzle DefaultInsert ベースで jsonb 列を絞り込めないため
    // 同ドメインの他 wrapper と同様にキャストで通す。
  } as unknown as Parameters<typeof base.update>[1]);
}
