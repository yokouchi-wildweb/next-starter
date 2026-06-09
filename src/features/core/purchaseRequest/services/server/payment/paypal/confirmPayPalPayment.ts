// src/features/core/purchaseRequest/services/server/payment/paypal/confirmPayPalPayment.ts
//
// PayPal (client_sdk 起動方式) 決済の完了確定サービス。
//
// クライアント (PayPal JS SDK ボタン) の onApprove で承認 (APPROVED) されたあと、
// API ルート (/api/wallet/purchase/[id]/paypal/confirm) から呼び出される。
//
// 処理の流れ（confirmPaidyPayment と対称）:
//   1. purchase_request の取得と認可（user_id 一致、payment_provider が "paypal"）
//   2. status 別の分岐（completed は冪等 return、processing のみ通常パス）
//   3. PayPal API へ order_id を投げて amount / status を再確認
//   4. APPROVED なら capture を実行（COMPLETED なら既に確定済みで skip）
//   5. completePurchase 呼び出し（既存の楽観ロックで Webhook 競合を吸収）
//   6. auditLogger.record で確定イベントを記録
//
// 備考: PayPal は order_id が createSession 時点で確定し、initiatePurchase が
//   payment_session_id に保存済み。よって Paidy と違い payment_session_id の追記更新は不要。

import { DomainError } from "@/lib/errors/domainError";
import { auditLogger } from "@/features/core/auditLog/services/server";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { completePurchase } from "@/features/core/purchaseRequest/services/server/wrappers/completePurchase";
import { failPurchase } from "@/features/core/purchaseRequest/services/server/wrappers/failPurchase";
import { base } from "@/features/core/purchaseRequest/services/server/drizzleBase";
import { paypalPaymentProvider } from "./paypalProvider";
import { PAYPAL_CAPTURE_STATUS, PAYPAL_ORDER_STATUS } from "./errorMapping";

const PAYPAL_PROVIDER_NAME = "paypal" as const;

/**
 * 確定サービスの入力。
 * クライアント (clientSdkHandler) が PayPal の onApprove で受け取った order_id をそのまま投げる。
 */
export type ConfirmPayPalPaymentParams = {
  purchaseRequestId: string;
  userId: string;
  /** PayPal の order_id（onApprove の data.orderID）。createSession で発行したものと一致する。 */
  providerPaymentId: string;
};

/**
 * 確定サービスの出力。
 * alreadyCompleted は Webhook 先着等で既に completed 化されていた場合に true。
 */
export type ConfirmPayPalPaymentResult = {
  purchaseRequest: PurchaseRequest;
  walletHistoryId: string | null;
  alreadyCompleted: boolean;
};

