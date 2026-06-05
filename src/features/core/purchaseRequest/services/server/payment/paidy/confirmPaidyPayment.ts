// src/features/core/purchaseRequest/services/server/payment/paidy/confirmPaidyPayment.ts
//
// Paidy (client_sdk 起動方式) 決済の完了確定サービス。
//
// クライアント (paidy.js) のモーダルで決済が AUTHORIZED されたあと、
// API ルート (/api/wallet/purchase/[id]/paidy/confirm) から呼び出される。
//
// 処理の流れ:
//   1. purchase_request の取得と認可（user_id 一致、payment_provider が "paidy"）
//   2. status 別の分岐（completed は冪等 return、processing のみ通常パス）
//   3. Paidy API へ payment_id を投げて amount / status を二重確認
//      （Paidy には HMAC 署名検証が無いため、ペイロード信頼ではなくサーバー間検証に依存する）
//   4. AUTHORIZED なら capture を能動的に実行（Paidy はオート capture を持たないため）
//   5. payment_session_id に Paidy 側 payment_id を保存（Webhook 後着時の照合用）
//   6. completePurchase 呼び出し（既存の楽観ロックで Webhook 競合を吸収）
//   7. auditLogger.record で確定イベントを記録

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { completePurchase } from "@/features/core/purchaseRequest/services/server/wrappers/completePurchase";
import { failPurchase } from "@/features/core/purchaseRequest/services/server/wrappers/failPurchase";
import { base } from "@/features/core/purchaseRequest/services/server/drizzleBase";
import { paidyPaymentProvider } from "./paidyProvider";
import { PAIDY_PAYMENT_STATUS } from "./errorMapping";

const PAIDY_PROVIDER_NAME = "paidy" as const;

/**
 * 確定サービスの入力。
 * クライアント (clientSdkHandler) が受け取った Paidy 側 payment_id をそのまま投げる。
 */
export type ConfirmPaidyPaymentParams = {
  purchaseRequestId: string;
  userId: string;
  providerPaymentId: string;
};

/**
 * 確定サービスの出力。
 * alreadyCompleted は Webhook 先着等で既に completed 化されていた場合に true。
 * UI 側はそれを区別する必要はないが、ログ / メトリクス用に返す。
 */
export type ConfirmPaidyPaymentResult = {
  purchaseRequest: PurchaseRequest;
  walletHistoryId: string | null;
  alreadyCompleted: boolean;
};

export async function confirmPaidyPayment(
  params: ConfirmPaidyPaymentParams,
): Promise<ConfirmPaidyPaymentResult> {
  const { purchaseRequestId, userId, providerPaymentId } = params;

  // 1. purchase_request 取得 + 認可 + provider 整合性。
  //    認可（user 不一致）と存在（NULL）は 404 で同一視して情報秘匿。
  const purchaseRequest = await base.get(purchaseRequestId);
  if (!purchaseRequest || purchaseRequest.user_id !== userId) {
    throw new DomainError("購入リクエストが見つかりません", { status: 404 });
  }
  if (purchaseRequest.payment_provider !== PAIDY_PROVIDER_NAME) {
    throw new DomainError("購入リクエストが見つかりません", { status: 404 });
  }

  // 2. status 別の分岐。
  //    completed は Webhook 先着で確定済みのケース。冪等に既存状態を返す。
  //    processing が想定パス。それ以外（pending / failed / expired）は確定不可。
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

  // 3. Paidy API への二重確認。
  //    capturePayment / completePurchase の前に必ず実行し、クライアントペイロード経由の
  //    不正な payment_id 投入や amount 改ざんを弾く。
  const payment = await paidyPaymentProvider.fetchPayment(providerPaymentId);
  if (!payment) {
    throw new DomainError("Paidy 側に該当の決済が見つかりません", { status: 400 });
  }
  if (payment.amount !== purchaseRequest.payment_amount) {
    throw new DomainError(
      `決済金額が一致しません（Paidy=${payment.amount}, request=${purchaseRequest.payment_amount}）`,
      { status: 400 },
    );
  }

  // 4. Paidy 側ステータスに応じた処理。
  //    AUTHORIZED: 与信のみ完了 → 能動的に capture を叩く。
  //    CLOSED:    既に capture 済み（Webhook 後着 → サーバー再起動等のレアケース）→ skip。
  //    REJECTED:  与信失敗 → failPurchase を呼んで失敗確定 + 400 を投げる。
  if (payment.status === PAIDY_PAYMENT_STATUS.REJECTED) {
    await failPurchase({
      sessionId: purchaseRequest.id,
      errorCode: "PAIDY_REJECTED",
      errorMessage: "Paidy が決済を拒否しました",
      providerName: PAIDY_PROVIDER_NAME,
    });
    throw new DomainError("Paidy が決済を拒否しました", { status: 400 });
  }

  if (payment.status === PAIDY_PAYMENT_STATUS.AUTHORIZED) {
    const captured = await paidyPaymentProvider.capturePayment(
      providerPaymentId,
      purchaseRequest.payment_amount,
    );
    if (!captured) {
      throw new DomainError("Paidy の capture に失敗しました", { status: 502 });
    }
  }
  // CLOSED の場合は capture スキップ（既に確定済み、completePurchase へ進む）

  // 5. payment_session_id を Paidy 側 payment_id で更新。
  //    後着 Webhook が findByWebhookIdentifier で本リクエストを引けるようにする。
  await db
    .update(PurchaseRequestTable)
    .set({ payment_session_id: providerPaymentId })
    .where(eq(PurchaseRequestTable.id, purchaseRequest.id));

  // 6. completePurchase で確定。
  //    Webhook が並行で先着していた場合は楽観ロック (status=processing WHERE) で 409 が返るが、
  //    その時点で既に completed 化されているため alreadyCompleted: true として正常応答する。
  let completion: Awaited<ReturnType<typeof completePurchase>> | null = null;
  let alreadyCompleted = false;
  try {
    completion = await completePurchase({
      sessionId: providerPaymentId,
      transactionId: providerPaymentId,
      paymentMethod: PAIDY_PROVIDER_NAME,
      paidAt: new Date(),
      paidAmount: payment.amount,
      providerName: PAIDY_PROVIDER_NAME,
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

  // 7. 監査ログ。
  //    確定は client_sdk 経路固有のイベント（redirect 型は Webhook 経路のみ）。
  //    action は provider 非依存の命名にし、provider 名は metadata に入れる。
  await auditLogger.record({
    targetType: "purchase_request",
    targetId: purchaseRequest.id,
    subjectUserId: userId,
    action: "purchase_request.payment.confirmed",
    before: { status: "processing" },
    after: { status: "completed" },
    metadata: {
      paymentProvider: PAIDY_PROVIDER_NAME,
      paymentId: providerPaymentId,
      alreadyCompleted,
    },
  });

  return {
    purchaseRequest: completion.purchaseRequest,
    walletHistoryId: completion.walletHistoryId,
    alreadyCompleted,
  };
}
