// src/features/core/purchaseRequest/services/server/payment/square/squareProvider.ts
// Square 決済プロバイダ実装（Checkout API リダイレクト型決済）

import * as crypto from "crypto";
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
  SQUARE_ERROR_MAP,
  isSuccessPaymentStatus,
  extractPaymentMethod,
} from "./errorMapping";

/**
 * Square 環境設定
 */
type SquareConfig = {
  accessToken: string;
  locationId: string;
  signatureKey: string;
  notificationUrl: string;
  environment: "sandbox" | "production";
};

/**
 * Square CreatePaymentLink リクエスト型
 */
type SquareCreatePaymentLinkRequest = {
  idempotency_key: string;
  quick_pay: {
    name: string;
    price_money: {
      amount: number; // 最小通貨単位（円の場合はそのまま）
      currency: string;
    };
    location_id: string;
  };
  checkout_options?: {
    redirect_url?: string;
  };
  pre_populated_data?: {
    buyer_email?: string;
    buyer_phone_number?: string;
  };
  payment_note?: string;
};

/**
 * Square CreatePaymentLink レスポンス型
 */
type SquarePaymentLinkResponse = {
  payment_link?: {
    id: string;
    version: number;
    order_id: string;
    url: string;
    long_url: string;
    created_at: string;
  };
  related_resources?: {
    orders?: Array<{ id: string }>;
  };
  errors?: Array<{
    category: string;
    code: string;
    detail: string;
    field?: string;
  }>;
};

/**
 * Square Webhook ペイロード型（payment.updated）
 */
type SquareWebhookPayload = {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object: {
      payment?: SquarePayment;
    };
  };
};

/**
 * Square Payment オブジェクト型
 */
type SquarePayment = {
  id: string;
  created_at: string;
  updated_at: string;
  amount_money: {
    amount: number;
    currency: string;
  };
  status: string;
  source_type?: string;
  order_id?: string;
  location_id: string;
  card_details?: {
    status: string;
    card?: {
      card_brand?: string;
      last_4?: string;
    };
    entry_method?: string;
    cvv_status?: string;
    avs_status?: string;
  };
  receipt_number?: string;
  receipt_url?: string;
  note?: string;
};

/**
 * Square 決済プロバイダ
 * Checkout API（Payment Link）を使用したリダイレクト型決済
 */
export class SquarePaymentProvider implements PaymentProvider {
  readonly providerName = "square";

  private getConfig(): SquareConfig {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const signatureKey = process.env.SQUARE_SIGNATURE_KEY;
    const notificationUrl = process.env.SQUARE_NOTIFICATION_URL;
    const environment = process.env.SQUARE_ENVIRONMENT as "sandbox" | "production" | undefined;

    if (!accessToken) {
      throw new Error("SQUARE_ACCESS_TOKEN is not configured");
    }
    if (!locationId) {
      throw new Error("SQUARE_LOCATION_ID is not configured");
    }
    if (!signatureKey) {
      throw new Error("SQUARE_SIGNATURE_KEY is not configured");
    }
    if (!notificationUrl) {
      throw new Error("SQUARE_NOTIFICATION_URL is not configured");
    }

    return {
      accessToken,
      locationId,
      signatureKey,
      notificationUrl,
      environment: environment || "sandbox",
    };
  }

  /**
   * Square APIのベースURLを取得
   */
  private getApiBaseUrl(): string {
    const config = this.getConfig();
    return config.environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  }

