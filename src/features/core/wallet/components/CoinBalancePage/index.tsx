// src/features/core/wallet/components/CoinBalancePage/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Button } from "@/components/Form/Button/Button";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useWalletBalances } from "@/features/core/wallet/hooks/useWalletBalances";
import { BalanceCard } from "../UserBalance/BalanceCard";
import { PurchaseList } from "../UserBalance/PurchaseList";

export function CoinBalancePage() {
  const router = useRouter();
  const { user } = useAuthSession();
  const { data, isLoading, error } = useWalletBalances(user?.userId);

  const handleHistoryClick = () => {
    // TODO: 履歴ページへの遷移
    console.log("履歴ボタンがクリックされました");
  };

  const handlePurchaseClick = () => {
    router.push("/coins/purchase");
  };

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

  return (
    <Block space="md">
      <Flex justify="end">
        <Button variant="outline" size="sm" onClick={handleHistoryClick}>
          履歴
        </Button>
      </Flex>
      <BalanceCard balance={currentBalance} label="コイン" />
      <PurchaseList label="コイン" onPurchase={handlePurchaseClick} />
    </Block>
  );
}
