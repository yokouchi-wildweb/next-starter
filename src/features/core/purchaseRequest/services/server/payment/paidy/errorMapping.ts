// src/features/core/purchaseRequest/services/server/payment/paidy/errorMapping.ts
// Paidy 固有エラーコード/イベント名と汎用エラーコードのマッピング定義

import {
  PAYMENT_ERROR_CODES,
  type ProviderErrorMapping,
} from "@/features/core/purchaseRequest/constants/errorCodes";

/**
 * Paidy エラーコードマッピング
 *
 * Paidy 側のエラーコードは GET /payments/{id} レスポンスや決済結果オブジェクトに
 * 含まれる文字列で、ドキュメント上の網羅一覧が乏しいため最小限のマッピングのみ提供。
 * 未知のコードは PAYMENT_ERROR_CODES.PROVIDER_ERROR に落ちる。
 */
export const PAIDY_ERROR_MAP: ProviderErrorMapping = {
  // 与信失敗（決済全般）
  declined: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
  rejected: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
  payment_declined: PAYMENT_ERROR_CODES.PAYMENT_FAILED,

  // ユーザー操作
  cancelled: PAYMENT_ERROR_CODES.PAYMENT_CANCELLED,
  consumer_cancelled: PAYMENT_ERROR_CODES.PAYMENT_CANCELLED,

  // 期限切れ
  expired: PAYMENT_ERROR_CODES.PAYMENT_EXPIRED,

  // 認証関連
  authentication_failed: PAYMENT_ERROR_CODES.AUTH_FAILED,

  // 通信・システム
  internal_error: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
  service_unavailable: PAYMENT_ERROR_CODES.PROVIDER_ERROR,

  // リクエスト不正
  invalid_request: PAYMENT_ERROR_CODES.INVALID_REQUEST,
};

/**
 * Paidy Webhook イベント名（status フィールドに入る値）
 *
 * Paidy Webhook はペイロード内の `status` でイベント種別を表現する。
 * event_type は "payment" / "token" の大分類のみ。
 *
 * 参考: paidy.com/docs/en/webhook.html
 */
export const PAIDY_WEBHOOK_EVENTS = {
  AUTHORIZE_SUCCESS: "authorize_success",
  CAPTURE_SUCCESS: "capture_success",
  CLOSE_SUCCESS: "close_success",
  REFUND_SUCCESS: "refund_success",
  UPDATE_SUCCESS: "update_success",
} as const;

/**
 * Paidy 決済オブジェクトの status フィールド値
 *
 * paidy.js の closed コールバックや GET /payments/{id} レスポンスに入る決済状態。
 * AUTHORIZED は与信完了（capture 待ち）、CLOSED は capture または void 後の終了状態。
 */
export const PAIDY_PAYMENT_STATUS = {
  AUTHORIZED: "AUTHORIZED",
  REJECTED: "REJECTED",
  CLOSED: "CLOSED",
} as const;

/**
 * Paidy event_type フィールドの値
 *
 * payment 系のみ purchase_request の確定処理に関与する。
 * token 系は本テンプレートでは扱わない（サブスクリプション用）ため、受信しても pending として無視する。
 */
export const PAIDY_EVENT_TYPE = {
  PAYMENT: "payment",
  TOKEN: "token",
} as const;
