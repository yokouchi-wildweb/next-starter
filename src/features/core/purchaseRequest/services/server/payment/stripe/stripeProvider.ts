// src/features/core/purchaseRequest/services/server/payment/stripe/stripeProvider.ts
// Stripe 決済プロバイダ実装（Stripe Checkout リダイレクト型決済）

import * as crypto from "crypto";
import type {
  PaymentProvider,
  CreatePaymentSessionParams,
  PaymentSession,
  PaymentResult,
  PaymentStatusResult,
} from "@/features/core/purchaseRequest/types/payment";
import { PAYMENT_ERROR_CODES } from "@/features/core/purchaseRequest/constants/errorCodes";
import {
  STRIPE_WEBHOOK_EVENTS,
  STRIPE_SESSION_STATUS,
  STRIPE_PAYMENT_STATUS,
  extractPaymentMethod,
} from "./errorMapping";
import { paymentConfig } from "@/config/app/payment.config";

/**
 * Stripe 環境設定
 */
type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
};

/**
 * Stripe Checkout Session オブジェクト（使用フィールドのみ抜粋）
 * @see https://docs.stripe.com/api/checkout/sessions/object
 */
type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  client_reference_id?: string | null;
  customer_email?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | null;
  payment_method_types?: string[];
  expires_at?: number;
  created?: number;
  url?: string | null;
  metadata?: Record<string, string>;
};

/**
 * Stripe Webhook イベント（Checkout Session 用）
 * @see https://docs.stripe.com/api/events/object
 */
type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number;
  data: {
    object: StripeCheckoutSession;
  };
};

/**
 * Stripe API エラーレスポンス
 */
type StripeApiErrorResponse = {
  error?: {
    type?: string;
    code?: string;
    message?: string;
    param?: string;
  };
};

