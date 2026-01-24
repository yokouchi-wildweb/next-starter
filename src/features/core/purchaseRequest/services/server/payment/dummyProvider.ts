// src/features/core/purchaseRequest/services/server/payment/dummyProvider.ts

import type {
  PaymentProvider,
  CreatePaymentSessionParams,
  PaymentSession,
  PaymentResult,
  PaymentStatusResult,
} from "@/features/core/purchaseRequest/types/payment";

/**
 * ダミー決済プロバイダ
 * 開発・テスト用の擬似決済実装
 * 実際の決済は行わず、フロー全体のテストを可能にする
 */
export class DummyPaymentProvider implements PaymentProvider {
  readonly providerName = "dummy";

  /**
   * ダミー決済セッションを作成
   * 実際の決済サービスへの通信は行わず、即座にセッションを返す
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSession> {
    const sessionId = `dummy_session_${params.purchaseRequestId}_${Date.now()}`;

    // ダミー決済確認ページにリダイレクト
    // このページでユーザーが「支払いを完了する」ボタンを押すとWebhookが発火する
    const queryParams = new URLSearchParams({
      session_id: sessionId,
      amount: String(params.amount),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    const redirectUrl = `/demo/dummy-payment?${queryParams.toString()}`;

    return {
      sessionId,
      redirectUrl,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分後
    };
  }

  /**
   * ダミーWebhookを検証
   * 開発環境では署名検証をスキップし、ペイロードをそのまま信頼する
   */
  async verifyWebhook(request: Request): Promise<PaymentResult> {
    try {
      const body = await request.json();

      // ダミーでは event_type で成功/失敗を判断
      const isSuccess = body.event_type === "payment.completed";

      return {
        success: isSuccess,
        sessionId: body.session_id,
        // 新規フィールド
        transactionId: isSuccess ? `dummy_txn_${Date.now()}` : undefined,
        paymentMethod: body.payment_method ?? "credit_card",
        paidAt: isSuccess ? new Date() : undefined,
        rawResponse: body,
        // エラー情報
        errorCode: isSuccess ? undefined : body.error_code,
        errorMessage: isSuccess ? undefined : body.error_message,
      };
    } catch {
      return {
        success: false,
        sessionId: "",
        errorCode: "INVALID_PAYLOAD",
        errorMessage: "Webhookペイロードの解析に失敗しました",
      };
    }
  }

  /**
   * Webhook署名を検証
   * ダミープロバイダでは常に true を返す（開発用）
   */
  async verifyWebhookSignature(_request: Request, _signature: string): Promise<boolean> {
    // ダミーでは署名検証をスキップ
    return true;
  }

  /**
   * 決済ステータスを照会
   * ダミープロバイダではセッションIDから疑似ステータスを返す
   */
  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    // ダミーでは常に completed を返す（実際のプロバイダではAPIを呼び出す）
    return {
      status: "completed",
      sessionId,
      transactionId: `dummy_txn_${sessionId}`,
      paidAt: new Date(),
    };
  }
}

/**
 * ダミープロバイダのシングルトンインスタンス
 */
export const dummyPaymentProvider = new DummyPaymentProvider();
