// src/features/core/purchaseRequest/services/server/payment/stripe/errorMapping.ts
// Stripe固有エラーコードを汎用エラーコードにマッピング

import {
  PAYMENT_ERROR_CODES,
  type ProviderErrorMapping,
} from "@/features/core/purchaseRequest/constants/errorCodes";

/**
 * Stripe エラーコード / decline code マッピング
 * @see https://docs.stripe.com/error-codes
 * @see https://docs.stripe.com/declines/codes
 */
export const STRIPE_ERROR_MAP: ProviderErrorMapping = {
  // カード拒否系（decline_code と card-related error codes を両方収録）
  card_declined: PAYMENT_ERROR_CODES.CARD_DECLINED,
  generic_decline: PAYMENT_ERROR_CODES.CARD_DECLINED,
  do_not_honor: PAYMENT_ERROR_CODES.CARD_DECLINED,
  lost_card: PAYMENT_ERROR_CODES.CARD_DECLINED,
  stolen_card: PAYMENT_ERROR_CODES.CARD_DECLINED,
  pickup_card: PAYMENT_ERROR_CODES.CARD_DECLINED,
  fraudulent: PAYMENT_ERROR_CODES.CARD_DECLINED,
  call_issuer: PAYMENT_ERROR_CODES.CARD_DECLINED,
  do_not_try_again: PAYMENT_ERROR_CODES.CARD_DECLINED,
  transaction_not_allowed: PAYMENT_ERROR_CODES.CARD_DECLINED,
  try_again_later: PAYMENT_ERROR_CODES.CARD_DECLINED,

  // カード情報不正
  expired_card: PAYMENT_ERROR_CODES.CARD_EXPIRED,
  invalid_expiry_month: PAYMENT_ERROR_CODES.CARD_EXPIRED,
  invalid_expiry_year: PAYMENT_ERROR_CODES.CARD_EXPIRED,
  incorrect_cvc: PAYMENT_ERROR_CODES.CARD_INVALID,
  invalid_cvc: PAYMENT_ERROR_CODES.CARD_INVALID,
  incorrect_number: PAYMENT_ERROR_CODES.CARD_INVALID,
  invalid_number: PAYMENT_ERROR_CODES.CARD_INVALID,
  incorrect_zip: PAYMENT_ERROR_CODES.CARD_INVALID,
  invalid_account: PAYMENT_ERROR_CODES.CARD_INVALID,
  card_not_supported: PAYMENT_ERROR_CODES.CARD_INVALID,
  currency_not_supported: PAYMENT_ERROR_CODES.CARD_INVALID,

  // 残高不足
  insufficient_funds: PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS,
  withdrawal_count_limit_exceeded: PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS,

  // 認証関連
  authentication_required: PAYMENT_ERROR_CODES.TDS_FAILED,
  approve_with_id: PAYMENT_ERROR_CODES.AUTH_FAILED,
  incorrect_pin: PAYMENT_ERROR_CODES.AUTH_FAILED,
  invalid_pin: PAYMENT_ERROR_CODES.AUTH_FAILED,
  offline_pin_required: PAYMENT_ERROR_CODES.AUTH_FAILED,
  online_or_offline_pin_required: PAYMENT_ERROR_CODES.AUTH_FAILED,

  // システム・通信
  processing_error: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
  issuer_not_available: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
  api_connection_error: PAYMENT_ERROR_CODES.NETWORK_ERROR,
  api_error: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
  rate_limit_error: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
  service_not_allowed: PAYMENT_ERROR_CODES.PROVIDER_ERROR,

  // リクエスト不正
  invalid_request_error: PAYMENT_ERROR_CODES.INVALID_REQUEST,
  amount_too_large: PAYMENT_ERROR_CODES.INVALID_REQUEST,
  amount_too_small: PAYMENT_ERROR_CODES.INVALID_REQUEST,
};

/**
 * Stripe Webhook イベントタイプ（Checkout Session 系のみ）
 * @see https://docs.stripe.com/api/events/types
 */
export const STRIPE_WEBHOOK_EVENTS = {
  SESSION_COMPLETED: "checkout.session.completed",
  SESSION_ASYNC_PAYMENT_SUCCEEDED: "checkout.session.async_payment_succeeded",
  SESSION_ASYNC_PAYMENT_FAILED: "checkout.session.async_payment_failed",
  SESSION_EXPIRED: "checkout.session.expired",
} as const;

/**
 * Stripe Checkout Session ステータス
 */
export const STRIPE_SESSION_STATUS = {
  OPEN: "open",
  COMPLETE: "complete",
  EXPIRED: "expired",
} as const;

/**
 * Stripe Checkout Session の payment_status
 */
export const STRIPE_PAYMENT_STATUS = {
  PAID: "paid",
  UNPAID: "unpaid",
  NO_PAYMENT_REQUIRED: "no_payment_required",
} as const;

/**
 * Stripe の payment_method_types から共通支払い方法名を抽出
 */
export function extractPaymentMethod(paymentMethodType?: string): string {
  switch (paymentMethodType) {
    case "card":
      return "credit_card";
    case "konbini":
      return "convenience_store";
    case "customer_balance":
    case "jp_bank_transfer":
      return "bank_transfer";
    case "paypay":
      return "paypay";
    default:
      return "credit_card";
  }
}
