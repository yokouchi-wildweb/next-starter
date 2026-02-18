// src/features/core/wallet/components/WalletPurchasePage/CurrencyPurchase.tsx

"use client";

import { useState, useCallback } from "react";
import { Stack } from "@/components/Layout/Stack";
import { useCoinPurchase } from "@/features/core/purchaseRequest/hooks/useCoinPurchase";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import type { PurchaseDiscountEffect } from "@/features/core/purchaseRequest/types/couponEffect";

import { PurchaseButton } from "./PurchaseButton";
import { PurchaseSummaryCard } from "./PurchaseSummaryCard";
import { CouponInput } from "./CouponInput";

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
  // クーポン状態
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponEffect, setCouponEffect] = useState<PurchaseDiscountEffect | null>(null);

  // 実際の支払い金額（割引適用後）
  const actualPaymentAmount = couponEffect?.finalPaymentAmount ?? paymentAmount;

  // 通貨設定から商品名を生成
  const currencyConfig = CURRENCY_CONFIG[walletType];
  const itemName = `${currencyConfig.label} ${purchaseAmount.toLocaleString()}${currencyConfig.unit}`;

  const { purchase, isLoading, error } = useCoinPurchase({
    walletType,
    amount: purchaseAmount,
    paymentAmount,
    itemName,
    couponCode: couponCode ?? undefined,
  });

  const handleCouponApply = useCallback((code: string, effect: PurchaseDiscountEffect) => {
    setCouponCode(code);
    setCouponEffect(effect);
  }, []);

  const handleCouponClear = useCallback(() => {
    setCouponCode(null);
    setCouponEffect(null);
  }, []);

  return (
    <Stack space={6}>
      <PurchaseSummaryCard
        purchaseAmount={purchaseAmount}
        paymentAmount={actualPaymentAmount}
        currentBalance={currentBalance}
        walletType={walletType}
        discountAmount={couponEffect?.discountAmount}
        originalPaymentAmount={couponEffect ? paymentAmount : undefined}
      />
      <CouponInput
        paymentAmount={paymentAmount}
        onApply={handleCouponApply}
        onClear={handleCouponClear}
      />
      <PurchaseButton
        onPurchase={purchase}
        isLoading={isLoading}
        error={error}
      />
    </Stack>
  );
}
