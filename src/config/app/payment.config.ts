// src/config/app/payment.config.ts
// 決済システムの設定ファイル
//
// 設計原則:
// - **1メソッド = 1プロバイダ**: 各支払い方法は paymentMethods[i].provider で
//   担当プロバイダを明示する（ソースオブトゥルース）。
//   解決は resolveProviderForMethod() を経由する。
// - プロバイダ別の API 名変換は providers[*].methodMapping で表現。
// - ダウンストリームでプロバイダや支払い方法を追加する場合は、このファイルの
//   paymentMethods および providers を拡張する（コードロジックの変更は不要）。

/**
 * 支払い方法のステータス
 * - available: 利用可能（決済画面に表示・選択可）
 * - coming_soon: 準備中（UI表示するがバッジ付き・選択不可）
 * - disabled: 無効（UIに表示しない）
 */
export type PaymentMethodStatus = "available" | "coming_soon" | "disabled";

/**
 * 支払い方法の定義
 *
 * provider:
 *   - status="available" の場合は必須。担当プロバイダ名を指定する。
 *   - status="coming_soon" / "disabled" の場合は任意（将来 available 化する際に設定）。
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
  /**
   * 担当プロバイダ名。
   * status="available" の場合は必須（未指定だと resolveProviderForMethod が undefined を返し API が 400 を返す）。
   */
  provider?: string;
};

/**
 * プロバイダ設定
 *
 * methodMapping: 共通 paymentMethod ID → プロバイダ API 固有 ID への変換マップ。
 * - 例: Fincode の "credit_card" → "Card"
 * - mapping が無い場合は paymentMethod ID をそのまま渡す（プロバイダが共通 ID を解釈する場合）。
 */
export type ProviderConfig = {
  /** 有効/無効 */
  enabled: boolean;
  /** config ID → プロバイダAPI固有ID の変換マップ */
  methodMapping?: Record<string, string>;
};

/**
 * 決済設定
 */
export const paymentConfig = {
  /**
   * プロバイダ別設定
   * ダウンストリームでプロバイダを追加する場合はここに enabled / methodMapping を定義する。
   */
  providers: {
    dummy: {
      enabled: true,
    },
    fincode: {
      enabled: true,
      methodMapping: {
        credit_card: "Card",
        convenience_store: "Konbini",
        paypay: "Paypay",
        bank_transfer: "Virtualaccount",
      },
    },
    square: {
      enabled: true,
      methodMapping: {
        credit_card: "card",
      },
    },
    stripe: {
      enabled: true,
      methodMapping: {
        credit_card: "card",
      },
    },
  } as Record<string, ProviderConfig>,

  /**
   * デバッグログ
   * true にすると決済プロバイダーの Webhook ペイロードやリクエストボディを
   * 全体出力する。PII（メールアドレス、電話番号等）を含むため、
   * 本番環境では false にすること。
   */
  debugLog: false,

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
      stripe: "Stripe-Signature",
      // komoju: "X-Komoju-Signature",
    } as Record<string, string | null>,
  },

  /**
   * 支払い方法の定義（UIで使用）
   *
   * - provider: status="available" の場合に担当プロバイダを指定する。
   *   ダウンストリームで切替えたい場合はここを書き換えるだけで配信先プロバイダが変わる。
   * - 同一プロバイダが複数の支払い方法を担当することは可能。
   * - 同一の支払い方法 ID を複数プロバイダで担当することは禁止
   *   （1メソッド = 1プロバイダの原則）。
   */
  paymentMethods: [
    { id: "credit_card", label: "クレジットカード", description: "VISA / Mastercard / JCB / AMEX / Diners", icon: "credit-card", status: "available", provider: "fincode" },
    { id: "convenience_store", label: "コンビニ決済", description: "セブン-イレブン / ファミリーマート / ローソン", icon: "store", status: "available", provider: "fincode" },
    { id: "bank_transfer", label: "銀行振込", icon: "bank", status: "available", provider: "fincode" },
    { id: "paypay", label: "PayPay", icon: "paypay", status: "coming_soon", provider: "fincode" },
    { id: "amazon_pay", label: "Amazon Pay", icon: "amazon", status: "disabled" },
  ] as PaymentMethodConfig[],
} as const;

// ============================================================================
// ヘルパー関数
// ============================================================================

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
 * 指定された支払い方法 ID の定義を取得
 */
export function getPaymentMethodById(methodId: string): PaymentMethodConfig | undefined {
  return paymentConfig.paymentMethods.find((m) => m.id === methodId);
}

/**
 * 支払い方法 ID が選択可能か（status="available" かつ provider が enabled）を判定
 */
export function isPaymentMethodSelectable(methodId: string): boolean {
  const method = getPaymentMethodById(methodId);
  if (!method || method.status !== "available" || !method.provider) {
    return false;
  }
  const provider = paymentConfig.providers[method.provider];
  return Boolean(provider?.enabled);
}

/**
 * 選択された支払い方法に対応するプロバイダ名を解決する
 *
 * - status="available" 以外、provider 未設定、provider が disabled の場合は undefined を返す
 *   （呼び出し側で 400 エラー等として扱うこと）
 */
export function resolveProviderForMethod(methodId: string): string | undefined {
  const method = getPaymentMethodById(methodId);
  if (!method || method.status !== "available" || !method.provider) {
    return undefined;
  }
  const provider = paymentConfig.providers[method.provider];
  if (!provider?.enabled) {
    return undefined;
  }
  return method.provider;
}

/**
 * 共通 paymentMethod ID をプロバイダ API 固有 ID に変換する
 *
 * - methodMapping が存在しない / mapping にエントリが無い場合は methodId をそのまま返す
 *   （プロバイダが共通 ID を解釈する想定の dummy 等で利用）
 * - 共通 ID をそのまま使えないプロバイダで mapping が欠けている場合は呼び出し側でエラーにすべき
 */
export function getProviderApiMethodId(providerName: string, methodId: string): string {
  const provider = paymentConfig.providers[providerName];
  return provider?.methodMapping?.[methodId] ?? methodId;
}

/**
 * 指定プロバイダが担当する全 available メソッドの API 固有 ID 一覧を取得
 *
 * paymentMethods から逆引きし、methodMapping で API 名に変換する。
 * Fincode の `pay_type` 一括指定など「プロバイダの全担当メソッド」が必要な箇所で利用。
 */
export function getProviderPayTypes(providerName: string): string[] {
  return paymentConfig.paymentMethods
    .filter((m) => m.status === "available" && m.provider === providerName)
    .map((m) => getProviderApiMethodId(providerName, m.id))
    .filter(Boolean);
}

/**
 * 指定プロバイダが担当する全 available メソッドの定義を取得
 */
export function getProviderPaymentMethods(providerName: string): PaymentMethodConfig[] {
  return paymentConfig.paymentMethods.filter(
    (m) => m.status === "available" && m.provider === providerName,
  );
}

/**
 * 決済設定の型
 */
export type PaymentConfig = typeof paymentConfig;
