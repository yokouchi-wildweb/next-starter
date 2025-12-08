// src/features/core/wallet/components/CoinPurchasePage/index.tsx

"use client";

import { useState } from "react";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useWalletBalances } from "@/features/core/wallet/hooks/useWalletBalances";
import { CurrencyPurchase } from "../CurrencyPurchase";
import { PurchasePackageSelector } from "./PurchasePackageSelector";

/** 購入パッケージ定義 */
const PURCHASE_PACKAGES = [
  { id: "100", amount: 100, price: 100, label: "100コイン" },
  { id: "500", amount: 500, price: 480, label: "500コイン", bonus: "4%お得" },
  { id: "1000", amount: 1000, price: 900, label: "1,000コイン", bonus: "10%お得" },
  { id: "3000", amount: 3000, price: 2500, label: "3,000コイン", bonus: "17%お得" },
  { id: "5000", amount: 5000, price: 4000, label: "5,000コイン", bonus: "20%お得" },
] as const;

export function CoinPurchasePage() {
  const { user } = useAuthSession();
  const { data, isLoading, error } = useWalletBalances(user?.userId);
  const [selectedPackage, setSelectedPackage] = useState("100");

  // ローディング中
  if (isLoading) {
    return (
      <Flex justify="center" padding="lg">
        <Spinner className="h-8 w-8" />
      </Flex>
    );
  }

  // エラー
  if (error) {
    return (
      <Block padding="lg">
        <Para tone="danger" align="center">
          残高情報の取得に失敗しました。
        </Para>
      </Block>
    );
  }

  // regular_coin の残高を取得
  const coinWallet = data?.wallets.find((w) => w.type === "regular_coin");
  const currentBalance = coinWallet?.balance ?? 0;

  // 選択中のパッケージ
  const pkg = PURCHASE_PACKAGES.find((p) => p.id === selectedPackage) ?? PURCHASE_PACKAGES[0];

  return (
    <Block space="md">
      <PurchasePackageSelector
        packages={PURCHASE_PACKAGES}
        selectedId={selectedPackage}
        onSelect={setSelectedPackage}
      />
      <CurrencyPurchase
        purchaseAmount={pkg.amount}
        paymentAmount={pkg.price}
        currentBalance={currentBalance}
        label="コイン"
        walletType="regular_coin"
      />
    </Block>
  );
}
