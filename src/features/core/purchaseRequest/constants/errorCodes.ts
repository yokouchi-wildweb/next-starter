// src/features/core/purchaseRequest/constants/errorCodes.ts
// 決済エラーコードの汎用定義
// プロバイダ固有のエラーコードをこれらの汎用コードにマッピングして使用する

/**
 * 汎用決済エラーコード（プロバイダ非依存）
 */
export const PAYMENT_ERROR_CODES = {
  // 決済失敗（一般）
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_CANCELLED: "payment_cancelled",
  PAYMENT_EXPIRED: "payment_expired",

  // カード関連
  CARD_DECLINED: "card_declined",
  CARD_EXPIRED: "card_expired",
  CARD_INVALID: "card_invalid",
  INSUFFICIENT_FUNDS: "insufficient_funds",

  // 認証関連
  AUTH_FAILED: "auth_failed",
  TDS_FAILED: "tds_failed", // 3Dセキュア失敗

  // コンビニ決済関連
  CONVENIENCE_EXPIRED: "convenience_expired",
  CONVENIENCE_CANCELLED: "convenience_cancelled",

  // 銀行振込関連
  BANK_TRANSFER_EXPIRED: "bank_transfer_expired",

  // システムエラー
  PROVIDER_ERROR: "provider_error",
  NETWORK_ERROR: "network_error",
  TIMEOUT: "timeout",
  INVALID_REQUEST: "invalid_request",
  INVALID_SIGNATURE: "invalid_signature",

  // 不明
  UNKNOWN: "unknown",
} as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[keyof typeof PAYMENT_ERROR_CODES];

/**
 * ユーザー向けエラーメッセージ
 */
export const PAYMENT_ERROR_MESSAGES: Record<PaymentErrorCode, string> = {
  // 決済失敗（一般）
  [PAYMENT_ERROR_CODES.PAYMENT_FAILED]: "決済に失敗しました。",
  [PAYMENT_ERROR_CODES.PAYMENT_CANCELLED]: "決済がキャンセルされました。",
  [PAYMENT_ERROR_CODES.PAYMENT_EXPIRED]: "決済の有効期限が切れました。",

  // カード関連
  [PAYMENT_ERROR_CODES.CARD_DECLINED]: "カードが拒否されました。別のカードをお試しください。",
  [PAYMENT_ERROR_CODES.CARD_EXPIRED]: "カードの有効期限が切れています。",
  [PAYMENT_ERROR_CODES.CARD_INVALID]: "カード情報が正しくありません。",
  [PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS]: "残高が不足しています。",

  // 認証関連
  [PAYMENT_ERROR_CODES.AUTH_FAILED]: "認証に失敗しました。",
  [PAYMENT_ERROR_CODES.TDS_FAILED]: "本人認証（3Dセキュア）に失敗しました。",

  // コンビニ決済関連
  [PAYMENT_ERROR_CODES.CONVENIENCE_EXPIRED]: "コンビニ決済の支払い期限が切れました。",
  [PAYMENT_ERROR_CODES.CONVENIENCE_CANCELLED]: "コンビニ決済がキャンセルされました。",

  // 銀行振込関連
  [PAYMENT_ERROR_CODES.BANK_TRANSFER_EXPIRED]: "銀行振込の支払い期限が切れました。",

  // システムエラー
  [PAYMENT_ERROR_CODES.PROVIDER_ERROR]: "決済サービスでエラーが発生しました。しばらくしてから再度お試しください。",
  [PAYMENT_ERROR_CODES.NETWORK_ERROR]: "通信エラーが発生しました。しばらくしてから再度お試しください。",
  [PAYMENT_ERROR_CODES.TIMEOUT]: "処理がタイムアウトしました。しばらくしてから再度お試しください。",
  [PAYMENT_ERROR_CODES.INVALID_REQUEST]: "リクエストが不正です。",
  [PAYMENT_ERROR_CODES.INVALID_SIGNATURE]: "署名の検証に失敗しました。",

  // 不明
  [PAYMENT_ERROR_CODES.UNKNOWN]: "予期しないエラーが発生しました。",
};

/**
 * エラーコードからユーザー向けメッセージを取得
 * @param errorCode エラーコード
 * @returns ユーザー向けメッセージ
 */
export function getPaymentErrorMessage(errorCode: string | undefined): string {
  if (!errorCode) {
    return PAYMENT_ERROR_MESSAGES[PAYMENT_ERROR_CODES.UNKNOWN];
  }
  return (
    PAYMENT_ERROR_MESSAGES[errorCode as PaymentErrorCode] ??
    PAYMENT_ERROR_MESSAGES[PAYMENT_ERROR_CODES.UNKNOWN]
  );
}

/**
 * プロバイダ固有エラーを汎用エラーコードにマッピングするヘルパー
 * ダウンストリームで各プロバイダ用のマッピングを定義する際に使用
 *
 * @example
 * const stripeErrorMap: ProviderErrorMapping = {
 *   'card_declined': PAYMENT_ERROR_CODES.CARD_DECLINED,
 *   'expired_card': PAYMENT_ERROR_CODES.CARD_EXPIRED,
 *   'insufficient_funds': PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS,
 * };
 */
export type ProviderErrorMapping = Record<string, PaymentErrorCode>;

/**
 * プロバイダ固有エラーを汎用エラーコードに変換
 * @param providerErrorCode プロバイダ固有のエラーコード
 * @param mapping エラーマッピング
 * @returns 汎用エラーコード
 */
export function mapProviderError(
  providerErrorCode: string | undefined,
  mapping: ProviderErrorMapping
): PaymentErrorCode {
  if (!providerErrorCode) {
    return PAYMENT_ERROR_CODES.UNKNOWN;
  }
  return mapping[providerErrorCode] ?? PAYMENT_ERROR_CODES.UNKNOWN;
}
