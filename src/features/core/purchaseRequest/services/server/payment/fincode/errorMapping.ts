// src/features/core/purchaseRequest/services/server/payment/fincode/errorMapping.ts
// Fincode固有エラーコードを汎用エラーコードにマッピング

import {
  PAYMENT_ERROR_CODES,
  type ProviderErrorMapping,
} from "@/features/core/purchaseRequest/constants/errorCodes";

/**
 * Fincode エラーコードマッピング
 * @see https://docs.fincode.jp/api
 */
export const FINCODE_ERROR_MAP: ProviderErrorMapping = {
  // カード関連エラー
  E0100001: PAYMENT_ERROR_CODES.CARD_DECLINED,
  E0100002: PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS,
  E0100003: PAYMENT_ERROR_CODES.CARD_DECLINED, // 限度額オーバー
  E0100004: PAYMENT_ERROR_CODES.CARD_INVALID,
  E0100005: PAYMENT_ERROR_CODES.CARD_EXPIRED,
  E0100006: PAYMENT_ERROR_CODES.CARD_DECLINED, // 取扱不可カード
  E0100007: PAYMENT_ERROR_CODES.CARD_DECLINED, // 無効カード番号

  // 3Dセキュア関連
  E0200001: PAYMENT_ERROR_CODES.TDS_FAILED,
  E0200002: PAYMENT_ERROR_CODES.TDS_FAILED, // 認証タイムアウト
  E0200003: PAYMENT_ERROR_CODES.TDS_FAILED, // 認証エラー

  // コンビニ決済関連
  E0300001: PAYMENT_ERROR_CODES.CONVENIENCE_EXPIRED,
  E0300002: PAYMENT_ERROR_CODES.CONVENIENCE_CANCELLED,

  // 銀行振込関連
  E0400001: PAYMENT_ERROR_CODES.BANK_TRANSFER_EXPIRED,

  // PayPay関連
  E0500001: PAYMENT_ERROR_CODES.PAYMENT_CANCELLED,
  E0500002: PAYMENT_ERROR_CODES.PAYMENT_EXPIRED, // PayPayセッション期限切れ
  E0500003: PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS, // PayPay残高不足

  // システムエラー
  E9900001: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
  E9900002: PAYMENT_ERROR_CODES.NETWORK_ERROR,
  E9900003: PAYMENT_ERROR_CODES.TIMEOUT,
};

/**
 * Fincode Webhookイベントタイプ
 */
export const FINCODE_WEBHOOK_EVENTS = {
  // カード決済
  CARD_COMPLETE: "payments.card.complete",
  CARD_SECURE: "payments.card.secure", // 3Dセキュア認証後の決済完了
  CARD_FAILED: "payments.card.failed",

  // コンビニ決済
  KONBINI_COMPLETE: "payments.konbini.complete",
  KONBINI_EXPIRED: "payments.konbini.expired",
  KONBINI_CANCELLED: "payments.konbini.cancelled",

  // PayPay決済
  PAYPAY_COMPLETE: "payments.paypay.complete",
  PAYPAY_FAILED: "payments.paypay.failed",
  PAYPAY_CANCELLED: "payments.paypay.cancelled",

  // 銀行振込
  VIRTUALACCOUNT_COMPLETE: "payments.virtualaccount.complete",
  VIRTUALACCOUNT_EXPIRED: "payments.virtualaccount.expired",

  // セッション
  SESSION_EXPIRED: "session.expired",
} as const;

/**
 * Webhookイベントが成功イベントかどうかを判定
 * .complete: 通常の決済完了
 * .secure: 3Dセキュア認証後の決済完了
 */
export function isSuccessEvent(eventType: string): boolean {
  return eventType.endsWith(".complete") || eventType.endsWith(".secure");
}

/**
 * イベントタイプから支払い方法を抽出
 */
export function extractPaymentMethod(eventType: string): string {
  if (eventType.includes("card") || eventType.includes("secure")) return "credit_card";
  if (eventType.includes("konbini")) return "convenience_store";
  if (eventType.includes("paypay")) return "paypay";
  if (eventType.includes("virtualaccount")) return "bank_transfer";
  return "unknown";
}
