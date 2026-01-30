// src/features/core/purchaseRequest/services/server/payment/square/errorMapping.ts
// Square固有エラーコードを汎用エラーコードにマッピング

import {
  PAYMENT_ERROR_CODES,
  type ProviderErrorMapping,
} from "@/features/core/purchaseRequest/constants/errorCodes";

/**
 * Square エラーコードマッピング
 * @see https://developer.squareup.com/docs/payments-api/error-codes
 */
export const SQUARE_ERROR_MAP: ProviderErrorMapping = {
  // カード関連エラー
  CARD_DECLINED: PAYMENT_ERROR_CODES.CARD_DECLINED,
  CARD_DECLINED_CALL_ISSUER: PAYMENT_ERROR_CODES.CARD_DECLINED,
  CARD_DECLINED_VERIFICATION_REQUIRED: PAYMENT_ERROR_CODES.TDS_FAILED,
  CVV_FAILURE: PAYMENT_ERROR_CODES.CARD_INVALID,
  ADDRESS_VERIFICATION_FAILURE: PAYMENT_ERROR_CODES.CARD_INVALID,
  INVALID_CARD: PAYMENT_ERROR_CODES.CARD_INVALID,
  INVALID_EXPIRATION: PAYMENT_ERROR_CODES.CARD_EXPIRED,
  CARD_EXPIRED: PAYMENT_ERROR_CODES.CARD_EXPIRED,
  INSUFFICIENT_FUNDS: PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS,
  CARD_NOT_SUPPORTED: PAYMENT_ERROR_CODES.CARD_DECLINED,

  // 認証関連
  VERIFY_AVS_FAILURE: PAYMENT_ERROR_CODES.AUTH_FAILED,
  VERIFY_CVV_FAILURE: PAYMENT_ERROR_CODES.AUTH_FAILED,
  VOICE_FAILURE: PAYMENT_ERROR_CODES.AUTH_FAILED,

  // トランザクション関連
  TRANSACTION_LIMIT: PAYMENT_ERROR_CODES.CARD_DECLINED,
  ALLOWABLE_PIN_TRIES_EXCEEDED: PAYMENT_ERROR_CODES.AUTH_FAILED,
  MANUALLY_ENTERED_PAYMENT_NOT_SUPPORTED: PAYMENT_ERROR_CODES.PAYMENT_FAILED,

  // システムエラー
  GATEWAY_ERROR: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
  REQUEST_TIMEOUT: PAYMENT_ERROR_CODES.TIMEOUT,
  INVALID_REQUEST: PAYMENT_ERROR_CODES.INVALID_REQUEST,

  // 一般エラー
  GENERIC_DECLINE: PAYMENT_ERROR_CODES.CARD_DECLINED,
  PAN_FAILURE: PAYMENT_ERROR_CODES.CARD_INVALID,
  EXPIRATION_FAILURE: PAYMENT_ERROR_CODES.CARD_EXPIRED,
  INVALID_ACCOUNT: PAYMENT_ERROR_CODES.CARD_INVALID,
  CURRENCY_MISMATCH: PAYMENT_ERROR_CODES.INVALID_REQUEST,
  AMOUNT_TOO_HIGH: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
  AMOUNT_TOO_LOW: PAYMENT_ERROR_CODES.PAYMENT_FAILED,
};

/**
 * Square Webhookイベントタイプ
 */
export const SQUARE_WEBHOOK_EVENTS = {
  // 決済関連
  PAYMENT_CREATED: "payment.created",
  PAYMENT_UPDATED: "payment.updated",

  // Checkout関連
  CHECKOUT_COMPLETED: "checkout.completed",
} as const;

/**
 * Square Payment ステータス
 */
export const SQUARE_PAYMENT_STATUS = {
  APPROVED: "APPROVED",
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  FAILED: "FAILED",
} as const;

/**
 * Webhookイベントが成功を示すかどうかを判定
 */
export function isSuccessPaymentStatus(status: string): boolean {
  return status === SQUARE_PAYMENT_STATUS.COMPLETED || status === SQUARE_PAYMENT_STATUS.APPROVED;
}

/**
 * Squareの支払いソースタイプから支払い方法を抽出
 */
export function extractPaymentMethod(sourceType?: string): string {
  switch (sourceType) {
    case "CARD":
      return "credit_card";
    case "BANK_ACCOUNT":
      return "bank_transfer";
    case "WALLET":
    case "CASH_APP":
    case "SQUARE_ACCOUNT":
      return "wallet";
    case "BUY_NOW_PAY_LATER":
      return "bnpl";
    default:
      return "credit_card"; // Squareはデフォルトでカード決済
  }
}
