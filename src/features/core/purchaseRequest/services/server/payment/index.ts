// src/features/core/purchaseRequest/services/server/payment/index.ts

import type { PaymentProvider } from "@/features/core/purchaseRequest/types/payment";
import { dummyPaymentProvider } from "./dummyProvider";
import { fincodePaymentProvider } from "./fincode";
import { squarePaymentProvider } from "./square";
import { stripePaymentProvider } from "./stripe";

export type { PaymentProvider, CreatePaymentSessionParams, PaymentSession, PaymentResult } from "@/features/core/purchaseRequest/types/payment";

/**
 * 利用可能な決済プロバイダ名
 */
export type PaymentProviderName = "dummy" | "komoju" | "fincode" | "square" | "stripe";

/**
 * 決済プロバイダを取得
 * @param providerName プロバイダ名
 * @returns 決済プロバイダインスタンス
 * @throws 不明なプロバイダ名の場合
 */
export function getPaymentProvider(providerName: PaymentProviderName): PaymentProvider {
  switch (providerName) {
    case "dummy":
      if (process.env.NODE_ENV === "production") {
        throw new Error("Dummy payment provider is not allowed in production");
      }
      return dummyPaymentProvider;

    case "fincode":
      return fincodePaymentProvider;

    case "square":
      return squarePaymentProvider;

    case "stripe":
      return stripePaymentProvider;

    case "komoju":
      // TODO: KOMOJU実装後に有効化
      throw new Error("KOMOJU provider is not implemented yet");

    default:
      throw new Error(`Unknown payment provider: ${providerName}`);
  }
}

/**
 * デフォルトの決済プロバイダ名を取得
 * 環境変数で切り替え可能
 */
export function getDefaultProviderName(): PaymentProviderName {
  const envProvider = process.env.PAYMENT_PROVIDER;
  if (envProvider === "fincode") {
    return "fincode";
  }
  if (envProvider === "square") {
    return "square";
  }
  if (envProvider === "stripe") {
    return "stripe";
  }
  if (envProvider === "komoju") {
    return "komoju";
  }
  return "dummy";
}
