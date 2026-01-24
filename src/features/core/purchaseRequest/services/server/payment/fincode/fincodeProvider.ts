// src/features/core/purchaseRequest/services/server/payment/fincode/fincodeProvider.ts
// GMO Fincode 決済プロバイダ実装（リダイレクト型決済）

import type {
  PaymentProvider,
  CreatePaymentSessionParams,
  PaymentSession,
  PaymentResult,
  PaymentStatusResult,
} from "@/features/core/purchaseRequest/types/payment";
import {
  PAYMENT_ERROR_CODES,
  mapProviderError,
} from "@/features/core/purchaseRequest/constants/errorCodes";
import {
  FINCODE_ERROR_MAP,
  isSuccessEvent,
  extractPaymentMethod,
} from "./errorMapping";

/**
 * Fincode 環境設定
 */
type FincodeConfig = {
  apiUrl: string;
  secretKey: string;
  webhookSignature: string;
};

/**
 * Fincode API レスポンス型（セッション作成）
 */
type FincodeSessionResponse = {
  id: string;
  link_url: string;
  expire?: string;
};

/**
 * Fincode Webhook ペイロード型
 */
type FincodeWebhookPayload = {
  event_type: string;
  data: {
    session_id?: string;
    order_id?: string;
    access_id?: string;
    transaction_id?: string;
    pay_type?: string;
    amount?: number;
    error_code?: string;
    created?: string;
    updated?: string;
  };
};

/**
 * Fincode セッション照会レスポンス型
 */
type FincodeSessionStatusResponse = {
  id: string;
  status: string;
  order_id?: string;
  access_id?: string;
  pay_type?: string;
  amount?: number;
  error_code?: string;
  paid?: string;
};

/**
 * GMO Fincode 決済プロバイダ
 * リダイレクト型決済を採用し、複数の支払い方法に対応
 */
export class FincodePaymentProvider implements PaymentProvider {
  readonly providerName = "fincode";

  private getConfig(): FincodeConfig {
    const apiUrl = process.env.FINCODE_API_URL;
    const secretKey = process.env.FINCODE_SECRET_KEY;
    const webhookSignature = process.env.FINCODE_WEBHOOK_SIGNATURE;

    if (!apiUrl) {
      throw new Error("FINCODE_API_URL is not configured");
    }
    if (!secretKey) {
      throw new Error("FINCODE_SECRET_KEY is not configured");
    }
    if (!webhookSignature) {
      throw new Error("FINCODE_WEBHOOK_SIGNATURE is not configured");
    }

    return { apiUrl, secretKey, webhookSignature };
  }

