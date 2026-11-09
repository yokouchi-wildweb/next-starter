// src/features/core/purchaseRequest/utils/paymentMethods.ts
// 決済の設定(purchaseRequestConfig.payment)を読む関数(設定の議会 D3・D71: 値でなく処理なので config から出した。名前は今のまま)
// 決済機能全体の有効/無効は APP_FEATURES.payment.enabled(門番の規則 payment の入切。設定の地区クエストでは触らない)

import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  purchaseRequestConfig,
  type BankTransferConfig,
  type PaymentMethodConfig,
} from "@/features/purchaseRequest/config";
import { isProduction } from "@/lib/appEnv";

/**
 * 利用可能な支払い方法を取得（status: "available" のみ）
 */
export function getAvailablePaymentMethods(): PaymentMethodConfig[] {
  return purchaseRequestConfig.payment.paymentMethods.filter((m) => m.status === "available");
}

/**
 * UI表示対象の支払い方法を取得（disabled 以外 = available + coming_soon）
 */
export function getVisiblePaymentMethods(): PaymentMethodConfig[] {
  return purchaseRequestConfig.payment.paymentMethods.filter((m) => m.status !== "disabled");
}

/**
 * 指定された支払い方法 ID の定義を取得
 */
export function getPaymentMethodById(methodId: string): PaymentMethodConfig | undefined {
  return purchaseRequestConfig.payment.paymentMethods.find((m) => m.id === methodId);
}

/**
 * 支払い方法 ID が選択可能か（決済機能が有効 かつ status="available" かつ provider が enabled）を判定
 */
export function isPaymentMethodSelectable(methodId: string): boolean {
  if (!APP_FEATURES.payment.enabled) {
    return false;
  }
  const method = getPaymentMethodById(methodId);
  if (!method || method.status !== "available" || !method.provider) {
    return false;
  }
  const provider = purchaseRequestConfig.payment.providers[method.provider];
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
  const provider = purchaseRequestConfig.payment.providers[method.provider];
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
  const provider = purchaseRequestConfig.payment.providers[providerName];
  return provider?.methodMapping?.[methodId] ?? methodId;
}

/**
 * 指定プロバイダが担当する全 available メソッドの API 固有 ID 一覧を取得
 *
 * paymentMethods から逆引きし、methodMapping で API 名に変換する。
 * Fincode の `pay_type` 一括指定など「プロバイダの全担当メソッド」が必要な箇所で利用。
 */
export function getProviderPayTypes(providerName: string): string[] {
  return purchaseRequestConfig.payment.paymentMethods
    .filter((m) => m.status === "available" && m.provider === providerName)
    .map((m) => getProviderApiMethodId(providerName, m.id))
    .filter(Boolean);
}

/**
 * 指定プロバイダが担当する全 available メソッドの定義を取得
 */
export function getProviderPaymentMethods(providerName: string): PaymentMethodConfig[] {
  return purchaseRequestConfig.payment.paymentMethods.filter(
    (m) => m.status === "available" && m.provider === providerName,
  );
}

/**
 * 指定プロバイダの決済セッション有効期限（分）を取得する。
 * 未指定時は purchaseRequestConfig.providerDefaultSessionExpiryMinutes（30 分）を返す。
 *
 * initiatePurchase が purchase_request.expires_at を計算する際に使用する。
 */
export function getProviderSessionExpiryMinutes(providerName: string): number {
  return (
    purchaseRequestConfig.payment.providers[providerName]?.sessionExpiryMinutes ??
    purchaseRequestConfig.providerDefaultSessionExpiryMinutes
  );
}

/**
 * inhouse プロバイダの銀行振込設定を取得する。
 * 振込案内 UI と振込完了申告 API の両方から参照される。
 */
export function getBankTransferConfig(): BankTransferConfig {
  assertBankTransferAccountConfigured();
  return purchaseRequestConfig.payment.bankTransfer;
}

/** 上流の既定の振込先口座(仮の値)。この値のまま自社振込を開けると本番で止める(設定 D68) */
export const PLACEHOLDER_BANK_TRANSFER_ACCOUNT: BankTransferConfig["account"] = {
  bankName: "サンプル銀行",
  branchName: "サンプル支店",
  branchCode: "000",
  accountType: "普通",
  accountNumber: "0000000",
  accountHolder: "サンプル（カ",
};

/**
 * 書き換え忘れの検査(設定 D68): 自社振込(bank_transfer_inhouse)が選べるのに振込先口座が仮の値のままなら、本番では止める。
 * 開発・ステージングでは通す(仮の口座で動作を確かめられるように)。読むのは振込案内と振込完了申告の側(getBankTransferConfig)
 */
export function assertBankTransferAccountConfigured(
  account: BankTransferConfig["account"] = purchaseRequestConfig.payment.bankTransfer.account,
  inhouseSelectable: boolean = isPaymentMethodSelectable("bank_transfer_inhouse"),
  production: boolean = isProduction(),
): void {
  if (!production || !inhouseSelectable) return;
  const placeholder = (Object.keys(PLACEHOLDER_BANK_TRANSFER_ACCOUNT) as (keyof BankTransferConfig["account"])[]).every(
    (key) => account[key] === PLACEHOLDER_BANK_TRANSFER_ACCOUNT[key],
  );
  if (placeholder) {
    throw new Error(
      "[purchaseRequest] 自社振込(bank_transfer_inhouse)が有効なのに、振込先口座が上流の仮の値のままです。src/config/features/purchaseRequest.config.ts の payment.bankTransfer.account に自社の口座を書いてください",
    );
  }
}
