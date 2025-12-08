// src/features/core/wallet/components/UserBalance/index.tsx

"use client";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button/Button";

import { BalanceCard } from "./BalanceCard";
import { PurchaseList } from "./PurchaseList";

type UserBalanceProps = {
  balance?: number;
  label?: string;
  onPurchase?: () => void;
};

export function UserBalance({
  balance = 1000,
  label = "コイン",
  onPurchase,
}: UserBalanceProps) {
  const handleHistoryClick = () => {
    // ダミー: 履歴ページへの遷移は後で実装
    console.log("履歴ボタンがクリックされました");
  };

  return (
    <Block space="md">
      <Flex justify="end">
        <Button variant="outline" size="sm" onClick={handleHistoryClick}>
          履歴
        </Button>
      </Flex>
      <BalanceCard balance={balance} label={label} />
      <PurchaseList label={label} onPurchase={onPurchase} />
    </Block>
  );
}