  /**
   * 決済セッションを作成
   * Fincode のリダイレクト型決済用セッションを生成
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSession> {
    const config = this.getConfig();

    const requestBody = {
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      order_id: params.purchaseRequestId,
      // お支払い画面案内メール送信フラグ: 0 = 送信しない
      send_mail_flag: "0",
      transaction: {
        // 対応する支払い方法（設定で有効なもの全て）
        pay_type: ["Card", "Konbini", "Paypay", "Virtualaccount"],
        amount: String(params.amount),
      },
      card: {
        job_code: "CAPTURE", // 即時売上
        tds_type: "2", // 3Dセキュア2.0
        tds2_type: "2",
      },
      konbini: {
        payment_term_day: "3", // 支払い期限: 3日
      },
      virtualaccount: {
        payment_term_day: "7", // 支払い期限: 7日
      },
      // メタデータを追加（照合用）
      ...(params.metadata && { metadata: params.metadata }),
    };

    const response = await fetch(`${config.apiUrl}/v1/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Fincode] Session creation failed:", errorText);
      throw new Error(`Fincode API error: ${response.status}`);
    }

    const data: FincodeSessionResponse = await response.json();

    return {
      sessionId: data.id,
      redirectUrl: data.link_url,
      expiresAt: data.expire ? new Date(data.expire) : undefined,
    };
  }

  /**
   * Webhookペイロードを検証・パース
   */
  async verifyWebhook(request: Request): Promise<PaymentResult> {
    try {
      const body: FincodeWebhookPayload = await request.json();

      const eventType = body.event_type;
      const isSuccess = isSuccessEvent(eventType);

      // order_id または session_id を取得（order_id優先）
      const sessionId = body.data.order_id || body.data.session_id || "";

      if (isSuccess) {
        return {
          success: true,
          sessionId,
          transactionId: body.data.access_id || body.data.transaction_id,
          paymentMethod: extractPaymentMethod(eventType),
          paidAt: body.data.updated ? new Date(body.data.updated) : new Date(),
          rawResponse: body,
        };
      }

      // 失敗・キャンセル・期限切れ
      const errorCode = mapProviderError(body.data.error_code, FINCODE_ERROR_MAP);

      return {
        success: false,
        sessionId,
        errorCode,
        errorMessage: this.getErrorMessageFromEvent(eventType),
        rawResponse: body,
      };
    } catch (error) {
      console.error("[Fincode] Webhook parsing error:", error);
      return {
        success: false,
        sessionId: "",
        errorCode: PAYMENT_ERROR_CODES.INVALID_REQUEST,
        errorMessage: "Webhookペイロードの解析に失敗しました",
      };
    }
  }

  /**
   * Webhook署名を検証
   * Fincodeは登録時に設定した固定値でシンプルに検証
   */
  async verifyWebhookSignature(_request: Request, signature: string): Promise<boolean> {
    const config = this.getConfig();
    return signature === config.webhookSignature;
  }

  /**
   * 決済ステータスを照会
   * Webhook未着時のフォールバック用
   */
  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    const config = this.getConfig();

    try {
      const response = await fetch(`${config.apiUrl}/v1/sessions/${sessionId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            status: "expired",
            sessionId,
            errorCode: PAYMENT_ERROR_CODES.PAYMENT_EXPIRED,
            errorMessage: "セッションが見つかりません",
          };
        }
        throw new Error(`Fincode API error: ${response.status}`);
      }

      const data: FincodeSessionStatusResponse = await response.json();

      return {
        status: this.mapFincodeStatus(data.status),
        sessionId,
        transactionId: data.access_id,
        paidAt: data.paid ? new Date(data.paid) : undefined,
        errorCode: data.error_code
          ? mapProviderError(data.error_code, FINCODE_ERROR_MAP)
          : undefined,
      };
    } catch (error) {
      console.error("[Fincode] Status check error:", error);
      return {
        status: "failed",
        sessionId,
        errorCode: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
        errorMessage: "ステータス照会に失敗しました",
      };
    }
  }

  /**
   * Fincodeのステータスを汎用ステータスにマッピング
   */
  private mapFincodeStatus(
    fincodeStatus: string
  ): PaymentStatusResult["status"] {
    switch (fincodeStatus) {
      case "UNPROCESSED":
      case "AWAITING_CUSTOMER_PAYMENT":
        return "pending";
      case "PROCESSING":
      case "AWAITING_3DS":
        return "processing";
      case "CAPTURED":
      case "AUTHORIZED":
        return "completed";
      case "CANCELED":
      case "FAILED":
        return "failed";
      case "EXPIRED":
        return "expired";
      default:
        return "pending";
    }
  }

  /**
   * イベントタイプからエラーメッセージを取得
   */
  private getErrorMessageFromEvent(eventType: string): string {
    if (eventType.includes("expired")) {
      return "支払い期限が切れました";
    }
    if (eventType.includes("cancelled")) {
      return "決済がキャンセルされました";
    }
    if (eventType.includes("failed")) {
      return "決済に失敗しました";
    }
    return "決済エラーが発生しました";
  }
}

/**
 * Fincodeプロバイダのシングルトンインスタンス
 */
export const fincodePaymentProvider = new FincodePaymentProvider();
