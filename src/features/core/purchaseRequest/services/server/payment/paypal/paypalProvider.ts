// src/features/core/purchaseRequest/services/server/payment/paypal/paypalProvider.ts
//
// PayPal 決済プロバイダ実装（client_sdk 起動方式 / PayPal JS SDK ボタン）
//
// 設計の要点:
// - createSession で **サーバー側に Orders v2 の Order を作成**し、order.id を返す。
//   Paidy が「クライアント SDK 内で payment を生成 → 後から payment_id を確定 API で記録」
//   する方式だったのに対し、PayPal は order_id が createSession 時点で確定するため、
//   そのまま PaymentSession.sessionId として返し initiatePurchase が payment_session_id に保存する。
//   → Webhook 照合（findByWebhookIdentifier の payment_session_id 一致）が createSession 時点で成立する。
// - createSession は LaunchInstruction { type: "client_sdk", sdkName: "paypal", config } を返す。
//   クライアント側の sdkLaunchers["paypal"] が config.clientId で JS SDK を読み込み、
//   PayPal ボタンを描画する。createOrder コールバックは config.orderId をそのまま返すだけ。
// - 確定（capture）はクライアントの onApprove 後に確定 API
//   (/api/wallet/purchase/[id]/paypal/confirm) → confirmPayPalPayment が実行する。
// - PayPal Webhook は署名検証機構（verify-webhook-signature API）を持つため、
//   verifyWebhookSignature を実装する。検証通過後の verifyWebhook はペイロードを信頼してよい。
// - JPY はゼロ小数通貨。amount.value は小数なしの整数文字列で送る必要がある。

import type {
  CreatePaymentSessionParams,
  PaymentProvider,
  PaymentResult,
  PaymentSession,
  PaymentStatusResult,
} from "@/features/core/purchaseRequest/types/payment";
import { PAYMENT_ERROR_CODES } from "@/features/core/purchaseRequest/constants/errorCodes";
import { paymentConfig } from "@/config/app/payment.config";
import {
  getPayPalConfig,
  getPayPalWebhookId,
  payPalFetch,
  type PayPalConfig,
} from "./payPalClient";
import {
  PAYPAL_CAPTURE_STATUS,
  PAYPAL_ORDER_STATUS,
  PAYPAL_VERIFICATION_STATUS,
  PAYPAL_WEBHOOK_EVENTS,
} from "./errorMapping";

/** PayPal の決済通貨。本テンプレートは JPY 固定（ゼロ小数通貨）。 */
const PAYPAL_CURRENCY = "JPY" as const;

/**
 * PayPal Order オブジェクト（GET /v2/checkout/orders/{id} / capture レスポンス、使用フィールドのみ抜粋）
 * 確定サービス (confirmPayPalPayment) からも参照されるため export する。
 */
export type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: { currency_code: string; value: string };
      }>;
    };
  }>;
};

/**
 * PayPal Webhook ペイロード（使用フィールドのみ抜粋）
 *
 * capture イベントの resource は capture オブジェクト。order_id は
 * resource.supplementary_data.related_ids.order_id に入る。
 */
type PayPalWebhookPayload = {
  id?: string;
  event_type: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    supplementary_data?: {
      related_ids?: { order_id?: string };
    };
  };
};

/**
 * 金額文字列（"1000"）を整数の円に変換する。
 * JPY はゼロ小数通貨のため小数は出ない想定だが、防御的に四捨五入する。
 */
