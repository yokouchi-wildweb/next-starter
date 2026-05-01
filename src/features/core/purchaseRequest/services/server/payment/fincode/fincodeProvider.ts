// src/features/core/purchaseRequest/services/server/payment/fincode/fincodeProvider.ts
// GMO Fincode 決済プロバイダ実装（リダイレクト型決済）

import crypto from "crypto";
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
import { paymentConfig, getProviderApiMethodId } from "@/config/app/payment.config";

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
 * 実際のWebhookではフィールドがルートレベルに配置される
 */
type FincodeWebhookPayload = {
  // イベント情報
  event: string;
  status?: string;
  // 取引識別子
  order_id?: string;
  access_id?: string;
  transaction_id?: string;
  // 決済情報
  pay_type?: string;
  // amount は仕様上 string だが、実運用では number で来るケースも観測されうるため
  // unknown としてパース時に正規化する（parsePaidAmount を参照）
  amount?: unknown;
  // 日時
  transaction_date?: string;
  // エラー情報
  error_code?: string | null;
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

    // ユーザーが選択した支払い方法を Fincode の pay_type 形式に変換する。
    // 1メソッド = 1プロバイダの設計上、ここでは選択された単一メソッドのみを渡す。
    // mapping が無いと Fincode が共通 ID を解釈できないため、明示的にエラーにする。
    const fincodePayType = getProviderApiMethodId("fincode", params.paymentMethod);
    if (!fincodePayType || fincodePayType === params.paymentMethod) {
      // mapping が見つからない場合 getProviderApiMethodId は元の ID をそのまま返すため、
      // ここで Fincode 側に意図せぬ ID が渡らないよう守る。
      const mappingExists =
        paymentConfig.providers.fincode?.methodMapping?.[params.paymentMethod];
      if (!mappingExists) {
        throw new Error(
          `[Fincode] 支払い方法 "${params.paymentMethod}" の methodMapping が定義されていません。payment.config.ts を確認してください。`,
        );
      }
    }

    const requestBody = {
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      // お支払い画面案内メール送信フラグ: "0" = 送信しない
      guide_mail_send_flag: "0",
      transaction: {
        // ユーザーが選択した単一の支払い方法のみを Fincode に渡す
        // （Fincode 側の選択画面ではこれ1種のみが提示される）
        pay_type: [fincodePayType],
        amount: String(params.amount),
        // オーダーID（Webhook照合用）- 最大30文字、ハイフン除去
        order_id: params.purchaseRequestId.replace(/-/g, "").slice(0, 30),
      },
      card: {
        job_code: "CAPTURE", // 即時売上
        tds_type: "2", // 3Dセキュア2.0
        tds2_type: "2",
      },
      konbini: {
        payment_term_day: "3", // 支払い期限: 3日
        konbini_reception_mail_send_flag: "0", // コンビニ決済受付メール: 送信しない
      },
      virtualaccount: {
        payment_term_day: "7", // 支払い期限: 7日
        virtualaccount_reception_mail_send_flag: "0", // 銀行振込受付メール: 送信しない
      },
      // メタデータを追加（照合用）
      ...(params.metadata && { metadata: params.metadata }),
    };

    if (paymentConfig.debugLog) {
      console.log("[Fincode] Request body:", JSON.stringify(requestBody, null, 2));
    } else {
      console.log(`[Fincode] Creating session: purchaseRequestId=${params.purchaseRequestId}, amount=${params.amount}`);
    }

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

      if (paymentConfig.debugLog) {
        console.log("[Fincode] Webhook payload:", JSON.stringify(body, null, 2));
      } else {
        console.log(`[Fincode] Webhook received: event=${body.event}, orderId=${body.order_id}`);
      }

      const eventType = body.event;
      const isSuccess = this.isSuccessWebhook(body);

      // order_id を取得（Fincodeでは order_id がメインの識別子）
      const sessionId = body.order_id || "";

      if (isSuccess) {
        // transaction_date を Date に変換（形式: "2026/01/24 13:08:10.017"）
        let paidAt = new Date();
        if (body.transaction_date) {
          const dateStr = body.transaction_date.replace(/\//g, "-");
          paidAt = new Date(dateStr);
        }

        return {
          success: true,
          sessionId,
          transactionId: body.access_id || body.transaction_id,
          paymentMethod: extractPaymentMethod(eventType),
          paidAt,
          paidAmount: parsePaidAmount(body.amount),
          rawResponse: body,
        };
      }

      // 失敗・キャンセル・期限切れ
      const errorCode = mapProviderError(body.error_code ?? undefined, FINCODE_ERROR_MAP);

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
   * Webhookが成功を示しているかを判定
   * status=CAPTUREDまたは特定の成功イベントで判定
   */
  private isSuccessWebhook(body: FincodeWebhookPayload): boolean {
    // statusがCAPTUREDなら成功
    if (body.status === "CAPTURED") {
      return true;
    }
    // イベントタイプで判定
    const eventType = body.event;
    if (eventType.endsWith(".complete") || eventType.endsWith(".secure")) {
      return true;
    }
    return false;
  }

  /**
   * Webhook署名を検証
   * Fincodeは登録時に設定した固定トークンをヘッダーに付与する方式（HMAC ではない）
   * タイミング攻撃防止のため定数時間比較を使用
   */
  async verifyWebhookSignature(_request: Request, signature: string): Promise<boolean> {
    const config = this.getConfig();
    const expected = Buffer.from(config.webhookSignature);
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, actual);
  }

  /**
   * 決済ステータスを照会（Webhook フォールバック用）
   *
   * `GET /v1/payments/Card/{order_id}` で Fincode API に問い合わせ、現在の決済状態を取得する。
   * クライアント側のポーリング (`usePurchaseStatusPolling`) から
   * `getPurchaseStatusForUser` 経由で呼ばれるため、Webhook が何らかの理由で届かない場合でも
   * 購入リクエストが自動で completed に遷移する（セルフヒーリング）。
   *
   * Webhook との二重化により、以下のいずれの故障ケースでも UX が保たれる:
   *   - Webhook 未登録イベント種別（例: 売上確定を登録し忘れ）で発火しない
   *   - Webhook 署名不一致で 401 返却
   *   - その他 Vercel 側でのリクエスト拒否
   *
   * @param identifier Fincode の `order_id`
   *   （`initiatePurchase` で `purchaseRequest.id` からハイフン除去・30 文字切り詰めした値）
   * @param paymentMethod 購入時にユーザーが選択した支払い方法 ID。
   *   照会 API の `pay_type` クエリに必要（メソッドごとに値が異なる）。
   *   未指定時は後方互換として "Card" を使用する。
   */
  async getPaymentStatus(identifier: string, paymentMethod?: string): Promise<PaymentStatusResult> {
    const config = this.getConfig();

    if (!identifier) {
      return { status: "pending", sessionId: identifier };
    }

    // Fincode 公式 API 仕様:
    //   GET /v1/payments/{id}?pay_type=Card
    //   ({id} は order_id、pay_type は path ではなく query で指定する)
    // 購入時に選択された pay_type を動的に解決する（mapping が無い場合は Card にフォールバック）。
    const fincodePayType = paymentMethod
      ? getProviderApiMethodId("fincode", paymentMethod)
      : "Card";

    try {
      const response = await fetch(
        `${config.apiUrl}/v1/payments/${encodeURIComponent(identifier)}?pay_type=${encodeURIComponent(fincodePayType)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        // 404: まだ Fincode 側にも決済が存在しない（ユーザーが決済画面を開いていない等）→ pending
        // その他のエラー: 次回ポーリングでリトライさせるため pending を返す
        const errorText = await response.text().catch(() => "");
        console.warn(
          `[Fincode] getPaymentStatus HTTP ${response.status}: identifier=${identifier}, body=${errorText}`,
        );
        return { status: "pending", sessionId: identifier };
      }

      const data = (await response.json()) as FincodeSessionStatusResponse;

      if (paymentConfig.debugLog) {
        console.log("[Fincode] Payment status response:", JSON.stringify(data, null, 2));
      } else {
        console.log(
          `[Fincode] Payment status: identifier=${identifier}, fincodeStatus=${data.status}`,
        );
      }

      const mapped = this.mapFincodeStatus(data.status);

      // Fincode レスポンスの日時フィールド優先順位:
      //   1. process_date — 決済処理日時
      //   2. updated      — レコード更新日時
      //   3. paid         — (旧仕様、後方互換用)
      // いずれも "YYYY/MM/DD HH:mm:ss.sss" 形式
      let paidAt: Date | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawDate = (data as any).process_date || (data as any).updated || data.paid;
      if (rawDate && typeof rawDate === "string") {
        const parsed = new Date(rawDate.replace(/\//g, "-"));
        if (!Number.isNaN(parsed.getTime())) {
          paidAt = parsed;
        }
      }

      return {
        status: mapped,
        sessionId: identifier,
        transactionId: data.access_id,
        paidAt,
        errorCode: data.error_code ?? undefined,
      };
    } catch (error) {
      console.error("[Fincode] getPaymentStatus network error:", error);
      return { status: "pending", sessionId: identifier };
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

/**
 * Fincode webhook ペイロードの amount フィールドを安全に数値化する。
 *
 * Fincode のドキュメント上 amount は「整数を文字列で表現したもの（円単位）」だが、
 * 実運用ではイベント種別やプロバイダのバージョン差により以下のパターンが観測されうる:
 *   - undefined / null / 空文字: 当該イベントに金額情報がない
 *   - "1000": 通常の整数文字列
 *   - "1000.00": 小数点付き（一部イベントで観測）
 *   - "1,000": カンマ区切り（互換のため許容）
 *   - 数値型 1000: 型定義は string だが念のため対応
 *
 * 上記いずれにも該当しない（パース不能、NaN、負数）場合は undefined を返し、
 * 金額照合チェックをスキップさせる。これにより、Fincode 側のペイロード仕様変更で
 * 誤って金額不一致エラーになり購入が永久に塩漬けになる事故を防ぐ。
 *
 * セキュリティ的には、金額照合は防御層の1つに過ぎず（Webhook 署名検証・冪等キー・
 * order_id 紐付けが先に効いている）、パース不能ケースをスキップしても他の防御層で
 * カバーされる。実際の不一致は completePurchase 側で検出され、markAsFatalFailure
 * で failed 状態に遷移するため、UX も保たれる。
 */
function parsePaidAmount(raw: unknown): number | undefined {
  if (raw == null) return undefined;

  // 数値型がそのまま渡ってきた場合
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? raw : undefined;
  }

  if (typeof raw !== "string") return undefined;

  // 空文字・空白のみは未設定として扱う
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;

  // カンマ区切りを除去（"1,000" → "1000"）
  const normalized = trimmed.replace(/,/g, "");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      `[Fincode] paidAmount のパースに失敗。金額照合をスキップします: raw=${JSON.stringify(raw)}`,
    );
    return undefined;
  }

  return parsed;
}
