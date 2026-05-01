// src/features/core/wallet/components/WalletPurchasePage/CurrencyPurchase.tsx

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Stack } from "@/components/Layout/Stack";
import { useCoinPurchase } from "@/features/core/purchaseRequest/hooks/useCoinPurchase";
import type { WalletType } from "@/config/app/currency.config";
import type { PurchaseDiscountEffect } from "@/features/core/purchaseRequest/types/couponEffect";
import { setActiveCoupon, clearActiveCoupon } from "@/features/core/wallet/utils/couponParam";
import { useActiveBankTransfer } from "@/features/core/bankTransferReview/hooks/useActiveBankTransfer";

import { SupportedPaymentMethods, type BlockedPaymentMethod } from "../common/SupportedPaymentMethods";

// payment.config.ts の paymentMethods[].id と一致させる（自社銀行振込のメソッド ID）
const INHOUSE_BANK_TRANSFER_METHOD_ID = "bank_transfer_inhouse";

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

  // 支払い方法の選択状態（未選択 = null）
  // 未選択時は購入ボタンを非活性にし、選択を強制する
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);

  // 進行中の自社銀行振込を取得し、ある場合は bank_transfer_inhouse を選択不可化する
  // （サーバー側の validateInitiation が並行ブロックする仕様の UI 反映）
  const { data: activeBankTransfer } = useActiveBankTransfer();
  const hasActiveBankTransfer = Boolean(activeBankTransfer?.active);

  const blockedMethods = useMemo<BlockedPaymentMethod[]>(() => {
    if (!hasActiveBankTransfer) return [];
    return [
      {
        id: INHOUSE_BANK_TRANSFER_METHOD_ID,
        badge: "進行中",
        message: "現在お振込み中のご購入があります",
      },
    ];
  }, [hasActiveBankTransfer]);

  // 選択中のメソッドが後からブロック対象になった場合は未選択に戻す（押下できないボタンが選択状態のまま残るのを防ぐ）
  useEffect(() => {
    if (selectedPaymentMethod && blockedMethods.some((b) => b.id === selectedPaymentMethod)) {
      setSelectedPaymentMethod(null);
    }
  }, [blockedMethods, selectedPaymentMethod]);

  // 実際の支払い金額（割引適用後）
  const actualPaymentAmount = couponEffect?.finalPaymentAmount ?? paymentAmount;

  // 決済プロバイダに渡す商品名（UIには表示されない）
  // 通貨種別を含めない汎用表記にしてプロバイダ側のレシート/管理画面でも中立的に表示
  const itemName = `商品購入 ${purchaseAmount.toLocaleString()}`;

  const { purchase, isLoading, error } = useCoinPurchase({
    walletType,
    amount: purchaseAmount,
    paymentAmount,
    paymentMethod: selectedPaymentMethod ?? "",
    itemName,
    couponCode: couponCode ?? undefined,
  });

  const handleCouponApply = useCallback((code: string, effect: PurchaseDiscountEffect) => {
    setCouponCode(code);
    setCouponEffect(effect);
    setActiveCoupon(code);
  }, []);

  const handleCouponClear = useCallback(() => {
    setCouponCode(null);
    setCouponEffect(null);
    clearActiveCoupon();
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
        purchaseAmount={purchaseAmount}
        onApply={handleCouponApply}
        onClear={handleCouponClear}
      />
      <SupportedPaymentMethods
        value={selectedPaymentMethod}
        onChange={setSelectedPaymentMethod}
        blockedMethods={blockedMethods}
      />
      <PurchaseButton
        onPurchase={purchase}
        isLoading={isLoading}
        error={error}
        disabled={selectedPaymentMethod === null}
        disabledLabel="決済方法が未選択"
      />
    </Stack>
  );
}
