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
 *
 * sessionExpiryMinutes: 決済セッション（purchase_request.expires_at）の有効期限（分）。
 * - 未指定時はコア側のデフォルト（30 分）が使われる。
 * - 銀行振込のように振込確定までユーザーの実時間が必要なプロバイダで延長する用途。
 */
export type ProviderConfig = {
  /** 有効/無効 */
  enabled: boolean;
  /** config ID → プロバイダAPI固有ID の変換マップ */
  methodMapping?: Record<string, string>;
  /**
   * 決済セッションの有効期限（分）。
   * 未指定時はデフォルト（PROVIDER_DEFAULT_SESSION_EXPIRY_MINUTES = 30）が適用される。
   */
  sessionExpiryMinutes?: number;
};

/**
 * 自社受付の銀行振込（inhouse プロバイダ）固有の設定。
 *
 * - autoComplete: 振込完了申告 API が呼ばれたときの挙動切替。
 *   - true:  即時に completePurchase を実行し通貨を付与する（管理者確認なし）。
 *   - false: 管理者確認待ちフロー（今回スコープ外。API は 501 を返す）。
 * - account: 振込案内画面に表示する自社の振込先口座情報。事業者ごとに書き換える。
 *
 * このプロバイダは外部 Webhook を持たない自社決済方法のため、振込完了の起点は
 * ユーザーの自己申告 API (POST /api/wallet/purchase/[id]/bank-transfer/confirm) となる。
 */
export type BankTransferConfig = {
  /** 振込完了申告時に即時で通貨を付与するか（false=管理者確認モード・今回スコープ外） */
  autoComplete: boolean;
  /** 振込先口座情報（案内画面に表示） */
  account: {
    bankName: string;
    branchName: string;
    /** 支店コード（3 桁数字。案内画面では「支店名 (コード)」形式で表示） */
    branchCode: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
  };
};

/**
 * プロバイダ設定の sessionExpiryMinutes 未指定時のデフォルト（分）。
 * 既存挙動（initiatePurchase の固定値 30 分）と一致させている。
 */
export const PROVIDER_DEFAULT_SESSION_EXPIRY_MINUTES = 30;

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
    /**
     * 自社受付の銀行振込プロバイダ。
     * 外部決済プロバイダを介さず、ユーザーが指定の口座に振り込み、
     * 振込完了をユーザー自身が画面から申告するフロー。
     * sessionExpiryMinutes を 7 日に設定（営業日跨ぎの振込に対応）。
     */
    inhouse: {
      enabled: true,
      sessionExpiryMinutes: 60 * 24 * 7,
    },
  } as Record<string, ProviderConfig>,

  /**
   * inhouse プロバイダ（自社銀行振込）の設定。
   * 振込先口座は事業者ごとに必ず書き換えること。
   */
  bankTransfer: {
    autoComplete: true,
    account: {
      bankName: "サンプル銀行",
      branchName: "サンプル支店",
      branchCode: "000",
      accountType: "普通",
      accountNumber: "0000000",
      accountHolder: "サンプル（カ",
    },
  } as BankTransferConfig,

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
    // { id: "bank_transfer", label: "銀行振込（仮想口座）", description: "Fincode の仮想口座で受付", icon: "bank", status: "available", provider: "fincode" },
    /**
     * 自社受付の銀行振込。
     * - 外部決済プロバイダを介さず、画面上に表示する自社の口座へ直接振り込んでもらう。
     * - 振込完了はユーザーが画面から自己申告（POST /api/wallet/purchase/[id]/bank-transfer/confirm）。
     * - fincode 仮想口座とは別メソッドとして並立。
     */
    { id: "bank_transfer_inhouse", label: "リアルタイム銀行振込", description: "手続き後に即時反映されます", icon: "bank", status: "available", provider: "inhouse" },
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
 * 指定プロバイダの決済セッション有効期限（分）を取得する。
 * 未指定時は PROVIDER_DEFAULT_SESSION_EXPIRY_MINUTES（30 分）を返す。
 *
 * initiatePurchase が purchase_request.expires_at を計算する際に使用する。
 */
export function getProviderSessionExpiryMinutes(providerName: string): number {
  return (
    paymentConfig.providers[providerName]?.sessionExpiryMinutes ??
    PROVIDER_DEFAULT_SESSION_EXPIRY_MINUTES
  );
}

/**
 * inhouse プロバイダの銀行振込設定を取得する。
 * 振込案内 UI と振込完了申告 API の両方から参照される。
 */
export function getBankTransferConfig(): BankTransferConfig {
  return paymentConfig.bankTransfer;
}

/**
 * 決済設定の型
 */
export type PaymentConfig = typeof paymentConfig;
