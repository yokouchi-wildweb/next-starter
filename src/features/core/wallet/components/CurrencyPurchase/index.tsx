// src/features/core/wallet/components/CurrencyPurchase/index.tsx

"use client";

import { Block } from "@/components/Layout/Block";
import { useCoinPurchase } from "@/features/core/purchaseRequest/hooks/useCoinPurchase";

import { PaymentMethodForm } from "./PaymentMethodForm";
import { PurchaseSummaryCard } from "./PurchaseSummaryCard";

type CurrencyPurchaseProps = {
  /** 購入するコイン数 */
  purchaseAmount: number;
  /** 支払い金額（円） */
  paymentAmount: number;
  /** 現在の残高 */
  currentBalance: number;
  /** ラベル（コイン等） */
  label?: string;
  /** ウォレット種別 */
  walletType?: string;
};

export function CurrencyPurchase({
  purchaseAmount,
  paymentAmount,
  currentBalance,
  label = "コイン",
  walletType = "regular_coin",
}: CurrencyPurchaseProps) {
  const { purchase, isLoading, error } = useCoinPurchase({
    walletType,
    amount: purchaseAmount,
    paymentAmount,
  });

  return (
    <Block space="md">
      <PurchaseSummaryCard
        purchaseAmount={purchaseAmount}
        paymentAmount={paymentAmount}
        currentBalance={currentBalance}
        label={label}
      />
      <PaymentMethodForm
        onPurchase={purchase}
        isLoading={isLoading}
        error={error}
      />
    </Block>
  );
}
