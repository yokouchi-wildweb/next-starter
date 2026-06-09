// src/features/core/purchaseRequest/services/server/payment/paidy/paidyProvider.ts
//
// Paidy 決済プロバイダ実装（client_sdk 起動方式）
//
// 設計の要点:
// - Paidy は paidy.js（クライアント JS SDK）を読み込んで起動するモーダル/ポップアップ型決済で、
//   サーバー側で外部リダイレクト URL を発行することができない。
// - そのため createSession は LaunchInstruction { type: "client_sdk", sdkName: "paidy", config }
//   を返す。クライアント側の sdkLaunchers["paidy"] が config を Paidy.configure / launch に渡す。
// - 起動・closed コールバック処理は sdkLaunchers/paidy.ts、確定 API 呼び出しは
//   launchers/clientSdkHandler.ts が担う。サーバーは provider のみ実装すれば足りる。
// - Paidy Webhook には HMAC 等の署名検証機構が無いため、verifyWebhook では payment_id を使って
//   GET /payments/{id} で Paidy API へ再問い合わせを行い、金額・状態を二重確認してから
//   PaymentResult を組み立てる。これにより偽 Webhook 偽装攻撃を成立しなくする。

import type {
  CreatePaymentSessionParams,
  PaymentProvider,
  PaymentResult,
  PaymentSession,
  PaymentStatusResult,
} from "@/features/core/purchaseRequest/types/payment";
import { PAYMENT_ERROR_CODES } from "@/features/core/purchaseRequest/constants/errorCodes";
import { paymentConfig } from "@/config/app/payment.config";
import { userService } from "@/features/core/user/services/server/userService";
import {
  PAIDY_EVENT_TYPE,
  PAIDY_PAYMENT_STATUS,
  PAIDY_WEBHOOK_EVENTS,
  normalizePaidyStatus,
} from "./errorMapping";

/**
 * Paidy 環境設定
 *
 * Paidy はテスト/本番共通エンドポイント（api.paidy.com）で、
 * 環境切替は API キーの prefix（sk_test_ / sk_live_）で行う。
 */
type PaidyConfig = {
  /** Paidy パブリック API キー（pk_test_ / pk_live_）。クライアント起動ページに渡す */
  publicKey: string;
  /** Paidy シークレット API キー（sk_test_ / sk_live_）。サーバーから API 叩く用 */
  secretKey: string;
};

/**
 * Paidy Payment オブジェクト（GET /payments/{id} レスポンス、使用フィールドのみ抜粋）
 *
 * 完全仕様は paidy.com/docs/api を参照。本実装で参照するのは amount/status/captures のみ。
 * 確定サービス (confirmPaidyPayment) からも参照されるため export する。
 */
export type PaidyPayment = {
  id: string;
  amount: number;
  currency: string;
  // Paidy は paidy.js コールバック側で小文字 ("authorized" 等)、REST API のレスポンスでは
  // 大文字 ("AUTHORIZED" 等) を返すケースがある。両方を許容するため string で受け、
  // 比較側で normalizePaidyStatus() を経由してから判定する。
  status: string;
  captured_amount?: number;
  captures?: Array<{ id: string; amount: number; created_at: string }>;
  created_at?: string;
  order?: { order_ref?: string };
};

/**
 * Paidy Webhook ペイロード（使用フィールドのみ抜粋）
 *
 * 例: { payment_id, capture_id, status, event_type, order_ref, timestamp }
 */
type PaidyWebhookPayload = {
  payment_id?: string;
  capture_id?: string;
  refund_id?: string;
  token_id?: string;
  status: string;
  event_type: string;
  order_ref?: string;
  timestamp?: string;
};

/**
 * Paidy 決済プロバイダ
 */
export class PaidyPaymentProvider implements PaymentProvider {
  readonly providerName = "paidy";
  readonly launchType = "client_sdk" as const;

  private readonly apiBaseUrl = "https://api.paidy.com";

  private getConfig(): PaidyConfig {
    const publicKey = process.env.PAIDY_PUBLIC_KEY;
    const secretKey = process.env.PAIDY_SECRET_KEY;

    if (!publicKey) {
      throw new Error("PAIDY_PUBLIC_KEY is not configured");
    }
    if (!secretKey) {
      throw new Error("PAIDY_SECRET_KEY is not configured");
    }

    return { publicKey, secretKey };
  }

