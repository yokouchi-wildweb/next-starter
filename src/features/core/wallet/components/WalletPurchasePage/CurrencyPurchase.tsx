// src/features/core/wallet/components/WalletPurchasePage/CurrencyPurchase.tsx

"use client";

import { Stack } from "@/components/Layout/Stack";
import { useCoinPurchase } from "@/features/core/purchaseRequest/hooks/useCoinPurchase";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

import { PurchaseButton } from "./PurchaseButton";
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
  // 通貨設定から商品名を生成
  const currencyConfig = CURRENCY_CONFIG[walletType];
  const itemName = `${currencyConfig.label} ${purchaseAmount.toLocaleString()}${currencyConfig.unit}`;

  const { purchase, isLoading, error } = useCoinPurchase({
    walletType,
    amount: purchaseAmount,
    paymentAmount,
    itemName,
  });

  return (
    <Stack space={6}>
      <PurchaseSummaryCard
        purchaseAmount={purchaseAmount}
        paymentAmount={paymentAmount}
        currentBalance={currentBalance}
        walletType={walletType}
      />
      <PurchaseButton
        onPurchase={purchase}
        isLoading={isLoading}
        error={error}
      />
    </Stack>
  );
}
