// src/features/core/purchaseRequest/services/server/payment/index.ts

import type { PaymentProvider } from "@/features/core/purchaseRequest/types/payment";
import { dummyPaymentProvider } from "./dummyProvider";
import { fincodePaymentProvider } from "./fincode";
import { squarePaymentProvider } from "./square";
import { stripePaymentProvider } from "./stripe";
import { inhousePaymentProvider } from "./inhouse";
import { paidyPaymentProvider } from "./paidy";
import { paypalPaymentProvider } from "./paypal";

export type { PaymentProvider, CreatePaymentSessionParams, PaymentSession, PaymentResult } from "@/features/core/purchaseRequest/types/payment";

/**
 * 利用可能な決済プロバイダ名
 *
 * - inhouse: 自社受付の銀行振込（外部 Webhook を持たず、ユーザーの自己申告 API で完了）
 * - paidy: BNPL（あと払い）。client_sdk 起動方式（paidy.js）。クライアントの sdkLaunchers["paidy"]
 *   がモーダルを launch し、完了後に /api/wallet/purchase/[id]/paidy/confirm で確定する
 * - paypal: PayPal 直接連携。client_sdk 起動方式（PayPal JS SDK ボタン）。createSession で
 *   Orders v2 の Order を作成し、onApprove 後に /api/wallet/purchase/[id]/paypal/confirm で capture 確定する
 */
export type PaymentProviderName = "dummy" | "komoju" | "fincode" | "square" | "stripe" | "inhouse" | "paidy" | "paypal";

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

    case "paidy":
      return paidyPaymentProvider;

    case "paypal":
      return paypalPaymentProvider;

    case "komoju":
      // TODO: KOMOJU実装後に有効化
      throw new Error("KOMOJU provider is not implemented yet");

    default:
      throw new Error(`Unknown payment provider: ${providerName}`);
  }
}
