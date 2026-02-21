// src/config/app/payment.config.ts
// 決済システムの設定ファイル
// ※ダウンストリームでプロバイダを追加する際はこのファイルを拡張する

/**
 * 支払い方法のステータス
 * - available: 利用可能（決済画面に表示・選択可）
 * - coming_soon: 準備中（UI表示するがバッジ付き・選択不可）
 * - disabled: 無効（UIに表示しない）
 */
export type PaymentMethodStatus = "available" | "coming_soon" | "disabled";

/**
 * 支払い方法の定義
 */
export type PaymentMethodConfig = {
  /** 支払い方法ID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 補足説明（対応ブランド等、UI表示用） */
  description?: string;
  /** アイコン識別子（UIで使用） */
  icon: string;
  /** ステータス */
  status: PaymentMethodStatus;
};

/**
 * プロバイダ設定
 */
export type ProviderConfig = {
  /** 有効/無効 */
  enabled: boolean;
  /** 対応する支払い方法ID一覧 */
  supportedMethods?: string[];
  /** config ID → プロバイダAPI固有ID の変換マップ */
  methodMapping?: Record<string, string>;
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
      methodMapping: {
        credit_card: "Card",
        convenience_store: "Konbini",
        paypay: "Paypay",
        bank_transfer: "Virtualaccount",
      },
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
    { id: "credit_card", label: "クレジットカード", description: "VISA / Mastercard", icon: "credit-card", status: "available" },
    { id: "convenience_store", label: "コンビニ決済", icon: "store", status: "available" },
    { id: "bank_transfer", label: "銀行振込", icon: "bank", status: "available" },
    { id: "paypay", label: "PayPay", icon: "paypay", status: "disabled" },
    { id: "amazon_pay", label: "Amazon Pay", icon: "amazon", status: "disabled" },
  ] as PaymentMethodConfig[],
} as const;

/**
 * 利用可能な支払い方法を取得（status: "available" のみ）
 */
export function getAvailablePaymentMethods(): PaymentMethodConfig[] {
  return paymentConfig.paymentMethods.filter((m) => m.status === "available");
}

/**
 * UI表示対象の支払い方法を取得（disabled 以外 = available + coming_soon）
 */
export function getVisiblePaymentMethods(): PaymentMethodConfig[] {
  return paymentConfig.paymentMethods.filter((m) => m.status !== "disabled");
}

/**
 * プロバイダがサポートする支払い方法を取得（available のみ）
 */
export function getProviderPaymentMethods(providerName: string): PaymentMethodConfig[] {
  const provider = paymentConfig.providers[providerName];
  if (!provider?.supportedMethods) {
    return getAvailablePaymentMethods();
  }
  return paymentConfig.paymentMethods.filter(
    (m) => m.status === "available" && provider.supportedMethods?.includes(m.id)
  );
}

/**
 * プロバイダの有効な支払い方法をプロバイダAPI固有のIDに変換して取得する
 *
 * paymentMethods の status と providers の supportedMethods を両方考慮し、
 * methodMapping で変換した結果を返す。
 */
export function getProviderPayTypes(providerName: string): string[] {
  const provider = paymentConfig.providers[providerName];
  if (!provider?.supportedMethods || !provider.methodMapping) {
    return [];
  }

  const availableMethodIds = new Set(
    paymentConfig.paymentMethods
      .filter((m) => m.status === "available")
      .map((m) => m.id),
  );

  return provider.supportedMethods
    .filter((id) => availableMethodIds.has(id))
    .map((id) => provider.methodMapping![id])
    .filter(Boolean);
}

/**
 * 決済設定の型
 */
export type PaymentConfig = typeof paymentConfig;
