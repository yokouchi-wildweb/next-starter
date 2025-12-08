// src/features/core/purchaseRequest/types/payment.ts

/**
 * 決済セッション作成パラメータ
 */
export type CreatePaymentSessionParams = {
  /** 購入リクエストID */
  purchaseRequestId: string;
  /** 支払い金額（円） */
  amount: number;
  /** ユーザーID */
  userId: string;
  /** 支払い成功時のリダイレクト先 */
  successUrl: string;
  /** キャンセル時のリダイレクト先 */
  cancelUrl: string;
  /** 追加メタデータ */
  metadata?: Record<string, string>;
};

/**
 * 決済セッション
 */
export type PaymentSession = {
  /** 決済サービス側のセッションID */
  sessionId: string;
  /** ユーザーをリダイレクトするURL */
  redirectUrl: string;
  /** セッションの有効期限 */
  expiresAt?: Date;
};

/**
 * 決済結果（Webhook から取得）
 */
export type PaymentResult = {
  /** 決済成功かどうか */
  success: boolean;
  /** 決済サービス側のセッションID */
  sessionId: string;
  /** エラーコード */
  errorCode?: string;
  /** エラーメッセージ */
  errorMessage?: string;
};

/**
 * 決済プロバイダインターフェース
 * 各決済サービス（KOMOJU, Stripe等）はこのインターフェースを実装する
 */
export interface PaymentProvider {
  /** プロバイダ名 */
  readonly providerName: string;

  /**
   * 決済セッションを作成
   * @param params セッション作成パラメータ
   * @returns 決済セッション情報（リダイレクトURL含む）
   */
  createSession(params: CreatePaymentSessionParams): Promise<PaymentSession>;

  /**
   * Webhookペイロードを検証・パース
   * @param request HTTPリクエスト
   * @returns 決済結果
   */
  verifyWebhook(request: Request): Promise<PaymentResult>;
}
