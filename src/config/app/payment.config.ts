// src/config/app/payment.config.ts
// 決済システムの設定ファイル
// ※ダウンストリームでプロバイダを追加する際はこのファイルを拡張する

/**
 * 支払い方法の定義
 */
export type PaymentMethodConfig = {
  /** 支払い方法ID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** アイコン識別子（UIで使用） */
  icon: string;
  /** 有効/無効 */
  enabled?: boolean;
};

/**
 * プロバイダ設定
 */
export type ProviderConfig = {
  /** 有効/無効 */
  enabled: boolean;
  /** 対応する支払い方法ID一覧 */
  supportedMethods?: string[];
};

/**
 * 決済設定
 */
export const paymentConfig = {
  /**
   * デフォルトの決済プロバイダ
   * 環境変数 PAYMENT_PROVIDER で切り替え可能
   */
  defaultProvider: (process.env.PAYMENT_PROVIDER || "dummy") as string,

  /**
   * プロバイダ別設定
   * ダウンストリームで拡張する
   */
  providers: {
    dummy: {
      enabled: true,
      supportedMethods: ["credit_card", "convenience_store", "bank_transfer"],
    },
    fincode: {
      enabled: true,
      supportedMethods: ["credit_card", "convenience_store", "paypay", "bank_transfer"],
    },
    square: {
      enabled: true,
      supportedMethods: ["credit_card"],
    },
    // 以下はダウンストリームで追加
    // stripe: {
    //   enabled: true,
    //   supportedMethods: ["credit_card"],
    // },
  } as Record<string, ProviderConfig>,

  /**
   * Webhook設定
   */
  webhook: {
    /**
     * 署名検証に使用するヘッダー名のマッピング
     * null の場合は署名検証をスキップ（開発用）
     */
    signatureHeaders: {
      dummy: null,
      fincode: "Fincode-Signature",
      square: "x-square-hmacsha256-signature",
      // stripe: "Stripe-Signature",
      // komoju: "X-Komoju-Signature",
    } as Record<string, string | null>,
  },

  /**
   * 支払い方法の定義（UIで使用）
   * ダウンストリームで拡張可能
   */
  paymentMethods: [
    { id: "credit_card", label: "クレジットカード", icon: "credit-card", enabled: true },
    { id: "convenience_store", label: "コンビニ決済", icon: "store", enabled: true },
    { id: "bank_transfer", label: "銀行振込", icon: "bank", enabled: true },
    { id: "paypay", label: "PayPay", icon: "paypay", enabled: false },
    { id: "amazon_pay", label: "Amazon Pay", icon: "amazon", enabled: false },
  ] as PaymentMethodConfig[],
} as const;

/**
 * 有効な支払い方法を取得
 */
export function getEnabledPaymentMethods(): PaymentMethodConfig[] {
  return paymentConfig.paymentMethods.filter((m) => m.enabled !== false);
}

/**
 * プロバイダがサポートする支払い方法を取得
 */
export function getProviderPaymentMethods(providerName: string): PaymentMethodConfig[] {
  const provider = paymentConfig.providers[providerName];
  if (!provider?.supportedMethods) {
    return getEnabledPaymentMethods();
  }
  return paymentConfig.paymentMethods.filter(
    (m) => m.enabled !== false && provider.supportedMethods?.includes(m.id)
  );
}

/**
 * 決済設定の型
 */
export type PaymentConfig = typeof paymentConfig;
