// src/features/core/purchaseRequest/services/server/payment/paypal/errorMapping.ts
// PayPal 固有のステータス / Webhook イベント名 / エラーコードと、汎用エラーコードのマッピング定義。

import {
  PAYMENT_ERROR_CODES,
  type ProviderErrorMapping,
} from "@/features/core/purchaseRequest/constants/errorCodes";

/**
 * PayPal Order の status（GET /v2/checkout/orders/{id} や capture レスポンスの status）
 *
 * 公式: https://developer.paypal.com/docs/api/orders/v2/#orders_get
 * - CREATED:           注文作成直後（未承認）
 * - SAVED:             保存済み（本テンプレートでは未使用）
 * - APPROVED:          購入者が承認済み（capture 待ち）
 * - PENDING_APPROVAL:  承認待ち
 * - VOIDED:            無効化
 * - COMPLETED:         capture 完了（決済確定）
 */
export const PAYPAL_ORDER_STATUS = {
  CREATED: "CREATED",
  SAVED: "SAVED",
  APPROVED: "APPROVED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  VOIDED: "VOIDED",
  COMPLETED: "COMPLETED",
} as const;

/**
 * PayPal Capture の status（purchase_units[].payments.captures[].status）
 *
 * 公式: https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 * - COMPLETED: 入金確定
 * - PENDING:   保留（リスク審査等）
 * - DECLINED:  拒否
 * - REFUNDED:  返金済み
 */
export const PAYPAL_CAPTURE_STATUS = {
  COMPLETED: "COMPLETED",
  PENDING: "PENDING",
  DECLINED: "DECLINED",
  REFUNDED: "REFUNDED",
} as const;

/**
 * PayPal Webhook の event_type（受信ペイロードの `event_type`）
 *
 * 公式: https://developer.paypal.com/api/rest/webhooks/event-names/
 * capture フロー（intent=CAPTURE）で確定/失敗判定に関与するもののみ列挙。
 * - CHECKOUT.ORDER.APPROVED:    購入者が承認（capture はこの後）。確定はしないので pending 扱い。
 * - PAYMENT.CAPTURE.COMPLETED:  capture 完了 → 決済確定。
 * - PAYMENT.CAPTURE.DENIED:     capture 拒否 → 決済失敗。
 * - PAYMENT.CAPTURE.PENDING:    capture 保留 → pending（後続イベントで確定/失敗が来る）。
 * - PAYMENT.CAPTURE.REFUNDED:   返金 → 当面 pending（返金ハンドリングは別途）。
 */
export const PAYPAL_WEBHOOK_EVENTS = {
  ORDER_APPROVED: "CHECKOUT.ORDER.APPROVED",
  CAPTURE_COMPLETED: "PAYMENT.CAPTURE.COMPLETED",
  CAPTURE_DENIED: "PAYMENT.CAPTURE.DENIED",
  CAPTURE_PENDING: "PAYMENT.CAPTURE.PENDING",
  CAPTURE_REFUNDED: "PAYMENT.CAPTURE.REFUNDED",
} as const;

/**
 * Webhook 署名検証 API（POST /v1/notifications/verify-webhook-signature）の
 * verification_status 値。
 */
export const PAYPAL_VERIFICATION_STATUS = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
} as const;

/**
 * PayPal エラーコードマッピング
 *
 * PayPal は capture 失敗時に details[].issue にコードを返す
 * （例: INSTRUMENT_DECLINED, PAYER_CANNOT_PAY 等）。
 * 公式: https://developer.paypal.com/api/rest/reference/orders/v2/errors/
 * 未知のコードは PAYMENT_ERROR_CODES.UNKNOWN に落ちる（mapProviderError 経由）。
 */
export const PAYPAL_ERROR_MAP: ProviderErrorMapping = {
  // 与信・支払い手段の拒否
  INSTRUMENT_DECLINED: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
  PAYER_CANNOT_PAY: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
  PAYER_ACCOUNT_RESTRICTED: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
  TRANSACTION_REFUSED: PAYMENT_ERROR_CODES.PAYMENT_FAILED,

  // 残高不足
  INSUFFICIENT_FUNDS: PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS,

  // カード関連
  CARD_EXPIRED: PAYMENT_ERROR_CODES.CARD_EXPIRED,

  // 認証関連（3DS 等）
  PAYER_AUTHENTICATION_FAILED: PAYMENT_ERROR_CODES.AUTH_FAILED,

  // リクエスト不正
  INVALID_REQUEST: PAYMENT_ERROR_CODES.INVALID_REQUEST,
  ORDER_ALREADY_CAPTURED: PAYMENT_ERROR_CODES.INVALID_REQUEST,
};