/**
 * Stripe 決済プロバイダ
 * Stripe Checkout を使用したリダイレクト型決済
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly providerName = "stripe";

  private readonly apiBaseUrl = "https://api.stripe.com";

  /**
   * Webhook 署名タイムスタンプの許容秒数（リプレイ攻撃防止、Stripe 推奨値）
   */
  private readonly signatureTolerance = 5 * 60;

  /**
   * Checkout Session の有効期限（秒）。既存の PurchaseRequest expires_at と揃える
   */
  private readonly sessionExpiresInSec = 30 * 60;

  private getConfig(): StripeConfig {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    return { secretKey, webhookSecret };
  }

  /**
   * Stripe API 仕様の application/x-www-form-urlencoded 形式にエンコード
   * ネストオブジェクトはブラケット記法（line_items[0][price_data][currency]=jpy）
   */
  private encodeFormBody(
    obj: Record<string, unknown>,
    prefix = "",
  ): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (Array.isArray(value)) {
        value.forEach((v, i) => {
          const arrayKey = `${fullKey}[${i}]`;
          if (v !== null && typeof v === "object") {
            const nested = this.encodeFormBody(
              v as Record<string, unknown>,
              arrayKey,
            );
            if (nested) parts.push(nested);
          } else {
            parts.push(
              `${encodeURIComponent(arrayKey)}=${encodeURIComponent(String(v))}`,
            );
          }
        });
      } else if (typeof value === "object") {
        const nested = this.encodeFormBody(
          value as Record<string, unknown>,
          fullKey,
        );
        if (nested) parts.push(nested);
      } else {
        parts.push(
          `${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`,
        );
      }
    }
    return parts.join("&");
  }

  /**
   * 決済セッションを作成
   * Stripe Checkout Session を生成し、リダイレクト先 URL を返す
   */
  async createSession(
    params: CreatePaymentSessionParams,
  ): Promise<PaymentSession> {
    const config = this.getConfig();

    // Stripe metadata は string 値のみ受け付ける
    const metadata: Record<string, string> = {
      purchase_request_id: params.purchaseRequestId,
      user_id: params.userId,
    };
    if (params.metadata) {
      for (const [k, v] of Object.entries(params.metadata)) {
        if (typeof v === "string") metadata[k] = v;
      }
    }

    const body: Record<string, unknown> = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: params.metadata?.itemName || "購入",
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.purchaseRequestId,
      expires_at: Math.floor(Date.now() / 1000) + this.sessionExpiresInSec,
      metadata,
    };

    if (params.buyerEmail) {
      body.customer_email = params.buyerEmail;
    }

    const formBody = this.encodeFormBody(body);

    if (paymentConfig.debugLog) {
      console.log("[Stripe] Creating checkout session:", formBody);
    } else {
      console.log(
        `[Stripe] Creating checkout session: purchaseRequestId=${params.purchaseRequestId}, amount=${params.amount}`,
      );
    }

    const response = await fetch(`${this.apiBaseUrl}/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // Idempotency-Key: 同一 purchaseRequestId に対する二重送信を防ぐ
        "Idempotency-Key": params.purchaseRequestId,
      },
      body: formBody,
    });

    const data = (await response.json()) as StripeCheckoutSession &
      StripeApiErrorResponse;

    if (!response.ok || data.error) {
      console.error(
        "[Stripe] Checkout session creation failed:",
        JSON.stringify(data, null, 2),
      );
      const message = data.error?.message ?? "Unknown error";
      throw new Error(`Stripe API error: ${message}`);
    }

    if (!data.url || !data.id) {
      throw new Error("Stripe API error: checkout session URL not returned");
    }

    return {
      sessionId: data.id,
      redirectUrl: data.url,
      expiresAt: data.expires_at
        ? new Date(data.expires_at * 1000)
        : undefined,
    };
  }

  /**
   * Webhook ペイロードを検証・パース
   * checkout.session.* イベントのみ処理、他イベントは pending で無視
   */
  async verifyWebhook(request: Request): Promise<PaymentResult> {
    try {
      const event = (await request.json()) as StripeWebhookEvent;

      if (paymentConfig.debugLog) {
        console.log("[Stripe] Webhook event:", JSON.stringify(event, null, 2));
      } else {
        console.log(
          `[Stripe] Webhook received: type=${event.type}, id=${event.id}`,
        );
      }

      const session = event.data?.object;

      if (!session || session.object !== "checkout.session") {
        console.log(
          `[Stripe] Non-checkout.session event skipped: type=${event.type}`,
        );
        return {
          success: false,
          sessionId: "",
          errorCode: PAYMENT_ERROR_CODES.INVALID_REQUEST,
          errorMessage: "Webhookにcheckout.sessionオブジェクトがありません",
        };
      }

      const sessionId = session.id;
      const paidAt = event.created ? new Date(event.created * 1000) : undefined;

      switch (event.type) {
        case STRIPE_WEBHOOK_EVENTS.SESSION_COMPLETED: {
          // 即時決済（カード）なら paid で確定
          if (session.payment_status === STRIPE_PAYMENT_STATUS.PAID) {
            return {
              success: true,
              status: "completed",
              sessionId,
              transactionId: session.payment_intent ?? session.id,
              paymentMethod: extractPaymentMethod(
                session.payment_method_types?.[0],
              ),
              paidAt,
              paidAmount: session.amount_total ?? undefined,
              rawResponse: event,
            };
          }

          // 遅延決済系（コンビニ・銀行振込等）は async_payment_succeeded を待つ
          if (session.payment_status === STRIPE_PAYMENT_STATUS.UNPAID) {
            console.log(
              `[Stripe] Session completed but payment pending (delayed method): sessionId=${sessionId}`,
            );
            return { success: false, status: "pending", sessionId };
          }

          // no_payment_required（金額0など）も完了扱い
          return {
            success: true,
            status: "completed",
            sessionId,
            transactionId: session.payment_intent ?? session.id,
            paidAt,
            paidAmount: session.amount_total ?? 0,
            rawResponse: event,
          };
        }

        case STRIPE_WEBHOOK_EVENTS.SESSION_ASYNC_PAYMENT_SUCCEEDED: {
          return {
            success: true,
            status: "completed",
            sessionId,
            transactionId: session.payment_intent ?? session.id,
            paymentMethod: extractPaymentMethod(
              session.payment_method_types?.[0],
            ),
            paidAt,
            paidAmount: session.amount_total ?? undefined,
            rawResponse: event,
          };
        }

        case STRIPE_WEBHOOK_EVENTS.SESSION_ASYNC_PAYMENT_FAILED: {
          return {
            success: false,
            status: "failed",
            sessionId,
            errorCode: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
            errorMessage: "遅延決済に失敗しました",
            rawResponse: event,
          };
        }

        case STRIPE_WEBHOOK_EVENTS.SESSION_EXPIRED: {
          return {
            success: false,
            status: "failed",
            sessionId,
            errorCode: PAYMENT_ERROR_CODES.PAYMENT_EXPIRED,
            errorMessage: "決済セッションの有効期限が切れました",
            rawResponse: event,
          };
        }

        default: {
          console.log(`[Stripe] Unhandled event type: ${event.type}`);
          return { success: false, status: "pending", sessionId };
        }
      }
    } catch (error) {
      console.error("[Stripe] Webhook parsing error:", error);
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
   * Stripe-Signature ヘッダ: "t=<timestamp>,v1=<sig>[,v0=...]" 形式
   * @see https://docs.stripe.com/webhooks#verify-manually
   */
  async verifyWebhookSignature(
    request: Request,
    signature: string,
  ): Promise<boolean> {
    const config = this.getConfig();

    try {
      const body = await request.text();

      // "t=xxx,v1=yyy,v0=zzz" をパース
      const parts = signature.split(",").reduce<Record<string, string>>(
        (acc, p) => {
          const eqIdx = p.indexOf("=");
          if (eqIdx > 0) {
            const key = p.slice(0, eqIdx).trim();
            const value = p.slice(eqIdx + 1).trim();
            if (key && value) acc[key] = value;
          }
          return acc;
        },
        {},
      );

      const timestamp = parts.t;
      const v1 = parts.v1;

      if (!timestamp || !v1) {
        console.error("[Stripe] Invalid signature format");
        return false;
      }

      // タイムスタンプ許容範囲チェック（リプレイ攻撃防止）
      const tsNum = Number(timestamp);
      const nowSec = Math.floor(Date.now() / 1000);
      if (
        !Number.isFinite(tsNum) ||
        Math.abs(nowSec - tsNum) > this.signatureTolerance
      ) {
        console.error(
          `[Stripe] Signature timestamp outside tolerance: ts=${timestamp}, now=${nowSec}`,
        );
        return false;
      }

      // 署名対象: "<timestamp>.<body>" を HMAC-SHA256(webhookSecret) で hex エンコード
      const payload = `${timestamp}.${body}`;
      const expected = crypto
        .createHmac("sha256", config.webhookSecret)
        .update(payload)
        .digest("hex");

      // 定数時間比較（hex 表現同士）
      const provided = Buffer.from(v1, "hex");
      const computed = Buffer.from(expected, "hex");

      if (provided.length !== computed.length || provided.length === 0) {
        console.error("[Stripe] Signature length mismatch");
        return false;
      }

      const isValid = crypto.timingSafeEqual(provided, computed);
      if (!isValid) {
        console.error("[Stripe] Signature verification failed");
      }

      return isValid;
    } catch (error) {
      console.error("[Stripe] Signature verification error:", error);
      return false;
    }
  }

  /**
   * 決済ステータスを照会（Webhook 未着時のフォールバック）
   */
  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    const config = this.getConfig();

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
          },
        },
      );

      if (!response.ok) {
        console.error(
          `[Stripe] Failed to fetch checkout session: status=${response.status}`,
        );
        return { status: "pending", sessionId };
      }

      const session = (await response.json()) as StripeCheckoutSession;

      if (session.status === STRIPE_SESSION_STATUS.EXPIRED) {
        return {
          status: "failed",
          sessionId,
          errorCode: PAYMENT_ERROR_CODES.PAYMENT_EXPIRED,
          errorMessage: "決済セッションの有効期限が切れました",
        };
      }

      if (session.status === STRIPE_SESSION_STATUS.COMPLETE) {
        // 決済確定（paid / no_payment_required）
        if (
          session.payment_status === STRIPE_PAYMENT_STATUS.PAID ||
          session.payment_status === STRIPE_PAYMENT_STATUS.NO_PAYMENT_REQUIRED
        ) {
          return {
            status: "completed",
            sessionId,
            transactionId: session.payment_intent ?? session.id,
          };
        }
        // セッション自体は complete でも unpaid の場合は遅延決済待ち
        return { status: "pending", sessionId };
      }

      // status === "open" → ユーザーがまだ決済ページ上
      return { status: "pending", sessionId };
    } catch (error) {
      console.error("[Stripe] getPaymentStatus error:", error);
      return { status: "pending", sessionId };
    }
  }
}

/**
 * Stripeプロバイダのシングルトンインスタンス
 */
export const stripePaymentProvider = new StripePaymentProvider();