function parseAmountValue(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

/**
 * PayPal 決済プロバイダ
 */
export class PayPalPaymentProvider implements PaymentProvider {
  readonly providerName = "paypal";

  private getConfig(): PayPalConfig {
    return getPayPalConfig();
  }

  /**
   * 決済セッションを作成（= PayPal Order を作成）
   *
   * Orders v2 API で intent=CAPTURE の Order を作成し、その id を sessionId として返す。
   * custom_id に purchaseRequestId を入れることで、Webhook 側でも custom_id から
   * purchase_request を逆引きできる（order_id ベースのフォールバック）。
   *
   * config に含めるのは公開情報（clientId / env / orderId / amount / currency）のみ。
   * clientSecret 等のサーバー秘密は絶対に含めない。
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSession> {
    const config = this.getConfig();

    if (paymentConfig.debugLog) {
      console.log(
        `[PayPal] createSession: purchaseRequestId=${params.purchaseRequestId}, amount=${params.amount}`,
      );
    }

    const itemTitle =
      (typeof params.metadata?.itemName === "string" && params.metadata.itemName) ||
      "購入";

    // JPY はゼロ小数通貨。value は小数なしの整数文字列にする。
    const amountValue = String(Math.round(params.amount));

    const orderBody = {
      intent: "CAPTURE",
      purchase_units: [
        {
          // Webhook の order_id 逆引きが取れなかった場合のフォールバック用に
          // custom_id へ purchaseRequestId を入れる（UUID なので findByWebhookIdentifier が id 一致で引ける）。
          reference_id: params.purchaseRequestId,
          custom_id: params.purchaseRequestId,
          description: itemTitle.slice(0, 127),
          amount: {
            currency_code: PAYPAL_CURRENCY,
            value: amountValue,
          },
        },
      ],
    };

    const response = await payPalFetch(config, "/v2/checkout/orders", {
      method: "POST",
      headers: {
        // 冪等キー: 同一 purchase_request での二重作成（リトライ）を PayPal 側で抑止する。
        "PayPal-Request-Id": `order_${params.purchaseRequestId}`,
      },
      body: JSON.stringify(orderBody),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[PayPal] createOrder failed: status=${response.status}, body=${body}`,
      );
      throw new Error(`[PayPal] Order の作成に失敗しました（status=${response.status}）`);
    }

    const order = (await response.json()) as PayPalOrder;

    return {
      sessionId: order.id,
      instruction: {
        type: "client_sdk",
        sdkName: this.providerName,
        config: {
          clientId: config.clientId,
          env: config.env,
          orderId: order.id,
          amount: params.amount,
          currency: PAYPAL_CURRENCY,
          purchaseRequestId: params.purchaseRequestId,
        },
      },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  /**
   * Webhook ペイロードを検証・パース
   *
   * verifyWebhookSignature を通過した後に呼ばれるため、ペイロードは信頼してよい。
   * event_type で分岐し、capture 完了/拒否を PaymentResult に変換する。
   *
   * sessionId（= 照合キー）は order_id を優先で返す（payment_session_id に保存済み）。
   * 取得できない場合は custom_id（= purchaseRequestId, UUID）をフォールバックで返す
   * （findByWebhookIdentifier が UUID なら id 一致で引ける）。
   */
  async verifyWebhook(request: Request): Promise<PaymentResult> {
    try {
      const payload = (await request.json()) as PayPalWebhookPayload;

      if (paymentConfig.debugLog) {
        console.log("[PayPal] Webhook payload:", JSON.stringify(payload, null, 2));
      } else {
        console.log(
          `[PayPal] Webhook received: event_type=${payload.event_type}, resource_id=${payload.resource?.id ?? "-"}`,
        );
      }

      const resource = payload.resource;
      const orderId =
        resource?.supplementary_data?.related_ids?.order_id ?? resource?.custom_id;
      const sessionId = orderId ?? "";

      switch (payload.event_type) {
        case PAYPAL_WEBHOOK_EVENTS.CAPTURE_COMPLETED: {
          return {
            success: true,
            status: "completed",
            sessionId,
            transactionId: resource?.id,
            paymentMethod: "paypal",
            paidAmount: parseAmountValue(resource?.amount?.value),
            rawResponse: payload,
          };
        }

        case PAYPAL_WEBHOOK_EVENTS.CAPTURE_DENIED: {
          return {
            success: false,
            status: "failed",
            sessionId,
            transactionId: resource?.id,
            errorCode: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
            errorMessage: "PayPal が決済を拒否しました",
            rawResponse: payload,
          };
        }

        // 承認のみ（capture 前）・保留・返金は確定状態を変えないため pending。
        case PAYPAL_WEBHOOK_EVENTS.ORDER_APPROVED:
        case PAYPAL_WEBHOOK_EVENTS.CAPTURE_PENDING:
        case PAYPAL_WEBHOOK_EVENTS.CAPTURE_REFUNDED: {
          return { success: false, status: "pending", sessionId };
        }

        default: {
          console.log(`[PayPal] Unhandled webhook event_type: ${payload.event_type}`);
          return { success: false, status: "pending", sessionId };
        }
      }
    } catch (error) {
      console.error("[PayPal] Webhook parsing error:", error);
      return {
        success: false,
        sessionId: "",
        errorCode: PAYMENT_ERROR_CODES.INVALID_REQUEST,
        errorMessage: "Webhookペイロードの解析に失敗しました",
      };
    }
  }

  /**
   * Webhook 署名を検証
   *
   * PayPal の verify-webhook-signature API にトランスミッション系ヘッダーと
   * 生ペイロードを渡して検証する。verification_status === "SUCCESS" のみ有効。
   *
   * 引数 request は webhook ルートが clone 済みのものを渡す（本文未読）。
   * signature は "Paypal-Transmission-Sig" ヘッダーの値（payment.config の signatureHeaders.paypal）。
   */
  async verifyWebhookSignature(request: Request, signature: string): Promise<boolean> {
    try {
      const config = this.getConfig();
      const webhookId = getPayPalWebhookId();

      const transmissionId = request.headers.get("paypal-transmission-id");
      const transmissionTime = request.headers.get("paypal-transmission-time");
      const certUrl = request.headers.get("paypal-cert-url");
      const authAlgo = request.headers.get("paypal-auth-algo");

      if (!transmissionId || !transmissionTime || !certUrl || !authAlgo) {
        console.warn("[PayPal] Webhook 署名検証に必要なヘッダーが不足しています");
        return false;
      }

      // webhook_event は生ペイロードを JSON として渡す（PayPal 側で再シリアライズ照合される）。
      const rawBody = await request.text();
      const webhookEvent = JSON.parse(rawBody);

      const verifyBody = {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: signature,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      };

      const response = await payPalFetch(
        config,
        "/v1/notifications/verify-webhook-signature",
        {
          method: "POST",
          body: JSON.stringify(verifyBody),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `[PayPal] verify-webhook-signature failed: status=${response.status}, body=${body}`,
        );
        return false;
      }

      const result = (await response.json()) as { verification_status?: string };
      return result.verification_status === PAYPAL_VERIFICATION_STATUS.SUCCESS;
    } catch (error) {
      console.error("[PayPal] verifyWebhookSignature error:", error);
      return false;
    }
  }

  /**
   * 決済ステータスを照会（Webhook 未着時のフォールバック）
   *
   * sessionId は PayPal の order_id（payment_session_id に保存済み）が渡る前提。
   */
  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    try {
      const order = await this.fetchOrder(sessionId);
      if (!order) {
        return { status: "pending", sessionId };
      }

      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];

      switch (order.status) {
        case PAYPAL_ORDER_STATUS.COMPLETED:
          return {
            status: "completed",
            sessionId,
            transactionId: capture?.id ?? order.id,
          };

        case PAYPAL_ORDER_STATUS.APPROVED:
          return { status: "processing", sessionId, transactionId: order.id };

        case PAYPAL_ORDER_STATUS.VOIDED:
          return {
            status: "failed",
            sessionId,
            transactionId: order.id,
            errorCode: PAYMENT_ERROR_CODES.PAYMENT_CANCELLED,
            errorMessage: "決済が無効化されました",
          };

        default:
          return { status: "pending", sessionId };
      }
    } catch (error) {
      console.error("[PayPal] getPaymentStatus error:", error);
      return { status: "pending", sessionId };
    }
  }

  /**
   * GET /v2/checkout/orders/{id} で Order を取得する。
   * verifyWebhook の補助、getPaymentStatus、確定 API (confirmPayPalPayment) から共有される。
   */
  async fetchOrder(orderId: string): Promise<PayPalOrder | null> {
    const config = this.getConfig();

    try {
      const response = await payPalFetch(
        config,
        `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
        { method: "GET" },
      );

      if (!response.ok) {
        console.error(
          `[PayPal] fetchOrder failed: id=${orderId}, status=${response.status}`,
        );
        return null;
      }

      return (await response.json()) as PayPalOrder;
    } catch (error) {
      console.error(`[PayPal] fetchOrder error: id=${orderId}`, error);
      return null;
    }
  }

  /**
   * Order を capture（決済確定）する。確定サービス (confirmPayPalPayment) から呼ばれる。
   *
   * 既に capture 済み（ORDER_ALREADY_CAPTURED, 422）の場合は no-op として最新の Order を
   * fetch して返す（Webhook 後着 → サーバー再起動等のレアケースでの冪等対応）。
   * PayPal-Request-Id を付与し、ネットワークリトライでの二重 capture も抑止する。
   */
  async captureOrder(orderId: string): Promise<PayPalOrder | null> {
    const config = this.getConfig();

    try {
      const response = await payPalFetch(
        config,
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {
          method: "POST",
          headers: {
            "PayPal-Request-Id": `capture_${orderId}`,
          },
          // capture はボディ不要だが、Content-Type 付き空ボディで送る。
          body: JSON.stringify({}),
        },
      );

      if (response.ok) {
        return (await response.json()) as PayPalOrder;
      }

      // 422 で ORDER_ALREADY_CAPTURED の場合は既に確定済み。最新 Order を取得して返す。
      if (response.status === 422) {
        const body = await response.text();
        if (body.includes("ORDER_ALREADY_CAPTURED")) {
          console.warn(`[PayPal] Order は既に capture 済みです: id=${orderId}`);
          return this.fetchOrder(orderId);
        }
        console.error(
          `[PayPal] captureOrder unprocessable: id=${orderId}, body=${body}`,
        );
        return null;
      }

      const body = await response.text();
      console.error(
        `[PayPal] captureOrder failed: id=${orderId}, status=${response.status}, body=${body}`,
      );
      return null;
    } catch (error) {
      console.error(`[PayPal] captureOrder error: id=${orderId}`, error);
      return null;
    }
  }
}

/**
 * PayPal プロバイダのシングルトンインスタンス
 */
export const paypalPaymentProvider = new PayPalPaymentProvider();
