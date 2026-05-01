// src/features/core/purchaseRequest/services/server/payment/index.ts

import type { PaymentProvider } from "@/features/core/purchaseRequest/types/payment";
import { dummyPaymentProvider } from "./dummyProvider";
import { fincodePaymentProvider } from "./fincode";
import { squarePaymentProvider } from "./square";
import { stripePaymentProvider } from "./stripe";
import { inhousePaymentProvider } from "./inhouse";

export type { PaymentProvider, CreatePaymentSessionParams, PaymentSession, PaymentResult } from "@/features/core/purchaseRequest/types/payment";

/**
 * 利用可能な決済プロバイダ名
 *
 * - inhouse: 自社受付の銀行振込（外部 Webhook を持たず、ユーザーの自己申告 API で完了）
 */
export type PaymentProviderName = "dummy" | "komoju" | "fincode" | "square" | "stripe" | "inhouse";

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

    case "inhouse":
      return inhousePaymentProvider;

    case "komoju":
      // TODO: KOMOJU実装後に有効化
      throw new Error("KOMOJU provider is not implemented yet");

    default:
      throw new Error(`Unknown payment provider: ${providerName}`);
  }
}