  /**
   * 決済セッションを作成
   * Square Checkout APIのPayment Linkを生成
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSession> {
    const config = this.getConfig();
    const baseUrl = this.getApiBaseUrl();

    // idempotency_keyとしてpurchaseRequestIdを使用
    const idempotencyKey = params.purchaseRequestId;

    const requestBody: SquareCreatePaymentLinkRequest = {
      idempotency_key: idempotencyKey,
      quick_pay: {
        name: params.metadata?.itemName || "購入",
        price_money: {
          amount: params.amount, // 日本円はそのまま（最小通貨単位）
          currency: "JPY",
        },
        location_id: config.locationId,
      },
      checkout_options: {
        redirect_url: params.successUrl,
      },
      // 購入者情報を事前入力
      ...((params.buyerEmail || params.buyerPhoneNumber) && {
        pre_populated_data: {
          ...(params.buyerEmail && { buyer_email: params.buyerEmail }),
          ...(params.buyerPhoneNumber && { buyer_phone_number: params.buyerPhoneNumber }),
        },
      }),
      // 購入リクエストIDをメモに保存（Webhook照合用）
      payment_note: params.purchaseRequestId,
    };

    console.log("[Square] Creating payment link:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Square-Version": "2025-01-23",
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data: SquarePaymentLinkResponse = await response.json();

    if (!response.ok || data.errors) {
      console.error("[Square] Payment link creation failed:", JSON.stringify(data.errors, null, 2));
      const errorDetail = data.errors?.[0]?.detail || "Unknown error";
      throw new Error(`Square API error: ${errorDetail}`);
    }

    if (!data.payment_link) {
      throw new Error("Square API error: payment_link not returned");
    }

    return {
      sessionId: data.payment_link.id,
      redirectUrl: data.payment_link.url,
      // Square Payment Linkには明示的な有効期限がないため undefined
      expiresAt: undefined,
    };
  }

  /**
   * Webhookペイロードを検証・パース
   */
  async verifyWebhook(request: Request): Promise<PaymentResult> {
    try {
      const body: SquareWebhookPayload = await request.json();

      console.log("[Square] Webhook payload:", JSON.stringify(body, null, 2));

      const eventType = body.type;
      const payment = body.data.object.payment;

      if (!payment) {
        console.log("[Square] No payment object in webhook, skipping");
        return {
          success: false,
          sessionId: "",
          errorCode: PAYMENT_ERROR_CODES.INVALID_REQUEST,
          errorMessage: "Webhookにpaymentオブジェクトがありません",
        };
      }

      // payment.noteに保存したpurchaseRequestIdを取得
      const sessionId = payment.note || payment.order_id || "";
      const isSuccess = isSuccessPaymentStatus(payment.status);

      if (isSuccess) {
        return {
          success: true,
          sessionId,
          transactionId: payment.id,
          paymentMethod: extractPaymentMethod(payment.source_type),
          paidAt: new Date(payment.updated_at || payment.created_at),
          rawResponse: body,
        };
      }

      // 失敗・キャンセル
      const cardStatus = payment.card_details?.status;
      const errorCode = cardStatus
        ? mapProviderError(cardStatus, SQUARE_ERROR_MAP)
        : PAYMENT_ERROR_CODES.PAYMENT_FAILED;

      return {
        success: false,
        sessionId,
        errorCode,
        errorMessage: this.getErrorMessageFromStatus(payment.status),
        rawResponse: body,
      };
    } catch (error) {
      console.error("[Square] Webhook parsing error:", error);
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
   * Square HMAC-SHA256署名検証
   */
  async verifyWebhookSignature(request: Request, signature: string): Promise<boolean> {
    const config = this.getConfig();

    try {
      // リクエストボディを取得
      const body = await request.text();

      // 署名を生成: notificationUrl + body をsignatureKeyでHMAC-SHA256
      const stringToSign = config.notificationUrl + body;
      const expectedSignature = crypto
        .createHmac("sha256", config.signatureKey)
        .update(stringToSign)
        .digest("base64");

      // 定数時間比較（タイミング攻撃防止）
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (signatureBuffer.length !== expectedBuffer.length) {
        console.error("[Square] Signature length mismatch");
        return false;
      }

      const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        console.error("[Square] Signature verification failed");
      }

      return isValid;
    } catch (error) {
      console.error("[Square] Signature verification error:", error);
      return false;
    }
  }

  /**
   * 決済ステータスを照会
   * Payment Link IDからOrder情報を取得し、関連するPaymentのステータスを確認
   */
  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    const config = this.getConfig();
    const baseUrl = this.getApiBaseUrl();

    try {
      // 1. Payment Link から Order ID を取得
      const linkResponse = await fetch(`${baseUrl}/v2/online-checkout/payment-links/${sessionId}`, {
        method: "GET",
        headers: {
          "Square-Version": "2025-01-23",
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

      if (!linkResponse.ok) {
        console.error("[Square] Failed to fetch payment link:", linkResponse.status);
        return { status: "pending", sessionId };
      }

      const linkData = await linkResponse.json();
      const orderId = linkData.payment_link?.order_id;

      if (!orderId) {
        console.log("[Square] No order_id in payment link");
        return { status: "pending", sessionId };
      }

      // 2. Order から Payment IDs を取得
      const orderResponse = await fetch(`${baseUrl}/v2/orders/${orderId}`, {
        method: "GET",
        headers: {
          "Square-Version": "2025-01-23",
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

      if (!orderResponse.ok) {
        console.error("[Square] Failed to fetch order:", orderResponse.status);
        return { status: "pending", sessionId };
      }

      const orderData = await orderResponse.json();
      const tenders = orderData.order?.tenders;

      if (!tenders || tenders.length === 0) {
        // まだ支払いが行われていない
        console.log("[Square] No tenders in order - payment not completed yet");
        return { status: "pending", sessionId };
      }

      // 3. 最初のtenderのpayment_idでPaymentステータスを確認
      const paymentId = tenders[0].payment_id;
      if (!paymentId) {
        console.log("[Square] No payment_id in tender");
        return { status: "pending", sessionId };
      }

      const paymentResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}`, {
        method: "GET",
        headers: {
          "Square-Version": "2025-01-23",
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

      if (!paymentResponse.ok) {
        console.error("[Square] Failed to fetch payment:", paymentResponse.status);
        return { status: "pending", sessionId };
      }

      const paymentData = await paymentResponse.json();
      const payment = paymentData.payment;

      if (!payment) {
        return { status: "pending", sessionId };
      }

      console.log("[Square] Payment status:", payment.status);

      // 4. ステータスをマッピング
      if (isSuccessPaymentStatus(payment.status)) {
        return {
          status: "completed",
          sessionId,
          transactionId: payment.id,
          paidAt: new Date(payment.updated_at || payment.created_at),
        };
      }

      if (payment.status === "CANCELED") {
        return {
          status: "failed",
          sessionId,
          errorCode: PAYMENT_ERROR_CODES.PAYMENT_CANCELLED,
          errorMessage: "決済がキャンセルされました",
        };
      }

      if (payment.status === "FAILED") {
        return {
          status: "failed",
          sessionId,
          errorCode: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
          errorMessage: "決済に失敗しました",
        };
      }

      // PENDING, APPROVED など進行中のステータス
      return { status: "pending", sessionId };
    } catch (error) {
      console.error("[Square] getPaymentStatus error:", error);
      return { status: "pending", sessionId };
    }
  }

  /**
   * ステータスからエラーメッセージを取得
   */
  private getErrorMessageFromStatus(status: string): string {
    switch (status) {
      case "CANCELED":
        return "決済がキャンセルされました";
      case "FAILED":
        return "決済に失敗しました";
      default:
        return "決済エラーが発生しました";
    }
  }
}

/**
 * Squareプロバイダのシングルトンインスタンス
 */
export const squarePaymentProvider = new SquarePaymentProvider();