/** Order の purchase_unit から金額（整数円）を取り出す。 */
function readOrderAmount(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export async function confirmPayPalPayment(
  params: ConfirmPayPalPaymentParams,
): Promise<ConfirmPayPalPaymentResult> {
  const { purchaseRequestId, userId, providerPaymentId } = params;

  // 1. purchase_request 取得 + 認可 + provider 整合性。
  //    認可（user 不一致）と存在（NULL）は 404 で同一視して情報秘匿。
  const purchaseRequest = await base.get(purchaseRequestId);
  if (!purchaseRequest || purchaseRequest.user_id !== userId) {
    throw new DomainError("購入リクエストが見つかりません", { status: 404 });
  }
  if (purchaseRequest.payment_provider !== PAYPAL_PROVIDER_NAME) {
    throw new DomainError("購入リクエストが見つかりません", { status: 404 });
  }

  // providerPaymentId が createSession で発行した order_id（= payment_session_id）と一致するか検証。
  // クライアント経由の order_id 差し替え（別注文の capture 流用）を弾く。
  if (
    purchaseRequest.payment_session_id &&
    purchaseRequest.payment_session_id !== providerPaymentId
  ) {
    throw new DomainError("order_id がリクエストと一致しません", { status: 400 });
  }

  // 2. status 別の分岐。
  //    completed は Webhook 先着で確定済みのケース。冪等に既存状態を返す。
  if (purchaseRequest.status === "completed") {
    return {
      purchaseRequest,
      walletHistoryId: purchaseRequest.wallet_history_id,
      alreadyCompleted: true,
    };
  }
  if (purchaseRequest.status !== "processing") {
    throw new DomainError(
      `この購入リクエストは確定できません（status=${purchaseRequest.status}）`,
      { status: 400 },
    );
  }

  // 3. PayPal API への再確認（capture / completePurchase の前に必ず実行）。
  const order = await paypalPaymentProvider.fetchOrder(providerPaymentId);
  if (!order) {
    throw new DomainError("PayPal 側に該当の注文が見つかりません", { status: 400 });
  }

  const orderAmount = readOrderAmount(order.purchase_units?.[0]?.amount?.value);
  if (orderAmount !== purchaseRequest.payment_amount) {
    throw new DomainError(
      `決済金額が一致しません（PayPal=${orderAmount}, request=${purchaseRequest.payment_amount}）`,
      { status: 400 },
    );
  }

  // 4. Order ステータスに応じた処理。
  //    VOIDED:    無効化済み → 失敗確定。
  //    COMPLETED: 既に capture 済み（Webhook 後着等）→ capture skip。
  //    APPROVED:  承認済み → capture を実行。
  //    その他（CREATED 等）: まだ承認されていないため確定不可。
  let captureId: string | undefined =
    order.purchase_units?.[0]?.payments?.captures?.[0]?.id;

  if (order.status === PAYPAL_ORDER_STATUS.VOIDED) {
    await failPurchase({
      sessionId: providerPaymentId,
      errorCode: "PAYPAL_VOIDED",
      errorMessage: "PayPal の注文が無効化されました",
      providerName: PAYPAL_PROVIDER_NAME,
    });
    throw new DomainError("PayPal の注文が無効化されました", { status: 400 });
  }

  if (order.status === PAYPAL_ORDER_STATUS.APPROVED) {
    const captured = await paypalPaymentProvider.captureOrder(providerPaymentId);
    if (!captured) {
      throw new DomainError("PayPal の capture に失敗しました", { status: 502 });
    }
    const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
    // capture が COMPLETED 以外（DECLINED 等）なら失敗確定。
    if (!capture || capture.status === PAYPAL_CAPTURE_STATUS.DECLINED) {
      await failPurchase({
        sessionId: providerPaymentId,
        errorCode: "PAYPAL_CAPTURE_DECLINED",
        errorMessage: "PayPal が決済を拒否しました",
        providerName: PAYPAL_PROVIDER_NAME,
      });
      throw new DomainError("PayPal が決済を拒否しました", { status: 400 });
    }
    captureId = capture.id;
  } else if (order.status !== PAYPAL_ORDER_STATUS.COMPLETED) {
    // CREATED / SAVED 等。購入者の承認がまだ完了していない。
    throw new DomainError(
      `PayPal の注文が確定可能な状態ではありません（status=${order.status}）`,
      { status: 400 },
    );
  }

  // 5. completePurchase で確定。
  //    sessionId は order_id（= payment_session_id）を渡す。findByWebhookIdentifier が一致で引く。
  //    Webhook が並行先着していた場合は楽観ロックで 409 が返るため alreadyCompleted で吸収する。
  let completion: Awaited<ReturnType<typeof completePurchase>> | null = null;
  try {
    completion = await completePurchase({
      sessionId: providerPaymentId,
      transactionId: captureId ?? providerPaymentId,
      paymentMethod: PAYPAL_PROVIDER_NAME,
      paidAt: new Date(),
      paidAmount: orderAmount,
      providerName: PAYPAL_PROVIDER_NAME,
    });
  } catch (error) {
    if (error instanceof DomainError && error.status === 409) {
      // 並行で Webhook が完了させた。最新状態を再取得して alreadyCompleted で返す。
      const refreshed = await base.get(purchaseRequest.id);
      if (refreshed && refreshed.status === "completed") {
        return {
          purchaseRequest: refreshed,
          walletHistoryId: refreshed.wallet_history_id,
          alreadyCompleted: true,
        };
      }
    }
    throw error;
  }

  if (!completion) {
    throw new DomainError("購入完了処理に失敗しました", { status: 500 });
  }

  // 6. 監査ログ（client_sdk 経路固有のイベント）。action は provider 非依存。
  await auditLogger.record({
    targetType: "purchase_request",
    targetId: purchaseRequest.id,
    subjectUserId: userId,
    action: "purchase_request.payment.confirmed",
    before: { status: "processing" },
    after: { status: "completed" },
    metadata: {
      paymentProvider: PAYPAL_PROVIDER_NAME,
      orderId: providerPaymentId,
      captureId: captureId ?? null,
    },
  });

  return {
    purchaseRequest: completion.purchaseRequest,
    walletHistoryId: completion.walletHistoryId,
    alreadyCompleted: false,
  };
}
