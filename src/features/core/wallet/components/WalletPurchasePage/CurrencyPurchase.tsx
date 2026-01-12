// src/features/core/wallet/components/WalletPurchasePage/CurrencyPurchase.tsx

"use client";

import { Block } from "@/components/Layout/Block";
import { useCoinPurchase } from "@/features/core/purchaseRequest/hooks/useCoinPurchase";
import type { WalletType } from "@/config/app/currency.config";

import { PaymentMethodForm } from "./PaymentMethodForm";
import { PurchaseSummaryCard } from "./PurchaseSummaryCard";

type CurrencyPurchaseProps = {
  /** 購入する数量 */
  purchaseAmount: number;
  /** 支払い金額（円） */
  paymentAmount: number;
  /** 現在の残高 */
  currentBalance: number;
  /** ウォレット種別 */
  walletType: WalletType;
};

export function CurrencyPurchase({
  purchaseAmount,
  paymentAmount,
  currentBalance,
  walletType,
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
        walletType={walletType}
      />
      <PaymentMethodForm
        onPurchase={purchase}
        isLoading={isLoading}
        error={error}
      />
    </Block>
  );
}
