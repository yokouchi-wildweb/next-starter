// src/domains/core/purchaseRequest/services/server/wrappers/reconcileWithProvider.ts
//
// 購入リクエスト 1 行を決済プロバイダの状態と照らす(照合)。読み手は 2 つ:
// - getPurchaseStatusForUser(callback 画面のポーリング): processing の行を照らし、未確定ならそのまま返す
// - settleStaleClientSdkSession(放置の掃除と cron): 照らして未確定なら expired にする
//
// プロバイダが「払われた」と言えば completePurchase(expired からも完了する、払いが確かめられた物は捨てない)、
// 「失敗」と言えば failPurchase。それ以外(承認だけ・未承認・照会 API が無い・識別子が無い)は open。
// プロバイダへの照会が throw した時は呼び手へ投げる(呼び手が「分からない」の扱いを決める)。

import type { PurchaseRequest } from "@/domains/core/purchaseRequest/entities/model";
import { getPaymentProvider, type PaymentProviderName } from "../payment";
import { completePurchase } from "./completePurchase";
import { failPurchase } from "./failPurchase";

export type ReconcileOutcome =
  /** プロバイダが払いを確かめ、行を completed にした(または既に completed) */
  | { kind: "completed"; request: PurchaseRequest }
  /** プロバイダが失敗・期限切れと言い、行を failed にした */
  | { kind: "failed"; request: PurchaseRequest }
  /** まだ決まらない(承認だけ・未承認)、または照会できない(照会 API・識別子が無い) */
  | { kind: "open"; request: PurchaseRequest };

/**
 * 1 行をプロバイダの状態と照らす。
 * @throws プロバイダの解決・照会、completePurchase / failPurchase の DB 障害(DomainError でない物)
 */
export async function reconcileWithProvider(request: PurchaseRequest): Promise<ReconcileOutcome> {
  if (!request.payment_provider) return { kind: "open", request };
  const providerName = request.payment_provider as PaymentProviderName;
  const provider = getPaymentProvider(providerName);
  // getPaymentStatus はオプショナル(未実装のプロバイダは照らせない)
  if (!provider.getPaymentStatus) return { kind: "open", request };

  // API 照会用の識別子を provider 契約(correlationKey)で選ぶ。
  // - "order_id"  : provider_order_id(Fincode の `GET /v1/payments/Card/{order_id}` の id 部分)
  // - "session_id": payment_session_id(多数派の既定)
  // この識別子は findByWebhookIdentifier の照合キーとしてもそのまま使われるため、
  // completePurchase / failPurchase の sessionId にも同じ値を渡す。
  const identifier = provider.correlationKey === "order_id" ? request.provider_order_id : request.payment_session_id;
  if (!identifier) return { kind: "open", request };

  // payment_method は購入時にユーザーが選んだ値。Fincode の照会 API は pay_type を要求するため、ここから解決する
  const providerStatus = await provider.getPaymentStatus(identifier, request.payment_method ?? undefined);

  if (providerStatus.status === "completed") {
    const result = await completePurchase({
      sessionId: identifier,
      transactionId: providerStatus.transactionId,
      paidAt: providerStatus.paidAt,
      providerName,
    });
    return { kind: "completed", request: result.purchaseRequest };
  }
  if (providerStatus.status === "failed" || providerStatus.status === "expired") {
    const result = await failPurchase({
      sessionId: identifier,
      errorCode: providerStatus.errorCode,
      errorMessage: providerStatus.errorMessage,
      providerName,
    });
    return { kind: "failed", request: result };
  }
  return { kind: "open", request };
}
