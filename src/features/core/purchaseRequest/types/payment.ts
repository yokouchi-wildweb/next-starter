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
  /** 購入者メールアドレス（決済ページで事前入力） */
  buyerEmail?: string;
  /** 購入者電話番号（E.164形式、決済ページで事前入力） */
  buyerPhoneNumber?: string;
  /** プロバイダ固有のオプション（下流から自由に渡せる） */
  providerOptions?: Record<string, unknown>;
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
  /** プロバイダ側の取引ID（問い合わせ・追跡用） */
  transactionId?: string;
  /** 実際に使用された支払い方法 */
  paymentMethod?: string;
  /** 支払い完了日時 */
  paidAt?: Date;
  /** プロバイダ固有データ（デバッグ用） */
  rawResponse?: unknown;
  /** エラーコード */
  errorCode?: string;
  /** エラーメッセージ */
  errorMessage?: string;
};

/**
 * 決済ステータス照会結果（ポーリング用）
 */
export type PaymentStatusResult = {
  /** 決済ステータス */
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  /** 決済サービス側のセッションID */
  sessionId: string;
  /** プロバイダ側の取引ID */
  transactionId?: string;
  /** 支払い完了日時 */
  paidAt?: Date;
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

  /**
   * Webhook署名を検証（本文解析前の検証）
   * @param request HTTPリクエスト（clone済み）
   * @param signature 署名ヘッダーの値
   * @returns 署名が有効かどうか
   */
  verifyWebhookSignature?(request: Request, signature: string): Promise<boolean>;

  /**
   * 決済ステータスを照会（Webhook未着時のフォールバック用）
   * @param sessionId 決済セッションID
   * @returns 決済ステータス
   */
  getPaymentStatus?(sessionId: string): Promise<PaymentStatusResult>;
}