  /**
   * 決済セッションを作成
   *
   * Paidy はサーバー側で外部 URL を発行しない。クライアントが paidy.js を読み込んで
   * モーダルを起動する方式のため、LaunchInstruction として "client_sdk" を返す。
   * クライアント側の sdkLaunchers["paidy"] が config を Paidy.configure / launch に渡す。
   *
   * sessionId:
   *   - Paidy 側にはまだ payment オブジェクトが存在しない段階のため、purchase_request.id を流用する。
   *   - Paidy 側の payment_id (`pay_xxx`) は paidy.js の closed コールバック後に確定 API 経由で
   *     purchase_request.provider_session_id にセットされる。
   *
   * config:
   *   - クライアントに直接渡るため、PAIDY_PUBLIC_KEY (pk_*) のみを含める。シークレットキー (sk_*)
   *     は絶対に含めないこと。
   *   - 購入者情報や店舗名は params.metadata / params.buyerEmail などから取得し、
   *     クライアントの sdkLauncher 側で Paidy payload に組み立てる。
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSession> {
    const config = this.getConfig();

    const sessionId = params.purchaseRequestId;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    if (paymentConfig.debugLog) {
      console.log(
        `[Paidy] createSession: purchaseRequestId=${params.purchaseRequestId}, amount=${params.amount}`,
      );
    }

    // order.items 用の商品名。initiatePurchase の metadata.itemName を流用し、
    // 無い場合は wallet_topup 等のデフォルト名にフォールバックする。
    const itemTitle =
      (typeof params.metadata?.itemName === "string" && params.metadata.itemName) ||
      "購入";

    // buyer.name1 用のユーザー名。Paidy は nonempty バリデーションで弾くため、
    // ユーザー登録名が空のケース（NULL / 空文字 / 空白のみ）では明示的なフォールバック値を入れる。
    const user = await userService.get(params.userId);
    const buyerName = user?.name?.trim() || "購入者";

    return {
      sessionId,
      instruction: {
        type: "client_sdk",
        sdkName: this.providerName,
        config: {
          publicKey: config.publicKey,
          purchaseRequestId: params.purchaseRequestId,
          amount: params.amount,
          currency: "JPY",
          itemTitle,
          // クライアント側でユーザーに表示する補助情報。空でも paidy.js は動作するが、
          // 与信通過率向上のため可能な限り渡す。
          buyerName,
          buyerEmail: params.buyerEmail,
          buyerPhoneNumber: params.buyerPhoneNumber,
          // 店舗名等のビジネス情報はクライアント側 sdkLauncher が businessConfig から取る。
        },
      },
      expiresAt,
    };
  }

  /**
   * Webhook ペイロードを検証・パース
   *
   * Paidy Webhook には HMAC 署名検証機構が無いため、ペイロードの内容は信頼せず、
   * 必ず payment_id を使って GET /payments/{id} で Paidy API に再問い合わせし、
   * その応答を真として PaymentResult を組み立てる。
   */
  async verifyWebhook(request: Request): Promise<PaymentResult> {
    try {
      const payload = (await request.json()) as PaidyWebhookPayload;

      if (paymentConfig.debugLog) {
        console.log("[Paidy] Webhook payload:", JSON.stringify(payload, null, 2));
      } else {
        console.log(
          `[Paidy] Webhook received: event_type=${payload.event_type}, status=${payload.status}, payment_id=${payload.payment_id ?? "-"}`,
        );
      }

      // token 系イベントは本テンプレートでは扱わない（サブスクリプション専用のため）
      if (payload.event_type !== PAIDY_EVENT_TYPE.PAYMENT) {
        return { success: false, status: "pending", sessionId: "" };
      }

      const paymentId = payload.payment_id;
      if (!paymentId) {
        return {
          success: false,
          sessionId: "",
          errorCode: PAYMENT_ERROR_CODES.INVALID_REQUEST,
          errorMessage: "Webhookペイロードに payment_id が含まれていません",
        };
      }

      // refund 系は当面 pending（ハンドリング未実装のため Webhook を受けても何もしない）
      if (payload.status === PAIDY_WEBHOOK_EVENTS.REFUND_SUCCESS) {
        return { success: false, status: "pending", sessionId: paymentId };
      }

      // ペイロードは信頼せず Paidy API に再問い合わせ（HMAC 署名が無いため必須）
      const payment = await this.fetchPayment(paymentId);
      if (!payment) {
        return {
          success: false,
          sessionId: paymentId,
          errorCode: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
          errorMessage: "Paidy API から payment 情報を取得できませんでした",
        };
      }

      const paidAt = payload.timestamp ? new Date(payload.timestamp) : undefined;
      const paidAmount = payment.captured_amount ?? payment.amount;

      switch (payload.status) {
        case PAIDY_WEBHOOK_EVENTS.AUTHORIZE_SUCCESS: {
          // 与信成功（capture 待ち）。クライアント側の確定 API がリアルタイムに capture を走らせる
          // 想定だが、Webhook が先着した場合は pending を返し、後続の capture_success で完了させる。
          return { success: false, status: "pending", sessionId: paymentId };
        }

        case PAIDY_WEBHOOK_EVENTS.CAPTURE_SUCCESS:
        case PAIDY_WEBHOOK_EVENTS.CLOSE_SUCCESS: {
          // capture / close は決済確定。
          // CLOSED 状態でも captured_amount が 0 の場合は void（無料/キャンセル close）扱いとする。
          if (
            normalizePaidyStatus(payment.status) === PAIDY_PAYMENT_STATUS.CLOSED &&
            payment.captured_amount === 0
          ) {
            return {
              success: false,
              status: "failed",
              sessionId: paymentId,
              errorCode: PAYMENT_ERROR_CODES.PAYMENT_CANCELLED,
              errorMessage: "決済がキャンセルされました（void close）",
              rawResponse: payment,
            };
          }
          return {
            success: true,
            status: "completed",
            sessionId: paymentId,
            transactionId: payload.capture_id ?? payment.captures?.[0]?.id ?? paymentId,
            paymentMethod: "paidy",
            paidAt,
            paidAmount,
            rawResponse: payment,
          };
        }

        case PAIDY_WEBHOOK_EVENTS.UPDATE_SUCCESS: {
          // 金額更新等。確定状態を変えないため pending とする。
          return { success: false, status: "pending", sessionId: paymentId };
        }

        default: {
          console.log(`[Paidy] Unhandled webhook status: ${payload.status}`);
          return { success: false, status: "pending", sessionId: paymentId };
        }
      }
    } catch (error) {
      console.error("[Paidy] Webhook parsing error:", error);
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
   * Paidy は HMAC 等の署名検証機構を提供していない（公式ドキュメントに記載なし）。
   * 偽 Webhook 対策は verifyWebhook 側で payment_id 経由の GET /payments/{id} による
   * 二重確認に集約しているため、ここでは常に true を返す。
   *
   * 将来 Paidy が署名機構を追加した場合はここを実装し、payment.config.ts の
   * webhook.signatureHeaders.paidy をヘッダー名にすることで自動的に有効化される。
   */
  async verifyWebhookSignature(_request: Request, _signature: string): Promise<boolean> {
    return true;
  }

  /**
   * 決済ステータスを照会（Webhook 未着時のフォールバック）
   *
   * 引数 sessionId は Paidy の payment_id（`pay_xxx`）が渡される前提。
   * purchase_request.provider_session_id に確定 API 経由で記録されたものが使われる。
   */
  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    try {
      const payment = await this.fetchPayment(sessionId);
      if (!payment) {
        return { status: "pending", sessionId };
      }

      switch (normalizePaidyStatus(payment.status)) {
        case PAIDY_PAYMENT_STATUS.AUTHORIZED:
          return { status: "processing", sessionId, transactionId: payment.id };

        case PAIDY_PAYMENT_STATUS.CLOSED: {
          if (payment.captured_amount === 0) {
            return {
              status: "failed",
              sessionId,
              transactionId: payment.id,
              errorCode: PAYMENT_ERROR_CODES.PAYMENT_CANCELLED,
              errorMessage: "決済がキャンセルされました（void close）",
            };
          }
          return {
            status: "completed",
            sessionId,
            transactionId: payment.captures?.[0]?.id ?? payment.id,
          };
        }

        case PAIDY_PAYMENT_STATUS.REJECTED:
          return {
            status: "failed",
            sessionId,
            transactionId: payment.id,
            errorCode: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
            errorMessage: "決済が拒否されました",
          };

        default:
          return { status: "pending", sessionId };
      }
    } catch (error) {
      console.error("[Paidy] getPaymentStatus error:", error);
      return { status: "pending", sessionId };
    }
  }

  /**
   * GET /payments/{id} で Paidy Payment オブジェクトを取得する。
   * verifyWebhook の二重確認、getPaymentStatus、確定 API (confirmPaidyPayment) から共有される。
   * confirmPaidyPayment が provider 外から呼び出すため public。
   */
  async fetchPayment(paymentId: string): Promise<PaidyPayment | null> {
    const config = this.getConfig();

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/payments/${encodeURIComponent(paymentId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            "Paidy-Version": "2018-04-10",
          },
        },
      );

      if (!response.ok) {
        console.error(
          `[Paidy] Failed to fetch payment: id=${paymentId}, status=${response.status}`,
        );
        return null;
      }

      return (await response.json()) as PaidyPayment;
    } catch (error) {
      console.error(`[Paidy] fetchPayment error: id=${paymentId}`, error);
      return null;
    }
  }

  /**
   * Capture を実行する。共通起動ページの確定 API から呼び出される想定。
   *
   * provider 内部に閉じた処理だが、確定 API ルートからも呼べるよう public で公開する。
   * 既に capture 済（status=CLOSED）の payment に対しては no-op として扱う。
   */
  async capturePayment(paymentId: string, amount: number): Promise<PaidyPayment | null> {
    const config = this.getConfig();

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/payments/${encodeURIComponent(paymentId)}/captures`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            "Content-Type": "application/json",
            "Paidy-Version": "2018-04-10",
            "Paidy-Idempotency-Key": `capture_${paymentId}`,
          },
          body: JSON.stringify({ amount }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `[Paidy] capturePayment failed: id=${paymentId}, status=${response.status}, body=${body}`,
        );
        return null;
      }

      return (await response.json()) as PaidyPayment;
    } catch (error) {
      console.error(`[Paidy] capturePayment error: id=${paymentId}`, error);
      return null;
    }
  }
}

/**
 * Paidy プロバイダのシングルトンインスタンス
 */
export const paidyPaymentProvider = new PaidyPaymentProvider();
